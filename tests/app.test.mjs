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
 window.TextEncoder=TextEncoder;window.TextDecoder=TextDecoder;
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
  browserMigrationAction,notice,action,projectMMAreas,
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

test('older documents gain area defaults and the current format survives backup/restore',async t=>{
 const {api}=await app(t);const data=copy(api.state());delete data.projects[0].mmAreas;
 for(const version of [1,2,3,4,5,6,7]){
  const restored=api.parseBackup(JSON.stringify({app:'mm-ticket-tracker',version,data}));
  assert.deepEqual(copy(restored.projects[0].mmAreas).map(area=>area.name),['Organization Structure','Master Data','Inventory Management','Procurement']);
 }
 assert.equal(JSON.parse(api.payload(api.state())).version,7);
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
 assert.equal(api.state().projects[0].name,'Existing browser work');assert.equal(db.row.document.version,7);
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
