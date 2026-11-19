import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
const window={};
for(const file of ['reminders.js','leave-balance-engine.js','sync-merge.js'])runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{window});
const E=window.WorkHubLeaveBalancesEngine,T='leave-toil',copy=x=>JSON.parse(JSON.stringify(x)),asOf='2026-11-20';
function state(){const d={workhub:{},schedule:[]};E.upgrade(d);d.workhub.leaveTypes.push({id:T,name:'Time off in lieu',code:'TOIL',archived:false,toil:true});const year=E.defaults('2026',d);year[T].allowance=0;year[T].toilEntries=[];d.workhub.leaveBalances=[year];return d;}
const policy=d=>d.workhub.leaveBalances[0][T];
function entry(d,id,kind,days,date='2026-11-18'){policy(d).toilEntries.push({id,kind,days,date,note:'Support work'});}
function booking(d,id,date,portion='full',status='Approved',extra={}){d.schedule.push({bookingId:id,date,time:'09:00',endTime:'13:00',kind:T,leave:{portion,status,...extra}});}
test('TOIL separates earned, utilized and reserved days, without counting other leave or duplicate fragments',()=>{
 const d=state();policy(d).allowance=1;policy(d).openingUsed=.5;entry(d,'earned','earned',2);entry(d,'used','utilized',.25,'2026-11-19');entry(d,'future-credit','earned',1,'2026-12-01');entry(d,'future-used','utilized',.125,'2026-11-30');
 booking(d,'approved','2026-11-20','morning');booking(d,'pending','2026-11-19','morning','Requested');
 for(const[time,endTime]of[['15:00','16:00'],['16:00','17:00'],['17:00','18:00'],['16:00','17:00']])d.schedule.push({bookingId:'hourly',date:'2026-11-23',time,endTime,kind:T,leave:{portion:'custom',chargeMode:'hours',hoursPerDay:8,status:'Approved'}});
 d.schedule.push({date:'2026-11-20',kind:'annual-leave',leave:{portion:'full',status:'Approved'}});E.validate(d);
 const b=E.balance(d,'2026',T,asOf);assert.equal(b.earned,3);assert.equal(b.utilized,1.25);assert.equal(b.reserved,1);assert.equal(b.remaining,.75);assert.equal(b.pendingEarned,1);assert.equal(b.scheduled,1.375);
 const later=E.balance(d,'2026',T,'2026-12-01');assert.equal(later.earned,4);assert.equal(later.utilized,1.75);assert.equal(later.reserved,.5);assert.equal(later.remaining,1.75);assert.equal(later.pendingEarned,0);
});
test('TOIL edits, deletion and type changes recalculate once while keeping yearly balances separate',()=>{
 const d=state();entry(d,'credit','earned',2);booking(d,'one','2026-11-19','morning');const before=E.balance(d,'2026',T,asOf);
 const draft={bookingId:'one',date:'2026-11-19',endDate:'2026-11-19',time:'15:00',endTime:'17:00',kind:T,leave:{portion:'custom',chargeMode:'hours',hoursPerDay:8,status:'Approved'}};
 const changed=E.preview(d,draft,asOf);assert.equal(changed.rows[0].requested,.25);assert.equal(changed.rows[0].remaining,1.75);assert.equal(E.balance(d,'2026',T,asOf).remaining,before.remaining);
 assert.equal(E.balance({...d,schedule:[]},'2026',T,asOf).remaining,2);
 const switched=E.preview(d,{...draft,kind:'medical-leave'},asOf);assert.equal(E.balance(switched.next,'2026',T,asOf).remaining,2);assert.equal(E.balance(d,'2027',T,asOf).remaining,0);
});
test('TOIL counts same-day halves separately and honors weekdays and maintained holidays',()=>{
 const d=state();entry(d,'credit','earned',2);booking(d,'morning','2026-11-20','morning');booking(d,'afternoon','2026-11-20','afternoon','Planned');
 let b=E.balance(d,'2026',T,asOf);assert.equal(b.utilized,.5);assert.equal(b.reserved,.5);assert.equal(b.remaining,1);
 d.workhub.publicHolidays=[{id:'2026-11-20',name:'Workplace holiday'}];policy(d).excludeHolidays=true;b=E.balance(d,'2026',T,asOf);assert.equal(b.utilized,0);assert.equal(b.reserved,0);assert.equal(b.remaining,2);
});
test('new TOIL bookings cannot bypass a missing year policy or borrow future earned credits',()=>{
 const d=state();d.workhub.leaveBalances=[];const next=copy(d);booking(next,'one','2027-01-04','morning');assert.throws(()=>E.assertWithinBalance(d,next,asOf),/only 0 day/);
 const funded=state();entry(funded,'later','earned',1,'2026-11-21');const request=E.preview(funded,{kind:T,date:'2026-11-23',leave:{portion:'full',status:'Approved'}},asOf);assert.throws(()=>E.assertWithinBalance(funded,request.next,asOf),/Record earned TOIL/);E.assertWithinBalance(funded,request.next,'2026-11-21');
});
test('TOIL imports reject invalid flags, orphan ledgers, duplicate IDs and malformed credit values',()=>{
 const d=state();for(const change of [row=>row.days=0,row=>row.days=-1,row=>row.days=Infinity,row=>row.days='1',row=>row.days=.333333333,row=>row.days=367,row=>row.date='2027-01-01',row=>row.date='2026-02-30',row=>row.kind='paid',row=>row.note='x'.repeat(1001),row=>row.id='']){const bad=copy(d);entry(bad,'one','earned',1);change(policy(bad).toilEntries[0]);assert.throws(()=>E.validate(bad),/TOIL entries/);}
 entry(d,'one','earned',.333333);E.validate(d);policy(d).toilEntries.push(copy(policy(d).toilEntries[0]));assert.throws(()=>E.validate(d),/TOIL entries/);
 const flags=state();flags.workhub.leaveTypes[0].toil=true;assert.throws(()=>E.validate(flags),/custom leave types/);delete flags.workhub.leaveTypes[0].toil;flags.workhub.leaveTypes.at(-1).toil='true';assert.throws(()=>E.validate(flags),/custom leave types/);flags.workhub.leaveTypes.at(-1).toil=false;assert.throws(()=>E.validate(flags),/TOIL type/);
});
test('independent TOIL entries merge by ID and concurrent reservations still require balance review',()=>{
 const d=state();entry(d,'opening','earned',1.5);const base={data:d},local=copy(base),remote=copy(base);entry(local.data,'left','earned',.5);entry(remote.data,'right','utilized',.25);
 const merged=window.MMTrackerMerge.merge(base,local,remote);assert.deepEqual(copy(merged.conflicts),[]);E.validate(merged.data);assert.equal(E.balance(merged.data,'2026',T,asOf).remaining,1.75);
 const left=copy(base),right=copy(base);booking(left.data,'first','2026-11-23');booking(right.data,'second','2026-11-24');const combined=window.MMTrackerMerge.merge(base,left,right);assert.deepEqual(copy(combined.conflicts),[]);assert.throws(()=>E.assertWithinBalance(base.data,combined.data,asOf),/only 1.5 day/);
});
test('correcting earned history can show an explicit negative TOIL balance without deleting bookings',()=>{
 const d=state();booking(d,'one','2026-11-19');const original=copy(d.schedule);assert.equal(E.balance(d,'2026',T,asOf).remaining,-1);E.validate(d);E.assertWithinBalance(d,copy(d),asOf);entry(d,'reconcile','earned',2);assert.equal(E.balance(d,'2026',T,asOf).remaining,1);assert.deepEqual(d.schedule,original);
});
