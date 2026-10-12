#!/usr/bin/env node
/* Gearhead Labs — structural check of docs/DEFERRED-WORK-REGISTER.md (the authoritative register of known defects, deferred
   improvements, engineering questions and future work). It checks the bookkeeping, not the engineering:

     1. every entry heading is "### GH-<KIND>-<NNN> — <title>" with a unique ID, filed under the section that matches its kind
        (A defects DEF, B improvements IMP, C engineering questions ENG, D future development FUT, E expected behavior EXP);
     2. every required field is present and not empty;
     3. the Status is one of the register's status words, and only the kinds allowed to use it use it;
     4. a defect is not "closed" by a code change alone:
          FIXED — UNVERIFIED  needs a Commits entry,
          VERIFIED CLOSED     needs Commits AND Tests entries and a "closed" History line that records the evidence;
     5. every GH-... reference inside the register points at an entry that exists;
     6. every id in the known-open ledger of premium/tests/toggle-sweep.test.js appears (in backticks) in an entry that is still open,
        and a non-empty premium/tests/data/nav-return-open.json is named by one, so the test ledgers and the register cannot drift apart;
     7. the generated index between the INDEX markers matches the entries (node premium/tests/register-check.js --write-index rewrites it).

   Run: node premium/tests/register-check.js          exit 0 = register is consistent, 1 = it is not
        node premium/tests/register-check.js --write-index   regenerate the index block, then check
        node premium/tests/register-check.js --summary       print counts by kind and status */
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
const REG = process.env.GH_REGISTER ? path.resolve(process.env.GH_REGISTER) : path.join(REPO, 'docs', 'DEFERRED-WORK-REGISTER.md');
const SWEEP = path.join(REPO, 'premium', 'tests', 'toggle-sweep.test.js');

const KINDS = { DEF: 'A', IMP: 'B', ENG: 'C', FUT: 'D', EXP: 'E' };
const FIELDS = ['Status', 'Severity', 'Priority', 'Description', 'Evidence', 'Affected', 'Impact', 'Decision', 'Dependencies', 'Revisit', 'Commits', 'Tests', 'Docs', 'Verification', 'History'];
const STATUSES = ['OPEN', 'INVESTIGATING', 'DEFERRED', 'IN PROGRESS', 'FIXED — UNVERIFIED', 'VERIFIED CLOSED', 'SUPERSEDED', 'APPROVED', 'AWAITING AUTHORIZATION', 'EXPECTED BEHAVIOR'];
const ONLY_KIND = { APPROVED: ['FUT'], 'AWAITING AUTHORIZATION': ['FUT'], 'EXPECTED BEHAVIOR': ['EXP'] };
const OPEN_STATUSES = new Set(['OPEN', 'INVESTIGATING', 'DEFERRED', 'IN PROGRESS', 'FIXED — UNVERIFIED', 'APPROVED', 'AWAITING AUTHORIZATION', 'EXPECTED BEHAVIOR']);
const NONE = /^(none|n\/a|—|-)(\b|$)/i;           // "None", "None yet.", "n/a" all mean there is nothing to cite

const args = new Set(process.argv.slice(2));
const problems = [];
const bad = m => problems.push(m);

function parse(text) {
  const lines = text.split('\n'), entries = []; let section = null, cur = null, field = null;
  for (const line of lines) {
    const sec = line.match(/^## ([A-E])\. /);
    if (sec) { section = sec[1]; cur = null; field = null; continue; }
    if (/^## /.test(line)) { section = null; cur = null; field = null; continue; }
    const h = line.match(/^### (GH-([A-Z]+)-(\d{3})) — (.+)$/);
    if (h) { cur = { id: h[1], kind: h[2], title: h[4].trim(), section, fields: {}, order: entries.length }; entries.push(cur); field = null; continue; }
    if (/^### /.test(line)) { bad(`malformed entry heading: "${line}" (expected "### GH-KIND-NNN — title")`); cur = null; field = null; continue; }
    if (!cur) continue;
    const f = line.match(/^- \*\*([A-Za-z ]+):\*\*\s?(.*)$/);
    if (f) { field = f[1].trim(); if (cur.fields[field] !== undefined) bad(`${cur.id}: field "${field}" appears twice`); cur.fields[field] = f[2]; continue; }
    if (field && /^\s+\S/.test(line)) { cur.fields[field] += '\n' + line.trim(); continue; }
  }
  return entries;
}

const SEVERITY_OK = /^(Critical|High|Medium|Low|Unknown|None|n\/a)\b/i;
const PRIORITY_OK = /^(P0|P1|P2|P3|High|Medium|Low|Deferred|n\/a|None)\b/i;

function checkEntries(entries, text) {
  const ids = new Set();
  for (const e of entries) {
    if (ids.has(e.id)) bad(`${e.id}: duplicate ID`);
    ids.add(e.id);
    if (!KINDS[e.kind]) { bad(`${e.id}: unknown kind "${e.kind}"`); continue; }
    if (e.section !== KINDS[e.kind]) bad(`${e.id}: kind ${e.kind} belongs in section ${KINDS[e.kind]}, found in ${e.section || 'none'}`);
    for (const f of FIELDS) {
      const v = e.fields[f];
      if (v === undefined) bad(`${e.id}: missing field "${f}"`);
      else if (!v.trim()) bad(`${e.id}: field "${f}" is empty (write "None" if there is genuinely nothing)`);
    }
    const status = (e.fields.Status || '').trim();
    if (!STATUSES.includes(status)) bad(`${e.id}: Status "${status}" is not one of: ${STATUSES.join(', ')}`);
    else if (ONLY_KIND[status] && !ONLY_KIND[status].includes(e.kind)) bad(`${e.id}: Status "${status}" is only for kinds ${ONLY_KIND[status].join(', ')}`);
    if (e.kind === 'EXP' && status !== 'EXPECTED BEHAVIOR' && status !== 'SUPERSEDED') bad(`${e.id}: an EXP entry must have Status EXPECTED BEHAVIOR (or SUPERSEDED)`);
    if (e.fields.Severity && !SEVERITY_OK.test(e.fields.Severity.trim())) bad(`${e.id}: Severity must start with Critical, High, Medium, Low, Unknown, None or n/a`);
    if (e.fields.Priority && !PRIORITY_OK.test(e.fields.Priority.trim())) bad(`${e.id}: Priority must start with P0-P3, High, Medium, Low, Deferred, n/a or None`);
    const commits = (e.fields.Commits || '').trim(), tests = (e.fields.Tests || '').trim(), hist = e.fields.History || '';
    if (status === 'FIXED — UNVERIFIED' && (!commits || NONE.test(commits))) bad(`${e.id}: FIXED — UNVERIFIED needs a Commits entry`);
    if (status === 'VERIFIED CLOSED') {
      if (!commits || NONE.test(commits)) bad(`${e.id}: VERIFIED CLOSED needs a Commits entry (a closure is not valid without the change it closes)`);
      if (!tests || NONE.test(tests)) bad(`${e.id}: VERIFIED CLOSED needs a Tests entry (closure requires passing verification evidence)`);
      if (!/closed/i.test(hist)) bad(`${e.id}: VERIFIED CLOSED needs a History line that says "closed" and records the evidence`);
    }
    if (!/\b20\d\d-\d\d-\d\d\b/.test(e.fields.History || '')) bad(`${e.id}: History needs at least one dated line (YYYY-MM-DD)`);
  }
  const refs = new Set(text.match(/GH-(?:DEF|IMP|ENG|FUT|EXP)-\d{3}/g) || []);
  for (const r of refs) if (!ids.has(r)) bad(`reference to ${r}, which has no entry`);
  return ids;
}

function ledgerIds() {
  const src = fs.readFileSync(SWEEP, 'utf8'), out = new Set();
  for (const name of ['CLASS_A', 'CLASS_B', 'EXPECTED_ROUNDING', 'CONVERTERS_OPEN']) {          // CONVERTERS_FIXED is history, not open work
    const m = src.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];'));
    if (!m) { if (name !== 'CLASS_B') bad(`toggle-sweep.test.js: could not read ${name}`); continue; }
    (m[1].match(/'([a-z0-9_]+)'/g) || []).forEach(s => out.add(s.slice(1, -1)));
  }
  return out;
}

function checkLedger(entries) {
  const live = entries.filter(e => OPEN_STATUSES.has((e.fields.Status || '').trim()));
  const liveText = live.map(e => Object.values(e.fields).join('\n') + '\n' + e.title).join('\n');
  const allText = entries.map(e => Object.values(e.fields).join('\n')).join('\n');
  let n = 0;
  for (const id of ledgerIds()) {
    n++;
    if (!liveText.includes('`' + id + '`')) {
      const closedMention = allText.includes('`' + id + '`');
      bad(`toggle-sweep ledger id "${id}" is not named (in backticks) in any entry that is still open${closedMention ? ' (it is only named in closed entries; remove it from the test ledger if it is really fixed)' : ''}`);
    }
  }
  /* the navigate-away-and-return ledger holds hundreds of ids: it is traced by file name, not id by id */
  const NAV = path.join(REPO, 'premium', 'tests', 'data', 'nav-return-open.json');
  if (fs.existsSync(NAV)) {
    let ids = []; try { ids = JSON.parse(fs.readFileSync(NAV, 'utf8')).ids || []; } catch (e) { bad('premium/tests/data/nav-return-open.json is not valid JSON'); }
    if (ids.length) { n += ids.length; if (!liveText.includes('premium/tests/data/nav-return-open.json')) bad(`nav-return ledger lists ${ids.length} calculators but no entry that is still open names premium/tests/data/nav-return-open.json`); }
  }
  return n;
}

function indexBlock(entries) {
  const row = e => `| [${e.id}](#${e.id.toLowerCase()}--${e.title.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-')}) | ${e.title.replace(/\|/g, '/')} | ${(e.fields.Status || '').trim()} | ${(e.fields.Severity || '').split(/[.;(—]/)[0].trim()} | ${(e.fields.Priority || '').split(/[.;(—]/)[0].trim()} |`;
  const out = ['| ID | Title | Status | Severity | Priority |', '|---|---|---|---|---|'];
  entries.forEach(e => out.push(row(e)));
  return out.join('\n');
}

function main() {
  if (!fs.existsSync(REG)) { console.error('register not found: ' + REG); process.exit(1); }
  let text = fs.readFileSync(REG, 'utf8');
  const entries = parse(text);
  if (!entries.length) bad('no entries found');
  const m = text.match(/(<!-- INDEX:START[^>]*-->\n)([\s\S]*?)(\n<!-- INDEX:END -->)/);
  if (!m) bad('INDEX markers not found (<!-- INDEX:START --> ... <!-- INDEX:END -->)');
  if (args.has('--write-index') && m) { text = text.replace(m[0], m[1] + indexBlock(entries) + m[3]); fs.writeFileSync(REG, text); console.log('index regenerated (' + entries.length + ' entries)'); }
  const ids = checkEntries(entries, text);
  const ledgerN = checkLedger(entries);
  const m2 = text.match(/<!-- INDEX:START[^>]*-->\n([\s\S]*?)\n<!-- INDEX:END -->/);
  if (m2 && m2[1] !== indexBlock(entries)) bad('the generated index is out of date: run  node premium/tests/register-check.js --write-index');
  const counts = {}; entries.forEach(e => { const k = e.kind + ' ' + (e.fields.Status || '?').trim(); counts[k] = (counts[k] || 0) + 1; });
  if (args.has('--summary')) { Object.keys(counts).sort().forEach(k => console.log(k.padEnd(34), counts[k])); }
  if (problems.length) { console.error(problems.map(p => '  FAIL ' + p).join('\n')); console.error(`\nregister check: ${problems.length} problem(s) in ${entries.length} entries`); process.exit(1); }
  const kinds = {}; entries.forEach(e => kinds[e.kind] = (kinds[e.kind] || 0) + 1);
  console.log(`register check: OK — ${entries.length} entries (${Object.keys(kinds).sort().map(k => k + ' ' + kinds[k]).join(', ')}); ${ids.size} unique IDs; ${ledgerN} ledger ids all traced to open entries`);
}
main();
