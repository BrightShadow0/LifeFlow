import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":Deno.env.get("APP_ORIGIN")||"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const esc=(v:string)=>v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({ok:false,error:"Method not allowed."},405);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const caller=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});
 const {data:{user},error:userError}=await caller.auth.getUser();
 if(userError||!user)return reply({ok:false,error:"Sign in to continue."},401);
 try{
  const body=await req.json(),eventId=String(body.eventId||""),action=String(body.action||"");
  if(!eventId||!["updated","cancelled"].includes(action))return reply({ok:false,error:"Invalid event notification request."},400);
  const {data:event,error:eventError}=await caller.from("calendar_events").select("id,calendar_id,title,starts_at,ends_at,location,location_lat,location_lng").eq("id",eventId).single();
  if(eventError||!event)return reply({ok:false,error:"Event not found or access denied."},404);
  const {data:canEdit,error:permissionError}=await caller.rpc("can_edit_calendar",{p_calendar_id:event.calendar_id});
  if(permissionError||!canEdit)return reply({ok:false,error:"Only calendar editors can notify guests about event changes."},403);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:guests,error:guestError}=await admin.from("calendar_event_guests").select("email,display_name").eq("event_id",eventId).eq("reminder_enabled",true);
  if(guestError)throw guestError;
  if(!guests?.length)return reply({ok:true,sent:0});
  const key=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("REMINDER_FROM_EMAIL");
  if(!key||!from)return reply({ok:false,error:"Guest email delivery is not configured yet."},503);
  const destination=event.location_lat!=null&&event.location_lng!=null?event.location_lat+","+event.location_lng:event.location;
  const maps=destination?"https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(destination):"";
  const cancelled=action==="cancelled",subject=(cancelled?"Cancelled: ":"Updated: ")+event.title;
  const html="<h2>"+esc(event.title)+"</h2><p>"+(cancelled?"This event has been cancelled.":"This event has been updated.")+"</p><p>"+esc(new Date(event.starts_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}))+"</p>"+(event.location?"<p>"+esc(event.location)+"</p>":"")+(maps?"<p><a href=\""+maps+"\">Open Google Maps directions</a></p>":"");
  let sent=0,failed=0;
  for(const guest of guests){
   const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:[guest.email],subject,html})});
   if(response.ok)sent++;else failed++;
  }
  return reply({ok:true,sent,failed});
 }catch(error){console.error("notify-calendar-guests failed",String((error as any)?.message||"unknown"));return reply({ok:false,error:"Guest notification could not be sent."},500);}
});
