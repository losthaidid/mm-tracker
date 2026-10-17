/* Batch A: small workflow tools woven into the existing workspace. */
(function(root){
'use strict';
const E=root.WorkHubBatchEngine;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={tasks:'Task',tickets:'Ticket',specs:'Project item',notes:'Knowledge note',projects:'Project'};
const btn=(action,label,attrs='',cls='')=>'<button type="button" data-batch="'+action+'" class="batch-button '+cls+'" '+attrs+'>'+label+'</button>';
const attrs=(kind,id)=>'data-kind="'+esc(kind)+'" data-id="'+esc(id)+'"';
const options=(items,value,blank='Choose…')=>'<option value="">'+esc(blank)+'</option>'+items.map(([id,name])=>'<option value="'+esc(id)+'"'+(id===value?' selected':'')+'>'+esc(name)+'</option>').join('');
const input=(name,label,value='',type='text',extra='')=>'<label class="batch-field">'+esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
const area=(name,label,value='',extra='')=>'<label class="batch-field batch-wide">'+esc(label)+'<textarea name="'+name+'" rows="3" '+(extra.includes('maxlength=')?'':'maxlength="8000" ')+extra+'>'+esc(value)+'</textarea></label>';
const select=(name,label,items,value='',blank)=>'<label class="batch-field">'+esc(label)+'<select name="'+name+'">'+options(items,value,blank)+'</select></label>';
const duration=n=>Math.floor(n/60)+'h'+(n%60?' '+n%60+'m':'');
function install(a){
 const $=id=>document.getElementById(id),state=()=>a.state(),data=()=>state().workhub.batchA;
 let owner='',filters={},glossaryQuery='',locationStart='',locationEnd='',undo=null;
 function sync(){const next=a.owner?.()||'';if(next!==owner){owner=next;filters={};glossaryQuery='';locationStart=locationEnd='';undo=null;$('batchUndo')?.remove();}return next;}
 function ready(){sync();if(!a.ready())throw Error('Sign in to open your work context.');}
 function save(fn,message='Work context saved.'){ready();const ok=a.mutate(d=>{E.upgrade(d);fn(d);});if(ok)a.tell(message);return ok;}
 function open(title,body){a.openModal(title,body);}
 function footer(label='Save'){return'<div class="modal-actions">'+btn('close','Cancel')+'<button class="primary" type="submit">'+label+'</button></div>';}
 function form(title,id,body,extra=''){open(title,'<form id="'+id+'" '+extra+'><div class="batch-form">'+body+'</div>'+footer()+'</form>');}
 function matches(kind,id){const f=filters[kind]||{},m=E.meta(state(),kind,id);return(!f.label||m?.labelIds.includes(f.label))&&(!f.environment||m?.environmentId===f.environment);}
 function fields(kind,id){
  const m=E.meta(state(),kind,id)||{},labelIds=m.labelIds||[];
  return'<section data-batch-fields class="batch-form-context batch-wide"><div class="batch-section-label"><span>WORK CONTEXT</span><small>Shared across projects</small></div><div class="batch-form">'+select('batchEnvironment','Environment',data().environments.map(x=>[x.id,x.name]),m.environmentId,'No environment')+input('batchSystem','System ID',m.systemId,'text','maxlength="80" placeholder="e.g. S4D"')+input('batchClient','Client',m.client,'text','maxlength="40" placeholder="e.g. 100"')+'</div><fieldset class="batch-label-choices"><legend>Shared labels</legend>'+(data().labels.length?data().labels.map(l=>'<label><input type="checkbox" name="batchLabel" value="'+esc(l.id)+'"'+(labelIds.includes(l.id)?' checked':'')+'>'+esc(l.name)+'</label>').join(''):'<span class="batch-muted">Create labels in Work context settings.</span>')+'</fieldset>'+btn('settings','Manage labels & environments','','small')+(kind==='tasks'?'<div class="batch-form">'+select('batchOutcome','Closure outcome',Object.entries(E.OUTCOMES),m.outcome,'Choose when closing')+area('batchOutcomeNote','Outcome notes',m.outcomeNote)+'</div>':'')+'</section>';
 }
 function capture(d,form,kind,id){
  if(!form.querySelector('[data-batch-fields]'))return;
  const v=new FormData(form),values={environmentId:v.get('batchEnvironment')||'',systemId:(v.get('batchSystem')||'').trim(),client:(v.get('batchClient')||'').trim(),labelIds:v.getAll('batchLabel')};
  if(kind==='tasks'){values.outcome=v.get('batchOutcome')||'';values.outcomeNote=(v.get('batchOutcomeNote')||'').trim();}
  E.patch(d,kind,id,values);
 }
 function decorateModal(){
  const modal=$('modal'),body=$('modalBody');if(!modal||!body)return;
  modal.classList.remove('batch-reading');modal.removeAttribute('data-batch-reading');
  const formEl=body.querySelector('#editForm,#hubNote,#projectForm');
  if(formEl&&!formEl.querySelector('[data-batch-fields]')&&a.ready()){
   const kind=formEl.id==='hubNote'?'notes':formEl.id==='projectForm'?'projects':formEl.dataset.group;
   if(E.KINDS.includes(kind)){const grid=formEl.querySelector('.form-grid');if(grid)grid.insertAdjacentHTML('beforeend',fields(kind,formEl.dataset.id||''));}
  }
  if(!body.querySelector('form')&&body.querySelector('.hub-detail,.view-details,.booking-view-hero,.batch-detail,.batch-location-overview')&&!body.querySelector('.batch-reader-toolbar')){
   body.insertAdjacentHTML('afterbegin','<div class="batch-reader-toolbar">'+btn('reading','◫ Reading mode','','small')+'<span>Room for the details</span></div>');
  }
  timerStartContext();
 }
 function timerStartContext(){
  const f=$('hubTimerStart');if(!f)return;f.querySelector('.batch-start-context')?.remove();
  const kind=f.elements.namedItem('kind')?.value,id=f.elements.namedItem('linkId')?.value,m=E.meta(state(),kind==='task'?'tasks':kind==='ticket'?'tickets':'projects',id||'');
  if(m?.nextStep||m?.pause?.active)f.insertAdjacentHTML('afterbegin','<section class="batch-callout batch-start-context"><span class="batch-eyebrow">WHERE YOU LEFT OFF</span>'+(m.pause?.active?'<p>'+esc(E.PAUSES[m.pause.reason])+'</p>':'')+(m.nextStep?'<p class="prewrap hub-sensitive"><strong>Next:</strong> '+esc(m.nextStep)+'</p>':'')+'</section>');
 }
 function toggleReading(){
  const modal=$('modal'),on=!modal.classList.contains('batch-reading');modal.classList.toggle('batch-reading',on);
  modal.dataset.batchReading=String(on);const b=modal.querySelector('[data-batch="reading"]');if(b){b.textContent=on?'↙ Exit reading mode':'◫ Reading mode';b.setAttribute('aria-pressed',String(on));}modal.scrollTop=0;
 }
 function badges(kind,id){
  const d=state(),r=E.record(d,kind,id),m=E.meta(d,kind,id);if(!r)return'';
  const env=data().environments.find(x=>x.id===m?.environmentId),labels=(m?.labelIds||[]).map(id=>data().labels.find(l=>l.id===id)).filter(Boolean),deps=kind==='tasks'?E.blockers(d,id):[];
  return'<div class="batch-record-context">'+(env?'<span class="batch-chip batch-environment" title="'+esc([m.systemId,m.client?'Client '+m.client:''].filter(Boolean).join(' · '))+'">'+esc(env.name)+([m.systemId,m.client].filter(Boolean).length?' <small>'+esc([m.systemId,m.client].filter(Boolean).join(' / '))+'</small>':'')+'</span>':m?.systemId||m?.client?'<span class="batch-chip">'+esc([m.systemId,m.client?'Client '+m.client:''].filter(Boolean).join(' · '))+'</span>':'')+labels.map(l=>'<span class="batch-chip batch-label">'+esc(l.name)+'</span>').join('')+(deps.length?btn('dependencies','⛓ '+deps.length+' dependenc'+(deps.length===1?'y':'ies')+' waiting',attrs(kind,id),'batch-blocked'):kind==='tasks'&&m?.dependencies.length?'<span class="batch-chip batch-ready">✓ Prerequisites ready</span>':'')+(m?.pause?.active?'<span class="batch-chip batch-paused">Ⅱ '+esc(E.PAUSES[m.pause.reason])+'</span>':'')+(kind==='tasks'&&r.done?btn('context',m?.outcome?'✓ '+esc(E.OUTCOMES[m.outcome]):'Set closure outcome',attrs(kind,id),'batch-outcome'):'')+btn('record','Work context ↗',attrs(kind,id),'batch-context-link')+'</div>';
 }
 function recordView(kind,id,read=false){
  ready();
  const d=state(),r=E.record(d,kind,id),m=E.meta(d,kind,id);if(!r)throw Error('This record no longer exists.');
  const sections=[['Description',r.description],['Remarks',r.remarks],['Feedback',r.feedback],['Latest history',kind==='tickets'?a.latestHistory?.(r)||r.history:''],['Situation, cause and solution',r.body],['Configuration',r.configuration],['Common errors',r.errors],['Testing checklist',r.testing]];
  const session=d.workhub.sessions.find(s=>s.id===m?.lastSessionId),split=kind==='tasks'&&m?.splitFrom?E.record(d,'tasks',m.splitFrom):null;
  open(E.title(r,kind),'<div class="batch-detail"><span class="batch-eyebrow">'+names[kind]+' · WORK CONTEXT</span>'+badges(kind,id)+(split?'<p class="batch-muted">Split from '+esc(split.task)+'. The original notes and links are retained.</p>':'')+(m?.pause?.active?'<section class="batch-callout"><h3>'+esc(E.PAUSES[m.pause.reason])+'</h3><p class="prewrap hub-sensitive">'+esc(m.pause.notes)+'</p></section>':'')+(m?.nextStep?'<section class="batch-callout"><h3>Your next step</h3><p class="prewrap hub-sensitive">'+esc(m.nextStep)+'</p></section>':'')+(session?.completedWork?'<section><h3>Last session wrap-up</h3><p class="prewrap hub-sensitive">'+esc(session.completedWork)+'</p></section>':'')+sections.filter(([,v])=>v).map(([name,value])=>'<section><h3>'+name+'</h3><p class="prewrap hub-sensitive">'+esc(value)+'</p></section>').join('')+(kind==='tasks'?dependencyList(id):'')+(m?.outcomeNote?'<section><h3>Outcome notes</h3><p class="prewrap hub-sensitive">'+esc(m.outcomeNote)+'</p></section>':'')+'<div class="batch-actions">'+btn('context','Edit context',attrs(kind,id))+(kind==='tasks'?btn('dependencies','Dependencies',attrs(kind,id))+(!r.done&&!r.archived?btn('split','Split into smaller tasks',attrs(kind,id)):''):'')+btn('open-original','Open record',attrs(kind,id))+btn('close','Close')+'</div></div>');
  if(read)toggleReading();
 }
 function contextForm(kind,id){
  ready();
  const r=E.record(state(),kind,id),m=E.meta(state(),kind,id);if(!r)throw Error('This record no longer exists.');
  form('Work context · '+E.title(r,kind),'batchContext',fields(kind,id)+select('pauseReason','Pause reason',Object.entries(E.PAUSES),m?.pause?.active?m.pause.reason:'','Work is not paused')+area('pauseNotes','Why did work stop?',m?.pause?.notes)+area('nextStep','The next small step',m?.nextStep),'data-kind="'+kind+'" data-id="'+esc(id)+'"');
 }
 function dependencyList(id){
  const m=E.meta(state(),'tasks',id),deps=m?.dependencies||[];return'<section class="batch-dependencies"><h3>What needs to happen first</h3>'+(deps.length?deps.map(dep=>{const s=E.dependencyState(state(),dep);return'<div class="batch-dependency '+(s.done?'is-ready':'')+'"><span class="batch-dep-marker">'+(s.done?'✓':'○')+'</span><div><small>'+E.DEPENDENCIES[dep.type]+'</small><strong class="hub-sensitive">'+esc(s.title)+'</strong><span>'+ (s.done?'Ready':s.missing?'Linked task was removed. Review this dependency.':'Waiting')+'</span></div>'+(dep.type==='task'&&!s.missing?btn('record','Open',attrs('tasks',dep.targetId),'small'):dep.type!=='task'?btn('dependency-toggle',s.done?'Reopen':'Mark ready','data-id="'+esc(id)+'" data-dependency="'+esc(dep.id)+'"','small'):'')+btn('dependency-remove','Remove','data-id="'+esc(id)+'" data-dependency="'+esc(dep.id)+'"','small')+'</div>';}).join(''):'<p class="batch-muted">Nothing is blocking this task. Add a task, approval, document or external event when needed.</p>')+'</section>';
 }
 function dependencies(id){
  ready();
  const task=E.record(state(),'tasks',id);if(!task)throw Error('This task no longer exists.');
  const candidates=state().tasks.filter(t=>t.id!==id&&!t.archived).map(t=>[t.id,(t.number?t.number+'. ':'')+t.task]);
  open('Dependencies · '+task.task,'<div class="batch-detail"><span class="batch-eyebrow">A CLEAR PATH TO START</span>'+dependencyList(id)+'<form id="batchDependency" data-id="'+esc(id)+'"><div class="batch-form">'+select('type','Dependency type',Object.entries(E.DEPENDENCIES),'task')+'<div id="batchDependencyTask">'+select('targetId','Prerequisite task',candidates,'','Choose a task')+'</div><div id="batchDependencyTitle" hidden>'+input('title','Approval, document or event','','text','maxlength="500"')+'</div></div><p class="batch-muted">Task prerequisites become ready when that task is completed. Other types are marked ready explicitly. Dependency loops are blocked.</p><button class="primary" type="submit">Add dependency</button></form></div>');
 }
 function splitForm(id){
  ready();
  const t=E.record(state(),'tasks',id);if(!t||t.done||t.archived)throw Error('Choose an open task to split.');
  form('Make room for smaller steps','batchSplit','<div class="batch-callout batch-wide"><span class="batch-eyebrow">SPLITTING</span><h3 class="hub-sensitive">'+esc(t.task)+'</h3><p>The original task and its subtasks stay here. Each new main task receives the same remarks, feedback, reference links, project or ticket link, labels, environment and prerequisites. New tasks start open, without copied subtasks.</p></div>'+area('titles','New task titles — one per line','','required placeholder="First small outcome&#10;Next small outcome"')+'<p class="batch-muted batch-wide">Create 2–20 tasks. The original task stays open for you to manage.</p>','data-id="'+esc(id)+'"');
 }
 function settings(){
  ready();
  open('Work context settings','<div class="batch-settings"><div class="batch-intro"><span class="batch-eyebrow">SMALL DETAILS. SHARED CONTEXT.</span><h3>Keep work connected.</h3><p>Labels travel across projects. Environment badges make the right system easy to spot.</p></div><section><h3>Shared labels</h3><div class="batch-maintained">'+data().labels.map(l=>'<div><span class="batch-chip batch-label">'+esc(l.name)+'</span>'+btn('browse-label','Browse work','data-id="'+esc(l.id)+'"','small')+btn('label-remove','Remove','data-id="'+esc(l.id)+'"','small')+'</div>').join('')+'</div><form id="batchLabel"><div class="batch-inline">'+input('name','New shared label','','text','required maxlength="80" placeholder="e.g. Client discussion"')+'<button type="submit" class="primary">Add label</button></div></form></section><section><h3>Environment list</h3><div class="batch-maintained">'+data().environments.map(e=>'<form id="batchEnvironment-'+esc(e.id)+'" data-batch-environment="'+esc(e.id)+'"><div class="batch-inline">'+input('name','Environment name',e.name,'text','required maxlength="80"')+'<button type="submit">Rename</button>'+btn('environment-remove','Remove','data-id="'+esc(e.id)+'"','small')+'</div></form>').join('')+'</div><form id="batchEnvironmentNew"><div class="batch-inline">'+input('name','New environment','','text','required maxlength="80" placeholder="e.g. Sandbox"')+'<button type="submit" class="primary">Add environment</button></div></form></section><section><h3>Stale-work alerts</h3><form id="batchStaleSettings"><div class="batch-inline">'+input('days','Days without an update',data().staleDays,'number','min="0" max="365" required')+'<button type="submit">Save threshold</button></div><p class="batch-muted">Use 0 to turn alerts off. Open tasks and tickets are checked when you open My day. Records without an update date are listed separately for review.</p></form></section></div>');
 }
 function browse(id){
  ready();
  const label=data().labels.find(l=>l.id===id);if(!label)throw Error('This label no longer exists.');
  const found=E.KINDS.flatMap(kind=>E.rows(state(),kind).filter(r=>E.meta(state(),kind,r.id)?.labelIds.includes(id)).map(r=>({kind,r})));
  open(label.name+' · Across projects','<div class="batch-detail"><span class="batch-eyebrow">ONE LABEL. EVERY PROJECT.</span><p>'+found.length+' linked records</p><div class="batch-linked-list">'+found.slice(0,300).map(({kind,r})=>btn('record','<small>'+names[kind]+' · '+esc(projectName(kind,r))+'</small><strong class="hub-sensitive">'+esc(E.title(r,kind))+'</strong>',attrs(kind,r.id))).join('')+'</div>'+(found.length>300?'<p>Showing the first 300 records. Use the shared-label filters in each workspace to narrow your view.</p>':'')+'</div>');
 }
 function projectName(kind,r){const id=kind==='projects'?r.id:kind==='tasks'&&r.taskType==='Project'?r.linkId:r.projectId;return state().projects.find(p=>p.id===id)?.name||'General work';}
 function glossary(){
  ready();
  const q=glossaryQuery.toLowerCase(),all=data().glossary.filter(g=>(g.term+' '+g.meaning+' '+g.aliases+' '+g.context+' '+(state().projects.find(p=>p.id===g.projectId)?.name||'')).toLowerCase().includes(q));
  open('Personal glossary','<section class="batch-glossary"><div class="batch-intro"><span class="batch-eyebrow">YOUR WORDS, CLOSE AT HAND</span><h3>A little clarity goes a long way.</h3><p>SAP terms, client abbreviations and the names your projects use.</p></div><div class="batch-inline"><label class="batch-field">Find a term<input id="batchGlossarySearch" type="search" value="'+esc(glossaryQuery)+'" placeholder="Search terms, meanings or projects"></label>'+btn('glossary-edit','＋ Add term','','primary')+'</div><div id="batchGlossaryResults">'+glossaryRows(all)+'</div></section>');
 }
 function glossaryRows(all){return all.slice(0,200).map(g=>'<article class="batch-term"><div><span class="batch-eyebrow">'+esc(state().projects.find(p=>p.id===g.projectId)?.name||'SHARED REFERENCE')+'</span><h3 class="hub-sensitive">'+esc(g.term)+'</h3>'+(g.aliases?'<small>'+esc(g.aliases)+'</small>':'')+'</div><p class="prewrap hub-sensitive">'+esc(g.meaning)+'</p>'+(g.context?'<p class="batch-muted hub-sensitive">'+esc(g.context)+'</p>':'')+'<div class="batch-actions">'+btn('glossary-edit','Edit','data-id="'+esc(g.id)+'"','small')+btn('glossary-remove','Remove','data-id="'+esc(g.id)+'"','small')+'</div></article>').join('')+(all.length?'':'<p class="batch-empty">Your own definitions belong here. Add a term to begin.</p>')+(all.length>200?'<p>Showing 200 of '+all.length+' terms. Refine your search to find the rest.</p>':'');}
 function glossaryForm(id=''){
  ready();
  const g=data().glossary.find(g=>g.id===id)||{};
  form(id?'Edit glossary term':'A new term to remember','batchGlossary',input('term','Term or abbreviation',g.term,'text','required maxlength="120"')+input('aliases','Also known as',g.aliases,'text','maxlength="500"')+area('meaning','Meaning in your own words',g.meaning,'required')+area('context','When you use it',g.context,'maxlength="1000"')+select('projectId','Project context',state().projects.map(p=>[p.id,p.name]),g.projectId,'Shared across projects'),'data-id="'+esc(id)+'"');
 }
 function stalePanel(){
  const summary=E.stale(state(),a.today());return'<section class="batch-stale-card"><div><span class="batch-eyebrow">A GENTLE NUDGE</span><h3>Anything need a fresh look?</h3><p>'+summary.items.length+' open item'+(summary.items.length===1?'':'s')+' without an update for '+data().staleDays+' days'+(summary.unknown.length?' · '+summary.unknown.length+' without an update date':'')+'</p></div>'+btn('stale','Review work ↗','','batch-soft')+'</section>';
 }
 function staleView(){
  ready();
  const s=E.stale(state(),a.today()),list=(items,unknown=false)=>items.slice(0,200).map(x=>'<article class="batch-stale-row"><div><small>'+names[x.kind]+' · '+(unknown?'No update date':x.age+' days without an update')+'</small><strong class="hub-sensitive">'+esc(x.title)+'</strong></div>'+btn('record','Open',attrs(x.kind,x.id),'small')+btn('reviewed','Mark reviewed',attrs(x.kind,x.id),'small')+'</article>').join('');
  open('A fresh look at open work','<div class="batch-detail"><span class="batch-eyebrow">YOUR STALE-WORK REVIEW</span><p>The threshold is '+data().staleDays+' days. Mark reviewed records the check without changing status or deadlines.</p>'+btn('settings','Change threshold','','small')+'<h3>Waiting for a fresh update · '+s.items.length+'</h3>'+(list(s.items)||'<p class="batch-muted">No dated records need attention.</p>')+(s.items.length>200?'<p>Showing the oldest 200 items.</p>':'')+'<h3>No update date yet · '+s.unknown.length+'</h3><p class="batch-muted">Earlier tasks may have no timestamp. Their age is not guessed. Reviewing one starts its update history.</p>'+list(s.unknown,true)+(s.unknown.length>200?'<p>Showing the first 200 undated records.</p>':'')+'</div>');
 }
 function resumeCards(){
  const t=a.timer?.(),candidates=E.resumable(state()).slice(0,3),timer=t&&!t.runningSince;
  if(!timer&&!candidates.length)return'';
  return'<section class="batch-resume"><div class="batch-resume-heading"><span class="batch-resume-art" aria-hidden="true">↗</span><div><span class="batch-eyebrow">PICK UP YOUR THREAD</span><h3>A soft landing back into work.</h3></div></div>'+(timer?'<article class="batch-resume-item"><div><small>PAUSED STOPWATCH</small><strong class="hub-sensitive">'+esc(t.title)+'</strong><p>'+esc(E.PAUSES[t.pauseReason]||'Ready when you are.')+'</p>'+(t.nextStep?'<p class="hub-sensitive">Next: '+esc(t.nextStep)+'</p>':'')+'</div>'+btn('resume-timer','▶ Resume timer','','primary')+'</article>':'')+candidates.filter(m=>!(timer&&timerKey(t)?.kind===m.kind&&timerKey(t)?.id===m.recordId)).map(m=>{const r=E.record(state(),m.kind,m.recordId),s=state().workhub.sessions.find(s=>s.id===m.lastSessionId);return'<article class="batch-resume-item"><div><small>'+names[m.kind]+(m.pause?.active?' · '+esc(E.PAUSES[m.pause.reason]):' · LAST SESSION')+'</small><strong class="hub-sensitive">'+esc(E.title(r,m.kind))+'</strong>'+(s?.completedWork?'<p class="hub-sensitive">'+esc(s.completedWork)+'</p>':'')+(m.pause?.active&&m.pause.notes?'<p class="hub-sensitive">'+esc(m.pause.notes)+'</p>':s?.pauseReason?'<p class="hub-sensitive"><b>Last pause: '+esc(E.PAUSES[s.pauseReason]||s.pauseReason)+'</b>'+(s.pauseNotes?' · '+esc(s.pauseNotes):'')+'</p>':'')+(m.nextStep?'<p class="batch-next hub-sensitive"><b>Next</b> '+esc(m.nextStep)+'</p>':'')+'</div><div class="batch-actions">'+btn('record','Open',attrs(m.kind,m.recordId))+(m.kind==='tasks'||m.kind==='tickets'||m.kind==='projects'?btn('resume-record','▶ Continue',attrs(m.kind,m.recordId),'batch-soft'):'')+'</div></article>';}).join('')+'</section>';
 }
 function locationView(start=locationStart,end=locationEnd){
  ready();
  if(!start){const month=a.month?.()||state().calendarMonth||a.today().slice(0,7);start=month+'-01';const [y,m]=month.split('-').map(Number);end=month+'-'+String(new Date(Date.UTC(y,m,0)).getUTCDate()).padStart(2,'0');}
  const result=E.locations(state(),start,end);locationStart=start;locationEnd=end;
  open('Your work, by location','<div class="batch-location-overview"><div class="batch-intro"><span class="batch-eyebrow">OFFICE. CLIENT SITE. REMOTE.</span><h3>See where your days went.</h3><p>A view of scheduled work for any period, using your maintained work locations.</p></div><form id="batchLocations"><div class="batch-inline">'+input('start','From',start,'date','required')+input('end','Through',end,'date','required')+'<button class="primary" type="submit">Show period</button></div></form><div class="batch-location-totals"><div><span>Days with work</span><strong>'+result.days+'</strong></div><div><span>Booked time</span><strong>'+duration(result.minutes)+'</strong></div><div><span>Locations</span><strong>'+result.groups.length+'</strong></div></div><div class="batch-location-list">'+result.groups.map((g,i)=>'<article><span class="batch-location-symbol" aria-hidden="true">'+['⌂','↗','◫'][i%3]+'</span><div><strong>'+esc(g.name)+'</strong><div class="batch-location-track"><i style="width:'+(result.minutes?Math.round(g.minutes/result.minutes*100):0)+'%"></i></div></div><span>'+g.days+' day'+(g.days===1?'':'s')+'<b>'+duration(g.minutes)+'</b></span></article>').join('')+'</div>'+(!result.groups.length?'<p class="batch-empty">No scheduled work in this period.</p>':'')+'<p class="batch-muted">Days count once per location; a mixed-location day can appear in more than one total. Time comes from Schedule bookings, including stopwatch entries. Leave is excluded. Location not set is shown separately.</p></div>');
 }
 function timerKey(t){return t?.kind==='task'?{kind:'tasks',id:t.linkId}:t?.kind==='ticket'?{kind:'tickets',id:t.linkId}:t?.kind==='project'?{kind:t.itemId?'specs':'projects',id:t.itemId||t.linkId}:null;}
 function pauseTimerPrompt(){
  ready();
  const t=a.timer?.();if(!t)return; a.pauseTimer();
  form('Leave yourself a little context','batchTimerPause','<div class="batch-callout batch-wide"><span class="batch-eyebrow">STOPWATCH PAUSED</span><h3 class="hub-sensitive">'+esc(t.title)+'</h3><p>Pause time is excluded. Your reason and next step will be waiting on My day.</p></div>'+select('reason','Why are you pausing?',Object.entries(E.PAUSES),t.pauseReason||'','Choose a reason')+area('notes','A little more context',t.pauseNotes)+area('nextStep','Where should you pick up?',t.nextStep),'data-timer="'+esc(t.id)+'"');
 }
 function wrapTimerPrompt(){
  ready();
  const t=a.timer?.();if(!t)return;a.pauseTimer();
  form('A small wrap-up, before you go','batchTimerWrap','<div class="batch-callout batch-wide"><span class="batch-eyebrow">WORK SESSION</span><h3 class="hub-sensitive">'+esc(t.title)+'</h3><p>Your stopwatch is paused. Capture the useful part, then save your active time.</p></div>'+area('completedWork','What did you complete or learn?',t.completedWork)+area('nextStep','The next small step',t.nextStep)+area('notes','Session remarks',t.notes),'data-timer="'+esc(t.id)+'"');
 }
 function timerFields(t){return{completedWork:t.completedWork||'',nextStep:t.nextStep||'',pauseReason:t.pauseReason||'',pauseNotes:t.pauseNotes||''};}
 function timerStarted(t){const k=timerKey(t),m=k&&E.meta(state(),k.kind,k.id);if(m&&(m.pause?.active||m.nextStep)){t.previousNextStep=m.nextStep;save(d=>{const r=E.touch(d,k.kind,k.id);if(r.pause)r.pause.active=false;r.nextStep='';r.updatedAt=E.iso();},'Work resumed.');}}
 function mount(tab){
  sync();if(!a.ready())return;
  const view=$('view');if(!view)return;
  const settingsMenu=$('settingsMenu');if(settingsMenu&&!settingsMenu.querySelector('[data-batch="settings"]'))settingsMenu.insertAdjacentHTML('beforeend',btn('settings','Work context & labels'));
  const targets=new Map();
  for(const b of view.querySelectorAll('[data-action="edit"][data-group]')){const kind=b.dataset.group;if(!['tasks','tickets','specs'].includes(kind))continue;const card=b.closest('.task-main-card,.ticket-queue-card,.ticket-card,.item-card,tr,article');if(card)targets.set(card,{kind,id:b.dataset.id});}
  for(const card of view.querySelectorAll('[data-task-card]'))targets.set(card,{kind:'tasks',id:card.dataset.taskCard});
  for(const b of view.querySelectorAll('[data-hub="note-view"]')){const card=b.closest('.hub-card');if(card)targets.set(card,{kind:'notes',id:b.dataset.id});}
  for(const [card,r]of targets){if(card.querySelector('.batch-record-context'))continue;const html=badges(r.kind,r.id);if(card.tagName==='TR'){const cell=card.querySelector('.desc,td');cell?.insertAdjacentHTML('beforeend',html);}else card.insertAdjacentHTML('beforeend',html);}
  const filterKind={tasks:'tasks',tickets:'tickets',specs:'specs',knowledge:'notes'}[tab];
  if(filterKind&&!view.querySelector('.batch-filter-toolbar')){
   const f=filters[filterKind]||{},el=document.createElement('div');el.className='batch-filter-toolbar';el.innerHTML='<span class="batch-eyebrow">CONNECTED WORK</span>'+select('batchFilterLabel','Shared label',data().labels.map(l=>[l.id,l.name]),f.label,'All labels')+select('batchFilterEnvironment','Environment',data().environments.map(e=>[e.id,e.name]),f.environment,'All environments')+btn('settings','Manage','','small')+(tab==='knowledge'?btn('glossary','Personal glossary ↗','','batch-soft'):'');el.dataset.kind=filterKind;
   const target=view.querySelector('.workspace-heading,.hub-head,.project-toolbar,.panel-top');if(target)target.after(el);else view.prepend(el);
  }
  if(tab==='home'){
   view.querySelector('.batch-day')?.remove();const html=resumeCards()+(data().staleDays?stalePanel():'');if(html){const el=document.createElement('div');el.className='batch-day';el.innerHTML=html;const heading=view.querySelector('.hub-head');if(heading)heading.after(el);else view.prepend(el);}
  }
  if(tab==='schedule'&&!view.querySelector('[data-batch="locations"]')){const target=view.querySelector('.workspace-heading,.panel-top,.schedule-toolbar')||view;target.insertAdjacentHTML('beforeend',btn('locations','◫ Work locations','','batch-location-button'));}
  if(tab==='specs'&&!view.querySelector('[data-batch="project-context"]')){const target=view.querySelector('.project-toolbar,.workspace-heading,.panel-top');if(target)target.insertAdjacentHTML('beforeend',btn('project-context','Project context','','small'));}
  for(const b of view.querySelectorAll('[data-hub="session-archive"],[data-hub="session-restore"]')){
   const session=state().workhub.sessions.find(s=>s.id===b.dataset.id),card=b.closest('article,.hub-session');if(!session||!card||card.querySelector('.batch-session-summary'))continue;
   if(session.completedWork||session.nextStep||session.pauseReason)card.insertAdjacentHTML('beforeend','<div class="batch-session-summary">'+(session.completedWork?'<p class="hub-sensitive"><b>Wrap-up</b> '+esc(session.completedWork)+'</p>':'')+(session.nextStep?'<p class="hub-sensitive"><b>Next</b> '+esc(session.nextStep)+'</p>':'')+(session.pauseReason?'<small>Last pause: '+esc(E.PAUSES[session.pauseReason]||session.pauseReason)+'</small>':'')+'</div>');
  }
 }
 function removeGlossary(id){const g=data().glossary.find(x=>x.id===id);if(!g)return;undo={owner,entry:E.copy(g)};if(save(d=>{d.workhub.batchA.glossary=d.workhub.batchA.glossary.filter(x=>x.id!==id);},'Term removed. Undo is available.')){glossary();$('batchUndo')?.remove();const b=document.createElement('button');b.id='batchUndo';b.className='batch-undo';b.dataset.batch='undo-glossary';b.textContent='Undo glossary removal';document.body.append(b);}}
 async function handle(el){
  ready();const action=el.dataset.batch,id=el.dataset.id,kind=el.dataset.kind;
  if(action==='close'){a.closeModal();return;}
  if(action==='reading'){toggleReading();return;}
  if(action==='record'){recordView(kind,id);return;}
  if(action==='context'){contextForm(kind,id);return;}
  if(action==='dependencies'){dependencies(id);return;}
  if(action==='split'){splitForm(id);return;}
  if(action==='settings'){if($('modalBody')?.querySelector('form')&&!root.confirm('Open settings and discard unsaved changes in this form?'))return;if($('settingsMenu'))$('settingsMenu').open=false;settings();return;}
  if(action==='glossary'){glossary();return;}
  if(action==='glossary-edit'){glossaryForm(id);return;}
  if(action==='glossary-remove'){removeGlossary(id);return;}
  if(action==='undo-glossary'){if(undo?.owner===owner&&save(d=>d.workhub.batchA.glossary.push(undo.entry),'Term restored.')){undo=null;$('batchUndo')?.remove();glossary();}return;}
  if(action==='browse-label'){browse(id);return;}
  if(action==='stale'){staleView();return;}
  if(action==='reviewed'){if(save(d=>{E.patch(d,kind,id,{reviewedAt:E.iso()});},'Marked as reviewed.'))staleView();return;}
  if(action==='locations'){locationView();return;}
  if(action==='project-context'){recordView('projects',state().activeProjectId);return;}
  if(action==='dependency-toggle'||action==='dependency-remove'){
   if(save(d=>{const m=E.touch(d,'tasks',id),dep=m.dependencies.find(x=>x.id===el.dataset.dependency);if(!dep)throw Error('Dependency no longer exists.');if(action==='dependency-remove')m.dependencies=m.dependencies.filter(x=>x.id!==dep.id);else{if(dep.type==='task')throw Error('Complete the linked task to make it ready.');dep.resolved=!dep.resolved;}m.updatedAt=E.iso();}))dependencies(id);return;
  }
  if(action==='label-remove'||action==='environment-remove'){
   const label=action==='label-remove',item=data()[label?'labels':'environments'].find(x=>x.id===id);if(!item)return;
   if(!root.confirm('Remove '+item.name+' from the list and all assigned records?'))return;
   if(save(d=>{const h=d.workhub.batchA;h[label?'labels':'environments']=h[label?'labels':'environments'].filter(x=>x.id!==id);for(const m of h.records){if(label)m.labelIds=m.labelIds.filter(x=>x!==id);else if(m.environmentId===id)m.environmentId='';}},'List updated.')){for(const f of Object.values(filters))if(f[label?'label':'environment']===id)f[label?'label':'environment']='';a.render();settings();}return;
  }
  if(action==='resume-timer'){a.resumeTimer();a.render();return;}
  if(action==='resume-record'){await a.hubAction({dataset:{hub:'timer-new',kind:kind==='tasks'?'task':kind==='tickets'?'ticket':'project',id}});return;}
  if(action==='open-original'){if(kind==='tickets')a.ticket(id);else if(kind==='tasks')await a.hubAction({dataset:{hub:'task-detail',id}});else if(kind==='notes')await a.hubAction({dataset:{hub:'note-view',id}});else if(kind==='projects')a.project(id);else a.openSubItems(id);return;}
 }
 function submit(formEl){
  ready();const v=new FormData(formEl),id=formEl.dataset.id,get=k=>(v.get(k)||'').trim();
  if(formEl.id==='batchContext'){
   if(save(d=>{capture(d,formEl,formEl.dataset.kind,id);E.patch(d,formEl.dataset.kind,id,{nextStep:get('nextStep'),pause:get('pauseReason')?{reason:get('pauseReason'),notes:get('pauseNotes'),at:E.iso(),active:true}:null});}))recordView(formEl.dataset.kind,id);return;
  }
  if(formEl.id==='batchDependency'){
   if(save(d=>{const type=get('type'),targetId=type==='task'?get('targetId'):'',target=E.record(d,'tasks',targetId);if(type==='task'&&!target)throw Error('Choose an available prerequisite task.');const m=E.touch(d,'tasks',id);m.dependencies.push({id:E.uid(),type,targetId,title:type==='task'?target.task.slice(0,500):get('title'),resolved:false});m.updatedAt=E.iso();E.validate(d);},'Dependency added.'))dependencies(id);return;
  }
  if(formEl.id==='batchSplit'){let created=[];if(save(d=>{created=E.split(d,id,get('titles').split(/\r?\n/).map(x=>x.trim()).filter(Boolean));},'Created '+get('titles').split(/\r?\n/).filter(x=>x.trim()).length+' smaller tasks; the original is retained.')){a.closeModal();a.navigate('tasks');}return created;}
  if(formEl.id==='batchLabel'){if(save(d=>d.workhub.batchA.labels.push({id:E.uid(),name:get('name')}),'Shared label added.'))settings();return;}
  if(formEl.id==='batchEnvironmentNew'){if(save(d=>d.workhub.batchA.environments.push({id:E.uid(),name:get('name')}),'Environment added.'))settings();return;}
  if(formEl.hasAttribute('data-batch-environment')){if(save(d=>{const e=d.workhub.batchA.environments.find(x=>x.id===formEl.dataset.batchEnvironment);if(!e)throw Error('Environment no longer exists.');e.name=get('name');},'Environment renamed.'))settings();return;}
  if(formEl.id==='batchStaleSettings'){if(save(d=>d.workhub.batchA.staleDays=Number(get('days')),'Stale-work threshold saved.'))settings();return;}
  if(formEl.id==='batchGlossary'){
   if(save(d=>{const g={id:id||E.uid(),term:get('term'),meaning:get('meaning'),aliases:get('aliases'),context:get('context'),projectId:get('projectId'),updatedAt:E.iso()},h=d.workhub.batchA;const i=h.glossary.findIndex(x=>x.id===id);if(id&&i<0)throw Error('Term no longer exists.');if(i<0)h.glossary.push(g);else h.glossary[i]=g;},'Glossary saved.'))glossary();return;
  }
  if(formEl.id==='batchLocations'){locationView(get('start'),get('end'));return;}
  if(formEl.id==='batchTimerPause'||formEl.id==='batchTimerWrap'){
   const t=a.timer?.();if(!t||t.id!==formEl.dataset.timer)throw Error('This stopwatch changed. Reopen its controls.');
   if(formEl.id==='batchTimerPause'){
    const reason=get('reason');if(!Object.hasOwn(E.PAUSES,reason))throw Error('Choose a pause reason.');t.pauseReason=reason;t.pauseNotes=get('notes');t.nextStep=get('nextStep');a.persistTimer();
    const k=timerKey(t);if(k&&E.record(state(),k.kind,k.id)&&!save(d=>E.patch(d,k.kind,k.id,{pause:{reason,notes:t.pauseNotes,at:E.iso(),active:true},nextStep:t.nextStep})))return;
    a.closeModal();a.render();a.tell('Paused. Your next step is kept on My day.');return;
   }
   t.completedWork=get('completedWork');t.nextStep=get('nextStep');t.notes=get('notes');a.persistTimer();a.finishTimer();return;
  }
 }
 document.addEventListener('click',event=>{const el=event.target.closest?.('[data-batch]');if(!el)return;event.preventDefault();event.stopPropagation();void handle(el).catch(err=>a.tell(err.message,true));});
 document.addEventListener('submit',event=>{if(!event.target.id.startsWith('batch'))return;event.preventDefault();event.stopPropagation();try{submit(event.target);}catch(err){a.tell(err.message,true);}});
 document.addEventListener('change',event=>{
  const el=event.target,toolbar=el.closest?.('.batch-filter-toolbar');if(toolbar){const kind=toolbar.dataset.kind;filters[kind]={label:toolbar.querySelector('[name="batchFilterLabel"]').value,environment:toolbar.querySelector('[name="batchFilterEnvironment"]').value};a.render();return;}
  if(el.closest?.('#batchDependency')&&el.name==='type'){$('batchDependencyTask').hidden=el.value!=='task';$('batchDependencyTitle').hidden=el.value==='task';}
  if(el.form?.id==='hubTimerStart'&&['kind','linkId'].includes(el.name))timerStartContext();
 });
 document.addEventListener('input',event=>{if(event.target.id!=='batchGlossarySearch')return;glossaryQuery=event.target.value;const q=glossaryQuery.toLowerCase();$('batchGlossaryResults').innerHTML=glossaryRows(data().glossary.filter(g=>(g.term+' '+g.meaning+' '+g.aliases+' '+g.context+' '+(state().projects.find(p=>p.id===g.projectId)?.name||'')).toLowerCase().includes(q)));});
 return{sync,mount,matches,fields,capture,decorateModal,recordView,contextForm,dependencies,settings,glossary,glossaryForm,staleView,locationView,handle,submit,pauseTimerPrompt,wrapTimerPrompt,timerFields,timerStarted,timerResumed:timerStarted,filters:()=>E.copy(filters)};
}
root.WorkHubBatchA={install};
})(window);
