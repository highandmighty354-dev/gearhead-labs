'use strict';
/* VALUE-FOUNDATION 1.0.0 - strict RFC 4180 CSV reader for the approved companion artifacts.
 * The artifacts are read exactly as approved (CRLF records, quoted fields with embedded commas, doubled quotes).
 * Anything malformed throws: the approved bytes are never repaired, normalized or guessed at. */

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', i = 0, quoted = false, fieldStart = true;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++;
        if (i < text.length && text[i] !== ',' && text[i] !== '\r' && text[i] !== '\n') throw new Error('csv: text after closing quote at ' + i);
        continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') {
      if (!fieldStart) throw new Error('csv: quote inside unquoted field at ' + i);
      quoted = true; fieldStart = false; i++; continue;
    }
    if (ch === ',') { row.push(field); field = ''; fieldStart = true; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = ''; fieldStart = true; i++; continue;
    }
    field += ch; fieldStart = false; i++;
  }
  if (quoted) throw new Error('csv: unterminated quoted field');
  if (!fieldStart || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* -> array of frozen objects keyed by the header. Every record must have exactly the header's field count. */
function readRecords(text) {
  const rows = parseCsv(text);
  if (rows.length < 1) throw new Error('csv: empty');
  const header = rows[0];
  if (new Set(header).size !== header.length) throw new Error('csv: duplicate header');
  return rows.slice(1).map((r, n) => {
    if (r.length !== header.length) throw new Error(`csv: record ${n + 1} has ${r.length} fields, header has ${header.length}`);
    const o = {}; header.forEach((h, k) => { o[h] = r[k]; }); return Object.freeze(o);
  });
}

module.exports = { parseCsv, readRecords };
