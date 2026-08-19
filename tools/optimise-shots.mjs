/**
 * Resizes every PNG in docs/manual-shots for embedding in the manual.
 *
 *   node tools/optimise-shots.mjs
 *
 * Screenshots are captured at 2x so text stays crisp, which lands them around
 * 2 MB each — nine of those would push the PDF past 20 MB. 1600px wide is still
 * well above what an A4 column needs at print resolution, and cuts them to a
 * few hundred KB. Writes *.opt.png alongside the originals; the originals are
 * kept so a shot can be re-derived at a different size without recapturing.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const DIR = resolve(import.meta.dirname, '..', 'docs', 'manual-shots');
const MAX_WIDTH = 1600;

const shots = readdirSync(DIR)
  .filter(f => f.endsWith('.png') && !f.endsWith('.opt.png'))
  .sort();

if (!shots.length) {
  console.log('No screenshots found in', DIR);
  process.exit(0);
}

for (const file of shots) {
  const src = join(DIR, file);
  const out = join(DIR, file.replace(/\.png$/, '.opt.png'));
  const before = statSync(src).size;
  const meta = await sharp(src).metadata();

  await sharp(src)
    .resize({ width: Math.min(MAX_WIDTH, meta.width), withoutEnlargement: true })
    // palette:true quantises to an indexed PNG — UI screenshots use few colours,
    // so this is a large saving with no visible loss on flat interface panels.
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(out);

  const after = statSync(out).size;
  console.log(
    file.padEnd(22),
    `${meta.width}x${meta.height}`.padEnd(12),
    (before / 1024).toFixed(0).padStart(5) + ' KB  ->  ' +
    (after / 1024).toFixed(0).padStart(5) + ' KB',
    `(${Math.round((1 - after / before) * 100)}% smaller)`
  );
}
