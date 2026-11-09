import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":Deno.env.get("APP_ORIGIN")||"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const hex=(b:Uint8Array)=>Array.from(b).map(x=>x.toString(16).padStart(2,"0")).join("");
async function digest(v:string){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))));}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({ok:false,error:"Method not allowed."},405);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const auth=req.headers.get("Authorization")||"",caller=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const {data:{user},error:userError}=await caller.auth.getUser();
 if(userError||!user)return reply({ok:false,error:"Sign in to continue."},401);
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const body=await req.json(),action=String(body.action||"");
  if(action==="create"){
   const calendarId=String(body.calendarId||""),email=String(body.email||"").trim().toLowerCase(),role=String(body.role||"read_only");
   if(!calendarId||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>320||!["read_only","read_write"].includes(role))return reply({ok:false,error:"Enter a valid email and access level."},400);
   const {data:calendar,error:calError}=await admin.from("shared_calendars").select("id,name,owner_id").eq("id",calendarId).single();
   if(calError||calendar.owner_id!==user.id)return reply({ok:false,error:"Only the calendar owner can invite people."},403);
   if(email===String(user.email||"").toLowerCase())return reply({ok:false,error:"You already own this calendar."},400);
   const token=hex(crypto.getRandomValues(new Uint8Array(32))),tokenHash=await digest(token),expiresAt=new Date(Date.now()+7*86400000).toISOString();
   const {error}=await admin.from("calendar_invites").insert({calendar_id:calendarId,invite_email:email,role,token_hash:tokenHash,invited_by:user.id,expires_at:expiresAt});
   if(error)throw error;
   const base=(Deno.env.get("APP_BASE_URL")||"").replace(/\/$/,""),inviteUrl=base+"/Updated/workspace.html?calendarInvite="+encodeURIComponent(token);
   let emailSent=false;
   const key=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("INVITE_FROM_EMAIL");
   if(key&&from){
    const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:[email],subject:"LifeFlow calendar invitation",html:`<p>You have been invited to <strong>${calendar.name}</strong> with ${role==="read_write"?"read and write":"read-only"} access.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in seven days. Only the calendar owner can manage access.</p>`})});
    emailSent=sent.ok;
   }
   return reply({ok:true,inviteUrl,emailSent,expiresAt});
  }
  if(action==="accept"){
   const token=String(body.token||"");if(token.length!==64)return reply({ok:false,error:"This invitation is invalid or expired."},400);
   const {data:invite,error}=await admin.from("calendar_invites").select("id,calendar_id,invite_email,role,expires_at,accepted_at").eq("token_hash",await digest(token)).maybeSingle();
   if(error||!invite||invite.accepted_at||Date.parse(invite.expires_at)<Date.now()||String(user.email||"").toLowerCase()!==invite.invite_email)return reply({ok:false,error:"This invitation is invalid, expired, or belongs to another email address."},403);
   const {error:addError}=await admin.from("calendar_memberships").upsert({calendar_id:invite.calendar_id,user_id:user.id,role:invite.role,invited_by:invite.invited_by},{onConflict:"calendar_id,user_id"});
   if(addError)throw addError;
   const {error:acceptError}=await admin.from("calendar_invites").update({accepted_at:new Date().toISOString(),accepted_by:user.id}).eq("id",invite.id);
   if(acceptError)throw acceptError;
   const {data:calendar}=await admin.from("shared_calendars").select("id,name,owner_id").eq("id",invite.calendar_id).single();
   return reply({ok:true,calendar});
  }
  return reply({ok:false,error:"Unknown invitation action."},400);
 }catch(error){console.error("calendar-invites failed",String(error?.message||"unknown"));return reply({ok:false,error:"The calendar invitation could not be processed."},500);}
});
