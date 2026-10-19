/* Account-owned route mappings and expense records; all money totals use integer sen. */
(function(root){
'use strict';
const CATEGORIES={toll:'TnG / toll',parking:'Parking',transport:'Public transport',meals:'Meals',stay:'Accommodation',other:'Other'},PAYMENTS=['Touch ’n Go','Cash','Card','Other'];
const JOURNEYS={return:'Return trip', 'one-way':'One-way trip'},TRAVEL_KEYS=['locationId','locationName','oneWayKm','ratePerKm','journey','visits','claimable'];
const text=(v,max=200)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v),line=(v,max=200)=>text(v,max)&&!/[\r\n\t]/.test(v),id=v=>line(v,100)&&!!v;
function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||v<'1900-01-01')return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;}
const validMonth=v=>typeof v==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v)&&v>='1900-01';
function decimal(v,places,min,max){return typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&Math.abs(v*Math.pow(10,places)-Math.round(v*Math.pow(10,places)))<.000001;}
function upgrade(d){if(d?.workhub&&d.workhub.claims===undefined)d.workhub.claims={locations:[],expenses:[]};return d;}
function validateTravel(t){if(!t||typeof t!=='object'||Array.isArray(t)||!id(t.locationId)||!line(t.locationName,120)||!t.locationName.trim()||!decimal(t.oneWayKm,2,.01,10000)||!decimal(t.ratePerKm,4,0,1000)||!Object.hasOwn(JOURNEYS,t.journey)||!Number.isInteger(t.visits)||t.visits<1||t.visits>20||typeof t.claimable!=='boolean')throw Error('Check the on-site location, distance, mileage rate and visits.');}
function validate(d){
 const h=d.workhub?.claims;if(!h||typeof h!=='object'||Array.isArray(h)||!Array.isArray(h.locations)||h.locations.length>200||!Array.isArray(h.expenses)||h.expenses.length>5000)throw Error('Check the mileage locations and expense records.');
 const ids=new Set(),names=new Set();for(const l of h.locations){if(!l||!id(l.id)||ids.has(l.id)||!line(l.name,120)||!l.name.trim()||names.has(l.name.trim().toLocaleLowerCase())||!text(l.address,300)||!decimal(l.oneWayKm,2,.01,10000)||!decimal(l.ratePerKm,4,0,1000)||!Object.hasOwn(JOURNEYS,l.journey)||typeof l.archived!=='boolean')throw Error('Each on-site location needs a unique name, valid distance and mileage rate.');ids.add(l.id);names.add(l.name.trim().toLocaleLowerCase());}
 const expenseIds=new Set();for(const e of h.expenses){if(!e||!id(e.id)||expenseIds.has(e.id)||!validDate(e.date)||!Object.hasOwn(CATEGORIES,e.category)||!Number.isSafeInteger(e.amountCents)||e.amountCents<1||e.amountCents>100000000||!line(e.description,300)||!e.description.trim()||!PAYMENTS.includes(e.payment)||typeof e.claimable!=='boolean'||!line(e.locationId,100)||!line(e.locationName,120)||!line(e.bookingId,100)||!line(e.reference,160)||!text(e.notes,2000)||!line(e.createdAt,50)||!Number.isFinite(Date.parse(e.createdAt))||!line(e.updatedAt,50)||!Number.isFinite(Date.parse(e.updatedAt)))throw Error('Check the expense date, description and positive RM amount.');expenseIds.add(e.id);}
 const bookings=new Map();for(const s of d.schedule||[]){if(s.travel!==undefined&&s.travel!==null)validateTravel(s.travel);if(s.travel&&!s.bookingId)throw Error('Mileage needs a saved booking ID.');if(s.travel&&root.WorkHubLeave?.isLeave(s.kind))throw Error('Leave bookings cannot include on-site mileage.');if(s.bookingId){const prior=bookings.get(s.bookingId);if(prior){if(TRAVEL_KEYS.some(k=>prior.travel?.[k]!==s.travel?.[k]))throw Error('All segments of a booking must keep the same mileage details.');}else bookings.set(s.bookingId,s);}}
}
function prepare(next,previous,restoring=false){
 upgrade(next);if(restoring)return;const old=new Map();for(const s of previous?.schedule||[])if(s.bookingId&&s.travel&&!old.has(s.bookingId))old.set(s.bookingId,s);
 // Project-calendar edits rebuild schedule segments. Preserve the saved mapping on the same route.
 for(const s of next.schedule||[])if(!Object.hasOwn(s,'travel')&&s.bookingId&&old.has(s.bookingId)&&!root.WorkHubLeave?.isLeave(s.kind)){const before=old.get(s.bookingId);if(s.location===before.location)s.travel={...before.travel};}
}
function distance(t){return Math.round(t.oneWayKm*100)*(t.journey==='return'?2:1)*t.visits/100;}
function travelCost(t){validateTravel(t);return Math.round(Math.round(t.oneWayKm*100)*Math.round(t.ratePerKm*10000)*(t.journey==='return'?2:1)*t.visits/10000);}
function tripKey(s){return s.bookingId||s.planId||'legacy:'+s.date+':'+s.time;}
function trips(d,month=''){
 if(month&&!validMonth(month))throw Error('Choose a valid claim month.');const grouped=new Map();
 for(const s of d.schedule||[]){if(!s.travel||month&&!s.date.startsWith(month))continue;const key=s.date+'|'+tripKey(s),prior=grouped.get(key);if(prior){if(s.time<prior.time)prior.time=s.time;continue;}
  const plan=d.projectPlans?.find(p=>p.id===s.planId),task=s.kind==='task'?d.tasks?.find(t=>t.id===s.linkId):null;grouped.set(key,{key,date:s.date,time:s.time,bookingId:s.bookingId||'',travel:{...s.travel},distanceKm:distance(s.travel),amountCents:travelCost(s.travel),title:plan?.title||task?.task||s.text||'Scheduled visit'});
 }
 return[...grouped.values()].sort((x,y)=>(x.date+x.time).localeCompare(y.date+y.time));
}
function summary(d,month){
 if(!validMonth(month))throw Error('Choose a valid claim month.');const mileage=trips(d,month),expenses=(d.workhub?.claims?.expenses||[]).filter(e=>e.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)),included=mileage.filter(t=>t.travel.claimable),cost=category=>expenses.filter(e=>e.claimable&&(!category||e.category===category)).reduce((n,e)=>n+e.amountCents,0),mileageCents=included.reduce((n,t)=>n+t.amountCents,0),tollCents=cost('toll'),otherCents=cost()-tollCents;
 return{month,mileage,expenses,mileageCents,tollCents,otherCents,totalCents:mileageCents+tollCents+otherCents,distanceKm:Math.round(included.reduce((n,t)=>n+t.distanceKm,0)*100)/100,visits:included.reduce((n,t)=>n+t.travel.visits,0),excludedCents:mileage.filter(t=>!t.travel.claimable).reduce((n,t)=>n+t.amountCents,0)+expenses.filter(e=>!e.claimable).reduce((n,e)=>n+e.amountCents,0)};
}
const money=cents=>'RM '+(cents/100).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}),rate=n=>'RM '+Number(n).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:4}),km=n=>Number(n).toLocaleString('en-MY',{maximumFractionDigits:2});
function csv(d,month){
 const m=summary(d,month),rows=[['Date','Type','Description','On-site location','One-way km','Journey','Visits','Total km','RM per km','Claimable','Amount RM','Payment method','Receipt / reference','Notes','Booking ID']];
 for(const t of m.mileage)rows.push([t.date,'Mileage',t.title,t.travel.locationName,t.travel.oneWayKm,JOURNEYS[t.travel.journey],t.travel.visits,t.distanceKm,t.travel.ratePerKm,t.travel.claimable?'Yes':'No',(t.amountCents/100).toFixed(2),'','','',t.bookingId]);
 for(const e of m.expenses)rows.push([e.date,CATEGORIES[e.category],e.description,e.locationName,'','','','','',e.claimable?'Yes':'No',(e.amountCents/100).toFixed(2),e.payment,e.reference,e.notes,e.bookingId]);
 rows.push(['','Claimable total','','','','','','','',(m.totalCents/100).toFixed(2),'','','','']);
 const cell=value=>{let s=String(value??'');if(/^[\s\uFEFF]*[=+\-@]/.test(s)||/^[\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};return'\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
root.WorkHubClaimsEngine={CATEGORIES,PAYMENTS,JOURNEYS,upgrade,validate,prepare,validateTravel,decimal,validDate,validMonth,travelCost,distance,trips,summary,tripKey,money,rate,km,csv};
})(window);
