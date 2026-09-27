import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BellOff, CheckCheck, Settings } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
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
  const { open, readAll } = useNotificationActions();

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

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Updates about trips, buses and uploads at your school. Kept for 30 days."
        action={
          <>
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
              <NotificationItem key={item._id} item={item} onOpen={(n) => open(n)} />
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
    </div>
  );
}
