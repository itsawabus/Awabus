import { useEffect, useRef, useState } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAuthStore } from '../src/store/authStore.js';
import { useUiStore } from '../src/store/uiStore.js';
import { useOfflineQueueStore } from '../src/store/offlineQueueStore.js';
import { useOfflineSync } from '../src/hooks/useOfflineSync.js';
import BrandSplash from '../src/components/layout/BrandSplash.jsx';
import BackgroundWork from '../src/components/BackgroundWork.jsx';
import LastCrashNotice from '../src/components/LastCrashNotice.jsx';
import { installCrashLog, saveCrash } from '../src/lib/crashLog.js';
// Defines the screen-off location task; must load when the app starts.
import '../src/lib/backgroundLocation.js';
import { colors } from '../src/lib/theme.js';

// Any error that would close the app is noted, so the next launch can show it.
installCrashLog();

// How long the in-app splash stays up at minimum, so it doesn't just flicker.
const MIN_SPLASH_MS = 1200;

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
  },
});

/**
 * A screen error shows this page instead of closing the app, with the reason
 * (and it is noted for the next launch too).
 */
export function ErrorBoundary({ error, retry }) {
  saveCrash(error);
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0a1f2a' }}>
      <Text style={{ color: 'white', fontSize: 20, fontWeight: '800' }}>Something went wrong</Text>
      <Text style={{ color: '#cbd5e1', fontSize: 14, marginTop: 8 }}>
        AwaBus hit a problem on this screen. Try again; if it keeps happening, send this message to the AwaBus team:
      </Text>
      <Text selectable style={{ color: '#fcd34d', fontSize: 13, marginTop: 12 }}>
        {String(error?.message || error)}
      </Text>
      <Pressable onPress={retry} style={{ marginTop: 24, backgroundColor: '#0d9488', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
        <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>Try again</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function RootLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authHydrated = useAuthStore((s) => s.isHydrated);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const uiHydrated = useUiStore((s) => s.isHydrated);
  const hydrateUi = useUiStore((s) => s.hydrate);
  const queueHydrated = useOfflineQueueStore((s) => s.isHydrated);
  const hydrateQueue = useOfflineQueueStore((s) => s.hydrate);

  const themeVersion = useUiStore((s) => s.themeVersion);

  // A new theme draws every screen again (their styles are remade with the new
  // colours) and comes back to the page the driver was on.
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const drawnFor = useRef(themeVersion);
  useEffect(() => {
    if (drawnFor.current === themeVersion) {
      pathRef.current = pathname;
      return;
    }
    drawnFor.current = themeVersion;
    const back = pathRef.current;
    if (back && back !== '/') {
      const t = setTimeout(() => {
        try {
          router.replace(back);
        } catch {
          // stays on the start screen
        }
      }, 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [pathname, themeVersion]);

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const ready = authHydrated && uiHydrated && queueHydrated && minTimeElapsed;

  useOfflineSync();

  useEffect(() => {
    hydrateAuth();
    hydrateUi();
    hydrateQueue();
  }, [hydrateAuth, hydrateUi, hydrateQueue]);

  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  // Hand over from the native splash to the identical in-app one straight away;
  // BrandSplash stays up until the stores have loaded.
  if (!ready) {
    return (
      <View style={{ flex: 1 }} onLayout={() => SplashScreen.hideAsync().catch(() => {})}>
        <StatusBar style="light" />
        <BrandSplash />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          {/* Sends the bus position and checks notifications on every screen, without moving between screens. */}
          {isAuthenticated && <BackgroundWork />}
          <StatusBar style="light" />
          <Stack key={`theme-${themeVersion}`} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }}>
            <Stack.Protected guard={!isAuthenticated}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Protected guard={isAuthenticated}>
              <Stack.Screen name="(app)" />
            </Stack.Protected>
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
