# AwaBus Driver App

Native mobile app for bus drivers, built with **React Native + Expo** (SDK 57,
Expo Router, New Architecture). This is not a website — it ships as an
installable Android/iOS app via **EAS Build**, with over-the-air JS updates
via **EAS Update**.

## Project structure

```
app/                 Expo Router routes (file-based)
  (auth)/            Sign in, forgot password, OTP, reset password
  (app)/(drawer)/    Home, Trip History (+detail), Broadcast History, Settings, Help
  (app)/trip/        Active Trip, Delay Broadcast (+sent), Trip Completed
                     — pushed outside the drawer chrome for a focused, full-screen feel
src/
  api/               axios client + one wrapper per /api/driver-app endpoint
  store/             Zustand stores (auth, ui prefs, connection, offline queue)
  hooks/             useGeolocation, useOfflineSync
  components/ui/     Design-token-based RN component kit (Button, Input, Card, ...)
  components/layout/ Header, TripHeader, DrawerContent, AuthLayout
  lib/               theme.js (colors/spacing/radii), utils.js (formatters)
```

## 1. Run it locally (development)

```bash
cd driver
cp .env.example .env
npm install
npm start
```

This opens Expo's dev tools. From there:

- **Expo Go** (fastest, no native build needed): scan the QR code with the
  Expo Go app on your phone. Good enough for most screens, but
  `expo-secure-store`/`expo-location` work in Expo Go too, so auth and GPS
  both function.
- **Custom dev client** (`npx expo run:android` / `run:ios`, or an EAS
  `development` build installed on your phone): needed once you add any
  native module Expo Go doesn't ship, or want closer-to-production behavior.

### Pointing the app at your server

`EXPO_PUBLIC_API_URL` in `.env` is inlined into the JS bundle at build/start
time (Expo/Metro's env var convention — same idea as Vite's `VITE_*`).

- **Simulator/emulator on the same machine as the server**: `http://localhost:5000/api` works for iOS simulator; Android emulator needs `http://10.0.2.2:5000/api`.
- **A physical phone** (Expo Go, dev client, or a built APK): `localhost` refers to the *phone*, not your computer. Use your computer's LAN IP instead, e.g. `http://192.168.1.42:5000/api`, and make sure the phone and the server are on the same network. Find your LAN IP with `ipconfig getifaddr en0` (macOS) or `ip addr` (Linux).
- **A deployed server**: point it at that public URL instead.

Restart `npm start` after changing `.env` — Metro only reads it at startup.

## 2. Building & running on your own phone with EAS

You'll need an Expo account (free) and the EAS CLI.

```bash
npm install -g eas-cli   # or use `npx eas-cli` for every command below
eas login                # once per machine
cd driver
eas init                 # links this project to an EAS project (first time only)
```

`eas init` will ask to create a project and will write a `projectId` into
`app.json` under `expo.extra.eas` — commit that once it's added.

### Development build (recommended first step)

A development build is a real installable app with the Expo dev client baked
in, so you get fast refresh + full native module support (better than Expo
Go once you're testing GPS/notifications thoroughly):

```bash
eas build --profile development --platform android   # or ios
```

When it finishes, EAS gives you a link/QR code to download and install the
APK (Android) or install via TestFlight/ad-hoc (iOS — needs your device UDID
registered, see below). Then run:

```bash
npm start --dev-client
```

and open the installed app — it connects to your local Metro bundler like
Expo Go would.

### Preview build (share a standalone APK, no dev server needed)

```bash
eas build --profile preview --platform android
```

This produces a standalone APK you can install directly on any Android phone
(`Settings → install unknown apps` may need enabling) — no computer or Metro
required to run it, it just talks to whatever `EXPO_PUBLIC_API_URL` was baked
in at build time.

### Production build (store-ready)

```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```

iOS builds need an Apple Developer account; EAS will walk you through
generating/registering certificates and provisioning profiles interactively
the first time. Submit with:

```bash
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

### Over-the-air updates (EAS Update)

Once a build is installed, you can push JS-only changes (no native code
changes) without a new store submission or reinstall:

```bash
eas update --branch production --message "Fix delay broadcast copy"
```

The build profiles in `eas.json` are already wired to channels
(`development`, `preview`, `production`) matching this convention — an
update pushed to a channel reaches every installed build on that channel.

## Environment reference

| Variable | Purpose | Example |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Base URL of the `/api` server the app talks to | `http://192.168.1.42:5000/api` |

## Notes

- `react-native-reanimated`, `react-native-svg`, and `react-native-worklets`
  are pinned to exact versions (no `^`/`~`) matching the versions Expo SDK 57
  actually bundles/tests against — bumping them individually can pull in an
  incompatible native module version. Use `npx expo install <pkg>` (not
  `npm install`) when adding new Expo/RN packages so the right version for
  this SDK gets resolved automatically.
- A `react-dom` override is pinned in `package.json` purely to keep
  `expo-router`'s optional web-dev-tools dependency chain (`@expo/ui` →
  `vaul` → Radix UI) from pulling in a `react-dom` patch that requires a
  newer React than this app's pinned `react` version. It has no effect on
  the native app.
