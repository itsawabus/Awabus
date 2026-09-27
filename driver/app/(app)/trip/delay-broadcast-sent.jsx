import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import Header from '../../../src/components/layout/Header.jsx';
import Card from '../../../src/components/ui/Card.jsx';
import Button from '../../../src/components/ui/Button.jsx';
import { formatTime } from '../../../src/lib/utils.js';
import { colors } from '../../../src/lib/theme.js';

export default function BroadcastSent() {
  const { recipientCount, deliveredCount, failedCount, sentAt } = useLocalSearchParams();

  return (
    <View style={{ flex: 1 }}>
      <Header title="Delay broadcast" back />
      <View style={styles.content}>
        <CheckCircle2 size={64} color={colors.navy} />
        <Text style={styles.title}>Broadcast sent</Text>
        <Text style={styles.subtitle}>Parents have been notified about the delay.</Text>

        <Card style={styles.card}>
          <Row label="Sent to" value={`${recipientCount} parent${recipientCount === '1' ? '' : 's'}`} />
          <Row label="Delivered" value={`${deliveredCount} successful`} />
          <Row label="Failed" value={failedCount} />
          <Row label="Sent at" value={formatTime(sentAt)} last />
        </Card>
      </View>

      <View style={styles.footer}>
        <Button onPress={() => router.replace('/trip/active')}>Back to trip</Button>
      </View>
    </View>
  );
}

const Row = ({ label, value, last }) => (
  <View style={[styles.row, !last && styles.rowBorder]}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  content: { alignItems: 'center', padding: 24, paddingTop: 40 },
  title: { marginTop: 16, fontSize: 20, fontWeight: '800', color: colors.slate900 },
  subtitle: { marginTop: 4, fontSize: 14, color: colors.slate500, textAlign: 'center' },
  card: { marginTop: 24, width: '100%' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  rowLabel: { color: colors.slate500, fontSize: 14 },
  rowValue: { color: colors.slate800, fontWeight: '700', fontSize: 14 },
  footer: { padding: 16 },
});
