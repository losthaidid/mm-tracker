import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
const source = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
function setup(t, ui = false) {
  const dom = new JSDOM('<div id="view"></div>', {
    url: 'https://example.test/workhub/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.Blob = Blob;
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  w.setImmediate = setImmediate;
  w.clearImmediate = clearImmediate;
  w.URL.createObjectURL = () => 'blob:reader-test';
  w.URL.revokeObjectURL = () => {};
  const timeout = w.setTimeout.bind(w);
  w.setTimeout = (fn, ms, ...args) => {
    if (ms === 30 || ms === 150) {
      queueMicrotask(() => fn(...args));
      return 0;
    }
    return timeout(fn, ms, ...args);
  };
  for (const f of [
    'vendor/jszip.min.js',
    'validator-engine.js',
    'validator-files.js',
    'data-reader-engine.js',
    'data-reader-files.js',
    ...(ui ? ['data-reader.js'] : []),
  ])
    w.eval(source(f));
  let owner = 'first-owner',
    ready = true;
  const downloads = [],
    a = {
      ready: () => ready,
      owner: () => owner,
      render: () => {},
      download: (blob, name, type) => downloads.push({ blob, name, type }),
    };
  const E = w.WorkHubDataReaderEngine,
    F = w.WorkHubDataReaderFiles;
  const reader = ui ? w.WorkHubDataReader.install(a) : null;
  if (reader) {
    w.document.getElementById('view').innerHTML = reader.render();
    reader.mount();
  }
  return {
    w,
    d: w.document,
    E,
    F,
    reader,
    downloads,
    setOwner: v => (owner = v),
    setReady: v => (ready = v),
  };
}
const clone = v => JSON.parse(JSON.stringify(v));
const xml = (inside, attrs = '') => `<wrapper><IDOC BEGIN="1" ${attrs}>${inside}</IDOC></wrapper>`;
test('Data reader: JSON preserves exact number tokens, empty values, duplicate keys, unsafe names and source text', t => {
  const { E } = setup(t),
    text =
      '\uFEFF{ "id":"0001", "large":90071992547409931234, "decimal":1.2300e+20, "id":"0002", "empty":"", "none":null, "flag":false,"__proto__":{"polluted":true}}';
  const d = E.parse(text),
    n = d.roots[0];
  assert.equal(d.source, text);
  assert.equal(d.duplicates, 1);
  assert.equal(n.children[1].value, '90071992547409931234');
  assert.equal(n.children[2].value, '1.2300e+20');
  assert.equal(n.children[3].key, 'id');
  assert.equal(n.children[3].value, '0002');
  assert.equal(typeof E.label('__proto__'), 'string');
  assert.equal({}.polluted, undefined);
  assert.equal(E.blank(n.children.find(x => x.key === 'empty')), true);
  assert.equal(E.blank(n.children.find(x => x.key === 'none')), false);
  const fields = E.sections(n)[0].rows;
  assert.equal(fields.filter(r => r[0] === 'Id [id]').length, 2);
  assert.ok(fields.some(r => r[1] === '90071992547409931234'));
  assert.throws(() => E.parse('{"a":1,}'), /line 1, column/);
  assert.throws(() => E.parse('{"a":01}'), /comma/);
  assert.throws(() => E.parse('true false'), /Unexpected content/);
  assert.throws(() => E.parse('"unclosed'), /Unclosed/);
});
test('Data reader: primitive and heterogeneous JSON arrays retain missing versus empty and discover every encountered column', t => {
  const { E } = setup(t),
    d = E.parse('[{"a":"","b":null},{"c":"new","a":"0002"}]'),
    table = E.table(d.roots[0].children);
  assert.deepEqual(
    Array.from(table.columns, c => c.title),
    ['a', 'b', 'c']
  );
  assert.equal(table.rows[0].cells.has(table.columns[2].key), false);
  assert.equal(table.rows[0].cells.get(table.columns[0].key).value, '');
  const primitive = E.parse('[90071992547409931234,null,false,"0001",{},[]]'),
    t2 = E.table(primitive.roots[0].children);
  assert.equal(t2.columns.length, 1);
  assert.equal(t2.columns[0].title, 'Value');
  assert.equal(E.scalar(t2.rows[4].cells.get(t2.columns[0].key)), '[object: 0 entries]');
  assert.equal(E.sections(primitive.roots[0]).length, 1);
  assert.equal(E.sections(primitive.roots[0])[0].rows.length, 6);
  assert.equal(E.sections(E.parse('""').roots[0], { hideEmpty: true }).length, 0);
});
test('Data reader: dynamically reads custom IDoc segments, CDATA, repeated acknowledgement rows and ordered status records', t => {
  const { E } = setup(t),
    d = E.parse(E.sample('idoc')),
    idoc = d.roots[0],
    info = E.idocInfo(idoc),
    g = E.groups(idoc).find(g => g.key === 'ZDEMO_ITEM');
  assert.equal(info.number, '0000000000000042');
  assert.equal(info.status, '03');
  assert.deepEqual(
    Array.from(info.statuses, s => E.field(s, 'STATUS')),
    ['01', '30', '03']
  );
  assert.equal(info.statusText, 'Sample dispatch message');
  assert.equal(g.records.length, 4);
  assert.equal(g.records[1].children.find(n => n.key === 'POSNR').value, '0001');
  assert.equal(
    g.records[1].children.find(n => n.key === 'DOC_NUMBER').value,
    g.records[3].children.find(n => n.key === 'DOC_NUMBER').value
  );
  assert.equal(
    E.field(
      idoc.children.find(n => n.key === 'ZDEMO_HEADER'),
      'STATUS'
    ),
    'S'
  );
  assert.equal(
    idoc.children.find(n => n.key === 'ZDEMO_HEADER').children[0].value,
    ' DEMO_ACK_SERVICE '
  );
  const section = E.sections(idoc).find(s => s.title.startsWith('ZDEMO ITEM'));
  assert.equal(section.rows.length, 4);
  assert.ok(section.columns.includes('Item number'));
  assert.equal(d.roots[0].path, '/ZDEMO_ACK[1]/IDOC[1]');
});
test('Data reader: namespaces, different wrappers, multiple IDocs, missing controls and repeated nested names keep distinct paths', t => {
  const { E } = setup(t),
    d = E.parse(
      '<env xmlns:s="urn:demo"><body><s:IDOC><s:ZNEW SEGMENT="1"><s:ROW SEGMENT="1"><A>1</A><A>2</A><parsererror>real field</parsererror></s:ROW><s:ROW SEGMENT="1"><B>3</B></s:ROW></s:ZNEW><OTHER SEGMENT="1"><s:ROW SEGMENT="1"><C>4</C></s:ROW></OTHER></s:IDOC><s:IDOC><DIFFERENT>5</DIFFERENT></s:IDOC></body></env>'
    );
  assert.equal(d.roots.length, 2);
  assert.equal(E.idocInfo(d.roots[0]).number, '');
  assert.match(d.roots[0].path, /env\[1\]\/body\[1\]\/s:IDOC\[1\]/);
  assert.match(d.roots[1].path, /s:IDOC\[2\]/);
  const group = E.groups(d.roots[0].children[0])[0],
    table = E.table(group.records);
  assert.equal(group.records.length, 2);
  assert.deepEqual(
    Array.from(table.columns, c => c.title),
    ['A', 'A [2]', 'parsererror', 'B']
  );
  const sections = E.sections(d.roots[0]);
  assert.ok(sections.some(s => s.rows.length === 2 && s.source.includes('s:ZNEW')));
  assert.ok(sections.some(s => s.source.includes('OTHER') && s.rows[0][1] === '4'));
  const rootOnly = E.parse('<IDOC><CUSTOM SEGMENT="1"/></IDOC>');
  assert.equal(rootOnly.roots[0].path, '/IDOC[1]');
  assert.equal(E.idocInfo(rootOnly.roots[0]).statuses.length, 0);
});
test('Data reader: malformed XML, DTDs, fixed-width text and oversized or deeply nested inputs stop with actionable errors', t => {
  const { E } = setup(t);
  assert.throws(() => E.parse('<IDOC><A></IDOC>'), /not well formed/);
  assert.throws(
    () => E.parse('<!DOCTYPE IDOC SYSTEM "https://example.test/private"><IDOC/>'),
    /DTD/
  );
  assert.throws(() => E.parse('<anything/>'), /No IDOC/);
  assert.throws(() => E.parse('EDI_DC40   400   00000001'), /JSON value/);
  assert.throws(() => E.parse('"' + 'x'.repeat(E.LIMITS.bytes) + '"'), /2 MB/);
  assert.throws(() => E.parse('['.repeat(66) + '0' + ']'.repeat(66)), /64 levels/);
  assert.throws(() => E.parse('[' + Array(30001).fill('0').join(',') + ']'), /30,000/);
  assert.equal(E.date('20260230'), '');
  assert.equal(E.time('250000'), '');
  assert.equal(E.date('00000000'), '');
  assert.equal(E.date('20261028'), '28 Oct 2026');
});
test('Data reader: report options, selected scopes, friendly labels and formula-safe CSV retain original values', t => {
  const { E } = setup(t),
    d = E.parse(
      xml(
        '<UNKNOWN SEGMENT="1"><CODE>0001</CODE><EMPTY/><STATUS>S</STATUS><NOTE><![CDATA[<img src=x onerror=alert(1)>]]></NOTE></UNKNOWN>'
      )
    ),
    n = d.roots[0],
    sections = E.sections(n, { hideEmpty: true, aliases: { CODE: 'Reference code' } });
  assert.ok(sections[0].rows.some(r => r[0] === 'Reference code [CODE]' && r[1] === '0001'));
  assert.ok(!sections[0].rows.some(r => r[0].includes('EMPTY')));
  assert.ok(sections[0].rows.some(r => r[1].startsWith('<img')));
  assert.equal(E.sections(n, { selected: [] }).length, 0);
  assert.equal(E.sections(n, { selected: [sections[0].id] }).length, 1);
  assert.match(E.csv([[' =SUM(A1)', '0001', '-2', '@x', 'plain']]), /"' =SUM\(A1\)"/);
  assert.equal(E.label('__proto__', JSON.parse('{"__proto__":"Custom label"}')), 'Custom label');
});
test('Data reader: Excel workbook uses text cells for identifiers, large integers and formula-like values', async t => {
  const { w, E, F } = setup(t),
    d = E.parse('[{"code":"0001","number":90071992547409931234,"text":"=1+1"}]'),
    s = E.sections(d.roots[0]);
  const blob = await w.WorkHubValidatorFiles.workbook(F.worksheets(s)),
    zip = await w.JSZip.loadAsync(new w.Uint8Array(await blob.arrayBuffer())),
    sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(sheet, /t="inlineStr"/);
  assert.match(sheet, />0001</);
  assert.match(sheet, />90071992547409931234</);
  assert.match(sheet, />=1\+1</);
  assert.doesNotMatch(sheet, /<f>/);
  assert.throws(
    () => F.worksheets([{ title: 'Bad', columns: ['x'], rows: [['\u0000']] }]),
    /safely in Excel/
  );
});
test('Data reader UI: report, explorer, search, raw source and custom labels stay local and render values as inert text', async t => {
  const { w, d, E, reader } = setup(t, true);
  await reader.openText(E.sample('idoc'));
  assert.equal(reader.snapshot().kind, 'idoc');
  assert.match(d.getElementById('drContent').textContent, /Technical status/);
  assert.match(d.getElementById('drContent').textContent, /03/);
  assert.equal(d.querySelectorAll('.dr-history li').length, 3);
  await reader.handle({ dataset: { dr: 'tab', tab: 'explore' } });
  const group = d.querySelector('[data-dr="group"]');
  assert.ok(group);
  await reader.handle(group);
  assert.match(d.getElementById('drContent').textContent, /4 of 4 records/);
  d.getElementById('drSearch').value = '4900000002';
  d.getElementById('drSearch').dispatchEvent(new w.Event('input', { bubbles: true }));
  await Promise.resolve();
  assert.match(d.getElementById('drContent').textContent, /3 of 4 records/);
  await reader.openText('{"html":"<img src=x onerror=alert(1)>","id":"0001"}');
  assert.equal(d.querySelector('#dataReader img'), null);
  assert.match(d.getElementById('drContent').textContent, /<img/);
  d.getElementById('drAliasKey').value = 'id';
  d.getElementById('drAliasValue').value = 'Reference';
  d.getElementById('drAliasForm').dispatchEvent(
    new w.Event('submit', { bubbles: true, cancelable: true })
  );
  assert.match(d.getElementById('drContent').textContent, /Reference \[id\]/);
  await reader.handle({ dataset: { dr: 'tab', tab: 'raw' } });
  assert.equal(
    d.querySelector('.dr-raw').value,
    '{"html":"<img src=x onerror=alert(1)>","id":"0001"}'
  );
  assert.equal(w.localStorage.length, 0);
});
test('Data reader UI: account changes, clear and late file reads cannot reveal previous content or download stale exports', async t => {
  const ctx = setup(t, true),
    { d, reader, E, setOwner, downloads, w } = ctx;
  await reader.openText(E.sample('json'));
  const textarea = d.getElementById('drSource');
  textarea.value = 'Pending draft';
  textarea.focus();
  textarea.setSelectionRange(2, 5);
  assert.equal(reader.patchRender(), true);
  assert.equal(d.getElementById('drSource'), textarea);
  let finish;
  const pending = reader.loadFile({
    name: 'private.json',
    size: 50,
    arrayBuffer: () => new Promise(r => (finish = r)),
  });
  setOwner('second-owner');
  reader.sync();
  d.getElementById('view').innerHTML = reader.render();
  reader.mount();
  finish(new TextEncoder().encode('{"private":"old account"}').buffer);
  await pending;
  assert.equal(reader.snapshot().source, '');
  assert.doesNotMatch(d.body.textContent, /old account/);
  await reader.openText('{"id":"0001"}');
  let complete;
  w.WorkHubDataReaderFiles.pdf = () => new Promise(r => (complete = r));
  const job = reader.exportFile('pdf');
  d.getElementById('drTitle').value = 'Changed title';
  d.getElementById('drTitle').dispatchEvent(new w.Event('input', { bubbles: true }));
  complete(new Blob(['old report']));
  await job;
  assert.equal(downloads.length, 0);
  assert.equal(reader.snapshot().busy, false);
  d.getElementById('drAliasKey').value = 'Private field';
  d.getElementById('drAliasValue').value = 'Private label';
  const job2 = reader.exportFile('pdf');
  await reader.handle({ dataset: { dr: 'clear' } });
  complete(new Blob(['cancelled report']));
  await job2;
  assert.equal(downloads.length, 0);
  assert.equal(reader.snapshot().source, '');
  assert.equal(reader.snapshot().busy, false);
  assert.equal(d.getElementById('drAliasKey').value, '');
  assert.equal(d.getElementById('drAliasValue').value, '');
  assert.equal(d.getElementById('drTree').childElementCount, 0);
  assert.equal(d.getElementById('drContent').childElementCount, 0);
  assert.equal(d.getElementById('drSectionOptions').childElementCount, 0);
});
test('Data reader UI: UTF-16 XML uploads, invalid replacements and source downloads retain the expected content', async t => {
  const { reader, downloads, E } = setup(t, true),
    text = E.sample('idoc'),
    buffer = Buffer.from('\uFEFF' + text, 'utf16le');
  await reader.loadFile({
    name: 'unicode.xml',
    size: buffer.length,
    arrayBuffer: async () =>
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  });
  assert.equal(reader.snapshot().kind, 'idoc');
  await reader.exportFile('original');
  assert.deepEqual(Buffer.from(downloads[0].blob), buffer);
  await reader.openText('{broken');
  assert.equal(reader.snapshot().kind, '');
  assert.match(reader.snapshot().error, /quoted field name/);
  assert.equal(reader.snapshot().busy, false);
});
test('Data reader UI: wide tables paginate fields and records while report exports retain the complete union', async t => {
  const { reader, d, w } = setup(t, true),
    rows = Array.from({ length: 45 }, (_, i) =>
      Object.fromEntries(Array.from({ length: 80 }, (_, j) => ['FIELD_' + j, String(i) + '-' + j]))
    );
  rows[44].EXTRA = 'last row only';
  await reader.openText(JSON.stringify(rows));
  await reader.handle({ dataset: { dr: 'tab', tab: 'explore' } });
  assert.equal(d.querySelectorAll('#drContent thead th').length, 26);
  assert.equal(d.querySelectorAll('#drContent tbody tr').length, 30);
  await reader.handle({ dataset: { dr: 'columns', delta: '1' } });
  assert.match(d.getElementById('drContent').textContent, /FIELD_25/);
  await reader.handle({ dataset: { dr: 'page', delta: '1' } });
  assert.equal(d.querySelectorAll('#drContent tbody tr').length, 15);
  const report = reader.report(),
    data = report.sections.find(s => s.rows.length === 45);
  assert.equal(data.columns.length, 82);
  assert.ok(data.rows[44].includes('last row only'));
  d.getElementById('drFriendly').checked = false;
  d.getElementById('drFriendly').dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.ok(reader.report().sections.some(s => s.columns.includes('EXTRA')));
});

test('Data reader: text-only and mixed-content segments retain their text and path expansion stays bounded', t => {
  const { E } = setup(t),
    d = E.parse(
      '<IDOC><ZPAYLOAD SEGMENT="1"><![CDATA[ raw payload 001 ]]></ZPAYLOAD><ZMIXED SEGMENT="1">prefix<F>child</F>suffix</ZMIXED></IDOC>'
    ),
    sections = E.sections(d.roots[0]);
  assert.ok(sections.some(s => s.rows.some(r => r[1] === ' raw payload 001 ')));
  assert.ok(sections.some(s => s.rows.some(r => r[1] === 'prefixsuffix')));
  assert.ok(sections.some(s => s.rows.some(r => r[1] === 'child')));
  assert.throws(() => E.parse(JSON.stringify({ ['x'.repeat(513)]: 'value' })), /512 characters/);
  let data = Array.from({ length: 10000 }, () => ({ id: '0001' }));
  for (let i = 0; i < 8; i++) data = { ['key'.repeat(100)]: data };
  assert.throws(() => E.parse(JSON.stringify(data)), /long paths/);
});

test('Data reader presentation: folding and jumping through report sections never removes exported records', async t => {
  const { reader, d, E, w } = setup(t, true);
  await reader.openText(E.sample('idoc'));
  const original = clone(reader.report()),
    content = d.getElementById('drContent');
  assert.match(content.textContent, /MESSAGE JOURNEY/);
  assert.match(content.textContent, /DEMO_SOURCE/);
  assert.match(content.textContent, /DEMO_TARGET/);
  assert.equal(d.querySelectorAll('.dr-field-grid').length, 3);
  await reader.handle({ dataset: { dr: 'fold' } });
  assert.equal(d.querySelectorAll('[data-report-section][open]').length, 0);
  assert.deepEqual(clone(reader.report()), original);
  await reader.handle({ dataset: { dr: 'tab', tab: 'explore' } });
  await reader.handle({ dataset: { dr: 'tab', tab: 'report' } });
  assert.equal(d.querySelectorAll('[data-report-section][open]').length, 0);
  const target = d.querySelectorAll('[data-report-section]')[3];
  content.scrollTop = 200;
  content.getBoundingClientRect = () => ({ top: 100 });
  target.getBoundingClientRect = () => ({ top: 400 });
  await reader.handle({ dataset: { dr: 'jump-section', id: target.dataset.reportSection } });
  assert.equal(target.open, true);
  assert.equal(content.scrollTop, 484);
  assert.equal(d.activeElement, target.querySelector('summary'));
  assert.equal(w.scrollY, 0);
  await reader.handle({ dataset: { dr: 'unfold' } });
  assert.equal(d.querySelectorAll('[data-report-section][open]').length, original.sections.length);
  assert.deepEqual(clone(reader.report()), original);
  const checkbox = d.querySelector('#drSectionOptions [data-section]');
  checkbox.checked = false;
  checkbox.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(reader.report().sections.length, original.sections.length - 1);
});

test('Data reader presentation: expanded mode supports Escape, returns focus and clears on account changes', async t => {
  const { reader, d, w, setOwner } = setup(t, true);
  await reader.openText('{"identifier":"00001","items":[{"a":"first"},{"a":"second"}]}');
  const expand = d.querySelector('[data-dr="expand-view"]'),
    root = d.getElementById('dataReader');
  expand.focus();
  await reader.handle(expand);
  assert.equal(reader.snapshot().expandedView, true);
  assert.equal(root.getAttribute('role'), 'dialog');
  assert.equal(root.getAttribute('aria-modal'), 'true');
  d.getElementById('drExportMenu').open = true;
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(d.getElementById('drExportMenu').open, false);
  assert.equal(reader.snapshot().expandedView, true);
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(reader.snapshot().expandedView, false);
  assert.equal(root.hasAttribute('aria-modal'), false);
  assert.equal(d.activeElement, expand);
  await reader.handle(expand);
  await reader.handle({ dataset: { dr: 'clear' } });
  assert.equal(root.classList.contains('dr-expanded'), false);
  assert.equal(reader.snapshot().source, '');
  await reader.openText('{"private":"first-owner-only"}');
  await reader.handle(expand);
  setOwner('second-owner');
  reader.sync();
  assert.equal(reader.snapshot().expandedView, false);
  assert.equal(reader.snapshot().source, '');
  assert.equal(root.classList.contains('dr-expanded'), false);
  assert.doesNotMatch(d.body.textContent, /first-owner-only/);
});

test('Data reader presentation: outline changes keep the report mounted and section choices keep keyboard focus', async t => {
  const { reader, d, w, E } = setup(t, true);
  await reader.openText(E.sample('idoc'));
  const content = d.getElementById('drContent'),
    heading = content.querySelector('[data-report-title]');
  content.scrollTop = 275;
  const branch = d.querySelectorAll('#drTree [data-dr="expand"]')[1];
  await reader.handle(branch);
  assert.equal(content.querySelector('[data-report-title]'), heading);
  assert.equal(content.scrollTop, 275);
  const checkbox = d.querySelector('#drSectionOptions [data-section]');
  await reader.handle({ dataset: { dr: 'options' } });
  checkbox.focus();
  checkbox.checked = false;
  checkbox.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(d.activeElement, checkbox);
  assert.equal(d.querySelector('#drSectionOptions [data-section]'), checkbox);
  assert.equal(d.getElementById('drOptions').open, true);
  assert.equal(content.scrollTop, 275);
  await reader.handle({ dataset: { dr: 'composer' } });
  assert.equal(d.getElementById('drComposer').open, true);
  assert.equal(d.activeElement, d.getElementById('drSource'));
});
