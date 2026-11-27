#!/usr/bin/env node
/* Gearhead Labs: builds the DELIVERED analytics script, analytics.min.js, from the readable source analytics.js.

   Why: the site is published by GitHub Pages straight from the repository (Jekyll copies .js files unchanged; there is no
   build step on the host). So the minified file is generated here, committed next to its source, and index.html loads it.
   analytics.js stays the readable, reviewed source; analytics.min.js is never edited by hand.

   Reproducible: terser is pinned to an exact version with integrity hashes (package-lock.json, installed with `npm ci`), and
   the options below are fixed. The same source and the same terser always give the same bytes.

   Usage (from the repository root):
     npm ci --prefix tools/analytics-build
     node tools/analytics-build/build.mjs           write analytics.min.js and update its ?v= in index.html
     node tools/analytics-build/build.mjs --check   change nothing; fail (exit 1) if analytics.min.js or index.html's ?v= is
                                                   stale, or if the delivered script compressed with gzip at ANY level 1-9
                                                   is over 8,192 bytes
   Size rule: the measure is the gzip-compressed response (what the browser downloads). The host's gzip level is not
   published, so the check uses the LARGEST result over levels 1-9 (level 1 compresses least). */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const require = createRequire(import.meta.url);
const { minify } = require('terser');
const TERSER_VERSION = require('terser/package.json').version;

const SRC = 'analytics.js', OUT = 'analytics.min.js', HTML = 'index.html';
const LIMIT = 8192;
const PINNED = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8')).devDependencies.terser;

/* Fixed options. Output stays ES5 (the source is ES5), every non-ASCII character is written as an escape (no dependence on the
   charset the host declares), no property names are renamed (window.GH_ANALYTICS, storage keys and event fields keep their
   exact names), and no source comments are kept. */
const OPTIONS = {
  ecma: 5,
  compress: { passes: 2 },
  mangle: { toplevel: false, properties: false },
  format: { ascii_only: true, comments: false, semicolons: true },
  sourceMap: false
};

const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const gzipSizes = b => { const s = {}; for (let l = 1; l <= 9; l++) s[l] = zlib.gzipSync(b, { level: l }).length; return s; };

async function build() {
  if (TERSER_VERSION !== PINNED) throw new Error(`terser ${TERSER_VERSION} is installed but ${PINNED} is pinned: run npm ci --prefix tools/analytics-build`);
  const src = fs.readFileSync(path.join(REPO, SRC));
  const r = await minify(src.toString('utf8'), OPTIONS);
  if (!r.code) throw new Error('terser produced no output');
  const header = `/* Generated from ${SRC} (sha256 ${sha256(src)}) by tools/analytics-build with terser ${TERSER_VERSION}. Do not edit: edit ${SRC} and rebuild. */\n`;
  const out = Buffer.from(header + r.code + '\n', 'utf8');
  return { src, out, v: sha256(out).slice(0, 12) };
}

const TAG = /<script src="analytics(?:\.min)?\.js\?v=[^"]*" defer><\/script>/;
const tagFor = v => `<script src="${OUT}?v=${v}" defer></script>`;

const { out, v } = await build();
const sizes = gzipSizes(out), worst = Math.max(...Object.values(sizes));
const html = fs.readFileSync(path.join(REPO, HTML), 'utf8');
if (!TAG.test(html)) { console.error(`FAIL ${HTML}: the analytics <script ... defer> tag was not found`); process.exit(1); }
const report = `${OUT}: ${out.length} bytes; gzip level 6: ${sizes[6]} bytes; level 9: ${sizes[9]} bytes; largest over levels 1-9: ${worst} bytes (limit ${LIMIT})`;

if (process.argv.includes('--check')) {
  const problems = [];
  const cur = fs.existsSync(path.join(REPO, OUT)) ? fs.readFileSync(path.join(REPO, OUT)) : null;
  if (!cur || !cur.equals(out)) problems.push(`${OUT} is stale or missing: it is not exactly what ${SRC} builds to (run node tools/analytics-build/build.mjs)`);
  if (!html.includes(tagFor(v))) problems.push(`${HTML} does not load ${OUT}?v=${v} (the version must be the first 12 hex digits of its sha256)`);
  const served = cur || out;
  const servedWorst = Math.max(...Object.values(gzipSizes(served)));
  if (worst > LIMIT || servedWorst > LIMIT) problems.push(`the delivered script is over ${LIMIT} bytes gzip-compressed (largest over levels 1-9: ${Math.max(worst, servedWorst)})`);
  console.log(report);
  if (problems.length) { problems.forEach(p => console.error('FAIL ' + p)); process.exit(1); }
  console.log(`PASS ${OUT} is current, ${HTML} loads ?v=${v}, and the gzip size is within ${LIMIT} bytes at every level`);
} else {
  fs.writeFileSync(path.join(REPO, OUT), out);
  fs.writeFileSync(path.join(REPO, HTML), html.replace(TAG, tagFor(v)));
  console.log(report);
  console.log(`wrote ${OUT}; ${HTML} now loads ${OUT}?v=${v}`);
  if (worst > LIMIT) { console.error(`FAIL over ${LIMIT} bytes gzip-compressed`); process.exit(1); }
}
