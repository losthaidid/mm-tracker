import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
process.env.TZ='Asia/Kuala_Lumpur';
const copy=x=>JSON.parse(JSON.stringify(x));
function setup(t){const dom=new JSDOM('',{runScripts:'outside-only'});t.after(()=>dom.window.close());dom.window.eval(readFileSync(new URL('../schedule-engine.js',import.meta.url),'utf8'));const E=dom.window.WorkHubScheduleEngine,d={projects:[{id:'a',name:'A'},{id:'b',name:'B'}],tasks:[{id:'task-a',taskType:'Project',linkId:'a',done:false}],tickets:[{id:'ticket-a',status:'Pending'}],projectPlans:[],schedule:[{kind:'task',linkId:'task-a',date:'2026-10-28',time:'09:00',endTime:'12:00',bookingId:'plan-a',text:''}],workhub:{sessions:[]}};E.upgrade(d);return{E,d,slot:d.schedule[0]};}
const at=(time,date='2026-10-28')=>Date.parse(date+'T'+time+':00+08:00');
function session(id,kind,linkId,start,end,more={}){return{id,title:id,kind,linkId,projectId:kind==='project'?linkId:'',start:new Date(at(start)).toISOString(),end:new Date(at(end)).toISOString(),intervals:[{start:new Date(at(start)).toISOString(),end:new Date(at(end)).toISOString()}],seconds:(at(end)-at(start))/1000,scheduled:true,scheduleVersion:1,...more};}

test('Daily execution: clock statuses are independent of linked record completion and read without writes',t=>{
 const {E,d,slot}=setup(t),before=copy(d);
 assert.equal(E.describe(d,slot,at('08:59')).status,'Planned');assert.equal(E.describe(d,slot,at('09:00')).status,'Active');assert.equal(E.describe(d,slot,at('12:00')).status,'Actual');assert.equal(E.describe(d,slot,at('17:00','2026-10-29')).status,'Actual');assert.equal(E.describe(d,slot,at('12:00')).source,'From plan');assert.deepEqual(copy(d),before);
 d.tasks[0].done=true;assert.equal(E.describe(d,slot,at('08:59')).status,'Planned');assert.equal(E.describe(d,slot,at('10:00')).status,'Active');assert.equal(E.describe(d,slot,at('12:00')).status,'Actual');
 for(const kind of ['ticket','project','custom']){const s={...slot,kind,linkId:kind==='ticket'?'ticket-a':kind==='project'?'a':'',text:'Original plan'};d.tickets[0].status='Closed';assert.equal(E.describe(d,s,at('12:00')).status,'Actual');}
});
test('Daily execution: interruptions pause, resume and produce Partial/Changed with unioned time instead of double counting',t=>{
 const {E,d,slot}=setup(t),timer={id:'b-live',kind:'project',linkId:'b',projectId:'b',title:'Unexpected B',started:new Date(at('10:00')).toISOString(),runningSince:new Date(at('10:00')).toISOString(),segments:[]};
 assert.equal(E.describe(d,slot,at('10:30'),timer).status,'Paused');
 d.workhub.sessions.push(session('b','project','b','10:00','11:00'));assert.equal(E.describe(d,slot,at('11:15')).status,'Active');let result=E.describe(d,slot,at('12:00'));assert.equal(result.status,'Partial');assert.equal(result.displacedMinutes,60);assert.equal(result.workedMinutes,120);
 d.workhub.sessions.push(session('b-overlap','project','b','10:30','11:00'));result=E.describe(d,slot,at('12:00'));assert.equal(result.displacedMinutes,60);
 d.workhub.sessions=[session('b-full','project','b','09:00','12:00')];assert.equal(E.describe(d,slot,at('12:00')).status,'Changed');
 assert.equal(E.describe(d,{...slot,date:'2026-10-29'},at('17:00')).status,'Planned');
});
test('Daily execution: own running timer overruns, pause is separate and explicit stop finishes a session early',t=>{
 const {E,d,slot}=setup(t),timer={id:'own',kind:'task',linkId:'task-a',title:'Working A',started:new Date(at('09:00')).toISOString(),runningSince:new Date(at('09:00')).toISOString(),segments:[]};
 assert.equal(E.describe(d,slot,at('13:00'),timer).status,'Active');timer.runningSince=null;timer.segments=[{start:new Date(at('09:00')).toISOString(),end:new Date(at('10:00')).toISOString()}];assert.equal(E.describe(d,slot,at('10:30'),timer).status,'Paused');
 d.workhub.sessions.push(session('own','task','task-a','09:00','10:00',{endReason:'stop'}));assert.equal(E.describe(d,slot,at('10:30')).status,'Actual');assert.equal(d.tasks[0].done,false);
});
test('Daily execution: recorded work survives relinking, archiving and deletion and never changes an earlier outcome',t=>{
 const {E,d,slot}=setup(t),s=session('unlisted','project','','10:00','11:00',{unlisted:true,unlistedName:'Future project'});s.captureIdentity=E.identity(s,d);d.workhub.sessions.push(s);assert.equal(E.describe(d,slot,at('12:00')).status,'Partial');
 s.linkId='a';s.projectId='a';s.archived=true;assert.equal(E.describe(d,slot,at('12:00')).status,'Partial');E.retain(d,s);d.workhub.sessions=[];assert.equal(E.describe(d,slot,at('12:00')).status,'Partial');assert.equal(E.day(d,'2026-10-28').length,1);assert.equal(E.day(d,'2026-10-28')[0].status,'Actual');E.validate(d);
});
test('Daily execution: actual overlaps are rejected, exact adjacency is allowed, cancellation/move snapshots preserve the original plan',t=>{
 const {E,d,slot}=setup(t);d.workhub.sessions.push(session('a','task','task-a','09:00','10:00'));
 assert.throws(()=>E.assertAvailable(d,session('bad','custom','','09:30','10:30').intervals),/overlaps/);assert.doesNotThrow(()=>E.assertAvailable(d,session('good','custom','','10:00','11:00').intervals));
 E.history(d,d.schedule,'Moved',new Date(at('08:00')).toISOString());d.schedule=[];assert.equal(d.workhub.daySchedule.changes[0].entries[0].title,'Task');assert.equal(d.workhub.daySchedule.changes[0].entries[0].time,'09:00');E.validate(d);
 const bad=copy(d);bad.workhub.sessions[0].intervals[0].end=bad.workhub.sessions[0].intervals[0].start;assert.throws(()=>E.validate(bad),/intervals/);
});
test('Daily execution: midnight and multi-day sessions split by local date without duplicating seconds',t=>{
 const {E,d}=setup(t),start='2026-10-28T23:30:00+08:00',end='2026-10-29T00:30:00+08:00';d.workhub.sessions=[{...session('night','custom','','09:00','10:00'),start,end,seconds:3600,intervals:[{start,end}]}];assert.equal(E.day(d,'2026-10-28')[0].minutes,30);assert.equal(E.day(d,'2026-10-28')[0].endTime,'24:00');assert.equal(E.day(d,'2026-10-29')[0].minutes,30);assert.equal(E.day(d,'2026-10-29')[0].time,'00:00');E.validate(d);
});

test('Daily execution: a pause that consumes the planned session remains Partial, and compensated overtime becomes Actual',t=>{
 const {E,d,slot}=setup(t),timer={id:'paused',kind:'task',linkId:'task-a',title:'A',started:new Date(at('09:00')).toISOString(),runningSince:null,segments:[{start:new Date(at('09:00')).toISOString(),end:new Date(at('10:00')).toISOString()}]};
 const result=E.describe(d,slot,at('12:00'),timer);assert.equal(result.status,'Partial');assert.equal(result.displacedMinutes,120);
 d.workhub.sessions=[session('a-first','task','task-a','09:00','10:00',{endReason:'switch'}),session('b','project','b','10:00','11:00'),session('a-resume','task','task-a','11:00','13:00',{endReason:'stop'})];assert.equal(E.describe(d,slot,at('13:00')).status,'Actual');
});
