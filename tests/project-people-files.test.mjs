import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

test('people: production workbook export preserves text, reporting lines, scope and unassigned activities', async t => {
  const dom = new JSDOM('<!doctype html>', { runScripts: 'outside-only' }); t.after(() => dom.window.close());
  const w = dom.window; w.Blob = Blob; w.setImmediate = setImmediate; w.clearImmediate = clearImmediate;
  for (const f of ['vendor/jszip.min.js', 'validator-files.js', 'recipients-engine.js', 'project-people-engine.js', 'project-people-files.js']) w.eval(readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
  const E = w.WorkHubProjectPeopleEngine, d = { projects: [{ id: 'p', name: 'Private project', mmAreas: [{ id: 'a', name: 'Procurement', visible: true }] }], workhub: {} };
  E.upgrade(d);
  E.data(d).people.push({ id: 'u', projectId: 'p', name: '=HYPERLINK("https://example.com")', email: 'buyer@example.com', department: 'Buying', title: 'Buyer', phone: '001234', managerId: '', x: 56, y: 56 });
  E.data(d).activities.push({ id: 'po', projectId: 'p', areaId: 'a', kind: 'activity', name: 'Create PO', sourceMappingId: '' }, { id: 'pr', projectId: 'p', areaId: 'a', kind: 'activity', name: 'Create PR', sourceMappingId: '' });
  E.assign(d, 'p', 'u', { type: 'activity', id: 'po' }, { role: 'Primary', scope: 'Plant 0001', notes: 'Use NB' }, () => 'assignment');
  const blob = await w.WorkHubProjectPeopleFiles.excel(d, 'p'), zip = await w.JSZip.loadAsync(new w.Uint8Array(await blob.arrayBuffer()));
  const book = await zip.file('xl/workbook.xml').async('string'); assert.match(book, /Responsibility Assignments/); assert.match(book, /Area Coverage/);
  const people = await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(people, /HYPERLINK/); assert.match(people, /001234/); assert.doesNotMatch(people, /<f[ >]/); assert.match(people, /t="inlineStr"/); assert.match(people, /state="frozen"/);
  const assignments = await zip.file('xl/worksheets/sheet2.xml').async('string'); assert.match(assignments, /Plant 0001/); assert.match(assignments, /Use NB/);
  const gaps = await zip.file('xl/worksheets/sheet3.xml').async('string'); assert.match(gaps, /Create PR/); assert.doesNotMatch(gaps, /Create PO/);
});
