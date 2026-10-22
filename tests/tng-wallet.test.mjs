import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto, createHash } from 'node:crypto';
import { test } from 'node:test';
import { PDFDocument, StandardFonts, degrees } from '../vendor/pdf-lib/pdf-lib.esm.min.js';

const copy = value => JSON.parse(JSON.stringify(value));
function modules(document = { baseURI: new URL('../index.html', import.meta.url).href }) {
  const window = { crypto: webcrypto };
  for (const file of ['claims-engine.js', 'tng-wallet.js', 'tng-engine.js', 'tng-files.js'])
    new Function('window', 'document', readFileSync(new URL('../' + file, import.meta.url), 'utf8'))(window, document);
  return { E: window.WorkHubTngEngine, C: window.WorkHubClaimsEngine, F: window.WorkHubTngFiles };
}
// Fictional records reproduce the geometry, wrapping and header-free continuation pages only.
function fixture() {
  const pages = [0, 1].map(() => ({ width: 842, height: 595, items: [] }));
  const put = (page, str, x, y, w = str.length * 5) => pages[page].items.push({ str, x, y, w, h: 10 });
  put(0, 'TNG WALLET TRANSACTION HISTORY', 250, 20);
  put(0, 'Wallet ID', 20, 45); put(0, 'WALLET-DEMO-001', 190, 45);
  ['Date', 'Status', 'Transaction Type', 'Reference', 'Description', 'Details', 'Amount (RM)', 'Wallet Balance']
    .forEach((s, i) => put(0, s, [20, 80, 140, 230, 295, 460, 657.55, 750.31][i], 80,
      [21.12, 28.35, 77.25, 46.13, 50.01, 30.56, 59.45, 66.69][i]));
  const body = (page, y, { type = 'RFID Payment', ref, details = '08/10/2026 07:45 AM', amount = 'RM1.66', status = 'Success', description = 'DEMO ROAD - NORTH' }) => {
    put(page, '9/10/2026', 20, y); put(page, status, 80, y);
    type.split('|').forEach((s, n) => put(page, s, 140, y + n * 12));
    ref.split('|').forEach((s, n) => put(page, s, 230, y + n * 12));
    put(page, description, 295, y); put(page, details, 460, y); put(page, amount, 670, y); put(page, 'RM9,999.99', 750.31, y);
  };
  body(0, 105, { ref: 'DEMOREF001|PART000001|PART000002|PART000003|LAST001' });
  body(0, 170, { ref: 'RELOAD00001', type: 'Reload', amount: 'RM1,000.00', details: 'CARD-REFERENCE', description: 'Credit / Debit Card' });
  body(0, 220, { ref: 'CRD00001', type: 'DUITNOW_RECEI|VEFROM', amount: 'RM25.12', details: 'INCOMING-REFERENCE', description: 'Fictional sender' });
  body(1, 20, { ref: 'RETURN00001|REFERENCE2', details: '08/10/2026 06:30 PM', amount: 'RM2.40' });
  body(1, 80, { ref: 'PMT00001', type: 'Payment', amount: 'RM6.70', details: 'SHOP-REFERENCE', description: 'Fictional cafe' });
  body(1, 130, { ref: 'TRANSFER001', type: 'DUITNOW_TRANS|FERTO', amount: 'RM100.00', details: 'TRANSFER-REFERENCE', description: 'Fictional recipient' });
  body(1, 180, { ref: 'FAILED0001', status: 'Failed', amount: 'RM3.00' });
  body(1, 230, { ref: 'UNKNOWN001', type: 'New wallet feature', amount: 'RM4.00' });
  for (let p = 0; p < pages.length; p++) put(p, '*This is a system generated email.', 20, 545);
  return pages;
}
const data = () => ({ workhub: { claims: { locations: [], expenses: [] } }, schedule: [], projects: [], projectPlans: [], tasks: [] });
const source = { fileHash: 'a'.repeat(64), cardKey: 'b'.repeat(64), fileName: 'fictional-wallet.pdf' };

test('eWallet: wrapped references, header-free continuation pages and amount columns are preserved', () => {
  const { E } = modules(), pages = fixture(), before = copy(pages), result = E.parsePages(pages);
  assert.deepEqual(pages, before);
  assert.equal(result.rows.length, 8);
  assert.equal(result.serial, 'ewallet:WALLET-DEMO-001');
  assert.equal(result.rows[0].transactionNo, 'DEMOREF001PART000001PART000002PART000003LAST001');
  assert.equal(result.rows[0].amountCents, 166);
  assert.equal(result.rows[1].amountCents, 100000);
  assert.equal(result.rows[3].amountCents, 240);
  assert.ok(result.rows.every(r => r.section === 'ewallet' && r.headerPage === 1 && !r.errors.length));
  assert.deepEqual(result.rows.map(r => r.kind), ['toll', 'reload', 'credit', 'toll', 'other', 'transfer', 'unsuccessful', 'unsupported']);
  assert.ok(result.rows.every(r => E.rectangle(r.rect, r.width, r.height)));
  assert.ok(result.rows[0].rect.y + result.rows[0].rect.h < result.rows[1].rect.y);
  assert.ok(result.rows.at(-1).rect.y + result.rows.at(-1).rect.h < 545);
  assert.equal(result.rows[3].rect.y, 19);
  const metrics = fixture(), lastReferenceLine = metrics[0].items.find(i => i.str === 'LAST001');
  lastReferenceLine.inkBottom = lastReferenceLine.y + lastReferenceLine.h + 2.5;
  metrics[0].items.find(i => i.y === 170 && i.x === 20).inkTop = 172;
  const crop = E.parsePages(metrics).rows[0].rect;
  assert.ok(crop.y + crop.h >= lastReferenceLine.inkBottom + 1);
  assert.ok(crop.y + crop.h < 172);
});

test('eWallet: statement dates remain separate from Details dates and AM/PM times are exact', () => {
  const { E } = modules(), pages = fixture(), rows = E.parsePages(pages).rows;
  assert.equal(rows[0].date, '2026-10-08'); assert.equal(rows[0].postedDate, '2026-10-09');
  assert.equal(rows[0].time, '07:45:00'); assert.equal(rows[3].time, '18:30:00');
  assert.equal(rows[4].date, '2026-10-09'); assert.equal(rows[4].time, '');
  for (const [text, expected] of [['08/10/2026 12:00 AM', '00:00:00'], ['08/10/2026 12:00 PM', '12:00:00'], ['08/10/2026 03:11:12 PM', '15:11:12']]) {
    const p = fixture(); p[0].items.find(i => i.str === '08/10/2026 07:45 AM').str = text;
    assert.equal(E.parsePages(p).rows[0].time, expected);
  }
});

test('eWallet: malformed money, dates and references stay review errors without using balances', () => {
  const { E } = modules(), p = fixture();
  p[0].items.find(i => i.str === 'RM1.66').str = '?';
  p[0].items.find(i => i.str === '9/10/2026').str = '31/2/2026';
  p[0].items.find(i => i.str === '08/10/2026 07:45 AM').str = '31/2/2026 07:45 AM';
  p[0].items = p[0].items.filter(i => !(i.x === 230 && i.y >= 105 && i.y < 170));
  const first = E.parsePages(p).rows[0];
  assert.equal(first.amountCents, null);
  assert.match(first.errors.join(' '), /amount/); assert.match(first.errors.join(' '), /date/); assert.match(first.errors.join(' '), /reference/);
  const badHeader = fixture(); badHeader[0].items.find(i => i.str === 'Amount (RM)').str = 'Amount (USD)';
  assert.throws(() => E.parsePages(badHeader), /headings/);
});

test('eWallet: credits, transfers and non-success rows cannot save; eligible provenance and overlap checks survive', () => {
  const { E, C } = modules(), rows = E.parsePages(fixture()).rows, d = data();
  for (const row of rows.filter(E.isExcluded)) assert.throws(() => E.expenses(d, [{ ...row, selected: true }], source), /cannot be imported/);
  const eligible = rows.filter(r => !E.isExcluded(r));
  d.workhub.claims.expenses.push(...E.expenses(d, eligible, source)); C.validate(d);
  assert.equal(d.workhub.claims.expenses.length, 3);
  assert.equal(d.workhub.claims.expenses[0].date, '2026-10-08');
  assert.equal(d.workhub.claims.expenses[0].tngSource.section, 'ewallet');
  assert.equal(d.workhub.claims.expenses[1].tngSource.headerPage, 1);
  assert.equal(E.expenses(data(), [eligible[0]], source, 'posted')[0].date, '2026-10-09');
  assert.throws(() => E.expenses(d, [eligible[0]], { ...source, fileHash: 'c'.repeat(64) }), /already/);
  for (const headerPage of [0, 61, 1.5]) assert.throws(() => E.validateSource({ ...d.workhub.claims.expenses[0].tngSource, headerPage }), /source details/);
  C.validate(copy(d));
});

test('eWallet: multiple wallets, repeated references, inconsistent pages and limits are checked', () => {
  const { E } = modules(), duplicate = fixture();
  duplicate[1].items.find(i => i.str === 'PMT00001').str = 'RELOAD00001';
  assert.match(E.parsePages(duplicate).rows[4].errors.join(' '), /Duplicate/);
  const other = fixture(); other[1].items.push({ str: 'Wallet ID OTHER-WALLET', x: 20, y: 560, w: 180, h: 10 });
  assert.throws(() => E.parsePages(other), /more than one wallet/);
  const size = fixture(); size[1].width = 800; assert.throws(() => E.parsePages(size), /different layout/);
  assert.throws(() => E.parsePages(Array(61).fill(fixture()[0])), /1–60/);
});

async function syntheticPdf() {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const fixturePage of fixture()) {
    // Native portrait media + /Rotate 90 + rotated text, as in the supplied landscape export.
    const page = pdf.addPage([595, 842]); page.setRotation(degrees(90));
    for (const item of fixturePage.items)
      page.drawText(item.str, { x: item.y + 10, y: item.x, size: 10, rotate: degrees(90), font });
  }
  return pdf.save();
}

test('eWallet PDF: the production PDF.js reader accepts native rotated landscape pages and continuations', async () => {
  const { F } = modules(), bytes = await syntheticPdf(), file = new File([bytes], 'fictional-wallet.pdf', { type: 'application/pdf' });
  const result = await F.read(file);
  try {
    assert.equal(result.rows.length, 8);
    assert.equal(result.rows[0].width, 842); assert.equal(result.rows[0].height, 595);
    assert.equal(result.rows[3].headerPage, 1); assert.equal(result.rows[3].page, 2);
    assert.equal(result.rows[0].amountCents, 166); assert.equal(result.rows[3].time, '18:30:00');
    assert.equal(result.source.cardKey, createHash('sha256').update('ewallet:WALLET-DEMO-001').digest('hex'));
    assert.ok(result.rows.every(r => !r.errors.length), JSON.stringify(result.rows.map(r=>({kind:r.kind,errors:r.errors,reference:r.transactionNo,amount:r.amountCents}))));
  } finally { result.close(); }
});

test('eWallet crops: continuation rows copy headings from their source page without changing legacy crops', async () => {
  const draws = [], calls = [];
  const { E, F } = modules({ baseURI: new URL('../index.html', import.meta.url).href,
    createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage(...args) { draws.push(args); } }) }) });
  const row = E.parsePages(fixture()).rows[3], session = { renderPage: async page => { calls.push(page); return { page, width: 1684 }; } };
  await F.crop(session, row, true);
  assert.deepEqual(calls, [2, 1]); assert.equal(draws[0][0].page, 1); assert.equal(draws[1][0].page, 2);
  calls.length = 0; draws.length = 0;
  await F.crop(session, row, false); assert.deepEqual(calls, [2]); assert.equal(draws.length, 1);
  calls.length = 0; draws.length = 0;
  const legacy = { ...row, section: 'offline' }; delete legacy.headerPage;
  await F.crop(session, legacy, true); assert.deepEqual(calls, [2]); assert.ok(draws.every(args => args[0].page === 2));
  assert.match(F.filename(row), /-ewallet-/);
});
