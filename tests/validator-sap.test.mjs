import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, after } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('', { runScripts: 'outside-only' }), w = dom.window;
Object.assign(w, { Blob, TextEncoder, TextDecoder, setImmediate, clearImmediate });
w.eval(readFileSync(new URL('../vendor/jszip.min.js', import.meta.url), 'utf8'));
for (const file of ['validator-engine.js', 'validator-files.js', 'validator-setup.js'])
  w.eval(readFileSync(new URL('../' + file, import.meta.url), 'utf8'));
after(() => w.close());
const E = w.WorkHubValidatorEngine, F = w.WorkHubValidatorFiles, S = w.WorkHubValidatorSetup;
const copy = x => JSON.parse(JSON.stringify(x));
function sap(type, extra = {}) {
  const t = E.create('DDIC checks'); t.mode = 'sap';
  t.columns = [{ ...E.column(), key: 'VALUE', label: 'Value', sapType: type, ...extra }];
  return t;
}
const check = (type, value, extra = {}) => E.validateRows(sap(type, extra), [{ VALUE: value }]).errors;
async function read(filename) {
  const bytes = readFileSync(new URL('../' + filename, import.meta.url));
  return F.read({ name: filename, size: bytes.length, arrayBuffer: async () => bytes });
}
const generalBook = await read('validation-setup-simple.xlsx');
const sapBook = await read('validation-setup-sap.xlsx');
function simple(mode = 'General', fields = [['CODE', '', 'text', 10, '', 'No', 'X', '', '', '']]) {
  return { sheets: [{ name: 'Setup', rows: [[], ['Template name', 'My checks'], ['Template type', mode], ['Description', 'Example'], [], [], [], [...S.SIMPLE_HEADERS], ...fields] }] };
}

test('SAP character and byte types enforce configured internal lengths without changing values', () => {
  const cases = [
    ['CHAR', 'AB', true, { sapLength: 2 }], ['CHAR', 'ABC', false, { sapLength: 2 }],
    ['NUMC', '000001', true, { sapLength: 6 }], ['NUMC', '1', false, { sapLength: 6 }],
    ['NUMC', '00A001', false, { sapLength: 6 }], ['CLNT', '100', true], ['CLNT', '10', false],
    ['LANG', 'E', true], ['LANG', 'EN', false], ['CUKY', 'MYR', true], ['CUKY', 'ABCDEF', false],
    ['UNIT', 'KG', true], ['UNIT', 'FOUR', false], ['SSTRING', 'text', true, { sapLength: 4 }],
    ['SSTRING', 'texts', false, { sapLength: 4 }], ['STRING', 'variable text', true],
    ['RAW', '00aF', true, { sapLength: 2 }], ['RAW', '0GAF', false, { sapLength: 2 }],
    ['RAW', 'AF', false, { sapLength: 2 }],
  ];
  for (const [type, value, valid, extra] of cases) assert.equal(check(type, value, extra), valid ? 0 : 1, type + ': ' + value);
  const t = sap('NUMC', { sapLength: 6 }), rows = [{ VALUE: '000001' }], before = copy(rows);
  E.validateRows(t, rows); assert.deepEqual(rows, before);
});
test('SAP DATS and TIMS accept real internal dates, initial values and valid clock boundaries', () => {
  for (const value of ['00000000', '00010101', '20000229', '20240229', '99991231']) assert.equal(check('DATS', value), 0, value);
  for (const value of ['20260229', '19000229', '20260431', '00000101', '2026-10-26', '20261301']) assert.equal(check('DATS', value), 1, value);
  for (const value of ['000000', '125959', '235959']) assert.equal(check('TIMS', value), 0, value);
  for (const value of ['240000', '236000', '235960', '12:00:00', '12000']) assert.equal(check('TIMS', value), 1, value);
  assert.equal(check('DATS', '', { required: true }), 1);
  assert.equal(check('DATS', '00000000', { required: true }), 0);
});
test('SAP integer ranges include INT8 boundaries without JavaScript number precision loss', () => {
  for (const [type, min, max] of [['INT1','0','255'],['INT2','-32768','32767'],['INT4','-2147483648','2147483647'],['INT8','-9223372036854775808','9223372036854775807']]) {
    for (const value of [min, max]) assert.equal(check(type, value), 0, type + ': ' + value);
    for (const value of [(BigInt(min)-1n).toString(), (BigInt(max)+1n).toString(), '1.1', '1e2']) assert.equal(check(type, value), 1, type + ': ' + value);
  }
});
test('SAP packed decimals obey precision and scale, use exact comparisons and never round', () => {
  for (const type of ['DEC', 'CURR', 'QUAN']) {
    const c = { sapLength: 5, sapDecimals: 2 };
    for (const v of ['999.99', '-999.99', '0', '+0.01', '00012.30']) assert.equal(check(type, v, c), 0, type + ': ' + v);
    for (const v of ['1000', '1.001', '1,000.00', '1e2', '.5', '1.']) assert.equal(check(type, v, c), 1, type + ': ' + v);
  }
  assert.equal(check('DEC', '0.99', {sapLength:2,sapDecimals:2}), 0);
  assert.equal(check('DEC', '1.00', {sapLength:2,sapDecimals:2}), 1);
  const t = sap('DEC', {sapLength:31,sapDecimals:14,unique:true});
  const r = E.rule('VALUE'); r.assertion = {...E.condition('VALUE'),operator:'gt',value:'9007199254740992.12345678901234'}; t.rules=[r];
  const rows=[{VALUE:'9007199254740992.12345678901235'},{VALUE:'9007199254740992.12345678901234'}];
  const result=E.validateRows(t,rows); assert.equal(result.errors,1); assert.equal(result.issues[0].index,1);
});
test('SAP references, allowed values, uniqueness and suggestions retain exact INT8 values', () => {
  const t = sap('INT8', {unique:true,values:'9007199254740992,9007199254740993'});
  t.lookups=[{id:'ids',name:'Valid IDs',headers:['ID'],rows:[['9007199254740992'],['9007199254740993']]}];
  const r=E.rule('VALUE');r.assertion={...E.condition('VALUE'),operator:'lookup',lookupId:'ids',lookupColumn:'ID'};t.rules=[r];
  assert.equal(E.validateRows(t,[{VALUE:'9007199254740992'},{VALUE:'9007199254740993'}]).errors,0);
  assert.equal(E.validateRows(t,[{VALUE:'9007199254740992'},{VALUE:'+9007199254740992'}]).errors,2);
  assert.deepEqual(copy(E.suggestions(t,{VALUE:'invalid'},'VALUE').choices.map(c=>c.value)),['9007199254740992','9007199254740993']);
  const d=sap('DEC',{sapLength:5,sapDecimals:2,unique:true});
  assert.equal(E.validateRows(d,[{VALUE:'1.2'},{VALUE:'1.20'}]).errors,2);
});
test('SAP string operators inspect visible text rather than scaled numeric comparison keys', () => {
  const t=sap('INT8'),r=E.rule('VALUE');t.rules=[r];
  for (const [operator,value,input,valid] of [['contains','12','3124',true],['starts','12','123',true],['ends','12','312',true],['ends','12','1200',false]]) {
    r.assertion={...E.condition('VALUE'),operator,value}; assert.equal(E.validateRows(t,[{VALUE:input}]).errors,valid?0:1);
  }
});
test('SAP currency and quantity references validate schema and required companion values', () => {
  const t=sap('CURR',{sapReference:'CURRENCY'});t.columns.push({...E.column(1),key:'CURRENCY',label:'Currency',sapType:'CUKY'});
  assert.equal(E.validateRows(t,[{VALUE:'10.25',CURRENCY:'MYR'}]).errors,0);
  assert.equal(E.validateRows(t,[{VALUE:'10.25',CURRENCY:''}]).errors,1);
  assert.equal(E.validateRows(t,[{VALUE:'',CURRENCY:''}]).errors,0);
  t.columns[1].sapType='CHAR';assert.throws(()=>E.checkSchema(t),/CUKY/);
  t.columns[0].sapType='QUAN';t.columns[0].sapReference='UNIT';t.columns[1].sapType='UNIT';t.columns[1].key='UNIT';
  assert.equal(E.validateRows(t,[{VALUE:'2.500',UNIT:'KG'}]).errors,0);
});
test('SAP invalid type, length, scale and malformed metadata cannot publish or restore', () => {
  for (const extra of [{sapType:'NOT_A_TYPE'},{sapType:'constructor'},{sapType:'toString'},{sapType:'__proto__'},{sapLength:0},{sapLength:30001},{sapLength:true},{sapDecimals:{}},{sapDecimals:15},{sapLength:2,sapDecimals:3}]) {
    const t=sap('DEC',extra);assert.throws(()=>E.checkSchema(t),/SAP/);
  }
  assert.throws(()=>E.checkSchema(sap('DATS',{sapLength:10})),/SAP/);
  assert.throws(()=>E.checkSchema(sap('CURR',{sapDecimals:0})),/decimal/);
  const t=sap('INT8');t.releases=[{version:1,publishedAt:new Date().toISOString(),schema:E.schema(t)}];
  const old={workhub:{validator:{templates:[t],runs:[]}}}, next=copy(old);
  next.workhub.validator.templates[0].columns[0].sapType='CHAR';E.prepare(next,old);
  next.workhub.validator.templates[0].releases[0].schema.mode='general';assert.throws(()=>E.prepare(next,old),/frozen/);
});
test('legacy General schemas keep date and format checks and ignore inactive SAP settings', () => {
  const t=sap('DATS');delete t.mode;t.columns[0].type='date';
  assert.equal(E.validateRows(t,[{VALUE:'2026-10-26'}]).errors,0);
  assert.equal(E.validateRows(t,[{VALUE:'20261026'}]).errors,1);
  t.columns[0].type='text';t.columns[0].format='email';
  assert.equal(E.validateRows(t,[{VALUE:'person@example.com'}]).errors,0);
  assert.equal(E.validateRows(t,[{VALUE:'invalid'}]).errors,1);
  assert.equal(E.schema(t).mode,'general');
});
test('single-sheet shipped downloads create General and SAP definitions using the actual reader', () => {
  assert.equal(generalBook.sheets.length,1);assert.equal(sapBook.sheets.length,1);
  const g=S.parse(generalBook),s=S.parse(sapBook);
  assert.equal(g.mode,'general');assert.equal(g.columns.length,4);assert.equal(s.mode,'sap');assert.equal(s.columns.length,9);
  assert.equal(E.validateRows(g,[{RECORD_ID:'000012',APPROVED:'',AMOUNT:'12.50',DUE_DATE:'2026-10-26'}]).errors,0);
  const row={CLIENT:'100',MATERIAL:'000001',BATCH:'0000000001',POSTING_DATE:'20261026',AMOUNT:'125.50',CURRENCY:'MYR',QUANTITY:'12.500',UNIT:'KG',APPROVED:''};
  assert.equal(E.validateRows(s,[row]).errors,0);
  assert.equal(E.validateRows(s,[{...row,APPROVED:'X'}]).errors,0);
  assert.equal(E.validateRows(s,[{...row,APPROVED:'Y'}]).errors,1);
});
test('single-sheet setup defaults optional labels, lists and metadata without mutating workbook data', () => {
  const b=simple(),before=copy(b),t=S.parse(b);assert.deepEqual(b,before);
  assert.equal(t.columns[0].label,'CODE');assert.equal(t.columns[0].maxLength,10);
  assert.equal(E.validateRows(t,[{CODE:''},{CODE:'X'}]).errors,0);
  b.sheets[0].rows[8][6]='X,';assert.equal(E.validateRows(S.parse(b),[{CODE:''},{CODE:'X'}]).errors,0);
});
test('single-sheet setup rejects typos, mixed layouts and mismatched SAP or General options', () => {
  for (const [change,pattern] of [
    [b=>b.sheets[0].rows[2][1]='other',/General or SAP/],
    [b=>b.sheets[0].rows[7][0]='Feld',/row 8/],
    [b=>b.sheets[0].rows[8][5]='maybe',/Required/],
    [b=>b.sheets[0].rows[8][3]='1.5',/whole number/],
    [b=>b.sheets[0].rows[8][4]=2,/SAP-only/],
    [b=>b.sheets.push({name:'Columns',rows:[]}),/either/],
    [b=>b.sheets[0].rows[8].push('unheaded'),/no column header/],
    [b=>b.sheets[0].rows[8][0]='',/Technical field/],
  ]) {const b=simple();change(b);assert.throws(()=>S.parse(b),pattern);}
  assert.throws(()=>S.parse(simple('SAP')),/SAP DDIC/);
  const b=simple('SAP',[['DATE','','DATS',8,0,'Yes','','email','','']]);assert.throws(()=>S.parse(b),/SAP format/);
});
test('advanced SAP setup reads additive DDIC columns and preserves numeric conditions', () => {
  const section=(name,records)=>({name,rows:[[...S.HEADERS[name]],...records.map(r=>S.HEADERS[name].map(h=>r[h]??''))]});
  const book={sheets:[section('Template',[{Name:'SAP advanced','Template type':'SAP','Format version':1}]),section('Columns',[{Field:'ID',Label:'ID','SAP type':'INT8','SAP length':19,'SAP decimals':0}]),section('Conditions',[{'Rule ID':'large',Part:'assert',Field:'ID',Operator:'gt',Value:'9007199254740992'}])]};
  const t=S.parse(book);assert.equal(t.mode,'sap');assert.equal(t.columns[0].sapType,'INT8');
  assert.equal(E.validateRows(t,[{ID:'9007199254740993'}]).errors,0);
  assert.equal(E.validateRows(t,[{ID:'9007199254740992'}]).errors,1);
});
test('200 fields round-trip setup, CSV, TSV and XLSX while 201 fields and excess cells are rejected', async () => {
  const b=simple('General',Array.from({length:200},(_,i)=>['FIELD_'+i,'Field '+i,'text','','','No','','','','']));
  const t=S.parse(b);assert.equal(t.columns.length,200);
  const headers=t.columns.map(c=>c.label),values=t.columns.map((c,i)=>String(i).padStart(5,'0'));
  for (const delimiter of [',','\t']) assert.equal(E.parseCSV([headers.join(delimiter),values.join(delimiter)].join('\n'))[0].length,200);
  const blob=await F.workbook([{name:'Data',rows:[headers,values]}]);
  const loaded=await F.read({name:'200.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()});
  assert.equal(loaded.sheets[0].rows[1][199],'00199');
  const mapped=E.mapRows(headers,[values],t,E.autoMap(headers,t));assert.equal(E.validateRows(t,mapped).errors,0);
  assert.equal(E.validateRows(t,Array.from({length:25000},()=>({}))).rows,25000);
  assert.throws(()=>E.validateRows(t,Array.from({length:25001},()=>({}))),/25,000 rows/);
  b.sheets[0].rows.push(['FIELD_200','','text']);assert.throws(()=>S.parse(b),/200 columns/);
  assert.throws(()=>E.parseCSV(Array.from({length:201},(_,i)=>'C'+i).join(',')),/200 upload columns/);
  assert.throws(()=>E.parseCSV([headers,...Array.from({length:25001},()=>values)].map(r=>r.join(',')).join('\n')),/5,000,000 data cells/);
  const tooWide=await F.workbook([{name:'Data',rows:[[...headers,'Field 200']]}]);
  await assert.rejects(F.read({name:'201.xlsx',size:tooWide.size,arrayBuffer:()=>tooWide.arrayBuffer()}),/200 columns/);
});
test('SAP data exports preserve internal dates, long integers and guide metadata', async () => {
  const t=sap('INT8');t.columns.push({...E.column(1),key:'DATE',label:'Date',sapType:'DATS'});
  const rows=[{VALUE:'9223372036854775807',DATE:'20261026'}];
  const blob=await F.report(t,rows,E.validateRows(t,rows));const out=await F.read({name:'sap-report.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()});
  assert.equal(out.sheets[0].rows[1][0],'9223372036854775807');assert.equal(out.sheets[0].rows[1][1],'20261026');
  t.columns[0].maxLength=1; // Inactive General settings must not appear as SAP upload limits.
  const template=await F.template(t),book=await F.read({name:'sap-data.xlsx',size:template.size,arrayBuffer:()=>template.arrayBuffer()});
  const guide=book.sheets.find(s=>s.name==='Field guide');assert.equal(guide.rows[1][2],'INT8');assert.ok(guide.rows[0].includes('SAP length'));
  assert.equal(guide.rows[1][5],'DDIC length 19; decimals 0');
});
