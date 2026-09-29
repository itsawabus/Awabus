import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck, Settings } from 'lucide-react';
import { getNotifications } from '../../api/notifications.js';
import NotificationItem from './NotificationItem.jsx';
import { useNotificationActions, useUnreadCount } from './useNotifications.js';
import Spinner from '../ui/Spinner.jsx';
import { cn } from '../../lib/utils.js';

const PANEL_SIZE = 8;

/** Top-bar bell: unread badge plus a panel with the latest notifications. */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { data: count } = useUnreadCount();
  const { open: openItem, readAll, removeOne } = useNotificationActions();
  const unread = count?.unread || 0;

  const list = useQuery({
    queryKey: ['notifications', 'list', { limit: PANEL_SIZE }],
    queryFn: () => getNotifications({ limit: PANEL_SIZE }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = list.data?.data || [];
  const close = () => setOpen(false);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-navy dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span
            className={cn(
              'absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white dark:ring-navy-light',
              count?.critical ? 'bg-red-600' : 'bg-amber-500'
            )}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-4 top-20 z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 dark:border-slate-700 dark:bg-navy-light"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Notifications</p>
              <p className="text-xs text-slate-400">{unread ? `${unread} unread` : 'You are all caught up'}</p>
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => readAll.mutate()}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
                </button>
              )}
              <Link
                to="/account/settings#notifications"
                onClick={close}
                title="Notification settings"
                aria-label="Notification settings"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-navy dark:hover:text-slate-200"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {list.isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : list.isError ? (
              <p className="px-4 py-8 text-center text-sm text-red-600">Couldn&apos;t load notifications. Try again shortly.</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <BellOff className="mb-2 h-6 w-6 text-slate-300" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No notifications yet</p>
                <p className="mt-1 text-xs text-slate-400">Trip, bus and upload updates will show up here.</p>
              </div>
            ) : (
              items.map((item) => (
                <NotificationItem
                  key={item._id}
                  item={item}
                  compact
                  onOpen={(n) => openItem(n, close)}
                  onDelete={(n) => removeOne.mutate(n._id)}
                />
              ))
            )}
          </div>

          <Link
            to="/notifications"
            onClick={close}
            className="block border-t border-slate-100 py-3 text-center text-sm font-semibold text-brand-600 hover:bg-slate-50 dark:border-slate-800 dark:text-brand-400 dark:hover:bg-navy"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
