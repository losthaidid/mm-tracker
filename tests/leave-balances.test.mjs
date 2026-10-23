import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
const window = {};
for (const file of ['reminders.js', 'leave-balance-engine.js', 'sync-merge.js']) runInNewContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { window });
const E = window.WorkHubLeaveBalancesEngine, copy = x => JSON.parse(JSON.stringify(x));
const AL = 'annual-leave', MC = 'medical-leave';
function state() {
  const y = E.defaults('2026'); y[AL].allowance = 12; y[AL].openingUsed = 10; y[MC].allowance = 14; y[MC].openingUsed = 11;
  return { workhub: { leaveBalances: [y] }, schedule: [] };
}
function add(d, date, kind = AL, portion = 'full', id = 'one', extra = {}) {
  for (const time of ['09:00', '10:00', '11:00', '12:00']) d.schedule.push({ date, time, endTime: String(Number(time.slice(0, 2)) + 1).padStart(2, '0') + ':00', bookingId: id, kind, leave: { portion, status: 'Planned', ...extra } });
}
test('leave balances: the 12 allowed / 10 used example permits two days and rejects a third without writes', () => {
  const d = state(), before = JSON.stringify(d);
  assert.equal(E.balance(d, '2026', AL).remaining, 2);
  const request = { kind: AL, date: '2026-10-26', endDate: '2026-10-27', leave: { portion: 'full' } };
  const p = E.preview(d, request); assert.equal(p.rows[0].requested, 2); assert.equal(p.rows[0].remaining, 0); E.assertWithinBalance(d, p.next);
  const over = E.preview(d, { ...request, endDate: '2026-10-28' }); assert.throws(() => E.assertWithinBalance(d, over.next), /only 2 day/);
  assert.equal(JSON.stringify(d), before);
});
test('leave balances: fragments count once; half-days combine, custom days stay explicit and MC is independent', () => {
  const d = state(); add(d, '2026-10-20', AL, 'morning'); add(d, '2026-10-20', AL, 'afternoon', 'two'); add(d, '2026-10-21', AL, 'custom', 'three', { daysPerDate: .5 }); add(d, '2026-10-22', MC);
  assert.equal(E.balance(d, '2026', AL).scheduled, 1.5); assert.equal(E.balance(d, '2026', AL).remaining, .5); assert.equal(E.balance(d, '2026', MC).remaining, 2);
  const legacy = state(); add(legacy, '2026-10-20', AL, 'morning', ''); assert.equal(E.balance(legacy, '2026', AL).scheduled, .5);
  const custom = state(); add(custom, '2026-10-20', AL, 'custom'); assert.equal(E.balance(custom, '2026', AL).scheduled, 1);
});
test('leave balances: configurable weekdays cover weekends, leap days and independent calendar years', () => {
  const d = state(); add(d, '2026-10-24'); add(d, '2026-10-25', MC); assert.equal(E.balance(d, '2026', AL).scheduled, 0); assert.equal(E.balance(d, '2026', MC).scheduled, 1);
  d.workhub.leaveBalances[0][AL].weekdays.push(6); assert.equal(E.balance(d, '2026', AL).scheduled, 1);
  const y = E.defaults('2027'); y[AL].allowance = 1; d.workhub.leaveBalances.push(y);
  const p = E.preview(d, { kind: AL, date: '2026-12-31', endDate: '2027-01-01', leave: { portion: 'full' } });
  assert.deepEqual(copy(p.years), ['2026', '2027']); assert.equal(p.rows[0].requested, 1); assert.equal(p.rows[1].requested, 1); assert.equal(p.rows[1].remaining, 0);
  assert.equal(E.dates('2028-02-28', '2028-03-01').length, 3); assert.throws(() => E.dates('2026-02-29', '2026-03-01'), /valid/);
});
test('leave balances: edits replace the original reservation, switching type releases AL, and deletion restores balance', () => {
  const d = state(); add(d, '2026-10-20'); const draft = { kind: AL, date: '2026-10-20', endDate: '2026-10-20', bookingId: 'one', leave: { portion: 'full' } };
  const p = E.preview(d, draft); assert.equal(p.rows[0].remaining, 1); assert.equal(p.rows[0].requested, 1); E.assertWithinBalance(d, p.next);
  const changed = E.preview(d, { ...draft, kind: MC }); assert.equal(E.balance(changed.next, '2026', AL).remaining, 2); assert.equal(E.balance(changed.next, '2026', MC).remaining, 2);
  const deleted = { ...d, schedule: [] }; assert.equal(E.balance(deleted, '2026', AL).remaining, 2);
});
test('leave balances: older unconfigured years stay usable, zero means no entitlement, overdrawn history can be reduced', () => {
  const d = { workhub: {}, schedule: [] }; E.upgrade(d); E.validate(d); assert.equal(E.balance(d, '2026', AL).remaining, null);
  const p = E.preview(d, { kind: AL, date: '2026-10-20', leave: { portion: 'full' } }); E.assertWithinBalance(d, p.next);
  const used = state(); used.workhub.leaveBalances[0][AL].allowance = 0; used.workhub.leaveBalances[0][AL].openingUsed = 0;
  assert.throws(() => E.assertWithinBalance(used, E.preview(used, { kind: AL, date: '2026-10-20', leave: { portion: 'full' } }).next), /only 0 day/);
  add(used, '2026-10-20'); E.assertWithinBalance(used, copy(used)); E.assertWithinBalance(used, { ...used, schedule: [] }); E.validate(used);
});
test('leave balances: invalid imports and fractional/nonfinite settings are rejected, without rewriting legacy bookings', () => {
  for (const value of [-1, .25, Infinity, NaN, '12', 367]) { const d = state(); d.workhub.leaveBalances[0][AL].allowance = value; assert.throws(() => E.validate(d), /leave days/); }
  for (const days of [[], [1, 1], [7], ['1']]) { const d = state(); d.workhub.leaveBalances[0][MC].weekdays = days; assert.throws(() => E.validate(d), /leave days/); }
  const d = state(); d.workhub.leaveBalances.push(copy(d.workhub.leaveBalances[0])); assert.throws(() => E.validate(d), /one leave allowance/);
  const legacy = { workhub: {}, schedule: [{ date: '2026-10-20', kind: AL, leave: { portion: 'custom' } }] }, before = copy(legacy.schedule); E.upgrade(legacy); E.validate(legacy); assert.deepEqual(legacy.schedule, before);
  const bad = state(); add(bad, '2026-10-20', AL, 'custom', 'bad', { daysPerDate: .25 }); assert.throws(() => E.validate(bad), /Custom leave/);
});
test('leave balances: independent year and AL/MC edits use the existing conservative document merge', () => {
  const b = { data: state() }, l = copy(b), r = copy(b); l.data.workhub.leaveBalances[0][AL].allowance = 13; r.data.workhub.leaveBalances[0][MC].allowance = 15;
  const result = window.MMTrackerMerge.merge(b, l, r); assert.deepEqual(copy(result.conflicts), []); assert.equal(result.data.workhub.leaveBalances[0][AL].allowance, 13); assert.equal(result.data.workhub.leaveBalances[0][MC].allowance, 15);
});


test('leave types: old documents gain AL/MC definitions without changing saved leave or existing allowances',()=>{
 const d=state();add(d,'2026-10-20');const before=copy(d.schedule),balance=E.balance(d,'2026',AL).remaining;E.upgrade(d);E.validate(d);assert.deepEqual(copy(d.schedule),before);assert.equal(E.balance(d,'2026',AL).remaining,balance);assert.deepEqual(copy(E.types(d).map(t=>t.code)),['AL','MC']);
});
test('leave types: a maintained custom type has independent policies, half-day usage and quota checks',()=>{
 const d=state();E.upgrade(d);const id='leave-compassionate';d.workhub.leaveTypes.push({id,name:'Compassionate Leave',code:'CL',archived:false});d.workhub.leaveBalances[0][id]={allowance:3,openingUsed:1,weekdays:[1,2,3,4,5]};add(d,'2026-10-20',id,'morning');E.validate(d);assert.equal(E.balance(d,'2026',id).remaining,1.5);assert.equal(E.balance(d,'2026',AL).remaining,2);const p=E.preview(d,{kind:id,date:'2026-10-26',endDate:'2026-10-27',leave:{portion:'full'}});assert.throws(()=>E.assertWithinBalance(d,p.next),/Compassionate Leave.*only 1.5/);
});
test('leave types: invalid definitions, duplicates and orphan references are rejected',()=>{
 const d=state();E.upgrade(d);for(const rows of [null,[],[d.workhub.leaveTypes[0]],[...d.workhub.leaveTypes,{id:'leave-extra',name:'Other Leave',code:'AL',archived:false}],[...d.workhub.leaveTypes,{id:'leave-extra',name:'annual leave',code:'EX',archived:false}],[...d.workhub.leaveTypes,{id:'__proto__',name:'Other Leave',code:'EX',archived:false}]])assert.throws(()=>E.validateTypes(rows),/leave type|AL and MC/i);
 const bad=copy(d);bad.workhub.leaveTypes=null;assert.throws(()=>E.validate(bad),/leave types/);add(d,'2026-10-20','leave-missing');assert.throws(()=>E.validate(d),/unknown leave type/);d.schedule=[];d.workhub.leaveBalances[0]['leave-missing']={allowance:1,openingUsed:0,weekdays:[1]};assert.throws(()=>E.validate(d),/unknown leave type/);
});
test('leave types: archiving keeps historical usage and independent type edits merge by stable ID',()=>{
 const d=state();E.upgrade(d);d.workhub.leaveTypes[0].archived=true;add(d,'2026-10-20');E.validate(d);assert.equal(E.balance(d,'2026',AL).remaining,1);
 const base={data:d},local=copy(base),remote=copy(base);local.data.workhub.leaveTypes[0].name='Vacation';remote.data.workhub.leaveTypes[1].name='Sick Leave';const merged=window.MMTrackerMerge.merge(base,local,remote);assert.deepEqual(copy(merged.conflicts),[]);assert.equal(E.type(merged.data,AL).name,'Vacation');assert.equal(E.type(merged.data,MC).name,'Sick Leave');
});
