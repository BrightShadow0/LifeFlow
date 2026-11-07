(function(global){
'use strict';
function createViewOrchestrator(){
  let activeView=null,renderers={};
  function configure(next){renderers={...(next||{})};}
  function render({view,state,container,onAfterRender}){
    if(!container)return false;
    const changed=activeView!==view;
    if(changed){container.replaceChildren();activeView=view;container.dataset.activeView=view;}
    const renderer=renderers[view];
    container.innerHTML=typeof renderer==='function'?renderer(state||{}):'';
    if(changed){
      container.classList.remove('page-enter');void container.offsetWidth;container.classList.add('page-enter');
      const clear=()=>container.classList.remove('page-enter');
      if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>setTimeout(clear,900));else setTimeout(clear,900);
    }
    if(typeof onAfterRender==='function')onAfterRender(view,state,{changed});
    return true;
  }
  return {configure,render,reset:()=>{activeView=null;},getActiveView:()=>activeView};
}
global.LifeFlowUIModule={createViewOrchestrator};
})(window);
