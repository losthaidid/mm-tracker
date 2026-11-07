import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
function fixture(t) {
  const dom = new JSDOM('<body><div id="view"></div></body>', {runScripts:'outside-only',url:'https://example.test/',pretendToBeVisual:true});
  t.after(() => dom.window.close());
  const w=dom.window,d=w.document; Object.assign(w,{Blob,TextEncoder,TextDecoder,setImmediate,clearImmediate});
  for (const file of ['vendor/jszip.min.js','vendor/ssf.js','validator-engine.js','validator-files.js','vendor/sheetjs/xlsx.full.min.js','project-golive-engine.js','project-golive-files.js','project-golive.js']) w.eval(source(file));
  let data={activeProjectId:'p',projects:[{id:'p',name:'Launch A'},{id:'q',name:'Launch B'}],workhub:{preferences:{workspace:'My WorkHub'}}};
  let owner='one',ready=true,edit=true,exportable=true,downloads=[];
  w.WorkHubCurrentAccess={can:(_,action)=>action==='edit'?edit:action==='export'?exportable:true};
  w.WorkHubDialogs={confirm:async()=>true};
  const api={state:()=>data,ready:()=>ready,owner:()=>owner,tell(){},download(blob,name,type){downloads.push({blob,name,type});},mutate(fn){const next=copy(data);fn(next);w.WorkHubGoLiveIssuesEngine.validate(next);data=next;render();return true;}};
  const ui=w.WorkHubGoLiveIssues.install(api);
  function render(){d.getElementById('view').innerHTML=ui.render(data.activeProjectId);}
  function input(id,value,type='input'){const el=d.getElementById(id);el.value=value;el.dispatchEvent(new w.Event(type,{bubbles:true}));}
  function file(bytes,name='source.xlsx'){const b=new Uint8Array(bytes);return {name,size:b.byteLength,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};}
  render();
  return {w,d,ui,input,file,render,downloads,state:()=>data,setOwner(v){owner=v;ui.sync();render();},setProject(v){data.activeProjectId=v;ui.sync();render();},setEdit(v){edit=v;render();},setExport(v){exportable=v;render();}};
}

test('Go-Live imports map columns, preserve leading zeros, duplicate extras and skip empty rows explicitly', t=>{
  const {w}=fixture(t), E=w.WorkHubGoLiveIssuesEngine;
  const sheet={rows:[['Issue ID','Issue','Status','Area','Area'],['0007','Orders fail','Open','Sales','North'],[],['0008','Payment delayed','In progress','Finance','South']]};
  const cols=E.columns(sheet,1),mapping=E.suggest(cols);let n=0;
  const result=E.importRows(sheet,1,mapping,()=>String(++n));
  assert.equal(result.records[0].reference,'0007');
  assert.deepEqual(copy(result.records[0].extras),[{header:'Area',value:'Sales'},{header:'Area',value:'North'}]);
  assert.deepEqual(copy(result.emptyRows),[3]);
  E.validate({projects:[{goLiveIssues:result.records}]});
  assert.deepEqual(copy(E.metrics(result.records)),{total:2,open:1,progress:1,resolved:0,other:0});
  assert.throws(()=>E.importRows({rows:[['Issue','Status'],['','Open']]},1,{...E.suggest(E.columns({rows:[['Issue','Status'],['','Open']]},1))},()=>String(++n)),/source row 2/);
  assert.throws(()=>E.importRows(sheet,1,{...mapping,status:mapping.title},()=>String(++n)),/only be mapped once/);
  const list=E.textSheet('The client cannot log in, even after reset\nMissing documents','auto');
  assert.deepEqual(copy(list.rows),[['Issue'],['The client cannot log in, even after reset'],['Missing documents']]);
  const table=E.textSheet('Issue\tStatus\nFirst\tOpen','auto');assert.equal(table.rows[1][1],'Open');
});

test('Go-Live manual entry and paste import stay in their project, support edits and export complete Excel data', async t=>{
  const x=fixture(t),{w,d,ui,input}=x;
  await ui.handle({dataset:{gli:'new'}});
  input('gliEdit-title','Cannot submit order');input('gliEdit-reference','0001');input('gliEdit-status','Open');input('gliEdit-owner','Aisyah');
  d.getElementById('gliIssueForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(x.state().projects[0].goLiveIssues[0].title,'Cannot submit order');
  await ui.handle({dataset:{gli:'open-import'}});
  input('gliPaste','Issue\tStatus\tPlant\tPlant\nLabel mismatch\tIn progress\t0007\tWest\nConnection slow\tClosed\t0008\tEast');
  await ui.handle({dataset:{gli:'preview-paste'}});
  assert.match(d.getElementById('gliWorkspace').textContent,/Review before import/i);
  await ui.handle({dataset:{gli:'commit-import'}});
  assert.equal(x.state().projects[0].goLiveIssues.length,3);
  assert.equal(x.state().projects[1].goLiveIssues,undefined);
  assert.equal(x.state().projects[0].goLiveIssues[1].extras[0].value,'0007');
  input('gliQuery','label');
  await ui.handle({dataset:{gli:'export-excel'}});
  assert.equal(x.downloads.length,1);assert.match(x.downloads[0].name,/\.xlsx$/);
  const bytes=new Uint8Array(await x.downloads[0].blob.arrayBuffer());
  const saved=await w.WorkHubValidatorFiles.read(x.file(bytes,'out.xlsx'),{displayValues:true});
  assert.deepEqual(copy(saved.sheets.map(s=>s.name)),['Overview','Issue details']);
  assert.deepEqual(copy(saved.sheets[1].rows[0].slice(-2)),['Extra · Plant','Extra · Plant (2)']);
  assert.deepEqual(copy(saved.sheets[1].rows[1].slice(-2)),['0007','West']);
  assert.equal(saved.sheets[1].rows.length,2);
  x.setProject('q');assert.equal(ui.snapshot().count,0);assert.doesNotMatch(d.getElementById('gliWorkspace').textContent,/Label mismatch/);
  x.setProject('p');assert.equal(ui.snapshot().count,3);
  x.setEdit(false);assert.equal(d.querySelector('[data-gli="new"]'),null);
  await assert.rejects(ui.handle({dataset:{gli:'new'}}),/cannot edit/);
  x.setExport(false);await assert.rejects(ui.handle({dataset:{gli:'export-excel'}}),/cannot export/);
  x.setOwner('other');assert.equal(ui.snapshot().owner,'other');
});

test('Go-Live reads formatted Excel and stores unmapped columns without altering the source', async t=>{
  const x=fixture(t),{w,ui}=x, book=w.XLSX.utils.book_new();
  const sheet=w.XLSX.utils.aoa_to_sheet([['ID','Issue','Status','Location'],[7,'Login problem','Open','HQ']]);sheet.A2.z='000000';
  w.XLSX.utils.book_append_sheet(book,sheet,'Issues');
  await ui.loadFile(x.file(w.XLSX.write(book,{bookType:'xlsx',type:'array'})));
  assert.equal(ui.snapshot().sourceName,'source.xlsx');
  await ui.handle({dataset:{gli:'commit-import'}});
  const issue=x.state().projects[0].goLiveIssues[0];
  assert.equal(issue.reference,'000007');assert.equal(issue.title,'Login problem');assert.deepEqual(copy(issue.extras),[{header:'Location',value:'HQ'}]);
});

test('Go-Live reads a text file as issue lines and rejects stale imports after a project change', async t=>{
  const x=fixture(t),{ui}=x;
  await ui.loadFile({name:'issues.txt',size:40,text:async()=> 'First issue, with a comma\nSecond issue'});
  await ui.handle({dataset:{gli:'commit-import'}});
  assert.equal(x.state().projects[0].goLiveIssues[0].title,'First issue, with a comma');
  assert.equal(x.state().projects[0].goLiveIssues.length,2);
  let finish;
  const pending=ui.loadFile({name:'delayed.txt',size:10,text:()=>new Promise(resolve=>{finish=resolve;})});
  x.setProject('q');finish('Private issue');
  await assert.rejects(pending,/switching projects/);
  assert.equal(x.state().projects[1].goLiveIssues,undefined);
  assert.doesNotMatch(x.d.body.textContent,/Private issue/);
});
