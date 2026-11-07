(function(global){
'use strict';
const SESSION_TTL_MS=7*24*3600*1000;
const PBKDF2_ITERATIONS=100000;
const OAUTH_CONFIG={
  google:{clientId:'',authorizeUrl:'https://accounts.google.com/o/oauth2/v2/auth',tokenUrl:'https://oauth2.googleapis.com/token',scope:'openid email profile'},
  github:{clientId:'',authorizeUrl:'https://github.com/login/oauth/authorize',tokenUrl:'https://github.com/login/oauth/access_token',scope:'read:user user:email'},
  apple:{clientId:''}
};
let viewRenderers={};
function configureRenderers(renderers){viewRenderers={...(renderers||{})};}
function render(state,view){const renderer=viewRenderers[view];return typeof renderer==='function'?renderer(state||{}):'';}
function createAuthController(deps){
  const {
    getUsers,saveUsers,newUserRecord,loadForUser,saveWorkspaceState,setWorkspaceState,
    defaultProfileState,normalizeDemoProfile,enterApp,showStep,showAuthError,showOAuthNotice,
    readLoginGuard,updateLoginCaptcha,startLoginLockCountdown,failLogin,resetLoginGuard,
    setLoginLoading,setLoginError,getLoginAttemptsInProgress,setLoginAttemptsInProgress,
    getLoginCaptchaAnswer,setLoginCaptchaAnswer
  }=deps||{};
  let pendingVerify=null;

  function base64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function randomToken(nBytes){const bytes=new Uint8Array(nBytes||32);crypto.getRandomValues(bytes);return base64url(bytes);}
  async function sha256B64url(value){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return base64url(new Uint8Array(digest));}
  function timingSafeEqual(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
  async function hashPassword(password,saltB64,iterations){
    const salt=saltB64?Uint8Array.from(atob(saltB64),c=>c.charCodeAt(0)):crypto.getRandomValues(new Uint8Array(16));
    const iter=iterations||PBKDF2_ITERATIONS;
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:iter},key,256);
    return 'pbkdf2-sha256$'+iter+'$'+btoa(String.fromCharCode(...salt))+'$'+btoa(String.fromCharCode(...new Uint8Array(bits)));
  }
  async function verifyPassword(password,user){
    const stored=user&&user.passwordHash;if(!stored)return false;
    const [,iter,salt]=stored.split('$');
    return timingSafeEqual(await hashPassword(password,salt,+iter),stored);
  }
  function getSession(){
    try{
      const s=JSON.parse(sessionStorage.getItem('lifeflow2_session')||'null');
      if(s&&s.token&&s.email&&s.expiresAt&&Date.now()<s.expiresAt){
        s.expiresAt=Date.now()+SESSION_TTL_MS;
        sessionStorage.setItem('lifeflow2_session',JSON.stringify(s));
        return s;
      }
    }catch(_){}
    return null;
  }
  function createSession(email,remember=true){
    normalizeDemoProfile(email);
    const duration=remember?SESSION_TTL_MS:8*3600*1000;
    const session={token:randomToken(32),email,createdAt:Date.now(),expiresAt:Date.now()+duration};
    try{localStorage.removeItem('lifeflow2_session');}catch(_){}
    sessionStorage.setItem('lifeflow2_session',JSON.stringify(session));
    setWorkspaceState(Object.assign(loadForUser(email),{currentUser:email}));
    saveWorkspaceState();
    return session;
  }
  function destroySession(){
    sessionStorage.removeItem('lifeflow2_session');
    try{localStorage.removeItem('lifeflow2_session');}catch(_){}
    setWorkspaceState(defaultProfileState(null));
  }
  function doLogout(){destroySession();}
  function redirectUri(){return location.href.split(/[?#]/)[0];}

  function renderOAuthButtons(){
    const marks={
      Google:'<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.8 27.7a12 12 0 0 1 0-7.4V15H5.9a20 20 0 0 0 0 18Z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.9 29.5 4 24 4A20 20 0 0 0 5.9 15l6.9 5.3c1.6-4.7 6-8.2 11.2-8.2Z"/></svg>',
      Apple:'<svg viewBox="0 0 384 512" aria-hidden="true"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.9 20.7-15.4 0-49.7-19.7-76.7-19.7C62.6 141.2 0 184.8 0 273.5c0 26.2 4.8 53.3 14.4 81.1 12.8 36.7 59 126.6 107.2 125.1 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.4 102.6-119.2-65.1-30.7-57.7-89.9-57.7-91.8ZM262.5 104.5C289.9 72 287.4 42.4 286.6 32c-24.2 1.4-52.2 16.5-68.1 35-17.5 19.8-27.8 44.3-25.6 72 26.1 2 50-11.4 69.6-34.5Z"/></svg>'
    };
    const host=document.getElementById('oauthRow');if(!host)return;
    host.innerHTML=['Google','Apple'].map(provider=>{
      const configured=!!(OAUTH_CONFIG[provider.toLowerCase()]&&OAUTH_CONFIG[provider.toLowerCase()].clientId);
      return '<button type="button" class="oauth-provider oauth-'+provider.toLowerCase()+'" data-auth-action="oauth" data-auth-provider="'+provider.toLowerCase()+'" aria-label="Continue with '+provider+(configured?'':' (local demo mode)')+'"><span class="oauth-mark" aria-hidden="true">'+marks[provider]+'</span><span>'+provider+(configured?'':' · Demo')+'</span></button>';
    }).join('');
  }
  async function doSignup(){
    const email=document.getElementById('signupEmail').value.trim().toLowerCase();
    const password=document.getElementById('signupPass').value;
    const name=document.getElementById('signupName').value.trim()||email.split('@')[0];
    const bio=document.getElementById('signupBio').value.trim();
    const workspace=document.getElementById('signupWorkspace').value.trim()||'My Workspace';
    const error=document.getElementById('signupError');
    try{
      if(!email||!email.includes('@')||!email.includes('.'))throw new Error('Enter a valid email address.');
      if(password.length<8)throw new Error('Password must be at least 8 characters.');
      const users=getUsers();if(users[email])throw new Error('That email already has an account. Log in instead, or use Forgot password.');
      if(!global.crypto||!crypto.subtle)throw new Error('Secure password hashing is unavailable here. Open LifeFlow from its HTTPS GitHub Pages address or from http://localhost.');
      const passwordHash=await hashPassword(password);
      users[email]=newUserRecord(email,{passwordHash,name,bio,workspace});saveUsers(users);
      const saved=getUsers();
      if(!saved[email]||saved[email].passwordHash!==passwordHash)throw new Error('Your browser blocked LifeFlow from saving the new account. Check browser storage/site permissions and try again.');
      pendingVerify={email,token:randomToken(12),expiresAt:Date.now()+15*60*1000};
      document.getElementById('verifyEmailLabel').textContent=email;
      document.getElementById('verifyTokenDisplay').textContent='Simulated activation token (expires in 15 min): '+pendingVerify.token;
      showStep('stepVerify');
    }catch(err){
      if(error){error.textContent=err&&err.message?err.message:'Could not create the account. Please try again.';error.hidden=false;}
      else alert(err&&err.message?err.message:'Could not create the account. Please try again.');
    }
  }
  function doVerify(){
    if(pendingVerify&&Date.now()<pendingVerify.expiresAt){
      const users=getUsers();
      if(pendingVerify.email&&users[pendingVerify.email]){users[pendingVerify.email].verified=true;saveUsers(users);}
      document.getElementById('loginEmail').value=pendingVerify.email||'';
    }
    document.getElementById('loginPass').value='';
    pendingVerify=null;
    showStep('stepLogin');
  }
  function demoOAuthLogin(provider){
    const email='demo_'+provider.toLowerCase()+'@lifeflow.local';
    const users=getUsers();
    if(!users[email])users[email]=newUserRecord(email,{name:'Demo '+provider+' User',workspace:'Demo Workspace',verified:true});
    users[email].tier='Free';users[email].colorTheme='platinum';users[email].connected[provider]=true;saveUsers(users);
    createSession(email);enterApp();
    const notice=document.createElement('div');notice.className='notice';
    notice.textContent='Demo mode: no real '+provider+' client ID is configured, so a local demo account was created without contacting '+provider+'.';
    document.getElementById('main').prepend(notice);
  }
  async function oauthLogin(provider){
    const cfg=OAUTH_CONFIG[provider.toLowerCase()];
    if(!cfg||!cfg.clientId){demoOAuthLogin(provider);return;}
    if(provider.toLowerCase()==='apple'&&!cfg.authorizeUrl){
      showOAuthNotice('Apple Sign in is visible, but this project still needs an Apple Services ID, redirect URI and server-side token validation before real sign-in can be enabled.');return;
    }
    const stateParam=randomToken(16),nonce=randomToken(16),verifier=randomToken(48);
    const challenge=await sha256B64url(verifier);
    sessionStorage.setItem('lifeflow2_oauth',JSON.stringify({provider:provider.toLowerCase(),state:stateParam,nonce,verifier,createdAt:Date.now()}));
    const params=new URLSearchParams({client_id:cfg.clientId,redirect_uri:redirectUri(),response_type:'code',scope:cfg.scope,state:stateParam,nonce,code_challenge:challenge,code_challenge_method:'S256'});
    location.href=cfg.authorizeUrl+'?'+params.toString();
  }
  async function handleOAuthCallback(){
    const params=new URLSearchParams(location.search),code=params.get('code');if(!code)return;
    const returnedState=params.get('state');history.replaceState(null,'',location.pathname);
    let pending=null;try{pending=JSON.parse(sessionStorage.getItem('lifeflow2_oauth'));}catch(_){}
    sessionStorage.removeItem('lifeflow2_oauth');
    const fail=message=>showOAuthNotice('OAuth sign-in failed: '+message);
    if(!pending||pending.state!==returnedState)return fail('state mismatch or expired attempt.');
    if(Date.now()-pending.createdAt>10*60*1000)return fail('sign-in attempt expired.');
    const cfg=OAUTH_CONFIG[pending.provider];if(!cfg)return fail('provider configuration is missing.');
    let tokens;
    try{
      const response=await fetch(cfg.tokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams({
        grant_type:'authorization_code',code,redirect_uri:redirectUri(),client_id:cfg.clientId,code_verifier:pending.verifier
      })});
      if(!response.ok)return fail('token exchange was rejected ('+response.status+').');
      tokens=await response.json();
    }catch(_){return fail('could not reach the provider.');}
    let profile=null;
    try{
      if(pending.provider==='google'){
        const payload=JSON.parse(atob(tokens.id_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
        const issuerValid=payload.iss==='https://accounts.google.com'||payload.iss==='accounts.google.com';
        if(!issuerValid||payload.aud!==cfg.clientId||payload.nonce!==pending.nonce||Date.now()/1000>payload.exp)return fail('ID token claims did not validate.');
        profile={email:payload.email,name:payload.name,avatar:payload.picture};
      }else{
        const response=await fetch('https://api.github.com/user',{headers:{Authorization:'Bearer '+tokens.access_token,Accept:'application/vnd.github+json'}});
        const data=await response.json();profile={email:data.email,name:data.name||data.login,avatar:data.avatar_url};
        if(!profile.email){
          const emailResponse=await fetch('https://api.github.com/user/emails',{headers:{Authorization:'Bearer '+tokens.access_token,Accept:'application/vnd.github+json'}});
          const list=await emailResponse.json();
          const primary=(list||[]).find(item=>item.primary&&item.verified)||(list||[])[0];
          if(primary)profile.email=primary.email;
        }
        if(!profile.email)return fail('no verified email on the GitHub account.');
      }
    }catch(_){return fail('could not fetch your profile.');}
    const email=profile.email.trim().toLowerCase();
    const providerName={google:'Google',github:'GitHub',apple:'Apple'}[pending.provider]||pending.provider;
    const users=getUsers();
    if(!users[email])users[email]=newUserRecord(email,{name:profile.name||email.split('@')[0],avatar:profile.avatar||null,verified:true,oauthProvider:providerName});
    users[email].connected[providerName]=true;saveUsers(users);
    createSession(email);enterApp();
  }
  async function doLogin(){
    if(getLoginAttemptsInProgress())return;
    const emailInput=document.getElementById('loginEmail'),passwordInput=document.getElementById('loginPass');
    const identifier=emailInput.value.trim().toLowerCase(),password=passwordInput.value;
    setLoginError('');
    if(!identifier){setLoginError('Enter your email address.','loginEmail');emailInput.focus();return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(identifier)){setLoginError('Enter a valid email address.','loginEmail');emailInput.focus();return;}
    if(!password){setLoginError('Enter your password.','loginPass');passwordInput.focus();return;}
    const guard=readLoginGuard();
    if(guard.lockUntil&&Date.now()<guard.lockUntil){
      startLoginLockCountdown();setLoginError('Too many attempts. Try again in '+Math.ceil((guard.lockUntil-Date.now())/1000)+' seconds.');return;
    }
    if((guard.failures||0)>=4){
      const answer=document.getElementById('captchaAnswer').value.trim();
      if(!answer){setLoginError('Complete the quick verification before signing in.','captchaAnswer');return;}
      if(answer!==getLoginCaptchaAnswer()){
        setLoginCaptchaAnswer(null);updateLoginCaptcha();setLoginError('Verification answer was incorrect. Try the new check.','captchaAnswer');return;
      }
    }
    setLoginAttemptsInProgress(true);setLoginLoading(true);
    try{
      await new Promise(resolve=>setTimeout(resolve,250));
      const users=getUsers(),user=users[identifier],email=identifier;
      if(!user){failLogin();return;}
      if(!user.passwordHash&&typeof user.password==='string'){
        if(user.password!==password){failLogin();return;}
        user.passwordHash=await hashPassword(password);delete user.password;saveUsers(users);
      }
      if(!user.passwordHash){failLogin();return;}
      if(!(await verifyPassword(password,user))){failLogin();return;}
      if(user.deletedAt){failLogin();return;}
      if(!user.verified){
        pendingVerify={email,token:randomToken(12),expiresAt:Date.now()+15*60*1000};
        document.getElementById('verifyEmailLabel').textContent=email;
        document.getElementById('verifyTokenDisplay').textContent='Account not verified yet — click below to simulate verifying.';
        showStep('stepVerify');return;
      }
      resetLoginGuard();createSession(email,document.getElementById('rememberMe').checked);enterApp();
    }catch(_){setLoginError('Sign-in could not be completed. Please try again.');}
    finally{setLoginAttemptsInProgress(false);setLoginLoading(false);}
  }

  // Expose session metadata to the UI, never the bearer token itself.
  function getPublicSession(){
    const session=getSession();
    if(!session)return null;
    return {email:session.email,createdAt:session.createdAt,expiresAt:session.expiresAt};
  }
  return {
    base64url,randomToken,sha256B64url,timingSafeEqual,hashPassword,verifyPassword,
    getSession:getPublicSession,createSession,destroySession,doLogout,doSignup,doVerify,
    renderOAuthButtons,oauthLogin,demoOAuthLogin,handleOAuthCallback,doLogin
  };
}
global.LifeFlowAuthModule={createAuthController,configureRenderers,render};
})(window);
