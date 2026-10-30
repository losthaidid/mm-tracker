import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const plain = v => JSON.parse(JSON.stringify(v));
const upload = (text, name = 'units.csv') => ({ name, size: new TextEncoder().encode(text).length, text: async () => text });
async function fixture(t, { versions = 0, runner, mode = 'general' } = {}) {
  const dom = new JSDOM('<div id="view"></div><dialog id="modal"><div id="modalBody"></div></dialog>', { url: 'https://example.test', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document;
  t.after(() => w.close());
  Object.assign(w, { Blob, TextEncoder, TextDecoder, setImmediate, clearImmediate });
  w.confirm = () => true;
  const timer = w.setTimeout.bind(w);
  w.setTimeout = (fn, ms) => ms === 50 ? (queueMicrotask(fn), 0) : timer(fn, ms);
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  for (const f of ['vendor/jszip.min.js', 'validator-engine.js', 'validator-reference-data.js', 'validator-transform.js', 'validator-files.js']) w.eval(read(f));
  if (runner) w.WorkHubValidatorRunner = { create: () => runner };
  w.eval(read('validator-studio.js'));
  const E = w.WorkHubValidatorEngine, F = w.WorkHubValidatorFiles, schema = E.create('Unit template');
  schema.mode = mode;
  schema.columns = [{ ...E.column(), key: 'MEINS', label: 'Unit of Measurement', required: true, ...(mode === 'sap' ? { sapType: 'UNIT', sapLength: '3' } : {}) }];
  schema.releases = Array.from({ length: versions }, (_, i) => ({ version: i + 1, publishedAt: '2026-10-30T00:00:00.000Z', schema: E.schema(schema) }));
  let state = { projects: [], projectCompanies: [], workhub: { validator: { templates: [schema], runs: [] } } }, owner = 'owner', ready = true, writes = 0, rejectSave = false, ui;
  const messages = [], downloads = [];
  const render = () => { if (!ui.patchRender()) d.getElementById('view').innerHTML = ui.render(); };
  ui = w.WorkHubValidatorStudio.install({
    state: () => state, owner: () => owner, ready: () => ready, render,
    tell: text => messages.push(text), download(blob, name) { downloads.push({ blob, name }); },
    mutate(fn) { if (rejectSave) return false; const next = E.copy(state); fn(next); E.prepare(next, state); E.validateState(next); state = next; writes++; render(); return true; },
    openModal(title, body) { d.getElementById('modalBody').innerHTML = body; d.getElementById('modal').showModal(); }, closeModal() { d.getElementById('modal').close(); },
  });
  render();
  const change = (el, value) => { if (el.type === 'checkbox') el.checked = value; else el.value = value; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const handle = (val, extras = {}) => ui.handle({ dataset: { val, ...extras } });
  return { w, d, E, F, ui, messages, downloads, render, handle, change, state: () => state, writes: () => writes, failSave(value) { rejectSave = value; }, switchOwner() { owner = 'other'; ready = false; }, async mode(value) { await handle('mode', { mode: value }); }, async chooseVersion(value) { await this.mode('check'); change(d.querySelector('[name="version"]'), value); }, deleteVersion(n) { return handle('delete-version', { version: String(n) }); }, list: () => w.WorkHubValidatorReferences.unitOfMeasurement() };
}
function withUnits(x) {
  const t = x.E.copy(x.state().workhub.validator.templates[0]);
  t.lookups = [x.list()];
  t.rules = [{ ...x.E.rule('MEINS'), name: 'Valid unit', assertion: { ...x.E.condition('MEINS'), operator: 'lookup', lookupId: t.lookups[0].id, lookupColumn: 'MEINS' } }];
  return t;
}
const summary = (id, version, templateId) => ({ id, version, templateId, templateName: 'Unit template', fileName: 'old.csv', at: '2026-10-30', rows: 1, passed: 1, errors: 0, warnings: 0 });

test('Unit of Measurement contains all 291 distinct supplied codes, exact symbols, case and blank description', async t => {
  const x = await fixture(t), list = x.list(), other = x.list(), values = new Map(list.rows);
  assert.equal(list.rows.length, 291); assert.equal(values.size, 291);
  assert.deepEqual(plain(list.headers), ['MEINS', 'DESCRIPTION']);
  for (const [code, desc] of [['000', 'm/min'], ['001', ''], ['%O', '%0'], ['"2', 'Inch2'], ['"3', 'Cubic inch'], ['µL', 'µl'], ['µGL', 'µg/l'], ['°F', '°F'], ['BTL', 'Bottle'], ['btl', 'Btu/lb'], ['KGS', 'kg/s'], ['kgs', 'kg/scf'], ['KML', 'kmol'], ['kml', 'kg/kg mole'], ['TM3', '1/m3'], ['tm3', 't/1000m3'], ['JKK', 'J/(kg*K)'], ['KWH', 'kW.h'], ['WMK', 'W/(m*K)'], ['ttj', 't/TJ']]) assert.equal(values.get(code), desc, code);
  assert.equal(list.codeColumn, 'MEINS'); assert.equal(list.nameColumn, 'DESCRIPTION'); assert.equal(list.caseSensitive, true);
  assert.notEqual(list.id, other.id); list.rows[0][1] = 'Changed'; assert.equal(other.rows[0][1], '%');
});

test('case-sensitive unit lookup validates all codes in General and SAP, including original leading zeros', async t => {
  for (const mode of ['general', 'sap']) {
    const x = await fixture(t, { mode }), tpl = withUnits(x), rows = tpl.lookups[0].rows.map(r => ({ MEINS: r[0] }));
    assert.equal(x.E.validateRows(tpl, rows).errors, 0, mode);
    const invalid = ['ea', 'Btl', 'Kg', '0', '1', 'μL', 'UNKNOWN', ''];
    const result = x.E.validateRows(tpl, invalid.map(MEINS => ({ MEINS })));
    assert.equal(result.passed, 0); assert.equal(new Set(result.issues.map(issue => issue.index)).size, invalid.length);
    for (const code of ['BTL', 'btl', '001']) assert.equal(x.E.testCondition(tpl.rules[0].assertion, { MEINS: code }, tpl), true);
    assert.equal(tpl.columns[0].caseSensitive, false, 'other field checks retain their policy');
  }
});

test('unit descriptions, tuple matches and correction suggestions distinguish upper and lower case', async t => {
  const x = await fixture(t), tpl = withUnits(x), E = x.E;
  assert.deepEqual(plain(E.referenceDetails(tpl, { MEINS: 'BTL' }).map(m => m.displayName)), ['Bottle']);
  assert.deepEqual(plain(E.referenceDetails(tpl, { MEINS: 'btl' }).map(m => m.displayName)), ['Btu/lb']);
  assert.equal(E.referenceDetails(tpl, { MEINS: 'Btl' }).length, 0);
  assert.deepEqual(plain(E.referenceDetails(tpl, { MEINS: '001' }).map(m => [m.code, m.displayName])), [['001', '']]);
  assert.deepEqual(new Set(E.suggestions(tpl, { MEINS: 'Btl' }, 'MEINS', 'btl').choices.map(c => c.value)), new Set(['BTL', 'btl']));
  assert.deepEqual(plain(E.suggestions(tpl, { MEINS: 'BTL' }, 'MEINS', 'btl').choices.map(c => c.value)), ['btl']);
  const ordinary = E.copy(tpl); delete ordinary.lookups[0].caseSensitive;
  assert.equal(E.validateRows(ordinary, [{ MEINS: 'ea' }]).errors, 0, 'existing reference behavior');
  ordinary.lookups[0].caseSensitive = 'yes'; assert.throws(() => E.checkSchema(ordinary), /case-sensitivity/);
  tpl.columns.push({ ...E.column(1), key: 'DESCRIPTION', label: 'Description' });
  tpl.rules[0].assertion = { ...E.condition('MEINS'), operator: 'lookupTuple', lookupId: tpl.lookups[0].id, pairs: [{ field: 'MEINS', referenceColumn: 'MEINS' }, { field: 'DESCRIPTION', referenceColumn: 'DESCRIPTION' }] };
  assert.equal(E.validateRows(tpl, [{ MEINS: 'BTL', DESCRIPTION: 'Bottle' }, { MEINS: 'btl', DESCRIPTION: 'Btu/lb' }, { MEINS: 'btl', DESCRIPTION: 'Bottle' }]).errors, 1);
  assert.deepEqual(plain(E.suggestions(tpl, { MEINS: 'bad', DESCRIPTION: 'Bottle' }, 'MEINS').choices.map(c => c.value)), ['BTL']);
});

test('reference preset remains editable, independent and frozen in older versions, and enforces list limits and permissions', async t => {
  const x = await fixture(t, { versions: 1 }), { ui, d, E } = x, frozen = plain(ui.snapshot().draft.releases);
  await x.mode('references'); const writes = x.writes(); await x.handle('reference-uom');
  let snap = ui.snapshot(); assert.equal(snap.dirty, true); assert.equal(snap.draft.lookups[0].rows.length, 291); assert.equal(x.writes(), writes);
  assert.equal(d.querySelector('[data-val="reference-uom"]').disabled, true);
  await assert.rejects(x.handle('reference-uom'), /already has/);
  let form = d.getElementById('valReferenceForm'); assert.equal(form.elements.refCaseSensitive.checked, true);
  form.elements.name.value = 'My units'; form.dispatchEvent(new x.w.Event('submit', { bubbles: true, cancelable: true }));
  snap = ui.snapshot(); assert.equal(snap.draft.lookups[0].name, 'My units'); assert.equal(snap.draft.lookups[0].preset, 'unit-of-measurement'); assert.equal(snap.draft.lookups[0].caseSensitive, true);
  assert.equal(new Map(snap.draft.lookups[0].rows).get('001'), ''); assert.equal(new Map(snap.draft.lookups[0].rows).get('"2'), 'Inch2');
  ui.saveDraft(); assert.deepEqual(plain(x.state().workhub.validator.templates[0].releases), frozen);
  await ui.publish(); const published = plain(x.state().workhub.validator.templates[0].releases[1]);
  await x.mode('references'); form = d.getElementById('valReferenceForm'); form.elements.refCaseSensitive.checked = false; form.dispatchEvent(new x.w.Event('submit', { bubbles: true, cancelable: true })); ui.saveDraft();
  assert.equal(ui.snapshot().draft.lookups[0].caseSensitive, undefined); assert.deepEqual(plain(x.state().workhub.validator.templates[0].releases[1]), published);
  const copied = E.copyTemplate(x.state().workhub.validator.templates[0], 'Independent copy', {}); copied.lookups[0].rows[0][1] = 'copy'; assert.equal(x.state().workhub.validator.templates[0].lookups[0].rows[0][1], '%');
  const limited = await fixture(t); for (let i = 0; i < 20; i++) limited.state().workhub.validator.templates[0].lookups.push({ id: 'ref' + i, name: 'Ref ' + i, headers: ['Code'], rows: [] });
  await limited.handle('open', { id: limited.state().workhub.validator.templates[0].id }); await limited.mode('references');
  assert.equal(limited.d.querySelector('[data-val="reference-uom"]').disabled, true); await assert.rejects(limited.handle('reference-uom'), /20 reference/); assert.equal(limited.ui.snapshot().draft.lookups.length, 20);
  const denied = await fixture(t); denied.w.WorkHubCurrentAccess = { can: () => false }; await assert.rejects(denied.handle('reference-uom'), /cannot edit/); assert.equal(denied.ui.snapshot().draft.lookups.length, 0);
});

test('Unit of Measurement works through existing independent reference selection and exports complete literal reference rows', async t => {
  const x = await fixture(t), { d, ui } = x; await x.mode('references'); await x.handle('reference-uom'); ui.saveDraft();
  await ui.loadFile(upload('Unit of Measurement\nEA\nea\nBTL\nbtl\n000\n001'));
  const form = d.getElementById('valRunReferenceForm'); form.dispatchEvent(new x.w.Event('submit', { bubbles: true, cancelable: true }));
  await ui.run(); assert.equal(ui.snapshot().result.errors, 1); assert.equal(ui.snapshot().result.issues[0].value, 'ea');
  const check = d.querySelector('[data-setup-reference]'); assert.equal(check.disabled, false); x.change(check, false); await ui.run(); assert.equal(ui.snapshot().result.errors, 0);
  x.change(d.querySelector('[data-setup-reference]'), true); await ui.run(); assert.equal(ui.snapshot().result.errors, 1);
  const tpl = ui.snapshot().draft, blob = await x.F.template(tpl), book = await x.F.read({ name: 'template.xlsx', size: blob.size, arrayBuffer: () => blob.arrayBuffer() });
  const rows = book.sheets.find(s => s.name.startsWith('Ref ')).rows;
  assert.equal(rows.length, 292); const values = new Map(rows.slice(1)); assert.equal(values.get('000'), 'm/min'); assert.equal(values.get('001') || '', ''); assert.equal(values.get('"2'), 'Inch2'); assert.equal(values.get('µL'), 'µl'); assert.equal(values.get('btl'), 'Btu/lb');
  await x.handle('export-comparison'); const report = x.downloads[0].blob, zip = await x.w.JSZip.loadAsync(new x.w.Uint8Array(await report.arrayBuffer()), { checkCRC32: true });
  const sheets = (await Promise.all(Object.values(zip.files).filter(f => f.name.startsWith('xl/worksheets/')).map(f => f.async('string')))).join('');
  assert.match(sheets, /Btu\/lb/); assert.match(sheets, /Bottle/); assert.doesNotMatch(sheets, /<f>/);
});

test('production worker retains exact unit-reference matching', async t => {
  const x = await fixture(t), tpl = withUnits(x), messages = [], sandbox = { Blob, postMessage: value => messages.push(value) }; sandbox.self = sandbox;
  const scope = vm.createContext(sandbox); sandbox.importScripts = path => { assert.match(path, /validator-engine\.js\?v=20261030-uom-versions-1$/); vm.runInContext(read('validator-engine.js'), scope); };
  vm.runInContext(read('validator-worker.js'), scope); const rows = ['EA', 'ea', 'BTL', 'btl', '001'].map(MEINS => ({ MEINS }));
  sandbox.onmessage({ data: { id: 1, template: plain(tpl), rows, context: {} } });
  assert.deepEqual(plain(messages[0].result), plain(x.E.validateRows(tpl, rows))); assert.equal(messages[0].result.errors, 1);
});

test('unused version deletion preserves unsaved draft edits, other versions and future numbering', async t => {
  const x = await fixture(t, { versions: 3 }), { d, ui } = x, original = plain(x.state().workhub.validator.templates[0].releases);
  const form = d.getElementById('valColumnForm'); x.change(form.elements.label, 'My unsaved unit label'); form.elements.label.dispatchEvent(new x.w.Event('input', { bubbles: true }));
  await x.mode('history'); assert.equal(d.querySelectorAll('[data-val="delete-version"]:not(:disabled)').length, 3);
  await x.deleteVersion(3); let saved = x.state().workhub.validator.templates[0];
  assert.deepEqual(plain(saved.releases), original.slice(0, 2)); assert.equal(saved.lastPublishedVersion, 3); assert.equal(saved.columns[0].label, 'Unit of Measurement');
  assert.equal(ui.snapshot().dirty, true); assert.equal(ui.snapshot().draft.columns[0].label, 'My unsaved unit label');
  await x.mode('check'); assert.equal(d.querySelector('[name="version"]').value, 'draft'); ui.saveDraft();
  await ui.publish(); saved = x.state().workhub.validator.templates[0]; assert.deepEqual(plain(saved.releases.map(r => r.version)), [1, 2, 4]); assert.equal(saved.releases[2].schema.columns[0].label, 'My unsaved unit label');
  await x.deleteVersion(4); await x.deleteVersion(2); await x.deleteVersion(1); assert.equal(ui.snapshot().draft.releases.length, 0); await ui.publish(); assert.equal(ui.snapshot().draft.releases[0].version, 5);
  await x.handle('duplicate'); assert.equal(ui.snapshot().draft.lastPublishedVersion, undefined); await ui.publish(); assert.equal(ui.snapshot().draft.releases[0].version, 1);
});

test('deletion requires confirmation and a successful save before changing local definitions', async t => {
  const x = await fixture(t, { versions: 2 }), before = plain(x.state()), draft = plain(x.ui.snapshot().draft); let prompts = 0;
  x.w.confirm = text => { prompts++; assert.match(text, /Delete published version 2/); return false; };
  await x.deleteVersion(2); assert.equal(prompts, 1); assert.deepEqual(plain(x.state()), before); assert.deepEqual(plain(x.ui.snapshot().draft), draft);
  x.w.confirm = () => true; x.failSave(true); await x.deleteVersion(2); assert.deepEqual(plain(x.state()), before); assert.deepEqual(plain(x.ui.snapshot().draft), draft);
});

test('saved run usage blocks deletion in the UI and state boundary even if history is removed in the same edit', async t => {
  const x = await fixture(t, { versions: 2 }), tpl = x.state().workhub.validator.templates[0]; x.state().workhub.validator.runs.push(summary('run', 1, tpl.id));
  await x.mode('history'); const button = x.d.querySelector('[data-val="delete-version"][data-version="1"]'); assert.equal(button.disabled, true); assert.match(button.title, /1 saved validation run/);
  await assert.rejects(x.deleteVersion(1), /saved validation run/); const next = plain(x.state()); next.workhub.validator.templates[0].lastPublishedVersion = 2; next.workhub.validator.templates[0].releases.shift();
  assert.throws(() => x.E.prepare(next, x.state()), /used by saved/); next.workhub.validator.runs = []; assert.throws(() => x.E.prepare(next, x.state()), /used by saved/);
  await x.deleteVersion(2); assert.equal(x.state().workhub.validator.runs.length, 1); assert.equal(x.state().workhub.validator.templates[0].releases[0].version, 1);
});

test('queued setup and compressed sessions protect their version until the queue is cleared', async t => {
  const x = await fixture(t, { versions: 2 }), { ui } = x; await ui.addQueueFiles([upload('Unit of Measurement\nEA', 'a.csv'), upload('Unit of Measurement\nKG', 'b.csv')]);
  ui.confirmQueueJob(); const jobs = ui.snapshot().queue; await ui.openQueueJob(jobs[1].id); ui.confirmQueueJob();
  await x.chooseVersion('draft'); await x.mode('history'); const button = x.d.querySelector('[data-val="delete-version"][data-version="2"]'); assert.equal(button.disabled, true); assert.match(button.title, /queued file/);
  await assert.rejects(x.deleteVersion(2), /queued file/); await x.deleteVersion(1); assert.equal(ui.snapshot().queue.length, 2);
  await x.handle('queue-clear'); await x.deleteVersion(2); assert.equal(ui.snapshot().draft.releases.length, 0);
});

test('active results and prepared uploads protect their selected version after retained history is pruned', async t => {
  const x = await fixture(t, { versions: 1 }), { ui } = x; await ui.loadFile(upload('Unit of Measurement\nEA')); await ui.run();
  x.state().workhub.validator.runs = []; await x.mode('history'); await assert.rejects(x.deleteVersion(1), /Active validation result/);
  await x.handle('clear-file'); await ui.loadFile(upload('Unit of Measurement\n"EA,KG"')); ui.openPreparation('explode'); const f = x.d.getElementById('valPreparationForm'); f.dispatchEvent(new x.w.Event('submit', { bubbles: true, cancelable: true })); ui.applyPreparation();
  assert.equal(ui.snapshot().preparations.length, 1); await assert.rejects(x.deleteVersion(1), /Prepared upload/);
  await x.handle('clear-file'); await x.deleteVersion(1); assert.equal(ui.snapshot().draft.releases.length, 0);
});

test('version deletion enforces edit and delete permissions and detects stale templates and confirmation-time changes', async t => {
  const x = await fixture(t, { versions: 1 }); let prompts = 0; x.w.confirm = () => { prompts++; return true; };
  for (const denied of ['edit', 'delete']) { x.w.WorkHubCurrentAccess = { can: (feature, action) => action !== denied }; await assert.rejects(x.deleteVersion(1), /cannot/); }
  assert.equal(prompts, 0); delete x.w.WorkHubCurrentAccess;
  x.state().workhub.validator.templates[0].updatedAt = '2026-10-31T00:00:00.000Z'; await assert.rejects(x.deleteVersion(1), /changed elsewhere/);
  const race = await fixture(t, { versions: 1 }); race.w.confirm = () => { race.state().workhub.validator.runs.push(summary('new-run', 1, race.ui.snapshot().draft.id)); return true; }; await assert.rejects(race.deleteVersion(1), /saved validation run/);
  const account = await fixture(t, { versions: 1 }); account.w.confirm = () => { account.switchOwner(); return true; }; await assert.rejects(account.deleteVersion(1), /Sign in|account changed/); assert.equal(account.state().workhub.validator.templates[0].releases.length, 1); assert.equal(account.ui.snapshot().draft, null);
});

test('deleting one unused version frees a full 15-version template and keeps the counter in backups', async t => {
  const x = await fixture(t, { versions: 15 }); assert.throws(() => x.ui.publish(), /Delete unused versions/);
  await x.deleteVersion(15); await x.ui.publish(); assert.equal(x.ui.snapshot().draft.releases.length, 15); assert.equal(x.ui.snapshot().draft.releases.at(-1).version, 16);
  await x.handle('export-definition'); const backup = JSON.parse(x.downloads[0].blob); assert.equal(backup.template.lastPublishedVersion, 16); x.E.validateState({ workhub: { validator: { templates: [backup.template], runs: [] } } });
});

test('deleting a different unused release preserves active results, uploaded rows and confirmed queue setups', async t => {
  const x = await fixture(t, { versions: 3 }), { ui } = x;
  await ui.addQueueFiles([upload('Unit of Measurement\nEA', 'a.csv'), upload('Unit of Measurement\nKG', 'b.csv')]);
  ui.confirmQueueJob(); const jobs = ui.snapshot().queue; await ui.openQueueJob(jobs[1].id); ui.confirmQueueJob(); await ui.startQueue();
  const before = ui.snapshot(), runs = plain(x.state().workhub.validator.runs); await x.mode('history'); await x.deleteVersion(1); const after = ui.snapshot();
  assert.deepEqual(plain(after.result), plain(before.result)); assert.deepEqual(plain(after.sourceRows), plain(before.sourceRows)); assert.deepEqual(plain(after.mapping), plain(before.mapping)); assert.deepEqual(plain(after.queue), plain(before.queue)); assert.deepEqual(plain(x.state().workhub.validator.runs), runs);
  await ui.openQueueJob(jobs[0].id); assert.equal(ui.snapshot().queue[0].status, 'completed'); assert.equal(ui.snapshot().result.errors, 0);
});

test('state guards retain frozen content, reject reused or reset numbers, and support old templates without a counter', async t => {
  const x = await fixture(t, { versions: 3 }), old = plain(x.state()), next = plain(old), tpl = next.workhub.validator.templates[0];
  tpl.releases.pop(); assert.throws(() => x.E.prepare(next, old), /last published version/); tpl.lastPublishedVersion = 3; assert.doesNotThrow(() => x.E.prepare(next, old)); assert.doesNotThrow(() => x.E.validateState(next));
  const reused = plain(next); reused.workhub.validator.templates[0].releases.push(old.workhub.validator.templates[0].releases[2]); assert.throws(() => x.E.prepare(reused, next), /reset or reused/);
  const reset = plain(next); delete reset.workhub.validator.templates[0].lastPublishedVersion; assert.throws(() => x.E.prepare(reset, next), /reset or reused/);
  const changed = plain(old); changed.workhub.validator.templates[0].releases[0].schema.name = 'Changed'; assert.throws(() => x.E.prepare(changed, old), /frozen/); assert.doesNotThrow(() => x.E.prepare(changed, old, true));
  for (const value of [-1, 1, '3', Number.MAX_SAFE_INTEGER + 1]) { tpl.lastPublishedVersion = value; assert.throws(() => x.E.validateState(next), /published version number/); }
  assert.equal(x.E.publishedVersion(old.workhub.validator.templates[0], [summary('old-run', 5, tpl.id)]), 5);
});
