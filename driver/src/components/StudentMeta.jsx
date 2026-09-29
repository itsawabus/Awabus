import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MessageSquare, Phone } from 'lucide-react-native';
import { formatPhone } from '../lib/phone.js';
import { colors, radii } from '../lib/theme.js';

export const guardianName = (g) => (g ? `${g.firstName || ''} ${g.lastName || ''}`.trim() : '');

/**
 * A student's class and parent/guardian, with buttons to call and to text the parent.
 * onCall(guardian) is called when the call button is pressed (the screen confirms first);
 * onMessage(student) opens the message sheet.
 */
export default function StudentMeta({ student, onCall, onMessage }) {
  const g = student?.primaryGuardian;
  const cls = student?.classGrade;
  if (!cls && !g) return null;
  return (
    <View style={styles.wrap}>
      {cls ? <Text style={styles.cls}>{cls}</Text> : null}
      {g ? (
        <View style={styles.parentRow}>
          <Text style={styles.parent} numberOfLines={1}>
            {g.relation && g.relation !== 'Guardian' ? `${g.relation}: ` : 'Parent: '}
            {guardianName(g) || '—'}
            {g.phone ? ` · ${formatPhone(g.phone)}` : ''}
          </Text>
          {g.phone && onCall ? (
            <Pressable
              onPress={() => onCall(g)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Call ${guardianName(g) || 'parent'}`}
              style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.7 }]}
            >
              <Phone size={14} color={colors.brand600} />
            </Pressable>
          ) : null}
          {g.phone && onMessage ? (
            <Pressable
              onPress={() => onMessage(student)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Send a message to ${guardianName(g) || 'the parent'}`}
              style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.7 }]}
            >
              <MessageSquare size={14} color={colors.brand600} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 2, gap: 2 },
  cls: { fontSize: 12, fontWeight: '700', color: colors.slate500 },
  parentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  parent: { flexShrink: 1, fontSize: 12, color: colors.slate500 },
  callBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.slate200,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
