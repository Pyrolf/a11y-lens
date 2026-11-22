import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST_ASSETS = 'dist/assets';
const THRESHOLDS = {
  js: 320 * 1024,
  css: 8 * 1024,
};

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} kB`;
}

let files;
try {
  files = readdirSync(DIST_ASSETS);
} catch (error) {
  console.error(`Unable to read ${DIST_ASSETS}: ${error.message}`);
  process.exit(1);
}

const totals = { js: 0, css: 0 };
const details = [];

for (const file of files) {
  const extension = file.slice(file.lastIndexOf('.'));
  if (extension !== '.js' && extension !== '.css') continue;
  const raw = readFileSync(join(DIST_ASSETS, file));
  const gzipped = gzipSync(raw).byteLength;
  const kind = extension === '.js' ? 'js' : 'css';
  totals[kind] += gzipped;
  details.push({ file, kind, raw: raw.byteLength, gzipped });
}

for (const detail of details.sort((a, b) => b.gzipped - a.gzipped)) {
  console.log(
    `${detail.file}: raw ${formatBytes(detail.raw)}, gzip ${formatBytes(detail.gzipped)}`,
  );
}

let failed = false;
for (const kind of ['js', 'css']) {
  const total = totals[kind];
  const threshold = THRESHOLDS[kind];
  const status = total <= threshold ? 'OK' : 'FAIL';
  console.log(`${kind.toUpperCase()} total gzip: ${formatBytes(total)} / ${formatBytes(threshold)} [${status}]`);
  if (total > threshold) failed = true;
}

if (failed) {
  console.error('Bundle size budget exceeded.');
  process.exit(1);
}

console.log('Bundle size budget passed.');
