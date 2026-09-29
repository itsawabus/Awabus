import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DrawerContentScrollView } from 'expo-router/drawer';
import { router, usePathname } from 'expo-router';
import {
  Home,
  Waypoints,
  History,
  MessageSquare,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  QrCode,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore.js';
import { reportSignOut } from '../../api/driverApp.js';
import { useConnectionStore } from '../../store/connectionStore.js';
import { colors, radii } from '../../lib/theme.js';
import Avatar from '../ui/Avatar.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';
import { useOfflineQueueStore } from '../../store/offlineQueueStore.js';
import { useConnectionStatus } from '../ConnectionStatus.jsx';

const NAV_ITEMS = [
  { path: '/', label: 'Home (pre-trip)', icon: Home },
  { path: '/trip/active', label: 'Active trip', icon: Waypoints },
  { path: '/trip-history', label: 'Trip history', icon: History },
  { path: '/assistant', label: 'Bus assistant', icon: QrCode },
  { path: '/broadcast-history', label: 'Broadcast history', icon: MessageSquare },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/help', label: 'Help & support', icon: HelpCircle },
];

export default function DrawerContent(props) {
  const pathname = usePathname();
  const { driver, logout } = useAuthStore();
  const unsent = useOfflineQueueStore((st) => st.queue.length);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const isOnline = useConnectionStore((s) => s.isOnline);
  const { busOnline } = useConnectionStatus();

  const go = (path) => {
    props.navigation.closeDrawer();
    router.push(path);
  };

  return (
    <View style={styles.container}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <Avatar name={driver?.name} src={driver?.profilePhotoUrl} size="md" />
          <View style={styles.drawerBadges}>
            <Badge tone={isOnline ? 'success' : 'neutral'} style={isOnline ? undefined : styles.offlineBadge}>
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
            <Badge tone={busOnline ? 'success' : 'warning'}>{busOnline ? 'Bus online' : 'Bus offline'}</Badge>
          </View>
        </View>

        <Text style={styles.name}>{driver?.name || 'Driver'}</Text>
        <Text style={styles.role}>
          Primary Driver{driver?.assignedBus ? ` • Bus ${driver.assignedBus.plateNumber}` : ''}
        </Text>

        <View style={styles.divider} />

        <View style={styles.nav}>
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = path === '/' ? pathname === '/' : pathname.startsWith(path);
            return (
              <Pressable
                key={path}
                onPress={() => go(path)}
                style={[styles.navItem, active && styles.navItemActive]}
              >
                <Icon size={18} color={active ? colors.brand300 : colors.slate200} />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </DrawerContentScrollView>

      <View style={styles.footer}>
        <View style={styles.divider} />
        <Pressable onPress={() => setConfirmLogout(true)} style={styles.logout}>
          <LogOut size={18} color={colors.red500} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
        <Text style={styles.version}>AwaBus Driver v1.0.0</Text>
      </View>

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

const styles = StyleSheet.create({
  drawerBadges: { alignItems: 'flex-end', gap: 4 },
  unsentWarning: { marginTop: 12, fontSize: 13, fontWeight: '700', color: '#b91c1c' },
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  scroll: {
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  offlineBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  name: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
  },
  role: {
    marginTop: 2,
    fontSize: 13,
    color: colors.slate400,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  nav: {
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
  },
  navItemActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate200,
  },
  navLabelActive: {
    color: colors.white,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.red500,
  },
  version: {
    fontSize: 11,
    color: colors.slate500,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.slate900 },
  sheetSubtitle: { fontSize: 14, color: colors.slate500, marginTop: 6, lineHeight: 20 },
});
