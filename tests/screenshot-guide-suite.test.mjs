import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { runInNewContext } from 'node:vm';
import * as pdfjs from '../vendor/pdfjs/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const root = {}; runInNewContext(source('batch-c-engine.js'), { window: root });
const E = root.WorkHubBatchCEngine, copy = v => JSON.parse(JSON.stringify(v));
const image = { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', width: 1, height: 1 };
const step = id => ({ id, title: 'Step ' + id, caption: 'Review and save.', image: copy(image), marks: [], crop: null });
const guide = () => ({ kind: 'workhub-screenshot-guide', version: 1, title: 'A useful guide', layout: 'walkthrough', steps: [step('a'), step('b')] });
const settle = async () => { for (let i = 0; i < 160; i++) await Promise.resolve(); };

// Implements request/transaction scheduling so the real store module can be tested without a browser.
function memoryIDB() {
  const data = new Map(); let lane = Promise.resolve(), initialized = false;
  const api = { data, failWrites: false, open() {
    const request = {};
    queueMicrotask(() => { request.result = db; if (!initialized) { initialized = true; request.onupgradeneeded?.(); } request.onsuccess?.(); });
    return request;
  } };
  const db = { createObjectStore() {}, close() {}, transaction(name, mode) {
    let active = false, ended = false, processing = false, finish, snapshot;
    const jobs = [], tx = { abort() { if (ended) return; ended = true; tx.onabort?.(); finish?.(); }, objectStore() { return store; } };
    function pump() {
      if (!active || processing || ended) return;
      const next = jobs.shift();
      if (!next) {
        queueMicrotask(() => { if (ended || jobs.length || processing) { pump(); return; } ended = true; if (mode === 'readwrite') { data.clear(); for (const [key, value] of snapshot) data.set(key, value); } tx.oncomplete?.(); finish(); });
        return;
      }
      processing = true;
      queueMicrotask(() => {
        try { next.request.result = next.operation(); next.request.onsuccess?.(); }
        catch (err) { tx.error = err; ended = true; next.request.onerror?.(); tx.onerror?.(); finish(); }
        processing = false; pump();
      });
    }
    function request(operation) { if (ended) throw Error('Inactive transaction'); const request = {}; jobs.push({ request, operation }); pump(); return request; }
    const store = {
      get(key) { return request(() => snapshot.has(key) ? copy(snapshot.get(key)) : undefined); },
      put(value) { return request(() => { if (api.failWrites) throw Error('Quota exceeded'); snapshot.set(value.key, copy(value)); return value.key; }); },
    };
    lane = lane.then(() => new Promise(resolve => { finish = resolve; snapshot = new Map([...data].map(([key, value]) => [key, copy(value)])); active = true; pump(); }));
    return tx;
  } };
  return api;
}
function fixture(t, idb = memoryIDB(), account = 'one') {
  const dom = new JSDOM('<button>Studio</button>', { url: 'https://losthaidid.github.io/mm-tracker/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document; let owner = account; const blobs = [], previews = [];
  t.after(() => dom.window.close());
  Object.defineProperty(w, 'indexedDB', { value: idb });
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {}, fillRect() {}, strokeRect() {}, save() {}, restore() {}, setLineDash() {} });
  w.HTMLCanvasElement.prototype.toDataURL = () => image.src;
  w.HTMLCanvasElement.prototype.setPointerCapture = function () {};
  w.URL.createObjectURL = value => { blobs.push(value); return 'blob:guide-' + blobs.length; };
  w.URL.revokeObjectURL = () => {}; w.Blob = Blob;
  w.eval(source('batch-c-engine.js')); w.eval(source('batch-c-store.js'));
  const canvas = () => { const c = d.createElement('canvas'); c.width = 1240; c.height = 1754; return c; };
  w.WorkHubBatchCFiles = {
    imageFromFile: async () => copy(image), loadImage: async () => ({}), loadLayers: async () => new Map(), draw() {}, release(c) { c.width = c.height = 1; },
    async documentPreview(g, alive) { previews.push({ type: 'document', guide: copy(g), alive }); return { pages: ['cover', 'contents', 'steps', 'steps'].map((kind, index) => ({ kind, index, width: 1240, height: 1754, thumbnail: image.src })), firstPage: canvas() }; },
    async previewPage(g, index, alive) { previews.push({ type: 'page', index, alive }); return canvas(); },
    async export(g, format) { return new Blob([JSON.stringify({ g, format })]); },
  };
  w.eval(source('batch-c.js'));
  const module = w.WorkHubBatchC.install({ ready: () => !!owner, owner: () => owner, state: () => ({ tickets: [] }), tell() {} });
  const click = (action, extra = {}) => module.handle({ dataset: { bc: action, ...extra } });
  const set = (selector, value, event = 'input') => { const el = d.querySelector(selector); if (el.type === 'checkbox') el.checked = value; else el.value = value; el.dispatchEvent(new w.Event(event, { bubbles: true })); };
  return { w, d, module, idb, click, set, previews, async start() { module.open('guide'); await settle(); }, async saved() { await module.prepare('editable'); return JSON.parse(await blobs.at(-1).text()); }, account(next) { owner = next; module.sync(); } };
}
test('guide suite settings validate and old guides receive a compact header without changing maintained content', () => {
  const old = guide(), checked = E.guide(old);
  assert.equal(checked.page.headerHeight, 70); assert.equal(checked.quality, 'balanced'); assert.equal(checked.contents, false); assert.equal(checked.steps[0].expected, ''); assert.equal(old.page, undefined);
  const g = E.guide({ ...old, page: { margin: 100, imageWidth: 65, spacing: 35, headerHeight: 60 }, quality: 'print', contents: true, steps: [{ ...step('a'), expected: 'Saved', notes: 'Have access', tip: 'Use a shortcut', warning: 'Check the value', pageBreakBefore: true, comparison: { image, orientation: 'stack' } }] });
  assert.deepEqual(copy(E.guide(g)), copy(g)); assert.match(E.caption(g.steps[0]), /EXPECTED RESULT\nSaved/); assert.match(E.caption(g.steps[0]), /CAUTION\nCheck the value/);
  for (const change of [g => g.page.headerHeight = 10, g => g.page.margin = 500, g => g.page.imageWidth = 0, g => g.quality = ['balanced'], g => g.contents = 'yes', g => g.steps[0].expected = 'x'.repeat(2001), g => g.steps[0].comparison.image.src = 'https://example.com/private.png']) { const bad = copy(g); change(bad); assert.throws(() => E.guide(bad)); }
});
test('brand templates retain only maintained branding and never copy guide steps or cover text/images', () => {
  const g = E.guide({ ...guide(), cover: { enabled: true, title: 'Private title', images: [image] }, footer: { logo: image }, colours: E.GUIDE_PALETTES.blue, contents: true });
  const template = E.brandTemplate('Company', g);
  assert.equal(template.settings.cover.title, ''); assert.equal(template.settings.cover.images.length, 0); assert.equal(template.settings.steps, undefined); assert.equal(template.settings.footer.logo.src, image.src); assert.equal(template.settings.contents, true);
});
test('header choices validate, preserve legacy appearance and survive templates and editable round trips', () => {
  assert.equal(E.guide(guide()).page.headerStyle, 'band');
  for (const headerStyle of ['band', 'text', 'none']) {
    const g = E.guide({ ...guide(), exportHeading: 'Retained heading', page: { headerStyle } });
    assert.equal(E.guide(copy(g)).page.headerStyle, headerStyle);
    assert.equal(E.brandTemplate('My header', g).settings.page.headerStyle, headerStyle);
    assert.equal(g.exportHeading, 'Retained heading');
  }
  for (const headerStyle of [null, false, 12, [], {}, 'transparent', '__proto__'])
    assert.throws(() => E.guide({ ...guide(), page: { headerStyle } }), /header/);
});
test('header controls update preview and invalidate downloads, retain text while hidden and restore from files and recovery', async t => {
  const c = fixture(t); await c.start(); await c.module.add([{ name: 'one.png' }]);
  c.set('[data-bc-export-heading]', 'Operations / My guide');
  c.set('[data-bc-header-style]', 'text', 'change'); await c.module.preview();
  assert.equal(c.previews.findLast(p => p.type === 'document').guide.page.headerStyle, 'text');
  await c.module.prepare('pdf'); assert.ok(c.d.querySelector('[data-bc-ready] a'));
  c.set('[data-bc-header-style]', 'none', 'change');
  assert.equal(c.d.querySelector('[data-bc-ready] a'), null);
  assert.equal(c.d.querySelector('[data-bc-export-heading]').disabled, true);
  assert.equal(c.d.querySelector('[data-bc-page="headerHeight"]').disabled, true);
  assert.equal(c.d.querySelector('[data-bc-export-heading]').value, 'Operations / My guide');
  c.set('[data-bc-template-name]', 'No header'); await c.click('save-template');
  c.set('[data-bc-header-style]', 'band', 'change');
  c.set('[data-bc-template]', 'No header', 'change'); await c.click('apply-template');
  assert.equal(c.d.querySelector('[data-bc-header-style]').value, 'none');
  await c.module.flushDraft();
  assert.equal((await c.w.WorkHubGuideStore.read('one')).draft.guide.page.headerStyle, 'none');
  const saved = await c.saved();
  await c.module.importGuide({ size: 100, text: async () => JSON.stringify(saved) });
  assert.equal(c.d.querySelector('[data-bc-header-style]').value, 'none');
  c.set('[data-bc-header-style]', 'text', 'change');
  assert.equal(c.d.querySelector('[data-bc-export-heading]').disabled, false);
  assert.equal(c.d.querySelector('[data-bc-page="headerHeight"]').disabled, false);
  assert.equal(c.d.querySelector('[data-bc-export-heading]').value, 'Operations / My guide');
});
test('cancelling any file picker preserves the builder, draft, canvas and ready download; dialog Escape still closes', async t => {
  const c = fixture(t); await c.start(); await c.module.add([{ name: 'kept.png' }]);
  c.set('[data-bc-caption]', 'Keep my unfinished instructions'); await c.module.prepare('pdf');
  const room = c.d.querySelector('#batchCRoom'), canvas = room.querySelector('[data-bc-canvas]'),
    link = room.querySelector('[data-bc-ready] a'), before = await c.saved();
  const ready = room.querySelector('[data-bc-ready] a');
  assert.ok(link);
  for (const input of room.querySelectorAll('input[type="file"]')) {
    input.dispatchEvent(new c.w.Event('cancel', { bubbles: true }));
    assert.ok(room.isConnected && room.open);
    assert.equal(room.querySelector('[data-bc-canvas]'), canvas);
    assert.equal(room.querySelector('[data-bc-ready] a'), ready);
  }
  assert.deepEqual(await c.saved(), before);
  room.dispatchEvent(new c.w.Event('cancel', { cancelable: true }));
  assert.equal(room.isConnected, false);
  c.module.open('privacy'); await c.module.add([{ name: 'private.png' }]);
  const privacy = c.d.querySelector('#batchCRoom');
  privacy.querySelector('input[type="file"]').dispatchEvent(new c.w.Event('cancel', { bubbles: true }));
  assert.ok(privacy.isConnected && privacy.open);
});
test('real browser-store module keeps accounts isolated, merges concurrent draft/template writes and handles quota atomically', async () => {
  const indexedDB = memoryIDB(), w = { indexedDB, WorkHubBatchCEngine: E }; new Function('window', source('batch-c-store.js'))(w); const S = w.WorkHubGuideStore;
  await Promise.all([S.saveDraft('one', guide()), S.saveTemplate('one', 'Company', guide())]);
  let state = await S.read('one'); assert.equal(state.draft.guide.title, 'A useful guide'); assert.equal(state.templates.length, 1); assert.equal((await S.read('two')).draft, null);
  await S.clearDraft('one'); await S.saveDraft('one', guide()); state = await S.read('one'); assert.equal(state.draft, null); assert.equal(state.autoSave, false); assert.equal(state.templates.length, 1);
  await S.setAutoSave('one', true); await S.saveDraft('one', guide()); indexedDB.failWrites = true; await assert.rejects(() => S.saveTemplate('one', 'New', guide()), /full|unavailable/); indexedDB.failWrites = false; assert.equal((await S.read('one')).templates.length, 1);
  for (let i = 0; i < 11; i++) await S.saveTemplate('one', 'Template ' + i, guide()); await assert.rejects(() => S.saveTemplate('one', 'Too many', guide()), /12/); assert.equal((await S.read('one')).templates.length, 12);
});
test('builder maintains structured instructions, page controls, contents, comparison images and quality in editable guides', async t => {
  const c = fixture(t); await c.start(); await c.module.add([{ name: 'one.png' }, { name: 'two.png' }]);
  c.set('[data-bc-step="expected"]', 'A saved request'); c.set('[data-bc-step="notes"]', 'Open the request first'); c.set('[data-bc-step="tip"]', 'Review the status'); c.set('[data-bc-step="warning"]', 'Check before saving'); c.set('[data-bc-page-break]', true, 'change');
  c.set('[data-bc-page="headerHeight"]', 60); c.set('[data-bc-page="margin"]', 100); c.set('[data-bc-page="imageWidth"]', 65); c.set('[data-bc-quality]', 'small', 'change'); c.set('[data-bc-contents]', true, 'change');
  await c.module.addComparison({ name: 'after.png' }); c.set('[data-bc-comparison="after"]', 'Saved result'); c.set('[data-bc-comparison="orientation"]', 'stack', 'change');
  let saved = await c.saved(); assert.equal(saved.steps[0].expected, 'A saved request'); assert.equal(saved.steps[0].warning, 'Check before saving'); assert.equal(saved.steps[0].pageBreakBefore, true); assert.equal(saved.steps[0].comparison.after, 'Saved result'); assert.equal(saved.page.headerHeight, 60); assert.equal(saved.page.margin, 100); assert.equal(saved.quality, 'small'); assert.equal(saved.contents, true);
  await c.click('remove-comparison'); assert.equal((await c.saved()).steps[0].comparison, null); await c.click('undo'); assert.equal((await c.saved()).steps[0].comparison.after, 'Saved result');
});
test('full document preview browses pages with thumbnails, page selection, footer inspection and zoom', async t => {
  const c = fixture(t); await c.start(); await c.module.add([{ name: 'one.png' }]); c.d.querySelector('.bc-branding').open = true; await c.module.preview();
  assert.equal(c.d.querySelectorAll('[data-bc-preview-thumbs] button').length, 4); assert.match(c.d.querySelector('[data-bc-preview-total]').textContent, /Page 1 of 4/);
  await c.click('preview-next'); await c.module.preview(); assert.equal(c.previews.at(-1).index, 1);
  c.set('[data-bc-preview-select]', 3, 'change'); await c.module.preview(); assert.equal(c.previews.at(-1).index, 3); assert.equal(c.d.querySelector('[data-bc="preview-next"]').disabled, true);
  c.set('[data-bc-preview-zoom]', 150); assert.equal(c.d.querySelector('[data-bc-preview-zoom-value]').textContent, '150%'); assert.equal(c.d.querySelector('[data-bc-page-sheet]').style.width, '930px');
  await c.click('preview-footer'); assert.match(c.d.querySelector('[data-bc-page-preview]').getAttribute('aria-label'), /Footer/);
  await c.click('preview-steps'); await c.module.preview(); assert.equal(c.previews.at(-1).index, 2);
});
test('studio workspaces preserve the same canvas and fields, selected steps and ready downloads', async t => {
  const c = fixture(t); await c.start(); await c.module.add([{ name: 'one.png' }, { name: 'two.png' }]);
  c.set('[data-bc-caption]', 'Keep this unfinished instruction'); const canvas = c.d.querySelector('[data-bc-canvas]'), caption = c.d.querySelector('[data-bc-caption]'), before = await c.saved(), link = c.d.querySelector('[data-bc-ready] a');
  assert.equal(c.d.querySelector('[data-bc-pane="edit"]').hidden, false);
  await c.click('workspace', { workspace: 'design' });
  assert.equal(c.d.querySelector('[data-bc-pane="edit"]').hidden, true); assert.equal(c.d.querySelector('[data-bc-pane="design"]').hidden, false); assert.ok(c.d.querySelector('[data-bc-preview-host="design"] .bc-guide-preview')); assert.equal(c.d.querySelector('.bc-branding .bc-guide-preview'), null);
  await c.module.preview(); await c.click('workspace', { workspace: 'preview' });
  assert.ok(c.d.querySelector('[data-bc-preview-host="preview"] .bc-guide-preview')); assert.equal(c.d.querySelector('[data-bc-pane="preview"]').hidden, false);
  await c.click('workspace', { workspace: 'edit' });
  assert.equal(c.d.querySelector('[data-bc-canvas]'), canvas); assert.equal(c.d.querySelector('[data-bc-caption]'), caption); assert.equal(caption.value, 'Keep this unfinished instruction'); assert.equal(c.d.querySelector('[data-bc-ready] a'), link); assert.deepEqual(await c.saved(), before);
  await c.click('workspace', { workspace: 'preview' }); await c.module.add([{ name: 'extra.png' }]); assert.equal(c.d.querySelector('[data-bc-pane="edit"]').hidden, false); assert.equal((await c.saved()).steps[0].caption, 'Keep this unfinished instruction');
});
test('workspace keyboard navigation and the More tools menu never nudge selected objects', async t => {
  const c = fixture(t); await c.start(); const g = guide(); g.steps[0].image = { ...image, width: 400, height: 300 }; g.steps[0].marks = [{ type: 'rectangle', color: '#ff0000', size: .01, points: [[.2, .2], [.5, .5]] }];
  await c.module.importGuide({ size: 100, text: async () => JSON.stringify(g) }); await settle(); await c.click('choose-object', { index: '0' }); const before = await c.saved();
  const editTab = c.d.querySelector('[data-bc-workspace-tab][data-workspace="edit"]'); editTab.dispatchEvent(new c.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); assert.equal(c.d.querySelector('[data-bc-pane="design"]').hidden, false);
  c.d.activeElement.dispatchEvent(new c.w.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })); assert.equal(c.d.querySelector('[data-bc-pane="preview"]').hidden, false); await c.click('workspace', { workspace: 'edit' });
  const menu = c.d.querySelector('.bc-more-tools'); menu.open = true; const text = menu.querySelector('[data-bc-tool="text"]'); text.dispatchEvent(new c.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); assert.deepEqual((await c.saved()).steps, before.steps);
  text.click(); assert.equal(menu.open, false); assert.equal(text.getAttribute('aria-pressed'), 'true'); menu.open = true; menu.querySelector('summary').dispatchEvent(new c.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); assert.equal(menu.open, false); assert.ok(c.d.querySelector('#batchCRoom'));
});
test('privacy editing keeps its existing tools and guide-only workspace controls stay absent', async t => {
  const c = fixture(t); c.module.open('privacy'); await c.module.add([{ name: 'private.png' }]); assert.equal(c.d.querySelector('[role="tablist"]'), null); assert.equal(c.d.querySelector('.bc-more-tools'), null); assert.equal(c.d.querySelector('[data-bc-tool="cover"]').getAttribute('aria-pressed'), 'true'); assert.ok(c.d.querySelector('[data-bc-tool="blur"]'));
});
test('automatic recovery restores a closed guide with its screenshot, comparison and text only for the same account', async t => {
  const idb = memoryIDB(), first = fixture(t, idb); await first.start(); await first.module.add([{ name: 'Saved.png' }]); first.set('[data-bc-step="expected"]', 'Recovered result'); await first.module.addComparison({ name: 'after.png' }); await first.module.flushDraft(); const expected = await first.saved(); first.module.close(); await settle();
  const second = fixture(t, idb); await second.start(); await settle(); const actual = await second.saved(); assert.deepEqual(actual.steps, expected.steps); assert.equal(actual.steps[0].comparison.image.src, image.src);
  const other = fixture(t, idb, 'two'); await other.start(); assert.equal(other.d.querySelectorAll('[data-bc="select"]').length, 0);
  await second.click('clear-recovery'); second.set('[data-bc-step="expected"]', 'Do not save'); await second.module.flushDraft(); assert.equal((await second.w.WorkHubGuideStore.read('one')).draft, null); assert.equal(second.d.querySelector('[data-bc-autosave]').checked, false);
});
test('saved brand templates apply across sessions while retaining current step text and cover images', async t => {
  const idb = memoryIDB(), c = fixture(t, idb); await c.start(); await c.module.add([{ name: 'one.png' }]); c.set('[data-bc-template-name]', 'Company <blue>'); c.set('[data-bc-export-heading]', 'TEAM / USER GUIDE'); c.set('[data-bc-quality]', 'print', 'change'); c.set('[data-bc-page="headerHeight"]', 60); await c.click('save-template');
  c.set('[data-bc-export-heading]', 'Different'); c.set('[data-bc-caption]', 'Keep this instruction'); c.set('[data-bc-cover="enabled"]', true, 'change'); c.set('[data-bc-cover="title"]', 'Keep this title'); await c.module.addCoverImages([{ name: 'cover.png' }]); c.set('[data-bc-template]', 'Company <blue>', 'change'); await c.click('apply-template');
  const saved = await c.saved(); assert.equal(saved.exportHeading, 'TEAM / USER GUIDE'); assert.equal(saved.steps[0].caption, 'Keep this instruction'); assert.equal(saved.cover.title, 'Keep this title'); assert.equal(saved.cover.images.length, 1); assert.equal(saved.quality, 'print'); assert.equal(saved.page.headerHeight, 60); assert.equal(c.d.querySelector('.bc-workspace-options script'), null);
  c.module.close(); const next = fixture(t, idb); await next.start(); assert.ok([...next.d.querySelector('[data-bc-template]').options].some(o => o.value === 'Company <blue>'));
  next.account('two'); next.module.open('guide'); await settle(); assert.equal(next.d.querySelector('[data-bc-template]').options.length, 1);
});
test('late recovery reads and preview work cannot populate a different account', async t => {
  const c = fixture(t); let finishRead;
  const S = c.w.WorkHubGuideStore, read = S.read;
  S.read = owner => owner === 'one' ? new Promise(resolve => { finishRead = resolve; }) : read(owner);
  await c.start(); c.account('two'); c.module.open('guide');
  finishRead({ draft: { guide: guide(), savedAt: Date.now() }, templates: [E.brandTemplate('Private brand', guide())], autoSave: true }); await settle();
  assert.equal(c.d.querySelectorAll('[data-bc="select"]').length, 0); assert.equal(c.d.querySelector('[data-bc-template]').options.length, 1);
  await c.module.add([{ name: 'new.png' }]); let finishPreview;
  c.w.WorkHubBatchCFiles.documentPreview = () => new Promise(resolve => { finishPreview = resolve; }); c.d.querySelector('.bc-branding').open = true; const pending = c.module.preview();
  c.account('three'); c.module.open('guide'); const page = c.d.createElement('canvas'); page.width = 1240; page.height = 1754; finishPreview({ pages: [{ index: 0, kind: 'steps', thumbnail: image.src }], firstPage: page }); await pending; await settle();
  assert.equal(page.width, 1); assert.equal(c.d.querySelectorAll('[data-bc-preview-thumbs] img').length, 0); assert.equal(c.d.querySelectorAll('[data-bc="select"]').length, 0);
});
test('a corrupt recovery image leaves current work intact and failed comparison uploads do not create undo edits', async t => {
  const c = fixture(t); let finish;
  c.w.WorkHubGuideStore.read = () => new Promise(resolve => { finish = resolve; });
  await c.start(); await c.module.add([{ name: 'current.png' }]); const bad = guide(); bad.steps[0].image.src = 'data:image/png;base64,AA==';
  finish({ draft: { guide: bad, savedAt: Date.now() }, templates: [], autoSave: true }); await settle(); const before = await c.saved();
  c.w.WorkHubBatchCFiles.loadImage = async im => { if (im.src.endsWith(',AA==')) throw Error('Corrupt saved image'); return {}; };
  await c.click('restore-recovery'); assert.match(c.d.querySelector('[data-bc-save-status]').textContent, /could not be opened/); assert.deepEqual(await c.saved(), before);
  c.w.WorkHubBatchCFiles.imageFromFile = async () => { throw Error('Bad upload'); }; await assert.rejects(() => c.module.addComparison({ name: 'bad.png' }), /Bad upload/); assert.deepEqual(await c.saved(), before); assert.equal(c.d.querySelector('[data-bc="undo"]').disabled, true);
});

async function native(t) {
  let mod; try { mod = await import('@napi-rs/canvas'); } catch { t.skip('Native canvas is available in visual QA'); return; }
  const { createCanvas, Image, GlobalFonts } = mod;
  for (const [family, file] of [['Arial', 'DejaVuSans'], ['Georgia', 'DejaVuSerif'], ['Courier New', 'DejaVuSansMono']]) { GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/' + file + '.ttf', family); GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/' + file + '-Bold.ttf', family); }
  const w = { Image, WorkHubBatchCEngine: E, atob: s => Buffer.from(s, 'base64').toString('binary') }, document = { baseURI: new URL('../index.html', import.meta.url).href, createElement: () => createCanvas(1, 1), fonts: { ready: Promise.resolve() } };
  new Function('window', 'document', source('batch-c-files.js'))(w, document); new Function('window', 'module', 'exports', source('vendor/jszip.min.js'))(w, undefined, undefined);
  const imageOf = (colour, width = 600, height = 300) => { const c = createCanvas(width, height), ctx = c.getContext('2d'); ctx.fillStyle = colour; ctx.fillRect(0, 0, width, height); return { src: c.toDataURL('image/png'), width, height }; };
  return { F: w.WorkHubBatchCFiles, w, imageOf, createCanvas };
}
test('rendered before-and-after comparisons keep both images and their arrangement without changing source pixels', async t => {
  const n = await native(t); if (!n) return; const { F, imageOf } = n, s = { ...step('a'), image: imageOf('#ff0000'), comparison: E.comparison({ image: imageOf('#0000ff'), orientation: 'side' }) };
  let c = await F.raster(s, () => true); assert.ok(c.width > c.height); let ctx = c.getContext('2d'); assert.deepEqual(Array.from(ctx.getImageData(c.width / 4, c.height / 2, 1, 1).data), [255, 0, 0, 255]); assert.deepEqual(Array.from(ctx.getImageData(c.width * 3 / 4, c.height / 2, 1, 1).data), [0, 0, 255, 255]); F.release(c);
  s.comparison.orientation = 'stack'; c = await F.raster(s, () => true); ctx = c.getContext('2d'); assert.deepEqual(Array.from(ctx.getImageData(c.width / 2, c.height / 4, 1, 1).data), [255, 0, 0, 255]); assert.deepEqual(Array.from(ctx.getImageData(c.width / 2, c.height * 3 / 4, 1, 1).data), [0, 0, 255, 255]); F.release(c);
});
test('contents thumbnails retain privacy covers', async t => {
  const n = await native(t); if (!n) return; const { F, imageOf } = n;
  const shot = imageOf('#ff0000', 400, 300), hidden = { ...step('private'), image: shot, marks: [{ type: 'cover', color: '#000000', size: .01, points: [[.1, .1], [.4, .4]] }] }, toc = await F.previewPage({ ...guide(), contents: true, steps: [hidden] }, 0, () => true), row = toc.guideMeta.links[0].rect;
  assert.deepEqual(Array.from(toc.getContext('2d').getImageData(row.x + 105, row.y + 32, 1, 1).data), [0, 0, 0, 255]); F.release(toc);
});
test('front-cover images have no border or inset frame and transparent pixels show the page in every cover design', async t => {
  const n = await native(t); if (!n) return; const { F, createCanvas } = n;
  const asset = createCanvas(400, 200), ink = asset.getContext('2d');
  ink.fillStyle = '#ff0000'; ink.fillRect(150, 50, 100, 100);
  const im = { src: asset.toDataURL('image/png'), width: 400, height: 200 };
  for (const design of ['band', 'editorial', 'gallery']) {
    const page = await F.previewPage({ ...guide(), page: { headerStyle: 'none' },
      colours: { accent: '#245e9a', paper: '#ffffff' },
      cover: { enabled: true, design, title: 'A cover', titleSize: 50, images: [im] } }, 0, () => true),
      ctx = page.getContext('2d'), top = design === 'gallery' ? 90 : 90 + 50 * 1.28 + 54;
    for (const [x, y] of [[90, top + 100], [1149, top + 100], [200, top], [200, top + 529], [120, top + 100]])
      assert.deepEqual(Array.from(ctx.getImageData(x, y, 1, 1).data), [255, 255, 255, 255], design);
    assert.deepEqual(Array.from(ctx.getImageData(620, top + 265, 1, 1).data), [255, 0, 0, 255]);
    F.release(page);
  }
});
test('plain and hidden headers match PNG exports across layouts and remove the top coloured strip on cover, contents and steps', async t => {
  const n = await native(t); if (!n) return; const { F, w, imageOf } = n;
  const firstRed = page => { const ctx = page.getContext('2d'); for (let y = 0; y < page.height; y++) {
    const p = ctx.getImageData(page.width / 2, y, 1, 1).data; if (p[0] > 240 && p[1] < 10 && p[2] < 10) return y;
  } return page.height; };
  for (const layout of ['walkthrough', 'split', 'compact']) {
    const positions = [];
    for (const headerStyle of ['band', 'text', 'none']) {
      const g = E.guide({ ...guide(), layout, exportHeading: 'Operations', page: { headerStyle },
        colours: { accent: '#245e9a', paper: '#ffffff' }, contents: true,
        cover: { enabled: true, design: 'band', images: [imageOf('#ff0000')] },
        steps: [{ ...step('a'), image: imageOf('#ff0000') }] }),
        zip = await w.JSZip.loadAsync(Buffer.from(await (await F.export(g, 'images', () => true)).arrayBuffer()));
      for (let i = 0; i < 3; i++) {
        const page = await F.previewPage(g, i, () => true);
        assert.deepEqual(page.toBuffer('image/png'), await zip.file(String(i + 1).padStart(3, '0') + '-guide-page.png').async('nodebuffer'));
        if (headerStyle !== 'band') assert.deepEqual(Array.from(page.getContext('2d').getImageData(5, 5, 1, 1).data), [255, 255, 255, 255]);
        if (i === 2 && layout === 'walkthrough') positions.push(firstRed(page));
        F.release(page);
      }
    }
    if (layout === 'walkthrough') assert.ok(positions[2] + 80 < positions[0]);
  }
});
test('compact header height moves screenshot content upward without reducing the maintained screenshot width', async t => {
  const n = await native(t); if (!n) return; const { F, imageOf } = n, g = { ...guide(), steps: [{ ...step('a'), image: imageOf('#ff0000') }] }, positions = [];
  for (const headerHeight of [70, 100]) {
    const page = await F.previewPage({ ...g, page: { headerHeight } }, 0, () => true), ctx = page.getContext('2d'); let y = 0;
    for (; y < page.height; y++) { const pixel = ctx.getImageData(620, y, 1, 1).data; if (pixel[0] > 240 && pixel[1] < 10 && pixel[2] < 10) break; }
    assert.ok(y < page.height); positions.push(y); F.release(page);
  }
  assert.ok(positions[0] + 35 < positions[1]);
});
test('PDF contents and bookmarks target actual step pages, including cover and manual page breaks', async t => {
  const n = await native(t); if (!n) return; const { F, imageOf } = n, g = E.guide({ ...guide(), contents: true, cover: { enabled: true, title: 'A useful guide' }, steps: [{ ...step('a'), image: imageOf('#f0f4f8'), expected: 'Saved successfully', tip: 'Review status', warning: 'Confirm before saving' }, { ...step('b'), image: imageOf('#e4f3e8'), pageBreakBefore: true }] });
  const file = await F.export(g, 'pdf', () => true), task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true });
  try { const pdf = await task.promise; assert.equal(pdf.numPages, 4); const outline = await pdf.getOutline(); assert.equal(outline.length, 2); assert.equal(await pdf.getPageIndex(outline[0].dest[0]), 2); assert.equal(await pdf.getPageIndex(outline[1].dest[0]), 3); const links = await (await pdf.getPage(2)).getAnnotations(); assert.equal(links.length, 2); assert.equal(await pdf.getPageIndex(links[1].dest[0]), 3); } finally { await task.destroy(); }
});
test('every document preview page matches exported PNG pixels and print quality renders more pixels without enlarging physical pages', async t => {
  const n = await native(t); if (!n) return; const { F, w, imageOf } = n, g = E.guide({ ...guide(), contents: true, cover: { enabled: true }, steps: [{ ...step('a'), image: imageOf('#dcebf8') }, { ...step('b'), image: imageOf('#dfefe8'), pageBreakBefore: true }] });
  const preview = await F.documentPreview(g, () => true), zip = await w.JSZip.loadAsync(Buffer.from(await (await F.export(g, 'images', () => true)).arrayBuffer())); assert.equal(preview.pages.length, 4); F.release(preview.firstPage);
  for (let i = 0; i < preview.pages.length; i++) { const page = await F.previewPage(g, i, () => true); assert.deepEqual(page.toBuffer('image/png'), await zip.file(String(i + 1).padStart(3, '0') + '-guide-page.png').async('nodebuffer')); F.release(page); }
  for (const [quality, width] of [['small', 930], ['balanced', 1240], ['print', 1860]]) { const page = await F.previewPage({ ...g, quality }, 0, () => true); assert.equal(page.width, width); F.release(page); const pdf = await F.export({ ...g, quality }, 'pdf', () => true), task = pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()), useSystemFonts: true }); try { const doc = await task.promise, page = await doc.getPage(1); assert.ok(Math.abs(page.view[2] - 595.28) < 0.01); assert.ok(Math.abs(page.view[3] - 841.89) < 0.01); } finally { await task.destroy(); } }
});
