import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
const cors={"Access-Control-Allow-Origin":Deno.env.get("APP_ORIGIN")||"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const esc=(v:string)=>v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
async function email(to:string,subject:string,html:string){const key=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("REMINDER_FROM_EMAIL");if(!key||!from)throw Error("email_not_configured");const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject,html})});if(!r.ok)throw Error("email_provider_"+r.status);return await r.json();}
async function sms(to:string,body:string){const sid=Deno.env.get("TWILIO_ACCOUNT_SID"),token=Deno.env.get("TWILIO_AUTH_TOKEN"),from=Deno.env.get("TWILIO_SMS_FROM");if(!sid||!token||!from)throw Error("sms_not_configured");const form=new URLSearchParams({To:to,From:from,Body:body}),r=await fetch("https://api.twilio.com/2010-04-01/Accounts/"+sid+"/Messages.json",{method:"POST",headers:{"Authorization":"Basic "+btoa(sid+":"+token),"Content-Type":"application/x-www-form-urlencoded"},body:form});if(!r.ok)throw Error("sms_provider_"+r.status);return await r.json();}
async function whatsapp(to:string,title:string,startAt:string,location:string,maps:string){const token=Deno.env.get("WHATSAPP_ACCESS_TOKEN"),phone=Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"),name=Deno.env.get("WHATSAPP_TEMPLATE_NAME"),language=Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE")||"en";if(!token||!phone||!name)throw Error("whatsapp_template_not_configured");const parameters=[title,new Date(startAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}),location||"Venue not specified",maps||"No map link"].map(text=>({type:"text",text}));const r=await fetch("https://graph.facebook.com/v21.0/"+phone+"/messages",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:to.replace("+",""),type:"template",template:{name,language:{code:language},components:[{type:"body",parameters}]}})});if(!r.ok)throw Error("whatsapp_provider_"+r.status);return await r.json();}
async function push(sub:any,payload:any){const pub=Deno.env.get("VAPID_PUBLIC_KEY"),priv=Deno.env.get("VAPID_PRIVATE_KEY"),subject=Deno.env.get("VAPID_SUBJECT")||"mailto:support@lifeflow.app";if(!pub||!priv)throw Error("push_not_configured");webpush.setVapidDetails(subject,pub,priv);return await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_secret}},JSON.stringify(payload));}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({ok:false,error:"Method not allowed."},405);
 const secret=Deno.env.get("REMINDER_CRON_SECRET");if(!secret||req.headers.get("Authorization")!=="Bearer "+secret)return reply({ok:false,error:"Unauthorized."},401);
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
 const now=Date.now(),from=new Date(now-5*60000),to=new Date(now+60000),{data:events,error}=await db.from("calendar_events").select("*,shared_calendars!inner(id,owner_id,name)").gt("starts_at",new Date(now-2*60000).toISOString()).lte("starts_at",new Date(now+8*86400000).toISOString());
 if(error)return reply({ok:false,error:"Could not load upcoming events."},500);
 let processed=0,delivered=0,failed=0;
 async function claim(event:any,userId:string|null,recipientKey:string,channel:string){
  let q=db.from("calendar_notification_deliveries").select("id,status").eq("event_id",event.id).eq("event_updated_at",event.updated_at).eq("channel",channel);
  q=userId?q.eq("user_id",userId):q.is("user_id",null).eq("recipient_key",recipientKey);
  const {data:old}=await q.maybeSingle();if(old?.status==="sent")return null;
  if(old){const {data,error}=await db.from("calendar_notification_deliveries").update({status:"queued",error_code:null}).eq("id",old.id).select("id").single();if(error)return null;return data;}
  const {data,error}=await db.from("calendar_notification_deliveries").insert({event_id:event.id,user_id:userId,recipient_key:recipientKey,event_updated_at:event.updated_at,channel,status:"queued"}).select("id").single();
  return error?null:data;
 }
 async function mark(id:string,status:string,code?:string){await db.from("calendar_notification_deliveries").update({status,error_code:code||null,sent_at:status==="sent"?new Date().toISOString():null}).eq("id",id);}
 for(const event of events||[]){
  const start=Date.parse(event.starts_at),travel=Number(event.travel_minutes||0);
  const location=event.location_lat!=null&&event.location_lng!=null?event.location_lat+","+event.location_lng:event.location;
  const maps=location?"https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(location):"";
  const details=[event.title,new Date(start).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}),event.location||"",maps].filter(Boolean).join("\\n");
  const {data:members}=await db.from("calendar_memberships").select("user_id").eq("calendar_id",event.calendar_id);
  const recipients=new Set([event.shared_calendars.owner_id,...(members||[]).map((m:any)=>m.user_id)]);
  for(const userId of recipients){
   const {data:prefs}=await db.from("calendar_notification_preferences").select("*").eq("user_id",userId).maybeSingle();
   if(prefs?.departure_reminders_enabled===false)continue;
   const lead=event.leave_alert_minutes==null?Number(prefs?.default_lead_minutes??15):Number(event.leave_alert_minutes);
   const departureAt=start-(travel+lead)*60000;
   if(departureAt<from.getTime()||departureAt>to.getTime())continue;
   const channels=["in_app","web_push","email","whatsapp","sms"].filter(ch=>ch==="in_app"?prefs?.in_app_enabled!==false:!!prefs?.[ch+"_enabled"]);
   for(const channel of channels){
    const recipientKey=userId,delivery=await claim(event,userId,recipientKey,channel);if(!delivery)continue;processed++;
    try{
     if(channel==="in_app"){
      const {error:e}=await db.from("calendar_in_app_notifications").insert({user_id:userId,event_id:event.id,title:"Time to leave: "+event.title,body:details,action_url:maps||"Updated/workspace.html"});if(e)throw e;
     }else if(channel==="web_push"){
      const {data:subs}=await db.from("calendar_push_subscriptions").select("*").eq("user_id",userId);if(!subs?.length)throw Error("no_push_subscription");
      for(const sub of subs){try{await push(sub,{title:"LifeFlow · Time to leave",body:event.title+(event.location?" · "+event.location:""),url:maps||"Updated/workspace.html",tag:"lifeflow-"+event.id});}catch(e){if((e as any)?.statusCode===404||(e as any)?.statusCode===410)await db.from("calendar_push_subscriptions").delete().eq("id",sub.id);throw e;}}
     }else if(channel==="email"){if(!prefs?.email_address)throw Error("email_address_missing");await email(prefs.email_address,"Time to leave: "+event.title,"<h2>"+esc(event.title)+"</h2><p>"+esc(details).replace(/\\n/g,"<br>")+"</p>"+(maps?'<p><a href="'+maps+'">Open Google Maps directions</a></p>':""));}
     else if(channel==="whatsapp"){if(!prefs?.whatsapp_e164)throw Error("whatsapp_number_missing");await whatsapp(prefs.whatsapp_e164,event.title,new Date(start).toISOString(),event.location||"",maps);}
     else if(channel==="sms"){if(!prefs?.phone_e164)throw Error("phone_number_missing");await sms(prefs.phone_e164,"Time to leave: "+event.title+(maps?" "+maps:""));}
     await mark(delivery.id,"sent");delivered++;
    }catch(e){await mark(delivery.id,"failed",String((e as any)?.message||"delivery_failed").slice(0,80));failed++;}
   }
  }
  const {data:guests}=await db.from("calendar_event_guests").select("*").eq("event_id",event.id).eq("reminder_enabled",true);
  for(const guest of guests||[]){
   const guestAt=start-Number(guest.reminder_minutes||60)*60000;if(guestAt<from.getTime()||guestAt>to.getTime())continue;
   const key=String(guest.email).toLowerCase(),delivery=await claim(event,null,key,"guest_email");if(!delivery)continue;processed++;
   try{await email(guest.email,"Event reminder: "+event.title,"<h2>"+esc(event.title)+"</h2><p>"+esc(details).replace(/\\n/g,"<br>")+"</p>"+(maps?'<p><a href="'+maps+'">Open Google Maps directions</a></p>':""));await mark(delivery.id,"sent");delivered++;}
   catch(e){await mark(delivery.id,"failed",String((e as any)?.message||"guest_email_failed").slice(0,80));failed++;}
  }
 }
 return reply({ok:true,processed,delivered,failed});
});
