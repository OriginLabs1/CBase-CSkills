import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shared = resolve(root, 'apps/pages-shared');
const sites = ['coreskills-pages', 'corebase-pages'];

for (const site of sites) {
  const assets = resolve(root, 'apps', site, 'assets');
  await mkdir(assets, { recursive: true });
  await cp(resolve(shared, 'site.css'), resolve(assets, 'site.css'));
  await cp(resolve(shared, 'site.js'), resolve(assets, 'site.js'));
  console.log(`synced assets → apps/${site}/assets`);
}
