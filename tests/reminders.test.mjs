import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
process.env.TZ = 'Asia/Kuala_Lumpur';
const window = {};
runInNewContext(readFileSync(new URL('../reminders.js', import.meta.url), 'utf8'), {window, TextEncoder});
const E = window.WorkHubReminders;
const copy = x => JSON.parse(JSON.stringify(x));
const reminder = patch => ({id:'tasks:one',kind:'tasks',recordId:'one',until:'2026-10-20',at:'2026-10-20T10:00:00.000Z',hideUntilDue:false,note:'Update before signing off',updatedAt:'2026-10-20T01:00:00.000Z',...patch});
const data = rows => ({tasks:[{id:'one',task:'End of day review'}],tickets:[],projects:[],workhub:{reminders:rows}});

test('timed reminders use a fixed instant and reach due status at the exact selected time', () => {
 const r=reminder(),d=data([r]),before=copy(d),early=Date.parse('2026-10-20T09:59:59.999Z'),due=early+1;
 assert.equal(E.localInstant('2026-10-20','18:00'),r.at);
 assert.equal(E.records(d,'2026-10-20',early)[0].due,false);
 assert.equal(E.records(d,'2026-10-20',due)[0].due,true);
 assert.equal(E.isSnoozed(d,'tasks','one','2026-10-20',early),false);
 d.workhub.reminders[0].hideUntilDue=true;
 assert.equal(E.isSnoozed(d,'tasks','one','2026-10-20',early),true);
 assert.equal(E.isSnoozed(d,'tasks','one','2026-10-20',due),false);
 d.workhub.reminders[0].hideUntilDue=false;
 assert.deepEqual(d,before);
});

test('legacy date-only reminders remain snoozed until their original calendar day', () => {
 const r=reminder();delete r.at;delete r.hideUntilDue;
 const d=data([r]),snapshot=copy(d);E.upgrade(d);E.validate(d);
 assert.equal(E.isSnoozed(d,'tasks','one','2026-10-19'),true);
 assert.equal(E.isSnoozed(d,'tasks','one','2026-10-20'),false);
 assert.equal(E.records(d,'2026-10-20')[0].due,true);
 assert.deepEqual(d,snapshot);
});

test('invalid times, impossible dates and malformed restored instants are rejected', () => {
 for(const [day,time]of [['2026-02-30','18:00'],['2026-10-20','24:00'],['2026-10-20','12:99']])assert.throws(()=>E.localInstant(day,time),/date and time/);
 E.validate(data([reminder()]));
 for(const patch of [{at:'2026-02-30T10:00:00.000Z'},{at:'not-a-time'},{at:'2026-10-20T10:00:00+00:00'},{hideUntilDue:'yes'}])assert.throws(()=>E.validate(data([reminder(patch)])),/dates and notes/);
});

test('calendar copies include the selected UTC time and alarm, escape text and fold UTF-8 safely', () => {
 const r={...reminder(),title:'Review; '+ '提醒🌱'.repeat(40),note:'One, two; three\\four\r\nBEGIN:ATTENDEE'};
 const ics=E.calendar(r),unfolded=ics.replace(/\r\n /g,'');
 assert.ok(ics.endsWith('\r\n'));
 assert.match(unfolded,/DTSTART:20261020T100000Z\r\n/);
 assert.match(unfolded,/DTEND:20261020T101500Z\r\n/);
 assert.match(unfolded,/BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:PT0S/);
 assert.ok(!unfolded.includes('\r\nBEGIN:ATTENDEE'));
 assert.ok(unfolded.includes('One\\, two\\; three\\\\four\\nBEGIN:ATTENDEE'));
 for(const line of ics.split('\r\n'))assert.ok(new TextEncoder().encode(line).length<=75);
 assert.equal(E.records(data([]),'2026-10-20').length,0);
});
