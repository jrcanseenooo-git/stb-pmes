/**
 * Builds docs/PMES_USER_MANUAL.docx from docs/PMES_USER_MANUAL.html.
 *
 *   node tools/build-manual-docx.mjs
 *
 * Generated from the HTML rather than hand-transcribed, so the Word version
 * cannot drift out of step with the PDF. Sections use Word's BUILT-IN heading
 * styles, which is what makes the file genuinely editable: the navigation pane
 * works, the table of contents field updates itself (Ctrl+A then F9), and
 * restyling every heading is a matter of editing one style rather than
 * touching 20 headings by hand.
 *
 * Run from the repo root. Requires `docx` and `node-html-parser`; if they are
 * not resolvable locally, point NODE_PATH at the directory holding them.
 */
import { writeFileSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'docs', 'PMES_USER_MANUAL.html');
const OUT = join(ROOT, 'docs', 'PMES_USER_MANUAL.docx');

const require = createRequire(import.meta.url);
const D = require('docx');
const { parse } = require('node-html-parser');

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  TableOfContents, PageBreak, LevelFormat, ImageRun, PageNumber, Header, Footer
} = D;

// ── Palette, mirroring the HTML's tokens ──────────────────────────────────
const NAVY = '08213D', GOLD = 'A9761C', INK = '0D1B2A', INK2 = '41506B',
      RULE = 'D8DEE7', SOFT = 'F3F5F9', BRANDSOFT = 'E8EFF9',
      WARNSOFT = 'FDF1E3', STOPSOFT = 'FBEAEA', GOLDSOFT = 'F7EFDF';

const PAGE_W = 11906, MARGIN = 850;          // A4 DXA, ~15mm margins
const CONTENT_W = PAGE_W - MARGIN * 2;

const html = readFileSync(SRC, 'utf8');
const root = parse(html);

const txt = el => (el?.text || '').replace(/\s+/g, ' ').trim();

function runs(el, opts = {}) {
  // Walks inline children so <strong> and <em> survive into Word rather than
  // being flattened to plain text.
  const out = [];
  const walk = (node, bold, italic) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const t = child.rawText.replace(/\s+/g, ' ');
        if (t.trim() || out.length) out.push(new TextRun({
          text: t, bold: bold || opts.bold, italics: italic,
          size: opts.size || 20, color: opts.color || INK2, font: 'Calibri'
        }));
      } else if (child.nodeType === 1) {
        const tag = child.rawTagName?.toLowerCase();
        walk(child, bold || tag === 'strong' || tag === 'b', italic || tag === 'em' || tag === 'i');
      }
    }
  };
  walk(el, false, false);
  return out.length ? out : [new TextRun({ text: '', size: opts.size || 20 })];
}

const para = (el, opts = {}) => new Paragraph({
  children: runs(el, opts),
  spacing: { after: opts.after ?? 140, line: 276 },
  ...(opts.bullet ? { bullet: { level: 0 } } : {}),
  ...(opts.numbering ? { numbering: opts.numbering } : {}),
  ...(opts.indent ? { indent: opts.indent } : {})
});

function textPara(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, size: opts.size || 20,
      color: opts.color || INK2, font: 'Calibri', allCaps: opts.caps })],
    spacing: { after: opts.after ?? 140, line: 276 },
    alignment: opts.align
  });
}

// ── Tables ────────────────────────────────────────────────────────────────
function buildTable(tableEl) {
  const headCells = tableEl.querySelectorAll('thead th');
  const bodyRows = tableEl.querySelectorAll('tbody tr');
  if (!headCells.length && !bodyRows.length) return null;

  const cols = headCells.length || (bodyRows[0]?.querySelectorAll('td').length ?? 1);
  // Column widths must sum to the table width or Word/Docs mis-render the grid.
  const base = Math.floor(CONTENT_W / cols);
  const widths = Array.from({ length: cols }, (_, i) =>
    i === cols - 1 ? CONTENT_W - base * (cols - 1) : base);

  const rows = [];
  if (headCells.length) {
    rows.push(new TableRow({
      tableHeader: true,
      children: headCells.map((th, i) => new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' },
        margins: { top: 80, bottom: 80, left: 110, right: 110 },
        children: [new Paragraph({ children: [new TextRun({
          text: txt(th), bold: true, size: 17, color: 'FFFFFF', font: 'Calibri', allCaps: true
        })], spacing: { after: 0 } })]
      }))
    }));
  }

  for (const tr of bodyRows) {
    const cells = tr.querySelectorAll('td');
    if (!cells.length) continue;
    rows.push(new TableRow({
      children: cells.map((td, i) => {
        const span = Number(td.getAttribute('rowspan') || 0);
        return new TableCell({
          width: { size: widths[Math.min(i, cols - 1)], type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 110, right: 110 },
          ...(span > 1 ? { rowSpan: span } : {}),
          children: [new Paragraph({
            children: runs(td, { size: 19, bold: i === 0 }),
            spacing: { after: 0 }
          })]
        });
      })
    }));
  }

  return new Table({
    rows,
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    borders: ['top', 'bottom', 'left', 'right', 'insideHorizontal', 'insideVertical']
      .reduce((acc, k) => (acc[k] = { style: BorderStyle.SINGLE, size: 2, color: RULE }, acc), {})
  });
}

// ── Callouts: a one-cell shaded table reads as a box in Word ───────────────
function buildNote(noteEl) {
  const cls = noteEl.getAttribute('class') || '';
  const fill = cls.includes('stop') ? STOPSOFT
    : cls.includes('warn') ? WARNSOFT
    : cls.includes('fill') ? GOLDSOFT : BRANDSOFT;
  const accent = cls.includes('stop') ? 'B91C1C'
    : cls.includes('warn') ? 'B45309'
    : cls.includes('fill') ? GOLD : '0B3B75';

  const label = noteEl.querySelector('.note-label');
  const kids = [];
  if (label) kids.push(new Paragraph({
    children: [new TextRun({ text: txt(label), bold: true, size: 17, color: accent, font: 'Calibri', allCaps: true })],
    spacing: { after: 60 }
  }));
  for (const p of noteEl.querySelectorAll('p')) {
    if (p.classNames?.includes('note-label')) continue;
    kids.push(new Paragraph({ children: runs(p, { size: 19 }), spacing: { after: 60, line: 276 } }));
  }
  if (!kids.length) return null;

  return new Table({
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
      margins: { top: 140, bottom: 140, left: 160, right: 160 },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: fill },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: fill },
        right: { style: BorderStyle.SINGLE, size: 2, color: fill },
        left: { style: BorderStyle.SINGLE, size: 18, color: accent }
      },
      children: kids
    })] })],
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W]
  });
}

// ── Document body ─────────────────────────────────────────────────────────
const children = [];

// Cover
const logoSrc = root.querySelector('.crest img')?.getAttribute('src') || '';
if (logoSrc.startsWith('data:image/png;base64,')) {
  children.push(new Paragraph({
    children: [new ImageRun({
      type: 'png',
      data: Buffer.from(logoSrc.split(',')[1], 'base64'),
      transformation: { width: 210, height: 76 }
    })],
    spacing: { after: 220 }
  }));
}
children.push(
  textPara('Republic of the Philippines', { size: 17, caps: true, bold: true, color: INK2, after: 40 }),
  textPara('Department of Social Welfare and Development', { size: 24, bold: true, color: NAVY, after: 40 }),
  textPara('Social Technology Bureau · Innovation Cluster', { size: 20, color: INK2, after: 420 }),
  textPara('User Manual', { size: 19, bold: true, caps: true, color: GOLD, after: 100 }),
  new Paragraph({
    children: [new TextRun({ text: 'Performance Monitoring and Evaluation System',
      bold: true, size: 52, color: NAVY, font: 'Calibri' })],
    spacing: { after: 220 }
  }),
  textPara('How to sign in, complete your assigned ratings, read your results, and - for administrators - set up your office, tag raters, and generate reports.',
    { size: 22, color: INK2, after: 320 }),
  textPara('Version 1.0   ·   Issued 16 August 2026', { size: 19, bold: true, color: INK, after: 60 }),
  textPara('Applies to all participating Innovation Cluster offices   ·   Instrument: IPAT (AO No. 11 s. 2025)',
    { size: 19, color: INK2, after: 0 }),
  new Paragraph({ children: [new PageBreak()] })
);

// Table of contents - a real field, so Word regenerates it after edits.
children.push(
  textPara('Table of Contents', { size: 28, bold: true, color: NAVY, after: 60 }),
  textPara('Right-click and choose "Update Field" after editing headings.', { size: 17, color: INK2, after: 200 }),
  new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-3' }),
  new Paragraph({ children: [new PageBreak()] })
);

// Sections
for (const section of root.querySelectorAll('section.section')) {
  const numeral = txt(section.querySelector('.section-numeral'));
  const title = txt(section.querySelector('.section-title h2'));
  const sub = txt(section.querySelector('.section-title p'));
  const chips = section.querySelectorAll('.audience .chip').map(c => txt(c));

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 80 },
    children: [new TextRun({ text: `${numeral}.  ${title}`, bold: true, size: 34, color: NAVY, font: 'Calibri' })]
  }));
  if (sub) children.push(textPara(sub, { size: 20, color: INK2, after: 60 }));
  if (chips.length) children.push(textPara(chips.join('   ·   '), { size: 16, bold: true, caps: true, color: GOLD, after: 160 }));

  // Walk the section body in document order so nothing is reordered.
  for (const node of section.childNodes) {
    if (node.nodeType !== 1) continue;
    const el = node;
    const tag = el.rawTagName?.toLowerCase();
    const cls = el.getAttribute?.('class') || '';
    if (cls.includes('section-head')) continue;

    if (tag === 'h3') {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 260, after: 70 },
        children: [new TextRun({ text: txt(el), bold: true, size: 25, color: NAVY, font: 'Calibri' })]
      }));
    } else if (tag === 'h4') {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 60 },
        children: [new TextRun({ text: txt(el), bold: true, size: 21, color: INK, font: 'Calibri' })]
      }));
    } else if (tag === 'p') {
      children.push(para(el));
    } else if (tag === 'ul') {
      for (const li of el.querySelectorAll('li')) children.push(para(li, { bullet: true, after: 70 }));
    } else if (tag === 'ol' && cls.includes('steps')) {
      let n = 1;
      for (const li of el.querySelectorAll('li')) {
        const b = li.querySelector('b'), s = li.querySelector('span');
        children.push(new Paragraph({
          children: [new TextRun({ text: `${n++}.  `, bold: true, size: 20, color: GOLD, font: 'Calibri' }),
                     new TextRun({ text: txt(b), bold: true, size: 20, color: INK, font: 'Calibri' })],
          spacing: { before: 100, after: 30 }
        }));
        if (s) children.push(new Paragraph({
          children: runs(s, { size: 19 }),
          indent: { left: 340 }, spacing: { after: 80, line: 276 }
        }));
      }
    } else if (tag === 'ol') {
      let n = 1;
      for (const li of el.querySelectorAll('li')) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `${n++}. `, bold: true, size: 20, color: GOLD, font: 'Calibri' }),
                     ...runs(li)],
          spacing: { after: 70, line: 276 }, indent: { left: 260 }
        }));
      }
    } else if (cls.includes('table-wrap')) {
      const t = buildTable(el.querySelector('table'));
      if (t) { children.push(t); children.push(textPara('', { after: 160 })); }
    } else if (cls.includes('note')) {
      const n = buildNote(el);
      if (n) { children.push(n); children.push(textPara('', { after: 160 })); }
    } else if (cls.includes('formula')) {
      const label = el.querySelector('.formula-label');
      const eq = el.querySelector('.formula-eq');
      const note = el.querySelector('.formula-note');
      const kids = [];
      if (label) kids.push(new Paragraph({ children: [new TextRun({ text: txt(label), bold: true, size: 16, color: GOLD, font: 'Calibri', allCaps: true })], spacing: { after: 70 } }));
      if (eq) kids.push(new Paragraph({ children: [new TextRun({ text: txt(eq), bold: true, size: 22, color: 'FFFFFF', font: 'Consolas' })], spacing: { after: note ? 100 : 0 } }));
      if (note) kids.push(new Paragraph({ children: runs(note, { size: 18, color: 'D8DEE7' }), spacing: { after: 0, line: 276 } }));
      children.push(new Table({
        rows: [new TableRow({ children: [new TableCell({
          width: { size: CONTENT_W, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' },
          margins: { top: 180, bottom: 180, left: 200, right: 200 },
          children: kids
        })] })],
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W]
      }));
      children.push(textPara('', { after: 160 }));
    } else if (cls.includes('grid')) {
      for (const card of el.querySelectorAll('.card')) {
        const h = card.querySelector('h5'), p = card.querySelector('p'), path = card.querySelector('.card-path');
        children.push(new Paragraph({
          children: [new TextRun({ text: '▪  ', color: GOLD, bold: true, size: 20 }),
                     new TextRun({ text: txt(h), bold: true, size: 20, color: NAVY, font: 'Calibri' }),
                     ...(path ? [new TextRun({ text: `   ${txt(path)}`, size: 17, color: INK2, font: 'Consolas' })] : [])],
          spacing: { before: 90, after: 25 }
        }));
        if (p) children.push(new Paragraph({ children: runs(p, { size: 19 }), indent: { left: 260 }, spacing: { after: 70, line: 276 } }));
      }
      children.push(textPara('', { after: 100 }));
    } else if (cls.includes('faq')) {
      for (const item of el.querySelectorAll('div')) {
        const q = item.querySelector('q'), a = item.querySelector('p');
        if (!q) continue;
        children.push(new Paragraph({
          children: [new TextRun({ text: txt(q), bold: true, size: 20, color: NAVY, font: 'Calibri' })],
          spacing: { before: 140, after: 40 }
        }));
        if (a) children.push(new Paragraph({ children: runs(a, { size: 19 }), spacing: { after: 80, line: 276 } }));
      }
    } else if (tag === 'figure') {
      const img = el.querySelector('img');
      const cap = el.querySelector('figcaption');
      const src = img?.getAttribute('src') || '';
      const m = /^data:image\/(png|jpe?g);base64,(.+)$/s.exec(src);
      if (m) {
        children.push(new Paragraph({
          children: [new ImageRun({
            type: m[1].startsWith('jp') ? 'jpg' : 'png',
            data: Buffer.from(m[2], 'base64'),
            transformation: { width: 600, height: 338 }
          })],
          spacing: { before: 140, after: 60 }
        }));
      }
      if (cap) children.push(textPara(txt(cap), { size: 17, color: INK2, after: 160 }));
    }
  }
}

const doc = new Document({
  creator: 'DSWD Social Technology Bureau',
  title: 'PMES User Manual',
  description: 'Performance Monitoring and Evaluation System - User Manual, Version 1.0',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 20, color: INK2 } } }
  },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 950, bottom: 950, left: MARGIN, right: MARGIN } } },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: RULE, space: 8 } },
        children: [
          new TextRun({ text: 'PMES User Manual · Version 1.0          Page ', size: 16, color: '6B7A93', font: 'Calibri' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '6B7A93', font: 'Calibri' }),
          new TextRun({ text: ' of ', size: 16, color: '6B7A93', font: 'Calibri' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '6B7A93', font: 'Calibri' })
        ]
      })] })
    },
    children
  }]
});

const buf = await Packer.toBuffer(doc);
writeFileSync(OUT, buf);
console.log(`Wrote ${OUT} (${(statSync(OUT).size / 1024).toFixed(0)} KB, ${children.length} block elements)`);
