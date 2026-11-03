import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['index.html', 'game.js', 'assets/favicon.svg', 'assets/share.png'];
// This project is plain HTML/CSS/JS. Its production build is a deterministic,
// dependency-free export; keep game.js identical to the reviewed upstream file.
await rm(resolve(root, 'dist'), { recursive: true, force: true });
await mkdir(resolve(root, 'dist/assets'), { recursive: true });
for (const file of files) {
  await copyFile(resolve(root, 'site', file), resolve(root, 'dist', file));
}
const html = await readFile(resolve(root, 'dist/index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = match[1];
  if (/^(?:https?:|#)/.test(url)) continue;
  if (url.startsWith('/') || url.includes('..')) throw new Error(`Non-relative asset: ${url}`);
  await readFile(resolve(root, 'dist', url));
}
console.log(`Built dist/: ${files.length} files, all local URLs relative.`);
