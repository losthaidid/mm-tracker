import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
const window={WorkHubLeave:{isLeave:kind=>['annual-leave','medical-leave'].includes(kind)}};
runInNewContext(readFileSync(new URL('../claims-engine.js',import.meta.url),'utf8'),{window});
const E=window.WorkHubClaimsEngine,copy=x=>JSON.parse(JSON.stringify(x));
const route={id:'site',name:'Client HQ',address:'Office → Client HQ',oneWayKm:23.75,ratePerKm:.65,journey:'return',archived:false};
const travel={locationId:'site',locationName:'Client HQ',oneWayKm:23.75,ratePerKm:.65,journey:'return',visits:1,claimable:true};
const stamp='2026-10-19T04:00:00Z';
const expense=(id,date,category,amountCents,claimable=true)=>({id,date,category,amountCents,claimable,description:'Client visit',payment:'Touch ’n Go',locationId:'site',locationName:'Client HQ',bookingId:'booking',reference:'',notes:'',createdAt:stamp,updatedAt:stamp});
function state(){return{workhub:{claims:{locations:[copy(route)],expenses:[]}},projectPlans:[],tasks:[],schedule:[]};}
function add(d,date,bookingId='booking',t=travel){for(const time of ['09:00','10:00','11:00'])d.schedule.push({date,time,endTime:(Number(time.slice(0,2))+1)+':00',kind:'custom',bookingId,planId:'',location:'Client site',text:'Workshop',travel:copy(t)});}

test('claims engine: mileage is counted once per booking date, split across months and rounded per visit',()=>{
 const d=state();for(const date of ['2026-10-31','2026-11-01','2026-11-02'])add(d,date);d.workhub.claims.expenses.push(expense('toll','2026-10-31','toll',965),expense('park','2026-10-31','parking',310),expense('excluded','2026-10-31','toll',200,false));E.validate(d);
 const oct=E.summary(d,'2026-10'),nov=E.summary(d,'2026-11');assert.equal(oct.mileage.length,1);assert.equal(oct.visits,1);assert.equal(oct.distanceKm,47.5);assert.equal(oct.mileageCents,3088);assert.equal(oct.totalCents,4363);assert.equal(oct.excludedCents,200);assert.equal(nov.mileage.length,2);assert.equal(nov.distanceKm,95);assert.equal(nov.totalCents,6176);
});

test('claims engine: fractional rates, one-way and repeat visits use integer sen',()=>{
 assert.equal(E.travelCost({...travel,oneWayKm:.1,ratePerKm:.7}),14);assert.equal(E.travelCost({...travel,oneWayKm:.1,ratePerKm:.7,visits:3}),42);assert.equal(E.travelCost({...travel,oneWayKm:.13,ratePerKm:.7755,journey:'one-way'}),10);assert.equal(E.travelCost({...travel,ratePerKm:0}),0);
 const d=state();add(d,'2026-10-19','booking',{...travel,claimable:false});const m=E.summary(d,'2026-10');assert.equal(m.totalCents,0);assert.equal(m.distanceKm,0);assert.equal(m.excludedCents,3088);assert.equal(m.mileage.length,1);
});

test('claims engine: mapping edits and archives do not reprice saved mileage',()=>{
 const d=state();add(d,'2026-10-19');const before=E.summary(d,'2026-10').totalCents;Object.assign(d.workhub.claims.locations[0],{name:'Renamed HQ',ratePerKm:1.5,oneWayKm:100,archived:true});E.validate(d);assert.equal(E.summary(d,'2026-10').totalCents,before);assert.equal(E.trips(d)[0].travel.locationName,'Client HQ');
});

test('claims engine: rebuilt plan slots retain mileage, explicit removal and route changes stay removed',()=>{
 const previous=state();add(previous,'2026-10-19');const next=copy(previous);for(const s of next.schedule){delete s.travel;s.date='2026-11-03';}E.prepare(next,previous);E.validate(next);assert.equal(E.summary(next,'2026-11').mileageCents,3088);
 const cleared=copy(next);for(const s of cleared.schedule)s.travel=null;E.prepare(cleared,next);assert.equal(E.summary(cleared,'2026-11').mileageCents,0);
 const office=copy(next);for(const s of office.schedule){delete s.travel;s.location='Office';}E.prepare(office,next);assert.equal(E.summary(office,'2026-11').mileage.length,0);
 const restore=copy(office);E.prepare(restore,next,true);assert.equal(E.summary(restore,'2026-11').mileage.length,0);
});

test('claims engine: invalid imports, inconsistent segments and duplicate locations are rejected',()=>{
 for(const patch of [{oneWayKm:-1},{oneWayKm:1.123},{ratePerKm:Infinity},{ratePerKm:.12345},{visits:0},{visits:1.5},{claimable:'yes'},{journey:'round'},{locationName:''}])assert.throws(()=>E.validateTravel({...travel,...patch}),/Check/);
 const d=state();add(d,'2026-10-19');d.schedule[1].travel.ratePerKm=1;assert.throws(()=>E.validate(d),/same mileage/);d.schedule[1].travel.ratePerKm=.65;d.workhub.claims.locations.push({...route,id:'other',name:'client hq'});assert.throws(()=>E.validate(d),/unique name/);
 const e=state();e.workhub.claims.expenses.push(expense('bad','2026-02-30','toll',100));assert.throws(()=>E.validate(e),/expense date/);for(const bad of [-1,.5,NaN,Infinity,100000001]){e.workhub.claims.expenses=[expense('bad','2026-10-19','toll',bad)];assert.throws(()=>E.validate(e),/positive RM/);}
 assert.throws(()=>E.summary(e,'2026-13'),/valid claim month/);
});

test('claims engine: opening older data adds only an empty claims collection',()=>{
 const d={workhub:{notes:[{id:'note',title:'Keep'}]},schedule:[{date:'2026-10-19',time:'09:00',location:'Client site'}]};E.upgrade(d);E.validate(d);assert.equal(d.schedule[0].travel,undefined);assert.equal(d.workhub.notes[0].title,'Keep');assert.equal(E.summary(d,'2026-10').totalCents,0);const before=JSON.stringify(d);E.summary(d,'2026-10');E.csv(d,'2026-10');assert.equal(JSON.stringify(d),before);
});

test('claims engine: monthly CSV preserves references, excludes other months and neutralises formulas',()=>{
 const d=state();add(d,'2026-10-19');d.workhub.claims.expenses.push({...expense('cost','2026-10-19','toll',1010),description:'=HYPERLINK("bad")',reference:'+command',notes:'two lines\n"quoted"'},expense('next','2026-11-01','parking',100));
 const csv=E.csv(d,'2026-10');assert.ok(csv.startsWith('\uFEFF"Date"'));assert.match(csv,/'=HYPERLINK\(""bad""\)/);assert.match(csv,/'\+command/);assert.match(csv,/two lines\n""quoted""/);assert.doesNotMatch(csv,/2026-11-01/);assert.match(csv,/Claimable total.*40\.98/);
});
