import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { colors, radii } from '../../lib/theme.js';
import Modal from './Modal.jsx';

// A field that opens a bottom-sheet list of options — the RN stand-in for a
// web <select>. `options` = [{ value, label }].
export function OptionField({ label, value, options, onChange, open, onOpen, onClose }) {
  const selected = options.find((o) => o.value === value);
  return (
    <>
      <Pressable onPress={onOpen} style={styles.field}>
        <Text style={styles.fieldText}>{selected?.label || label}</Text>
        <ChevronDown size={18} color={colors.slate400} />
      </Pressable>
      <Modal open={open} onClose={onClose}>
        <Text style={styles.sheetTitle}>{label}</Text>
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => {
              onChange(opt.value);
              onClose();
            }}
            style={styles.option}
          >
            <Text style={styles.optionText}>{opt.label}</Text>
            {opt.value === value && <Check size={18} color={colors.brand600} />}
          </Pressable>
        ))}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldText: {
    fontSize: 16,
    color: colors.slate900,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.slate900,
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  optionText: {
    fontSize: 16,
    color: colors.slate800,
  },
});

export default OptionField;
