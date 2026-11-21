(function(g){
'use strict';
const cache={};
function escText(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function getSelectedItems(){
 const includeTasks=document.getElementById('calendarShareIncludeTasks')?.checked!==false;
 const includeDetails=document.getElementById('calendarShareIncludeDetails')?.checked===true;
 const events=(Array.isArray(state.events)?state.events:[]).map(e=>({id:String(e.id),title:e.title,startAt:e.startAt,endAt:e.endAt,allDay:!!e.allDay,location:includeDetails?e.location||'':'',description:includeDetails?e.description||'':''}));
 const tasks=includeTasks?(Array.isArray(state.tasks)?state.tasks:[]).map(t=>window.LifeFlowCalendarEvents.createTaskEntry(t)).filter(Boolean):[];
 return [...events,...tasks];
}
function openCalendarShareDialog(){
 const host=document.getElementById('calendarEventHost');if(!host)return;
 const eventCount=(state.events||[]).length,taskCount=(state.tasks||[]).filter(t=>t.due&&t.title).length;
 host.innerHTML='<div class="calendar-event-overlay" data-lf-overlay="close-calendar-share"><section class="calendar-event-dialog calendar-share-dialog" role="dialog" aria-modal="true" aria-labelledby="calendarShareTitle"><header><div><span class="custom-kicker">CALENDAR SHARING</span><h2 id="calendarShareTitle">Share your calendar</h2></div><button type="button" class="hbtn" data-lf-action="close-calendar-share" aria-label="Close">×</button></header><div class="calendar-share-counts"><span><strong>'+eventCount+'</strong> events</span><span><strong>'+taskCount+'</strong> scheduled tasks</span></div><label class="calendar-share-option"><input id="calendarShareIncludeTasks" type="checkbox" checked> <span><strong>Include scheduled tasks</strong><small>Scheduled tasks are shared as calendar entries.</small></span></label><label class="calendar-share-option"><input id="calendarShareIncludeDetails" type="checkbox"> <span><strong>Include event details</strong><small>Shares addresses and notes. Off by default for privacy.</small></span></label><div class="calendar-reminder-hint"><strong>Snapshot sharing</strong><br>Export a .lfcal file and send it to someone. They can import it into LifeFlow. No account or server required.</div><input id="calendarSnapshotFile" type="file" accept=".lfcal,.json,application/json" hidden><footer><div><button type="button" class="secondary" data-lf-action="import-calendar-snapshot">Import snapshot</button></div><div><button type="button" class="secondary" data-lf-action="download-calendar-snapshot">Export snapshot</button><button type="button" class="primary" data-lf-action="open-live-calendar">Live sharing</button></div></footer></section></div>';
}
function closeShareDialog(){const host=document.getElementById('calendarEventHost');if(host)host.innerHTML='';}
function downloadSnapshot(){
 const events=getSelectedItems();if(!events.length){showToast('Choose at least one event or scheduled task to share.');return;}
 const payload={format:'lifeflow-calendar-snapshot',version:1,title:'LifeFlow calendar',createdAt:new Date().toISOString(),events};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/vnd.lifeflow.calendar+json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='lifeflow-calendar.lfcal';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);closeShareDialog();showToast('Snapshot exported. Send the .lfcal file to the other person.');
}
async function importSnapshot(file){
 if(!file)return;
 try{
  const data=JSON.parse(await file.text());
  if(data?.format!=='lifeflow-calendar-snapshot'||data.version!==1||!Array.isArray(data.events)||data.events.length>2000)throw new Error('This is not a supported LifeFlow calendar snapshot.');
  const imported=data.events.map((e,i)=>{const start=new Date(e.startAt),end=new Date(e.endAt);if(!String(e.title||'').trim()||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)throw new Error('The snapshot contains an invalid event.');return {id:'shared-'+Date.now()+'-'+i+'-'+Math.random().toString(36).slice(2,7),title:String(e.title).slice(0,160),startAt:start.toISOString(),endAt:end.toISOString(),allDay:!!e.allDay,location:String(e.location||'').slice(0,500),description:String(e.description||'').slice(0,2000),travelMinutes:0,leaveAlertMinutes:0,sharedSnapshot:true,sourceCalendar:data.title||'Shared calendar'};});
  updateWorkspaceState({events:[...(state.events||[]),...imported]});closeShareDialog();showToast(imported.length+' shared events imported into your calendar.');
 }catch(error){showToast(error.message||'Could not import the calendar snapshot.');}
}
function openLiveCalendarDialog(){
 const host=document.getElementById('calendarEventHost');if(!host)return;
 const endpoint=window.LifeFlowCalendarSharing.getEndpoint(),owners=JSON.parse(localStorage.getItem('lifeflow_calendar_share_owners')||'{}');
 const rows=Object.entries(owners).map(([id,item])=>'<div class="other-calendar-event"><strong>'+escText(item.title||'Shared calendar')+'</strong><small>Live link active on this device</small><button type="button" class="secondary" data-lf-action="copy-live-calendar-share" data-share-id="'+escText(id)+'">Copy share link</button><button type="button" class="secondary" data-lf-action="update-live-calendar-share" data-share-id="'+escText(id)+'">Update from my events</button><button type="button" class="danger" data-lf-action="revoke-live-calendar-share" data-share-id="'+escText(id)+'">Revoke link</button></div>').join('');
 host.innerHTML='<div class="calendar-event-overlay" data-lf-overlay="close-calendar-share"><section class="calendar-event-dialog live-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="liveCalendarTitle"><header><div><span class="custom-kicker">OPTIONAL LIVE SHARING</span><h2 id="liveCalendarTitle">Live shared calendars</h2></div><button type="button" class="hbtn" data-lf-action="close-calendar-share">×</button></header><p>Live sharing uses a small relay service. Neither person needs a LifeFlow account. Your events remain private unless you publish them.</p><label for="calendarShareRelayUrl">Relay service URL</label><input id="calendarShareRelayUrl" type="url" value="'+escText(endpoint)+'" placeholder="https://your-calendar-relay.workers.dev"><small class="muted">Snapshot sharing works without this service. Live sharing needs the optional Cloudflare Worker configured for LifeFlow.</small><label for="calendarSubscribeLink">Add someone else’s live calendar link</label><input id="calendarSubscribeLink" type="url" placeholder="Paste the complete LifeFlow share link"><div class="calendar-event-error" id="liveCalendarMessage" role="status"></div><footer><div><button type="button" class="secondary" data-lf-action="save-calendar-relay">Save relay URL</button></div><div><button type="button" class="secondary" data-lf-action="subscribe-live-calendar">Add calendar</button><button type="button" class="primary" data-lf-action="create-live-calendar-share">Create live link</button></div></footer><div id="liveCalendarOwned">'+(rows?'<h3>Your live links</h3>'+rows:'')+'</div></section></div>';
}
async function createLiveShare(){
 const message=document.getElementById('liveCalendarMessage');
 try{
  const endpoint=document.getElementById('calendarShareRelayUrl')?.value.trim()||'';if(endpoint)window.LifeFlowCalendarSharing.setEndpoint(endpoint);
  const details=document.getElementById('calendarShareIncludeDetails')?.checked===true;
  const result=await window.LifeFlowCalendarSharing.createLiveShare('LifeFlow shared calendar',getSelectedItems().filter(e=>!String(e.id).startsWith('task-')),details);
  const input=document.getElementById('liveCalendarMessage');if(input)input.textContent='Live link created: '+result.url;
  try{await navigator.clipboard.writeText(result.url);if(input)input.textContent='Live link created and copied to clipboard. Share it only with people you trust.';}catch(_){}
  openLiveCalendarDialog();
 }catch(error){if(message)message.textContent=error.message||'Could not create a live link.';}
}
async function subscribeLiveShare(){
 const message=document.getElementById('liveCalendarMessage');
 try{const feed=await window.LifeFlowCalendarSharing.subscribe(document.getElementById('calendarSubscribeLink')?.value||'');cache[feed.id]=feed;await renderOtherCalendarsPanel(document.getElementById('main'));if(message)message.textContent='Added '+feed.title+'. Its events are now visible under Other Calendars.';}
 catch(error){if(message)message.textContent=error.message;}
}
async function refreshFeed(id){
 try{cache[id]=await window.LifeFlowCalendarSharing.refreshSubscription(id);await renderOtherCalendarsPanel(document.getElementById('main'));}
 catch(error){showToast(error.message);}
}
async function revokeShare(id){
 if(!confirm('Revoke this live calendar link? Subscribers will no longer be able to access it.'))return;
 try{await window.LifeFlowCalendarSharing.revokeLiveShare(id);openLiveCalendarDialog();showToast('Live link revoked.');}
 catch(error){showToast(error.message);}
}
async function updateShare(id){
 try{const events=(state.events||[]).map(e=>({id:e.id,title:e.title,startAt:e.startAt,endAt:e.endAt,allDay:!!e.allDay}));const result=await window.LifeFlowCalendarSharing.updateLiveShare(id,events,'LifeFlow shared calendar');showToast('Live calendar updated with '+result.eventCount+' events.');}
 catch(error){showToast(error.message);}
}
async function renderOtherCalendarsPanel(root){
 const panel=root?.querySelector('#lfOtherCalendars .other-calendars-content');if(!panel)return;
 const subs=window.LifeFlowCalendarSharing.listSubscriptions();
 if(!subs.length){panel.innerHTML='<p class="muted">No shared calendars yet. Add a link from someone you trust.</p><button type="button" class="secondary" data-lf-action="open-live-calendar">Add a shared calendar</button>';return;}
 if(!renderOtherCalendarsPanel.loading){renderOtherCalendarsPanel.loading=true;Promise.all(subs.map(async s=>{if(!cache[s.id])try{cache[s.id]=await window.LifeFlowCalendarSharing.refreshSubscription(s.id);}catch(error){cache[s.id]={title:s.title,events:[],error:error.message};}})).finally(()=>{renderOtherCalendarsPanel.loading=false;renderOtherCalendarsPanel(root);});}
 panel.innerHTML=subs.map(s=>{const feed=cache[s.id],events=(feed?.events||[]).filter(e=>new Date(e.endAt)>=new Date()).slice(0,8);return '<div class="other-calendar-entry"><div class="other-calendar-name"><strong>'+escText(feed?.title||s.title||'Shared calendar')+'</strong><small>Live subscription · read only</small></div><div>'+(events.map(e=>'<div class="other-calendar-event"><strong>'+escText(e.title)+'</strong><span>'+escText(new Date(e.startAt).toLocaleString([], {dateStyle:'medium',timeStyle:e.allDay?undefined:'short'}))+'</span></div>').join('')||'<small class="muted">'+escText(feed?.error||'No upcoming events.')+'</small>')+'</div><button type="button" class="secondary" data-lf-action="refresh-shared-calendar" data-share-id="'+escText(s.id)+'">Refresh</button><button type="button" class="danger" data-lf-action="remove-shared-calendar" data-share-id="'+escText(s.id)+'">Remove</button></div>';}).join('')+'<button type="button" class="secondary" data-lf-action="open-live-calendar">Manage shared calendars</button>';
}
document.addEventListener('click',function(event){
 const control=event.target.closest('[data-lf-action]');if(!control)return;const action=control.dataset.lfAction;
 const actions={
  'copy-live-calendar-share':()=>{const item=JSON.parse(localStorage.getItem('lifeflow_calendar_share_owners')||'{}')[control.dataset.shareId];if(item?.url)navigator.clipboard?.writeText(item.url).then(()=>showToast('Live link copied.')).catch(()=>showToast(item.url));},
  'download-calendar-snapshot':downloadSnapshot,
  'import-calendar-snapshot':()=>document.getElementById('calendarSnapshotFile')?.click(),
  'save-calendar-relay':()=>{const v=document.getElementById('calendarShareRelayUrl')?.value.trim()||'';if(!v){document.getElementById('liveCalendarMessage').textContent='Enter the relay service URL.';return;}window.LifeFlowCalendarSharing.setEndpoint(v);document.getElementById('liveCalendarMessage').textContent='Relay URL saved on this browser.';},
  'create-live-calendar-share':createLiveShare,
  'subscribe-live-calendar':subscribeLiveShare,
  'refresh-shared-calendar':()=>refreshFeed(control.dataset.shareId),
  'remove-shared-calendar':()=>{window.LifeFlowCalendarSharing.removeSubscription(control.dataset.shareId);delete cache[control.dataset.shareId];renderOtherCalendarsPanel(document.getElementById('main'));},
  'update-live-calendar-share':()=>updateShare(control.dataset.shareId),
  'revoke-live-calendar-share':()=>revokeShare(control.dataset.shareId)
 };
 if(actions[action]){event.preventDefault();event.stopImmediatePropagation();actions[action]();}
},true);
document.addEventListener('change',function(event){if(event.target?.id==='calendarSnapshotFile'){importSnapshot(event.target.files?.[0]);event.target.value='';}},true);
window.addEventListener('load',function(){
 const url=new URL(location.href);if(!url.searchParams.has('calendarShare'))return;
 window.LifeFlowCalendarSharing.subscribe(location.href).then(function(feed){
  cache[feed.id]=feed;const clean=new URL(location.href);clean.searchParams.delete('calendarShare');clean.searchParams.delete('relay');clean.hash='';history.replaceState({},'',clean.pathname+clean.search);
  const main=document.getElementById('main');if(main)renderOtherCalendarsPanel(main);
  if(typeof setView==='function')setView('calendar');if(typeof showToast==='function')showToast('Shared calendar added: '+feed.title);
 }).catch(function(error){if(typeof showToast==='function')showToast('Could not add shared calendar: '+error.message);});
});
g.openCalendarShareDialog=openCalendarShareDialog;
g.openLiveCalendarDialog=openLiveCalendarDialog;
g.renderOtherCalendarsPanel=renderOtherCalendarsPanel;
})(window);
