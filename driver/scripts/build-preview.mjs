// Builds an installable "preview" APK with EAS, talking to the same server
// as driver/.env (EXPO_PUBLIC_API_URL).
//
// Why: .env is not uploaded to EAS (it is in .gitignore), and a preview APK
// has its code and settings baked in at build time. Without this the APK
// would fall back to the deployed Render server. The address is written into
// eas.json's preview profile ("env") just before the build.
//
//   npm run build:preview:android
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const envFile = new URL('../.env', import.meta.url);
const easFile = new URL('../eas.json', import.meta.url);

let apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
if (!apiUrl && existsSync(envFile)) {
  const line = readFileSync(envFile, 'utf8').split(/\r?\n/).find((l) => l.startsWith('EXPO_PUBLIC_API_URL='));
  apiUrl = line ? line.slice('EXPO_PUBLIC_API_URL='.length).trim().replace(/^["']|["']$/g, '') : '';
}
if (!apiUrl) {
  console.error('No EXPO_PUBLIC_API_URL found. Run "npm run api:codespace" (or api:render) first.');
  process.exit(1);
}

const eas = JSON.parse(readFileSync(easFile, 'utf8'));
eas.build.preview.env = { ...(eas.build.preview.env || {}), EXPO_PUBLIC_API_URL: apiUrl };
writeFileSync(easFile, `${JSON.stringify(eas, null, 2)}\n`);

console.log(`\nPreview APK will use the server: ${apiUrl}`);
if (apiUrl.includes('.app.github.dev')) {
  console.log('That is your Codespace: it must be running, with port 5000 set to Public, whenever the app is used.');
}
console.log('');

const res = spawnSync('npx', ['-y', 'eas-cli@latest', 'build', '--profile', 'preview', '--platform', process.argv[2] || 'android'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(res.status ?? 1);
