// Builds an installable "preview" APK with EAS, talking to the Render server
// (or driver/.env's server with --codespace; see server-for-phones.mjs).
//
// Why: .env is not uploaded to EAS (it is in .gitignore), and a preview APK
// has its code and settings baked in at build time. Without this the APK
// would fall back to the deployed Render server. The address is written into
// eas.json's preview profile ("env") just before the build.
//
//   npm run build:preview:android
import { readFileSync, writeFileSync } from 'node:fs';
import { serverForPhones, withoutFlags } from './server-for-phones.mjs';
import { spawnSync } from 'node:child_process';

const easFile = new URL('../eas.json', import.meta.url);
const apiUrl = serverForPhones();

const eas = JSON.parse(readFileSync(easFile, 'utf8'));
eas.build.preview.env = { ...(eas.build.preview.env || {}), EXPO_PUBLIC_API_URL: apiUrl };
writeFileSync(easFile, `${JSON.stringify(eas, null, 2)}\n`);

console.log(`\nPreview APK will use the server: ${apiUrl}`);
if (apiUrl.includes('.app.github.dev')) {
  console.log('That is your Codespace: it must be running, with port 5000 set to Public, whenever the app is used.');
}
console.log('');

const res = spawnSync('npx', ['-y', 'eas-cli@latest', 'build', '--profile', 'preview', '--platform', withoutFlags()[0] || 'android'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(res.status ?? 1);
