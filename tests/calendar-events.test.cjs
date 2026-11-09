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
test('iCalendar export preserves location and includes departure alarm',()=>{
  const api=load(),ics=api.toIcs([{id:'e1',title:'Review, meeting',startAt:'2026-01-01T10:00:00.000Z',endAt:'2026-01-01T11:00:00.000Z',location:'Mumbai; India',travelMinutes:25,leaveAlertMinutes:10}]);
  assert.match(ics,/SUMMARY:Review\\, meeting/);assert.match(ics,/LOCATION:Mumbai\\; India/);assert.match(ics,/TRIGGER:-PT35M/);
});
