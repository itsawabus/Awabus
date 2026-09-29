import { Pressable } from 'react-native';
import { Moon, Sun } from 'lucide-react-native';
import { useUiStore } from '../store/uiStore.js';
import { colors, currentScheme } from '../lib/theme.js';

/**
 * Sun / moon button at the top left: switches between light and dark straight
 * away (no restart). Settings > Appearance can set it back to the phone's own.
 */
export default function ThemeButton({ size = 20, style }) {
  useUiStore((s) => s.themeVersion);
  const setPref = useUiStore((s) => s.setPref);
  const dark = currentScheme() === 'dark';
  return (
    <Pressable
      onPress={() => setPref('theme', dark ? 'light' : 'dark')}
      hitSlop={10}
      style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="button"
      accessibilityLabel={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {dark ? <Sun size={size} color={colors.onDark} /> : <Moon size={size} color={colors.onDark} />}
    </Pressable>
  );
}
