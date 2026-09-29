import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BellOff, CheckSquare, Info, Square, Trash2, UploadCloud, X } from 'lucide-react-native';
import Header from '../../../src/components/layout/Header.jsx';
import Card from '../../../src/components/ui/Card.jsx';
import { PageLoader } from '../../../src/components/ui/Spinner.jsx';
import { deleteNotifications, getNotifications } from '../../../src/api/driverApp.js';
import ConfirmDialog from '../../../src/components/ui/ConfirmDialog.jsx';
import Button from '../../../src/components/ui/Button.jsx';
import { useOfflineQueueStore } from '../../../src/store/offlineQueueStore.js';
import { useUiStore } from '../../../src/store/uiStore.js';
import { formatDateTime } from '../../../src/lib/utils.js';
import { colors } from '../../../src/lib/theme.js';

const LOOK = {
  danger: { Icon: AlertTriangle, color: colors.red600, bg: colors.red50 },
  warning: { Icon: AlertTriangle, color: colors.amber800, bg: colors.amber50 },
  info: { Icon: Info, color: colors.navy, bg: colors.brand50 },
  queue: { Icon: UploadCloud, color: colors.navy, bg: colors.slate100 },
};

export default function Notifications() {
  const { data, isLoading, isRefetching, refetch, isError, error } = useQuery({
    queryKey: ['driver-notifications'],
    queryFn: getNotifications,
  });
  const waiting = useOfflineQueueStore((s) => s.queue.length);
  const qc = useQueryClient();
  // Select mode: tap notifications to tick them, then delete them together.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [confirm, setConfirm] = useState(null);
  const remove = useMutation({
    mutationFn: deleteNotifications,
    onSuccess: (left) => qc.setQueryData(['driver-notifications'], left),
    onSettled: () => {
      setSelecting(false);
      setSelected(new Set());
    },
  });
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const count = data?.length || 0;
  const askDelete = (kind, ids) =>
    setConfirm({
      title: kind === 'all' ? 'Delete all notifications?' : `Delete ${ids.length} notification${ids.length === 1 ? '' : 's'}?`,
      message: 'They are removed from this list. Notifications older than 30 days are removed automatically.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => remove.mutate(kind === 'all' ? { all: true } : { ids }),
    });

  // Opening this screen counts as having seen everything in it.
  useFocusEffect(
    useCallback(() => {
      const newest = data?.[0]?.at ? new Date(data[0].at).getTime() : 0;
      if (newest > (useUiStore.getState().notificationsSeenAt || 0)) useUiStore.getState().setPref('notificationsSeenAt', newest);
    }, [data])
  );

  const items = [
    ...(waiting
      ? [
          {
            id: 'queue',
            type: 'queue',
            title: `${waiting} update${waiting === 1 ? '' : 's'} waiting to send`,
            message: 'They were saved on this phone while it was offline and are sent automatically when the connection is back.',
          },
        ]
      : []),
    ...(data || []),
  ];

  return (
    <View style={{ flex: 1 }}>
      <Header
        title="Notifications"
        right={
          count ? (
            <Pressable
              onPress={() => (selecting ? (setSelecting(false), setSelected(new Set())) : setSelecting(true))}
              hitSlop={8}
              style={styles.headerBtn}
              accessibilityLabel={selecting ? 'Done selecting' : 'Select notifications'}
            >
              {selecting ? <X size={20} color={colors.white} /> : <Text style={styles.headerBtnText}>Select</Text>}
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )
        }
      />
      {isLoading ? (
        <PageLoader />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListHeaderComponent={isError ? <Text style={styles.error}>Couldn't load notifications: {error.message}</Text> : null}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <BellOff size={28} color={colors.slate300} />
              <Text style={styles.emptyTitle}>Nothing new</Text>
              <Text style={styles.emptyText}>
                You'll see licence reminders, bus changes, trips ended for you and delay texts that failed here.
              </Text>
            </Card>
          }
          renderItem={({ item }) => {
            const look = LOOK[item.type] || LOOK.info;
            const deletable = item.type !== 'queue';
            const ticked = selected.has(item.id);
            return (
              <Pressable disabled={!selecting || !deletable} onPress={() => toggle(item.id)}>
              <Card style={[styles.card, ticked && styles.cardTicked]}>
                <View style={styles.row}>
                  {selecting && deletable ? (
                    ticked ? <CheckSquare size={20} color={colors.brand600} /> : <Square size={20} color={colors.slate400} />
                  ) : null}
                  <View style={[styles.iconWrap, { backgroundColor: look.bg }]}>
                    <look.Icon size={16} color={look.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.message}>{item.message}</Text>
                    {item.at ? <Text style={styles.time}>{formatDateTime(item.at)}</Text> : null}
                  </View>
                  {!selecting && deletable ? (
                    <Pressable
                      onPress={() => askDelete('some', [item.id])}
                      hitSlop={10}
                      accessibilityLabel="Delete notification"
                      style={styles.trash}
                    >
                      <Trash2 size={18} color={colors.slate400} />
                    </Pressable>
                  ) : null}
                </View>
              </Card>
              </Pressable>
            );
          }}
        />
      )}
      {selecting ? (
        <View style={styles.actionBar}>
          <Button
            variant="danger"
            disabled={!selected.size}
            loading={remove.isPending}
            onPress={() => askDelete('some', [...selected])}
            style={{ flex: 1 }}
          >
            {selected.size ? `Delete (${selected.size})` : 'Tick to delete'}
          </Button>
          <Button variant="ghost" onPress={() => askDelete('all')} style={{ flex: 1 }}>
            Delete all
          </Button>
        </View>
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} loading={remove.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, flexGrow: 1 },
  card: { padding: 14 },
  cardTicked: { borderColor: colors.brand600, borderWidth: 1 },
  trash: { padding: 4, alignSelf: 'flex-start' },
  headerBtn: { minWidth: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  actionBar: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.slate200, backgroundColor: colors.white },
  row: { flexDirection: 'row', gap: 12 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '800', color: colors.slate800 },
  message: { marginTop: 2, fontSize: 13, color: colors.slate500, lineHeight: 18 },
  time: { marginTop: 6, fontSize: 12, color: colors.slate400 },
  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { fontWeight: '800', color: colors.slate800, fontSize: 15 },
  emptyText: { color: colors.slate500, fontSize: 13, textAlign: 'center' },
  error: { color: colors.red600, marginBottom: 8 },
});
