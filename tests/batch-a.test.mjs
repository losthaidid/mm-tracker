import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
process.env.TZ='Asia/Kuala_Lumpur';
const source=readFileSync(new URL('../batch-a-engine.js',import.meta.url),'utf8');
const copy=x=>JSON.parse(JSON.stringify(x));
function setup(t){
 const dom=new JSDOM('',{runScripts:'outside-only'});t.after(()=>dom.window.close());dom.window.eval(source);
 const E=dom.window.WorkHubBatchEngine,d={tasks:[task('a'),task('b'),task('c')],tickets:[],specs:[],projects:[],schedule:[],workhub:{notes:[],sessions:[]}};
 E.upgrade(d);return{E,d};
}
function task(id){return{id,task:'Task '+id,number:id,done:false,archived:false,remarks:'Keep this note',feedback:'Original feedback',ref:'https://example.com/spec',taskType:'Project',linkId:'project-a',subTasks:[{id:'child-'+id,title:'Existing child',status:'Not started'}]};}
function dep(id,targetId,type='task'){return{id,type,targetId,title:'Waiting on '+targetId,resolved:false};}

test('typed dependencies resolve live and reject cycles without ignoring removed prerequisites',t=>{
 const {E,d}=setup(t);E.touch(d,'tasks','a').dependencies=[dep('ab','b')];E.touch(d,'tasks','b').dependencies=[dep('bc','c')];
 E.validate(d);assert.equal(E.blockers(d,'a').length,1);
 d.tasks[1].done=true;assert.equal(E.blockers(d,'a').length,0);
 E.touch(d,'tasks','c').dependencies=[dep('ca','a')];assert.throws(()=>E.validate(d),/loop/);
 E.meta(d,'tasks','c').dependencies=[];d.tasks=d.tasks.filter(x=>x.id!=='b');assert.equal(E.blockers(d,'a').length,1);assert.equal(E.dependencyState(d,E.meta(d,'tasks','a').dependencies[0]).missing,true);
 E.meta(d,'tasks','a').dependencies=[{...dep('approval','','approval'),title:'Design approval'}];E.validate(d);
 assert.equal(E.blockers(d,'a').length,1);E.meta(d,'tasks','a').dependencies[0].resolved=true;assert.equal(E.blockers(d,'a').length,0);assert.equal(d.tasks[0].done,false);
});

test('splitting retains originals and copies notes, links and context into independent main tasks',t=>{
 const {E,d}=setup(t);d.workhub.batchA.labels.push({id:'shared',name:'Client discussion'});
 const m=E.touch(d,'tasks','a');m.labelIds=['shared'];m.environmentId='qas';m.systemId='S4Q';m.client='200';m.dependencies=[dep('ab','b')];
 const original=copy(d.tasks[0]),ids=E.split(d,'a',['Prepare test data','Run the scenario']);
 assert.deepEqual(copy(d.tasks[0]),original);assert.equal(ids.length,2);
 for(const id of ids){const child=d.tasks.find(x=>x.id===id),context=E.meta(d,'tasks',id);assert.equal(child.ref,original.ref);assert.equal(child.remarks,original.remarks);assert.equal(child.feedback,original.feedback);assert.equal(child.linkId,'project-a');assert.equal(child.subTasks.length,0);assert.equal(child.done,false);assert.equal(context.environmentId,'qas');assert.equal(context.splitFrom,'a');assert.deepEqual(copy(context.labelIds),['shared']);assert.notEqual(context.dependencies[0].id,'ab');}
 d.tasks.find(x=>x.id===ids[0]).remarks='Independent edit';assert.equal(d.tasks[0].remarks,original.remarks);E.validate(d);
 assert.throws(()=>E.split(d,'a',['same','Same']),/different/);
 assert.equal(E.split(d,'c',['First','Second']).length,2);
});

test('stale review distinguishes unknown dates, respects thresholds and excludes finished records',t=>{
 const {E,d}=setup(t);d.tasks[1].done=true;d.tickets=[{id:'ticket',ticket:'AMS-1',description:'Old request',status:'Pending',created:'2026-09-01'}];
 d.workhub.batchA.staleDays=14;E.touch(d,'tasks','a','2026-10-01T12:00:00Z');
 let result=E.stale(d,'2026-10-17');assert.equal(result.items.length,2);assert.equal(result.unknown.length,1);assert.equal(result.unknown[0].id,'c');
 E.patch(d,'tasks','a',{reviewedAt:'2026-10-17T10:00:00Z'});result=E.stale(d,'2026-10-17');assert.equal(result.items.length,1);
 d.workhub.batchA.staleDays=0;assert.equal(E.stale(d,'2026-10-17').items.length,0);
});

test('record updates are tracked while unrelated settings and navigation leave timestamps alone',t=>{
 const {E,d}=setup(t);let next=copy(d);E.prepare(next,d);const initial=E.meta(next,'tasks','a');assert.equal(initial,undefined);
 const before=copy(next);next.tasks[0].remarks='A real update';E.prepare(next,before);const at=E.meta(next,'tasks','a').updatedAt;assert.ok(at);
 const later=copy(next);later.activeProjectId='project-b';later.workhub.batchA.staleDays=7;E.prepare(later,next);assert.equal(E.meta(later,'tasks','a').updatedAt,at);
 later.tasks=later.tasks.filter(x=>x.id!=='a');E.prepare(later,next);assert.equal(E.meta(later,'tasks','a'),undefined);
});

test('session wrap-ups create a resume thread and completing work clears active pauses',t=>{
 const {E,d}=setup(t);const s={id:'session',kind:'task',linkId:'a',completedWork:'Checked the mapping',nextStep:'Confirm with owner',pauseReason:'approval',pauseNotes:'Owner review'};
 d.workhub.sessions.push(s);E.attachSession(d,s);assert.equal(E.resumable(d)[0].nextStep,'Confirm with owner');assert.equal(E.meta(d,'tasks','a').lastSessionId,'session');
 const before=copy(d);E.meta(d,'tasks','a').pause={reason:'approval',notes:'Waiting',at:'2026-10-17T10:00:00Z',active:true};d.tasks[0].done=true;E.prepare(d,before);
 assert.equal(E.resumable(d).length,0);assert.equal(E.meta(d,'tasks','a').pause.active,false);E.validate(d);
});

test('work-location totals use exact booked minutes and distinct days, excluding leave and duplicate plan records',t=>{
 const {E,d}=setup(t);d.schedule=[
  {date:'2026-10-01',time:'09:15',endTime:'10:00',kind:'project',location:'Office'},
  {date:'2026-10-01',time:'10:00',endTime:'10:45',kind:'project',location:'Office'},
  {date:'2026-10-01',time:'11:00',endTime:'12:00',kind:'project',location:'Client site'},
  {date:'2026-10-02',time:'23:30',endTime:'24:00',kind:'project',location:'Remote'},
  {date:'2026-10-02',time:'09:00',endTime:'10:00',kind:'custom',location:''},
  {date:'2026-10-03',time:'09:00',endTime:'18:00',kind:'annual-leave',location:'Office'},
  {date:'2026-11-01',time:'09:00',endTime:'10:00',kind:'project',location:'Office'}
 ];d.projectPlans=[{date:'2026-10-01',time:'09:15',endTime:'10:45',location:'Office'}];
 const result=E.locations(d,'2026-10-01','2026-10-31');assert.equal(result.minutes,240);assert.equal(result.days,2);assert.equal(result.groups.find(x=>x.name==='Office').days,1);assert.equal(result.groups.find(x=>x.name==='Office').minutes,90);assert.equal(result.groups.find(x=>x.name==='Remote').minutes,30);
 assert.throws(()=>E.locations(d,'2026-02-30','2026-10-31'),/valid date/);assert.throws(()=>E.locations(d,'2024-01-01','2026-10-31'),/valid date/);
});

test('context validation rejects duplicate labels, invalid assignments and conflicting glossary terms',t=>{
 const {E,d}=setup(t);d.workhub.batchA.labels=[{id:'one',name:'Urgent'},{id:'two',name:'urgent'}];assert.throws(()=>E.validate(d),/unique/);
 d.workhub.batchA.labels.pop();E.touch(d,'tasks','a').labelIds=['missing'];assert.throws(()=>E.validate(d),/context/);
 E.meta(d,'tasks','a').labelIds=['one'];E.meta(d,'tasks','a').outcome='invented';assert.throws(()=>E.validate(d),/context/);E.meta(d,'tasks','a').outcome='workaround';
 const term={id:'term',term:'BP',meaning:'Business partner',aliases:'',context:'',projectId:'',updatedAt:'2026-10-17T10:00:00Z'};d.workhub.batchA.glossary=[term,{...term,id:'other',term:'bp'}];assert.throws(()=>E.validate(d),/unique glossary/);
 d.workhub.batchA.glossary[1].projectId='client-project';E.validate(d);
});

test('older documents receive identical defaults on independent devices',t=>{
 const {E}=setup(t),a={workhub:{}},b={workhub:{}};E.upgrade(a);E.upgrade(b);assert.deepEqual(copy(a),copy(b));const prior=copy(a);E.upgrade(a);assert.deepEqual(copy(a),prior);
});

test('stale timestamps follow the local calendar and closed work cannot retain an active pause',t=>{
 const {E,d}=setup(t);d.workhub.batchA.staleDays=1;
 E.touch(d,'tasks','a','2026-10-16T23:30:00Z');assert.equal(E.stale(d,'2026-10-17').items.some(x=>x.id==='a'),false);assert.equal(E.stale(d,'2026-10-18').items.some(x=>x.id==='a'),true);
 d.tasks[0].done=true;const before=copy(d);E.meta(d,'tasks','a').pause={reason:'approval',notes:'An outdated pause',at:'2026-10-17T00:00:00Z',active:true};E.prepare(d,before);assert.equal(E.meta(d,'tasks','a').pause.active,false);
});
