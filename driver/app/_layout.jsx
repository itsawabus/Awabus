import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useAuthStore } from '../src/store/authStore.js';
import { useUiStore } from '../src/store/uiStore.js';
import { useOfflineQueueStore } from '../src/store/offlineQueueStore.js';
import { useOfflineSync } from '../src/hooks/useOfflineSync.js';
import BrandSplash from '../src/components/layout/BrandSplash.jsx';

// How long the in-app splash stays up at minimum, so it doesn't just flicker.
const MIN_SPLASH_MS = 1200;

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
  },
});

export default function RootLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authHydrated = useAuthStore((s) => s.isHydrated);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const uiHydrated = useUiStore((s) => s.isHydrated);
  const hydrateUi = useUiStore((s) => s.hydrate);
  const queueHydrated = useOfflineQueueStore((s) => s.isHydrated);
  const hydrateQueue = useOfflineQueueStore((s) => s.hydrate);

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
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
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
