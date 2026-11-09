const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(){
  const context={window:null,crypto:require('node:crypto').webcrypto,Date,Math,String,Number,Array,Error,encodeURIComponent};
  context.window=context;vm.runInNewContext(fs.readFileSync('Updated/calendar-events.js','utf8'),context);return context.LifeFlowCalendarEvents;
}
test('calendar event validates title, range and travel estimate',()=>{
  const api=load();
  assert.throws(()=>api.createEvent({startAt:'2026-01-01T10:00',endAt:'2026-01-01T11:00'}),/title/);
  assert.throws(()=>api.createEvent({title:'Bad',startAt:'2026-01-01T11:00',endAt:'2026-01-01T10:00'}),/times/);
  assert.throws(()=>api.createEvent({title:'Bad',startAt:'2026-01-01T10:00',endAt:'2026-01-01T11:00',travelMinutes:601}),/600/);
});
test('maps URL encodes location and travel alarm is based on departure plus alert offset',()=>{
  const api=load(),event={startAt:'2026-01-01T10:00:00.000Z',travelMinutes:30,leaveAlertMinutes:10,location:'Maker Chambers, Mumbai'};
  assert.match(api.mapsUrl(event.location),/Maker%20Chambers/);
  assert.equal(api.travelReminderAt(event).toISOString(),'2026-01-01T09:20:00.000Z');
});
test('iCalendar export preserves event details and includes departure alarm',()=>{
  const api=load(),ics=api.toIcs([{id:'e1',title:'Review, meeting',startAt:'2026-01-01T10:00:00.000Z',endAt:'2026-01-01T11:00:00.000Z',location:'Mumbai; India',description:'Bring the notes',travelMinutes:25,leaveAlertMinutes:10}]);
  assert.match(ics,/SUMMARY:Review\\, meeting/);assert.match(ics,/LOCATION:Mumbai\\; India/);assert.match(ics,/DESCRIPTION:Bring the notes\\nEstimated travel: 25 minutes\./);assert.match(ics,/TRIGGER:-PT35M/);
});
test('all-day task exports use an exclusive next-day end and preserve completion status',()=>{
  const api=load(),ics=api.toIcs([{id:'task-7',title:'Submit report',startAt:'2026-01-01T00:00:00.000Z',endAt:'2026-01-02T00:00:00.000Z',allDay:true,done:true}]);
  assert.match(ics,/DTSTART;VALUE=DATE:20260101/);assert.match(ics,/DTEND;VALUE=DATE:20260102/);assert.match(ics,/STATUS:CONFIRMED/);assert.match(ics,/X-LIFEFLOW-STATUS:COMPLETED/);
});
test('empty or malformed calendar rows are skipped safely',()=>{
  const api=load(),ics=api.toIcs([null,{}, {title:'No dates'}]);
  assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,0);
  assert.match(ics,/BEGIN:VCALENDAR/);assert.match(ics,/END:VCALENDAR/);
});

test('scheduled tasks become all-day entries or timed entries without changing their due date',()=>{
  const api=load();
  const allDay=api.createTaskEntry({id:7,title:'Submit report',due:'2026-01-01T00:00:00.000Z',done:true});
  assert.equal(allDay.allDay,true);assert.equal(allDay.id,'task-7');assert.equal(allDay.done,true);
  const timed=api.createTaskEntry({id:8,title:'Review',due:'2026-01-01T00:00:00.000Z',startTime:'09:30',endTime:'10:15'});
  assert.equal(timed.allDay,undefined);assert.equal(new Date(timed.startAt).getHours(),9);assert.equal(new Date(timed.endAt).getMinutes(),15);
  assert.equal(api.createTaskEntry({title:'No due date'}),null);
});
