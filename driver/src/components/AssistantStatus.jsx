import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme.js';
import { timeAgo } from '../lib/utils.js';

/**
 * One bus assistant: a green dot while their page is open and reaching
 * AwaBus (it checks in every 10 seconds), grey when it has gone quiet.
 */
export function AssistantLine({ assistant, style }) {
  const on = Boolean(assistant?.connected);
  return (
    <View style={[styles.row, style]}>
      <View style={[styles.dot, { backgroundColor: on ? colors.emerald600 : colors.slate400 }]} />
      <Text style={[styles.text, { color: on ? colors.emerald700 : colors.slate500 }]}>
        {assistant?.name || 'Bus assistant'} · {on ? 'connected' : `disconnected${assistant?.lastSeenAt ? ` (last seen ${timeAgo(assistant.lastSeenAt)})` : ''}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  text: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
});
