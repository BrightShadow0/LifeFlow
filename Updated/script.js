function passwordEyeIcon(hidden){
  return hidden
    ? '<svg class="password-eye-icon" viewBox="0 0 64 44" aria-hidden="true"><path d="M4 22C14 8 25 3 32 3s18 5 28 19c-10 14-21 19-28 19S14 36 4 22Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="22" r="9" fill="currentColor"/><path d="M8 39 56 5" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>'
    : '<svg class="password-eye-icon" viewBox="0 0 64 44" aria-hidden="true"><path d="M4 22C14 8 25 3 32 3s18 5 28 19c-10 14-21 19-28 19S14 36 4 22Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="22" r="9" fill="currentColor"/></svg>';
}
function togglePasswordVisibility(inputId, button){
  const input=document.getElementById(inputId);
  if(!input)return;
  const visible=input.type==='password';
  input.type=visible?'text':'password';
  if(button){
    button.classList.toggle('is-visible',visible);
    button.setAttribute('aria-label',visible?'Hide password':'Show password');
    button.setAttribute('aria-pressed',visible?'true':'false');
    button.title=visible?'Hide password':'Show password';
    button.innerHTML=passwordEyeIcon(!visible);
  }
}

function defaultProfileState(email){
  return {tasks:[], currentUser:email||null};
}
function profileStateKey(email){
  return 'lifeflow2_state_'+encodeURIComponent(String(email||''));
}
function readLegacyState(){
  try{
    const r=localStorage.getItem('lifeflow2_state');
    if(r) return JSON.parse(r);
  }catch(e){}
  return null;
}
function storedSessionEmail(){
  // Browsers can restore a recently closed tab, including its sessionStorage.
  // A close marker invalidates that restored login, while a normal refresh
  // and an in-progress OAuth round-trip keep the session intact.
  try{
    const closing=sessionStorage.getItem('lifeflow2_closed_tab')==='1';
    const nav=performance.getEntriesByType('navigation')[0];
    const isRefresh=nav && nav.type==='reload';
    const oauthInProgress=!!sessionStorage.getItem('lifeflow2_oauth');
    if(closing){
      if(!isRefresh && !oauthInProgress) sessionStorage.removeItem('lifeflow2_session');
      sessionStorage.removeItem('lifeflow2_closed_tab');
    }
    localStorage.removeItem('lifeflow2_session');
  }catch(e){}
  try{
    const s=JSON.parse(sessionStorage.getItem('lifeflow2_session')||'null');
    if(s && s.token && s.email && s.expiresAt && Date.now()<s.expiresAt) return s.email;
  }catch(e){}
  return null;
}
function loadForUser(email){
  if(!email) return defaultProfileState(null);
  const key=profileStateKey(email);
  try{
    const r=localStorage.getItem(key);
    if(r) return Object.assign(defaultProfileState(email),JSON.parse(r),{currentUser:email});
  }catch(e){}
  const legacy=readLegacyState();
  if(legacy && legacy.currentUser===email){
    const migrated=Object.assign(defaultProfileState(email),legacy,{currentUser:email});
    try{ localStorage.setItem(key,JSON.stringify(migrated)); }catch(e){}
    return migrated;
  }
  return defaultProfileState(email);
}

let state = loadForUser(storedSessionEmail());
let view = 'today';
let calMonth = new Date().getMonth(), calYear = new Date().getFullYear();
let calendarMode = 'month';
let taskMasterActivationActive = false;

function load(){ return loadForUser(state?.currentUser || storedSessionEmail()); }
function save(){
  try{
    if(state && state.currentUser) localStorage.setItem(profileStateKey(state.currentUser),JSON.stringify(state));
  }catch(e){}
}
window.addEventListener('storage', e=>{
  if(e.key===profileStateKey(state?.currentUser)){
    state=loadForUser(state.currentUser);
    renderApp();
  }
});

function base64url(bytes){return lifeFlowAuthController.base64url(bytes);}
function randomToken(nBytes){return lifeFlowAuthController.randomToken(nBytes);}
async function sha256B64url(value){return lifeFlowAuthController.sha256B64url(value);}
function timingSafeEqual(a,b){return lifeFlowAuthController.timingSafeEqual(a,b);}
async function hashPassword(password,saltB64,iterations){return lifeFlowAuthController.hashPassword(password,saltB64,iterations);}
async function verifyPassword(password,user){return lifeFlowAuthController.verifyPassword(password,user);}
function getSession(){return lifeFlowAuthController?lifeFlowAuthController.getSession():null;}
function createSession(email,remember=true){return lifeFlowAuthController.createSession(email,remember);}
function destroySession(){
  if(lifeFlowAuthController)return lifeFlowAuthController.destroySession();
  sessionStorage.removeItem('lifeflow2_session');
  state=defaultProfileState(null);
}
// Mark a live session before the tab/window closes. On a browser "reopen
// closed tab" restore, storedSessionEmail() sees this marker and requires login.
window.addEventListener('beforeunload',()=>{
  try{
    if(sessionStorage.getItem('lifeflow2_session')){
      sessionStorage.setItem('lifeflow2_closed_tab','1');
    }
  }catch(e){}
});

setInterval(()=>{ if(!getSession() && !document.getElementById('app').classList.contains('lifeflow-stage-hidden')) doLogout(); }, 60000);

function showStep(id){
  document.querySelectorAll('.authstep').forEach(s=>s.classList.remove('active'));
  const step=document.getElementById(id);if(!step)return;step.classList.add('active');
  const captions={stepLogin:['Welcome back.','Sign in to access your personal planning workspace.'],stepSignup1:['Create an account.','First, choose your email and password.'],stepSignup2:['Make it yours.','Add a name to your workspace.'],stepSignup3:['Your workspace.','One last step before you start planning.'],stepVerify:['Verify your account.','This activation is simulated in the browser.'],stepForgot:['Reset your password.','Enter the email you used to sign up.'],stepSent:['Reset link ready.','This simulated link expires in 15 minutes.'],stepReset:['New password.','Use at least eight characters.'],stepDone:['Password updated.','Return to sign in.']};
  const caption=captions[id]||captions.stepLogin;const heading=document.getElementById('authTitle');heading.textContent=caption[0];heading.setAttribute('tabindex','-1');document.getElementById('authSubtitle').textContent=caption[1];requestAnimationFrame(()=>{const target=step.querySelector('input:not([type=hidden]),button:not([disabled])')||heading;target.focus({preventScroll:true});});
  ['loginError','signupError','forgotError','resetError'].forEach(e=>{ const el=document.getElementById(e); if(el) el.hidden=true; });
  if(typeof setLoginError==='function')setLoginError('');
}
function showAuthError(id,msg){ const el=document.getElementById(id); el.textContent=msg; el.hidden=false; }
function showOAuthNotice(msg){ const el=document.getElementById('oauthNotice'); el.textContent=msg; el.hidden=false; }
function getUsers(){ try{ return JSON.parse(localStorage.getItem('lifeflow2_users')||'{}'); }catch(e){ return {}; } }
function saveUsers(u){ localStorage.setItem('lifeflow2_users', JSON.stringify(u)); }
function newUserRecord(email, extra){
  return Object.assign({
    passwordHash:null, name:email.split('@')[0], bio:'', avatar:null, theme:'dark', autoTheme:false, colorTheme:'platinum',
    workspace:'My Workspace', timezone:'UTC',
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
  if(!email){ emailHint.hidden=true; }
  else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ emailHint.textContent='Invalid email format.'; emailHint.hidden=false; }
  else if(users[email]){
    const ex = users[email];
    emailHint.textContent = ex.deletedAt
      ? 'That email belongs to an account scheduled for deletion. Log in to keep it, or reset all app data from the Danger Zone.'
      : 'That email already has an account. Log in instead, or use Forgot password on the login screen.';
    emailHint.hidden=false;
  }
  else{ emailHint.hidden=true; emailOk = true; }

  let score = 0;
  if(pass.length>=8) score++;
  if(/[0-9]/.test(pass)) score++;
  if(/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
  if(/[^A-Za-z0-9]/.test(pass)) score++;
  const fill = document.getElementById('strengthFill');
  fill.dataset.score=String(score);
  const passOk = pass.length>=8;
  if(pass && !passOk){ passHint.textContent='Password must be at least 8 characters.'; passHint.hidden=false; }
  else{ passHint.hidden=true; }

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

async function doSignup(){return lifeFlowAuthController.doSignup();}
function doVerify(){return lifeFlowAuthController.doVerify();}
function renderOAuthButtons(){return lifeFlowAuthController.renderOAuthButtons();}
function startPasskeyLogin(){
  showOAuthNotice('Passkey sign-in needs a registered WebAuthn relying-party server and a server-generated challenge. This browser-only build cannot verify passkeys yet.');
}
async function oauthLogin(provider){
  if(!lifeFlowCoreReady){showOAuthNotice('LifeFlow is still initializing. Please try again in a moment.');return;}
  return lifeFlowAuthController.oauthLogin(provider);
}
function demoOAuthLogin(provider){
  if(!lifeFlowCoreReady){showOAuthNotice('LifeFlow is still initializing. Please try again in a moment.');return;}
  return lifeFlowAuthController.demoOAuthLogin(provider);
}
async function handleOAuthCallback(){return lifeFlowAuthController.handleOAuthCallback();}


let lifeFlowAuthController = null;
function initializeAuthArchitecture() {
  lifeFlowAuthController = window.LifeFlowAuthModule.createAuthController({
    getUsers, saveUsers, newUserRecord, loadForUser, saveWorkspaceState: save,
    setWorkspaceState: next => { state = next; },
    defaultProfileState, normalizeDemoProfile, enterApp,
    showStep, showAuthError, showOAuthNotice, readLoginGuard, updateLoginCaptcha,
    startLoginLockCountdown, failLogin, resetLoginGuard, setLoginLoading, setLoginError,
    getLoginAttemptsInProgress: () => loginAttemptsInProgress,
    setLoginAttemptsInProgress: value => { loginAttemptsInProgress = !!value; },
    getLoginCaptchaAnswer: () => loginCaptchaAnswer,
    setLoginCaptchaAnswer: value => { loginCaptchaAnswer = value; }
  });
}

let loginCaptchaAnswer = null;
let loginAttemptsInProgress = false;
let loginLockTimer = null;
function readLoginGuard(){try{return JSON.parse(localStorage.getItem('lifeflow_login_guard')||'{}');}catch(e){return {};}}
function writeLoginGuard(guard){try{localStorage.setItem('lifeflow_login_guard',JSON.stringify(guard));}catch(e){}}
function updateLoginCaptcha(){
  const guard=readLoginGuard(),box=document.getElementById('loginCaptcha');if(!box)return;
  if(guard.failures>=4){if(loginCaptchaAnswer===null){const a=2+Math.floor(Math.random()*8),b=1+Math.floor(Math.random()*8);loginCaptchaAnswer=String(a+b);document.getElementById('captchaQuestion').textContent=a+' + '+b+' = ?';}box.hidden=false;}
  else{box.hidden=true;loginCaptchaAnswer=null;const answer=document.getElementById('captchaAnswer');if(answer)answer.value='';}
}
function updateLoginLockUI(){
  const guard=readLoginGuard(),remaining=Math.max(0,(guard.lockUntil||0)-Date.now()),button=document.getElementById('loginSubmit');
  if(button){const locked=remaining>0;button.disabled=locked||loginAttemptsInProgress;button.setAttribute('aria-disabled',locked?'true':'false');const label=button.querySelector('.submit-label');if(label&&!loginAttemptsInProgress)label.textContent=locked?'Try again in '+Math.ceil(remaining/1000)+'s':'Sign in';}
  const error=document.getElementById('loginError');if(remaining>0&&error&&!error.hidden)error.textContent='Too many attempts. Try again in '+Math.ceil(remaining/1000)+' seconds.';
  if(remaining<=0&&guard.lockUntil){guard.lockUntil=0;guard.failures=0;writeLoginGuard(guard);if(error&&error.textContent.includes('Too many attempts'))setLoginError('');if(button&&!loginAttemptsInProgress){button.disabled=false;button.setAttribute('aria-disabled','false');const label=button.querySelector('.submit-label');if(label)label.textContent='Sign in';}}
  return remaining;
}
function startLoginLockCountdown(){if(loginLockTimer)clearInterval(loginLockTimer);updateLoginLockUI();loginLockTimer=setInterval(()=>{if(updateLoginLockUI()<=0){clearInterval(loginLockTimer);loginLockTimer=null;}},250);}
function recordLoginFailure(){const guard=readLoginGuard();guard.failures=(guard.failures||0)+1;if(guard.failures>=8){guard.lockLevel=Math.min(guard.lockLevel||0,5)+1;const delay=Math.min(900000,30000*Math.pow(2,guard.lockLevel-1));guard.lockUntil=Date.now()+delay;guard.failures=0;}writeLoginGuard(guard);updateLoginCaptcha();startLoginLockCountdown();}
function resetLoginGuard(){writeLoginGuard({failures:0,lockUntil:0,lockLevel:0});loginCaptchaAnswer=null;updateLoginCaptcha();startLoginLockCountdown();}
function failLogin(){recordLoginFailure();const guard=readLoginGuard();setLoginError(guard.lockUntil>Date.now()?'Too many failed attempts. Sign-in is temporarily locked.':'Email or password is incorrect. Please try again.');}
function setLoginLoading(loading){
  const button=document.getElementById('loginSubmit');if(!button)return;
  button.disabled=loading;button.classList.toggle('is-loading',loading);
  button.setAttribute('aria-busy',loading?'true':'false');
  button.querySelector('.submit-label').textContent=loading?'Signing in…':'Sign in';
}
function setLoginError(message,fieldId){
  const general=document.getElementById('loginError');
  const map={loginEmail:'loginEmailError',loginPass:'loginPassError',captchaAnswer:'captchaAnswerError'};
  Object.entries(map).forEach(([id,errorId])=>{const field=document.getElementById(id),err=document.getElementById(errorId);if(field)field.removeAttribute('aria-invalid');if(err){err.textContent='';err.hidden=true;}});
  if(fieldId&&map[fieldId]){const field=document.getElementById(fieldId),err=document.getElementById(map[fieldId]);if(field)field.setAttribute('aria-invalid','true');if(err){err.textContent=message;err.hidden=!message;}if(general){general.textContent='';general.hidden=true;}return;}
  if(general){general.textContent=message;general.hidden=!message;}
}
async function doLogin(){
  if(!lifeFlowCoreReady){setLoginError('LifeFlow is still initializing. Please try again in a moment.');return;}
  return lifeFlowAuthController.doLogin();
}
function initTaskEventDelegation(){
  if(!window.lfMasterArchiveInputBound){document.addEventListener('change',event=>{if(event.target?.id==='masterArchiveFile')restoreMasterArchiveFile(event.target.files?.[0]);if(event.target?.id==='masterArchiveSecure'){const fields=document.getElementById('masterArchivePasswordFields');if(fields)fields.hidden=!event.target.checked;}});window.lfMasterArchiveInputBound=true;}
  document.addEventListener('click',event=>{
    if(document.getElementById('lfNoteContextMenu')&&!event.target.closest('#lfNoteContextMenu'))closeNoteContextMenu();
    const control=event.target.closest('[data-lf-action],[data-lf-overlay]');
    if(!control) return;
    if(control.dataset.lfOverlay){
      if(event.target===control){
        if(control.dataset.lfOverlay==='close-time-editor') closeTimeEditor();
        else if(control.dataset.lfOverlay==='close-clock') closeClock();
      }
      return;
    }
    const action=control.dataset.lfAction;
    if(action==='open-new-start') openClock('new','start');
    else if(action==='open-new-end') openClock('new','end');
    else if(action==='clear-new-times') clearNewTimes();
    else if(action==='submit-task') submitTask();
    else if(action==='edit-task-time') editTaskTime(Number(control.dataset.taskId));
    else if(action==='delete-task') deleteTask(Number(control.dataset.taskId));
    else if(action==='complete-all') completeAllTasks();
    else if(action==='clear-completed') clearCompletedTasks();
    else if(action==='shift-month') shiftMonth(Number(control.dataset.monthDelta));
    else if(action==='calendar-mode'){calendarMode=control.dataset.calendarMode==='agenda'?'agenda':'month';renderApp();}
    else if(action==='open-edit-start') openClock('edit','start');
    else if(action==='open-edit-end') openClock('edit','end');
    else if(action==='clear-task-times') clearTaskTimes();
    else if(action==='close-time-editor') closeTimeEditor();
    else if(action==='save-task-times') saveTaskTimes();
    else if(action==='select-clock-value') selectClockValue(Number(control.dataset.clockValue));
    else if(action==='clock-hour') setClockActive('hour');
    else if(action==='clock-minute') setClockActive('minute');
    else if(action==='toggle-clock-input') toggleClockInput();
    else if(action==='close-clock') closeClock();
    else if(action==='clock-ok') clockOK();
    else if(action==='command-close') closeCommandPalette();
    else if(action==='command-view'){view=control.dataset.view;closeCommandPalette();renderApp();}
    else if(action==='command-task'){view='list';closeCommandPalette();renderApp();requestAnimationFrame(()=>document.querySelector('[data-task-id="'+control.dataset.taskId+'"]')?.focus());}
    else if(action==='command-note'){closeCommandPalette();view='notes';selectKnowledgeNote(control.dataset.noteId,'regular','edit');}
    else if(action==='choose-note-link') chooseNoteLink(Number(control.dataset.noteLinkIndex));
    else if(action==='note-panel-toggle'){const panel=control.dataset.notesPanel;window.lfNotesPanelOpen=!(window.lfNotesPanelOpen&&window.lfNotesPanel===panel);window.lfNotesPanel=panel;renderApp();}
    else if(action==='note-panel-close'){window.lfNotesPanelOpen=false;renderApp();}
    else if(action==='notes-search-more'){window.lfNotesSearchVisible=(Number(window.lfNotesSearchVisible)||12)+12;renderNotesListOnly();}
    else if(action==='note-new') newKnowledgeNote('regular');
    else if(action==='note-delete-all') deleteAllKnowledgeNotes('regular');
    else if(action==='note-select') selectKnowledgeNote(control.dataset.noteId,'regular','edit');
    else if(action==='note-add-folder') createKnowledgeFolder();
    else if(action==='note-folder-toggle') {lifeFlowNoteController?.toggleFolder(control.dataset.folderName);renderApp();}
    else if(action==='note-move-folder') {lifeFlowNoteController?.moveToFolder(control.dataset.noteId,control.value);renderApp();}
    else if(action==='note-backlink'){openKnowledgeBacklink(control.dataset.noteId,Number(control.dataset.lineIndex));}
    else if(action==='note-view') setKnowledgeNoteView(control.dataset.noteView);
    else if(action==='note-history-toggle'){window.lfNoteHistoryOpen=!window.lfNoteHistoryOpen;window.lfNoteHistoryPreview=null;renderApp();}
    else if(action==='note-history-preview'){window.lfNoteHistoryPreview=control.dataset.versionId||null;renderApp();}
    else if(action==='note-history-restore')restoreKnowledgeVersion(control.dataset.noteId,control.dataset.versionId);
    else if(action==='note-context-open'){const id=control.dataset.noteId;closeNoteContextMenu();selectKnowledgeNote(id,'regular','edit');}
    else if(action==='note-context-move'){const id=control.dataset.noteId,name=control.dataset.folderName;closeNoteContextMenu();if(lifeFlowNoteController?.moveToFolder(id,name)){showToast('Moved to '+name);renderApp();}}
    else if(action==='note-context-rename'){const id=control.dataset.noteId;closeNoteContextMenu();selectKnowledgeNote(id,'regular','edit');requestAnimationFrame(()=>beginKnowledgeNoteRename(id));}
    else if(action==='note-context-delete'){const id=control.dataset.noteId;closeNoteContextMenu();deleteKnowledgeNote('regular',id);}
    else if(action==='note-context-close') closeNoteContextMenu();
    else if(action==='folder-context-rename'){const name=control.dataset.folderName;closeNoteContextMenu();const next=window.prompt('Rename folder',name);if(next&&lifeFlowNoteController?.renameFolder(name,next)){showToast('Folder renamed');renderApp();}else if(next)showToast('Folder name is invalid or already exists');}
    else if(action==='folder-context-delete'){const name=control.dataset.folderName;closeNoteContextMenu();if(window.confirm('Delete “'+name+'”? Notes in this folder will be moved to Unfiled.')){lifeFlowNoteController?.deleteFolder(name);renderApp();}}
    else if(action==='branches-zoom') branchesZoom(Number(control.dataset.zoomFactor));
    else if(action==='branches-reset') branchesResetView();
    else if(action==='branches-focus-toggle') toggleBranchesFocusMode();
    else if(action==='account-tab') setAccountTab(control.dataset.accountTab);
    else if(action==='task-master-activate') activateCobaltSequence();
    else if(action==='save-profile') saveProfile();
    else if(action==='backup-master-archive') backupMasterArchive();
    else if(action==='choose-master-archive') document.getElementById('masterArchiveFile')?.click();
    else if(action==='cancel-master-restore') closeMasterRestorePreview();
    else if(action==='confirm-master-restore') restoreMasterArchiveNow();
    else if(action==='save-tier') saveTier();
    else if(action==='toggle-change-password') toggleChangePasswordPanel();
    else if(action==='close-change-password') toggleChangePasswordPanel(false);
    else if(action==='change-password') changePassword();
    else if(action==='reset-customisation') resetCustomisation();
    else if(action==='set-theme') setTheme(control.dataset.themeId);
    else if(action==='set-color-theme') setColorTheme(control.dataset.colorTheme);
    else if(action==='revoke-session') revokeSession(Number(control.dataset.sessionIndex));
    else if(action==='revoke-all') revokeAll();
    else if(action==='delete-account') deleteAccount();
    else if(action==='reset-all-data') resetAllData();
  });
  document.addEventListener('change',event=>{
    const control=event.target.closest('[data-lf-change]');
    if(!control) return;
    const action=control.dataset.lfChange;
    if(action==='repeat-fields') updateRepeatIntervalFields();
    else if(action==='task-done') toggleDone(Number(control.dataset.taskId));
    else if(action==='subtask-done') toggleSub(Number(control.dataset.taskId),Number(control.dataset.subtaskId));
    else if(action==='markdown-task') toggleMarkdownTask(Number(control.dataset.lineIndex),control.checked);
    else if(action==='note-move-folder') {lifeFlowNoteController?.moveToFolder(control.dataset.noteId,control.value);renderApp();}
    else if(action==='avatar-change') onAvatarChange(event);
    else if(action==='profile-timezone'){saveLocalizationField('timezone',control.value);lfSecretAction(control.value==='-'?'timezoneDash':'timezoneOther');}
    else if(action==='profile-language'){saveLocalizationField('language',control.value);lfSecretAction(control.value==='Cobalt'?'languageCobalt':'languageOther');}
    else if(action==='profile-week'){saveLocalizationField('weekStart',control.value);lfSecretAction(control.value==='Monday'?'weekMonday':'weekOther');}
    else if(action==='auto-theme-sync') setAutoThemeSync(control.checked);
    else if(action==='translucent-sidebar') setTranslucentSidebar(control.checked);
    else if(action==='interactive-atmosphere') setInteractiveAtmosphere(control.checked);
    else if(action==='ambient-mode') updateAmbientMode(control.checked);
    else if(action==='toggle-connected') toggleConnected(control.dataset.provider);
    else if(action==='auto-logout') saveAutoLogoutPreference(control.value);
  });
  document.addEventListener('keydown',event=>{
    const control=event.target.closest('[data-lf-keydown]');
    if(!control || event.key!=='Enter') return;
    if(control.dataset.lfKeydown==='add-subtask'){
      event.preventDefault();
      const value=control.value.trim();
      if(value) addSubtask(Number(control.dataset.taskId),value);
      control.value='';
    }else if(control.dataset.lfKeydown==='clock-ok'){
      event.preventDefault();clockOK();
    }else if(control.dataset.lfKeydown==='markdown-editor'){
      handleMarkdownKeydown(event);
    }else if(control.dataset.lfKeydown==='note-title-edit'){
      if(event.key==='Enter'){event.preventDefault();control.blur();}
      else if(event.key==='Escape'){control.dataset.cancel='1';control.blur();}
    }
  });
  document.addEventListener('input',event=>{
    const title=event.target.closest('[data-lf-input="note-title-live"]');
    if(title){updateKnowledgeTitle('regular',title.dataset.noteId,title.value);return;}
  });
  document.addEventListener('input',event=>{
    const control=event.target.closest('[data-lf-input="markdown-content"]');
    if(!control) return;
    updateKnowledgeNote('regular',control.dataset.noteId,control.value);
    handleNoteLinkAutocomplete(event);
    refreshMarkdownPreview();
  });
  document.addEventListener('input',event=>{
    const control=event.target.closest('[data-lf-input="notes-search"]');
    if(!control)return;
    scheduleNotesSearch(control);
  });
  document.addEventListener('input',event=>{
    const control=event.target.closest('[data-lf-input="ambient-intensity"]');
    if(control) updateAmbientIntensity(control.value);
  });
  document.addEventListener('focusout',event=>{
    const control=event.target.closest('[data-lf-blur]');
    if(!control) return;
    if(control.dataset.lfBlur==='note-title-live') renderApp();
    else if(control.dataset.lfBlur==='markdown-content') autoTitleKnowledgeNote(control.dataset.noteId,control.value);
  });
  document.addEventListener('dragstart',event=>{
    const card=event.target.closest('[data-lf-kanban-card]');
    if(card && event.dataTransfer){
      event.dataTransfer.effectAllowed='move';
      event.dataTransfer.setData('id',card.dataset.taskId);
      card.classList.add('dragging');
      return;
    }
    const control=event.target.closest('[data-lf-dragstart="task"]');
    if(control && event.dataTransfer) event.dataTransfer.setData('id',control.dataset.taskId);
  });
  document.addEventListener('dragend',event=>{
    const card=event.target.closest('[data-lf-kanban-card]');
    if(card) card.classList.remove('dragging');
  });
  document.addEventListener('dragover',event=>{
    const card=event.target.closest('[data-lf-kanban-card]');
    if(card){kanbanCardDragOver(event,card);return;}
    const column=event.target.closest('[data-lf-kanban-column]');
    if(column){kanbanDragOver(event,column);return;}
    if(event.target.closest('[data-lf-dragover="calendar-day"]')) event.preventDefault();
  });
  document.addEventListener('dragleave',event=>{
    const column=event.target.closest('[data-lf-kanban-column]');
    if(column) kanbanDragLeave(event,column);
  });
  document.addEventListener('drop',event=>{
    const card=event.target.closest('[data-lf-kanban-card]');
    if(card){kanbanCardDrop(event,card,card.dataset.columnStatus);return;}
    const column=event.target.closest('[data-lf-kanban-column]');
    if(column){kanbanDrop(event,column,column.dataset.columnStatus);return;}
    const control=event.target.closest('[data-lf-drop-day]');
    if(!control) return;
    event.preventDefault();
    const [year,month,day]=control.dataset.lfDropDay.split(',').map(Number);
    dropDay(event,year,month,day);
  });
}
document.addEventListener('contextmenu',event=>{
  const folder=event.target.closest?.('[data-lf-folder-context]');
  if(folder){event.preventDefault();openFolderContextMenu(event,folder.dataset.folderName);return;}
  const item=event.target.closest?.('[data-lf-note-context]');
  if(!item){closeNoteContextMenu();return;}
  event.preventDefault();openNoteContextMenu(event,item.dataset.noteId);
});
document.addEventListener('DOMContentLoaded',initTaskEventDelegation);

function initLoginAccessibility(){
  const appRoot=document.getElementById('app');
  if(appRoot){
    appRoot.addEventListener('click',event=>{
      const control=event.target.closest('[data-app-action]');
      if(!control || !appRoot.contains(control)) return;
      if(control.dataset.appAction==='export-csv') exportData('csv');
      else if(control.dataset.appAction==='export-json') exportData('json');
      else if(control.dataset.appAction==='logout') doLogout();
      else if(control.dataset.appAction==='set-view') setView(control.dataset.view);
      else if(control.dataset.appAction==='set-backdrop') setWorkspaceBackdrop(control.dataset.backdropId);
      else if(control.dataset.appAction==='undo-delete') undoDelete();
    });
  }
  document.addEventListener('click',event=>{
      const control=event.target.closest('[data-auth-action]');
      if(!control || !control.closest('#authScreen')) return;
      const handlers={
        'forgot-password':()=>showStep('stepForgot'),
        'toggle-login-password':()=>togglePasswordVisibility('loginPass',control),
        'start-signup':()=>startSignup(),
        'toggle-signup-password':()=>togglePasswordVisibility('signupPass',control),
        'signup-next-step-2':()=>showStep('stepSignup2'),
        'signup-back-to-login':()=>showStep('stepLogin'),
        'signup-next-step-3':()=>showStep('stepSignup3'),
        'signup-back-step-1':()=>showStep('stepSignup1'),
        'signup-submit':()=>doSignup(),
        'signup-back-step-2':()=>showStep('stepSignup2'),
        'verify-submit':()=>doVerify(),
        'reset-request':()=>sendReset(),
        'forgot-back-to-login':()=>showStep('stepLogin'),
        'reset-open':()=>showStep('stepReset'),
        'reset-submit':()=>doReset(),
        'reset-back-to-login':()=>showStep('stepLogin'),
        'oauth':()=>oauthLogin(control.dataset.authProvider)
      };
      const action=handlers[control.dataset.authAction];
      if(action) action();
    });
  document.addEventListener('input',event=>{
    if(event.target.matches('#authScreen [data-auth-input="signup-validation"]')) validateSignup1();
  });
  const form=document.getElementById('loginForm');
  if(form)form.addEventListener('submit',event=>{event.preventDefault();doLogin();});
  const password=document.getElementById('loginPass'),caps=document.getElementById('capsWarning');
  if(password&&caps){
    const check=event=>{caps.hidden=!(event.getModifierState&&event.getModifierState('CapsLock'));};
    password.addEventListener('keydown',check);password.addEventListener('keyup',check);password.addEventListener('blur',()=>{caps.hidden=true;});
  }
  ['loginEmail','loginPass','captchaAnswer'].forEach(id=>{
    const input=document.getElementById(id);
    if(input)input.addEventListener('input',()=>{if(input.getAttribute('aria-invalid')==='true')setLoginError('');});
  });
  updateLoginCaptcha();
  startLoginLockCountdown();
}
document.addEventListener('DOMContentLoaded',initLoginAccessibility);

const AUTO_LOGOUT_ACTIVITY_KEY='lifeflow2_last_activity';
let autoLogoutMonitorTimer=null;
let autoLogoutLastActivity=0;
let autoLogoutOverlay=null;
let autoLogoutActivityBound=false;
function autoLogoutLimitMs(){
  const value=currentUser()?.autoLogoutMinutes??30;
  if(value==='never')return Infinity;
  const minutes=Number(value);
  return [10,15,30,60].includes(minutes)?minutes*60000:30*60000;
}
function recordAutoLogoutActivity(){
  if(!getSession()||document.getElementById('app')?.classList.contains('lifeflow-stage-hidden'))return;
  autoLogoutLastActivity=Date.now();
  try{sessionStorage.setItem(AUTO_LOGOUT_ACTIVITY_KEY,String(autoLogoutLastActivity));}catch(_){}
  if(autoLogoutOverlay)hideAutoLogoutReminder();
}
function ensureAutoLogoutReminder(){
  if(autoLogoutOverlay?.isConnected)return autoLogoutOverlay;
  const overlay=document.createElement('div');
  overlay.id='autoLogoutReminder';
  overlay.className='auto-logout-overlay';
  overlay.hidden=true;
  overlay.innerHTML='<section class="auto-logout-dialog" role="dialog" aria-modal="true" aria-labelledby="autoLogoutTitle" aria-describedby="autoLogoutDescription"><div class="auto-logout-eyebrow"><span class="auto-logout-mark" aria-hidden="true">◈</span><span>SESSION REMINDER</span></div><h2 id="autoLogoutTitle">Still there?</h2><p id="autoLogoutDescription">You’ve been inactive for a while. For your security, LifeFlow will log you out soon.</p><div class="auto-logout-countdown"><strong id="autoLogoutCountdown">01:00</strong><span>Time remaining before logout</span></div><button type="button" class="primary auto-logout-stay" data-auto-logout-stay>I'm still here</button><p class="auto-logout-footnote">Otherwise, you'll be automatically logged out.</p></section>';
  document.body.appendChild(overlay);
  overlay.querySelector('[data-auto-logout-stay]')?.addEventListener('click',recordAutoLogoutActivity);
  autoLogoutOverlay=overlay;
  return overlay;
}
function hideAutoLogoutReminder(){
  if(!autoLogoutOverlay)return;
  autoLogoutOverlay.hidden=true;
  autoLogoutOverlay.classList.remove('is-visible');
}
function showAutoLogoutReminder(seconds){
  const overlay=ensureAutoLogoutReminder();
  const countdown=overlay.querySelector('#autoLogoutCountdown');
  const remaining=Math.max(0,Math.ceil(seconds));
  if(countdown)countdown.textContent=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');
  if(overlay.hidden){overlay.hidden=false;requestAnimationFrame(()=>overlay.classList.add('is-visible'));}
}
function autoLogoutTick(){
  if(!getSession()||document.getElementById('app')?.classList.contains('lifeflow-stage-hidden')){hideAutoLogoutReminder();return;}
  const limit=autoLogoutLimitMs();
  if(limit===Infinity){hideAutoLogoutReminder();return;}
  const remaining=limit-(Date.now()-autoLogoutLastActivity);
  if(remaining<=0){hideAutoLogoutReminder();doLogout();showToast('You were logged out after a period of inactivity.');return;}
  if(remaining<=60000)showAutoLogoutReminder(remaining/1000);
  else hideAutoLogoutReminder();
}
function startAutoLogoutMonitor(){
  if(!autoLogoutActivityBound){
    const activityEvents=['pointerdown','pointermove','keydown','input','change','scroll','touchstart','wheel'];
    activityEvents.forEach(type=>document.addEventListener(type,recordAutoLogoutActivity,{capture:true,passive:type==='scroll'||type==='touchstart'||type==='wheel'}));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)autoLogoutTick();});
    autoLogoutActivityBound=true;
  }
  try{autoLogoutLastActivity=Number(sessionStorage.getItem(AUTO_LOGOUT_ACTIVITY_KEY))||Date.now();}catch(_){autoLogoutLastActivity=Date.now();}
  if(!autoLogoutLastActivity)autoLogoutLastActivity=Date.now();
  if(autoLogoutMonitorTimer)clearInterval(autoLogoutMonitorTimer);
  autoLogoutMonitorTimer=setInterval(autoLogoutTick,1000);
  autoLogoutTick();
}
function stopAutoLogoutMonitor(){
  if(autoLogoutMonitorTimer){clearInterval(autoLogoutMonitorTimer);autoLogoutMonitorTimer=null;}
  hideAutoLogoutReminder();
  try{sessionStorage.removeItem(AUTO_LOGOUT_ACTIVITY_KEY);}catch(_){}
  autoLogoutLastActivity=0;
}
function saveAutoLogoutPreference(value){
  const normalized=value==='never'?'never':([10,15,30,60].includes(Number(value))?Number(value):30);
  updateUser(user=>{user.autoLogoutMinutes=normalized;});
  recordAutoLogoutActivity();
  showToast('Auto logout preference saved');
  autoLogoutTick();
}

function enterApp(){
  if(lifeFlowTaskStateManager){
    lifeFlowTaskStateManager.switchUser(state.currentUser || null);
    state = lifeFlowTaskStateManager.getState();
  }
  if(lifeFlowProfileManager) lifeFlowProfileManager.switchUser(state.currentUser || null);
  document.body.dataset.stage='workspace';
  document.title='LifeFlow';
  if(window.self!==window.top && new URLSearchParams(window.location.search).get('embed')==='1'){
    window.parent.postMessage({type:'lifeflow-authenticated'},window.location.origin);
    return;
  }
  document.body.classList.remove('auth-open');
  document.getElementById('authScreen').classList.add('lifeflow-stage-hidden');
  document.getElementById('app').classList.remove('lifeflow-stage-hidden');
  window.lifeFlowLoginEntry=true;
  renderApp();
  startAutoLogoutMonitor();
}
function resetAuthViewport(){
  window.scrollTo(0,0);
  if(document.scrollingElement) document.scrollingElement.scrollTop=0;
  document.documentElement.scrollTop=0;
  document.body.scrollTop=0;
}
function doLogout(){
  try{save();lifeFlowTaskStateManager?.flush?.();lifeFlowProfileManager?.flush?.();}catch(error){console.warn('LifeFlow could not flush all pending changes before logout:',error);}
  stopAutoLogoutMonitor();
  if(lifeFlowAuthController) lifeFlowAuthController.doLogout();
  else destroySession();
  if(lifeFlowTaskStateManager) lifeFlowTaskStateManager.switchUser(null);
  if(lifeFlowProfileManager) lifeFlowProfileManager.switchUser(null);
  document.body.dataset.stage='login-terminal';
  document.title='LifeFlow Login Terminal';
  // Clear workspace-only ambient state before showing the independent login terminal.
  ['data-ambient','data-load','data-time','data-density','data-glass-sidebar','data-interactive-atmosphere','data-mouse-light'].forEach(key=>document.documentElement.removeAttribute(key));
  ['--lf-load','--lf-ambient-intensity','--lf-theme-transition'].forEach(key=>document.documentElement.style.removeProperty(key));
  // Restore the independent authentication palette so the previous account's
  // workspace colour theme cannot leak onto the login screen.
  applyAuthTheme(getAuthTheme());
  document.body.classList.add('auth-open');
  document.getElementById('app').classList.add('lifeflow-stage-hidden');
  document.getElementById('authScreen').classList.remove('lifeflow-stage-hidden');
  resetAuthViewport();
  document.getElementById('oauthNotice').hidden=true;
  showStep('stepLogin');
  requestAnimationFrame(resetAuthViewport);
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
function normalizeDemoProfile(email){
  if(!email || !email.startsWith('demo_') || !email.endsWith('@lifeflow.local')) return;
  const users=getUsers();
  if(!users[email]) return;
  users[email].tier='Free';
  users[email].colorTheme='platinum';
  saveUsers(users);
}
function currentUser(){ const users=getUsers(); return users[state.currentUser]; }

let lifeFlowCoreReady = false;
let lifeFlowProfileManager = null;
let lifeFlowThemeController = null;
let lifeFlowTaskStateManager = null;
let lifeFlowTaskController = null;
const lifeFlowWorkspaceUnsubscribers = [];
function disposeWorkspaceSubscriptions(){
  while(lifeFlowWorkspaceUnsubscribers.length){
    const unsubscribe=lifeFlowWorkspaceUnsubscribers.pop();
    try{unsubscribe();}catch(error){console.warn('LifeFlow subscription cleanup failed:',error);}
  }
  lifeFlowThemeController?.destroy?.();
}
const LIFE_FLOW_APPEARANCE_KEYS = [
  'theme', 'autoTheme', 'colorTheme', 'ambient', 'workspaceBackdrop',
  'translucentSidebar', 'interactiveAtmosphere'
];
function readAppearancePreferences(user) {
  const preferences = {};
  if (!user || typeof user !== 'object') return preferences;
  LIFE_FLOW_APPEARANCE_KEYS.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(user, key)) {
      const value = user[key];
      preferences[key] = value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
    }
  });
  return preferences;
}
async function initializeThemeArchitecture() {
  const { StateManager } = await import('./state.js?v=20261107-modular-core-final1');
  lifeFlowProfileManager = new StateManager({
    currentUser: null,
    defaults: email => ({ currentUser: email || null, profile: {} }),
    storage: localStorage,
    saveDelay: 300,
    keyForUser: () => 'lifeflow2_users',
    loadState: email => ({ profile: readAppearancePreferences(getUsers()[email]) }),
    saveState: (snapshot, email) => {
      if (!email) return false;
      const users = getUsers();
      if (!users[email]) return false;
      Object.assign(users[email], readAppearancePreferences(snapshot.profile));
      saveUsers(users);
      return true;
    }
  });
  lifeFlowThemeController = window.LifeFlowThemeModule.createThemeController({
    profileState: lifeFlowProfileManager,
    getCurrentUser: currentUser,
    getTasks: () => state.tasks || [],
    systemTheme, renderApp, showToast, applyWorkspaceAppearance,
    backdropGroups: WORKSPACE_BACKDROP_GROUPS,
    defaultBackdropForTheme, getSession
  });
}
function syncAppearanceStateFromUser(user) {
  if (!lifeFlowProfileManager || !user) return;
  lifeFlowProfileManager.setState({ profile: readAppearancePreferences(user) });
  lifeFlowProfileManager.flush();
}

async function initializeTaskArchitecture() {
  const { StateManager } = await import('./state.js?v=20261107-modular-core-final1');
  lifeFlowTaskStateManager = new StateManager({
    currentUser: null,
    defaults: defaultProfileState,
    storage: localStorage,
    saveDelay: 300
  });
  lifeFlowTaskController = window.LifeFlowTasksModule.createTaskController({
    stateManager: lifeFlowTaskStateManager,
    getCurrentState: () => state,
    uid
  });
  lifeFlowWorkspaceUnsubscribers.push(lifeFlowTaskStateManager.subscribe('tasks', tasks => {
    const previousCount=Array.isArray(state.tasks)?state.tasks.length:0;
    state = { ...lifeFlowTaskStateManager.getState(), tasks: tasks || [] };
    if (getSession() && !document.getElementById('app')?.classList.contains('lifeflow-stage-hidden')) {
      const pending=window.lifeFlowTargetedTaskId;
      if(pending!==undefined&&pending!==null&&tasks.length===previousCount){
        window.LifeFlowTasksModule.updateTaskCompletion(pending,!!tasks.find(task=>String(task.id)===String(pending))?.done,document.getElementById('main'));
        window.lifeFlowTargetedTaskId=null;
      }else{
        window.lifeFlowTargetedTaskId=null;
        renderApp();
      }
    }
  }));
  const session = getSession();
  if (session?.email) {
    lifeFlowTaskStateManager.switchUser(session.email);
    state = lifeFlowTaskStateManager.getState();
  }
}
function updateWorkspaceState(patch) {
  if (lifeFlowTaskStateManager) {
    lifeFlowTaskStateManager.setState(patch);
    state = lifeFlowTaskStateManager.getState();
    lifeFlowTaskStateManager.flush();
    return state;
  }
  state = { ...state, ...patch };
  save();
  return state;
}


let lifeFlowViewOrchestrator = null;
function initializeUIArchitecture() {
  if(!window.LifeFlowUIModule)throw new Error('UI orchestrator module is unavailable.');
  lifeFlowViewOrchestrator=window.LifeFlowUIModule.createViewOrchestrator();
  window.LifeFlowTasksModule.configureRenderers({today:()=>renderToday(),list:()=>renderList(),board:()=>renderBoard(),calendar:()=>renderCalendar()});
  window.LifeFlowNotesModule.configureRenderers({notes:()=>renderNotesManager(),branches:()=>renderBranches()});
  window.LifeFlowAuthModule.configureRenderers({account:()=>renderAccount(),about:()=>renderAbout()});
  lifeFlowViewOrchestrator.configure({
    today:()=>window.LifeFlowTasksModule.render(state,'today'),
    list:()=>window.LifeFlowTasksModule.render(state,'list'),
    board:()=>window.LifeFlowTasksModule.render(state,'board'),
    calendar:()=>window.LifeFlowTasksModule.render(state,'calendar'),
    notes:()=>window.LifeFlowNotesModule.render(state,'notes'),
    branches:()=>window.LifeFlowNotesModule.render(state,'branches'),
    account:()=>window.LifeFlowAuthModule.render(state,'account'),
    about:()=>window.LifeFlowAuthModule.render(state,'about')
  });
}

let lifeFlowNoteController = null;
function initializeNotesArchitecture() {
  if (!lifeFlowTaskStateManager) throw new Error('Workspace StateManager is unavailable.');
  lifeFlowNoteController = window.LifeFlowNotesModule.createNotesController({
    stateManager: lifeFlowTaskStateManager, getCurrentState: () => state, uid
  });
  ['notes','codeNotes','noteLinks','folders','collapsedFolders','searchQuery','selectedNoteId','selectedNoteKind','noteView'].forEach(key => {
    lifeFlowWorkspaceUnsubscribers.push(lifeFlowTaskStateManager.subscribe(key, () => {
      state = lifeFlowTaskStateManager.getState();
      window.lfSelectedNote = state.selectedNoteId ?? null;
      window.lfNoteMode = state.selectedNoteKind || 'regular';
      window.lfNoteView = state.noteView || 'edit';
    }));
  });
  lifeFlowNoteController.ensure();
  window.lfSelectedNote = lifeFlowNoteController.selectedId();
  window.lfNoteMode = lifeFlowNoteController.selectedKind();
  window.lfNoteView = lifeFlowNoteController.noteView();
  if(!window.lfKnowledgeChangeListenerInstalled){
    window.addEventListener('lifeflow:knowledge-change',event=>{
      if(view==='notes'){refreshKnowledgeBacklinks();return;}
      if(view==='branches'){
        const previous={
          zoom:window.lfBranchesZoom||1,
          panX:window.lfBranchesPanX||0,
          panY:window.lfBranchesPanY||0,
          focusMode:!!window.lfBranchesFocusMode,
          focusedId:window.lfBranchesFocusedId??null,
          scrollLeft:document.querySelector('.branch-graph')?.scrollLeft||0,
          scrollTop:document.querySelector('.branch-graph')?.scrollTop||0
        };
        renderApp();
        requestAnimationFrame(()=>{
          window.lfBranchesZoom=previous.zoom;
          window.lfBranchesPanX=previous.panX;
          window.lfBranchesPanY=previous.panY;
          window.lfBranchesFocusMode=previous.focusMode;
          window.lfBranchesFocusedId=previous.focusedId;
          branchesApplyTransform();
          const button=document.querySelector('[data-lf-action="branches-focus-toggle"]');
          if(button){button.setAttribute('aria-pressed',String(previous.focusMode));button.classList.toggle('active',previous.focusMode);}
          if(previous.focusMode&&previous.focusedId)window.lfBranchesFocusNode?.(String(previous.focusedId));
          const next=document.querySelector('.branch-graph');
          if(next){next.scrollLeft=previous.scrollLeft;next.scrollTop=previous.scrollTop;}
        });
      }
    });
    window.lfKnowledgeChangeListenerInstalled=true;
  }
}
function selectedKnowledgeNote(kind='regular') { return lifeFlowNoteController?.getSelectedNote(kind) || null; }
let knowledgeVersionTimer=null,knowledgeVersionTimerNoteId=null;
function stopKnowledgeVersionTimer(){if(knowledgeVersionTimer!==null)window.clearTimeout(knowledgeVersionTimer);knowledgeVersionTimer=null;knowledgeVersionTimerNoteId=null;}
function startKnowledgeVersionTimer(id){
  if(!id)return;if(knowledgeVersionTimerNoteId!==String(id)){stopKnowledgeVersionTimer();knowledgeVersionTimerNoteId=String(id);}if(knowledgeVersionTimer!==null)return;
  const tick=()=>{knowledgeVersionTimer=null;if(view!=='notes'||String(lifeFlowNoteController?.selectedId())!==String(id)){stopKnowledgeVersionTimer();return;}const version=lifeFlowNoteController?.recordVersion(id,'10-minute-autosave');if(version)showToast('Note version saved');knowledgeVersionTimer=window.setTimeout(tick,600000);};
  knowledgeVersionTimer=window.setTimeout(tick,600000);
}
function selectKnowledgeNote(id,kind='regular',mode='edit') {
  if(!lifeFlowNoteController)return;
  if(String(lifeFlowNoteController.selectedId())!==String(id))stopKnowledgeVersionTimer();
  if(view==='branches'&&window.lfBranchesFocusMode)window.lfBranchesFocusedId=id==null?null:String(id);
  else if(view!=='branches'){window.lfBranchesFocusMode=false;window.lfBranchesFocusedId=null;}
  lifeFlowNoteController.select(id,kind,mode);
  window.lfSelectedNote=id??null;window.lfNoteMode=kind;window.lfNoteView=mode;
  renderApp();
}

function effectiveTheme(u){
  return lifeFlowThemeController?.effectiveTheme(u) ||
    (u?.autoTheme ? systemTheme() : (['dark','light','forest','paper'].includes(u?.theme)?u.theme:'dark'));
}
function applyTheme(theme){
  if(lifeFlowThemeController) return lifeFlowThemeController.applyTheme(theme);
  const allowed=['dark','light','forest','paper'];
  const u=currentUser();
  const actual=u?.autoTheme ? systemTheme() : (allowed.includes(theme)?theme:'dark');
  document.documentElement.setAttribute('data-theme',actual);
  document.documentElement.setAttribute('data-mouse-light',actual==='light'?'off':'on');
  if(actual==='light'){
    const app=document.getElementById('app');
    if(app){
      app.style.setProperty('--lf-pointer-x','50%');
      app.style.setProperty('--lf-pointer-y','35%');
      app.style.setProperty('--lf-depth-x','0px');
      app.style.setProperty('--lf-depth-y','0px');
    }
  }
  const entitledColors=['sapphire','emerald','platinum','amethyst','ruby'];
  let color=u?.colorTheme||'platinum';
  if(color==='gold') color='sapphire';
  if(color==='amethyst' && u && !['Premium','Team Admin'].includes(u.tier)) color='sapphire';
  document.documentElement.setAttribute('data-color-theme',entitledColors.includes(color)?color:'platinum');
  // Keep an explicit theme snapshot on the workspace stage. The public site and
  // login terminal use their own documents/stage state and never read this value.
  const workspace=document.getElementById('app');
  if(workspace){
    workspace.setAttribute('data-theme',actual);
    workspace.setAttribute('data-color-theme',entitledColors.includes(color)?color:'platinum');
  }
  document.documentElement.style.setProperty('--lf-theme-transition','1');
}
const WORKSPACE_BACKDROP_GROUPS={
  sapphire:[
    ['blue-hour','Blue Hour','Cobalt twilight and deep blue silhouettes']
  ],
  emerald:[
    ['green-hour','Green Hour','Sunlight filtering through a lush forest']
  ],
  platinum:[
    ['grey-hour','Grey Hour','Foggy trees and soft silver-grey tones']
  ],
  amethyst:[
    ['purple-hour','Purple Hour','Violet twilight and deep indigo silhouettes']
  ],
  ruby:[
    ['red-hour','Red Hour','Fiery red clouds above a dark horizon']
  ]
};
function normalizedBackdropTheme(u=currentUser()){
  const allowed=['sapphire','emerald','platinum','amethyst','ruby'];
  let theme=allowed.includes(u?.colorTheme)?u.colorTheme:'platinum';
  if(theme==='gold') theme='sapphire';
  if(theme==='amethyst' && u && !['Premium','Team Admin'].includes(u.tier)) theme='sapphire';
  return theme;
}
function workspaceBackdropOptions(u=currentUser()){
  const theme=normalizedBackdropTheme(u);
  const options=WORKSPACE_BACKDROP_GROUPS[theme]||WORKSPACE_BACKDROP_GROUPS.sapphire;
  const selected=options.some(([id])=>id===u?.workspaceBackdrop)?u.workspaceBackdrop:options[0][0];
  return options.map(([id,name,desc])=>`<button type="button" class="backdrop-option backdrop-${id} ${selected===id?'active':''}" data-app-action="set-backdrop" data-backdrop-id="${id}" aria-pressed="${selected===id}"><span class="backdrop-preview"><i></i><b></b><em></em></span><span class="backdrop-option-copy"><strong>${name}</strong><small>${desc}</small></span><b class="backdrop-check">${selected===id?'✓':'○'}</b></button>`).join('');
}
function defaultBackdropForTheme(theme){
  return (WORKSPACE_BACKDROP_GROUPS[theme]||WORKSPACE_BACKDROP_GROUPS.sapphire)[0][0];
}
function applyWorkspaceAppearance(u=currentUser()){
  const root=document.documentElement;
  const app=document.getElementById('app');
  const theme=normalizedBackdropTheme(u);
  const options=WORKSPACE_BACKDROP_GROUPS[theme]||WORKSPACE_BACKDROP_GROUPS.sapphire;
  const validIds=options.map(option=>option[0]);
  let backdrop=u?.workspaceBackdrop;
  if(!validIds.includes(backdrop)){
    // `darkMode` was never defined; this branch could throw before any page content rendered.
    backdrop=defaultBackdropForTheme(theme);
    if(u && u.workspaceBackdrop!==backdrop){
      const users=getUsers();
      if(users[state.currentUser]){
        users[state.currentUser].workspaceBackdrop=backdrop;
        saveUsers(users);
        syncAppearanceStateFromUser(users[state.currentUser]);
      }
    }
  }
  if(app) app.setAttribute('data-workspace-backdrop',backdrop);
  root.setAttribute('data-glass-sidebar',u?.translucentSidebar===false?'off':'on');
  root.setAttribute('data-interactive-atmosphere',u?.interactiveAtmosphere===false?'off':'on');
}
function setInteractiveAtmosphere(enabled){
  updateUser(u=>{u.interactiveAtmosphere=!!enabled;});
}
function initWorkspaceAtmosphereInteraction(){
  if(lifeFlowThemeController) return lifeFlowThemeController.initWorkspaceAtmosphereInteraction();
}
function setWorkspaceBackdrop(backdrop){
  const u=currentUser();
  const theme=normalizedBackdropTheme(u);
  const allowed=(WORKSPACE_BACKDROP_GROUPS[theme]||WORKSPACE_BACKDROP_GROUPS.sapphire).map(option=>option[0]);
  if(!allowed.includes(backdrop))return;
  updateUser(user=>{user.workspaceBackdrop=backdrop;});
}
function setTranslucentSidebar(enabled){
  updateUser(u=>{u.translucentSidebar=!!enabled;});
}
function setTheme(theme){
  if(lifeFlowThemeController) return lifeFlowThemeController.setTheme(theme);
}
function setAutoThemeSync(enabled){
  if(lifeFlowThemeController) return lifeFlowThemeController.setAutoThemeSync(enabled);
}
function initAppThemeSync(){
  if(!window.matchMedia)return;
  const mq=window.matchMedia('(prefers-color-scheme: light)');
  const onChange=()=>{ const u=currentUser(); if(u?.autoTheme && !document.getElementById('app')?.classList.contains('lifeflow-stage-hidden')) renderApp(); };
  mq.addEventListener?.('change',onChange);
  mq.addListener?.(onChange);
}
function setColorTheme(theme){
  if(lifeFlowThemeController) return lifeFlowThemeController.setColorTheme(theme);
}
function ambientSettings(u){
  return lifeFlowThemeController?.ambientSettings(u) ||
    Object.assign({ambientMode:true,ambientIntensity:'medium'},u?.ambient||{});
}
function applyAmbientEnvironment(){
  if(lifeFlowThemeController) return lifeFlowThemeController.applyAmbientEnvironment();
}
function themeLabel(theme){
  return lifeFlowThemeController?.themeLabel(theme) ||
    ({dark:'Nighttime',light:'Daytime',forest:'Quiet Forest',paper:'Warm Paper'})[theme]||'Nighttime';
}
function getAuthTheme(){ return localStorage.getItem('lifeflow2_auth_theme') || 'dark'; }
function systemTheme(){ return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
function applyAuthTheme(mode){
  const actual=mode==='auto' ? systemTheme() : mode;
  // Login Terminal owns a separate saved theme; do not call applyTheme(), which
  // belongs to the authenticated workspace stage.
  document.documentElement.setAttribute('data-theme',actual);
  document.documentElement.setAttribute('data-mouse-light',actual==='light'?'off':'on');
  document.documentElement.setAttribute('data-color-theme','platinum');
  const authScreen=document.getElementById('authScreen');
  if(authScreen){
    authScreen.setAttribute('data-auth-theme',actual);
    authScreen.setAttribute('data-auth-color-theme','platinum');
  }
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
function initThemePull(){
  const button=document.getElementById('themePull');
  if(!button||button.dataset.clickReady==='true')return;
  button.dataset.clickReady='true';
  const switchTheme=()=>{
    const user=currentUser();
    const next=(user?.theme||document.documentElement.dataset.theme||'dark')==='dark'?'light':'dark';
    button.classList.add('snap');
    if(user)updateUser(profile=>{profile.theme=next;profile.autoTheme=false;});
    else applyTheme(next);
    window.setTimeout(()=>button.classList.remove('snap'),300);
  };
  button.addEventListener('click',switchTheme);
  button.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){
      event.preventDefault();
      button.click();
    }
  });
}

function updateUser(fn){
  const users=getUsers();
  if(!users[state.currentUser]) return;
  fn(users[state.currentUser]);
  saveUsers(users);
  syncAppearanceStateFromUser(users[state.currentUser]);
  renderApp();
}

function uid(){ return Date.now()+Math.floor(Math.random()*1000); }
function addTask(task){ if(lifeFlowTaskController) lifeFlowTaskController.add(task); else { state.tasks.push(Object.assign({id:uid(),title:'',tags:[],priority:'medium',due:null,startTime:null,endTime:null,recur:'none',status:'todo',done:false,subtasks:[]},task)); save(); renderApp(); } }
function toggleDone(id){
  if(lifeFlowTaskController){window.lifeFlowTargetedTaskId=id;lifeFlowTaskController.toggleDone(id);}
  else{const task=state.tasks.find(item=>item.id===id);if(task){task.done=!task.done;save();renderApp();}}
}
let lastDeletedTask=null;
let lastDeletedTimer=null;
function deleteTask(id){
  const removed=lifeFlowTaskController ? lifeFlowTaskController.remove(id) : null;
  if(!removed)return;
  lastDeletedTask=removed;
  renderApp();
  showUndoToast('Task deleted');
}
function undoDelete(){
  if(!lastDeletedTask)return;
  if(lifeFlowTaskController) lifeFlowTaskController.restore(lastDeletedTask);
  lastDeletedTask=null;
  clearTimeout(lastDeletedTimer);lastDeletedTimer=null;
  document.getElementById('toastHost').innerHTML='';
  renderApp();
}
function showUndoToast(message){
  const host=document.getElementById('toastHost'); if(!host)return;
  clearTimeout(lastDeletedTimer);
  host.innerHTML='<div class="toast" role="status"><span>'+esc(message)+'</span><button class="undo-action" type="button" data-app-action="undo-delete">Undo</button></div>';
  lastDeletedTimer=setTimeout(()=>{lastDeletedTask=null;host.innerHTML='';},5000);
}
function addSubtask(id,text){ if(lifeFlowTaskController) lifeFlowTaskController.addSubtask(id,text); }
function toggleSub(tid,sid){ if(lifeFlowTaskController) lifeFlowTaskController.toggleSubtask(tid,sid); }

function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function intervalHtml(t){ return validTime(t.startTime)&&validTime(t.endTime)?`<span class="time-chip">◷ ${esc(t.startTime)}–${esc(t.endTime)}</span>`:''; }
function validTime(t){ return typeof t==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }
function validInterval(a,b){ return validTime(a)&&validTime(b)&&a<b; }
function fmtDate(iso){ if(!iso) return ''; const d=new Date(iso); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }

async function closeMasterRestorePreview(){document.getElementById('masterRestoreOverlay')?.remove();window.lfPendingMasterArchive=null;}
async function restoreMasterArchiveFile(file){
 if(!file)return;const input=document.getElementById('masterArchiveFile'),button=document.querySelector('[data-lf-action="choose-master-archive"]');
 if(button){button.disabled=true;button.textContent='Validating archive…';}
 try{
  if(file.size>25*1024*1024)throw new Error('The archive exceeds the 25 MB safety limit.');
  const raw=await new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(new Error('The selected file could not be read.'));r.onload=()=>resolve(String(r.result||''));r.readAsText(file);});
  let parsed;try{parsed=JSON.parse(raw);}catch(_){throw new Error('Invalid backup file. The file may be corrupted or from an incompatible version of LifeFlow.');}
  const {validateMasterArchive,normalizeMasterArchive}=await import('./state.js?v=20261108-validation-gate1');
  const {isEncryptedMasterArchive,decryptMasterArchive}=await import('./state.js?v=20261108-encrypted-backups1');
  if(isEncryptedMasterArchive(parsed)){const password=window.prompt('This backup is encrypted. Enter its backup password to continue:');if(password===null)throw new Error('Restore cancelled.');try{parsed=await decryptMasterArchive(parsed,password);}catch(error){throw error;}}
  const result=validateMasterArchive(parsed);if(!result.valid)throw new Error('Invalid backup file. '+result.errors.slice(0,4).join(' '));
  const archive=normalizeMasterArchive(parsed),d=archive.data;
  if(!d.state||typeof d.state!=='object'||Array.isArray(d.state))throw new Error('The archive is missing its complete workspace state.');
  window.lfPendingMasterArchive={archive,fileName:file.name};
  const overlay=document.createElement('div');overlay.id='masterRestoreOverlay';overlay.className='master-restore-overlay';
  overlay.innerHTML='<section class="master-restore-dialog" role="dialog" aria-modal="true" aria-labelledby="masterRestoreTitle"><span class="custom-kicker">VALIDATION COMPLETE</span><h2 id="masterRestoreTitle">Restore this archive?</h2><p class="master-restore-summary"></p><p class="master-restore-warning"><strong>This will permanently replace your current workspace data.</strong> This action cannot be undone. Login credentials and active sessions are not restored.</p>'+(result.warnings.length?'<p class="master-restore-warning">'+esc(result.warnings.join(' '))+'</p>':'')+'<div class="master-restore-actions"><button type="button" class="secondary" data-lf-action="cancel-master-restore">Cancel</button><button type="button" class="primary danger-action" data-lf-action="confirm-master-restore">Restore Now</button></div></section>';
  overlay.querySelector('.master-restore-summary').textContent='We found a valid backup from '+new Date(archive.metadata.timestamp).toLocaleString()+'. It contains '+d.tasks.length+' tasks and '+(d.notes.regular.length+d.notes.code.length)+' notes.';
  document.body.appendChild(overlay);overlay.querySelector('[data-lf-action="cancel-master-restore"]')?.focus();
 }catch(e){showToast(e.message||'Invalid backup file. The file may be corrupted or from an incompatible version of LifeFlow.');}
 finally{if(button){button.disabled=false;button.textContent='↥ Restore Backup';}if(input)input.value='';}
}
async function restoreMasterArchiveNow(){
 const pending=window.lfPendingMasterArchive;if(!pending)return;
 const button=document.querySelector('#masterRestoreOverlay [data-lf-action="confirm-master-restore"]');if(button){button.disabled=true;button.textContent='Restoring…';}
 try{
  if(!getSession()||!state?.currentUser)throw new Error('Please sign in again before restoring a backup.');
  const d=pending.archive.data;
  const sanitize=items=>items.map(n=>({...n,content:window.DOMPurify?window.DOMPurify.sanitize(String(n.content||''),{USE_PROFILES:{html:true}}):String(n.content||'')}));
  const restored={...d.state,currentUser:state.currentUser,tasks:d.tasks,notes:sanitize(d.notes.regular),codeNotes:sanitize(d.notes.code),folders:d.folders,noteLinks:d.noteLinks};
  delete restored.sessionToken;delete restored.passwordHash;
  const snap={timestamp:new Date().toISOString(),state:lifeFlowTaskStateManager?.getState?.()||state,profile:lifeFlowProfileManager?.getState?.()||null};
  sessionStorage.setItem('lifeflow_pre_restore_snapshot',JSON.stringify(snap));
  if(!lifeFlowTaskStateManager)throw new Error('Workspace state manager is unavailable.');
  lifeFlowTaskStateManager.replaceState(restored);if(!lifeFlowTaskStateManager.flush())throw new Error('LifeFlow could not save the restored workspace to browser storage.');
  const users=getUsers(),user=users[state.currentUser];
  if(user){const profile=d.profile||{},prefs=d.preferences||{};['name','bio','avatar','timezone','language','weekStart','workspace'].forEach(k=>{if(Object.prototype.hasOwnProperty.call(profile,k))user[k]=profile[k];});Object.assign(user,prefs);saveUsers(users);}
  if(lifeFlowProfileManager){lifeFlowProfileManager.setState({profile:readAppearancePreferences(user||{})});lifeFlowProfileManager.flush();}
  state=lifeFlowTaskStateManager.getState();closeMasterRestorePreview();showToast('Backup restored successfully. Reloading LifeFlow…');setTimeout(()=>window.location.reload(),450);
 }catch(e){if(button){button.disabled=false;button.textContent='Restore Now';}showToast(e.message||'Restore failed.');}
}
async function backupMasterArchive(){
  try{
    if(!state?.currentUser || !getSession()){showToast('Please sign in again before creating an archive.');return;}
    save(); lifeFlowTaskStateManager?.flush?.(); lifeFlowProfileManager?.flush?.();
    const { exportMasterArchive } = await import('./state.js?v=20261108-master-archive1');
    const user=currentUser()||{};
    const profile={name:user.name||'',bio:user.bio||'',avatar:user.avatar||null,timezone:user.timezone||'UTC',language:user.language||'en',weekStart:user.weekStart||'Sunday',workspace:user.workspace||'My Workspace',...(lifeFlowProfileManager?.getState?.().profile||{}),...readAppearancePreferences(user)};
    const options={workspaceState:lifeFlowTaskStateManager?.getState?.()||state,profile,appVersion:document.documentElement.dataset.appVersion||'1.0.0'};
    const secure=document.getElementById('masterArchiveSecure')?.checked;
    if(secure){const password=document.getElementById('masterArchivePassword')?.value||'',confirm=document.getElementById('masterArchivePasswordConfirm')?.value||'';if(password!==confirm)throw new Error('The backup passwords do not match.');if(password.length<10)throw new Error('Use a backup password with at least 10 characters.');await exportEncryptedMasterArchive({...options,password});}
    else exportMasterArchive(false,options);
    if(document.getElementById('masterArchivePassword'))document.getElementById('masterArchivePassword').value='';if(document.getElementById('masterArchivePasswordConfirm'))document.getElementById('masterArchivePasswordConfirm').value='';
    recordLastBackup();
    showToast(secure?'Encrypted archive created successfully. Keep your password safe.':'Archive created successfully. Keep this file in a safe place.');
  }catch(error){console.error('LifeFlow master archive export failed:',error);showToast(error?.message||'Archive could not be created. Please try again.');}
}
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

function hasPremiumAccess(u){ return !!u && (u.tier==='Premium' || u.tier==='Team Admin'); }
function renderNav(){
  const sidebar=document.querySelector('.app-sidebar'); if(!sidebar)return;
  sidebar.innerHTML='<div class="workspace-wordmark">LIFEFLOW</div><div class="navlabel">Workspace</div><nav id="nav" aria-label="Workspace"></nav><div class="sidebottom"><div class="sidebar-data"><div class="navlabel">Data & account</div><button class="sidebar-action" data-app-action="export-csv"><span class="nav-icon">⇩</span><span class="nav-text">Export CSV</span></button><button class="sidebar-action" data-app-action="export-json"><span class="nav-icon">⇩</span><span class="nav-text">Export JSON</span></button></div><button class="sidebar-action logout" data-app-action="logout"><span class="nav-icon">↪</span><span class="nav-text">Log out</span></button></div>';
  const u=currentUser(),tabs=[['today','Today','◈'],['list','Tasks','☷'],['calendar','Calendar','▦'],['board','Board','▥']];
  if(hasPremiumAccess(u)){tabs.push(['branches','Your Branches','⌘'],['notes','Notes Manager','▤']);}
  tabs.push(['account','Profile & settings','◎']);
  document.getElementById('nav').innerHTML=tabs.map(function(x){return '<button type="button" title="'+x[1]+'" aria-label="'+x[1]+'" class="'+(view===x[0]?'active':'')+'" data-app-action="set-view" data-view="'+x[0]+'"><span class="nav-icon">'+x[2]+'</span><span class="nav-text">'+x[1]+'</span></button>';}).join('');
}
function setView(v){const u=currentUser();if((v==='branches'||v==='notes')&&!hasPremiumAccess(u)){toast('This feature is available to Premium and Team Admin accounts.');return;}view=v;clearNewTimes();renderApp();}
function taskFormHtml(){
  return `<div class="card new-task-card"><h2>New Task</h2>
    <div class="new-task-fields">
      <input id="nt_title" aria-label="Task title" placeholder="Task title" autocomplete="off">
      <label class="task-field-select"><span>Start date</span><input id="nt_startDate" type="date" aria-label="Start date"></label>
      <label class="task-field-select"><span>Due date</span><input id="nt_due" type="date" aria-label="Due date" data-lf-change="repeat-fields"></label>
      <label class="task-field-select" aria-label="Priority"><span>Priority</span><select id="nt_pri"><option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option></select></label>
    </div>
    <div id="nt_repeatInterval" class="repeat-interval">
      <div class="repeat-field">
        <label for="nt_interval">Interval</label>
        <select id="nt_interval" aria-label="Repeat interval" data-lf-change="repeat-fields">
          <option value="week">One week (starting today)</option>
          <option value="month">One month (starting today)</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div id="nt_repeatEndWrap" class="repeat-field repeat-end" hidden>
        <label for="nt_repeatEnd">End date</label>
        <input id="nt_repeatEnd" type="date" aria-label="Repeat end date">
      </div>
    </div>
    <div class="time-fields new-task-time"><span class="time-label">Time</span>
      <button type="button" id="nt_start" data-lf-action="open-new-start">Start</button><span>to</span>
      <button type="button" id="nt_end" data-lf-action="open-new-end">End</button>
      <input id="nt_tags" class="new-task-tags" aria-label="Tags" placeholder="Tags">
      <button class="clear-timing" type="button" data-lf-action="clear-new-times" aria-label="Clear timing">Clear timing</button>
    </div>
    <div id="nt_timeError" class="time-error" role="alert"></div>
    <div class="new-task-actions"><button class="primary" data-lf-action="submit-task" aria-label="Add task">Add</button></div></div>`;
}
let newTaskTimes={start:'',end:''};
function clearNewTimes(){ newTaskTimes={start:'',end:''}; updateNewTimeButtons(); }
function updateNewTimeButtons(){
  const a=document.getElementById('nt_start'), b=document.getElementById('nt_end');
  if(a) a.textContent=newTaskTimes.start||'Start time';
  if(b) b.textContent=newTaskTimes.end||'End time';
  const e=document.getElementById('nt_timeError'); if(e)e.textContent='';
}
function dateInputToLocalDate(value){
  const [y,m,d]=String(value||'').split('-').map(Number);
  return y&&m&&d ? new Date(y,m-1,d) : null;
}
function dateToIsoDay(d){
  return new Date(d.getFullYear(),d.getMonth(),d.getDate()).toISOString();
}
function repeatEndDate(start,mode){
  const end=new Date(start);
  if(mode==='week') end.setDate(end.getDate()+6);
  else if(mode==='month'){
    const day=start.getDate();
    end.setDate(1);
    end.setMonth(end.getMonth()+1);
    end.setDate(day-1);
  }
  return end;
}
function recurringDates(start,end,recur){
  const dates=[];
  const d=new Date(start);
  while(d<=end){
    dates.push(new Date(d));
    if(recur==='daily') d.setDate(d.getDate()+1);
    else if(recur==='weekly') d.setDate(d.getDate()+7);
    else if(recur==='monthly'){
      const day=d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth()+1);
      d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));
    }else break;
  }
  return dates;
}
function updateRepeatIntervalFields(){
  const recur='daily';
  const box=document.getElementById('nt_repeatInterval');
  const interval=document.getElementById('nt_interval');
  const endWrap=document.getElementById('nt_repeatEndWrap');
  const end=document.getElementById('nt_repeatEnd');
  const due=document.getElementById('nt_due')?.value||'';
  if(!box)return;
  box.hidden=recur==='none';
  if(end) end.min=due||new Date().toISOString().slice(0,10);
  if(interval && interval.value==='other' && endWrap) endWrap.hidden=false;
  else if(endWrap) endWrap.hidden=true;
}
function submitTask(){
  const title = document.getElementById('nt_title').value.trim();
  if(!title) return;
  const startValue = document.getElementById('nt_startDate')?.value||'';
  const dueValue = document.getElementById('nt_due').value;
  const tags = document.getElementById('nt_tags')?.value.split(',').map(s=>s.trim()).filter(Boolean)||[];
  const recur='daily';
  const interval=document.getElementById('nt_interval')?.value||'week';
  const startDate=dateInputToLocalDate(startValue)||new Date();
  startDate.setHours(0,0,0,0);
  const dueDate=dateInputToLocalDate(dueValue);
  if(dueDate){dueDate.setHours(0,0,0,0);if(dueDate<startDate){toast('Due date must be on or after the start date.');return;}}
  if((newTaskTimes.start||newTaskTimes.end) && !validInterval(newTaskTimes.start,newTaskTimes.end)){document.getElementById('nt_timeError').textContent='Choose both times, with the end after the start (same day).';return;}
  if(recur==='none'){
    addTask({title, startDate:dateToIsoDay(startDate), due:dueDate?dateToIsoDay(dueDate):null, startTime:newTaskTimes.start||null, endTime:newTaskTimes.end||null, priority:document.getElementById('nt_pri').value, recur:'none', tags});
    clearNewTimes();
    return;
  }
  let endDate;
  if(interval==='other'){
    endDate=dateInputToLocalDate(document.getElementById('nt_repeatEnd')?.value);
    if(!endDate){ toast('Choose an end date for the repeat interval.'); return; }
  }else endDate=repeatEndDate(startDate,interval);
  endDate.setHours(0,0,0,0);
  if(endDate<startDate){ toast('The repeat end date must be on or after the start date.'); return; }
  const dates=recurringDates(startDate,endDate,recur);
  const base={title,tags,priority:document.getElementById('nt_pri').value,startTime:newTaskTimes.start||null,endTime:newTaskTimes.end||null,status:'todo',done:false,subtasks:[],repeatPattern:recur,repeatEnd:dateToIsoDay(endDate)};
  const recurringTasks=dates.map(d=>Object.assign({id:uid(),startDate:dateToIsoDay(d),due:dueDate?dateToIsoDay(dueDate):dateToIsoDay(d),recur:'none'},base));
  if(lifeFlowTaskController) lifeFlowTaskController.addMany(recurringTasks);
  else { state.tasks.push(...recurringTasks); save(); }
  clearNewTimes();
  renderApp();
}
function taskRow(t){
  const overdue=!!(t.due && new Date(t.due)<new Date() && !t.done);
  const priorityLabel=t.priority==='high'?'High':t.priority==='medium'?'Medium':'Low';
  const subDone=t.subtasks.filter(s=>s.done).length;
  const subTotal=t.subtasks.length;
  return '<div class="task '+(t.done?'done ':'')+(overdue?'overdue ':'')+'priority-'+t.priority+'" data-task-id="'+t.id+'" tabindex="0">'+
    '<span class="task-priority-dot" aria-hidden="true" title="'+priorityLabel+' priority"></span>'+
    '<input type="checkbox" '+(t.done?'checked':'')+' data-lf-change="task-done" data-task-id="'+t.id+'" aria-label="Toggle task completion">'+
    '<div class="task-body"><div class="task-title-line"><div class="title">'+esc(t.title)+'</div>'+((t.recur!=='none'||t.repeatPattern)?'<span class="recurrence-badge" title="Recurring task">↻</span>':'')+(subTotal?'<span class="subtask-count" title="'+subDone+' of '+subTotal+' subtasks complete">'+subDone+'/'+subTotal+'</span>':'')+'</div>'+
    '<div class="meta"><span class="priority-label">'+priorityLabel+'</span>'+(t.due?'<span class="'+(overdue?'due-overdue':'')+'">'+(overdue?'Overdue · ':'')+fmtDate(t.due)+'</span>':'')+intervalHtml(t)+((t.recur!=='none'||t.repeatPattern)?'<span class="recurrence-text">↻ '+esc(t.repeatPattern||t.recur)+'</span>':'')+t.tags.map(g=>'<span>#'+esc(g)+'</span>').join('')+'</div>'+
    (subTotal?'<div class="subtask-list">'+t.subtasks.map(s=>'<label class="sub"><input type="checkbox" '+(s.done?'checked':'')+' data-lf-change="subtask-done" data-task-id="'+t.id+'" data-subtask-id="'+s.id+'"> <span>'+esc(s.text)+'</span></label>').join('')+'</div>':'')+
    '<div class="subtask-add"><input placeholder="+ add subtask" aria-label="Add subtask" data-lf-keydown="add-subtask" data-task-id="'+t.id+'"></div></div>'+
    '<button class="del task-action" data-lf-action="edit-task-time" data-task-id="'+t.id+'" aria-label="Edit time">◷</button><button class="del task-action" data-lf-action="delete-task" data-task-id="'+t.id+'" aria-label="Delete task">✕</button></div>';
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
        <div class="hero-ring progress-pct-${percent}"><span>${percent}%</span></div>
      </div>
    </section>
    ${overloaded?`<div class="workload-warning"><div class="load-icon">!</div><div><strong>Your day is getting full</strong><span>${esc(loadReasons.join(' · '))}. Consider protecting some space before adding more.</span></div></div>`:''}<div class="today-grid"><div>${taskFormHtml()}<div class="card"><div class="section-heading"><div><h2>Today's tasks</h2><p>${activeDueToday.length? 'Stay focused on what needs your attention.':dueToday.length?'You are all caught up for today.':'You have a clear slate.'}</p></div><span class="section-count">${activeDueToday.length}</span></div>${activeDueToday.length?'<div class="task-scroll">'+activeDueToday.map(taskRow).join('')+'</div>':'<div class="empty empty-soft">'+(dueToday.length?'All today’s tasks are done.':'Nothing due today. Add a task to get started.')+'</div>'}</div>
    ${overdue.length?`<div class="card"><h2>Overdue (${overdue.length})</h2><div class="task-scroll">${overdue.map(taskRow).join('')}</div></div>`:''}<div class="card"><h2>Upcoming</h2>${upcoming.length?'<div class="task-scroll">'+upcoming.map(taskRow).join('')+'</div>':'<div class="empty">Nothing upcoming.</div>'}</div></div>
    <div><div class="card"><h2>Daily progress</h2><div class="statgrid"><div class="stat"><b>${dueToday.length}</b><small>Due today</small></div><div class="stat"><b>${completed}</b><small>Done</small></div><div class="stat"><b>${Math.round(minutes/60*10)/10}h</b><small>Scheduled</small></div></div><div class="progress-track" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span class="progress-fill progress-pct-${percent}"></span></div><small class="meta">${percent}% of today's tasks complete</small></div>
    <div class="card"><h2>Schedule</h2>${scheduled.length?'<div class="schedule-scroll">'+scheduled.map(t=>'<div class="event"><b>'+esc(t.title)+'</b><small>'+esc(t.startTime)+'–'+esc(t.endTime)+'</small></div>').join('')+'</div>':'<div class="empty">No time intervals today.</div>'}</div></div></div>`;
}

function completeAllTasks(){
  const count=lifeFlowTaskController ? lifeFlowTaskController.completeAll() : 0;
  if(!count){toast('All tasks are already completed.');return;}
  renderApp();toast(count+' task'+(count===1?'':'s')+' marked as completed.');
}
function clearCompletedTasks(){
  const count=lifeFlowTaskController ? lifeFlowTaskController.clearCompleted() : 0;
  if(!count){toast('No completed tasks to clear.');return;}
  renderApp();toast(count+' completed task'+(count===1?'':'s')+' cleared.');
}
function renderList(){
  const today=new Date();
  today.setHours(0,0,0,0);
  const list = state.tasks
    .filter(t=>Array.isArray(t.tags)&&t.tags.includes('Task Master') || !t.due || new Date(t.due)>=today)
    .sort((a,b)=>(a.done-b.done)||((a.due?new Date(a.due):Infinity)-(b.due?new Date(b.due):Infinity)));
  const completedCount=state.tasks.filter(t=>t.done).length;
  return `<div class="card"><div class="section-heading"><div><h2>All Tasks (${list.length})</h2></div><div class="task-toolbar-actions"><button type="button" class="complete-all-button" data-lf-action="complete-all" ${list.some(t=>!t.done)?'':'disabled'}>Complete all</button><button type="button" class="clear-completed-button" data-lf-action="clear-completed" ${completedCount?'':'disabled'}>Clear completed tasks${completedCount?' ('+completedCount+')':''}</button></div></div>${list.length?list.map(taskRow).join(''):'<div class="empty">No current or upcoming tasks.</div>'}</div>`;
}

function renderBoard(){
  const cols=[['todo','To Do'],['doing','Doing'],['done','Done']];
  return '<div class="card"><div class="board-heading"><div><h2>Kanban Board</h2><p>Move work through the flow. Drop cards anywhere inside a column to update status.</p></div></div><div class="board">'+cols.map(([k,l])=>
    '<div class="col col-'+k+'" data-lf-kanban-column="'+k+'">'+
      '<h3><span class="col-title">'+l+'</span></h3><div class="col-drop-hint">Drop anywhere in this column</div>'+
      state.tasks.filter(t=>t.status===k).map(t=>'<div class="kcard priority-'+t.priority+' '+(t.done?'done':'')+'" draggable="true" data-lf-kanban-card="true" data-task-id="'+t.id+'" data-column-status="'+k+'">'+
        '<div class="kcard-title"><span class="task-priority-dot" aria-hidden="true"></span>'+esc(t.title)+((t.recur!=='none'||t.repeatPattern)?'<span class="recurrence-badge">↻</span>':'')+'</div>'+
        '<div class="meta"><span class="priority-label">'+t.priority+'</span>'+(t.due?'<span>'+fmtDate(t.due)+'</span>':'')+intervalHtml(t)+'</div>'+(t.subtasks.length?'<div class="k-subprogress">'+t.subtasks.filter(s=>s.done).length+'/'+t.subtasks.length+' subtasks</div>':'')+
        '<button class="linklike" data-lf-action="edit-task-time" data-task-id="'+t.id+'">Edit time</button></div>').join('')+'</div>').join('')+'</div></div>';
}
function kanbanDragOver(e,col){
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  col.classList.add('drag-over');
}
function kanbanDragLeave(e,col){
  const next=e.relatedTarget;
  if(next && col.contains(next)) return;
  col.classList.remove('drag-over');
}
function kanbanDrop(e,col,targetStatus){
  e.preventDefault();
  e.stopPropagation();
  col.classList.remove('drag-over');
  dropCol(e,targetStatus);
}
function kanbanCardDragOver(e,card){
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect='move';
  card.closest('.col')?.classList.add('drag-over');
}
function kanbanCardDrop(e,card,targetStatus){
  e.preventDefault();
  e.stopPropagation();
  const col=card.closest('.col');
  col?.classList.remove('drag-over');
  dropCol(e,targetStatus);
}
function dropCol(e,col){
  const id=+e.dataTransfer.getData('id');
  if(lifeFlowTaskController && lifeFlowTaskController.update(id,{status:col,done:col==='done'})) renderApp();
}

function renderCalendar(){
  const first=new Date(calYear,calMonth,1);
  const u=currentUser();
  const weekStartsMonday=u?.weekStart==='Monday';
  const startDow=weekStartsMonday?(first.getDay()+6)%7:first.getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const monthName=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  const monthTasks=state.tasks.filter(t=>{
    if(!t.due)return false;
    const date=new Date(t.due);
    return !Number.isNaN(date.getTime())&&date.getFullYear()===calYear&&date.getMonth()===calMonth;
  });
  const isDone=t=>!!(t.done||t.status==='done');
  const scheduledDays=new Set(monthTasks.map(t=>new Date(t.due).getDate()));
  const busiestDay=Math.max(0,...Array.from({length:daysInMonth},(_,i)=>monthTasks.filter(t=>new Date(t.due).getDate()===i+1).length));
  const modeToggle=`<div class="cal-mode-switch" role="group" aria-label="Calendar view">
    <button type="button" class="cal-mode ${calendarMode==='month'?'active':''}" data-lf-action="calendar-mode" data-calendar-mode="month" aria-pressed="${calendarMode==='month'}"><span>▦</span> Month</button>
    <button type="button" class="cal-mode ${calendarMode==='agenda'?'active':''}" data-lf-action="calendar-mode" data-calendar-mode="agenda" aria-pressed="${calendarMode==='agenda'}"><span>☷</span> Agenda</button>
  </div>`;
  let body='';
  if(calendarMode==='month'){
    let cells='';
    for(let i=0;i<startDow;i++)cells+='<div class="cal-empty" aria-hidden="true"></div>';
    for(let d=1;d<=daysInMonth;d++){
      const cellDate=new Date(calYear,calMonth,d);
      const dayTasks=monthTasks.filter(t=>new Date(t.due).getDate()===d);
      const dayOpen=dayTasks.filter(t=>!isDone(t)).length;
      const dayDone=dayTasks.length-dayOpen;
      const isToday=cellDate.toDateString()===new Date().toDateString();
      const workload=!dayTasks.length?'is-clear':dayOpen===0?'is-complete':dayOpen>=4?'is-busy':'has-open';
      const shown=dayTasks.slice(0,2);
      cells+=`<div class="cal-day ${isToday?'today':''} ${workload}" data-lf-dragover="calendar-day" data-lf-drop-day="${calYear},${calMonth},${d}" aria-label="${cellDate.toLocaleDateString(undefined,{dateStyle:'full'})}: ${dayTasks.length} scheduled tasks, ${dayOpen} open, ${dayDone} completed">
        <div class="cal-date-row"><div class="dnum">${d}</div>${dayTasks.length?'<span class="cal-day-count">'+dayTasks.length+'</span>':''}</div>
        <div class="cal-tasks">${shown.map(t=>`<div class="citem ${isDone(t)?'is-done':''}" draggable="true" data-lf-dragstart="task" data-task-id="${t.id}"><span class="cal-task-title">${esc(t.title)}</span>${intervalHtml(t)?`<div>${intervalHtml(t)}</div>`:''}</div>`).join('')}${dayTasks.length>2?'<span class="cal-more">+'+(dayTasks.length-2)+' more</span>':''}</div>
        ${dayTasks.length?'<div class="cal-day-load"><span style="width:'+Math.min(100,dayTasks.length/Math.max(1,busiestDay)*100)+'%"></span></div>':''}
      </div>`;
    }
    const trailing=(7-((startDow+daysInMonth)%7))%7;
    for(let i=0;i<trailing;i++)cells+='<div class="cal-empty" aria-hidden="true"></div>';
    body=`<div class="calendar-wrap"><div class="cal-grid">${(weekStartsMonday?['MON','TUE','WED','THU','FRI','SAT','SUN']:['SUN','MON','TUE','WED','THU','FRI','SAT']).map((d,i)=>`<div class="dow" role="columnheader" aria-label="${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][(i+(weekStartsMonday?1:0))%7]}">${d}</div>`).join('')}${cells}</div></div>`;
  }else{
    const grouped=[];
    const sorted=monthTasks.slice().sort((a,b)=>new Date(a.due)-new Date(b.due));
    sorted.forEach(task=>{
      const date=new Date(task.due),key=date.getDate();
      let group=grouped.find(g=>g.day===key);
      if(!group){group={day:key,date,tasks:[]};grouped.push(group);}
      group.tasks.push(task);
    });
    body=grouped.length?`<div class="cal-agenda">${grouped.map(group=>`<section class="cal-agenda-day"><div class="cal-agenda-date"><strong>${group.date.toLocaleDateString(undefined,{weekday:'short'})}</strong><span>${group.day}</span><small>${group.date.toLocaleDateString(undefined,{month:'short'})}</small></div><div class="cal-agenda-items">${group.tasks.map(t=>`<div class="cal-agenda-item ${isDone(t)?'is-done':''}" draggable="true" data-lf-dragstart="task" data-task-id="${t.id}"><span class="cal-agenda-time">${validTime(t.startTime)?t.startTime:'All day'}${validTime(t.endTime)?' – '+t.endTime:''}</span><span class="cal-agenda-title">${esc(t.title)}</span><span class="cal-agenda-status">${isDone(t)?'Completed':'Scheduled'}</span></div>`).join('')}</div></section>`).join('')}</div>`:'<div class="cal-agenda-empty"><strong>No scheduled items this month</strong><span>Tasks with due dates will appear here.</span></div>';
  }
  return `<div class="card calendar-card">
    <div class="cal-topbar"><div class="cal-head"><button class="hbtn" data-lf-action="shift-month" data-month-delta="-1" aria-label="Previous month">‹</button><strong>${monthName}</strong><button class="hbtn" data-lf-action="shift-month" data-month-delta="1" aria-label="Next month">›</button></div>${modeToggle}</div>
    <div class="cal-context-strip"><span><strong>${monthTasks.length}</strong> scheduled</span><span><strong>${scheduledDays.size}</strong> active days</span><span><strong>${busiestDay}</strong> peak daily load</span></div>
    ${body}
    ${calendarMode==='month'?'<div class="cal-legend"><span><i class="open-dot"></i> Open commitments</span><span><i class="done-dot"></i> Completed</span><span><i class="clear-dot"></i> No scheduled tasks</span></div>':''}
    <div class="notice">Calendar shows when your dated tasks happen. Manage task details and workflow in Today, Tasks and Kanban.</div>
  </div>`;
}
function shiftMonth(n){ calMonth+=n; if(calMonth<0){calMonth=11;calYear--;} if(calMonth>11){calMonth=0;calYear++;} renderApp(); }
function dropDay(e,y,m,d){
  const id=+e.dataTransfer.getData('id');
  if(lifeFlowTaskController && lifeFlowTaskController.update(id,{due:new Date(y,m,d).toISOString()})) renderApp();
}

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
  host.innerHTML=`<div class="time-edit" role="presentation" data-lf-overlay="close-time-editor"><div class="time-edit-card" role="dialog" aria-modal="true" aria-label="Edit task time interval">
    <h2>Edit time: ${esc(t.title)}</h2><div class="time-fields"><button data-lf-action="open-edit-start">${timeEdit.start||'Start time'}</button><span>to</span><button data-lf-action="open-edit-end">${timeEdit.end||'End time'}</button></div>
    <div class="time-error" id="editTimeError" role="alert"></div><div class="time-edit-actions"><button data-lf-action="clear-task-times">Clear interval</button><button data-lf-action="close-time-editor">Cancel</button><button class="primary" data-lf-action="save-task-times">Save</button></div>
  </div></div>`;
}
function closeTimeEditor(){timeEdit=null;renderTimeEditor();}
function clearTaskTimes(){
  if(!lifeFlowTaskController || !timeEdit)return;
  lifeFlowTaskController.update(timeEdit.id,{startTime:null,endTime:null});
  closeTimeEditor();renderApp();
}
function saveTaskTimes(){
  if(!validInterval(timeEdit.start,timeEdit.end)){document.getElementById('editTimeError').textContent='Choose a start and end time, with the end after the start (same day).';return;}
  if(!lifeFlowTaskController || !timeEdit)return;
  lifeFlowTaskController.update(timeEdit.id,{startTime:timeEdit.start,endTime:timeEdit.end});
  closeTimeEditor();renderApp();
}
function currentLocalClockTime(){
  const now=new Date();
  const roundedMinutes=Math.round(now.getMinutes()/5)*5;
  const roundedTime=new Date(now);
  roundedTime.setMinutes(roundedMinutes,0,0);
  return String(roundedTime.getHours()).padStart(2,'0')+':'+String(roundedTime.getMinutes()).padStart(2,'0');
}
function timePlusOneHour(value){
  const [hour,minute]=value.split(':').map(Number);
  return String((hour+1)%24).padStart(2,'0')+':'+String(minute).padStart(2,'0');
}
function openClock(target,field){
  const stored=target==='new'?newTaskTimes:timeEdit; if(!stored)return;
  const startDefault=stored.start||currentLocalClockTime();
  const initial=stored[field]||(field==='start'?startDefault:timePlusOneHour(startDefault));
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
    numbers.push(`<button type="button" class="clock-number ${selected===n?'selected':''}" data-clock-position="${radius===39?'outer':'inner'}-${Math.round(angle/(Math.PI/6))%12}" aria-label="${active==='hour'?'Hour':'Minute'} ${String(n).padStart(2,'0')}" data-lf-action="select-clock-value" data-clock-value="${n}">${label}</button>`);
  };
  if(active==='hour'){
    for(let i=0;i<12;i++){let angle=i*Math.PI/6; add(i,angle,39,String(i));add(i+12,angle,26,String(i+12));}
  }else for(let i=0;i<12;i++) add(i*5,i*Math.PI/6,39,String(i*5).padStart(2,'0'));
  const angle=(active==='hour'?(hour%12):minute/5)*Math.PI/6;
  const radius=active==='hour'?(hour>=12?26:39):39;
  const handKey=active==='hour'?'hour-'+hour:'minute-'+minute;
  const hand=`<div class="clock-hand" data-clock-hand="${handKey}"></div><div class="clock-center"></div>`;
  document.getElementById('clockHost').innerHTML=`<div class="clock-overlay" role="presentation" data-lf-overlay="close-clock"><div class="clock-dialog" role="dialog" aria-modal="true" aria-label="Select ${field} time">
    <h2>Select ${field} time</h2><div class="clock-subtitle">24-hour clock · ${field==='start'?'Choose when this task starts':'Choose when this task ends'}</div>
    <div class="clock-display"><button type="button" class="${active==='hour'?'active':''}" data-lf-action="clock-hour" aria-label="Select hour">${String(hour).padStart(2,'0')}</button><span>:</span><button type="button" class="${active==='minute'?'active':''}" data-lf-action="clock-minute" aria-label="Select minute">${String(minute).padStart(2,'0')}</button></div>
    ${keyboard?`<div class="clock-keyboard"><input id="clockInput" type="time" aria-label="Time in 24-hour format" value="${clockValue()}" data-lf-keydown="clock-ok"></div>`:`<div class="clock-dial" id="clockDial" role="group" aria-label="${active} dial">${hand}${numbers.join('')}</div>`}
    <div id="clockError" class="time-error" role="alert"></div><div class="clock-footer"><button type="button" class="clock-mode" data-lf-action="toggle-clock-input" aria-label="${keyboard?'Use clock dial':'Use keyboard input'}" title="${keyboard?'Use clock dial':'Use keyboard input'}">${keyboard?'◷':'⌨'}</button><button type="button" data-lf-action="close-clock">Cancel</button><button type="button" data-lf-action="clock-ok">OK</button></div>
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
  if(!getSession())return;
  applyDensity();renderNav();
  const names={today:'Today',list:'Tasks',calendar:'Calendar',board:'Board',branches:'Your Branches',notes:'Notes Manager',account:'Profile & settings',about:'Why LifeFlow'};
  document.getElementById('pageTitle').textContent=names[view]||'LifeFlow';
  const u=currentUser();applyTheme(temporaryTheme||u?.theme||'dark');applyWorkspaceAppearance(u);initWorkspaceAtmosphereInteraction();applyAmbientEnvironment();
  document.getElementById('pageSubtitle').textContent=view==='today'?new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}):'';
  const el=document.getElementById('main');
  if(!lifeFlowViewOrchestrator)initializeUIArchitecture();
  lifeFlowViewOrchestrator.render({view,state,container:el,onAfterRender:activeView=>{
    if(activeView==='branches')initBranchesGraph(el);
    if(activeView==='notes'){const preview=el.querySelector('#kn_preview');if(preview)renderMarkdownPreview(preview,noteStore('regular').find(n=>String(n.id)===String(lifeFlowNoteController?.selectedId()??window.lfSelectedNote))?.content||'');}
    if(window.lifeFlowLoginEntry)window.lifeFlowLoginEntry=false;
  }});
  initThemePull();lfAccessibilityPass();
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
  overlay.innerHTML='<div class="command-panel" role="dialog" aria-modal="true" aria-label="LifeFlow search"><div class="command-head"><div><strong>Search LifeFlow</strong><span>Notes, tasks, pages and actions</span></div><button class="command-close" type="button" data-lf-action="command-close" aria-label="Close">×</button></div><input id="lfCommandInput" class="command-input" autocomplete="off" placeholder="Search notes, tasks or pages..." aria-label="Search LifeFlow"><div id="lfCommandResults" class="command-results"></div><div class="command-hint">Esc to close · Enter to open</div></div>';
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
  const pages=[['today','Today','See what needs attention now'],['list','Tasks','Browse and manage tasks'],['calendar','Calendar','View deadlines and scheduled time'],['board','Board','Move work through the flow'],['account','Profile & settings','Personalize LifeFlow']];
  const matches=pages.filter(x=>!q||x.join(' ').toLowerCase().includes(q)).map(x=>'<button type="button" class="command-result" data-lf-action="command-view" data-view="'+x[0]+'"><b>'+x[1]+'</b><span>'+x[2]+'</span></button>');
  const tasks=(state.tasks||[]).filter(t=>!q||((t.title||'')+' '+(t.description||'')).toLowerCase().includes(q)).slice(0,5).map(t=>'<button type="button" class="command-result" data-lf-action="command-task" data-task-id="'+t.id+'"><b>'+esc(t.title||'Untitled task')+'</b><span>'+((t.done?'Completed':'Open'))+(t.priority?' · '+esc(t.priority):'')+'</span></button>');
  const noteResults=lifeFlowNoteController?.searchNotes(q)||[];
  const noteHtml=noteResults.slice(0,8).map(note=>'<button type="button" class="command-result command-note-result" data-lf-action="command-note" data-note-id="'+esc(note.id)+'"><b>'+esc(note.title||'Untitled note')+'</b>'+window.LifeFlowUIModule.renderSearchSnippet({folder:note.folder,folderIcon:note.folderIcon,snippet:note.snippet,terms:note.terms})+'</button>');
  const heading=noteHtml.length?'<div class="command-section-label">Search Results</div>':'';
  const otherResults=(matches.concat(tasks)).slice(0,5).join('');
  const output=heading+noteHtml.join('')+otherResults||'<div class="command-empty">No matching pages, tasks or notes.</div>';
  const template=host.ownerDocument.createElement('template');
  template.innerHTML=output;
  host.replaceChildren(template.content);
}
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeCommandPalette();closeNoteContextMenu();}
  if((e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10'))&&e.target?.closest?.('[data-lf-folder-context]')){
    e.preventDefault();const item=e.target.closest('[data-lf-folder-context]'),rect=item.getBoundingClientRect();
    openFolderContextMenu({clientX:rect.left+24,clientY:rect.top+24,preventDefault(){}},item.dataset.folderName);
  }
  if((e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10'))&&e.target?.closest?.('[data-lf-note-context]')){
    e.preventDefault();
    const item=e.target.closest('[data-lf-note-context]'),rect=item.getBoundingClientRect();
    openNoteContextMenu({clientX:rect.left+24,clientY:rect.top+24,preventDefault(){}},item.dataset.noteId);
  }
});
function makeKnowledgeNoteCode(){return lifeFlowNoteController?.makeNoteCode()||'';}
function ensureKnowledgeState(){if(lifeFlowNoteController)lifeFlowNoteController.ensure();}
function noteStore(kind){return lifeFlowNoteController?.getNotes(kind)||[];}
function nextKnowledgeNoteNumber(kind){return lifeFlowNoteController?.nextNumber(kind)||1;}
function newKnowledgeNote(kind){
  if(!lifeFlowNoteController)return;
  const note=lifeFlowNoteController.newNote(kind);
  window.lfSelectedNote=note.id;window.lfNoteMode=kind;window.lfNoteView='edit';renderApp();
}
function updateKnowledgeNote(kind,id,value){lifeFlowNoteController?.updateContent(kind,id,value);if(kind==='regular')startKnowledgeVersionTimer(id);}
function restoreKnowledgeVersion(id,versionId){if(!window.confirm('Restore this version? Your current note will first be saved as a version.'))return;if(lifeFlowNoteController?.restoreVersion(id,versionId)){window.lfNoteHistoryPreview=null;window.lfNoteHistoryOpen=true;stopKnowledgeVersionTimer();showToast('Previous note version restored');renderApp();}}
function refreshCodeEditor(){const t=document.getElementById('kn_content'),h=document.getElementById('kn_highlight');if(!t||!h)return;h.innerHTML=highlightCode(t.value);syncCodeScroll();}function syncCodeScroll(){const t=document.getElementById('kn_content'),h=document.getElementById('kn_highlight');if(t&&h){h.scrollTop=t.scrollTop;h.scrollLeft=t.scrollLeft;}}
function deleteKnowledgeNote(kind,id){
  if(!confirm('Delete this note?'))return;
  if(lifeFlowNoteController?.deleteNote(kind,id)){window.lfSelectedNote=null;renderApp();}
}
function deleteAllKnowledgeNotes(kind){
  const count=noteStore(kind).length;if(!count)return;
  if(!confirm('Delete all '+count+' notes? This cannot be undone.'))return;
  lifeFlowNoteController?.deleteAll(kind);window.lfSelectedNote=null;window.lfNoteView='edit';renderApp();
}
function downloadKnowledgeNote(kind,id){
  const n=noteStore(kind).find(function(x){return String(x.id)===String(id);});
  if(!n)return;
  const nl=String.fromCharCode(10);
  let md='# '+(n.title||'Untitled')+nl+nl;
  const fence=String.fromCharCode(96).repeat(3);
  if(kind==='code')md+=fence+(n.language||'text')+nl+(n.code||'')+nl+fence+nl;
  else md+=(n.content||'')+nl;
  const blob=new Blob([md],{type:'text/markdown;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=(n.title||'lifeflow-note').replace(/[^a-z0-9_-]+/gi,'_')+'.md';
  a.style.display='none';
  document.body.appendChild(a);
  a.click();
  window.setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1500);
}
function highlightCode(s){const src=String(s||'');const re=/(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b(?:function|return|const|let|var|class|if|else|for|while|def|import|from|public|private|static|void|int|float|boolean|new|true|false|null|None)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*(?=\s*\())/g;let out='',last=0,m;while((m=re.exec(src))){out+=esc(src.slice(last,m.index));const t=m[0];let cls='';if(/^\/\//.test(t)||/^#/.test(t)||/^\/\*/.test(t))cls='code-comment';else if(/^(?:"|')/.test(t))cls='code-string';else if(/^(?:function|return|const|let|var|class|if|else|for|while|def|import|from|public|private|static|void|int|float|boolean|new|true|false|null|None)$/.test(t))cls='code-keyword';else if(/^\d/.test(t))cls='code-number';else cls='code-function';out+='<span class="'+cls+'">'+esc(t)+'</span>';last=m.index+t.length;}out+=esc(src.slice(last));return out||'<span class="code-placeholder">Start writing code…</span>';}

function highlightCodeBlock(source,language){
  const code=String(source||'');
  const lang=String(language||'').toLowerCase();
  const keywords={
    c:'auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while',
    cpp:'alignas alignof auto bool break case char class const constexpr continue default delete do double else enum explicit export extern false float for friend goto if inline int long namespace new noexcept nullptr operator private protected public register return short signed sizeof static static_assert struct switch template this throw true try typedef typename union unsigned using virtual void volatile while',
    javascript:'async await break case catch class const continue debugger default delete do else export extends false finally for from function get if import in instanceof let new null of return set static super switch this throw true try typeof undefined var void while with yield',
    python:'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield',
    java:'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while',
    csharp:'abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var virtual void volatile while',
    sql:'add all alter as asc begin between by case cast check column commit constraint create cross current_date current_time database default delete desc distinct drop else end except exists false fetch for foreign from full group having in index inner insert intersect into is join key left like limit not null offset on or order outer primary references right rollback row select set table then true union unique update use values view when where with',
    bash:'case do done elif else esac fi for function if in local return select then time until while'
  };
  const keywordSet=new Set((keywords[lang]||keywords.c).split(/\s+/));
  const typeSet=new Set('size_t ssize_t uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t FILE NULL'.split(' '));
  const re=/(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[uUlLfF]*\b|\b[A-Za-z_$][\w$]*\b|[^\s])/g;
  let out='',last=0,m;
  while((m=re.exec(code))){
    out+=esc(code.slice(last,m.index));
    const token=m[0];let cls='';
    if(/^\/\//.test(token)||/^\/\*/.test(token))cls='code-comment';
    else if(/^#/.test(token)&&lang!=='sql')cls='code-preprocessor';
    else if(/^(?:"|')/.test(token))cls='code-string';
    else if(/^\d|^\.\d/.test(token))cls='code-number';
    else if(keywordSet.has(token))cls='code-keyword';
    else if(typeSet.has(token))cls='code-type';
    else if(/^[A-Za-z_$]/.test(token)&&/^\s*\(/.test(code.slice(re.lastIndex)))cls='code-function';
    else if(/^(?:[+\-*\/%=<>!&|^~?:]+|[{}()[\];,.])$/.test(token))cls='code-operator';
    out+=cls?'<span class="'+cls+'">'+esc(token)+'</span>':esc(token);
    last=re.lastIndex;
  }
  out+=esc(code.slice(last));
  return out;
}
function markdownToHtml(source){return lifeFlowNoteController?.markdownToHtml(source)||'';}
function renderMarkdownPreview(element,source){
  if(lifeFlowNoteController)lifeFlowNoteController.renderMarkdownPreview(element,source);
}
function handleMarkdownKeydown(e){
  const menu=document.getElementById('noteLinkSuggestions');
  if(menu&&!menu.hidden){
    const options=Array.from(menu.querySelectorAll('.note-link-option'));
    if((e.key==='ArrowDown'||e.key==='ArrowUp')&&options.length){e.preventDefault();window.lfNoteLinkActive=(Number(window.lfNoteLinkActive||0)+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options.forEach(function(option,i){option.classList.toggle('active',i===window.lfNoteLinkActive);});return;}
    if(e.key==='Enter'&&options.length){e.preventDefault();chooseNoteLink(Number(window.lfNoteLinkActive||0));return;}
    if(e.key==='Escape'){menu.hidden=true;return;}
  }
  if(e.key!=='Enter'||e.shiftKey||e.altKey||e.ctrlKey||e.metaKey)return;
  const ta=e.target?.closest?.('#kn_content')||document.getElementById('kn_content');
  const before=ta.value.slice(0,ta.selectionStart);
  const lineStart=before.lastIndexOf('\n')+1;
  const line=before.slice(lineStart);
  const fenceCount=(before.match(new RegExp('^\\s{0,3}('+String.fromCharCode(96,96,96)+'|~~~)','gm'))||[]).length;
  if(fenceCount%2===1)return;
  const task=line.match(/^(\s{0,3})([-*+])\s+\[[ xX]\]\s+(.*)$/);
  const bullet=line.match(/^(\s{0,3})([-*+])\s+(.*)$/);
  const ordered=line.match(/^(\s{0,3})(\d+)\.\s+(.*)$/);
  const match=task||bullet||ordered;
  if(!match)return;
  const content=match[3];
  if(!content.trim())return;
  let prefix;
  if(task)prefix=match[1]+match[2]+' [ ] ';
  else if(ordered)prefix=match[1]+(Number(match[2])+1)+'. ';
  else prefix=match[1]+match[2]+' ';
  e.preventDefault();
  const start=ta.selectionStart,end=ta.selectionEnd;
  ta.setRangeText('\n'+prefix,start,end,'end');
  ta.dispatchEvent(new Event('input',{bubbles:true}));
}
function setKnowledgeNoteView(mode){
  if(lifeFlowNoteController)lifeFlowNoteController.select(lifeFlowNoteController.selectedId(),'regular',mode);
  window.lfNoteView=mode==='preview'?'preview':'edit';renderApp();
}
function refreshMarkdownPreview(){
  const source=document.getElementById('kn_content'),preview=document.getElementById('kn_preview');
  if(source&&preview)renderMarkdownPreview(preview,source.value);
}
function findNoteLinkQuery(text,cursor){
  const before=String(text||'').slice(0,cursor),open=before.lastIndexOf('[[');
  if(open<0)return null;
  const tail=before.slice(open+2);
  if(tail.includes(']]')||tail.includes('\n'))return null;
  return {start:open,end:cursor,query:tail.trimStart()};
}
function handleNoteLinkAutocomplete(e){
  const ta=e.target?.closest?.('#kn_content')||document.getElementById('kn_content'),menu=document.getElementById('noteLinkSuggestions');
  if(!ta||!menu)return;
  const match=findNoteLinkQuery(ta.value,ta.selectionStart);
  if(!match){menu.hidden=true;menu.innerHTML='';return;}
  const q=match.query.toLowerCase();
  const notes=noteStore('regular').filter(function(n){return String(n.title||'').toLowerCase().includes(q);}).slice(0,8);
  if(!notes.length){menu.hidden=true;menu.innerHTML='';return;}
  window.lfNoteLinkMatches=notes.map(function(n){return n.id;});window.lfNoteLinkActive=0;
  menu.innerHTML=notes.map(function(n,i){return '<button type="button" class="note-link-option '+(i===0?'active':'')+'" data-lf-action="choose-note-link" data-note-link-index="'+i+'"><strong>'+esc(n.title||'Untitled')+'</strong></button>';}).join('');
  menu.hidden=false;
}
function chooseNoteLink(index){
  const ta=document.getElementById('kn_content'),menu=document.getElementById('noteLinkSuggestions');
  if(!ta||!menu)return;
  const ids=window.lfNoteLinkMatches||[];
  const n=noteStore('regular').find(function(item){return String(item.id)===String(ids[index]);});
  const match=findNoteLinkQuery(ta.value,ta.selectionStart);
  if(!n||!match)return;
  ta.setRangeText('[['+(n.title||'Untitled')+']]',match.start,match.end,'end');
  ta.dispatchEvent(new Event('input',{bubbles:true}));menu.hidden=true;ta.focus();
}
function openKnowledgeNoteByTitle(title){
  const before=noteStore('regular').length,note=lifeFlowNoteController?.openByTitle(title);
  if(!note)return;
  window.lfNoteMode='regular';window.lfSelectedNote=note.id;window.lfNoteView='edit';
  if(noteStore('regular').length>before)showToast('Created note: '+note.title);
  renderApp();
}
function createKnowledgeFolder(){const name=window.prompt('Folder name');if(!name)return;const folder=lifeFlowNoteController?.createFolder(name);if(!folder)showToast('Folder name already exists or is invalid');else renderApp();}
let notesSearchTimer=null;
function scheduleNotesSearch(control){
  const query=control.value;
  lifeFlowNoteController?.setSearchQuery(query);
  window.lfNotesSearchVisible=12;
  if(notesSearchTimer!==null)window.clearTimeout(notesSearchTimer);
  notesSearchTimer=window.setTimeout(()=>{
    notesSearchTimer=null;
    if(!control.isConnected)return;
    renderNotesListOnly();
  },150);
}
function closeNoteContextMenu(){document.getElementById('lfNoteContextMenu')?.remove();}
function openFolderContextMenu(event,name){
  closeNoteContextMenu();if(!name)return;
  const menu=document.createElement('div');menu.id='lfNoteContextMenu';menu.className='note-context-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Folder actions');
  menu.innerHTML='<div class="note-context-label">FOLDER</div><button type="button" role="menuitem" data-lf-action="folder-context-rename" data-folder-name="'+esc(name)+'" '+(name==='Unfiled'?'disabled':'')+'>Rename folder</button><button type="button" role="menuitem" class="danger" data-lf-action="folder-context-delete" data-folder-name="'+esc(name)+'" '+(name==='Unfiled'?'disabled':'')+'>Delete folder</button>';
  document.body.appendChild(menu);const width=Math.min(230,Math.max(180,window.innerWidth-16)),height=menu.offsetHeight||120,left=Math.max(8,Math.min(Number(event.clientX)||8,window.innerWidth-width-8)),top=Math.max(8,Math.min(Number(event.clientY)||8,window.innerHeight-height-8));menu.style.left=left+'px';menu.style.top=top+'px';
}
function openNoteContextMenu(event,noteId){
  closeNoteContextMenu();
  const note=noteStore('regular').find(item=>String(item.id)===String(noteId));if(!note)return;
  event.preventDefault?.();
  const folders=lifeFlowNoteController?.getFolders()||[{name:'Unfiled'}];
  const menu=document.createElement('div');
  menu.id='lfNoteContextMenu';menu.className='note-context-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Note actions');
  menu.innerHTML='<button type="button" role="menuitem" data-lf-action="note-context-open" data-note-id="'+esc(note.id)+'">Open note</button><div class="note-context-label">MOVE TO FOLDER</div>'+folders.map(folder=>'<button type="button" role="menuitem" class="note-context-folder '+((note.folderId||'unfiled')===folder.id?'current':'')+'" data-lf-action="note-context-move" data-note-id="'+esc(note.id)+'" data-folder-name="'+esc(folder.id)+'" '+((note.folderId||'unfiled')===folder.id?'disabled':'')+'><span>'+esc(folder.icon||'▣')+'</span>'+esc(folder.name)+((note.folderId||'unfiled')===folder.id?'<small>Current</small>':'')+'</button>').join('')+'<div class="note-context-divider"></div><button type="button" role="menuitem" data-lf-action="note-context-rename" data-note-id="'+esc(note.id)+'">Rename note</button><button type="button" role="menuitem" class="danger" data-lf-action="note-context-delete" data-note-id="'+esc(note.id)+'">Delete note</button>';
  document.body.appendChild(menu);
  const width=Math.min(250,Math.max(180,window.innerWidth-16)),height=menu.offsetHeight||240,left=Math.max(8,Math.min(Number(event.clientX)||8,window.innerWidth-width-8)),top=Math.max(8,Math.min(Number(event.clientY)||8,window.innerHeight-height-8));
  menu.style.left=left+'px';menu.style.top=top+'px';
  menu.querySelector('button')?.focus({preventScroll:true});
}
function renderNotesListOnly(){
  const main=document.getElementById('main');if(!main||view!=='notes')return;
  const active=document.activeElement,start=active?.selectionStart,end=active?.selectionEnd;
  const temp=document.createElement('div');temp.innerHTML=renderNotesManager();
  const current=main.querySelector('.notes-workspace'),next=temp.querySelector('.notes-workspace');
  if(current&&next){current.replaceWith(next);const input=next.querySelector('.notes-search');if(input){input.focus({preventScroll:true});try{input.setSelectionRange(start,end);}catch(_){}}}
}
function refreshKnowledgeBacklinks(){
  const selected=selectedKnowledgeNote('regular'),card=document.querySelector('.note-editor');
  if(!card)return;
  const existing=card.querySelector('.note-backlinks');
  const backlinks=selected?lifeFlowNoteController?.getBacklinks(selected.id)||[]:[];
  if(!backlinks.length){existing?.remove();return;}
  const section=document.createElement('section');
  section.className='note-backlinks';
  section.innerHTML='<div class="note-backlinks-head"><strong>Referenced In</strong><span>'+backlinks.length+'</span></div>'+backlinks.map(item=>window.LifeFlowUIModule.renderBacklinkItem(item)).join('');
  if(existing)existing.replaceWith(section);
  else card.appendChild(section);
}
function openKnowledgeBacklink(id,lineIndex){
  selectKnowledgeNote(id,'regular','edit');
  requestAnimationFrame(()=>{
    const editor=document.getElementById('kn_content');if(!editor)return;
    const lines=editor.value.replace(/\r\n?/g,'\n').split('\n');
    const safeLine=Math.max(0,Math.min(lines.length-1,Number.isFinite(lineIndex)?lineIndex:0));
    const start=lines.slice(0,safeLine).reduce((sum,line)=>sum+line.length+1,0);
    const end=start+(lines[safeLine]||'').length;
    editor.focus({preventScroll:true});editor.setSelectionRange(start,end);
    const lineHeight=parseFloat(getComputedStyle(editor).lineHeight)||22;
    editor.scrollTop=Math.max(0,safeLine*lineHeight-editor.clientHeight/2);
    editor.classList.remove('backlink-jump-active');
    void editor.offsetWidth;
    editor.classList.add('backlink-jump-active');
    window.setTimeout(()=>editor.classList.remove('backlink-jump-active'),1800);
  });
}
function renderNotesManager(){
  const u=currentUser();
  if(!hasPremiumAccess(u))return '<div class="card"><h2>Premium feature</h2><p>Notes Manager is available to Premium and Team Admin accounts.</p></div>';
  ensureKnowledgeState();
  const kind='regular',items=noteStore(kind);
  const selectedId=lifeFlowNoteController?.selectedId() ?? window.lfSelectedNote;
  const selected=items.find(function(n){return String(n.id)===String(selectedId);})||items[0];
  if(selected&&String(selected.id)!==String(selectedId)){
    lifeFlowNoteController?.select(selected.id,'regular',lifeFlowNoteController.noteView());
    window.lfSelectedNote=selected.id;
  }
  const mode=(lifeFlowNoteController?.noteView() || window.lfNoteView)==='preview'?'preview':'edit';
  const folders=lifeFlowNoteController?.getFolders()||[{id:'unfiled',name:'Unfiled',icon:'▤'}],collapsed=new Set(state.collapsedFolders||[]);
  const searchQuery=String(state.searchQuery||'');
  const searchResults=searchQuery?lifeFlowNoteController.searchNotes(searchQuery):[];
  const searchResultById=new Map(searchResults.map(result=>[String(result.id),result]));
  const filteredItems=searchQuery?searchResults.map(result=>items.find(note=>String(note.id)===String(result.id))).filter(Boolean):items;
  const lazySearch=!!searchQuery&&filteredItems.length>=50;
  const visibleLimit=Math.max(12,Number(window.lfNotesSearchVisible)||12);
  const visibleItems=lazySearch?filteredItems.slice(0,visibleLimit):filteredItems;
  const activePanel=window.lfNotesPanel==='folders'?'folders':'notes';
  const panelOpen=window.lfNotesPanelOpen===true;
  let html='<div class="knowledge-shell notes-workspace"><div class="notes-searchbar"><label class="notes-global-search"><span aria-hidden="true">⌕</span><input class="notes-search" type="search" value="'+esc(searchQuery)+'" placeholder="Search notes, folders and content..." aria-label="Search notes, folders and content" data-lf-input="notes-search"></label><span class="notes-search-count">'+filteredItems.length+' of '+items.length+' notes</span></div><div class="notes-editor-stage"><div class="card note-editor">';
  if(selected){
    const content=selected.content||'';
    html+='<div class="note-identity"><label for="kn_title_edit">CURRENT NOTE</label><input id="kn_title_edit" class="note-title-edit" type="text" value="'+esc(selected.title||'')+'" maxlength="80" placeholder="Untitled note" aria-label="Current note name" data-lf-input="note-title-live" data-lf-blur="note-title-live" data-note-id="'+selected.id+'"></div><div class="markdown-toolbar"><div class="markdown-tabs"><button type="button" class="'+(mode==='edit'?'active':'')+'" data-lf-action="note-view" data-note-view="edit">Write</button><button type="button" class="'+(mode==='preview'?'active':'')+'" data-lf-action="note-view" data-note-view="preview">Preview</button></div><button type="button" class="note-history-toggle '+(window.lfNoteHistoryOpen?'active':'')+'" data-lf-action="note-history-toggle" aria-expanded="'+(!!window.lfNoteHistoryOpen)+'">↶ Version history <span>'+((lifeFlowNoteController?.getVersionHistory(selected.id)||[]).length)+'</span></button></div>';
    html+='<label class="note-folder-move">Move to Folder <select data-lf-change="note-move-folder" data-note-id="'+selected.id+'">'+folders.map(folder=>'<option value="'+esc(folder.id)+'" '+((selected.folderId||'unfiled')===folder.id?'selected':'')+'>'+esc(folder.name)+'</option>').join('')+'</select></label><div class="note-content-surface">';
    if(mode==='preview')html+='<article id="kn_preview" class="markdown-preview">'+markdownToHtml(content)+'</article>';
    else html+='<div class="regular-note-source-wrap"><textarea id="kn_content" class="regular-note-source" spellcheck="false" data-lf-keydown="markdown-editor" data-lf-input="markdown-content" data-note-id="'+selected.id+'" data-lf-blur="markdown-content" placeholder="Write here...">'+esc(content)+'</textarea><div id="noteLinkSuggestions" class="note-link-suggestions" hidden></div></div>';
    html+='</div>';
    const backlinks=lifeFlowNoteController?.getBacklinks(selected.id)||[];
    if(backlinks.length)html+='<section class="note-backlinks"><div class="note-backlinks-head"><strong>Referenced In</strong><span>'+backlinks.length+'</span></div>'+backlinks.map(item=>window.LifeFlowUIModule.renderBacklinkItem(item)).join('')+'</section>';
    if(window.lfNoteHistoryOpen){
      const versions=lifeFlowNoteController?.getVersionHistory(selected.id)||[],preview=versions.find(item=>String(item.id)===String(window.lfNoteHistoryPreview));
      html+='<section class="note-version-history" aria-label="Note version history"><div class="note-version-head"><div><strong>Version history</strong><small>Snapshots on note switch and every 10 minutes while editing</small></div><button type="button" data-lf-action="note-history-toggle" aria-label="Close version history">×</button></div>';
      if(preview)html+='<div class="note-version-preview"><div class="note-version-preview-head"><strong>'+esc(preview.title||'Untitled note')+'</strong><span>'+new Date(preview.createdAt).toLocaleString()+'</span></div><pre>'+esc(preview.content||'')+'</pre><div class="note-version-actions"><button type="button" data-lf-action="note-history-restore" data-note-id="'+esc(selected.id)+'" data-version-id="'+esc(preview.id)+'">Restore this version</button><button type="button" data-lf-action="note-history-preview" data-version-id="">Back to history</button></div></div>';
      else if(!versions.length)html+='<p class="note-version-empty">No previous versions yet. A snapshot will be created when you switch notes or after 10 minutes of editing.</p>';
      else html+='<div class="note-version-list">'+versions.map(item=>'<article class="note-version-item"><div><strong>'+esc(item.title||'Untitled note')+'</strong><small>'+new Date(item.createdAt).toLocaleString()+' · '+esc(item.reason==='note-switch'?'Saved on note switch':item.reason==='10-minute-autosave'?'10-minute autosave':item.reason==='before-restore'?'Before restore':'Saved version')+'</small></div><button type="button" data-lf-action="note-history-preview" data-version-id="'+esc(item.id)+'">Preview</button></article>').join('')+'</div>';
      html+='</section>';
    }
  }else html+='<div class="empty-state"><h3>No notes yet</h3><p>Use New note to create one.</p></div>';
  html+='</div><div class="notes-panel-tabs" aria-label="Notes panels"><button type="button" class="notes-ear '+(panelOpen&&activePanel==='folders'?'active':'')+'" data-lf-action="note-panel-toggle" data-notes-panel="folders" aria-expanded="'+(panelOpen&&activePanel==='folders')+'" title="Folders"><span>▣</span><small>Folders</small></button><button type="button" class="notes-ear '+(panelOpen&&activePanel==='notes'?'active':'')+'" data-lf-action="note-panel-toggle" data-notes-panel="notes" aria-expanded="'+(panelOpen&&activePanel==='notes')+'" title="Notes"><span>▤</span><small>Notes</small></button></div><aside class="notes-drawer '+(panelOpen?'is-open':'')+'" data-active-panel="'+activePanel+'" aria-label="'+(activePanel==='folders'?'Folders':'Notes')+'"><div class="notes-drawer-content">';
  if(activePanel==='folders'){
    html+='<div class="notes-drawer-heading"><div><strong>Folders</strong><small>Organise your thinking</small></div><button type="button" class="notes-drawer-close" data-lf-action="note-panel-close" aria-label="Close panel">×</button></div><div class="notes-list-actions"><button class="primary" data-lf-action="note-add-folder">+ New folder</button></div><div class="notes-folder-groups">';
    folders.forEach(function(folder){const group=filteredItems.filter(n=>(n.folderId||folders.find(item=>item.name===(n.folder||'Unfiled'))?.id||'unfiled')===folder.id);if(folder.id!=='unfiled'&&folder.isDefault&&group.length===0)return;html+=window.LifeFlowUIModule.renderFolderCategory({folder,notes:group,collapsed:collapsed.has(folder.name),selectedId:selected?.id??null});});
    html+='</div>';
  }else{
    html+='<div class="notes-drawer-heading"><div><strong>Notes</strong><small>'+filteredItems.length+' notes in your workspace</small></div><button type="button" class="notes-drawer-close" data-lf-action="note-panel-close" aria-label="Close panel">×</button></div><div class="notes-list-actions"><button class="primary" data-lf-action="note-new">+ New note</button><button type="button" data-lf-action="note-add-folder">+ Folder</button><button class="del notes-delete-all" data-lf-action="note-delete-all" '+(items.length?'':'disabled')+'>Delete all</button></div><div class="notes-items notes-flat-items">';
    visibleItems.forEach(note=>{
      const result=searchResultById.get(String(note.id));
      const snippet=result?window.LifeFlowUIModule.renderSearchSnippet({folder:result.folder,folderIcon:result.folderIcon,snippet:result.snippet,terms:result.terms}):'';
      html+='<button class="note-item'+(String(note.id)===String(selected?.id)?' active':'')+'" data-lf-action="note-select" data-lf-note-context aria-haspopup="menu" data-note-id="'+esc(note.id)+'"><strong>'+esc(note.title||'Untitled')+'</strong><small>'+esc(new Date(note.updatedAt||Date.now()).toLocaleDateString())+'</small>'+(result?'<span class="note-search-result-snippet">'+snippet+'</span>':'')+'</button>';
    });
    if(!filteredItems.length)html+='<p class="notes-empty">'+(searchQuery?'No results found. Try another phrase.':'No notes yet. Create your first note.')+'</p>';
    if(lazySearch&&visibleItems.length<filteredItems.length)html+='<button type="button" class="notes-search-more" data-lf-action="notes-search-more">Show more ('+Math.min(12,filteredItems.length-visibleItems.length)+' more)</button>';
    html+='</div>';
  }
  html+='</div></aside></div></div>';
  return html;
}
function copyKnowledgeNoteCode(id){const n=noteStore('regular').find(function(x){return String(x.id)===String(id);});if(!n)return;const value=n.noteCode||'';if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(value).then(function(){showToast('Note code copied');}).catch(function(){showToast(value);});}else showToast(value);}
function autoTitleKnowledgeNote(id,value){if(lifeFlowNoteController?.autoTitle(id,value))renderApp();}
function updateKnowledgeTitle(kind,id,value){lifeFlowNoteController?.updateFields(kind,id,{title:value});}
function updateKnowledgeLanguage(id,value){if(lifeFlowNoteController?.updateFields('code',id,{language:value}))renderApp();}
function renderBranches(){
  const u=currentUser();
  if(!hasPremiumAccess(u))return '<div class="card"><h2>Premium feature</h2><p>Your Branches is available to Premium and Team Admin accounts.</p></div>';
  ensureKnowledgeState();
  const items=state.notes, count=items.length, positions={};
  const edges=lifeFlowNoteController?.getGraphLinks()||[];
  const ghostNodes=new Map();
  edges.filter(edge=>edge.ghost).forEach(edge=>ghostNodes.set(edge.to,{id:edge.to,title:edge.toTitle}));
  const width=1400,height=Math.max(900,Math.ceil(Math.sqrt(Math.max(1,count+ghostNodes.size)))*260);
  let changed=false;
  const hash=function(value){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
  const labelWidth=function(n){return Math.max(92,Math.min(250,String(n.title||'Untitled').slice(0,34).length*7.2));};
  items.forEach(function(n,i){
    let x=n.graphX,y=n.graphY;
    if(!Number.isFinite(x)||!Number.isFinite(y)){
      const h=hash(String(n.id||n.noteCode||i));
      x=90+(h%10000)/10000*(width-180);
      y=80+((h>>>10)%10000)/10000*(height-160);changed=true;
    }
    positions[String(n.id)]={x,y};
  });
  // Relax overlapping node labels while retaining the user's saved layout.
  for(let pass=0;pass<Math.min(48,Math.max(12,items.length));pass++){
    let moved=false;
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
      const a=items[i],b=items[j],pa=positions[String(a.id)],pb=positions[String(b.id)];
      let dx=pb.x-pa.x,dy=pb.y-pa.y;
      const minX=(labelWidth(a)+labelWidth(b))/2+34,minY=88;
      if(Math.abs(dx)<minX&&Math.abs(dy)<minY){
        if(Math.abs(dx)<1)dx=(i%2?1:-1)*2;
        if(Math.abs(dy)<1)dy=(j%2?1:-1)*2;
        const ox=(minX-Math.abs(dx))*.055*Math.sign(dx);
        const oy=(minY-Math.abs(dy))*.055*Math.sign(dy);
        pa.x-=ox;pb.x+=ox;pa.y-=oy;pb.y+=oy;moved=true;
      }
    }
    items.forEach(function(n){
      const p=positions[String(n.id)],x=Math.max(110,Math.min(width-110,p.x)),y=Math.max(80,Math.min(height-65,p.y));
      if(x!==p.x||y!==p.y)moved=true;p.x=x;p.y=y;
    });
    if(!moved)break;
  }
  items.forEach(function(n){const p=positions[String(n.id)];if(!Number.isFinite(n.graphX)||!Number.isFinite(n.graphY)||Math.abs(n.graphX-p.x)>.5||Math.abs(n.graphY-p.y)>.5)changed=true;});
  if(changed&&lifeFlowNoteController){
    lifeFlowNoteController.updateAll('regular',current=>current.map(note=>{
      const position=positions[String(note.id)];
      return position?{...note,graphX:position.x,graphY:position.y}:note;
    }));
  }
  ghostNodes.forEach(function(node){
    const h=hash(node.id),x=120+(h%10000)/10000*(width-240),y=90+((h>>>10)%10000)/10000*(height-180);
    positions[node.id]={x,y};
  });
  let svg='';
  edges.forEach(function(edge){
    const a=positions[edge.from],b=positions[edge.to];
    if(a&&b)svg+='<line class="branch-edge'+(edge.ghost?' branch-edge-ghost':'')+'" data-from="'+esc(edge.from)+'" data-to="'+esc(edge.to)+'" data-ghost="'+String(!!edge.ghost)+'" data-line="'+edge.line+'" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"></line><line class="branch-edge-hit" data-from="'+esc(edge.from)+'" data-to="'+esc(edge.to)+'" data-ghost="'+String(!!edge.ghost)+'" data-line="'+edge.line+'" data-target-title="'+esc(edge.toTitle)+'" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" tabindex="0" role="button" aria-label="Open '+esc(edge.toTitle)+' from '+esc(edge.fromTitle)+'"></line>';
  });
  const activeId=String(state.selectedNoteId??'');
  items.forEach(function(n){
    const p=positions[String(n.id)],label=esc(n.title||'Untitled').slice(0,34),active=String(n.id)===activeId?' branch-node-active':'';
    svg+='<g class="branch-node interactive-branch-node'+active+'" data-note-id="'+esc(String(n.id))+'" transform="translate('+p.x+' '+p.y+')" tabindex="0" role="button" aria-label="Open '+label+'"><circle r="17"></circle><text y="39" text-anchor="middle">'+label+'</text></g>';
  });
  ghostNodes.forEach(function(node){
    const p=positions[node.id],label=esc(node.title||'Future idea').slice(0,34);
    svg+='<g class="branch-node branch-ghost-node interactive-branch-node" data-ghost-title="'+esc(node.title)+'" data-note-id="'+esc(node.id)+'" transform="translate('+p.x+' '+p.y+')" tabindex="0" role="button" aria-label="Create note '+label+'"><circle r="17"></circle><text y="39" text-anchor="middle">'+label+'</text></g>';
  });
  if(!count)svg='<text x="600" y="410" text-anchor="middle" class="branch-empty">Create notes to grow your branches.</text>';
  return '<div class="card branches-card"><div class="knowledge-header"><div><span class="custom-kicker">PREMIUM WORKSPACE</span><h2>Your Branches</h2><p>A living map of your notes. Drag to arrange, scroll to zoom, and click a node to open it.</p></div><span class="theme-current-pill">'+count+' nodes · '+edges.length+' links</span></div><div class="branch-graph interactive-branch-graph"><svg id="branchesSvg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Interactive map of your notes"><g id="branchesViewport">'+svg+'</g></svg><div class="branch-graph-controls"><button type="button" data-lf-action="branches-focus-toggle" aria-pressed="false">Focus Mode</button><button type="button" data-lf-action="branches-zoom" data-zoom-factor="1.2" aria-label="Zoom in">+</button><button type="button" data-lf-action="branches-zoom" data-zoom-factor=".8333" aria-label="Zoom out">−</button><button type="button" data-lf-action="branches-reset">Reset view</button></div></div></div>';
}
function toggleBranchesFocusMode(){
  window.lfBranchesFocusMode=!window.lfBranchesFocusMode;
  const button=document.querySelector('[data-lf-action="branches-focus-toggle"]');
  if(button){button.setAttribute('aria-pressed',String(window.lfBranchesFocusMode));button.classList.toggle('active',window.lfBranchesFocusMode);}
  if(!window.lfBranchesFocusMode){
    window.lfBranchesFocusedId=null;
    document.querySelector('.interactive-branch-graph')?.classList.remove('branch-focus-active');
    document.querySelectorAll('.interactive-branch-graph .branch-dimmed').forEach(node=>node.classList.remove('branch-dimmed'));
  }
  showToast(window.lfBranchesFocusMode?'Focus Mode on · select a node to focus':'Focus Mode off');
}
function branchesApplyTransform(){
  const g=document.getElementById('branchesViewport');if(!g)return;
  const z=window.lfBranchesZoom||1,x=window.lfBranchesPanX||0,y=window.lfBranchesPanY||0;
  g.setAttribute('transform','translate('+x+' '+y+') scale('+z+')');
}
function branchesZoomAt(factor,pivotX,pivotY){
  const svg=document.getElementById('branchesSvg'),g=document.getElementById('branchesViewport');if(!svg||!g)return;
  const oldZ=window.lfBranchesZoom||1,newZ=Math.max(.35,Math.min(4,oldZ*factor));
  const x=window.lfBranchesPanX||0,y=window.lfBranchesPanY||0;
  const px=Number.isFinite(pivotX)?pivotX:svg.viewBox.baseVal.width/2;
  const py=Number.isFinite(pivotY)?pivotY:svg.viewBox.baseVal.height/2;
  const worldX=(px-x)/oldZ,worldY=(py-y)/oldZ;
  window.lfBranchesZoom=newZ;
  window.lfBranchesPanX=px-worldX*newZ;
  window.lfBranchesPanY=py-worldY*newZ;
  branchesApplyTransform();
}
function branchesZoom(factor){branchesZoomAt(factor);}
function branchesResetView(){
  window.lfBranchesZoom=1;window.lfBranchesPanX=0;window.lfBranchesPanY=0;window.lfBranchesFocusMode=false;window.lfBranchesFocusedId=null;
  document.querySelector(".interactive-branch-graph")?.classList.remove("branch-focus-active");document.querySelectorAll(".interactive-branch-graph .branch-dimmed").forEach(node=>node.classList.remove("branch-dimmed"));
  const button=document.querySelector("[data-lf-action=branches-focus-toggle]");if(button){button.classList.remove("active");button.setAttribute("aria-pressed","false");}branchesApplyTransform();
}
function initBranchesGraph(root){
  const svg=root.querySelector('#branchesSvg'),viewport=root.querySelector('#branchesViewport');if(!svg||!viewport)return;
  window.lfBranchesZoom=1;window.lfBranchesPanX=0;window.lfBranchesPanY=0;branchesApplyTransform();
  let drag=null;
  const svgPoint=function(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());};
  const point=function(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(viewport.getScreenCTM().inverse());};
  const moveNode=function(id,x,y){
    const node=viewport.querySelector('[data-note-id="'+CSS.escape(id)+'"]');if(!node)return;
    node.setAttribute('transform','translate('+x+' '+y+')');
    viewport.querySelectorAll('.branch-edge').forEach(function(line){
      if(line.dataset.from===id){line.setAttribute('x1',x);line.setAttribute('y1',y);}
      if(line.dataset.to===id){line.setAttribute('x2',x);line.setAttribute('y2',y);}
    });
  };
  const focusNode=function(id){
    const node=viewport.querySelector('.interactive-branch-node[data-note-id="'+CSS.escape(id)+'"]');if(!node)return;
    window.lfBranchesFocusedId=id;root.classList.add('branch-focus-active');
    const connected=new Set([id]);viewport.querySelectorAll('.branch-edge').forEach(line=>{if(line.dataset.from===id)connected.add(line.dataset.to);if(line.dataset.to===id)connected.add(line.dataset.from);});
    viewport.querySelectorAll('.interactive-branch-node').forEach(item=>item.classList.toggle('branch-dimmed',!connected.has(item.dataset.noteId)));
    viewport.querySelectorAll('.branch-edge,.branch-edge-hit').forEach(line=>line.classList.toggle('branch-dimmed',line.dataset.from!==id&&line.dataset.to!==id));
    const matrix=node.transform.baseVal.consolidate().matrix,box=svg.viewBox.baseVal,z=window.lfBranchesZoom||1;
    window.lfBranchesPanX=box.width/2-matrix.e*z;window.lfBranchesPanY=box.height/2-matrix.f*z;branchesApplyTransform();
  };
  window.lfBranchesFocusNode=focusNode;
  if(window.lfBranchesFocusMode&&window.lfBranchesFocusedId)focusNode(String(window.lfBranchesFocusedId));
  else if(window.lfSelectedNote!==null&&window.lfSelectedNote!==undefined){
    const active=viewport.querySelector('.interactive-branch-node[data-note-id="'+CSS.escape(String(window.lfSelectedNote))+'"]');
    if(active){const matrix=active.transform.baseVal.consolidate().matrix,box=svg.viewBox.baseVal,z=window.lfBranchesZoom||1;window.lfBranchesPanX=box.width/2-matrix.e*z;window.lfBranchesPanY=box.height/2-matrix.f*z;branchesApplyTransform();}
  }
  viewport.querySelectorAll('.branch-edge-hit').forEach(line=>{
    const activate=()=>{
      if(line.dataset.ghost==='true'){
        const created=lifeFlowNoteController?.openByTitle(line.dataset.targetTitle||'Future Idea');
        if(created)selectKnowledgeNote(created.id,'regular','edit');
        return;
      }
      const target=noteStore('regular').find(n=>String(n.id)===line.dataset.to);
      if(target)selectKnowledgeNote(target.id,'regular','edit');
    };
    line.addEventListener('click',activate);
    line.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
  });
  viewport.querySelectorAll('.interactive-branch-node').forEach(function(node){
    node.addEventListener('pointerdown',function(e){
      e.preventDefault();e.stopPropagation();const p=point(e),id=node.dataset.noteId;
      const matrix=node.transform.baseVal.consolidate().matrix;
      drag={type:'node',id,dx:p.x-matrix.e,dy:p.y-matrix.f,moved:false};
      node.classList.add('dragging');svg.setPointerCapture(e.pointerId);
    });
    node.addEventListener('click',function(e){
      if(node.dataset.moved==='1'){node.dataset.moved='0';return;}
      if(node.dataset.noteId.startsWith('ghost:')){
        const created=lifeFlowNoteController?.openByTitle(node.dataset.ghostTitle||'Future Idea');
        if(created){window.lfBranchesFocusMode=true;window.lfBranchesFocusedId=String(created.id);selectKnowledgeNote(created.id,'regular','edit');}
        return;
      }
      const n=noteStore('regular').find(function(item){return String(item.id)===String(node.dataset.noteId);});
      if(n){window.lfBranchesFocusMode=true;window.lfBranchesFocusedId=String(n.id);selectKnowledgeNote(n.id,'regular','edit');}
    });
    node.addEventListener('dblclick',function(){if(node.dataset.noteId.startsWith('ghost:')){const created=lifeFlowNoteController?.openByTitle(node.dataset.ghostTitle||'Future Idea');if(created)selectKnowledgeNote(created.id,'regular','edit');return;}const n=noteStore('regular').find(item=>String(item.id)===String(node.dataset.noteId));if(n)selectKnowledgeNote(n.id,'regular','edit');});
    node.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();node.click();}});
  });
  svg.addEventListener('pointerdown',function(e){
    if(e.target.closest('.interactive-branch-node'))return;
    const p=svgPoint(e);
    drag={type:'pan',x:p.x,y:p.y,px:window.lfBranchesPanX||0,py:window.lfBranchesPanY||0};
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove',function(e){
    if(!drag)return;
    if(drag.type==='node'){
      const p=point(e),x=p.x-drag.dx,y=p.y-drag.dy;
      if(Math.abs(x-(drag.lastX??x))>1||Math.abs(y-(drag.lastY??y))>1)drag.moved=true;
      drag.lastX=x;drag.lastY=y;
      const node=viewport.querySelector('[data-note-id="'+CSS.escape(drag.id)+'"]');if(node&&drag.moved)node.dataset.moved='1';
      moveNode(drag.id,x,y);
    }else{
      const p=svgPoint(e);
      window.lfBranchesPanX=drag.px+(p.x-drag.x);window.lfBranchesPanY=drag.py+(p.y-drag.y);
      branchesApplyTransform();
    }
  });
  const finish=function(){
    if(!drag)return;
    if(drag.type==='node'){
      const node=viewport.querySelector('[data-note-id="'+CSS.escape(drag.id)+'"]');
      if(node){
        node.classList.remove('dragging');
        const matrix=node.transform.baseVal.consolidate().matrix;
        const n=noteStore('regular').find(function(item){return String(item.id)===String(drag.id);});
        if(n)lifeFlowNoteController?.updateFields('regular',n.id,{graphX:matrix.e,graphY:matrix.f});
      }
    }
    drag=null;
  };
  svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
  svg.addEventListener('wheel',function(e){
    e.preventDefault();
    const p=svgPoint(e),factor=Math.exp(-e.deltaY*.0015);
    branchesZoomAt(factor,p.x,p.y);
  },{passive:false});
}
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
      <div class="manifesto-card manifesto-wide"><span>08</span><h3>Local by design</h3><p>LifeFlow runs locally in your browser, so your tasks, notes, plans and settings are stored on your device instead of being synced to a central LifeFlow server. Your life stays close to you.</p></div>
      <div class="manifesto-card manifesto-wide"><span>09</span><h3>A Markdown-powered Notes Manager</h3><p>Notes Manager gives you a flexible writing space with Markdown support. Format ideas with headings, bold and italic text, lists, checklists, links, tables and code blocks. Switch between Write and Preview to see your formatted notes as you work. Use double-square-bracket links like <code>[[Project Planning]]</code> to connect notes by title, with autocomplete to find existing notes. Open linked notes directly and explore the connections in Your Branches.</p></div>
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
  const sub = `<div class="subnav">${[['profile','Profile'],['custom','Customisation'],['connected','Connected'],['sessions','Sessions'],['danger','Danger Zone'],['data','Data Management']].map(([k,l])=>`<button class="${accountTab===k?'active':''}" data-lf-action="account-tab" data-account-tab="${k}">${l}</button>`).join('')}</div>`;
  if(accountTab==='profile') return sub + renderProfileTab(u);
  if(accountTab==='custom') return sub + renderCustomisationTab(u);
  if(accountTab==='connected') return sub + renderConnectedTab(u);
  if(accountTab==='sessions') return sub + renderSessionsTab(u);
  if(accountTab==='danger') return sub + renderDangerTab(u);
  if(accountTab==='data') return sub + renderDataManagementTab();
}

function secretSequence(u){
  const base={step:0,languageRevealed:false,used:false,pendingTeamAdmin:false};
  if(!u)return base;
  return Object.assign(base,u.secretSequence||{});
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

function showTaskMasterActivation(){
  const old=document.getElementById('taskMasterActivation');
  if(old) old.remove();

  taskMasterActivationActive=true;

  const overlay=document.createElement('div');
  overlay.id='taskMasterActivation';
  overlay.className='task-master-activation';
  overlay.setAttribute('role','status');
  overlay.setAttribute('aria-live','polite');
  overlay.innerHTML='<div class="task-master-terminal"><div class="task-master-terminal-text">* Your tasks have been generated</div></div>';
  document.body.appendChild(overlay);

  const audio=new Audio();
  audio.preload='auto';
  audio.volume=0.72;
  audio.src='assets/megalovania.mp3';
  overlay._audio=audio;

  const finishSequence=()=>{
    if(overlay._finished)return;
    overlay._finished=true;
    taskMasterActivationActive=false;
    overlay.classList.remove('is-visible');
    overlay.classList.add('is-fading');
    setTimeout(()=>{
      if(overlay.isConnected) overlay.remove();
      if(!document.getElementById('app')?.classList.contains('lifeflow-stage-hidden')) renderApp();
    },560);
  };

  // Normal path: the overlay lasts for the full track and fades only after it ends.
  audio.addEventListener('ended',finishSequence,{once:true});

  // Failure path: never leave a dead overlay on screen if the audio asset
  // is missing, corrupt, or cannot be loaded.
  audio.addEventListener('error',finishSequence,{once:true});

  // Start playback synchronously while this function is still inside the
  // Task Master button click. This preserves the browser's user-activation
  // permission for audio playback.
  const playAttempt=audio.play();
  if(playAttempt && typeof playAttempt.catch==='function'){
    playAttempt.catch(finishSequence);
  }

  requestAnimationFrame(()=>{
    overlay.classList.add('is-visible');
  });
}

function activateCobaltSequence(){
  const u=currentUser();
  if(!u)return;
  const s=secretSequence(u);
  const existingMaster=state.tasks.some(t=>Array.isArray(t.tags)&&t.tags.includes('Task Master'));
  // Task Master is intentionally repeatable during development/testing.
  // Each activation generates another fresh batch of 15 tasks.

  const base=new Date();
  base.setHours(12,0,0,0);
  const dateForOffset=(offset)=>{
    const d=new Date(base);
    d.setDate(d.getDate()+offset);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  };
  const pools={
    yesterday:[
      'Review yesterday’s notes','Clear yesterday’s unfinished work','Organise yesterday’s files',
      'Review completed work','Write yesterday’s follow-up','Archive old messages','Check yesterday’s priorities',
      'Update yesterday’s records','Review what was missed','Sort yesterday’s tasks'
    ],
    today:[
      'Plan today’s priorities','Finish the most important task','Review today’s schedule',
      'Clear the task list','Complete a focused work block','Handle today’s follow-up','Review today’s notes',
      'Organise today’s files','Finish an open item','Set today’s priorities'
    ],
    tomorrow:[
      'Prepare for tomorrow','Set tomorrow’s priorities','Review upcoming work',
      'Plan tomorrow’s schedule','Prepare the next steps','Organise tomorrow’s materials',
      'Review tomorrow’s commitments','Prepare tomorrow’s notes','Set up tomorrow’s work',
      'Plan the first task for tomorrow'
    ]
  };
  const pick=(items,count)=>{
    const copy=[...items];
    for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
    return copy.slice(0,count);
  };
  // Give every Task Master task its own random, non-overlapping
  // time interval. Five tasks are spread naturally across an 8 AM–8 PM day.
  const randomIntervals=()=>{
    const slots=[];
    const dayStart=8*60;
    const slotWidth=Math.floor((12*60)/5);
    for(let i=0;i<5;i++){
      const slotStart=dayStart+i*slotWidth;
      const latestStart=slotStart+Math.max(0,slotWidth-45);
      const start=slotStart+Math.floor(Math.random()*(latestStart-slotStart+1));
      const duration=30+Math.floor(Math.random()*46); // 30–75 minutes
      const end=Math.min(start+duration,dayStart+(i+1)*slotWidth-5);
      const hh=n=>String(Math.floor(n/60)).padStart(2,'0');
      const mm=n=>String(n%60).padStart(2,'0');
      slots.push({startTime:hh(start)+':'+mm(start),endTime:hh(end)+':'+mm(end)});
    }
    return slots;
  };

  const generated=[];
  [[-1,'yesterday'],[0,'today'],[1,'tomorrow']].forEach(([offset,key])=>{
    const intervals=randomIntervals();
    pick(pools[key],5).forEach((title,index)=>{
      const interval=intervals[index];
      generated.push({
        id:uid(),title,tags:['Task Master'],
        priority:['low','medium','high'][Math.floor(Math.random()*3)],
        due:dateForOffset(offset),
        startTime:interval.startTime,
        endTime:interval.endTime,
        recur:'none',status:'todo',done:false,subtasks:[]
      });
    });
  });

  // Backfill older Task Master tasks too, so every generated Task Master
  // task has an actual start and end time, not just date and priority.
  const missingMasterTimes=state.tasks.filter(t=>
    Array.isArray(t.tags)&&t.tags.includes('Task Master')&&
    (!validTime(t.startTime)||!validTime(t.endTime)||!validInterval(t.startTime,t.endTime))
  );
  if(lifeFlowTaskController){
    lifeFlowTaskController.updateAll(current=>current.map(t=>{
      if(!(Array.isArray(t.tags)&&t.tags.includes('Task Master')) ||
         (validTime(t.startTime)&&validTime(t.endTime)&&validInterval(t.startTime,t.endTime))) return t;
      const index=missingMasterTimes.findIndex(item=>String(item.id)===String(t.id));
      if(index<0)return t;
      const minute=8*60+(index%10)*70+Math.floor(Math.random()*25);
      const duration=30+Math.floor(Math.random()*31);
      const end=Math.min(minute+duration,20*60);
      const hh=n=>String(Math.floor(n/60)).padStart(2,'0');
      const mm=n=>String(n%60).padStart(2,'0');
      return {...t,startTime:hh(minute)+':'+mm(minute),endTime:hh(end)+':'+mm(end)};
    }));
    lifeFlowTaskController.addMany(generated);
  }else{
    missingMasterTimes.forEach(t=>{t.startTime=t.startTime||'08:00';t.endTime=t.endTime||'08:30';});
    state.tasks.push(...generated);save();
  }

  const next=Object.assign(s,{used:false,unlocked:true});
  updateSecretSequence(next);
  // Hide the trigger only because it was explicitly clicked.
  // Do not switch away from Profile, and do not let tab navigation affect the overlay/audio.
  document.getElementById('taskMasterHost')?.replaceChildren();
  // Keep the normal LifeFlow visual system during the event.
  // The Task Master effect belongs to the overlay, not the entire app.
  temporaryTheme=null;
  clearTimeout(temporaryThemeTimer);
  showTaskMasterActivation();
  toast('Task Master created 15 tasks: 5 yesterday, 5 today, 5 tomorrow.');
}
function showTaskMaster(){
  const host=document.getElementById('taskMasterHost');
  if(host)host.innerHTML='<button type="button" class="task-master-button" data-lf-action="task-master-activate"><span class="task-master-flame" aria-hidden="true"><i></i><b></b><em></em></span><span>TASK MASTER</span></button>';
}
function lfSecretAction(action){
  const u=currentUser(); if(!u)return;
  const s=secretSequence(u);
  if(false && s.used)return;
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
    <div class="profile-identity-row">
      <div class="avatar" id="avatarBox">${u.avatar?`<img src="${esc(u.avatar)}">`:'👤'}</div>
      <div>
        <div class="profile-upload"><input type="file" class="profile-file-input" accept="image/*" data-lf-change="avatar-change"></div>
        <div class="notice profile-upload-note">Upload only — cropping isn't included in this build.</div>
      </div>
    </div>
    <input id="prof_name" value="${esc(u.name)}" placeholder="Display name">
    <button class="primary account-action-spaced" data-lf-action="save-profile">Save</button>
  </div>
  <div class="card auto-logout-settings">
    <div class="custom-section-head"><div><h2>Auto Logout</h2><p>Choose how long LifeFlow can remain inactive before signing you out.</p></div></div>
    <label class="auto-logout-field" for="profileAutoLogout"><span><strong>Automatically log out after</strong><small>Your preference is saved to this account.</small></span><select id="profileAutoLogout" class="profile-select" data-lf-change="auto-logout"><option value="10" ${Number(u.autoLogoutMinutes??30)===10?'selected':''}>10 minutes</option><option value="15" ${Number(u.autoLogoutMinutes??30)===15?'selected':''}>15 minutes</option><option value="30" ${Number(u.autoLogoutMinutes??30)===30?'selected':''}>30 minutes</option><option value="60" ${Number(u.autoLogoutMinutes??30)===60?'selected':''}>1 hour</option><option value="never" ${u.autoLogoutMinutes==='never'?'selected':''}>Never</option></select></label>
    <p class="auto-logout-help">A reminder appears 60 seconds before logout. Choose “I'm still here” to continue your session.</p>
  </div>
  <div class="card">
    <h2>Localization</h2>
    <div class="lf-secret-field ${s.languageRevealed?'revealed':''}">
      <select id="prof_tz" class="profile-select" data-lf-change="profile-timezone">${tzs.map(tz=>`<option ${u.timezone===tz?'selected':''}>${tz}</option>`).join('')}</select>
    </div>
    <div class="lf-secret-field ${s.languageRevealed?'revealed':''}">
      <select id="prof_lang" class="profile-select" data-lf-change="profile-language">${langs.map(l=>`<option ${u.language===l?'selected':''}>${l}</option>`).join('')}</select>
      ${s.languageRevealed?'<span class="lf-secret-dot" aria-label="Language option revealed"></span>':''}
    </div>
    <select id="prof_week" class="profile-select" data-lf-change="profile-week">${[['Sunday','Sunday start'],['Monday','Monday start']].map(([v,label])=>`<option value="${v}" ${u.weekStart===v?'selected':''}>${label}</option>`).join('')}</select>
  </div>
  <div class="card">
    <h2>Account Tier</h2>
    <span class="badge ${u.tier.replace(' ','')}">${u.tier}</span>
    <select id="prof_tier" class="profile-tier-select">${['Free','Premium','Team Admin'].map(t=>`<option ${u.tier===t?'selected':''}>${t}</option>`).join('')}</select>
    <button class="primary account-action-spaced" data-lf-action="save-tier">Update settings</button>
    <div id="taskMasterHost" class="task-master-host">${s.step>=4&&!taskMasterActivationActive?'<button type="button" class="task-master-button" data-lf-action="task-master-activate"><span class="task-master-flame" aria-hidden="true"><i></i><b></b><em></em></span><span>TASK MASTER</span></button>':''}</div>
  </div>
  <div class="card change-password-launcher">
    <button type="button" class="primary" id="toggleChangePassword" aria-expanded="false" aria-controls="changePasswordPanel" data-lf-action="toggle-change-password">Change password</button>
  </div>
  <div class="card change-password-panel" id="changePasswordPanel" hidden>
    <div class="custom-section-head"><div><h2>Change Password</h2><p>Update your account password securely.</p></div><button type="button" class="hbtn" data-lf-action="close-change-password">Close</button></div>
    <input id="changeCurrentPassword" type="password" autocomplete="current-password" placeholder="Current password">
    <input id="changeNewPassword" class="password-change-input" type="password" autocomplete="new-password" placeholder="New password">
    <input id="changeConfirmPassword" class="password-change-input" type="password" autocomplete="new-password" placeholder="Confirm new password">
    <div class="notice password-guidance">Use at least 8 characters.</div>
    <button class="primary account-action-spaced" data-lf-action="change-password">Change password</button>
  </div>`;
}
function renderCustomisationTab(u){
  const themes=[['dark','Nighttime','A deep evening palette with clear, bright text'],['light','Daytime','A bright sky-inspired palette with dark, readable text']];
  const a=ambientSettings(u);
  return subCustomisation(themes,u,a);
}
function subCustomisation(themes,u,a){
  return `<div class="customisation-shell">
    <div class="card customisation-intro"><div><span class="custom-kicker">YOUR LIFEFLOW</span><h2>Customisation</h2><p>Shape the atmosphere around your planning without changing how LifeFlow works.</p></div><span class="theme-current-pill" id="currentThemeLabel">Currently using <b>${themeLabel(effectiveTheme(u))}</b></span></div>
    <div class="card"><div class="custom-section-head"><div><h2>Theme</h2><p>Choose the visual environment for your LifeFlow.</p></div><button class="hbtn" data-lf-action="reset-customisation">Reset to default</button></div>
      <div class="theme-gallery">${themes.map(([id,name,desc])=>`<button type="button" class="theme-preview theme-preview-${id} ${!u.autoTheme&&u.theme===id?'active':''}" data-lf-action="set-theme" data-theme-id="${id}" aria-pressed="${!u.autoTheme&&u.theme===id}">
        <span class="theme-preview-window"><i></i><b></b><em></em><small></small></span><span class="theme-preview-copy"><strong>${name}</strong><span>${desc}</span></span><span class="theme-check">${!u.autoTheme&&u.theme===id?'✓':'○'}</span>
      </button>`).join('')}</div>
      <label class="theme-sync-row"><span><strong>Auto theme sync</strong><small>Automatically match LifeFlow to your device's light or dark mode.</small></span><span class="switch"><input type="checkbox" ${u.autoTheme?"checked":""} data-lf-change="auto-theme-sync"><span class="slider"></span></span></label>
    </div>

    <div class="card workspace-atmosphere-card">
      <div class="custom-section-head"><div><h2>Workspace atmosphere</h2><p>Choose a scenic background for your workspace. The sidebar can be translucent so the scene carries through the layout.</p></div></div>
      <div class="backdrop-gallery">${workspaceBackdropOptions(u)}</div>
      <label class="theme-sync-row"><span><strong>Translucent sidebar</strong><small>Let the selected background show through the navigation panel.</small></span><span class="switch"><input type="checkbox" ${u.translucentSidebar!==false?'checked':''} data-lf-change="translucent-sidebar"><span class="slider"></span></span></label>
      <label class="theme-sync-row"><span><strong>Interactive atmosphere</strong><small>Let ambient light and the scenery respond gently to your pointer. Respects reduced-motion settings.</small></span><span class="switch"><input type="checkbox" ${u.interactiveAtmosphere!==false?'checked':''} data-lf-change="interactive-atmosphere"><span class="slider"></span></span></label>
    </div>
    <div class="card color-combinations-card"><div class="custom-section-head"><div><h2>Color combinations</h2><p>Choose the colour personality for your LifeFlow. It changes the full environment, not just the accents.</p></div><span class="theme-current-pill">Currently using <b>${({sapphire:'Sapphire',emerald:'Emerald',platinum:'Platinum',amethyst:'Amethyst',ruby:'Ruby'})[u.colorTheme||'sapphire']||'Sapphire'}</b></span></div>
      <div class="color-combinations">${[['sapphire','Sapphire','Blue based'],['emerald','Emerald','Green based'],['platinum','Platinum','Black & silver'],['amethyst','Amethyst','Purple based'],['ruby','Ruby','Red based']].filter(([id])=>id!=='amethyst'||['Premium','Team Admin'].includes(u.tier)).map(([id,name,desc])=>`<button type="button" class="color-combination color-${id} ${(u.colorTheme||'sapphire')===id?'active':''}" data-lf-action="set-color-theme" data-color-theme="${id}" aria-pressed="${(u.colorTheme||'sapphire')===id}"><span class="color-swatch"></span><span><strong>${name}</strong><small>${desc}</small></span><b>${(u.colorTheme||'sapphire')===id?'✓':'○'}</b></button>`).join('')}</div>
    </div>
<div class="card"><div class="custom-section-head"><div><h2>Ambient environment</h2><p>Let LifeFlow subtly respond to workload and time of day.</p></div><label class="ambient-toggle"><span>Ambient response</span><span class="switch"><input type="checkbox" ${a.ambientMode?'checked':''} data-lf-change="ambient-mode"><span class="slider"></span></span><strong>${a.ambientMode?'ON':'OFF'}</strong></label></div>
      <div class="ambient-preview" data-load="medium"><span class="ambient-orb"></span><div><strong>Adaptive atmosphere</strong><small>Background lighting becomes calmer with lighter workloads and more energetic as activity rises.</small></div></div>
      <div class="intensity-control"><div class="intensity-copy"><strong>Visual intensity</strong><span>Control how noticeable the ambient effect feels.</span></div><div class="intensity-slider"><input type="range" aria-label="Visual intensity" min="0" max="2" step="1" value="${a.ambientIntensity==='low'?0:a.ambientIntensity==='high'?2:1}" data-lf-input="ambient-intensity"><div class="range-labels"><span>Subtle</span><span>Balanced</span><span>Expressive</span></div></div><b class="intensity-value">${a.ambientIntensity}</b></div>
    </div>
    <div class="card customisation-note"><strong>Your choices persist automatically.</strong><span>Theme and atmosphere settings stay with this account and never change your tasks, navigation or information hierarchy.</span></div>
  </div>`;
}
function updateAmbientMode(enabled){updateUser(u=>{u.ambient=Object.assign(ambientSettings(u),{ambientMode:enabled});});}
function updateAmbientIntensity(value){const levels=['low','medium','high'];updateUser(u=>{u.ambient=Object.assign(ambientSettings(u),{ambientIntensity:levels[+value]||'medium'});});}
function resetCustomisation(){updateUser(u=>{u.theme='dark';u.autoTheme=false;u.colorTheme='platinum';u.workspaceBackdrop='amethyst';u.translucentSidebar=true;u.interactiveAtmosphere=true;u.ambient={ambientMode:true,ambientIntensity:'medium'};});}
function onAvatarChange(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{ updateUser(u=>u.avatar = reader.result); };
  reader.readAsDataURL(file);
}
function saveProfile(){ updateUser(u=>{ u.name=document.getElementById('prof_name').value.trim(); }); }
function saveLocalizationField(field,value){
  const u=currentUser(); if(!u)return;
  updateUser(user=>{ user[field]=value; });
}
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
function toggleChangePasswordPanel(force){
  const panel=document.getElementById('changePasswordPanel');
  const button=document.getElementById('toggleChangePassword');
  if(!panel||!button)return;
  const open=typeof force==='boolean'?force:panel.hidden;
  panel.hidden=!open;
  button.setAttribute('aria-expanded',String(open));
  if(open)panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function changePassword(){
  const current=document.getElementById('changeCurrentPassword')?.value||'';
  const next=document.getElementById('changeNewPassword')?.value||'';
  const confirm=document.getElementById('changeConfirmPassword')?.value||'';
  const u=currentUser();
  if(!u){ toast('Please sign in again.'); return; }
  if(!current||!next||!confirm){ toast('Please complete all password fields.'); return; }
  if(!(await verifyPassword(current,u))){ toast('Current password is incorrect.'); return; }
  if(next.length<8){ toast('New password must be at least 8 characters.'); return; }
  if(next!==confirm){ toast('New passwords do not match.'); return; }
  if(await verifyPassword(next,u)){ toast('Choose a different password.'); return; }
  const hash=await hashPassword(next);
  updateUser(user=>{user.passwordHash=hash;});
  ['changeCurrentPassword','changeNewPassword','changeConfirmPassword'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  toast('Password changed successfully.');
}

function saveTier(){
  const tier=document.getElementById('prof_tier')?.value;
  updateUser(u=>{
    u.tier=tier||u.tier;
    if(!['Premium','Team Admin'].includes(u.tier) && ['gold','amethyst'].includes(u.colorTheme)) u.colorTheme='sapphire';
    if(u.tier!=='Team Admin') u.secretSequence={step:0,languageRevealed:false,used:false,pendingTeamAdmin:false};
  });
  const saved=currentUser();
  if(saved?.tier==='Team Admin') lfSecretAction('tierTeamAdmin');
  else lfSecretAction('tierOther');
}
function renderConnectedTab(u){
  return `<div class="card"><h2>Identity Providers</h2>
    ${['Google','Apple','GitHub'].map(p=>`<div class="row-between">
      <div>${p}${u.connected[p]?' <span class="notice linked-provider-badge">Linked</span>':''}</div>
      <label class="switch"><input type="checkbox" ${u.connected[p]?'checked':''} data-lf-change="toggle-connected" data-provider="${p}"><span class="slider"></span></label>
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
  let mock = state.mockSessions;
  if (!Array.isArray(mock)) {
    mock = [
      {device:'iPhone · Safari', loc:'Mumbai, IN', last:'2 days ago'},
      {device:'Windows · Edge', loc:'Pune, IN', last:'1 week ago'}
    ];
    updateWorkspaceState({ mockSessions: mock });
  }
  return `<div class="card"><h2>Active Sessions</h2>
    <div class="row-between"><div><strong>${browser} · This device</strong><div class="notice current-session-notice">Current session — expires ${new Date(s.expiresAt).toLocaleString()}</div></div><span></span></div>
    ${mock.map((m,i)=>`<div class="row-between"><div>${esc(m.device)}<div class="session-detail">${esc(m.loc)} · ${esc(m.last)} (simulated)</div></div><button class="del" data-lf-action="revoke-session" data-session-index="${i}">Revoke</button></div>`).join('')}
    <button class="primary session-logout-button" data-lf-action="revoke-all">Log out all other devices</button>
  </div>`;
}
function revokeSession(i){
  const sessions=Array.isArray(state.mockSessions)?state.mockSessions.slice():[];
  if(!Number.isInteger(i)||i<0||i>=sessions.length)return;
  sessions.splice(i,1);
  updateWorkspaceState({mockSessions:sessions});
  renderApp();
}
function revokeAll(){
  updateWorkspaceState({mockSessions:[]});
  renderApp();
}

function getDataHealthSnapshot(){
  const user=currentUser()||{},lastBackup=user.lastBackupAt?new Date(user.lastBackupAt):null;
  const validBackupDate=lastBackup&&!Number.isNaN(lastBackup.getTime());
  const ageMs=validBackupDate?Math.max(0,Date.now()-lastBackup.getTime()):null;
  const backupState=ageMs===null?'missing':ageMs<86400000?'fresh':'stale';
  let usedBytes=0,integrity='ok',integrityMessage='Basic workspace structure check passed';
  try{
    const keys=[];
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&(key.startsWith('lifeflow2_')||key==='lifeflow_users'))keys.push(key);}
    keys.forEach(key=>{const value=localStorage.getItem(key)||'';usedBytes+=(key.length+value.length)*2;});
    const stateKey='lifeflow2_state_'+encodeURIComponent(String(state?.currentUser||''));
    const raw=localStorage.getItem(stateKey);
    const stored=raw?JSON.parse(raw):(lifeFlowTaskStateManager?.getState?.()||state);
    if(!stored||typeof stored!=='object'||Array.isArray(stored)||!Array.isArray(stored.tasks||[]))throw new Error('Workspace state has an unexpected structure');
    ['notes','codeNotes','folders','noteLinks'].forEach(key=>{if(stored[key]!==undefined&&!Array.isArray(stored[key]))throw new Error('Invalid '+key);});
    JSON.stringify(stored);
  }catch(error){integrity='check';integrityMessage='Could not verify all saved workspace data';}
  const approximateLimit=5*1024*1024,percent=Math.min(100,Math.round(usedBytes/approximateLimit*100));
  const formatBytes=bytes=>bytes<1024?bytes+' B':bytes<1024*1024?(bytes/1024).toFixed(1)+' KB':(bytes/1024/1024).toFixed(2)+' MB';
  let backupLabel='No backup recorded';
  if(ageMs!==null){const hours=Math.floor(ageMs/3600000);backupLabel=hours<1?'Backed up less than an hour ago':hours<24?'Last backup '+hours+' hour'+(hours===1?'':'s')+' ago':'Last backup '+Math.floor(hours/24)+' day'+(Math.floor(hours/24)===1?'':'s')+' ago';}
  return {backupState,backupLabel,usedLabel:formatBytes(usedBytes),percent,integrity,integrityMessage};
}
function recordLastBackup(){
  const users=getUsers(),email=state?.currentUser;
  if(!email||!users[email])return;
  users[email].lastBackupAt=new Date().toISOString();
  saveUsers(users);
}
function renderDataManagementTab(){
  const health=getDataHealthSnapshot();
  return `<section class="card master-archive-card">\n    <div class="data-health-panel" aria-label="Data health"><div class="data-health-heading"><div><span class="custom-kicker">WORKSPACE STATUS</span><h3>Data Health</h3></div><span class="data-health-pill ${health.backupState==='fresh'?'is-good':health.backupState==='stale'?'is-warning':'is-missing'}">${health.backupState==='fresh'?'Protected':health.backupState==='stale'?'Backup overdue':'No backup yet'}</span></div><div class="data-health-grid"><div class="data-health-metric"><span>Last backup</span><strong>${health.backupLabel}</strong></div><div class="data-health-metric"><span>Storage used</span><strong>${health.usedLabel}</strong></div><div class="data-health-metric"><span>Data integrity</span><strong class="${health.integrity==='ok'?'health-integrity-ok':'health-integrity-warning'}">${health.integrityMessage}</strong></div></div><div class="data-health-storage"><div><span>Estimated browser storage</span><strong>${health.percent}%</strong></div><div class="data-health-track"><span style="width:${health.percent}%"></span></div><small>Approximation based on LifeFlow localStorage data and a 5 MB reference limit. Actual browser limits vary.</small></div></div>
    <div class="custom-section-head"><div><span class="custom-kicker">DATA OWNERSHIP</span><h2>Master Archive</h2><p>Download a portable snapshot of your LifeFlow workspace, including your profile, preferences, folders, notes, tasks and saved note links.</p></div></div>
    <div class="master-secure-options"><label class="master-secure-toggle"><input id="masterArchiveSecure" type="checkbox"> <span>Secure Backup (password-protected)</span></label><div id="masterArchivePasswordFields" class="master-password-fields" hidden><label>Backup password<input id="masterArchivePassword" type="password" autocomplete="new-password" minlength="10" placeholder="At least 10 characters"></label><label>Confirm password<input id="masterArchivePasswordConfirm" type="password" autocomplete="new-password" minlength="10" placeholder="Re-enter backup password"></label><p class="master-encryption-warning">Critical: If you lose this password, your backup cannot be recovered. There is no reset password for encrypted files.</p></div></div><div class="master-archive-actions"><button type="button" class="primary master-archive-button" data-lf-action="backup-master-archive">⇩ Backup Now</button><button type="button" class="secondary master-archive-button" data-lf-action="choose-master-archive">↥ Restore Backup</button></div><input id="masterArchiveFile" class="master-archive-file" type="file" accept=".json,application/json" aria-label="Choose LifeFlow backup file">
    <p class="notice master-archive-warning"><strong>Protect your data:</strong> LifeFlow stores your workspace in this browser. Clearing browser storage or losing this device can erase it. Create and keep an archive somewhere safe, and repeat regularly.</p>
    <small class="muted">The archive contains your data, not your login session or password credentials. You will need to sign in again after a future restore.</small>
  </section>`;
}
function renderDangerTab(u){
  const email = esc(state.currentUser || '');
  return `<div class="card"><h2>Delete Account</h2>
    <div class="notice danger-notice">You are deleting <strong>${email}</strong>. Only this account is removed; other accounts and their tasks stay.</div>
    ${u.passwordHash?'<input id="danger_pass" class="danger-password-input" type="password" placeholder="Confirm your password">':'<div class="notice">This account signs in with '+(u.oauthProvider||'an identity provider')+', so no password is needed to confirm.</div>'}
    <select id="danger_mode" class="danger-mode-select">
      <option value="soft">Soft delete — 30-day recovery window</option>
      <option value="hard">Hard delete — immediate, permanent, email freed for reuse</option>
    </select>
    <button class="primary danger-action" data-lf-action="delete-account">Delete ${email}</button>
  </div>
  <div class="card"><h2>Reset All App Data</h2>
    <div class="notice">Stuck at login, or an email says "already taken" and you can't get in? This wipes every account, task, and setting LifeFlow stored in this browser - a clean slate. There is no undo.</div>
    <button class="primary danger-action" data-lf-action="reset-all-data">Erase everything in this browser</button>
  </div>`;
}
function resetAllData(){
  if(!confirm('Erase ALL LifeFlow data in this browser - every account, task, and setting? There is no undo.')) return;
  // Let the active managers flush first, then remove every LifeFlow-owned key.
  doLogout();
  const keysToRemove=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key && (
      key==='lifeflow2_users' ||
      key==='lifeflow2_state' ||
      key.startsWith('lifeflow2_state_') ||
      key==='lifeflow2_auth_theme' ||
      key==='lifeflow2_density' ||
      key==='lifeflow_login_guard' ||
      key==='lifeflow2_session'
    )) keysToRemove.push(key);
  }
  keysToRemove.forEach(key=>localStorage.removeItem(key));
  sessionStorage.removeItem('lifeflow2_oauth');
  sessionStorage.removeItem('lifeflow2_session');
  state = {tasks:[]}; // fresh in-memory state; nothing is written back to storage
  alert('All app data erased. You can sign up fresh.');
}
async function deleteAccount(){
  const passEl = document.getElementById('danger_pass');
  const mode = document.getElementById('danger_mode').value;
  const deletingEmail = state.currentUser;
  const users = getUsers();
  const u = users[deletingEmail];
  if(u.passwordHash && !(await verifyPassword(passEl ? passEl.value : '', u))){ alert('Incorrect password for '+deletingEmail+'.'); return; }
  let permanentlyDeleted = false;
  if(mode==='soft'){
    u.deletedAt = new Date(Date.now()+30*86400000).toISOString();
    saveUsers(users);
    alert(deletingEmail+' scheduled for deletion. Data is recoverable until '+new Date(u.deletedAt).toDateString()+'.');
  }else{
    if(!confirm('Permanently delete '+deletingEmail+' right now? The email becomes reusable immediately. There is no undo.')) return;
    delete users[deletingEmail];
    saveUsers(users);
    permanentlyDeleted = !getUsers()[deletingEmail];
    alert(permanentlyDeleted
      ? deletingEmail+' permanently deleted. That email is free to sign up again.'
      : 'Delete failed - storage did not update. Try Reset All App Data instead.');
  }
  // Sign-out flushes the active StateManager before we remove its account key.
  doLogout();
  if(permanentlyDeleted){
    try{localStorage.removeItem(profileStateKey(deletingEmail));}catch(_){}
  }
}

// Explicitly publish authentication entry points for the HTML login form and OAuth controls.
window.doLogin = doLogin;
window.doSignup = doSignup;
window.doVerify = doVerify;
window.startSignup = startSignup;
window.renderOAuthButtons = renderOAuthButtons;
window.oauthLogin = oauthLogin;
window.demoOAuthLogin = demoOAuthLogin;
window.startPasskeyLogin = startPasskeyLogin;
window.handleOAuthCallback = handleOAuthCallback;

(async function boot(){
  initializeAuthArchitecture();
  try {
    await initializeThemeArchitecture();
    await initializeTaskArchitecture();
    initializeNotesArchitecture();
    initializeUIArchitecture();
  } catch (error) {
    console.error('LifeFlow core modules could not be fully initialized:', error);
    showToast('Some workspace features could not be initialized. Please refresh the workspace.');
  }
  lifeFlowCoreReady = true;
  startAutoLogoutMonitor();
  initAuthTheme();
  initAppThemeSync();
  renderOAuthButtons();
  if(!window.crypto || !crypto.subtle){
    showOAuthNotice('This app needs the Web Crypto API. Serve it over https or http://localhost (most browsers treat file:// and plain http as insecure).');
  }
  await handleOAuthCallback();
  const authParams = new URLSearchParams(window.location.search);
  const authEntry = authParams.get('auth');
  if(authParams.get('embed')==='1') document.body.classList.add('auth-embed');
  if(authEntry === 'signup') startSignup();
  else if(authEntry === 'login') showStep('stepLogin');
  const session = getSession();
  if(session && document.getElementById('app').classList.contains('lifeflow-stage-hidden')){
    normalizeDemoProfile(session.email);
    state.currentUser = session.email;
    enterApp();
  }
})();
