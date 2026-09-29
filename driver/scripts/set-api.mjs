#!/usr/bin/env node
// Points the driver app at a backend by writing EXPO_PUBLIC_API_URL into
// driver/.env (other lines in the file are kept).
//
//   npm run api:render      -> the deployed server on Render
//   npm run api:codespace   -> the server running in this GitHub Codespace
//                              (port 5000, made public so a phone can reach it)
//   npm run api -- <url>    -> any other server, e.g. http://192.168.1.20:5000/api
//
// Restart Expo afterwards: EXPO_PUBLIC_ values are read when the bundle is built.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RENDER_URL = 'https://awabus.onrender.com/api';
const PORT = 5000;
const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');

function codespaceUrl() {
  const name = process.env.CODESPACE_NAME;
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
  if (!name) {
    console.error('This terminal is not inside a GitHub Codespace (CODESPACE_NAME is not set).');
    process.exit(1);
  }
  // A phone isn't signed in to GitHub, so the forwarded port must be public.
  try {
    execFileSync('gh', ['codespace', 'ports', 'visibility', `${PORT}:public`, '-c', name], { stdio: 'pipe' });
    console.log(`Port ${PORT} is now public.`);
  } catch {
    console.warn(
      `Could not make port ${PORT} public automatically. In VS Code open the Ports tab, ` +
        `right-click port ${PORT} -> Port Visibility -> Public.`
    );
  }
  return `https://${name}-${PORT}.${domain}/api`;
}

const arg = process.argv[2];
let url;
if (arg === 'render') url = RENDER_URL;
else if (arg === 'codespace') url = codespaceUrl();
else if (arg && /^https?:\/\//.test(arg)) url = arg.replace(/\/+$/, '');
else {
  console.error('Usage: npm run api:render | npm run api:codespace | npm run api -- <url>');
  process.exit(1);
}

const lines = existsSync(envPath) ? readFileSync(envPath, 'utf8').split('\n') : [];
const kept = lines.filter((l) => !l.startsWith('EXPO_PUBLIC_API_URL='));
while (kept.length && kept[kept.length - 1] === '') kept.pop();
kept.push(`EXPO_PUBLIC_API_URL=${url}`, '');
writeFileSync(envPath, kept.join('\n'));

console.log(`driver/.env -> EXPO_PUBLIC_API_URL=${url}`);
if (arg === 'codespace') console.log('Make sure the server is running: cd server && npm run dev');
console.log('Now (re)start Expo: npx expo start --tunnel --clear');
