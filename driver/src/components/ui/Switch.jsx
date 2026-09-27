import { Switch as RNSwitch, Platform } from 'react-native';
import { colors } from '../../lib/theme.js';

export default function Switch({ value, onValueChange, disabled }) {
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.slate300, true: colors.brand600 }}
      thumbColor={Platform.OS === 'android' ? colors.white : undefined}
      ios_backgroundColor={colors.slate300}
    />
  );
}
