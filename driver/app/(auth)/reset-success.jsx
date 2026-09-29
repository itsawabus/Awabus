import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import AuthLayout from '../../src/components/layout/AuthLayout.jsx';
import Button from '../../src/components/ui/Button.jsx';
import { colors } from '../../src/lib/theme.js';

export default function ResetSuccess() {
  return (
    <AuthLayout>
      <View style={styles.center}>
        <CheckCircle2 size={64} color={colors.brand500} />
        <Text style={styles.title}>Password reset successful</Text>
        <Text style={styles.subtitle}>You can now sign in with your new password</Text>
        <Button variant="auth" style={styles.button} onPress={() => router.replace('/sign-in')}>
          Return to sign in
        </Button>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', textAlign: 'center' },
  title: { marginTop: 16, fontSize: 20, fontWeight: '800', color: colors.slate900, textAlign: 'center' },
  subtitle: { marginTop: 8, fontSize: 14, color: colors.slate500, textAlign: 'center' },
  button: { marginTop: 32, width: '100%' },
});
