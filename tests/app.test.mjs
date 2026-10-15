import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

async function app(t,{storage={},rpcError=null,remote=null,login=true}={}){
 const dom=new JSDOM(html,{url:'https://losthaidid.github.io/mm-tracker/',runScripts:'outside-only'});
 const {window}=dom;
 t.after(()=>window.close());
 window.TextEncoder=TextEncoder;window.TextDecoder=TextDecoder;window.Blob=Blob;
 window.setTimeout=()=>0;window.setInterval=()=>0;
 window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 window.confirm=()=>true;
 for(const [key,value]of Object.entries(storage))window.localStorage.setItem(key,value);
 const db={row:remote,calls:[],error:rpcError,read:null};
 const client={
  auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>db.read?db.read():({data:copy(db.row),error:null})})})}),
  rpc:async(name,args)=>{
   db.calls.push({name,args:copy(args)});
   if(db.error)return{data:null,error:db.error};
   db.row={document:copy(args.p_document),revision:(db.row?.revision||0)+1,mutation_id:args.p_mutation_id,updated_at:new Date().toISOString()};
   return{data:[{revision:db.row.revision,mutation_id:db.row.mutation_id,updated_at:db.row.updated_at}],error:null};
  }
 };
 window.MMTrackerSupabase={createClient:()=>client};
 const script=[...window.document.scripts].find(script=>script.textContent.includes("'use strict'"));
 window.eval(script.textContent+`\nwindow.api={
  state:()=>state,steps:()=>STEPS,cloud,KEY,payload,parseBackup,emptyState,validate,mutate,loadCloud,flushCloud,refreshCloud,
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
 assert.equal(JSON.parse(api.payload(api.state())).version,8);
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
 assert.equal(api.state().projects[0].name,'Existing browser work');assert.equal(db.row.document.version,8);
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
