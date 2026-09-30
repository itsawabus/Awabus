// Sends the current app code to phones that have the preview APK, without a
// new build (an "over-the-air" update). Phones get it the next time AwaBus is
// opened (it shows on the second start: once to download, once to run it).
//
// Works for changes to screens and app code. A new build is still needed
// after changing app.json, adding a native package, or a new app version.
//
//   npm run update:preview
import { serverForPhones, withoutFlags } from './server-for-phones.mjs';
import { spawnSync } from 'node:child_process';

const apiUrl = serverForPhones();
console.log(`\nUpdate will use the server: ${apiUrl}\n`);

const message = withoutFlags().join(' ') || 'App update';
const res = spawnSync('npx', ['-y', 'eas-cli@latest', 'update', '--channel', 'preview', '--message', message], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl },
});
process.exit(res.status ?? 1);
