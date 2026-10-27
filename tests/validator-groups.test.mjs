import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test,after} from 'node:test';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;
w.Blob=Blob;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.setImmediate=setImmediate;w.clearImmediate=clearImmediate;
w.eval(readFileSync(new URL('../vendor/jszip.min.js',import.meta.url),'utf8'));
for(const file of ['validator-engine.js','validator-files.js'])w.eval(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const E=w.WorkHubValidatorEngine,F=w.WorkHubValidatorFiles,copy=x=>JSON.parse(JSON.stringify(x));
after(()=>w.close());
function template(){
 const t=E.create('Sales area');t.mode='sap';
 t.columns=[['VKORG','Sales organization','CHAR',4],['VTWEG','Distribution channel','NUMC',2],['SPART','Division','NUMC',2],['MAKTX','Description','CHAR',40]].map(([key,label,sapType,sapLength],i)=>({...E.column(i),key,label,sapType,sapLength:String(sapLength)}));
 t.columnGroups=[{id:'sales',name:'Sales area',fields:['VKORG','VTWEG','SPART'],sets:[{id:'fpso',name:'FPSO setup',values:{VKORG:'FPSO',VTWEG:'60,50',SPART:'00'}},{id:'abco',name:'Another setup',values:{VKORG:'ABCO',VTWEG:'10,20',SPART:'01'}}]}];
 for(const id of ['fpso','abco']) {const r=E.rule('VTWEG');r.id='channel-'+id;r.name=id+' channels';r.when.conditions=[{...E.condition('VKORG'),valueSource:'group',groupId:'sales',valueSetId:id}];r.assertion={...E.condition('VTWEG'),operator:'in',valueSource:'group',groupId:'sales',valueSetId:id};t.rules.push(r);}
 return t;
}
const row=(values={})=>({VKORG:'FPSO',VTWEG:'60',SPART:'00',MAKTX:'A material',...values});
test('SAP column groups: conditions choose independent saved sets while shared SAP checks remain enabled',()=>{
 const t=template(),before=copy(t),data=[row(),row({VTWEG:'50'}),row({VTWEG:'10'}),row({VKORG:'ABCO',VTWEG:'10',SPART:'01'}),row({MAKTX:'x'.repeat(41)})],r=E.validateRows(t,data);
 assert.equal(r.errors,2);assert.equal(r.passed,3);assert.deepEqual(copy(t),before);assert.match(E.describe(t.rules[0].assertion,t),/60,50.*Sales area.*FPSO setup/);
 t.columnGroups[0].sets[1].values.VTWEG='30,40';assert.equal(E.validateRows(t,[row()]).errors,0);assert.equal(E.validateRows(t,[row({VKORG:'ABCO',VTWEG:'10'})]).errors,1);
});
test('SAP column groups: saved values obey SAP type, leading zeros and field references',()=>{
 const t=template();assert.equal(E.validateRows(t,[row({VTWEG:'5'})]).errors,2);
 for(const alter of [x=>x.columnGroups[0].sets[0].values.VTWEG='A0',x=>x.columnGroups[0].fields.push('MISSING'),x=>x.columnGroups[0].sets.push(copy(x.columnGroups[0].sets[0])),x=>x.columnGroups[0].sets[0].values.EXTRA='x',x=>x.rules[0].assertion.valueSetId='missing',x=>x.rules[0].assertion.field='MAKTX',x=>x.rules[0].assertion.operator='pattern']){const x=template();alter(x);assert.throws(()=>E.checkSchema(x),/group|Value set|values|value set/i);}
 assert.deepEqual(copy(E.suggestions(t,row({VTWEG:'wrong'}),'VTWEG').choices.map(c=>c.value)),['50','60']);
});
test('SAP column groups: company scope still determines which set-backed rules apply',()=>{
 const t=template();t.projectId='p';t.projectName='Rollout';for(const r of t.rules){r.when=E.group();r.companyScope='selected';r.companies=[{id:r.id.endsWith('fpso')?'a':'b',name:r.id}];}
 const context=id=>({projectId:'p',projectName:'Rollout',companyId:id,companyName:id});
 assert.equal(E.validateRows(t,[row()],context('a')).errors,0);assert.equal(E.validateRows(t,[row()],context('b')).errors,1);assert.deepEqual(copy(E.suggestions(t,row({VTWEG:'wrong'}),'VTWEG','',context('b')).choices.map(c=>c.value)),['10','20']);
});
test('SAP column groups: copying conditions brings independent sets and rejects incomplete destination fields atomically',()=>{
 const source=template(),target=E.create('Destination');target.mode='sap';target.columns=copy(source.columns);const before=copy(target),next=E.copyConditions(source,target,source.rules.map(r=>r.id),{companyScope:'all'});
 assert.equal(next.columnGroups.length,1);assert.notEqual(next.columnGroups[0].id,'sales');assert.equal(next.rules[0].assertion.groupId,next.columnGroups[0].id);assert.equal(E.validateRows(next,[row()]).errors,0);
 next.columnGroups[0].sets[0].values.VTWEG='70';assert.equal(source.columnGroups[0].sets[0].values.VTWEG,'60,50');assert.deepEqual(copy(target),before);
 target.columns=target.columns.filter(c=>c.key!=='SPART');assert.throws(()=>E.copyConditions(source,target,[source.rules[0].id],{}),/technical field SPART/);assert.equal(target.columnGroups.length,0);
 const independent=E.copyTemplate(source,'Independent',{});independent.columnGroups[0].sets[0].values.VTWEG='80';assert.equal(source.columnGroups[0].sets[0].values.VTWEG,'60,50');
});
test('SAP column groups: published values remain frozen and export definitions include readable set choices',async()=>{
 const t=template();t.releases=[{version:1,publishedAt:'2026-10-27',schema:E.schema(t)}];const previous={workhub:{validator:{templates:[t],runs:[]}}},next=copy(previous);next.workhub.validator.templates[0].columnGroups[0].sets[0].values.VTWEG='70';E.prepare(next,previous);
 next.workhub.validator.templates[0].releases[0].schema.columnGroups[0].sets[0].values.VTWEG='80';assert.throws(()=>E.prepare(next,previous),/frozen/);
 const blob=await F.template(t),read=await F.read({name:'data.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()});assert.equal(read.sheets.find(s=>s.name==='Column groups').rows[2][3],'60,50');assert.match(read.sheets.find(s=>s.name==='Conditions').rows[1][3],/FPSO setup/);
});
test('issue review: ignores are exact, reversible and never change source data or raw error counts',()=>{
 const t=template(),rows=[row({VTWEG:'10'}),row({VTWEG:'11'})],raw=E.validateRows(t,rows),before=copy(raw),decisions=new Map([[E.issueKey(raw.issues[0]),{row:JSON.stringify(rows[0]),reason:'Agreed exception'}]]),result=E.reviewIssues(raw,rows,decisions);
 assert.equal(result.errors,1);assert.equal(result.ignored,1);assert.equal(result.passed,1);assert.equal(result.clean,0);assert.equal(result.issues[0].ignoreReason,'Agreed exception');assert.deepEqual(copy(raw),before);assert.equal(rows[0].VTWEG,'10');
 assert.equal(E.reviewIssues(raw,rows,new Map()).errors,2);const changed=copy(rows);changed[0].MAKTX='Changed context';assert.equal(E.reviewIssues(E.validateRows(t,changed),changed,decisions).ignored,0);
});
test('issue review: ignored errors remain visibly documented in both issue and accepted exports',async()=>{
 const t=template(),rows=[row({VTWEG:'10'}),row({VTWEG:'11'})],raw=E.validateRows(t,rows),result=E.reviewIssues(raw,rows,new Map([[E.issueKey(raw.issues[0]),{row:JSON.stringify(rows[0]),reason:'=APPROVED()'}]]));
 for(const accepted of [false,true]){const blob=await F.report(t,rows,result,accepted),read=await F.read({name:'review.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()}),ignored=read.sheets.find(s=>s.name==='Ignored issues');assert.equal(ignored.rows[1][7],'=APPROVED()');assert.equal(read.sheets[0].rows.length,accepted?2:3);assert.equal(read.sheets.find(s=>s.name==='Run details').rows.find(r=>r[0]==='Ignored issues')[1],'1');if(!accepted)assert.equal(read.sheets.find(s=>s.name==='Issues').rows[1][7],'Ignored');const zip=await w.JSZip.loadAsync(new w.Uint8Array(await blob.arrayBuffer()));for(const path of Object.keys(zip.files).filter(p=>p.startsWith('xl/worksheets/')&&p.endsWith('.xml')))assert.ok(!(await zip.file(path).async('string')).includes('<f>'));}
});
