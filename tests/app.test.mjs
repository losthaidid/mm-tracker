import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
process.env.TZ='Asia/Kuala_Lumpur';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
async function unzipReport(blob){const bytes=Buffer.from(await blob.arrayBuffer()),entries={};let offset=0;while(bytes.readUInt32LE(offset)===0x04034b50){const size=bytes.readUInt32LE(offset+18),nameLength=bytes.readUInt16LE(offset+26),extraLength=bytes.readUInt16LE(offset+28),name=bytes.subarray(offset+30,offset+30+nameLength).toString(),start=offset+30+nameLength+extraLength;assert.equal(bytes.readUInt16LE(offset+8),0);entries[name]=bytes.subarray(start,start+size).toString();offset=start+size;}assert.equal(bytes.readUInt32LE(offset),0x02014b50);return entries;}
async function atmosphereChoices(ctx,values={},meet=false){
 const {api,document,window}=ctx;api.hub.atmosphere.settings();const form=document.getElementById('atmosphereForm');
 for(const [name,value]of Object.entries(values)){const field=form.elements.namedItem(name);if(field.type==='checkbox')field.checked=value;else field.value=value;}
 const submitter=form.querySelector('[value="'+(meet?'visit':'save')+'"]');form.dispatchEvent(new window.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter}));await settle();
}

async function app(t,{storage={},rpcError=null,remote=null,login=true,styles=false,adventures=false,sessionLookup=null,read=null,cloudClient=true}={}){
 const dom=new JSDOM(html,{url:'https://losthaidid.github.io/mm-tracker/',runScripts:'outside-only',pretendToBeVisual:true});
 const {window}=dom;
 t.after(()=>window.close());
 window.TextEncoder=TextEncoder;window.TextDecoder=TextDecoder;window.Blob=Blob;window.setImmediate=setImmediate;window.clearImmediate=clearImmediate;
 const intervals=[],frames=new Map();let nextFrame=1;
 window.setTimeout=()=>0;window.setInterval=(callback,ms)=>{intervals.push({callback,ms});return intervals.length;};
 window.requestAnimationFrame=callback=>{const id=nextFrame++;frames.set(id,callback);return id;};window.cancelAnimationFrame=id=>frames.delete(id);
 const baseStyle=window.document.createElement('style');baseStyle.textContent=readFileSync(new URL('../base.css',import.meta.url),'utf8');window.document.head.append(baseStyle);
 if(styles){const style=window.document.createElement('style');style.textContent=[...window.document.querySelectorAll('link[rel="stylesheet"]')].map(link=>new URL(link.href).pathname.split('/').at(-1)).filter(file=>file!=='base.css').map(file=>readFileSync(new URL('../'+file,import.meta.url),'utf8')).join('\n');window.document.head.append(style);}
 window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 window.confirm=()=>true;
 if(!adventures&&!storage['mm-tracker.momo-adventures.v1'])window.localStorage.setItem('mm-tracker.momo-adventures.v1',JSON.stringify({greetings:false,antics:false,reminders:false,chases:false}));
 for(const [key,value]of Object.entries(storage))window.localStorage.setItem(key,value);
 const db={row:remote,calls:[],error:rpcError,read,selects:[]};
 const client={
  auth:{getSession:sessionLookup||(async()=>({data:{session:null},error:null})),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
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
 if(cloudClient)window.MMTrackerSupabase={createClient:()=>client};
 // Use production's script order, replacing only the network client with the stub above.
 for(const script of window.document.querySelectorAll('script[src]')){const file=new URL(script.src).pathname.split('/mm-tracker/')[1];if(!['supabase-client.js','app.js'].includes(file))window.eval(readFileSync(new URL('../'+file,import.meta.url),'utf8'));}
 window.eval(readFileSync(new URL('../app.js',import.meta.url),'utf8')+`\nwindow.api={
  hub,queueCloudReview,state:()=>state,steps:()=>STEPS,cloud,KEY,payload,parseBackup,emptyState,validate,mutate,loadCloud,flushCloud,refreshCloud,retryCloud,closeModal,
  openMMAreaManager,saveMMAreas,editLists,saveLists,editMMAreaDraft,canonicalArea,summarizeGovernanceRows,
  renderProjectCompanies,editCompany,saveCompany,editProcess,saveProcess,editProject,saveProject,
  browserMigrationAction,notice,action,projectMMAreas,editRecord,saveEdit,editSubItem,saveSubItem,openSubItems,editTaskSub,saveTaskSub,openRangeEditor,saveRange,scheduleEntries,viewBooking,workhubAction,workhubChange,rangeSegments,rangeTimes,editPlan,savePlan,reportModel,reportDashboard,exportReport,scheduleMonthMetrics,formatDuration,
  showTab(value){tab=value;render();},showProjectItems(){tab='specs';projectView='items';render();},setMonth(value){month=value;},
  login(){cloud.user={id:'11111111-1111-4111-8111-111111111111',email:'owner@example.com'};cloud.ready=true;cloud.key='mm-tracker.cloud.v1:'+cloudConfig.project+':'+cloud.user.id;cloud.status='Saved to Supabase';persistCloudCache();notice();render();},
  showCompanies(){tab='specs';projectView='companies';render();}
 };`);
 await settle();
 if(login)window.api.login();
 return{window,document:window.document,api:window.api,db,intervals,frames};
}

async function solutionWorkspace(ctx,copySample=false){
 const {api,document}=ctx;api.showTab('specs');await api.action(document.querySelector('[data-action="project-view"][data-view="solution"]'));const ui=api.hub.solution;
 if(copySample){document.querySelector('[data-ss="sample-copy"]').click();const f=document.getElementById('ssStudioForm');ui.submit(f);await settle();}
 return ui;
}
test('Batch C: new-ticket twins preview earlier cases without replacing the draft, saving or duplicating a record',async t=>{
 const {api,document,db,window}=await app(t);api.editRecord('tickets');let form=document.getElementById('editForm');fill(form,{ticket:'OLD-01',description:'Connection timeout while uploading files',history:'Fixed by changing the endpoint configuration.',pic:'Rina'});api.saveEdit(form);await settle();const id=api.state().tickets[0].id,calls=db.calls.length;
 api.editRecord('tickets');form=document.getElementById('editForm');assert.ok(form.querySelector('.bc-twins'));fill(form,{ticket:'NEW-02',description:'Connection timeout while uploading files'});api.hub.batchC.decorateModal();assert.equal(form.querySelectorAll('.bc-twins article').length,1);assert.match(form.querySelector('.bc-twins').textContent,/Fixed by changing/);form.querySelector('.bc-twins details').open=true;assert.equal(document.getElementById('editForm'),form);assert.equal(form.elements.namedItem('ticket').value,'NEW-02');await settle();assert.equal(db.calls.length,calls);assert.equal(api.state().tickets.length,1);
 api.closeModal();api.editRecord('tickets',id);assert.equal(document.querySelectorAll('.bc-twins article').length,0);api.cloud.user={id:'different-owner'};api.showTab('home');assert.equal(document.querySelector('.bc-twins'),null);
});
test('Batch C: Studio tools and ticket screenshot shortcut use local editors and preserve existing record exports',async t=>{
 const {api,document,db}=await app(t);const id=addWishlistTicket(api,document);await settle();const before=api.payload(api.state()),calls=db.calls.length;await api.action({dataset:{action:'detail',id}});const shortcut=document.querySelector('.ticket-detail-tools [data-bc="privacy"]');assert.ok(shortcut);shortcut.click();assert.match(document.getElementById('bcRoomTitle').textContent,/Ready to share/);assert.equal(document.querySelector('[data-bc="undo"]').disabled,true);api.hub.batchC.close();assert.ok(document.querySelector('[data-ticket-detail]'));api.closeModal();
 api.hub.setTool('screenshots');api.showTab('studio');assert.ok(document.querySelector('[data-bc="guide"]'));document.querySelector('[data-bc="guide"]').click();assert.match(document.getElementById('bcRoomTitle').textContent,/Step|step/);api.hub.batchC.close();await settle();assert.equal(db.calls.length,calls);assert.deepEqual(JSON.parse(api.payload(api.state())).data,JSON.parse(before).data);assert.equal(api.parseBackup(before).tickets[0].id,id);
});
test('Batch C: account change during screenshot decoding cannot restore old images or leave a download behind',async t=>{
 const {api,document,window,db}=await app(t);let finish;window.WorkHubBatchCFiles.imageFromFile=()=>new Promise(resolve=>finish=resolve);api.hub.batchC.open('guide');const job=api.hub.batchC.add([{name:'private.png'}]);api.cloud.user={id:'next-owner'};api.showTab('home');finish({src:'data:image/png;base64,AA==',width:1,height:1});await job;assert.equal(document.getElementById('batchCRoom'),null);api.hub.batchC.open('guide');assert.equal(document.querySelectorAll('[data-bc="select"]').length,0);assert.equal(db.calls.length,0);
});
function solutionButton(document,op,attrs={}){const el=document.createElement('button');el.dataset.ss=op;for(const[k,v]of Object.entries(attrs))el.dataset[k]=v;return el;}
function experienceButton(document,op,attrs={}){const el=document.createElement('button');el.dataset.sx=op;for(const[k,v]of Object.entries(attrs))el.dataset[k]=v;return el;}
test('Solution Studio valuation: MAP, batch and split worked examples explain engine results without account writes',async t=>{
 const ctx=await app(t),{api,document,db,window}=ctx,ui=await solutionWorkspace(ctx);await settle();const writes=db.calls.length;
 assert.equal(document.querySelectorAll('.sv-example-cards [data-ss="learn-inventory"]').length,3);
 ui.handle(solutionButton(document,'learn-inventory',{kind:'map'}));assert.match(document.querySelector('.sv-price-cards').textContent,/RM 11.00/);assert.equal(ui.simulator.snapshot().snap.profile.priceControl,'V');
 ui.simulator.advance();ui.simulator.advance();assert.match(document.querySelector('.sg-balance-changes').textContent,/RM 330.00/);
 ui.handle(solutionButton(document,'learn-inventory',{kind:'batch'}));assert.equal(document.querySelectorAll('.sv-batches tbody tr').length,2);ui.simulator.advance();ui.simulator.advance();assert.equal(document.querySelector('[data-sim-status]').dataset.simStatus,'error');assert.match(document.querySelector('.sg-narrator').textContent,/LOT-A/);
 ui.handle(solutionButton(document,'learn-inventory',{kind:'split'}));assert.equal(document.querySelectorAll('.sv-valuation-table tbody tr').length,2);assert.match(document.querySelector('.sv-valuation-table').textContent,/3100/);assert.ok(document.getElementById('ssWarehouseType'));assert.ok(document.querySelector('#ssTransactionForm [name="valuationType"]'));
 for(let i=0;i<5;i++)ui.simulator.advance();assert.equal(document.querySelector('[data-sim-status]').dataset.simStatus,'success');const s=ui.simulator.snapshot(),r=window.WorkHubSolutionEngine.simulate(s.snap.profile,s.actions,s.snap.scenario,s.snap.engineVersion);assert.ok(r.events.every(e=>e.status==='success'));await settle();assert.equal(db.calls.length,writes);assert.equal(api.state().workhub.solutionStudio.products.length,0);
});
test('Solution Studio valuation: proposal S/V, valuation class and batch controls persist through backups and cloud reopening',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,ui=await solutionWorkspace(ctx,true);ui.proposalEditor(ui.context().proposalId);let f=document.getElementById('ssStudioForm');
 fill(f,{priceControl:'V',movingAveragePrice:'10',valuationClass:'4000',openingQty:'100',openingBatch:'OPEN-LOT'});f.elements.namedItem('batchManaged').checked=true;f.elements.namedItem('priceControl').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(f.elements.namedItem('standardPrice').disabled,true);ui.submit(f);await settle();
 const p=api.state().workhub.solutionStudio.proposals.find(p=>p.id===ui.context().proposalId);assert.equal(p.profile.valuationClass,'4000');assert.equal(p.profile.priceControl,'V');assert.equal(p.profile.batchManaged,true);
 ui.handle(solutionButton(document,'pane',{pane:'simulation'}));ui.simulator.advance();document.querySelector('[data-ss-sim="save"]').click();f=document.getElementById('ssStudioForm');f.elements.namedItem('title').value='MAP and batch evidence';ui.submit(f);await settle();const saved=api.state().workhub.solutionStudio.runs.at(-1);assert.equal(saved.snapshot.profile.openingBatch,'OPEN-LOT');assert.equal(saved.actions[0].batch,'BATCH-001');assert.match(saved.snapshot.engineVersion,/2026-10-22/);
 const backup=api.parseBackup(api.payload(api.state()));assert.equal(backup.workhub.solutionStudio.proposals.find(r=>r.id===p.id).profile.valuationClass,'4000');
 const restored=await app(t,{remote:copy(db.row),login:false});await restored.api.loadCloud(sessionUser);await solutionWorkspace(restored);const run=restored.api.state().workhub.solutionStudio.runs.at(-1);const replay=restored.window.WorkHubSolutionEngine.simulate(run.snapshot.profile,run.actions,run.snapshot.scenario,run.snapshot.engineVersion);assert.equal(replay.events[0].after.mapPrice,11);restored.api.validate(restored.api.state());
});
test('Solution Studio valuation: split-type editors total opening stock and warehouse transfers retain batch and type',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,ui=await solutionWorkspace(ctx,true);ui.proposalEditor(ui.context().proposalId);let f=document.getElementById('ssStudioForm');f.elements.namedItem('splitValuation').checked=true;f.elements.namedItem('batchManaged').checked=true;f.elements.namedItem('splitValuation').dispatchEvent(new window.Event('change',{bubbles:true}));
 const rows=f.querySelectorAll('[data-valuation-type]');rows[0].querySelector('[name="vtOpeningQty"]').value='100';rows[0].querySelector('[name="vtOpeningBatch"]').value='LOC-OPEN';rows[1].querySelector('[name="vtOpeningQty"]').value='40';rows[1].querySelector('[name="vtOpeningBatch"]').value='IMP-OPEN';rows[1].querySelector('[name="vtPriceControl"]').value='S';rows[0].querySelector('[name="vtOpeningQty"]').dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(f.elements.namedItem('openingQty').value,'140');assert.equal(f.elements.namedItem('priceControl').value,'V');
 f.querySelector('[data-ss-sim="valuation-add"]').click();assert.equal(f.querySelectorAll('[data-valuation-type]').length,3);f.querySelectorAll('[data-ss-sim="valuation-remove"]')[2].click();assert.equal(f.querySelectorAll('[data-valuation-type]').length,2);ui.submit(f);await settle();const p=api.state().workhub.solutionStudio.proposals.find(p=>p.id===ui.context().proposalId);assert.equal(p.profile.valuationTypes[1].priceControl,'S');assert.equal(p.profile.valuationTypes[1].valuationClass,'3100');assert.equal(db.row.document.data.workhub.solutionStudio.proposals.find(x=>x.id===p.id).profile.openingQty,140);
 ui.handle(solutionButton(document,'pane',{pane:'simulation'}));ui.simulator.advance();document.getElementById('ssWarehouseType').value='LOCAL';document.getElementById('ssWarehouseBatch').value='BATCH-001';document.getElementById('ssWarehouseQty').value='5';document.querySelector('[data-ss-sim="warehouse-transfer"][data-from="MAIN"]').click();const snap=ui.simulator.snapshot();assert.equal(snap.actions[1].batch,'BATCH-001');assert.equal(snap.actions[1].valuationType,'LOCAL');assert.equal(document.querySelector('[data-sim-status]').dataset.simStatus,'success');api.validate(api.state());
});
test('Solution Studio valuation: batch/type labels escape markup and handovers retain valuation assumptions',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,ui=await solutionWorkspace(ctx);ui.handle(solutionButton(document,'learn-inventory',{kind:'split'}));ui.handle(solutionButton(document,'pane',{pane:'simulation'}));let f=document.getElementById('ssTransactionForm');fill(f,{type:'gr',qty:'1',batch:'<svg>',valuationType:'LOCAL'});const trial=document.getElementById('ssTrialProfile');trial.elements.namedItem('unlimited').checked=true;ui.simulator.submit(trial);f=document.getElementById('ssTransactionForm');fill(f,{type:'gr',qty:'1',batch:'<svg>',valuationType:'LOCAL'});ui.simulator.submit(f);assert.equal(document.querySelector('.sv-batches svg'),null);assert.match(document.querySelector('.sv-batches').textContent,/<svg>/);
 ui.experience.handle(experienceButton(document,'handover'));assert.match(document.querySelector('.sx-handover').textContent,/Valuation and batch controls/);assert.match(document.querySelector('.sx-handover').textContent,/3100/);api.closeModal();document.body.classList.add('hub-private');assert.throws(()=>ui.handle(solutionButton(document,'learn-inventory',{kind:'map'})),/privacy/);
});
test('Solution Studio learning: Start here explains the journey and guided lessons open the real screens without saving',async t=>{
 const ctx=await app(t),{api,document,db}=ctx,ui=await solutionWorkspace(ctx);await settle();const writes=db.calls.length;
 assert.equal(ui.context().pane,'start');assert.ok(document.querySelector('.sg-welcome'));assert.equal(document.querySelectorAll('.sg-navigation > button').length,7);assert.equal(document.querySelectorAll('.sg-journey-stop').length,5);assert.match(document.querySelector('.sg-start').textContent,/Product \/ group/);
 document.querySelector('[data-ss="tour"]').click();assert.equal(ui.context().pane,'discovery');assert.equal(document.querySelectorAll('.sg-lesson-grid article').length,3);assert.match(document.querySelector('.sg-lesson').textContent,/bearing/i);assert.ok(document.querySelector('.ss-mapping-lines path'));
 document.querySelector('[data-ss="tour-step"][data-index="3"]').click();assert.equal(ui.context().pane,'simulation');assert.ok(document.querySelector('.sg-narrator.is-ready'));document.querySelector('[data-ss="lesson-transaction"]').click();assert.match(document.querySelector('.sg-narrator').textContent,/What just happened/);assert.match(document.querySelector('.sg-balance-changes').textContent,/\+100 units/);assert.match(document.querySelector('.sg-balance-changes').textContent,/\+RM 1,000.00/);
 document.querySelector('[data-ss="tour-step"][data-index="4"]').click();document.querySelector('[data-ss-sim="next"]').click();assert.ok(document.querySelector('.sg-narrator.is-error'));assert.match(document.querySelector('.sg-narrator').textContent,/cannot receive into inventory/);document.querySelector('[data-ss-sim="next"]').click();assert.ok(document.querySelector('.sg-narrator.is-success'));assert.match(document.querySelector('.sg-balance-changes').textContent,/RM 1,200.00/);await settle();assert.equal(db.calls.length,writes);assert.equal(api.state().workhub.solutionStudio.products.length,0);
});
test('Solution Studio learning: three worked cases stay isolated and glossary explains the selected term',async t=>{
 const ctx=await app(t),{api,document,db}=ctx,ui=await solutionWorkspace(ctx);await settle();const writes=db.calls.length;
 for(const [mode,status,stock]of [['valuated','success','100 in inventory'],['quantity','success','100 in inventory'],['nonstock','error','0 in inventory']]){ui.handle(solutionButton(document,'learn-case',{mode}));assert.equal(ui.context().isDemo,true);assert.equal(ui.simulator.snapshot().snap.profile.mode,mode);assert.equal(document.querySelector('[data-sim-status]').dataset.simStatus,status);assert.match(document.querySelector('.ss-theatre-balance').textContent,new RegExp(stock));}
 ui.handle(solutionButton(document,'glossary',{term:'grir'}));assert.equal(document.querySelectorAll('.sg-glossary details').length,19);assert.match(document.querySelector('.sg-glossary details[open]').textContent,/RM 1,200/);assert.equal(ui.simulator.snapshot().playing,false);api.closeModal();await settle();assert.equal(db.calls.length,writes);
});
test('Solution Studio learning: changing playback pace preserves the selected transaction and stopped attempts pause',async t=>{
 const ctx=await app(t),{document,window,intervals}=ctx,ui=await solutionWorkspace(ctx);ui.handle(solutionButton(document,'pane',{pane:'simulation'}));ui.simulator.play();assert.equal(ui.simulator.snapshot().cursor,0);assert.equal(ui.simulator.snapshot().pace,6000);assert.ok(intervals.some(i=>i.ms===6000));
 const control=document.getElementById('ssSimPace');control.value='3500';control.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(ui.simulator.snapshot().cursor,0);assert.equal(ui.simulator.snapshot().playing,true);assert.equal(ui.simulator.snapshot().pace,3500);intervals.findLast(i=>i.ms===3500).callback();assert.equal(ui.simulator.snapshot().cursor,1);assert.match(document.querySelector('.sg-narrator').textContent,/Stock in MAIN/);assert.match(document.querySelector('.sg-narrator').textContent,/Stock in LINE/);
 ui.handle(solutionButton(document,'learn-case',{mode:'nonstock'}));const reset=document.createElement('button');reset.dataset.ssSim='restart';ui.simulator.handle(reset);ui.simulator.play();assert.equal(ui.simulator.snapshot().playing,false);assert.equal(ui.simulator.snapshot().cursor,0);assert.ok(document.querySelector('.sg-narrator.is-error'));
});
test('Solution Studio learning: form guidance and own discovery interview preserve the existing save controls',async t=>{
 const ctx=await app(t),{api,document,db}=ctx,ui=await solutionWorkspace(ctx);ui.proposalEditor(ui.context().proposalId);let form=document.getElementById('ssStudioForm');assert.ok(form.querySelector('.sg-form-help'));assert.equal(form.querySelector('.ss-profile-editor').open,false);const before=ui.data().workhub.solutionStudio.proposals.find(p=>p.id===ui.context().proposalId).profile.poPrice;ui.submit(form);assert.equal(ui.data().workhub.solutionStudio.proposals.find(p=>p.id===ui.context().proposalId).profile.poPrice,before);await settle();const writes=db.calls.length;
 ui.handle(solutionButton(document,'start-interview'));assert.equal(ui.context().isDemo,false);assert.equal(ui.context().pane,'tools');assert.ok(document.getElementById('ssExperienceForm'));assert.equal(api.state().workhub.solutionStudio.products.length,0);await settle();assert.equal(db.calls.length,writes);document.body.classList.add('hub-private');assert.throws(()=>ui.handle(solutionButton(document,'glossary')),/privacy/);
});
test('Solution Studio additions: material wizard, dependent controls and before/after comparisons stay local until saved',async t=>{
 const ctx=await app(t),{api,document,db,window}=ctx,ui=await solutionWorkspace(ctx);await settle();const writes=db.calls.length,x=ui.experience;
 x.handle(experienceButton(document,'wizard'));let f=document.getElementById('ssExperienceForm');fill(f,{kind:'spares',stored:'yes',valued:'no',route:'external'});x.submit(f);assert.match(document.querySelector('.sx-type-title').textContent,/UNBW/);
 x.handle(experienceButton(document,'apply-trial'));assert.equal(ui.simulator.snapshot().snap.profile.mode,'quantity');assert.match(document.querySelector('.sx-comparison').textContent,/Before/);assert.equal(document.querySelectorAll('.sx-storage-zone').length,2);
 f=document.getElementById('ssTrialProfile');f.elements.namedItem('materialValue').checked=true;submitLocal(window,f);assert.equal(ui.simulator.snapshot().snap.profile.mode,'valuated');assert.ok(document.querySelector('.sx-comparison'));
 await settle();assert.equal(db.calls.length,writes);assert.equal(api.state().workhub.solutionStudio.materialTypes.length,0);
});
test('Solution Studio additions: maintained profiles and independent product/proposal snapshots persist and survive ordinary editors',async t=>{
 const ctx=await app(t),{api,document,db}=ctx,ui=await solutionWorkspace(ctx,true),x=ui.experience;
 ui.handle(solutionButton(document,'product-select',{id:api.state().workhub.solutionStudio.products[0].id}));
 x.handle(experienceButton(document,'explorer'));x.handle(experienceButton(document,'type-edit'));let f=document.getElementById('ssExperienceForm');fill(f,{code:'ZSPR',name:'Client bearings',notes:'Confirmed plant 1100'});x.submit(f);await settle();assert.equal(api.state().workhub.solutionStudio.materialTypes[0].code,'ZSPR');
 x.handle(experienceButton(document,'apply-proposal'));x.submit(document.getElementById('ssExperienceForm'));x.handle(experienceButton(document,'apply-product'));x.submit(document.getElementById('ssExperienceForm'));await settle();
 let p=api.state().workhub.solutionStudio.proposals.find(p=>p.id===ui.context().proposalId),product=api.state().workhub.solutionStudio.products.find(p=>p.id===ui.context().productId);assert.equal(p.profile.materialType.code,'ZSPR');assert.equal(product.materialType.code,'ZSPR');
 ui.proposalEditor(p.id);f=document.getElementById('ssStudioForm');f.elements.namedItem('title').value='Revised bearing design';ui.submit(f);ui.productEditor(product.id);f=document.getElementById('ssStudioForm');f.elements.namedItem('name').value='Plant bearing';ui.submit(f);await settle();
 assert.equal(db.row.document.data.workhub.solutionStudio.proposals.find(r=>r.id===p.id).profile.materialType.code,'ZSPR');assert.equal(api.state().workhub.solutionStudio.products.find(r=>r.id===product.id).materialType.code,'ZSPR');
 const restored=await app(t,{remote:copy(db.row),login:false});await restored.api.loadCloud(sessionUser);await solutionWorkspace(restored);assert.equal(restored.api.state().workhub.solutionStudio.materialTypes[0].code,'ZSPR');restored.api.validate(restored.api.state());
});
test('Solution Studio additions: discovery interview previews safe text and creates a company-scoped editable process draft',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,ui=await solutionWorkspace(ctx),x=ui.experience;x.handle(experienceButton(document,'interview'));let f=document.getElementById('ssExperienceForm');fill(f,{name:'Bearing discovery',product:'Maintenance bearing',buy:'Email <img src=x onerror=alert(1)>',store:'Engineering cupboard',consume:'Record the technician and cost centre',pain:'Late usage updates'});f.elements.namedItem('buy').dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(document.querySelector('#sxInterviewPreview img'),null);x.submit(f);assert.equal(ui.data().workhub.solutionStudio.processes.length,9);assert.equal(api.state().workhub.solutionStudio.processes.length,0);
 ui.handle(solutionButton(document,'mine'));x.handle(experienceButton(document,'interview'));f=document.getElementById('ssExperienceForm');fill(f,{name:'New client process',product:'New product',buy:'Buyer orders',store:'Storekeeper records delivery',make:'Production transforms it',pain:'Missing process ownership'});x.submit(f);await settle();const h=api.state().workhub.solutionStudio;assert.equal(h.products.length,1);assert.equal(h.processes[0].steps.length,3);assert.equal(h.processes[0].scenario,'context');assert.equal(h.processes[0].interview.make,'Production transforms it');assert.equal(db.row.document.data.workhub.solutionStudio.processes[0].name,'New client process');api.validate(api.state());
});
test('Solution Studio additions: business rules attach to stable steps, require re-review and reject stale edits',async t=>{
 const ctx=await app(t),{api,document}=ctx,ui=await solutionWorkspace(ctx,true),x=ui.experience;ui.decisionEditor();let f=document.getElementById('ssStudioForm');fill(f,{by:'Owner',outcome:'Agreed',note:'Approved'});ui.submit(f);const proposalId=ui.context().proposalId;
 x.handle(experienceButton(document,'rule-new'));f=document.getElementById('ssExperienceForm');fill(f,{title:'Approval above threshold',condition:'Order > RM5000',response:'Ask manager to approve',owner:'Purchasing',implementation:'Workflow'});f.querySelector('[name="stepIds"]').checked=true;x.submit(f);assert.equal(api.state().workhub.solutionStudio.proposals.find(p=>p.id===proposalId).status,'Under review');ui.handle(solutionButton(document,'pane',{pane:'discovery'}));assert.match(document.querySelector('.sx-rule-badge').textContent,/Approval/);
 const rule=api.state().workhub.solutionStudio.businessRules.at(-1);x.handle(experienceButton(document,'rule-edit',{id:rule.id}));f=document.getElementById('ssExperienceForm');api.mutate(d=>d.workhub.solutionStudio.businessRules.find(r=>r.id===rule.id).response='Fresh response');assert.throws(()=>x.submit(f),/rule changed/);api.closeModal();x.handle(experienceButton(document,'rule-delete',{id:rule.id}));x.submit(document.getElementById('ssExperienceForm'));assert.ok(!api.state().workhub.solutionStudio.businessRules.some(r=>r.id===rule.id));api.validate(api.state());
});
test('Solution Studio additions: preparation checks save independently of agreement and reset visibly for a revised profile',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,ui=await solutionWorkspace(ctx,true),x=ui.experience;ui.decisionEditor();let f=document.getElementById('ssStudioForm');fill(f,{by:'Business owner',outcome:'Agreed',note:'Ready'});ui.submit(f);x.handle(experienceButton(document,'explorer'));x.handle(experienceButton(document,'material-tab',{tab:'preparation'}));
 let checkbox=document.querySelector('[data-sx-check="identity"]');checkbox.checked=true;checkbox.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(api.state().workhub.solutionStudio.preparations.length,1);const id=ui.context().proposalId;assert.equal(api.state().workhub.solutionStudio.proposals.find(p=>p.id===id).status,'Agreed');
 ui.proposalEditor(id);f=document.getElementById('ssStudioForm');f.elements.namedItem('standardPrice').value='11';ui.submit(f);x.handle(experienceButton(document,'explorer'));x.handle(experienceButton(document,'material-tab',{tab:'preparation'}));assert.equal(document.querySelector('[data-sx-check="identity"]').checked,false);assert.match(document.querySelector('.sx-preparation').textContent,/profile changed/);api.validate(api.state());
});
test('Solution Studio additions: warehouse transfers and surprises insert after the selected step with engine-derived document and FI effects',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,ui=await solutionWorkspace(ctx);ui.handle(solutionButton(document,'pane',{pane:'simulation'}));document.querySelector('[data-ss-sim="next"]').click();document.getElementById('ssWarehouseQty').value='15';const source=document.querySelector('[data-ss-stock="MAIN"]'),target=document.querySelector('[data-ss-drop="LINE"]');document.elementFromPoint=()=>target;for(const [type,x,y]of [['pointerdown',20,20],['pointermove',120,50],['pointerup',120,50]]){const event=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:1,button:0,clientX:x,clientY:y});source.dispatchEvent(event);}assert.equal(document.querySelector('.sx-stock-ghost'),null);let snap=ui.simulator.snapshot();assert.equal(snap.actions[1].type,'transfer');assert.equal(snap.actions[1].qty,15);assert.equal(snap.cursor,1);assert.match(document.querySelector('.ss-outcome').textContent,/Stock transferred/);assert.match(document.querySelector('.sx-doc-flow').textContent,/No FI posting/);assert.match(document.querySelector('[data-ss-drop="LINE"]').textContent,/15/);
 document.getElementById('ssWarehouseQty').value='999';document.querySelector('[data-ss-sim="warehouse-transfer"][data-from="MAIN"]').click();assert.equal(document.querySelector('[data-sim-status]').dataset.simStatus,'error');assert.match(document.querySelector('.sx-doc-flow').textContent,/No document/);assert.match(document.querySelector('.sx-account-reason').textContent,/unchanged/);
 document.querySelector('[data-ss-sim="surprise"][data-event="damage"]').click();snap=ui.simulator.snapshot();const damage=snap.actions[snap.cursor];assert.equal(damage.type,'return');assert.equal(damage.reference,snap.actions[0].id);assert.match(document.querySelector('.ss-outcome').textContent,/Supplier return recorded/);assert.equal(api.state().workhub.solutionStudio.runs.length,0);
});
test('Solution Studio additions: workshop captures notes without granting agreement and handover download escapes user content',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,ui=await solutionWorkspace(ctx,true),x=ui.experience;
 x.openWorkshop(3);assert.equal(ui.simulator.snapshot().playing,true);x.handle(experienceButton(document,'workshop-slide',{index:4}));assert.equal(ui.simulator.snapshot().playing,false);let f=document.getElementById('ssWorkshopNoteForm');fill(f,{kind:'Decision',text:'Discuss <script>alert(1)</script> later',by:'PM'});x.submit(f);await settle();assert.equal(api.state().workhub.solutionStudio.workshopNotes.length,1);assert.equal(document.querySelector('#sxWorkshopNotes script'),null);assert.equal(api.state().workhub.solutionStudio.proposals.find(p=>p.id===ui.context().proposalId).status,'Exploring');assert.equal(db.row.document.data.workhub.solutionStudio.workshopNotes[0].kind,'Decision');
 x.handle(experienceButton(document,'close'));x.handle(experienceButton(document,'tools'));x.handle(experienceButton(document,'perspective',{level:'finance'}));assert.match(document.getElementById('sxExplanation').value,/GR\/IR/);x.handle(experienceButton(document,'handover'));assert.match(document.querySelector('.sx-handover').textContent,/DRAFT/);assert.equal(document.querySelector('.sx-handover script'),null);
 let blob;window.URL.createObjectURL=value=>{blob=value;return'blob:qa';};window.URL.revokeObjectURL=()=>{};window.HTMLAnchorElement.prototype.click=function(){assert.equal(this.closest('dialog'),document.getElementById('modal'));};x.handle(experienceButton(document,'download-handover'));const html=await blob.text();assert.match(html,/Business rules/);assert.match(html,/&lt;script&gt;/);assert.ok(!html.includes('<script>'));assert.match(html,/Simulation coverage/);api.validate(api.state());
});
test('Solution Studio additions: replaced forms, changed contexts and screen privacy protect new design tools',async t=>{
 const ctx=await app(t),{api,document}=ctx,ui=await solutionWorkspace(ctx),x=ui.experience;x.handle(experienceButton(document,'interview'));const stale=document.getElementById('ssExperienceForm');x.handle(experienceButton(document,'wizard'));assert.throws(()=>x.submit(stale),/Reopen/);api.closeModal();x.handle(experienceButton(document,'interview'));const old=document.getElementById('ssExperienceForm');ui.handle(solutionButton(document,'mine'));assert.throws(()=>x.submit(old),/Reopen/);document.body.classList.add('hub-private');assert.throws(()=>x.handle(experienceButton(document,'handover')),/privacy/);assert.throws(()=>x.handle(experienceButton(document,'interview')),/privacy/);
});
test('Solution Studio: demo business, guided tour, comparison and edits stay separate from account records',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,ui=await solutionWorkspace(ctx);await settle();const writes=db.calls.length;
 assert.equal(ui.context().isDemo,true);assert.equal(api.state().workhub.solutionStudio.products.length,0);assert.equal(ui.data().workhub.solutionStudio.products.length,5);assert.ok(document.querySelector('.sg-start'));ui.handle(solutionButton(document,'pane',{pane:'discovery'}));assert.ok(document.querySelector('.ss-mapping-lines path'));
 ui.productEditor('demo-bearing');let f=document.getElementById('ssStudioForm');f.elements.namedItem('name').value='Demo bearing <img src=x>';ui.submit(f);assert.equal(document.querySelector('.ss-product-card img'),null);assert.equal(api.state().workhub.solutionStudio.products.length,0);
 ui.handle(solutionButton(document,'compare'));assert.equal(document.querySelectorAll('.ss-comparison tbody tr').length,3);assert.match(document.querySelector('.ss-comparison').textContent,/non-stock|Non-stock/);api.closeModal();
 document.querySelector('[data-ss="tour"]').click();for(let i=0;i<4;i++)document.querySelector('[data-ss="tour-next"]').click();assert.equal(ui.context().pane,'simulation');ui.simulator.advance();assert.equal(document.querySelector('[data-sim-status]').dataset.simStatus,'error');assert.match(document.querySelector('.ss-outcome').textContent,/cannot receive into inventory/);ui.simulator.advance();assert.equal(document.querySelector('[data-sim-status]').dataset.simStatus,'success');assert.match(document.querySelector('.ss-outcome').textContent,/direct consumption/);assert.match(document.querySelector('.ss-theatre-balance').textContent,/0 in inventory/);await settle();assert.equal(db.calls.length,writes);
});
test('Solution Studio: explicit sample copy persists private blueprints, relationships, backups and cloud reopening',async t=>{
 const ctx=await app(t),{api,document,db}=ctx,ui=await solutionWorkspace(ctx,true);const h=api.state().workhub.solutionStudio;
 assert.equal(ui.context().isDemo,false);assert.equal(h.products.length,5);assert.equal(h.processes.length,8);assert.equal(h.proposals.length,10);assert.ok(h.proposals.every(p=>p.status==='Exploring'));assert.equal(h.decisions.length,0);assert.equal(h.runs.length,0);assert.equal(db.row.document.data.workhub.solutionStudio.processes.length,8);assert.equal(api.parseBackup(api.payload(api.state())).workhub.solutionStudio.proposals.length,10);
 ui.productEditor(h.products[0].id);const f=document.getElementById('ssStudioForm');fill(f,{name:'Real flour process',purpose:'Actual client requirement'});ui.submit(f);await settle();assert.equal(db.row.document.data.workhub.solutionStudio.products[0].name,'Real flour process');
 const restored=await app(t,{remote:copy(db.row),login:false});await restored.api.loadCloud(sessionUser);const reopened=await solutionWorkspace(restored);assert.equal(reopened.context().isDemo,false);assert.equal(reopened.data().workhub.solutionStudio.products[0].name,'Real flour process');restored.api.validate(restored.api.state());
});
test('Solution Studio: capture products, company-scoped shared processes, stable steps and business requirements through the forms',async t=>{
 const ctx=await app(t),{api,document,window}=ctx;addCompany(api,document,'Client A');addCompany(api,document,'Client B');await settle();const [a,b]=api.state().projectCompanies,ui=await solutionWorkspace(ctx);
 ui.handle(solutionButton(document,'mine'));for(const [name,company]of [['Part A',a],['Part B',a],['Other company part',b]]){ui.productEditor();const f=document.getElementById('ssStudioForm');fill(f,{name,companyId:company.id,unit:'EA'});ui.submit(f);}
 const [first,second,foreign]=api.state().workhub.solutionStudio.products;ui.processEditor();let f=document.getElementById('ssStudioForm');fill(f,{name:'Shared purchasing',companyId:a.id,objective:'Track requests consistently'});f.elements.namedItem('companyId').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(f.querySelector('[name="productIds"][value="'+foreign.id+'"]'),null);for(const id of [first.id,second.id])f.querySelector('[name="productIds"][value="'+id+'"]').checked=true;ui.submit(f);
 let process=api.state().workhub.solutionStudio.processes[0];assert.deepEqual(copy(process.productIds),[first.id,second.id]);ui.stepEditor('as');f=document.getElementById('ssStudioForm');fill(f,{title:'Email the buyer',actor:'Warehouse team',detail:'Send an Excel request',pain:'Missing approval evidence'});ui.submit(f);const step=api.state().workhub.solutionStudio.processes[0].steps[0];
 ui.requirementEditor();f=document.getElementById('ssStudioForm');fill(f,{text:'Keep approval evidence',acceptance:'The business can retrieve the approved request'});ui.submit(f);ui.proposalEditor();f=document.getElementById('ssStudioForm');fill(f,{title:'SAP PR and PO',approach:'Capture approved purchasing demand'});f.querySelector('[name="requirementIds"]').checked=true;ui.submit(f);ui.stepEditor('to');f=document.getElementById('ssStudioForm');fill(f,{title:'Create a purchase requisition',detail:'Use the agreed approval approach'});f.querySelector('[name="sourceIds"][value="'+step.id+'"]').checked=true;ui.submit(f);
 const proposal=api.state().workhub.solutionStudio.proposals[0];assert.equal(proposal.steps[0].sourceIds[0],step.id);assert.equal(proposal.requirementIds.length,1);assert.equal(document.querySelectorAll('.ss-proposal-card').length,1);ui.handle(solutionButton(document,'pane',{pane:'discovery'}));assert.ok(document.querySelector('.ss-mapping-lines path'));api.validate(api.state());
});
test('Solution Studio: feedback gates delivery creation and creates valid project work once with acceptance notes',async t=>{
 const ctx=await app(t),{api,document,db}=ctx,ui=await solutionWorkspace(ctx,true);ui.handle(solutionButton(document,'pane',{pane:'decisions'}));assert.equal(document.querySelector('[data-ss="delivery"]'),null);
 ui.decisionEditor();let f=document.getElementById('ssStudioForm');fill(f,{by:'Client process owner',outcome:'Agreed',note:'Approved after workshop'});ui.submit(f);await settle();const proposal=api.state().workhub.solutionStudio.proposals.find(x=>x.id===ui.context().proposalId);assert.equal(proposal.status,'Agreed');assert.ok(document.querySelector('[data-ss="delivery"]'));
 document.querySelector('[data-ss="delivery"]').click();f=document.getElementById('ssStudioForm');f.elements.namedItem('title').value='Implement agreed ingredient process';ui.submit(f);await settle();assert.equal(api.state().specs.length,1);assert.equal(api.state().tasks.length,3);assert.equal(api.state().workhub.solutionStudio.deliveries[0].tests.length,2);assert.ok(api.state().tasks.every(t=>t.taskType==='Project'&&t.linkId===api.state().activeProjectId));assert.equal(db.row.document.data.workhub.solutionStudio.deliveries.length,1);assert.ok(document.querySelector('.ss-delivery-detail'));
 api.closeModal();ui.handle(solutionButton(document,'delivery'));f=document.getElementById('ssStudioForm');ui.submit(f);assert.equal(api.state().tasks.length,3);api.validate(api.state());api.closeModal();ui.proposalEditor(proposal.id);f=document.getElementById('ssStudioForm');f.elements.namedItem('approach').value='Revised approach';ui.submit(f);assert.equal(api.state().workhub.solutionStudio.proposals.find(x=>x.id===proposal.id).status,'Under review');assert.equal(api.state().workhub.solutionStudio.decisions.length,1);
});
test('Solution Studio: transfer playback, rule failures and trial inputs remain local until an explicit saved run',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,ui=await solutionWorkspace(ctx,true);ui.handle(solutionButton(document,'pane',{pane:'simulation'}));await settle();const writes=db.calls.length;
 ui.simulator.advance();ui.simulator.advance();assert.equal(document.querySelector('[data-sim-status]').dataset.simStatus,'success');assert.match(document.querySelector('.ss-outcome').textContent,/transferred/);assert.match(document.querySelector('.ss-location-balances').textContent,/LINE 20 units/);assert.match(document.querySelector('.ss-location-balances').textContent,/MAIN 80 units/);
 document.querySelector('[data-ss-sim="invalid"]').click();assert.equal(document.querySelector('[data-sim-status]').dataset.simStatus,'error');assert.match(document.querySelector('.ss-outcome').textContent,/Insufficient unrestricted stock/);const before=ui.simulator.snapshot().snap.profile.poPrice;let f=document.getElementById('ssTrialProfile');f.elements.namedItem('poPrice').value='15';submitLocal(window,f);assert.equal(ui.simulator.snapshot().snap.profile.poPrice,15);assert.equal(api.state().workhub.solutionStudio.proposals.find(x=>x.id===ui.context().proposalId).profile.poPrice,before);await settle();assert.equal(db.calls.length,writes);
 document.querySelector('[data-ss-sim="save"]').click();f=document.getElementById('ssStudioForm');f.elements.namedItem('title').value='Workshop what-if';ui.submit(f);await settle();const saved=api.state().workhub.solutionStudio.runs[0];assert.equal(saved.snapshot.profile.poPrice,15);assert.equal(saved.actions.length,5);assert.equal(db.row.document.data.workhub.solutionStudio.runs[0].title,'Workshop what-if');ui.proposalEditor(ui.context().proposalId);f=document.getElementById('ssStudioForm');f.elements.namedItem('poPrice').value='99';ui.submit(f);ui.handle(solutionButton(document,'runs'));document.querySelector('[data-ss="run-open"][data-id="'+saved.id+'"]').click();assert.equal(ui.simulator.snapshot().snap.profile.poPrice,15);assert.match(document.querySelector('.ss-sim-heading').textContent,/Workshop what-if/);api.validate(api.state());
});
test('Solution Studio: saved transfer cancellation keeps its original reference when editing and replaying',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,ui=await solutionWorkspace(ctx);await settle();const writes=db.calls.length;
 const run=ui.data().workhub.solutionStudio.runs.find(r=>r.title==='311 transfer and 312 cancellation');ui.handle(solutionButton(document,'run-open',{id:run.id}));ui.simulator.advance();ui.simulator.advance();ui.simulator.advance();assert.equal(document.querySelector('[data-sim-status]').dataset.simStatus,'success');assert.match(document.querySelector('.ss-outcome').textContent,/cancelled/);
 document.querySelector('[data-ss-sim="edit"][data-id="'+run.actions[2].id+'"]').click();const f=document.getElementById('ssTransactionForm');assert.equal(f.elements.namedItem('reference').value,run.actions[1].id);submitLocal(window,f);assert.equal(document.querySelector('[data-sim-status]').dataset.simStatus,'success');assert.match(document.querySelector('.ss-location-balances').textContent,/MAIN 100 units/);assert.equal(ui.simulator.snapshot().actions[2].reference,run.actions[1].id);await settle();assert.equal(db.calls.length,writes);
});
test('Solution Studio: stale edits, replaced forms, privacy and account changes cannot overwrite business records',async t=>{
 const ctx=await app(t),{api,document}=ctx,ui=await solutionWorkspace(ctx,true),product=api.state().workhub.solutionStudio.products[0];ui.productEditor(product.id);let stale=document.getElementById('ssStudioForm');stale.elements.namedItem('name').value='Stale overwrite';api.mutate(d=>d.workhub.solutionStudio.products[0].name='Fresh update');assert.throws(()=>ui.submit(stale),/record changed/);assert.equal(api.state().workhub.solutionStudio.products[0].name,'Fresh update');
 ui.productEditor(product.id);stale=document.getElementById('ssStudioForm');ui.productEditor();assert.throws(()=>ui.submit(stale),/Reopen/);api.closeModal();document.body.classList.add('hub-private');assert.throws(()=>ui.productEditor(product.id),/screen privacy/);document.body.classList.remove('hub-private');ui.productEditor(product.id);stale=document.getElementById('ssStudioForm');api.cloud.user={id:'another-owner'};api.showTab('home');assert.equal(document.getElementById('modal').open,false);assert.throws(()=>ui.submit(stale),/Reopen/);assert.equal(ui.simulator.snapshot().snap,null);
});

function standupFixture(api,document){
 api.editRecord('specs');let f=document.getElementById('editForm');f.elements.namedItem('description').value='PO configuration';f.elements.namedItem('status').value='In Progress';f.elements.namedItem('remarks').value='Core setup ready';api.saveEdit(f);const item=api.state().specs.at(-1);
 for(const [title,status,remarks]of [['Standard PO','Completed','Tested successfully'],['Subcontracting','Blocked','Awaiting business reply']]){api.editSubItem(item.id);f=document.getElementById('subItemForm');f.elements.namedItem('title').value=title;f.elements.namedItem('status').value=status;f.elements.namedItem('remarks').value=remarks;api.saveSubItem(f);}
 api.closeModal();return api.state().specs.find(r=>r.id===item.id);
}

function peopleFixture(api,document,window){
 api.showTab('specs');document.querySelector('[data-action="project-view"][data-view="people"]').click();
 const ui=api.hub.people;
 for(const [name,email,department,title]of [['Aisyah','aisyah@example.com','Purchasing','Business owner'],['Daniel','daniel@example.com','Purchasing','Buyer']]){
  ui.personEditor();const f=document.getElementById('peForm');for(const [key,value]of Object.entries({name,email,department,title}))f.elements.namedItem(key).value=value;ui.submit(f);
 }
 const people=api.state().workhub.projectPeople.people;
 ui.personEditor(people[1].id);let f=document.getElementById('peForm');f.elements.namedItem('managerId').value=people[0].id;ui.submit(f);
 ui.activityEditor();f=document.getElementById('peForm');f.elements.namedItem('name').value='Create PO';ui.submit(f);
 return{ui,manager:api.state().workhub.projectPeople.people[0],buyer:api.state().workhub.projectPeople.people[1],activity:api.state().workhub.projectPeople.activities[0]};
}

test('people: project workspace saves contacts and assignments together, restores them and keeps MM area IDs',async t=>{
 const {api,document,window,db}=await app(t),{ui,buyer,activity}=peopleFixture(api,document,window);await settle();
 ui.place(buyer.id,{type:'activity',id:activity.id});await settle();
 assert.equal(api.state().workhub.projectPeople.assignments.length,1);assert.equal(db.row.document.data.workhub.projectPeople.assignments[0].personId,buyer.id);
 ui.place(buyer.id,{type:'activity',id:activity.id});assert.equal(api.state().workhub.projectPeople.assignments.length,1);
 ui.details(buyer.id);assert.match(document.querySelector('.pe-person-detail').textContent,/Create PO/);
 const link=api.state().workhub.projectPeople.assignments[0];ui.assignmentEditor(buyer.id,link.id);const f=document.getElementById('peForm');f.elements.namedItem('role').value='Tester';f.elements.namedItem('scope').value='Plant 1100';f.elements.namedItem('notes').value='UAT owner';ui.submit(f);await settle();
 const restored=api.parseBackup(api.payload(api.state()));assert.equal(restored.workhub.projectPeople.assignments[0].scope,'Plant 1100');assert.equal(restored.workhub.projectPeople.assignments[0].role,'Tester');
 const areaId=activity.areaId;api.mutate(d=>{d.projects[0].mmAreas.find(a=>a.id===areaId).name='Procurement renamed';});ui.details(buyer.id);assert.match(document.querySelector('.pe-person-detail').textContent,/Procurement renamed/);
});

test('people: drag-drop and tap mapping use the same assignment path and reverse lookup is local',async t=>{
 const {api,document,window,db}=await app(t),{buyer,activity}=peopleFixture(api,document,window);await settle();const calls=db.calls.length;
 const chip=document.querySelector('[data-chip-type="activity"][data-id="'+activity.id+'"]');chip.click();assert.ok(document.querySelector('.pe-armed-bar'));document.querySelector('[data-pe="place"][data-id="'+buyer.id+'"]').click();await settle();assert.equal(api.state().workhub.projectPeople.assignments.length,1);
 const payload={owner:api.cloud.user.id,projectId:api.state().activeProjectId,type:'area',id:api.state().projects[0].mmAreas[0].id};
 const card=document.querySelector('[data-pe-person="'+buyer.id+'"]'),event=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(event,'dataTransfer',{value:{getData:()=>JSON.stringify(payload)}});card.dispatchEvent(event);await settle();assert.equal(api.state().workhub.projectPeople.assignments.length,2);
 const pointerChip=document.querySelector('[data-chip-type="area"][data-id="'+api.state().projects[0].mmAreas[1].id+'"]');document.elementFromPoint=()=>document.querySelector('[data-pe-person="'+buyer.id+'"]');
 for(const [type,x,y]of [['pointerdown',20,20],['pointermove',160,80],['pointerup',160,80]]){const e=new window.Event(type,{bubbles:true,cancelable:true});for(const [k,v]of Object.entries({pointerId:7,button:0,clientX:x,clientY:y}))Object.defineProperty(e,k,{value:v});(type==='pointerdown'?pointerChip:document).dispatchEvent(e);}
 await settle();assert.equal(api.state().workhub.projectPeople.assignments.length,3);assert.equal(document.querySelector('.pe-drag-ghost'),null);
 const before=db.calls.length;document.querySelector('[data-pe="lookup-activity"][data-id="'+activity.id+'"]').click();assert.equal(document.querySelectorAll('[data-pe-person]').length,1);assert.ok(document.querySelector('.pe-filter-notice'));assert.equal(db.calls.length,before);assert.ok(before>calls);
});

test('people: stale editors, replaced forms and foreign-account drops cannot overwrite contacts',async t=>{
 const {api,document,window}=await app(t),{ui,buyer,activity}=peopleFixture(api,document,window);await settle();
 ui.personEditor(buyer.id);let stale=document.getElementById('peForm');stale.elements.namedItem('name').value='Outdated';api.mutate(d=>d.workhub.projectPeople.people.find(p=>p.id===buyer.id).title='New title');assert.throws(()=>ui.submit(stale),/record changed/);assert.equal(api.state().workhub.projectPeople.people[1].name,'Daniel');
 ui.personEditor(buyer.id);stale=document.getElementById('peForm');ui.personEditor();assert.throws(()=>ui.submit(stale),/Reopen/);
 ui.personEditor(buyer.id);stale=document.getElementById('peForm');api.cloud.user={id:'another-owner'};api.showTab('home');assert.equal(document.getElementById('modal').open,false);assert.throws(()=>ui.submit(stale),/Reopen|signing in/);
 api.showTab('specs');document.querySelector('[data-action="project-view"][data-view="people"]').click();await settle();const event=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(event,'dataTransfer',{value:{getData:()=>JSON.stringify({owner:'old-owner',projectId:api.state().activeProjectId,type:'activity',id:activity.id})}});document.querySelector('[data-pe-person]').dispatchEvent(event);assert.equal(api.state().workhub.projectPeople.assignments.length,0);
});

test('people: pointer movement saves once, keyboard arrangement preserves assignments and privacy blocks exports',async t=>{
 const {api,document,window,db}=await app(t),{ui,buyer,activity}=peopleFixture(api,document,window);ui.place(buyer.id,{type:'activity',id:activity.id});await settle();
 document.querySelector('[data-pe="chart"]').click();const handle=document.querySelector('[data-pe-move="'+buyer.id+'"]'),x=api.state().workhub.projectPeople.people[1].x,calls=db.calls.length;
 function pointer(type,target,px,py){const e=new window.Event(type,{bubbles:true,cancelable:true});for(const [k,v]of Object.entries({pointerId:3,button:0,clientX:px,clientY:py}))Object.defineProperty(e,k,{value:v});target.dispatchEvent(e);}
 pointer('pointerdown',handle,100,100);pointer('pointermove',document,160,145);await settle();assert.equal(db.calls.length,calls);pointer('pointerup',document,160,145);await settle();assert.equal(db.calls.length,calls+1);assert.equal(api.state().workhub.projectPeople.people[1].x,x+60);assert.equal(api.state().workhub.projectPeople.assignments.length,1);
 document.querySelector('[data-pe-move="'+buyer.id+'"]').dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(api.state().workhub.projectPeople.people[1].x,x+84);
 const viewport=document.getElementById('peViewport'),tray=document.querySelector('.pe-area-list');viewport.scrollLeft=40;viewport.scrollTop=80;viewport.dispatchEvent(new window.Event('scroll'));tray.scrollTop=90;tray.dispatchEvent(new window.Event('scroll'));document.querySelector('[data-pe="zoom-in"]').click();assert.equal(document.getElementById('peViewport').scrollTop,80);assert.equal(document.querySelector('.pe-area-list').scrollTop,90);
 document.body.classList.add('hub-private');await assert.rejects(ui.exportFile('excel'),/screen privacy/);document.body.classList.remove('hub-private');
});

test('people: Excel is project-scoped, text-safe, complete and cancelled if the account changes',async t=>{
 const {api,document,window}=await app(t),{ui,buyer,activity}=peopleFixture(api,document,window);ui.place(buyer.id,{type:'activity',id:activity.id});await settle();
 const E=window.WorkHubProjectPeopleEngine,sheets=E.sheets(api.state(),api.state().activeProjectId);assert.deepEqual(Array.from(sheets,s=>s.name),['People','Responsibility Assignments','Unassigned Activities','Area Coverage']);
 let finish;window.WorkHubProjectPeopleFiles.excel=()=>new Promise(resolve=>finish=resolve);const exporting=ui.exportFile('excel');api.cloud.user={id:'next-account'};api.showTab('home');finish(new window.Blob(['demo']));await assert.rejects(exporting,/Reopen/);
});

test('stand-up: overview card opens all item and sub-item remarks with independent progress and update times',async t=>{
 const {api,document,db}=await app(t),item=standupFixture(api,document);await settle();api.showTab('specs');const calls=db.calls.length;
 document.querySelector('.standup-overview-card').click();assert.ok(document.getElementById('modal').classList.contains('standup-dialog'));
 assert.equal(document.querySelectorAll('.standup-item').length,1);assert.equal(document.querySelectorAll('.standup-sub-row').length,2);assert.match(document.querySelector('.standup-report').textContent,/Core setup ready/);assert.match(document.querySelector('.standup-report').textContent,/Awaiting business reply/);
 assert.equal(document.querySelector('[aria-label="Project items completed"]').getAttribute('aria-valuenow'),'0');assert.equal(document.querySelector('[aria-label="Sub-items completed"]').getAttribute('aria-valuenow'),'50');assert.ok(document.querySelector('time[datetime]'));assert.equal(db.calls.length,calls);
 document.querySelector('[data-standup="collapse"]').click();assert.equal(document.querySelector('.standup-item').open,false);document.querySelector('[data-standup="expand"]').click();assert.equal(document.querySelector('.standup-item').open,true);assert.equal(api.state().specs[0].id,item.id);
});

test('stand-up: live search keeps sub-item context, highlights safely and restores collapsed groups without saves',async t=>{
 const {api,document,window,db}=await app(t),first=standupFixture(api,document),second=standupFixture(api,document);
 api.mutate(d=>{const a=d.specs.find(r=>r.id===first.id),b=d.specs.find(r=>r.id===second.id);a.itemId=a.ricefw='MM-042';a.subItems[1].remarks='Awaiting business reply <img src=x onerror=alert(1)>';b.description='Invoice verification';b.remarks='Finance sign-off';b.status='Completed';b.subItems=[];});await settle();
 api.hub.standup.open(first.projectId);document.querySelector('[data-standup="collapse"]').click();const calls=db.calls.length,input=document.getElementById('standupSearch');
 const search=q=>{input.value=q;input.dispatchEvent(new window.Event('input',{bubbles:true}));};
 search('MM-042 business');assert.equal(document.querySelectorAll('.standup-item:not([hidden])').length,1);assert.equal(document.querySelector('.standup-item:not([hidden])').open,true);assert.equal(document.querySelectorAll('.standup-sub-row').length,2);assert.match(document.querySelector('.standup-sub-row.is-search-match').textContent,/Subcontracting/);assert.match(document.getElementById('standupSearchResults').textContent,/1 of 2 project items · 1 matching sub-item/);assert.ok(document.querySelector('.standup-item mark'));assert.equal(document.querySelector('[aria-label="Project items completed"]').getAttribute('aria-valuenow'),'50');
 search('<img');assert.equal(document.querySelector('.standup-report img'),null);assert.equal(document.querySelector('.standup-remarks mark').textContent,'<img');
 search('missing.*');assert.equal(document.querySelectorAll('.standup-item:not([hidden])').length,0);assert.equal(document.querySelector('.standup-no-results').hidden,false);
 document.querySelector('[data-standup="clear-search"]').click();assert.equal(input.value,'');assert.equal(document.activeElement,input);assert.equal(document.querySelectorAll('.standup-item:not([hidden])').length,2);assert.ok([...document.querySelectorAll('.standup-item')].every(el=>!el.open));assert.equal(document.querySelector('.standup-report mark'),null);assert.equal(db.calls.length,calls);
});

test('stand-up: search survives refreshes and Action saves, preserves drafts and resets on reopen or account change',async t=>{
 const {api,document,window}=await app(t),item=standupFixture(api,document),ui=api.hub.standup;ui.open(item.projectId);
 const search=q=>{const input=document.getElementById('standupSearch');input.value=q;input.dispatchEvent(new window.Event('input',{bubbles:true}));return input;};
 search('PO');document.querySelector('.standup-sub-row [data-standup="add"]').click();let form=document.getElementById('standupActionForm');form.elements.namedItem('text').value='Email the business owner';submitLocal(window,form);await settle();assert.equal(document.getElementById('standupSearch').value,'PO');
 const task=api.state().tasks[0];let input=search('email');input.focus();input.setSelectionRange(2,4);api.hub.moveTask(task.id,'blocked');await settle();input=document.getElementById('standupSearch');assert.equal(input.value,'email');assert.equal(document.activeElement,input);assert.equal(input.selectionStart,2);assert.equal(input.selectionEnd,4);assert.match(document.querySelector('.standup-item:not([hidden])').textContent,/Blocked/);
 document.querySelector('.standup-sub-row [data-standup="add"]').click();form=document.getElementById('standupActionForm');form.elements.namedItem('text').value='Unsaved instruction';search('no-match');assert.equal(document.getElementById('standupActionForm'),form);document.querySelector('[data-standup="clear-search"]').click();assert.equal(form.elements.namedItem('text').value,'Unsaved instruction');assert.equal(api.state().tasks.length,1);document.querySelector('[data-standup="cancel-action"]').click();
 search('email');api.closeModal();ui.open(item.projectId);assert.equal(document.getElementById('standupSearch').value,'');search('private term');api.cloud.user={id:'next-account'};api.showTab('home');assert.equal(document.getElementById('modal').open,false);api.login();ui.open(item.projectId);assert.equal(document.getElementById('standupSearch').value,'');
});

test('stand-up: saving Actions creates linked tasks once, persists together and shows task completion',async t=>{
 const {api,document,window,db}=await app(t),item=standupFixture(api,document),ui=api.hub.standup;ui.open(item.projectId);
 document.querySelector('.standup-sub-row [data-standup="add"]').click();let f=document.getElementById('standupActionForm');f.elements.namedItem('text').value='Email the business team';f.elements.namedItem('dueDate').value='2026-10-23';submitLocal(window,f);await settle();
 let action=api.state().workhub.projectStandup.actions[0],task=api.state().tasks[0];assert.equal(task.taskType,'Project');assert.equal(task.linkId,item.projectId);assert.equal(action.subItemId,item.subItems[0].id);assert.equal(task.task,'Email the business team');assert.equal(db.row.document.data.tasks[0].id,action.taskId);assert.equal(db.row.document.data.workhub.projectStandup.actions[0].taskId,task.id);
 document.querySelector('[data-standup="edit"]').click();f=document.getElementById('standupActionForm');f.elements.namedItem('text').value='Email the confirmed details';submitLocal(window,f);await settle();assert.equal(api.state().tasks.length,1);assert.equal(api.state().tasks[0].task,'Email the confirmed details');
 api.hub.moveTask(task.id,'done');await settle();assert.match(document.querySelector('.standup-actions').closest('.standup-item').textContent,/Completed/);assert.equal(api.state().specs[0].status,'In Progress');
 const restored=api.parseBackup(api.payload(api.state()));assert.equal(restored.workhub.projectStandup.actions[0].taskId,task.id);assert.equal(restored.tasks[0].done,true);
});

test('stand-up: task details and task editing retain the source link and synchronize instruction edits',async t=>{
 const {api,document,window}=await app(t),item=standupFixture(api,document),ui=api.hub.standup;ui.open(item.projectId);document.querySelector('[data-standup="add"]').click();let f=document.getElementById('standupActionForm');f.elements.namedItem('text').value='Request feedback';submitLocal(window,f);await settle();const task=api.state().tasks[0];
 document.querySelector('[data-standup="task"]').click();await settle();assert.match(document.querySelector('.standup-task-context').textContent,/PO configuration/);document.querySelector('[data-standup="source"]').click();assert.ok(document.querySelector('.standup-report'));
 api.editRecord('tasks',task.id);assert.equal(document.getElementById('modal').classList.contains('standup-dialog'),false);f=document.getElementById('editForm');f.elements.namedItem('task').value='Request updated feedback';f.elements.namedItem('feedback').value='Keep this feedback';api.saveEdit(f);await settle();assert.equal(api.state().workhub.projectStandup.actions[0].text,'Request updated feedback');ui.open(item.projectId);assert.match(document.querySelector('.standup-report').textContent,/Request updated feedback/);api.showTab('tasks');assert.ok(document.querySelector('#view .standup-task-context'));assert.equal(api.state().tasks[0].feedback,'Keep this feedback');
});

test('stand-up: cancelled drafts do not create tasks and account changes close the private report',async t=>{
 const {api,document}=await app(t),item=standupFixture(api,document),ui=api.hub.standup;ui.open(item.projectId);document.querySelector('[data-standup="add"]').click();const form=document.getElementById('standupActionForm');form.elements.namedItem('text').value='Private draft';document.querySelector('[data-standup="cancel-action"]').click();assert.equal(api.state().tasks.length,0);assert.equal(api.state().workhub.projectStandup.actions.length,0);
 document.querySelector('[data-standup="add"]').click();const stale=document.getElementById('standupActionForm');stale.elements.namedItem('text').value='Old account instruction';api.cloud.user={id:'22222222-2222-4222-8222-222222222222'};api.showTab('home');assert.equal(document.getElementById('modal').open,false);assert.throws(()=>ui.saveAction(stale),/signing in/);assert.equal(api.state().tasks.length,0);
});

test('startup: signed-out visitors see the modern sign-in screen after layout preparation',async t=>{
 const {document,window,db}=await app(t,{login:false,styles:true});
 assert.equal(document.documentElement.hasAttribute('data-workhub-startup'),false);
 assert.ok(document.getElementById('hubHeader'));assert.ok(document.getElementById('hubShell'));
 assert.equal(document.getElementById('cloudGate').hidden,false);assert.equal(document.getElementById('tabs').hidden,true);
 assert.notEqual(window.getComputedStyle(document.querySelector('body > header')).visibility,'hidden');
 assert.equal(document.getElementById('workhubStartup').getAttribute('aria-hidden'),'true');assert.equal(db.calls.length,0);
});

test('startup: returning visitors stay covered through session lookup and slow record loading',async t=>{
 let resolveSession,resolveRow;const session=new Promise(resolve=>resolveSession=resolve),row=new Promise(resolve=>resolveRow=resolve);
 const {document,window,api,db}=await app(t,{login:false,sessionLookup:()=>session,read:()=>row});
 assert.equal(document.documentElement.dataset.workhubStartup,'loading');assert.equal(window.getComputedStyle(document.querySelector('body > header')).visibility,'hidden');
 resolveSession({data:{session:{user:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.com'}}},error:null});await settle();
 assert.equal(document.documentElement.dataset.workhubStartup,'loading');assert.match(document.getElementById('workhubStartupStatus').textContent,/Opening your records/);
 const data=api.emptyState();data.workhub.preferences.workspace='A calm desk';data.workhub.preferences.theme='forest';
 resolveRow({data:{document:JSON.parse(api.payload(data)),revision:1,mutation_id:'initial'},error:null});await settle();
 assert.equal(api.cloud.ready,true);assert.equal(document.documentElement.hasAttribute('data-workhub-startup'),false);
 assert.equal(document.getElementById('hubSiteTitle').textContent,'A calm desk');assert.equal(document.body.dataset.hubTheme,'forest');assert.equal(document.getElementById('cloudGate').hidden,true);assert.equal(db.calls.length,0);
});

test('startup: a renamed website stays branded during reload and follows verified account changes',async t=>{
 const seed=await app(t);seed.api.mutate(d=>{d.workhub.preferences.workspace='My renamed space 🌿';});await settle();
 const storage=Object.fromEntries(Array.from({length:seed.window.localStorage.length},(_,i)=>{const k=seed.window.localStorage.key(i);return[k,seed.window.localStorage.getItem(k)];}));
 storage['mm-tracker.auth.v1:aaotojqkiewbhtnrlcur']=JSON.stringify({user:{id:seed.api.cloud.user.id}});
 let resolveSession,resolveRow;const session=new Promise(resolve=>resolveSession=resolve),row=new Promise(resolve=>resolveRow=resolve);
 const ctx=await app(t,{login:false,storage,sessionLookup:()=>session,read:()=>row}),{api,document,db}=ctx,brand=document.getElementById('workhubStartupBrand');
 assert.equal(brand.textContent,'My renamed space 🌿');assert.equal(document.title,'My renamed space 🌿');assert.equal(document.documentElement.dataset.workhubStartup,'loading');
 resolveSession({data:{session:{user:{id:seed.api.cloud.user.id}}},error:null});await settle();assert.equal(brand.textContent,'My renamed space 🌿');
 const data=seed.api.emptyState();data.workhub.preferences.workspace='Renamed on another device';resolveRow({data:{document:JSON.parse(seed.api.payload(data)),revision:2,mutation_id:'remote'},error:null});await settle();
 assert.equal(brand.textContent,'Renamed on another device');assert.equal(document.getElementById('hubSiteTitle').textContent,brand.textContent);assert.equal(db.calls.length,0);
 db.read=()=>new Promise(()=>{});void api.loadCloud({user:{id:'22222222-2222-4222-8222-222222222222'}});await settle();assert.equal(brand.textContent,'Your workspace');
 await api.loadCloud(null);assert.equal(brand.textContent,'Your workspace');assert.equal(db.calls.length,0);
});

test('startup: failed session lookup exposes styled recovery for returned and rejected errors',async t=>{
 for(const sessionLookup of [async()=>({data:{session:null},error:{message:'Session unavailable'}}),async()=>{throw Error('Network unavailable');}]){
  const {document,api,db}=await app(t,{login:false,sessionLookup});
  assert.equal(document.documentElement.hasAttribute('data-workhub-startup'),false);assert.ok(document.getElementById('hubHeader'));assert.equal(api.cloud.error,true);
  assert.equal(document.getElementById('storageNotice').hidden,false);assert.equal(document.getElementById('cloudGate').hidden,false);assert.equal(db.calls.length,0);
 }
});

test('startup: offline record loading opens an existing recovery copy or the styled retry notice',async t=>{
 const seed=await app(t,{login:false}),data=seed.api.emptyState();data.workhub.preferences.workspace='My cached workspace';
 const key='mm-tracker.cloud.v1:aaotojqkiewbhtnrlcur:11111111-1111-4111-8111-111111111111',cache=JSON.stringify({document:JSON.parse(seed.api.payload(data)),revision:1,pending:null,inFlight:null,baseDocument:null});
 for(const storage of [{[key]:cache},{}]){
  const {document,api,db}=await app(t,{login:false,storage,sessionLookup:async()=>({data:{session:{user:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.com'}}},error:null}),read:async()=>({data:null,error:{message:'Failed to fetch'}})});
  assert.equal(document.documentElement.hasAttribute('data-workhub-startup'),false);assert.equal(document.getElementById('storageNotice').hidden,false);assert.equal(db.calls.length,0);
  assert.equal(api.cloud.ready,!!storage[key]);assert.equal(document.getElementById('cloudGate').hidden,!!storage[key]);
  if(storage[key])assert.equal(document.getElementById('hubSiteTitle').textContent,'My cached workspace');
 }
});

test('startup: an unavailable sign-in client leaves a usable modern recovery screen',async t=>{
 const {document,api,db}=await app(t,{login:false,cloudClient:false});
 assert.equal(document.documentElement.hasAttribute('data-workhub-startup'),false);assert.equal(api.cloud.error,true);assert.match(document.getElementById('storageNotice').textContent,/Cloud sign-in could not load/);assert.ok(document.getElementById('hubShell'));assert.equal(db.calls.length,0);
});

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

test('task quick feedback appends a save-time timestamp without changing remarks, children or other tasks',async t=>{
 const {api,document,window,db}=await app(t),id=addMainTask(api,document,'Stock <review>');await settle();
 addTaskSub(api,document,id,'Check receipt','Child remarks','Child feedback','Blocked');await settle();
 const other=addMainTask(api,document,'Unrelated task');await settle();
 api.mutate(d=>{const task=d.tasks.find(x=>x.id===id);task.remarks='Keep these remarks';task.feedback='Earlier feedback';});await settle();
 const before=copy(api.state().tasks.find(x=>x.id===id)),unrelated=copy(api.state().tasks.find(x=>x.id===other));
 const RealDate=window.Date;let time='2026-10-21T09:00:00';window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[time]));}static now(){return new RealDate(time).getTime();}};
 api.showTab('tasks');const calls=db.calls.length,button=document.querySelector('[data-hub="task-feedback"][data-id="'+id+'"]');assert.ok(button);assert.equal(document.querySelectorAll('[data-hub="task-feedback"][data-id="'+id+'"]').length,1);button.click();await settle();
 const form=document.getElementById('hubTaskFeedback');assert.ok(form);assert.equal(document.getElementById('editForm'),null);assert.equal(form.querySelector('h3').textContent,'Stock <review>');assert.equal(form.elements.namedItem('feedback').value,'');assert.match(form.querySelector('details').textContent,/Earlier feedback/);assert.equal(db.calls.length,calls);
 time='2026-10-21T10:37:00';form.elements.namedItem('feedback').value='  Confirmed <script>alert(1)</script>\nReady for testing  ';form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();
 const feedback='Earlier feedback\n\nConfirmed <script>alert(1)</script>\nReady for testing [21-10-2026 10:37]';
 assert.deepEqual(copy(api.state().tasks.find(x=>x.id===id)),{...before,feedback});assert.deepEqual(copy(api.state().tasks.find(x=>x.id===other)),unrelated);assert.equal(document.getElementById('modal').open,false);assert.equal(db.calls.length,calls+1);assert.equal(db.row.document.data.tasks.find(x=>x.id===id).feedback,feedback);assert.equal(document.querySelector('#view script'),null);assert.match(document.querySelector('.task-parent-notes').textContent,/21-10-2026 10:37/);
 api.hub.submit(form);await settle();assert.equal(db.calls.length,calls+1);
 assert.equal(api.parseBackup(api.payload(api.state())).tasks.find(x=>x.id===id).feedback,feedback);
 const report=window.WorkHubReports.files(api.state(),{asOf:'2026-10-21'});assert.ok(report.model.sheets.find(s=>s.name==='Task notes').rows.some(row=>row.values.includes(feedback)));
 const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);await settle();assert.equal(reopened.api.state().tasks.find(x=>x.id===id).feedback,feedback);
});

test('task quick feedback is available from the board and Details; opening and cancelling never saves',async t=>{
 const {api,document,db}=await app(t),id=addMainTask(api,document,'Board feedback');await settle();api.hub.setBoard(true);api.showTab('tasks');const calls=db.calls.length;
 const card=document.querySelector('[data-task-card="'+id+'"]');card.querySelector('[data-hub="task-feedback"]').click();await settle();assert.ok(document.getElementById('hubTaskFeedback'));document.querySelector('#hubTaskFeedback [data-hub="close"]').click();await settle();assert.equal(document.getElementById('modal').open,false);assert.equal(db.calls.length,calls);
 card.querySelector('[data-hub="task-detail"]').click();await settle();document.querySelector('#modalBody [data-hub="task-feedback"]').click();await settle();const form=document.getElementById('hubTaskFeedback');form.elements.namedItem('feedback').value='Board update';api.hub.submit(form);await settle();assert.match(api.state().tasks[0].feedback,/^Board update \[\d{2}-\d{2}-\d{4} \d{2}:\d{2}\]$/);assert.equal(db.calls.length,calls+1);
});

test('task quick feedback keeps the draft on blank, full-history and conflicting saves',async t=>{
 const {api,document,db}=await app(t),id=addMainTask(api,document,'Feedback limits');await settle();await hubAction(api,'task-feedback',{id});let form=document.getElementById('hubTaskFeedback'),calls=db.calls.length;form.elements.namedItem('feedback').value=' \n ';assert.throws(()=>api.hub.submit(form),/Enter feedback/);assert.equal(document.getElementById('modal').open,true);assert.equal(db.calls.length,calls);
 form.elements.namedItem('feedback').value='Keep this draft';api.cloud.conflict=true;assert.throws(()=>api.hub.submit(form),/reload cloud records/);assert.equal(form.elements.namedItem('feedback').value,'Keep this draft');assert.equal(document.getElementById('modal').open,true);assert.equal(api.state().tasks[0].feedback,'');assert.equal(db.calls.length,calls);api.cloud.conflict=false;
 api.mutate(d=>{d.tasks[0].feedback='x'.repeat(32760);});await settle();calls=db.calls.length;assert.throws(()=>api.hub.submit(form),/Feedback history is full/);assert.equal(form.elements.namedItem('feedback').value,'Keep this draft');assert.equal(db.calls.length,calls);assert.equal(api.state().tasks[0].feedback.length,32760);
});

test('task quick feedback appends to current history and rejects cancelled, replaced, deleted or wrong-account forms',async t=>{
 const {api,document,db}=await app(t),id=addMainTask(api,document,'Fresh feedback');await settle();await hubAction(api,'task-feedback',{id});let form=document.getElementById('hubTaskFeedback');form.elements.namedItem('feedback').value='New feedback';api.mutate(d=>{d.tasks[0].feedback='Update added while the form was open';});await settle();api.hub.submit(form);await settle();assert.match(api.state().tasks[0].feedback,/^Update added while the form was open\n\nNew feedback \[/);
 await hubAction(api,'task-feedback',{id});form=document.getElementById('hubTaskFeedback');form.elements.namedItem('feedback').value='Cancelled';api.closeModal();let calls=db.calls.length;assert.throws(()=>api.hub.submit(form),/Reopen Add feedback/);assert.equal(db.calls.length,calls);
 await hubAction(api,'task-feedback',{id});const replaced=document.getElementById('hubTaskFeedback');replaced.elements.namedItem('feedback').value='Old form';await hubAction(api,'task-feedback',{id});assert.throws(()=>api.hub.submit(replaced),/Reopen Add feedback/);
 form=document.getElementById('hubTaskFeedback');form.elements.namedItem('feedback').value='Deleted task';api.mutate(d=>{d.tasks=[];});await settle();calls=db.calls.length;assert.throws(()=>api.hub.submit(form),/Task no longer exists/);assert.equal(db.calls.length,calls);api.closeModal();
 const next=addMainTask(api,document,'Account safety');await settle();await hubAction(api,'task-feedback',{id:next});form=document.getElementById('hubTaskFeedback');form.elements.namedItem('feedback').value='Previous account';calls=db.calls.length;api.cloud.user={id:'22222222-2222-4222-8222-222222222222'};api.showTab('tasks');assert.equal(document.getElementById('modal').open,false);assert.throws(()=>api.hub.submit(form),/signing in/);assert.equal(db.calls.length,calls);assert.equal(api.state().tasks[0].feedback,'');
});

function addBooking(api,document,start,end,{date='2026-10-16',endDate=date,text='Focused work'}={}){
 api.openRangeEditor(date,start,'',true);const form=document.getElementById('scheduleForm');
 form.elements.namedItem('endDate').value=endDate;form.elements.namedItem('endTime').value=end;form.elements.namedItem('text').value=text;api.saveRange(form);
}

test('project quick feedback is timestamped at save, shown on cards and Traceability, and retained in editors, reports and cloud records',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,{itemId}=await addProjectDeliverable(ctx),get=()=>api.state().specs.find(r=>r.id===itemId);api.mutate(d=>{d.specs.find(r=>r.id===itemId).remarks='Keep the original scope';});await settle();
 const before=copy(get()),RealDate=window.Date;let time='2026-10-21T09:00:00';window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[time]));}static now(){return new RealDate(time).getTime();}};
 api.showProjectItems();assert.equal(document.querySelector('.item-feedback p').textContent,'No feedback yet.');let calls=db.calls.length;document.querySelector('.item-card [data-hub="item-feedback"]').click();await settle();let form=document.getElementById('hubItemFeedback');assert.ok(form);assert.equal(document.getElementById('editForm'),null);assert.match(form.querySelector('h3').textContent,/Prepare purchasing design/);assert.equal(db.calls.length,calls);
 time='2026-10-21T10:41:00';form.elements.namedItem('feedback').value='Confirmed <script>alert(1)</script>\nReady for testing';form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();let feedback='Confirmed <script>alert(1)</script>\nReady for testing [21-10-2026 10:41]';assert.deepEqual(copy(get()),{...before,feedback});assert.equal(document.querySelector('.item-feedback p').textContent,feedback);assert.equal(document.querySelector('.item-feedback script'),null);assert.equal(db.calls.length,calls+1);api.hub.submit(form);await settle();assert.equal(db.calls.length,calls+1);
 document.querySelector('.item-card [data-action="view-item-links"]').click();await settle();assert.equal(document.querySelector('#modalBody .item-feedback p').textContent,feedback);document.querySelector('#modalBody [data-hub="item-feedback"]').click();await settle();form=document.getElementById('hubItemFeedback');assert.equal(form.querySelector('details p').textContent,feedback);time='2026-10-22T11:05:00';form.elements.namedItem('feedback').value='Business signed off';api.hub.submit(form);await settle();feedback+='\n\nBusiness signed off [22-10-2026 11:05]';assert.equal(get().feedback,feedback);assert.equal(document.querySelector('.item-feedback p').textContent,feedback);
 api.editRecord('specs',itemId);form=document.getElementById('editForm');assert.equal(form.elements.namedItem('feedback').value,feedback);form.elements.namedItem('reference').value='Approved design';api.saveEdit(form);await settle();assert.equal(get().feedback,feedback);assert.ok(api.state().workhub.workLibrary.events.some(e=>e.kind==='specs'&&e.recordId===itemId&&e.changes.some(c=>c.field==='feedback')));assert.deepEqual(copy(get().subItems),before.subItems);assert.equal(get().remarks,before.remarks);assert.equal(get().statusDate,before.statusDate);assert.equal(db.row.document.data.specs.find(r=>r.id===itemId).feedback,feedback);assert.equal(api.parseBackup(api.payload(api.state())).specs.find(r=>r.id===itemId).feedback,feedback);
 const legacy=api.reportModel(api.state(),'2026-10-22').find(s=>s.name==='Project items');assert.equal(legacy.rows[0][legacy.headers.indexOf('Item feedback')],feedback);assert.ok(legacy.rows.every(row=>row.length===legacy.headers.length));const report=window.WorkHubReports.build(api.state(),{asOf:'2026-10-22'});assert.ok(report.sheets.find(s=>s.name==='Project notes').rows.some(row=>row.values.includes(feedback)));
 const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);await settle();reopened.api.showProjectItems();assert.equal(reopened.api.state().specs.find(r=>r.id===itemId).feedback,feedback);assert.equal(reopened.document.querySelector('.item-feedback p').textContent,feedback);
 const old=copy(api.state());delete old.specs[0].feedback;const restored=api.parseBackup(JSON.stringify({app:'mm-ticket-tracker',version:9,data:old}));assert.equal(restored.specs[0].feedback,'');restored.specs[0].feedback='x'.repeat(32768);assert.throws(()=>api.validate(restored),/oversized text/);
});

test('project feedback targets keep main and sub-item histories separate, preserve typed drafts and display each history beside its item',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,{itemId,subItemId}=await addProjectDeliverable(ctx);api.editSubItem(itemId);let form=document.getElementById('subItemForm');fill(form,{title:'Prepare the next step',remarks:'Other scope',feedback:'Sibling review'});api.saveSubItem(form);await settle();api.mutate(d=>{const item=d.specs.find(r=>r.id===itemId);item.feedback='Main review';item.subItems.find(r=>r.id===subItemId).feedback='Child review';});await settle();useDay(window,'2026-10-21');const before=copy(api.state().specs.find(r=>r.id===itemId)),child=before.subItems.find(r=>r.id===subItemId),sibling=before.subItems.find(r=>r.id!==subItemId);api.showProjectItems();let calls=db.calls.length;document.querySelector('.item-card [data-hub="item-feedback"]:not([data-sub])').click();await settle();form=document.getElementById('hubItemFeedback');const target=form.elements.namedItem('feedbackTarget');assert.equal(target.value,'');assert.equal(target.options.length,3);assert.match(target.options[0].textContent,/Main item/);assert.match(target.options[1].textContent,/Sub-item/);assert.equal(form.querySelector('details p').textContent,'Main review');form.elements.namedItem('feedback').value='Typed before choosing a target';
 target.value=subItemId;target.dispatchEvent(new window.Event('change',{bubbles:true}));await settle();assert.equal(form.querySelector('details p').textContent,'Child review');assert.equal(form.elements.namedItem('feedback').value,'Typed before choosing a target');target.value='';target.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(form.querySelector('details p').textContent,'Main review');target.value=subItemId;target.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(db.calls.length,calls);api.hub.submit(form);await settle();const feedback='Child review\n\nTyped before choosing a target [21-10-2026 12:00]',item=api.state().specs.find(r=>r.id===itemId),updated=item.subItems.find(r=>r.id===subItemId);assert.deepEqual(copy(updated),{...child,feedback,updatedAt:new window.Date().toISOString()});assert.equal(item.feedback,'Main review');assert.deepEqual(copy(item.subItems.find(r=>r.id===sibling.id)),sibling);assert.deepEqual(copy(item.statusHistory),before.statusHistory);assert.equal(db.calls.length,calls+1);assert.equal(document.querySelector('.item-card [data-feedback-sub="'+subItemId+'"] p').textContent,feedback);assert.match(document.querySelector('.item-card [data-feedback-sub="'+subItemId+'"] h5').textContent,/Review release strategy/);assert.equal(document.querySelector('.item-card [data-feedback-sub=""] p').textContent,'Main review');
 document.querySelector('.item-card [data-sub="'+subItemId+'"][data-hub="item-feedback"]').click();await settle();assert.equal(document.getElementById('hubItemFeedback').elements.namedItem('feedbackTarget').value,subItemId);api.closeModal();api.openSubItems(itemId);assert.equal(document.querySelector('#modalBody [data-feedback-sub="'+subItemId+'"] p').textContent,feedback);document.querySelector('#modalBody [data-sub="'+sibling.id+'"][data-hub="item-feedback"]').click();await settle();assert.equal(document.getElementById('hubItemFeedback').elements.namedItem('feedbackTarget').value,sibling.id);assert.equal(document.querySelector('#hubItemFeedback details p').textContent,'Sibling review');api.closeModal();await api.action({dataset:{action:'view-item-links',id:itemId}});assert.equal(document.querySelector('#modalBody [data-feedback-sub="'+subItemId+'"] p').textContent,feedback);assert.equal(document.querySelector('#modalBody [data-feedback-sub=""] p').textContent,'Main review');assert.equal(db.calls.length,calls+1);
});

test('sub-item feedback survives child and parent edits, status changes, search, account reopening, backups and reports',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,{itemId,subItemId}=await addProjectDeliverable(ctx);useDay(window,'2026-10-21');await hubAction(api,'item-feedback',{id:itemId,sub:subItemId});let form=document.getElementById('hubItemFeedback');assert.equal(form.elements.namedItem('feedbackTarget').value,subItemId);form.elements.namedItem('feedback').value='A child-only validation finding';api.hub.submit(form);await settle();const feedback='A child-only validation finding [21-10-2026 12:00]';api.editSubItem(itemId,subItemId);form=document.getElementById('subItemForm');assert.equal(form.elements.namedItem('feedback').value,feedback);fill(form,{title:'Confirm the approver matrix',owner:'Process owner'});api.saveSubItem(form);await settle();api.hub.workbench.changeStatus('specSub',subItemId,itemId,'Completed','2026-10-21');await settle();api.editRecord('specs',itemId);form=document.getElementById('editForm');form.elements.namedItem('remarks').value='Main scope still independent';api.saveEdit(form);await settle();let item=api.state().specs.find(r=>r.id===itemId),sub=item.subItems.find(r=>r.id===subItemId);assert.equal(sub.feedback,feedback);assert.equal(sub.status,'Completed');assert.equal(item.feedback,'');assert.equal(db.row.document.data.specs.find(r=>r.id===itemId).subItems.find(r=>r.id===subItemId).feedback,feedback);assert.equal(api.parseBackup(api.payload(api.state())).specs.find(r=>r.id===itemId).subItems.find(r=>r.id===subItemId).feedback,feedback);assert.ok(api.state().workhub.workLibrary.events.some(e=>e.recordId===itemId&&e.sourceId===subItemId&&e.changes.some(c=>c.field==='feedback')));
 const legacy=api.reportModel(api.state(),'2026-10-21').find(s=>s.name==='Project items'),row=legacy.rows.find(row=>row[legacy.headers.indexOf('Sub-item ID')]===subItemId);assert.equal(row[legacy.headers.indexOf('Item feedback')],feedback);const report=window.WorkHubReports.build(api.state(),{asOf:'2026-10-21'}),note=report.sheets.find(s=>s.name==='Project notes').rows.find(row=>row.values.includes(feedback));assert.equal(note.values[1],'Sub-item feedback');assert.match(note.values[2],/Prepare purchasing design.*Confirm the approver matrix/);api.closeModal();api.showProjectItems();const search=document.getElementById('specSearch');search.value='child-only validation finding';search.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(document.querySelectorAll('.item-card').length,1);
 const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);await settle();item=reopened.api.state().specs.find(r=>r.id===itemId);assert.equal(item.subItems.find(r=>r.id===subItemId).feedback,feedback);reopened.api.showProjectItems();assert.equal(reopened.document.querySelector('[data-feedback-sub="'+subItemId+'"] p').textContent,feedback);
});

test('sub-item feedback refuses foreign or deleted children and full histories without falling back to the main item',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,{itemId,subItemId}=await addProjectDeliverable(ctx),other=await addProjectDeliverable(ctx,'MM-43');api.mutate(d=>{d.specs.find(r=>r.id===itemId).feedback='Main feedback must stay unchanged';});await settle();await hubAction(api,'item-feedback',{id:itemId,sub:subItemId});const form=document.getElementById('hubItemFeedback'),target=form.elements.namedItem('feedbackTarget');form.elements.namedItem('feedback').value='Keep this draft';target.append(new window.Option('Foreign child',other.subItemId));target.value=other.subItemId;let calls=db.calls.length;assert.throws(()=>api.hub.submit(form),/Sub-item no longer exists/);assert.equal(db.calls.length,calls);assert.equal(form.elements.namedItem('feedback').value,'Keep this draft');target.value=subItemId;api.cloud.conflict=true;assert.throws(()=>api.hub.submit(form),/reload cloud records/);api.cloud.conflict=false;api.mutate(d=>{d.specs.find(r=>r.id===itemId).subItems.find(r=>r.id===subItemId).feedback='x'.repeat(32760);});await settle();const before=copy(api.state().specs);calls=db.calls.length;assert.throws(()=>api.hub.submit(form),/Feedback history is full/);assert.deepEqual(copy(api.state().specs),before);assert.equal(db.calls.length,calls);assert.equal(form.elements.namedItem('feedback').value,'Keep this draft');api.mutate(d=>{d.specs.find(r=>r.id===itemId).subItems=[];});await settle();calls=db.calls.length;assert.throws(()=>api.hub.submit(form),/Sub-item no longer exists/);assert.equal(db.calls.length,calls);assert.equal(api.state().specs.find(r=>r.id===itemId).feedback,'Main feedback must stay unchanged');assert.equal(api.state().specs.find(r=>r.id===other.itemId).subItems[0].feedback,'');await assert.rejects(hubAction(api,'item-feedback',{id:itemId,sub:subItemId}),/Sub-item no longer exists/);
});

test('legacy sub-items gain empty feedback and malformed restored histories are rejected without truncation',async t=>{
 const ctx=await app(t),{api}=ctx,{itemId,subItemId}=await addProjectDeliverable(ctx),old=copy(api.state()),item=old.specs.find(r=>r.id===itemId),sub=item.subItems.find(r=>r.id===subItemId);delete sub.feedback;const raw=()=>JSON.stringify({app:'mm-ticket-tracker',version:9,data:old}),restored=api.parseBackup(raw()).specs.find(r=>r.id===itemId).subItems.find(r=>r.id===subItemId);assert.equal(restored.feedback,'');assert.equal(restored.remarks,sub.remarks);assert.equal(restored.title,sub.title);for(const value of ['x'.repeat(32768),null,12]){sub.feedback=value;assert.throws(()=>api.parseBackup(raw()),/project sub-item details/);}assert.equal(api.state().specs.find(r=>r.id===itemId).subItems[0].feedback,'');
});

test('ticket quick Status update appends to its existing journal and immediately displays the update and save-time date and time',async t=>{
 const {api,document,window,db}=await app(t),id=addWishlistTicket(api,document);await settle();const other=addReportTicket(api,document,'OTHER-2049');await settle();const before=copy(api.state().tickets.find(r=>r.id===id)),unrelated=copy(api.state().tickets.find(r=>r.id===other)),trackers=copy(api.state().trackers),RealDate=window.Date;let time='2026-10-21T09:00:00';window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[time]));}static now(){return new RealDate(time).getTime();}};
 api.showTab('tickets');const calls=db.calls.length;document.querySelector('[data-hub="ticket-update"][data-id="'+id+'"]').click();await settle();const form=document.getElementById('hubTicketUpdate');assert.ok(form);assert.equal(form.elements.namedItem('feedback'),null);assert.equal(form.elements.namedItem('newHistory').value,'');assert.equal(form.querySelector('details p').textContent,before.history);assert.equal(db.calls.length,calls);time='2026-10-22T11:23:45';form.elements.namedItem('newHistory').value='  User confirmed <b>the result</b>\nTransport can proceed  ';form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();const entry='User confirmed <b>the result</b>\nTransport can proceed [22-10-2026 11:23:45]',history=before.history+'\n'+entry;
 assert.deepEqual(copy(api.state().tickets.find(r=>r.id===id)),{...before,history,historyDate:'2026-10-22',historyTime:'11:23:45'});assert.deepEqual(copy(api.state().tickets.find(r=>r.id===other)),unrelated);assert.deepEqual(copy(api.state().trackers),trackers);assert.equal(db.calls.length,calls+1);assert.equal(db.row.document.data.tickets.find(r=>r.id===id).history,history);const card=document.querySelector('[data-hub="ticket-update"][data-id="'+id+'"]').closest('article');assert.equal(card.querySelector('.ticket-history-preview p').textContent,entry);assert.equal(card.querySelector('.ticket-history-preview b'),null);assert.equal(card.querySelector('.ticket-history-preview time').textContent,'2026-10-22 11:23:45');api.hub.submit(form);await settle();assert.equal(db.calls.length,calls+1);
 await api.action({dataset:{action:'detail',id}});assert.equal(document.querySelector('.ticket-detail-update p').textContent,entry);assert.equal(document.querySelector('.ticket-detail-update time').textContent,'2026-10-22 11:23:45');assert.match(document.querySelector('#historyForm label').textContent,/Status update/);assert.equal(document.querySelector('.ticket-history-archive .history').textContent,history);assert.equal(api.parseBackup(api.payload(api.state())).tickets.find(r=>r.id===id).history,history);const report=window.WorkHubReports.build(api.state(),{asOf:'2026-10-22'});assert.ok(report.sheets.find(s=>s.name==='Ticket updates').rows.some(row=>row.values.includes(entry)));
 const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);await settle();assert.equal(reopened.api.state().tickets.find(r=>r.id===id).history,history);
});

for(const kind of ['specs','tickets'])test(kind+' quick updates reject blank, stale, oversized and wrong-account drafts without changing records',async t=>{
 const ctx=await app(t),{api,document,db}=ctx,id=kind==='specs'?(await addProjectDeliverable(ctx)).itemId:addReportTicket(api,document),action=kind==='specs'?'item-feedback':'ticket-update',formId=kind==='specs'?'hubItemFeedback':'hubTicketUpdate',field=kind==='specs'?'feedback':'history',input=kind==='specs'?'feedback':'newHistory';await settle();await hubAction(api,action,{id});let form=document.getElementById(formId),calls=db.calls.length;form.elements.namedItem(input).value=' \n ';assert.throws(()=>api.hub.submit(form),/Enter/);assert.equal(db.calls.length,calls);form.elements.namedItem(input).value='Keep this draft';api.cloud.conflict=true;assert.throws(()=>api.hub.submit(form),/reload cloud records/);assert.equal(form.elements.namedItem(input).value,'Keep this draft');assert.equal(document.getElementById('modal').open,true);api.cloud.conflict=false;
 api.mutate(d=>{d[kind].find(r=>r.id===id)[field]='x'.repeat(32760);});await settle();const before=copy(api.state()[kind].find(r=>r.id===id));calls=db.calls.length;assert.throws(()=>api.hub.submit(form),/history is full/);assert.deepEqual(copy(api.state()[kind].find(r=>r.id===id)),before);assert.equal(form.elements.namedItem(input).value,'Keep this draft');assert.equal(db.calls.length,calls);api.closeModal();assert.throws(()=>api.hub.submit(form),/Reopen/);
 await hubAction(api,action,{id});const replaced=document.getElementById(formId);replaced.elements.namedItem(input).value='Old draft';await hubAction(api,action,{id});assert.throws(()=>api.hub.submit(replaced),/Reopen/);form=document.getElementById(formId);form.elements.namedItem(input).value='Removed record';api.mutate(d=>{d[kind]=d[kind].filter(r=>r.id!==id);});await settle();calls=db.calls.length;assert.throws(()=>api.hub.submit(form),/no longer exists/);assert.equal(db.calls.length,calls);api.closeModal();
 const next=kind==='specs'?(await addProjectDeliverable(ctx)).itemId:addReportTicket(api,document,'NEXT-2050');await settle();await hubAction(api,action,{id:next});form=document.getElementById(formId);form.elements.namedItem(input).value='Old account';calls=db.calls.length;api.cloud.user={id:'22222222-2222-4222-8222-222222222222'};api.showTab('home');assert.equal(document.getElementById('modal').open,false);assert.throws(()=>api.hub.submit(form),/signing in/);assert.equal(db.calls.length,calls);assert.equal(api.state()[kind].find(r=>r.id===next)[field],'');
});

test('ticket Details Status update keeps failed drafts and prevents cancelled, duplicate and wrong-account submissions',async t=>{
 const {api,document,window,db}=await app(t),id=addReportTicket(api,document);await settle();useDay(window,'2026-10-22');await api.action({dataset:{action:'detail',id}});let form=document.getElementById('historyForm');form.elements.namedItem('newHistory').value='Keep this update';let calls=db.calls.length;api.cloud.conflict=true;form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(document.getElementById('historyForm'),form);assert.equal(form.elements.namedItem('newHistory').value,'Keep this update');assert.equal(db.calls.length,calls);api.cloud.conflict=false;form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(api.state().tickets[0].history,'Keep this update [22-10-2026 12:00:00]');assert.equal(db.calls.length,calls+1);form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(db.calls.length,calls+1);assert.equal(document.getElementById('historyForm').elements.namedItem('newHistory').value,'');
 form=document.getElementById('historyForm');form.elements.namedItem('newHistory').value='Cancelled';api.closeModal();calls=db.calls.length;form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(db.calls.length,calls);await api.action({dataset:{action:'detail',id}});form=document.getElementById('historyForm');form.elements.namedItem('newHistory').value='Old account';api.cloud.user={id:'22222222-2222-4222-8222-222222222222'};api.showTab('home');assert.equal(document.getElementById('modal').open,false);form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(db.calls.length,calls);assert.equal(api.state().tickets[0].history,'Keep this update [22-10-2026 12:00:00]');
});

test('Batch A context survives base editors, cloud reopen and JSON backup restore',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.batchA,E=window.WorkHubBatchEngine;
 ui.settings();let form=document.getElementById('batchLabel');form.elements.namedItem('name').value='Client discussion';ui.submit(form);
 const label=api.state().workhub.batchA.labels[0].id;
 api.editRecord('tasks');form=document.getElementById('editForm');form.elements.namedItem('task').value='Confirm design';form.elements.namedItem('batchEnvironment').value='qas';form.elements.namedItem('batchSystem').value='S4Q';form.elements.namedItem('batchClient').value='200';form.elements.namedItem('batchLabel').checked=true;api.saveEdit(form);await settle();
 const id=api.state().tasks[0].id;assert.deepEqual(copy(E.meta(api.state(),'tasks',id).labelIds),[label]);assert.equal(E.meta(api.state(),'tasks',id).client,'200');
 api.editRecord('tasks',id);form=document.getElementById('editForm');form.elements.namedItem('task').value='Confirm revised design';assert.equal(form.elements.namedItem('batchSystem').value,'S4Q');form.elements.namedItem('done').checked=true;form.elements.namedItem('batchOutcome').value='workaround';form.elements.namedItem('batchOutcomeNote').value='Approved interim approach';api.saveEdit(form);await settle();
 assert.equal(E.meta(api.state(),'tasks',id).outcome,'workaround');assert.equal(E.meta(api.state(),'tasks',id).environmentId,'qas');
 const restored=api.parseBackup(api.payload(api.state()));assert.equal(restored.workhub.batchA.records.find(x=>x.recordId===id).outcomeNote,'Approved interim approach');
 const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);await settle();assert.equal(reopened.api.state().workhub.batchA.records.find(x=>x.recordId===id).environmentId,'qas');
});

test('Batch A shared-label filters affect list, board and knowledge while preserving normal filters',async t=>{
 const {api,document,window}=await app(t),ui=api.hub.batchA,E=window.WorkHubBatchEngine;
 const a=addMainTask(api,document,'Labelled work'),b=addMainTask(api,document,'Other work');
 api.mutate(d=>{d.workhub.batchA.labels.push({id:'label',name:'Urgent clarification'});E.patch(d,'tasks',a,{labelIds:['label'],environmentId:'dev'});});
 api.showTab('tasks');let filter=document.querySelector('[name="batchFilterLabel"]');filter.value='label';filter.dispatchEvent(new window.Event('change',{bubbles:true}));
 assert.equal(document.querySelectorAll('.task-main-card').length,1);assert.match(document.querySelector('.task-main-card').textContent,/Labelled work/);
 api.hub.setBoard(true);api.showTab('tasks');assert.equal(document.querySelectorAll('[data-task-card]').length,1);assert.equal(document.querySelector('[data-task-card]').dataset.taskCard,a);
 api.hub.setBoard(false);await api.hub.handle({dataset:{hub:'note-edit'}});let form=document.getElementById('hubNote');form.elements.namedItem('title').value='One definition';form.elements.namedItem('body').value='A reusable note';form.elements.namedItem('batchLabel').checked=true;api.hub.submit(form);
 assert.deepEqual(copy(E.meta(api.state(),'notes',api.state().workhub.notes[0].id).labelIds),['label']);
 api.showTab('knowledge');filter=document.querySelector('[name="batchFilterLabel"]');filter.value='label';filter.dispatchEvent(new window.Event('change',{bubbles:true}));assert.match(document.getElementById('view').textContent,/One definition/);
 assert.equal(api.state().tasks.find(x=>x.id===b).task,'Other work');api.validate(api.state());
});

test('Batch A dependencies update from completion and a rejected cycle leaves saved state untouched',async t=>{
 const {api,document,window}=await app(t),ui=api.hub.batchA,E=window.WorkHubBatchEngine,a=addMainTask(api,document,'Build'),b=addMainTask(api,document,'Approve');
 ui.dependencies(a);let form=document.getElementById('batchDependency');form.elements.namedItem('targetId').value=b;ui.submit(form);assert.equal(E.blockers(api.state(),a).length,1);
 ui.dependencies(b);form=document.getElementById('batchDependency');form.elements.namedItem('targetId').value=a;assert.throws(()=>ui.submit(form),/loop/);assert.equal(E.meta(api.state(),'tasks',b).dependencies.length,0);
 api.hub.moveTask(b,'done');assert.equal(E.blockers(api.state(),a).length,0);
 ui.dependencies(a);form=document.getElementById('batchDependency');form.elements.namedItem('type').value='document';form.elements.namedItem('title').value='Signed design';ui.submit(form);assert.equal(E.blockers(api.state(),a).length,1);
 const dep=E.meta(api.state(),'tasks',a).dependencies.find(x=>x.type==='document');await ui.handle({dataset:{batch:'dependency-toggle',id:a,dependency:dep.id}});assert.equal(E.blockers(api.state(),a).length,0);
});

test('Batch A splitting copies task context and links and retains the original task and subtasks',async t=>{
 const {api,document,window}=await app(t),ui=api.hub.batchA,E=window.WorkHubBatchEngine,id=addMainTask(api,document,'Large deliverable');
 addTaskSub(api,document,id,'Existing step','Child notes','Child feedback');
 api.editRecord('tasks',id);let form=document.getElementById('editForm');form.elements.namedItem('remarks').value='Original notes';form.elements.namedItem('feedback').value='Owner feedback';form.elements.namedItem('customLink').value='https://example.com/design';form.elements.namedItem('batchEnvironment').value='dev';api.saveEdit(form);
 const original=copy(api.state().tasks[0]);await ui.handle({dataset:{batch:'split',id}});form=document.getElementById('batchSplit');form.elements.namedItem('titles').value='Prepare the change\nTest the change';ui.submit(form);
 assert.equal(api.state().tasks.length,3);assert.deepEqual(copy(api.state().tasks[0]),original);
 for(const task of api.state().tasks.slice(1)){assert.equal(task.remarks,'Original notes');assert.equal(task.feedback,'Owner feedback');assert.equal(task.customLink,'https://example.com/design');assert.equal(task.subTasks.length,0);assert.equal(E.meta(api.state(),'tasks',task.id).environmentId,'dev');}
});

test('Batch A glossary searches escaped text, rejects duplicates, and supports undo',async t=>{
 const {api,document,window}=await app(t),ui=api.hub.batchA;
 ui.glossaryForm();let form=document.getElementById('batchGlossary');form.elements.namedItem('term').value='BP <img src=x>';form.elements.namedItem('meaning').value='Business partner';form.elements.namedItem('aliases').value='Supplier';ui.submit(form);
 assert.equal(document.querySelector('.batch-term img'),null);const search=document.getElementById('batchGlossarySearch');search.value='supplier';search.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(document.querySelectorAll('.batch-term').length,1);
 ui.glossaryForm();form=document.getElementById('batchGlossary');form.elements.namedItem('term').value='bp <img src=x>';form.elements.namedItem('meaning').value='A duplicate';assert.throws(()=>ui.submit(form),/unique glossary/);assert.equal(api.state().workhub.batchA.glossary.length,1);
 const id=api.state().workhub.batchA.glossary[0].id;await ui.handle({dataset:{batch:'glossary-remove',id}});assert.equal(api.state().workhub.batchA.glossary.length,0);await ui.handle({dataset:{batch:'undo-glossary'}});assert.equal(api.state().workhub.batchA.glossary[0].id,id);
});

test('Batch A stale review and reading mode are explicit and navigation creates no cloud writes',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.batchA,E=window.WorkHubBatchEngine,id=addMainTask(api,document,'Review this older task');
 api.mutate(d=>{const m=E.touch(d,'tasks',id);m.updatedAt='2020-01-01T00:00:00Z';m.createdAt=m.updatedAt;});await settle();
 assert.equal(E.stale(api.state(),new Date().toISOString().slice(0,10)).items.length,1);
 const before=db.calls.length;api.showTab('home');ui.staleView();assert.match(document.getElementById('modalBody').textContent,/Review this older task/);ui.recordView('tasks',id,true);assert.equal(document.getElementById('modal').classList.contains('batch-reading'),true);api.closeModal();api.showTab('tasks');await settle();assert.equal(db.calls.length,before);
 await ui.handle({dataset:{batch:'reviewed',kind:'tasks',id}});assert.equal(E.stale(api.state(),new Date().toISOString().slice(0,10)).items.length,0);
});

test('Batch A stopwatch pause and wrap-up persist a useful resume thread with the saved session',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.batchA,E=window.WorkHubBatchEngine,id=addMainTask(api,document,'Investigate mapping');
 api.hub.startTimer({kind:'task',linkId:id});const timer=api.hub.timer();timer.started=new Date(Date.now()-120000).toISOString();timer.runningSince=timer.started;
 await api.hub.handle({dataset:{hub:'timer-pause'}});let form=document.getElementById('batchTimerPause');form.elements.namedItem('reason').value='approval';form.elements.namedItem('notes').value='Owner needs to confirm';form.elements.namedItem('nextStep').value='Check the signed design';ui.submit(form);
 assert.equal(api.hub.timer().runningSince,null);assert.equal(E.meta(api.state(),'tasks',id).pause.active,true);api.showTab('home');assert.match(document.querySelector('.batch-resume').textContent,/Check the signed design/);
 await settle();const storage=Object.fromEntries(Array.from({length:window.localStorage.length},(_,i)=>{const key=window.localStorage.key(i);return[key,window.localStorage.getItem(key)];})),reopened=await app(t,{remote:copy(db.row),storage,login:false});await reopened.api.loadCloud(sessionUser);await settle();assert.equal(reopened.api.hub.timer().pauseReason,'approval');assert.equal(reopened.api.hub.timer().nextStep,'Check the signed design');
 await api.hub.handle({dataset:{hub:'timer-stop'}});form=document.getElementById('batchTimerWrap');form.elements.namedItem('completedWork').value='Compared both mappings';form.elements.namedItem('nextStep').value='Apply the approved change';ui.submit(form);await settle();
 assert.equal(api.hub.timer(),null);assert.equal(api.state().workhub.sessions.length,1);const session=api.state().workhub.sessions[0];assert.equal(session.completedWork,'Compared both mappings');assert.equal(session.pauseReason,'approval');assert.equal(session.nextStep,'Apply the approved change');assert.equal(E.meta(api.state(),'tasks',id).lastSessionId,session.id);assert.equal(E.meta(api.state(),'tasks',id).pause.active,false);
 api.showTab('home');assert.match(document.querySelector('.batch-resume').textContent,/Compared both mappings/);assert.match(document.querySelector('.batch-resume').textContent,/Last pause: Waiting for approval/);api.hub.setTool('sessions');api.showTab('studio');assert.match(document.querySelector('.batch-session-summary').textContent,/Apply the approved change/);
 api.hub.startTimer({kind:'task',linkId:id});assert.equal(E.meta(api.state(),'tasks',id).nextStep,'');assert.equal(api.hub.timer().previousNextStep,'Apply the approved change');
});

test('Batch A location overview derives exact periods and environment maintenance keeps assigned IDs',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.batchA,E=window.WorkHubBatchEngine,id=addMainTask(api,document,'System check');
 api.mutate(d=>E.patch(d,'tasks',id,{environmentId:'qas',systemId:'S4Q',client:'200'}));ui.settings();let form=document.querySelector('[data-batch-environment="qas"]');form.elements.namedItem('name').value='QUALITY';ui.submit(form);assert.equal(E.meta(api.state(),'tasks',id).environmentId,'qas');
 addBooking(api,document,'09:15','10:45',{date:'2026-10-16'});await settle();const writes=db.calls.length;ui.locationView('2026-10-01','2026-10-31');assert.match(document.querySelector('.batch-location-totals').textContent,/1h 30m/);assert.match(document.querySelector('.batch-location-list').textContent,/Location not set/);await settle();assert.equal(db.calls.length,writes);
 api.editProject(api.state().activeProjectId);form=document.getElementById('projectForm');form.elements.namedItem('batchEnvironment').value='prd';api.saveProject(form);assert.equal(E.meta(api.state(),'projects',api.state().activeProjectId).environmentId,'prd');
 api.editRecord('specs');form=document.getElementById('editForm');form.elements.namedItem('description').value='A linked item';form.elements.namedItem('batchEnvironment').value='dev';api.saveEdit(form);assert.equal(E.meta(api.state(),'specs',api.state().specs[0].id).environmentId,'dev');
});

test('Batch A account changes clear filters and glossary undo context',async t=>{
 const {api,document,window}=await app(t),ui=api.hub.batchA;addMainTask(api,document,'Private work');api.showTab('tasks');
 const filter=document.querySelector('[name="batchFilterEnvironment"]');filter.value='dev';filter.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(ui.filters().tasks.environment,'dev');
 api.cloud.user=null;api.cloud.ready=false;api.showTab('home');assert.deepEqual(copy(ui.filters()),{});assert.equal(document.getElementById('batchUndo'),null);assert.throws(()=>ui.settings(),/Sign in/);
});

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
 const blob=api.exportReport(api.state(),'2026-10-16');assert.ok(blob.size>1000);const entries=await unzipReport(blob);assert.ok(entries['xl/workbook.xml']);
});

test('schedule milestones open in display mode and precise bookings remain visible in the weekly grid',async t=>{
 const {api,document}=await app(t);api.mutate(data=>data.projects[0].goLiveDate='2026-10-16');await settle();addBooking(api,document,'09:15','09:45');await settle();
 api.setMonth('2026-10');api.showTab('schedule');assert.match(document.getElementById('view').textContent,/30m/);
 await api.action(document.querySelector('[data-action="edit-project"]'));assert.equal(document.getElementById('projectForm'),null);assert.match(document.getElementById('modalTitle').textContent,/Go-Live milestone/);
 await api.action(document.querySelector('[data-action="edit-schedule-milestone"]'));assert.ok(document.getElementById('projectForm'));document.getElementById('modal').close();
 await api.action(document.querySelector('[data-action="schedule-day"][data-date="2026-10-16"]'));await api.action(document.querySelector('[data-action="schedule-layout"][data-layout="grid"]'));assert.ok(document.querySelector('.precision-grid'));assert.equal(document.querySelectorAll('.precision-grid tbody tr').length,24);
 assert.match(document.querySelector('.precision-grid').textContent,/09:15–09:45/);
 await api.action(document.querySelector('.precision-grid [data-action="open-booking"]'));assert.equal(document.getElementById('scheduleForm'),null);assert.ok(document.querySelector('[data-action="edit-booking"]'));
});

test('Tickets use cards only with working details, editing and empty search results',async t=>{
 const {api,document}=await app(t);api.editRecord('tickets');const form=document.getElementById('editForm');form.elements.namedItem('ticket').value='AMS-100';form.elements.namedItem('description').value='Test ticket layout';api.saveEdit(form);await settle();
 api.showTab('tickets');assert.ok(document.querySelector('.ticket-queue-card'));assert.match(document.querySelector('.ticket-queue-card').textContent,/AMS-100/);
 assert.equal(document.querySelector('#view table'),null);assert.equal(document.querySelector('[data-action="ticket-layout"]'),null);
 await api.action(document.querySelector('.ticket-queue-card [data-action="detail"]'));assert.ok(document.querySelector('[data-ticket-detail]'));assert.ok(document.querySelector('.ticket-history-section'));
 await api.action(document.querySelector('[data-ticket-detail] [data-action="edit"]'));const edit=document.getElementById('editForm');edit.elements.namedItem('description').value='Updated card description';api.saveEdit(edit);await settle();assert.match(document.querySelector('.ticket-queue-card').textContent,/Updated card description/);
 const search=document.getElementById('ticketSearch');search.value='No matching ticket';search.dispatchEvent(new document.defaultView.Event('input',{bubbles:true}));assert.equal(document.querySelectorAll('.ticket-queue-card').length,0);assert.ok(document.querySelector('.workspace-empty'));assert.equal(document.querySelector('#view table'),null);
 api.showTab('home');api.showTab('tickets');assert.equal(document.querySelector('[data-action="ticket-layout"]'),null);assert.equal(document.querySelector('#view table'),null);
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
 assert.equal(document.getElementById('saveStatus').dataset.syncState,'saved');assert.equal(document.getElementById('saveStatus').getAttribute('aria-label'),'All changes saved');
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
 const {api,document}=await app(t);await hubAction(api,'widget-size',{id:'tasks'});await hubAction(api,'widget-up',{id:'tasks'});assert.equal(api.state().workhub.widgets[0].id,'tasks');assert.equal(api.state().workhub.widgets[0].span,'wide');await hubAction(api,'layout');const form=document.getElementById('hubLayout');form.querySelector('[value="desk"]').checked=false;assert.equal(form.querySelector('[value="focus"]'),null);form.querySelector('[value="knowledge"]').checked=true;api.hub.submit(form);await settle();assert.ok(!api.state().workhub.widgets.some(w=>w.id==='desk'));assert.ok(api.state().workhub.widgets.some(w=>w.id==='knowledge'));
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

function pointer(window,target,type,x,y,id=1){const e=new window.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0});Object.defineProperty(e,'pointerId',{value:id});target.dispatchEvent(e);return e;}

test('the companion floats in viewport space, moves by touch, and remembers its place',async t=>{
 const {api,document,window,db}=await app(t),pet=document.getElementById('hubPet'),button=pet.querySelector('button');
 assert.equal(pet.parentElement,document.body);assert.equal(pet.style.position,'fixed');assert.equal(pet.style.bottom,'auto');assert.ok(parseFloat(pet.style.top)<window.innerHeight-pet.getBoundingClientRect().height);
 const oldTop=pet.style.top;window.dispatchEvent(new window.Event('scroll'));assert.equal(pet.style.top,oldTop);
 pointer(window,button,'pointerdown',900,300);pointer(window,document,'pointermove',200,200);pointer(window,document,'pointerup',200,200);assert.ok(parseFloat(pet.style.left)<400);assert.ok(window.localStorage.getItem('mm-tracker.companion-position.v1'));assert.equal(db.calls.length,0);
 const place={left:pet.style.left,top:pet.style.top};api.showTab('tasks');assert.equal(pet.style.left,place.left);assert.equal(pet.style.top,place.top);
 Object.defineProperty(window,'innerWidth',{value:375,configurable:true});Object.defineProperty(window,'innerHeight',{value:667,configurable:true});window.dispatchEvent(new window.Event('resize'));assert.ok(parseFloat(pet.style.left)>=12);assert.ok(parseFloat(pet.style.left)+parseFloat(pet.style.width)<=363);assert.ok(parseFloat(pet.style.top)+parseFloat(pet.style.height)<=655);
});

test('the companion remains visible around the phone keyboard and supports keyboard movement',async t=>{
 const {document,window}=await app(t),pet=document.getElementById('hubPet'),button=pet.querySelector('button'),before=parseFloat(pet.style.left);
 button.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));assert.ok(parseFloat(pet.style.left)<before);
 Object.defineProperty(window,'innerHeight',{value:240,configurable:true});window.dispatchEvent(new window.Event('resize'));assert.ok(parseFloat(pet.style.top)+parseFloat(pet.style.height)<=228);
});

test('editable website title and subtitle save to the same private account and survive restore',async t=>{
 const {api,document,db}=await app(t);await hubAction(api,'header-edit');const form=document.getElementById('hubHeaderForm');fill(form,{workspace:'Haidid’s SAP Space',headerSubtitle:'A place for ideas & progress'});api.hub.submit(form);await settle();
 assert.equal(document.getElementById('hubSiteTitle').textContent,'Haidid’s SAP Space');assert.equal(document.getElementById('hubSiteSubtitle').textContent,'A place for ideas & progress');assert.equal(document.title,'Haidid’s SAP Space');assert.equal(db.row.document.data.workhub.headerSubtitle,'A place for ideas & progress');assert.equal(api.parseBackup(api.payload(api.state())).workhub.preferences.workspace,'Haidid’s SAP Space');
 assert.equal(document.getElementById('tabs').parentElement.id,'hubSidebar');assert.equal(document.querySelector('main.page').parentElement.id,'hubShell');
});

test('dashboard handles support pointer dragging and keyboard reorder with a single saved drop',async t=>{
 const {api,document,window,db}=await app(t);api.showTab('home');const tasks=document.querySelector('[data-widget="tasks"]'),target=document.querySelector('[data-widget="today"]'),handle=tasks.querySelector('[data-hub-drag="widget"]');document.elementFromPoint=()=>target;
 const before=db.calls.length;pointer(window,handle,'pointerdown',300,300);pointer(window,document,'pointermove',200,200);assert.ok(document.querySelector('.hub-sort-ghost'));assert.ok(target.classList.contains('hub-drop-target'));assert.equal(db.calls.length,before);
 pointer(window,document,'pointerup',200,200);await settle();assert.equal(api.state().workhub.widgets[0].id,'tasks');assert.equal(db.calls.length,before+1);assert.equal(document.querySelector('.hub-sort-ghost'),null);
 document.querySelector('[data-widget="tasks"] [data-hub-drag]').dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await settle();assert.equal(api.state().workhub.widgets[0].id,'today');
});

test('task handles move a card to a status column with touch without losing its child records',async t=>{
 const {api,document,window}=await app(t),id=addMainTask(api,document,'Drag me');addTaskSub(api,document,id,'Child','Keep remarks','Keep feedback');await settle();api.hub.setBoard(true);api.showTab('tasks');const handle=document.querySelector('[data-task-card] [data-hub-drag="task"]'),target=document.querySelector('[data-column="blocked"]');document.elementFromPoint=()=>target;
 pointer(window,handle,'pointerdown',300,300);pointer(window,document,'pointermove',400,300);pointer(window,document,'pointerup',400,300);await settle();assert.equal(api.state().tasks[0].boardStatus,'blocked');assert.equal(api.state().tasks[0].subTasks[0].feedback,'Keep feedback');assert.ok(document.querySelector('[data-column="blocked"] [data-task-card]'));
});

test('cancelling a drag leaves both layout and records unchanged',async t=>{
 const {api,document,window,db}=await app(t);api.showTab('home');const initial=copy(api.state().workhub.widgets),handle=document.querySelector('[data-widget] [data-hub-drag]');pointer(window,handle,'pointerdown',200,200);pointer(window,document,'pointermove',300,300);pointer(window,document,'pointercancel',300,300);assert.deepEqual(copy(api.state().workhub.widgets),initial);assert.equal(db.calls.length,0);assert.equal(document.querySelector('.hub-sort-ghost'),null);
});

test('the page security policy permits its shipped styles and Momo artwork with matching browser checks',async t=>{
 const {document,window}=await app(t,{styles:true});
 const policy=Object.fromEntries(document.querySelector('meta[http-equiv="Content-Security-Policy"]').content.split(';').map(part=>part.trim().split(/\s+/)).map(([key,...values])=>[key,values]));
 const styleSources=policy['style-src-elem']||policy['style-src']||policy['default-src'];
 const imageSources=policy['img-src']||policy['default-src'];
 for(const image of document.querySelectorAll('.momo-part-image')){assert.equal(new URL(image.getAttribute('href'),window.location.href).origin,window.location.origin);assert.ok(imageSources.includes("'self'"),'The shipped Momo artwork must be allowed by CSP.');}
 const preview=new JSDOM(readFileSync(new URL('./momo-preview.html',import.meta.url),'utf8'));t.after(()=>preview.window.close());
 assert.equal(preview.window.document.querySelector('meta[http-equiv="Content-Security-Policy"]').content,document.querySelector('meta[http-equiv="Content-Security-Policy"]').content,'The browser check must use the production security policy.');
 for(const link of document.querySelectorAll('link[rel="stylesheet"]')){assert.equal(new URL(link.href).origin,window.location.origin);assert.ok(styleSources.includes("'self'"),'The shipped stylesheet must be allowed by CSP.');}
 assert.ok(policy['style-src'].includes("'unsafe-inline'"),'Existing generated per-record styles must remain supported.');
 assert.ok(policy['default-src'].includes("'none'"));
 assert.equal(window.getComputedStyle(document.querySelector('.hub-layout')).display,'grid');
 assert.equal(window.getComputedStyle(document.querySelector('.hub-widget-head')).display,'flex');
 assert.equal(window.getComputedStyle(document.querySelector('.hub-list')).display,'grid');
 assert.equal(window.getComputedStyle(document.body).fontSize,'15px');
});

test('privacy and presentation clicks visibly change the screen and restore on exit',async t=>{
 const {api,document,window,db}=await app(t,{styles:true});addMainTask(api,document,'Private rollout title');await settle();api.showTab('home');const writes=db.calls.length;
 document.querySelector('#hubToolbar [data-hub="privacy"]').click();await settle();assert.equal(document.querySelector('.my-day-page').dataset.mvMotion,'still');
 const title=document.querySelector('[data-widget="tasks"] .hub-sensitive');assert.match(window.getComputedStyle(title).filter,/blur\(/);assert.match(document.getElementById('hubViewStatus').textContent,/Privacy is on/);assert.equal(document.querySelector('#hubToolbar [data-hub="privacy"]').getAttribute('aria-pressed'),'true');
 document.querySelector('#hubToolbar [data-hub="presentation"]').click();await settle();
 assert.equal(window.getComputedStyle(document.getElementById('hubToolbar')).display,'none');assert.equal(window.getComputedStyle(document.getElementById('hubPet')).display,'none');assert.equal(window.getComputedStyle(document.getElementById('hubSidebar')).display,'none');assert.ok(document.getElementById('hubExitPresentation'));
 document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(document.getElementById('hubExitPresentation'),null);assert.notEqual(window.getComputedStyle(document.getElementById('hubToolbar')).display,'none');assert.equal(document.querySelector('#hubToolbar [data-hub="presentation"]').getAttribute('aria-pressed'),'false');
 document.querySelector('#hubViewStatus [data-hub="privacy"]').click();await settle();assert.equal(document.getElementById('hubViewStatus'),null);assert.doesNotMatch(window.getComputedStyle(title).filter,/blur/);assert.equal(db.calls.length,writes);
});

test('Edit header is inside Settings and its action closes the settings menu',async t=>{
 const {document}=await app(t);const settings=document.getElementById('settingsMenu');assert.equal(document.querySelectorAll('[data-hub="header-edit"]').length,1);assert.ok(settings.querySelector('[data-hub="header-edit"]'));assert.equal(document.querySelector('.hub-header-brand [data-hub="header-edit"]'),null);
 settings.open=true;settings.querySelector('[data-hub="header-edit"]').click();await settle();assert.equal(settings.open,false);assert.ok(document.getElementById('hubHeaderForm'));
});

test('palette and custom colour changes preview, save through the form, and reload from the account',async t=>{
 const {api,document,window,db}=await app(t,{styles:true});api.hub.setTool('theme');api.showTab('studio');const originalTitle=api.state().workhub.preferences.workspace;
 document.querySelector('[data-theme-choice="forest"]').click();await settle();assert.equal(document.body.dataset.hubTheme,'forest');assert.equal(api.state().workhub.preferences.theme,'ocean');assert.equal(db.calls.length,0);const forestSurface=window.getComputedStyle(document.body).getPropertyValue('--hub-bg');
 document.querySelector('[data-theme-choice="sunset"]').click();await settle();assert.notEqual(window.getComputedStyle(document.body).getPropertyValue('--hub-bg'),forestSurface);assert.equal(document.querySelector('[data-theme-choice="sunset"]').getAttribute('aria-pressed'),'true');
 let form=document.getElementById('hubTheme');form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(api.state().workhub.preferences.theme,'sunset');assert.equal(db.row.document.data.workhub.preferences.theme,'sunset');assert.equal(api.state().workhub.preferences.workspace,originalTitle);assert.match(document.getElementById('hubThemeStatus').textContent,/Theme saved/);
 form=document.getElementById('hubTheme');form.elements.namedItem('accent').value='#7652b5';form.elements.namedItem('accent').dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(document.body.dataset.hubTheme,'custom');assert.equal(document.documentElement.style.getPropertyValue('--hub-accent'),'#7652b5');form.elements.namedItem('roaming').checked=false;form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();
 const second=await app(t,{remote:copy(db.row),login:false});await second.api.loadCloud(sessionUser);await settle();assert.equal(second.document.body.dataset.hubTheme,'custom');assert.equal(second.api.state().workhub.preferences.roaming,false);assert.equal(second.document.documentElement.style.getPropertyValue('--hub-accent'),'#7652b5');
});

test('the floating timer moves, minimises, recovers and stays within a phone viewport without cloud writes',async t=>{
 const {api,document,window,db}=await app(t);api.hub.startTimer({kind:'custom',title:'Floating session'});const id=api.hub.timer().id,bar=document.getElementById('hubTimerBar');assert.equal(bar.parentElement,document.body);assert.equal(bar.style.position,'fixed');assert.equal(bar.style.bottom,'auto');
 const handle=bar.querySelector('[data-hub="timer-drag"]');pointer(window,handle,'pointerdown',800,200);pointer(window,document,'pointermove',300,320);pointer(window,document,'pointerup',300,320);const position={left:bar.style.left,top:bar.style.top};window.dispatchEvent(new window.Event('scroll'));assert.equal(bar.style.top,position.top);api.showTab('knowledge');assert.equal(bar.style.left,position.left);
 Object.defineProperty(window,'innerWidth',{value:375,configurable:true});Object.defineProperty(window,'innerHeight',{value:667,configurable:true});window.dispatchEvent(new window.Event('resize'));assert.ok(parseFloat(bar.style.left)>=12);assert.ok(parseFloat(bar.style.left)+parseFloat(bar.style.width)<=363);assert.ok(parseFloat(bar.style.top)+250<=655);
 document.querySelector('[data-hub="timer-minimize"]').click();await settle();assert.equal(bar.dataset.minimized,'true');assert.ok(bar.querySelector('#hubTimerClock'));assert.equal(api.hub.timer().id,id);
 const storage=Object.fromEntries(Array.from({length:window.localStorage.length},(_,i)=>window.localStorage.key(i)).filter(k=>k.startsWith('mm-tracker.timer')).map(k=>[k,window.localStorage.getItem(k)]));const second=await app(t,{storage});assert.equal(second.document.getElementById('hubTimerBar').dataset.minimized,'true');assert.equal(second.api.hub.timer().id,id);
 document.querySelector('[data-hub="timer-minimize"]').click();await settle();document.querySelector('[data-hub="timer-pause"]').click();await settle();assert.equal(api.hub.timer().runningSince,null);document.querySelector('[data-hub="timer-resume"]').click();await settle();assert.ok(api.hub.timer().runningSince);assert.equal(db.calls.length,0);
 Object.defineProperty(window,'visualViewport',{value:{width:375,height:220,offsetTop:40,offsetLeft:0},configurable:true});window.dispatchEvent(new window.Event('resize'));assert.ok(parseFloat(bar.style.top)>=52);assert.ok(parseFloat(bar.style.top)+parseFloat(bar.style.maxHeight)<=248);
});

test('Momo walks locally and pauses for typing, reduced motion, presentation and disabled wandering',async t=>{
 const {api,document,window,db,intervals,frames}=await app(t,{storage:{'mm-tracker.momo-moments.v1':JSON.stringify({visitors:false})}}),tick=intervals.find(x=>x.ms===1000).callback,pet=document.getElementById('hubPet'),before=pet.style.top;
 tick();assert.ok(frames.size);assert.equal(pet.dataset.roaming,'true');for(const [id,callback]of [...frames]){frames.delete(id);callback(window.performance.now()+6000);}assert.notEqual(pet.style.top,before);assert.equal(db.calls.length,0);
 const start=Date.now();window.Date.now=()=>start+30000;tick();assert.ok(frames.size);api.showTab('knowledge');document.getElementById('hubSearch').focus();assert.equal(frames.size,0);assert.equal(pet.dataset.roaming,'false');document.getElementById('hubSearch').blur();
 window.matchMedia=()=>({matches:true});tick();assert.equal(frames.size,0);window.matchMedia=()=>({matches:false});tick();assert.ok(frames.size);document.querySelector('#hubToolbar [data-hub="presentation"]').click();await settle();assert.equal(frames.size,0);
 document.getElementById('hubExitPresentation').click();await settle();api.hub.setTool('theme');api.showTab('studio');const form=document.getElementById('hubTheme');form.elements.namedItem('roaming').checked=false;form.elements.namedItem('roaming').dispatchEvent(new window.Event('change',{bubbles:true}));tick();assert.equal(frames.size,0);assert.equal(db.calls.length,0);
});

function addReportTicket(api,document,number='INC-101'){
 api.editRecord('tickets');const f=document.getElementById('editForm');fill(f,{ticket:number,description:'Investigate '+number,pic:'Haidid'});api.saveEdit(f);return api.state().tickets.at(-1).id;
}
function useDay(window,day){const RealDate=window.Date;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[day+'T12:00:00']));}static now(){return new RealDate(day+'T12:00:00').getTime();}};}

test('reminder presets and custom dates persist without changing task details or subtasks',async t=>{
 const {api,document,window,db}=await app(t),id=addMainTask(api,document,'Revisit the rollout');addTaskSub(api,document,id,'Keep this child','Child remarks','Child feedback');await settle();const before=copy(api.state().tasks[0]);api.showTab('tasks');document.querySelector('.task-main-card [data-reminder="edit"]').click();await settle();
 document.querySelector('[data-reminder="days"][data-days="7"]').click();assert.equal(document.getElementById('reminderDays').value,'7');document.getElementById('reminderDays').value='5';document.getElementById('reminderDays').dispatchEvent(new window.Event('input',{bubbles:true}));let f=document.getElementById('reminderForm');const until=window.WorkHubReminders.shift(window.api.state().tasks[0].doneDate||new window.Date().toLocaleDateString('en-CA'),5);assert.equal(f.elements.namedItem('until').value,until);f.elements.namedItem('hideUntilDue').checked=true;f.elements.namedItem('note').value='Review transport after UAT';f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();
 assert.deepEqual(copy(api.state().tasks[0]),before);assert.equal(document.querySelectorAll('.task-main-card').length,0);assert.match(document.querySelector('.reminder-snoozed').textContent,/Review transport after UAT/);assert.equal(db.row.document.data.workhub.reminders[0].until,until);assert.equal(api.parseBackup(api.payload(api.state())).workhub.reminders[0].note,'Review transport after UAT');
 api.hub.setBoard(true);api.showTab('tasks');assert.equal(document.querySelectorAll('[data-task-card]').length,0);api.hub.reminders.dismiss('tasks',id);await settle();assert.ok(document.querySelector('[data-task-card]'));assert.equal(api.state().tasks[0].subTasks[0].feedback,'Child feedback');
});

test('due reminders return automatically on the chosen local day and can be dismissed or resnoozed',async t=>{
 const {api,document,window,db}=await app(t);useDay(window,'2026-10-16');api.hub.reminders.tick();const id=addMainTask(api,document,'Return tomorrow');await settle();api.hub.reminders.set('tasks',id,'2026-10-17','Do this next');await settle();const writes=db.calls.length;useDay(window,'2026-10-17');api.hub.reminders.tick();assert.ok(document.querySelector('.reminder-due-panel'));assert.match(document.querySelector('.reminder-due-panel').textContent,/Return tomorrow/);api.showTab('tasks');assert.ok(document.querySelector('.task-main-card'));assert.match(document.querySelector('.reminder-item-control').textContent,/Time to revisit/);assert.equal(db.calls.length,writes);
 api.hub.reminders.set('tasks',id,'2026-10-20','Another review');await settle();assert.equal(document.querySelectorAll('.task-main-card').length,0);api.hub.reminders.dismiss('tasks',id);await settle();assert.equal(api.state().workhub.reminders.length,0);assert.ok(document.querySelector('.task-main-card'));assert.throws(()=>api.hub.reminders.set('tasks',id,'2026-10-17'),/after today/);assert.throws(()=>api.hub.reminders.set('tasks',id,'2026-02-30'),/after today/);
});

test('tickets and projects have independent synced reminders and a snoozed project keeps its child work available',async t=>{
 const {api,document,window,db}=await app(t);useDay(window,'2026-10-16');const ticket=addReportTicket(api,document),task=addMainTask(api,document,'A linked action'),project=api.state().projects[0].id;await settle();api.hub.reminders.set('tickets',ticket,'2026-10-21','Wait for user');await settle();api.hub.reminders.set('projects',project,'2026-10-22','Phase review');await settle();api.showTab('tickets');assert.equal(document.querySelectorAll('.ticket-queue-card').length,0);assert.match(document.querySelector('.reminder-snoozed').textContent,/INC-101/);api.showTab('tasks');assert.ok(document.querySelector('.task-main-card'));assert.equal(window.WorkHubReminders.isSnoozed(api.state(),'tasks',task,'2026-10-16'),false);api.showTab('specs');assert.match(document.querySelector('.reminder-snoozed').textContent,/Phase review/);assert.ok(document.querySelector('.project-banner [data-reminder="edit"]'));
 const other=await app(t,{remote:copy(db.row),login:false});await other.api.loadCloud(sessionUser);await settle();assert.equal(other.api.state().workhub.reminders.length,2);assert.equal(other.window.WorkHubReminders.lookup(other.api.state(),'tickets',ticket).until,'2026-10-21');
});

test('Momo reveals the complete rig only after its artwork loads and hides failed artwork',async t=>{
 const {document,window,db}=await app(t,{styles:true}),pet=document.getElementById('hubPet'),art=pet.querySelector('.momo-anime-art'),images=[];
 window.Image=class{constructor(){images.push(this);}};
 window.WorkHubMomoArt.mount(pet);assert.equal(window.getComputedStyle(art).opacity,'0');assert.match(images[0].src,/assets\/momo\/anime-rig\.webp/);
 images[0].onload();assert.equal(art.dataset.artReady,'true');assert.notEqual(window.getComputedStyle(art).opacity,'0');
 window.WorkHubMomoArt.mount(pet);images[1].onerror();assert.equal(window.getComputedStyle(art).opacity,'0');assert.equal(db.calls.length,0);
});

test('Validation Studio is navigable and saves general-purpose definitions, references and frozen versions across devices',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.validator;
 api.showTab('validator');assert.match(document.getElementById('view').textContent,/Validation Studio/);assert.ok(document.querySelector('[data-tab="validator"]'));
 await ui.handle({dataset:{val:'example'}});assert.equal(ui.snapshot().draft.name,'Project intake');
 assert.equal(ui.saveDraft(),true);await settle();const id=ui.snapshot().draft.id;
 ui.publish();await settle();assert.equal(api.state().workhub.validator.templates[0].releases[0].version,1);
 const snapshot=copy(api.state().workhub.validator.templates[0].releases[0]);
 document.querySelector('#valColumnForm [name="label"]').value='Intake reference';
 assert.equal(ui.saveDraft(),true);await settle();assert.equal(api.state().workhub.validator.templates[0].columns[0].label,'Intake reference');assert.deepEqual(copy(api.state().workhub.validator.templates[0].releases[0]),snapshot);
 const loaded=await app(t,{remote:copy(db.row),login:false});await loaded.api.loadCloud(sessionUser);await settle();
 assert.equal(loaded.api.state().workhub.validator.templates[0].id,id);assert.equal(loaded.api.state().workhub.validator.templates[0].releases[0].version,1);
 assert.match(api.payload(api.state()),/Intake reference/);api.validate(api.state());
});

test('validator mapping, correction and revalidation keep uploaded data out of cloud records',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.validator;api.showTab('validator');await ui.handle({dataset:{val:'example'}});ui.saveDraft();await settle();
 ui.loadSample();window.setTimeout=callback=>{queueMicrotask(callback);return 0;};await ui.run();await settle();
 assert.equal(ui.snapshot().result.errors,3);assert.equal(ui.snapshot().result.warnings,1);assert.equal(api.state().workhub.validator.runs.length,1);
 assert.equal(api.payload(api.state()).includes('REQ-002'),false);assert.equal(JSON.stringify(db.row).includes('REQ-002'),false);
 const cell=document.querySelector('[data-cell="1"][data-field="OWNER"]');cell.value='Mira';cell.dispatchEvent(new window.Event('change',{bubbles:true}));await settle();
 assert.equal(ui.snapshot().result,null);assert.equal(document.querySelector('[data-val="report"]').disabled,true);
 await ui.run();await settle();assert.equal(ui.snapshot().result.errors,2);assert.equal(ui.snapshot().rows[1].OWNER,'Mira');
 api.cloud.user=null;api.cloud.ready=false;api.showTab('home');assert.equal(ui.snapshot().draft,null);assert.deepEqual(copy(ui.snapshot().rows),[]);assert.equal(ui.snapshot().result,null);
});

test('validator discards an upload finishing after the account changes',async t=>{
 const {api}=await app(t),ui=api.hub.validator;api.showTab('validator');await ui.handle({dataset:{val:'example'}});
 let release;const text=new Promise(resolve=>release=resolve),pending=ui.loadFile({name:'private.csv',size:20,text:()=>text});
 api.cloud.user=null;api.cloud.ready=false;api.showTab('home');release('Request ID,Request type\nPRIVATE-ROW,Standard');await pending;
 assert.equal(ui.snapshot().draft,null);assert.equal(ui.snapshot().rows.length,0);assert.equal(ui.snapshot().result,null);
});

test('validator column renaming rewires conditions and prevents deleting referenced fields',async t=>{
 const {api,document,window}=await app(t),ui=api.hub.validator;api.showTab('validator');await ui.handle({dataset:{val:'example'}});
 const owner=ui.snapshot().draft.columns.find(c=>c.key==='OWNER');await ui.handle({dataset:{val:'select-column',id:owner.id}});
 const field=document.querySelector('#valColumnForm [name="key"]');field.value='ASSIGNEE';field.dispatchEvent(new window.Event('input',{bubbles:true}));ui.saveDraft();await settle();
 assert.equal(ui.snapshot().draft.rules[0].assertion.field,'ASSIGNEE');
 await assert.rejects(ui.handle({dataset:{val:'remove-column',id:owner.id}}),/used in a condition/);
 window.WorkHubValidatorEngine.checkSchema(ui.snapshot().draft);
});

test('Momo has live glossy anime eyes and pickup reactions stay local',async t=>{
 const {document,window,db,frames}=await app(t),pet=document.getElementById('hubPet');assert.ok(pet.querySelector('radialGradient'));assert.equal(pet.querySelector('svg').getAttribute('viewBox'),'0 0 140 155');assert.ok(pet.querySelector('.momo-pupils'));
 pointer(window,document.body,'pointermove',0,0);for(const [id,fn]of [...frames]){frames.delete(id);fn(window.performance.now()+20);}assert.ok(parseFloat(pet.style.getPropertyValue('--momo-look-x'))<0);
 const button=pet.querySelector('button');pointer(window,button,'pointerdown',900,300);pointer(window,document,'pointermove',700,250);assert.equal(pet.dataset.pose,'held');pointer(window,document,'pointerup',700,250);assert.equal(pet.dataset.pose,'annoyed');assert.equal(db.calls.length,0);
});

test('Momo can go home, wake, play ball, perch and move away when a card is used',async t=>{
 const {api,document,window,db,frames}=await app(t),pet=document.getElementById('hubPet');const finish=()=>{for(const [id,fn]of [...frames]){frames.delete(id);fn(window.performance.now()+10000);}};
 pet.querySelector('button').click();await settle();assert.ok(document.getElementById('hubMomoMenu'));document.querySelector('[data-momo="place-home"]').click();assert.ok(window.localStorage.getItem('mm-tracker.momo-home.v2'));document.getElementById('hubMomoHome').click();finish();assert.equal(pet.dataset.pose,'nap');document.getElementById('hubMomoHome').click();assert.equal(pet.dataset.pose,'nap');pet.querySelector(':scope > button').click();assert.equal(pet.dataset.pose,'stretch');
 api.hub.life.menu();document.querySelector('[data-momo="ball"]').click();assert.ok(document.getElementById('hubMomoBall'));finish();assert.equal(pet.dataset.pose,'play');
 const card=document.querySelector('[data-widget]');card.getBoundingClientRect=()=>({left:200,top:250,width:400,height:200,right:600,bottom:450});api.hub.life.menu();document.querySelector('[data-momo="perch"]').click();finish();assert.equal(pet.dataset.pose,'perch');pointer(window,card,'pointerdown',300,300);assert.equal(pet.dataset.pose,'walk');finish();document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(document.getElementById('hubMomoBall'),null);assert.equal(db.calls.length,0);
});

test('ticket closure dates are recorded on closing, preserved on edits and reset on reopening',async t=>{
 const {api,document,window}=await app(t);useDay(window,'2026-10-16');const id=addReportTicket(api,document);await settle();api.mutate(d=>d.tickets.find(x=>x.id===id).status='Closed');await settle();assert.equal(api.state().workhub.ticketClosures[0].date,'2026-10-16');useDay(window,'2026-10-19');api.mutate(d=>d.tickets.find(x=>x.id===id).pic='New owner');await settle();assert.equal(api.state().workhub.ticketClosures[0].date,'2026-10-16');api.mutate(d=>d.tickets.find(x=>x.id===id).status='Pending');await settle();assert.equal(api.state().workhub.ticketClosures.length,0);
});

test('new Excel reports exclude older closures, retain subtasks and minutes, and contain valid linked XML',async t=>{
 const {api,document,window}=await app(t),task=addMainTask(api,document,'UAT main task');addTaskSub(api,document,task,'Check receipt','Own child remarks','Own child feedback','Completed');addBooking(api,document,'09:15','10:45',{text:'Workshop'});const ticket=addReportTicket(api,document);await settle();addCompany(api,document,'Farm operations');api.editRecord('specs');fill(document.getElementById('editForm'),{description:'Prepare receiving configuration',remarks:'Confirm movement type and account determination'});api.saveEdit(document.getElementById('editForm'));const spec=api.state().specs.at(-1);api.editSubItem(spec.id);fill(document.getElementById('subItemForm'),{title:'Confirm receipt controls',remarks:'Document the agreed settings'});api.saveSubItem(document.getElementById('subItemForm'));const d=copy(api.state()),template=copy(d.tickets[0]);d.tickets=[{...template,id:'open-ticket',ticket:'OPEN-1',status:'Pending',historyDate:'2026-10-16',history:'Open update'},{...template,id:'recent-ticket',ticket:'RECENT-1',status:'Closed',historyDate:'2026-10-15',history:'Recent closure'},{...template,id:'old-ticket',ticket:'OLD-1',status:'Closed',historyDate:'2026-08-01',history:'Historical closure'},{...template,id:'unknown-ticket',ticket:'UNKNOWN-1',status:'Closed',historyDate:'',history:''}];d.trackers=[{id:'report-progress',ticket:'OPEN-1',steps:d.lists.milestones.map((_,i)=>i<3),onHold:false,remarks:'Awaiting UAT confirmation'}];d.workhub.sessions=[{id:'session-report',title:'UAT preparation',start:'2026-10-16T01:15:00Z',end:'2026-10-16T02:45:00Z',intervals:[{start:'2026-10-16T01:15:00Z',end:'2026-10-16T02:45:00Z'}],seconds:5400,kind:'custom',linkId:'',subTaskId:'',projectId:d.projects[0].id,notes:'Prepared the acceptance checklist',chargeCode:'F-UAT',scheduled:true}];d.workhub.reminders=[{id:'tasks:'+task,kind:'tasks',recordId:task,until:'2026-10-17',note:'Check the acceptance results',updatedAt:'2026-10-16T01:00:00Z'}];d.workhub.ticketClosures=[];d.workhub.waiting.push({id:'waiting',title:'Confirm UAT',person:'Team',followUp:'2026-10-17',notes:'Waiting for sign-off',projectId:d.projects[0].id,resolved:false,createdAt:'2026-10-16',resolvedAt:''});
 const options={asOf:'2026-10-16',from:'2026-10-01',to:'2026-10-16',closedDays:30},result=window.WorkHubReports.files(d,options);assert.equal(result.model.metrics.openTickets,1);assert.equal(result.model.metrics.archivedTickets,1);assert.equal(result.model.metrics.closedInPeriod,1);assert.equal(result.model.sheets.some(s=>s.name==='Closed archive'),false);assert.deepEqual(Array.from(result.model.scope.tickets,t=>t.ticket),['OPEN-1','RECENT-1','UNKNOWN-1']);assert.equal(result.model.sheets.find(s=>s.name==='Schedule').rows.length,1);assert.equal(result.model.sheets.find(s=>s.name==='Schedule').rows[0].values[3],1.5/24);assert.equal(result.model.sheets.find(s=>s.name==='Task notes').rows.at(-1).values[3],'Own child feedback');assert.ok(result.model.sheets.find(s=>s.name==='Tasks').rows.some(r=>r.level===1));
 const archive=window.WorkHubReports.files(d,{...options,includeArchive:true});assert.equal(archive.model.sheets.find(s=>s.name==='Closed archive').rows[0].values[0],'OLD-1');assert.equal(archive.model.metrics.openTickets,result.model.metrics.openTickets);const singleDay=window.WorkHubReports.files(d,{...options,from:'2026-10-16'});assert.match(singleDay.files['xl/charts/chart2.xml'],/Dashboard!\$M\$33:\$M\$33/);assert.equal(archive.model.sheets.find(s=>s.name==='Archive updates').rows[0].values[3],'Historical closure');
 for(const [path,content]of Object.entries(archive.files)){const xml=new window.DOMParser().parseFromString(content,'application/xml');assert.equal(xml.querySelector('parsererror')?.textContent||'', '',path);}
 const blob=api.exportReport(d,'2026-10-16',{...options,includeArchive:true}),entries=await unzipReport(blob);assert.ok(entries['xl/charts/chart1.xml']);assert.ok(entries['xl/worksheets/sheet2.xml'].includes('showGridLines="0"'));assert.ok(entries['xl/worksheets/sheet4.xml'].includes('Milestone'));
 if(process.env.WORKHUB_QA_REPORT)writeFileSync(process.env.WORKHUB_QA_REPORT,Buffer.from(await blob.arrayBuffer()));
});

test('Excel export opens options and long remarks continue without duplicate time or lost text',async t=>{
 const {api,document,window}=await app(t);document.getElementById('exportButton').click();assert.ok(document.getElementById('reportExportForm'));assert.equal(document.querySelector('#reportExportForm [name="includeArchive"]').checked,false);assert.equal(document.querySelector('#reportExportForm [name="closedDays"]').value,'30');
 const d=copy(api.state()),long='A detailed finding with a newline\n'.repeat(200);d.workhub.waiting.push({id:'long-notes',title:'Long follow-up',person:'Team',projectId:'',followUp:'',resolved:false,notes:long});const result=window.WorkHubReports.files(d,{asOf:'2026-10-16'}),s=result.model.sheets.find(s=>s.name==='Follow-ups');assert.ok(s.expanded.length>1);assert.equal(s.expanded.map(r=>r.values[5]).join(''),long);assert.equal(s.expanded.reduce((n,r)=>n+r.record,0),1);assert.throws(()=>window.WorkHubReports.files(d,{asOf:'2026-10-16',from:'2026-11-01',to:'2026-10-16'}),/report dates/);
});

test('recorded sessions archive, restore, delete and undo while preserving calendar and project entries',async t=>{
 const {api,document,window,db}=await app(t);
 api.hub.startTimer({kind:'project',linkId:api.state().activeProjectId,title:'Session to manage'});
 const draft=api.hub.timer();draft.started='2026-10-16T09:15:00+08:00';draft.runningSince=null;draft.segments=[{start:draft.started,end:'2026-10-16T09:45:12+08:00'}];api.hub.finishTimer();await settle();
 const id=api.state().workhub.sessions[0].id,schedule=copy(api.state().schedule),plans=copy(api.state().projectPlans);
 api.hub.setTool('sessions');api.showTab('studio');assert.match(document.querySelector('[data-session-id]').textContent,/30m 12s/);
 document.querySelector('[data-hub="session-archive"]').click();await settle();assert.equal(document.querySelectorAll('[data-session-id]').length,0);assert.equal(db.row.document.data.workhub.sessions[0].archived,true);
 document.querySelector('[data-hub="session-view"][data-view="archived"]').click();await settle();assert.ok(document.querySelector('[data-hub="session-restore"]'));
 const second=await app(t,{remote:copy(db.row),login:false});await second.api.loadCloud(sessionUser);assert.equal(second.api.state().workhub.sessions[0].archived,true);
 const report=window.WorkHubReports.build(api.state(),{asOf:'2026-10-16'});assert.equal(report.sheets.find(s=>s.name==='Work sessions').rows[0].values[7],'Archived');assert.ok(report.metrics.recordedHours>0.5);
 document.querySelector('[data-hub="session-restore"]').click();await settle();assert.equal(api.state().workhub.sessions[0].archived,false);
 document.querySelector('[data-hub="session-view"][data-view="active"]').click();await settle();let prompt='';window.confirm=value=>{prompt=value;return false;};document.querySelector('[data-hub="session-delete"]').click();await settle();assert.equal(api.state().workhub.sessions.length,1);assert.match(prompt,/Schedule and Project entries will be kept/);
 window.confirm=()=>true;document.querySelector('[data-hub="session-delete"]').click();await settle();assert.equal(api.state().workhub.sessions.length,0);assert.equal(db.row.document.data.workhub.sessions.length,0);assert.deepEqual(copy(api.state().schedule),schedule);assert.deepEqual(copy(api.state().projectPlans),plans);
 document.getElementById('hubUndo').click();await settle();assert.equal(api.state().workhub.sessions[0].id,id);assert.deepEqual(copy(api.state().schedule),schedule);assert.deepEqual(copy(api.state().projectPlans),plans);
 const bad=copy(api.state());bad.workhub.sessions[0].archived='yes';assert.throws(()=>api.validate(bad),/work session/);
});

test('Tickets starts with Pending selected and All statuses remains available',async t=>{
 const {api,document,window}=await app(t),pending=addReportTicket(api,document,'PENDING-DEFAULT'),closed=addReportTicket(api,document,'CLOSED-HISTORY');await settle();api.mutate(d=>d.tickets.find(x=>x.id===closed).status='Closed');await settle();api.showTab('tickets');
 assert.equal(document.getElementById('statusFilter').value,'Pending');assert.equal(document.querySelectorAll('.ticket-queue-card').length,1);assert.match(document.querySelector('.ticket-queue-card').textContent,/PENDING-DEFAULT/);
 document.getElementById('statusFilter').value='';document.getElementById('statusFilter').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(document.querySelectorAll('.ticket-queue-card').length,2);api.showTab('home');api.showTab('tickets');assert.equal(document.getElementById('statusFilter').value,'');assert.ok(api.state().tickets.find(t=>t.id===pending));
});

test('Momo offers expressive local jokes, clumsy recovery poses and persistent quiet time',async t=>{
 const {api,document,window,db}=await app(t),pet=document.getElementById('hubPet');window.Math.random=()=>0;
 assert.ok(pet.querySelector('.momo-mouth-grin'));assert.ok(pet.querySelector('.momo-dizzy-eyes'));assert.equal(pet.querySelectorAll('.momo-eye-right').length,1);
 api.hub.life.menu();document.querySelector('[data-momo="quip"]').click();assert.equal(pet.dataset.pose,'stumble');assert.equal(pet.dataset.expression,'dizzy');assert.match(document.getElementById('hubPetBubble').textContent,/tripped over a pixel/);
 const end=new window.Event('animationend',{bubbles:true});Object.defineProperty(end,'animationName',{value:'momo-oops'});pet.querySelector('.pet-body').dispatchEvent(end);assert.equal(pet.dataset.expression,'shy');
 let clock=window.Date.now()+9000;window.Date.now=()=>clock;api.hub.life.tick();assert.equal(pet.dataset.pose,'idle');assert.equal(pet.dataset.expression,'curious');
 api.hub.life.menu();document.querySelector('[data-momo="quip"]').click();assert.equal(pet.dataset.pose,'sneeze');assert.equal(pet.dataset.expression,'surprised');
 api.hub.life.menu();document.querySelector('[data-momo="quiet"]').click();assert.equal(window.localStorage.getItem('mm-tracker.momo-chatter.v1'),'quiet');const message=document.getElementById('hubPetBubble').textContent;clock+=600000;document.getElementById('hubPetBubble').hidden=true;api.hub.life.tick();assert.equal(document.getElementById('hubPetBubble').textContent,message);
 const second=await app(t,{storage:{'mm-tracker.momo-chatter.v1':'quiet'}});second.api.hub.life.menu();assert.equal(second.document.querySelector('[data-momo="quiet"]').getAttribute('aria-pressed'),'true');assert.equal(db.calls.length,0);
 Object.defineProperty(window,'innerWidth',{value:375,configurable:true});Object.defineProperty(window,'innerHeight',{value:667,configurable:true});api.hub.life.menu();const menu=document.getElementById('hubMomoMenu');Object.defineProperty(menu,'scrollHeight',{value:500,configurable:true});api.hub.life.layout();assert.ok(parseFloat(menu.style.top)>=12);assert.ok(parseFloat(menu.style.top)+500<=655);assert.ok(parseFloat(menu.style.width)<=351);
});

test('random Momo chats pause for forms, Focus, presentation, hidden pages and reduced motion',async t=>{
 const {api,document,window,db}=await app(t),pet=document.getElementById('hubPet'),bubble=document.getElementById('hubPetBubble');window.Math.random=()=>0;let clock=window.Date.now()+200000;window.Date.now=()=>clock;
 const reset=()=>{bubble.hidden=true;};const noChat=()=>{reset();api.hub.life.tick();assert.equal(bubble.hidden,true);};
 api.showTab('knowledge');document.getElementById('hubSearch').focus();noChat();document.getElementById('hubSearch').blur();
 api.editRecord('tasks');noChat();api.closeModal();document.body.classList.add('hub-focus');noChat();document.body.classList.remove('hub-focus');document.body.classList.add('hub-present');noChat();document.body.classList.remove('hub-present');
 Object.defineProperty(document,'hidden',{configurable:true,value:true});noChat();Object.defineProperty(document,'hidden',{configurable:true,value:false});window.matchMedia=()=>({matches:true});noChat();window.matchMedia=()=>({matches:false});
 api.hub.life.tick();assert.equal(bubble.hidden,false);assert.equal(pet.dataset.pose,'stumble');const first=bubble.textContent;clock+=10000;reset();api.hub.life.tick();assert.equal(bubble.hidden,true);clock+=300000;api.hub.life.tick();assert.notEqual(bubble.textContent,first);assert.equal(db.calls.length,0);
});

test('downloaded Excel uses the real form path and preserves the OOXML element order and package links',async t=>{
 const {api,document,window}=await app(t);let downloaded=null,filename='';window.URL.createObjectURL=blob=>{downloaded=blob;return'blob:report';};window.HTMLAnchorElement.prototype.click=function(){filename=this.download;};
 document.getElementById('exportButton').click();document.getElementById('reportExportForm').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.ok(downloaded);assert.match(filename,/\.xlsx$/);assert.equal(downloaded.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 const entries=await unzipReport(downloaded),parse=s=>new window.DOMParser().parseFromString(s,'application/xml');assert.ok(entries['xl/workbook.xml']);
 // ECMA-376 Part 4, CT_SheetPr: tabColor, outlinePr, pageSetUpPr.
 // Excel repairs this file if outlinePr is emitted after pageSetUpPr.
 for(const [path,content]of Object.entries(entries)){
  const xml=parse(content);assert.equal(xml.querySelector('parsererror'),null,path);
  if(/^xl\/worksheets\/sheet\d+\.xml$/.test(path)){
   const props=xml.getElementsByTagName('sheetPr')[0],order=['tabColor','outlinePr','pageSetUpPr'];const positions=[...props.children].map(n=>order.indexOf(n.localName));assert.deepEqual(positions,[...positions].sort((a,b)=>a-b),path);
   const sheetOrder=['sheetPr','dimension','sheetViews','sheetFormatPr','cols','sheetData','autoFilter','mergeCells','conditionalFormatting','hyperlinks','printOptions','pageMargins','pageSetup','headerFooter','drawing'];let last=-1;for(const node of xml.documentElement.children){const n=sheetOrder.indexOf(node.localName);assert.ok(n>=last,path+': '+node.localName);last=n;}
   const refs=[...xml.getElementsByTagName('c')].map(n=>n.getAttribute('r'));assert.equal(new Set(refs).size,refs.length,path);
  }
  if(path.endsWith('.rels'))for(const rel of xml.documentElement.children){if(rel.getAttribute('TargetMode')==='External')continue;const source=path==='_rels/.rels'?'':path.replace(/_rels\/[^/]+\.rels$/,'');const target=new URL(rel.getAttribute('Target'),'https://package/'+source).pathname.slice(1);assert.ok(entries[target],path+' -> '+target);}
 }
});

test('retired external video integration leaves no controls, players or stored search key',async t=>{
 const {api,document,window,db}=await app(t,{storage:{'mm-tracker.youtube-key.v1':'old-device-key','mm-tracker.music.v1':JSON.stringify({favourites:[]})}});
 assert.equal(window.localStorage.getItem('mm-tracker.youtube-key.v1'),null);assert.equal(window.localStorage.getItem('mm-tracker.music.v1'),null);
 assert.equal(window.WorkHubMusic,undefined);assert.equal(api.hub.music,undefined);
 document.getElementById('focusModeButton').click();api.hub.life.menu();
 assert.equal(document.querySelector('[data-momo="music"],[data-music],#musicCorner,#musicSettingsLauncher,#fpMusicForm,iframe'),null);
 assert.ok(document.getElementById('fpSoundPane'));assert.equal(/youtube|music corner/i.test(document.body.textContent),false);
 const policy=document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;assert.ok(policy.includes("frame-src 'none'"));assert.equal(/youtube|ytimg|googleapis/.test(policy),false);
 assert.equal(db.calls.length,0);
});

test('built-in list library groups editors, preserves hidden drafts and saves previews through cloud reopen',async t=>{
 const {api,document,window,db}=await app(t);api.editLists();const form=document.getElementById('listsForm');
 assert.equal(form.querySelectorAll('[data-list-pane]:not([hidden])').length,1);
 assert.equal(form.querySelector('[data-list-count="0"]').textContent,'12 / 12 steps');
 const phases=copy(api.state().lists.phaseGateCriteria),department=form.elements.namedItem('departments');
 department.value+='\nA new support team\nA new support team';department.dispatchEvent(new window.Event('input',{bubbles:true}));
 const preview=form.querySelector('[data-list-preview="'+department.dataset.listInput+'"]');assert.equal([...preview.children].filter(li=>li.textContent==='A new support team').length,1);
 const search=document.getElementById('blSearch');search.value='departments';search.dispatchEvent(new window.Event('input',{bubbles:true}));
 assert.equal(department.closest('[data-list-pane]').hidden,false);assert.equal(form.querySelectorAll('[data-list-tab]:not([hidden])').length,1);
 const milestones=form.elements.namedItem('milestones'),rows=milestones.value.split('\n');rows[0]='Confirm <script> is plain text';milestones.value=rows.join('\n');milestones.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(form.querySelector('script'),null);
 search.value='';search.dispatchEvent(new window.Event('input',{bubbles:true}));const tab=form.querySelector('[data-list-tab]:not([hidden])');tab.dispatchEvent(new window.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));assert.equal(document.activeElement,form.querySelector('[data-list-tab]:last-child'));
 await settle();assert.equal(db.calls.length,0);api.saveLists(form);await settle();
 assert.ok(api.state().lists.departments.includes('A new support team'));assert.equal(api.steps()[0],'Confirm <script> is plain text');assert.deepEqual(copy(api.state().lists.phaseGateCriteria),phases);
 const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);assert.ok(reopened.api.state().lists.departments.includes('A new support team'));assert.equal(reopened.api.steps()[0],'Confirm <script> is plain text');
});

test('built-in lists keep milestone counts, used departments and account boundaries protected',async t=>{
 const {api,document,db}=await app(t);addCompany(api,document);addProcess(api,document);await settle();api.editLists();const form=document.getElementById('listsForm'),before=JSON.stringify(api.state()),milestones=form.elements.namedItem('milestones'),original=milestones.value;
 milestones.value=original.split('\n').slice(1).join('\n');assert.throws(()=>api.saveLists(form),/exactly 12/);assert.equal(JSON.stringify(api.state()),before);
 milestones.value=original;const used=api.state().projectProcessMappings[0].department;form.elements.namedItem('departments').value=api.state().lists.departments.filter(d=>d!==used).join('\n');assert.throws(()=>api.saveLists(form),/Keep department|Keep all built-in lists/);assert.equal(JSON.stringify(api.state()),before);
 const writes=db.calls.length;await api.loadCloud({user:{id:'22222222-2222-4222-8222-222222222222',email:'another@example.com'}});assert.throws(()=>api.saveLists(form),/current account/);assert.equal(db.calls.length,writes);
});

test('expressive motion pauses on hidden pages and Animations Off disables decorative movement without saves',async t=>{
 const {api,document,window,db}=await app(t,{styles:true});api.editLists();document.body.dataset.motion='off';const mark=document.querySelector('.bl-library-mark');assert.equal(window.getComputedStyle(mark).animation,'none');assert.equal(window.getComputedStyle(mark).transition,'none');
 Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(document.body.classList.contains('hub-motion-paused'),true);
 Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(document.body.classList.contains('hub-motion-paused'),false);assert.equal(db.calls.length,0);
});

test('daylight follows the local clock across all four phases without changing records',async t=>{
 const ctx=await app(t),{api,window,document,db}=ctx,original=window.Date;let clock=Date.parse('2026-10-16T04:59:00+08:00');
 window.Date=class extends original{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
 const before=JSON.stringify(api.state());
 for(const [time,phase]of [['04:59','night'],['05:00','morning'],['10:59','morning'],['11:00','afternoon'],['16:59','afternoon'],['17:00','evening'],['19:59','evening'],['20:00','night']]){
  clock=Date.parse('2026-10-16T'+time+':00+08:00');api.hub.atmosphere.tick();assert.equal(document.body.dataset.atmosphere,phase);assert.equal(api.hub.atmosphere.snapshot().phase,phase);assert.equal(document.getElementById('hubAtmosphereCard').dataset.phase,phase);
 }
 for(const tab of ['tasks','tickets','schedule','specs','home'])api.showTab(tab);
 assert.equal(document.querySelectorAll('#hubAtmosphere').length,1);assert.equal(document.querySelectorAll('#hubVisitors').length,1);assert.equal(document.querySelectorAll('#atmosphereSettings').length,1);assert.ok(document.getElementById('settingsMenu').contains(document.getElementById('atmosphereSettings')));
 assert.equal(JSON.stringify(api.state()),before);assert.equal(db.calls.length,0);
});

test('atmosphere choices save on this device, preview safely and synchronize across local tabs',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx;const before=JSON.stringify(api.state());
 await atmosphereChoices(ctx,{mode:'night',rain:true,visitors:false});assert.equal(document.body.dataset.atmosphere,'night');assert.equal(document.getElementById('hubAtmosphere').dataset.rain,'true');assert.equal(api.hub.atmosphere.invite(),false);
 const storage={'mm-tracker.atmosphere.v1':window.localStorage.getItem('mm-tracker.atmosphere.v1')},second=await app(t,{storage});assert.equal(second.document.body.dataset.atmosphere,'night');assert.equal(second.api.hub.atmosphere.snapshot().preferences.visitors,false);
 api.hub.atmosphere.settings();const select=document.getElementById('atmosphereMode');select.value='morning';select.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(document.getElementById('atmospherePreview').dataset.phase,'morning');assert.equal(document.body.dataset.atmosphere,'night');document.querySelector('[data-atmosphere-action="cancel"]').click();await settle();assert.equal(document.body.dataset.atmosphere,'night');
 window.localStorage.setItem('mm-tracker.atmosphere.v1',JSON.stringify({mode:'off',rain:false,visitors:false}));window.dispatchEvent(new window.StorageEvent('storage',{key:'mm-tracker.atmosphere.v1'}));assert.equal(document.body.dataset.atmosphere,'off');assert.equal(document.getElementById('hubAtmosphere').hidden,true);assert.equal(document.getElementById('hubAtmosphereCard').hidden,true);
 assert.equal(JSON.stringify(api.state()),before);assert.equal(db.calls.length,0);assert.equal(second.db.calls.length,0);
 const invalid=await app(t,{storage:{'mm-tracker.atmosphere.v1':'{"mode":"<script>","visitors":"yes","rain":1}'}});assert.ok(['morning','afternoon','evening','night'].includes(invalid.document.body.dataset.atmosphere));assert.equal(invalid.api.hub.atmosphere.snapshot().preferences.rain,false);
});

test('tiny visitors match the scenery, respond to a hello and leave without uploading anything',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx;const before=JSON.stringify(api.state());
 for(const [mode,kind]of [['morning','butterfly'],['afternoon','bird'],['evening','firefly'],['night','firefly']]){
  await atmosphereChoices(ctx,{mode,visitors:true},true);const visitor=document.querySelector('.hub-visitor');assert.ok(visitor,mode);assert.equal(visitor.dataset.visitor,kind);assert.ok(visitor.querySelector('svg'));assert.match(visitor.getAttribute('aria-label'),/Say hello/);assert.equal(api.hub.atmosphere.invite(),false);assert.equal(document.querySelectorAll('.hub-visitor').length,1);
  visitor.focus();assert.ok(visitor.classList.contains('is-held'));visitor.click();assert.ok(visitor.classList.contains('is-greeted'));assert.equal(api.hub.atmosphere.snapshot().visitor.greeted,true);assert.equal(document.getElementById('hubPetBubble').hidden,false);
  const now=window.Date.now();window.Date.now=()=>now+2000;api.hub.atmosphere.tick();assert.equal(document.querySelector('.hub-visitor'),null);assert.equal(api.hub.atmosphere.snapshot().visitor,null);
 }
 assert.equal(JSON.stringify(api.state()),before);assert.equal(db.calls.length,0);
});

test('visitors and moving weather respect writing, dialogs, view modes and device motion settings',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx;await atmosphereChoices(ctx,{mode:'morning',rain:true,visitors:true},true);assert.ok(document.querySelector('.hub-visitor'));
 for(const cls of ['hub-focus','hub-private','hub-present','hub-sorting']){
  document.body.classList.add(cls);api.hub.atmosphere.sync();assert.equal(document.querySelector('.hub-visitor'),null);assert.equal(api.hub.atmosphere.invite(),false);assert.equal(document.getElementById('hubAtmosphere').dataset.paused,'true');if(cls==='hub-present')assert.equal(document.getElementById('hubAtmosphere').hidden,true);document.body.classList.remove(cls);
 }
 api.editRecord('tasks');api.hub.atmosphere.sync();assert.equal(api.hub.atmosphere.invite(),false);api.closeModal();
 api.showTab('knowledge');document.getElementById('hubSearch').focus();assert.equal(api.hub.atmosphere.invite(),false);document.getElementById('hubSearch').blur();
 const base=window.Date.now();window.Date.now=()=>base+20000;
 window.matchMedia=()=>({matches:true});api.hub.atmosphere.sync();assert.equal(api.hub.atmosphere.invite(),false);window.matchMedia=()=>({matches:false});
 api.state().workhub.preferences.motion='off';api.hub.atmosphere.sync();assert.equal(api.hub.atmosphere.invite(),false);api.state().workhub.preferences.motion='calm';
 Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(api.hub.atmosphere.invite(),false);Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new window.Event('visibilitychange'));window.Date.now=()=>base+30000;assert.equal(api.hub.atmosphere.invite(),true);
 api.cloud.ready=false;api.hub.atmosphere.sync();assert.equal(document.querySelector('.hub-visitor'),null);assert.equal(document.getElementById('hubAtmosphere').hidden,true);assert.equal(db.calls.length,0);
});

test('visitors fit a phone viewport, avoid floating controls and clean up on resize and Escape',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx;await atmosphereChoices(ctx,{mode:'morning',visitors:true});
 Object.defineProperty(window,'visualViewport',{configurable:true,value:{offsetLeft:15,offsetTop:20,width:375,height:600,addEventListener(){}}});
 document.getElementById('hubPet').getBoundingClientRect=()=>({left:25,top:548,right:73,bottom:596,width:48,height:48});
 window.dispatchEvent(new window.Event('resize'));const now=window.Date.now();window.Date.now=()=>now+4000;assert.equal(api.hub.atmosphere.invite(),true);
 let visitor=document.querySelector('.hub-visitor');const x=parseFloat(visitor.style.getPropertyValue('--visitor-x')),y=parseFloat(visitor.style.getPropertyValue('--visitor-y'));assert.ok(x>=23&&x+48<=382);assert.ok(y>=28&&y+48<=612);assert.ok(x>=79);visitor.focus();document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(document.querySelector('.hub-visitor'),null);
 window.dispatchEvent(new window.Event('resize'));assert.equal(document.querySelector('.hub-visitor'),null);window.Date.now=()=>now+8000;assert.equal(api.hub.atmosphere.invite(),true);window.dispatchEvent(new window.Event('resize'));assert.equal(document.querySelector('.hub-visitor'),null);
 window.visualViewport.width=280;window.Date.now=()=>now+12000;assert.equal(api.hub.atmosphere.invite(),false);assert.equal(db.calls.length,0);
});

test('visitors arrive occasionally and clean up between visits without a cloud save',async t=>{
 const ctx=await app(t),{api,window,document,db}=ctx;await atmosphereChoices(ctx,{mode:'morning',visitors:true});const base=window.Date.now();let elapsed=25000;window.Date.now=()=>base+elapsed;
 api.hub.atmosphere.tick();assert.equal(document.querySelectorAll('.hub-visitor').length,1);api.hub.atmosphere.tick();assert.equal(document.querySelectorAll('.hub-visitor').length,1);
 elapsed=45000;api.hub.atmosphere.tick();assert.equal(document.querySelectorAll('.hub-visitor').length,0);elapsed=200000;api.hub.atmosphere.tick();assert.equal(document.querySelectorAll('.hub-visitor').length,1);assert.equal(db.calls.length,0);
});

test('a subtask Complete button updates only that child and saves its existing details',async t=>{
 const {api,document,db}=await app(t),id=addMainTask(api,document,'Direct completion');await settle();const first=addTaskSub(api,document,id,'Review blueprint','Keep the review notes','Feedback from owner','In Progress');await settle();const second=addTaskSub(api,document,id,'Run UAT','Other notes','Still waiting','Blocked');await settle();api.showTab('tasks');
 const before=copy(api.state().tasks[0]),calls=db.calls.length;document.querySelector('[data-hub="subtask-complete"][data-id="'+first+'"]').click();await settle();
 const task=api.state().tasks[0],child=task.subTasks.find(s=>s.id===first);assert.equal(child.status,'Completed');assert.equal(child.remarks,before.subTasks[0].remarks);assert.equal(child.feedback,before.subTasks[0].feedback);assert.equal(child.createdAt,before.subTasks[0].createdAt);assert.ok(!Number.isNaN(Date.parse(child.updatedAt)));assert.deepEqual(copy(task.subTasks.find(s=>s.id===second)),before.subTasks[1]);assert.equal(task.done,false);assert.equal(db.calls.length,calls+1);
 const completed=document.querySelector('[data-hub="subtask-complete"][data-id="'+first+'"]');assert.equal(completed.disabled,true);assert.match(document.querySelector('.task-subheading').textContent,/1\/2 complete/);completed.click();await settle();await api.hub.handle({dataset:{hub:'subtask-complete',parent:id,id:first}});await settle();assert.equal(db.calls.length,calls+1);assert.equal(db.row.document.data.tasks[0].subTasks[0].status,'Completed');assert.equal(api.parseBackup(JSON.stringify(db.row.document)).tasks[0].subTasks[0].feedback,'Feedback from owner');
});

test('marking a main task complete finishes every unfinished child in a single saved change',async t=>{
 const {api,document,window,db}=await app(t),id=addMainTask(api,document,'Complete the delivery');await settle();
 for(const status of ['Not started','In Progress','Blocked','Completed']){addTaskSub(api,document,id,status+' child',status+' notes',status+' feedback',status);await settle();}
 const other=addMainTask(api,document,'Another delivery');await settle();addTaskSub(api,document,other,'Leave this child','Separate notes','Separate feedback','Blocked');await settle();
 const before=copy(api.state().tasks.find(t=>t.id===id)),unrelated=copy(api.state().tasks.find(t=>t.id===other));api.showTab('tasks');assert.equal(document.querySelector('.task-complete-control'),null);const actions=document.querySelector('.task-main-card .task-action-cluster');assert.ok(actions.querySelector('[data-action="edit"]'));assert.ok(actions.querySelector('[data-reminder="edit"]'));assert.ok(actions.querySelector('[data-hub="timer-new"]'));assert.equal(actions.querySelectorAll('.task-action-button').length,5);actions.querySelector('[data-hub="timer-new"]').click();await settle();assert.ok(document.getElementById('hubTimerStart'));api.closeModal();const calls=db.calls.length,control=document.querySelector('[data-bench="status"][data-kind="tasks"][data-id="'+id+'"]');assert.ok(control);control.click();await settle();const choice=document.querySelector('[data-bench="status-pick"][data-value="done"]');assert.ok(choice);choice.click();await settle();
 api.showTab('tasks');document.getElementById('taskView').value='done';document.getElementById('taskView').dispatchEvent(new window.Event('change',{bubbles:true}));assert.ok(document.querySelector('.task-action-cluster [data-action="archive-task"]'));const task=api.state().tasks.find(t=>t.id===id);assert.equal(task.done,true);assert.equal(task.boardStatus,'done');assert.ok(task.doneDate);assert.ok(task.subTasks.every(s=>s.status==='Completed'));assert.equal(db.calls.length,calls+1);
 for(let i=0;i<task.subTasks.length;i++){const sub=task.subTasks[i],prior=before.subTasks[i];for(const k of ['id','title','remarks','feedback','createdAt'])assert.equal(sub[k],prior[k]);if(prior.status==='Completed')assert.equal(sub.updatedAt,prior.updatedAt);}
 assert.equal(new Set(task.subTasks.slice(0,3).map(s=>s.updatedAt)).size,1);assert.deepEqual(copy(api.state().tasks.find(t=>t.id===other)),unrelated);assert.ok(db.row.document.data.tasks.find(t=>t.id===id).subTasks.every(s=>s.status==='Completed'));
});

test('main-task edit completion persists all child statuses and reopening preserves their completed work',async t=>{
 const {api,document,db}=await app(t),id=addMainTask(api,document,'Edit to finish');await settle();addTaskSub(api,document,id,'Configuration','Do not lose this','Approved','Blocked');await settle();
 api.editRecord('tasks',id);let form=document.getElementById('editForm');form.elements.namedItem('done').checked=true;const calls=db.calls.length;api.saveEdit(form);await settle();assert.equal(db.calls.length,calls+1);assert.equal(api.state().tasks[0].subTasks[0].status,'Completed');const completed=copy(api.state().tasks[0].subTasks);
 const other=await app(t,{remote:copy(db.row),login:false});await other.api.loadCloud(sessionUser);await settle();assert.equal(other.api.state().tasks[0].done,true);assert.deepEqual(copy(other.api.state().tasks[0].subTasks),completed);
 api.editRecord('tasks',id);form=document.getElementById('editForm');form.elements.namedItem('done').checked=false;api.saveEdit(form);await settle();assert.equal(api.state().tasks[0].done,false);assert.deepEqual(copy(api.state().tasks[0].subTasks),completed);
});

test('board details support direct child completion and moving to Done completes the remaining children',async t=>{
 const {api,document,window,db}=await app(t),id=addMainTask(api,document,'Board delivery');await settle();const first=addTaskSub(api,document,id,'First child','First note','First feedback');await settle();addTaskSub(api,document,id,'Remaining child','Second note','Second feedback','Blocked');await settle();api.hub.setBoard(true);api.showTab('tasks');
 document.querySelector('[data-hub="task-detail"][data-id="'+id+'"]').click();await settle();document.querySelector('#modalBody [data-hub="subtask-complete"][data-id="'+first+'"]').click();await settle();assert.equal(document.getElementById('modal').open,true);assert.equal(document.querySelector('#modalBody [data-hub="subtask-complete"][data-id="'+first+'"]').disabled,true);assert.equal(api.state().tasks[0].done,false);assert.equal(api.state().tasks[0].subTasks[1].status,'Blocked');api.closeModal();
 let move=document.querySelector('[data-hub-move="'+id+'"]');move.value='done';const calls=db.calls.length;move.dispatchEvent(new window.Event('change',{bubbles:true}));await settle();assert.equal(db.calls.length,calls+1);assert.ok(api.state().tasks[0].subTasks.every(s=>s.status==='Completed'));assert.ok(document.querySelector('[data-column="done"] [data-task-card="'+id+'"]'));assert.match(document.querySelector('[data-task-card="'+id+'"] .hub-meta:nth-of-type(2)').textContent,/2\/2 subtasks/);
 move=document.querySelector('[data-hub-move="'+id+'"]');move.value='doing';move.dispatchEvent(new window.Event('change',{bubbles:true}));await settle();assert.equal(api.state().tasks[0].done,false);assert.ok(api.state().tasks[0].subTasks.every(s=>s.status==='Completed'));assert.equal(api.state().tasks[0].subTasks[1].feedback,'Second feedback');
});

test('Focus supports custom minutes and updating a running total keeps elapsed time',async t=>{
 const {api,document,window,intervals,db}=await app(t),task=addMainTask(api,document,'Concentrate on this');await settle();api.hub.setTool('focus');api.showTab('studio');let time=window.Date.now();window.Date.now=()=>time;const tick=intervals.find(i=>i.ms===1000).callback,calls=db.calls.length;
 let form=document.getElementById('hubFocusForm');form.elements.namedItem('focusTask').value=task;form.elements.namedItem('minutes').value='40';form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(document.getElementById('hubFocusClock').textContent,'40:00');assert.equal(document.body.classList.contains('hub-focus'),true);assert.equal(window.localStorage.getItem('mm-tracker.focus-minutes.v1'),'40');
 time+=10*60000;tick();assert.equal(document.getElementById('hubFocusClock').textContent,'30:00');form=document.getElementById('hubFocusForm');form.elements.namedItem('minutes').value='45';form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(document.getElementById('hubFocusClock').textContent,'35:00');assert.match(document.getElementById('hubFocusForm').textContent,/Concentrate on this/);assert.equal(window.localStorage.getItem('mm-tracker.focus-minutes.v1'),'45');
 time+=35*60000;tick();assert.equal(document.body.classList.contains('hub-focus'),false);assert.equal(document.getElementById('hubFocusClock').textContent,'45:00');assert.match(document.getElementById('toast').textContent,/Focus session complete/);assert.equal(db.calls.length,calls);
});

test('Focus validates custom lengths and a shortened total can complete an elapsed session',async t=>{
 const {api,document,window,db}=await app(t);api.hub.setTool('focus');api.showTab('studio');let time=window.Date.now();window.Date.now=()=>time;
 for(const value of ['','0','-1','1.5','1441']){const form=document.getElementById('hubFocusForm');form.elements.namedItem('minutes').value=value;assert.throws(()=>api.hub.submit(form),/whole number of minutes/);assert.equal(document.body.classList.contains('hub-focus'),false);}
 let form=document.getElementById('hubFocusForm');form.elements.namedItem('minutes').value='25';api.hub.submit(form);time+=10*60000;form=document.getElementById('hubFocusForm');form.elements.namedItem('minutes').value='0';assert.throws(()=>api.hub.submit(form),/whole number/);assert.equal(document.body.classList.contains('hub-focus'),true);assert.equal(window.localStorage.getItem('mm-tracker.focus-minutes.v1'),'25');
 form.elements.namedItem('minutes').value='5';api.hub.submit(form);assert.equal(document.body.classList.contains('hub-focus'),false);assert.equal(document.getElementById('hubFocusClock').textContent,'05:00');assert.match(document.getElementById('toast').textContent,/Focus session complete/);assert.equal(db.calls.length,0);
});

test('Focus remembers the last used duration on this device and accepts minute boundaries',async t=>{
 const {api,document,window,db}=await app(t);api.hub.setTool('focus');api.showTab('studio');assert.equal(document.getElementById('hubFocusMinutes').value,'25');let input=document.getElementById('hubFocusMinutes');input.value='55';input.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(document.getElementById('hubFocusClock').textContent,'55:00');api.hub.submit(document.getElementById('hubFocusForm'));await api.hub.handle({dataset:{hub:'focus-stop'}});
 const second=await app(t,{storage:{'mm-tracker.focus-minutes.v1':window.localStorage.getItem('mm-tracker.focus-minutes.v1')}});second.api.hub.setTool('focus');second.api.showTab('studio');assert.equal(second.document.getElementById('hubFocusMinutes').value,'55');assert.equal(second.document.getElementById('hubFocusClock').textContent,'55:00');
 for(const value of ['1','1440']){input=document.getElementById('hubFocusMinutes');input.value=value;input.dispatchEvent(new window.Event('input',{bubbles:true}));api.hub.submit(document.getElementById('hubFocusForm'));assert.equal(document.getElementById('hubFocusClock').textContent,value==='1'?'01:00':'1440:00');assert.equal(document.getElementById('hubFocusClock').dataset.long,String(value==='1440'));await api.hub.handle({dataset:{hub:'focus-stop'}});}
 assert.equal(db.calls.length,0);assert.equal(second.db.calls.length,0);
});

function addLabCase(api,document,values={}){
 api.hub.workbench.caseForm();const form=document.getElementById('benchCaseForm');fill(form,{title:'MIGO account determination error',error:'Account determination failed',tcodes:'MIGO M7-021',system:'QA',...values});api.hub.workbench.saveCase(form);return api.state().workhub.lab.at(-1).id;
}
function mockAmbientAudio(window,{pending=false}={}){
 const instances=[];const param=()=>({value:0,setTargetAtTime(v){this.value=v;},cancelScheduledValues(){},setValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;}});
 const node=()=>({gain:param(),frequency:param(),Q:param(),playbackRate:param(),connect(){},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;}});
 window.AudioContext=class{constructor(){this.state='suspended';this.sampleRate=100;this.currentTime=0;this.destination={};this.nodes=[];instances.push(this);}createGain(){const n=node();this.nodes.push(n);return n;}createBufferSource(){const n=node();this.nodes.push(n);return n;}createBiquadFilter(){return node();}createDynamicsCompressor(){const n={...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),isCompressor:true};this.nodes.push(n);return n;}createOscillator(){const n=node();this.nodes.push(n);return n;}createBuffer(c,n){return{getChannelData:()=>new Float32Array(n)};}resume(){if(pending)return new Promise(resolve=>{this.finishResume=()=>{this.state='running';resolve();};});this.state='running';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}};return instances;
}

test('workspace Schedule uses activity titles and consistent location, task and ticket colours in both views',async t=>{
 const {api,document}=await app(t);api.setMonth('2026-10');
 for(const [title,time,endTime,location]of [['Fit-to-standard workshop','09:00','10:00','Office'],['Client blueprint review','10:00','11:00','Client site']]){api.editPlan();const f=document.getElementById('planForm');fill(f,{title,date:'2026-10-16',endDate:'2026-10-16',time,endTime,location});api.savePlan(f);await settle();}
 const taskId=addMainTask(api,document,'Prepare mapping');await settle();const ticketId=addReportTicket(api,document);await settle();const linkedId=addMainTask(api,document,'Investigate invoice');await settle();
 api.mutate(d=>{const task=d.tasks.find(x=>x.id===linkedId);task.taskType='Ticket';task.linkId=ticketId;});await settle();
 for(const [time,end]of [['11:00','12:00'],['12:00','13:00'],['13:00','14:00']]){addBooking(api,document,time,end);await settle();}
 api.mutate(d=>{for(const [time,id]of [['11:00',taskId],['12:00',linkedId]]){const s=d.schedule.find(s=>s.time===time);s.kind='task';s.linkId=id;}});await settle();api.showTab('schedule');document.querySelector('[data-action="schedule-day"][data-date="2026-10-16"]').click();await settle();
 const verify=()=>{const buttons=[...document.querySelectorAll('#view [data-action="open-booking"]')],at=time=>buttons.find(b=>b.dataset.time===time);assert.match(at('09:00').textContent,/Fit-to-standard workshop/);assert.match(at('10:00').textContent,/Client blueprint review/);assert.equal(at('09:00').dataset.entryKind,'projects');assert.equal(at('09:00').dataset.entryLocation,'Office');assert.notEqual(at('09:00').style.getPropertyValue('--entry-hue'),at('10:00').style.getPropertyValue('--entry-hue'));assert.equal(at('11:00').dataset.entryKind,'tasks');assert.equal(at('12:00').dataset.entryKind,'tickets');assert.equal(at('13:00').dataset.entryKind,'custom');assert.equal(new Set(['09:00','11:00','12:00','13:00'].map(time=>at(time).style.getPropertyValue('--entry-hue'))).size,4);assert.match(document.getElementById('benchScheduleLegend').textContent,/Project · Office/);};verify();
 document.querySelector('[data-action="schedule-layout"][data-layout="grid"]').click();verify();assert.match(api.hub.workbench.resolve('schedule','2026-10-16|09:00').title,/Fit-to-standard workshop/);
 api.mutate(d=>d.lists.workLocations.push('Home','Warehouse'));await settle();assert.equal(new Set(api.state().lists.workLocations.map(api.hub.workbench.locationHue)).size,4);
});

test('workspace status badges complete a main task and all subtasks in a single preserved save',async t=>{
 const {api,document,db}=await app(t),id=addMainTask(api,document,'Finish a release');await settle();addTaskSub(api,document,id,'Review','Keep remarks','Keep feedback','Blocked');await settle();api.showTab('tasks');const before=db.calls.length;
 document.querySelector('[data-bench="status"][data-kind="tasks"]').click();assert.ok(document.querySelector('.bench-status-options'));document.querySelector('[data-bench="status-pick"][data-value="done"]').click();await settle();assert.equal(db.calls.length,before+1);const task=api.state().tasks[0];assert.equal(task.done,true);assert.equal(task.subTasks[0].status,'Completed');assert.equal(task.subTasks[0].remarks,'Keep remarks');assert.equal(task.subTasks[0].feedback,'Keep feedback');assert.equal(db.row.document.data.tasks[0].done,true);
 api.hub.workbench.changeStatus('tasks',id,'','todo');await settle();assert.equal(api.state().tasks[0].subTasks[0].status,'Completed');assert.throws(()=>api.hub.workbench.changeStatus('tasks',id,'','invalid'),/valid status/);
});

test('workspace ticket stopwatch bookings retain their colour after their session is deleted',async t=>{
 const {api,document}=await app(t),id=addReportTicket(api,document);await settle();api.mutate(d=>{const s={id:'ticket-time',title:'Ticket investigation',kind:'ticket',linkId:id,projectId:'',subTaskId:'',chargeCode:'',notes:'Reviewed the error',start:'2026-10-16T01:00:00.000Z',end:'2026-10-16T02:00:00.000Z',intervals:[{start:'2026-10-16T01:00:00.000Z',end:'2026-10-16T02:00:00.000Z'}],seconds:3600,archived:false,scheduled:false};d.workhub.sessions.push(s);api.hub.scheduleSession(s,d);});await settle();assert.equal(api.hub.workbench.scheduleKind(api.state().schedule[0]),'tickets');api.mutate(d=>d.workhub.sessions=[]);await settle();assert.equal(api.hub.workbench.scheduleKind(api.state().schedule[0]),'tickets');assert.equal(api.state().schedule[0].ticketId,id);assert.equal(api.parseBackup(api.payload(api.state())).schedule[0].ticketId,id);
});

test('workspace ticket and project sub-item status badges preserve notes and return to their details',async t=>{
 const {api,document,db}=await app(t),id=addReportTicket(api,document);await settle();api.showTab('tickets');const badge=document.querySelector('[data-bench="status"][data-kind="tickets"]');assert.ok(badge);assert.equal(document.querySelector('select[data-ticket-status]').hidden,true);badge.click();document.querySelector('[data-bench="status-pick"][data-value="Closed"]').click();await settle();assert.equal(api.state().tickets[0].status,'Closed');assert.ok(api.state().workhub.ticketClosures.find(x=>x.id===id));
 api.editRecord('specs');let f=document.getElementById('editForm');fill(f,{description:'Blueprint sign-off'});api.saveEdit(f);await settle();const parent=api.state().specs[0].id;api.editSubItem(parent);f=document.getElementById('subItemForm');fill(f,{title:'Check assumptions',remarks:'A note to keep'});api.saveSubItem(f);await settle();document.querySelector('[data-bench="status"][data-kind="specSub"]').click();document.querySelector('[data-bench="status-pick"][data-value="Completed"]').click();await settle();assert.equal(api.state().specs[0].subItems[0].status,'Completed');assert.equal(api.state().specs[0].subItems[0].remarks,'A note to keep');assert.match(document.getElementById('modalBody').textContent,/Check assumptions/);assert.equal(db.row.document.data.specs[0].subItems[0].status,'Completed');
});

test('workspace phone hold previews stay in bounds, suppress release clicks and cancel while scrolling',async t=>{
 const {api,document,window,db}=await app(t),id=addReportTicket(api,document);await settle();api.showTab('tickets');Object.defineProperty(window,'innerWidth',{configurable:true,value:375});Object.defineProperty(window,'innerHeight',{configurable:true,value:667});const target=document.querySelector('[data-peek-kind="tickets"]');assert.ok(target);let now=window.Date.now();window.Date.now=()=>now;const timers=new Map();let i=0;window.setTimeout=(fn,ms)=>{timers.set(++i,{fn,ms});return i;};window.clearTimeout=id=>timers.delete(id);
 const touch=(type,x=40,y=60)=>{const e=new window.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y});Object.defineProperty(e,'pointerType',{value:'touch'});target.dispatchEvent(e);return e;},fire=ms=>{for(const [id,timer]of [...timers])if(timer.ms===ms){timers.delete(id);timer.fn();}};const calls=db.calls.length;touch('pointerdown');fire(500);let peek=document.getElementById('benchPeek');assert.ok(peek);assert.ok(parseFloat(peek.style.width)<=351);assert.ok(parseFloat(peek.style.left)>=12);assert.ok(parseFloat(peek.style.top)>=12);now+=5000;assert.equal(touch('contextmenu').defaultPrevented,true);touch('pointerup');assert.equal(touch('click').defaultPrevented,true);assert.equal(document.getElementById('modal').open,false);assert.equal(db.calls.length,calls);
 window.dispatchEvent(new window.Event('scroll'));assert.equal(document.getElementById('benchPeek'),null);touch('pointerdown');touch('pointermove',40,100);fire(500);assert.equal(document.getElementById('benchPeek'),null);assert.equal(api.state().tickets[0].id,id);
});

test('workspace keyboard previews restore focus and privacy immediately closes them',async t=>{
 const {api,document,window,db}=await app(t);addMainTask(api,document,'A keyboard task');await settle();api.showTab('tasks');const title=document.querySelector('[data-peek-kind="tasks"]');title.focus();title.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(document.activeElement.dataset.bench,'peek-close');document.activeElement.click();assert.equal(document.getElementById('benchPeek'),null);assert.equal(document.activeElement,title);api.hub.workbench.peek(title);document.querySelector('[data-hub="privacy"]').click();await settle();assert.equal(document.getElementById('benchPeek'),null);assert.equal(db.calls.length,1);
});

test('workspace lab records attempts, saves privately, restores backups and reuses its Knowledge solution',async t=>{
 const {api,document,db}=await app(t),ticketId=addReportTicket(api,document);await settle();const id=addLabCase(api,document,{ticketId,projectId:api.state().projects[0].id});await settle();assert.ok(document.querySelector('[data-tab="lab"]').classList.contains('active'));document.querySelector('[data-bench="attempt-new"]').click();let f=document.getElementById('benchAttemptForm');fill(f,{title:'Check valuation grouping',action:'Review the assigned valuation area',result:'Assignment missing in QA',outcome:'Passed'});f.dispatchEvent(new document.defaultView.Event('submit',{bubbles:true,cancelable:true}));await settle();
 document.querySelector('[data-bench="case-edit"]').click();f=document.getElementById('benchCaseForm');fill(f,{status:'Solved',solution:'Maintain and verify the approved assignment',cause:'QA configuration missing'});f.dispatchEvent(new document.defaultView.Event('submit',{bubbles:true,cancelable:true}));await settle();document.querySelector('[data-bench="case-knowledge"]').click();await settle();const noteId=api.state().workhub.lab[0].knowledgeId;assert.ok(noteId);assert.equal(api.state().workhub.notes.length,1);assert.match(api.state().workhub.notes[0].testing,/Assignment missing/);document.querySelector('[data-bench="case-knowledge"]').click();await settle();assert.equal(api.state().workhub.notes.length,1);assert.equal(api.state().workhub.notes[0].ticketId,ticketId);assert.equal(api.state().workhub.notes[0].projectId,api.state().projects[0].id);assert.equal(api.parseBackup(JSON.stringify(db.row.document)).workhub.lab[0].attempts[0].outcome,'Passed');
 const second=await app(t,{remote:copy(db.row),login:false});await second.api.loadCloud(sessionUser);second.api.showTab('lab');assert.equal(second.api.state().workhub.lab[0].id,id);assert.equal(second.api.state().workhub.lab[0].knowledgeId,noteId);assert.match(second.document.getElementById('view').textContent,/Maintain and verify/);
});

test('workspace lab requires a verified solution, supports archive/search and clears account-specific view state',async t=>{
 const {api,document,window}=await app(t);const id=addLabCase(api,document);await settle();api.hub.workbench.caseForm(id);let f=document.getElementById('benchCaseForm');fill(f,{status:'Solved'});assert.throws(()=>api.hub.workbench.saveCase(f),/verified solution/);assert.equal(api.state().workhub.lab[0].status,'Investigating');api.closeModal();api.showTab('lab');document.querySelector('[data-bench="case-archive"]').click();await settle();assert.equal(api.state().workhub.lab[0].archived,true);assert.equal(document.querySelector('.bench-case-detail'),null);const view=document.getElementById('benchLabView');view.value='archived';view.dispatchEvent(new window.Event('change',{bubbles:true}));document.querySelector('[data-bench="case-archive"]').click();await settle();assert.equal(api.state().workhub.lab[0].archived,false);let search=document.getElementById('benchLabSearch');search.value='private search';search.dispatchEvent(new window.Event('input',{bubbles:true}));api.cloud.user={id:'22222222-2222-4222-8222-222222222222',email:'second@example.com'};api.showTab('lab');assert.equal(document.getElementById('benchLabSearch').value,'');assert.equal(document.getElementById('benchLabView').value,'active');
});

test('workspace lab validates imported cases and merges independent investigation edits across devices',async t=>{
 const {api,document,window}=await app(t);const id=addLabCase(api,document);await settle();const base=copy(api.payload(api.state()));const invalid=JSON.parse(base);invalid.data.workhub.lab.push(copy(invalid.data.workhub.lab[0]));assert.throws(()=>api.parseBackup(JSON.stringify(invalid)),/troubleshooting case/);invalid.data.workhub.lab.pop();invalid.data.workhub.lab[0].status='Solved';assert.throws(()=>api.parseBackup(JSON.stringify(invalid)),/troubleshooting case/);
 const local=JSON.parse(base),remote=JSON.parse(base);local.data.workhub.lab[0].cause='Checked the valuation area';remote.data.workhub.lab[0].notes='Confirmed with functional owner';const result=window.MMTrackerMerge.merge(JSON.parse(base),local,remote);assert.equal(result.conflicts.length,0);assert.equal(result.data.workhub.lab[0].id,id);assert.equal(result.data.workhub.lab[0].cause,'Checked the valuation area');assert.equal(result.data.workhub.lab[0].notes,'Confirmed with functional owner');api.parseBackup(JSON.stringify({...local,data:result.data}));
});

test('workspace soundscape starts explicitly, mixes locally, stays playing when hidden and stops on logout',async t=>{
 const {api,document,window,db}=await app(t),audio=mockAmbientAudio(window);assert.equal(audio.length,0);document.getElementById('soundscapeSettings').click();assert.equal(audio.length,0);document.querySelector('[data-sound="preset"][data-preset="forest"]').click();assert.equal(api.hub.soundscape.snapshot().mix.forest,65);document.querySelector('[data-sound="play"]').click();await settle();assert.equal(audio.length,1);assert.equal(api.hub.soundscape.snapshot().playing,true);const slider=document.querySelector('[data-sound-level="rain"]');slider.value='28';slider.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(api.hub.soundscape.snapshot().mix.rain,28);document.querySelector('[data-sound="mute"]').click();assert.equal(api.hub.soundscape.snapshot().muted,true);assert.equal(audio[0].nodes[0].gain.value,0);api.closeModal();api.showTab('tickets');Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'));api.hub.soundscape.tick();assert.equal(api.hub.soundscape.snapshot().playing,true);assert.ok(document.getElementById('soundscapeDock'));
 const second=await app(t,{storage:{'mm-tracker.soundscape.v1':window.localStorage.getItem('mm-tracker.soundscape.v1')}});assert.equal(second.api.hub.soundscape.snapshot().mix.rain,28);assert.equal(second.api.hub.soundscape.snapshot().playing,false);assert.equal(api.payload(api.state()).includes('soundscape'),false);api.cloud.ready=false;api.hub.soundscape.mount();assert.equal(audio[0].state,'closed');assert.equal(document.getElementById('soundscapeDock'),null);assert.equal(db.calls.length,0);
});

test('workspace soundscape can retry unsupported audio and safely cancel a pending audio start',async t=>{
 const {api,window,db}=await app(t);await api.hub.soundscape.start();assert.match(api.hub.soundscape.snapshot().error,/unavailable/);mockAmbientAudio(window);await api.hub.soundscape.start();assert.equal(api.hub.soundscape.snapshot().playing,true);api.hub.soundscape.stop();const audio=mockAmbientAudio(window,{pending:true}),start=api.hub.soundscape.start();api.hub.soundscape.stop();audio[0].finishResume();await start;assert.equal(api.hub.soundscape.snapshot().playing,false);assert.equal(api.hub.soundscape.snapshot().error,'');assert.equal(db.calls.length,0);
});

test('workspace Momo theatre runs three short shows from the menu without writes and fits a phone',async t=>{
 const {api,document,window,db}=await app(t);let now=window.Date.now();window.Date.now=()=>now;Object.defineProperty(window,'innerWidth',{configurable:true,value:375});Object.defineProperty(window,'innerHeight',{configurable:true,value:667});api.hub.life.menu();document.querySelector('[data-momo="theatre"]').click();assert.ok(document.getElementById('momoTheatre'));api.hub.moments.finish();
 for(let i=0;i<3;i++){assert.equal(api.hub.moments.playTheatre(i),true);const stage=document.getElementById('momoTheatre'),first=document.getElementById('momoTheatreCaption').textContent;assert.ok(parseFloat(stage.style.left)>=12);assert.ok(parseFloat(stage.style.left)+parseFloat(stage.style.width)<=363);now+=4500;api.hub.moments.tick();assert.notEqual(document.getElementById('momoTheatreCaption').textContent,first);now+=8000;api.hub.moments.tick();assert.equal(document.getElementById('momoTheatre'),null);}assert.equal(db.calls.length,0);
});

test('workspace Momo respects quiet, focus, reduced motion and local moment switches',async t=>{
 const {api,document,window,db}=await app(t);window.localStorage.setItem('mm-tracker.momo-chatter.v1','quiet');assert.equal(api.hub.moments.deliver(),false);api.hub.moments.settings();const f=document.getElementById('momentsSettingsForm');fill(f,{theatre:false,discoveries:false,visitors:false});f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));assert.equal(JSON.parse(window.localStorage.getItem('mm-tracker.momo-moments.v1')).theatre,false);await settle();window.matchMedia=()=>({matches:true});assert.equal(api.hub.moments.playTheatre(0),true);assert.ok(document.querySelector('.moments-static'));assert.equal(document.getElementById('momoTheatre'),null);api.closeModal();window.matchMedia=()=>({matches:false});document.body.classList.add('hub-focus');assert.equal(api.hub.moments.playTheatre(0),false);document.body.classList.remove('hub-focus');assert.equal(api.hub.moments.visitor('bird'),null);assert.equal(db.calls.length,0);
});

test('workspace Momo discoveries use real record links, open the reference and respect snoozed tasks',async t=>{
 const {api,document,window,db}=await app(t),id=addMainTask(api,document,'Review procurement design');await settle();api.mutate(d=>{d.tasks[0].taskType='Project';d.tasks[0].linkId=d.projects[0].id;d.workhub.notes.push({id:'note-discovery',title:'Verified procurement reference',body:'Our checked notes',tags:'',tcodes:'ME21N',configuration:'',errors:'',testing:'',projectId:d.projects[0].id,ticketId:'',itemId:'',updatedAt:new Date().toISOString()});});await settle();const calls=db.calls.length,discovery=api.hub.moments.discoveries()[0];assert.equal(discovery.links[0].id,id);assert.equal(discovery.links[1].id,'note-discovery');assert.equal(api.hub.moments.deliver(),true);document.getElementById('momoDiscovery').click();assert.match(document.getElementById('modalBody').textContent,/Verified procurement reference/);document.querySelector('[data-moment="open-record"][data-kind="notes"]').click();await settle();assert.match(document.getElementById('modalBody').textContent,/Our checked notes/);assert.equal(db.calls.length,calls);
 api.closeModal();api.hub.reminders.editor('tasks',id);const form=document.getElementById('reminderForm');assert.ok(form);form.elements.namedItem('days').value='7';form.elements.namedItem('days').dispatchEvent(new window.Event('input',{bubbles:true}));form.elements.namedItem('hideUntilDue').checked=true;form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(api.hub.moments.discoveries().some(x=>x.links.some(l=>l.kind==='tasks'&&l.id===id)),false);
});

test('workspace visitors meet Momo, change expressions and release the scene when they leave',async t=>{
 const {api,document,window,db}=await app(t);window.Math.random=()=>0;let now=window.Date.now();window.Date.now=()=>now;api.hub.life.scene(null);const pet=document.getElementById('hubPet');pet.style.left='150px';pet.style.top='200px';
 for(const kind of ['butterfly','bird','firefly']){now+=5000;const point=api.hub.moments.visitor(kind);assert.ok(point);assert.equal(api.hub.life.busy(),true);assert.equal(pet.dataset.pose,'visitor-watch');if(kind==='firefly')assert.ok(document.getElementById('momoVisitorProp'));now+=5000;api.hub.moments.tick();assert.equal(pet.dataset.expression,kind==='butterfly'?'surprised':'delighted');api.hub.moments.visitorEnd();assert.equal(api.hub.moments.snapshot().active,null);assert.equal(document.getElementById('momoVisitorProp'),null);}
 now+=5000;await atmosphereChoices({api,document,window},{mode:'morning',visitors:true});document.activeElement?.blur();await settle();assert.equal(api.hub.atmosphere.invite(),true);assert.equal(api.hub.moments.snapshot().active.kind,'visitor');document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(api.hub.moments.snapshot().active,null);assert.equal(document.querySelectorAll('.hub-visitor').length,0);assert.equal(db.calls.length,0);
});

function addExperiment(ctx,caseId,title='Check the assignment',values={}){
 const {api,document}=ctx;api.hub.workbench.attemptForm(caseId);const f=document.getElementById('benchAttemptForm');fill(f,{title,action:'Compare the maintained values',expected:'The values match the approved design',...values});api.hub.workbench.saveAttempt(f);return api.state().workhub.lab.find(c=>c.id===caseId).attempts.at(-1).id;
}
function labCard(document,id){return[...document.querySelectorAll('[data-experiment]')].find(el=>el.dataset.experiment===id);}

test('magnetic lab upgrades historical investigations without inventing connections or losing observations',async t=>{
 const ctx=await app(t),{api,document}=ctx,id=addLabCase(api,document);await settle();addExperiment(ctx,id,'An old experiment',{outcome:'Passed',result:'The retest passed'});await settle();const backup=JSON.parse(api.payload(api.state())),c=backup.data.workhub.lab[0],attempt=c.attempts[0];for(const k of ['process','expected','actual','verification','resolvedAt','position'])delete c[k];for(const k of ['expected','parentId','position'])delete attempt[k];const restored=api.parseBackup(JSON.stringify(backup));assert.equal(restored.workhub.lab[0].attempts[0].result,'The retest passed');assert.equal(restored.workhub.lab[0].attempts[0].parentId,'');assert.equal(restored.workhub.lab[0].expected,'');assert.equal(restored.workhub.lab[0].attempts[0].createdAt,attempt.createdAt);assert.ok(Number.isFinite(restored.workhub.lab[0].position.x));assert.equal(api.hub.workbench.workshop.snapshot().mode,'board');
});

test('magnetic lab maintains process, expected and actual results with a usable notebook and circuit',async t=>{
 const {api,document,db}=await app(t),id=addLabCase(api,document,{process:'Purchase order → goods receipt',expected:'A material document is posted',actual:'Posting stopped with a message'});await settle();assert.ok(document.getElementById('labBoardWorld'));assert.match(document.getElementById('labInspector').textContent,/A material document is posted/);assert.match(document.getElementById('labInspector').textContent,/Posting stopped/);assert.equal(db.row.document.data.workhub.lab[0].process,'Purchase order → goods receipt');const calls=db.calls.length;document.querySelector('[data-workshop="view"][data-value="list"]').click();assert.ok(document.querySelector('.lab-notes-view'));assert.equal(document.getElementById('labBoardWorld'),null);document.querySelector('[data-workshop="view"][data-value="board"]').click();assert.ok(document.getElementById('labBoardWorld'));assert.equal(db.calls.length,calls);assert.equal(api.state().workhub.lab[0].id,id);
});

test('magnetic lab records failures on the ruled-out shelf with sparks and a short Momo reaction',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,id=addLabCase(api,document);await settle();const p=addExperiment(ctx,id);await settle();const calls=db.calls.length;document.querySelector('[data-workshop="result"][data-id="'+p+'"]').click();let f=document.getElementById('labResultForm');fill(f,{outcome:'Failed',result:'Still reproduces in QA'});f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();const c=api.state().workhub.lab[0];assert.equal(c.attempts[0].outcome,'Failed');assert.equal(c.attempts[0].parentId,'');assert.ok(document.querySelector('#labBoardWorld [data-experiment="'+p+'"][data-outcome="Failed"]'));assert.ok(document.querySelector('.lab-failed-list [data-experiment="'+p+'"]'));assert.match(document.querySelector('.lab-failed-list').textContent,/Still reproduces in QA/);assert.equal(document.querySelectorAll('.lab-sparks i').length,9);assert.equal(document.getElementById('hubPet').dataset.pose,'lab-cower');assert.equal(document.getElementById('hubPet').dataset.expression,'afraid');assert.equal(db.calls.length,calls+1);
 let now=window.Date.now();window.Date.now=()=>now+2000;api.hub.workbench.tick();assert.equal(document.getElementById('hubPet').dataset.pose,'lab-peek');window.Date.now=()=>now+5000;api.hub.workbench.tick();assert.equal(api.hub.workbench.workshop.snapshot().reaction,null);assert.equal(document.querySelector('.lab-sparks'),null);assert.equal(db.calls.length,calls+1);
});

test('magnetic lab successes snap into free spaces and power a branching investigation without overlap',async t=>{
 const ctx=await app(t),{api,document}=ctx,id=addLabCase(api,document);await settle();const one=addExperiment(ctx,id,'First test');await settle();const two=addExperiment(ctx,id,'Second test');await settle();const ws=api.hub.workbench.workshop;ws.recordResult(id,one,'Passed','Verified first result');await settle();ws.recordResult(id,two,'Passed','Verified second result');await settle();let c=api.state().workhub.lab[0];assert.equal(c.attempts[0].parentId,'@issue');assert.equal(c.attempts[0].position.x,c.position.x+272+48);assert.notDeepEqual(copy(c.attempts[0].position),copy(c.attempts[1].position));assert.equal(document.querySelectorAll('[data-wire-state="powered"]').length,2);assert.equal(ws.connected(id,one),true);ws.connect(id,two,one);await settle();c=api.state().workhub.lab[0];assert.equal(c.attempts[1].parentId,one);assert.equal(ws.connected(id,two),true);assert.equal(document.querySelectorAll('[data-wire-state="powered"]').length,2);assert.throws(()=>ws.connect(id,one,two),/without creating a loop/);
});

test('magnetic lab disconnects downstream wires when a source fails and preserves every experiment',async t=>{
 const ctx=await app(t),{api,document}=ctx,id=addLabCase(api,document);await settle();const one=addExperiment(ctx,id,'First',{outcome:'Passed',result:'First passed'});await settle();const two=addExperiment(ctx,id,'Second',{outcome:'Passed',result:'Second passed'});await settle();const three=addExperiment(ctx,id,'Third',{outcome:'Passed',result:'Third passed'});await settle();const ws=api.hub.workbench.workshop;ws.connect(id,two,one,false);await settle();ws.connect(id,three,two,false);await settle();ws.recordResult(id,one,'Failed','Retest disproved the first assumption');await settle();const c=api.state().workhub.lab[0];assert.equal(c.attempts.length,3);assert.equal(c.attempts[1].parentId,'');assert.equal(c.attempts[2].parentId,two);assert.equal(ws.connected(id,three),false);assert.equal(document.querySelectorAll('[data-wire-state="powered"]').length,0);assert.ok(document.querySelector('[data-wire-state="waiting"]'));api.validate(api.state());
});

test('magnetic lab keeps inconclusive connections dotted and refuses failed sources and invalid imports',async t=>{
 const ctx=await app(t),{api,document}=ctx,id=addLabCase(api,document);await settle();const one=addExperiment(ctx,id,'An uncertain test');await settle();const two=addExperiment(ctx,id,'A second test');await settle();const ws=api.hub.workbench.workshop;ws.recordResult(id,one,'Inconclusive','Result differs between runs');await settle();assert.ok(document.querySelector('[data-wire-state="uncertain"]'));assert.equal(ws.connected(id,one),false);ws.recordResult(id,two,'Passed','Second retest passed');await settle();assert.throws(()=>ws.connect(id,two,one),/successful source/);const invalid=JSON.parse(api.payload(api.state()));invalid.data.workhub.lab[0].attempts[0].parentId=two;invalid.data.workhub.lab[0].attempts[1].parentId=one;assert.throws(()=>api.parseBackup(JSON.stringify(invalid)),/successful source|loop/);invalid.data.workhub.lab[0].attempts[0].position.x=-1;assert.throws(()=>api.parseBackup(JSON.stringify(invalid)),/card positions|connections/);
});

test('magnetic lab drag previews are local, snap once on release and cancel without writes',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,id=addLabCase(api,document);await settle();const p=addExperiment(ctx,id,'A draggable test',{outcome:'Passed',result:'Verified result'});await settle();api.mutate(d=>{const r=d.workhub.lab[0].attempts[0];r.parentId='';r.position={x:700,y:450};});await settle();let h=document.querySelector('[data-lab-drag="'+p+'"]'),calls=db.calls.length;pointer(window,h,'pointerdown',100,100);pointer(window,document,'pointermove',-264,-190);assert.equal(api.hub.workbench.workshop.snapshot().dragging,true);assert.equal(db.calls.length,calls);assert.equal(labCard(document,p).dataset.magnetic,'true');pointer(window,document,'pointerup',-264,-190);await settle();assert.equal(db.calls.length,calls+1);assert.equal(api.state().workhub.lab[0].attempts[0].parentId,'@issue');assert.equal(api.state().workhub.lab[0].attempts[0].position.x,374);assert.equal(document.body.classList.contains('lab-drag-active'),false);
 h=document.querySelector('[data-lab-drag="'+p+'"]');const before=copy(api.state().workhub.lab[0].attempts[0].position);calls=db.calls.length;pointer(window,h,'pointerdown',100,100);pointer(window,document,'pointermove',220,260);pointer(window,document,'pointercancel',220,260);await settle();assert.deepEqual(copy(api.state().workhub.lab[0].attempts[0].position),before);assert.equal(db.calls.length,calls);assert.equal(api.hub.workbench.workshop.snapshot().dragging,false);
});

test('magnetic lab keyboard movement commits once and Escape restores the original card',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,id=addLabCase(api,document);await settle();const p=addExperiment(ctx,id);await settle();let h=document.querySelector('[data-lab-drag="'+p+'"]'),before=copy(api.state().workhub.lab[0].attempts[0].position),calls=db.calls.length;const key=(el,k)=>el.dispatchEvent(new window.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));h.focus();key(h,'Enter');key(h,'ArrowRight');key(h,'ArrowDown');assert.equal(db.calls.length,calls);key(h,'Escape');assert.deepEqual(copy(api.state().workhub.lab[0].attempts[0].position),before);key(h,'Enter');key(h,'ArrowRight');key(h,'Enter');await settle();assert.equal(db.calls.length,calls+1);assert.equal(api.state().workhub.lab[0].attempts[0].position.x,before.x+12);assert.equal(document.activeElement.dataset.labDrag,p);
});

test('magnetic lab phone controls switch views, zoom locally and connect without dragging',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx;Object.defineProperty(window,'innerWidth',{configurable:true,value:375});Object.defineProperty(window,'innerHeight',{configurable:true,value:667});const id=addLabCase(api,document);await settle();const p=addExperiment(ctx,id,'Phone experiment',{outcome:'Passed',result:'Verified'});await settle();assert.ok(document.getElementById('labBoardScroll').scrollLeft>0);assert.match(document.querySelector('#labInspector > h3').textContent,/Phone experiment/);const calls=db.calls.length;document.querySelector('[data-workshop="zoom-out"]').click();assert.equal(api.hub.workbench.workshop.snapshot().zoom,.9);assert.equal(document.getElementById('labZoomValue').textContent,'90%');document.querySelector('[data-workshop="view"][data-value="list"]').click();assert.ok(document.querySelector('.lab-stacked-card'));assert.equal(db.calls.length,calls);document.querySelector('[data-workshop="connect"][data-id="'+p+'"]').click();let f=document.getElementById('labConnectForm');f.elements.namedItem('parentId').value='';f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(api.state().workhub.lab[0].attempts[0].parentId,'');assert.equal(db.calls.length,calls+1);assert.equal(api.hub.workbench.workshop.snapshot().mode,'list');
 const prefs=window.localStorage.getItem('mm-tracker.lab-workshop.v1'),other=await app(t,{storage:{'mm-tracker.lab-workshop.v1':prefs}});assert.equal(other.api.hub.workbench.workshop.snapshot().zoom,.9);assert.equal(other.api.hub.workbench.workshop.snapshot().mode,'list');
});

test('magnetic lab resolution reviews evidence and atomically creates one linked Knowledge note',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,id=addLabCase(api,document,{process:'Invoice verification',expected:'Invoice is accepted',actual:'Invoice is blocked'});await settle();const fail=addExperiment(ctx,id,'Initial idea',{outcome:'Failed',result:'The message remained'});await settle();addExperiment(ctx,id,'Verified approach',{outcome:'Passed',result:'Retest passed'});await settle();const calls=db.calls.length;document.querySelector('[data-workshop="resolve"]').click();let f=document.getElementById('labResolveForm');assert.match(f.textContent,/The message remained|1 failed attempts/);assert.throws(()=>api.hub.workbench.workshop.saveResolution(f),/confirm your review/);assert.equal(db.calls.length,calls);fill(f,{cause:'Incorrect maintained value',solution:'Corrected and retested the approved value',verification:'Original and exception scenarios passed',reviewed:true});f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(db.calls.length,calls+1);let c=api.state().workhub.lab[0],n=api.state().workhub.notes[0];assert.equal(c.status,'Solved');assert.equal(n.labCaseId,id);assert.equal(n.id,c.knowledgeId);assert.match(n.body,/Invoice verification/);assert.match(n.body,/Invoice is blocked/);assert.match(n.body,/Original and exception scenarios passed/);assert.match(n.testing,/The message remained/);assert.ok(c.resolvedAt);assert.equal(c.attempts.find(p=>p.id===fail).outcome,'Failed');assert.equal(db.row.document.data.workhub.notes[0].id,c.knowledgeId);assert.ok(document.querySelector('.lab-verified-banner'));
 document.querySelector('[data-bench="case-knowledge"]').click();await settle();assert.equal(api.state().workhub.notes.length,1);assert.equal(api.state().workhub.notes[0].id,n.id);document.querySelector('[data-bench="open"][data-kind="notes"]').click();await settle();assert.ok(document.querySelector('[data-bench="open"][data-kind="lab"]'));document.querySelector('[data-bench="open"][data-kind="lab"]').click();assert.ok(document.querySelector('.lab-workshop'));
 const other=await app(t,{remote:copy(db.row),login:false});await other.api.loadCloud(sessionUser);other.api.showTab('lab');assert.deepEqual(copy(other.api.state().workhub.lab[0].attempts),copy(c.attempts));assert.equal(other.api.state().workhub.notes[0].labCaseId,id);
});

test('magnetic lab reopens safely and preserves the Knowledge backlink through manual note edits',async t=>{
 const {api,document,window}=await app(t),id=addLabCase(api,document,{status:'Solved',solution:'A verified fix'});await settle();const note=copy(api.state().workhub.notes[0]);assert.ok(note.labCaseId);assert.throws(()=>api.hub.workbench.attemptForm(id),/Reopen/);document.querySelector('[data-workshop="reopen"]').click();await settle();assert.equal(api.state().workhub.lab[0].status,'Investigating');assert.deepEqual(copy(api.state().workhub.notes[0]),note);await api.hub.handle({dataset:{hub:'note-edit',id:note.id}});let f=document.getElementById('hubNote');f.elements.namedItem('tags').value='Reviewed by consultant';f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(api.state().workhub.notes[0].labCaseId,id);assert.equal(api.state().workhub.notes[0].tags,'Reviewed by consultant');
});

test('magnetic lab deletes cases with confirmation, preserves Knowledge and restores them through Undo',async t=>{
 const {api,document,window,db}=await app(t),id=addLabCase(api,document,{status:'Solved',solution:'A verified answer'});await settle();const before=copy(api.state().workhub.lab[0]),note=copy(api.state().workhub.notes[0]),calls=db.calls.length;window.confirm=()=>false;document.querySelector('[data-workshop="delete-case"]').click();await settle();assert.equal(api.state().workhub.lab.length,1);assert.equal(db.calls.length,calls);window.confirm=()=>true;document.querySelector('[data-workshop="delete-case"]').click();await settle();assert.equal(api.state().workhub.lab.length,0);assert.deepEqual(copy(api.state().workhub.notes[0]),note);assert.equal(db.calls.length,calls+1);assert.ok(document.getElementById('labUndo'));api.showTab('knowledge');document.getElementById('labUndo').click();await settle();assert.deepEqual(copy(api.state().workhub.lab[0]),before);assert.equal(api.state().workhub.lab[0].id,id);assert.equal(document.getElementById('labUndo'),null);assert.equal(db.calls.length,calls+2);assert.ok(document.querySelector('.lab-workshop'));assert.equal(api.hub.workbench.workshop.restore(),false);
});

test('magnetic lab deletes experiments and restores their connections and order with Undo',async t=>{
 const ctx=await app(t),{api,document,db}=ctx,id=addLabCase(api,document);await settle();const a=addExperiment(ctx,id,'First',{outcome:'Passed',result:'First verified'});await settle();const b=addExperiment(ctx,id,'Second',{outcome:'Passed',result:'Second verified'});await settle();const ws=api.hub.workbench.workshop;ws.connect(id,b,a,false);await settle();const before=copy(api.state().workhub.lab[0]),calls=db.calls.length;document.querySelector('[data-workshop="inspect"][data-id="'+a+'"]').click();document.querySelector('#labInspector [data-workshop="delete-attempt"]').click();await settle();assert.equal(api.state().workhub.lab[0].attempts.length,1);assert.equal(api.state().workhub.lab[0].attempts[0].parentId,'');assert.equal(db.calls.length,calls+1);document.getElementById('labUndo').click();await settle();assert.deepEqual(copy(api.state().workhub.lab[0]),before);assert.equal(ws.connected(id,b),true);assert.equal(db.calls.length,calls+2);
});

test('magnetic lab deletion reopens solved work and never replaces the published Knowledge snapshot',async t=>{
 const ctx=await app(t),{api,document}=ctx,id=addLabCase(api,document);await settle();const p=addExperiment(ctx,id,'Fix',{outcome:'Passed',result:'Confirmed'});await settle();api.hub.workbench.caseForm(id);let f=document.getElementById('benchCaseForm');fill(f,{status:'Solved',solution:'Verified solution'});api.hub.workbench.saveCase(f);await settle();const note=copy(api.state().workhub.notes[0]);api.hub.workbench.workshop.remove(id,p);await settle();assert.equal(api.state().workhub.lab[0].status,'Investigating');assert.deepEqual(copy(api.state().workhub.notes[0]),note);api.hub.workbench.workshop.restore();await settle();assert.equal(api.state().workhub.lab[0].status,'Solved');assert.deepEqual(copy(api.state().workhub.notes[0]),note);
});

test('magnetic lab Undo is account-scoped and a cancelled deletion preserves the previous Undo',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,id=addLabCase(api,document);await settle();const a=addExperiment(ctx,id,'First');await settle();const b=addExperiment(ctx,id,'Second');await settle();const ws=api.hub.workbench.workshop;ws.remove(id,a);await settle();window.confirm=()=>false;assert.equal(ws.remove(id,b),false);assert.equal(ws.snapshot().canUndo,true);ws.restore();await settle();assert.ok(api.state().workhub.lab[0].attempts.some(p=>p.id===a));window.confirm=()=>true;ws.remove(id,a);await settle();api.cloud.user={id:'22222222-2222-4222-8222-222222222222',email:'other@example.com'};api.showTab('lab');assert.equal(ws.snapshot().canUndo,false);assert.equal(document.getElementById('labUndo'),null);assert.equal(ws.restore(),false);
});

test('magnetic lab retries keep failed evidence and motion/privacy settings suppress visual reactions',async t=>{
 const ctx=await app(t,{styles:true}),{api,document,window,db}=ctx,id=addLabCase(api,document);await settle();const p=addExperiment(ctx,id,'A failed approach',{outcome:'Failed',result:'Observed the same error'});await settle();document.querySelector('.lab-failed-list [data-workshop="retry"]').click();const f=document.getElementById('benchAttemptForm');assert.match(f.elements.namedItem('title').value,/Another approach/);assert.equal(f.elements.namedItem('result').value,'');api.hub.workbench.saveAttempt(f);await settle();assert.equal(api.state().workhub.lab[0].attempts.length,2);assert.equal(api.state().workhub.lab[0].attempts[0].result,'Observed the same error');const next=api.state().workhub.lab[0].attempts[1].id;window.matchMedia=()=>({matches:true});api.hub.workbench.workshop.recordResult(id,next,'Failed','Second idea did not resolve it');await settle();assert.equal(document.querySelectorAll('.lab-sparks').length,0);assert.equal(document.getElementById('hubPet').dataset.pose,'idle');const calls=db.calls.length;document.querySelector('[data-hub="privacy"]').click();await settle();assert.equal(api.hub.workbench.workshop.snapshot().reaction,null);api.hub.workbench.workshop.feedback(id,'failed',p);assert.equal(api.hub.workbench.workshop.snapshot().reaction,null);assert.equal(db.calls.length,calls);
});

test('magnetic lab cancels a drag if another render replaces its records and preserves cloud data',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,id=addLabCase(api,document);await settle();const p=addExperiment(ctx,id);await settle();const h=document.querySelector('[data-lab-drag="'+p+'"]'),before=copy(api.state().workhub.lab[0].attempts[0].position),calls=db.calls.length;pointer(window,h,'pointerdown',100,100);pointer(window,document,'pointermove',230,230);api.showTab('tickets');pointer(window,document,'pointerup',230,230);await settle();assert.equal(api.hub.workbench.workshop.snapshot().dragging,false);assert.deepEqual(copy(api.state().workhub.lab[0].attempts[0].position),before);assert.equal(db.calls.length,calls);
});

test('magnetic lab Undo keeps later edits and avoids restoring a connection that would create a loop',async t=>{
 const ctx=await app(t),{api,document}=ctx,id=addLabCase(api,document);await settle();const a=addExperiment(ctx,id,'First',{outcome:'Passed',result:'First verified'});await settle();const b=addExperiment(ctx,id,'Second',{outcome:'Passed',result:'Second verified'});await settle();const c=addExperiment(ctx,id,'Third',{outcome:'Passed',result:'Third verified'});await settle();const ws=api.hub.workbench.workshop;ws.connect(id,a,b,false);await settle();ws.connect(id,c,a,false);await settle();ws.remove(id,a);await settle();ws.connect(id,b,c,false);await settle();ws.restore();await settle();const record=api.state().workhub.lab[0];assert.equal(record.attempts.find(p=>p.id===a).parentId,b);assert.equal(record.attempts.find(p=>p.id===b).parentId,c);assert.equal(record.attempts.find(p=>p.id===c).parentId,'');api.validate(api.state());
});

async function addProjectDeliverable(ctx,itemRef='MM-42'){const {api,document}=ctx;api.editRecord('specs');let f=document.getElementById('editForm');fill(f,{description:'Prepare purchasing design',itemId:itemRef});api.saveEdit(f);await settle();const item=api.state().specs.at(-1);api.editSubItem(item.id);f=document.getElementById('subItemForm');fill(f,{title:'Review release strategy',remarks:'Check the approver matrix'});api.saveSubItem(f);await settle();return{itemId:item.id,subItemId:api.state().specs.at(-1).subItems[0].id,projectId:item.projectId};}

test('card drops keep the same canvas and card nodes, including a newly powered connection',async t=>{
 const ctx=await app(t,{styles:true}),{api,document,window,db}=ctx,id=addLabCase(api,document);await settle();const p=addExperiment(ctx,id,'Stable canvas',{outcome:'Passed',result:'Confirmed'});await settle();api.mutate(d=>{Object.assign(d.workhub.lab[0].attempts[0],{parentId:'',position:{x:700,y:450}});});await settle();const world=document.getElementById('labBoardWorld'),card=labCard(document,p),sc=document.getElementById('labBoardScroll'),before=db.calls.length;pointer(window,card.querySelector('[data-lab-drag]'),'pointerdown',100,100);pointer(window,document,'pointermove',-264,-190);pointer(window,document,'pointerup',-264,-190);await settle();assert.equal(document.getElementById('labBoardWorld'),world);assert.equal(document.getElementById('labBoardScroll'),sc);assert.equal(labCard(document,p),card);assert.match(card.querySelector('[data-workshop="connect"]').textContent,/Connected/);assert.match(document.querySelector('.lab-workspace-count').textContent,/1 powered/);assert.equal(window.getComputedStyle(document.querySelector('.lab-workshop')).animation,'none');assert.equal(db.calls.length,before+1);
});

test('failed magnets repel and all released cards settle without overlapping their neighbours',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,id=addLabCase(api,document);await settle();const one=addExperiment(ctx,id,'Failed magnet',{outcome:'Failed',result:'Observed failure'});await settle();const two=addExperiment(ctx,id,'Other magnet');await settle();api.mutate(d=>{d.workhub.lab[0].attempts[0].position={x:700,y:450};d.workhub.lab[0].attempts[1].position={x:410,y:100};});await settle();const h=labCard(document,one).querySelector('[data-lab-drag]');pointer(window,h,'pointerdown',100,100);pointer(window,document,'pointermove',-110,-170);assert.equal(labCard(document,one).dataset.repelling,'true');assert.equal(labCard(document,one).dataset.magnetic,'false');pointer(window,document,'pointerup',-110,-170);await settle();const [a,b]=api.state().workhub.lab[0].attempts;assert.equal(a.parentId,'');assert.ok(a.position.x+264<=b.position.x||b.position.x+264<=a.position.x||a.position.y+264<=b.position.y||b.position.y+264<=a.position.y);
});

test('failure effects sit above the viewport instead of inside clipped cards and clean up',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,id=addLabCase(api,document);await settle();const p=addExperiment(ctx,id);await settle();const ws=api.hub.workbench.workshop;ws.recordResult(id,p,'Failed','Negative test');await settle();const fx=document.querySelector('.lab-screen-effects');assert.equal(fx.parentElement,document.body);assert.equal(fx.querySelectorAll('i').length,9);assert.equal(fx.querySelectorAll('.lab-smoke').length,3);assert.ok(Number.parseFloat(fx.style.top)>0);let now=window.Date.now();window.Date.now=()=>now+5000;ws.tick();assert.equal(document.querySelector('.lab-screen-effects'),null);
});

test('named colour combinations and patterns persist privately and survive theme import and backup',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx;api.showTab('studio');let f=document.getElementById('hubTheme');document.querySelector('[data-theme-choice="custom"]').click();fill(f,{accent:'#9671cd','color-page':'#eee4fb','color-surface':'#fffaf4','color-text':'#392345','color-secondary':'#a4c6a1',background:'honeycomb'});f.elements.namedItem('color-page').dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(db.calls.length,0);assert.equal(document.body.style.getPropertyValue('--hub-bg'),'#eee4fb');document.getElementById('workspacePaletteName').value='My soft desk';document.querySelector('[data-hub="palette-save"]').click();await settle();const p=api.state().workhub.preferences;assert.equal(p.palettes.length,1);assert.equal(p.palettes[0].name,'My soft desk');assert.equal(p.background,'honeycomb');assert.equal(Object.keys(p).some(k=>k.startsWith('color-')),false);assert.equal(db.row.document.data.workhub.preferences.colors.surface,'#fffaf4');document.querySelector('[data-theme-choice="forest"]').click();f=document.getElementById('hubTheme');api.hub.submit(f);await settle();assert.equal(document.body.style.getPropertyValue('--hub-bg'),'');document.getElementById('workspacePalette').value=p.palettes[0].id;document.querySelector('[data-hub="palette-load"]').click();await settle();assert.equal(api.state().workhub.preferences.theme,'custom');assert.equal(document.body.style.getPropertyValue('--hub-bg'),'#eee4fb');assert.equal(api.parseBackup(api.payload(api.state())).workhub.preferences.palettes[0].colors.text,'#392345');const saved=copy(api.state().workhub.preferences);await api.hub.importTheme({size:2000,text:async()=>JSON.stringify({app:'mm-tracker-theme',version:1,preferences:saved})});await settle();assert.deepEqual(copy(api.state().workhub.preferences.palettes),saved.palettes);const reloaded=await app(t,{remote:copy(db.row),login:false});await reloaded.api.loadCloud(sessionUser);await settle();assert.equal(reloaded.document.body.style.getPropertyValue('--hub-bg'),'#eee4fb');
});

test('project and sub-item status changes capture dates, manual history and editable corrections',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,{itemId,subItemId}=await addProjectDeliverable(ctx),get=()=>api.state().specs.find(p=>p.id===itemId);assert.match(get().statusDate,/^\d{4}-\d{2}-\d{2}$/);assert.equal(get().statusHistory.length,1);assert.equal(get().subItems[0].statusHistory.length,1);api.closeModal();api.hub.workbench.changeStatus('specs',itemId,'','Completed','2026-10-11');await settle();assert.equal(get().statusDate,'2026-10-11');assert.equal(get().statusHistory.at(-1).status,'Completed');assert.equal(get().statusHistory.length,2);api.hub.workbench.changeStatus('specSub',subItemId,itemId,'Completed','2026-10-12');await settle();assert.equal(get().subItems[0].statusDate,'2026-10-12');api.editRecord('specs',itemId);await settle();let f=document.getElementById('editForm');assert.equal(f.elements.namedItem('statusDate').value,'2026-10-11');f.elements.namedItem('description').value='Updated description';api.saveEdit(f);await settle();assert.equal(get().statusHistory.length,2);api.showProjectItems();document.querySelector('[data-project-status-date="'+itemId+'"]').click();f=document.getElementById('projectStatusDateForm');f.elements.namedItem('statusDate').value='2026-10-10';f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(get().statusHistory.length,2);assert.equal(get().statusHistory.at(-1).date,'2026-10-10');api.editSubItem(itemId,subItemId);await settle();f=document.getElementById('subItemForm');fill(f,{status:'Blocked',statusDate:'2026-10-09'});f.elements.namedItem('statusDate').dispatchEvent(new window.Event('change',{bubbles:true}));api.saveSubItem(f);await settle();assert.equal(get().subItems[0].statusDate,'2026-10-09');assert.equal(get().subItems[0].statusHistory.length,3);assert.equal(db.row.document.data.specs[0].subItems[0].statusDate,'2026-10-09');assert.equal(api.parseBackup(api.payload(api.state())).specs[0].statusHistory.length,2);
});

test('legacy items keep unknown dates blank, every new transition captures today and restores add no history',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,{itemId}=await addProjectDeliverable(ctx),legacy=copy(api.state());for(const r of [legacy.specs[0],...legacy.specs[0].subItems]){delete r.statusDate;delete r.statusHistory;}const imported=api.parseBackup(JSON.stringify({app:'mm-ticket-tracker',version:9,data:legacy}));assert.equal(imported.specs[0].statusDate,'');assert.equal(imported.specs[0].statusHistory.length,0);const before=copy(api.state());window.WorkHubProjectDates.prepare(imported,before,'2026-10-17',true);assert.equal(imported.specs[0].statusHistory.length,0);api.hub.workbench.changeStatus('specs',itemId,'','Completed','2026-10-01');await settle();api.editRecord('specs',itemId);await settle();const f=document.getElementById('editForm');f.elements.namedItem('status').value='Not yet Started';f.elements.namedItem('status').dispatchEvent(new window.Event('change',{bubbles:true}));assert.notEqual(f.elements.namedItem('statusDate').value,'2026-10-01');api.saveEdit(f);await settle();assert.notEqual(api.state().specs[0].statusDate,'2026-10-01');assert.equal(api.state().specs[0].statusHistory.length,3);const bad=copy(api.state());bad.specs[0].statusDate='2026-02-30';assert.throws(()=>api.validate(bad),/status dates/);
});

test('sub-item Track time preserves context through recovery, pause and saving to Schedule and Projects',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,{itemId,subItemId,projectId}=await addProjectDeliverable(ctx);api.openSubItems(itemId);await settle();const track=document.querySelector('[data-hub="timer-new"][data-subitem="'+subItemId+'"]');assert.ok(track);track.click();await settle();let f=document.getElementById('hubTimerStart');assert.equal(f.elements.namedItem('linkId').value,projectId);assert.equal(f.elements.namedItem('itemId').value,itemId);assert.equal(f.elements.namedItem('subItemId').value,subItemId);api.hub.submit(f);let clock=window.Date.now();window.Date.now=()=>clock+90000;const timer=api.hub.timer();assert.equal(timer.title,'Review release strategy');assert.equal(timer.itemId,itemId);assert.match(document.getElementById('hubTimerBar').textContent,/Prepare purchasing design/);const storage=Object.fromEntries(Object.keys(window.localStorage).map(k=>[k,window.localStorage.getItem(k)])),recovered=await app(t,{storage,remote:copy(db.row),login:false});await recovered.api.loadCloud(sessionUser);await settle();assert.equal(recovered.api.hub.timer().subItemId,subItemId);timer.started='2026-10-16T01:00:00.000Z';timer.runningSince=null;timer.segments=[{start:'2026-10-16T01:00:00.000Z',end:'2026-10-16T01:02:00.000Z'}];window.localStorage.setItem('mm-tracker.timer.v1:'+api.cloud.user.id,JSON.stringify(timer));api.hub.finishTimer();await settle();assert.equal(api.hub.timer(),null);const session=api.state().workhub.sessions[0];assert.equal(session.seconds,120);assert.equal(session.itemId,itemId);assert.equal(session.subItemId,subItemId);assert.equal(session.scheduled,true);assert.equal(api.state().projectPlans[0].subItemId,subItemId);assert.equal(api.state().projectPlans[0].title,'Review release strategy');assert.equal(api.state().schedule[0].subItemId,subItemId);assert.match(api.state().schedule[0].text,/Project item: Prepare purchasing design/);api.openSubItems(itemId);assert.match(document.querySelector('.subitem-time-summary').textContent,/0h 2m/);assert.equal(db.row.document.data.workhub.sessions[0].subItemId,subItemId);
});

test('project timer selectors reset dependent sub-items and reject mismatched links',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,{itemId,subItemId,projectId}=await addProjectDeliverable(ctx);api.closeModal();await hubAction(api,'timer-new',{kind:'project',id:projectId,item:itemId,subitem:subItemId});const f=document.getElementById('hubTimerStart');f.elements.namedItem('itemId').value='';f.elements.namedItem('itemId').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(f.elements.namedItem('subItemId').value,'');assert.throws(()=>api.hub.startTimer({kind:'project',linkId:projectId,itemId:'wrong',subItemId}),/belonging to this project/);assert.equal(api.hub.timer(),null);assert.throws(()=>api.hub.startTimer({kind:'project',linkId:projectId,itemId,subItemId:'wrong'}),/belonging to this project/);
});

test('Momo performs local articulated gestures randomly and stops them while editing or motion is disabled',async t=>{
 const {api,document,window,db}=await app(t,{storage:{'mm-tracker.momo-chatter.v1':'quiet'}}),life=api.hub.life,pet=document.getElementById('hubPet');assert.ok(pet.querySelector('.momo-face .momo-mouth-yawn'));assert.equal(life.gesture('sit'),true);assert.equal(pet.dataset.pose,'idle-sit');assert.equal(pet.dataset.chairPhase,'unfold');assert.ok(pet.querySelector('.momo-folding-chair'));assert.equal(life.busy(),true);let now=window.Date.now();window.Date.now=()=>now+16000;life.tick();assert.equal(life.gestureState(),null);assert.equal(pet.hasAttribute('data-chair-phase'),false);assert.equal(life.gesture('yawn'),true);api.showTab('knowledge');document.getElementById('hubSearch').focus();life.tick();assert.equal(life.gestureState(),null);document.getElementById('hubSearch').blur();window.Date.now=()=>now+120000;life.tick();assert.ok(life.gestureState());window.matchMedia=()=>({matches:true});life.tick();assert.equal(life.gestureState(),null);assert.equal(life.gesture('wave'),false);assert.equal(db.calls.length,0);
});

test('the scenery has separate cloud layers, moving celestial orbits and a compact phone window without uploads',async t=>{
 const {api,document,window,db}=await app(t,{styles:true});Object.defineProperty(window,'innerWidth',{value:375,configurable:true});api.hub.atmosphere.sync();const pocket=document.getElementById('hubAtmospherePocket');assert.ok(pocket);assert.ok(pocket.querySelector('.ambient-cloud-front'));assert.ok(pocket.querySelector('.ambient-cloud-back'));assert.ok(pocket.querySelector('.ambient-solar-orbit'));assert.ok(pocket.querySelector('.ambient-lunar-orbit'));assert.match(document.body.style.getPropertyValue('--ambient-sun-x'),/px$/);assert.ok(pocket.getAttribute('aria-label'));assert.equal(db.calls.length,0);document.querySelector('[data-hub="presentation"]').click();await settle();api.hub.atmosphere.sync();assert.equal(pocket.hidden,true);assert.equal(db.calls.length,0);
});

async function leaveEditor(ctx,kind='annual-leave',{date='2026-10-20',time='09:00',createNew=true}={}){const {api,document,window}=ctx;api.openRangeEditor(date,time,'',createNew);let f=document.getElementById('scheduleForm');f.elements.namedItem('kind').value=kind;f.elements.namedItem('kind').dispatchEvent(new window.Event('change',{bubbles:true}));await settle();return document.getElementById('scheduleForm');}

test('sun and moon are mutually exclusive and their movement respects scenery motion settings',async t=>{
 const ctx=await app(t,{styles:true}),{api,document,window,db}=ctx;await atmosphereChoices(ctx,{mode:'night',visitors:false});let scene=document.getElementById('hubAtmospherePocket');assert.equal(window.getComputedStyle(scene.querySelector('.ambient-solar-orbit')).display,'none');assert.equal(window.getComputedStyle(scene.querySelector('.ambient-lunar-orbit')).display,'block');assert.match(window.getComputedStyle(scene.querySelector('.ambient-moon')).animation,/ambient-moon-bob/);await atmosphereChoices(ctx,{mode:'morning'});scene=document.getElementById('hubAtmospherePocket');assert.notEqual(window.getComputedStyle(scene.querySelector('.ambient-solar-orbit')).display,'none');assert.equal(window.getComputedStyle(scene.querySelector('.ambient-lunar-orbit')).display,'none');assert.match(window.getComputedStyle(scene.querySelector('.ambient-sun')).animation,/ambient-orb-bob/);assert.equal(window.getComputedStyle(scene.querySelector('.ambient-sun-rays')).animationDuration,'26s');assert.equal(db.calls.length,0);
});

test('Annual Leave saves a precise multi-day booking, handover, approval and readable report without project time',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx;let f=await leaveEditor(ctx);fill(f,{endDate:'2026-10-21',leaveStatus:'Approved',leaveContact:'Cover colleague',leaveReference:'AL-42',text:'Handover notes'});f.elements.namedItem('leavePortion').value='morning';f.elements.namedItem('leavePortion').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(f.elements.namedItem('time').value,'09:00');assert.equal(f.elements.namedItem('endTime').value,'13:00');f.querySelector('[data-action="booking-duration"][data-minutes="45"]').click();await settle();assert.equal(f.elements.namedItem('leavePortion').value,'custom');assert.equal(f.elements.namedItem('endTime').value,'09:45');f.elements.namedItem('leavePortion').value='morning';f.elements.namedItem('leavePortion').dispatchEvent(new window.Event('change',{bubbles:true}));api.saveRange(f);await settle();assert.equal(api.state().schedule.length,8);assert.equal(api.state().projectPlans.length,0);assert.ok(api.state().schedule.every(s=>s.kind==='annual-leave'&&s.leave.status==='Approved'&&!s.planId&&!s.linkId));const slot=api.state().schedule[0];assert.equal(slot.leave.contact,'Cover colleague');assert.equal(api.hub.workbench.scheduleKind(slot),'annual-leave');api.viewBooking('2026-10-20','09:00');assert.match(document.getElementById('modalBody').textContent,/Annual Leave/);assert.match(document.getElementById('modalBody').textContent,/Cover colleague/);assert.equal(document.getElementById('scheduleForm'),null);api.openRangeEditor('2026-10-20','09:00');f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('leaveReference').value,'AL-42');assert.equal(f.elements.namedItem('leavePortion').value,'morning');assert.deepEqual(copy(api.parseBackup(api.payload(api.state())).schedule),copy(api.state().schedule));const report=window.WorkHubReports.build(api.state(),{asOf:'2026-10-21',from:'2026-10-20',to:'2026-10-21'}),rows=report.sheets.find(s=>s.name==='Schedule').rows;assert.equal(rows.length,2);assert.equal(rows[0].values[5],'Annual Leave');assert.equal(rows[0].values[7],'Approved');assert.match(rows[0].values[4],/Handover notes/);assert.equal(db.row.document.data.schedule[0].leave.reference,'AL-42');const second=await app(t,{remote:copy(db.row),login:false});await second.api.loadCloud(sessionUser);await settle();assert.equal(second.api.state().schedule[0].kind,'annual-leave');
});

test('Medical Leave requires the MC submission date and preserves submitted/not-yet states through edits',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx;let f=await leaveEditor(ctx,'medical-leave');assert.equal(document.getElementById('mcDateField').hidden,true);f.elements.namedItem('mcSubmitted').value='yes';f.elements.namedItem('mcSubmitted').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(document.getElementById('mcDateField').hidden,false);assert.equal(f.elements.namedItem('mcSubmittedDate').required,true);f.elements.namedItem('mcSubmittedDate').value='';assert.throws(()=>api.saveRange(f),/date you submitted/);assert.equal(api.state().schedule.length,0);fill(f,{mcSubmittedDate:'2026-10-17',leaveStatus:'Approved',text:'Rest day'});api.saveRange(f);await settle();assert.ok(api.state().schedule.every(s=>s.leave.mcSubmitted&&s.leave.mcSubmittedDate==='2026-10-17'));api.viewBooking('2026-10-20','09:00');assert.match(document.getElementById('modalBody').textContent,/Submitted · 2026-10-17/);api.openRangeEditor('2026-10-20','09:00');f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('mcSubmitted').value,'yes');f.elements.namedItem('mcSubmitted').value='no';f.elements.namedItem('mcSubmitted').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(f.elements.namedItem('mcSubmittedDate').value,'');api.saveRange(f);await settle();assert.equal(db.row.document.data.schedule[0].leave.mcSubmitted,false);assert.equal(db.row.document.data.schedule[0].leave.mcSubmittedDate,'');api.viewBooking('2026-10-20','09:00');assert.match(document.getElementById('modalBody').textContent,/Not yet submitted/);const invalid=copy(api.state());invalid.schedule[0].leave.mcSubmitted=true;assert.throws(()=>api.validate(invalid),/leave details/);
});

test('leave custom minutes and overlap protection preserve existing work and require no migration of old bookings',async t=>{
 const ctx=await app(t),{api,document,window}=ctx;addBooking(api,document,'11:00','12:00',{date:'2026-10-20'});await settle();const existing=copy(api.state().schedule);let f=await leaveEditor(ctx);fill(f,{time:'10:15',endTime:'12:30',leavePortion:'custom'});assert.throws(()=>api.saveRange(f),/overlaps/);assert.deepEqual(copy(api.state().schedule),existing);fill(f,{time:'13:15',endTime:'14:45'});api.saveRange(f);await settle();const leave=api.state().schedule.filter(s=>s.kind==='annual-leave');assert.equal(leave[0].time,'13:15');assert.equal(leave.at(-1).endTime,'14:45');const report=window.WorkHubReports.build(api.state(),{asOf:'2026-10-20'});assert.equal(report.sheets.find(s=>s.name==='Schedule').rows.length,2);const old=api.parseBackup(JSON.stringify({app:'mm-ticket-tracker',version:9,data:{...copy(api.state()),schedule:existing}}));assert.equal(old.schedule[0].kind,'custom');assert.equal(old.schedule[0].leave,undefined);
});

test('legacy Process Hub presentation retains maintained steps and keyboard navigation without writes',async t=>{
 const {api,document,window,db}=await app(t);await hubAction(api,'process-example');api.showTab('processhub');const calls=db.calls.length;assert.ok(document.getElementById('rehearsalRoot'));api.hub.processDeck.open(api.state().workhub.processes[0].id);await settle();assert.ok(document.getElementById('processDeck'));assert.ok(document.getElementById('modal').classList.contains('process-presentation-modal'));assert.match(document.getElementById('processSlideTitle').textContent,/Purchase requisition/);assert.match(document.getElementById('processDeck').textContent,/ME51N/);document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.match(document.getElementById('processSlideTitle').textContent,/Purchase order/);assert.equal(api.hub.processDeck.snapshot().index,1);document.querySelector('[data-deck="prev"]').click();assert.equal(api.hub.processDeck.snapshot().index,0);document.querySelector('[data-deck="jump"][data-index="3"]').click();assert.match(document.getElementById('processSlideTitle').textContent,/Invoice verification/);document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(document.getElementById('modal').open,false);assert.equal(document.getElementById('modal').classList.contains('process-presentation-modal'),false);assert.equal(db.calls.length,calls);
});

test('Process presentations pause at branches and on hidden pages, and cannot autoplay forever around loops',async t=>{
 const {api,document,window,db}=await app(t);await hubAction(api,'process-example');api.mutate(d=>{const p=d.workhub.processes[0];p.steps[0].next=[p.steps[1].id,p.steps[2].id];p.steps[2].next=[p.steps[0].id];});await settle();const calls=db.calls.length,id=api.state().workhub.processes[0].id;api.hub.processDeck.open(id);document.querySelector('[data-deck="play"]').click();let now=window.Date.now();window.Date.now=()=>now+9000;api.hub.processDeck.tick();assert.equal(api.hub.processDeck.snapshot().playing,false);assert.equal(api.hub.processDeck.snapshot().index,0);assert.equal(document.querySelectorAll('[data-deck="branch"]').length,2);document.querySelectorAll('[data-deck="branch"]')[1].click();assert.equal(api.hub.processDeck.snapshot().index,2);document.querySelector('[data-deck="play"]').click();window.Date.now=()=>now+18000;api.hub.processDeck.tick();assert.equal(api.hub.processDeck.snapshot().playing,false);assert.equal(api.hub.processDeck.snapshot().index,2);document.querySelector('[data-deck="play"]').click();Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(api.hub.processDeck.snapshot().playing,false);Object.defineProperty(document,'hidden',{configurable:true,value:false});api.hub.processDeck.close();assert.equal(db.calls.length,calls);
});

test('Settings opens on hover, animates its close, stays open on re-entry and supports touch and Escape',async t=>{
 const {api,document,window,db}=await app(t),menu=document.getElementById('settingsMenu'),summary=menu.querySelector('summary'),panel=menu.querySelector('.settings-panel'),timers=new Map();let id=0;window.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id;};window.clearTimeout=id=>timers.delete(id);const run=ms=>{for(const[key,timer]of[...timers])if(timer.ms===ms){timers.delete(key);timer.fn();}};menu.dispatchEvent(new window.MouseEvent('pointerenter',{bubbles:false}));assert.equal(menu.open,true);assert.equal(summary.getAttribute('aria-expanded'),'true');menu.dispatchEvent(new window.MouseEvent('pointerleave',{bubbles:false}));run(100);assert.equal(menu.dataset.menuState,'closing');assert.equal(menu.open,true);menu.dispatchEvent(new window.MouseEvent('pointerenter',{bubbles:false}));run(190);assert.equal(menu.open,true);menu.dispatchEvent(new window.MouseEvent('pointerleave',{bubbles:false}));run(100);const end=new window.Event('animationend',{bubbles:true});Object.defineProperty(end,'animationName',{value:'workspace-settings-close'});panel.dispatchEvent(end);assert.equal(menu.open,false);const touch=new window.MouseEvent('pointerdown',{bubbles:true});Object.defineProperty(touch,'pointerType',{value:'touch'});summary.dispatchEvent(touch);summary.click();assert.equal(menu.open,true);document.querySelector('#workspaceSettingsPanel button:not([hidden])').focus();document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(menu.open,false);assert.equal(document.activeElement,summary);assert.equal(db.calls.length,0);
});

test('the cloud icon exposes saved, pending, offline and conflict states without hiding recovery warnings',async t=>{
 const {api,document,db}=await app(t),icon=document.getElementById('saveStatus');assert.ok(icon.querySelector('svg'));assert.equal(icon.dataset.syncState,'saved');assert.equal(icon.title,'All changes saved');assert.equal(icon.textContent.includes('Supabase'),false);api.cloud.pending={id:'queued'};api.cloud.status='Saving changes…';api.notice();assert.equal(icon.dataset.syncState,'saving');assert.match(icon.getAttribute('aria-label'),/Saving changes/);api.cloud.status='Offline · changes are waiting';api.cloud.error='offline';api.notice();assert.equal(icon.dataset.syncState,'offline');assert.equal(document.getElementById('storageNotice').hidden,false);api.cloud.conflict=true;api.cloud.status='Newer records need review';api.notice();assert.equal(icon.dataset.syncState,'review');assert.match(icon.title,/review/);assert.equal(document.getElementById('cloudReload').hidden,false);assert.equal(db.calls.length,0);
});

test('Momo’s house drags by touch, cancels safely, moves with keys and remembers its position locally',async t=>{
 const {api,document,window,db}=await app(t);Object.defineProperty(window,'innerWidth',{value:375,configurable:true});Object.defineProperty(window,'innerHeight',{value:667,configurable:true});window.dispatchEvent(new window.Event('resize'));const house=document.getElementById('hubMomoHome');pointer(window,house,'pointerdown',310,600);pointer(window,document,'pointermove',30,110);assert.equal(house.dataset.dragging,'true');pointer(window,document,'pointerup',30,110);const saved=window.localStorage.getItem('mm-tracker.momo-home.v2');assert.ok(saved);const point=copy(api.hub.life.homePosition());house.click();assert.notEqual(document.getElementById('hubPet').dataset.pose,'nap');pointer(window,house,'pointerdown',30,110);pointer(window,document,'pointermove',180,400);pointer(window,document,'pointercancel',180,400);assert.deepEqual(copy(api.hub.life.homePosition()),point);assert.equal(window.localStorage.getItem('mm-tracker.momo-home.v2'),saved);house.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.ok(api.hub.life.homePosition().x>point.x);const storage={'mm-tracker.momo-home.v2':window.localStorage.getItem('mm-tracker.momo-home.v2')},second=await app(t,{storage});assert.deepEqual(copy(second.api.hub.life.homePosition()),JSON.parse(storage['mm-tracker.momo-home.v2']));assert.ok(parseFloat(house.style.left)>=8);assert.ok(parseFloat(house.style.left)+64<=375);assert.equal(db.calls.length,0);
});

test('lo-fi soundscape is opt-in, changes original loops, persists locally and releases audio on stop',async t=>{
 const {api,document,window,db}=await app(t),audio=mockAmbientAudio(window);api.hub.soundscape.open();document.querySelector('[data-sound="preset"][data-preset="lofi"]').click();assert.equal(audio.length,0);assert.equal(api.hub.soundscape.snapshot().mix.lofi,85);await api.hub.soundscape.start();assert.equal(api.hub.soundscape.snapshot().musicRunning,true);const original=audio[0].nodes.findLast(n=>n.buffer);assert.equal(original.loop,true);document.getElementById('soundscapeTrack').value='bluehour';document.getElementById('soundscapeTrack').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(original.stopped,true);assert.equal(original.disconnected,true);assert.equal(api.hub.soundscape.snapshot().track,'bluehour');Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'));api.hub.soundscape.tick();assert.equal(api.hub.soundscape.snapshot().playing,true);const storage={'mm-tracker.soundscape.v1':window.localStorage.getItem('mm-tracker.soundscape.v1')},second=await app(t,{storage});assert.equal(second.api.hub.soundscape.snapshot().track,'bluehour');assert.equal(second.api.hub.soundscape.snapshot().playing,false);api.hub.soundscape.stop();assert.equal(api.hub.soundscape.snapshot().musicRunning,false);assert.equal(audio[0].state,'closed');assert.equal(db.calls.length,0);assert.equal(api.payload(api.state()).includes('bluehour'),false);
});

test('original lo-fi buffers contain louder bounded stereo music with practical loop lengths and no invalid samples',async t=>{
 const {window}=await app(t);const context={sampleRate:48000,createBuffer(n,length,sampleRate){const channels=Array.from({length:n},()=>new Float32Array(length));return{length,sampleRate,duration:length/sampleRate,getChannelData:i=>channels[i]};}};for(const id of Object.keys(window.WorkHubLofi.TRACKS)){const b=window.WorkHubLofi.createBuffer(context,id);assert.ok(b.duration>20&&b.duration<35);assert.ok(b.sampleRate<=24000);let sq=0,peak=0,stereoDifference=0;const left=b.getChannelData(0),right=b.getChannelData(1);for(let i=0;i<b.length;i++){assert.ok(Number.isFinite(left[i])&&Number.isFinite(right[i]));sq+=left[i]**2;peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));stereoDifference+=Math.abs(left[i]-right[i]);}assert.ok(Math.sqrt(sq/b.length)>.12);assert.ok(peak<.85);assert.ok(stereoDifference>1);assert.ok(Math.abs(left[0]-left.at(-1))<.05);}
});

test('anime Momo startles only on a nearby cursor entry, recovers, and has a cooldown',async t=>{
 const {api,document,window,frames,db}=await app(t),pet=document.getElementById('hubPet');
 let now=window.Date.now();window.Date.now=()=>now;
 pet.getBoundingClientRect=()=>({left:400,top:200,width:144,height:144,right:544,bottom:344});
 const move=(x,y,type='mouse')=>{const e=new window.MouseEvent('pointermove',{bubbles:true,clientX:x,clientY:y});Object.defineProperties(e,{pointerId:{value:1},pointerType:{value:type}});document.body.dispatchEvent(e);for(const [id,fn]of [...frames]){frames.delete(id);fn(window.performance.now()+20);}};
 move(0,0);assert.notEqual(pet.dataset.pose,'startled');move(470,250);assert.equal(pet.dataset.pose,'startled');assert.equal(pet.dataset.expression,'surprised');assert.match(document.getElementById('hubPetBubble').textContent,/startled/);
 now+=2100;api.hub.life.tick();assert.equal(pet.dataset.pose,'idle');document.getElementById('hubPetBubble').hidden=true;
 move(0,0);move(470,250);assert.equal(pet.dataset.pose,'idle');now+=21000;move(0,0);move(470,250,'touch');assert.equal(pet.dataset.pose,'idle');move(0,0);move(470,250);assert.equal(pet.dataset.pose,'startled');
 assert.ok(pet.style.getPropertyValue('--momo-look-x'));assert.equal(db.calls.length,0);
});

test('anime Momo protests once when dragged, looks annoyed on release, and recovers without saving records',async t=>{
 const {api,document,window,db}=await app(t),pet=document.getElementById('hubPet'),button=pet.querySelector('button');let now=window.Date.now();window.Date.now=()=>now;
 pointer(window,button,'pointerdown',700,250);pointer(window,document,'pointermove',702,252);assert.notEqual(pet.dataset.pose,'held');pointer(window,document,'pointerup',702,252);assert.notEqual(pet.dataset.pose,'annoyed');
 pointer(window,button,'pointerdown',700,250);pointer(window,document,'pointermove',650,240);assert.equal(pet.dataset.pose,'held');assert.match(document.getElementById('hubPetBubble').textContent,/Hey! Let me go!/);
 pointer(window,document,'pointermove',600,220);assert.equal(pet.dataset.pose,'held');pointer(window,document,'pointerup',600,220);assert.equal(pet.dataset.pose,'annoyed');assert.equal(pet.dataset.expression,'annoyed');assert.match(document.getElementById('hubPetBubble').textContent,/Hmph/);
 now+=6500;api.hub.life.tick();assert.equal(pet.dataset.pose,'idle');assert.ok(window.localStorage.getItem('mm-tracker.companion-position.v1'));assert.equal(db.calls.length,0);
});

test('Momo unfolds a chair, settles, whistles, folds it away and keeps live pupils',async t=>{
 const {api,document,window,db}=await app(t,{styles:true}),pet=document.getElementById('hubPet'),life=api.hub.life;let now=window.Date.now();const start=now;window.Date.now=()=>now;
 const chair=pet.querySelector('.momo-folding-chair'),notes=pet.querySelector('.momo-whistle-notes');assert.equal(window.getComputedStyle(chair).display,'none');
 assert.equal(life.gesture('sit'),true);assert.equal(pet.dataset.chairPhase,'unfold');assert.equal(window.getComputedStyle(chair).display,'inline');assert.ok(pet.querySelector('.momo-pupils'));assert.match(window.getComputedStyle(pet.querySelector('.pet-body')).animation,/none/);
 now=start+2100;life.tick();assert.equal(pet.dataset.chairPhase,'settle');now=start+3500;life.tick();assert.equal(pet.dataset.chairPhase,'whistle');assert.equal(window.getComputedStyle(notes).display,'inline');
 now=start+13000;life.tick();assert.equal(pet.dataset.chairPhase,'fold');assert.equal(window.getComputedStyle(notes).display,'none');now=start+16000;life.tick();assert.equal(life.gestureState(),null);assert.equal(pet.hasAttribute('data-chair-phase'),false);assert.equal(window.getComputedStyle(chair).display,'none');assert.equal(db.calls.length,0);
});

test('Momo randomly nods off and wakes himself, while a requested home nap lasts until woken',async t=>{
 const {api,document,window,frames,db}=await app(t,{styles:true,storage:{'mm-tracker.momo-chatter.v1':'quiet'}}),pet=document.getElementById('hubPet'),life=api.hub.life;let now=window.Date.now();window.Date.now=()=>now;window.Math.random=()=>.36;
 now+=120000;life.tick();assert.equal(life.gestureState(),'sleep');assert.equal(pet.dataset.pose,'idle-sleep');assert.equal(window.getComputedStyle(pet.querySelector('.momo-eye-lids')).opacity,'1');now+=16000;life.tick();assert.equal(pet.dataset.pose,'stretch');now+=2100;life.tick();assert.equal(life.gestureState(),null);assert.equal(pet.dataset.pose,'idle');
 life.goHome();for(const [id,fn]of [...frames]){frames.delete(id);fn(window.performance.now()+10000);}assert.equal(pet.dataset.pose,'nap');now+=3600000;life.tick();assert.equal(pet.dataset.pose,'nap');life.wake();assert.equal(pet.dataset.pose,'stretch');now+=3500;life.tick();assert.notEqual(pet.dataset.pose,'nap');assert.equal(db.calls.length,0);
});

test('new Momo gestures stop for editing, scenes, hidden tabs and reduced motion; quiet time silences drag speech',async t=>{
 const {api,document,window,db}=await app(t,{storage:{'mm-tracker.momo-chatter.v1':'quiet'}}),life=api.hub.life,pet=document.getElementById('hubPet');
 assert.equal(life.gesture('sit'),true);document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(life.gestureState(),null);assert.equal(pet.hasAttribute('data-chair-phase'),false);assert.equal(life.gesture('hair-tidy'),true);api.showTab('knowledge');document.getElementById('hubSearch').focus();assert.equal(life.gestureState(),null);assert.equal(life.gesture('sleep'),false);document.getElementById('hubSearch').blur();
 assert.equal(life.gesture('sleep'),true);life.scene({pose:'lab-cower',expression:'surprised'});assert.equal(life.gestureState(),null);assert.equal(pet.dataset.pose,'lab-cower');life.scene(null);
 assert.equal(life.gesture('daydream'),true);Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(life.gestureState(),null);assert.equal(pet.dataset.pose,'idle');Object.defineProperty(document,'hidden',{configurable:true,value:false});
 assert.equal(life.gesture('balance'),true);window.matchMedia=()=>({matches:true});life.tick();assert.equal(life.gestureState(),null);assert.equal(life.gesture('sit'),false);window.matchMedia=()=>({matches:false});
 document.getElementById('hubPetBubble').hidden=true;pointer(window,pet.querySelector('button'),'pointerdown',700,250);pointer(window,document,'pointermove',600,200);assert.equal(pet.dataset.pose,'held');assert.equal(document.getElementById('hubPetBubble').hidden,true);pointer(window,document,'pointercancel',600,200);assert.equal(pet.dataset.pose,'annoyed');assert.equal(document.getElementById('hubPetBubble').hidden,true);assert.equal(db.calls.length,0);
});

test('existing lo-fi volume choices remain local with a stronger music channel and a mix compressor',async t=>{
 const storage={'mm-tracker.soundscape.v1':JSON.stringify({mix:{rain:18,lofi:64},master:45,muted:false,track:'bluehour'})};
 const {api,window,db}=await app(t,{storage}),audio=mockAmbientAudio(window);assert.equal(api.hub.soundscape.snapshot().playing,false);assert.equal(audio.length,0);await api.hub.soundscape.start();const ctx=audio[0],compressor=ctx.nodes.find(n=>n.isCompressor);
 assert.equal(api.hub.soundscape.snapshot().master,45);assert.equal(api.hub.soundscape.snapshot().mix.lofi,64);assert.ok(ctx.nodes.some(n=>Math.abs(n.gain.value-1.792)<.00001));assert.equal(ctx.nodes[0].gain.value,.27);assert.equal(compressor.threshold.value,-6);assert.equal(compressor.ratio.value,8);
 api.hub.soundscape.stop();assert.equal(compressor.disconnected,true);assert.equal(ctx.nodes[0].disconnected,true);assert.equal(db.calls.length,0);
});

function addWishlistTicket(api,document){api.editRecord('tickets');const f=document.getElementById('editForm');for(const [k,v]of Object.entries({ticket:'AMS-2048',description:'Keep plant assignments consistent',history:'- Blueprint confirmed [16-10-2026]',pic:'Haidid',transport:'FMD'}))f.elements.namedItem(k).value=v;f.elements.namedItem('batchSystem').value='S4Q';f.elements.namedItem('batchClient').value='010';api.saveEdit(f);return api.state().tickets.at(-1).id;}
test('wishlist snippets and bundles persist through cloud reopen and backup with safe record composition',async t=>{const {api,document,window,db}=await app(t),ui=api.hub.library,id=addWishlistTicket(api,document);ui.bundleManager();let f=document.getElementById('wlBundleNew');f.elements.namedItem('name').value='Testing coordination';ui.submit(f);const bundle=api.state().workhub.workLibrary.bundles[0].id;ui.snippetEditor();f=document.getElementById('wlSnippet');f.elements.namedItem('title').value='Ready for testing';f.elements.namedItem('bundleId').value=bundle;f.elements.namedItem('body').value='Hi {name},\n\nPlease test {ticket} in {system}/{client}.';ui.submit(f);const snippet=api.state().workhub.workLibrary.snippets[0].id;ui.composer(snippet,'tickets',id);f=document.getElementById('wlCompose');assert.equal(f.elements.namedItem('p_ticket').value,'AMS-2048');assert.equal(f.elements.namedItem('p_system').value,'S4Q');assert.equal(f.elements.namedItem('p_client').value,'010');assert.equal(f.elements.namedItem('p_name').value,'');assert.equal(f.querySelector('[data-wl="copy"]').disabled,true);f.elements.namedItem('p_name').value='<Aisha>';f.elements.namedItem('p_name').dispatchEvent(new window.Event('input',{bubbles:true}));let copied='';Object.defineProperty(window.navigator,'clipboard',{configurable:true,value:{writeText:async x=>copied=x}});await ui.copyMessage();assert.ok(copied.includes('AMS-2048'));assert.ok(copied.includes('<Aisha>'));await settle();await api.flushCloud();const saved=api.parseBackup(api.payload(api.state()));assert.equal(saved.workhub.workLibrary.snippets[0].body,api.state().workhub.workLibrary.snippets[0].body);const reopened=await app(t,{login:false,remote:copy(db.row)});await reopened.api.loadCloud(sessionUser);await settle();reopened.api.showTab('snippets');assert.match(reopened.document.getElementById('view').textContent,/Ready for testing/);assert.equal(reopened.api.state().workhub.workLibrary.bundles[0].name,'Testing coordination');});
test('snippet bundle removal and undo preserve messages and later assignments',async t=>{const {api,document,window}=await app(t),ui=api.hub.library;window.confirm=()=>true;api.mutate(d=>{d.workhub.workLibrary.bundles=[{id:'a',name:'Testing'},{id:'b',name:'Delivery'}];d.workhub.workLibrary.snippets=[{id:'s',title:'Ready',category:'',body:'Hello',bundleId:'a',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}];});await ui.handle({dataset:{wl:'bundle-remove',id:'a'}});assert.equal(api.state().workhub.workLibrary.snippets[0].bundleId,'');api.mutate(d=>d.workhub.workLibrary.snippets[0].bundleId='b');await ui.handle({dataset:{wl:'undo'}});assert.equal(api.state().workhub.workLibrary.snippets[0].bundleId,'b');assert.equal(api.state().workhub.workLibrary.bundles.length,2);});
test('ticket cards, details and grouped editor preserve fields, Work Context, milestones and dated history',async t=>{const {api,document,window}=await app(t),id=addWishlistTicket(api,document);api.showTab('tickets');assert.ok(document.querySelector('.ticket-folio'));assert.match(document.querySelector('.ticket-history-preview').textContent,/Blueprint confirmed/);await api.action({dataset:{action:'detail',id}});assert.ok(document.querySelector('[data-ticket-detail] .ticket-facts'));assert.ok(document.querySelector('[data-ticket-detail] [data-wl="timeline"]'));let f=document.getElementById('historyForm');f.elements.namedItem('newHistory').value='UAT data prepared';f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.match(api.state().tickets[0].history,/UAT data prepared/);await api.action({dataset:{action:'progress-detail',id:api.state().trackers[0].id}});f=document.getElementById('progressForm');f.elements.namedItem('step0').checked=true;f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();await api.action({dataset:{action:'detail',id}});assert.equal(document.querySelectorAll('.ticket-milestones [data-step]').length,api.steps().length+2);api.editRecord('tickets',id);f=document.getElementById('editForm');assert.equal(f.querySelectorAll('.ticket-editor-section').length,4);assert.match(f.querySelector('.ticket-context-panel').textContent,/Work Context/);assert.equal(f.elements.namedItem('batchClient').value,'010');assert.equal(f.elements.namedItem('transport').value,'FMD');f.elements.namedItem('pic').value='Aisha';api.saveEdit(f);assert.equal(api.state().tickets[0].pic,'Aisha');assert.equal(api.state().trackers[0].steps[0],true);assert.equal(window.WorkHubBatchEngine.meta(api.state(),'tickets',id).systemId,'S4Q');assert.ok(api.state().workhub.workLibrary.events.some(e=>e.title==='Milestone tracker added'));});
test('work timeline opens without saves and filters recorded status and history changes',async t=>{const {api,document,window,db}=await app(t),id=addMainTask(api,document,'Prepare a test scenario'),ui=api.hub.library;api.mutate(d=>{d.tasks[0].done=true;d.tasks[0].remarks='Result confirmed';});await settle();const calls=db.calls.length;ui.openTimeline('tasks',id);assert.match(document.getElementById('modalBody').textContent,/Status changed/);const filter=document.querySelector('[name="timelineFilter"]');filter.value='status';filter.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(document.querySelectorAll('.wl-event').length,1);await settle();assert.equal(db.calls.length,calls);assert.match(document.getElementById('modalBody').textContent,/Result confirmed/);});
test('field library inserts independent complete columns, handles naming collisions and preserves published versions',async t=>{const {api,document,window}=await app(t),ui=api.hub.library,val=api.hub.validator;api.showTab('validator');await val.handle({dataset:{val:'example'}});await val.saveDraft();await val.publish();const frozen=copy(api.state().workhub.validator.templates[0].releases[0]);ui.openFields({...window.WorkHubValidatorEngine.column(),key:'TYPE',label:'Request type',required:true,values:'A,B'},definition=>val.addLibraryField(definition));ui.fieldEditor();let f=document.getElementById('wlField');f.elements.namedItem('name').value='Reusable request type';ui.submit(f);const field=api.state().workhub.workLibrary.fields[0];await ui.handle({dataset:{wl:'field-insert',id:field.id}});const c=val.snapshot().draft.columns.at(-1);assert.equal(c.key,'TYPE_2');assert.equal(c.required,true);assert.equal(c.values,'A,B');assert.notEqual(c.id,field.definition.id);await val.saveDraft();assert.deepEqual(copy(api.state().workhub.validator.templates[0].releases[0]),frozen);ui.fieldEditor(field.id);f=document.getElementById('wlField');f.elements.namedItem('values').value='C,D';ui.submit(f);assert.equal(api.state().workhub.validator.templates[0].columns.at(-1).values,'A,B');});
test('combination builder, reference explanations and field renaming work through actual forms',async t=>{const {api,document,window}=await app(t),ui=api.hub.validator,E=window.WorkHubValidatorEngine;api.showTab('validator');await ui.handle({dataset:{val:'example'}});await ui.handle({dataset:{val:'mode',mode:'references'}});let f=document.getElementById('valReferenceForm');f.elements.namedItem('name').value='Owners by type';f.elements.namedItem('data').value='Type,Owner,Name,Description\nStandard,Aisha,Aisha team,Finance coordination\nUrgent,Daniel,Daniel team,Emergency support';f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));f=document.getElementById('valReferenceForm');f.elements.namedItem('codeColumn').value='Owner';f.elements.namedItem('nameColumn').value='Name';f.querySelector('[name="refDescription"][value="Description"]').checked=true;f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await ui.handle({dataset:{val:'mode',mode:'rules'}});await ui.handle({dataset:{val:'add-rule'}});f=document.getElementById('valRuleForm');let clause=f.querySelector('[data-assertion]');clause.querySelector('[data-clause="field"]').value='OWNER';const op=clause.querySelector('[data-clause="operator"]');op.value='lookupTuple';op.dispatchEvent(new window.Event('change',{bubbles:true}));await settle();clause=document.querySelector('[data-assertion]');let pairs=clause.querySelectorAll('[data-tuple-pair]');pairs[0].querySelector('[data-pair-field]').value='OWNER';pairs[0].querySelector('[data-pair-reference]').value='Owner';pairs[1].querySelector('[data-pair-field]').value='TYPE';pairs[1].querySelector('[data-pair-reference]').value='Type';f=document.getElementById('valRuleForm');f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await ui.saveDraft();const saved=ui.snapshot().draft;assert.equal(saved.rules.at(-1).assertion.pairs.length,2);assert.equal(E.validateRows(saved,[{REQUEST_ID:'1',TYPE:'Standard',OWNER:'Daniel',AMOUNT:'1',START_DATE:'2026-10-20',END_DATE:'2026-10-21'}]).issues.some(i=>i.rule==='New condition'),true);await ui.handle({dataset:{val:'mode',mode:'columns'}});const column=saved.columns.find(c=>c.key==='OWNER');await ui.handle({dataset:{val:'select-column',id:column.id}});f=document.getElementById('valColumnForm');f.elements.namedItem('key').value='ASSIGNEE';f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));assert.equal(ui.snapshot().draft.rules.at(-1).assertion.pairs[0].field,'ASSIGNEE');});

test('floating Focus sits beside Reminders and preserves the current form while sharing the timer',async t=>{
 const {api,document,window,db}=await app(t),task=addMainTask(api,document,'Review the design');await settle();api.showTab('validator');await api.hub.validator.handle({dataset:{val:'example'}});const template=document.getElementById('valMetaForm');template.elements.namedItem('name').value='Unsaved working name';const writes=db.calls.length;
 assert.equal(document.getElementById('reminderInboxButton').nextElementSibling.id,'focusShortcuts');assert.equal(document.getElementById('focusShortcuts').firstElementChild.id,'focusModeButton');document.getElementById('focusModeButton').click();assert.equal(document.getElementById('focusPanel').hidden,false);assert.equal(document.querySelector('dialog[open]'),null);const form=document.getElementById('fpFocusForm');form.elements.namedItem('minutes').value='35';form.elements.namedItem('task').value=task;form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));assert.equal(document.getElementById('fpClock').textContent,'35:00');assert.equal(document.getElementById('valMetaForm'),template);assert.equal(template.elements.namedItem('name').value,'Unsaved working name');assert.equal(api.hub.focusSnapshot().title,'Review the design');assert.equal(db.calls.length,writes);
 api.showTab('studio');api.hub.setTool('focus');api.showTab('studio');assert.equal(document.getElementById('hubFocusClock').textContent,'35:00');assert.ok(document.getElementById('focusPanel'));await api.hub.handle({dataset:{hub:'focus-stop'}});assert.equal(document.getElementById('fpState').textContent,'Ready when you are');assert.equal(document.getElementById('fpClock').textContent,'35:00');const restart=document.getElementById('hubFocusForm');restart.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await api.loadCloud({user:{id:'22222222-2222-4222-8222-222222222222',email:'other@example.com'}});await settle();assert.equal(api.hub.focusSnapshot().active,false);assert.ok(!document.getElementById('hubFocusForm').querySelector('.hub-meta').textContent.includes('Review the design'));
});
test('floating Focus pauses, resumes and finishes without resetting elapsed time or closing other work',async t=>{
 const {api,document,window,intervals,db}=await app(t);let clock=window.Date.now();window.Date.now=()=>clock;document.getElementById('focusModeButton').click();let f=document.getElementById('fpFocusForm');f.elements.namedItem('minutes').value='2';f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));const tick=intervals.find(i=>i.ms===1000).callback;clock+=30000;tick();assert.equal(document.getElementById('fpClock').textContent,'01:30');document.getElementById('fpPause').click();clock+=120000;tick();assert.equal(document.getElementById('fpClock').textContent,'01:30');assert.equal(api.hub.focusSnapshot().paused,true);document.getElementById('fpPause').click();clock+=30000;tick();assert.equal(document.getElementById('fpClock').textContent,'01:00');document.querySelector('[data-focus="minimize"]').click();assert.equal(document.getElementById('focusPanel').dataset.minimized,'true');clock+=60000;tick();assert.equal(api.hub.focusSnapshot().active,false);assert.match(document.getElementById('toast').textContent,/Focus session complete/);assert.equal(db.calls.length,0);
});
test('floating Focus controls local Soundscape playback and volume without an external player',async t=>{
 const {api,document,window,db}=await app(t);mockAmbientAudio(window);document.getElementById('focusModeButton').click();
 const preset=document.getElementById('fpPreset');preset.value='rain';preset.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(api.hub.soundscape.snapshot().mix.rain,55);
 document.getElementById('fpSoundPlay').click();await settle();assert.equal(api.hub.soundscape.snapshot().playing,true);
 document.getElementById('fpVolume').value='25';document.getElementById('fpVolume').dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(api.hub.soundscape.snapshot().master,25);
 document.querySelector('[data-focus="quiet"]').click();await settle();assert.equal(api.hub.soundscape.snapshot().playing,false);
 assert.equal(document.getElementById('fpMusicPane'),null);assert.equal(document.querySelector('[data-focus="source"]'),null);assert.equal(document.querySelector('iframe'),null);assert.equal(db.calls.length,0);
});
test('floating Focus clamps dragging, supports keyboard movement and clears private session state on sign-out',async t=>{
 const {api,document,window,db}=await app(t);document.getElementById('focusModeButton').click();const panel=document.getElementById('focusPanel'),handle=panel.querySelector('[data-focus="drag"]'),before=parseFloat(panel.style.left);handle.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));assert.ok(parseFloat(panel.style.left)<before);const prior=copy(api.hub.focusPanel.snapshot().position);pointer(window,handle,'pointerdown',100,100);pointer(window,document,'pointermove',-10000,10000);assert.equal(parseFloat(panel.style.left),12);pointer(window,document,'pointercancel',-10000,10000);assert.deepEqual(copy(api.hub.focusPanel.snapshot().position),prior);pointer(window,handle,'pointerdown',100,100);pointer(window,document,'pointermove',-10000,10000);pointer(window,document,'pointerup',-10000,10000);assert.equal(JSON.parse(window.localStorage.getItem('mm-tracker.focus-panel.v1')).x,0);
 const f=document.getElementById('fpFocusForm');f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));document.querySelector('[data-focus="close"]').click();assert.equal(panel.hidden,true);assert.equal(api.hub.focusSnapshot().active,true);document.getElementById('focusModeButton').click();assert.equal(panel.hidden,false);Object.defineProperty(window,'innerWidth',{configurable:true,value:300});Object.defineProperty(window,'innerHeight',{configurable:true,value:240});window.dispatchEvent(new window.Event('resize'));assert.equal(parseFloat(panel.style.width),276);assert.equal(parseFloat(panel.style.maxHeight),216);assert.ok(parseFloat(panel.style.top)>=12);await api.loadCloud(null);assert.equal(document.getElementById('focusPanel'),null);assert.equal(api.hub.focusSnapshot().active,false);assert.equal(document.getElementById('focusModeButton').hidden,true);assert.equal(db.calls.length,0);
});
test('floating Focus hides behind dialogs and cancels pending sound when Stop audio is pressed',async t=>{
 const {api,document,window}=await app(t),audio=mockAmbientAudio(window,{pending:true});document.getElementById('focusModeButton').click();document.getElementById('fpSoundPlay').click();await settle();assert.equal(audio.length,1);document.querySelector('[data-focus="quiet"]').click();audio[0].finishResume();await settle();assert.equal(api.hub.soundscape.snapshot().playing,false);assert.equal(document.getElementById('soundscapeDock'),null);api.editRecord('tasks');await settle();assert.equal(document.getElementById('focusPanel').hidden,true);api.closeModal();await settle();assert.equal(document.getElementById('focusPanel').hidden,false);await api.hub.handle({dataset:{hub:'privacy'}});await settle();assert.equal(document.getElementById('focusPanel').hidden,true);await api.hub.handle({dataset:{hub:'privacy'}});await settle();assert.equal(document.getElementById('focusPanel').hidden,false);
});

const adventureChoices={greetings:false,antics:false,reminders:false,chases:true};
const adventureStorage=values=>({'mm-tracker.momo-adventures.v1':JSON.stringify({...adventureChoices,...values})});
function submitLocal(window,form){form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));}
function rect(left,top,width,height){return{left,top,width,height,right:left+width,bottom:top+height,x:left,y:top};}

test('Momo world: rename follows account, backup and controls without treating names as markup',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.adventures;
 ui.renameForm();let f=document.getElementById('momoNameForm');f.elements.namedItem('mascotName').value='<b>Mini</b>';submitLocal(window,f);await settle();
 assert.equal(api.state().workhub.preferences.mascotName,'<b>Mini</b>');assert.equal(db.calls.length,1);assert.equal(db.row.document.data.workhub.preferences.mascotName,'<b>Mini</b>');
 assert.equal(api.parseBackup(api.payload(api.state())).workhub.preferences.mascotName,'<b>Mini</b>');
 api.hub.life.menu();const menu=document.getElementById('hubMomoMenu');assert.equal(menu.querySelector('strong').textContent,'A little time with <b>Mini</b>');assert.equal(menu.querySelector('b'),null);assert.match(document.querySelector('#hubPet>button').getAttribute('aria-label'),/^<b>Mini<\/b>,/);
 menu.querySelector('[data-adventure="rename"]').click();f=document.getElementById('momoNameForm');assert.equal(f.elements.namedItem('mascotName').value,'<b>Mini</b>');assert.equal(f.querySelector('b'),null);f.elements.namedItem('mascotName').value='x'.repeat(33);submitLocal(window,f);assert.equal(api.state().workhub.preferences.mascotName,'<b>Mini</b>');assert.match(document.getElementById('toast').textContent,/1–32/);api.closeModal();
 api.hub.moments.settings();assert.match(document.getElementById('momentsSettingsForm').textContent,/<b>Mini<\/b>/);assert.equal(document.querySelector('#momentsSettingsForm b'),null);api.closeModal();
 api.hub.setTool('theme');api.showTab('studio');assert.match(document.getElementById('hubTheme').textContent,/Show <b>Mini<\/b>/);assert.equal(document.querySelector('#hubTheme label b'),null);
 const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);await settle();assert.equal(reopened.api.hub.adventures.snapshot().name,'<b>Mini</b>');
 const bad=copy(api.state());bad.workhub.preferences.mascotName='bad\nname';assert.throws(()=>api.validate(bad),/companion name/);
});

test('Momo world: opening greeting waits for forms, waves once, and resets for the next account',async t=>{
 const {api,document,window,db}=await app(t,{adventures:true,styles:true}),ui=api.hub.adventures;let clock=window.Date.now();window.Date.now=()=>clock;
 api.editRecord('tasks');clock+=6000;ui.tick();assert.equal(ui.snapshot().pendingGreeting,true);assert.equal(document.getElementById('hubPet').dataset.adventure,undefined);
 api.closeModal();document.activeElement?.blur();ui.tick();assert.equal(ui.snapshot().active.kind,'greeting');assert.equal(document.getElementById('hubPet').dataset.pose,'idle-wave');assert.match(window.getComputedStyle(document.querySelector('#hubPet .momo-arm-right')).animation,/world-wave/);assert.match(document.getElementById('hubPetBubble').textContent,/Haidid/);assert.equal(ui.snapshot().pendingGreeting,false);
 clock+=7000;ui.tick();assert.equal(ui.snapshot().active,null);api.showTab('tickets');ui.tick();assert.equal(ui.snapshot().pendingGreeting,false);assert.notEqual(ui.snapshot().active?.kind,'greeting');
 api.cloud.user={id:'22222222-2222-4222-8222-222222222222'};ui.mount();assert.equal(ui.snapshot().pendingGreeting,true);assert.equal(document.getElementById('hubPetBubble').hidden,true);assert.equal(db.calls.length,0);
});

test('Momo world: quiet time defers greetings and reduced motion delivers a still greeting',async t=>{
 const {api,window,document}=await app(t,{adventures:true,storage:{'mm-tracker.momo-chatter.v1':'quiet'}}),ui=api.hub.adventures;const clock=window.Date.now()+6000;window.Date.now=()=>clock;ui.tick();assert.equal(ui.snapshot().pendingGreeting,true);
 window.localStorage.removeItem('mm-tracker.momo-chatter.v1');window.matchMedia=()=>({matches:true});ui.tick();assert.equal(ui.snapshot().pendingGreeting,false);assert.equal(ui.snapshot().active,null);assert.match(document.getElementById('hubPetBubble').textContent,/Haidid/);assert.notEqual(document.getElementById('hubPet').dataset.pose,'idle-wave');
});

test('Momo world: all fourteen additional visitors have artwork and survive scrolling',async t=>{
 const {api,document,window,db}=await app(t),world=api.hub.atmosphere;const old=['butterfly','bird','firefly'],added=world.visitorKinds.filter(k=>!old.includes(k));assert.equal(added.length,14);assert.equal(new Set(added).size,14);
 for(const kind of added){assert.equal(world.invite(kind),true,kind);const visitor=document.querySelector('.hub-visitor');assert.equal(visitor.dataset.visitor,kind);assert.ok(visitor.querySelector('svg path'));window.dispatchEvent(new window.Event('scroll'));world.sync();assert.equal(document.querySelector('.hub-visitor'),visitor);world.clearVisitor();}
 assert.equal(world.invite('rabbit'),true);const visitor=document.querySelector('.hub-visitor');world.positionVisitor(80,160);visitor.click();assert.equal(visitor.style.left,'80px');assert.equal(visitor.style.top,'160px');assert.equal(visitor.classList.contains('is-greeted'),true);assert.equal(db.calls.length,0);
});

test('Momo world: eight landscapes and seven weathers preview locally, retire old aurora choices and rotate without changing records',async t=>{
 const ctx=await app(t,{styles:true,storage:{'mm-tracker.atmosphere.v1':JSON.stringify({weather:'aurora'})}}),{api,window,document,db}=ctx,world=api.hub.atmosphere,before=JSON.stringify(api.state());assert.equal(Object.keys(world.scenes).length,8);assert.equal(Object.keys(world.weathers).length,7);assert.equal(world.snapshot().preferences.weather,'random');assert.notEqual(world.snapshot().weather,'aurora');assert.equal(document.querySelector('.world-aurora'),null);
 await atmosphereChoices(ctx,{scenery:'coast',weather:'snow'});assert.equal(world.snapshot().scenery,'coast');assert.equal(document.body.dataset.weather,'snow');assert.equal(window.getComputedStyle(document.querySelector('#hubAtmosphereCard .world-snow')).display,'inline');assert.equal(window.getComputedStyle(document.querySelector('#hubAtmosphereCard .world-rain')).display,'none');assert.equal(window.getComputedStyle(document.querySelector('#hubAtmosphereCard .world-scene-coast')).display,'inline');assert.equal(window.getComputedStyle(document.querySelector('#hubAtmosphereCard .world-scene-forest')).display,'none');
 world.settings();let f=document.getElementById('atmosphereForm');assert.equal(f.querySelector('[value="aurora"]'),null);f.elements.namedItem('scenery').value='forest';f.elements.namedItem('scenery').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(document.getElementById('atmospherePreview').dataset.scenery,'forest');assert.equal(window.getComputedStyle(document.querySelector('#atmospherePreview .world-scene-coast')).display,'none');assert.equal(world.snapshot().scenery,'coast');api.closeModal();
 await atmosphereChoices(ctx,{scenery:'random',weather:'random'});const current=world.snapshot(),clock=window.Date.now();window.Date.now=()=>clock+600000;world.tick();assert.notEqual(world.snapshot().scenery,current.scenery);assert.notEqual(world.snapshot().weather,current.weather);assert.equal(JSON.stringify(api.state()),before);assert.equal(db.calls.length,0);
});

test('Momo world: umbrella reserves headroom, holds steady and cleans up across scenes and small screens',async t=>{
 const {api,document,window,frames,db}=await app(t,{styles:true}),life=api.hub.life,pet=document.getElementById('hubPet');
 Object.defineProperty(window,'innerWidth',{configurable:true,value:375});Object.defineProperty(window,'innerHeight',{configurable:true,value:220});pet.style.left='900px';pet.style.top='0px';assert.equal(life.umbrella(),true);assert.ok(document.querySelector('#hubMomoUmbrella .momo-umbrella-hand'));assert.equal(window.getComputedStyle(pet.querySelector('.momo-arm-right')).visibility,'hidden');
 let size=parseFloat(pet.style.width);assert.ok(parseFloat(pet.style.top)-size*.48>=11.99);assert.ok(parseFloat(pet.style.left)+size*1.08<=363.01);assert.ok(parseFloat(pet.style.top)+size<=208.01);assert.equal(pet.dataset.pose,'umbrella-walk');assert.equal(window.getComputedStyle(document.getElementById('hubMomoUmbrella')).left,pet.dataset.facing==='left'?'-6%':'10%');
 for(const [id,fn]of [...frames]){frames.delete(id);fn(window.performance.now()+4000);}assert.equal(pet.dataset.pose,'umbrella-rest');size=parseFloat(pet.style.width);assert.ok(parseFloat(pet.style.top)-size*.48>=11.99);
 life.scene({pose:'theatre'});assert.equal(document.getElementById('hubMomoUmbrella'),null);assert.equal(window.getComputedStyle(pet.querySelector('.momo-arm-right')).visibility,'visible');assert.equal(pet.hasAttribute('data-umbrella'),false);life.scene(null);api.editRecord('tasks');assert.equal(life.umbrella(),false);assert.equal(db.calls.length,0);
});

test('Momo world: visitor chase crosses the viewport, survives scrolling, and yields to a form',async t=>{
 const {api,document,window,db}=await app(t,{adventures:true,storage:adventureStorage({})}),ui=api.hub.adventures,world=api.hub.atmosphere;let clock=window.Date.now();window.Date.now=()=>clock;window.Math.random=()=>0;
 assert.equal(world.invite('fox'),true);clock+=4500;ui.tick();assert.equal(ui.snapshot().active.kind,'chase');assert.equal(api.hub.moments.snapshot().active,null);assert.equal(document.getElementById('hubPet').dataset.pose,'run');const visitor=document.querySelector('.hub-visitor');
 clock+=2500;ui.tick();const first=world.visitorPoint();clock+=3000;ui.tick();const second=world.visitorPoint();assert.ok(Math.abs(first.x-second.x)>150);window.dispatchEvent(new window.Event('scroll'));assert.equal(document.querySelector('.hub-visitor'),visitor);assert.equal(ui.snapshot().active.kind,'chase');
 api.editRecord('tasks');await settle();assert.equal(ui.snapshot().active,null);assert.equal(document.querySelector('.hub-visitor'),null);assert.equal(db.calls.length,0);
});

test('Momo world: fast sprint is finite, bounded, read only and unavailable during Focus or reduced motion',async t=>{
 const {api,document,window,frames,db}=await app(t),ui=api.hub.adventures,pet=document.getElementById('hubPet');const before=JSON.stringify(api.state()),left=pet.style.left;
 assert.equal(ui.sprint(),true);assert.ok(ui.snapshot().active.duration<=1550);assert.equal(pet.dataset.pose,'run');for(const [id,fn]of [...frames]){frames.delete(id);fn(window.performance.now()+1800);}assert.equal(ui.snapshot().active,null);assert.notEqual(pet.style.left,left);assert.ok(parseFloat(pet.style.left)>=12);assert.ok(parseFloat(pet.style.left)+parseFloat(pet.style.width)<=window.innerWidth-12);
 document.body.classList.add('hub-focus');assert.equal(ui.sprint(),false);document.body.classList.remove('hub-focus');window.matchMedia=()=>({matches:true});assert.equal(ui.sprint(),false);assert.equal(JSON.stringify(api.state()),before);assert.equal(db.calls.length,0);
});

test('Momo world: a section stretches visually while the real section, controls and records stay intact',async t=>{
 const {api,document,window,db}=await app(t,{styles:true}),ui=api.hub.adventures,card=document.querySelector('#view .hub-card');assert.ok(card);card.getBoundingClientRect=()=>rect(220,180,300,150);const markup=card.outerHTML,before=JSON.stringify(api.state());
 assert.equal(ui.pullSection(),true);const copyCard=document.getElementById('momoElasticCard');assert.ok(copyCard);assert.equal(copyCard.getAttribute('aria-hidden'),'true');assert.equal(copyCard.hasAttribute('inert'),true);assert.equal(copyCard.querySelector('[data-hub],[data-action],[id]'),null);for(const b of copyCard.querySelectorAll('button'))assert.equal(b.disabled,true);assert.equal(card.outerHTML,markup);assert.equal(JSON.stringify(api.state()),before);
 window.dispatchEvent(new window.Event('scroll'));assert.equal(document.getElementById('momoElasticCard'),null);assert.equal(ui.snapshot().active,null);assert.equal(card.outerHTML,markup);assert.equal(db.calls.length,0);
});

test('Momo world: window watching uses the visible window and cancels when the page moves',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.adventures,card=document.getElementById('hubAtmosphereCard');card.getBoundingClientRect=()=>rect(20,260,180,125);
 assert.equal(ui.watchWindow(),true);assert.equal(document.getElementById('hubPet').dataset.pose,'window-watch');assert.equal(ui.snapshot().active.kind,'window');window.dispatchEvent(new window.Event('scroll'));assert.equal(ui.snapshot().active,null);card.hidden=true;assert.equal(ui.watchWindow(),false);assert.equal(db.calls.length,0);
});

test('Momo world: work nudges use real open items, skip snoozed and completed work, and open the correct task',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.adventures,id=addMainTask(api,document,'Review Momo <img src=x> design'),done=addMainTask(api,document,'Already complete'),snoozed=addMainTask(api,document,'Later please');
 api.mutate(d=>{d.tasks.find(x=>x.id===done).done=true;d.workhub.reminders.push({id:'tasks:'+snoozed,kind:'tasks',recordId:snoozed,until:'2099-01-01',note:'later',updatedAt:new Date().toISOString()});});await settle();const before=JSON.stringify(api.state()),calls=db.calls.length;window.Math.random=()=>0;
 const list=ui.reminderCandidates();assert.ok(list.some(x=>x.id===id));assert.ok(!list.some(x=>x.id===done||x.id===snoozed));assert.equal(ui.nudge(),true);const bubble=document.getElementById('hubPetBubble');assert.match(bubble.textContent,/Haidid/);assert.match(bubble.textContent,/Review Momo <img src=x> design/);assert.equal(bubble.querySelector('img'),null);bubble.querySelector('[data-adventure="open-record"]').click();assert.match(document.getElementById('modal').textContent,/Review Momo <img src=x> design/);api.closeModal();document.body.classList.add('hub-private');assert.equal(ui.nudge(),false);await settle();assert.equal(JSON.stringify(api.state()),before);assert.equal(db.calls.length,calls);
});

test('Momo world: soccer counts requested kicks and cycles through eight surprises without repeats',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.adventures;let clock=window.Date.now();window.Date.now=()=>clock;const before=JSON.stringify(api.state()),seen=[];
 ui.trickForm();let form=document.getElementById('momoJuggleForm');form.elements.namedItem('count').value='3';submitLocal(window,form);assert.equal(ui.snapshot().active.kind,'juggle');clock+=1300;ui.tick();assert.equal(document.getElementById('momoJuggleCount').textContent,'2 / 3');clock+=650;ui.tick();assert.equal(document.getElementById('momoJuggleCount').textContent,'3 / 3');assert.equal(ui.snapshot().active.finalised,true);seen.push(ui.snapshot().finale);assert.equal(document.querySelectorAll('#momoFinale span').length,12);ui.finish();
 for(let i=1;i<8;i++){assert.equal(ui.juggle(i+1),true);clock+=(i+1)*650;ui.tick();seen.push(ui.snapshot().finale);assert.equal(ui.snapshot().active.kicks,i+1);ui.finish();}
 assert.equal(new Set(seen).size,8);assert.equal(ui.snapshot().finalesRemaining,0);assert.equal(ui.juggle(1),true);clock+=650;ui.tick();assert.notEqual(ui.snapshot().finale,seen.at(-1));clock+=5000;ui.tick();assert.equal(ui.snapshot().active,null);assert.equal(document.getElementById('momoSoccerStage'),null);assert.equal(JSON.stringify(api.state()),before);assert.equal(db.calls.length,0);
 for(const invalid of [0,51,2.5,NaN])assert.throws(()=>ui.juggle(invalid),/whole number/);
});

test('Momo world: adventures yield immediately to pickup, Escape, hidden pages and account changes',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.adventures;assert.equal(ui.juggle(50),true);document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(ui.snapshot().active,null);
 assert.equal(ui.juggle(2),true);pointer(window,document.querySelector('#hubPet>button'),'pointerdown',600,300,21);assert.equal(ui.snapshot().active,null);pointer(window,document.querySelector('#hubPet>button'),'pointerup',600,300,21);
 assert.equal(ui.juggle(2),true);Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(ui.snapshot().active,null);assert.equal(document.getElementById('momoSoccerStage'),null);Object.defineProperty(document,'hidden',{configurable:true,value:false});
 assert.equal(ui.juggle(2),true);api.cloud.ready=false;ui.mount();assert.equal(ui.snapshot().active,null);assert.equal(document.getElementById('hubPetBubble').hidden,true);assert.equal(db.calls.length,0);
});

test('Momo Batch B: paused soccer resumes its count, then Escape clears the pause permanently',async t=>{
 const {api,document,window,db}=await app(t,{adventures:true,storage:adventureStorage({chases:false})}),ui=api.hub.adventures;let clock=window.Date.now();window.Date.now=()=>clock;
 assert.equal(ui.juggle(5),true);clock+=1300;ui.tick();assert.equal(ui.snapshot().active.kicks,2);api.editRecord('tasks');await settle();assert.equal(ui.snapshot().active,null);assert.equal(ui.snapshot().bookmark.kind,'juggle');clock+=60000;ui.tick();assert.equal(ui.snapshot().bookmark.elapsed,1300);api.closeModal();document.activeElement?.blur();clock+=5000;api.hub.life.tick();ui.tick();assert.equal(ui.snapshot().active.kind,'juggle');ui.tick();assert.equal(ui.snapshot().active.kicks,2);clock+=650;ui.tick();assert.equal(ui.snapshot().active.kicks,3);document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(ui.snapshot().bookmark,null);assert.equal(document.getElementById('momoSoccerStage'),null);clock+=5000;ui.tick();assert.equal(ui.snapshot().active,null);assert.equal(db.calls.length,0);
});

test('Momo Batch B: return greetings distinguish a short absence and a longer break without moving him',async t=>{
 const {api,document,window,db}=await app(t,{adventures:true,storage:adventureStorage({greetings:true,chases:false})}),ui=api.hub.adventures,pet=document.getElementById('hubPet');let clock=window.Date.now();window.Date.now=()=>clock;clock+=6000;ui.tick();assert.equal(ui.snapshot().greetingKind,'fresh');ui.finish();pet.style.left='300px';pet.style.top='200px';clock+=70000;Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'));clock+=30000;Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new window.Event('visibilitychange'));clock+=5000;api.hub.life.tick();ui.tick();assert.equal(ui.snapshot().greetingKind,'brief-return');assert.equal(ui.snapshot().active.kind,'greeting');assert.equal(pet.style.left,'300px');assert.equal(pet.style.top,'200px');ui.finish();clock+=70000;Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'));clock+=180000;Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new window.Event('visibilitychange'));clock+=5000;api.hub.life.tick();ui.tick();assert.equal(ui.snapshot().greetingKind,'long-return');assert.match(document.getElementById('hubPetBubble').textContent,/Haidid/);assert.equal(db.calls.length,0);
});

test('Momo Batch B: gift friendships remember repeat visitors locally and isolate accounts',async t=>{
 const {api,document,window,db}=await app(t,{adventures:true,storage:adventureStorage({})}),ui=api.hub.adventures,world=api.hub.atmosphere;let clock=window.Date.now();window.Date.now=()=>clock;
 assert.equal(world.invite('squirrel'),true);clock+=4500;ui.tick();assert.equal(ui.snapshot().active.kind,'friend');assert.equal(ui.snapshot().active.role,'gift');clock+=3000;ui.tick();assert.ok(document.getElementById('momoFriendProp').querySelector('svg'));clock+=3000;ui.tick();assert.match(document.getElementById('hubPetBubble').textContent,/Nutmeg/);clock+=5000;ui.tick();assert.match(ui.contextLine(),/Nutmeg.*present/);world.clearVisitor();clock+=5000;api.hub.life.tick();assert.equal(world.invite('squirrel'),true);assert.equal(ui.snapshot().bonds.squirrel,2);const key='mm-tracker.momo-adventures.v1.friends:'+api.cloud.user.id;assert.equal(JSON.parse(window.localStorage.getItem(key)).squirrel,2);api.cloud.user={id:'22222222-2222-4222-8222-222222222222'};ui.mount();assert.deepEqual(copy(ui.snapshot().bonds),{});assert.equal(ui.snapshot().context.length,0);assert.equal(document.querySelector('.hub-visitor'),null);assert.equal(document.getElementById('momoFriendProp'),null);assert.equal(db.calls.length,0);
});

test('Momo Batch B: cheeky visitors borrow a chair, and greeting one ends the scene without a queued chase',async t=>{
 const {api,document,window,db}=await app(t,{adventures:true,storage:adventureStorage({})}),ui=api.hub.adventures,world=api.hub.atmosphere;let clock=window.Date.now();window.Date.now=()=>clock;assert.equal(world.invite('cat'),true);assert.equal(ui.meetVisitor(),true);assert.equal(ui.snapshot().active.role,'seat');clock+=3500;ui.tick();const seat=document.getElementById('momoFriendSeat');assert.ok(seat.querySelector('svg'));assert.equal(seat.getAttribute('aria-hidden'),'true');assert.equal(ui.snapshot().active.phase,'exchange');document.querySelector('.hub-visitor').click();assert.equal(ui.snapshot().active,null);assert.equal(ui.snapshot().bookmark,null);assert.equal(document.getElementById('momoFriendSeat'),null);assert.match(document.getElementById('hubPetBubble').textContent,/Miso/);assert.equal(db.calls.length,0);
});

test('Momo Batch B: weather leaves bounded footprints, theatre leaves and a wipeable foggy window',async t=>{
 const ctx=await app(t,{styles:true,adventures:true,storage:adventureStorage({chases:false})}),{api,document,window,db,frames}=ctx,ui=api.hub.adventures,life=api.hub.life;let clock=window.Date.now();window.Date.now=()=>clock;
 await atmosphereChoices(ctx,{weather:'rain'});assert.equal(life.umbrella(),true);for(const elapsed of [1000,1900,2600,4000])for(const[id,fn]of [...frames]){frames.delete(id);fn(window.performance.now()+elapsed);}assert.equal(ui.snapshot().wet,true);assert.ok(document.querySelectorAll('.momo-wet-footprint').length>0);assert.ok(document.querySelectorAll('.momo-wet-footprint').length<=10);clock+=7000;ui.tick();assert.equal(document.querySelectorAll('.momo-wet-footprint').length,0);life.endUmbrella();await atmosphereChoices(ctx,{weather:'breeze'});life.clearForWork();assert.equal(api.hub.moments.playTheatre(0),true);ui.tick();assert.equal(document.querySelectorAll('#momoTheatre .momo-weather-leaf').length,3);api.hub.moments.finish(false);await atmosphereChoices(ctx,{weather:'fog'});const card=document.getElementById('hubAtmosphereCard');card.getBoundingClientRect=()=>rect(20,260,180,125);assert.equal(ui.watchWindow(),true);clock+=2500;ui.tick();assert.ok(document.getElementById('momoWindowFog'));assert.equal(window.getComputedStyle(document.getElementById('momoWindowFog')).pointerEvents,'none');document.body.classList.add('hub-private');await settle();assert.equal(document.getElementById('momoWindowFog'),null);assert.equal(document.getElementById('momoWeatherEffects'),null);assert.equal(ui.snapshot().bookmark,null);assert.equal(db.calls.length,0);
});

test('Momo Batch B: a visitor chase resumes after a short editing pause without counting another visit',async t=>{
 const {api,document,window,db}=await app(t,{adventures:true,storage:adventureStorage({})}),ui=api.hub.adventures,world=api.hub.atmosphere;let clock=window.Date.now();window.Date.now=()=>clock;assert.equal(world.invite('fox'),true);clock+=4500;ui.tick();assert.equal(ui.snapshot().active.kind,'chase');clock+=2500;ui.tick();api.editRecord('tasks');await settle();assert.equal(ui.snapshot().active,null);assert.equal(ui.snapshot().bookmark.kind,'chase');assert.equal(world.snapshot().visitor,null);api.closeModal();document.activeElement?.blur();clock+=9000;api.hub.life.tick();ui.tick();assert.equal(ui.snapshot().active.kind,'chase');assert.equal(world.snapshot().visitor.kind,'fox');assert.equal(ui.snapshot().bonds.fox,1);assert.equal(ui.snapshot().bookmark,null);assert.equal(db.calls.length,0);
});

test('Momo Batch B: work-area awareness clears a focused control while retaining its value and paused story',async t=>{
 const {api,document,window,db}=await app(t,{adventures:true,storage:adventureStorage({chases:false})}),ui=api.hub.adventures,pet=document.getElementById('hubPet'),field=document.createElement('input');document.getElementById('view').append(field);assert.equal(ui.juggle(5),true);pet.style.left='210px';pet.style.top='210px';field.getBoundingClientRect=()=>rect(220,220,240,40);field.value='Keep this search';field.focus();assert.equal(ui.snapshot().active,null);assert.equal(ui.snapshot().bookmark.kind,'juggle');const p={x:parseFloat(pet.style.left),y:parseFloat(pet.style.top)};assert.equal(window.WorkHubMomoBehaviourEngine.overlaps(p,parseFloat(pet.style.width),field.getBoundingClientRect()),false);assert.equal(field.value,'Keep this search');assert.equal(document.activeElement,field);assert.equal(db.calls.length,0);
});

test('Momo Batch B: nearby click reactions preserve the clicked action, have a cooldown and respect the local switch',async t=>{
 const {api,document,window,db}=await app(t,{adventures:true,storage:adventureStorage({chases:false})}),ui=api.hub.adventures,pet=document.getElementById('hubPet'),button=document.createElement('button');let clock=window.Date.now(),clicks=0;window.Date.now=()=>clock;button.textContent='Open details';button.addEventListener('click',()=>clicks++);document.getElementById('view').append(button);const x=parseFloat(pet.style.left),y=parseFloat(pet.style.top);button.getBoundingClientRect=()=>rect(x-80,y+30,50,35);button.click();assert.equal(clicks,1);assert.equal(ui.snapshot().active.kind,'click');assert.equal(pet.dataset.pose,'click-lean');clock+=1500;ui.tick();assert.equal(ui.snapshot().active,null);assert.equal(ui.clickReaction(button),false);ui.settings();let f=document.getElementById('momoAdventuresForm');f.elements.namedItem('clickReactions').checked=false;submitLocal(window,f);clock+=25000;api.hub.life.tick();assert.equal(ui.clickReaction(button),false);assert.equal(JSON.parse(window.localStorage.getItem('mm-tracker.momo-adventures.v1')).clickReactions,false);assert.equal(db.calls.length,0);
});

test('Momo Batch B: automatic dialogue follows the last real activity while explicit jokes remain available',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.adventures;let clock=window.Date.now();window.Date.now=()=>clock;clock+=120000;ui.remember('pull');api.hub.life.tick();assert.match(document.getElementById('hubPetBubble').textContent,/corner.*back/);assert.match(ui.contextLine(),/stretch test/);for(let i=0;i<30;i++)ui.remember('sprint');assert.equal(ui.snapshot().context.length,12);clock+=121000;assert.equal(ui.contextLine(),'');assert.equal(db.calls.length,0);
});

test('Momo world: a soccer invitation waits for a click before asking for a kick count',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.adventures;assert.equal(ui.offerTrick(),true);assert.equal(document.getElementById('momoJuggleForm'),null);assert.equal(document.querySelector('dialog[open]'),null);document.querySelector('#hubPetBubble [data-adventure="trick"]').click();assert.ok(document.getElementById('momoJuggleForm'));assert.equal(ui.snapshot().active,null);assert.equal(db.calls.length,0);
 const f=document.getElementById('momoJuggleForm');f.elements.namedItem('count').value='2.5';submitLocal(window,f);assert.equal(ui.snapshot().active,null);assert.ok(document.querySelector('dialog[open]'));assert.match(document.getElementById('toast').textContent,/whole number/);
});

test('Momo world: new idle moves finish on time and linked project snoozes suppress work nudges',async t=>{
 const {api,document,window,db}=await app(t),life=api.hub.life;let clock=window.Date.now();window.Date.now=()=>clock;
 for(const kind of ['hop','tiptoe','hand-heart','peek','shadow-box','toe-spin','leaf-catch','pocket-search']){assert.equal(life.gesture(kind),true);assert.equal(document.getElementById('hubPet').dataset.pose,'idle-'+kind);clock+=4100;life.tick();assert.equal(life.gestureState(),null);}
 const id=addMainTask(api,document,'Project work'),project=api.state().projects[0].id;api.mutate(d=>{d.tasks.find(x=>x.id===id).taskType='Project';d.tasks.find(x=>x.id===id).linkId=project;d.workhub.reminders.push({id:'projects:'+project,kind:'projects',recordId:project,until:'2099-01-01',note:'later',updatedAt:new Date().toISOString()});});await settle();const calls=db.calls.length;assert.equal(api.hub.adventures.reminderCandidates().some(x=>x.id===id||x.id===project),false);assert.equal(db.calls.length,calls);
});

async function claimLocation(ctx,values={}){
 const {api,document}=ctx;api.hub.claims.locationForm();const f=document.getElementById('claimLocationForm');fill(f,{name:'Client HQ',address:'Home → Client HQ',oneWayKm:'25',ratePerKm:'.65',journey:'return',...values});api.hub.claims.saveLocation(f);await settle();api.closeModal();return api.state().workhub.claims.locations.at(-1).id;
}
async function claimBooking(ctx,site,{date='2026-10-31',endDate=date,time='09:15',endTime='11:45',values={}}={}){
 const {api,document,window}=ctx;api.openRangeEditor(date,time,'',true);const f=document.getElementById('scheduleForm');fill(f,{date,endDate,time,endTime,text:'Client workshop'});f.elements.namedItem('travelLocationId').value=site;f.elements.namedItem('travelLocationId').dispatchEvent(new window.Event('change',{bubbles:true}));fill(f,values);api.saveRange(f);await settle();return api.state().schedule.find(s=>s.date===date&&s.time===time)?.bookingId;
}
async function claimExpense(ctx,values={},context={}){
 const {api,document}=ctx;api.hub.claims.expenseForm('',context);const f=document.getElementById('claimExpenseForm');fill(f,{date:'2026-10-31',amount:'12.34',description:'PLUS toll',category:'toll',...values});api.hub.claims.saveExpense(f);await settle();return api.state().workhub.claims.expenses.at(-1).id;
}

test('claims: maintain locations through Settings and retain them in cloud and backup without changing prior records',async t=>{
 const ctx=await app(t),{api,document,db}=ctx;assert.ok(document.getElementById('claimSettingsButton'));document.getElementById('claimSettingsButton').click();assert.match(document.getElementById('modalTitle').textContent,/On-site/);api.closeModal();const id=await claimLocation(ctx,{name:'HQ <img src=x>'});assert.equal(api.state().workhub.claims.locations[0].id,id);assert.equal(db.row.document.data.workhub.claims.locations[0].oneWayKm,25);assert.equal(api.parseBackup(api.payload(api.state())).workhub.claims.locations[0].ratePerKm,.65);
 api.hub.claims.settings();assert.match(document.querySelector('.claim-location-row').textContent,/HQ <img src=x>/);assert.equal(document.querySelector('.claim-location-row img'),null);api.hub.claims.locationForm();let f=document.getElementById('claimLocationForm');fill(f,{name:'hq <img src=x>',oneWayKm:'10',ratePerKm:'.7'});const calls=db.calls.length;assert.throws(()=>api.hub.claims.saveLocation(f),/unique name/);await settle();assert.equal(api.state().workhub.claims.locations.length,1);assert.equal(db.calls.length,calls);api.closeModal();
 const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);await settle();assert.equal(reopened.api.state().workhub.claims.locations[0].name,'HQ <img src=x>');assert.equal(api.state().schedule.length,0);
});

test('claims: mileage preview and monthly header count each booking date once across months and both Schedule views',async t=>{
 const ctx=await app(t,{styles:true}),{api,document,window,db}=ctx,site=await claimLocation(ctx);api.openRangeEditor('2026-10-31','09:15','',true);let f=document.getElementById('scheduleForm');fill(f,{endDate:'2026-11-02',endTime:'11:45',text:'Client workshop'});f.elements.namedItem('travelLocationId').value=site;f.elements.namedItem('travelLocationId').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(f.elements.namedItem('location').value,'Client site');assert.match(document.querySelector('[data-claim-preview]').textContent,/RM 97\.50 for 3 booked dates/);api.saveRange(f);await settle();assert.equal(api.state().schedule.length,9);assert.equal(api.hub.claims.summary().totalCents,3250);api.showTab('schedule');assert.match(document.getElementById('claimMonthSummary').textContent,/RM 32\.50/);assert.equal(document.querySelectorAll('#claimMonthSummary').length,1);assert.ok(document.querySelector('.claim-booking-badge'));const calls=db.calls.length;
 await api.action(document.querySelector('[data-action="schedule-day"][data-date="2026-10-31"]'));await api.action(document.querySelector('[data-action="schedule-layout"][data-layout="grid"]'));assert.match(document.getElementById('claimMonthSummary').textContent,/RM 32\.50/);assert.equal(document.querySelectorAll('#claimExpenseLedger').length,1);api.setMonth('2026-11');api.showTab('schedule');assert.equal(api.hub.claims.summary().totalCents,6500);assert.match(document.getElementById('claimMonthSummary').textContent,/November 2026/);await settle();assert.equal(db.calls.length,calls);
});

test('claims: historical rate snapshots survive mapping edits, latest mapping is explicit, and archives retain history',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,site=await claimLocation(ctx);await claimBooking(ctx,site);api.hub.claims.locationForm(site);let f=document.getElementById('claimLocationForm');fill(f,{ratePerKm:'.9',name:'HQ renamed'});api.hub.claims.saveLocation(f);await settle();api.closeModal();assert.equal(api.hub.claims.summary().mileageCents,3250);
 api.openRangeEditor('2026-10-31','09:15');f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('travelRate').value,'0.65');assert.equal(f.elements.namedItem('travelLocationName').value,'Client HQ');f.elements.namedItem('text').value='Updated notes';api.saveRange(f);await settle();assert.equal(api.hub.claims.summary().mileageCents,3250);
 api.openRangeEditor('2026-10-31','09:15');f=document.getElementById('scheduleForm');document.querySelector('[data-claim="latest-route"]').click();assert.equal(f.elements.namedItem('travelRate').value,'0.9');api.saveRange(f);await settle();assert.equal(api.hub.claims.summary().mileageCents,4500);assert.equal(api.state().schedule[0].travel.locationName,'HQ renamed');
 api.hub.claims.settings();document.querySelector('[data-claim="archive-location"]').click();await settle();api.closeModal();assert.equal(api.state().workhub.claims.locations[0].archived,true);api.openRangeEditor('2026-10-30','09:00','',true);assert.equal([...document.getElementById('travelLocationId').options].some(o=>o.value===site),false);api.closeModal();api.openRangeEditor('2026-10-31','09:15');assert.equal(document.getElementById('travelLocationId').value,site);api.closeModal();assert.equal(api.hub.claims.summary().mileageCents,4500);
});

test('claims: a project visit retains mileage through project-calendar date edits and changing to Office removes it',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,site=await claimLocation(ctx);api.openRangeEditor('2026-10-31','09:00','',true);let f=document.getElementById('scheduleForm');f.elements.namedItem('travelLocationId').value=site;f.elements.namedItem('travelLocationId').dispatchEvent(new window.Event('change',{bubbles:true}));f.elements.namedItem('text').value='Project workshop';f.elements.namedItem('kind').value='project';f.elements.namedItem('kind').dispatchEvent(new window.Event('change',{bubbles:true}));f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('travelLocationId').value,site);assert.equal(f.elements.namedItem('travelRate').value,'0.65');api.saveRange(f);await settle();const plan=api.state().projectPlans.at(-1);assert.ok(plan);assert.equal(api.hub.claims.summary().totalCents,3250);
 api.editPlan(plan.id);f=document.getElementById('planForm');fill(f,{date:'2026-11-02',endDate:'2026-11-02'});api.savePlan(f);await settle();api.setMonth('2026-11');assert.equal(api.hub.claims.summary().totalCents,3250);assert.equal(api.state().schedule[0].travel.ratePerKm,.65);
 api.editPlan(plan.id);f=document.getElementById('planForm');f.elements.namedItem('location').value='Office';api.savePlan(f);await settle();assert.equal(api.hub.claims.summary().totalCents,0);assert.equal(api.state().schedule[0].travel,undefined);api.validate(api.state());
});

test('claims: tolls, parking and excluded expenses total correctly, and deleted expenses can be restored',async t=>{
 const ctx=await app(t),{api,document,db}=ctx,site=await claimLocation(ctx);await claimBooking(ctx,site);const toll=await claimExpense(ctx),park=await claimExpense(ctx,{category:'parking',amount:'5.50',description:'Parking'});await claimExpense(ctx,{category:'meals',amount:'10',description:'Personal coffee',claimable:false});api.showTab('schedule');let m=api.hub.claims.summary();assert.equal(m.mileageCents,3250);assert.equal(m.tollCents,1234);assert.equal(m.otherCents,550);assert.equal(m.totalCents,5034);assert.equal(m.excludedCents,1000);assert.match(document.getElementById('claimMonthSummary').textContent,/RM 50\.34/);assert.equal(document.querySelectorAll('.claim-expense-row').length,3);
 document.querySelector('[data-claim="delete-expense"][data-id="'+park+'"]').click();await settle();assert.equal(api.hub.claims.summary().totalCents,4484);document.querySelector('[data-claim="undo-delete"]').click();await settle();assert.equal(api.hub.claims.summary().totalCents,5034);assert.ok(api.state().workhub.claims.expenses.some(e=>e.id===toll));const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);reopened.api.setMonth('2026-10');assert.equal(reopened.api.hub.claims.summary().totalCents,5034);
});

test('claims: booking details link tolls to the visit and deleting the booking preserves receipts',async t=>{
 const ctx=await app(t),{api,document}=ctx,site=await claimLocation(ctx),booking=await claimBooking(ctx,site);api.viewBooking('2026-10-31','09:15');assert.match(document.querySelector('.claim-booking-details').textContent,/RM 32\.50/);document.querySelector('[data-claim="add-expense"]').click();let f=document.getElementById('claimExpenseForm');assert.equal(f.dataset.booking,booking);assert.equal(f.elements.namedItem('locationId').value,site);fill(f,{amount:'8.40',description:'TnG toll',reference:'TX123'});api.hub.claims.saveExpense(f);await settle();api.openRangeEditor('2026-10-31','09:15');api.mutate(d=>{d.schedule=d.schedule.filter(s=>s.bookingId!==booking);});api.closeModal();await settle();assert.equal(api.state().schedule.length,0);assert.equal(api.state().workhub.claims.expenses.length,1);assert.equal(api.state().workhub.claims.expenses[0].reference,'TX123');assert.equal(api.hub.claims.summary().totalCents,840);api.validate(api.state());
});

test('claims: duplicate visit guidance allows excluding a second booking and leave cannot carry mileage',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,site=await claimLocation(ctx);await claimBooking(ctx,site,{endTime:'10:00'});api.openRangeEditor('2026-10-31','13:00','',true);let f=document.getElementById('scheduleForm');f.elements.namedItem('text').value='Afternoon follow-up';f.elements.namedItem('travelLocationId').value=site;f.elements.namedItem('travelLocationId').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(document.querySelector('[data-claim-duplicate]').hidden,false);assert.match(document.querySelector('[data-claim-duplicate]').textContent,/same visit/);f.elements.namedItem('travelClaimable').checked=false;f.elements.namedItem('travelVisits').value='2';document.querySelector('[data-claim="latest-route"]').click();assert.equal(f.elements.namedItem('travelClaimable').checked,false);assert.equal(f.elements.namedItem('travelVisits').value,'2');api.saveRange(f);await settle();assert.equal(api.hub.claims.summary().totalCents,3250);
 api.openRangeEditor('2026-10-30','09:00','',true);f=document.getElementById('scheduleForm');f.elements.namedItem('travelLocationId').value=site;f.elements.namedItem('travelLocationId').dispatchEvent(new window.Event('change',{bubbles:true}));f.elements.namedItem('kind').value='annual-leave';f.elements.namedItem('kind').dispatchEvent(new window.Event('change',{bubbles:true}));f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('travelLocationId'),null);api.saveRange(f);await settle();assert.ok(api.state().schedule.filter(s=>s.kind==='annual-leave').every(s=>!s.travel));assert.equal(api.hub.claims.summary().totalCents,3250);
});

test('claims: invalid inputs and backups fail without losing saved records or opening navigation writes',async t=>{
 const ctx=await app(t),{api,document,db}=ctx,site=await claimLocation(ctx);api.openRangeEditor('2026-10-31','09:00','',true);let f=document.getElementById('scheduleForm');f.elements.namedItem('travelLocationId').value=site;f.elements.namedItem('travelLocationId').dispatchEvent(new ctx.window.Event('change',{bubbles:true}));f.elements.namedItem('travelRate').value='';assert.throws(()=>api.saveRange(f),/distance, rate/);assert.equal(api.state().schedule.length,0);api.closeModal();api.hub.claims.expenseForm();f=document.getElementById('claimExpenseForm');fill(f,{date:'2026-10-31',amount:'-1',description:'Bad expense'});assert.throws(()=>api.hub.claims.saveExpense(f),/positive expense amount/);assert.equal(api.state().workhub.claims.expenses.length,0);api.closeModal();
 const invalid=copy(api.state());invalid.workhub.claims.expenses=[{id:'bad'}];assert.throws(()=>api.parseBackup(api.payload(invalid)),/expense/);await settle();const calls=db.calls.length;api.showTab('schedule');api.hub.claims.review();api.closeModal();api.hub.claims.settings();api.closeModal();api.setMonth('2026-11');api.showTab('schedule');await settle();assert.equal(db.calls.length,calls);assert.equal(api.hub.claims.summary().totalCents,0);
});

test('claims: the monthly CSV download and expense pages use the selected month',async t=>{
 const {api,document,window}=await app(t);api.setMonth('2026-10');api.mutate(d=>{for(let i=0;i<14;i++)d.workhub.claims.expenses.push({id:'e'+i,date:'2026-10-31',category:'toll',amountCents:100,description:'Toll '+i,payment:'Touch ’n Go',claimable:true,locationId:'',locationName:'',bookingId:'',reference:'',notes:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});});await settle();api.showTab('schedule');assert.equal(document.querySelectorAll('.claim-expense-row').length,12);document.querySelector('[data-claim="page"][data-step="1"]').click();assert.equal(document.querySelectorAll('.claim-expense-row').length,2);let blob,filename;window.URL.createObjectURL=b=>{blob=b;return'blob:claims';};window.URL.revokeObjectURL=()=>{};window.HTMLAnchorElement.prototype.click=function(){filename=this.download;};document.querySelector('[data-claim="export"]').click();assert.equal(filename,'claims-2026-10.csv');assert.match(await blob.text(),/Claimable total.*14\.00/);api.setMonth('2026-11');api.showTab('schedule');assert.equal(document.querySelectorAll('.claim-expense-row').length,0);assert.equal(api.hub.claims.summary().totalCents,0);
});

function addRecipientCompany(ctx,name='Client A',notes=''){
 const {api,document}=ctx;api.hub.recipients.companyForm();const form=document.getElementById('recipientCompanyForm');fill(form,{companyName:name,companyNotes:notes});api.hub.recipients.saveCompany(form);return api.state().workhub.recipients.companies.at(-1).id;
}
function addRecipient(ctx,email,name='',role='to',enabled=true){
 const {api,document}=ctx;api.hub.recipients.contactForm();const form=document.getElementById('recipientContactForm');fill(form,{email,contactName:name,role,enabled});api.hub.recipients.saveContact(form);return api.state().workhub.recipients.companies.find(c=>c.contacts.some(r=>r.email===email)).contacts.find(r=>r.email===email).id;
}

test('recipients: settings and company shortcuts maintain an escaped directory independently of project records',async t=>{
 const ctx=await app(t,{styles:true}),{api,document,window,db}=ctx,ui=api.hub.recipients;
 document.getElementById('recipientSettingsButton').click();assert.match(document.getElementById('recipientDirectory').textContent,/Create a company list/);assert.equal(document.getElementById('modal').classList.contains('hub-drawer'),false);
 addCompany(api,document,'Farms <img src=x>');api.showCompanies();const before=copy(api.state().projectCompanies);document.querySelector('.company-focus [data-recipient="company-shortcut"]').click();let f=document.getElementById('recipientCompanyForm');assert.equal(f.elements.namedItem('companyName').value,'Farms <img src=x>');submitLocal(window,f);await settle();assert.equal(api.state().workhub.recipients.companies.length,1);assert.equal(document.querySelector('#recipientDirectory img'),null);assert.equal(document.querySelector('.recipient-company-heading h3').textContent,'Farms <img src=x>');assert.deepEqual(copy(api.state().projectCompanies),before);
 const id=api.state().workhub.recipients.companies[0].id;ui.companyForm(id);f=document.getElementById('recipientCompanyForm');fill(f,{companyNotes:'Team <script>bad()</script>'});ui.saveCompany(f);assert.equal(document.querySelector('#recipientDirectory script'),null);assert.match(document.querySelector('.recipient-company-heading p').textContent,/<script>/);
 ui.companyForm();f=document.getElementById('recipientCompanyForm');fill(f,{companyName:'  farms <img src=x>  '});submitLocal(window,f);assert.equal(document.getElementById('recipientCompanyForm'),f);assert.match(f.querySelector('[data-recipient-error]').textContent,/already exists/);assert.equal(api.state().workhub.recipients.companies.length,1);api.closeModal();api.showCompanies();document.querySelector('.company-focus [data-recipient="company-shortcut"]').click();assert.equal(document.getElementById('recipientCompanyForm'),null);assert.equal(document.querySelector('.recipient-company-heading h3').textContent,'Farms <img src=x>');
 await settle();const calls=db.calls.length;api.closeModal();api.showTab('snippets');document.querySelector('.wl-hero [data-recipient="open"]').click();await settle();assert.equal(db.calls.length,calls);
});

test('recipients: edits, groups and exclusion switches validate before saving',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,ui=api.hub.recipients;const companyId=addRecipientCompany(ctx),id=addRecipient(ctx,'owner@example.com','Owner');addRecipient(ctx,'cc@example.com','CC person','cc');addRecipient(ctx,'private@example.com','Private','bcc',false);
 assert.equal(document.querySelectorAll('.recipient-contact').length,3);assert.equal(document.getElementById('recipientCopyPreview').value,'owner@example.com; cc@example.com');
 ui.contactForm(id);let f=document.getElementById('recipientContactForm');fill(f,{email:'new.owner@example.com',contactName:'Owner <img src=x>',role:'bcc'});submitLocal(window,f);assert.equal(document.querySelector('.recipient-contact img'),null);assert.equal(api.state().workhub.recipients.companies[0].contacts[0].email,'new.owner@example.com');
 const toggle=[...document.querySelectorAll('[data-recipient-toggle]')].find(el=>el.dataset.recipientToggle===id);toggle.checked=false;toggle.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(api.state().workhub.recipients.companies[0].contacts[0].enabled,false);assert.equal(document.getElementById('recipientCopyPreview').value,'cc@example.com');assert.equal(document.activeElement.dataset.recipientToggle,id);
 ui.contactForm();f=document.getElementById('recipientContactForm');fill(f,{email:'CC@EXAMPLE.COM',role:'to'});assert.throws(()=>ui.saveContact(f),/already exists/);assert.equal(api.state().workhub.recipients.companies[0].contacts.length,3);fill(f,{email:'bad@@example.com'});assert.throws(()=>ui.saveContact(f),/valid email/);assert.equal(document.getElementById('recipientContactForm'),f);
 api.validate(api.state());assert.equal(api.state().workhub.recipients.companies[0].id,companyId);
});

test('recipients: bulk additions preview duplicates, retain saved groups and reject a mixed invalid list atomically',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,ui=api.hub.recipients;addRecipientCompany(ctx);addRecipient(ctx,'kept@example.com','Kept','bcc',false);ui.bulkForm();let f=document.getElementById('recipientBulkForm');fill(f,{role:'cc',emails:'KEPT@EXAMPLE.COM; "Doe, Jo" <jo@example.com>\nteam@example.com; JO@example.com'});f.elements.namedItem('emails').dispatchEvent(new window.Event('input',{bubbles:true}));assert.match(document.getElementById('recipientBulkPreview').textContent,/2 new · 2 duplicates/);submitLocal(window,f);const contacts=api.state().workhub.recipients.companies[0].contacts;assert.equal(contacts.length,3);assert.equal(contacts[0].enabled,false);assert.equal(contacts[0].role,'bcc');assert.equal(contacts[1].name,'Doe, Jo');assert.equal(contacts[1].role,'cc');
 ui.bulkForm();f=document.getElementById('recipientBulkForm');fill(f,{emails:'another@example.com; not-an-email'});submitLocal(window,f);assert.equal(document.getElementById('recipientBulkForm'),f);assert.match(f.querySelector('[data-recipient-error]').textContent,/entry 2/);assert.equal(api.state().workhub.recipients.companies[0].contacts.length,3);
 fill(f,{emails:'jo@example.com'});assert.throws(()=>ui.saveBulk(f),/already in/);assert.equal(api.state().workhub.recipients.companies[0].contacts.length,3);
});

test('recipients: copying uses the chosen company, enabled group and separator even when rows are filtered',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,ui=api.hub.recipients,copies=[];Object.defineProperty(window.navigator,'clipboard',{configurable:true,value:{writeText:async text=>copies.push(text)}});
 const a=addRecipientCompany(ctx);addRecipient(ctx,'to@example.com','Owner');addRecipient(ctx,'cc@example.com','Copy','cc');addRecipient(ctx,'bcc@example.com','Private','bcc');addRecipient(ctx,'excluded@example.com','','to',false);const b=addRecipientCompany(ctx,'Client B');addRecipient(ctx,'b@example.com');ui.open(a);await settle();const calls=db.calls.length;
 const search=document.getElementById('recipientContactSearch');search.value='Owner';search.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(document.querySelectorAll('.recipient-contact').length,1);document.getElementById('recipientCopyButton').click();await settle();assert.equal(copies.at(-1),'to@example.com; cc@example.com; bcc@example.com');
 document.querySelector('[data-recipient="choose-role"][data-role="cc"]').click();document.getElementById('recipientCopyButton').click();await settle();assert.equal(copies.at(-1),'cc@example.com');document.querySelector('[data-recipient="choose-role"][data-role="all"]').click();const separator=document.getElementById('recipientSeparator');separator.value='comma';separator.dispatchEvent(new window.Event('change',{bubbles:true}));document.getElementById('recipientCopyButton').click();await settle();assert.equal(copies.at(-1),'to@example.com, cc@example.com, bcc@example.com');separator.value='lines';separator.dispatchEvent(new window.Event('change',{bubbles:true}));document.getElementById('recipientCopyButton').click();await settle();assert.equal(copies.at(-1),'to@example.com\ncc@example.com\nbcc@example.com');
 document.querySelector('[data-recipient="quick-copy"][data-id="'+b+'"]').click();await settle();assert.equal(copies.at(-1),'b@example.com');assert.equal(document.querySelector('.recipient-company-heading h3').textContent,'Client B');document.querySelector('[data-recipient="choose-role"][data-role="bcc"]').click();assert.equal(document.getElementById('recipientCopyButton').disabled,true);assert.equal(document.getElementById('recipientCopyPreview').value,'');assert.equal(db.calls.length,calls);
});

test('recipients: blocked clipboard offers selected plain addresses and an old async copy cannot update a new screen',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,ui=api.hub.recipients;const a=addRecipientCompany(ctx);addRecipient(ctx,'a@example.com');await ui.copyAddresses();let preview=document.getElementById('recipientCopyPreview');assert.equal(document.activeElement,preview);assert.equal(preview.selectionStart,0);assert.equal(preview.selectionEnd,preview.value.length);assert.match(document.getElementById('recipientCopyStatus').textContent,/Automatic copying is unavailable/);
 Object.defineProperty(window.navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied');}}});await ui.copyAddresses();assert.match(document.getElementById('recipientCopyStatus').textContent,/Ctrl\+C/);
 let finish;window.navigator.clipboard.writeText=()=>new Promise(resolve=>{finish=resolve;});const pending=ui.copyAddresses();const b=addRecipientCompany(ctx,'Client B');addRecipient(ctx,'b@example.com');finish();await pending;assert.equal(document.querySelector('.recipient-company-heading h3').textContent,'Client B');assert.equal(document.getElementById('recipientCopyStatus').textContent,'');assert.equal(api.state().workhub.recipients.companies.length,2);assert.notEqual(a,b);
});

test('recipients: removal and undo restore contacts and company lists without changing project companies',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,ui=api.hub.recipients;addCompany(api,document,'Client A');const a=addRecipientCompany(ctx),r=addRecipient(ctx,'owner@example.com');await ui.handle({dataset:{recipient:'delete-contact',id:r}});assert.equal(api.state().workhub.recipients.companies[0].contacts.length,0);document.querySelector('[data-recipient="undo"]').click();await settle();assert.equal(api.state().workhub.recipients.companies[0].contacts[0].id,r);
 window.confirm=()=>false;await ui.handle({dataset:{recipient:'delete-company',id:a}});assert.equal(api.state().workhub.recipients.companies.length,1);window.confirm=()=>true;await ui.handle({dataset:{recipient:'delete-company',id:a}});assert.equal(api.state().workhub.recipients.companies.length,0);assert.equal(api.state().projectCompanies.length,1);await ui.handle({dataset:{recipient:'undo'}});assert.equal(api.state().workhub.recipients.companies[0].contacts[0].email,'owner@example.com');
 await ui.handle({dataset:{recipient:'delete-contact',id:r}});addRecipient(ctx,'owner@example.com');await assert.rejects(ui.handle({dataset:{recipient:'undo'}}),/already exists/);assert.equal(api.state().workhub.recipients.companies[0].contacts.length,1);
});

test('recipients: account saves, reopened records and JSON backups retain company lists and reject malformed restores',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,ui=api.hub.recipients;const a=addRecipientCompany(ctx,'Client A','Team notes');addRecipient(ctx,'owner@example.com','Owner');addRecipient(ctx,'hidden@example.com','','bcc',false);await settle();assert.deepEqual(db.row.document.data.workhub.recipients,copy(api.state().workhub.recipients));
 const restored=api.parseBackup(api.payload(api.state()));assert.deepEqual(copy(restored.workhub.recipients),copy(api.state().workhub.recipients));const bad=copy(restored);bad.workhub.recipients.companies[0].contacts[0].email='bad@@example.com';assert.throws(()=>api.parseBackup(api.payload(bad)),/recipient/);
 const second=await app(t,{remote:copy(db.row),login:false});await second.api.loadCloud(sessionUser);await settle();second.api.hub.recipients.open(a);assert.equal(second.document.getElementById('recipientCopyPreview').value,'owner@example.com');assert.equal(second.api.state().workhub.recipients.companies[0].contacts[1].enabled,false);
 ui.contactForm();const stale=document.getElementById('recipientContactForm');fill(stale,{email:'stale@example.com'});api.cloud.ready=false;api.cloud.user=null;api.showTab('home');assert.equal(document.getElementById('modal').open,false);assert.equal(document.getElementById('recipientSettingsButton').hidden,true);assert.throws(()=>ui.saveContact(stale),/Sign in/);api.login();assert.throws(()=>ui.saveContact(stale),/Reopen/);assert.equal(api.state().workhub.recipients.companies[0].contacts.length,2);
});

test('grouped Settings: five sections keep all existing actions and section changes stay open',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.settingsPanel,menu=document.getElementById('settingsMenu');api.hub.chromeUX.open();await settle();
 assert.equal(document.querySelectorAll('#settingsCategories [role="tab"]').length,5);assert.deepEqual(copy(ui.snapshot().groups.map(g=>[g.id,g.count])),[['workspace',3],['work',8],['companion',4],['data',4],['account',2]]);assert.equal(document.querySelectorAll('.settings-group:not([hidden])').length,1);assert.equal(document.querySelector('.settings-group:not([hidden])').id,'settingsGroup-workspace');assert.equal(document.querySelectorAll('.settings-option').length,21);assert.equal(document.querySelector('#hubSettingsAppearance button'),null);
 for(const [id,group]of [['hubSettingsHeader','workspace'],['claimSettingsButton','work'],['recipientSettingsButton','work'],['momoAdventureSettings','companion'],['soundscapeSettings','companion'],['backupButton','data'],['cloudSignOut','account']])assert.equal(document.getElementById(id).closest('.settings-group').id,'settingsGroup-'+group);
 document.querySelector('[data-settings-group="work"]').click();assert.equal(menu.open,true);assert.equal(ui.snapshot().active,'work');document.getElementById('recipientSettingsButton').click();await settle();assert.equal(menu.open,false);assert.ok(document.getElementById('recipientDirectory'));api.closeModal();api.hub.chromeUX.open();document.querySelector('[data-settings-group="companion"]').click();document.getElementById('soundscapeSettings').click();await settle();assert.equal(menu.open,false);assert.ok(document.querySelector('#modalBody .soundscape-room'));assert.equal(db.calls.length,0);
});

test('grouped Settings: search finds options across sections, escapes input and clears without closing',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.settingsPanel,menu=document.getElementById('settingsMenu'),search=document.getElementById('settingsSearch');api.hub.chromeUX.open();await settle();const find=value=>{search.value=value;search.dispatchEvent(new window.Event('input',{bubbles:true}));};
 find('email');assert.equal(document.getElementById('settingsCategories').hidden,true);assert.equal(document.getElementById('recipientSettingsButton').closest('.settings-entry').hidden,false);assert.equal(document.getElementById('claimSettingsButton').closest('.settings-entry').hidden,true);assert.equal(document.querySelectorAll('.settings-group:not([hidden])').length,2);assert.equal(document.getElementById('settingsGroup-work').getAttribute('role'),'region');
 find('  cost KM  ');assert.equal(document.getElementById('claimSettingsButton').closest('.settings-entry').hidden,false);assert.equal(document.querySelectorAll('.settings-entry:not([hidden])').length,1);find('<img src=x onerror=alert(1)>');assert.equal(document.getElementById('settingsNoResults').hidden,false);assert.equal(document.querySelector('#settingsSections img'),null);
 document.getElementById('settingsSearchClear').click();assert.equal(menu.open,true);assert.equal(search.value,'');assert.equal(document.activeElement,search);assert.equal(ui.snapshot().active,'workspace');assert.equal(document.getElementById('settingsGroup-workspace').getAttribute('role'),'tabpanel');assert.equal(document.getElementById('settingsCategories').hidden,false);await settle();assert.equal(db.calls.length,0);
});

test('grouped Settings: keyboard section navigation, narrow-screen orientation and Escape preserve focus',async t=>{
 const {api,document,window,db}=await app(t),menu=document.getElementById('settingsMenu'),first=document.getElementById('settingsTab-workspace');api.hub.chromeUX.open();await settle();first.focus();first.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));assert.equal(document.activeElement.id,'settingsTab-work');assert.equal(document.getElementById('settingsTab-work').getAttribute('aria-selected'),'true');assert.equal(menu.open,true);
 document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));assert.equal(document.activeElement.id,'settingsTab-account');document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));assert.equal(document.activeElement,first);assert.equal(document.querySelectorAll('#settingsCategories [tabindex="0"]').length,1);
 Object.defineProperty(window,'innerWidth',{configurable:true,value:375});window.dispatchEvent(new window.Event('resize'));assert.equal(document.getElementById('settingsCategories').getAttribute('aria-orientation'),'horizontal');first.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));assert.equal(document.activeElement.id,'settingsTab-account');document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(menu.open,false);assert.equal(document.activeElement,menu.querySelector('summary'));assert.equal(db.calls.length,0);
});

test('grouped Settings: later launchers and sync visibility update without cloning controls or writing records',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.settingsPanel,button=document.createElement('button');button.id='customWorkspaceSetting';button.textContent='Custom workspace option';let clicked=0;button.addEventListener('click',()=>clicked++);document.getElementById('hubSettingsAppearance').append(button);await settle();assert.equal(document.querySelector('#settingsItems-workspace #customWorkspaceSetting'),button);assert.equal(ui.snapshot().groups.find(g=>g.id==='workspace').count,4);for(let i=0;i<3;i++)ui.mount();assert.equal(document.querySelectorAll('#customWorkspaceSetting').length,1);
 api.hub.chromeUX.open();button.click();assert.equal(clicked,1);assert.equal(document.getElementById('settingsMenu').open,false);button.hidden=true;await settle();assert.equal(button.closest('.settings-entry').hidden,true);assert.equal(ui.snapshot().groups.find(g=>g.id==='workspace').count,3);
 api.cloud.conflict=true;api.cloud.status='Newer records need review';api.notice();await settle();assert.equal(document.getElementById('cloudRetry').closest('.settings-entry').hidden,true);assert.equal(document.getElementById('cloudReload').closest('.settings-entry').hidden,false);assert.equal(document.getElementById('restoreButton').disabled,true);assert.equal(ui.snapshot().groups.find(g=>g.id==='data').count,3);assert.match(document.getElementById('settingsSaveStatus').textContent,/review/);assert.equal(db.calls.length,0);
});

test('grouped Settings: sign-out clears the search and hides account-owned options while sign-in remains available',async t=>{
 const {api,document,window,db}=await app(t),search=document.getElementById('settingsSearch');search.value='company';search.dispatchEvent(new window.Event('input',{bubbles:true}));api.cloud.ready=false;api.cloud.user=null;api.notice();api.showTab('home');await settle();assert.equal(search.value,'');assert.equal(document.getElementById('settingsTab-work').hidden,true);assert.equal(document.getElementById('settingsTab-companion').hidden,true);assert.equal(document.getElementById('hubSettingsHeader').closest('.settings-entry').hidden,true);assert.equal(document.getElementById('recipientSettingsButton').closest('.settings-entry').hidden,true);assert.equal(document.getElementById('cloudAccountButton').hidden,false);assert.equal(document.getElementById('cloudAccountButton').textContent,'Sign in');assert.equal(api.hub.settingsPanel.snapshot().active,'account');
 api.login();await settle();assert.equal(document.getElementById('settingsTab-work').hidden,false);assert.equal(document.getElementById('hubSettingsHeader').closest('.settings-entry').hidden,false);assert.equal(api.hub.settingsPanel.snapshot().active,'workspace');assert.equal(db.calls.length,0);
});

function tngFixtureRow(patch={}){return {id:'t1',transactionNo:'0001',section:'offline',page:1,width:595,height:842,date:'2026-10-09',postedDate:'2026-10-10',time:'09:00:00',type:'Fare Usage - Toll/Bus',sector:'TOLL',entry:'Demo entry',exit:'Demo exit',amountCents:166,kind:'toll',category:'toll',rect:{x:20,y:60,w:555,h:30},originalRect:{x:20,y:60,w:555,h:30},headerRect:{x:20,y:20,w:555,h:30},errors:[],manual:false,selected:false,bookingKey:'',description:'Demo toll',...patch};}
function mockTngReader(window,rows){window.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});let closed=0;const result={rows:copy(rows),warnings:[],source:{fileHash:'a'.repeat(64),cardKey:'b'.repeat(64),fileName:'fixture.pdf',pages:1},close(){closed++;},renderPage:async()=>{const canvas=window.document.createElement('canvas');canvas.width=1190;canvas.height=1684;return canvas;}};window.WorkHubTngFiles.read=async()=>result;return{result,closed:()=>closed};}

test('TNG desk: date filtering, on-site suggestions and confirmed saves update claims exactly once',async t=>{
 const {api,document,window,db}=await app(t);api.setMonth('2026-10');addBooking(api,document,'09:00','10:00',{date:'2026-10-09'});api.mutate(d=>d.schedule.forEach(s=>s.location='Client site'));await settle();api.showTab('schedule');assert.ok(document.querySelector('[data-tng="open"]'));const ui=api.hub.tng;ui.open();mockTngReader(window,[tngFixtureRow(),tngFixtureRow({id:'reload',transactionNo:'0002',kind:'reload',amountCents:2000}),tngFixtureRow({id:'other',transactionNo:'0003',date:'2026-10-08',postedDate:'2026-10-08',amountCents:250})]);const calls=db.calls.length;await ui.loadFile({name:'fixture.pdf'});ui.matchVisits();assert.equal(ui.snapshot().selected,1);assert.equal(ui.snapshot().rows[0].bookingKey,api.state().schedule[0].bookingId);assert.equal(db.calls.length,calls);ui.save();await settle();assert.equal(db.calls.length,calls+1);assert.equal(api.hub.claims.summary().tollCents,166);assert.equal(api.state().workhub.claims.expenses.length,1);assert.equal(ui.snapshot().selected,0);assert.equal(ui.snapshot().rows[0].selected,true,'Keep saved PDF rows available for evidence.');assert.throws(()=>ui.save(),/at least one/);assert.equal(api.state().workhub.claims.expenses.length,1);const restored=api.parseBackup(api.payload(api.state()));assert.equal(restored.workhub.claims.expenses[0].tngSource.transactionNo,'0001');assert.ok(document.querySelector('[data-tng="open-source"]'));
 const basis=document.getElementById('tngBasis');basis.value='posted';basis.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(ui.snapshot().basis,'posted');ui.matchVisits();assert.equal(ui.snapshot().selected,0);
});
test('TNG wallet desk: new source sections survive save and backup while non-expense wallet rows remain excluded',async t=>{
 const {api,document,window}=await app(t),ui=api.hub.tng;api.showTab('schedule');ui.open();
 const wallet=tngFixtureRow({section:'ewallet',page:2,headerPage:1,width:842,height:595,date:'2026-10-08',postedDate:'2026-10-09',type:'RFID Payment'});
 mockTngReader(window,[wallet,...['reload','credit','transfer','unsuccessful','unsupported'].map((kind,n)=>tngFixtureRow({id:'blocked'+n,transactionNo:'EXCLUDED'+n,section:'ewallet',kind,errors:[]}))]);
 await ui.loadFile({name:'fictional-wallet.pdf'});assert.equal(document.querySelectorAll('[data-tng-select]:disabled').length,5);assert.match(document.getElementById('tngStudio').textContent,/Statement.*posted date/);assert.match(document.getElementById('tngStudio').textContent,/Transfer · excluded/);
 document.querySelector('[data-tng="select-visible"]').click();assert.equal(ui.snapshot().selected,1);ui.save();await settle();
 const expense=api.state().workhub.claims.expenses[0];assert.equal(expense.date,'2026-10-08');assert.equal(expense.tngSource.section,'ewallet');assert.equal(expense.tngSource.headerPage,1);assert.equal(api.state().workhub.claims.expenses.length,1);
 const restored=api.parseBackup(api.payload(api.state()));assert.equal(restored.workhub.claims.expenses[0].tngSource.headerPage,1);assert.equal(restored.workhub.claims.expenses[0].tngSource.postedDate,'2026-10-09');
});

test('TNG desk: manual expenses are explicit drafts and existing source metadata survives ledger edits',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.tng;api.setMonth('2026-10');api.showTab('schedule');ui.open();document.querySelector('[data-tng="manual"]').click();let f=document.getElementById('tngRowForm');fill(f,{date:'2026-10-09',postedDate:'2026-10-09',amount:'4.50',description:'Parking after workshop',category:'parking',notes:'Manual receipt'});ui.rowForm(f);await settle();assert.equal(api.state().workhub.claims.expenses.length,0);ui.save();await settle();assert.equal(api.hub.claims.summary().otherCents,450);assert.equal(api.state().workhub.claims.expenses[0].tngSource,undefined);assert.equal(ui.snapshot().selected,0);
 mockTngReader(window,[tngFixtureRow()]);await ui.loadFile({name:'fixture.pdf'});document.querySelector('[data-tng="select-visible"]').click();ui.save();await settle();const e=api.state().workhub.claims.expenses.find(e=>e.tngSource),source=copy(e.tngSource);api.hub.claims.expenseForm(e.id);f=document.getElementById('claimExpenseForm');fill(f,{description:'Reviewed toll'});api.hub.claims.saveExpense(f);await settle();assert.deepEqual(copy(api.state().workhub.claims.expenses.find(x=>x.id===e.id).tngSource),source);ui.openSource(e.id);assert.match(document.getElementById('modalTitle').textContent,/TNG/);assert.equal(ui.snapshot().rows[0].selected,true);
});
test('TNG desk: late PDF reads are discarded after account changes',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.tng;ui.open();let finish;window.WorkHubTngFiles.read=()=>new Promise(resolve=>finish=resolve);const pending=ui.loadFile({name:'fixture.pdf'});await settle();api.cloud.ready=false;api.cloud.user=null;api.showTab('home');let closed=false;finish({rows:[tngFixtureRow()],warnings:[],source:{fileHash:'a'.repeat(64),cardKey:'b'.repeat(64),fileName:'fixture.pdf',pages:1},close(){closed=true;}});await pending;assert.equal(ui.snapshot().rows.length,0);assert.equal(closed,true);assert.equal(db.calls.length,0);
});
test('TNG desk: late exports and stale manual forms cannot cross accounts',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.tng;
 let downloads=0,finish;
 window.URL.createObjectURL=()=>{downloads++;return 'blob:fixture';};
 window.URL.revokeObjectURL=()=>{};
 window.HTMLAnchorElement.prototype.click=()=>{};
 ui.open();
 const reader=mockTngReader(window,[tngFixtureRow()]);
 await ui.loadFile({name:'fixture.pdf'});
 document.querySelector('[data-tng="select-visible"]').click();
 window.WorkHubTngFiles.pdfPack=()=>new Promise(resolve=>finish=resolve);
 const pending=ui.download('pdf');
 await settle();
 api.cloud.user={id:'22222222-2222-4222-8222-222222222222',email:'other@example.com'};
 ui.sync();
 finish(new Blob(['pdf'],{type:'application/pdf'}));
 await pending;
 assert.equal(downloads,0);
 assert.equal(reader.closed(),1);
 assert.equal(ui.snapshot().rows.length,0);
 assert.equal(document.getElementById('modal').open,false);
 ui.open();
 document.querySelector('[data-tng="manual"]').click();
 const stale=document.getElementById('tngRowForm');
 fill(stale,{date:'2026-10-09',postedDate:'2026-10-09',amount:'4.50',description:'Private draft',category:'parking',notes:''});
 api.cloud.user={id:'33333333-3333-4333-8333-333333333333',email:'third@example.com'};
 assert.throws(()=>ui.rowForm(stale),/Reopen the review/);
 assert.equal(ui.snapshot().rows.length,0);
 assert.equal(api.state().workhub.claims.expenses.length,0);
 assert.equal(db.calls.length,0);
});
test('TNG desk: keyboard crop edits are bounded and evidence export uses the edited crop without saving records',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.tng;window.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});let downloads=0;window.URL.createObjectURL=()=>{downloads++;return'blob:fixture';};window.URL.revokeObjectURL=()=>{};window.HTMLAnchorElement.prototype.click=()=>{};ui.open();mockTngReader(window,[tngFixtureRow()]);await ui.loadFile({name:'fixture.pdf'});document.querySelector('[data-tng="preview"]').click();await settle();const before=ui.snapshot().rows[0].rect.x;document.getElementById('tngCropFrame').dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(ui.snapshot().rows[0].rect.x,before+1);let used;window.WorkHubTngFiles.crop=async(_s,r,header)=>{used={r:copy(r),header};return{};};window.WorkHubTngFiles.png=async()=>new Blob(['png'],{type:'image/png'});await ui.download('png');assert.equal(used.r.rect.x,before+1);assert.equal(used.header,true);assert.equal(downloads,1);assert.equal(db.calls.length,0);
});
test('claim types: special destinations survive Schedule edits, inherit on receipts and reopen from cloud',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx;api.setMonth('2026-10');api.openRangeEditor('2026-10-09','14:00','',true);let f=document.getElementById('scheduleForm');fill(f,{claimType:'special',travelLocationId:'__one-off__',text:'Training visit'});f.elements.namedItem('travelLocationId').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(f.elements.namedItem('claimLocationName').disabled,false);assert.equal(f.querySelector('[data-claim-route-fields]').disabled,true);assert.throws(()=>api.saveRange(f),/one-off destination/);f.elements.namedItem('claimLocationName').value='Training <venue>';api.saveRange(f);await settle();let slot=api.state().schedule[0];assert.equal(slot.claimType,'special');assert.equal(slot.claimLocationName,'Training <venue>');assert.equal(slot.travel,null);api.openRangeEditor('2026-10-09','14:00');f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('travelLocationId').value,'__one-off__');assert.equal(f.elements.namedItem('claimType').value,'special');api.saveRange(f);await settle();api.viewBooking('2026-10-09','14:00');assert.match(document.querySelector('.claim-booking-details').textContent,/Special claims/);assert.equal(document.querySelector('.claim-booking-details venue'),null);document.querySelector('[data-claim="add-expense"]').click();f=document.getElementById('claimExpenseForm');assert.equal(f.elements.namedItem('claimType').value,'special');assert.equal(f.elements.namedItem('locationId').value,'__one-off__');fill(f,{amount:'4.50',description:'Training toll'});api.hub.claims.saveExpense(f);await settle();assert.equal(api.hub.claims.summary().byClaimType.special.totalCents,450);api.showTab('schedule');assert.match(document.querySelector('.claim-type-totals').textContent,/Special claimsRM 4\.50/);const restored=api.parseBackup(api.payload(api.state()));assert.equal(restored.schedule[0].claimLocationName,'Training <venue>');const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);reopened.api.setMonth('2026-10');assert.equal(reopened.api.state().schedule[0].claimType,'special');assert.equal(reopened.api.hub.claims.summary().byClaimType.special.totalCents,450);
});

test('TNG claim packs: editable captions and client/special export choices remain local and save the chosen type',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.tng;api.setMonth('2026-10');ui.open();mockTngReader(window,[tngFixtureRow(),tngFixtureRow({id:'t2',transactionNo:'0002',time:'10:00:00'}),tngFixtureRow({id:'t3',transactionNo:'0003',time:'17:00:00'})]);await ui.loadFile({name:'fixture.pdf'});document.querySelector('[data-tng="select-visible"]').click();assert.equal(document.querySelectorAll('[data-tng-caption]').length,2);let caption=document.querySelector('[data-tng-caption]');assert.equal(caption.value,'tol 2 of 2 (09/10/2026 to)');caption.value='tol 4 of 4 (09/10/2026 to)';caption.dispatchEvent(new window.Event('input',{bubbles:true}));document.getElementById('tngKind').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(document.querySelector('[data-tng-caption]').value,'tol 4 of 4 (09/10/2026 to)');let pack,downloads=0;window.WorkHubTngFiles.pdfPack=async(_s,rows,header,alive,options)=>{pack={rows:copy(rows),header,options:copy(options)};assert.equal(alive(),true);return new Blob(['fixture'],{type:'application/pdf'});};window.URL.createObjectURL=()=>{downloads++;return'blob:claim';};window.URL.revokeObjectURL=()=>{};window.HTMLAnchorElement.prototype.click=()=>{};await ui.download('pdf');assert.equal(pack.options.claimType,'client-site');assert.equal(pack.options.captions['2026-10-09|to'],'tol 4 of 4 (09/10/2026 to)');assert.equal(downloads,1);assert.equal(db.calls.length,0);const type=document.getElementById('tngClaimType');type.value='special';type.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(document.querySelectorAll('[data-tng-caption]').length,0);assert.match(document.querySelector('.tng-evidence-plan').textContent,/existing evidence format/);await ui.download('pdf');assert.equal(pack.options.claimType,'special');ui.save();await settle();assert.ok(api.state().workhub.claims.expenses.every(e=>e.claimType==='special'));assert.equal(api.hub.claims.summary().byClaimType.special.totalCents,498);let select=document.getElementById('tngClaimType');select.value='client-site';select.dispatchEvent(new window.Event('change',{bubbles:true}));assert.ok([...document.querySelectorAll('[data-tng-select]')].every(e=>e.disabled));await assert.rejects(()=>ui.download('pdf'),/at least one/);ui.openSource(api.state().workhub.claims.expenses[0].id);assert.equal(ui.snapshot().claimType,'special');assert.equal(document.getElementById('tngClaimType').value,'special');
});

test('saved Lab results autoplay indefinitely, pause/stop locally, and restart automatically on returning',async t=>{
 const ctx=await app(t,{styles:true}),{api,document,window,db}=ctx,id=addLabCase(api,document);addExperiment(ctx,id,'Passed check',{outcome:'Passed',result:'Confirmed'});addExperiment(ctx,id,'Failed check',{outcome:'Failed',result:'Not resolved'});await settle();api.showTab('home');api.showTab('lab');const ws=api.hub.workbench.workshop,host=()=>document.querySelector('.lab-case'),calls=db.calls.length,before=copy(api.state().workhub.lab);assert.equal(host().dataset.playback,'running');assert.ok(document.querySelector('[data-outcome="Passed"] .lab-result-motion'));assert.ok(document.querySelector('[data-outcome="Failed"] .lab-result-motion'));const original=window.Date.now;window.Date.now=()=>original()+600000;ws.tick();assert.equal(host().dataset.playback,'running');assert.match(window.getComputedStyle(document.querySelector('.lab-result-motion b')).animation,/infinite/);document.querySelector('[data-workshop="playback-toggle"]').click();assert.equal(host().dataset.playback,'paused');document.querySelector('[data-workshop="playback-toggle"]').click();assert.equal(host().dataset.playback,'running');const speed=document.getElementById('labPlaybackSpeed');speed.value='2';speed.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(host().style.getPropertyValue('--lab-loop-duration'),'2s');document.querySelector('[data-workshop="playback-stop"]').click();assert.equal(host().dataset.playback,'stopped');api.showTab('home');api.showTab('lab');assert.equal(host().dataset.playback,'running');await settle();assert.equal(db.calls.length,calls);assert.deepEqual(copy(api.state().workhub.lab),before);
});
test('saved solved Lab cases animate on reopen and motion/privacy preferences suspend playback without writes',async t=>{
 const {api,document,window,db}=await app(t),id=addLabCase(api,document,{status:'Solved',solution:'Verified answer'});await settle();api.showTab('lab');assert.equal(document.querySelector('.lab-case').dataset.playback,'running');assert.ok(document.querySelector('.lab-issue .lab-result-motion'));const calls=db.calls.length;window.matchMedia=()=>({matches:true});api.hub.workbench.tick();assert.equal(document.querySelector('.lab-case').dataset.playback,'paused');window.matchMedia=()=>({matches:false});api.hub.workbench.tick();assert.equal(document.querySelector('.lab-case').dataset.playback,'running');document.body.classList.add('hub-private');await settle();assert.equal(document.querySelector('.lab-case').dataset.playback,'paused');document.body.classList.remove('hub-private');api.hub.workbench.tick();assert.equal(document.querySelector('.lab-case').dataset.playback,'running');api.openMMAreaManager();api.hub.workbench.tick();assert.equal(document.querySelector('.lab-case').dataset.playback,'paused');api.closeModal();api.hub.workbench.tick();assert.equal(document.querySelector('.lab-case').dataset.playback,'running');assert.equal(db.calls.length,calls);
 const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);reopened.api.showTab('lab');assert.equal(reopened.document.querySelector('.lab-case').dataset.playback,'running');
});

async function saveProgressRemark(ctx, ticketId, remarks) {
 const {api,document,window}=ctx;
 const ticket=api.state().tickets.find(t=>t.id===ticketId);
 const tracker=api.state().trackers.find(p=>p.ticket===ticket.ticket);
 await api.action({dataset:{action:'progress-detail',id:tracker.id}});
 const form=document.getElementById('progressForm');
 form.elements.namedItem('remarks').value=remarks;
 form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 await settle();
}

test('ticket history appends only changed remarks with date and time, without prefixes',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx;
 useDay(window,'2026-10-20');
 const id=addReportTicket(api,document);
 await settle();
 assert.equal(api.state().tickets[0].history,'');
 assert.equal(api.state().tickets[0].historyDate,'');
 await saveProgressRemark(ctx,id,'  Awaiting user confirmation  ');
 let ticket=api.state().tickets[0];
 assert.equal(ticket.history,'Awaiting user confirmation [20-10-2026 12:00:00]');
 assert.equal(ticket.historyDate,'2026-10-20');
 assert.equal(ticket.historyTime,'12:00:00');
 const saved=copy(ticket);
 useDay(window,'2026-10-21');
 await saveProgressRemark(ctx,id,'Awaiting user confirmation');
 assert.equal(api.state().tickets[0].history,saved.history);
 assert.equal(api.state().tickets[0].historyDate,saved.historyDate);
 await saveProgressRemark(ctx,id,'Test complete\nUser confirmed the result');
 ticket=api.state().tickets[0];
 assert.equal(ticket.history,saved.history+'\nTest complete\nUser confirmed the result [21-10-2026 12:00:00]');
 api.showTab('tickets');
 document.getElementById('statusFilter').value='';
 document.getElementById('statusFilter').dispatchEvent(new window.Event('change',{bubbles:true}));
 assert.equal(document.querySelector('.ticket-history-preview p').textContent,'Test complete\nUser confirmed the result [21-10-2026 12:00:00]');
 const second=copy(ticket);
 await saveProgressRemark(ctx,id,'   ');
 assert.equal(api.state().tickets[0].history,second.history);
 assert.equal(api.state().tickets[0].historyTime,second.historyTime);
 assert.equal(api.parseBackup(api.payload(api.state())).tickets[0].history,second.history);
 const reopened=await app(t,{remote:copy(db.row),login:false});
 await reopened.api.loadCloud(sessionUser);
 assert.equal(reopened.api.state().tickets[0].history,second.history);
});

test('ticket status and milestone changes preserve the remarks journal and its timestamp',async t=>{
 const ctx=await app(t),{api,document,window}=ctx;
 useDay(window,'2026-10-20');
 const id=addReportTicket(api,document);
 await saveProgressRemark(ctx,id,'Keep this useful update');
 const prior=copy(api.state().tickets[0]);
 useDay(window,'2026-10-21');
 api.showTab('tickets');
 document.getElementById('statusFilter').value='';
 document.getElementById('statusFilter').dispatchEvent(new window.Event('change',{bubbles:true}));
 let status=document.querySelector('select[data-ticket-status]');
 status.value='Closed';
 status.dispatchEvent(new window.Event('change',{bubbles:true}));
 await settle();
 assert.equal(api.state().tickets[0].status,'Closed');
 assert.ok(api.state().trackers[0].steps.every(Boolean));
 assert.equal(api.state().workhub.ticketClosures[0].date,'2026-10-21');
 assert.equal(api.state().tickets[0].history,prior.history);
 assert.equal(api.state().tickets[0].historyDate,prior.historyDate);
 api.editRecord('tickets',id);
 const editor=document.getElementById('editForm');
 editor.elements.namedItem('status').value='Pending';
 api.saveEdit(editor);
 await settle();
 assert.equal(api.state().tickets[0].history,prior.history);
 await api.action({dataset:{action:'detail',id}});
 const checkbox=document.querySelector('.ticket-milestones [data-step="all"]');
 checkbox.checked=true;
 checkbox.dispatchEvent(new window.Event('change',{bubbles:true}));
 await settle();
 assert.equal(api.state().tickets[0].status,'Closed');
 assert.equal(api.state().tickets[0].history,prior.history);
 assert.equal(api.state().tickets[0].historyTime,prior.historyTime);
 assert.ok(api.state().workhub.workLibrary.events.some(e=>e.title==='Status changed'));
});

test('ticket history preserves older entries and manual updates use plain timestamped remarks',async t=>{
 const ctx=await app(t),{api,document,window}=ctx;
 useDay(window,'2026-10-20');
 const id=addWishlistTicket(api,document),legacy=api.state().tickets[0].history;
 await saveProgressRemark(ctx,id,'New progress note');
 assert.equal(api.state().tickets[0].history,legacy+'\nNew progress note [20-10-2026 12:00:00]');
 await api.action({dataset:{action:'detail',id}});
 let form=document.getElementById('historyForm');
 form.elements.namedItem('newHistory').value='Manual follow-up';
 form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 await settle();
 assert.ok(api.state().tickets[0].history.startsWith(legacy+'\n'));
 assert.ok(api.state().tickets[0].history.endsWith('Manual follow-up [20-10-2026 12:00:00]'));
 assert.equal(document.querySelector('.ticket-detail-update p').textContent,'Manual follow-up [20-10-2026 12:00:00]');
 const sheet=window.WorkHubReports.build(api.state(),{asOf:'2026-10-20'}).sheets.find(s=>s.name==='Ticket updates');
 assert.equal(sheet.rows.length,3);
 assert.equal(sheet.rows[0].values[3],legacy);
 assert.equal(sheet.rows[1].values[3],'New progress note [20-10-2026 12:00:00]');
 assert.equal(sheet.rows[2].values[3],'Manual follow-up [20-10-2026 12:00:00]');
});

function reminderClock(window, stamp) {
 const NativeDate=window.Date;
 window.Date=class extends NativeDate {
  constructor(...args){super(...(args.length?args:[stamp]));}
  static now(){return new NativeDate(stamp).getTime();}
 };
}

test('timed reminders: end-of-day alerts arrive at the chosen minute without hiding the task or saving clock ticks',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.reminders;
 reminderClock(window,'2026-10-20T12:00:00');
 const id=addMainTask(api,document,'Prepare the end-of-day update');
 await settle();const before=copy(api.state().tasks[0]);api.showTab('tasks');
 ui.editor('tasks',id);document.querySelector('[data-quick="eod"]').click();
 const f=document.getElementById('reminderForm');
 assert.equal(f.elements.namedItem('until').value,'2026-10-20');
 assert.equal(f.elements.namedItem('time').value,'18:00');
 assert.equal(f.elements.namedItem('hideUntilDue').checked,false);
 f.elements.namedItem('note').value='Update the ticket <img src=x> before signing off';
 f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();
 const r=api.state().workhub.reminders[0],writes=db.calls.length;
 assert.equal(r.at,'2026-10-20T10:00:00.000Z');assert.equal(r.hideUntilDue,false);
 assert.ok(document.querySelector('.task-main-card'));assert.equal(document.getElementById('reminderAlert'),null);
 reminderClock(window,'2026-10-20T17:59:59');ui.tick();assert.equal(document.getElementById('reminderAlert'),null);
 reminderClock(window,'2026-10-20T18:00:00');ui.tick();
 const alert=document.getElementById('reminderAlert');assert.ok(alert);
 assert.match(alert.textContent,/before signing off/);assert.equal(alert.querySelector('img'),null);
 ui.tick();assert.equal(document.getElementById('reminderAlert'),alert);
 assert.equal(db.calls.length,writes);assert.deepEqual(copy(api.state().tasks[0]),before);
 assert.equal(api.parseBackup(api.payload(api.state())).workhub.reminders[0].at,r.at);
});

test('timed reminders: due alerts wait for editing and respect hidden pages and Privacy',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.reminders;
 reminderClock(window,'2026-10-20T12:00:00');const id=addMainTask(api,document,'Review a draft');
 ui.schedule('tasks',id,'2026-10-20T04:15:00.000Z','Review this draft');await settle();
 api.editRecord('tasks',id);const f=document.getElementById('editForm');f.elements.namedItem('task').value='Unsaved draft remains';
 const writes=db.calls.length;reminderClock(window,'2026-10-20T12:15:00');ui.tick();
 assert.equal(document.getElementById('editForm'),f);assert.equal(f.elements.namedItem('task').value,'Unsaved draft remains');
 assert.equal(document.getElementById('reminderAlert'),null);
 api.closeModal();
 const inline=document.createElement('input');document.getElementById('view').append(inline);inline.value='Unsaved inline text';inline.focus();
 ui.tick();assert.equal(inline.isConnected,true);assert.equal(document.activeElement,inline);assert.equal(inline.value,'Unsaved inline text');assert.equal(document.getElementById('reminderAlert'),null);
 inline.blur();inline.remove();ui.tick();assert.ok(document.getElementById('reminderAlert'));
 document.body.classList.add('hub-private');ui.tick();assert.equal(document.getElementById('reminderAlert'),null);
 document.body.classList.remove('hub-private');ui.tick();assert.ok(document.getElementById('reminderAlert'));
 Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});ui.tick();assert.equal(document.getElementById('reminderAlert'),null);
 Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new window.Event('visibilitychange'));
 assert.ok(document.getElementById('reminderAlert'));assert.equal(db.calls.length,writes);
});

test('timed reminders: snooze reschedules once and hiding an alert keeps it in the inbox without cloud writes',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.reminders;
 reminderClock(window,'2026-10-20T12:00:00');const id=addMainTask(api,document,'Call back after lunch');
 ui.schedule('tasks',id,'2026-10-20T04:15:00.000Z','Call the user back');await settle();
 reminderClock(window,'2026-10-20T12:15:00');ui.tick();const writes=db.calls.length;
 document.querySelector('#reminderAlert [data-reminder="later15"]').click();await settle();
 assert.equal(api.state().workhub.reminders[0].at,'2026-10-20T04:30:00.000Z');
 assert.equal(api.state().workhub.reminders[0].note,'Call the user back');assert.equal(db.calls.length,writes+1);
 assert.equal(document.getElementById('reminderAlert'),null);
 reminderClock(window,'2026-10-20T12:30:00');ui.tick();assert.ok(document.getElementById('reminderAlert'));
 document.querySelector('[data-reminder="hide-alert"]').click();ui.tick();
 assert.equal(document.getElementById('reminderAlert'),null);assert.equal(db.calls.length,writes+1);
 assert.equal(api.state().workhub.reminders.length,1);ui.inbox();assert.match(document.getElementById('modalBody').textContent,/Call the user back/);
 document.querySelector('.reminder-inbox [data-reminder="dismiss"]').click();await settle();
 assert.equal(api.state().workhub.reminders.length,0);assert.equal(api.state().tasks[0].done,false);
});

test('timed reminders: relative choices cross midnight, end-of-day time is editable and past times are rejected',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.reminders;
 reminderClock(window,'2026-10-20T23:55:00');const id=addMainTask(api,document,'Tomorrow review');ui.editor('tasks',id);
 document.querySelector('[data-quick="15"]').click();let f=document.getElementById('reminderForm');
 assert.equal(f.elements.namedItem('until').value,'2026-10-21');assert.equal(f.elements.namedItem('time').value,'00:10');
 const end=document.getElementById('reminderEndTime');end.value='17:30';end.dispatchEvent(new window.Event('change',{bubbles:true}));
 document.querySelector('[data-quick="eod"]').click();assert.equal(f.elements.namedItem('until').value,'2026-10-21');assert.equal(f.elements.namedItem('time').value,'17:30');
 const writes=db.calls.length;f.elements.namedItem('until').value='2026-10-20';f.elements.namedItem('time').value='12:00';
 f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();
 assert.equal(api.state().workhub.reminders.length,0);assert.equal(db.calls.length,writes);assert.equal(document.getElementById('modal').open,true);
 assert.equal(window.localStorage.getItem('mm-tracker.reminder-end-time'),'17:30');
});

test('timed reminders: exact times survive cloud reopen and calendar/report exports without extra saves',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.reminders;
 reminderClock(window,'2026-10-20T12:00:00');const id=addMainTask(api,document,'Review before signing off');
 ui.schedule('tasks',id,'2026-10-20T10:00:00.000Z','Send the final update');await settle();const writes=db.calls.length;
 let downloaded;window.URL.createObjectURL=blob=>{downloaded=blob;return 'blob:calendar';};window.URL.revokeObjectURL=()=>{};window.HTMLAnchorElement.prototype.click=()=>{};
 ui.exportCalendar('tasks',id);assert.match(await downloaded.text(),/DTSTART:20261020T100000Z/);assert.equal(db.calls.length,writes);
 const sheet=window.WorkHubReports.build(api.state(),{asOf:'2026-10-20'}).sheets.find(s=>s.name==='Reminders');
 assert.equal(sheet.rows[0].values[3],'Scheduled');assert.equal(sheet.rows[0].values[5],'2026-10-20T10:00:00.000Z');assert.equal(sheet.rows[0].values[6],'No');
 const reopened=await app(t,{remote:copy(db.row),login:false});reminderClock(reopened.window,'2026-10-20T18:30:00');await reopened.api.loadCloud(sessionUser);await settle();
 assert.equal(reopened.api.state().workhub.reminders[0].at,'2026-10-20T10:00:00.000Z');assert.ok(reopened.document.getElementById('reminderAlert'));
});

test('timed reminders: switching accounts closes the old reminder editor and rejects its stale form',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.reminders;
 reminderClock(window,'2026-10-20T12:00:00');const id=addMainTask(api,document,'Private reminder');await settle();ui.editor('tasks',id);
 const stale=document.getElementById('reminderForm'),writes=db.calls.length;
 api.cloud.ready=false;api.cloud.user=null;ui.tick();assert.equal(document.getElementById('modal').open,false);
 stale.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();
 assert.equal(db.calls.length,writes);assert.equal(api.state().workhub.reminders.length,0);assert.equal(document.getElementById('reminderAlert'),null);
});

test('grouped Settings: option spacing overrides header button styles and hidden sections stay hidden',async t=>{
 const {api,document,window}=await app(t,{styles:true});api.hub.chromeUX.open();api.hub.settingsPanel.select('work');const button=document.getElementById('claimSettingsButton'),style=window.getComputedStyle(button);assert.ok(parseFloat(style.paddingLeft)>=40,'Reserve space for the icon.');assert.ok(parseFloat(style.paddingBottom)>=35,'Reserve space for the description.');assert.equal(window.getComputedStyle(document.getElementById('hubSettingsAppearance')).display,'none');assert.equal(window.getComputedStyle(document.getElementById('settingsGroup-workspace')).display,'none');assert.equal(window.getComputedStyle(document.getElementById('settingsTab-work')).display,'flex');assert.equal(window.getComputedStyle(button.closest('.settings-entry').querySelector('.settings-entry-note')).position,'absolute');
});

// Schedule companies use the same maintained company records as Projects.
test('Schedule companies: multi-day minute bookings save, reopen and display companies in Calendar and the time grid',async t=>{
 const {api,document,window,db}=await app(t);addCompany(api,document,'Farms <img src=x> & Co');await settle();const company=api.state().projectCompanies[0];
 api.openRangeEditor('2026-10-20','09:15','',true);let f=document.getElementById('scheduleForm');assert.match(f.elements.namedItem('companyId').textContent,/Farms <img src=x> & Co/);assert.equal(f.querySelector('.schedule-company-field img'),null);assert.ok(f.querySelector('optgroup'));
 fill(f,{companyId:company.id,endDate:'2026-10-22',endTime:'10:45',text:'Company workshop'});api.saveRange(f);await settle();
 assert.equal(api.state().schedule.length,6);assert.ok(api.state().schedule.every(s=>s.companyId===company.id&&s.companyName===company.name));assert.equal(db.row.document.data.schedule[0].companyId,company.id);assert.equal(api.parseBackup(api.payload(api.state())).schedule[0].companyName,company.name);
 api.openRangeEditor('2026-10-20','09:15');f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('companyId').value,company.id);assert.equal(f.elements.namedItem('endTime').value,'10:45');api.closeModal();const writes=db.calls.length;api.setMonth('2026-10');api.showTab('schedule');
 const badges=[...document.querySelectorAll('.day-bookings .booking-company')];assert.equal(badges.length,3);assert.ok(badges.every(el=>el.textContent.includes(company.name)));assert.equal(document.querySelector('.day-bookings .booking-company img'),null);
 await api.action(document.querySelector('[data-action="schedule-day"][data-date="2026-10-20"]'));assert.match(document.querySelector('.agenda-bookings .booking-company').textContent,/Farms <img src=x> & Co/);
 api.viewBooking('2026-10-20','09:15');assert.equal(document.querySelector('#modalBody form'),null);assert.match(document.querySelector('.booking-facts').textContent,/CompanyFarms <img src=x> & Co/);api.closeModal();
 await api.action(document.querySelector('[data-action="schedule-layout"][data-layout="grid"]'));assert.match(document.querySelector('.precision-grid .booking-company').textContent,/Farms <img src=x> & Co/);await settle();assert.equal(db.calls.length,writes);
 const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);await settle();assert.equal(reopened.api.state().schedule[0].companyId,company.id);reopened.api.openRangeEditor('2026-10-20','09:15');assert.equal(reopened.document.getElementById('bookingCompany').value,company.id);
});

test('Schedule companies: project changes filter companies without replacing typed fields, and project Calendar edits keep the selection',async t=>{
 const {api,document,window,db}=await app(t);addCompany(api,document,'Company A');await settle();const companyA=api.state().projectCompanies[0],projectA=api.state().projects[0];
 api.mutate(d=>{d.projects.push({...copy(projectA),id:'company-project-b',name:'Rollout B',code:'B'});d.activeProjectId='company-project-b';});addCompany(api,document,'Company B');await settle();const companyB=api.state().projectCompanies.at(-1);api.mutate(d=>d.activeProjectId=projectA.id);await settle();
 api.openRangeEditor('2026-10-20','09:15','',true);let f=document.getElementById('scheduleForm');f.elements.namedItem('kind').value='project';f.elements.namedItem('kind').dispatchEvent(new window.Event('change',{bubbles:true}));f=document.getElementById('scheduleForm');
 assert.ok(f.querySelector('option[value="'+companyA.id+'"]'));assert.equal(f.querySelector('option[value="'+companyB.id+'"]'),null);fill(f,{companyId:companyA.id,title:'UAT workshop',text:'Keep my typed notes',location:api.state().lists.workLocations[0],endTime:'10:45'});
 const original=f;f.elements.namedItem('linkId').value='company-project-b';f.elements.namedItem('linkId').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(document.getElementById('scheduleForm'),original);assert.equal(f.elements.namedItem('text').value,'Keep my typed notes');assert.equal(f.elements.namedItem('endTime').value,'10:45');assert.equal(f.elements.namedItem('companyId').value,'');assert.equal(f.querySelector('option[value="'+companyA.id+'"]'),null);assert.ok(f.querySelector('option[value="'+companyB.id+'"]'));
 const bad=document.createElement('option');bad.value=companyA.id;bad.textContent=companyA.name;f.elements.namedItem('companyId').append(bad);f.elements.namedItem('companyId').value=companyA.id;const writes=db.calls.length;assert.throws(()=>api.saveRange(f),/company.*selected project/);assert.equal(db.calls.length,writes);assert.equal(api.state().schedule.length,0);bad.remove();f.elements.namedItem('companyId').value=companyB.id;api.saveRange(f);await settle();
 const plan=api.state().projectPlans[0];assert.equal(plan.companyId,companyB.id);assert.ok(api.state().schedule.every(s=>s.companyId===plan.companyId&&s.companyName===plan.companyName));
 api.editPlan(plan.id);f=document.getElementById('planForm');assert.equal(f.elements.namedItem('companyId').value,companyB.id);fill(f,{date:'2026-10-23',endDate:'2026-10-23',text:'Edited through project Calendar'});api.savePlan(f);await settle();assert.ok(api.state().schedule.every(s=>s.date==='2026-10-23'&&s.companyId===companyB.id));
 api.mutate(d=>d.activeProjectId='company-project-b');api.showTab('specs');const button=document.querySelector('[data-action="project-view"][data-view="calendar"]');assert.ok(button);await api.action(button);assert.match(document.querySelector('.calendar-event .booking-company').textContent,/Company B/);assert.match(document.querySelector('.plan-row .booking-company').textContent,/Company B/);api.validate(api.state());
});

test('Schedule companies: renaming updates displayed labels and deleted companies keep historical bookings editable',async t=>{
 const {api,document,window}=await app(t);addCompany(api,document,'Original company');await settle();const company=api.state().projectCompanies[0];api.openRangeEditor('2026-10-20','09:00','',true);let f=document.getElementById('scheduleForm');fill(f,{companyId:company.id,text:'Saved company work'});api.saveRange(f);await settle();
 api.editCompany(company.id);f=document.getElementById('companyForm');f.elements.namedItem('name').value='Renamed company';api.saveCompany(f);await settle();api.setMonth('2026-10');api.showTab('schedule');assert.match(document.querySelector('.day-bookings .booking-company').textContent,/Renamed company/);
 api.openRangeEditor('2026-10-20','09:00');f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('companyId').value,company.id);api.saveRange(f);await settle();api.mutate(d=>d.projectCompanies=d.projectCompanies.filter(c=>c.id!==company.id));await settle();api.showTab('schedule');assert.match(document.querySelector('.day-bookings .booking-company').textContent,/Renamed company/);
 api.openRangeEditor('2026-10-20','09:00');f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('companyId').value,company.id);assert.match(f.elements.namedItem('companyId').selectedOptions[0].textContent,/saved company/);f.elements.namedItem('text').value='Historical booking notes updated';api.saveRange(f);await settle();assert.equal(api.state().schedule[0].companyName,'Renamed company');
 const legacy=copy(api.state());for(const s of legacy.schedule){delete s.companyId;delete s.companyName;}assert.equal(api.parseBackup(api.payload(legacy)).schedule[0].text,'Historical booking notes updated');const invalid=copy(api.state());invalid.schedule[0].companyName={bad:true};assert.throws(()=>api.parseBackup(api.payload(invalid)),/company/);
 api.openRangeEditor('2026-10-20','09:00');f=document.getElementById('scheduleForm');f.elements.namedItem('companyId').value='';api.saveRange(f);await settle();assert.equal(api.state().schedule[0].companyId,'');assert.equal(api.state().schedule[0].companyName,'');api.showTab('schedule');assert.equal(document.querySelector('.booking-company'),null);api.validate(api.state());
});

test('Schedule companies: changing booking types preserves company choices for tasks and leave',async t=>{
 const {api,document,window,db}=await app(t);addCompany(api,document,'Shared company');const company=api.state().projectCompanies[0],task=addMainTask(api,document,'Company follow-up');await settle();
 api.openRangeEditor('2026-10-20','13:15','',true);let f=document.getElementById('scheduleForm');fill(f,{companyId:company.id,text:'Notes before switching'});f.elements.namedItem('kind').value='task';f.elements.namedItem('kind').dispatchEvent(new window.Event('change',{bubbles:true}));f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('companyId').value,company.id);assert.equal(f.elements.namedItem('text').value,'Notes before switching');f.elements.namedItem('linkId').value=task;api.saveRange(f);await settle();assert.equal(api.state().schedule[0].companyId,company.id);
 api.openRangeEditor('2026-10-21','09:00','',true);f=document.getElementById('scheduleForm');f.elements.namedItem('companyId').value=company.id;f.elements.namedItem('kind').value='annual-leave';f.elements.namedItem('kind').dispatchEvent(new window.Event('change',{bubbles:true}));f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('companyId').value,company.id);api.saveRange(f);await settle();assert.ok(api.state().schedule.filter(s=>s.kind==='annual-leave').every(s=>s.companyId===company.id));assert.equal(db.row.document.data.schedule.at(-1).companyId,company.id);api.validate(api.state());
});

test('rehearsal UI: opening the replacement starts a local looping preview with sound enabled by default',async t=>{
 const {api,document,db}=await app(t);api.showTab('processhub');const r=api.hub.rehearsal;
 assert.ok(document.getElementById('rehearsalRoot'));assert.equal(document.getElementById('hubSimulator'),null);assert.equal(api.state().workhub.rehearsal.preferences.sound,true);assert.equal(r.snapshot().paused,false);assert.equal(db.calls.length,0);
 assert.ok(document.querySelectorAll('.rehearsal-node').length>=8);assert.equal(r.plan().entries.length,6);
 for(let n=1;n<=420;n++)r.tick(n*150);
 assert.ok(r.snapshot().loops>=1);assert.equal(api.state().workhub.rehearsal.processes.length,0);assert.equal(db.calls.length,0);
});

test('rehearsal UI: save example, edit a step and retain snapshots through cloud saving and backup',async t=>{
 const {api,document,window,db}=await app(t);api.showTab('processhub');document.querySelector('[data-rehearsal="keep"]').click();await settle();
 const r=api.hub.rehearsal,p=api.state().workhub.rehearsal.processes[0];assert.ok(p);assert.notEqual(p.id,'__demo__');r.stepEditor('po');let f=document.getElementById('rehearsalStepForm');
 assert.equal(r.snapshot().paused,true);assert.equal(r.snapshot().editing,true);f.elements.namedItem('instruction').value='Review the order with my checklist';f.elements.namedItem('changes').value='Ordered quantity = 120\nOrder value = 1200';r.saveForm(f);await settle();
 assert.equal(api.state().workhub.rehearsal.processes[0].steps[0].instruction,'Review the order with my checklist');assert.equal(r.snapshot().editing,false);assert.equal(r.snapshot().paused,false);
 const restored=api.parseBackup(JSON.stringify(db.row.document));assert.equal(restored.workhub.rehearsal.processes[0].steps[0].changes[0].value,120);
 r.stepEditor('po');f=document.getElementById('rehearsalStepForm');f.elements.namedItem('instruction').value='Unsaved draft';const speed=document.getElementById('rehearsalSpeed');speed.value='2';speed.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(document.getElementById('rehearsalStepForm').elements.namedItem('instruction').value,'Unsaved draft');
});

test('rehearsal UI: scenario changes, rewind, failure routes and off-route inspection remain deterministic',async t=>{
 const {api,document,window}=await app(t);api.showTab('processhub');const r=api.hub.rehearsal;
 const select=document.getElementById('rehearsalScenario');select.value='partial';select.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(r.plan().values['Received quantity'],60);assert.ok(r.plan().entries.some(e=>e.id==='followup'));
 document.querySelector('[data-rehearsal="inspect"][data-id="rework"]').click();await settle();assert.match(document.getElementById('rehearsalInspector').textContent,/Revise rejected order/);
 document.querySelector('[data-rehearsal="failure"][data-id="rework"]').click();await settle();assert.ok(r.plan().entries.length>0);assert.match(document.getElementById('toast').textContent,/outside the current route/);
 document.querySelector('[data-rehearsal="back"]').click();await settle();assert.equal(r.snapshot().paused,true);
});

test('rehearsal UI: account switches reject stale step editors and motion off stops automatic advance',async t=>{
 const {api,document}=await app(t);api.showTab('processhub');document.querySelector('[data-rehearsal="keep"]').click();await settle();const r=api.hub.rehearsal;r.stepEditor('po');const stale=document.getElementById('rehearsalStepForm');stale.elements.namedItem('title').value='Private old draft';
 api.cloud.user={id:'22222222-2222-4222-8222-222222222222'};api.showTab('home');assert.throws(()=>r.saveForm(stale),/Sign in/);
 api.mutate(d=>{d.workhub.preferences.motion='off';});api.showTab('processhub');const before=r.snapshot().index;for(let n=1;n<=80;n++)r.tick(n*150);assert.equal(r.snapshot().index,before);
});

test('T-code UI: version filters, custom maintenance, favourites and archival use private autosave',async t=>{
 const {api,document,window,db}=await app(t);api.hub.setTool('tcodes');api.showTab('studio');assert.equal(document.querySelectorAll('.tcode-card').length,79);
 const system=document.getElementById('tcodesSystem');system.value='S4';system.dispatchEvent(new window.Event('change',{bubbles:true}));assert.ok(![...document.querySelectorAll('.tcode-code')].some(el=>el.textContent==='XK01'));assert.ok([...document.querySelectorAll('.tcode-code')].some(el=>el.textContent==='BP'));
 api.hub.tcodes.editor();let f=document.getElementById('tcodeForm');for(const [k,v]of Object.entries({code:'ZMM_REPORT',title:'My MM report',category:'Reporting',area:'Purchasing',notes:'Use my saved variant'}))f.elements.namedItem(k).value=v;api.hub.tcodes.save(f);await settle();
 const record=api.state().workhub.tcodes.records.find(r=>r.code==='ZMM_REPORT');assert.ok(record);assert.equal(db.row.document.data.workhub.tcodes.records.at(-1).id,record.id);document.querySelector('[data-tcodes="favorite"][data-id="'+record.id+'"]').click();await settle();assert.equal(api.state().workhub.tcodes.records.find(r=>r.id===record.id).favorite,true);
 document.querySelector('[data-tcodes="archive"][data-id="'+record.id+'"]').click();await settle();assert.equal(api.state().workhub.tcodes.records.find(r=>r.id===record.id).archived,true);
});

test('T-code UI: stale account forms and invalid duplicate codes cannot overwrite library entries',async t=>{
 const {api,document}=await app(t);api.hub.setTool('tcodes');api.showTab('studio');const ui=api.hub.tcodes;ui.editor();const f=document.getElementById('tcodeForm');f.elements.namedItem('code').value='ME21N';f.elements.namedItem('title').value='Duplicate';assert.throws(()=>ui.save(f),/unique/);assert.equal(api.state().workhub.tcodes.records.length,79);
 api.cloud.user={id:'22222222-2222-4222-8222-222222222222'};api.showTab('home');assert.equal(document.getElementById('modal').open,false);assert.throws(()=>ui.save(f),/Sign in/);
});

test('rehearsal UI: audio waits for a gesture, respects mute and keyboard positioning preserves focus',async t=>{
 const {api,document,window}=await app(t);let starts=0,suspends=0;
 class AudioMock{constructor(){this.state='suspended';this.currentTime=0;this.destination={};}async resume(){this.state='running';}async suspend(){suspends++;this.state='suspended';}async close(){this.state='closed';}createOscillator(){return{frequency:{setValueAtTime(){}},connect(){},disconnect(){},start(){starts++;},stop(){}};}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}}
 window.AudioContext=AudioMock;api.showTab('processhub');assert.equal(starts,0);
 document.querySelector('[data-rehearsal="play"]').click();await settle();document.querySelector('[data-rehearsal="play"]').click();await settle();assert.ok(starts>0);
 document.querySelector('[data-rehearsal="sound"]').click();await settle();assert.equal(api.state().workhub.rehearsal.preferences.sound,false);assert.ok(suspends>0);
 document.querySelector('[data-rehearsal="keep"]').click();await settle();const old=api.state().workhub.rehearsal.processes[0].steps[0].x,handle=document.querySelector('[data-rehearsal-drag="po"]');handle.focus();handle.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await settle();assert.equal(api.state().workhub.rehearsal.processes[0].steps[0].x,old+10);assert.equal(document.activeElement.dataset.rehearsalDrag,'po');
});

test('rehearsal UI: rewind visibly retraces the previous connector before restoring its step',async t=>{
 const {api,document}=await app(t);api.showTab('processhub');const r=api.hub.rehearsal;
 document.querySelector('[data-rehearsal="next"]').click();await settle();assert.equal(r.snapshot().index,1);
 document.querySelector('[data-rehearsal="back"]').click();await settle();assert.equal(r.snapshot().rewinding,true);const token=document.getElementById('rehearsalToken'),start=token.style.left;assert.equal(token.hidden,false);
 r.tick(150);r.tick(300);r.tick(450);assert.notEqual(token.style.left,start);
 for(let n=4;n<=12;n++)r.tick(n*150);assert.equal(r.snapshot().rewinding,false);assert.equal(r.snapshot().index,0);assert.equal(r.snapshot().paused,true);assert.equal(document.getElementById('rehearsalRoot').dataset.direction,'forward');
});

// Project item links share the same stable identifiers as Track time.
async function projectItemBooking(ctx,link,date='2026-10-20'){
 const {api,document,window}=ctx;api.openRangeEditor(date,'09:15','',true);let f=document.getElementById('scheduleForm');f.elements.namedItem('kind').value='project';f.elements.namedItem('kind').dispatchEvent(new window.Event('change',{bubbles:true}));f=document.getElementById('scheduleForm');f.elements.namedItem('linkId').value=link.projectId;f.elements.namedItem('linkId').dispatchEvent(new window.Event('change',{bubbles:true}));fill(f,{title:'Configuration review',itemId:link.itemId,location:api.state().lists.workLocations[0],endTime:'10:45',text:'Check the saved design'});f.elements.namedItem('itemId').dispatchEvent(new window.Event('change',{bubbles:true}));f.elements.namedItem('subItemId').value=link.subItemId;return f;
}
test('Schedule project items: main and sub-item selections persist across cloud, backup, Calendar, details and project Calendar edits',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,link=await addProjectDeliverable(ctx);let f=await projectItemBooking(ctx,link);f.elements.namedItem('endDate').value='2026-10-22';api.saveRange(f);await settle();const plan=api.state().projectPlans[0];assert.equal(plan.itemId,link.itemId);assert.equal(plan.subItemId,link.subItemId);assert.ok(api.state().schedule.every(s=>s.itemId===link.itemId&&s.subItemId===link.subItemId&&s.itemTitle==='Prepare purchasing design'));assert.equal(db.row.document.data.schedule[0].subItemTitle,'Review release strategy');assert.equal(api.parseBackup(api.payload(api.state())).projectPlans[0].subItemId,link.subItemId);
 api.openRangeEditor('2026-10-20','09:15');f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('itemId').value,link.itemId);assert.equal(f.elements.namedItem('subItemId').value,link.subItemId);assert.equal(f.elements.namedItem('endTime').value,'10:45');api.closeModal();const writes=db.calls.length;api.setMonth('2026-10');api.showTab('schedule');assert.match(document.querySelector('.day-bookings .booking-item').textContent,/Prepare purchasing design.*Review release strategy/);await api.action(document.querySelector('[data-action="schedule-day"][data-date="2026-10-20"]'));assert.match(document.querySelector('.agenda-bookings .booking-item').textContent,/Review release strategy/);api.viewBooking('2026-10-20','09:15');assert.match(document.querySelector('.booking-facts').textContent,/Project itemPrepare purchasing design.*Sub-itemReview release strategy/);api.closeModal();await api.action(document.querySelector('[data-action="schedule-layout"][data-layout="grid"]'));assert.match(document.querySelector('.precision-grid .booking-item').textContent,/Prepare purchasing design/);assert.equal(db.calls.length,writes);
 const modern=window.WorkHubReports.build(api.state(),{asOf:'2026-10-22'}).sheets.find(s=>s.name==='Schedule');assert.ok(modern.rows.every(row=>row.values.length===modern.columns.length));assert.ok(modern.rows.some(row=>row.values[8]==='Prepare purchasing design'&&row.values[9]==='Review release strategy'));const legacy=api.reportModel(api.state(),'2026-10-22').find(s=>s.name==='Schedule');assert.ok(JSON.stringify(legacy).includes('Review release strategy'));
 api.editPlan(plan.id);f=document.getElementById('planForm');assert.equal(f.elements.namedItem('itemId').value,link.itemId);assert.equal(f.elements.namedItem('subItemId').value,link.subItemId);fill(f,{date:'2026-10-23',endDate:'2026-10-23'});api.savePlan(f);await settle();assert.ok(api.state().schedule.every(s=>s.date==='2026-10-23'&&s.subItemId===link.subItemId));api.mutate(d=>d.activeProjectId=link.projectId);api.showTab('specs');await api.action(document.querySelector('[data-action="project-view"][data-view="calendar"]'));assert.match(document.querySelector('.calendar-event .booking-item').textContent,/Review release strategy/);assert.match(document.querySelector('.plan-row .booking-item').textContent,/Prepare purchasing design/);
 const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);reopened.api.openRangeEditor('2026-10-23','09:15');assert.equal(reopened.document.getElementById('bookingItem').value,link.itemId);assert.equal(reopened.document.getElementById('bookingSubItem').value,link.subItemId);api.validate(api.state());
});
test('Schedule project items: scope changes reset linked choices without losing notes and reject mismatched project or sub-item links',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,a=await addProjectDeliverable(ctx),second=await addProjectDeliverable(ctx,'MM-43');api.mutate(d=>{d.projects.push({...copy(d.projects[0]),id:'item-project-b',name:'Rollout B',code:'B'});d.activeProjectId='item-project-b';});await settle();const b=await addProjectDeliverable(ctx,'MM-44');let f=await projectItemBooking(ctx,a);const same=f;f.elements.namedItem('itemId').value=second.itemId;f.elements.namedItem('itemId').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(f.elements.namedItem('subItemId').value,'');assert.ok(f.querySelector('#bookingSubItem option[value="'+second.subItemId+'"]'));assert.equal(f.querySelector('#bookingSubItem option[value="'+a.subItemId+'"]'),null);f.elements.namedItem('linkId').value=b.projectId;f.elements.namedItem('linkId').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(document.getElementById('scheduleForm'),same);assert.equal(f.elements.namedItem('text').value,'Check the saved design');assert.equal(f.elements.namedItem('endTime').value,'10:45');assert.equal(f.elements.namedItem('itemId').value,'');assert.equal(f.elements.namedItem('subItemId').disabled,true);assert.equal(f.querySelector('#bookingItem option[value="'+a.itemId+'"]'),null);
 const bad=document.createElement('option');bad.value=a.itemId;f.elements.namedItem('itemId').append(bad);f.elements.namedItem('itemId').value=a.itemId;const writes=db.calls.length;assert.throws(()=>api.saveRange(f),/project item.*selected project/);assert.equal(db.calls.length,writes);bad.remove();f.elements.namedItem('itemId').value=b.itemId;f.elements.namedItem('itemId').dispatchEvent(new window.Event('change',{bubbles:true}));const wrong=document.createElement('option');wrong.value=a.subItemId;f.elements.namedItem('subItemId').append(wrong);f.elements.namedItem('subItemId').value=a.subItemId;assert.throws(()=>api.saveRange(f),/sub-item.*selected project item/);wrong.remove();f.elements.namedItem('subItemId').value='';api.saveRange(f);await settle();assert.equal(api.state().schedule[0].itemId,b.itemId);assert.equal(api.state().schedule[0].subItemId,'');
 api.openRangeEditor('2026-10-20','09:15');f=document.getElementById('scheduleForm');f.elements.namedItem('kind').value='annual-leave';f.elements.namedItem('kind').dispatchEvent(new window.Event('change',{bubbles:true}));f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('itemId'),null);api.saveRange(f);await settle();assert.ok(api.state().schedule.every(s=>s.kind==='annual-leave'&&!s.itemId&&!s.subItemId));assert.equal(api.state().projectPlans.length,0);
});
test('Schedule project items: renames display current labels and deleted items retain editable historical snapshots',async t=>{
 const ctx=await app(t),{api,document}=ctx,link=await addProjectDeliverable(ctx);let f=await projectItemBooking(ctx,link);api.saveRange(f);await settle();api.mutate(d=>{d.specs[0].description='Updated design <img src=x>';d.specs[0].subItems[0].title='Updated approver check';});await settle();api.openRangeEditor('2026-10-20','09:15');f=document.getElementById('scheduleForm');assert.match(f.elements.namedItem('itemId').selectedOptions[0].textContent,/Updated design <img src=x>/);assert.equal(f.querySelector('.schedule-item-field img'),null);api.saveRange(f);await settle();api.mutate(d=>d.specs=[]);await settle();api.setMonth('2026-10');api.showTab('schedule');assert.match(document.querySelector('.booking-item').textContent,/Updated design <img src=x>.*Updated approver check/);assert.equal(document.querySelector('.booking-item img'),null);api.openRangeEditor('2026-10-20','09:15');f=document.getElementById('scheduleForm');assert.match(f.elements.namedItem('itemId').selectedOptions[0].textContent,/saved item/);assert.match(f.elements.namedItem('subItemId').selectedOptions[0].textContent,/saved sub-item/);f.elements.namedItem('text').value='Historical booking updated';api.saveRange(f);await settle();assert.equal(api.state().schedule[0].itemTitle,'Updated design <img src=x>');
 const legacy=copy(api.state());for(const row of [...legacy.schedule,...legacy.projectPlans])for(const key of ['itemId','subItemId','itemTitle','subItemTitle'])delete row[key];assert.equal(api.parseBackup(api.payload(legacy)).schedule[0].text,'Historical booking updated');const invalid=copy(api.state());invalid.schedule[0].itemTitle={bad:true};assert.throws(()=>api.parseBackup(api.payload(invalid)),/schedule project item/);const mismatch=copy(api.state());mismatch.schedule[0].subItemId='wrong-sub';assert.throws(()=>api.parseBackup(api.payload(mismatch)),/do not match/);
 api.openRangeEditor('2026-10-20','09:15');f=document.getElementById('scheduleForm');f.elements.namedItem('itemId').value='';f.elements.namedItem('itemId').dispatchEvent(new ctx.window.Event('change',{bubbles:true}));api.saveRange(f);await settle();assert.equal(api.state().schedule[0].subItemId,'');assert.equal(api.state().projectPlans[0].itemId,'');api.validate(api.state());
});
async function companyScheduleFixture(ctx){
 const {api,document}=ctx;
 addCompany(api,document,'Company A');addCompany(api,document,'Company B');addCompany(api,document,'Company without items');
 const [companyA,companyB,emptyCompany]=api.state().projectCompanies;
 const a=await addProjectDeliverable(ctx,'MM-A'),b=await addProjectDeliverable(ctx,'MM-B'),unassigned=await addProjectDeliverable(ctx,'MM-GENERAL');
 api.mutate(d=>{d.specs.find(item=>item.id===a.itemId).companyId=companyA.id;d.specs.find(item=>item.id===b.itemId).companyId=companyB.id;});
 await settle();return{a,b,unassigned,companyA,companyB,emptyCompany};
}
function changeBookingField(window,form,name,value){
 const field=form.elements.namedItem(name);field.value=value;field.dispatchEvent(new window.Event('change',{bubbles:true}));
}
test('Schedule company items: company changes filter items and clear incompatible sub-items without replacing typed fields',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,{a,b,unassigned,companyA,companyB,emptyCompany}=await companyScheduleFixture(ctx);
 const f=await projectItemBooking(ctx,a),writes=db.calls.length;
 const items=()=>[...f.elements.namedItem('itemId').options].map(option=>option.value);
 assert.deepEqual(items(),['',a.itemId,b.itemId,unassigned.itemId]);
 changeBookingField(window,f,'companyId',companyA.id);
 assert.deepEqual(items(),['',a.itemId]);assert.equal(f.elements.namedItem('itemId').value,a.itemId);assert.equal(f.elements.namedItem('subItemId').value,a.subItemId);
 assert.match(document.getElementById('bookingItemHint').textContent,/selected company/);
 changeBookingField(window,f,'companyId',companyB.id);
 assert.equal(document.getElementById('scheduleForm'),f);assert.deepEqual(items(),['',b.itemId]);assert.equal(f.elements.namedItem('itemId').value,'');assert.equal(f.elements.namedItem('subItemId').value,'');assert.equal(f.elements.namedItem('subItemId').disabled,true);assert.equal(f.elements.namedItem('subItemId').options.length,1);
 assert.equal(f.elements.namedItem('text').value,'Check the saved design');assert.equal(f.elements.namedItem('title').value,'Configuration review');assert.equal(f.elements.namedItem('endTime').value,'10:45');
 changeBookingField(window,f,'itemId',b.itemId);f.elements.namedItem('subItemId').value=b.subItemId;
 changeBookingField(window,f,'companyId',emptyCompany.id);assert.deepEqual(items(),['']);assert.equal(f.elements.namedItem('subItemId').disabled,true);
 changeBookingField(window,f,'companyId','');assert.deepEqual(items(),['',a.itemId,b.itemId,unassigned.itemId]);await settle();assert.equal(db.calls.length,writes);
});
test('Schedule company items: save guards, reopening and project Calendar edits respect the selected company',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,{a,b,companyA,companyB}=await companyScheduleFixture(ctx);
 let f=await projectItemBooking(ctx,a);changeBookingField(window,f,'companyId',companyB.id);
 const bad=document.createElement('option');bad.value=a.itemId;f.elements.namedItem('itemId').append(bad);f.elements.namedItem('itemId').value=a.itemId;
 const writes=db.calls.length;assert.throws(()=>api.saveRange(f),/project item.*selected company/);assert.equal(db.calls.length,writes);assert.equal(api.state().schedule.length,0);bad.remove();
 changeBookingField(window,f,'companyId',companyA.id);changeBookingField(window,f,'itemId',a.itemId);f.elements.namedItem('subItemId').value=a.subItemId;api.saveRange(f);await settle();
 assert.equal(db.row.document.data.projectPlans[0].companyId,companyA.id);assert.ok(db.row.document.data.schedule.every(row=>row.itemId===a.itemId&&row.subItemId===a.subItemId));
 api.openRangeEditor('2026-10-20','09:15');f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('itemId').value,a.itemId);assert.equal(f.elements.namedItem('subItemId').value,a.subItemId);assert.equal(f.querySelector('#bookingItem option[value="'+b.itemId+'"]'),null);
 const planId=api.state().projectPlans[0].id;api.editPlan(planId);f=document.getElementById('planForm');assert.equal(f.elements.namedItem('itemId').value,a.itemId);changeBookingField(window,f,'companyId',companyB.id);assert.equal(f.elements.namedItem('itemId').value,'');assert.equal(f.elements.namedItem('subItemId').disabled,true);
 f.elements.namedItem('itemId').append(bad);f.elements.namedItem('itemId').value=a.itemId;const planWrites=db.calls.length;assert.throws(()=>api.savePlan(f),/project item.*selected company/);assert.equal(db.calls.length,planWrites);bad.remove();
 changeBookingField(window,f,'itemId',b.itemId);f.elements.namedItem('subItemId').value=b.subItemId;api.savePlan(f);await settle();assert.ok(api.state().schedule.every(row=>row.companyId===companyB.id&&row.itemId===b.itemId&&row.subItemId===b.subItemId));
 const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);reopened.api.openRangeEditor('2026-10-20','09:15');const saved=reopened.document.getElementById('scheduleForm');assert.equal(saved.elements.namedItem('companyId').value,companyB.id);assert.equal(saved.elements.namedItem('itemId').value,b.itemId);assert.equal(saved.elements.namedItem('subItemId').value,b.subItemId);assert.equal(saved.querySelector('#bookingItem option[value="'+a.itemId+'"]'),null);api.validate(api.state());
});
test('Schedule company items: older cross-company bookings load safely and editors remove the incompatible selection',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,{a,b,companyA,companyB}=await companyScheduleFixture(ctx);
 let f=await projectItemBooking(ctx,a);changeBookingField(window,f,'companyId',companyA.id);api.saveRange(f);await settle();
 // Reproduce a booking the previous project-only dropdown allowed to be saved.
 api.mutate(d=>{for(const row of [...d.projectPlans,...d.schedule])Object.assign(row,{companyId:companyB.id,companyName:companyB.name});});await settle();
 const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);const other=reopened.api;assert.equal(other.state().schedule[0].itemId,a.itemId);
 other.editPlan(other.state().projectPlans[0].id);f=reopened.document.getElementById('planForm');assert.equal(f.elements.namedItem('itemId').value,'');assert.equal(f.elements.namedItem('subItemId').disabled,true);assert.equal(f.querySelector('#bookingItem option[value="'+a.itemId+'"]'),null);assert.ok(f.querySelector('#bookingItem option[value="'+b.itemId+'"]'));
 other.openRangeEditor('2026-10-20','09:15');f=reopened.document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('itemId').value,'');assert.equal(f.elements.namedItem('subItemId').options.length,1);assert.equal(other.state().schedule[0].itemId,a.itemId);other.saveRange(f);await settle();assert.ok(other.state().schedule.every(row=>row.companyId===companyB.id&&!row.itemId&&!row.subItemId));other.validate(other.state());
});
test('Schedule company items: deleted historical links stay in their original company and cannot follow a company change',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,{a,companyA,companyB}=await companyScheduleFixture(ctx);
 let f=await projectItemBooking(ctx,a);changeBookingField(window,f,'companyId',companyA.id);api.saveRange(f);await settle();api.mutate(d=>d.specs=d.specs.filter(item=>item.id!==a.itemId));await settle();
 api.openRangeEditor('2026-10-20','09:15');f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('itemId').value,a.itemId);assert.match(f.elements.namedItem('itemId').selectedOptions[0].textContent,/saved item/);assert.equal(f.elements.namedItem('subItemId').value,a.subItemId);api.saveRange(f);await settle();
 api.openRangeEditor('2026-10-20','09:15');f=document.getElementById('scheduleForm');changeBookingField(window,f,'companyId',companyB.id);assert.equal(f.querySelector('#bookingItem option[value="'+a.itemId+'"]'),null);assert.equal(f.elements.namedItem('subItemId').disabled,true);
 const bad=document.createElement('option');bad.value=a.itemId;f.elements.namedItem('itemId').append(bad);f.elements.namedItem('itemId').value=a.itemId;const writes=db.calls.length;assert.throws(()=>api.saveRange(f),/project item.*selected project/);assert.equal(db.calls.length,writes);bad.remove();api.saveRange(f);await settle();assert.ok(api.state().schedule.every(row=>row.companyId===companyB.id&&!row.itemId&&!row.subItemId));
});
test('workspace Momo discovery letter stays attached during travel and dragging on phone and laptop without cloud writes',async t=>{
 for(const width of [375,1280]){
  const ctx=await app(t,{styles:true}),{api,document,window,db,frames}=ctx;Object.defineProperty(window,'innerWidth',{configurable:true,value:width});Object.defineProperty(window,'innerHeight',{configurable:true,value:800});window.dispatchEvent(new window.Event('resize'));const task=addMainTask(api,document,'Follow up discovery');api.mutate(d=>{d.tasks[0].boardStatus='blocked';});await settle();assert.equal(api.hub.moments.deliver(),true);const letter=document.getElementById('momoDiscovery'),pet=document.getElementById('hubPet'),writes=db.calls.length,before=pet.style.left;assert.equal(letter.closest('#hubPet'),pet);assert.equal(window.getComputedStyle(letter).position,'absolute');assert.ok(parseFloat(window.getComputedStyle(letter).minWidth)>=44);api.hub.life.travel(20,100,()=>{},1600);assert.equal(api.hub.life.busy(),true);let frame=[...frames.values()].at(-1);frames.clear();frame(window.performance.now()+800);assert.notEqual(pet.style.left,before);assert.equal(letter.closest('#hubPet'),pet);api.hub.moments.tick();assert.equal(document.getElementById('momoDiscovery'),letter);assert.equal(letter.style.left,'');assert.equal(letter.style.top,'');
  pointer(window,pet.querySelector(':scope > button'),'pointerdown',100,300);pointer(window,document,'pointermove',160,370);assert.equal(letter.closest('#hubPet'),pet);pointer(window,document,'pointerup',160,370);await settle();assert.equal(db.calls.length,writes);const letterPosition=pet.style.left;pointer(window,letter,'pointerdown',120,370);pointer(window,document,'pointermove',125,370);pointer(window,document,'pointerup',125,370);assert.equal(pet.style.left,letterPosition);letter.click();assert.match(document.getElementById('modalBody').textContent,/Follow up discovery/);assert.equal(document.getElementById('momoDiscovery'),null);api.closeModal();assert.ok(api.state().tasks.some(t=>t.id===task));assert.equal(db.calls.length,writes);
 }
});

test('sub-task quick feedback saves only the chosen child with a save-time stamp and persists through views, cloud, backups, edits and reports',async t=>{
 const {api,document,window,db}=await app(t),id=addMainTask(api,document,'Review procurement design'),subId=addTaskSub(api,document,id,'Check <receipt>','Keep child remarks','Earlier child feedback','Blocked'),sibling=addTaskSub(api,document,id,'Check invoice','Sibling remarks','Sibling feedback');api.mutate(d=>d.tasks.find(t=>t.id===id).feedback='Main task feedback');await settle();const before=copy(api.state().tasks.find(t=>t.id===id)),RealDate=window.Date;let time='2026-10-21T14:00:00';window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[time]));}static now(){return new RealDate(time).getTime();}};
 api.showTab('tasks');let card=document.querySelector('.task-child[data-subtask-id="'+subId+'"]');assert.ok(card.querySelector('[data-hub="subtask-feedback"]'));assert.equal(document.querySelectorAll('.task-action-buttons [data-hub="task-feedback"]').length,1);const writes=db.calls.length;card.querySelector('[data-hub="subtask-feedback"]').click();await settle();let f=document.getElementById('hubTaskFeedback');assert.equal(f.querySelector('h3').textContent,'Review procurement design');assert.equal(f.elements.namedItem('feedbackTarget').value,subId);assert.match(document.getElementById('hubTaskFeedbackHistory').textContent,/Earlier child feedback/);assert.doesNotMatch(document.getElementById('hubTaskFeedbackHistory').textContent,/Main task feedback|Sibling feedback/);assert.equal(db.calls.length,writes);
 time='2026-10-21T14:23:00';f.elements.namedItem('feedback').value='  Receipt confirmed <img src=x>\nReady for review  ';submitLocal(window,f);await settle();const feedback='Earlier child feedback\n\nReceipt confirmed <img src=x>\nReady for review [21-10-2026 14:23]',task=api.state().tasks.find(t=>t.id===id),child=task.subTasks.find(s=>s.id===subId);assert.equal(child.feedback,feedback);assert.equal(child.updatedAt,new RealDate(time).toISOString());assert.deepEqual(copy(task),{...before,subTasks:before.subTasks.map(s=>s.id===subId?{...s,feedback,updatedAt:child.updatedAt}:s)});assert.equal(task.subTasks.find(s=>s.id===sibling).feedback,'Sibling feedback');assert.equal(db.calls.length,writes+1);assert.equal(db.row.document.data.tasks[0].subTasks[0].feedback,feedback);assert.equal(document.querySelector('.task-child[data-subtask-id="'+subId+'"] .task-child-notes img'),null);assert.match(document.querySelector('.task-child[data-subtask-id="'+subId+'"] .task-child-notes').textContent,/21-10-2026 14:23/);api.hub.submit(f);await settle();assert.equal(db.calls.length,writes+1);
 api.hub.setBoard(true);api.showTab('tasks');await hubAction(api,'task-detail',{id});let detail=document.querySelector('.task-detail-subtask[data-subtask-id="'+subId+'"]');assert.match(detail.textContent,/Receipt confirmed <img src=x>/);detail.querySelector('[data-hub="subtask-feedback"]').click();await settle();assert.equal(document.getElementById('hubTaskFeedbackTarget').value,subId);api.closeModal();api.editTaskSub(id,subId);f=document.getElementById('taskSubForm');assert.equal(f.elements.namedItem('feedback').value,feedback);f.elements.namedItem('remarks').value='Updated child remarks';api.saveTaskSub(f);api.editRecord('tasks',id);f=document.getElementById('editForm');f.elements.namedItem('task').value='Updated main title';api.saveEdit(f);await settle();assert.equal(api.state().tasks[0].subTasks[0].feedback,feedback);assert.equal(api.parseBackup(api.payload(api.state())).tasks[0].subTasks[0].feedback,feedback);const report=window.WorkHubReports.build(api.state(),{asOf:'2026-10-21'}).sheets.find(s=>s.name==='Task notes');assert.ok(report.rows.some(row=>row.values[0]==='Updated main title'&&row.values.includes(feedback)));const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);assert.equal(reopened.api.state().tasks[0].subTasks[0].feedback,feedback);
});
test('sub-task quick feedback chooser shows the selected history, keeps typed drafts and never copies feedback between targets',async t=>{
 const {api,document,window,db}=await app(t),id=addMainTask(api,document,'Main task'),a=addTaskSub(api,document,id,'First step','A remarks','A feedback'),b=addTaskSub(api,document,id,'Second step','B remarks','B feedback');api.mutate(d=>d.tasks[0].feedback='Main feedback');await settle();await hubAction(api,'task-feedback',{id});const f=document.getElementById('hubTaskFeedback'),target=f.elements.namedItem('feedbackTarget'),writes=db.calls.length;assert.equal(target.value,'');f.elements.namedItem('feedback').value='My typed update';for(const [value,history]of [[a,'A feedback'],[b,'B feedback'],['','Main feedback']]){target.value=value;target.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(f.elements.namedItem('feedback').value,'My typed update');assert.equal(document.querySelector('#hubTaskFeedbackHistory details p').textContent,history);}assert.equal(db.calls.length,writes);target.value=b;target.dispatchEvent(new window.Event('change',{bubbles:true}));api.hub.submit(f);await settle();assert.equal(api.state().tasks[0].feedback,'Main feedback');assert.equal(api.state().tasks[0].subTasks[0].feedback,'A feedback');assert.match(api.state().tasks[0].subTasks[1].feedback,/^B feedback\n\nMy typed update \[/);
 await hubAction(api,'subtask-feedback',{parent:id,id:a});const current=document.getElementById('hubTaskFeedback');current.elements.namedItem('feedback').value='Cancelled child draft';api.closeModal();const calls=db.calls.length;assert.throws(()=>api.hub.submit(current),/Reopen Add feedback/);assert.equal(db.calls.length,calls);
});
test('sub-task quick feedback rejects foreign or deleted children, blank, oversized, conflicting and wrong-account saves while keeping the draft',async t=>{
 const {api,document,window,db}=await app(t),id=addMainTask(api,document,'Protected main task'),sub=addTaskSub(api,document,id,'Chosen subtask','Remarks','Original feedback'),other=addMainTask(api,document,'Other main task'),foreign=addTaskSub(api,document,other,'Foreign subtask','','Foreign feedback');await settle();await hubAction(api,'subtask-feedback',{parent:id,id:sub});const f=document.getElementById('hubTaskFeedback'),target=f.elements.namedItem('feedbackTarget');let calls=db.calls.length;f.elements.namedItem('feedback').value='  ';assert.throws(()=>api.hub.submit(f),/Enter feedback/);f.elements.namedItem('feedback').value='Keep this draft';target.append(new window.Option('Foreign child',foreign));target.value=foreign;assert.throws(()=>api.hub.submit(f),/Sub-task no longer exists/);assert.equal(db.calls.length,calls);target.value=sub;api.cloud.conflict=true;assert.throws(()=>api.hub.submit(f),/reload cloud records/);api.cloud.conflict=false;api.mutate(d=>d.tasks.find(t=>t.id===id).subTasks[0].feedback='x'.repeat(32760));await settle();calls=db.calls.length;assert.throws(()=>api.hub.submit(f),/Feedback history is full/);assert.equal(db.calls.length,calls);assert.equal(f.elements.namedItem('feedback').value,'Keep this draft');api.mutate(d=>d.tasks.find(t=>t.id===id).subTasks=[]);await settle();calls=db.calls.length;assert.throws(()=>api.hub.submit(f),/Sub-task no longer exists/);assert.equal(db.calls.length,calls);assert.equal(api.state().tasks.find(t=>t.id===id).feedback,'');assert.equal(api.state().tasks.find(t=>t.id===other).subTasks[0].feedback,'Foreign feedback');await assert.rejects(hubAction(api,'subtask-feedback',{parent:id,id:sub}),/Sub-task no longer exists/);
 api.closeModal();await hubAction(api,'subtask-feedback',{parent:other,id:foreign});const stale=document.getElementById('hubTaskFeedback');stale.elements.namedItem('feedback').value='Previous account';calls=db.calls.length;api.cloud.user={id:'22222222-2222-4222-8222-222222222222'};api.showTab('tasks');assert.equal(document.getElementById('modal').open,false);assert.throws(()=>api.hub.submit(stale),/signing in/);assert.equal(db.calls.length,calls);assert.equal(stale.elements.namedItem('feedback').value,'Previous account');
});


async function maintainLeave(ctx, year='2026', annual=12, used=10, medical=14, mcUsed=11) {
 const {api,document}=ctx; api.hub.leaveBalances.settings(year);
 const f=document.getElementById('leaveBalanceForm');
 fill(f,{'annual-leave-allowance':String(annual),'annual-leave-used':String(used),'medical-leave-allowance':String(medical),'medical-leave-used':String(mcUsed)});
 api.hub.leaveBalances.saveSettings(f); await settle(); return f;
}
test('leave allowances: searchable Settings saves yearly AL and MC balances through cloud, backup and reload',async t=>{
 const ctx=await app(t),{api,document,db,window}=ctx;
 const button=document.getElementById('leaveBalanceSettingsButton'); assert.ok(button); assert.ok(button.closest('#settingsGroup-work'));
 document.getElementById('settingsSearch').value='annual leave';document.getElementById('settingsSearch').dispatchEvent(new window.Event('input',{bubbles:true}));await settle();assert.equal(button.closest('.settings-entry').hidden,false);
 api.hub.leaveBalances.settings('2026'); const f=document.getElementById('leaveBalanceForm'), writes=db.calls.length;
 fill(f,{'annual-leave-allowance':'12','annual-leave-used':'10','medical-leave-allowance':'14','medical-leave-used':'11'});f.elements.namedItem('annual-leave-used').dispatchEvent(new window.Event('input',{bubbles:true}));
 assert.match(document.getElementById('leaveSettingsPreview').textContent,/2 days remaining/); assert.equal(db.calls.length,writes);
 f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();
 assert.equal(api.state().workhub.leaveBalances[0]['annual-leave'].openingUsed,10);
 assert.equal(db.row.document.data.workhub.leaveBalances[0]['medical-leave'].allowance,14);
 const backup=api.parseBackup(api.payload(api.state()));assert.deepEqual(copy(backup.workhub.leaveBalances),copy(api.state().workhub.leaveBalances));
 api.setMonth('2026-10');api.showTab('schedule');assert.match(document.getElementById('leaveScheduleBalances').textContent,/2 days remaining.*3 days remaining/s);
 const restored=await app(t,{remote:copy(db.row),login:false});await restored.api.loadCloud(sessionUser);await settle();assert.equal(restored.window.WorkHubLeaveBalancesEngine.balance(restored.api.state(),'2026','annual-leave').remaining,2);
});
test('leave allowances: two remaining AL days may be booked; an extra day is blocked, editing does not double count, deletion releases days',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx;await maintainLeave(ctx);
 let f=await leaveEditor(ctx,'annual-leave',{date:'2026-10-26'});fill(f,{endDate:'2026-10-28'});f.elements.namedItem('endDate').dispatchEvent(new window.Event('input',{bubbles:true}));
 assert.match(f.querySelector('[data-leave-range-preview]').textContent,/-1 day\(s\) remaining after saving/);assert.match(f.querySelector('.leave-limit-warning').textContent,/only 2 day/);
 const writes=db.calls.length;assert.throws(()=>api.saveRange(f),/only 2 day/);assert.equal(api.state().schedule.length,0);assert.equal(db.calls.length,writes);
 fill(f,{endDate:'2026-10-27'});api.saveRange(f);await settle();assert.equal(window.WorkHubLeaveBalancesEngine.balance(api.state(),'2026','annual-leave').remaining,0);
 api.openRangeEditor('2026-10-26','09:00');f=document.getElementById('scheduleForm');assert.match(f.querySelector('[data-leave-range-preview]').textContent,/0 day\(s\) remaining after saving/);fill(f,{leaveContact:'Updated cover'});api.saveRange(f);await settle();
 f=await leaveEditor(ctx,'annual-leave',{date:'2026-10-28'});assert.throws(()=>api.saveRange(f),/only 0 day/);api.closeModal();
 api.closeModal();api.mutate(d=>d.schedule=[]);await settle();assert.equal(window.WorkHubLeaveBalancesEngine.balance(api.state(),'2026','annual-leave').remaining,2);
});
test('leave allowances: half-days, custom hours and MC use separate balances and preserve HR submission details',async t=>{
 const ctx=await app(t),{api,document,window}=ctx;await maintainLeave(ctx);
 let f=await leaveEditor(ctx,'annual-leave',{date:'2026-10-26'});f.elements.namedItem('leavePortion').value='morning';f.elements.namedItem('leavePortion').dispatchEvent(new window.Event('change',{bubbles:true}));
 assert.match(f.querySelector('[data-leave-range-preview]').textContent,/0.5 day\(s\) in this range.*1.5 day\(s\) remaining/s);api.saveRange(f);await settle();
 f=await leaveEditor(ctx,'annual-leave',{date:'2026-10-27'});f.querySelector('[data-action="booking-duration"][data-minutes="45"]').click();await settle();assert.equal(f.querySelector('[data-leave-custom-days]').hidden,false);
 f.elements.namedItem('leaveDaysPerDate').value='0.5';f.elements.namedItem('leaveDaysPerDate').dispatchEvent(new window.Event('input',{bubbles:true}));assert.match(f.querySelector('[data-leave-range-preview]').textContent,/1 day\(s\) remaining after saving/);api.saveRange(f);await settle();assert.equal(api.state().schedule.at(-1).leave.daysPerDate,.5);
 f=await leaveEditor(ctx,'medical-leave',{date:'2026-10-28'});fill(f,{mcSubmitted:'yes',mcSubmittedDate:'2026-10-28'});api.saveRange(f);await settle();assert.equal(window.WorkHubLeaveBalancesEngine.balance(api.state(),'2026','medical-leave').remaining,2);assert.equal(window.WorkHubLeaveBalancesEngine.balance(api.state(),'2026','annual-leave').remaining,1);assert.equal(api.state().schedule.at(-1).leave.mcSubmitted,true);api.validate(api.state());
});
test('leave allowances: years and weekday policy stay explicit and invalid Settings never write',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx;await maintainLeave(ctx);api.hub.leaveBalances.settings('2026');let f=document.getElementById('leaveBalanceForm'), writes=db.calls.length;
 fill(f,{'annual-leave-allowance':'-1'});assert.throws(()=>api.hub.leaveBalances.saveSettings(f),/leave days/);assert.equal(db.calls.length,writes);
 fill(f,{'annual-leave-allowance':'12',year:'2027'});assert.throws(()=>api.hub.leaveBalances.saveSettings(f),/Open year/);document.querySelector('[data-leave-balance="load-year"]').click();f=document.getElementById('leaveBalanceForm');assert.equal(f.elements.namedItem('annual-leave-allowance').value,'');assert.equal(f.elements.namedItem('annual-leave-used').value,'0');assert.equal(db.calls.length,writes);api.closeModal();
 f=await leaveEditor(ctx,'annual-leave',{date:'2026-10-24'});assert.match(f.querySelector('[data-leave-range-preview]').textContent,/0 day\(s\) in this range/);api.closeModal();api.hub.leaveBalances.settings('2026');f=document.getElementById('leaveBalanceForm');f.querySelector('[name="annual-leave-weekday"][value="6"]').checked=true;api.hub.leaveBalances.saveSettings(f);await settle();
 f=await leaveEditor(ctx,'annual-leave',{date:'2026-10-24'});assert.match(f.querySelector('[data-leave-range-preview]').textContent,/1 day\(s\) in this range/);api.closeModal();
 f=await leaveEditor(ctx,'annual-leave',{date:'2026-12-31'});fill(f,{endDate:'2027-01-01'});f.elements.namedItem('endDate').dispatchEvent(new window.Event('change',{bubbles:true}));assert.match(f.querySelector('[data-leave-range-preview]').textContent,/2027.*set this year’s allowance/s);assert.match(f.querySelector('[data-leave-balance-years]').textContent,/2026 \/ 2027/);
});
test('leave allowances: the settings draft closes on account change and cannot be saved for the next owner',async t=>{
 const ctx=await app(t),{api,document,db}=ctx;api.hub.leaveBalances.settings('2026');const f=document.getElementById('leaveBalanceForm'), writes=db.calls.length;
 api.cloud.user={id:'22222222-2222-4222-8222-222222222222',email:'other@example.com'};api.showTab('schedule');assert.equal(document.getElementById('modal').open,false);assert.throws(()=>api.hub.leaveBalances.saveSettings(f),/current account/);assert.equal(db.calls.length,writes);
});

test('leave allowances: project Plan activity shows balances and stale Settings must be reopened',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx;await maintainLeave(ctx);await addProjectDeliverable(ctx);api.editPlan('','2026-10-29');let f=document.getElementById('planForm');assert.match(f.querySelector('[data-leave-range-current]').textContent,/2 days remaining/);f.elements.namedItem('date').value='2027-01-04';f.elements.namedItem('date').dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(f.querySelector('[data-leave-balance-years]').textContent,'2027');assert.match(f.querySelector('[data-leave-range-current]').textContent,/Allowance not set/);api.closeModal();
 api.hub.leaveBalances.settings('2026');f=document.getElementById('leaveBalanceForm');api.mutate(d=>d.workhub.leaveBalances[0]['annual-leave'].openingUsed=9);await settle();const writes=db.calls.length;assert.throws(()=>api.hub.leaveBalances.saveSettings(f),/changed while this form/);assert.equal(db.calls.length,writes);assert.equal(api.state().workhub.leaveBalances[0]['annual-leave'].openingUsed,9);
});

test('leave allowances: concurrent bookings that jointly exceed an allowance require conflict review',async t=>{
 const {api}=await app(t);api.mutate(d=>{const y={id:'2026','annual-leave':{allowance:1,openingUsed:0,weekdays:[1,2,3,4,5]},'medical-leave':{allowance:null,openingUsed:0,weekdays:[0,1,2,3,4,5,6]}};d.workhub.leaveBalances=[y];});await settle();
 const base=JSON.parse(api.payload(api.state())),local=copy(base),remote=copy(base);
 const leave=(date,id)=>({date,time:'09:00',endTime:'10:00',kind:'annual-leave',bookingId:id,planId:'',linkId:'',activity:'',location:'',text:'',title:'Annual Leave',leave:{portion:'full',status:'Planned',contact:'',reference:'',mcSubmitted:false,mcSubmittedDate:''}});
 local.data.schedule.push(leave('2026-10-26','device-a'));remote.data.schedule.push(leave('2026-10-27','device-b'));
 const result=api.queueCloudReview({document:remote,revision:2,mutation_id:'other-device'},{document:local,baseDocument:base,pending:local,revision:1});assert.equal(result.conflict,true);assert.equal(result.document.data.schedule.length,1);
});


async function addLeaveType(ctx,name='Compassionate Leave',code='CL'){
 const {api,document}=ctx;api.hub.leaveBalances.editType();const f=document.getElementById('leaveTypeForm');fill(f,{name,code});api.hub.leaveBalances.saveType(f);await settle();return api.state().workhub.leaveTypes.at(-1).id;
}
test('maintained leave types: adding a type populates Schedule and its yearly allowances, saves and reopens',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx,id=await addLeaveType(ctx);api.setMonth('2026-10');api.showTab('schedule');assert.ok(document.querySelector('.leave-balance-card[data-leave-kind="'+id+'"]'));assert.match(document.getElementById('leaveScheduleBalances').textContent,/Compassionate Leave/);
 api.hub.leaveBalances.settings('2026');let f=document.getElementById('leaveBalanceForm');assert.ok(f.elements.namedItem(id+'-allowance'));fill(f,{[id+'-allowance']:'2',[id+'-used']:'0.5'});api.hub.leaveBalances.saveSettings(f);await settle();f=await leaveEditor(ctx,id,{date:'2026-10-26'});assert.equal(f.elements.namedItem('kind').value,id);fill(f,{endDate:'2026-10-27',leavePortion:'morning'});f.elements.namedItem('leavePortion').dispatchEvent(new window.Event('change',{bubbles:true}));assert.match(f.querySelector('[data-leave-range-preview]').textContent,/0.5 day\(s\) remaining/);api.saveRange(f);await settle();assert.ok(api.state().schedule.every(s=>s.kind===id&&!s.travel&&!s.planId));assert.equal(window.WorkHubLeaveBalancesEngine.balance(api.state(),'2026',id).remaining,.5);
 const backup=api.parseBackup(api.payload(api.state()));assert.equal(backup.workhub.leaveTypes.at(-1).name,'Compassionate Leave');const report=window.WorkHubReports.build(api.state(),{asOf:'2026-10-28'});assert.equal(report.sheets.find(s=>s.name==='Schedule').rows[0].values[5],'Compassionate Leave');
 const next=await app(t,{remote:copy(db.row),login:false});await next.api.loadCloud(sessionUser);assert.equal(next.window.WorkHubLeaveBalancesEngine.balance(next.api.state(),'2026',id).remaining,.5);next.api.openRangeEditor('2026-10-26','09:00');assert.equal(next.document.getElementById('scheduleForm').elements.namedItem('kind').value,id);api.validate(api.state());
});
test('maintained leave types: rename, archive and restore preserve bookings and escape maintained names',async t=>{
 const ctx=await app(t),{api,document,window}=ctx,id=await addLeaveType(ctx);let f=await leaveEditor(ctx,id,{date:'2026-10-26'});api.saveRange(f);await settle();const before=copy(api.state().schedule);api.hub.leaveBalances.editType(id);f=document.getElementById('leaveTypeForm');fill(f,{name:'Care <img src=x> Leave',code:'CARE'});f.elements.namedItem('archived').checked=true;api.hub.leaveBalances.saveType(f);await settle();assert.deepEqual(copy(api.state().schedule),before);assert.equal(document.querySelector('#leaveTypesManager img'),null);assert.match(document.getElementById('leaveTypesManager').textContent,/Care <img src=x> Leave/);api.closeModal();
 api.openRangeEditor('2026-10-27','09:00','',true);f=document.getElementById('scheduleForm');assert.equal(f.querySelector('option[value="'+id+'"]'),null);api.closeModal();api.openRangeEditor('2026-10-26','09:00');f=document.getElementById('scheduleForm');assert.match(f.elements.namedItem('kind').selectedOptions[0].textContent,/archived/);assert.equal(f.querySelector('[data-leave-editor] img'),null);fill(f,{leaveContact:'Keep this historical note'});api.saveRange(f);await settle();
 api.hub.leaveBalances.editType(id);f=document.getElementById('leaveTypeForm');f.elements.namedItem('archived').checked=false;api.hub.leaveBalances.saveType(f);await settle();api.closeModal();api.openRangeEditor('2026-10-27','09:00','',true);assert.match(document.getElementById('scheduleForm').querySelector('option[value="'+id+'"]').textContent,/Care <img src=x> Leave/);api.validate(api.state());
});
test('maintained leave types: invalid duplicates and changed accounts cannot save a type draft',async t=>{
 const ctx=await app(t),{api,document,db}=ctx;api.hub.leaveBalances.editType();let f=document.getElementById('leaveTypeForm');fill(f,{name:'Other Leave',code:'AL'});let writes=db.calls.length;assert.throws(()=>api.hub.leaveBalances.saveType(f),/valid and unique/);assert.equal(db.calls.length,writes);api.cloud.user={id:'22222222-2222-4222-8222-222222222222',email:'next@example.com'};api.showTab('schedule');assert.equal(document.getElementById('modal').open,false);assert.throws(()=>api.hub.leaveBalances.saveType(f),/current account/);assert.equal(db.calls.length,writes);
});
test('maintained leave types: card setup focuses the matching allowance and changed type lists protect open drafts',async t=>{
 const ctx=await app(t),{api,document,db}=ctx,id=await addLeaveType(ctx);api.closeModal();api.setMonth('2026-10');api.showTab('schedule');document.querySelector('.leave-balance-card[data-leave-kind="'+id+'"] [data-leave-balance="settings"]').click();let f=document.getElementById('leaveBalanceForm');assert.equal(document.activeElement,f.elements.namedItem(id+'-allowance'));const writes=db.calls.length;api.mutate(d=>d.workhub.leaveTypes.push({id:'leave-study',name:'Study Leave',code:'SL',archived:false}));await settle();assert.throws(()=>api.hub.leaveBalances.saveSettings(f),/Leave types changed/);assert.equal(db.calls.length,writes+1);api.closeModal();api.hub.leaveBalances.settings('2026');assert.ok(document.getElementById('leaveBalanceForm').elements.namedItem('leave-study-allowance'));
});

test('Excel setup UI: preview creates a new draft, retains existing releases, and saves through cloud and backup', async t => {
  const { api, document, db } = await app(t), ui = api.hub.validator;
  api.showTab('validator');
  await ui.handle({ dataset: { val: 'example' } });
  ui.publish(); await settle();
  const saved = copy(api.state().workhub.validator.templates[0]), writes = db.calls.length;
  const bytes = readFileSync(new URL('../validation-setup-template.xlsx', import.meta.url));
  await ui.loadSetupFile({ name: 'setup.xlsx', size: bytes.length, arrayBuffer: async () => bytes });
  assert.ok(document.querySelector('#valSetupReview'));
  assert.match(document.getElementById('valSetupReview').textContent, /6Columns/);
  assert.equal(db.calls.length, writes);
  assert.equal(ui.snapshot().draft.id, saved.id);
  await ui.handle(document.querySelector('[data-val="apply-setup"]'));
  assert.equal(document.querySelector('dialog[open]'), null);
  const draft = ui.snapshot().draft;
  assert.notEqual(draft.id, saved.id);
  assert.equal(draft.columns.length, 6);
  assert.equal(draft.rules.length, 3);
  assert.equal(draft.lookups[1].rows[0][1], '0001');
  assert.equal(ui.snapshot().dirty, true);
  assert.equal(db.calls.length, writes);
  assert.equal(ui.saveDraft(), true); await settle();
  assert.equal(api.state().workhub.validator.templates.length, 2);
  assert.deepEqual(copy(api.state().workhub.validator.templates[0]), saved);
  const backup = api.parseBackup(api.payload(api.state()));
  assert.equal(backup.workhub.validator.templates[1].rules.length, 3);
  const reopened = await app(t, { remote: copy(db.row), login: false });
  await reopened.api.loadCloud(sessionUser); await settle();
  assert.equal(reopened.api.state().workhub.validator.templates[1].lookups[1].rows[0][1], '0001');
});

test('Excel setup UI: invalid files, cancelled previews and changed drafts preserve the current work without saves', async t => {
  const { api, document, db, window } = await app(t), ui = api.hub.validator;
  api.showTab('validator');
  await ui.handle({ dataset: { val: 'example' } });
  const bytes = readFileSync(new URL('../validation-setup-template.xlsx', import.meta.url));
  const original = copy(ui.snapshot().draft), writes = db.calls.length;
  await assert.rejects(ui.loadSetupFile({ name: 'data.csv', size: 10 }), /xlsx setup/);
  assert.deepEqual(copy(ui.snapshot().draft), original);
  await ui.loadSetupFile({ name: 'setup.xlsx', size: bytes.length, arrayBuffer: async () => bytes });
  await ui.handle(document.querySelector('[data-val="cancel-setup"]'));
  assert.deepEqual(copy(ui.snapshot().draft), original);
  let release;
  const pending = ui.loadSetupFile({ name: 'late.xlsx', size: bytes.length, arrayBuffer: () => new Promise(resolve => { release = resolve; }) });
  const field = document.querySelector('#valMetaForm [name="name"]');
  field.value = 'Keep my updated draft'; field.dispatchEvent(new window.Event('input', { bubbles: true }));
  release(bytes); await pending;
  assert.equal(document.querySelector('dialog[open]'), null);
  ui.saveDraft(); await settle();
  assert.equal(api.state().workhub.validator.templates[0].name, 'Keep my updated draft');
  assert.equal(db.calls.length, writes + 1);
});

test('Excel setup UI: late reads and stale preview buttons cannot cross accounts', async t => {
  const { api, document } = await app(t), ui = api.hub.validator;
  api.showTab('validator');
  const bytes = readFileSync(new URL('../validation-setup-template.xlsx', import.meta.url));
  await ui.loadSetupFile({ name: 'setup.xlsx', size: bytes.length, arrayBuffer: async () => bytes });
  const oldApply = document.querySelector('[data-val="apply-setup"]');
  api.cloud.user = { id: '22222222-2222-4222-8222-222222222222', email: 'other@example.com' };
  ui.sync();
  assert.equal(document.querySelector('dialog[open]'), null);
  await assert.rejects(ui.handle(oldApply), /preview has changed/);
  let release;
  const pending = ui.loadSetupFile({ name: 'late.xlsx', size: bytes.length, arrayBuffer: () => new Promise(resolve => { release = resolve; }) });
  api.cloud.user = sessionUser; ui.sync(); release(bytes); await pending;
  assert.equal(document.querySelector('dialog[open]'), null);
  assert.equal(ui.snapshot().draft, null);
  assert.equal(api.state().workhub.validator.templates.length, 0);
});

test('requested companion naps survive scenes, work avoidance, weather, home clicks and navigation until the companion is activated', async t => {
  const { api, document, window, frames, db } = await app(t, { adventures: true });
  const life = api.hub.life, pet = document.getElementById('hubPet');
  let now = window.Date.now(); window.Date.now = () => now;
  life.goHome();
  for (const [id, fn] of [...frames]) { frames.delete(id); fn(window.performance.now() + 10000); }
  life.tick();
  assert.equal(life.sleeping(), true);
  assert.equal(pet.dataset.pose, 'nap');
  assert.equal(life.clearForWork(), false);
  assert.equal(life.sceneAvailable(), false);
  assert.equal(life.scene({ pose: 'lab-cower' }), false);
  assert.equal(life.umbrella(), false);
  assert.equal(life.gesture('wave'), false);
  document.getElementById('hubMomoHome').click();
  await api.hub.handle({ dataset: { hub: 'celebrate' } });
  api.showTab('schedule');
  document.getElementById('month').focus();
  now += 3600000;
  life.tick(); api.hub.adventures.tick(); life.tick();
  assert.equal(pet.dataset.pose, 'nap');
  assert.equal(life.sleeping(), true);
  document.activeElement.blur();
  pet.querySelector(':scope > button').click();
  assert.equal(life.sleeping(), false);
  assert.equal(pet.dataset.pose, 'stretch');
  assert.equal(db.calls.length, 0);
});

test('an interrupted trip home still settles into the requested nap', async t => {
  const { api, document, window, frames } = await app(t), life = api.hub.life;
  life.goHome();
  api.editRecord('tasks');
  for (const [id, fn] of [...frames]) { frames.delete(id); fn(window.performance.now() + 1000); }
  life.tick();
  assert.equal(life.sleeping(), true);
  assert.equal(document.getElementById('hubPet').dataset.pose, 'nap');
  api.closeModal(); life.tick();
  assert.equal(document.getElementById('hubPet').dataset.pose, 'nap');
});

test('claims actions retain the PDF extractor after an expense refresh and deletion undo', async t => {
  const ctx = await app(t), { api, document } = ctx;
  api.showTab('schedule');
  const expense = await claimExpense(ctx);
  assert.equal(document.querySelectorAll('#claimMonthSummary [data-tng="open"]').length, 1);
  document.querySelector('[data-claim="delete-expense"][data-id="' + expense + '"]').click();
  await settle();
  document.querySelector('[data-claim="undo-delete"]').click(); await settle();
  assert.equal(document.querySelectorAll('#claimMonthSummary [data-tng="open"]').length, 1);
  document.querySelector('#claimMonthSummary [data-tng="open"]').click();
  assert.match(document.getElementById('modalTitle').textContent, /TNG/);
});

test('requested companion naps persist locally for the same account and clear only on companion activation', async t => {
  const { api, window } = await app(t);
  api.hub.life.goHome();
  const key = 'mm-tracker.momo-nap.v1:11111111-1111-4111-8111-111111111111';
  assert.equal(window.localStorage.getItem(key), 'sleeping');
  const reopened = await app(t, { storage: { [key]: 'sleeping' } });
  assert.equal(reopened.api.hub.life.sleeping(), true);
  assert.equal(reopened.document.getElementById('hubPet').dataset.pose, 'nap');
  reopened.document.querySelector('#hubPet > button').click();
  assert.equal(reopened.api.hub.life.sleeping(), false);
  assert.equal(reopened.window.localStorage.getItem(key), null);
  const other = await app(t, { storage: { 'mm-tracker.momo-nap.v1:another-owner': 'sleeping' } });
  assert.equal(other.api.hub.life.sleeping(), false);
});

test('suggested corrections update only the chosen uploaded value, survive remapping and stay out of cloud', async t => {
 const {api,document,window,db}=await app(t),ui=api.hub.validator;api.showTab('validator');await ui.handle({dataset:{val:'example'}});
 const text='Request ID,Request type,Owner,Amount,Start date,End date\nPRIVATE-001,Wrong,Aisha,25,2026-10-20,2026-10-21\nPRIVATE-002,Standard,Mira,30,2026-10-20,2026-10-21';
 await ui.loadFile({name:'data.csv',size:text.length,text:async()=>text});window.setTimeout=callback=>{queueMicrotask(callback);return 0;};await ui.run();await settle();
 const before=copy(ui.snapshot().rows),writes=db.calls.length;assert.equal(ui.snapshot().result.errors,1);assert.ok(document.querySelector('[data-val="suggest"][data-field="TYPE"]'));
 ui.openCorrections(0,'TYPE');const choice=[...document.querySelectorAll('[data-val="apply-correction"]')].find(b=>b.querySelector('strong').textContent==='Standard');assert.ok(choice);ui.applyCorrection(Number(choice.dataset.choice));
 assert.equal(ui.snapshot().rows[0].TYPE,'Standard');assert.deepEqual(copy(ui.snapshot().rows[1]),before[1]);assert.equal(ui.snapshot().result,null);assert.equal(db.calls.length,writes);
 await ui.run();await settle();assert.equal(ui.snapshot().result.errors,0);assert.equal(ui.snapshot().rows[0].TYPE,'Standard');assert.equal(api.payload(api.state()).includes('PRIVATE-001'),false);assert.equal(JSON.stringify(db.row).includes('PRIVATE-001'),false);
 ui.openCorrections(0,'TYPE');window.setTimeout=()=>0;api.cloud.user=null;api.cloud.ready=false;api.showTab('home');assert.equal(document.querySelector('dialog[open]'),null);assert.throws(()=>ui.applyCorrection(0),/preview changed/);
});

test('holiday calendar saves, marks Schedule, recalculates leave and persists through backup and cloud reload', async t => {
 const ctx=await app(t),{api,document,window,db}=ctx;await maintainLeave(ctx);let f=await leaveEditor(ctx,'annual-leave',{date:'2026-10-26'});api.saveRange(f);await settle();const bookings=copy(api.state().schedule);
 api.hub.leaveBalances.holidays('2026');document.querySelector('[data-leave-balance="holiday-add"]').click();f=document.getElementById('leaveHolidayForm');f.querySelector('[data-holiday-date]').value='2026-10-26';f.querySelector('[data-holiday-name]').value='Office <img src=x> holiday';api.hub.leaveBalances.saveHolidays(f);await settle();
 assert.deepEqual(copy(api.state().schedule),bookings);assert.equal(window.WorkHubLeaveBalancesEngine.balance(api.state(),'2026','annual-leave').remaining,2);api.setMonth('2026-10');api.showTab('schedule');assert.match(document.querySelector('.leave-holiday-badge').textContent,/Office <img src=x> holiday/);assert.equal(document.querySelector('.leave-holiday-badge img'),null);
 assert.equal(api.parseBackup(api.payload(api.state())).workhub.publicHolidays[0].id,'2026-10-26');const next=await app(t,{remote:copy(db.row),login:false});await next.api.loadCloud(sessionUser);assert.equal(next.window.WorkHubLeaveBalancesEngine.balance(next.api.state(),'2026','annual-leave').remaining,2);
 api.hub.leaveBalances.holidays('2026');f=document.getElementById('leaveHolidayForm');document.querySelector('[data-leave-balance="holiday-remove"]').click();api.hub.leaveBalances.saveHolidays(f);await settle();assert.equal(window.WorkHubLeaveBalancesEngine.balance(api.state(),'2026','annual-leave').remaining,1);
});

test('holiday calendar rejects changed years, concurrent edits and stale account forms without writes',async t=>{
 const {api,document,db}=await app(t);api.hub.leaveBalances.holidays('2026');const f=document.getElementById('leaveHolidayForm');document.getElementById('leaveHolidayYear').value='2027';let writes=db.calls.length;assert.throws(()=>api.hub.leaveBalances.saveHolidays(f),/Open year/);assert.equal(db.calls.length,writes);document.getElementById('leaveHolidayYear').value='2026';api.mutate(d=>d.workhub.publicHolidays.push({id:'2026-10-26',name:'Changed elsewhere'}));await settle();writes=db.calls.length;assert.throws(()=>api.hub.leaveBalances.saveHolidays(f),/changed while/);assert.equal(db.calls.length,writes);
 api.cloud.user={id:'22222222-2222-4222-8222-222222222222'};api.showTab('schedule');assert.throws(()=>api.hub.leaveBalances.saveHolidays(f),/Reopen/);assert.equal(db.calls.length,writes);
});

test('claims status tracks partial and full payment, keeps estimates separate, and reopens from cloud and backup',async t=>{
 const ctx=await app(t),{api,document,window,db}=ctx;await claimExpense(ctx);api.hub.claims.submissionForm('2026-10');let f=document.getElementById('claimSubmissionForm');fill(f,{status:'submitted',submittedDate:'2026-10-20',submittedAmount:'100.00',paidAmount:'25.00',paidDate:'2026-10-21',submissionReference:'OCT <img src=x>'});api.hub.claims.saveSubmission(f);await settle();
 assert.equal(window.WorkHubClaimsEngine.submission(api.state(),'2026-10').outstandingCents,7500);await claimExpense(ctx,{amount:'50.00'});assert.equal(window.WorkHubClaimsEngine.submission(api.state(),'2026-10').submittedCents,10000);api.hub.claims.tracking();assert.match(document.getElementById('modal').textContent,/RM 75.00 outstanding/);assert.equal(document.querySelector('.claim-tracking img'),null);
 assert.equal(api.parseBackup(api.payload(api.state())).workhub.claims.submissions[0].paidCents,2500);const next=await app(t,{remote:copy(db.row),login:false});await next.api.loadCloud(sessionUser);assert.equal(next.window.WorkHubClaimsEngine.submission(next.api.state(),'2026-10').outstandingCents,7500);
 api.hub.claims.submissionForm('2026-10');f=document.getElementById('claimSubmissionForm');f.elements.namedItem('status').value='paid';f.elements.namedItem('status').dispatchEvent(new window.Event('change',{bubbles:true}));api.hub.claims.saveSubmission(f);await settle();assert.equal(window.WorkHubClaimsEngine.submission(api.state(),'2026-10').outstandingCents,0);
 const expenses=copy(api.state().workhub.claims.expenses);api.hub.claims.submissionForm('2026-10');f=document.getElementById('claimSubmissionForm');f.elements.namedItem('status').value='draft';api.hub.claims.saveSubmission(f);await settle();assert.equal(window.WorkHubClaimsEngine.submission(api.state(),'2026-10').submittedCents,0);assert.deepEqual(copy(api.state().workhub.claims.expenses),expenses);
});

test('claims status rejects excess payment, concurrent edits and stale owner forms without writes',async t=>{
 const {api,document,db}=await app(t);api.hub.claims.submissionForm('2026-10');let f=document.getElementById('claimSubmissionForm');fill(f,{status:'submitted',submittedDate:'2026-10-20',submittedAmount:'100',paidAmount:'101',paidDate:'2026-10-21'});let writes=db.calls.length;assert.throws(()=>api.hub.claims.saveSubmission(f),/claims status/);assert.equal(db.calls.length,writes);fill(f,{paidAmount:'0',paidDate:''});api.hub.claims.saveSubmission(f);await settle();
 api.hub.claims.submissionForm('2026-10');f=document.getElementById('claimSubmissionForm');api.mutate(d=>d.workhub.claims.submissions[0].reference='Changed elsewhere');await settle();writes=db.calls.length;assert.throws(()=>api.hub.claims.saveSubmission(f),/changed while/);assert.equal(db.calls.length,writes);api.cloud.user={id:'22222222-2222-4222-8222-222222222222'};api.showTab('schedule');assert.throws(()=>api.hub.claims.saveSubmission(f),/current account/);assert.equal(db.calls.length,writes);
});

const mdAction=(ui,action,extra={})=>ui.handle({dataset:{md:action,...extra}});
test('My Day intention: completed priorities leave active lists and choices while progress and task history survive',async t=>{
 const {api,document,window,db}=await app(t);reminderClock(window,'2026-10-24T09:00:00');
 const ids=['Finished priority','Focus remaining','Another finished task'].map(x=>addMainTask(api,document,x));
 api.mutate(d=>{window.WorkHubMyDayEngine.day(d,'2026-10-24',true).missions=ids.slice(0,2);for(const i of [0,2]){d.tasks[i].done=true;d.tasks[i].doneDate='2026-10-24';}d.workhub.widgets.push({id:'garden',span:'normal'});});api.showTab('home');await settle();const calls=db.calls.length,ui=api.hub.myDay;
 const active=document.querySelector('[data-widget="missions"]');assert.equal(active.querySelectorAll('.md-mission').length,1);assert.match(active.textContent,/Focus remaining/);assert.doesNotMatch(active.textContent,/Finished priority/);assert.equal(active.querySelector('.md-progress-orbit b').textContent,'1/2');assert.match(document.querySelector('.mv-hero-metric strong').textContent,/1 left/);assert.ok(document.querySelector('.md-garden-plant.has-bloom'));assert.equal(db.calls.length,calls);
 ui.missionsForm();let f=document.getElementById('mdMissions');assert.doesNotMatch(f.textContent,/Finished priority|Another finished task/);assert.equal(f.querySelectorAll('[name="mission"][type="checkbox"]').length,1);assert.equal(f.querySelector('[name="mission"][type="hidden"]').value,ids[0]);ui.submit(f);await settle();assert.deepEqual(copy(api.state().workhub.myDay.days[0].missions),ids.slice(0,2));assert.equal(api.state().tasks.length,3);assert.equal(api.state().tasks[0].done,true);
 await mdAction(ui,'complete',{id:ids[1]});await settle();assert.equal(document.querySelectorAll('[data-widget="missions"] .md-mission').length,0);assert.match(document.querySelector('[data-widget="missions"]').textContent,/Your intentions, fulfilled/);assert.match(document.querySelector('.mv-hero-metric strong').textContent,/0 left/);assert.equal(document.querySelectorAll('.md-garden-plant.has-bloom').length,2);assert.equal(api.state().tasks.length,3);assert.equal(api.state().workhub.myDay.days[0].missions.length,2);
});
test('My Day effects: feedback is bounded, decorative and removed immediately when motion becomes unavailable',async t=>{
 const {api,document,window,db}=await app(t);api.mutate(d=>d.workhub.myDay.settings.effects='playful');api.showTab('home');await settle();const ui=api.hub.myDay,calls=db.calls.length;
 for(let i=0;i<30;i++)document.querySelector('[data-mv="view"][data-view="all"]').click();assert.equal(document.querySelector('.mv-touch-effects').childElementCount,18);assert.equal(document.querySelector('.mv-touch-effects').getAttribute('aria-hidden'),'true');
 ui.visual.celebrate();assert.equal(document.querySelectorAll('.mv-milestone .mv-ripple').length,3);assert.equal(document.querySelectorAll('.mv-milestone b').length,32);assert.ok(document.querySelector('.mv-sun-rays'));assert.equal(document.querySelector('.mv-aurora'),null);assert.ok(document.querySelector('.mv-butterflies'));assert.equal(db.calls.length,calls);
 document.querySelector('#hubToolbar [data-hub="privacy"]').click();await settle();assert.equal(document.querySelector('.mv-milestone,.mv-touch-effects'),null);assert.equal(document.querySelector('.my-day-page').dataset.mvMotion,'still');ui.visual.celebrate();assert.equal(document.querySelector('.mv-milestone'),null);
 document.querySelector('#hubToolbar [data-hub="privacy"]').click();await settle();window.matchMedia=()=>({matches:true});ui.visual.sync();document.querySelector('[data-mv="view"][data-view="plan"]').click();assert.equal(document.querySelector('.mv-touch-effects'),null);assert.equal(db.calls.length,calls);
 window.matchMedia=()=>({matches:false});ui.visual.sync();ui.visual.celebrate();assert.ok(document.querySelector('.mv-milestone'));api.showTab('tasks');assert.equal(document.querySelector('.mv-milestone,.mv-touch-effects'),null);assert.equal(db.calls.length,calls);
});
test('My Day design: chapters preserve saved order and sizes, survive widget refresh and offer an empty view',async t=>{
 const {api,document,window,db}=await app(t);api.showTab('home');await settle();
 const layout=copy(api.state().workhub.widgets),before=copy(api.state()),calls=db.calls.length;
 const ids=()=>[...document.querySelectorAll('.hub-layout>[data-widget]')].map(x=>x.dataset.widget);
 const initial=ids();document.querySelector('[data-mv="view"][data-view="work"]').click();
 assert.equal(document.querySelector('.my-day-page').dataset.mvView,'work');
 assert.ok([...document.querySelectorAll('.hub-layout>[data-widget]:not([hidden])')].every(x=>window.WorkHubMyDayVisuals.phase(x.dataset.widget)==='work'));
 assert.deepEqual(ids(),initial);assert.equal(document.querySelector('[data-widget="today"]').hidden,true);
 await mdAction(api.hub.myDay,'expand',{id:'tasks'});
 assert.equal(document.querySelector('.my-day-page').dataset.mvView,'work');assert.equal(document.querySelector('[data-widget="tasks"] [data-md="expand"]').getAttribute('aria-expanded'),'true');
 document.querySelector('[data-mv="view"][data-view="all"]').click();assert.deepEqual(ids(),initial);assert.ok([...document.querySelectorAll('.hub-layout>[data-widget]')].every(x=>!x.hidden));
 assert.deepEqual(copy(api.state().workhub.widgets),layout);assert.deepEqual(copy(api.state()),before);assert.equal(db.calls.length,calls);
 api.mutate(d=>d.workhub.widgets=d.workhub.widgets.filter(x=>window.WorkHubMyDayVisuals.phase(x.id)!=='reflect'));api.showTab('home');await settle();const saved=db.calls.length;
 document.querySelector('[data-mv="view"][data-view="reflect"]').click();assert.equal(document.querySelector('.mv-no-widgets').hidden,false);assert.equal(document.querySelectorAll('.hub-layout>[data-widget]:not([hidden])').length,0);assert.equal(db.calls.length,saved);
});
test('My Day design: live widget previews cancel cleanly and a released drop saves exactly once',async t=>{
 const {api,document,window,db}=await app(t);api.showTab('home');await settle();
 const ids=()=>[...document.querySelectorAll('.hub-layout>[data-widget]')].map(x=>x.dataset.widget),initial=ids(),layout=copy(api.state().workhub.widgets),calls=db.calls.length;
 const start=()=>{const source=document.querySelector('[data-widget="today"]'),target=document.querySelector('[data-widget="tasks"]');document.elementFromPoint=()=>target;pointer(window,source.querySelector('[data-hub-drag]'),'pointerdown',100,100);pointer(window,document,'pointermove',200,200);return source;};
 let source=start();assert.notDeepEqual(ids(),initial);assert.equal(source.classList.contains('mv-sort-space'),true);assert.deepEqual(copy(api.state().workhub.widgets),layout);assert.equal(db.calls.length,calls);
 pointer(window,document,'pointercancel',200,200);assert.deepEqual(ids(),initial);assert.equal(document.querySelector('.mv-sort-space,.hub-sort-ghost'),null);assert.deepEqual(copy(api.state().workhub.widgets),layout);
 source=start();document.elementFromPoint=()=>source;pointer(window,document,'pointermove',201,201);document.elementFromPoint=()=>source.parentElement;pointer(window,document,'pointermove',202,202);pointer(window,document,'pointerup',202,202);await settle();assert.equal(db.calls.length,calls+1);assert.equal(api.state().workhub.widgets[0].id,'tasks');assert.equal(api.state().workhub.widgets[1].id,'today');assert.equal(document.querySelector('.mv-sort-space,.hub-sort-ghost'),null);
});
test('My Day design: chart categories drill down without writes and motion guards stop decorative work',async t=>{
 const {api,document,window,db}=await app(t);reminderClock(window,'2026-10-24T09:00:00');
 api.openRangeEditor('2026-10-24','09:00','',true);let f=document.getElementById('scheduleForm');fill(f,{text:'Planning session'});api.saveRange(f);
 api.mutate(d=>{d.workhub.widgets.push({id:'radar',span:'normal'});d.workhub.myDay.settings.effects='ambient';d.workhub.preferences.motion='playful';});api.showTab('home');await settle();const calls=db.calls.length,ui=api.hub.myDay;
 document.querySelector('[data-md="radar"][data-kind="custom"]').click();await settle();assert.match(document.querySelector('.md-drilldown').textContent,/Planning session/);assert.equal(document.querySelector('[data-md="radar"][data-kind="custom"]').getAttribute('aria-pressed'),'true');
 document.querySelector('[data-md="radar"][data-kind="free"]').click();await settle();assert.match(document.querySelector('.md-drilldown').textContent,/Free time/);document.querySelector('[data-md="radar"][data-kind="free"]').click();await settle();assert.equal(document.querySelector('.md-drilldown'),null);assert.equal(db.calls.length,calls);
 let reduced=false;window.matchMedia=()=>({matches:reduced});ui.visual.sync();assert.equal(document.querySelector('.my-day-page').dataset.mvMotion,'flow');
 let cancelled=0,started=0;window.Element.prototype.animate=()=>{started++;return{cancel(){cancelled++;},finished:new Promise(()=>{})};};api.showTab('tasks');api.showTab('home');assert.ok(started>0);reduced=true;ui.visual.sync();assert.equal(document.querySelector('.my-day-page').dataset.mvMotion,'still');assert.ok(cancelled>0);
 reduced=false;document.body.classList.add('hub-private');ui.visual.sync();assert.equal(document.querySelector('.my-day-page').dataset.mvMotion,'still');document.body.classList.remove('hub-private');
 Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(document.querySelector('.my-day-page').dataset.mvMotion,'still');Object.defineProperty(document,'hidden',{configurable:true,value:false});ui.visual.sync();assert.equal(document.querySelector('.my-day-page').dataset.mvMotion,'flow');
 document.querySelector('[data-mv="view"][data-view="work"]').click();api.cloud.user={id:'22222222-2222-4222-8222-222222222222'};api.showTab('home');assert.equal(document.querySelector('.my-day-page').dataset.mvView,'all');assert.equal(db.calls.length,calls);
});
test('My Day: canvas ideas, groups and connections persist through cloud reload and backup, with idempotent task conversion',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.myDay;api.showTab('home');
 await mdAction(ui,'groups');let f=document.getElementById('mdGroups');fill(f,{newName:'Fresh ideas'});ui.submit(f);const group=api.state().workhub.myDay.groups[0].id;
 for(const title of ['Prepare <new> plan','Confirm next steps']){ui.ideaEditor();f=document.getElementById('mdIdea');fill(f,{title,notes:'Keep the original thought',groupId:group});ui.submit(f);}
 let ideas=api.state().workhub.myDay.ideas;assert.equal(document.querySelector('.md-idea img'),null);assert.match(document.querySelector('.md-idea h4').textContent,/<new>/);
 await mdAction(ui,'connection');f=document.getElementById('mdConnection');fill(f,{from:ideas[0].id,to:ideas[1].id});ui.submit(f);assert.equal(api.state().workhub.myDay.links.length,1);
 for(const id of ideas.map(x=>x.id)){const input=document.querySelector('[data-md-select="'+id+'"]');input.checked=true;input.dispatchEvent(new window.Event('change',{bubbles:true}));}
 await mdAction(ui,'convert');f=document.getElementById('mdConvert');ui.submit(f);assert.equal(api.state().tasks.length,2);assert.equal(api.state().tasks[0].remarks,'Keep the original thought');assert.equal(api.state().workhub.myDay.ideas.length,2);
 await mdAction(ui,'convert');ui.submit(document.getElementById('mdConvert'));assert.equal(api.state().tasks.length,2);
 await settle();await api.flushCloud();const restored=api.parseBackup(api.payload(api.state()));assert.equal(restored.workhub.myDay.groups[0].name,'Fresh ideas');const reopened=await app(t,{remote:copy(db.row),login:false});await reopened.api.loadCloud(sessionUser);reopened.api.showTab('home');assert.equal(reopened.document.querySelectorAll('.md-idea').length,2);assert.equal(reopened.api.state().workhub.myDay.links.length,1);reopened.api.validate(reopened.api.state());
});
test('My Day: idea dragging saves only the drop, cancels safely and retains dashboard sorting',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.myDay;ui.ideaEditor();let f=document.getElementById('mdIdea');fill(f,{title:'Move this thought'});ui.submit(f);api.showTab('home');await settle();const id=api.state().workhub.myDay.ideas[0].id,before=copy(api.state().workhub.widgets),writes=db.calls.length;
 let h=document.querySelector('[data-md-drag="idea"]');pointer(window,h,'pointerdown',100,100);pointer(window,document,'pointermove',140,160);assert.equal(db.calls.length,writes);pointer(window,document,'pointerup',140,160);await settle();assert.equal(api.state().workhub.myDay.ideas[0].x,80);assert.equal(api.state().workhub.myDay.ideas[0].y,100);assert.equal(db.calls.length,writes+1);assert.deepEqual(copy(api.state().workhub.widgets),before);
 h=document.querySelector('[data-md-drag="idea"]');pointer(window,h,'pointerdown',100,100);pointer(window,document,'pointermove',160,180);pointer(window,document,'pointercancel',160,180);assert.equal(api.state().workhub.myDay.ideas[0].x,80);
 h.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(api.state().workhub.myDay.ideas[0].x,90);assert.equal(api.state().workhub.myDay.ideas[0].id,id);
 const source=document.querySelector('[data-widget="canvas"] [data-hub-drag]'),target=document.querySelector('[data-widget="today"]');document.elementFromPoint=()=>target;pointer(window,source,'pointerdown',100,100);pointer(window,document,'pointermove',200,200);pointer(window,document,'pointerup',200,200);assert.equal(api.state().workhub.widgets[0].id,'canvas');
});
test('My Day: stale idea forms and cross-account submissions are rejected, and undo never overwrites later grouping',async t=>{
 const {api,document}=await app(t),ui=api.hub.myDay;ui.ideaEditor();let f=document.getElementById('mdIdea');fill(f,{title:'First thought'});ui.submit(f);const id=api.state().workhub.myDay.ideas[0].id;ui.ideaEditor(id);f=document.getElementById('mdIdea');api.mutate(d=>d.workhub.myDay.ideas[0].title='Updated elsewhere');assert.throws(()=>ui.submit(f),/changed while/);api.closeModal();
 await mdAction(ui,'idea-delete',{id});assert.equal(api.state().workhub.myDay.ideas.length,0);await mdAction(ui,'undo');assert.equal(api.state().workhub.myDay.ideas[0].title,'Updated elsewhere');
 ui.ideaEditor(id);f=document.getElementById('mdIdea');api.cloud.user={id:'22222222-2222-4222-8222-222222222222'};assert.throws(()=>ui.submit(f),/earlier account/);assert.equal(api.state().workhub.myDay.ideas[0].title,'Updated elsewhere');
});
test('My Day: priorities, morning baseline and evening carry-forward preserve existing schedule records',async t=>{
 const {api,document,window}=await app(t);reminderClock(window,'2026-10-23T09:00:00');const ui=api.hub.myDay,ids=['One','Two','Three','Four'].map(x=>addMainTask(api,document,x));api.showTab('home');ui.morning();let f=document.getElementById('mdMorning');for(const input of f.querySelectorAll('[name="mission"]'))input.checked=true;assert.throws(()=>ui.submit(f),/up to three/);f.querySelector('[name="mission"][value="'+ids[3]+'"]').checked=false;ui.submit(f);assert.equal(api.state().workhub.myDay.days[0].missions.length,3);await mdAction(ui,'complete',{id:ids[0]});assert.equal(api.state().tasks[0].done,true);assert.equal(api.state().tasks[0].doneDate,'2026-10-23');
 const before=copy(api.state().schedule);ui.evening();f=document.getElementById('mdEvening');fill(f,{reflection:'Moved the important work forward',carryDate:'2026-10-26'});f.querySelector('[name="carry"][value="'+ids[1]+'"]').checked=true;ui.submit(f);assert.equal(api.state().tasks[1].dueDate,'2026-10-26');assert.deepEqual(copy(api.state().schedule),before);assert.equal(api.state().workhub.myDay.days[0].closed,true);assert.equal(api.state().workhub.myDay.days[0].reflection,'Moved the important work forward');
});
test('My Day: gap scheduling and moving activities open the existing review editor before any record changes',async t=>{
 const {api,document,window,db}=await app(t);reminderClock(window,'2026-10-23T09:00:00');const ui=api.hub.myDay,id=addMainTask(api,document,'A short task');ui.estimate(id);let f=document.getElementById('mdEstimate');fill(f,{minutes:'15',effort:'low'});ui.submit(f);api.showTab('home');await settle();const writes=db.calls.length;
 await mdAction(ui,'fit',{id,start:'540'});f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('time').value,'09:00');assert.equal(f.elements.namedItem('endTime').value,'09:15');assert.equal(db.calls.length,writes);assert.equal(api.state().schedule.length,0);api.saveRange(f);assert.equal(api.state().schedule[0].linkId,id);assert.equal(api.state().schedule[0].endTime,'09:15');const entry=window.WorkHubMyDayEngine.agenda(api.state(),'2026-10-23')[0];await mdAction(ui,'reschedule',{id:entry.id});f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('time').value,'09:00');assert.equal(api.state().schedule[0].time,'09:00');api.closeModal();
});
test('My Day: break clocks pause active work and focus without cloud writes, and all optional widgets render',async t=>{
 const {api,document,window,db,intervals}=await app(t);reminderClock(window,'2026-10-23T09:00:00');const ui=api.hub.myDay;api.hub.startTimer({kind:'custom',title:'Focused work',chargeCode:'',notes:''});await mdAction(ui,'focus-open');let f=document.getElementById('mdFocus');fill(f,{minutes:'25'});ui.submit(f);assert.equal(api.hub.focusSnapshot().active,true);await settle();const calls=db.calls.length;await mdAction(ui,'break-start',{label:'Step away'});assert.equal(api.hub.timer().runningSince,null);assert.equal(api.hub.focusSnapshot().paused,true);assert.equal(ui.breakSnapshot().label,'Step away');ui.tick();await settle();assert.equal(db.calls.length,calls);
 await mdAction(ui,'break-pause');assert.ok(ui.breakSnapshot().pausedAt);await mdAction(ui,'break-pause');assert.equal(ui.breakSnapshot().pausedAt,undefined);await mdAction(ui,'break-end');assert.equal(ui.breakSnapshot().complete,true);assert.equal(api.hub.focusSnapshot().paused,true);await mdAction(ui,'break-resume');assert.equal(ui.breakSnapshot(),null);assert.equal(api.hub.focusSnapshot().paused,false);
 api.mutate(d=>{for(const id of Object.keys(window.WorkHubMyDayEngine.WIDGETS))if(!d.workhub.widgets.some(w=>w.id===id))d.workhub.widgets.push({id,span:'normal'});});api.showTab('home');for(const id of Object.keys(window.WorkHubMyDayEngine.WIDGETS))assert.ok(document.querySelector('[data-widget="'+id+'"] .md-widget-body'));assert.doesNotMatch(document.querySelector('.my-day-page').innerHTML,/NaN/);
 await mdAction(ui,'settings');f=document.getElementById('mdSettings');fill(f,{effects:'calm',breakMinutes:'3'});f.elements.namedItem('particles').checked=false;ui.submit(f);assert.equal(api.state().workhub.myDay.settings.effects,'calm');assert.equal(document.querySelector('.my-day-page').dataset.effects,'calm');
});
test('Presentation break: the shared clock updates custom audience content without operating personal timers or saving records',async t=>{
 const {api,window,document,intervals,db}=await app(t);let now=window.Date.now();window.Date.now=()=>now;api.showTab('tasks');await settle();api.hub.startTimer({kind:'custom',title:'Presentation preparation',chargeCode:'',notes:''});const work=api.hub.timer().runningSince,writes=db.calls.length;
 document.getElementById('presentationBreakButton').click();const form=document.querySelector('#presentationBreakSettings form');fill(form,{message:'Please wait while we prepare the next section',minutes:'1',scene:'stars',complete:'Ready to continue together'});form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(document.querySelector('#pbMessage').textContent,'Please wait while we prepare the next section');assert.equal(document.querySelector('[data-pb-clock]').textContent,'01:00');now+=61000;intervals.find(i=>i.ms===1000).callback();assert.equal(document.querySelector('[data-pb-clock]').textContent,'00:00');assert.equal(document.querySelector('[data-pb-status]').textContent,'Ready to continue together');assert.equal(api.hub.timer().runningSince,work);assert.equal(api.hub.myDay.breakSnapshot(),null);assert.equal(db.calls.length,writes);document.querySelector('[data-pb="end"]').click();assert.equal(document.getElementById('presentationBreak'),null);
});
test('Terrarium: the toolbar shortcut stays beside Focus, uses the saved length from every section and preserves the current page',async t=>{
 const {api,document,window,db}=await app(t);mockAmbientAudio(window);const ui=api.hub.myDay;
 api.mutate(d=>{d.workhub.myDay.settings.breakMinutes=7;});await settle();
 for(const tab of ['home','tickets','tasks','schedule','specs','knowledge','processhub','waiting','studio','lab','validator','snippets']){api.showTab(tab);await settle();const shortcut=document.getElementById('breakTerrariumButton');assert.equal(document.getElementById('focusModeButton').nextElementSibling,shortcut);assert.equal(shortcut.hidden,false);assert.equal(shortcut.textContent,'Break Terrarium');assert.equal(document.querySelectorAll('#breakTerrariumButton').length,1);}
 api.showTab('tasks');await settle();const shortcut=document.getElementById('breakTerrariumButton'),page=document.getElementById('view').firstElementChild,writes=db.calls.length;shortcut.focus();shortcut.click();await settle();assert.equal(document.getElementById('restRoom').open,true);assert.equal(ui.breakSnapshot().duration,420);assert.equal(ui.breakSnapshot().label,'Rest your eyes');assert.equal(document.getElementById('view').firstElementChild,page);
 const session=ui.breakSnapshot();shortcut.click();await settle();assert.equal(ui.breakSnapshot().start,session.start);assert.equal(ui.breakSnapshot().end,session.end);assert.equal(document.querySelectorAll('#restRoom').length,1);
 document.querySelector('#restRoom [data-rest="end"]').click();document.querySelector('#restRoom [data-rest="resume"]').click();await settle();assert.equal(ui.breakSnapshot(),null);assert.equal(document.getElementById('view').firstElementChild,page);assert.equal(document.activeElement,shortcut);assert.equal(db.calls.length,writes);
 await api.loadCloud(null);assert.equal(document.getElementById('breakTerrariumButton').hidden,true);assert.equal(document.getElementById('restRoom'),null);
});
test('Terrarium: full-screen rest uses different music, expires once in the background and resumes only the prior running work on request',async t=>{
 const {api,document,window,db}=await app(t),contexts=mockAmbientAudio(window),ui=api.hub.myDay;reminderClock(window,'2026-10-24T09:00:00');
 api.hub.startTimer({kind:'custom',title:'Work before a break',chargeCode:'',notes:''});await mdAction(ui,'focus-open');let f=document.getElementById('mdFocus');fill(f,{minutes:'25'});ui.submit(f);api.hub.soundscape.preset('lofi');await api.hub.soundscape.start();const focusMix=copy(api.hub.soundscape.snapshot().mix);await settle();const writes=db.calls.length;
 reminderClock(window,'2026-10-24T09:01:00');await mdAction(ui,'break-start',{label:'Rest your eyes'});await settle();assert.ok(document.getElementById('restRoom').open);assert.equal(document.querySelector('.rest-aurora'),null);assert.equal(document.getElementById('restRoom').parentElement,document.body);assert.equal(api.hub.timer().runningSince,null);assert.equal(api.hub.focusSnapshot().paused,true);assert.equal(api.hub.focusSnapshot().remaining,1440);assert.equal(api.hub.soundscape.snapshot().playing,false);assert.equal(ui.rest.audio().playing,true);assert.equal(ui.rest.audio().track,'garden');assert.equal(contexts[0].state,'closed');assert.equal(contexts.length,2);assert.ok(!document.querySelector('[data-widget="focus"]'));
 const select=document.querySelector('[data-rest-track]');select.value='tide';select.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(ui.rest.audio().track,'tide');assert.deepEqual(copy(api.hub.soundscape.snapshot().mix),focusMix);
 Object.defineProperty(document,'hidden',{configurable:true,value:true});reminderClock(window,'2026-10-24T09:06:01');ui.tick();assert.equal(ui.breakSnapshot().complete,true);assert.equal(ui.rest.audio().playing,false);assert.equal(ui.rest.audio().alerting,true);assert.equal(api.hub.timer().runningSince,null);assert.equal(api.hub.focusSnapshot().paused,true);assert.equal(document.querySelector('[data-rest-clock]').textContent,'00:00');assert.equal(document.querySelector('[data-rest="resume"]').hidden,false);const alarms=()=>contexts[1].nodes.filter(n=>n.loop&&n.buffer&&!n.stopped);assert.equal(alarms().length,1);const ringing=alarms()[0];ui.tick();assert.equal(alarms().length,1);assert.equal(db.calls.length,writes);
 assert.equal(document.querySelector('[data-rest="silence"], [data-rest-alarm]'),null);const volume=document.querySelector('[data-rest-volume]');volume.value='0';volume.dispatchEvent(new window.Event('input',{bubbles:true}));document.getElementById('restRoom').dispatchEvent(new window.Event('cancel',{cancelable:true}));reminderClock(window,'2026-10-24T09:40:00');ui.tick();assert.equal(ui.rest.audio().alerting,true);assert.equal(ringing.stopped,undefined);assert.equal(alarms().length,1);Object.defineProperty(document,'hidden',{configurable:true,value:false});reminderClock(window,'2026-10-24T09:06:01');document.querySelector('[data-rest="resume"]').click();await settle();assert.equal(ui.breakSnapshot(),null);assert.equal(document.getElementById('restRoom'),null);assert.equal(contexts[1].state,'closed');assert.equal(ringing.stopped,true);assert.equal(api.hub.focusSnapshot().paused,false);assert.equal(api.hub.focusSnapshot().remaining,1440);assert.equal(api.hub.timer().runningSince,'2026-10-24T01:06:01.000Z');assert.equal(api.hub.timer().segments[0].end,'2026-10-24T01:01:00.000Z');assert.equal(api.hub.soundscape.snapshot().playing,true);assert.deepEqual(copy(api.hub.soundscape.snapshot().mix),focusMix);
});
test('Terrarium: already-paused timers stay paused, break pauses exclude elapsed time and Escape waits for explicit work resumption',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.myDay;mockAmbientAudio(window);reminderClock(window,'2026-10-24T09:00:00');api.hub.startTimer({kind:'custom',title:'Paused work',chargeCode:'',notes:''});await hubAction(api,'timer-pause');await mdAction(ui,'focus-open');let f=document.getElementById('mdFocus');fill(f,{minutes:'25'});ui.submit(f);await mdAction(ui,'focus-pause');await mdAction(ui,'break-start',{label:'Stretch'});await settle();const writes=db.calls.length;
 reminderClock(window,'2026-10-24T09:01:00');await mdAction(ui,'break-pause');reminderClock(window,'2026-10-24T09:10:00');ui.tick();assert.equal(ui.breakSnapshot().seconds,240);assert.equal(ui.breakSnapshot().complete,false);assert.equal(ui.rest.audio().paused,true);await mdAction(ui,'break-pause');assert.equal(ui.breakSnapshot().seconds,240);
 const dialog=document.getElementById('restRoom'),event=new window.Event('cancel',{cancelable:true});dialog.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(ui.breakSnapshot().complete,true);assert.equal(dialog.open,true);assert.equal(ui.rest.audio().alerting,false);await mdAction(ui,'break-resume');assert.equal(api.hub.timer().runningSince,null);assert.equal(api.hub.focusSnapshot().paused,true);assert.equal(api.hub.soundscape.snapshot().playing,false);assert.equal(db.calls.length,writes);
});
test('Terrarium: pending audio, old resume buttons and account changes cannot revive another account’s break or timers',async t=>{
 const {api,document,window,db}=await app(t),ui=api.hub.myDay,contexts=mockAmbientAudio(window,{pending:true});await mdAction(ui,'break-start',{label:'Step away'});await mdAction(ui,'break-end');const button=document.querySelector('[data-rest="resume"]');api.cloud.user={id:'22222222-2222-4222-8222-222222222222'};ui.sync();assert.equal(ui.breakSnapshot(),null);assert.equal(document.getElementById('restRoom'),null);assert.equal(contexts[0].state,'closed');contexts[0].finishResume();await settle();button.click();await settle();assert.equal(ui.breakSnapshot(),null);assert.equal(ui.rest.audio().playing,false);assert.equal(document.body.classList.contains('rest-room-open'),false);assert.equal(db.calls.length,0);
});
test('Terrarium: delayed audio respects an early end and starts a persistent alarm after natural expiry',async t=>{
 for(const natural of [false,true]){
  const {api,document,window}=await app(t),ui=api.hub.myDay,contexts=mockAmbientAudio(window,{pending:true});reminderClock(window,'2026-10-24T09:00:00');await mdAction(ui,'break-start',{label:'Rest your eyes'});
  if(natural){reminderClock(window,'2026-10-24T09:05:01');ui.tick();}else await mdAction(ui,'break-end');
  contexts[0].finishResume();await settle();assert.equal(ui.breakSnapshot().complete,true);assert.equal(ui.rest.audio().playing,false);assert.equal(ui.rest.audio().alerting,natural);assert.equal(ui.rest.audio().alarm,true);assert.equal(contexts[0].nodes.filter(n=>n.loop&&n.buffer&&!n.stopped).length,natural?1:0);await mdAction(ui,'break-resume');assert.equal(ui.rest.audio().alerting,false);assert.equal(document.getElementById('restRoom'),null);
 }
});
test('My Day: activity dragging previews a new time without sorting its parent widget or writing schedule records',async t=>{
 const {api,document,window,db}=await app(t);reminderClock(window,'2026-10-23T09:00:00');api.openRangeEditor('2026-10-23','09:00','',true);let f=document.getElementById('scheduleForm');fill(f,{text:'A planned activity'});api.saveRange(f);api.showTab('home');await settle();const before=copy(api.state().schedule),layout=copy(api.state().workhub.widgets),calls=db.calls.length,handle=document.querySelector('[data-md-drag="activity"]'),track=document.querySelector('[data-md-track]');track.getBoundingClientRect=()=>({left:0,right:900,top:0,bottom:66,width:900,height:66});
 const transfer=new Map();const start=new window.Event('dragstart',{bubbles:true,cancelable:true});Object.defineProperty(start,'dataTransfer',{value:{setData:(k,v)=>transfer.set(k,v)}});handle.dispatchEvent(start);const drop=new window.MouseEvent('drop',{bubbles:true,cancelable:true,clientX:300});Object.defineProperty(drop,'dataTransfer',{value:{getData:k=>transfer.get(k)}});track.dispatchEvent(drop);f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('time').value,'12:00');assert.equal(f.elements.namedItem('endTime').value,'13:00');assert.equal(f.elements.namedItem('endClock').value,'13:00');assert.deepEqual(copy(api.state().schedule),before);assert.deepEqual(copy(api.state().workhub.widgets),layout);assert.equal(db.calls.length,calls);api.closeModal();
 pointer(window,handle,'pointerdown',20,100);pointer(window,document,'pointermove',300,20);assert.ok(document.querySelector('.md-time-ghost'));pointer(window,document,'pointerup',300,20);f=document.getElementById('scheduleForm');assert.equal(f.elements.namedItem('time').value,'12:00');assert.equal(document.querySelector('.md-time-ghost'),null);assert.deepEqual(copy(api.state().schedule),before);assert.equal(db.calls.length,calls);api.closeModal();
 pointer(window,handle,'pointerdown',20,100);pointer(window,document,'pointermove',300,20);pointer(window,document,'pointercancel',300,20);assert.equal(document.getElementById('modal').open,false);assert.equal(document.querySelector('.md-time-ghost'),null);
});
test('My Day: replay keeps the active slider stable and draws recorded intervals with their pause gap',async t=>{
 const {api,document,window}=await app(t);reminderClock(window,'2026-10-23T09:00:00');api.mutate(d=>{d.workhub.widgets.push({id:'replay',span:'wide'});d.workhub.sessions=[{id:'paused-session',title:'Work in chapters',kind:'custom',linkId:'',start:'2026-10-23T01:00:00Z',end:'2026-10-23T03:00:00Z',seconds:5400,intervals:[{start:'2026-10-23T01:00:00Z',end:'2026-10-23T02:00:00Z'},{start:'2026-10-23T02:30:00Z',end:'2026-10-23T03:00:00Z'}]}];});api.showTab('home');const widget=document.querySelector('[data-widget="replay"]'),slider=widget.querySelector('[data-md-replay]');assert.equal(widget.querySelectorAll('[data-md="session-detail"]').length,2);slider.focus();slider.value='600';slider.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(widget.querySelector('[data-md-replay]'),slider);assert.equal(document.activeElement,slider);assert.match(widget.querySelector('[data-md-replay-label]').textContent,/10:00/);assert.equal(widget.querySelectorAll('[data-md="session-detail"]').length,1);
});
test('My Day: growing scene follows each actual priority and maintained group colours appear on idea labels',async t=>{
 const {api,document,window}=await app(t);reminderClock(window,'2026-10-23T09:00:00');const ids=['First','Second'].map(x=>addMainTask(api,document,x));api.mutate(d=>{window.WorkHubMyDayEngine.day(d,'2026-10-23',true).missions=ids;d.tasks[1].done=true;d.tasks[1].doneDate='2026-10-23';d.workhub.widgets.push({id:'garden',span:'normal'});});api.showTab('home');
 const ui=api.hub.myDay;ui.missionsForm();let f=document.getElementById('mdMissions');for(const box of f.querySelectorAll('[name="mission"]'))box.checked=true;ui.submit(f);
 const plants=[...document.querySelectorAll('.md-garden-plant')];assert.equal(plants[0].classList.contains('has-bloom'),false);assert.equal(plants[1].classList.contains('has-bloom'),true);
 await mdAction(ui,'groups');f=document.getElementById('mdGroups');fill(f,{newName:'A group',newColor:'peach'});ui.submit(f);const group=api.state().workhub.myDay.groups[0];ui.ideaEditor();f=document.getElementById('mdIdea');fill(f,{title:'Colourful thought',groupId:group.id});ui.submit(f);assert.ok(document.querySelector('.md-group-tag.md-color-peach'));await mdAction(ui,'groups');f=document.getElementById('mdGroups');f.elements.namedItem('color-'+group.id).value='sky';ui.submit(f);assert.ok(document.querySelector('.md-group-tag.md-color-sky'));
});


test('Terrarium: old muted-chime preferences and muted rest music cannot disable the alarm; pending audio cannot restart after Resume work',async t=>{
 const {api,window,document,db}=await app(t,{storage:{'mm-tracker.rest-sound.v1':JSON.stringify({alarm:false,music:false,volume:0,track:'tide'})}}),contexts=mockAmbientAudio(window,{pending:true}),ui=api.hub.myDay;reminderClock(window,'2026-10-24T09:00:00');await mdAction(ui,'break-start');assert.equal(ui.rest.audio().alarm,true);reminderClock(window,'2026-10-24T09:05:01');ui.tick();assert.equal(ui.rest.audio().alerting,true);assert.equal(document.querySelector('[data-rest="silence"], [data-rest-alarm]'),null);document.querySelector('[data-rest="resume"]').click();contexts[0].finishResume();await settle();assert.equal(ui.rest.audio().alerting,false);assert.equal(ui.rest.audio().playing,false);assert.equal(contexts[0].nodes.filter(n=>n.loop&&n.buffer).length,0);assert.equal(db.calls.length,0);
});
test('Spectacle: every section keeps the shared living effects, navigation bursts stay bounded and records are untouched',async t=>{
 const {api,window,document,db}=await app(t);await settle();const before=copy(api.state()),calls=db.calls.length;
 for(const tab of ['tickets','tasks','schedule','specs','knowledge','processhub','waiting','studio','lab','validator','snippets','home']){api.showTab(tab);await settle();assert.equal(document.querySelectorAll('#hubSpectacle').length,1);assert.equal(document.querySelector('.fx-ribbon,.mv-aurora,.world-aurora'),null);assert.equal(document.getElementById('hubSpectacle').hidden,false);assert.equal(document.body.dataset.spectacle,'spectacle');assert.ok(document.querySelector('#view > .fx-stage'));}
 const control=document.querySelector('#tabs [data-tab="home"]');for(let i=0;i<20;i++)control.dispatchEvent(new window.MouseEvent('click',{bubbles:true,clientX:90,clientY:130}));await settle();assert.ok(document.querySelectorAll('.fx-shockwave').length>0);assert.ok(document.querySelector('.fx-reactions').childElementCount<=140);assert.equal(document.getElementById('hubSpectacle').getAttribute('aria-hidden'),'true');assert.ok(document.querySelectorAll('.mv-tree').length>20);assert.ok(document.querySelectorAll('.mv-river-caustics path').length>10);assert.deepEqual(copy(api.state()),before);assert.equal(db.calls.length,calls);
});
test('Spectacle: motion off, privacy, reduced motion and hidden pages clear feedback; drag and input gestures stay untouched',async t=>{
 const {window,document,db}=await app(t);await settle();const ui=window.WorkHubSpectacle,control=document.querySelector('#tabs button');control.dispatchEvent(new window.MouseEvent('click',{bubbles:true,clientX:80,clientY:150}));assert.ok(document.querySelector('.fx-reactions').childElementCount);document.body.dataset.motion='off';ui.sync();assert.equal(document.getElementById('hubSpectacle').hidden,true);assert.equal(document.querySelector('.fx-reactions').childElementCount,0);document.body.dataset.motion='playful';document.body.classList.add('hub-private');ui.sync();assert.equal(document.getElementById('hubSpectacle').hidden,true);document.body.classList.remove('hub-private');window.matchMedia=()=>({matches:true});ui.sync();assert.equal(document.body.dataset.spectacle,'off');window.matchMedia=()=>({matches:false});ui.sync();document.body.classList.add('hub-sorting');control.dispatchEvent(new window.MouseEvent('click',{bubbles:true,clientX:80,clientY:150}));assert.equal(document.querySelector('.fx-reactions').childElementCount,0);document.body.classList.remove('hub-sorting');Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(document.getElementById('hubSpectacle').hidden,true);assert.equal(db.calls.length,0);
});


test('Process Hub: rehearsal leaves Studio and a new full-screen canvas saves its graph with one document write',async t=>{
 const {api,document,window,db}=await app(t);api.showTab('studio');assert.equal(document.querySelector('[data-tool="simulator"]'),null);api.showTab('processhub');assert.equal(document.querySelectorAll('#rehearsalRoot').length,1);
 const before=db.calls.length;document.querySelector('[data-rehearsal="new"]').click();await settle();assert.ok(document.getElementById('processHubOverlay').open);assert.equal(db.calls.length,before);
 let f=document.getElementById('processHubDetails');fill(f,{name:'Request handling',objective:'Explain the flow',processOwner:'Service lead',revision:'v2',presenterNotes:'Private prompts'});
 document.querySelector('[data-step-type="approval"]').click();await settle();f=document.getElementById('rehearsalStepForm');fill(f,{title:'Review request',instruction:'Check the details',inputs:'Request form',outputs:'Decision',configuration:'Internal setup',testing:'Verify both routes',audienceText:'We review your request'});
 document.querySelector('[data-rehearsal="save-draft"]').click();await settle();assert.equal(db.calls.length,before+1);const p=api.state().workhub.rehearsal.processes[0];assert.equal(p.name,'Request handling');assert.equal(p.steps[2].inputs,'Request form');assert.equal(p.presenterNotes,'Private prompts');assert.equal(api.parseBackup(JSON.stringify(db.row.document)).workhub.rehearsal.processes[0].steps[2].configuration,'Internal setup');
 const view=document.getElementById('processHubView');view.value='present';view.dispatchEvent(new window.Event('change',{bubbles:true}));assert.doesNotMatch(document.getElementById('processHubOverlay').textContent,/Private prompts|Internal setup/);api.hub.rehearsal.setMode('normal',false);assert.equal(document.getElementById('processHubOverlay'),null);assert.equal(document.getElementById('rehearsalProcess').value,p.id);
 const reloaded=await app(t,{remote:copy(db.row),login:false});await reloaded.api.loadCloud(sessionUser);reloaded.api.showTab('processhub');assert.equal(reloaded.api.hub.rehearsal.model().steps[2].testing,'Verify both routes');
});

test('Process Hub: old hub records play and edit without copying or losing their maintained information',async t=>{
 const {api,document,window,db}=await app(t);await hubAction(api,'process-example');api.mutate(d=>{const p=d.workhub.processes[0];p.steps[0].next=[p.steps[1].id,p.steps[2].id];p.steps[0].configuration='Existing configuration';p.steps[0].testing='Existing tests';p.steps[0].errors='Existing solution';});await settle();
 api.showTab('processhub');const old=api.state().workhub.processes[0];api.hub.rehearsal.open(old.id);api.showTab('processhub');const calls=db.calls.length;for(let n=1;n<100;n++)api.hub.rehearsal.tick(n*150);assert.equal(db.calls.length,calls);assert.equal(api.state().workhub.rehearsal.processes.length,0);
 document.querySelector('[data-rehearsal="edit-process"]').click();await settle();api.hub.rehearsal.stepEditor(old.steps[0].id);const f=document.getElementById('rehearsalStepForm');assert.equal(f.elements.namedItem('configuration').value,'Existing configuration');fill(f,{expected:'A maintained result'});document.querySelector('[data-rehearsal="save-draft"]').click();await settle();const updated=api.state().workhub.processes[0];assert.equal(updated.steps[0].testing,'Existing tests');assert.equal(updated.steps[0].expected,'A maintained result');assert.deepEqual(copy(updated.steps[0].next),old.steps[0].next);assert.equal(api.state().workhub.rehearsal.processes.length,0);api.validate(api.state());api.parseBackup(JSON.stringify(db.row.document));
});

test('Batch D: named decision answers save through the account document and reload without presentation-state writes',async t=>{
 const {api,document,window,db}=await app(t);api.showTab('processhub');document.querySelector('[data-rehearsal="keep"]').click();await settle();
 const rehearsal=api.hub.rehearsal;rehearsal.stepEditor('match');const form=document.getElementById('rehearsalStepForm');
 fill(form,{decisionQuestion:'Is the request complete?','decisionLabel-0':'Continue to review','decisionNext-0':'invoice','decisionLabel-1':'Ask for details','decisionNext-1':'followup'});form.elements.namedItem('decisionEnabled').checked=true;
 rehearsal.saveForm(form);await settle();assert.equal(rehearsal.model().steps.find(s=>s.id==='match').decision.question,'Is the request complete?');
 const saved=api.parseBackup(JSON.stringify(db.row.document));assert.equal(saved.workhub.rehearsal.processes[0].steps.find(s=>s.id==='match').decision.answers[1].label,'Ask for details');
 const before=db.calls.length;const mode=document.getElementById('rehearsalDecisionMode');mode.value='interactive';mode.dispatchEvent(new window.Event('change',{bubbles:true}));window.open=()=>null;rehearsal.presenter.open();await settle();assert.equal(db.calls.length,before);rehearsal.presenter.close();
 const reloaded=await app(t,{remote:copy(db.row),login:false});await reloaded.api.loadCloud(sessionUser);reloaded.api.showTab('processhub');assert.equal(reloaded.api.hub.rehearsal.model().steps.find(s=>s.id==='match').decision.answers[0].next,'invoice');
});
