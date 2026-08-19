/**
 * Embeds optimised screenshots into docs/PMES_USER_MANUAL.html.
 *
 *   node tools/embed-shots.mjs
 *
 * The manual is a single self-contained file — it is published as an Artifact
 * and converted to PDF and Word from the same source — so images have to be
 * inlined as data URIs rather than linked. This replaces each
 * `<!--SHOT:name-->` marker with a numbered figure built from
 * docs/manual-shots/<name>.opt.png.
 *
 * Re-running is safe: a marker already filled in is left alone, and markers
 * whose image is missing are reported rather than silently skipped.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const HTML = join(ROOT, 'docs', 'PMES_USER_MANUAL.html');
const SHOTS = join(ROOT, 'docs', 'manual-shots');

let html = readFileSync(HTML, 'utf8');

const markers = [...html.matchAll(/<!--SHOT:([a-z0-9-]+)\|([^>]*?)-->/g)];
if (!markers.length) {
  console.log('No <!--SHOT:name|caption--> markers found.');
  process.exit(0);
}

// Figures are numbered in document order so captions read "Figure 1", "Figure 2"
// regardless of which section they sit in.
let figureNo = (html.match(/class="fig-num"/g) || []).length;
let embedded = 0;
const missing = [];

for (const [marker, name, caption] of markers) {
  const file = join(SHOTS, `${name}.opt.png`);
  if (!existsSync(file)) { missing.push(name); continue; }

  figureNo += 1;
  const b64 = readFileSync(file).toString('base64');
  const figure =
    `<figure>\n` +
    `      <img src="data:image/png;base64,${b64}" alt="${caption.replace(/"/g, '&quot;')}">\n` +
    `      <figcaption><span class="fig-num">Figure ${figureNo}</span><span>${caption}</span></figcaption>\n` +
    `    </figure>`;

  html = html.replace(marker, figure);
  embedded += 1;
  console.log(`Figure ${figureNo}  ${name}  (${(statSync(file).size / 1024).toFixed(0)} KB)`);
}

writeFileSync(HTML, html);
console.log(`\nEmbedded ${embedded} figure(s). Manual is now ${(statSync(HTML).size / 1024 / 1024).toFixed(2)} MB.`);
if (missing.length) console.log('MISSING screenshots (marker left in place):', missing.join(', '));
