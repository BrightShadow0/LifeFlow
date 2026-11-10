const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('Updated/experience-lab/inner-workspace.html', 'utf8');
const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
assert.ok(inlineScripts.length, 'Experience Lab must contain its interactive prototype script');
const appScript = inlineScripts[inlineScripts.length - 1][1];

test('Experience Lab item editor script is valid JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(appScript, { filename: 'inner-workspace-inline.js' }));
});

test('calendar item editor offers a simple single-day or recurring nature selector', () => {
  assert.match(html, /<option value="single">Single day<\/option>/);
  assert.match(html, /<option value="recurring">Recurring<\/option>/);
  assert.match(html, /id="eventSingleDate"/);
  assert.doesNotMatch(html, /id="eventDueDate"|id="eventRangeStart"|id="eventRangeEnd"/);
  assert.match(appScript, /document\.getElementById\('singleDayWrap'\)\.hidden=recurring/);
  assert.match(appScript, /document\.getElementById\('repeatPanel'\)\.hidden=!recurring/);
  assert.match(html, /id="view-calendar"[\s\S]*?id="eventList"/);
  const todayView = html.slice(html.indexOf('id="view-today"'), html.indexOf('id="view-tasks"'));
  assert.doesNotMatch(todayView, /Events & reminders|id="eventList"/);
});

test('recurrence is shown only for recurring items and supports weekly/monthly date ranges', () => {
  assert.match(appScript, /document\.getElementById\('eventNature'\)\.value==='recurring'/);
  assert.match(html, /id="eventRepeatStart"/);
  assert.match(html, /id="eventRepeatEnd"/);
  assert.match(html, /value="weekly"/);
  assert.match(html, /value="monthly"/);
  assert.match(html, /class="weekday"/);
  assert.match(html, /id="eventMonthDay"/);
  assert.match(appScript, /function occurrenceDates\(ev\)/);
});

test('alarms can request browser notifications and remain one-shot per occurrence', () => {
  assert.match(html, /id="eventAlarmEnabled"/);
  assert.match(html, /id="eventAlarmTime"/);
  assert.match(html, /id="eventAlarmLead"/);
  assert.match(appScript, /Notification\.requestPermission\(\)/);
  assert.match(appScript, /new Notification\('LifeFlow reminder'/);
  assert.match(appScript, /requireInteraction:true/);
  assert.match(appScript, /notifiedDates/);
  assert.match(appScript, /document\.addEventListener\('visibilitychange'/);
});


test('background reminders register a scoped service worker and use persistent browser notifications', () => {
  assert.match(appScript, /navigator\.serviceWorker\.register\(new URL\('\.\/reminder-sw\.js',location\.href\)/);
  assert.match(appScript, /registration\.showNotification\('LifeFlow reminder'/);
  assert.match(appScript, /requireInteraction:true/);
  assert.match(appScript, /window\.addEventListener\('focus',checkDueAlarms\)/);
  assert.match(appScript, /window\.addEventListener\('pageshow',checkDueAlarms\)/);
  const worker = fs.readFileSync('Updated/experience-lab/reminder-sw.js', 'utf8');
  assert.match(worker, /self\.addEventListener\('notificationclick'/);
  assert.match(worker, /self\.clients\.matchAll/);
  assert.match(worker, /self\.clients\.openWindow/);
  assert.doesNotThrow(() => new vm.Script(worker, { filename: 'reminder-sw.js' }));
});

test('created items are persisted and appear in Today, Tasks and Calendar', () => {
  assert.match(appScript, /lifeflow-lab-events-v2/);
  assert.match(appScript, /function persistEvents\(\)/);
  assert.match(appScript, /renderItemRows\('taskList'\)/);
  assert.match(appScript, /renderItemRows\('allTasks'\)/);
  assert.match(appScript, /renderCalendarItems\(\)/);
});

function extractFunction(name) {
  const start = appScript.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'missing function ' + name);
  const next = appScript.slice(start + 1).search(/\n(?:async )?function [A-Za-z_$][\w$]*\(/);
  return next < 0 ? appScript.slice(start) : appScript.slice(start, start + 1 + next);
}
function runPureFunctions(names, extraContext = {}) {
  const context = { Date, Math, Set, String, Number, Array, Object, ...extraContext };
  vm.createContext(context);
  vm.runInContext(names.map(extractFunction).join('\n'), context);
  return context;
}

test('strict date parsing rejects impossible and malformed dates', () => {
  const ctx = runPureFunctions(['dateFromKey']);
  assert.equal(ctx.dateFromKey('2026-02-29'), null);
  assert.equal(ctx.dateFromKey('2028-02-29').getDate(), 29);
  assert.equal(ctx.dateFromKey('2026-13-01'), null);
  assert.equal(ctx.dateFromKey('2026-01-01', '25:00'), null);
});

test('weekly recurrence honours selected weekdays and inclusive range boundaries', () => {
  const ctx = runPureFunctions(['localDateKey', 'dateFromKey', 'occurrenceDates'], {
    weekdayNames: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  });
  const dates = ctx.occurrenceDates({
    repeat: 'weekly', repeatStart: '2026-11-09', repeatEnd: '2026-11-15', days: [1, 3, 5]
  });
  assert.deepEqual(Array.from(dates), ['2026-11-09', '2026-11-11', '2026-11-13']);
});

test('monthly recurrence clamps day 29, 30 or 31 to the final day of shorter months', () => {
  const ctx = runPureFunctions(['localDateKey', 'dateFromKey', 'occurrenceDates']);
  assert.deepEqual(Array.from(ctx.occurrenceDates({
    repeat: 'monthly', repeatStart: '2026-01-31', repeatEnd: '2026-04-30', monthDay: 31
  })), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  assert.deepEqual(Array.from(ctx.occurrenceDates({
    repeat: 'monthly', repeatStart: '2028-01-30', repeatEnd: '2028-03-31', monthDay: 30
  })), ['2028-01-30', '2028-02-29', '2028-03-30']);
});

test('alarms fire once when due, tolerate background delay, and skip stale reminders', () => {
  const fixedNow = new Date(2026, 10, 10, 10, 0, 0).getTime();
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [fixedNow])); } static now() { return fixedNow; } }
  const ctx = runPureFunctions(['localDateKey', 'dateFromKey', 'occurrenceDates', 'nextOccurrence'], { Date: FixedDate });
  const base = { nature: 'general', singleDate: '2026-11-10', alarmEnabled: true, notify: true, alarmTime: '09:00', lead: 0, repeat: 'none', notifiedDates: [] };
  assert.equal(ctx.nextOccurrence(base).date, '2026-11-10');
  assert.equal(ctx.nextOccurrence({ ...base, notifiedDates: ['2026-11-10'] }), null);
  const stale = { ...base, singleDate: '2026-11-08' };
  assert.equal(ctx.nextOccurrence(stale), null);
});

test('saved item normalisation rejects invalid shapes and recurrence on single-day items', () => {
  const context = runPureFunctions(['dateFromKey', 'normaliseStoredEvent'], { Date, Math });
  const base = { title: 'Reminder', nature: 'single', singleDate: '2026-11-10', alarmEnabled: false, notify: false };
  assert.equal(context.normaliseStoredEvent(base).nature, 'single');
  assert.equal(context.normaliseStoredEvent({ ...base, nature: 'recurring', repeat: 'weekly', repeatStart: '2026-11-10', repeatEnd: '2026-12-10', days: [1] }).repeat, 'weekly');
  assert.equal(context.normaliseStoredEvent({ ...base, repeat: 'weekly' }).repeat, 'none');
  assert.equal(context.normaliseStoredEvent({ ...base, singleDate: '2026-02-31' }), null);
  assert.equal(context.normaliseStoredEvent({ title: '', nature: 'single' }), null);
});
test('calendar month grid is generated from the current month and marks item dates', () => {
  assert.match(appScript, /function renderMonthCalendar\(\)/);
  assert.match(appScript, /renderMonthCalendar\(\)/);
  assert.match(appScript, /className='month-day'/);
  assert.match(appScript, /has-items/);
  assert.match(html, /id="calendarMonthLabel"/);
  assert.match(html, /id="calendarCardMonth"/);
  assert.doesNotMatch(html, /NOVEMBER 2026/);
  assert.doesNotMatch(html, /Weekly planning<\/strong><small>10:30/);
});

test('recurrence and date ranges are bounded to five years', () => {
  assert.match(appScript, /repeat range within five years/);
  assert.doesNotMatch(appScript, /item date range within five years/);
  assert.match(appScript, /span>366\*5\*24\*60\*60\*1000/);
});

test('browser notification construction failure has a safe fallback', () => {
  assert.match(appScript, /const notification=new Notification/);
  assert.match(appScript, /using the in-app reminder instead/);
  assert.match(appScript, /now-triggerAt<=24\*60\*60\*1000/);
});

test('Cancel closes the item dialog without submitting the form', () => {
  assert.match(html, /<button type="button" class="text-btn" id="cancelEvent">Cancel<\/button>/);
  assert.match(appScript, /document\.getElementById\('cancelEvent'\)\.addEventListener\('click',event=>\{event\.preventDefault\(\)/);
});
test('theme rocker position is inverted for dark and light themes', () => {
  const css = fs.readFileSync('Updated/style.css', 'utf8');
  assert.match(css, /:root\[data-theme="dark"\] #app \.rocker-switch-lever\{transform:translateY\(calc\(100% \+ 2px\)\)\}/);
  assert.match(css, /:root\[data-theme="light"\] #app \.rocker-switch-lever\{transform:translateY\(0\)\}/);
});
