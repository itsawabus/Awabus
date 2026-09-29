import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Mail, MailWarning } from 'lucide-react-native';
import Header from '../../../src/components/layout/Header.jsx';
import Card from '../../../src/components/ui/Card.jsx';
import { PageLoader } from '../../../src/components/ui/Spinner.jsx';
import { getBroadcastHistory } from '../../../src/api/driverApp.js';
import { formatDateTime } from '../../../src/lib/utils.js';
import { colors } from '../../../src/lib/theme.js';

export default function BroadcastHistory() {
  const { data, isLoading } = useQuery({ queryKey: ['broadcast-history'], queryFn: getBroadcastHistory });
  const broadcasts = data || [];

  return (
    <View style={{ flex: 1 }}>
      <Header title="Broadcast history" />
      {isLoading ? (
        <PageLoader />
      ) : (
        <FlatList
          data={broadcasts}
          keyExtractor={(item, index) => item._id || String(index)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <MailWarning size={28} color={colors.slate300} />
              <Text style={styles.emptyTitle}>No broadcasts sent yet</Text>
              <Text style={styles.emptyText}>Delay broadcasts you send parents will show up here.</Text>
            </Card>
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.row}>
                <View style={styles.iconWrap}>
                  <Mail size={16} color={colors.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reason}>{item.reason}</Text>
                  <Text style={styles.routeName}>{item.trip?.route?.name || 'Route'}</Text>
                </View>
              </View>
              <Text style={styles.message}>{item.message}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  {item.recipientCount} sent · {item.deliveredCount} delivered
                  {item.failedCount ? ` · ${item.failedCount} failed` : ''}
                </Text>
                <Text style={styles.metaText}>{formatDateTime(item.sentAt)}</Text>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  card: { gap: 8, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reason: { fontWeight: '800', color: colors.slate900, fontSize: 14 },
  routeName: { color: colors.slate500, fontSize: 12 },
  message: { color: colors.slate600, fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.slate100, paddingTop: 8 },
  metaText: { color: colors.slate400, fontSize: 12 },
  emptyCard: { alignItems: 'center', gap: 6, paddingVertical: 40 },
  emptyTitle: { fontWeight: '800', color: colors.slate700, fontSize: 14 },
  emptyText: { color: colors.slate400, fontSize: 13, textAlign: 'center' },
});
