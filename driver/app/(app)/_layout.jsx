import { Stack } from 'expo-router';

// Screens that should escape the drawer chrome entirely (Active Trip, Delay
// Broadcast, etc) live as siblings of the (drawer) group here, in a shared
// Stack, so navigating to them doesn't carry the drawer's own navigator.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
