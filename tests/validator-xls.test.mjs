import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const copy = v => JSON.parse(JSON.stringify(v));
const vendor = source('vendor/sheetjs/xlsx.full.min.js');
function fixture(t, studio = false) {
  const dom = new JSDOM('<div id="view"></div>', { url: 'https://example.test/workhub/', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document;
  Object.assign(w, { Blob, TextEncoder, TextDecoder, setImmediate, clearImmediate });
  for (const file of ['vendor/jszip.min.js','vendor/ssf.js','validator-engine.js','validator-files.js','validator-xls.js','validator-csv.js']) w.eval(source(file));
  // Independent worker realm also proves that the binary parser is never
  // loaded into the application's window or given a persistence adapter.
  const workers = [];
  w.Worker = class {
    constructor(url) {
      assert.equal(new URL(url).pathname, '/workhub/validator-xls-worker.js');
      const self = { console, Blob, TextEncoder, TextDecoder, Uint8Array, DataView };
      this.self = self; workers.push(this);
      self.self = self;
      self.postMessage = value => queueMicrotask(() => this.onmessage?.({ data: structuredClone(value) }));
      this.scope = vm.createContext(self);
      self.importScripts = (...urls) => { for (const url of urls) vm.runInContext(source(url.split('?')[0].replace(/^\.\//,'')), this.scope); };
      vm.runInContext(source('validator-xls-worker.js'), this.scope);
    }
    postMessage(packet, transfers) {
      assert.equal(transfers.length, 1); assert.strictEqual(transfers[0], packet.buffer);
      this.packet = structuredClone(packet);
      queueMicrotask(() => { if (!this.stopped) this.self.onmessage({ data: this.packet }); });
    }
    terminate() { this.stopped = true; }
  };
  const local = { console, Uint8Array, DataView }; local.self = local; local.window = local;
  const scope = vm.createContext(local);
  for (const file of ['vendor/sheetjs/xlsx.full.min.js','vendor/ssf.js','validator-files.js','validator-xls-engine.js']) vm.runInContext(source(file), scope);
  const X = local.XLSX, F = w.WorkHubValidatorFiles, C = w.WorkHubValidatorCSV;
  function workbook(sheets, options = {}) {
    const book = X.utils.book_new();
    for (const s of sheets) X.utils.book_append_sheet(book, s.sheet, s.name);
    book.Workbook = { WBProps: { date1904: !!options.date1904 }, Sheets: sheets.map(s => ({ Hidden: s.hidden || 0 })) };
    return Buffer.from(X.write(book, { bookType: options.bookType || 'biff8', type: 'array', bookSST: options.bookType !== 'biff5' }));
  }
  const file = bytes => ({ name: 'legacy.xls', size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  const read = bytes => w.WorkHubValidatorXLS.read(file(bytes));
  function rewrite(bytes, change) {
    const cfb = X.CFB.read(bytes, { type: 'array' }), entry = X.CFB.find(cfb, '/Workbook') || X.CFB.find(cfb, '/Book');
    const replaced = Buffer.from(change(Buffer.from(entry.content)));
    X.CFB.utils.cfb_add(cfb, entry.name, replaced);
    return Buffer.from(X.CFB.write(cfb, { type: 'array' }));
  }
  const records = bytes => {
    const list = [];
    for (let p = 0; p + 4 <= bytes.length;) { const type = bytes.readUInt16LE(p), size = bytes.readUInt16LE(p + 2); if (!type && !size) break; list.push({ type, size, start: p, p: p + 4, end: p + 4 + size }); p += size + 4; }
    return list;
  };
  const aoa = rows => X.utils.aoa_to_sheet(rows);
  return { w,d,X,F,C,workers,local,workbook,file,read,rewrite,records,aoa,engine: local.WorkHubValidatorXLSEngine };
}
function representative(x) {
  const sheet = x.aoa([['Code','Text','Percent','Date','Flag','Formula','Blank'], [7,'  µL 界 😀, "quoted"\r\nnext  ',.125,45292,false,2,''], ['123456789012345678901',' literal =1+1 ',0,0,true,0,'']]);
  Object.assign(sheet.A2,{z:'000000'}); sheet.C2.z='0.00%'; sheet.D2.z='yyyy-mm-dd';
  Object.assign(sheet.F2,{f:'2',bf:[3,0,0x1e,2,0],z:'000000'});
  sheet.G5={t:'z'}; sheet['!ref']='A1:G5';
  return sheet;
}
async function parsedCSV(blob) {
  const result = spawnSync('python3',['-c','import csv,sys,json,io;print(json.dumps(list(csv.reader(io.StringIO(sys.stdin.buffer.read().decode("utf-8-sig"),newline=""))),ensure_ascii=False))'],{input:Buffer.from(await blob.arrayBuffer()),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr); return JSON.parse(result.stdout);
}

test('real BIFF8 XLS values, formats, formula caches and explicit blanks survive a verified CSV in an isolated worker', async t => {
  const x=fixture(t), sheet=representative(x), bytes=x.workbook([{name:'Original',sheet}]), before=Buffer.from(bytes), book=await x.read(bytes);
  assert.equal(x.w.XLSX,undefined); assert.equal(x.workers.length,1); assert.equal(x.workers[0].stopped,true);
  assert.deepEqual(copy(book.sheets[0].rows),[
    ['Code','Text','Percent','Date','Flag','Formula','Blank'],
    ['000007','  µL 界 😀, "quoted"\r\nnext  ','12.50%','2024-01-01','FALSE','000002',''],
    ['123456789012345678901',' literal =1+1 ','0','0','TRUE','0',''],
    ['','','','','','',''],['','','','','','',''],
  ]);
  assert.equal(book.sheets[0].notes.formulas,1);
  assert.deepEqual(await parsedCSV((await x.C.prepare(book,[0],'legacy.xls')).blob),copy(book.sheets[0].rows));
  assert.deepEqual(bytes,before);
  const independently=spawnSync('python3',['-c','import xlrd,sys,json;b=xlrd.open_workbook(file_contents=sys.stdin.buffer.read(),formatting_info=True);s=b.sheet_by_index(0);print(json.dumps({"rows":s.nrows,"code":s.cell_value(1,0),"text":s.cell_value(1,1),"formula_result":s.cell_value(1,5),"code_format":b.format_map[b.xf_list[s.cell_xf_index(1,0)].format_key].format_str}))'],{input:bytes,encoding:'utf8'});
  assert.equal(independently.status,0,independently.stderr); const independent=JSON.parse(independently.stdout);
  assert.equal(independent.code,7); assert.equal(independent.formula_result,2); assert.equal(independent.code_format,'000000'); assert.equal(independent.text,book.sheets[0].rows[1][1]);
});

test('BIFF5 XLS codepages and the 1904 date system preserve readable non-ASCII text and date values', async t => {
  const x=fixture(t), sheet=x.aoa([['Code','Text','Date'],[7,'Café µL',0]]); sheet.A2.z='000000'; sheet.C2.z='yyyy-mm-dd';
  // The library's BIFF5 writer emits ASCII only. Insert genuine CP1252 source
  // bytes so this tests decoding existing Excel files rather than that writer.
  const bytes=x.rewrite(x.workbook([{name:'Legacy',sheet}],{bookType:'biff5',date1904:true}),s=>{const label=x.records(s).find(r=>r.type===0x204 && s.readUInt16LE(r.p)===1 && s.readUInt16LE(r.p+2)===1);Buffer.from('Café µL','latin1').copy(s,label.p+8);return s;});
  const book=await x.read(bytes);
  assert.deepEqual(copy(book.sheets[0].rows[1]),['000007','Café µL','1904-01-01']);
});

test('worksheet order, hidden sheets and distinct original/exploded records stay separate in a verified ZIP', async t => {
  const x=fixture(t), original=x.aoa([['ID','Plant'],['0007','P1,P2']]), exploded=x.aoa([['ID','Plant'],['0007','P1'],['0007','P2']]);
  const bytes=x.workbook([{name:'Original',sheet:original},{name:'Exploded',sheet:exploded,hidden:1}]);
  // Reorder directory records without moving physical sheet streams.
  const reordered=x.rewrite(bytes,stream=>{const bounds=x.records(stream).filter(r=>r.type===0x85); const a=Buffer.from(stream.subarray(bounds[0].start,bounds[0].end)),b=Buffer.from(stream.subarray(bounds[1].start,bounds[1].end)); return Buffer.concat([stream.subarray(0,bounds[0].start),b,a,stream.subarray(bounds[1].end)]);});
  const book=await x.read(reordered); assert.deepEqual(copy(book.sheets.map(s=>s.name)),['Exploded','Original']); assert.equal(book.sheets[0].state,'hidden');
  assert.deepEqual(copy(book.sheets[0].rows[2]),['0007','P2']);
  const output=await x.C.prepare(book,[0,1],'records.xls'), zip=await x.w.JSZip.loadAsync(new x.w.Uint8Array(await output.blob.arrayBuffer()),{checkCRC32:true});
  assert.deepEqual(Object.keys(zip.files),['records-Exploded.csv','records-Original.csv']);
  for(const [i,entry] of Object.values(zip.files).entries()) assert.deepEqual(await parsedCSV(new Blob([await entry.async('uint8array')])),copy(book.sheets[i].rows));
});

test('saved XLS formula strings, empty strings, booleans and errors remain cached values', async t=>{
  const x=fixture(t), sheet=x.aoa([[2]]); Object.assign(sheet.A1,{f:'2',bf:[3,0,0x1e,2,0]}); const base=x.workbook([{name:'Formula',sheet}]);
  for(const [tag,value,expected] of [[3,0,''],[1,0,'FALSE'],[1,1,'TRUE'],[2,42,'#N/A']]) {
    const patched=x.rewrite(base,s=>{const f=x.records(s).find(r=>r.type===6);s.fill(0,f.p+6,f.p+14);s[f.p+6]=tag;s[f.p+8]=value;s.writeUInt16LE(65535,f.p+12);return s;});
    assert.equal((await x.read(patched)).sheets[0].rows[0][0],expected);
  }
  const string=x.rewrite(base,s=>{const f=x.records(s).find(r=>r.type===6);s.fill(0,f.p+6,f.p+14);s.writeUInt16LE(65535,f.p+12);const text=Buffer.from('0007 µL','utf16le'),r=Buffer.alloc(7);r.writeUInt16LE(0x207,0);r.writeUInt16LE(text.length+3,2);r.writeUInt16LE(text.length/2,4);r[6]=1;return Buffer.concat([s.subarray(0,f.end),r,text,s.subarray(f.end)]);});
  assert.equal((await x.read(string)).sheets[0].rows[0][0],'0007 µL');
  const missing=x.rewrite(base,s=>{const f=x.records(s).find(r=>r.type===6);s.fill(0,f.p+6,f.p+14);s.writeUInt16LE(65535,f.p+12);return s;});
  await assert.rejects(x.read(missing),/no saved string result/);
});

test('XLS files fail clearly for incomplete streams, duplicate cells, protection, unsupported displays and renamed text', async t=>{
  const x=fixture(t), sheet=x.aoa([[7]]);sheet.A1.z='000000';const base=x.workbook([{name:'Values',sheet}]);
  const record=(type,payload)=>{const b=Buffer.alloc(4+payload.length);b.writeUInt16LE(type,0);b.writeUInt16LE(payload.length,2);payload.copy(b,4);return b;};
  for(const [type,payload,pattern] of [[0x1b0,Buffer.alloc(0),/conditional formatting/],[0x2f,Buffer.alloc(2),/password-protected/]]) {
    const bad=x.rewrite(base,s=>{const eof=x.records(s).at(-1);return Buffer.concat([s.subarray(0,eof.start),record(type,payload),s.subarray(eof.start)]);}); await assert.rejects(x.read(bad),pattern);
  }
  const duplicate=x.rewrite(base,s=>{const value=x.records(s).find(r=>[0x203,0x27e].includes(r.type));return Buffer.concat([s.subarray(0,value.end),s.subarray(value.start,value.end),s.subarray(value.end)]);});await assert.rejects(x.read(duplicate),/duplicate cell/);
  const truncated=x.rewrite(base,s=>s.subarray(0,x.records(s).at(-1).start));await assert.rejects(x.read(truncated),/incomplete|unsupported structure/);
  const hidden=x.aoa([[7]]);hidden.A1.z=';;;';await assert.rejects(x.read(x.workbook([{name:'Hidden',sheet:hidden}])),/nonblank value hidden/);
  const locale=x.aoa([[45292]]);locale.A1.z='[$-407]dddd, dd mmmm yyyy';await assert.rejects(x.read(x.workbook([{name:'Locale',sheet:locale}])),/locale-dependent/);
  await assert.rejects(x.read(Buffer.from('<html><table><tr><td>0007</td></tr></table></html>')),/not a binary Excel workbook/);
});

test('large XLS imports include 10,001 rows and the final identifier without truncation', {timeout:30000}, async t=>{
  const x=fixture(t), rows=Array.from({length:10001},(_,r)=>[String(r).padStart(8,'0'),'Value '+r]), bytes=x.workbook([{name:'Large',sheet:x.aoa(rows)}]), book=await x.read(bytes);
  assert.equal(book.sheets[0].rows.length,10001);assert.deepEqual(copy(book.sheets[0].rows.at(-1)),['00010000','Value 10000']);
  const out=await x.C.prepare(book,[0],'large.xls');assert.equal(out.cells,20002);assert.deepEqual((await parsedCSV(out.blob)).at(-1),rows.at(-1));
});

test('XLS reader cancels in-flight workers, ignores late results and reports unavailable worker support', async t=>{
  const x=fixture(t), bytes=x.workbook([{name:'Values',sheet:x.aoa([['private']])}]), workers=[];
  x.w.Worker=class {constructor(){workers.push(this);}postMessage(p){this.packet=p;}terminate(){this.stopped=true;}};
  const controller=new x.w.AbortController(),pending=x.w.WorkHubValidatorXLS.read(x.file(bytes),{signal:controller.signal}), rejected=assert.rejects(pending,{name:'AbortError'});
  await new Promise(r=>setImmediate(r));controller.abort();await rejected;assert.equal(workers[0].stopped,true);workers[0].onmessage({data:{result:{sheets:[{name:'late'}]}}});
  const next=x.w.WorkHubValidatorXLS.read(x.file(bytes)), stopped=assert.rejects(next,{name:'AbortError'});await new Promise(r=>setImmediate(r));x.w.dispatchEvent(new x.w.Event('pagehide'));await stopped;
  delete x.w.Worker;await assert.rejects(x.read(bytes),/background XLS reader/);
});

test('the existing CSV workspace routes XLS through the worker and XLSX through its existing reader without account writes', async t=>{
  const x=fixture(t),downloads=[];let owner='one',ui,writes=0;
  const render=()=>{x.d.getElementById('view').innerHTML=ui.render();};
  ui=x.C.install({owner:()=>owner,ready:()=>true,render,mutate(){writes++;},tell(){},download(blob,name){downloads.push({blob,name});}});render();
  assert.equal(x.d.getElementById('valCSVFile').accept,'.xls,.xlsx');
  const bytes=x.workbook([{name:'Values',sheet:representative(x)}]);await ui.loadFile(x.file(bytes));await ui.convert();ui.download();
  assert.match(downloads[0].name,/legacy-Values.csv$/);assert.equal((await parsedCSV(downloads[0].blob))[1][0],'000007');
  assert.equal(writes,0);owner='two';ui.sync();assert.equal(ui.snapshot().ready,null);assert.deepEqual(copy(ui.snapshot().sheets),[]);
  x.w.WorkHubCurrentAccess={can:(feature,action)=>action!=='run'};await assert.rejects(ui.loadFile(x.file(bytes)),/cannot run/);
  assert.equal(vendor.includes('0.20.3'),true);
});
