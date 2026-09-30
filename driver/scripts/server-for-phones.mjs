// Which server an installable app (preview APK or over-the-air update) talks
// to. Phones out on the road need an address that is always on: the Render
// server. A Codespace address only works while that Codespace is running with
// port 5000 public, so it is used only when asked for with --codespace.
import { readFileSync, existsSync } from 'node:fs';

export const RENDER_URL = 'https://awabus.onrender.com/api';

export function serverForPhones(args = process.argv.slice(2)) {
  const envFile = new URL('../.env', import.meta.url);
  let fromEnv = process.env.EXPO_PUBLIC_API_URL || '';
  if (!fromEnv && existsSync(envFile)) {
    const line = readFileSync(envFile, 'utf8').split(/\r?\n/).find((l) => l.startsWith('EXPO_PUBLIC_API_URL='));
    fromEnv = line ? line.slice('EXPO_PUBLIC_API_URL='.length).trim().replace(/^["']|["']$/g, '') : '';
  }
  const isCodespace = /\.app\.github\.dev/.test(fromEnv) || /localhost|127\.0\.0\.1|192\.168\./.test(fromEnv);
  if (isCodespace && !args.includes('--codespace')) {
    console.log(`driver/.env points at ${fromEnv}, which phones cannot reach when that computer or Codespace is off.`);
    console.log(`Using the Render server instead: ${RENDER_URL}`);
    console.log('(Add --codespace to use the .env address anyway.)');
    return RENDER_URL;
  }
  return fromEnv || RENDER_URL;
}

export const withoutFlags = (args = process.argv.slice(2)) => args.filter((a) => !a.startsWith('--'));
