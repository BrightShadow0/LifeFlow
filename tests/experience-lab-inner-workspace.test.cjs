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

test('item nature options and conditional date controls are present', () => {
  for (const type of ['general', 'birthday', 'anniversary', 'meeting', 'assignment']) {
    assert.match(html, new RegExp('<option value="' + type + '">'));
  }
  assert.match(html, /id="eventSingleDate"/);
  assert.match(html, /id="eventDueDate"/);
  assert.match(html, /id="eventRangeStart"/);
  assert.match(html, /id="eventRangeEnd"/);
  assert.match(appScript, /document\.getElementById\('repeatToggleWrap'\)\.hidden=!general/);
  assert.match(appScript, /document\.getElementById\('assignmentDateWrap'\)\.hidden=!assignment/);
  assert.match(appScript, /document\.getElementById\('rangeDateWrap'\)\.hidden=general\|\|assignment/);
});

test('recurrence is restricted to General and supports weekly/monthly date ranges', () => {
  assert.match(appScript, /document\.getElementById\('eventRepeating'\)\.checked&&document\.getElementById\('eventNature'\)\.value==='general'/);
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
  const brace = appScript.indexOf('{', start);
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = brace; i < appScript.length; i++) {
    const ch = appScript[i], next = appScript[i + 1];
    if (lineComment) { if (ch === '\\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}' && --depth === 0) return appScript.slice(start, i + 1);
  }
  throw new Error('unterminated function ' + name);
}
function runPureFunctions(names, extraContext = {}) {
  const context = { Date, Math, Set, String, Number, Array, Object, ...extraContext };
  vm.createContext(context);
  vm.runInContext(names.map(extractFunction).join('\\n'), context);
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

test('saved item normalisation rejects invalid shapes and non-General recurrence', () => {
  const ctx = runPureFunctions(['dateFromKey', 'normaliseStoredEvent']);
  assert.equal(ctx.normaliseStoredEvent(null), null);
  assert.equal(ctx.normaliseStoredEvent({ title: 'No date', nature: 'general', singleDate: '2026-02-31' }), null);
  const birthday = ctx.normaliseStoredEvent({
    id: 'b1', title: 'Birthday', nature: 'birthday', repeat: 'weekly',
    startDate: '2026-11-10', endDate: '2026-11-10'
  });
  assert.equal(birthday.repeat, 'none');
});
