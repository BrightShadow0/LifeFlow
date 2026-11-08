/* LifeFlow Release 9 · encrypted cloud backup engine
 * Client-side authenticated encryption. Supabase receives ciphertext only.
 * Passphrases are user-held: losing one makes that backup unrecoverable.
 */
(function(global){
  'use strict';
  const TABLE='encrypted_workspace_backups';
  const FORMAT='lifeflow-encrypted-workspace';
  const VERSION=2;
  const KDF='PBKDF2-SHA256';
  const ITERATIONS=600000;
  const MAX_BACKUP_BYTES=25*1024*1024;
  const encoder=new TextEncoder();
  const decoder=new TextDecoder('utf-8',{fatal:true});
  function getClient(){
    const api=global.LifeFlowSupabase;
    const value=api&&api.getClient&&api.getClient();
    if(!value)throw new Error('Cloud connection is unavailable.');
    if(!global.crypto?.subtle)throw new Error('This browser does not support secure backup encryption.');
    return value;
  }
  function toBase64(bytes){
    let binary='';const chunk=0x8000;
    for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
    return btoa(binary);
  }
  function fromBase64(value){
    if(typeof value!=='string'||!value||value.length>MAX_BACKUP_BYTES*2)throw new Error('Backup encoding is invalid.');
    let binary;try{binary=atob(value);}catch(_){throw new Error('Backup encoding is invalid.');}
    return Uint8Array.from(binary,char=>char.charCodeAt(0));
  }
  function randomBytes(length){const bytes=new Uint8Array(length);crypto.getRandomValues(bytes);return bytes;}
  function validatePassphrase(value){
    if(typeof value!=='string'||value.length<12||value.length>1024)throw new Error('Use a backup passphrase between 12 and 1,024 characters.');
    if(!/\S/.test(value))throw new Error('The backup passphrase cannot contain only spaces.');
    return value;
  }
  async function deriveKey(passphrase,salt){
    const material=await crypto.subtle.importKey('raw',encoder.encode(validatePassphrase(passphrase)),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function signedUser(){
    const {data,error}=await getClient().auth.getUser();
    if(error||!data?.user)throw new Error('Sign in to your LifeFlow cloud account first.');
    return data.user;
  }
  function validateWorkspace(state){
    if(!state||typeof state!=='object'||Array.isArray(state))throw new Error('Workspace data is not available.');
    for(const key of ['tasks','notes','codeNotes','folders','noteLinks']){
      if(state[key]!==undefined&&!Array.isArray(state[key]))throw new Error('Workspace validation failed for '+key+'. No backup was created.');
    }
    let serialized;
    try{serialized=JSON.stringify(state);}catch(_){throw new Error('Workspace contains data that cannot be backed up.');}
    if(typeof serialized!=='string')throw new Error('Workspace is empty or invalid.');
    const bytes=encoder.encode(serialized);
    if(bytes.byteLength>MAX_BACKUP_BYTES)throw new Error('Workspace backup exceeds the 25 MB safety limit.');
    return {serialized,bytes};
  }
  function aad(userId,schemaVersion){
    return encoder.encode([FORMAT,VERSION,userId,String(schemaVersion)].join('|'));
  }
  async function createBackup(state,passphrase){
    const user=await signedUser();
    const validated=validateWorkspace(state);
    const schemaVersion=Number(state.__lifeFlowSchemaVersion)||1;
    const salt=randomBytes(16),nonce=randomBytes(12),key=await deriveKey(passphrase,salt);
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,additionalData:aad(user.id,schemaVersion),tagLength:128},key,validated.bytes);
    const envelope=JSON.stringify({format:FORMAT,version:VERSION,kdf:KDF,iterations:ITERATIONS,salt:toBase64(salt),ciphertext:toBase64(new Uint8Array(encrypted))});
    const {data,error}=await getClient().from(TABLE).insert({
      user_id:user.id,device_id:crypto.randomUUID(),label:'LifeFlow workspace backup',
      ciphertext:envelope,nonce:toBase64(nonce),encryption_version:VERSION,
      workspace_schema_version:schemaVersion,payload_bytes:validated.bytes.byteLength
    }).select('id,created_at,payload_bytes,encryption_version,workspace_schema_version').single();
    if(error)throw new Error(error.message||'Encrypted backup upload failed.');
    return {ok:true,backup:data,account:user.email||user.id};
  }
  async function listBackups(){
    const user=await signedUser();
    const {data,error}=await getClient().from(TABLE).select('id,label,created_at,payload_bytes,encryption_version,workspace_schema_version').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);
    if(error)throw new Error(error.message||'Could not load cloud backups.');
    return {account:user.email||user.id,backups:data||[]};
  }
  async function decryptBackup(id,passphrase){
    if(typeof id!=='string'||!id||id.length>100)throw new Error('Backup identifier is invalid.');
    const user=await signedUser();
    const {data,error}=await getClient().from(TABLE).select('id,ciphertext,nonce,created_at,payload_bytes,encryption_version,workspace_schema_version').eq('id',id).eq('user_id',user.id).single();
    if(error||!data)throw new Error('Backup could not be found in this cloud account.');
    if(Number(data.encryption_version)!==VERSION)throw new Error('This backup uses an unsupported encryption version.');
    let envelope;try{envelope=JSON.parse(data.ciphertext);}catch(_){throw new Error('Backup format is invalid.');}
    if(envelope.format!==FORMAT||envelope.version!==VERSION||envelope.kdf!==KDF||envelope.iterations!==ITERATIONS)throw new Error('Backup encryption metadata is invalid or unsupported.');
    const salt=fromBase64(envelope.salt),nonce=fromBase64(data.nonce),ciphertext=fromBase64(envelope.ciphertext);
    if(salt.length!==16||nonce.length!==12||ciphertext.length<17||ciphertext.length>MAX_BACKUP_BYTES+16)throw new Error('Backup integrity metadata is invalid.');
    const schemaVersion=Number(data.workspace_schema_version);
    if(!Number.isSafeInteger(schemaVersion)||schemaVersion<1)throw new Error('Backup schema version is invalid.');
    const key=await deriveKey(passphrase,salt);
    let plain;
    try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce,additionalData:aad(user.id,schemaVersion),tagLength:128},key,ciphertext);}
    catch(_){throw new Error('Decryption or integrity verification failed. Check the passphrase. Your current workspace has not been changed.');}
    if(plain.byteLength!==Number(data.payload_bytes))throw new Error('Backup size verification failed. No data was restored.');
    let workspace;
    try{workspace=JSON.parse(decoder.decode(plain));}catch(_){throw new Error('Decrypted backup content is not valid UTF-8 JSON.');}
    validateWorkspace(workspace);
    return {id:data.id,createdAt:data.created_at,workspace,account:user.email||user.id,verified:true};
  }
  async function deleteBackup(id){
    if(typeof id!=='string'||!id)throw new Error('Backup identifier is invalid.');
    const user=await signedUser();
    const {error}=await getClient().from(TABLE).delete().eq('id',id).eq('user_id',user.id);
    if(error)throw new Error(error.message||'Could not delete this backup.');
    return {ok:true};
  }
  global.LifeFlowCloudBackup=Object.freeze({createBackup,listBackups,decryptBackup,deleteBackup,version:VERSION});
})(window);
