import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
let nextId = 0;
const window = {
  crypto: { randomUUID: () => `fixture-${++nextId}` },
  WorkHubLeave: { isLeave: k => k === 'annual-leave' },
};
for (const file of ['claims-engine.js', 'tng-engine.js'])
  runInNewContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { window });
const E = window.WorkHubTngEngine,
  C = window.WorkHubClaimsEngine,
  copy = x => JSON.parse(JSON.stringify(x));
const source = { fileHash: 'a'.repeat(64), cardKey: 'b'.repeat(64), fileName: 'fixture.pdf' };
function row(patch = {}) {
  return {
    id: 'r1',
    transactionNo: '0000123',
    section: 'offline',
    page: 1,
    width: 595,
    height: 842,
    date: '2026-10-09',
    postedDate: '2026-10-10',
    time: '09:00:00',
    type: 'Fare Usage - Toll/Bus',
    sector: 'TOLL',
    entry: 'SITE A',
    exit: 'SITE B',
    amountCents: 166,
    kind: 'toll',
    category: 'toll',
    rect: { x: 20, y: 60, w: 555, h: 30 },
    originalRect: { x: 20, y: 60, w: 555, h: 30 },
    headerRect: { x: 20, y: 20, w: 555, h: 30 },
    errors: [],
    manual: false,
    selected: true,
    bookingKey: '',
    description: 'SITE A → SITE B',
    ...patch,
  };
}
function data() {
  return {
    workhub: { claims: { locations: [], expenses: [] } },
    schedule: [],
    projects: [],
    projectPlans: [],
    tasks: [],
  };
}
function synthetic() {
  const items = [],
    put = (str, x, y, w = 20, h = 8) => items.push({ str, x, y, w, h });
  put('Serial No.', 20, 4, 40);
  put('CARD-DEMO', 150, 4, 60);
  put('Trans No.', 28, 30, 33);
  put('Amount', 474, 30, 26);
  put('Sector', 544, 30, 21);
  function body(ref, y, amount = '1.66', type = 'Fare Usage - Toll/Bus', sector = 'TOLL') {
    put(ref, 33, y, 24);
    put('09/10/2026', 127, y - 4, 46);
    put('09:00:00', 134, y + 6, 32);
    put('10/10', 181, y - 4, 23);
    put('/2026', 181, y + 6, 23);
    put(type, 207, y, 26);
    put('SITE A', 240, y, 30);
    put('SITE B', 335, y, 30);
    put(amount, 487, y, 16);
    put('5.00', 517, y, 16);
    put(sector, 547, y, 16);
  }
  body('0000123', 64);
  body('0000124', 94, '20.00', 'OTA Reload', 'RETAIL');
  put('Transaction', 25, 160, 39);
  put('Amount (RM)', 478, 169, 45);
  put('Sector', 540, 165, 20);
  put('116002W032', 20, 190, 49);
  put('0261002082', 22, 199.6, 46);
  put('73600', 33, 209.2, 23);
  put('02/10/2026', 127, 195, 46);
  put('08:27:36', 134, 205, 32);
  put('02/10', 181, 195, 23);
  put('/2026', 181, 205, 23);
  put('Fare Usage', 208, 195, 40);
  put('SITE A', 260, 195, 30);
  put('SITE B', 378, 195, 30);
  put('1.66', 507, 195, 16);
  put('Toll', 544, 195, 16);
  return [
    {
      width: 595,
      height: 842,
      items,
      lines: [20, 50, 80, 110, 150, 180, 225].map(y => ({ y, x1: 20, x2: 575 })),
    },
  ];
}
test('TNG table reader separates offline/online rows, wraps references and reads amounts rather than balances', () => {
  const before = synthetic(),
    snapshot = copy(before),
    r = E.parsePages(before);
  assert.deepEqual(copy(before), snapshot);
  assert.equal(r.rows.length, 3);
  assert.equal(r.tables, 2);
  assert.equal(r.serial, 'CARD-DEMO');
  assert.equal(r.rows[0].amountCents, 166);
  assert.equal(r.rows[0].date, '2026-10-09');
  assert.equal(r.rows[0].postedDate, '2026-10-10');
  assert.equal(r.rows[1].kind, 'reload');
  assert.equal(r.rows[2].section, 'online');
  assert.equal(r.rows[2].transactionNo, '116002W032026100208273600');
  assert.equal(r.rows[2].amountCents, 166);
  assert.deepEqual(copy(r.rows[0].rect), { x: 20, y: 50, w: 555, h: 30 });
  assert.deepEqual(copy(r.rows[2].rect), { x: 20, y: 180, w: 555, h: 45 });
  assert.ok(r.rows.every(r => !r.errors.length));
});
test('TNG parser reports invalid rows and rejects unsupported/oversized statements', () => {
  const p = synthetic();
  p[0].items.find(x => x.str === '1.66').str = '?';
  assert.match(E.parsePages(p).rows[0].errors.join(','), /amount/);
  assert.throws(() => E.parsePages([{ width: 595, height: 842, items: [] }]), /No supported/);
  assert.throws(() => E.parsePages(Array(61).fill(p[0])), /1–60/);
  assert.equal(E.date('30/02/2026'), '');
  assert.equal(E.date('01/10/2026'), '2026-10-01');
  assert.equal(E.cents('1,000.09'), 100009);
  for (const value of ['-1.00', '0.00', '1.666', '1e3', 'NaN']) assert.equal(E.cents(value), null);
});
test('on-site matching collapses booking segments, omits leave/office and keeps ambiguous visits separate', () => {
  const d = data();
  d.schedule = [
    {
      date: '2026-10-09',
      time: '09:00',
      location: 'Client site',
      kind: 'custom',
      bookingId: 'one',
      text: 'Workshop',
    },
    {
      date: '2026-10-09',
      time: '10:00',
      location: 'Client site',
      kind: 'custom',
      bookingId: 'one',
      text: 'Workshop',
    },
    {
      date: '2026-10-09',
      time: '14:00',
      location: 'Client site',
      kind: 'custom',
      bookingId: 'two',
      text: 'Other client',
    },
    {
      date: '2026-10-09',
      time: '11:00',
      location: 'Client site',
      kind: 'annual-leave',
      bookingId: 'leave',
    },
    { date: '2026-10-09', time: '12:00', location: 'Office', kind: 'custom', bookingId: 'office' },
  ];
  assert.equal(E.matches(d, '2026-10-09').length, 2);
  assert.equal(E.matches(d, '2026-10-10').length, 0);
  const r = row({ bookingKey: 'one' }),
    out = E.expenses(d, [r], source);
  assert.equal(out[0].bookingId, 'one');
  assert.equal(out[0].date, '2026-10-09');
  assert.equal(E.expenses(d, [row()], source, 'posted')[0].date, '2026-10-10');
  assert.throws(() => E.expenses(d, [row({ bookingKey: 'deleted' })], source), /visit changed/);
});
test('confirmed expense imports preserve provenance, exact sen and reject repeat or overlapping transaction identities', () => {
  const d = data(),
    rows = [row(), row({ id: 'r2', transactionNo: '0000124', amountCents: 230 })],
    before = copy(rows);
  d.workhub.claims.expenses.push(...E.expenses(d, rows, source));
  C.validate(d);
  assert.equal(C.summary(d, '2026-10').tollCents, 396);
  assert.equal(d.workhub.claims.expenses[0].tngSource.page, 1);
  assert.deepEqual(copy(rows), before);
  assert.throws(() => E.expenses(d, [row()], { ...source, fileHash: 'c'.repeat(64) }), /already/);
  assert.throws(() => E.expenses(data(), [row(), row()], source), /already/);
  assert.equal(E.expenses(d, [row()], { ...source, cardKey: 'd'.repeat(64) }).length, 1);
});
test('reloads, credits and unresolved rows cannot enter expense totals; manual entries do not invent PDF evidence', () => {
  for (const patch of [
    { kind: 'reload' },
    { kind: 'credit' },
    { errors: ['Check amount'] },
    { amountCents: 1.5 },
    { date: '2026-02-30' },
    { description: '' },
  ])
    assert.throws(() => E.expenses(data(), [row(patch)], source), /Review/);
  const out = E.expenses(
    data(),
    [row({ manual: true, section: 'manual', transactionNo: '', category: 'parking' })],
    {}
  );
  assert.equal(out[0].tngSource, undefined);
  assert.equal(out[0].category, 'parking');
  assert.equal(out[0].amountCents, 166);
});
test('source rectangle validation bounds exported evidence and rejects malformed imported provenance', () => {
  const s = E.expenses(data(), [row()], source)[0].tngSource;
  E.validateSource(s);
  for (const patch of [
    { page: 0 },
    { fileHash: 'bad' },
    { rect: { x: 0, y: 0, w: Infinity, h: 20 } },
    { rect: { x: 580, y: 20, w: 100, h: 20 } },
    { height: 0 },
  ])
    assert.throws(() => E.validateSource({ ...s, ...patch }), /source/);
  assert.deepEqual(copy(E.clampRect({ x: -10, y: 900, w: 900, h: -1 }, 595, 842)), {
    x: 0,
    y: 841,
    w: 595,
    h: 1,
  });
});
