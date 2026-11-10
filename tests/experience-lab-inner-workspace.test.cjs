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
