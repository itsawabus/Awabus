import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getUnreadCount, markAllNotificationsRead, markNotificationRead } from '../../api/notifications.js';

// How often the bell checks for new notifications.
export const NOTIFICATION_POLL_MS = 30 * 1000;

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: getUnreadCount,
    refetchInterval: NOTIFICATION_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

/** Mark-read helpers shared by the bell panel and the Notifications page. */
export function useNotificationActions() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });

  const readOne = useMutation({ mutationFn: markNotificationRead, onSettled: refresh });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSettled: refresh });

  // Mark as read (if needed) and go to the page it is about.
  const open = (item, after) => {
    if (!item.read) readOne.mutate(item._id);
    after?.();
    if (item.link) navigate(item.link);
  };

  return { open, readAll };
}
