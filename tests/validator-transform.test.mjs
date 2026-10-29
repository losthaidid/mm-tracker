import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test,after} from 'node:test';
import {JSDOM} from 'jsdom';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;
w.eval(read('validator-engine.js'));w.eval(read('validator-transform.js'));
after(()=>w.close());
const E=w.WorkHubValidatorEngine,T=w.WorkHubValidatorTransform,copy=x=>JSON.parse(JSON.stringify(x));
function schema(type='NUMC',length=2){const s=E.create('SAP preparation');s.mode='sap';s.columns=[{...E.column(),key:'CODE',label:'Code',sapType:type,sapLength:length}];return s;}

test('SAP preparation pads only eligible fields, preserves blanks and rejects lossy guesses',()=>{
 const s=schema(),rows=[['2'],['02'],[''],[' 3 '],['123'],['2.0'],['2e2'],['-2'],['A2']],before=copy(rows);
 const p=T.sap(['Code'],rows,s,{CODE:0});assert.deepEqual(copy(p.rows),[['02'],['02'],[''],['03'],['123'],['2.0'],['2e2'],['-2'],['A2']]);assert.equal(p.changes,2);assert.equal(p.warningCount,5);assert.deepEqual(rows,before);
 const c=schema('CHAR',2);assert.equal(T.sap(['Code'],[['2']],c,{CODE:0}).rows[0][0],'2');assert.equal(T.sap(['Code'],[['2']],c,{CODE:0},{CODE:'zero'}).rows[0][0],'02');assert.equal(T.sap(['Code'],[['A']],c,{CODE:0},{CODE:'zero'}).rows[0][0],'A');
 assert.equal(T.sap(['Code'],[['2']],s,{CODE:0},{CODE:'keep'}).changes,0);s.mode='general';assert.throws(()=>T.sap(['Code'],[['2']],s,{CODE:0}),/SAP template/);
});
test('SAP preparation converts unambiguous dates and times without rounding, domain guesses or precision loss',()=>{
 const dates=T.sap(['Code'],[['2024-02-29'],['2026-02-29'],['01/02/2026'],['00000000']],schema('DATS',8),{CODE:0});assert.deepEqual(copy(dates.rows),[['20240229'],['2026-02-29'],['01/02/2026'],['00000000']]);
 const times=T.sap(['Code'],[['09:30'],['23:59:59'],['24:00']],schema('TIMS',6),{CODE:0});assert.deepEqual(copy(times.rows),[['093000'],['235959'],['24:00']]);
 const dec=schema('DEC',5);dec.columns[0].sapDecimals=2;assert.equal(T.sap(['Code'],[['1.234']],dec,{CODE:0}).rows[0][0],'1.234');
 const bigint=schema('INT8',19);assert.equal(T.sap(['Code'],[['9223372036854775807']],bigint,{CODE:0}).rows[0][0],'9223372036854775807');
});
test('Explode pairs lists by position and copies every unselected column without changing input',()=>{
 const headers=['Material','Plant','Storage','Extra'],rows=[['000001','FF01, FF02, FF03','ST00, WH00, WH01','=1+1']],before=copy(rows);
 const p=T.explode(headers,rows,{primary:1,mapped:[2]});assert.deepEqual(copy(p.rows),[['000001','FF01','ST00','=1+1'],['000001','FF02','WH00','=1+1'],['000001','FF03','WH01','=1+1']]);assert.equal(p.outputCount,3);assert.deepEqual(copy(p.parents),[{index:0,part:'1'},{index:0,part:'2'},{index:0,part:'3'}]);assert.deepEqual(rows,before);
});
test('Explode retains blank positions and requires explicit single-value repetition',()=>{
 let p=T.explode(['Plant','Storage'],[['FF01,,FF03,','ST00,WH00,WH01,']],{primary:0,mapped:[1]});assert.deepEqual(copy(p.rows),[['FF01','ST00'],['','WH00'],['FF03','WH01'],['','']]);
 p=T.explode(['Plant','Storage'],[['FF01,FF02,FF03','ST00,WH00']],{primary:0,mapped:[1]});assert.equal(p.blocked,true);assert.equal(p.rows.length,0);assert.equal(p.warningCount,1);
 assert.equal(T.explode(['Plant','Storage'],[['FF01,FF02','ST00']],{primary:0,mapped:[1]}).blocked,true);
 p=T.explode(['Plant','Storage'],[['FF01,FF02','ST00']],{primary:0,mapped:[1],repeatSingle:true});assert.deepEqual(copy(p.rows),[['FF01','ST00'],['FF02','ST00']]);
 p=T.explode(['Plant','Storage'],[['FF01,FF02','']],{primary:0,mapped:[1],repeatSingle:true});assert.deepEqual(copy(p.rows),[['FF01',''],['FF02','']]);
});
test('Explode supports literal delimiters, multiple mapped columns and preflights size limits',()=>{
 const p=T.explode(['A','B','C'],[['a||b','x||y','1||2']],{primary:0,mapped:[1,2],delimiter:'||'});assert.deepEqual(copy(p.rows),[['a','x','1'],['b','y','2']]);
 assert.throws(()=>T.explode(['A'],[['a,b']],{primary:0,mapped:[0]}),/distinct/);assert.throws(()=>T.explode(['A'],[['a,b']],{primary:0,delimiter:''}),/delimiter/);
 assert.throws(()=>T.explode(['A'],Array.from({length:2501},()=>['a,b']),{primary:0}),/5,000 rows/);
 const headers=Array.from({length:200},(_,i)=>'C'+i),rows=Array.from({length:501},()=>headers.map((h,i)=>i?'x':'a,b'));
 assert.throws(()=>T.explode(headers,rows,{primary:0}),/200,000 cells/);
});

async function fixture(t, csv='Availability Check,Plant,Storage Location,Extra\n2,"FF01, FF02, FF03","ST00, WH00, WH01",=1+1') {
 const dom=new JSDOM('<div id="view"></div><dialog id="modal"><div id="modalBody"></div></dialog>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test'}),w=dom.window,d=w.document;t.after(()=>w.close());
 Object.assign(w,{TextEncoder,TextDecoder,Blob,setImmediate,clearImmediate});let account='owner',ready=true,writes=0,downloads=[];
 w.setTimeout=(fn,ms)=>{if(ms===50)queueMicrotask(fn);return 0;};w.clearTimeout=()=>{};w.confirm=()=>true;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const f of ['vendor/jszip.min.js','validator-engine.js','validator-transform.js','validator-files.js','validator-studio.js'])w.eval(read(f));
 const E=w.WorkHubValidatorEngine,s=E.create('Prepared material');s.mode='sap';s.columns=[{...E.column(0),key:'AVAIL',label:'Availability Check',type:'integer',sapType:'CHAR',sapLength:2,values:'02'},...['Plant','Storage Location'].map((name,i)=>({...E.column(i+1),key:i?'STORAGE':'PLANT',label:name,sapType:'CHAR',sapLength:4}))];
 let state={projects:[],projectCompanies:[],workhub:{validator:{templates:[s],runs:[]}}},ui;
 const render=()=>{if(!ui.patchRender())d.getElementById('view').innerHTML=ui.render();};
 ui=w.WorkHubValidatorStudio.install({state:()=>state,owner:()=>account,ready:()=>ready,render,tell:()=>{},mutate(fn){const next=E.copy(state);fn(next);E.prepare(next,state);E.validateState(next);state=next;writes++;render();return true;},openModal(title,body){d.getElementById('modalBody').innerHTML=body;d.getElementById('modal').showModal();},closeModal(){d.getElementById('modal').close();},download(blob,name,type){downloads.push({blob,name,type});}});
 render();await ui.loadFile({name:'materials.csv',size:csv.length,text:async()=>csv});
 const preview=()=>d.getElementById('valPreparationForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const explode=()=>{ui.openPreparation('explode');const f=d.getElementById('valPreparationForm');f.elements.primary.value='1';f.elements.primary.dispatchEvent(new w.Event('change',{bubbles:true}));f.querySelector('[name="mapped"][value="2"]').checked=true;preview();};
 const pad=()=>{ui.openPreparation('sap');d.querySelector('[data-prep-mode="AVAIL"]').value='zero';preview();};
 return {w,d,ui,E,F:w.WorkHubValidatorFiles,preview,explode,pad,render,state:()=>state,writes:()=>writes,downloads,account(value){account=value;ui.sync();},ready(value){ready=value;},};
}
test('Preparation UI previews without writes, validates all paired rows, and exports exact codes plus unmapped values',async t=>{
 const x=await fixture(t),{ui,d,F}=x,before=x.writes(),root=d.querySelector('.validation-studio');x.explode();assert.equal(ui.snapshot().sourceRows.length,1);assert.match(d.getElementById('valPreparationPreview').textContent,/1 records → 3 records/);ui.applyPreparation();assert.equal(d.querySelector('.validation-studio'),root);assert.equal(ui.snapshot().sourceRows.length,3);assert.equal(x.writes(),before);assert.equal(ui.snapshot().result,null);
 x.pad();ui.applyPreparation();assert.equal(x.writes(),before);assert.ok(ui.snapshot().sourceRows.every(r=>r[0]==='02'));await ui.run();assert.equal(ui.snapshot().result.errors,0);assert.equal(ui.snapshot().result.rows,3);assert.doesNotMatch(JSON.stringify(x.state()),/=1\+1|FF01/);
 await ui.handle({dataset:{val:'accepted'}});const blob=x.downloads[0].blob,book=await F.read({name:'prepared.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()});assert.equal(book.sheets[0].rows[1][0],'02');assert.equal(book.sheets[0].rows.length,4);assert.deepEqual(copy(book.sheets.find(s=>s.name==='Prepared upload').rows.slice(1)),[['02','FF01','ST00','=1+1'],['02','FF02','WH00','=1+1'],['02','FF03','WH01','=1+1']]);
 const xml=await (await x.w.JSZip.loadAsync(new x.w.Uint8Array(await blob.arrayBuffer()))).file('xl/worksheets/sheet1.xml').async('string');assert.match(xml,/t="inlineStr"[^>]*>.*?02/s);assert.doesNotMatch(xml,/<f[ >]/);const origins=book.sheets.find(s=>s.name==='Row origins').rows;assert.equal(origins[3][3],'2');assert.equal(origins[3][4],'3');
});
test('Preparation undo and restore keep the original upload and invalidate previous results',async t=>{
 const x=await fixture(t),{ui}=x;x.explode();ui.applyPreparation();x.pad();ui.applyPreparation();await ui.run();ui.undoPreparation();assert.equal(ui.snapshot().sourceRows.length,3);assert.equal(ui.snapshot().sourceRows[0][0],'2');assert.equal(ui.snapshot().result,null);ui.undoPreparation();assert.equal(ui.snapshot().sourceRows.length,1);assert.match(ui.snapshot().sourceRows[0][1],/FF01, FF02/);assert.equal(ui.snapshot().undoCount,0);
 x.explode();ui.applyPreparation();ui.undoPreparation(true);assert.equal(ui.snapshot().sourceRows.length,1);assert.equal(ui.snapshot().preparations.length,0);
});
test('Preparation option edits retain controls and require a fresh preview; count mismatches block Apply',async t=>{
 const x=await fixture(t),{ui,d,w}=x;x.pad();const select=d.querySelector('[data-prep-mode="AVAIL"]');select.focus();select.value='keep';select.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(d.querySelector('[data-prep-mode="AVAIL"]'),select);assert.equal(d.activeElement,select);assert.equal(d.querySelector('[data-val="prep-apply"]').disabled,true);assert.throws(()=>ui.applyPreparation(),/Preview/);
 const y=await fixture(t,'Availability Check,Plant,Storage Location,Extra\n2,"FF01,FF02,FF03","ST00,WH00",keep');y.explode();assert.match(y.d.getElementById('valPreparationPreview').textContent,/mismatch/);assert.equal(y.d.querySelector('[data-val="prep-apply"]').disabled,true);assert.throws(()=>y.ui.applyPreparation(),/Preview/);assert.equal(y.ui.snapshot().sourceRows.length,1);
});
test('Preparations require Run permission but do not need template edit permission',async t=>{
 const x=await fixture(t),{ui,w}=x;ui.saveDraft(true);w.WorkHubCurrentAccess={can:()=>false};assert.throws(()=>ui.openPreparation('sap'),/disabled/);w.WorkHubCurrentAccess={can:(id,action)=>action!=='edit'};x.explode();ui.applyPreparation();x.pad();ui.applyPreparation();const before=x.writes();await ui.run();assert.equal(ui.snapshot().result.errors,0);assert.equal(x.writes(),before+1);assert.equal(x.state().workhub.validator.templates[0].columns[0].type,'integer');
});
test('A new upload or account wipes preparation previews, undo and uploaded values; late exports cannot cross accounts',async t=>{
 const x=await fixture(t),{ui,d,w}=x;x.explode();await ui.loadFile({name:'new.csv',size:44,text:async()=> 'Availability Check,Plant,Storage Location,Extra\n02,FF01,ST00,new'});assert.equal(d.getElementById('modal').open,false);assert.throws(()=>ui.applyPreparation(),/context changed/);assert.equal(ui.snapshot().sourceRows[0][3],'new');assert.equal(ui.snapshot().undoCount,0);
 await ui.run();const pending=ui.handle({dataset:{val:'report'}});x.account('different-owner');await pending;assert.equal(x.downloads.length,0);assert.equal(ui.snapshot().sourceRows.length,0);assert.equal(ui.snapshot().undoCount,0);assert.doesNotMatch(d.getElementById('modalBody').textContent,/FF01|ST00/);
});
