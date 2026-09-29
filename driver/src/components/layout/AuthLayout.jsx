import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../lib/theme.js';

const LOGO = require('../../../assets/awabus-logo.png');

export default function AuthLayout({ children }) {
  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.banner}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="AwaBus" />
      </SafeAreaView>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  banner: {
    height: 180,
    backgroundColor: colors.authBg, // same as the admin sign-in left pane
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 98,
  },
  body: {
    padding: 24,
    paddingBottom: 48,
  },
});
