import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Menu } from 'lucide-react-native';
import { router, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '../../api/driverApp.js';
import { useUiStore } from '../../store/uiStore.js';
import { useOfflineQueueStore } from '../../store/offlineQueueStore.js';
import { colors, themed } from '../../lib/theme.js';
import ThemeButton from '../ThemeButton.jsx';

const LOGO = require('../../../assets/awabus-logo.png');

// Standard navy app-bar. `back` shows a back arrow instead of the hamburger;
// `logo` shows the AwaBus logo in place of a text title.
export default function Header({ title, logo = false, back = false, right }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const handleMenuPress = () => {
    if (back) {
      router.back();
      return;
    }
    // Walk up the navigator tree to find the Drawer, however deeply this
    // screen is nested inside it (a section's own Stack, etc).
    let nav = navigation;
    while (nav) {
      if (typeof nav.toggleDrawer === 'function') {
        nav.toggleDrawer();
        return;
      }
      nav = nav.getParent?.();
    }
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <Pressable onPress={handleMenuPress} style={styles.iconButton} hitSlop={10}>
        {back ? <ArrowLeft size={22} color={colors.onDark} /> : <Menu size={22} color={colors.onDark} />}
      </Pressable>
      <ThemeButton style={{ marginLeft: -8 }} />
      {logo ? (
        <View style={styles.logoWrap}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="AwaBus" />
        </View>
      ) : (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      )}
      {right || <NotificationBell />}
    </View>
  );
}

// Opens Notifications; a red dot means something new since the driver last looked.
function NotificationBell() {
  const { data } = useQuery({ queryKey: ['driver-notifications'], queryFn: getNotifications, staleTime: 60000 });
  const seenAt = useUiStore((s) => s.notificationsSeenAt) || 0;
  const waiting = useOfflineQueueStore((s) => s.queue.length);
  const unseen = (data || []).filter((n) => new Date(n.at).getTime() > seenAt).length;
  const dot = unseen > 0 || waiting > 0;
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      style={styles.iconButton}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={dot ? `Notifications, ${unseen || waiting} new` : 'Notifications'}
    >
      <Bell size={22} color={colors.onDark} />
      {dot && <View style={styles.dot} />}
    </Pressable>
  );
}

const styles = themed(() => ({
  header: {
    backgroundColor: colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.red500,
    borderWidth: 1.5,
    borderColor: colors.navy,
  },
  logoWrap: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    width: 82,
    height: 40,
  },
  title: {
    flex: 1,
    color: colors.onDark,
    fontSize: 18,
    fontWeight: '800',
  },
}));
