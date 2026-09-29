import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, LogOut } from 'lucide-react-native';
import Header from '../../../../src/components/layout/Header.jsx';
import Card from '../../../../src/components/ui/Card.jsx';
import Button from '../../../../src/components/ui/Button.jsx';
import Avatar from '../../../../src/components/ui/Avatar.jsx';
import Switch from '../../../../src/components/ui/Switch.jsx';
import Modal from '../../../../src/components/ui/Modal.jsx';
import { OptionField } from '../../../../src/components/ui/OptionPicker.jsx';
import { getMe, reportSignOut } from '../../../../src/api/driverApp.js';
import { useAuthStore } from '../../../../src/store/authStore.js';
import { useUiStore } from '../../../../src/store/uiStore.js';
import { colors } from '../../../../src/lib/theme.js';
import { formatPhone } from '../../../../src/lib/phone.js';
import { buildLine } from '../../../../src/lib/buildInfo.js';
import { useOfflineQueueStore } from '../../../../src/store/offlineQueueStore.js';
import { busLabel } from '../../../../src/lib/bus.js';

const THEME_OPTIONS = [
  { value: 'system', label: 'Follow system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const CACHE_OPTIONS = [
  { value: 25, label: '25 trips' },
  { value: 50, label: '50 trips' },
  { value: 100, label: '100 trips' },
];

export default function Settings() {
  const { driver, logout } = useAuthStore();
  const unsent = useOfflineQueueStore((st) => st.queue.length);
  const prefs = useUiStore();
  const { data: profile } = useQuery({ queryKey: ['driver-me'], queryFn: getMe });
  const [themeOpen, setThemeOpen] = useState(false);
  const [cacheOpen, setCacheOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const info = profile || driver || {};

  return (
    <View style={{ flex: 1 }}>
      <Header title="Settings" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.profileCard}>
          <Avatar name={driver?.name} src={info.profilePhotoUrl} size="lg" />
          <Text style={styles.name}>{driver?.name || 'Driver'}</Text>
          <Text style={styles.phone}>{formatPhone(driver?.phone)}</Text>
          <View style={styles.divider} />
          <Row label="License number" value={info.licenseNumber || '—'} />
          <Row label="Assigned bus" value={busLabel(info.assignedBus) || 'Not assigned'} />
          <Row label="Assigned route" value={info.assignedRoute?.name || 'Not assigned'} last />
        </Card>

        <Text style={styles.sectionTitle}>Appearance</Text>
        <Card style={styles.card}>
          <Label>Theme</Label>
          <OptionField
            label="Theme"
            value={prefs.theme}
            options={THEME_OPTIONS}
            onChange={(v) => prefs.setPref('theme', v)}
            open={themeOpen}
            onOpen={() => setThemeOpen(true)}
            onClose={() => setThemeOpen(false)}
          />
          <Text style={styles.themeHint}>The app restarts for a moment to apply a new theme.</Text>
        </Card>

        <Text style={styles.sectionTitle}>Notifications</Text>
        <Card style={styles.card}>
          <ToggleRow
            label="Vibrate for new notifications"
            value={prefs.notificationSounds}
            onValueChange={(v) => prefs.setPref('notificationSounds', v)}
          />
          <ToggleRow
            label="Vibration on scan"
            value={prefs.vibration}
            onValueChange={(v) => prefs.setPref('vibration', v)}
            last
          />
        </Card>

        <Text style={styles.sectionTitle}>Data & offline</Text>
        <Card style={styles.card}>
          <ToggleRow
            label="Auto-sync on mobile data"
            value={prefs.autoSyncOnMobileData}
            onValueChange={(v) => prefs.setPref('autoSyncOnMobileData', v)}
          />
          <View style={[styles.toggleRow, styles.toggleRowBorder]}>
            <Text style={styles.toggleLabel}>Offline cache limit</Text>
          </View>
          <OptionField
            label="Offline cache limit"
            value={prefs.offlineCacheLimitTrips}
            options={CACHE_OPTIONS}
            onChange={(v) => prefs.setPref('offlineCacheLimitTrips', v)}
            open={cacheOpen}
            onOpen={() => setCacheOpen(true)}
            onClose={() => setCacheOpen(false)}
          />
        </Card>

        <Text style={styles.sectionTitle}>Support</Text>
        <Card style={[styles.card, { padding: 0 }]}>
          <Pressable style={styles.linkRow} onPress={() => router.push('/help')}>
            <Text style={styles.linkText}>Help & support</Text>
            <ChevronRight size={18} color={colors.slate400} />
          </Pressable>
        </Card>

        <Button variant="danger" style={styles.logoutButton} onPress={() => setConfirmLogout(true)}>
          <LogOut size={18} color={colors.onDark} />
          <Text style={styles.logoutText}>Log out</Text>
        </Button>
        <Text style={styles.version}>AwaBus Driver v1.0.0</Text>
        <Text style={styles.version}>{buildLine()}</Text>
      </ScrollView>

      <Modal open={confirmLogout} onClose={() => setConfirmLogout(false)}>
        <Text style={styles.sheetTitle}>Log out?</Text>
        <Text style={styles.sheetSubtitle}>You'll need your phone number and password to sign back in.</Text>
        {unsent > 0 && (
          <Text style={styles.unsentWarning}>
            {unsent} update{unsent === 1 ? ' has' : 's have'} not reached the school yet and will be lost. Connect to the internet
            and wait a moment before logging out.
          </Text>
        )}
        <Button
          variant="danger"
          onPress={() => {
            useOfflineQueueStore.getState().clear();
            reportSignOut(useAuthStore.getState().token);
            logout();
          }}
          style={{ marginTop: 16 }}
        >
          Log out
        </Button>
        <Button variant="ghost" onPress={() => setConfirmLogout(false)} style={{ marginTop: 8 }}>
          Cancel
        </Button>
      </Modal>
    </View>
  );
}

const Label = ({ children }) => <Text style={styles.fieldLabel}>{children}</Text>;

const Row = ({ label, value, last }) => (
  <View style={[styles.infoRow, !last && styles.toggleRowBorder]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const ToggleRow = ({ label, value, onValueChange, last }) => (
  <View style={[styles.toggleRow, !last && styles.toggleRowBorder]}>
    <Text style={styles.toggleLabel}>{label}</Text>
    <Switch value={value} onValueChange={onValueChange} />
  </View>
);

const styles = StyleSheet.create({
  themeHint: { marginTop: 8, fontSize: 12, color: colors.slate500 },
  unsentWarning: { marginTop: 12, fontSize: 13, fontWeight: '700', color: colors.red700 },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
  profileCard: { alignItems: 'center' },
  name: { marginTop: 10, fontSize: 17, fontWeight: '800', color: colors.slate900 },
  phone: { color: colors.slate500, fontSize: 13, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.slate100, width: '100%', marginVertical: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 8 },
  infoLabel: { color: colors.slate500, fontSize: 13 },
  infoValue: { color: colors.slate800, fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.slate500 },
  card: { gap: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.slate600, marginBottom: 6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  toggleRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  toggleLabel: { fontSize: 14, color: colors.slate700, fontWeight: '600' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  linkText: { fontSize: 14, fontWeight: '700', color: colors.slate800 },
  logoutButton: { marginTop: 8, flexDirection: 'row' },
  logoutText: { color: colors.onDark, fontWeight: '700', fontSize: 16 },
  version: { textAlign: 'center', color: colors.slate400, fontSize: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.slate900 },
  sheetSubtitle: { marginTop: 6, color: colors.slate500, fontSize: 14 },
});
