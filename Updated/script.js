
const OAUTH_CONFIG = {
  google: {
    clientId: '',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  },
  github: {
    clientId: '',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
  },
  apple: { clientId: '' },
};
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const PBKDF2_ITERATIONS = 100000;

let state = load();
let view = 'today';
let calMonth = new Date().getMonth(), calYear = new Date().getFullYear();

function load(){
  try{ const r = localStorage.getItem('lifeflow2_state'); if(r) return JSON.parse(r); }catch(e){}
  return {tasks:[]};
}
function save(){ try{ localStorage.setItem('lifeflow2_state', JSON.stringify(state)); }catch(e){} }
window.addEventListener('storage', e=>{ if(e.key==='lifeflow2_state'){ state = load(); renderApp(); } });

function base64url(bytes){
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function randomToken(nBytes){
  const b = new Uint8Array(nBytes || 32);
  crypto.getRandomValues(b);
  return base64url(b);
}
async function sha256B64url(str){
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return base64url(new Uint8Array(digest));
}

function timingSafeEqual(a, b){
  if(a.length !== b.length) return false;
  let diff = 0;
  for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hashPassword(password, saltB64, iterations){
  const salt = saltB64
    ? Uint8Array.from(atob(saltB64), c=>c.charCodeAt(0))
    : crypto.getRandomValues(new Uint8Array(16));
  const iter = iterations || PBKDF2_ITERATIONS;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt, iterations:iter}, key, 256);
  return 'pbkdf2-sha256$' + iter + '$' + btoa(String.fromCharCode(...salt)) + '$' + btoa(String.fromCharCode(...new Uint8Array(bits)));
}
async function verifyPassword(password, u){
  const stored = u && u.passwordHash;
  if(!stored) return false;
  const [, iter, salt] = stored.split('$');
  const candidate = await hashPassword(password, salt, +iter);
  return timingSafeEqual(candidate, stored);
}

function getSession(){
  try{
    const s = JSON.parse(localStorage.getItem('lifeflow2_session'));
    if(s && s.token && s.email && s.expiresAt && Date.now() < s.expiresAt){
      s.expiresAt = Date.now() + SESSION_TTL_MS;
      localStorage.setItem('lifeflow2_session', JSON.stringify(s));
      return s;
    }
  }catch(e){}
  return null;
}
function createSession(email){
  const s = {token: randomToken(32), email, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS};
  localStorage.setItem('lifeflow2_session', JSON.stringify(s));
  state.currentUser = email; save();
  return s;
}
function destroySession(){ localStorage.removeItem('lifeflow2_session'); state.currentUser = null; save(); }

setInterval(()=>{ if(!getSession() && document.getElementById('app').style.display==='block') doLogout(); }, 60000);

function showStep(id){
  document.querySelectorAll('.authstep').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const captions={stepLogin:['Welcome back.','Sign in to access your personal planning workspace.'],stepSignup1:['Create an account.','First, choose your email and password.'],stepSignup2:['Make it yours.','Add a name to your workspace.'],stepSignup3:['Your workspace.','One last step before you start planning.'],stepVerify:['Verify your account.','This activation is simulated in the browser.'],stepForgot:['Reset your password.','Enter the email you used to sign up.'],stepSent:['Reset link ready.','This simulated link expires in 15 minutes.'],stepReset:['New password.','Use at least eight characters.'],stepDone:['Password updated.','Return to sign in.']};
  const caption=captions[id]||captions.stepLogin;document.getElementById('authTitle').textContent=caption[0];document.getElementById('authSubtitle').textContent=caption[1];
  ['loginError','signupError','forgotError','resetError'].forEach(e=>{ const el=document.getElementById(e); if(el) el.style.display='none'; });
}
function showAuthError(id,msg){ const el=document.getElementById(id); el.textContent=msg; el.style.display='block'; }
function showOAuthNotice(msg){ const el=document.getElementById('oauthNotice'); el.textContent=msg; el.style.display='block'; }
function getUsers(){ try{ return JSON.parse(localStorage.getItem('lifeflow2_users')||'{}'); }catch(e){ return {}; } }
function saveUsers(u){ localStorage.setItem('lifeflow2_users', JSON.stringify(u)); }
function newUserRecord(email, extra){
  return Object.assign({
    passwordHash:null, name:email.split('@')[0], bio:'', avatar:null, theme:'dark',
    workspace:'My Workspace', timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
    language:'en', weekStart:'Sunday', tier:'Free',
    connected:{Google:false,Apple:false,GitHub:false},
    verified:false, deletedAt:null, oauthProvider:null,
  }, extra||{});
}

function validateSignup1(){
  const email = document.getElementById('signupEmail').value.trim().toLowerCase();
  const pass = document.getElementById('signupPass').value;
  const emailHint = document.getElementById('emailHint');
  const passHint = document.getElementById('passHint');
  const users = getUsers();
  let emailOk = false;
  if(!email){ emailHint.style.display='none'; }
  else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ emailHint.textContent='Invalid email format.'; emailHint.style.display='block'; }
  else if(users[email]){
    const ex = users[email];
    emailHint.textContent = ex.deletedAt
      ? 'That email belongs to an account scheduled for deletion. Log in to keep it, or reset all app data from the Danger Zone.'
      : 'That email already has an account. Log in instead, or use Forgot password on the login screen.';
    emailHint.style.display='block';
  }
  else{ emailHint.style.display='none'; emailOk = true; }

  let score = 0;
  if(pass.length>=8) score++;
  if(/[0-9]/.test(pass)) score++;
  if(/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
  if(/[^A-Za-z0-9]/.test(pass)) score++;
  const fill = document.getElementById('strengthFill');
  const pct = (score/4)*100;
  fill.style.width = pct+'%';
  fill.style.background = score<=1?'var(--danger)':score<=2?'var(--warn)':'var(--ok)';
  const passOk = pass.length>=8;
  if(pass && !passOk){ passHint.textContent='Password must be at least 8 characters.'; passHint.style.display='block'; }
  else{ passHint.style.display='none'; }

  document.getElementById('s1Next').disabled = !(emailOk && passOk);
}
function startSignup(){
  ['signupEmail','signupPass','signupName','signupBio','signupWorkspace'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });
  showStep('stepSignup1');
  validateSignup1();
}

async function doSignup(){
  const email=document.getElementById('signupEmail').value.trim().toLowerCase();
  const pass=document.getElementById('signupPass').value;
  const name=document.getElementById('signupName').value.trim() || email.split('@')[0];
  const bio=document.getElementById('signupBio').value.trim();
  const workspace=document.getElementById('signupWorkspace').value.trim() || 'My Workspace';
  const error=document.getElementById('signupError');
  try{
    if(!email || !email.includes('@') || !email.includes('.')) throw new Error('Enter a valid email address.');
    if(pass.length<8) throw new Error('Password must be at least 8 characters.');
    const users=getUsers();
    if(users[email]) throw new Error('That email already has an account. Log in instead, or use Forgot password.');
    if(!window.crypto || !crypto.subtle) throw new Error('Secure password hashing is unavailable here. Open LifeFlow from its HTTPS GitHub Pages address or from http://localhost.');
    const passwordHash=await hashPassword(pass);
    users[email]=newUserRecord(email,{passwordHash,name,bio,workspace});
    saveUsers(users);
    const savedUsers=getUsers();
    if(!savedUsers[email] || savedUsers[email].passwordHash!==passwordHash) throw new Error('Your browser blocked LifeFlow from saving the new account. Check browser storage/site permissions and try again.');
    pendingVerify={email,token:randomToken(12),expiresAt:Date.now()+15*60*1000};
    document.getElementById('verifyEmailLabel').textContent=email;
    document.getElementById('verifyTokenDisplay').textContent='Simulated activation token (expires in 15 min): '+pendingVerify.token;
    showStep('stepVerify');
  }catch(err){
    if(error){
      error.textContent=err && err.message ? err.message : 'Could not create the account. Please try again.';
      error.style.display='block';
    }else{
      alert(err && err.message ? err.message : 'Could not create the account. Please try again.');
    }
  }
}
let pendingVerify=null;
function doVerify(){
  if(pendingVerify && Date.now() < pendingVerify.expiresAt){
    const users = getUsers();
    if(pendingVerify.email && users[pendingVerify.email]){ users[pendingVerify.email].verified = true; saveUsers(users); }
    document.getElementById('loginEmail').value = pendingVerify.email || '';
  }
  document.getElementById('loginPass').value = '';
  pendingVerify=null;
  showStep('stepLogin');
}

function redirectUri(){ return location.href.split(/[?#]/)[0]; }
function renderOAuthButtons(){
  document.getElementById('oauthRow').innerHTML = ['Google','Apple','GitHub'].map(p=>{
    const configured = !!(OAUTH_CONFIG[p.toLowerCase()] && OAUTH_CONFIG[p.toLowerCase()].clientId);
    return `<button onclick="oauthLogin('${p}')">${p}${configured?'':' (demo)'}</button>`;
  }).join('');
}
async function oauthLogin(provider){
  const cfg = OAUTH_CONFIG[provider.toLowerCase()];
  if(!cfg || !cfg.clientId){ demoOAuthLogin(provider); return; }
  const stateParam = randomToken(16);
  const nonce = randomToken(16);
  const verifier = randomToken(48);
  const challenge = await sha256B64url(verifier);
  sessionStorage.setItem('lifeflow2_oauth', JSON.stringify({
    provider: provider.toLowerCase(), state: stateParam, nonce, verifier, createdAt: Date.now()
  }));
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: cfg.scope,
    state: stateParam,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  location.href = cfg.authorizeUrl + '?' + params.toString();
}

function demoOAuthLogin(provider){
  const email = 'demo_'+provider.toLowerCase()+'@lifeflow.local';
  const users = getUsers();
  if(!users[email]) users[email] = newUserRecord(email, {name:'Demo '+provider+' User', workspace:'Demo Workspace', verified:true});
  users[email].connected[provider] = true;
  saveUsers(users);
  createSession(email);
  enterApp();

  const n = document.createElement('div');
  n.className = 'notice';
  n.textContent = 'Demo mode: no real '+provider+' client ID is configured, so a local demo account was created without contacting '+provider+'.';
  document.getElementById('main').prepend(n);
}

async function handleOAuthCallback(){
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if(!code) return;
  const returnedState = params.get('state');
  history.replaceState(null, '', location.pathname);
  let pending = null;
  try{ pending = JSON.parse(sessionStorage.getItem('lifeflow2_oauth')); }catch(e){}
  sessionStorage.removeItem('lifeflow2_oauth');
  const fail = msg => showOAuthNotice('OAuth sign-in failed: '+msg);

  if(!pending || pending.state !== returnedState) return fail('state mismatch or expired attempt.');
  if(Date.now() - pending.createdAt > 10*60*1000) return fail('sign-in attempt expired.');
  const cfg = OAUTH_CONFIG[pending.provider];
  let tokens;
  try{
    const resp = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded', 'Accept':'application/json'},
      body: new URLSearchParams({
        grant_type: 'authorization_code', code,
        redirect_uri: redirectUri(), client_id: cfg.clientId,
        code_verifier: pending.verifier,
      }),
    });
    if(!resp.ok) return fail('token exchange was rejected ('+resp.status+').');
    tokens = await resp.json();
  }catch(e){ return fail('could not reach the provider.'); }

  let profile = null;
  try{
    if(pending.provider === 'google'){

      const payload = JSON.parse(atob(tokens.id_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      const issOk = payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com';
      if(!issOk || payload.aud !== cfg.clientId || payload.nonce !== pending.nonce || Date.now()/1000 > payload.exp)
        return fail('ID token claims did not validate.');
      profile = {email: payload.email, name: payload.name, avatar: payload.picture};
    }else{
      const ui = await fetch('https://api.github.com/user', {headers:{Authorization:'Bearer '+tokens.access_token, Accept:'application/vnd.github+json'}});
      const data = await ui.json();
      profile = {email: data.email, name: data.name || data.login, avatar: data.avatar_url};
      if(!profile.email){
        const em = await fetch('https://api.github.com/user/emails', {headers:{Authorization:'Bearer '+tokens.access_token, Accept:'application/vnd.github+json'}});
        const list = await em.json();
        const primary = (list||[]).find(e=>e.primary && e.verified) || (list||[])[0];
        if(primary) profile.email = primary.email;
      }
      if(!profile.email) return fail('no verified email on the GitHub account.');
    }
  }catch(e){ return fail('could not fetch your profile.'); }

  const email = profile.email.trim().toLowerCase();
  const providerName = {google:'Google', github:'GitHub', apple:'Apple'}[pending.provider] || pending.provider;
  const users = getUsers();
  if(!users[email]) users[email] = newUserRecord(email, {name: profile.name || email.split('@')[0], avatar: profile.avatar || null, verified:true, oauthProvider: providerName});
  users[email].connected[providerName] = true;
  saveUsers(users);
  createSession(email);
  enterApp();
}

async function doLogin(){
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value;
  const users = getUsers();
  const u = users[email];

  if(!u){ showAuthError('loginError','No account exists for that email here. Accounts are stored per browser and per web address (localhost vs file:// vs a different port each have separate storage) - sign up here, or go back to the address where you created it.'); return; }

  if(!u.passwordHash && typeof u.password === 'string'){
    if(u.password !== pass){ showAuthError('loginError','Wrong password for this account. Try again or use Forgot password.'); return; }
    u.passwordHash = await hashPassword(pass);
    delete u.password;
    saveUsers(users);
  }
  if(!u.passwordHash){ showAuthError('loginError','This account signs in with '+(u.oauthProvider||'an identity provider')+'. Use that button instead of a password.'); return; }
  if(!(await verifyPassword(pass, u))){ showAuthError('loginError','Wrong password for this account. Try again or use Forgot password.'); return; }
  if(u.deletedAt){ showAuthError('loginError','This account is scheduled for deletion and can no longer be accessed.'); return; }
  if(!u.verified){ pendingVerify = {email, token: randomToken(12), expiresAt: Date.now() + 15*60*1000}; document.getElementById('verifyEmailLabel').textContent=email; document.getElementById('verifyTokenDisplay').textContent='Account not verified yet — click below to simulate verifying.'; showStep('stepVerify'); return; }
  createSession(email);
  enterApp();
}
function enterApp(){
  document.getElementById('authScreen').style.display='none';
  document.getElementById('app').style.display='block';
  window.lifeFlowLoginEntry=true;
  renderApp();
}
function doLogout(){
  destroySession();
  document.getElementById('app').style.display='none';
  document.getElementById('authScreen').style.display='block';
  document.getElementById('oauthNotice').style.display='none';
  showStep('stepLogin');
}
let pendingReset=null;
function sendReset(){
  const email = document.getElementById('forgotEmail').value.trim().toLowerCase();
  const users = getUsers();
  if(!users[email]){ showAuthError('forgotError','No account found for that email.'); return; }

  pendingReset = {email, token: randomToken(16), expiresAt: Date.now() + 15*60*1000};
  document.getElementById('tokenDisplay').textContent = 'Simulated email link token (expires in 15 min): '+pendingReset.token;
  showStep('stepSent');
}
async function doReset(){
  const pass = document.getElementById('newPass').value;
  if(!pass || !pendingReset) return;
  if(Date.now() > pendingReset.expiresAt){ showAuthError('resetError','That reset link has expired. Request a new one.'); return; }
  if(pass.length < 8){ showAuthError('resetError','Password must be at least 8 characters.'); return; }
  const users = getUsers();
  users[pendingReset.email].passwordHash = await hashPassword(pass);
  saveUsers(users);
  pendingReset = null;
  showStep('stepDone');
}
function currentUser(){ const users=getUsers(); return users[state.currentUser]; }
function applyTheme(theme){
  const allowed=['dark','light','forest','paper'];
  const actual=allowed.includes(theme)?theme:'dark';
  document.documentElement.setAttribute('data-theme',actual);
  const color=currentUser()?.colorTheme||'sapphire';
  document.documentElement.setAttribute('data-color-theme',['sapphire','emerald','gold','platinum','amethyst','ruby'].includes(color)?color:'sapphire');
  document.documentElement.style.setProperty('--lf-theme-transition','1');
}
function setTheme(theme){
  const u=currentUser();
  const next=['dark','light','forest','paper'].includes(theme)?theme:'dark';
  if(u) updateUser(user=>user.theme=next); else applyTheme(next);
  if(document.getElementById('app')?.style.display==='block') renderApp();
}
function setColorTheme(theme){
  const allowed=['sapphire','emerald','gold','platinum','amethyst','ruby'];
  const next=allowed.includes(theme)?theme:'life';
  const u=currentUser();
  if(u) updateUser(user=>user.colorTheme=next); else document.documentElement.setAttribute('data-color-theme',next);
}
function ambientSettings(u){
  return Object.assign({ambientMode:true,ambientIntensity:'medium'},u?.ambient||{});
}
function applyAmbientEnvironment(){
  const u=currentUser(); if(!u)return;
  const settings=ambientSettings(u);
  const tasks=state.tasks||[];
  const active=tasks.filter(t=>!t.done).length;
  const overdue=tasks.filter(t=>t.due && new Date(t.due)<new Date() && !t.done).length;
  const today=new Date();
  const hour=today.getHours()+today.getMinutes()/60;
  const timeState=hour<7?'dawn':hour<12?'morning':hour<17?'afternoon':hour<21?'evening':'night';
  const load=Math.min(1,(active/12)+(overdue/8));
  const level=overdue>=3||active>=8?'high':overdue>=1||active>=4?'medium':'calm';
  const intensity=settings.ambientMode?({low:.45,medium:.75,high:1}[settings.ambientIntensity==='low'?'low':settings.ambientIntensity==='high'?'high':'medium']):0;
  const root=document.documentElement;
  root.setAttribute('data-ambient',settings.ambientMode?'on':'off');
  root.setAttribute('data-load',level);
  root.setAttribute('data-time',timeState);
  root.style.setProperty('--lf-load',String(load));
  root.style.setProperty('--lf-ambient-intensity',String(intensity));
}
function themeLabel(theme){ return ({dark:'Deep Night',light:'Clean Light',forest:'Quiet Forest',paper:'Warm Paper'})[theme]||'Deep Night'; }
function getAuthTheme(){ return localStorage.getItem('lifeflow2_auth_theme') || 'dark'; }
function systemTheme(){ return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
function applyAuthTheme(mode){
  const actual=mode==='auto' ? systemTheme() : mode;
  applyTheme(actual);
  const auto=document.getElementById('authAuto'), dark=document.getElementById('authDark'), light=document.getElementById('authLight'), bulb=document.getElementById('authBulb');
  if(auto) auto.classList.toggle('active',mode==='auto');
  if(dark) dark.classList.toggle('active',mode==='dark');
  if(light) light.classList.toggle('active',mode==='light');
  if(bulb) bulb.classList.toggle('light',actual==='light');
}
function setAuthTheme(mode){
  const stored=mode==='auto' ? 'auto' : (mode==='light' ? 'light' : 'dark');
  localStorage.setItem('lifeflow2_auth_theme',stored);
  applyAuthTheme(stored);
}
function initAuthTheme(){
  const mode=getAuthTheme(); applyAuthTheme(mode);
  if(window.matchMedia){
    const mq=window.matchMedia('(prefers-color-scheme: light)');
    const onChange=()=>{ if(getAuthTheme()==='auto') applyAuthTheme('auto'); };
    mq.addEventListener?.('change',onChange); mq.addListener?.(onChange);
  }
  const bulb=document.getElementById('authBulb'); if(!bulb) return;
  let startY=null,active=false,switched=false;
  const down=e=>{startY=e.clientY;active=true;switched=false;bulb.setPointerCapture?.(e.pointerId);e.preventDefault();};
  const move=e=>{
    if(!active)return;
    const dy=Math.max(0,Math.min(24,e.clientY-startY));
    bulb.style.setProperty('--pull-y',dy+'px');
    if(dy>8 && !switched){
      switched=true;
      setAuthTheme(getAuthTheme()==='light'?'dark':'light');
    }
  };
  const end=e=>{if(!active)return;active=false;bulb.style.setProperty('--pull-y','0px');bulb.releasePointerCapture?.(e.pointerId);};
  bulb.addEventListener('pointerdown',down);bulb.addEventListener('pointermove',move);bulb.addEventListener('pointerup',end);bulb.addEventListener('pointercancel',end);
}
function setTheme(theme){ const u=currentUser(); const next=theme === 'light' ? 'light' : 'dark'; if(u) updateUser(user=>user.theme=next); else applyTheme(next); }
let themePullStartY=null, themePullActive=false;
function initThemePull(){
  const b=document.getElementById('themePull'); if(!b) return;
  const begin=e=>{
    themePullStartY=e.clientY;
    themePullActive=true;
    b.classList.add('pulling');
    b.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const move=e=>{
    if(!themePullActive)return;
    const dy=Math.max(0,Math.min(24,e.clientY-themePullStartY));

    b.style.setProperty('--pull-y',dy+'px');
  };
  const end=e=>{
    if(!themePullActive)return;
    const dy=Math.max(0,e.clientY-themePullStartY);
    themePullActive=false;
    b.classList.remove('pulling');
    b.style.setProperty('--pull-y','0px');
    b.releasePointerCapture?.(e.pointerId);
    if(dy>8){
      b.classList.add('snap');
      setTheme((currentUser()?.theme||'dark')==='dark'?'light':'dark');
      setTimeout(()=>b.classList.remove('snap'),300);
    }
  };
  b.addEventListener('pointerdown',begin);
  b.addEventListener('pointermove',move);
  b.addEventListener('pointerup',end);
  b.addEventListener('pointercancel',end);
}
function updateUser(fn){ const users=getUsers(); if(!users[state.currentUser]) return; fn(users[state.currentUser]); saveUsers(users); renderApp(); }

function uid(){ return Date.now()+Math.floor(Math.random()*1000); }
function addTask(t){ state.tasks.push(Object.assign({id:uid(), title:'', tags:[], priority:'medium', due:null, startTime:null, endTime:null, recur:'none', status:'todo', done:false, subtasks:[]}, t)); save(); renderApp(); }
function toggleDone(id){
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  t.done = !t.done;
  if(t.done && t.recur !== 'none' && t.due){
    const d = new Date(t.due);
    if(t.recur==='daily') d.setDate(d.getDate()+1);
    if(t.recur==='weekly') d.setDate(d.getDate()+7);
    if(t.recur==='monthly') d.setMonth(d.getMonth()+1);
    addTask({title:t.title, tags:t.tags, priority:t.priority, due:d.toISOString(), startTime:t.startTime||null, endTime:t.endTime||null, recur:t.recur, status:'todo'});
  }
  save(); renderApp();
}
let lastDeletedTask=null;
let lastDeletedTimer=null;
function deleteTask(id){
  const index=state.tasks.findIndex(t=>t.id===id);
  if(index<0)return;
  lastDeletedTask={task:JSON.parse(JSON.stringify(state.tasks[index])),index};
  state.tasks.splice(index,1);
  save();
  renderApp();
  showUndoToast('Task deleted');
}
function undoDelete(){
  if(!lastDeletedTask)return;
  const exists=state.tasks.some(t=>t.id===lastDeletedTask.task.id);
  if(!exists) state.tasks.splice(Math.min(lastDeletedTask.index,state.tasks.length),0,lastDeletedTask.task);
  save(); lastDeletedTask=null;
  clearTimeout(lastDeletedTimer); lastDeletedTimer=null;
  document.getElementById('toastHost').innerHTML='';
  renderApp();
}
function showUndoToast(message){
  const host=document.getElementById('toastHost'); if(!host)return;
  clearTimeout(lastDeletedTimer);
  host.innerHTML='<div class="toast" role="status"><span>'+esc(message)+'</span><button class="undo-action" type="button" onclick="undoDelete()">Undo</button></div>';
  lastDeletedTimer=setTimeout(()=>{lastDeletedTask=null;host.innerHTML='';},5000);
}
function addSubtask(id, text){
  const t = state.tasks.find(x=>x.id===id); if(!t||!text) return;
  t.subtasks.push({id:uid(), text, done:false}); save(); renderApp();
}
function toggleSub(tid,sid){
  const t = state.tasks.find(x=>x.id===tid); const s = t.subtasks.find(x=>x.id===sid);
  s.done = !s.done; save(); renderApp();
}

function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function intervalHtml(t){ return validTime(t.startTime)&&validTime(t.endTime)?`<span class="time-chip">◷ ${esc(t.startTime)}–${esc(t.endTime)}</span>`:''; }
function validTime(t){ return typeof t==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }
function validInterval(a,b){ return validTime(a)&&validTime(b)&&a<b; }
function fmtDate(iso){ if(!iso) return ''; const d=new Date(iso); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }

function exportData(fmt){
  let content, mime, ext;
  if(fmt==='json'){ content = JSON.stringify(state.tasks,null,2); mime='application/json'; ext='json'; }
  else{
    const rows=[['Title','Priority','Due','Start time','End time','Status','Recurrence','Done']];
    state.tasks.forEach(t=>rows.push([t.title,t.priority,t.due||'',t.startTime||'',t.endTime||'',t.status,t.recur,t.done]));
    content = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    mime='text/csv'; ext='csv';
  }
  const blob = new Blob([content],{type:mime});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'lifeflow_tasks.'+ext; a.click();
}

function renderNav(){
  const tabs=[['today','Today','◈'],['list','Tasks','☷'],['calendar','Calendar','▦'],['board','Board','▥'],['about','Why LifeFlow','✦'],['account','Profile & settings','◎']];
  document.getElementById('nav').innerHTML = tabs.map(([k,l,i])=>`<button title="${l}" aria-label="${l}" class="${view===k?'active':''}" onclick="setView('${k}')"><span class="nav-icon">${i}</span><span class="nav-text">${l}</span></button>`).join('');
}
function setView(v){ view=v; clearNewTimes(); renderApp(); }

function taskFormHtml(){
  return `<div class="card"><h2>New Task</h2>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <input id="nt_title" aria-label="Task title" placeholder="Task title" autocomplete="off" style="flex:2;min-width:140px">
      <input id="nt_due" type="date" aria-label="Due date">
      <select id="nt_pri" aria-label="Priority"><option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option></select>
      <select id="nt_recur" aria-label="Repeat task"><option value="none">No repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
      <input id="nt_tags" aria-label="Task tags" placeholder="tags (comma)" style="min-width:100px">
      <button class="primary" onclick="submitTask()" aria-label="Add task">Add</button>
    </div>
    <div class="time-fields"><label>Optional time interval</label>
      <button type="button" id="nt_start" onclick="openClock('new','start')">Start time</button><span>to</span>
      <button type="button" id="nt_end" onclick="openClock('new','end')">End time</button>
      <button type="button" onclick="clearNewTimes()" aria-label="Clear task times">Clear times</button>
    </div><div id="nt_timeError" class="time-error" role="alert"></div></div>`;
}
let newTaskTimes={start:'',end:''};
function clearNewTimes(){ newTaskTimes={start:'',end:''}; updateNewTimeButtons(); }
function updateNewTimeButtons(){
  const a=document.getElementById('nt_start'), b=document.getElementById('nt_end');
  if(a) a.textContent=newTaskTimes.start||'Start time';
  if(b) b.textContent=newTaskTimes.end||'End time';
  const e=document.getElementById('nt_timeError'); if(e)e.textContent='';
}
function submitTask(){
  const title = document.getElementById('nt_title').value.trim();
  if(!title) return;
  const due = document.getElementById('nt_due').value;
  const tags = document.getElementById('nt_tags').value.split(',').map(s=>s.trim()).filter(Boolean);
  if((newTaskTimes.start||newTaskTimes.end) && !validInterval(newTaskTimes.start,newTaskTimes.end)){document.getElementById('nt_timeError').textContent='Choose both times, with the end after the start (same day).';return;}
  addTask({title, due: due? new Date(due).toISOString(): null, startTime:newTaskTimes.start||null, endTime:newTaskTimes.end||null, priority:document.getElementById('nt_pri').value, recur:document.getElementById('nt_recur').value, tags});
  clearNewTimes();
}

function taskRow(t){
  const overdue=!!(t.due && new Date(t.due)<new Date() && !t.done);
  const priorityLabel=t.priority==='high'?'High':t.priority==='medium'?'Medium':'Low';
  const subDone=t.subtasks.filter(s=>s.done).length;
  const subTotal=t.subtasks.length;
  return '<div class="task '+(t.done?'done ':'')+(overdue?'overdue ':'')+'priority-'+t.priority+'" tabindex="0">'+
    '<span class="task-priority-dot" aria-hidden="true" title="'+priorityLabel+' priority"></span>'+
    '<input type="checkbox" '+(t.done?'checked':'')+' onchange="toggleDone('+t.id+')" aria-label="Toggle task completion">'+
    '<div class="task-body"><div class="task-title-line"><div class="title">'+esc(t.title)+'</div>'+(t.recur!=='none'?'<span class="recurrence-badge" title="Recurring task">↻</span>':'')+(subTotal?'<span class="subtask-count" title="'+subDone+' of '+subTotal+' subtasks complete">'+subDone+'/'+subTotal+'</span>':'')+'</div>'+
    '<div class="meta"><span class="priority-label">'+priorityLabel+'</span>'+(t.due?'<span class="'+(overdue?'due-overdue':'')+'">'+(overdue?'Overdue · ':'')+fmtDate(t.due)+'</span>':'')+intervalHtml(t)+(t.recur!=='none'?'<span class="recurrence-text">↻ '+t.recur+'</span>':'')+t.tags.map(g=>'<span>#'+esc(g)+'</span>').join('')+'</div>'+
    (subTotal?'<div class="subtask-list">'+t.subtasks.map(s=>'<label class="sub"><input type="checkbox" '+(s.done?'checked':'')+' onchange="toggleSub('+t.id+','+s.id+')"> <span>'+esc(s.text)+'</span></label>').join('')+'</div>':'')+
    '<div class="subtask-add"><input placeholder="+ add subtask" aria-label="Add subtask" onkeydown="if(event.key===\'Enter\'){addSubtask('+t.id+',this.value);this.value=\'\';}"></div></div>'+
    '<button class="del task-action" onclick="editTaskTime('+t.id+')" aria-label="Edit time">◷</button><button class="del task-action" onclick="deleteTask('+t.id+')" aria-label="Delete task">✕</button></div>';
}

function todayKey(d){return new Date(d).toDateString();}
function renderToday(){
  const now=new Date(), todayStr=now.toDateString();
  const dueToday=state.tasks.filter(t=>t.due && todayKey(t.due)===todayStr);
  const activeDueToday=dueToday.filter(t=>!t.done);
  const overdue=state.tasks.filter(t=>t.due && new Date(t.due)<now && todayKey(t.due)!==todayStr && !t.done);
  const upcoming=state.tasks.filter(t=>t.due && new Date(t.due)>now && todayKey(t.due)!==todayStr && !t.done).sort((a,b)=>new Date(a.due)-new Date(b.due)).slice(0,5);
  const completed=dueToday.filter(t=>t.done).length;
  const percent=dueToday.length?Math.round(completed/dueToday.length*100):0;
  const scheduled=dueToday.filter(t=>validInterval(t.startTime,t.endTime) && !t.done).sort((a,b)=>a.startTime.localeCompare(b.startTime));
  const minutes=scheduled.reduce((n,t)=>{const [ah,am]=t.startTime.split(':').map(Number),[bh,bm]=t.endTime.split(':').map(Number);return n+bh*60+bm-ah*60-am},0);
  const loadReasons=[];
  if(dueToday.filter(t=>!t.done).length>=8) loadReasons.push(dueToday.filter(t=>!t.done).length+' active tasks');
  if(minutes>=480) loadReasons.push(Math.round(minutes/60*10)/10+' scheduled hours');
  if(overdue.length>=3) loadReasons.push(overdue.length+' overdue tasks');
  const overloaded=loadReasons.length>0;
  const u=currentUser()||{}, first=esc((u.name||'there').trim().split(/\s+/)[0]);
  return `<section class="card hero hero-welcome">
      <div class="hero-copy">
        <div class="hero-kicker">YOUR DAY</div>
        <h2>Good to see you, ${first}.</h2>
        <p>${esc(now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}))}</p>
        <div class="hero-summary"><span>${dueToday.length} task${dueToday.length===1?'':'s'} today</span><span class="hero-dot">•</span><span>${completed} completed</span></div>
      </div>
      <div class="hero-progress">
        <div class="hero-ring" style="--progress:${percent*3.6}deg"><span>${percent}%</span></div>
      </div>
    </section>
    ${overloaded?`<div class="workload-warning"><div class="load-icon">!</div><div><strong>Your day is getting full</strong><span>${esc(loadReasons.join(' · '))}. Consider protecting some space before adding more.</span></div></div>`:''}<div class="today-grid"><div>${taskFormHtml()}<div class="card"><div class="section-heading"><div><h2>Today's tasks</h2><p>${activeDueToday.length? 'Stay focused on what needs your attention.':dueToday.length?'You are all caught up for today.':'You have a clear slate.'}</p></div><span class="section-count">${activeDueToday.length}</span></div>${activeDueToday.length?'<div class="task-scroll">'+activeDueToday.map(taskRow).join('')+'</div>':'<div class="empty empty-soft">'+(dueToday.length?'All today’s tasks are done.':'Nothing due today. Add a task to get started.')+'</div>'}</div>
    ${overdue.length?`<div class="card"><h2>Overdue (${overdue.length})</h2><div class="task-scroll">${overdue.map(taskRow).join('')}</div></div>`:''}<div class="card"><h2>Upcoming</h2>${upcoming.length?'<div class="task-scroll">'+upcoming.map(taskRow).join('')+'</div>':'<div class="empty">Nothing upcoming.</div>'}</div></div>
    <div><div class="card"><h2>Daily progress</h2><div class="statgrid"><div class="stat"><b>${dueToday.length}</b><small>Due today</small></div><div class="stat"><b>${completed}</b><small>Done</small></div><div class="stat"><b>${Math.round(minutes/60*10)/10}h</b><small>Scheduled</small></div></div><div class="progress-track" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div><small class="meta">${percent}% of today's tasks complete</small></div>
    <div class="card"><h2>Schedule</h2>${scheduled.length?'<div class="schedule-scroll">'+scheduled.map(t=>'<div class="event"><b>'+esc(t.title)+'</b><small>'+esc(t.startTime)+'–'+esc(t.endTime)+'</small></div>').join('')+'</div>':'<div class="empty">No time intervals today.</div>'}</div></div></div>`;
}

function renderList(){
  const today=new Date();
  today.setHours(0,0,0,0);
  const list = state.tasks
    .filter(t=>!t.due || new Date(t.due)>=today)
    .sort((a,b)=>(a.done-b.done)||((a.due?new Date(a.due):Infinity)-(b.due?new Date(b.due):Infinity)));
  return `<div class="card"><h2>All Tasks (${list.length})</h2>${list.length?list.map(taskRow).join(''):'<div class="empty">No current or upcoming tasks.</div>'}</div>`;
}

function renderBoard(){
  const cols=[['todo','To Do'],['doing','Doing'],['done','Done']];
  return '<div class="card"><div class="board-heading"><div><h2>Kanban Board</h2><p>Move work through the flow. Drop cards into a column to update status.</p></div></div><div class="board">'+cols.map(([k,l])=>
    '<div class="col col-'+k+'" ondragover="event.preventDefault();this.classList.add(\'drag-over\')" ondragleave="this.classList.remove(\'drag-over\')" ondrop="this.classList.remove(\'drag-over\');dropCol(event,\''+k+'\')">'+
      '<h3><span class="col-title">'+l+'</span></h3><div class="col-drop-hint">Drop here</div>'+
      state.tasks.filter(t=>t.status===k).map(t=>'<div class="kcard priority-'+t.priority+' '+(t.done?'done':'')+'" draggable="true" ondragstart="event.dataTransfer.effectAllowed=\'move\';event.dataTransfer.setData(\'id\','+t.id+');this.classList.add(\'dragging\')" ondragend="this.classList.remove(\'dragging\')">'+
        '<div class="kcard-title"><span class="task-priority-dot" aria-hidden="true"></span>'+esc(t.title)+(t.recur!=='none'?'<span class="recurrence-badge">↻</span>':'')+'</div>'+
        '<div class="meta"><span class="priority-label">'+t.priority+'</span>'+(t.due?'<span>'+fmtDate(t.due)+'</span>':'')+intervalHtml(t)+'</div>'+(t.subtasks.length?'<div class="k-subprogress">'+t.subtasks.filter(s=>s.done).length+'/'+t.subtasks.length+' subtasks</div>':'')+
        '<button class="linklike" onclick="editTaskTime('+t.id+')">Edit time</button></div>').join('')+'</div>').join('')+'</div></div>';
}
function dropCol(e,col){ const id=+e.dataTransfer.getData('id'); const t=state.tasks.find(x=>x.id===id); if(t){ t.status=col; t.done=col==='done'; save(); renderApp(); } }

function renderCalendar(){
  const first = new Date(calYear, calMonth, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const monthName = first.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  let cells = '';
  for(let i=0;i<startDow;i++) cells += `<div></div>`;
  for(let d=1; d<=daysInMonth; d++){
    const cellDate = new Date(calYear,calMonth,d);
    const isToday = cellDate.toDateString()===new Date().toDateString();
    const dayTasks = state.tasks.filter(t=>t.due && new Date(t.due).toDateString()===cellDate.toDateString());
    cells += `<div class="cal-day ${isToday?'today':''}" ondragover="event.preventDefault()" ondrop="dropDay(event,${calYear},${calMonth},${d})">
      <div class="dnum">${d}</div>
      ${dayTasks.map(t=>`<div class="citem" draggable="true" ondragstart="event.dataTransfer.setData('id',${t.id})">${esc(t.title)}${intervalHtml(t)?`<div>${intervalHtml(t)}</div>`:''}<button class="linklike" onclick="editTaskTime(${t.id})" aria-label="Edit time for ${esc(t.title)}">Edit</button></div>`).join('')}
    </div>`;
  }
  return `<div class="card"><div class="cal-head">
      <button class="hbtn" onclick="shiftMonth(-1)">‹</button>
      <strong>${monthName}</strong>
      <button class="hbtn" onclick="shiftMonth(1)">›</button>
    </div>
    <div class="calendar-wrap"><div class="cal-grid">${['S','M','T','W','T','F','S'].map(d=>`<div class="dow">${d}</div>`).join('')}${cells}</div></div>
    <div class="notice">Drag a task onto another day to reschedule it.</div>
  </div>`;
}
function shiftMonth(n){ calMonth+=n; if(calMonth<0){calMonth=11;calYear--;} if(calMonth>11){calMonth=0;calYear++;} renderApp(); }
function dropDay(e,y,m,d){ const id=+e.dataTransfer.getData('id'); const t=state.tasks.find(x=>x.id===id); if(t){ t.due=new Date(y,m,d).toISOString(); save(); renderApp(); } }

let densityMode=localStorage.getItem('lifeflow2_density')||'comfortable';
function setDensity(mode){
  densityMode=['compact','comfortable','immersive'].includes(mode)?mode:'comfortable';
  localStorage.setItem('lifeflow2_density',densityMode);
  document.documentElement.setAttribute('data-density',densityMode);
  renderApp();
}
function applyDensity(){ document.documentElement.setAttribute('data-density',densityMode); }

let timeEdit=null, clock=null;
function editTaskTime(id){
  const t=state.tasks.find(x=>x.id===id); if(!t)return;
  timeEdit={id,start:validTime(t.startTime)?t.startTime:'',end:validTime(t.endTime)?t.endTime:''};
  renderTimeEditor();
}
function renderTimeEditor(){
  const host=document.getElementById('timeEditorHost');
  if(!timeEdit){host.innerHTML='';return;}
  const t=state.tasks.find(x=>x.id===timeEdit.id);if(!t){timeEdit=null;host.innerHTML='';return;}
  host.innerHTML=`<div class="time-edit" role="presentation" onclick="if(event.target===this)closeTimeEditor()"><div class="time-edit-card" role="dialog" aria-modal="true" aria-label="Edit task time interval">
    <h2>Edit time: ${esc(t.title)}</h2><div class="time-fields"><button onclick="openClock('edit','start')">${timeEdit.start||'Start time'}</button><span>to</span><button onclick="openClock('edit','end')">${timeEdit.end||'End time'}</button></div>
    <div class="time-error" id="editTimeError" role="alert"></div><div class="time-edit-actions"><button onclick="clearTaskTimes()">Clear interval</button><button onclick="closeTimeEditor()">Cancel</button><button class="primary" onclick="saveTaskTimes()">Save</button></div>
  </div></div>`;
}
function closeTimeEditor(){timeEdit=null;renderTimeEditor();}
function clearTaskTimes(){
  const t=state.tasks.find(x=>x.id===timeEdit?.id); if(!t)return;
  t.startTime=null;t.endTime=null;save();closeTimeEditor();renderApp();
}
function saveTaskTimes(){
  if(!validInterval(timeEdit.start,timeEdit.end)){document.getElementById('editTimeError').textContent='Choose a start and end time, with the end after the start (same day).';return;}
  const t=state.tasks.find(x=>x.id===timeEdit.id);if(!t)return;
  t.startTime=timeEdit.start;t.endTime=timeEdit.end;save();closeTimeEditor();renderApp();
}
function openClock(target,field){
  const stored=target==='new'?newTaskTimes:timeEdit; if(!stored)return;
  const initial=stored[field]|| (field==='end'?'10:00':'09:00');
  clock={target,field,hour:Number(initial.slice(0,2)),minute:Number(initial.slice(3)),active:'hour',keyboard:false};
  renderClock();
}
function closeClock(){clock=null;document.getElementById('clockHost').innerHTML='';}
function setClockActive(part){clock.active=part;clock.keyboard=false;renderClock();}
function selectClockValue(n){
  if(clock.active==='hour'){clock.hour=n;clock.active='minute';}
  else clock.minute=n;
  renderClock();
}
function clockValue(){return String(clock.hour).padStart(2,'0')+':'+String(clock.minute).padStart(2,'0');}
function toggleClockInput(){clock.keyboard=!clock.keyboard;renderClock();if(clock.keyboard)document.getElementById('clockInput').focus();}
function clockOK(){
  if(clock.keyboard){
    const value=document.getElementById('clockInput').value;
    if(!validTime(value)){document.getElementById('clockError').textContent='Enter a valid time (00:00–23:59).';return;}
    clock.hour=Number(value.slice(0,2));clock.minute=Number(value.slice(3));
  }
  const {target,field}=clock,value=clockValue();closeClock();
  if(target==='new'){newTaskTimes[field]=value;updateNewTimeButtons();}
  else if(timeEdit){timeEdit[field]=value;renderTimeEditor();}
}
function renderClock(){
  if(!clock)return;
  const {hour,minute,active,field,keyboard}=clock;
  const selected=active==='hour'?hour:minute;
  const numbers=[];
  const add=(n,angle,radius,label)=>{
    const x=50+radius*Math.sin(angle),y=50-radius*Math.cos(angle);
    numbers.push(`<button type="button" class="clock-number ${selected===n?'selected':''}" style="left:${x}%;top:${y}%" aria-label="${active==='hour'?'Hour':'Minute'} ${String(n).padStart(2,'0')}" onclick="selectClockValue(${n})">${label}</button>`);
  };
  if(active==='hour'){
    for(let i=0;i<12;i++){let angle=i*Math.PI/6; add(i,angle,39,String(i));add(i+12,angle,26,String(i+12));}
  }else for(let i=0;i<12;i++) add(i*5,i*Math.PI/6,39,String(i*5).padStart(2,'0'));
  const angle=(active==='hour'?(hour%12):minute/5)*Math.PI/6;
  const radius=active==='hour'?(hour>=12?26:39):39;
  const hand=`<div class="clock-hand" style="width:${radius}%;transform:rotate(${angle*180/Math.PI-90}deg)"></div><div class="clock-center"></div>`;
  document.getElementById('clockHost').innerHTML=`<div class="clock-overlay" role="presentation" onclick="if(event.target===this)closeClock()"><div class="clock-dialog" role="dialog" aria-modal="true" aria-label="Select ${field} time">
    <h2>Select ${field} time</h2><div class="clock-subtitle">24-hour clock · ${field==='start'?'Choose when this task starts':'Choose when this task ends'}</div>
    <div class="clock-display"><button type="button" class="${active==='hour'?'active':''}" onclick="setClockActive('hour')" aria-label="Select hour">${String(hour).padStart(2,'0')}</button><span>:</span><button type="button" class="${active==='minute'?'active':''}" onclick="setClockActive('minute')" aria-label="Select minute">${String(minute).padStart(2,'0')}</button></div>
    ${keyboard?`<div class="clock-keyboard"><input id="clockInput" type="time" aria-label="Time in 24-hour format" value="${clockValue()}" onkeydown="if(event.key==='Enter')clockOK()"></div>`:`<div class="clock-dial" id="clockDial" role="group" aria-label="${active} dial">${hand}${numbers.join('')}</div>`}
    <div id="clockError" class="time-error" role="alert"></div><div class="clock-footer"><button type="button" class="clock-mode" onclick="toggleClockInput()" aria-label="${keyboard?'Use clock dial':'Use keyboard input'}" title="${keyboard?'Use clock dial':'Use keyboard input'}">${keyboard?'◷':'⌨'}</button><button type="button" onclick="closeClock()">Cancel</button><button type="button" onclick="clockOK()">OK</button></div>
  </div></div>`;
  const dial=document.getElementById('clockDial');
  if(dial){
    dial.addEventListener('pointerdown',e=>{dial.setPointerCapture(e.pointerId);clockPointer(e,false);});
    dial.addEventListener('pointermove',e=>{if(e.buttons)clockPointer(e,false);});
    dial.addEventListener('pointerup',e=>{clockPointer(e,true);});
  }
}
function clockPointer(e,finish=true){
  if(!clock)return;
  const rect=e.currentTarget.getBoundingClientRect(), cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  const x=e.clientX-cx,y=e.clientY-cy,dist=Math.hypot(x,y)/(rect.width/2);
  if(dist<.12)return;
  const turn=(Math.atan2(x,-y)+2*Math.PI)%(2*Math.PI);
  const n=Math.round(turn/(Math.PI/6))%12;
  if(clock.active==='hour')clock.hour=n+(dist<.66?12:0);
  else clock.minute=n*5;
  if(finish){if(clock.active==='hour')clock.active='minute';renderClock();}
  else{
    const old=e.currentTarget.querySelector('.clock-number.selected');if(old)old.classList.remove('selected');
    const value=clock.active==='hour'?clock.hour:clock.minute;
    e.currentTarget.querySelector(`[aria-label="${clock.active==='hour'?'Hour':'Minute'} ${String(value).padStart(2,'0')}"]`)?.classList.add('selected');
  }
}
function showToast(message){const host=document.getElementById('toastHost');host.innerHTML='<div class="toast"></div>';host.firstElementChild.textContent=message;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>host.innerHTML='',3200);}
let temporaryTheme=null;
let temporaryThemeTimer=null;
function renderApp(){
  newTaskTimes={start:'',end:''};
  if(!getSession()) return; // no valid session: stay on the auth screen
  applyDensity();
  renderNav();
  const names={today:'Today',list:'Tasks',calendar:'Calendar',board:'Board',about:'Why LifeFlow',account:'Profile & settings'};
  document.getElementById('pageTitle').textContent=names[view]||'LifeFlow';
  const u=currentUser(); applyTheme(temporaryTheme||u?.theme||'dark'); applyAmbientEnvironment(); document.getElementById('topAvatar').textContent=(u?.name||'L').trim().charAt(0).toUpperCase();
  document.getElementById('pageSubtitle').textContent=view==='today'?new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'}):'';
  const el = document.getElementById('main');
  if(view==='today') el.innerHTML = renderToday();
  else if(view==='list') el.innerHTML = renderList();
  else if(view==='board') el.innerHTML = renderBoard();
  else if(view==='calendar') el.innerHTML = renderCalendar();
  else if(view==='about') el.innerHTML = renderAbout();
  else if(view==='account') el.innerHTML = renderAccount();
  if(window.lifeFlowLoginEntry){
    el.classList.remove('page-enter');
    void el.offsetWidth;
    el.classList.add('page-enter');
    window.lifeFlowLoginEntry=false;
    setTimeout(()=>el.classList.remove('page-enter'),900);
  }
  initThemePull();
  lfAccessibilityPass();
}
function lfAccessibilityPass(){
  const root=document.documentElement;
  root.setAttribute('data-first-use',state.tasks?.length?'off':'on');
  root.setAttribute('data-session-state',currentUser()?'returning':'guest');
  document.querySelectorAll('#main input,#main select').forEach(el=>{
    if(!el.getAttribute('aria-label') && el.placeholder) el.setAttribute('aria-label',el.placeholder);
  });
  document.querySelectorAll('#main button').forEach(btn=>{
    if(!btn.getAttribute('aria-label') && !btn.textContent.trim() && btn.title) btn.setAttribute('aria-label',btn.title);
  });
}
function openCommandPalette(){
  if(document.getElementById('lfCommandPalette')) return;
  const overlay=document.createElement('div');
  overlay.id='lfCommandPalette';
  overlay.className='command-overlay';
  overlay.innerHTML='<div class="command-panel" role="dialog" aria-modal="true" aria-label="LifeFlow search"><div class="command-head"><div><strong>Search LifeFlow</strong><span>Tasks, pages and actions</span></div><button class="command-close" type="button" onclick="closeCommandPalette()" aria-label="Close">×</button></div><input id="lfCommandInput" class="command-input" autocomplete="off" placeholder="Search tasks or jump to a page..." aria-label="Search tasks or pages"><div id="lfCommandResults" class="command-results"></div><div class="command-hint">Esc to close · Enter to open</div></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeCommandPalette();});
  const input=document.getElementById('lfCommandInput');
  input.addEventListener('input',renderCommandResults);
  input.addEventListener('keydown',e=>{if(e.key==='Escape')closeCommandPalette();if(e.key==='Enter'){const first=document.querySelector('#lfCommandResults button');if(first)first.click();}});
  renderCommandResults();
  input.focus();
}
function closeCommandPalette(){document.getElementById('lfCommandPalette')?.remove();}
function renderCommandResults(){
  const input=document.getElementById('lfCommandInput'); const host=document.getElementById('lfCommandResults'); if(!input||!host)return;
  const q=input.value.trim().toLowerCase();
  const pages=[['today','Today','See what needs attention now'],['list','Tasks','Browse and manage tasks'],['calendar','Calendar','View deadlines and scheduled time'],['board','Board','Move work through the flow'],['about','Why LifeFlow','Read the product principles'],['account','Profile & settings','Personalize LifeFlow']];
  const matches=pages.filter(x=>!q||x.join(' ').toLowerCase().includes(q)).map(x=>'<button type="button" class="command-result" onclick="view=\''+x[0]+'\';closeCommandPalette();renderApp()"><b>'+x[1]+'</b><span>'+x[2]+'</span></button>');
  const tasks=(state.tasks||[]).filter(t=>!q||((t.title||'')+' '+(t.description||'')).toLowerCase().includes(q)).slice(0,8).map(t=>'<button type="button" class="command-result" onclick="view=\'list\';closeCommandPalette();renderApp();setTimeout(()=>document.querySelector(\'[data-task-id="'+t.id+'"]\')?.focus(),50)"><b>'+esc(t.title||'Untitled task')+'</b><span>'+((t.done?'Completed':'Open'))+(t.priority?' · '+esc(t.priority):'')+'</span></button>');
  host.innerHTML=(matches.concat(tasks)).slice(0,10).join('')||'<div class="command-empty">No matching pages or tasks.</div>';
}
window.addEventListener('keydown',e=>{
  if(e.key==='Escape')closeCommandPalette();
});
function renderAbout(){
  return `<section class="card lifeflow-manifesto">
    <div class="manifesto-kicker">THE IDEA BEHIND LIFEFLOW</div>
    <h2>Life is bigger than a task list.</h2>
    <p class="manifesto-lead">LifeFlow exists to help you see what is competing for your time, understand what matters today, and move through your day with less friction.</p>
    <div class="manifesto-grid">
      <div class="manifesto-card"><span>01</span><h3>Why it exists</h3><p>Planning tools often make people manage lists instead of managing their lives. LifeFlow brings tasks, commitments, time and progress into one place.</p></div>
      <div class="manifesto-card"><span>02</span><h3>Who it is for</h3><p>People balancing multiple parts of life: work or study, responsibilities, personal priorities and the things they want to make progress on.</p></div>
      <div class="manifesto-card"><span>03</span><h3>What it manages</h3><p>Tasks are the starting point, but the centre is broader: your time, attention, commitments and progress.</p></div>
      <div class="manifesto-card"><span>04</span><h3>Your first 30 seconds</h3><p>You should quickly understand what needs attention today, what is already handled, and where your time is going.</p></div>
      <div class="manifesto-card"><span>05</span><h3>How it should feel</h3><p>Clear. Calm. Focused. Human. In control. LifeFlow should never feel like another system demanding that you keep up with it.</p></div>
      <div class="manifesto-card"><span>06</span><h3>Why “Flow”</h3><p>Flow means moving through life with less friction: seeing what is next, giving attention to the right things, and continuously making progress.</p></div>
      <div class="manifesto-card manifesto-wide"><span>07</span><h3>The six-month test</h3><p>Success is not having a perfectly maintained planner. It is having fewer forgotten commitments, clearer days, better use of time, and a stronger sense of progress in the parts of life that matter.</p></div>
    </div>
  </section>
  <section class="card manifesto-principles">
    <h2>One principle</h2>
    <p><strong>LifeFlow should help you decide, not just record.</strong> A task is useful when it helps you understand what deserves your attention and take the next meaningful step.</p>
  </section>`;
}
let accountTab='profile';
function setAccountTab(t){ accountTab=t; renderApp(); }

function renderAccount(){
  const u = currentUser();
  if(!u) return '<div class="empty">No profile data.</div>';
  const sub = `<div class="subnav">${[['profile','Profile'],['custom','Customisation'],['connected','Connected'],['sessions','Sessions'],['danger','Danger Zone']].map(([k,l])=>`<button class="${accountTab===k?'active':''}" onclick="setAccountTab('${k}')">${l}</button>`).join('')}</div>`;
  if(accountTab==='profile') return sub + renderProfileTab(u);
  if(accountTab==='custom') return sub + renderCustomisationTab(u);
  if(accountTab==='connected') return sub + renderConnectedTab(u);
  if(accountTab==='sessions') return sub + renderSessionsTab(u);
  if(accountTab==='danger') return sub + renderDangerTab(u);
}

function secretSequence(u){
  const base={step:0,languageRevealed:false,used:false,pendingTeamAdmin:false};
  if(!u)return base;
  const s=Object.assign(base,u.secretSequence||{});
  if(u.tier!=='Team Admin' && !s.pendingTeamAdmin) return base;
  return s;
}
function updateSecretSequence(s){
  const users=getUsers(); if(!users[state.currentUser])return;
  users[state.currentUser].secretSequence=s;
  saveUsers(users);
}
function revealCobaltLanguage(show){
  const select=document.getElementById('prof_lang');
  const field=select?.closest('.lf-secret-field');
  if(!select || !field)return;
  const existing=[...select.options].find(o=>o.value==='Cobalt');
  if(show){
    if(!existing){
      const option=document.createElement('option');
      option.value='Cobalt'; option.textContent='Cobalt';
      select.appendChild(option);
    }
    field.classList.add('revealed');
    if(!field.querySelector('.lf-secret-dot')){
      const dot=document.createElement('span');
      dot.className='lf-secret-dot';
      dot.setAttribute('aria-label','Cobalt language revealed');
      field.appendChild(dot);
    }
  }else if(existing && select.value!=='Cobalt'){
    existing.remove();
    field.classList.remove('revealed');
    field.querySelector('.lf-secret-dot')?.remove();
  }
}
function revealSecretTimezone(){
  const select=document.getElementById('prof_tz'); if(!select)return;
  if(![...select.options].some(o=>o.value==='-')){
    const option=document.createElement('option');
    option.value='-'; option.textContent='-';
    select.insertBefore(option,select.firstChild);
  }
  select.closest('.lf-secret-field')?.classList.add('revealed');
}
function showTaskMaster(){
  const host=document.getElementById('taskMasterHost');
  if(host)host.innerHTML='<button type="button" class="task-master-button" onclick="activateCobaltSequence()"><span class="task-master-flame" aria-hidden="true"><i></i><b></b><em></em></span><span>🔥 TASK MASTER 🔥</span></button>';
}
function lfSecretAction(action){
  const u=currentUser(); if(!u)return;
  const s=secretSequence(u);
  if(s.used)return;
  if(action==='tierTeamAdmin' && s.step===0){
    s.step=1; s.pendingTeamAdmin=true; updateSecretSequence(s); revealSecretTimezone();
  }else if(action==='timezoneDash' && s.step===1){
    s.step=2; s.languageRevealed=true; updateSecretSequence(s); revealCobaltLanguage(true);
  }else if(action==='languageCobalt' && s.step===2){
    s.step=3; updateSecretSequence(s);
  }else if(action==='weekMonday' && s.step===3){
    s.step=4; updateSecretSequence(s); showTaskMaster();
  }else if(action==='tierOther' && s.step>=1){
    s.step=0; s.pendingTeamAdmin=false; s.languageRevealed=false; updateSecretSequence(s); revealCobaltLanguage(false); document.getElementById('taskMasterHost')?.replaceChildren();
  }else if(action==='timezoneOther' && s.step>=2){
    s.step=0; s.languageRevealed=false; updateSecretSequence(s); revealCobaltLanguage(false);
  }else if(action==='languageOther' && (s.step===2 || s.step===3)){
    s.step=0; s.languageRevealed=false; updateSecretSequence(s); revealCobaltLanguage(false);
  }else if(action==='weekOther' && (s.step===3 || s.step===4)){
    s.step=0; updateSecretSequence(s);
    document.getElementById('taskMasterHost')?.replaceChildren();
  }
}
function renderProfileTab(u){
  const s=secretSequence(u);
  const tzs=(s.step>=1?['-']:[]).concat(['UTC','America/New_York','America/Los_Angeles','Europe/London','Asia/Kolkata','Asia/Tokyo','Australia/Sydney']);
  const langs=['English','Spanish','French','Hindi','German'].concat(s.languageRevealed?['Cobalt']:[]);
  return `<div class="card">
    <h2>Identity</h2>
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:12px">
      <div class="avatar" id="avatarBox">${u.avatar?`<img src="${esc(u.avatar)}">`:'👤'}</div>
      <div>
        <input type="file" accept="image/*" onchange="onAvatarChange(event)">
        <div class="notice" style="margin:6px 0 0">Upload only — cropping isn't included in this build.</div>
      </div>
    </div>
    <input id="prof_name" value="${esc(u.name)}" placeholder="Display name">
    <input id="prof_bio" value="${esc(u.bio||'')}" placeholder="Bio" style="margin-top:8px">
    <button class="primary" style="margin-top:8px" onclick="saveProfile()">Save</button>
  </div>
  <div class="card">
    <h2>Localization</h2>
    <div class="lf-secret-field ${s.languageRevealed?'revealed':''}">
      <select id="prof_tz" style="width:100%;margin-bottom:8px" onchange="lfSecretAction(this.value==='-'?'timezoneDash':'timezoneOther')">${tzs.map(tz=>`<option ${u.timezone===tz?'selected':''}>${tz}</option>`).join('')}</select>
    </div>
    <div class="lf-secret-field ${s.languageRevealed?'revealed':''}">
      <select id="prof_lang" style="width:100%;margin-bottom:8px" onchange="lfSecretAction(this.value==='Cobalt'?'languageCobalt':'languageOther')">${langs.map(l=>`<option ${u.language===l?'selected':''}>${l}</option>`).join('')}</select>
      ${s.languageRevealed?'<span class="lf-secret-dot" aria-label="Language option revealed"></span>':''}
    </div>
    <select id="prof_week" style="width:100%;margin-bottom:8px" onchange="lfSecretAction(this.value==='Monday start'?'weekMonday':'weekOther')">${['Sunday','Monday'].map(w=>`<option ${u.weekStart===w?'selected':''}>${w} start</option>`).join('')}</select>
    <button class="primary" onclick="saveLocalization()">Save</button>
  </div>
  <div class="card">
    <h2>Account Tier</h2>
    <span class="badge ${u.tier.replace(' ','')}">${u.tier}</span>
    <select id="prof_tier" style="margin-top:8px;width:100%" onchange="lfSecretAction(this.value==='Team Admin'?'tierTeamAdmin':'tierOther')">${['Free','Premium','Team Admin'].map(t=>`<option ${u.tier===t?'selected':''}>${t}</option>`).join('')}</select>
    <button class="primary" style="margin-top:8px" onclick="saveTier()">Update settings</button>
    <div id="taskMasterHost" style="margin-top:12px">${s.step>=4?'<button type="button" class="task-master-button" onclick="activateCobaltSequence()"><span class="task-master-flame" aria-hidden="true"><i></i><b></b><em></em></span><span>🔥 TASK MASTER 🔥</span></button>':''}</div>
  </div>`;
}
function renderCustomisationTab(u){
  const themes=[['dark','Deep Night','Deep, focused, high-contrast workspace'],['light','Clean Light','Open, crisp and airy'],['forest','Quiet Forest','Natural, grounded and calm'],['paper','Warm Paper','Warm editorial, tactile and softer']];
  const a=ambientSettings(u);
  return subCustomisation(themes,u,a);
}
function subCustomisation(themes,u,a){
  return `<div class="customisation-shell">
    <div class="card customisation-intro"><div><span class="custom-kicker">YOUR LIFEFLOW</span><h2>Customisation</h2><p>Shape the atmosphere around your planning without changing how LifeFlow works.</p></div><span class="theme-current-pill">Currently using <b>${themeLabel(u.theme)}</b></span></div>
    <div class="card"><div class="custom-section-head"><div><h2>Theme</h2><p>Choose the visual environment for your LifeFlow.</p></div><button class="hbtn" onclick="resetCustomisation()">Reset to default</button></div>
      <div class="theme-gallery">${themes.map(([id,name,desc])=>`<button type="button" class="theme-preview theme-preview-${id} ${u.theme===id?'active':''}" onclick="setTheme('${id}')" aria-pressed="${u.theme===id}">
        <span class="theme-preview-window"><i></i><b></b><em></em><small></small></span><span class="theme-preview-copy"><strong>${name}</strong><span>${desc}</span></span><span class="theme-check">${u.theme===id?'✓':'○'}</span>
      </button>`).join('')}</div>
    </div>
    <div class="card color-combinations-card"><div class="custom-section-head"><div><h2>Color combinations</h2><p>Pair your visual theme with an accent palette that changes the character of LifeFlow.</p></div></div>
      <div class="color-combinations"><button type="button" class="color-combination color-sapphire active" onclick="setColorTheme('sapphire')" aria-pressed="true"><span class="color-swatch"></span><span><strong>Sapphire</strong><small>Blue based</small></span><b>✓</b></button><button type="button" class="color-combination color-emerald " onclick="setColorTheme('emerald')" aria-pressed="false"><span class="color-swatch"></span><span><strong>Emerald</strong><small>Green based</small></span><b>○</b></button><button type="button" class="color-combination color-gold " onclick="setColorTheme('gold')" aria-pressed="false"><span class="color-swatch"></span><span><strong>Gold</strong><small>Yellow & orange</small></span><b>○</b></button><button type="button" class="color-combination color-platinum " onclick="setColorTheme('platinum')" aria-pressed="false"><span class="color-swatch"></span><span><strong>Platinum</strong><small>Black & silver</small></span><b>○</b></button><button type="button" class="color-combination color-amethyst " onclick="setColorTheme('amethyst')" aria-pressed="false"><span class="color-swatch"></span><span><strong>Amethyst</strong><small>Purple based</small></span><b>○</b></button><button type="button" class="color-combination color-ruby " onclick="setColorTheme('ruby')" aria-pressed="false"><span class="color-swatch"></span><span><strong>Ruby</strong><small>Red based</small></span><b>○</b></button></div>
    </div>
    <div class="card"><div class="custom-section-head"><div><h2>Ambient environment</h2><p>Let LifeFlow subtly respond to workload and time of day.</p></div><label class="ambient-toggle"><span>Ambient response</span><span class="switch"><input type="checkbox" ${a.ambientMode?'checked':''} onchange="updateAmbientMode(this.checked)"><span class="slider"></span></span><strong>${a.ambientMode?'ON':'OFF'}</strong></label></div>
      <div class="ambient-preview" data-load="medium"><span class="ambient-orb"></span><div><strong>Adaptive atmosphere</strong><small>Background lighting becomes calmer with lighter workloads and more energetic as activity rises.</small></div></div>
      <div class="intensity-control"><div class="intensity-copy"><strong>Visual intensity</strong><span>Control how noticeable the ambient effect feels.</span></div><div class="intensity-slider"><input type="range" aria-label="Visual intensity" min="0" max="2" step="1" value="${a.ambientIntensity==='low'?0:a.ambientIntensity==='high'?2:1}" oninput="updateAmbientIntensity(this.value)"><div class="range-labels"><span>Subtle</span><span>Balanced</span><span>Expressive</span></div></div><b class="intensity-value">${a.ambientIntensity}</b></div>
    </div>
    <div class="card customisation-note"><strong>Your choices persist automatically.</strong><span>Theme and atmosphere settings stay with this account and never change your tasks, navigation or information hierarchy.</span></div>
  </div>`;
}
function updateAmbientMode(enabled){updateUser(u=>{u.ambient=Object.assign(ambientSettings(u),{ambientMode:enabled});});}
function updateAmbientIntensity(value){const levels=['low','medium','high'];updateUser(u=>{u.ambient=Object.assign(ambientSettings(u),{ambientIntensity:levels[+value]||'medium'});});}
function resetCustomisation(){updateUser(u=>{u.theme='dark';u.ambient={ambientMode:true,ambientIntensity:'medium'};});}
function onAvatarChange(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{ updateUser(u=>u.avatar = reader.result); };
  reader.readAsDataURL(file);
}
function saveProfile(){ updateUser(u=>{ u.name=document.getElementById('prof_name').value.trim(); u.bio=document.getElementById('prof_bio').value.trim(); }); }
function saveLocalization(){
  const tz=document.getElementById('prof_tz')?.value;
  const lang=document.getElementById('prof_lang')?.value;
  const week=document.getElementById('prof_week')?.value;
  const u=currentUser(); if(!u)return;
  const s=secretSequence(u);
  const exact=s.step===4 && tz==='-' && lang==='Cobalt' && week==='Monday' && s.languageRevealed && !s.used;
  updateUser(user=>{
    user.timezone=tz||user.timezone;
    user.language=lang||user.language;
    user.weekStart=week||user.weekStart;
  });
  if(exact) activateCobaltSequence();
}
function saveTier(){
  const tier=document.getElementById('prof_tier')?.value;
  updateUser(u=>{
    u.tier=tier||u.tier;
    if(u.tier!=='Team Admin') u.secretSequence={step:0,languageRevealed:false,used:false,pendingTeamAdmin:false};
  });
}

function renderConnectedTab(u){
  return `<div class="card"><h2>Identity Providers</h2>
    ${['Google','Apple','GitHub'].map(p=>`<div class="row-between">
      <div>${p}${u.connected[p]?' <span class="notice" style="display:inline;padding:2px 6px">Linked</span>':''}</div>
      <label class="switch"><input type="checkbox" ${u.connected[p]?'checked':''} onchange="toggleConnected('${p}')"><span class="slider"></span></label>
    </div>`).join('')}
  </div>
  <div class="card"><h2>Data Permissions</h2>
    <div class="notice">Linked providers can read your name and email. Access tokens are used once at sign-in and never stored in the browser.</div>
  </div>`;
}
function toggleConnected(p){ updateUser(u=>{ u.connected[p] = !u.connected[p]; }); }

function renderSessionsTab(u){
  const ua = navigator.userAgent;
  const browser = /Chrome/.test(ua)?'Chrome':/Firefox/.test(ua)?'Firefox':/Safari/.test(ua)?'Safari':'Browser';
  const s = getSession();
  const mock = state.mockSessions || (state.mockSessions = [
    {device:'iPhone · Safari', loc:'Mumbai, IN', last:'2 days ago'},
    {device:'Windows · Edge', loc:'Pune, IN', last:'1 week ago'}
  ]);
  return `<div class="card"><h2>Active Sessions</h2>
    <div class="row-between"><div><strong>${browser} · This device</strong><div class="notice" style="display:inline">Current session — expires ${new Date(s.expiresAt).toLocaleString()}</div></div><span></span></div>
    ${mock.map((m,i)=>`<div class="row-between"><div>${esc(m.device)}<div style="font-size:11px;color:var(--muted)">${esc(m.loc)} · ${esc(m.last)} (simulated)</div></div><button class="del" onclick="revokeSession(${i})">Revoke</button></div>`).join('')}
    <button class="primary" style="margin-top:10px" onclick="revokeAll()">Log out all other devices</button>
  </div>`;
}
function revokeSession(i){ state.mockSessions.splice(i,1); save(); renderApp(); }
function revokeAll(){ state.mockSessions = []; save(); renderApp(); }

function renderDangerTab(u){
  const email = esc(state.currentUser || '');
  return `<div class="card"><h2>Delete Account</h2>
    <div class="notice" style="border-color:var(--danger);color:var(--danger);background:transparent">You are deleting <strong>${email}</strong>. Only this account is removed; other accounts and their tasks stay.</div>
    ${u.passwordHash?'<input id="danger_pass" type="password" placeholder="Confirm your password" style="margin-top:8px">':'<div class="notice">This account signs in with '+(u.oauthProvider||'an identity provider')+', so no password is needed to confirm.</div>'}
    <select id="danger_mode" style="width:100%;margin:8px 0">
      <option value="soft">Soft delete — 30-day recovery window</option>
      <option value="hard">Hard delete — immediate, permanent, email freed for reuse</option>
    </select>
    <button class="primary" style="background:var(--danger)" onclick="deleteAccount()">Delete ${email}</button>
  </div>
  <div class="card"><h2>Reset All App Data</h2>
    <div class="notice">Stuck at login, or an email says "already taken" and you can't get in? This wipes every account, task, and setting LifeFlow stored in this browser - a clean slate. There is no undo.</div>
    <button class="primary" style="background:var(--danger)" onclick="resetAllData()">Erase everything in this browser</button>
  </div>`;
}
function resetAllData(){
  if(!confirm('Erase ALL LifeFlow data in this browser - every account, task, and setting? There is no undo.')) return;
  doLogout(); // destroys the session and returns to the login screen
  ['lifeflow2_users','lifeflow2_state'].forEach(k=>localStorage.removeItem(k));
  sessionStorage.removeItem('lifeflow2_oauth');
  state = {tasks:[]}; // fresh in-memory state; nothing is written back to storage
  alert('All app data erased. You can sign up fresh.');
}
async function deleteAccount(){
  const passEl = document.getElementById('danger_pass');
  const mode = document.getElementById('danger_mode').value;
  const users = getUsers();
  const u = users[state.currentUser];
  if(u.passwordHash && !(await verifyPassword(passEl ? passEl.value : '', u))){ alert('Incorrect password for '+state.currentUser+'.'); return; }
  if(mode==='soft'){
    u.deletedAt = new Date(Date.now()+30*86400000).toISOString();
    saveUsers(users);
    alert(state.currentUser+' scheduled for deletion. Data is recoverable until '+new Date(u.deletedAt).toDateString()+'.');
  }else{
    if(!confirm('Permanently delete '+state.currentUser+' right now? The email becomes reusable immediately. There is no undo.')) return;
    delete users[state.currentUser];
    saveUsers(users);
    const gone = !getUsers()[state.currentUser];
    alert(gone
      ? state.currentUser+' permanently deleted. That email is free to sign up again.'
      : 'Delete failed - storage did not update. Try Reset All App Data instead.');
  }
  doLogout();
}

(async function boot(){
  initAuthTheme();
  renderOAuthButtons();
  if(!window.crypto || !crypto.subtle){
    showOAuthNotice('This app needs the Web Crypto API. Serve it over https or http://localhost (most browsers treat file:// and plain http as insecure).');
  }
  await handleOAuthCallback();
  const session = getSession();
  if(session && !document.getElementById('app').style.display.includes('block')){
    state.currentUser = session.email;
    enterApp();
  }
})();
