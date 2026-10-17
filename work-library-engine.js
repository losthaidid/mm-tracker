/* Reusable communication, field definitions and an account-owned work timeline. */
(function(root){
'use strict';
const V=root.WorkHubValidatorEngine,B=root.WorkHubBatchEngine;
const copy=x=>JSON.parse(JSON.stringify(x)),uid=V.uid,now=()=>new Date().toISOString();
const MAX_EVENTS=12000,MAX_EVENT_BYTES=2097152,MAX_LIBRARY_BYTES=6000000,bytes=x=>new Blob([JSON.stringify(x)]).size,KINDS=['tickets','tasks','specs','notes','projects'];
const text=(v,n)=>typeof v==='string'&&v.length<=n&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
const store=d=>d.workhub.workLibrary;
const records=(d,k)=>k==='notes'?(d.workhub?.notes||[]):(d[k]||[]);
const record=(d,k,id)=>records(d,k).find(x=>x.id===id);
const title=(r,k)=>B.title(r,k);
function upgrade(d){if(d.workhub&&d.workhub.workLibrary===undefined)d.workhub.workLibrary={version:1,snippets:[],bundles:[],fields:[],events:[],eventsDropped:0};return d;}
function placeholders(body){return[...new Set([...String(body).matchAll(/\{([A-Za-z][A-Za-z0-9_]{0,63})\}/g)].map(m=>m[1]))];}
function renderSnippet(s,values,format='plain'){
 const value=k=>Object.hasOwn(values||{},k)?String(values[k]??'').trim():'',keys=placeholders(s.body),missing=keys.filter(k=>!value(k));
 const body=s.body.replace(/\{([A-Za-z][A-Za-z0-9_]{0,63})\}/g,(all,k)=>value(k)||all);
 const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return{missing,text:format==='ticket'?'### '+s.title+'\n\n'+body:body,html:'<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#263d32">'+body.split(/\n{2,}/).map(p=>'<p style="margin:0 0 14px">'+esc(p).replace(/\n/g,'<br>')+'</p>').join('')+'</div>'};
}
function contextValues(d,kind,id){
 const r=record(d,kind,id);if(!r)return{};
 const m=B.meta(d,kind,id),projectId=kind==='projects'?id:kind==='tasks'&&r.taskType==='Project'?r.linkId:r.projectId,project=d.projects.find(p=>p.id===projectId);
 return{ticket:kind==='tickets'?r.ticket:kind==='tasks'&&r.taskType==='Ticket'?d.tickets.find(t=>t.id===r.linkId)?.ticket||'':'',ticket_number:kind==='tickets'?r.ticket:'',task:kind==='tasks'?r.task:'',description:r.description||r.task||r.body||'',project:project?.name||'',system:m?.systemId||'',system_id:m?.systemId||'',client:m?.client||'',transport:r.transport||'',status:kind==='tasks'?(r.done?'Completed':r.boardStatus||'todo'):r.status||'',priority:r.priority||'',pic:r.pic||''};
}
function validateField(f){
 if(!f||!text(f.id,100)||!f.id||!text(f.name,120)||!f.name.trim()||!text(f.updatedAt,50))throw Error('Give the reusable field a name.');
 const t=V.create('Field definition');t.columns=[copy(f.definition)];V.checkSchema(t);
}
function validate(d){
 const h=d.workhub?.workLibrary;if(!h)return;
 if(h.version!==1||!Number.isInteger(h.eventsDropped)||h.eventsDropped<0)throw Error('Check the work library.');
 function list(xs,max,name){if(!Array.isArray(xs)||xs.length>max||new Set(xs.map(x=>x?.id)).size!==xs.length||xs.some(x=>!x||!text(x.id,220)||!x.id))throw Error('Check the '+name+' records.');}
 list(h.snippets,500,'snippet');list(h.bundles,100,'bundle');list(h.fields,500,'reusable field');list(h.events,MAX_EVENTS,'timeline');
 const bundles=new Set(h.bundles.map(x=>x.id)),names=new Set();
 for(const b of h.bundles){if(!text(b.name,120)||!b.name.trim()||names.has(b.name.toLowerCase()))throw Error('Use unique bundle names of up to 120 characters.');names.add(b.name.toLowerCase());}
 for(const s of h.snippets)if(!text(s.title,120)||!s.title.trim()||!text(s.category,80)||!text(s.body,12000)||!s.body.trim()||placeholders(s.body).length>40||!text(s.bundleId,100)||s.bundleId&&!bundles.has(s.bundleId)||!text(s.createdAt,50)||!text(s.updatedAt,50))throw Error('Check the snippet title, message and bundle (up to 40 placeholders).');
 for(const f of h.fields)validateField(f);
 for(const e of h.events){
  if(!KINDS.includes(e.kind)||!text(e.recordId,100)||!e.recordId||!['created','status','update','session','pause','dependency','context','deleted'].includes(e.type)||!text(e.at,50)||!Number.isFinite(Date.parse(e.at))||!text(e.title,500)||!text(e.summary,2000)||!text(e.note,4000)||!text(e.sourceId,100)||!Array.isArray(e.changes)||e.changes.length>20||e.changes.some(c=>!text(c.field,100)||!text(c.before,1200)||!text(c.after,1200)||typeof c.shortened!=='boolean'))throw Error('Check the timeline event.');
 }
 if(bytes(h)>MAX_LIBRARY_BYTES)throw Error('The work library exceeds 6 MB. Shorten reusable messages or field instructions before saving.');
}
const fields={tickets:['ticket','jira','created','description','priority','pic','status','object','action','transport','type','mandays','history'],tasks:['task','priority','dueDate','done','remarks','feedback','taskType','linkId','customLink','boardStatus','archived'],specs:['description','status','remarks','priority','expectedDate','dueDate','reference','url'],notes:['title','body','tags','tcodes','configuration','errors','testing','projectId'],projects:['name','code','phase','goLiveDate','nextMilestone']};
const string=x=>x===undefined||x===null?'':typeof x==='string'?x:JSON.stringify(x);
function changes(a,b,keys){return keys.filter(k=>string(a?.[k])!==string(b?.[k])).map(k=>{const before=string(a?.[k]),after=string(b?.[k]);return{field:k,before:before.slice(0,1200),after:after.slice(0,1200),shortened:before.length>1200||after.length>1200};});}
function sessionTarget(s){return s.kind==='task'?{kind:'tasks',id:s.linkId}:s.kind==='ticket'?{kind:'tickets',id:s.linkId}:s.kind==='project'?{kind:s.itemId?'specs':'projects',id:s.itemId||s.linkId}:null;}
function prepare(next,previous,restoring=false){
 upgrade(next);if(restoring||!previous?.workhub)return;
 const h=store(next),before=previous.workhub.workLibrary,at=now();
 if(before){const old=new Map(before.events.map(e=>[e.id,e]));const retained=new Set(h.events.map(e=>e.id));if(before.events.some(e=>!retained.has(e.id)))throw Error('Recorded timeline events stay unchanged. Restore a backup to recover older history.');for(const e of h.events)if(old.has(e.id)&&JSON.stringify(old.get(e.id))!==JSON.stringify(e))throw Error('Recorded timeline events stay unchanged. Restore a backup to recover older history.');}
 function add(kind,id,type,eventTitle,summary='',note='',diff=[],sourceId=''){
  h.events.push({id:uid(),kind,recordId:id,type,at,title:eventTitle.slice(0,500),summary:summary.slice(0,2000),note:note.slice(0,4000),changes:diff.slice(0,20),sourceId});
 }
 for(const kind of KINDS){
  const old=new Map(records(previous,kind).map(r=>[r.id,r])),live=new Set();
  for(const r of records(next,kind)){
   live.add(r.id);const prior=old.get(r.id);
   if(!prior){add(kind,r.id,'created',kind==='tickets'?'Ticket created':kind==='tasks'?'Task created':'Record created',title(r,kind));continue;}
   const diff=changes(prior,r,fields[kind]),status=diff.find(c=>['done','status','phase','archived'].includes(c.field));
   if(diff.length)add(kind,r.id,status?'status':'update',status?'Status changed':'Record updated',status?status.before+' → '+status.after:diff.map(c=>c.field==='history'?'History update':c.field).join(', '),'',diff);
   const childKey=kind==='tasks'?'subTasks':kind==='specs'?'subItems':'';
   if(childKey){const children=new Map((prior[childKey]||[]).map(x=>[x.id,x]));for(const child of r[childKey]||[]){const oldChild=children.get(child.id),diff=changes(oldChild,child,['title','status','remarks','feedback','dueDate']);if(!oldChild||diff.length)add(kind,r.id,diff.some(c=>c.field==='status')?'status':'update',oldChild?'Child item updated':'Child item added',child.title,'',diff,child.id);children.delete(child.id);}for(const child of children.values())add(kind,r.id,'deleted','Child item removed',child.title,'',[],child.id);}
  }
  for(const prior of old.values())if(!live.has(prior.id))add(kind,prior.id,'deleted','Record removed',title(prior,kind));
 }
 const oldTrackers=new Map((previous.trackers||[]).map(p=>[p.id,p]));
 for(const tracker of next.trackers||[]){const prior=oldTrackers.get(tracker.id),ticket=(next.tickets||[]).find(t=>t.ticket===tracker.ticket);if(!ticket)continue;const diff=changes(prior,tracker,['steps','onHold','remarks']);if(diff.length)add('tickets',ticket.id,'update',prior?'Milestones updated':'Milestone tracker added',tracker.steps.filter(Boolean).length+'/'+tracker.steps.length+' complete','',diff,tracker.id);}
 const oldMeta=new Map((previous.workhub.batchA?.records||[]).map(m=>[m.id,m]));
 for(const m of next.workhub.batchA?.records||[]){
  const prior=oldMeta.get(m.id),diff=changes(prior||{labelIds:[],environmentId:'',systemId:'',client:'',outcome:'',outcomeNote:'',nextStep:''},m,['labelIds','environmentId','systemId','client','outcome','outcomeNote','nextStep']);
  if(diff.length)add(m.kind,m.recordId,'context','Work context updated',m.outcome?'Outcome: '+(B.OUTCOMES[m.outcome]||m.outcome):'Labels, environment or record context','',diff);
  if(JSON.stringify(prior?.pause||null)!==JSON.stringify(m.pause||null)&&m.pause)add(m.kind,m.recordId,'pause',m.pause.active?'Work paused':'Work resumed',B.PAUSES[m.pause.reason]||m.pause.reason,m.pause.notes,changes(prior,m,['nextStep']));
  const oldDeps=new Map((prior?.dependencies||[]).map(x=>[x.id,x]));for(const dep of m.dependencies){const p=oldDeps.get(dep.id);if(!p||JSON.stringify(p)!==JSON.stringify(dep))add(m.kind,m.recordId,'dependency',!p?'Dependency added':dep.resolved?'Dependency ready':'Dependency reopened',B.DEPENDENCIES[dep.type]+': '+dep.title,'',[],dep.id);oldDeps.delete(dep.id);}for(const dep of oldDeps.values())add(m.kind,m.recordId,'dependency','Dependency removed',B.DEPENDENCIES[dep.type]+': '+dep.title,'',[],dep.id);
 }
 // Task completion also changes the readiness of each task that depends on it.
 const oldTasks=new Map((previous.tasks||[]).map(t=>[t.id,t]));
 for(const task of next.tasks||[])if(oldTasks.has(task.id)&&oldTasks.get(task.id).done!==task.done)for(const m of next.workhub.batchA?.records||[])if(m.dependencies.some(dep=>dep.type==='task'&&dep.targetId===task.id))add(m.kind,m.recordId,'dependency',task.done?'Prerequisite completed':'Prerequisite reopened',task.task,'',[],task.id);
 const oldSessions=new Map((previous.workhub.sessions||[]).map(s=>[s.id,s]));
 for(const s of next.workhub.sessions||[]){
  const p=oldSessions.get(s.id),target=sessionTarget(s);if(!target||!record(next,target.kind,target.id))continue;
  if(!p)add(target.kind,target.id,'session','Work session saved',s.title,[s.completedWork,s.pauseReason?'Last pause: '+(B.PAUSES[s.pauseReason]||s.pauseReason):'',s.nextStep?'Next: '+s.nextStep:'',s.notes].filter(Boolean).join('\n'),[],s.id);
  else if(s.archived!==p.archived)add(target.kind,target.id,'session',s.archived?'Session archived':'Session restored',s.title,'',[],s.id);
 }
 let size=h.events.reduce((n,e)=>n+bytes(e)+2,2),removed=0;while(h.events.length-removed>MAX_EVENTS||size>MAX_EVENT_BYTES&&removed<h.events.length){size-=bytes(h.events[removed])+2;removed++;}if(removed){h.events.splice(0,removed);h.eventsDropped+=removed;}
}
function timeline(d,kind,id){
 const h=store(d),events=h.events.filter(e=>e.kind===kind&&e.recordId===id).map(copy),r=record(d,kind,id);
 const add=(key,type,at,name,summary,note='')=>{if(at&&Number.isFinite(Date.parse(at)))events.push({id:'legacy:'+key,kind,recordId:id,type,at,title:name,summary:String(summary||'').slice(0,2000),note:String(note||'').slice(0,4000),changes:[],sourceId:key,legacy:true});};
 for(const s of d.workhub.sessions||[]){const t=sessionTarget(s);if(t?.kind===kind&&t.id===id&&!events.some(e=>e.type==='session'&&e.sourceId===s.id))add(s.id,'session',s.end||s.start,'Recorded work session',s.title,[s.completedWork,s.nextStep?'Next: '+s.nextStep:'',s.notes].filter(Boolean).join('\n'));}
 if(kind==='tickets'&&r?.created&&!events.some(e=>e.type==='created'))add('created','created',r.created,'Ticket creation date',r.ticket);
 if(kind==='tasks'&&r?.doneDate&&!events.some(e=>e.type==='status'))add('completed','status',r.doneDate,'Recorded completion date',r.task);
 for(const item of r?.statusHistory||[])if(!events.some(e=>e.type==='status'&&e.at.slice(0,10)===(item.date||item.changedAt?.slice(0,10))))add(item.id,'status',item.changedAt||item.date,'Recorded status change',item.status);
 if(kind==='tickets'){const c=d.workhub.ticketClosures?.find(c=>c.id===id);if(c&&!events.some(e=>e.type==='status'&&e.at.slice(0,10)===c.date))add('closure','status',c.date,'Recorded ticket closure',r?.status);}
 return events.sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id));
}
root.WorkHubWorkLibraryEngine={upgrade,validate,prepare,placeholders,renderSnippet,contextValues,validateField,timeline,MAX_EVENTS,MAX_EVENT_BYTES,copy,uid,now,record,title,changes};
})(window);
