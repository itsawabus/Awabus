import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BellOff, CheckCheck, ListChecks, Settings, Trash2, X } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { PillTabs } from '../../components/ui/Tabs.jsx';
import NotificationItem from '../../components/notifications/NotificationItem.jsx';
import { useNotificationActions } from '../../components/notifications/useNotifications.js';
import { getNotifications } from '../../api/notifications.js';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'critical', label: 'Critical' },
  { value: 'trips', label: 'Trips' },
  { value: 'fleet', label: 'Fleet' },
  { value: 'account', label: 'Uploads' },
];
const PAGE_SIZE = 20;

export default function Notifications() {
  usePageHeader({ breadcrumb: ['AwaBus', 'Notifications'] });
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { open, readAll, removeOne, removeMany } = useNotificationActions();
  // Selection mode: tick notifications, then delete them together.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [confirm, setConfirm] = useState(null); // 'selected' | 'all' | null
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const toggle = (item) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item._id)) next.delete(item._id);
      else next.add(item._id);
      return next;
    });

  const params = {
    page,
    limit: PAGE_SIZE,
    ...(filter === 'unread' ? { status: 'unread' } : filter !== 'all' ? { category: filter } : {}),
  };
  const { data, isLoading, isError } = useQuery({
    queryKey: ['notifications', 'list', params],
    queryFn: () => getNotifications(params),
    placeholderData: (prev) => prev,
  });
  const items = data?.data || [];
  const unread = data?.counts?.unread || 0;
  const total = data?.meta?.total || 0;
  const allOnPage = items.length > 0 && items.every((n) => selected.has(n._id));
  const runDelete = () => {
    const body = confirm === 'all' ? { all: true } : { ids: [...selected] };
    removeMany.mutate(body, {
      onSettled: () => {
        setConfirm(null);
        stopSelecting();
        setPage(1);
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Updates about trips, buses and uploads at your school. Deleted automatically after 30 days, or delete them yourself (only for you)."
        action={
          <>
            {!selecting && (
              <Button variant="outline" onClick={() => setSelecting(true)} disabled={!items.length}>
                <ListChecks className="h-4 w-4" /> Select
              </Button>
            )}
            <Button variant="outline" onClick={() => setConfirm('all')} disabled={!total}>
              <Trash2 className="h-4 w-4" /> Delete all
            </Button>
            <Link to="/account/settings#notifications">
              <Button variant="outline">
                <Settings className="h-4 w-4" /> Notification settings
              </Button>
            </Link>
            <Button onClick={() => readAll.mutate()} disabled={!unread} loading={readAll.isPending}>
              <CheckCheck className="h-4 w-4" /> Mark all as read
            </Button>
          </>
        }
      />

      <PillTabs
        className="mb-4"
        tabs={FILTERS.map((f) => (f.value === 'unread' && unread ? { ...f, label: `Unread (${unread})` } : f))}
        active={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
      />

      {selecting && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-navy-light">
          <span className="mr-auto text-sm font-semibold text-slate-800 dark:text-slate-100">
            {selected.size ? `${selected.size} selected` : 'Tick the notifications to delete'}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setSelected((prev) => {
                const next = new Set(prev);
                items.forEach((n) => (allOnPage ? next.delete(n._id) : next.add(n._id)));
                return next;
              })
            }
          >
            {allOnPage ? 'Unselect this page' : 'Select all on this page'}
          </Button>
          <Button size="sm" variant="danger" disabled={!selected.size} onClick={() => setConfirm('selected')}>
            <Trash2 className="h-4 w-4" /> Delete{selected.size ? ` (${selected.size})` : ''}
          </Button>
          <button
            type="button"
            onClick={stopSelecting}
            aria-label="Done selecting"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-navy"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="px-6 py-16 text-center text-sm text-red-600">Couldn&apos;t load notifications. Try again shortly.</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={filter === 'unread' ? 'Nothing unread' : 'No notifications here'}
            description="Trip, bus and upload updates for your school will show up here as they happen."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <NotificationItem
                key={item._id}
                item={item}
                onOpen={(n) => open(n)}
                onDelete={(n) => removeOne.mutate(n._id)}
                selecting={selecting}
                selected={selected.has(item._id)}
                onToggle={toggle}
              />
            ))}
          </div>
        )}
        <div className="px-5">
          <Pagination
            page={page}
            totalPages={data?.meta?.totalPages || 1}
            onChange={setPage}
            label={data?.meta ? `${data.meta.total} notification${data.meta.total === 1 ? '' : 's'}` : ''}
          />
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm === 'all' ? 'Delete all notifications?' : `Delete ${selected.size} notification${selected.size === 1 ? '' : 's'}?`}
        message={
          confirm === 'all'
            ? `${filter === 'all' ? `All ${total} of your notifications` : 'All your notifications, in every tab (not only this one),'} will be deleted. Other admins at your school still see theirs.`
            : 'They will be deleted for you. Other admins at your school still see them.'
        }
        confirmLabel="Delete"
        loading={removeMany.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={runDelete}
      />
    </div>
  );
}
