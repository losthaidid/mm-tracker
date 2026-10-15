import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
process.env.TZ='Asia/Kuala_Lumpur';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

async function app(t,{storage={},rpcError=null,remote=null,login=true}={}){
 const dom=new JSDOM(html,{url:'https://losthaidid.github.io/mm-tracker/',runScripts:'outside-only',pretendToBeVisual:true});
 const {window}=dom;
 t.after(()=>window.close());
 window.TextEncoder=TextEncoder;window.TextDecoder=TextDecoder;window.Blob=Blob;
 window.setTimeout=()=>0;window.setInterval=()=>0;
 window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 window.confirm=()=>true;
 for(const [key,value]of Object.entries(storage))window.localStorage.setItem(key,value);
 const db={row:remote,calls:[],error:rpcError,read:null,selects:[]};
 const client={
  auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  from:()=>({select:columns=>{db.selects.push(columns);return{eq:()=>({maybeSingle:async()=>db.read?db.read():({data:copy(db.row),error:null})})};}}),
  rpc:async(name,args)=>{
   db.calls.push({name,args:copy(args)});
   if(db.error)return{data:null,error:db.error};
   if(db.row?.mutation_id===args.p_mutation_id)return{data:[{revision:db.row.revision,mutation_id:db.row.mutation_id}],error:null};
   if((db.row?.revision||0)!==args.p_expected_revision)return{data:null,error:{code:'PT409',message:'Another device saved newer records.'}};
   db.row={document:copy(args.p_document),revision:(db.row?.revision||0)+1,mutation_id:args.p_mutation_id,updated_at:new Date().toISOString()};
   return{data:[{revision:db.row.revision,mutation_id:db.row.mutation_id,updated_at:db.row.updated_at}],error:null};
  }
 };
 window.MMTrackerSupabase={createClient:()=>client};
 for(const file of ['sync-merge.js','studio.js'])window.eval(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
 const script=[...window.document.scripts].find(script=>script.textContent.includes("'use strict'"));
 window.eval(script.textContent+`\nwindow.api={
  hub,queueCloudReview,state:()=>state,steps:()=>STEPS,cloud,KEY,payload,parseBackup,emptyState,validate,mutate,loadCloud,flushCloud,refreshCloud,retryCloud,closeModal,
  openMMAreaManager,saveMMAreas,editMMAreaDraft,canonicalArea,summarizeGovernanceRows,
  renderProjectCompanies,editCompany,saveCompany,editProcess,saveProcess,editProject,saveProject,
  browserMigrationAction,notice,action,projectMMAreas,editRecord,saveEdit,editSubItem,saveSubItem,openSubItems,editTaskSub,saveTaskSub,openRangeEditor,saveRange,scheduleEntries,viewBooking,workhubAction,workhubChange,rangeSegments,rangeTimes,editPlan,savePlan,reportModel,reportDashboard,exportReport,scheduleMonthMetrics,formatDuration,
  showTab(value){tab=value;render();},showProjectItems(){tab='specs';projectView='items';render();},setMonth(value){month=value;},
  login(){cloud.user={id:'11111111-1111-4111-8111-111111111111',email:'owner@example.com'};cloud.ready=true;cloud.key='mm-tracker.cloud.v1:'+cloudConfig.project+':'+cloud.user.id;cloud.status='Saved to Supabase';persistCloudCache();notice();render();},
  showCompanies(){tab='specs';projectView='companies';render();}
 };`);
 await settle();
 if(login)window.api.login();
 return{window,document:window.document,api:window.api,db};
}

function addCompany(api,document,name='Farms'){
 api.editCompany();const form=document.getElementById('companyForm');
 form.elements.namedItem('name').value=name;api.saveCompany(form);
}
function addProcess(api,document,{area='Procurement',item='Purchase order',code='PO-001'}={}){
 api.editProcess();const form=document.getElementById('processForm');
 form.elements.namedItem('area').value=area;form.elements.namedItem('item').value=item;form.elements.namedItem('code').value=code;
 api.saveProcess(form);
}
function areaRow(document,name){return[...document.querySelectorAll('[data-area-id]')].find(row=>row.querySelector('[data-area-name]').value===name);}

function addMainTask(api,document,title='Main deliverable'){
 api.editRecord('tasks');const form=document.getElementById('editForm');form.elements.namedItem('task').value=title;api.saveEdit(form);return api.state().tasks.at(-1).id;
}
function addTaskSub(api,document,parent,title,remarks,feedback,status='Not started'){
 api.editTaskSub(parent);const form=document.getElementById('taskSubForm');
 for(const [name,value]of Object.entries({title,remarks,feedback,status}))form.elements.namedItem(name).value=value;
 api.saveTaskSub(form);return api.state().tasks.find(task=>task.id===parent).subTasks.at(-1).id;
}
function addBooking(api,document,start,end,{date='2026-10-16',endDate=date,text='Focused work'}={}){
 api.openRangeEditor(date,start,'',true);const form=document.getElementById('scheduleForm');
 form.elements.namedItem('endDate').value=endDate;form.elements.namedItem('endTime').value=end;form.elements.namedItem('text').value=text;api.saveRange(form);
}

test('project sub-item remarks persist through editing, cloud saving and backup restore',async t=>{
 const {api,document,db}=await app(t);api.editRecord('specs');let form=document.getElementById('editForm');form.elements.namedItem('description').value='Project deliverable';api.saveEdit(form);await settle();
 const parent=api.state().specs[0].id;api.editSubItem(parent);form=document.getElementById('subItemForm');
 form.elements.namedItem('title').value='Confirm requirements';form.elements.namedItem('remarks').value='Discuss with owner\nKeep the signed copy';api.saveSubItem(form);await settle();
 const child=api.state().specs[0].subItems[0];assert.equal(child.remarks,'Discuss with owner\nKeep the signed copy');
 assert.match(document.getElementById('modalBody').textContent,/Keep the signed copy/);
 api.editSubItem(parent,child.id);assert.equal(document.getElementById('subItemForm').elements.namedItem('remarks').value,child.remarks);
 assert.equal(api.parseBackup(JSON.stringify(db.row.document)).specs[0].subItems[0].remarks,child.remarks);
 api.showProjectItems();assert.equal(document.querySelector('#view .workspace-v10'),null);
});

test('each sub-task has its own status, remarks and feedback and keeps the main title',async t=>{
 const {api,document,window}=await app(t),parent=addMainTask(api,document,'Roll out the MM process');await settle();
 const first=addTaskSub(api,document,parent,'Review blueprint','First notes','First feedback','In Progress');await settle();
 addTaskSub(api,document,parent,'Run UAT','Second notes','Second feedback','Blocked');await settle();
 const other=addMainTask(api,document,'Another main task');await settle();
 assert.equal(api.state().tasks.find(task=>task.id===other).subTasks.length,0);
 api.editTaskSub(parent,first);assert.match(document.getElementById('modalBody').textContent,/Roll out the MM process/);
 let form=document.getElementById('taskSubForm');form.elements.namedItem('feedback').value='First feedback changed';form.elements.namedItem('status').value='Completed';api.saveTaskSub(form);await settle();
 api.editRecord('tasks',parent);form=document.getElementById('editForm');form.elements.namedItem('task').value='MM rollout main title';api.saveEdit(form);await settle();
 const children=api.state().tasks.find(task=>task.id===parent).subTasks;assert.equal(children[0].status,'Completed');assert.equal(children[1].status,'Blocked');assert.equal(children[1].feedback,'Second feedback');
 api.showTab('tasks');assert.match(document.getElementById('view').textContent,/MM rollout main title/);
 const search=document.getElementById('tasksSearch');search.value='Second feedback';search.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(document.querySelectorAll('.task-main-card').length,1);
});

test('minute bookings have exact durations, open read-only, and edit only after Edit',async t=>{
 const {api,document}=await app(t);addBooking(api,document,'09:15','10:45');await settle();
 assert.deepEqual(copy(api.state().schedule).map(row=>[row.time,row.endTime]),[['09:15','10:00'],['10:00','10:45']]);
 assert.equal(api.scheduleEntries('2026-10-16')[0].hours,1.5);
 api.viewBooking('2026-10-16','10:00');assert.equal(document.getElementById('scheduleForm'),null);assert.equal(document.querySelectorAll('#modalBody textarea').length,0);assert.match(document.getElementById('modalBody').textContent,/09:15–10:45/);
 await api.action(document.querySelector('[data-action="edit-booking"]'));const form=document.getElementById('scheduleForm');assert.ok(form);assert.equal(form.elements.namedItem('time').value,'09:15');assert.equal(form.elements.namedItem('endTime').value,'10:45');
 form.elements.namedItem('endTime').value='11:05';api.saveRange(form);await settle();assert.equal(api.scheduleEntries('2026-10-16')[0].endTime,'11:05');assert.equal(api.state().schedule.length,3);
});

test('overlap checks use minutes and allow back-to-back bookings',async t=>{
 const {api,document}=await app(t);addBooking(api,document,'09:15','09:45');await settle();addBooking(api,document,'09:45','10:15');await settle();
 assert.equal(api.scheduleEntries('2026-10-16').length,2);const before=copy(api.state().schedule);
 assert.throws(()=>addBooking(api,document,'09:35','09:40'),/overlaps/);assert.deepEqual(copy(api.state().schedule),before);
});

test('midnight, arbitrary minutes and quick durations work without rounding',async t=>{
 const {api,document}=await app(t);addBooking(api,document,'00:05','00:22');await settle();addBooking(api,document,'23:45','24:00');await settle();
 assert.equal(api.scheduleEntries('2026-10-16')[0].hours,17/60);assert.equal(api.scheduleEntries('2026-10-16')[1].hours,0.25);
 api.openRangeEditor('2026-10-17','23:45','',true);api.workhubAction(document.querySelector('[data-action="booking-duration"][data-minutes="60"]'));
 assert.equal(document.getElementById('scheduleForm').elements.namedItem('endTime').value,'24:00');assert.equal(document.getElementById('bookingMidnight').checked,true);
 assert.throws(()=>api.rangeSegments('10:15','10:15'),/after/);assert.throws(()=>api.rangeSegments('09:80','10:00'),/valid time/);
 api.setMonth('2026-10');assert.equal(api.scheduleMonthMetrics().hours,0.53);
});

test('project plans and schedule preserve precise multi-day ranges and weekend TOIL',async t=>{
 const {api,document}=await app(t);api.editPlan();const form=document.getElementById('planForm');
 for(const [name,value]of Object.entries({title:'Project workshop',date:'2026-10-16',endDate:'2026-10-17',time:'09:20',endTime:'10:05'}))form.elements.namedItem(name).value=value;
 api.savePlan(form);await settle();assert.equal(api.state().schedule.length,4);assert.equal(api.state().projectPlans[0].endTime,'10:05');
 assert.equal(api.scheduleEntries('2026-10-17')[0].hours,0.75);api.setMonth('2026-10');assert.equal(api.scheduleMonthMetrics().toil,0.75);
 const restored=api.parseBackup(api.payload(api.state()));assert.deepEqual(copy(restored.schedule),copy(api.state().schedule));
});

test('legacy hourly bookings and main tasks upgrade without losing data',async t=>{
 const {api,document}=await app(t);addMainTask(api,document);await settle();const data=copy(api.state());delete data.tasks[0].subTasks;
 data.schedule=['09:00','10:00'].map(time=>({date:'2026-10-16',time,text:'Legacy booking',kind:'custom',linkId:'',activity:'',location:'',bookingId:'legacy',planId:''}));
 const restored=api.parseBackup(JSON.stringify({app:'mm-ticket-tracker',version:7,data}));assert.equal(restored.tasks[0].subTasks.length,0);assert.deepEqual(copy(restored.schedule).map(row=>row.endTime),['10:00','11:00']);assert.equal(restored.schedule[0].text,'Legacy booking');
});

test('reports include each sub-task under its main title and exact minute times',async t=>{
 const {api,document,window}=await app(t),parent=addMainTask(api,document,'Report parent');await settle();addTaskSub(api,document,parent,'Report child','Own remarks','Own feedback');await settle();addBooking(api,document,'09:15','09:45');await settle();
 const models=api.reportModel(api.state(),'2026-10-16'),tasks=models.find(model=>model.name==='Tasks'),schedule=models.find(model=>model.name==='Schedule');
 assert.equal(tasks.rows[1][17],'Report parent');assert.equal(tasks.rows[1][21],'Own remarks');assert.equal(tasks.rows[1][22],'Own feedback');assert.equal(schedule.rows[0][1],555/1440);assert.equal(schedule.rows[0][12],'09:45');assert.equal(schedule.rows[0][13],30);assert.equal(api.reportDashboard(api.state(),'2026-10-16').C30.value,0.5);
 for(const model of models)for(const row of model.rows)assert.equal(row.length,model.headers.length,model.name);
 const blob=api.exportReport(api.state(),'2026-10-16');assert.ok(blob.size>1000);const zip=await window.JSZip.loadAsync(window.Array.from(new Uint8Array(await blob.arrayBuffer())));assert.ok(zip.file('xl/workbook.xml'));
});

test('schedule milestones open in display mode and precise bookings remain visible in the weekly grid',async t=>{
 const {api,document}=await app(t);api.mutate(data=>data.projects[0].goLiveDate='2026-10-16');await settle();addBooking(api,document,'09:15','09:45');await settle();
 api.setMonth('2026-10');api.showTab('schedule');assert.match(document.getElementById('view').textContent,/30m/);
 await api.action(document.querySelector('[data-action="edit-project"]'));assert.equal(document.getElementById('projectForm'),null);assert.match(document.getElementById('modalTitle').textContent,/Go-Live milestone/);
 await api.action(document.querySelector('[data-action="edit-schedule-milestone"]'));assert.ok(document.getElementById('projectForm'));document.getElementById('modal').close();
 await api.action(document.querySelector('[data-action="schedule-layout"][data-layout="grid"]'));assert.ok(document.querySelector('.precision-grid'));assert.equal(document.querySelectorAll('.precision-grid tbody tr').length,24);
 assert.match(document.querySelector('.precision-grid').textContent,/09:15–09:45/);
 await api.action(document.querySelector('.precision-grid [data-action="open-booking"]'));assert.equal(document.getElementById('scheduleForm'),null);assert.ok(document.querySelector('[data-action="edit-booking"]'));
});

test('Tickets offers cards and the original table with working detail controls',async t=>{
 const {api,document}=await app(t);api.editRecord('tickets');const form=document.getElementById('editForm');form.elements.namedItem('ticket').value='AMS-100';form.elements.namedItem('description').value='Test ticket layout';api.saveEdit(form);await settle();
 api.showTab('tickets');assert.ok(document.querySelector('.ticket-queue-card'));assert.match(document.querySelector('.ticket-queue-card').textContent,/AMS-100/);
 await api.action(document.querySelector('[data-action="ticket-layout"][data-layout="table"]'));assert.ok(document.querySelector('#view table'));assert.match(document.getElementById('view').textContent,/History tracker/);
});

test('older documents gain area defaults and the current format survives backup/restore',async t=>{
 const {api}=await app(t);const data=copy(api.state());delete data.projects[0].mmAreas;
 for(const version of [1,2,3,4,5,6,7,8]){
  const restored=api.parseBackup(JSON.stringify({app:'mm-ticket-tracker',version,data}));
  assert.deepEqual(copy(restored.projects[0].mmAreas).map(area=>area.name),['Organization Structure','Master Data','Inventory Management','Procurement']);
 }
 assert.equal(JSON.parse(api.payload(api.state())).version,9);
});

test('areas can be added, renamed, reordered, hidden and restored with their mappings',async t=>{
 const {api,document,db}=await app(t);addCompany(api,document);await settle();addProcess(api,document);await settle();
 api.openMMAreaManager();
 const procurement=areaRow(document,'Procurement');procurement.querySelector('[data-area-name]').value='Purchasing';procurement.querySelector('[data-area-visible]').checked=false;
 api.editMMAreaDraft(procurement.querySelector('[data-action="mm-area-up"]'));
 api.editMMAreaDraft(document.querySelector('[data-action="mm-area-add"]'));
 document.querySelector('#mmAreaRows').lastElementChild.querySelector('[data-area-name]').value='Invoice Verification';
 api.saveMMAreas(document.getElementById('mmAreasForm'));await settle();
 const areas=copy(api.state().projects[0].mmAreas);
 assert.deepEqual(areas.map(area=>area.name),['Organization Structure','Master Data','Purchasing','Inventory Management','Invoice Verification']);
 assert.equal(areas[2].visible,false);assert.equal(api.state().projectProcessMappings[0].area,'Purchasing');
 api.showCompanies();
 assert.equal(document.querySelector('[data-action="governance-area"][data-area="Purchasing"]'),null);
 assert.equal(api.canonicalArea('Procurement'),'Purchasing');assert.equal(api.canonicalArea('invoice verification'),'Invoice Verification');
 const uploaded=db.calls.at(-1).args.p_document;assert.equal(uploaded.data.projectProcessMappings[0].area,'Purchasing');
 assert.deepEqual(copy(api.parseBackup(JSON.stringify(uploaded)).projects[0].mmAreas),areas);
 api.openMMAreaManager();areaRow(document,'Purchasing').querySelector('[data-area-visible]').checked=true;
 api.saveMMAreas(document.getElementById('mmAreasForm'));await settle();api.showCompanies();
 assert.equal(document.querySelector('[data-action="governance-area"][data-area="Purchasing"] strong').textContent,'1');
 api.editProcess();const processForm=document.getElementById('processForm');
 assert.ok([...processForm.elements.namedItem('area').options].some(option=>option.value==='Invoice Verification'));
});

test('invalid area changes preserve the last valid records and all-hidden views can be recovered',async t=>{
 const {api,document}=await app(t);addCompany(api,document);await settle();addProcess(api,document);await settle();
 api.openMMAreaManager();areaRow(document,'Procurement').remove();
 assert.throws(()=>api.saveMMAreas(document.getElementById('mmAreasForm')),/mapped records/);
 assert.equal(api.state().projectProcessMappings.length,1);
 api.openMMAreaManager();areaRow(document,'Master Data').querySelector('[data-area-name]').value=' procurement ';
 assert.throws(()=>api.saveMMAreas(document.getElementById('mmAreasForm')),/unique/);
 api.openMMAreaManager();for(const input of document.querySelectorAll('[data-area-visible]'))input.checked=false;
 api.saveMMAreas(document.getElementById('mmAreasForm'));await settle();api.showCompanies();
 assert.match(document.getElementById('view').textContent,/All SAP MM areas are hidden/);
 assert.equal(api.state().projectProcessMappings.length,1);
 assert.throws(()=>api.editProcess(),/Show at least one/);
});

test('each project has independent areas and custom areas work in Excel import normalization',async t=>{
 const {api,document}=await app(t);api.openMMAreaManager();
 api.editMMAreaDraft(document.querySelector('[data-action="mm-area-add"]'));
 document.querySelector('#mmAreaRows').lastElementChild.querySelector('[data-area-name]').value='Invoice Verification';
 api.saveMMAreas(document.getElementById('mmAreasForm'));await settle();
 const result=api.summarizeGovernanceRows([{name:'Mappings',rows:[['Company','Area','Item / BPML Process','Department'],['Farms','Invoice Verification','Three-way match','Finance / Accounts Payable']]}],'mapping.xlsx');
 assert.equal(result.rows[0].area,'Invoice Verification');
 api.editProject();const form=document.getElementById('projectForm');form.elements.namedItem('name').value='Another project';api.saveProject(form);await settle();
 assert.equal(api.projectMMAreas().length,4);assert.equal(api.state().projects[0].mmAreas.length,5);
});

test('a rejected cloud save remains queued and shows an explicit warning',async t=>{
 const {api,document,db}=await app(t,{rpcError:{code:'23514',message:'constraint violation'}});
 api.mutate(data=>data.projects[0].name='Unsaved project');await settle();
 assert.equal(api.cloud.error,true);assert.ok(api.cloud.inFlight);assert.equal(document.getElementById('storageNotice').hidden,false);
 assert.match(document.getElementById('storageNotice').textContent,/Supabase rejected/);
 db.error=null;await api.flushCloud();
 assert.equal(api.cloud.inFlight,null);assert.equal(api.cloud.revision,1);assert.equal(api.cloud.error,false);
 assert.equal(document.getElementById('saveStatus').textContent,'Saved to Supabase');
 assert.equal(db.calls[0].args.p_mutation_id,db.calls[1].args.p_mutation_id);
});

test('a slow cloud refresh cannot replace edits made while it was loading',async t=>{
 const {api,db}=await app(t);let resolveRead;
 db.read=()=>new Promise(resolve=>resolveRead=resolve);
 const refresh=api.refreshCloud();
 api.mutate(data=>data.projects[0].name='New local edit');await settle();
 resolveRead({data:null,error:null});await refresh;
 assert.equal(api.state().projects[0].name,'New local edit');assert.equal(api.cloud.revision,1);
 assert.equal(db.row.document.data.projects[0].name,'New local edit');
});

test('a failed upload survives reopening the app and saves when the connection returns',async t=>{
 const first=await app(t,{rpcError:{message:'Failed to fetch'}});
 first.api.mutate(data=>data.projects[0].name='Offline recovery');await settle();
 assert.ok(first.api.cloud.inFlight);
 const storage=Object.fromEntries(Object.keys(first.window.localStorage).map(key=>[key,first.window.localStorage.getItem(key)]));
 const restored=await app(t,{storage,login:false});
 await restored.api.loadCloud({user:{id:first.api.cloud.user.id,email:first.api.cloud.user.email}});await settle();
 assert.equal(restored.api.state().projects[0].name,'Offline recovery');
 assert.equal(restored.db.row.document.data.projects[0].name,'Offline recovery');
 assert.equal(restored.api.cloud.inFlight,null);assert.equal(restored.api.cloud.status,'Saved to Supabase');
});

test('upgrading a custom mapping preserves its area instead of moving it to Procurement',async t=>{
 const {api,document}=await app(t);addCompany(api,document);await settle();addProcess(api,document);await settle();
 const data=copy(api.state());delete data.projects[0].mmAreas;data.projectProcessMappings[0].area='Custom finance';
 const restored=api.parseBackup(JSON.stringify({app:'mm-ticket-tracker',version:6,data}));
 assert.equal(restored.projectProcessMappings[0].area,'Custom finance');
 assert.ok(restored.projects[0].mmAreas.some(area=>area.name==='Custom finance'));
});

test('earlier browser records import into an empty account once and remain in browser recovery storage',async t=>{
 const first=await app(t),data=copy(first.api.state());data.projects[0].name='Existing browser work';delete data.projects[0].mmAreas;data.lists.milestones[0]='Custom analysis';
 const raw=JSON.stringify({app:'mm-ticket-tracker',version:6,data});
 const {api,window,document,db}=await app(t,{storage:{[first.api.KEY]:raw}});
 assert.equal(document.getElementById('browserMigrationNotice').hidden,false);
 await api.browserMigrationAction('cloud-import-browser');
 assert.match(document.getElementById('modalBody').textContent,/owner@example.com/);
 await api.browserMigrationAction('cloud-apply-browser-import');await settle();
 assert.equal(api.state().projects[0].name,'Existing browser work');assert.equal(db.row.document.version,9);
 assert.equal(api.steps()[0],'Custom analysis');
 assert.equal(window.localStorage.getItem(api.KEY),raw);assert.equal(document.getElementById('browserMigrationNotice').hidden,true);
 await assert.rejects(api.browserMigrationAction('cloud-apply-browser-import'),/Cloud records already exist/);
});

test('browser import detects a cloud document created after the import prompt',async t=>{
 const first=await app(t),data=copy(first.api.state());data.projects[0].name='Browser work';
 const raw=JSON.stringify({app:'mm-ticket-tracker',version:6,data});
 const {api,db}=await app(t,{storage:{[first.api.KEY]:raw}});
 await api.browserMigrationAction('cloud-import-browser');
 db.row={document:JSON.parse(api.payload(api.state())),revision:1};
 await assert.rejects(api.browserMigrationAction('cloud-apply-browser-import'),/Cloud records now exist/);
 assert.equal(db.calls.length,0);assert.equal(api.state().projects[0].name,'SAP Projects');
});

const sessionUser={user:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.com'}};
async function loggedCloud(t){const ctx=await app(t,{login:false});const data=ctx.api.emptyState();ctx.db.row={document:JSON.parse(ctx.api.payload(data)),revision:1,mutation_id:'initial'};await ctx.api.loadCloud(sessionUser);await settle();return ctx;}
async function hubAction(api,hub,extra={}){await api.hub.handle({dataset:{hub,...extra}});await settle();}
function fill(form,values){for(const[k,v]of Object.entries(values)){const el=form.elements.namedItem(k);if(el.type==='checkbox')el.checked=v;else el.value=v;}}

test('a clean device automatically follows newer cloud records and clears a stale conflict',async t=>{
 const {api,db}=await loggedCloud(t);const remote=copy(db.row);remote.revision=2;remote.document.data.projects[0].name='Latest laptop work';db.row=remote;api.cloud.conflict=true;
 await api.refreshCloud();assert.equal(api.state().projects[0].name,'Latest laptop work');assert.equal(api.cloud.revision,2);assert.equal(api.cloud.conflict,false);assert.equal(db.calls.length,0);
});

test('independent offline and cloud edits merge without discarding either device',async t=>{
 const {api,db}=await loggedCloud(t);db.error={message:'Failed to fetch'};api.mutate(d=>d.projects[0].name='Local project title');await settle();
 db.row.document.data.projects[0].code='Laptop-code';db.row.revision=2;db.row.mutation_id='laptop';db.error=null;await api.retryCloud();await settle();
 assert.equal(api.state().projects[0].name,'Local project title');assert.equal(api.state().projects[0].code,'Laptop-code');assert.equal(db.row.document.data.projects[0].name,'Local project title');assert.equal(api.cloud.conflict,false);assert.equal(api.cloud.pending,null);assert.equal(api.cloud.inFlight,null);
});

test('competing edits of the same field stay protected and recover on reopening',async t=>{
 const {api,db,window}=await loggedCloud(t);db.error={message:'Failed to fetch'};api.mutate(d=>d.projects[0].name='Phone edit');await settle();
 db.row.document.data.projects[0].name='Laptop edit';db.row.revision=2;db.row.mutation_id='laptop';db.error=null;await api.retryCloud();
 assert.equal(api.cloud.conflict,true);assert.equal(api.state().projects[0].name,'Phone edit');assert.equal(db.row.document.data.projects[0].name,'Laptop edit');
 const storage=Object.fromEntries(Object.keys(window.localStorage).map(k=>[k,window.localStorage.getItem(k)]));const reopened=await app(t,{storage,remote:db.row,login:false});await reopened.api.loadCloud(sessionUser);assert.equal(reopened.api.cloud.conflict,true);assert.equal(reopened.api.state().projects[0].name,'Phone edit');assert.equal(reopened.db.calls.length,0);
});

test('a persisted acknowledgement with no different edits clears a false review',async t=>{
 const {api,db,window}=await loggedCloud(t),key=api.cloud.key,cache=JSON.parse(window.localStorage.getItem(key));cache.pending=copy(cache.document);cache.document.savedAt='older';cache.revision=0;delete cache.baseDocument;
 const reopened=await app(t,{storage:{[key]:JSON.stringify(cache)},remote:db.row,login:false});await reopened.api.loadCloud(sessionUser);assert.equal(reopened.api.cloud.conflict,false);assert.equal(reopened.api.cloud.pending,null);assert.equal(reopened.db.calls.length,0);
});

test('cloud refresh protects form drafts and resumes after the editor closes',async t=>{
 const {api,db,document}=await loggedCloud(t);api.editRecord('tasks');document.getElementById('editForm').elements.namedItem('task').value='Unsaved draft';db.row.document.data.projects[0].name='New cloud';db.row.revision=2;
 await api.refreshCloud();assert.equal(document.getElementById('editForm').elements.namedItem('task').value,'Unsaved draft');assert.equal(api.cloud.refreshDeferred,true);
 api.closeModal();await settle();assert.equal(api.state().projects[0].name,'New cloud');assert.equal(api.cloud.refreshDeferred,false);
});

test('visibility and focus fetch new records without requiring settings',async t=>{
 const {api,db,window}=await loggedCloud(t);db.row.document.data.projects[0].code='Visible update';db.row.revision=2;
 window.dispatchEvent(new window.Event('focus'));await settle();assert.equal(api.state().projects[0].code,'Visible update');
 db.row.document.data.projects[0].code='Return update';db.row.revision=3;window.document.dispatchEvent(new window.Event('visibilitychange'));await settle();assert.equal(api.state().projects[0].code,'Return update');
});

test('navigating projects and months does not create conflicting record uploads',async t=>{
 const {api,db}=await loggedCloud(t);api.mutate(d=>d.calendarMonth='2026-11');await settle();assert.equal(db.calls.length,0);assert.equal(api.cloud.pending,null);assert.equal(api.state().calendarMonth,'2026-11');
});

test('the notebook saves linked details, escapes markup and survives backup restore',async t=>{
 const {api,document,db}=await app(t);await hubAction(api,'note-edit');const form=document.getElementById('hubNote');fill(form,{title:'<script>unsafe</script>',tags:'Goods receipt',tcodes:'MIGO',body:'Cause and solution',configuration:'Configuration path',errors:'Error details',testing:'Check quantity',projectId:api.state().activeProjectId});api.hub.submit(form);await settle();const n=api.state().workhub.notes[0];assert.equal(db.row.document.data.workhub.notes[0].body,'Cause and solution');await hubAction(api,'note-view',{id:n.id});assert.equal(document.getElementById('modalBody').querySelector('script'),null);assert.match(document.getElementById('modalBody').textContent,/Configuration path/);assert.equal(api.parseBackup(api.payload(api.state())).workhub.notes[0].tcodes,'MIGO');
});

test('Waiting on preserves dates and notes through resolve, reopen, delete and undo',async t=>{
 const {api,document}=await app(t);await hubAction(api,'waiting-edit');let form=document.getElementById('hubWaiting');fill(form,{title:'Approval',person:'Finance',followUp:'2026-10-20',notes:'Ask for confirmation'});api.hub.submit(form);await settle();const id=api.state().workhub.waiting[0].id;await hubAction(api,'waiting-toggle',{id});assert.equal(api.state().workhub.waiting[0].resolved,true);await hubAction(api,'waiting-toggle',{id});assert.equal(api.state().workhub.waiting[0].resolved,false);await hubAction(api,'waiting-delete',{id});assert.equal(api.state().workhub.waiting.length,0);await hubAction(api,'undo');assert.equal(api.state().workhub.waiting[0].person,'Finance');
});

test('Process Hub maintains T-codes, branches, order and links without invalid connections',async t=>{
 const {api,document}=await app(t);await hubAction(api,'process-example');let process=api.state().workhub.processes[0];assert.equal(process.steps.length,4);const id=process.steps[0].id;await hubAction(api,'step-edit',{process:process.id,id});let form=document.getElementById('hubStep');fill(form,{tcodes:'CUSTOM1, CUSTOM2',notes:'Company-specific usage',title:'Prepare purchase request'});api.hub.submit(form);await settle();process=api.state().workhub.processes[0];assert.equal(process.steps[0].tcodes,'CUSTOM1, CUSTOM2');assert.equal(process.steps[0].next.length,1);await hubAction(api,'step-delete',{id:process.steps[1].id});process=api.state().workhub.processes[0];assert.equal(process.steps.length,3);assert.equal(process.steps[0].next.length,0);api.validate(api.state());
});

test('task board changes status without losing subtasks or notes',async t=>{
 const {api,document}=await app(t),id=addMainTask(api,document,'Main card');addTaskSub(api,document,id,'Child','Remark','Feedback');await settle();api.hub.moveTask(id,'blocked');await settle();assert.equal(api.state().tasks[0].boardStatus,'blocked');assert.equal(api.state().tasks[0].done,false);api.hub.moveTask(id,'done');await settle();assert.equal(api.state().tasks[0].done,true);assert.ok(api.state().tasks[0].doneDate);api.hub.moveTask(id,'doing');await settle();assert.equal(api.state().tasks[0].done,false);assert.equal(api.state().tasks[0].subTasks[0].feedback,'Feedback');api.hub.setBoard(true);api.showTab('tasks');assert.equal(document.querySelectorAll('.hub-column').length,4);assert.match(document.getElementById('view').textContent,/Main card/);
});

test('dashboard selection, sizing and reordering persist as compact settings',async t=>{
 const {api,document}=await app(t);await hubAction(api,'widget-size',{id:'tasks'});await hubAction(api,'widget-up',{id:'tasks'});assert.equal(api.state().workhub.widgets[0].id,'tasks');assert.equal(api.state().workhub.widgets[0].span,'wide');await hubAction(api,'layout');const form=document.getElementById('hubLayout');form.querySelector('[value="desk"]').checked=false;form.querySelector('[value="focus"]').checked=true;api.hub.submit(form);await settle();assert.ok(!api.state().workhub.widgets.some(w=>w.id==='desk'));assert.ok(api.state().workhub.widgets.some(w=>w.id==='focus'));
});

test('theme preview stays local until saved and imported settings are validated',async t=>{
 const {api,document,window,db}=await app(t);api.hub.setTool('theme');api.showTab('studio');const form=document.getElementById('hubTheme');fill(form,{theme:'dark',name:'Haidid',radius:'24',motion:'off'});form.elements.namedItem('theme').dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(document.body.dataset.hubTheme,'dark');assert.equal(api.state().workhub.preferences.theme,'ocean');assert.equal(db.calls.length,0);api.hub.submit(form);await settle();assert.equal(api.state().workhub.preferences.name,'Haidid');assert.equal(api.state().workhub.preferences.motion,'off');await assert.rejects(api.hub.importTheme({size:10,text:async()=>JSON.stringify({app:'mm-tracker-theme',version:1,preferences:{accent:'url(javascript:bad)'}})}),/theme settings/);
});

test('the document simulator computes quantity and price differences locally',async t=>{
 const {api,db}=await app(t);const result=api.hub.simulationValues({quantity:100,price:10,received:80,invoiced:90,invoicePrice:11,tolerance:2});assert.equal(result.order,1000);assert.equal(result.receipt,800);assert.equal(result.invoice,990);assert.equal(result.quantityDifference,10);assert.equal(result.priceVariance,10);assert.equal(result.withinTolerance,false);assert.equal(db.calls.length,0);
});

test('stopping a project stopwatch creates synchronized schedule and project records once',async t=>{
 const {api,db}=await app(t);api.hub.startTimer({kind:'project',linkId:api.state().activeProjectId,title:'Project testing',notes:'Verified quantity',chargeCode:'MM-TEST'});const draft=api.hub.timer();draft.started='2026-10-16T09:15:00+08:00';draft.runningSince=null;draft.segments=[{start:'2026-10-16T09:15:00+08:00',end:'2026-10-16T10:05:00+08:00'},{start:'2026-10-16T10:15:00+08:00',end:'2026-10-16T10:45:00+08:00'}];api.hub.finishTimer();await settle();assert.equal(api.hub.timer(),null);assert.equal(api.state().workhub.sessions.length,1);assert.equal(api.state().workhub.sessions[0].seconds,4800);assert.equal(api.state().projectPlans.length,2);assert.equal(api.state().schedule.reduce((n,r)=>n+(+r.endTime.slice(0,2)*60 + +r.endTime.slice(3))-(+r.time.slice(0,2)*60 + +r.time.slice(3)),0),80);assert.ok(api.state().schedule.every(r=>r.planId&&r.sessionId));api.validate(api.state());api.hub.finishTimer();assert.equal(api.state().workhub.sessions.length,1);assert.equal(db.row.document.data.workhub.sessions[0].scheduled,true);
});

test('a stopwatch overlapping a booking preserves both the booking and timer for review',async t=>{
 const {api,document}=await app(t);addBooking(api,document,'09:00','10:00',{date:'2026-10-16'});await settle();api.hub.startTimer({kind:'custom',title:'Investigation'});const draft=api.hub.timer();draft.started='2026-10-16T09:15:00+08:00';draft.runningSince=null;draft.segments=[{start:'2026-10-16T09:15:00+08:00',end:'2026-10-16T09:30:00+08:00'}];api.hub.finishTimer();assert.ok(api.hub.timer());assert.equal(api.state().workhub.sessions.length,0);assert.match(document.getElementById('modalBody').textContent,/overlaps/);api.hub.finishTimer(true);await settle();assert.equal(api.state().workhub.sessions[0].scheduled,false);assert.equal(api.state().schedule[0].text,'Focused work');
});

test('a local timer survives refresh without uploading every tick and stays scoped to its account',async t=>{
 const first=await app(t);first.api.hub.startTimer({kind:'custom',title:'Reading'});assert.equal(first.db.calls.length,0);const storage=Object.fromEntries(Object.keys(first.window.localStorage).map(k=>[k,first.window.localStorage.getItem(k)]));const reopened=await app(t,{storage,login:false});await reopened.api.loadCloud(sessionUser);assert.equal(reopened.api.hub.timer().title,'Reading');await reopened.api.loadCloud({user:{id:'22222222-2222-4222-8222-222222222222',email:'other@example.com'}});assert.equal(reopened.api.hub.timer(),null);
});

test('project phase changes create editable scrapbook keepsakes',async t=>{
 const {api}=await app(t);api.mutate(d=>d.projects[0].phase=d.lists.projectPhases[1]);await settle();assert.equal(api.state().workhub.scrapbook.length,1);assert.match(api.state().workhub.scrapbook[0].title,/Blueprint/);api.validate(api.state());
});

test('automatic refresh never overwrites another tab’s durable pending upload',async t=>{
 const {api,window}=await loggedCloud(t),raw=JSON.parse(window.localStorage.getItem(api.cloud.key));raw.document.data.projects[0].name='Other tab draft';raw.pending=copy(raw.document);const other=JSON.stringify(raw);window.localStorage.setItem(api.cloud.key,other);await api.refreshCloud();assert.equal(window.localStorage.getItem(api.cloud.key),other);assert.match(api.cloud.status,/Another browser tab/);assert.notEqual(api.state().projects[0].name,'Other tab draft');
});

test('a stale RPC revision automatically merges disjoint changes and retries against the new revision',async t=>{
 const {api,db}=await loggedCloud(t);db.row.document.data.projects[0].code='Laptop latest';db.row.revision=2;db.row.mutation_id='remote';api.mutate(d=>d.projects[0].name='Phone new title');for(let i=0;i<5;i++)await settle();assert.equal(api.cloud.conflict,false);assert.equal(db.row.document.data.projects[0].code,'Laptop latest');assert.equal(db.row.document.data.projects[0].name,'Phone new title');assert.equal(api.cloud.revision,3);
});

test('midnight and paused stopwatch intervals retain local dates and minute boundaries',async t=>{
 const {api}=await app(t);const ranges=copy(api.hub.sessionRanges({intervals:[{start:'2026-10-15T23:45:10+08:00',end:'2026-10-16T00:15:01+08:00'}]}));assert.deepEqual(ranges,[{date:'2026-10-15',time:'23:45',endTime:'24:00'},{date:'2026-10-16',time:'00:00',endTime:'00:16'}]);
});

test('all new screens render with working navigation, commands, privacy and presentation exit',async t=>{
 const {api,document}=await app(t);for(const tab of ['home','tickets','tasks','schedule','specs','knowledge','processhub','waiting','studio']){api.showTab(tab);assert.ok(document.getElementById('view').innerHTML.length>50,tab);assert.ok(document.querySelector('[data-tab="'+tab+'"]'));}
 await hubAction(api,'commands');assert.ok(document.getElementById('hubCommandResults').children.length);await hubAction(api,'privacy');assert.ok(document.body.classList.contains('hub-private'));await hubAction(api,'presentation');assert.ok(document.getElementById('hubExitPresentation'));await hubAction(api,'presentation');assert.equal(document.getElementById('hubExitPresentation'),null);
 await api.loadCloud(null);assert.equal(document.getElementById('hubToolbar').hidden,true);assert.equal(document.getElementById('hubPet').hidden,true);
});

test('unchanged background checks fetch only lightweight revision metadata',async t=>{
 const {api,db}=await loggedCloud(t);db.selects.length=0;await api.refreshCloud();assert.deepEqual(db.selects,['revision,mutation_id,updated_at']);
 db.row.revision=2;db.row.document.data.projects[0].code='Changed';await api.refreshCloud();assert.equal(db.selects.at(-1),'document,revision,mutation_id,updated_at');assert.equal(api.state().projects[0].code,'Changed');
});
