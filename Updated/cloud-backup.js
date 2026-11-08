(function(global){
  'use strict';
  const TABLE='encrypted_workspace_backups';
  const encoder=new TextEncoder(),decoder=new TextDecoder();
  const ITERATIONS=310000,VERSION=1;
  function client(){const api=global.LifeFlowSupabase;const c=api&&api.getClient&&api.getClient();if(!c)throw new Error('Cloud connection is unavailable.');return c;}
  function bytesToBase64(bytes){let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));return btoa(binary);}
  function base64ToBytes(value){const binary=atob(value);return Uint8Array.from(binary,c=>c.charCodeAt(0));}
  function randomBytes(length){const bytes=new Uint8Array(length);crypto.getRandomValues(bytes);return bytes;}
  async function deriveKey(passphrase,salt){
    if(typeof passphrase!=='string'||passphrase.length<12)throw new Error('Use a backup passphrase with at least 12 characters.');
    const material=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function signedUser(){const {data,error}=await client().auth.getUser();if(error||!data.user)throw new Error('Sign in to your LifeFlow cloud account first.');return data.user;}
  function validateState(state){
    if(!state||typeof state!=='object'||Array.isArray(state))throw new Error('Workspace data is not available.');
    for(const key of ['tasks','notes','codeNotes','folders','noteLinks'])if(state[key]!==undefined&&!Array.isArray(state[key]))throw new Error('Workspace data failed validation. No backup was created.');
    return state;
  }
  async function createBackup(state,passphrase){
    const user=await signedUser();validateState(state);
    const payload=JSON.stringify({format:'lifeflow-encrypted-workspace',version:VERSION,createdAt:new Date().toISOString(),workspace:state});
    const plain=encoder.encode(payload),salt=randomBytes(16),nonce=randomBytes(12),key=await deriveKey(passphrase,salt);
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,plain);
    const envelope=JSON.stringify({kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:bytesToBase64(salt),data:bytesToBase64(new Uint8Array(encrypted))});
    const {data,error}=await client().from(TABLE).insert({
      user_id:user.id,device_id:crypto.randomUUID(),label:'LifeFlow workspace backup',
      ciphertext:envelope,nonce:bytesToBase64(nonce),encryption_version:VERSION,
      workspace_schema_version:Number(state.__lifeFlowSchemaVersion)||1,payload_bytes:plain.byteLength
    }).select('id,created_at,payload_bytes').single();
    if(error)throw new Error(error.message||'Encrypted backup upload failed.');
    return {ok:true,backup:data};
  }
  async function listBackups(){
    const user=await signedUser();
    const {data,error}=await client().from(TABLE).select('id,label,created_at,payload_bytes,encryption_version,workspace_schema_version').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20);
    if(error)throw new Error(error.message||'Could not load cloud backups.');
    return data||[];
  }
  async function decryptBackup(id,passphrase){
    const user=await signedUser();
    const {data,error}=await client().from(TABLE).select('id,ciphertext,nonce,created_at,payload_bytes,encryption_version,workspace_schema_version').eq('id',id).eq('user_id',user.id).single();
    if(error||!data)throw new Error('Backup could not be found in this cloud account.');
    if(Number(data.encryption_version)!==VERSION)throw new Error('This backup uses an unsupported encryption version.');
    let envelope;try{envelope=JSON.parse(data.ciphertext);}catch(_){throw new Error('Backup format is invalid.');}
    if(envelope.kdf!=='PBKDF2-SHA256'||!envelope.salt||!envelope.data)throw new Error('Backup encryption metadata is invalid.');
    const key=await deriveKey(passphrase,base64ToBytes(envelope.salt));
    let plain;try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(data.nonce)},key,base64ToBytes(envelope.data));}
    catch(_){throw new Error('Decryption failed. Check the backup passphrase. Your current workspace has not been changed.');}
    let decoded;try{decoded=JSON.parse(decoder.decode(plain));}catch(_){throw new Error('Decrypted backup content is invalid.');}
    if(decoded.format!=='lifeflow-encrypted-workspace'||!decoded.workspace)throw new Error('This is not a valid LifeFlow workspace backup.');
    validateState(decoded.workspace);
    return {id:data.id,createdAt:data.created_at,workspace:decoded.workspace};
  }
  global.LifeFlowCloudBackup=Object.freeze({createBackup,listBackups,decryptBackup});
})(window);
