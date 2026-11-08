const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness({aal='aal1',factor=true,failVerify=false}={}) {
  const calls=[];
  const user={id:'cloud-user',email:'cloud@example.test',user_metadata:{display_name:'Cloud User'}};
  const auth={
    signUp:async args=>({data:{user,session:null},error:null}),
    signInWithPassword:async args=>({data:{user,session:{user}},error:null}),
    resetPasswordForEmail:async(...args)=>({data:{},error:null}),
    resend:async(...args)=>({data:{},error:null}),
    updateUser:async(...args)=>({data:{user},error:null}),
    signOut:async(...args)=>({data:{},error:null}),
    getSession:async()=>({data:{session:null},error:null}),
    getUser:async()=>({data:{user},error:null}),
    onAuthStateChange:callback=>({data:{subscription:{unsubscribe(){}}}}),
    mfa:{
      getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal,nextLevel:factor?'aal2':'aal1'},error:null}),
      listFactors:async()=>({data:{all:factor?[{id:'factor-1',status:'verified',factor_type:'totp'}]:[],totp:factor?[{id:'factor-1',status:'verified'}]:[]},error:null}),
      enroll:async()=>({data:{id:'pending-1',type:'totp',totp:{qr_code:'data:image/svg+xml;base64,abc',secret:'secret',uri:'otpauth://test'}},error:null}),
      challenge:async()=>({data:{id:'challenge-1'},error:null}),
      verify:async args=>{calls.push(['verify',args]);return {data:{},error:failVerify?{message:'bad code'}:null};},
      unenroll:async args=>{calls.push(['unenroll',args]);return {data:{},error:null};}
    }
  };
  const client={auth,from(table){return {upsert:async(...args)=>({data:null,error:null})};}};
  const context={window:null,location:{origin:'https://example.test',pathname:'/workspace.html'},LifeFlowSupabase:{getClient:()=>client}};
  context.window=context;
  vm.runInNewContext(fs.readFileSync('Updated/supabase-auth.js','utf8'),context,{filename:'supabase-auth.js'});
  return {api:context.LifeFlowCloudAuth,calls};
}

test('cloud registration requires an eight-character password and requests email confirmation',async()=>{
  const h=harness();
  assert.equal((await h.api.signUp({email:'a@b.test',password:'short'})).ok,false);
  const result=await h.api.signUp({email:'a@b.test',password:'long-enough-password',displayName:'A'});
  assert.equal(result.ok,true);assert.equal(result.needsEmailConfirmation,true);
});
test('password sign-in signals an authenticator challenge when AAL2 is required',async()=>{
  const h=harness({aal:'aal1',factor:true});
  const result=await h.api.signIn({email:'a@b.test',password:'long-enough-password'});
  assert.equal(result.ok,true);assert.equal(result.requiresMfa,true);assert.equal(result.factorId,'factor-1');
});
test('sign-in does not request MFA when no verified factor is enrolled',async()=>{
  const h=harness({aal:'aal1',factor:false});
  const result=await h.api.signIn({email:'a@b.test',password:'long-enough-password'});
  assert.equal(result.ok,true);assert.equal(result.requiresMfa,false);
});
test('MFA verification uses a provider challenge and six-digit code',async()=>{
  const h=harness();
  assert.equal((await h.api.verifyAuthenticator('factor-1','123')).ok,false);
  assert.equal((await h.api.verifyAuthenticator('factor-1','123456')).ok,true);
  assert.equal(h.calls[0][0],'verify');
});
test('factor removal requires successful code verification before unenrolling',async()=>{
  const h=harness();
  assert.equal((await h.api.removeAuthenticator('factor-1')).ok,false);
  assert.equal((await h.api.removeAuthenticator('factor-1','123456')).ok,true);
  assert.equal(h.calls[0][0],'verify');assert.equal(h.calls[1][0],'unenroll');
});
test('failed MFA verification never removes the factor',async()=>{
  const h=harness({failVerify:true});
  const result=await h.api.removeAuthenticator('factor-1','123456');
  assert.equal(result.ok,false);assert.equal(h.calls.some(call=>call[0]==='unenroll'),false);
});
test('password reset, confirmation resend and password update use provider auth',async()=>{
  const h=harness();
  assert.equal((await h.api.requestPasswordReset('a@b.test')).ok,true);
  assert.equal((await h.api.resendConfirmation('a@b.test')).ok,true);
  assert.equal((await h.api.completePasswordRecovery('long-enough-password')).ok,true);
});
