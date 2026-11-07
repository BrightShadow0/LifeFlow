(function(global){
'use strict';
function createViewOrchestrator(){
  let activeView=null,renderers={},lastError=null;
  const FALLBACK='<section class="card lf-render-error" role="alert" aria-live="assertive"><h2>Something went wrong loading this section</h2><p>Your workspace is still running. Try switching sections or refreshing the page.</p></section>';
  function configure(next){renderers={...(next||{})};}
  function render({view,state,container,onAfterRender,onError}){
    if(!container)return false;
    const changed=activeView!==view;
    if(changed){container.replaceChildren();activeView=view;container.dataset.activeView=view;}
    const renderer=renderers[view];
    try{
      const output=typeof renderer==='function'?renderer(state||{}):'';
      container.innerHTML=output;
      lastError=null;
    }catch(error){
      lastError=error;
      try{container.innerHTML=FALLBACK;}catch(_){container.textContent='Something went wrong loading this section.';}
      if(typeof onError==='function'){
        try{onError(error,view);}catch(callbackError){console.error('LifeFlow render error handler failed:',callbackError);}
      }else{
        console.error('LifeFlow section render failed ('+String(view)+'):',error);
      }
    }
    if(changed){
      container.classList.remove('page-enter');void container.offsetWidth;container.classList.add('page-enter');
      const clear=()=>container.classList.remove('page-enter');
      if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>setTimeout(clear,900));else setTimeout(clear,900);
    }
    if(typeof onAfterRender==='function'){
      try{onAfterRender(view,state,{changed,error:lastError});}
      catch(error){
        lastError=error;
        console.error('LifeFlow post-render enhancement failed ('+String(view)+'):',error);
      }
    }
    return !lastError;
  }
  return {configure,render,reset:()=>{activeView=null;lastError=null;},getActiveView:()=>activeView,getLastError:()=>lastError};
}
global.LifeFlowUIModule={createViewOrchestrator};
})(window);
