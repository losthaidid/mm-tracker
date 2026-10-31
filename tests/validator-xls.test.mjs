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
  for (const file of ['vendor/sheetjs/xlsx.full.min.js','vendor/ssf.js','validator-engine.js','validator-files.js','validator-xls-engine.js']) vm.runInContext(source(file), scope);
  const X = local.XLSX, F = w.WorkHubValidatorFiles, C = w.WorkHubValidatorCSV;
  function workbook(sheets, options = {}) {
    const book = X.utils.book_new();
    for (const s of sheets) X.utils.book_append_sheet(book, s.sheet, s.name);
    book.Workbook = { WBProps: { date1904: !!options.date1904 }, Sheets: sheets.map(s => ({ Hidden: s.hidden || 0 })) };
    return Buffer.from(X.write(book, { bookType: options.bookType || 'biff8', type: 'array', bookSST: options.bookType !== 'biff5' }));
  }
  const file = bytes => ({ name: 'legacy.xls', size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  const read = (bytes, options) => w.WorkHubValidatorXLS.read(file(bytes), options);
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

async function comparison(t) {
  const x=fixture(t);for(const name of ['validator-compare-engine.js','validator-compare.js'])x.w.eval(source(name));
  let owner='owner',ready=true,q,writes=0;const downloads=[],render=()=>{x.d.getElementById('view').innerHTML=q.render();};
  q=x.w.WorkHubValidatorCompare.install({owner:()=>owner,ready:()=>ready,render,mutate(){writes++;},download(blob,name){downloads.push({blob,name});}});render();
  const change=(selector,value)=>{const el=x.d.querySelector(selector);assert.ok(el,selector);if(el.type==='checkbox'||el.type==='radio')el.checked=value;else el.value=value;el.dispatchEvent(new x.w.Event('change',{bubbles:true}));};
  const upload=(side,bytes,name)=>q.loadFile(side,{...x.file(bytes),name});
  return {...x,q,downloads,render,change,upload,writes:()=>writes,account(name,active=true){owner=name;ready=active;q.sync();render();}};
}

test('XLS comparison uses the existing saved-value rules and agrees with equivalent XLSX cells',async t=>{
  const x=fixture(t),sheet=representative(x),xls=x.workbook([{name:'Data',sheet}]),xlsx=x.workbook([{name:'Data',sheet}],{bookType:'xlsx'});
  const a=await x.read(xls,{valuesOnly:true}),b=await x.F.read({...x.file(xlsx),name:'same.xlsx'},{valuesOnly:true});
  assert.deepEqual(copy(a.sheets),copy(b.sheets));
  assert.deepEqual(copy(a.sheets[0].rows[1]),['000007','  µL 界 😀, "quoted"\r\nnext  ','0.125','2024-01-01','false','000002','']);
  assert.equal(x.workers[0].packet.valuesOnly,true);
  assert.equal((await x.read(xls)).sheets[0].rows[1][2],'12.50%','CSV display mode stays unchanged');
});

test('both comparison uploads accept XLS, mixed formats retain exclusions and reports keep exact values',async t=>{
  const x=await comparison(t),a=x.aoa([['Skip','Code','Value','Note'],['left','001','7','  µL  '],['left','002','8','same']]),b=x.aoa([['Metadata','Other','ID','Amount','Description'],['right','meta','001','7','  µL  '],['right','meta','002','8','same']]);
  const ax=x.workbook([{name:'Data',sheet:a}]),bx=x.workbook([{name:'Data',sheet:b}],{bookType:'xlsx'});
  for(const id of ['vfcFileA','vfcFileB','vfcQueueA','vfcQueueB'])assert.match(x.d.getElementById(id).accept,/\.xls,/);
  await x.upload('A',ax,'original.xls');await x.upload('B',bx,'output.xlsx');x.change('[name="vfcCountA"]','1');x.change('[name="vfcCountB"]','2');await x.q.run();assert.equal(x.q.snapshot().result.match,true);
  x.change('[data-vfc-setting="mode"][data-side="A"][value="checkboxes"]',true);x.change('[data-vfc-skip="0"][data-side="A"]',true);
  b.D3={t:'s',v:'9'};await x.upload('B',x.workbook([{name:'Data',sheet:b}]),'changed.xls');x.change('[name="vfcCountB"]','2');await x.q.run();
  const r=x.q.snapshot().result;assert.equal(r.differentCells,1);assert.equal(r.differentRows,1);assert.deepEqual(copy(x.w.WorkHubValidatorCompareEngine.cell(r,1,1)),{a:'8',b:'9',hasA:true,hasB:true,match:false});
  await x.q.exportReport();const report=await x.F.read({...x.file(Buffer.from(await x.downloads[0].blob.arrayBuffer())),name:'report.xlsx'},{valuesOnly:true});
  assert.deepEqual(copy(report.sheets.map(s=>s.name)),['Summary','Field Comparison']);assert.equal(report.sheets[0].rows[2][6],'8');assert.equal(report.sheets[0].rows[2][11],'9');assert.equal(report.sheets[1].rows[1][4],'001');
  assert.equal(x.writes(),0);assert.equal(x.w.XLSX,undefined);
});

test('mixed XLS/XLSX comparison queues keep each pair, compressed setups and two-sheet reports independent',async t=>{
  const x=await comparison(t);
  const make=(i,side,type)=>{const data=side==='A'?[['Skip','ID'],['meta','00'+i]]:[['Code'],[i===2?'DIFFERENT':'00'+i]];return {...x.file(x.workbook([{name:'Data',sheet:x.aoa(data)}],{bookType:type==='xls'?'biff8':'xlsx'})),name:side+i+'.'+type};};
  await x.q.addFiles('A',[make(1,'A','xls'),make(2,'A','xlsx'),make(3,'A','xls')]);await x.q.addFiles('B',[make(1,'B','xlsx'),make(2,'B','xls'),make(3,'B','xls')]);
  const ids=x.q.snapshot().queue.map(p=>p.id);for(const id of ids){await x.q.openPair(id);x.change('[name="vfcCountA"]','1');x.q.confirmPair();}
  await x.q.startQueue();assert.deepEqual(copy(x.q.snapshot().queue.map(p=>p.summary.match)),[true,false,true]);
  await x.q.openPair(ids[0]);assert.equal(x.d.querySelector('[name="vfcCountA"]').value,'1');assert.equal(x.q.snapshot().result.a.fileName,'A1.xls');await x.q.exportAll();
  const zip=await x.w.JSZip.loadAsync(new x.w.Uint8Array(await x.downloads[0].blob.arrayBuffer()),{checkCRC32:true});assert.equal(Object.keys(zip.files).length,3);
  for(const [i,entry] of Object.values(zip.files).entries()){const bytes=await entry.async('uint8array'),book=await x.F.read({...x.file(bytes),name:'pair.xlsx'},{valuesOnly:true});assert.deepEqual(copy(book.sheets.map(s=>s.name)),['Summary','Field Comparison']);assert.equal(book.sheets[0].rows[1][0],i===1?'Not match':'Match');}
  assert.equal(x.q.snapshot().activePairId,ids[0]);assert.equal(x.writes(),0);
});

test('XLS reads terminate on replacement, clearing and account changes, and late results stay discarded',async t=>{
  const x=await comparison(t),bytes=x.workbook([{name:'Data',sheet:x.aoa([['ID'],['PRIVATE']])}]),held=[];
  x.w.Worker=class{constructor(){held.push(this);}postMessage(packet){this.packet=packet;}terminate(){this.stopped=true;}};
  const first=x.upload('A',bytes,'private.xls');await new Promise(r=>setImmediate(r));
  await x.q.loadFile('A',{name:'current.csv',size:10,text:async()=> 'ID\n001'});assert.equal(held[0].stopped,true);held[0].onmessage({data:{result:{sheets:[{name:'Late',rows:[['ID'],['PRIVATE']]}]}}});await first;assert.equal(x.q.snapshot().files.A.name,'current.csv');
  const pending=x.upload('B',bytes,'clear.xls');await new Promise(r=>setImmediate(r));await x.q.handle({dataset:{vfc:'clear'}});await pending;assert.equal(held[1].stopped,true);assert.equal(x.q.snapshot().files.B.name,'');
  const other=x.upload('A',bytes,'account.xls');await new Promise(r=>setImmediate(r));x.account('other');await other;assert.equal(held[2].stopped,true);assert.doesNotMatch(x.d.body.textContent,/PRIVATE|account.xls/);
  const count=held.length;x.w.WorkHubCurrentAccess={can:(feature,action)=>action!=='run'};await assert.rejects(x.upload('A',bytes,'denied.xls'),/permission/);assert.equal(held.length,count);
});

test('XLS comparison retains raw hidden values and enforces comparison capacity while CSV display checks stay strict',async t=>{
  const x=fixture(t),hidden=x.aoa([['Value'],[7]]);hidden.A2.z=';;;';const bytes=x.workbook([{name:'Data',sheet:hidden}]);
  assert.equal((await x.read(bytes,{valuesOnly:true})).sheets[0].rows[1][0],'7');await assert.rejects(x.read(bytes),/nonblank value hidden/);
  const wide=x.aoa([Array.from({length:201},(_,i)=>'F'+i),Array.from({length:201},()=> '001')]),w=x.workbook([{name:'Data',sheet:wide}]);
  await assert.rejects(x.read(w,{valuesOnly:true}),/200 columns/);assert.equal((await x.read(w)).sheets[0].width,201);
});

test('mixed comparisons and both report sheets preserve escaped line breaks and literal OOXML-like text',async t=>{
  const x=await comparison(t),value='001\r\nµL _x0041_\u000Btail',a=x.aoa([['Value'],[value]]),b=x.aoa([['Label'],['different']]);
  await x.upload('A',x.workbook([{name:'Data',sheet:a}]),'source.xls');await x.upload('B',x.workbook([{name:'Data',sheet:b}],{bookType:'xlsx'}),'target.xlsx');await x.q.run();await x.q.exportReport();
  const bytes=Buffer.from(await x.downloads[0].blob.arrayBuffer()),book=await x.F.read({...x.file(bytes),name:'report.xlsx'},{valuesOnly:true});
  assert.equal(book.sheets[0].rows[2][6],value);assert.equal(book.sheets[1].rows[1][4],value);
});
