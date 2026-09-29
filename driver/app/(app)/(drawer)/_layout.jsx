import { Drawer } from 'expo-router/drawer';
import DrawerContent from '../../../src/components/layout/DrawerContent.jsx';
import { colors } from '../../../src/lib/theme.js';

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{ headerShown: false, drawerStyle: { width: '78%' }, sceneStyle: { backgroundColor: colors.page } }}
      drawerContent={(props) => <DrawerContent {...props} />}
    >
      <Drawer.Screen name="index" />
      <Drawer.Screen name="trip-history" />
      <Drawer.Screen name="assistant" />
      <Drawer.Screen name="broadcast-history" />
      <Drawer.Screen name="notifications" />
      <Drawer.Screen name="settings" />
      <Drawer.Screen name="help" />
    </Drawer>
  );
}
