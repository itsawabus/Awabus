import { AssistantScreen } from '../(drawer)/assistant.jsx';

// The bus assistant QR code, opened from the running trip's screen, so a
// teacher can scan it (or scan again) after the trip has started.
export default function TripAssistant() {
  return <AssistantScreen back />;
}
