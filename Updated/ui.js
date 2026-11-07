(function(global){
'use strict';
function escapeKnowledgeHtml(value){
  return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function renderFolderCategory(options){
  const {folder,notes=[],collapsed=false,selectedId=null}=options||{};
  const name=escapeKnowledgeHtml(folder?.name||'Unfiled'),icon=escapeKnowledgeHtml(folder?.icon||'▣');
  const folderName=String(folder?.name||'Unfiled');
  const rows=collapsed?'':notes.map(note=>{
    const id=escapeKnowledgeHtml(note.id),title=escapeKnowledgeHtml(note.title||'Untitled');
    const date=escapeKnowledgeHtml(new Date(note.updatedAt||Date.now()).toLocaleDateString());
    const active=String(note.id)===String(selectedId)?' active':'';
    return '<button class="note-item'+active+'" data-lf-action="note-select" data-lf-note-context aria-haspopup="menu" data-note-id="'+id+'"><strong>'+title+'</strong><small>'+date+'</small></button>';
  }).join('');
  return '<section class="note-folder" data-folder-name="'+escapeKnowledgeHtml(folderName)+'"><button class="note-folder-heading" type="button" data-lf-action="note-folder-toggle" data-folder-name="'+name+'" data-lf-folder-context aria-haspopup="menu"><span>'+icon+'</span><strong>'+name+'</strong><small>'+notes.length+'</small><span class="folder-chevron">'+(collapsed?'▸':'▾')+'</span></button>'+rows+'</section>';
}
function renderSearchSnippet(options){
  const {folder='',folderIcon='▤',snippet='',terms=[]}=options||{};
  const source=String(snippet||''),needles=Array.from(new Set((terms||[]).map(value=>String(value||'').trim()).filter(Boolean))).sort((a,b)=>b.length-a.length);
  let html='',cursor=0;
  while(cursor<source.length){
    let found=-1,matched='';
    needles.forEach(term=>{const index=source.toLowerCase().indexOf(term.toLowerCase(),cursor);if(index>=0&&(found<0||index<found)){found=index;matched=source.slice(index,index+term.length);}});
    if(found<0){html+=escapeKnowledgeHtml(source.slice(cursor));break;}
    html+=escapeKnowledgeHtml(source.slice(cursor,found))+'<mark class="search-highlight">'+escapeKnowledgeHtml(matched)+'</mark>';
    cursor=found+matched.length;
  }
  return '<span class="search-snippet-folder"><span class="search-snippet-icon" aria-hidden="true">'+escapeKnowledgeHtml(folderIcon)+'</span> '+escapeKnowledgeHtml(folder)+'</span> · <span class="search-snippet-text">'+html+'</span>';
}
function renderBacklinkItem(item){
  const id=escapeKnowledgeHtml(item?.id),line=Number.isInteger(item?.line)?item.line:0;
  return '<button type="button" class="backlink-item" data-lf-action="note-backlink" data-note-id="'+id+'" data-line-index="'+line+'"><strong>'+escapeKnowledgeHtml(item?.title||'Untitled')+'</strong><span>'+escapeKnowledgeHtml(item?.context||'')+'</span></button>';
}
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
global.LifeFlowUIModule={createViewOrchestrator,renderFolderCategory,renderSearchSnippet,renderBacklinkItem};
})(window);
