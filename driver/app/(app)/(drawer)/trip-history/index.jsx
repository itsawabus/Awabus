import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react-native';
import Header from '../../../../src/components/layout/Header.jsx';
import Card from '../../../../src/components/ui/Card.jsx';
import Badge from '../../../../src/components/ui/Badge.jsx';
import { PageLoader } from '../../../../src/components/ui/Spinner.jsx';
import { getTripHistory } from '../../../../src/api/driverApp.js';
import { formatShortDate } from '../../../../src/lib/utils.js';
import { colors } from '../../../../src/lib/theme.js';

const STATUS_TONE = { Completed: 'success', Cancelled: 'danger', Delayed: 'warning' };

export default function TripHistory() {
  const { data, isLoading } = useQuery({ queryKey: ['trip-history'], queryFn: () => getTripHistory() });
  const trips = data?.data || [];

  return (
    <View style={{ flex: 1 }}>
      <Header title="Trip history" />
      {isLoading ? (
        <PageLoader />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <History size={28} color={colors.slate300} />
              <Text style={styles.emptyTitle}>No completed trips yet</Text>
              <Text style={styles.emptyText}>Your finished trips will show up here.</Text>
            </Card>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/trip-history/${item._id}`)}>
              <Card style={styles.tripCard}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.routeName}>{item.route?.name}</Text>
                    <Text style={styles.plate}>{item.bus?.plateNumber}</Text>
                  </View>
                  <Badge tone={STATUS_TONE[item.status] || 'neutral'}>{item.status}</Badge>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.metaText}>{formatShortDate(item.date)}</Text>
                  <Text style={styles.metaText}>
                    {item.departureTime} — {item.arrivalTime || '—'}
                  </Text>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  tripCard: { gap: 6, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeName: { fontWeight: '800', color: colors.slate900, fontSize: 15 },
  plate: { color: colors.slate500, fontSize: 13 },
  metaText: { color: colors.slate400, fontSize: 12 },
  emptyCard: { alignItems: 'center', gap: 6, paddingVertical: 40 },
  emptyTitle: { fontWeight: '800', color: colors.slate700, fontSize: 14 },
  emptyText: { color: colors.slate400, fontSize: 13 },
});
