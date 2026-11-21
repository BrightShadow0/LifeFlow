(function(g){
'use strict';
const ENDPOINT_KEY='lifeflow_calendar_share_endpoint';
const OWNER_KEY='lifeflow_calendar_share_owners';
const SUBS_KEY='lifeflow_calendar_subscriptions';
const endpoint=()=>String(localStorage.getItem(ENDPOINT_KEY)||'').trim().replace(/\/$/,'');
function token(){const b=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function id(){return 'lfc_'+token().slice(0,24);}
async function request(url,method,key,body){
 const headers={'authorization':'Bearer '+key};if(body)headers['content-type']='application/json';
 const response=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 let data={};try{data=await response.json();}catch(_){}
 if(!response.ok)throw new Error(data.error||'Shared calendar request failed ('+response.status+').');
 return data;
}
function owners(){try{return JSON.parse(localStorage.getItem(OWNER_KEY)||'{}');}catch(_){return {};}}
function saveOwners(v){localStorage.setItem(OWNER_KEY,JSON.stringify(v));}
function subscriptions(){try{return JSON.parse(localStorage.getItem(SUBS_KEY)||'[]');}catch(_){return [];}}
function saveSubscriptions(v){localStorage.setItem(SUBS_KEY,JSON.stringify(v));}
function shareUrl(calendarId,readKey){const u=new URL(location.href);u.search='?calendarShare='+encodeURIComponent(calendarId)+'&relay='+encodeURIComponent(endpoint());u.hash=readKey;return u.href;}
async function createLiveShare(title,events,includeDetails=false){
 const base=endpoint();if(!base)throw new Error('Set the Live Sharing relay URL first.');
 const calendarId=id(),ownerKey=token(),readKey=token(),clean=(events||[]).map(e=>({id:e.id,title:e.title,startAt:e.startAt,endAt:e.endAt,allDay:!!e.allDay,location:includeDetails?e.location||'':'',description:includeDetails?e.description||'':''}));
 await request(base+'/calendar/'+calendarId,'PUT',ownerKey,{create:true,ownerHash:await hash(ownerKey),readHash:await hash(readKey),title,events:clean});
 const all=owners();all[calendarId]={ownerKey,title,updatedAt:new Date().toISOString()};saveOwners(all);
 return {id:calendarId,url:shareUrl(calendarId,readKey),eventCount:clean.length};
}
async function updateLiveShare(calendarId,events,title,includeDetails=false){
 const base=endpoint(),record=owners()[calendarId];if(!base||!record)throw new Error('This browser does not hold the owner key for that shared calendar.');
 const clean=(events||[]).map(e=>({id:e.id,title:e.title,startAt:e.startAt,endAt:e.endAt,allDay:!!e.allDay,location:includeDetails?e.location||'':'',description:includeDetails?e.description||'':''}));
 const result=await request(base+'/calendar/'+calendarId,'PUT',record.ownerKey,{ownerHash:await hash(record.ownerKey),title:title||record.title,events:clean});
 record.updatedAt=result.updatedAt;const all=owners();all[calendarId]=record;saveOwners(all);return result;
}
async function revokeLiveShare(calendarId){
 const base=endpoint(),all=owners(),record=all[calendarId];if(!base||!record)throw new Error('Owner key not found on this device.');
 await request(base+'/calendar/'+calendarId,'DELETE',record.ownerKey);delete all[calendarId];saveOwners(all);return true;
}
async function subscribe(link){
 const u=new URL(String(link||''),location.href),calendarId=u.searchParams.get('calendarShare'),readKey=u.hash.replace(/^#/,'');
 if(!calendarId||!readKey)throw new Error('Paste the complete LifeFlow shared calendar link.');
 const relay=u.searchParams.get('relay');if(relay)localStorage.setItem(ENDPOINT_KEY,relay.replace(/\/$/,''));const base=endpoint();if(!base)throw new Error('Set the Live Sharing relay URL first.');
 const feed=await request(base+'/calendar/'+calendarId,'GET',readKey);
 const all=subscriptions().filter(x=>x.id!==calendarId);all.push({id:calendarId,readKey,title:feed.title,addedAt:new Date().toISOString(),lastUpdated:feed.updatedAt});saveSubscriptions(all);
 return feed;
}
async function refreshSubscription(calendarId){
 const record=subscriptions().find(x=>x.id===calendarId);if(!record)throw new Error('Shared calendar subscription not found.');
 const feed=await request(endpoint()+'/calendar/'+calendarId,'GET',record.readKey);record.title=feed.title;record.lastUpdated=feed.updatedAt;saveSubscriptions(subscriptions().map(x=>x.id===calendarId?record:x));return feed;
}
async function hash(value){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function removeSubscription(calendarId){saveSubscriptions(subscriptions().filter(x=>x.id!==calendarId));}
g.LifeFlowCalendarSharing=Object.freeze({setEndpoint:value=>localStorage.setItem(ENDPOINT_KEY,String(value||'').trim().replace(/\/$/,'')),getEndpoint:endpoint,createLiveShare,updateLiveShare,revokeLiveShare,subscribe,refreshSubscription,listSubscriptions:subscriptions,removeSubscription});
})(window);
