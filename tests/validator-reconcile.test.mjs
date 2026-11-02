import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';

const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const copy=v=>JSON.parse(JSON.stringify(v));
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const headers=['Material','Description','Plant','Storage Location','Extra'];
const originals=[
 ['6.00007','Water Pump','FF01, FF02, FF03','(FF01) QA00, QA01, (FF02,FF03) QA00','001'],
 ['000001','Another pump','FF01,FF02','QA00,QA01','=literal()'],
];
const exploded=[
 ['6.00007','Water Pump','FF01','QA00','001'],['6.00007','Water Pump','FF01','QA01','001'],
 ['6.00007','Water Pump','FF02','QA00','001'],['6.00007','Water Pump','FF03','QA00','001'],
 ['000001','Another pump','FF01','QA00','=literal()'],['000001','Another pump','FF02','QA01','=literal()'],
];

function fixture(t,{templates=false,writer,compare}={}){
 const dom=new JSDOM('<div id="view"></div><dialog id="modal"><div id="modalBody"></div></dialog>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test'}),w=dom.window,d=w.document;t.after(()=>w.close());
 Object.assign(w,{Blob,TextEncoder,TextDecoder,setImmediate,clearImmediate});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.confirm=()=>true;
 for(const f of ['vendor/jszip.min.js','vendor/ssf.js','validator-engine.js','validator-transform.js','validator-files.js','validator-compare-engine.js','validator-reconcile-engine.js'])w.eval(read(f));
 const E=w.WorkHubValidatorEngine,F=w.WorkHubValidatorFiles,C=w.WorkHubValidatorReconcileEngine;
 if(writer)w.WorkHubValidatorFiles={...F,workbook:writer};
 if(compare)w.WorkHubValidatorReconcileEngine={...C,compare};
 for(const f of ['validator-reconcile.js','validator-studio.js'])w.eval(read(f));
 let owner='owner',ready=true,writes=0,ui,state={projects:[],projectCompanies:[],workhub:{validator:{templates:templates?[E.example()]:[],runs:[]}}};
 const downloads=[],render=()=>{if(!ui.patchRender())d.getElementById('view').innerHTML=ui.render();};
 ui=w.WorkHubValidatorStudio.install({state:()=>state,owner:()=>owner,ready:()=>ready,render,tell:()=>{},
 mutate(fn){const next=E.copy(state);fn(next);E.prepare(next,state);E.validateState(next);state=next;writes++;render();return true;},
 openModal(title,body){d.getElementById('modalBody').innerHTML=body;d.getElementById('modal').showModal();},closeModal(){d.getElementById('modal').close();},download(blob,name){downloads.push({blob,name});}});render();
 const tool=ui.recombinedComparison,open=()=>ui.handle({dataset:{val:'mode',mode:'recombined'}});
 const file=(name,values,h=headers)=>{const csv=E.csv([h,...values]).replaceAll("'=literal()",'=literal()');return{name,size:csv.length,text:async()=>csv};};
 const upload=(side,values,h=headers)=>tool.loadFile(side,file(side+'.csv',values,h));
 const source=(values,h=headers,metadata={})=>({...C.sheet({sheets:[{name:'Data',rows:[h,...values],...metadata}]}),fileName:'file.csv'});
 const settings=(a,b)=>{const fields=C.autoFields(a,b);return{fields,relationship:C.autoRelationship(a,fields)};};
 const change=(selector,value)=>{const el=typeof selector==='string'?d.querySelector(selector):selector;assert.ok(el);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 return{w,d,E,F,C,ui,tool,open,upload,file,source,settings,change,downloads,writes:()=>writes,state:()=>state,account(next,active=true){owner=next;ready=active;ui.sync();render();}};
}

test('two independent uploads recombine without a template or validation run and show distinct comma values',async t=>{
 const x=fixture(t);await x.open();assert.ok(x.d.getElementById('vrcFileA'));assert.ok(x.d.getElementById('vrcFileB'));
 await x.upload('A',originals);await x.upload('B',exploded);const report=await x.tool.run();
 assert.equal(report.match,true);assert.equal(report.rows.length,2);assert.equal(report.bGroups,2);assert.equal(report.b.rows.length,6);
 assert.deepEqual(copy(report.rows[0].bValues),['6.00007','Water Pump','FF01, FF02, FF03','QA00, QA01','001']);
 assert.equal(x.d.querySelectorAll('[data-vrc-row]').length,2);assert.match(x.d.getElementById('vrcReport').textContent,/Water Pump/);
 assert.equal(x.writes(),0);assert.deepEqual(copy(x.state().workhub.validator),{templates:[],runs:[]});assert.equal(x.ui.snapshot().result,null);
});

test('description and storage differences are combined with commas and highlighted against File A',async t=>{
 const x=fixture(t),b=copy(exploded);b[1][1]='Water Pump Updated';b[1][3]='QA99';
 await x.open();await x.upload('A',originals);await x.upload('B',b);const r=await x.tool.run();
 assert.equal(r.different,1);assert.equal(r.matched,1);assert.equal(x.C.cell(r,0,1).b,'Water Pump, Water Pump Updated');
 assert.equal(x.C.cell(r,0,1).match,false);assert.equal(x.C.cell(r,0,0).match,true);
 assert.ok(x.d.querySelector('[data-vrc-row="0"] [data-vrc-cell="1"]').classList.contains('val-difference'));
 await x.tool.handle({dataset:{vrc:'detail',index:'0'}});assert.match(x.d.querySelector('.vrc-detail').textContent,/Water Pump Updated/);assert.match(x.d.querySelector('.vrc-detail').textContent,/QA99/);
});

test('crossed plant assignments fail even when the separate comma lists match; duplicate exploded rows add no new values',async t=>{
 const x=fixture(t),a=x.source([['001','Pump','P1,P2','S1,S2','']]),b=x.source([['001','Pump','P1','S2',''],['001','Pump','P2','S1','']]);
 const r=await x.C.compare(a,b,x.settings(a,b));assert.equal(r.match,false);assert.equal(r.rows[0].pair.missing.length,2);assert.equal(r.rows[0].pair.extra.length,2);assert.deepEqual(copy(r.rows[0].changed),[2,3]);
 const duplicate=x.source([...exploded,...exploded]),original=x.source(originals),same=await x.C.compare(original,duplicate,x.settings(original,duplicate));
 assert.equal(same.match,true);assert.equal(same.rows[0].bIndices.length,8);assert.equal(same.rows[0].bValues[3],'QA00, QA01');
});

test('ambiguous original keys never pick a material description; selecting an additional unchanged key resolves them',async t=>{
 const x=fixture(t),h=['Material','Source ID','Description','Plant','Storage Location'],a=x.source([['001','A','Alpha','P1,P2','S1,S2'],['001','B','Beta','P1','S1']],h),b=x.source([['001','B','Beta','P1','S1'],['001','A','Alpha','P1','S1'],['001','A','Alpha','P2','S2']],h),s=x.settings(a,b);
 let r=await x.C.compare(a,b,s);assert.equal(r.ambiguous,2);assert.ok(r.rows.every(row=>row.status==='Ambiguous key'));assert.equal(x.C.cell(r,0,2).hasB,false);assert.equal(x.C.cell(r,1,2).b,'');
 s.fields[1].key=true;r=await x.C.compare(a,b,s);assert.equal(r.match,true);assert.equal(x.C.cell(r,0,2).b,'Alpha');assert.equal(x.C.cell(r,1,2).b,'Beta');
});

test('record matching uses keys rather than row order and reports missing, extra and blank-key records explicitly',async t=>{
 const x=fixture(t),a=x.source([['001','Alpha','P1','S1',''],['002','Beta','P2','S2',''],['','No key','P0','S0','']]),b=x.source([['003','Extra','P3','S3',''],['001','Alpha','P1','S1',''],['','No key B','P0','S0','']]);
 const r=await x.C.compare(a,b,x.settings(a,b));assert.equal(r.matched,1);assert.equal(r.missing,1);assert.equal(r.extra,1);assert.equal(r.blankKeys,2);assert.equal(r.rows.length,5);
 assert.equal(x.C.cell(r,0,1).b,'Alpha');assert.equal(r.rows[1].status,'Missing record');assert.equal(r.rows[3].status,'Extra record');
});

test('matching keys, text, spaces, case and long identifiers are exact while chosen comma fields compare distinct values',async t=>{
 const x=fixture(t),a=x.source([['000001',' Pump ','P1, P2','S1,S2','12345678901234567890']]),b=x.source([['000001',' Pump ','P2','S2','12345678901234567890'],['000001',' Pump ','P1','S1','12345678901234567890']]);
 let r=await x.C.compare(a,b,x.settings(a,b));assert.equal(r.match,true);
 const textChange=x.source([['000001','pump','P1','S1','12345678901234567890'],['000001','pump','P2','S2','12345678901234567890']]);r=await x.C.compare(a,textChange,x.settings(a,textChange));assert.equal(x.C.cell(r,0,1).match,false);
 const changedKey=x.source([['1',' Pump ','P1','S1','12345678901234567890']]);r=await x.C.compare(a,changedKey,x.settings(a,changedKey));assert.equal(r.missing,1);assert.equal(r.extra,1);
});

test('column mapping handles reordered or renamed headers and rejects reused source columns or missing key mappings',async t=>{
 const x=fixture(t),a=x.source([['001','Pump','P1','S1','z']]),b=x.source([['P1','001','S1','Pump','z']],['Plant','Material','Storage Location','Description','Extra']),settings=x.settings(a,b);
 assert.equal((await x.C.compare(a,b,settings)).match,true);
 const bad=copy(settings);bad.fields[1].b=bad.fields[0].b;assert.throws(()=>x.C.configure(a,b,bad),/only once/);
 bad.fields[0].b=-1;assert.throws(()=>x.C.configure(a,b,bad),/matching key/);
 const missing=x.source([['001','Pump','P1','S1']],headers.slice(0,4)),m=x.settings(a,missing);assert.equal((await x.C.compare(a,missing,m)).differentFields,1);
 m.fields[4].include=false;assert.equal((await x.C.compare(a,missing,m)).match,true);
});

test('unsupported grouped assignments are flagged for review and never reported as matching pairings',async t=>{
 const x=fixture(t),a=x.source([['001','Pump','P1,P2','(P1) S1','']]),b=x.source([['001','Pump','P1','S1',''],['001','Pump','P2','S2','']]);
 const r=await x.C.compare(a,b,x.settings(a,b));assert.equal(r.rows[0].status,'Review assignments');assert.match(r.rows[0].pair.error,/Every parent/);assert.equal(x.C.cell(r,0,3).match,false);
});

test('disabling assignment checks still compares grouped values correctly and Exact text remains literal',async t=>{
 const x=fixture(t),a=x.source(originals),b=x.source(exploded),setup=x.settings(a,b);setup.relationship.enabled=false;
 assert.equal((await x.C.compare(a,b,setup)).match,true);
 const groupedB=x.source(originals);assert.equal((await x.C.compare(a,groupedB,setup)).match,true);
 setup.fields[2].include=false;assert.equal((await x.C.compare(a,b,setup)).match,true);
 setup.fields[3].mode='text';assert.equal((await x.C.compare(a,b,setup)).match,false);
 await x.open();await x.upload('A',originals);await x.upload('B',exploded);
 x.change('[data-vrc-field="include"][data-index="2"]',false);assert.equal(x.tool.snapshot().settings.relationship.enabled,false);assert.equal((await x.tool.run()).match,true);
});

test('the report has exactly Summary and Field Comparison and keeps full mismatches, assignments and formula-like text',async t=>{
 const x=fixture(t),b=copy(exploded);b[1][1]='Changed';b[1][3]='QA99';await x.open();await x.upload('A',originals);await x.upload('B',b);await x.tool.run();
 x.change('[data-vrc-filter]','different');await x.tool.exportReport();assert.equal(x.downloads.length,1);
 const{blob,name}=x.downloads[0],book=await x.F.read({name,size:blob.size,arrayBuffer:()=>blob.arrayBuffer()},{valuesOnly:true});
 assert.deepEqual(copy(book.sheets.map(s=>s.name)),['Summary','Field Comparison']);assert.equal(book.sheets[0].rows.length,3);assert.equal(book.sheets[1].rows.length,3);
 assert.ok(book.sheets[0].rows[2].some(v=>v.includes('QA99')));assert.ok(book.sheets[0].rows[2].some(v=>v.includes('Missing assignments:')));
 assert.ok(book.sheets[1].rows[2].some(v=>v==='=literal()'));assert.ok(book.sheets[1].rows[1].some(v=>v==='6.00007'));
 const zip=await x.w.JSZip.loadAsync(new x.w.Uint8Array(await blob.arrayBuffer()),{checkCRC32:true});
 for(const name of ['xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml']){const xml=await zip.file(name).async('string');assert.doesNotMatch(xml,/<f[ >]/);assert.match(xml,/s="2"/);}
});

test('long recombined values continue in the same two sheets without truncation, including CR and escaped-looking text',async t=>{
 const x=fixture(t),h=['Material','Description'],a=x.source([['001','Original']],h),b=x.source([['001','a'.repeat(20000)+'\r_x000D_'],['001','b'.repeat(20000)+'\n']],h),r=await x.C.compare(a,b,x.settings(a,b)),blob=await x.F.workbook(x.C.reportSheets(r)),book=await x.F.read({name:'long.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()},{valuesOnly:true});
 assert.equal(book.sheets.length,2);assert.equal(book.sheets[1].rows.length,3);
 const f=9+3+1,joined=book.sheets[1].rows.slice(1).map(row=>row[f]).join('');assert.equal(joined,x.C.cell(r,0,1).b);assert.match(joined,/_x000D_/);
 assert.equal(book.sheets[1].rows[1][7],'1/2');assert.equal(book.sheets[1].rows[2][7],'2/2');
});

test('continuation rows never split a Unicode surrogate pair at the Excel cell boundary',async t=>{
 const x=fixture(t),h=['Material','Description'],a=x.source([['001','Original']],h),b=x.source([['001','a'.repeat(16000)+'😀'],['001','b'.repeat(15995)+'😀']],h),r=await x.C.compare(a,b,x.settings(a,b)),blob=await x.F.workbook(x.C.reportSheets(r)),book=await x.F.read({name:'unicode.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()},{valuesOnly:true});
 const parts=book.sheets[1].rows.slice(1).map(row=>row[13]);assert.equal(parts.length,2);assert.equal(parts[0].length,31999);assert.equal(parts.join(''),x.C.cell(r,0,1).b);assert.ok(parts.every(v=>!v.includes('�')));
});

test('worksheet and header selection are independent and preserve numeric identifiers with Excel display metadata',async t=>{
 const x=fixture(t),blob=await x.F.workbook([{name:'Instructions',rows:[['Notes']]},{name:'Actual',rows:[['Title'],['Material','Description'],['6.00007','Pump']]}]),zip=await x.w.JSZip.loadAsync(new x.w.Uint8Array(await blob.arrayBuffer()));
 const path='xl/worksheets/sheet2.xml';zip.file(path,(await zip.file(path).async('string')).replace(/<c r="A3"[^>]*>.*?<\/c>/s,'<c r="A3" s="4"><v>6.0000699999999996</v></c>'));
 const bytes=await zip.generateAsync({type:'uint8array'});await x.open();await x.tool.loadFile('A',{name:'original.xlsx',size:bytes.length,arrayBuffer:async()=>bytes});
 x.change('[data-vrc-setting="sheetIndex"][data-side="A"]','1');x.change('[data-vrc-setting="headerRow"][data-side="A"]','2');
 await x.upload('B',[['6.00007','Pump']],['Material','Description']);const r=await x.tool.run();assert.equal(r.match,true);assert.equal(x.C.cell(r,0,0).a,'6.00007');assert.equal(r.a.headerRow,2);
});

test('saved formulas are read as values; a missing saved result stops that upload',async t=>{
 const x=fixture(t),base=await x.F.workbook([{name:'Data',rows:[['Material','Description'],['001','Pump']]}]),zip=await x.w.JSZip.loadAsync(new x.w.Uint8Array(await base.arrayBuffer())),path='xl/worksheets/sheet1.xml';
 zip.file(path,(await zip.file(path).async('string')).replace(/<c r="B2"[^>]*>.*?<\/c>/s,'<c r="B2" t="str"><f>_xlfn.XLOOKUP(A2,C:C,D:D)</f><v>Pump</v></c>'));
 let bytes=await zip.generateAsync({type:'uint8array'});await x.open();await x.upload('A',[['001','Pump']],['Material','Description']);await x.tool.loadFile('B',{name:'lookup.xlsx',size:bytes.length,arrayBuffer:async()=>bytes});assert.equal((await x.tool.run()).match,true);
 zip.file(path,(await zip.file(path).async('string')).replace('<v>Pump</v>',''));bytes=await zip.generateAsync({type:'uint8array'});await x.tool.loadFile('B',{name:'missing-cache.xlsx',size:bytes.length,arrayBuffer:async()=>bytes});assert.match(x.tool.snapshot().files.B.error,/without a saved result/);assert.equal(x.tool.snapshot().result,null);
});

test('XLS uses the existing saved-value worker route with cancellation support',async t=>{
 const x=fixture(t),calls=[];x.w.WorkHubValidatorXLS={read:async(file,opts)=>{calls.push({file,opts});return{sheets:[{name:'Legacy',rows:[headers,...exploded]}]};}};
 await x.open();await x.upload('A',originals);await x.tool.loadFile('B',{name:'legacy.xls',size:10});assert.equal((await x.tool.run()).match,true);assert.equal(calls.length,1);assert.equal(calls[0].opts.valuesOnly,true);assert.ok(calls[0].opts.signal);
});

test('replacement and clearing abort readers and late reads or exports cannot cross accounts',async t=>{
 const wait=defer(),writer=defer(),x=fixture(t,{writer:()=>writer.promise});await x.open();
 let signal;x.w.WorkHubValidatorXLS={read:(_f,opts)=>{signal=opts.signal;return wait.promise;}};
 const pending=x.tool.loadFile('A',{name:'slow.xls',size:10});await x.upload('A',originals);assert.equal(signal.aborted,true);wait.resolve({sheets:[{name:'Old',rows:[headers,...originals]}]});await pending;assert.equal(x.tool.snapshot().files.A.name,'A.csv');
 await x.upload('B',exploded);await x.tool.run();await x.tool.handle({dataset:{vrc:'detail',index:'0'}});
 const exported=x.tool.exportReport();x.account('other');writer.resolve(new Blob(['old']));await exported;
 assert.equal(x.downloads.length,0);assert.equal(x.tool.snapshot().files.A.name,'');assert.doesNotMatch(x.d.getElementById('modalBody').textContent,/Water Pump/);
});

test('changing mapping invalidates results and exports, while view filters only change the displayed records',async t=>{
 const x=fixture(t);await x.open();await x.upload('A',originals);await x.upload('B',exploded);await x.tool.run();x.change('[data-vrc-filter]','different');assert.equal(x.d.querySelectorAll('[data-vrc-row]').length,0);assert.ok(x.tool.snapshot().result);
 x.change('[data-vrc-field="include"][data-index="4"]',false);assert.equal(x.tool.snapshot().result,null);await assert.rejects(x.tool.exportReport(),/before exporting/);
 await x.tool.run();assert.equal(x.tool.snapshot().result.match,true);
});

test('standalone recombination leaves an existing validation session and history untouched',async t=>{
 const x=fixture(t,{templates:true});x.ui.loadSample();await x.ui.run();const before=copy(x.ui.snapshot()),writes=x.writes();
 await x.open();await x.upload('A',originals);await x.upload('B',exploded);await x.tool.run();
 const after=x.ui.snapshot();assert.deepEqual(copy(after.sourceRows),before.sourceRows);assert.deepEqual(copy(after.mapping),before.mapping);assert.deepEqual(copy(after.result),before.result);assert.equal(x.writes(),writes);
});

test('run and export permissions are checked independently and can cancel a pending run without losing its files',async t=>{
 const x=fixture(t);await x.open();x.w.WorkHubCurrentAccess={can:(_,action)=>action==='view'};await assert.rejects(x.upload('A',originals),/cannot recombine/);
 x.w.WorkHubCurrentAccess={can:()=>true};await x.upload('A',originals);await x.upload('B',exploded);await x.tool.run();x.w.WorkHubCurrentAccess={can:(_,action)=>action!=='export'};await assert.rejects(x.tool.exportReport(),/cannot export/);
 const a=x.source(Array.from({length:12000},(_,i)=>[String(i),'Pump','P1','S1',''])),b=x.source(Array.from({length:12000},(_,i)=>[String(i),'Pump','P1','S1','']));let stopped=false;
 await assert.rejects(x.C.compare(a,b,x.settings(a,b),{pause:async()=>{stopped=true;},cancelled:()=>stopped}),{name:'AbortError'});
});

test('12,000 originals and 24,000 separate exploded rows compare completely with distant discrepancies',async t=>{
 const x=fixture(t),a=x.source(Array.from({length:12000},(_,i)=>['000'+i,'Description '+i,'P1,P2','S1,S2',''])),b=x.source(Array.from({length:24000},(_,i)=>['000'+Math.floor(i/2),'Description '+Math.floor(i/2),i%2?'P2':'P1',i===23999?'DIFFERENT':i%2?'S2':'S1','']));
 const r=await x.C.compare(a,b,x.settings(a,b));assert.equal(r.rows.length,12000);assert.equal(r.matched,11999);assert.equal(r.different,1);assert.equal(x.C.cell(r,11999,1).b,'Description 11999');assert.equal(x.C.cell(r,11999,3).b,'S1, DIFFERENT');
});
