import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
const window = {};
for (const f of ['recipients-engine.js', 'project-people-engine.js']) runInNewContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), { window });
const E = window.WorkHubProjectPeopleEngine, copy = x => JSON.parse(JSON.stringify(x));
let serial = 0; const uid = () => 'new-' + ++serial;
function state() {
  const d = { projects: [{ id: 'p', name: 'MM Project', mmAreas: [{ id: 'purch', name: 'Procurement', visible: true }, { id: 'inv', name: 'Inventory', visible: true }] }, { id: 'other', name: 'Other project', mmAreas: [{ id: 'buy', name: 'Purchasing', visible: true }, { id: 'stock', name: 'Inventory', visible: true }] }], workhub: {} };
  E.upgrade(d);
  const h = E.data(d);
  h.people.push({ id: 'manager', projectId: 'p', name: 'Aisyah', email: 'aisyah@example.com', department: 'Purchasing', title: 'Business owner', phone: '', managerId: '', x: 56, y: 56 });
  h.people.push({ id: 'buyer', projectId: 'p', name: 'Daniel', email: 'daniel@example.com', department: 'Purchasing', title: 'Buyer', phone: '1234', managerId: 'manager', x: 56, y: 382 });
  h.activities.push({ id: 'po', projectId: 'p', areaId: 'purch', kind: 'activity', name: 'Create PO', sourceMappingId: '' }, { id: 'gr', projectId: 'p', areaId: 'inv', kind: 'activity', name: 'Perform goods receipt', sourceMappingId: '' });
  return d;
}
test('people: upgrades are additive, empty and idempotent', () => {
  const d = { workhub: { keep: true } }; E.upgrade(d); assert.equal(d.workhub.keep, true); assert.equal(E.data(d).people.length, 0);
  const h = E.data(d); E.upgrade(d); assert.equal(E.data(d), h);
});
test('people: one activity supports multiple people, roles and explicit scope without duplicate drops', () => {
  const d = state(); E.assign(d, 'p', 'buyer', { type: 'activity', id: 'po' }, { scope: 'Plant 1100' }, uid);
  E.assign(d, 'p', 'manager', { type: 'activity', id: 'po' }, { role: 'Backup', scope: 'Plant 1100' }, uid);
  const duplicate = E.assign(d, 'p', 'buyer', { type: 'activity', id: 'po' }, { scope: ' plant   1100 ' }, uid);
  assert.equal(duplicate.duplicate, true); assert.equal(E.data(d).assignments.length, 2);
  E.assign(d, 'p', 'buyer', { type: 'activity', id: 'po' }, { scope: 'Plant 1200' }, uid);
  assert.equal(E.data(d).assignments.length, 3); E.validate(d);
  assert.equal(E.filter(d, 'p', 'plant 1200')[0].name, 'Daniel');
  assert.equal(E.filter(d, 'p', '', '', '', 'po').length, 2); assert.equal(E.metrics(d, 'p').unassigned, 1);
});
test('people: entire-area drops use stable IDs across rename and hidden areas', () => {
  const d = state(); E.assign(d, 'p', 'buyer', { type: 'area', id: 'purch' }, {}, uid); E.assign(d, 'p', 'manager', { type: 'area', id: 'purch' }, {}, uid);
  assert.equal(E.data(d).activities.filter(a => a.kind === 'area').length, 1);
  const whole = E.data(d).activities.find(a => a.kind === 'area'); d.projects[0].mmAreas[0].name = 'Purchasing'; d.projects[0].mmAreas[0].visible = false;
  E.validate(d); assert.equal(E.activityLabel(d, whole), 'Purchasing · Entire area'); assert.equal(E.filter(d, 'p', '', '', 'purch').length, 2);
  d.projects[0].mmAreas.shift(); assert.throws(() => E.validate(d), /MM area is used/);
});
test('people: reporting movement never changes responsibility assignments, and loops are rejected', () => {
  const d = state(); E.assign(d, 'p', 'buyer', { type: 'activity', id: 'po' }, {}, uid); const links = JSON.stringify(E.data(d).assignments);
  E.data(d).people[1].x = 500; E.data(d).people[1].managerId = ''; E.validate(d); assert.equal(JSON.stringify(E.data(d).assignments), links);
  E.data(d).people[1].managerId = 'manager'; E.data(d).people[0].managerId = 'buyer'; assert.throws(() => E.validate(d), /loop/);
});
test('people: cross-project contacts, area links and forged drops cannot enter a saved document', () => {
  const d = state(); E.data(d).people.push({ ...E.data(d).people[0], id: 'outsider', projectId: 'other' });
  assert.throws(() => E.assign(d, 'p', 'outsider', { type: 'activity', id: 'po' }, {}, uid), /no longer exists/);
  assert.throws(() => E.assign(d, 'p', 'buyer', { type: 'bogus', id: 'po' }, {}, uid), /Choose an MM area/);
  const bad = copy(d); E.data(bad).people[1].managerId = 'outsider'; assert.throws(() => E.validate(bad), /inside the project/);
  const badArea = copy(d); E.data(badArea).activities[0].areaId = 'buy'; assert.throws(() => E.validate(badArea), /MM area is used/);
});
test('people: remove person releases direct reports and keeps process definitions available', () => {
  const d = state(); E.assign(d, 'p', 'manager', { type: 'activity', id: 'po' }, {}, uid); E.removePerson(d, 'p', 'manager');
  assert.equal(E.data(d).people[0].managerId, ''); assert.equal(E.data(d).assignments.length, 0); assert.equal(E.metrics(d, 'p').unassigned, 2); E.validate(d);
});
test('people: deleted projects cascade, while a malformed restored document is rejected', () => {
  const before = state(), after = copy(before); after.projects = after.projects.filter(p => p.id !== 'p');
  E.prepare(after, before); assert.equal(E.data(after).people.length, 0); assert.equal(E.data(after).activities.length, 0); E.validate(after);
  const restored = copy(before); restored.projects = [restored.projects[1]]; E.prepare(restored, before, true); assert.throws(() => E.validate(restored), /no longer exists/);
});
test('people: imports enforce valid emails, positions, roles, activity IDs and capacity', () => {
  for (const change of [d => E.data(d).people[0].email = 'not-an-address', d => E.data(d).people[0].x = NaN, d => E.data(d).people[0].name = 'Bad\nname', d => E.data(d).people.push(copy(E.data(d).people[0]))]) {
    const d = state(); change(d); assert.throws(() => E.validate(d));
  }
  const d = state(); E.assign(d, 'p', 'buyer', { type: 'activity', id: 'po' }, {}, uid); E.data(d).assignments[0].role = 'Superuser'; assert.throws(() => E.validate(d), /roles and scope/);
  const big = state(); E.data(big).people = Array.from({ length: 101 }, (_, i) => ({ ...E.data(big).people[0], id: 'p-' + i })); assert.throws(() => E.validate(big), /100 people/);
});
test('people: activity edits and removals preserve and then clean their assignment links', () => {
  const d = state(); E.assign(d, 'p', 'buyer', { type: 'activity', id: 'po' }, {}, uid);
  E.upsertActivity(d, { ...E.data(d).activities[0], name: 'Create purchase order', areaId: 'inv' }); assert.equal(E.data(d).assignments.length, 1);
  E.removeActivity(d, 'p', 'po'); assert.equal(E.data(d).assignments.length, 0); assert.equal(E.data(d).activities.length, 1); E.validate(d);
  assert.throws(() => E.upsertActivity(d, { ...E.data(d).activities[0], id: 'duplicate' }), /already exists/);
});
test('people: copying a project remaps IDs and areas without changing the source', () => {
  const d = state(); E.assign(d, 'p', 'buyer', { type: 'activity', id: 'po' }, { role: 'Tester', scope: 'Plant 1100' }, uid);
  const source = JSON.stringify(E.records(d, 'p'));
  E.cloneSetup(d, 'p', 'other', { purch: 'buy', inv: 'stock' }, uid); const r = E.records(d, 'other');
  assert.equal(JSON.stringify(E.records(d, 'p')), source); assert.equal(r.people.length, 2); assert.equal(r.assignments[0].scope, 'Plant 1100');
  assert.ok(r.people.some(p => p.managerId && r.people.some(m => m.id === p.managerId))); assert.equal(r.activities[0].areaId, 'buy');
  assert.throws(() => E.cloneSetup(d, 'p', 'other', { purch: 'buy', inv: 'stock' }, uid), /empty/); E.validate(d);
});
test('people: Excel register contains full details, one assignment per row and gaps', () => {
  const d = state(); E.data(d).people[0].name = '=1+1'; E.assign(d, 'p', 'buyer', { type: 'activity', id: 'po' }, { notes: 'Use NB type', scope: '1000' }, uid);
  const sheets = E.sheets(d, 'p'); assert.equal(sheets.length, 4); assert.equal(sheets[1].rows.length, 2);
  assert.equal(sheets[0].rows[1][1], '=1+1'); assert.equal(sheets[1].rows[1][8], '1000'); assert.equal(sheets[1].rows[1][9], 'Use NB type');
  assert.equal(sheets[2].rows[1][2], 'Perform goods receipt'); assert.equal(sheets[0].rows[2][6], '=1+1');
});
test('people: arranging a large forest or a deep hierarchy yields distinct bounded positions', () => {
  for (const deep of [false, true]) {
    const people = Array.from({ length: 100 }, (_, i) => ({ id: 'p' + i, managerId: deep && i ? 'p' + (i - 1) : '', department: 'Dept', name: 'Person ' + i }));
    const layout = E.layout(people), bounds = E.bounds(layout);
    assert.equal(layout.length, 100); assert.equal(new Set(layout.map(p => p.x + ',' + p.y)).size, 100); assert.ok(bounds.width > 0 && bounds.height > 0);
    assert.ok(layout.every(p => p.x >= 24 && p.x <= 50000 && p.y >= 24 && p.y <= 50000));
  }
});

test('people: a new contact never overlaps manually moved cards', () => {
  const d = state(), people = E.data(d).people;
  people[0].x = 45; people[0].y = 45; people[1].x = 400; people[1].y = 60;
  const next = E.nextPosition(people);
  assert.ok(people.every(p => !(next.x < p.x + E.CARD.width + 20 && next.x + E.CARD.width + 20 > p.x && next.y < p.y + E.CARD.height + 20 && next.y + E.CARD.height + 20 > p.y)));
});
