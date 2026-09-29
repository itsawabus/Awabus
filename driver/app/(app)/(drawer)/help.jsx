import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HelpCircle, Mail, MessageCircle, Phone } from 'lucide-react-native';
import Header from '../../../src/components/layout/Header.jsx';
import Card from '../../../src/components/ui/Card.jsx';
import { colors } from '../../../src/lib/theme.js';

const FAQS = [
  {
    q: 'What happens if I lose internet connection during a trip?',
    a: 'The app keeps working offline. Student scans and location updates are queued on your phone and automatically sent to the school once you reconnect.',
  },
  {
    q: 'How do parents get notified about a delay?',
    a: 'Sending a delay broadcast sends an SMS to every parent whose child is marked attending on today’s trip, with your chosen reason and message.',
  },
  {
    q: 'Can I still end a trip if not every student has been dropped off?',
    a: 'Yes, but the app will warn you first so you can double check the roster before confirming.',
  },
  {
    q: 'Can I do more than one trip in a day?',
    a: 'Yes. After you end a trip, the home screen has a new trip ready. Each trip you start is shown live to the school and kept in your trip history.',
  },
  {
    q: 'Why does the app ask "Are you sure?"',
    a: 'Every change (boarding, drop off, not here, attending, calling a parent) is confirmed first, so a stray tap never changes a record. Tap Cancel to leave it as it was.',
  },
  {
    q: 'How do I reach a student’s parent?',
    a: 'Each student shows their class and their parent or guardian. Tap the phone button next to the parent to call them.',
  },
  {
    q: 'Does the school still see the bus if I open another screen?',
    a: 'Yes. While a trip is running the app keeps sending the bus position whichever screen you are on, as long as the app stays open.',
  },
  {
    q: 'How do I change my password?',
    a: 'Use "Forgot password" on the sign in screen — you’ll get a one-time code by SMS to reset it.',
  },
];

const CONTACTS = [
  { icon: Phone, label: 'Call support', value: '020 000 0000', action: () => Linking.openURL('tel:+233200000000') },
  { icon: Mail, label: 'Email support', value: 'support@awabus.com', action: () => Linking.openURL('mailto:support@awabus.com') },
  { icon: MessageCircle, label: 'WhatsApp', value: 'Chat with the school office', action: () => Linking.openURL('https://wa.me/233200000000') },
];

export default function HelpSupport() {
  return (
    <View style={{ flex: 1 }}>
      <Header title="Help & support" back />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.iconWrap}>
          <HelpCircle size={28} color={colors.ink} />
        </View>
        <Text style={styles.title}>We're here to help</Text>
        <Text style={styles.subtitle}>Reach the school's support team or check answers to common questions.</Text>

        <Card style={[styles.card, { padding: 0 }]}>
          {CONTACTS.map(({ icon: Icon, label, value, action }, index) => (
            <Pressable
              key={label}
              onPress={action}
              style={[styles.contactRow, index < CONTACTS.length - 1 && styles.rowBorder]}
            >
              <View style={styles.contactIcon}>
                <Icon size={18} color={colors.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactLabel}>{label}</Text>
                <Text style={styles.contactValue}>{value}</Text>
              </View>
            </Pressable>
          ))}
        </Card>

        <Text style={styles.sectionTitle}>Frequently asked questions</Text>
        <Card style={styles.card}>
          {FAQS.map((item, index) => (
            <View key={item.q} style={[styles.faqItem, index < FAQS.length - 1 && styles.rowBorder]}>
              <Text style={styles.faqQuestion}>{item.q}</Text>
              <Text style={styles.faqAnswer}>{item.a}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 16, paddingBottom: 32 },
  iconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.slate900, textAlign: 'center' },
  subtitle: { color: colors.slate500, fontSize: 14, textAlign: 'center', marginBottom: 4 },
  card: { gap: 0 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactLabel: { fontWeight: '700', color: colors.slate800, fontSize: 14 },
  contactValue: { color: colors.slate500, fontSize: 13, marginTop: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.slate500 },
  faqItem: { paddingVertical: 14 },
  faqQuestion: { fontWeight: '700', color: colors.slate800, fontSize: 14 },
  faqAnswer: { marginTop: 6, color: colors.slate500, fontSize: 13, lineHeight: 19 },
});
