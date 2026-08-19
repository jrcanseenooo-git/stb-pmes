/**
 * Builds docs/PMES_USER_MANUAL.pdf from docs/PMES_USER_MANUAL.html.
 *
 *   node tools/build-manual-pdf.mjs
 *
 * Chrome's plain `--print-to-pdf` stamps its own header and footer on every
 * page - the date, the tab title and the full `file:///C:/Users/...` path of
 * the source file. That is fine for a quick proof and unacceptable on a
 * document attached to a transmittal memo, and there is no flag that keeps the
 * page numbers while dropping the URL.
 *
 * So this drives Chrome over the DevTools Protocol instead, which accepts
 * explicit header/footer templates: an empty header, and a footer carrying the
 * document title and "Page N of M". `preferCSSPageSize` hands page size and
 * margins back to the @page rule in the stylesheet, so the A4 layout stays
 * where the CSS put it.
 *
 * No npm dependency: Node 22 ships a global WebSocket.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'docs', 'PMES_USER_MANUAL.html');
const OUT = join(ROOT, 'docs', 'PMES_USER_MANUAL.pdf');
const PORT = 9333;

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

const chromePath = CHROME_CANDIDATES.find(p => p && existsSync(p));
if (!chromePath) { console.error('No Chrome/Edge found.'); process.exit(1); }
if (!existsSync(SRC)) { console.error(`Missing source: ${SRC}`); process.exit(1); }

const FOOTER = `
<div style="width:100%;font-size:8px;font-family:Arial,sans-serif;color:#6B7A93;
            padding:0 15mm;display:flex;justify-content:space-between;">
  <span>PMES User Manual &middot; Version 1.0</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;

// An empty div, not an empty string: Chrome falls back to its default header
// (date + title) when the template has no renderable content.
const HEADER = '<div style="display:none"></div>';

const profileDir = mkdtempSync(join(tmpdir(), 'pmes-pdf-'));
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${PORT}`,
  'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cdpTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find(t => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint never became available.');
}

function cdpSession(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const events = new Map();

  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: res, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method && events.has(msg.method)) {
      events.get(msg.method)();
      events.delete(msg.method);
    }
  });

  return {
    ready: new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('CDP socket failed')), { once: true });
    }),
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((res, rej) => {
        pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    once(method) { return new Promise(res => events.set(method, res)); },
    close() { ws.close(); }
  };
}

try {
  const session = cdpSession(await cdpTarget());
  await session.ready;
  await session.send('Page.enable');

  const loaded = session.once('Page.loadEventFired');
  await session.send('Page.navigate', { url: pathToFileURL(SRC).href });
  await loaded;
  await sleep(1200); // let the embedded seal decode and fonts settle

  const { data } = await session.send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,   // honour the @page A4 + margins in the stylesheet
    displayHeaderFooter: true,
    headerTemplate: HEADER,
    footerTemplate: FOOTER
  });

  writeFileSync(OUT, Buffer.from(data, 'base64'));
  session.close();
  console.log(`Wrote ${OUT} (${(statSync(OUT).size / 1024).toFixed(0)} KB)`);
} finally {
  chrome.kill();
  try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* best effort */ }
}
