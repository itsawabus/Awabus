import { Linking, Platform } from 'react-native';

// Turn-by-turn directions to a child's home in Google Maps (free, the best
// local roads and traffic). The driver taps back to return to AwaBus; with
// location "Allow all the time" the bus keeps being tracked meanwhile.

export const hasHome = (student) => Number.isFinite(student?.lat) && Number.isFinite(student?.lng);

export async function openDirections(student) {
  if (!hasHome(student)) return;
  const { lat, lng } = student;
  // Android: start Google Maps navigation straight away.
  if (Platform.OS === 'android') {
    try {
      await Linking.openURL(`google.navigation:q=${lat},${lng}&mode=d`);
      return;
    } catch {
      // no Google Maps app: the web link below still works
    }
  }
  await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`).catch(() => {});
}
