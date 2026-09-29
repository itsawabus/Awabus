import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../../lib/theme.js';

const LOGO = require('../../../assets/awabus-logo.png');

/**
 * Full-screen AwaBus logo on the logo's background colour. Shown by the root
 * layout while the app starts, so the branded splash appears even on an older
 * installed build whose native splash image predates the logo.
 */
export default function BrandSplash() {
  return (
    <View style={styles.container}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="AwaBus" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.logoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 108,
  },
});
