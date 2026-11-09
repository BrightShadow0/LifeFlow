(function(global){
'use strict';
function mapsUrl(location){
  const value=String(location||'').trim();
  if(!value)return '';
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(value);
}
function travelReminderAt(event){
  const start=Date.parse(event?.startAt);
  if(!Number.isFinite(start))return null;
  const minutes=Math.max(0,Number(event.travelMinutes)||0)+Math.max(0,Number(event.leaveAlertMinutes)||0);
  return new Date(start-minutes*60000);
}
function escapeIcs(value){
  return String(value??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}
function icsDate(value){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))throw new Error('Calendar event contains an invalid date.');
  return date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
}
function icsDateOnly(value){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))throw new Error('Calendar task contains an invalid date.');
  return String(date.getFullYear())+String(date.getMonth()+1).padStart(2,'0')+String(date.getDate()).padStart(2,'0');
}
function toIcs(events,title='LifeFlow shared calendar'){
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LifeFlow//Calendar 1.0//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+escapeIcs(title)];
  (Array.isArray(events)?events:[]).forEach(event=>{
    if(!event?.title||!event.startAt||!event.endAt)return;
    const uid=String(event.id||global.crypto?.randomUUID?.()||Date.now())+'@lifeflow';
    const description=[event.description||'',Number(event.travelMinutes)>0?'Estimated travel: '+Number(event.travelMinutes)+' minutes.':''].filter(Boolean).join('\n');
    lines.push('BEGIN:VEVENT','UID:'+escapeIcs(uid),'DTSTAMP:'+icsDate(new Date()));
    if(event.allDay){
      lines.push('DTSTART;VALUE=DATE:'+icsDateOnly(event.startAt),'DTEND;VALUE=DATE:'+icsDateOnly(event.endAt));
    }else{
      lines.push('DTSTART:'+icsDate(event.startAt),'DTEND:'+icsDate(event.endAt));
    }
    lines.push('SUMMARY:'+escapeIcs(event.title));
    if(event.location)lines.push('LOCATION:'+escapeIcs(event.location));
    if(description)lines.push('DESCRIPTION:'+escapeIcs(description));
    lines.push('STATUS:CONFIRMED');
    if(event.done)lines.push('X-LIFEFLOW-STATUS:COMPLETED');
    if(!event.allDay&&Number(event.travelMinutes)>0){
      const offset=Number(event.travelMinutes)+Math.max(0,Number(event.leaveAlertMinutes)||0);
      lines.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+escapeIcs('Time to leave for '+event.title),'TRIGGER:-PT'+offset+'M','END:VALARM');
    }
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n')+'\r\n';
}
function createTaskEntry(task){
  const due=new Date(task?.due),title=String(task?.title||'').trim();
  if(!title||!task?.due||Number.isNaN(due.getTime()))return null;
  const start=new Date(due),end=new Date(due),startTime=String(task.startTime||''),endTime=String(task.endTime||'');
  const timed=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime)&&startTime<endTime;
  if(timed){
    const [sh,sm]=startTime.split(':').map(Number),[eh,em]=endTime.split(':').map(Number);
    start.setHours(sh,sm,0,0);end.setHours(eh,em,0,0);
    return {id:'task-'+String(task.id??Date.now()),title,startAt:start.toISOString(),endAt:end.toISOString(),done:!!(task.done||task.status==='done')};
  }
  start.setHours(0,0,0,0);end.setTime(start.getTime());end.setDate(end.getDate()+1);
  return {id:'task-'+String(task.id??Date.now()),title,startAt:start.toISOString(),endAt:end.toISOString(),allDay:true,done:!!(task.done||task.status==='done')};
}
function createEvent(input){
  const start=new Date(input?.startAt),end=new Date(input?.endAt),title=String(input?.title||'').trim();
  if(!title)throw new Error('An event needs a title.');
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<=start)throw new Error('Event start and end times are invalid.');
  const travel=Number(input?.travelMinutes)||0;
  if(!Number.isFinite(travel)||travel<0||travel>600)throw new Error('Travel time must be between 0 and 600 minutes.');
  return {id:String(input.id||global.crypto?.randomUUID?.()||Date.now()),title,startAt:start.toISOString(),endAt:end.toISOString(),location:String(input.location||'').trim().slice(0,500),description:String(input.description||'').trim().slice(0,2000),travelMinutes:travel,leaveAlertMinutes:Math.max(0,Math.min(180,Number(input.leaveAlertMinutes)||0)),reminderSentAt:null,updatedAt:new Date().toISOString()};
}
global.LifeFlowCalendarEvents=Object.freeze({mapsUrl,travelReminderAt,toIcs,createTaskEntry,createEvent});
})(window);
