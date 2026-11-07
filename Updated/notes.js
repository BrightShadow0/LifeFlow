(function(global){
'use strict';
let viewRenderers={};
function configureRenderers(renderers){viewRenderers={...(renderers||{})};}
function render(state,view){const renderer=viewRenderers[view];return typeof renderer==='function'?renderer(state||{}):'';}
function createNotesController(options){
  const {stateManager,getCurrentState,uid}=options||{};
  if(!stateManager||typeof stateManager.setState!=='function')throw new TypeError('Notes controller requires a StateManager.');
  const snapshot=()=>stateManager.getState();
  const noteKey=kind=>kind==='code'?'codeNotes':'notes';
  let regularNotesRevision=0,searchIndexCache=null,backlinkIndexCache=null,graphLinksCache=null,committingNotes=false;
  if(typeof stateManager.subscribe==='function'){
    stateManager.subscribe('notes',()=>{
      regularNotesRevision++;searchIndexCache=null;backlinkIndexCache=null;graphLinksCache=null;
      if(!committingNotes)notifyKnowledgeChange('notes-synced-from-another-window');
    });
  }
  function notifyKnowledgeChange(reason){
    if(typeof global.dispatchEvent!=='function'||typeof global.CustomEvent!=='function')return;
    global.dispatchEvent(new global.CustomEvent('lifeflow:knowledge-change',{detail:{reason,revision:regularNotesRevision}}));
  }
  function commit(patch){
    if(Object.prototype.hasOwnProperty.call(patch||{},'notes')){
      regularNotesRevision++;
      searchIndexCache=null;
      backlinkIndexCache=null;
      graphLinksCache=null;
    }
    committingNotes=true;
    try{stateManager.setState({...getCurrentState(),...patch});}
    finally{committingNotes=false;}
  }
  function getNotes(kind){const list=snapshot()[noteKey(kind)];return Array.isArray(list)?list:[];}
  function selectedId(){return snapshot().selectedNoteId??null;}
  function selectedKind(){return snapshot().selectedNoteKind||'regular';}
  function noteView(){return snapshot().noteView==='preview'?'preview':'edit';}
  function makeNoteCode(){
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code='';
    do{code='LF-';for(let i=0;i<6;i++)code+=alphabet[Math.floor(Math.random()*alphabet.length)];}
    while([...getNotes('regular'),...getNotes('code')].some(note=>note.noteCode===code));
    return code;
  }
  function ensure(){
    const current=snapshot(),patch={};let changed=false;
    ['notes','codeNotes','noteLinks'].forEach(key=>{if(!Array.isArray(current[key])){patch[key]=[];changed=true;}});
    const defaults=[
      {id:'folder-work',name:'Work',icon:'💼',color:'#55ddeb',isDefault:true},
      {id:'folder-personal',name:'Personal',icon:'◉',color:'#a78bfa',isDefault:true},
      {id:'folder-projects',name:'Projects',icon:'▣',color:'#f5b942',isDefault:true},
      {id:'folder-archive',name:'Archive',icon:'▤',color:'#94a3b8',isDefault:true},
      {id:'unfiled',name:'Unfiled',icon:'▤',color:'#94a3b8',isDefault:true}
    ];
    const existing=Array.isArray(current.folders)?current.folders:[];
    const folders=defaults.map(base=>existing.find(item=>item.id===base.id||String(item.name||'').toLowerCase()===base.name.toLowerCase())||base);
    existing.forEach(item=>{if(!folders.some(folder=>folder.id===item.id||folder.name.toLowerCase()===String(item.name||'').toLowerCase()))folders.push(item);});
    if(!Array.isArray(current.folders)||JSON.stringify(folders)!==JSON.stringify(current.folders)){patch.folders=folders;changed=true;}
    if(!Array.isArray(current.collapsedFolders)){patch.collapsedFolders=[];changed=true;}
    if(typeof current.searchQuery!=='string'){patch.searchQuery='';changed=true;}
    ['notes','codeNotes'].forEach(key=>{
      const list=Array.isArray(current[key])?current[key]:[];
      const next=list.map(note=>{
        let updated=note;
        if(!note.noteCode){updated={...updated,noteCode:makeNoteCode()};changed=true;}
        const legacyName=String(updated.folder||'Unfiled');
        const folder=folders.find(item=>item.id===updated.folderId||item.name===legacyName)||folders.find(item=>item.id==='unfiled');
        if(!updated.folderId||updated.folderId!==folder.id||updated.folder!==folder.name){updated={...updated,folderId:folder.id,folder:folder.name};changed=true;}
        return updated;
      });
      if(next.some((note,index)=>note!==list[index]))patch[key]=next;
    });
    if(changed)commit(patch);
    return true;
  }
  function nextNumber(kind){
    const notes=getNotes(kind);if(!notes.length)return 1;
    const highest=notes.reduce((max,note)=>{
      const stored=Number(note.noteNumber)||0;
      const match=String(note.title||'').match(/^Untitled Note\s+(\d+)$/i);
      return Math.max(max,stored,match?Number(match[1]):0);
    },0);
    return Math.max(notes.length,highest)+1;
  }
  function recordVersion(id,reason='manual'){
    const note=getNotes('regular').find(item=>String(item.id)===String(id));if(!note)return null;
    const history=Array.isArray(note.versionHistory)?note.versionHistory.slice():[],title=String(note.title||''),content=String(note.content||''),latest=history[history.length-1];
    if(latest&&latest.title===title&&latest.content===content)return latest;
    const version={id:'v-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),title,content,createdAt:Date.now(),reason:String(reason||'autosave')};
    history.push(version);updateFields('regular',id,{versionHistory:history.slice(-20)});return version;
  }
  function getVersionHistory(id){const note=getNotes('regular').find(item=>String(item.id)===String(id));return note&&Array.isArray(note.versionHistory)?note.versionHistory.slice().sort((a,b)=>b.createdAt-a.createdAt):[];}
  function restoreVersion(id,versionId){
    const note=getNotes('regular').find(item=>String(item.id)===String(id));if(!note)return false;
    const version=(note.versionHistory||[]).find(item=>String(item.id)===String(versionId));if(!version)return false;
    recordVersion(id,'before-restore');
    const refreshed=getNotes('regular').find(item=>String(item.id)===String(id)),history=Array.isArray(refreshed?.versionHistory)?refreshed.versionHistory:[];
    const next=getNotes('regular').map(item=>String(item.id)===String(id)?{...item,title:String(version.title||'Untitled note'),content:String(version.content||''),versionHistory:history,updatedAt:Date.now()}:item);
    commit({notes:next,selectedNoteId:id,selectedNoteKind:'regular',noteView:'edit'});notifyKnowledgeChange('note-version-restored');return true;
  }
  function select(id,kind='regular',view='edit'){
    const previous=selectedId(),previousKind=selectedKind();if(previous!=null&&String(previous)!==String(id)&&previousKind==='regular')recordVersion(previous,'note-switch');
    commit({selectedNoteId:id??null,selectedNoteKind:kind==='code'?'code':'regular',noteView:view==='preview'?'preview':'edit'});return id??null;
  }
  function newNote(kind='regular'){
    ensure();const number=kind==='regular'?nextNumber(kind):null;
    const note={id:uid(),noteCode:makeNoteCode(),title:kind==='code'?'Untitled Code Note':'Untitled Note '+number,noteNumber:number,content:'',code:'',language:'javascript',folderId:'unfiled',folderId:'unfiled',folder:'Unfiled',createdAt:Date.now(),updatedAt:Date.now()};
    commit({[noteKey(kind)]:[note,...getNotes(kind)],selectedNoteId:note.id,selectedNoteKind:kind==='code'?'code':'regular',noteView:'edit'});
    if(kind!=='code')notifyKnowledgeChange('note-created');
    return note;
  }
  function updateContent(kind,id,value){
    const key=noteKey(kind);let found=false;
    const next=getNotes(kind).map(note=>{
      if(String(note.id)!==String(id))return note;
      found=true;return {...note,[kind==='code'?'code':'content']:value,updatedAt:Date.now()};
    });
    if(found){commit({[key]:next});if(kind!=='code')notifyKnowledgeChange('note-content-updated');}
    return found;
  }
  function updateFields(kind,id,patch){
    const key=noteKey(kind);let found=false;
    const next=getNotes(kind).map(note=>{
      if(String(note.id)!==String(id))return note;
      found=true;return {...note,...patch,updatedAt:Date.now()};
    });
    if(found){commit({[key]:next});if(kind!=='code'&&Object.prototype.hasOwnProperty.call(patch||{},'title'))notifyKnowledgeChange('note-renamed');}
    return found;
  }
  function deleteNote(kind,id){
    const key=noteKey(kind),list=getNotes(kind),next=list.filter(note=>String(note.id)!==String(id));
    if(next.length===list.length)return false;
    commit({[key]:next,selectedNoteId:null});if(kind!=='code')notifyKnowledgeChange('note-deleted');return true;
  }
  function deleteAll(kind){
    const key=noteKey(kind),count=getNotes(kind).length;if(!count)return 0;
    commit({[key]:[],selectedNoteId:null,noteView:'edit'});if(kind!=='code')notifyKnowledgeChange('notes-cleared');return count;
  }
  function openByTitle(title){
    const clean=String(title||'').trim();if(!clean)return null;
    let note=getNotes('regular').find(item=>String(item.title||'').trim().toLowerCase()===clean.toLowerCase());
    if(!note){
      note={id:uid(),noteCode:makeNoteCode(),title:clean,noteNumber:null,content:'',code:'',language:'javascript',folder:'Unfiled',createdAt:Date.now(),updatedAt:Date.now()};
      commit({notes:[note,...getNotes('regular')]});notifyKnowledgeChange('note-created-by-link');
    }
    select(note.id,'regular','edit');return note;
  }
  function autoTitle(id,value){
    const note=getNotes('regular').find(item=>String(item.id)===String(id));if(!note)return false;
    const current=String(note.title||'');if(!/^Untitled Note\s+\d+$/i.test(current))return false;
    const first=String(value||'').split(/\r?\n/).map(line=>line.replace(/^\s*#+\s*/,'').trim()).find(Boolean);
    if(!first)return false;
    const title=first.length>52?first.slice(0,49).trimEnd()+'…':first;
    return title!==current&&updateFields('regular',id,{title});
  }
  function getFolders(){return snapshot().folders||[{id:'unfiled',name:'Unfiled',icon:'▤',isDefault:true}];}
  function resolveFolder(reference){return getFolders().find(item=>item.id===reference||item.name===reference)||null;}
  function createFolder(name,icon='▣'){
    const clean=String(name||'').trim().slice(0,40);if(!clean)return null;
    if(getFolders().some(folder=>String(folder.name||'').toLowerCase()===clean.toLowerCase()))return null;
    const folder={id:'folder-'+uid(),name:clean,icon:String(icon||'▣').slice(0,4),color:'#55ddeb',isDefault:false};
    commit({folders:[...getFolders(),folder]});return folder;
  }
  function moveToFolder(id,folderReference){
    const folder=resolveFolder(folderReference);if(!folder)return false;
    return updateFields('regular',id,{folderId:folder.id,folder:folder.name});
  }
  function renameFolder(reference,nextName){
    const folder=resolveFolder(reference),clean=String(nextName||'').trim().slice(0,40);
    if(!folder||folder.id==='unfiled'||!clean||getFolders().some(item=>item.id!==folder.id&&String(item.name||'').toLowerCase()===clean.toLowerCase()))return false;
    commit({folders:getFolders().map(item=>item.id===folder.id?{...item,name:clean}:item),notes:getNotes('regular').map(note=>(note.folderId===folder.id||(!note.folderId&&note.folder===folder.name))?{...note,folder:clean,updatedAt:Date.now()}:note)});
    return true;
  }
  function deleteFolder(reference){
    const folder=resolveFolder(reference);if(!folder||folder.id==='unfiled')return false;
    const unfiled=resolveFolder('unfiled')||{id:'unfiled',name:'Unfiled'};
    commit({
      folders:getFolders().filter(item=>item.id!==folder.id),
      notes:getNotes('regular').map(note=>(note.folderId===folder.id||(!note.folderId&&note.folder===folder.name))?{...note,folderId:unfiled.id,folder:unfiled.name,updatedAt:Date.now()}:note),
      collapsedFolders:(snapshot().collapsedFolders||[]).filter(item=>item!==folder.name&&item!==folder.id)
    });
    return true;
  }
  function toggleFolder(name){const collapsed=new Set(snapshot().collapsedFolders||[]);if(collapsed.has(name))collapsed.delete(name);else collapsed.add(name);commit({collapsedFolders:[...collapsed]});}
  function setSearchQuery(query){commit({searchQuery:String(query||'')});}
  function getGraphLinks(){
    if(graphLinksCache&&graphLinksCache.revision===regularNotesRevision)return graphLinksCache.edges;
    const notes=getNotes('regular'),byTitle=new Map(),seen=new Set(),edges=[];
    notes.forEach(note=>{
      const title=String(note.title||'').trim().toLowerCase();
      if(title&&!byTitle.has(title))byTitle.set(title,note);
    });
    notes.forEach(source=>{
      const content=String(source.content||'').replace(/\r\n?/g,'\n');
      const pattern=/\[\[\s*([^\]\n]+?)\s*\]\]/g;let match;
      while((match=pattern.exec(content))){
        const cleanTitle=match[1].trim(),title=cleanTitle.toLowerCase();
        if(!title)continue;
        const target=byTitle.get(title);
        if(target&&String(target.id)===String(source.id))continue;
        const targetId=target?String(target.id):'ghost:'+title;
        const key=[String(source.id),targetId].join('|');
        if(seen.has(key))continue;
        seen.add(key);
        const prefix=content.slice(0,match.index),line=prefix.split('\n').length-1;
        const context=content.split('\n')[line]?.trim()||'';
        edges.push({from:String(source.id),to:targetId,fromTitle:source.title||'Untitled',toTitle:target?.title||cleanTitle,token:match[0],line,context:context.length>220?context.slice(0,217)+'…':context,ghost:!target});
      }
    });
    graphLinksCache={revision:regularNotesRevision,edges};return edges;
  }
  function extractBacklinkContext(line,start,length){
    const raw=String(line||''),text=raw.trim();if(!text)return '';
    const leading=raw.length-raw.trimStart().length,matchStart=Math.max(0,start-leading),matchEnd=matchStart+length;
    const before=text.slice(0,matchStart),after=text.slice(matchEnd);
    const leftBoundary=Math.max(before.lastIndexOf('. '),before.lastIndexOf('! '),before.lastIndexOf('? '),before.lastIndexOf('; '));
    const rightCandidates=['. ','! ','? ','; '].map(token=>after.indexOf(token)).filter(index=>index>=0);
    const rightBoundary=rightCandidates.length?Math.min(...rightCandidates):-1;
    const context=text.slice(leftBoundary<0?0:leftBoundary+2,rightBoundary<0?text.length:matchEnd+rightBoundary+1).trim();
    return context.length>220?context.slice(0,217)+'…':context;
  }
  function getBacklinkIndex(){
    if(backlinkIndexCache&&backlinkIndexCache.revision===regularNotesRevision)return backlinkIndexCache.index;
    const index=new Map();
    getNotes('regular').forEach(source=>{
      const lines=String(source.content||'').replace(/\r\n?/g,'\n').split('\n'),seen=new Set();
      lines.forEach((line,lineNumber)=>{
        const pattern=/\[\[\s*([^\]]+?)\s*\]\]/g;let match;
        while((match=pattern.exec(line))){
          const key=match[1].trim().toLowerCase();if(!key||seen.has(key))continue;
          seen.add(key);
          if(!index.has(key))index.set(key,[]);
          index.get(key).push({id:source.id,title:source.title||'Untitled',line:lineNumber,context:extractBacklinkContext(line,match.index,match[0].length),targetTitle:match[1].trim()});
        }
      });
    });
    backlinkIndexCache={revision:regularNotesRevision,index};return index;
  }
  function getBacklinks(targetId){
    const target=getNotes('regular').find(note=>String(note.id)===String(targetId));
    if(!target)return [];
    const title=String(target.title||'').trim().toLowerCase();
    if(!title)return [];
    return (getBacklinkIndex().get(title)||[]).filter(item=>String(item.id)!==String(targetId));
  }
  function getSearchIndex(){
    if(searchIndexCache&&searchIndexCache.revision===regularNotesRevision)return searchIndexCache.docs;
    const folders=new Map(getFolders().map(folder=>[folder.id,folder]));
    const docs=getNotes('regular').map(note=>{
      const title=String(note.title||'').trim(),content=String(note.content||''),tags=Array.isArray(note.tags)?note.tags.join(' '):String(note.tags||'');
      const folder=folders.get(note.folderId)||getFolders().find(item=>item.name===note.folder)||folders.get('unfiled')||{name:'Unfiled',icon:'▤'};
      const folderName=String(folder.name||'Unfiled'),flat=content.replace(/\\s+/g,' ').trim();
      return {id:note.id,title,content,tags,folder:folderName,folderIcon:String(folder.icon||'▤'),tl:title.toLowerCase(),cl:content.toLowerCase(),tg:tags.toLowerCase(),fl:folderName.toLowerCase(),flat};
    });
    searchIndexCache={revision:regularNotesRevision,docs};return docs;
  }
  function countOccurrences(source,term){
    if(!term)return 0;
    let count=0,index=0;
    while((index=source.indexOf(term,index))!==-1){count++;index+=term.length;}
    return count;
  }
  function searchNotes(query){
    const normalized=String(query||'').toLowerCase().trim().replace(/\\s+/g,' ');
    if(!normalized)return [];
    const terms=Array.from(new Set(normalized.split(' ').filter(Boolean)));
    const results=[];
    getSearchIndex().forEach(note=>{
      const {title,content,tags,folder,folderIcon,tl,cl,tg,fl,flat}=note;
      const searchable=tl+' '+cl+' '+fl;
      if(!terms.every(term=>searchable.includes(term)))return;
      let score=0;
      if(tl===normalized)score+=100;
      else if(tl.includes(normalized))score+=50;
      if(fl.includes(normalized))score+=20;
      terms.forEach(term=>{score+=countOccurrences(cl,term);});
      let matchIndex=flat.toLowerCase().indexOf(normalized);
      let matchedTerm=normalized;
      if(matchIndex<0){
        const firstContentTerm=terms.find(term=>cl.includes(term));
        if(firstContentTerm){matchedTerm=firstContentTerm;matchIndex=flat.toLowerCase().indexOf(firstContentTerm);}
      }
      let snippet='';
      if(matchIndex>=0){
        const from=Math.max(0,matchIndex-30),to=Math.min(flat.length,matchIndex+matchedTerm.length+30);
        snippet=(from>0?'…':'')+flat.slice(from,to)+(to<flat.length?'…':'');
      }else if(tl.includes(normalized))snippet='Title: '+title;
      else if(fl.includes(normalized))snippet='Folder: '+folder;
      else snippet=flat.slice(0,80);
      results.push({id:note.id,title,folder,folderIcon,score,snippet,terms});
    });
    return results.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
  }
  function highlightText(value,terms){
    const source=String(value||''),needles=(terms||[]).filter(Boolean).sort((a,b)=>b.length-a.length);
    if(!needles.length)return esc(source);
    let output='',cursor=0;
    while(cursor<source.length){
      let found=-1,matched='';
      needles.forEach(term=>{
        const index=source.toLowerCase().indexOf(term.toLowerCase(),cursor);
        if(index>=0&&(found<0||index<found)){found=index;matched=source.slice(index,index+term.length);}
      });
      if(found<0){output+=esc(source.slice(cursor));break;}
      output+=esc(source.slice(cursor,found))+'<mark class="search-highlight">'+esc(matched)+'</mark>';
      cursor=found+matched.length;
    }
    return output;
  }
  function updateAll(kind,updater){
    const list=getNotes(kind),next=updater(list);
    if(!Array.isArray(next))throw new TypeError('Notes update must return an array.');
    commit({[noteKey(kind)]:next});return next;
  }
  function getSelectedNote(kind='regular'){
    const id=selectedId();return getNotes(kind).find(note=>String(note.id)===String(id))||getNotes(kind)[0]||null;
  }
function safeMarkdownUrl(url){
  const raw=String(url||'').trim();
  try{
    const parsed=new URL(raw,window.location.href);
    if(['http:','https:','mailto:'].includes(parsed.protocol)) return parsed.href;
  }catch(e){}
  return '#';
}
function safeMarkdownImageUrl(url){
  const raw=String(url||'').trim();
  if(/^data:image\/(?:png|jpeg|gif|webp|avif|bmp|x-icon);base64,/i.test(raw))return raw;
  return safeMarkdownUrl(raw)==='#'?'#':safeMarkdownUrl(raw);
}
function markdownInline(input){
  let s=esc(String(input||'')),stash=[];
  const hold=function(html){const key='@@LFMD'+stash.length+'@@';stash.push(html);return key;};
  s=s.replace(/\`([^\`\n]+)\`/g,function(_,code){return hold('<code class="md-inline-code">'+highlightCode(code)+'</code>');});
  s=s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,function(_,alt,url,title){
    const src=safeMarkdownUrl(url);
    if(src==='#')return _;
    return hold('<img class="md-image" src="'+esc(src)+'" alt="'+esc(alt||'')+'"'+(title?' title="'+esc(title)+'"':'')+' loading="lazy">');
  });
  s=s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,function(_,label,url,title){
    const href=safeMarkdownUrl(url);
    if(href==='#')return _;
    return hold('<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>');
  });
  s=s.replace(/&lt;(https?:\/\/[^&\s]+)&gt;/g,function(_,url){const href=safeMarkdownUrl(url);return href==='#'?_:hold('<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(url)+'</a>');});
  s=s.replace(/\[\[\s*([^\]\n]+?)\s*\]\]/g,function(_,title){const clean=title.trim();return hold('<a href="#" class="md-note-link" data-note-title="'+esc(clean)+'">'+esc(clean)+'</a>');});
  s=s.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_\n]+)__/g,'<strong>$1</strong>');
  s=s.replace(/~~([^~\n]+)~~/g,'<del>$1</del>');
  s=s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>').replace(/(?<!_)_([^_\n]+)_(?!_)/g,'<em>$1</em>');
  s=s.replace(/ {2}\n/g,'<br>');
  s=s.replace(/\n/g,'<br>');
  stash.forEach(function(html,i){s=s.replace('@@LFMD'+i+'@@',html);});
  return s;
}
function markdownToHtmlFallback(source){
  const lines=String(source||'').replace(/\r\n?/g,'\n').split('\n');
  let html='',i=0;
  const isBlockStart=function(line){
    return /^\s{0,3}(#{1,6})\s+/.test(line)||/^\s{0,3}(\`\`\`|~~~)/.test(line)||/^\s{0,3}>\s?/.test(line)||/^\s{0,3}([-*+]|\d+\.)\s+/.test(line)||/^\s{0,3}([-*_])(?:\s*\3){2,}\s*$/.test(line);
  };
  while(i<lines.length){
    const line=lines[i];
    if(!line.trim()){i++;continue;}
    const fence=line.match(/^\s{0,3}(\`\`\`|~~~)\s*([A-Za-z0-9_+-]*)\s*$/);
    if(fence){
      const marker=fence[1],lang=fence[2]||'',buf=[];i++;
      const closeRe=new RegExp('^\\s{0,3}'+marker.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&')+'\\s*$');
      while(i<lines.length&&!closeRe.test(lines[i])){buf.push(lines[i]);i++;}
      if(i<lines.length)i++;
      html+='<pre class="md-code"><code'+(lang?' class="language-'+esc(lang)+'"':'')+'>'+esc(buf.join('\n'))+'</code></pre>';
      continue;
    }
    const heading=line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if(heading){const level=heading[1].length;html+='<h'+level+'>'+markdownInline(heading[2])+'</h'+level+'>';i++;continue;}
    if(/^\s{0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line)){html+='<hr>';i++;continue;}
    if(/^\s{0,3}>\s?/.test(line)){
      const buf=[];while(i<lines.length&&/^\s{0,3}>\s?/.test(lines[i])){buf.push(lines[i].replace(/^\s{0,3}>\s?/,'').replace(/\s+$/,''));i++;}
      html+='<blockquote>'+markdownToHtml(buf.join('\n'))+'</blockquote>';continue;
    }
    const ul=/^\s{0,3}([-*+])\s+(.+)$/.exec(line),ol=/^\s{0,3}(\d+)\.\s+(.+)$/.exec(line);
    if(ul||ol){
      const ordered=!!ol,items=[];
      let hasTasks=false;
      while(i<lines.length){
        const m=(ordered?/^\s{0,3}\d+\.\s+(.+)$/:/^\s{0,3}[-*+]\s+(.+)$/).exec(lines[i]);
        if(!m)break;
        let item=m[1],checked=false;
        const task=item.match(/^\[(x|X| )\]\s+(.+)$/);
        if(task){hasTasks=true;checked=/x/i.test(task[1]);item=task[2];}
        const taskLineIndex=i;
        items.push('<li'+(task?' class="md-task-item"':'')+'>'+(task?'<input class="md-task" type="checkbox" data-md-task-line="'+taskLineIndex+'" data-lf-change="markdown-task" data-line-index="'+taskLineIndex+'" '+(checked?'checked':'')+'> ':'')+markdownInline(item)+'</li>');
        i++;
      }
      const listStart=ordered?Number(ol[1]):1;
      const startAttr=ordered&&listStart!==1?' start="'+listStart+'"':'';
      const listClass=hasTasks?' class="md-task-list"':'';
      html+='<'+(ordered?'ol':'ul')+startAttr+listClass+'>'+items.join('')+'</'+(ordered?'ol':'ul')+'>';
      continue;
    }
    const buf=[line];i++;
    while(i<lines.length&&lines[i].trim()&&!isBlockStart(lines[i])){buf.push(lines[i]);i++;}
    html+='<p>'+markdownInline(buf.join('\n'))+'</p>';
  }
  return html||'<p class="md-empty">Nothing to preview yet.</p>';
}
function markdownToHtml(source){
  if(!window.marked||typeof window.marked.parse!=='function')return markdownToHtmlFallback(source);
  let taskIndex=0;
  const renderer=new window.marked.Renderer();
  renderer.text=function(token){return markdownInline(token.text||'');};
  renderer.image=function(token){
    const src=safeMarkdownImageUrl(token.href||'');
    if(src==='#')return esc(token.text||'');
    const alt=esc(token.text||'');
    const title=token.title?' title="'+esc(token.title)+'"':'';
    return '<img class="md-image" src="'+esc(src)+'" alt="'+alt+'"'+title+' loading="lazy" decoding="async">';
  };
  renderer.code=function(token){
    const lang=String(token.lang||'').trim().split(/\s+/)[0].toLowerCase();
    if(lang==='mermaid')return '<pre class="md-mermaid"><code>'+esc(token.text||'')+'</code></pre>';
    return '<pre class="md-code"><code'+(lang?' class="language-'+esc(lang)+'"':'')+'>'+highlightCodeBlock(token.text||'',lang)+'</code></pre>';
  };
  renderer.listitem=function(token){
    const body=this.parser.parse(token.tokens||[]);
    if(token.task){
      const index=taskIndex++;
      return '<li class="md-task-item"><input class="md-task" type="checkbox" data-md-task-index="'+index+'" '+(token.checked?'checked':'')+'> '+body+'</li>\n';
    }
    return '<li>'+body+'</li>\n';
  };
  const raw=window.marked.parse(String(source||''),{gfm:true,breaks:false,headerIds:false,mangle:false,renderer});
  const clean=window.DOMPurify?window.DOMPurify.sanitize(raw,{USE_PROFILES:{html:true},ADD_ATTR:['target','rel','loading','decoding','class','start','checked','disabled','data-md-task-index','data-note-title']}):markdownToHtmlFallback(source);
  return clean||'<p class="md-empty">Nothing to preview yet.</p>';
}

function renderMarkdownPreview(element,source){
  element.innerHTML=markdownToHtml(source);
  element.querySelectorAll('a.md-note-link').forEach(function(link){link.addEventListener('click',function(e){e.preventDefault();openKnowledgeNoteByTitle(link.dataset.noteTitle||'');});});
  element.querySelectorAll('img.md-image').forEach(function(img){
    img.addEventListener('error',function(){
      img.classList.add('md-image-error');
      img.alt=img.alt||'Image could not be loaded. Check the image URL or hosting permissions.';
      img.title='Image could not be loaded. Check the image URL or hosting permissions.';
    },{once:true});
  });
  element.querySelectorAll('input.md-task[data-md-task-index]').forEach(function(input){
    input.addEventListener('change',function(){toggleMarkdownTaskByIndex(Number(input.dataset.mdTaskIndex),input.checked);});
  });
  const diagrams=element.querySelectorAll('.md-mermaid');
  if(diagrams.length&&window.mermaid){
    diagrams.forEach(function(node){
      const code=node.querySelector('code');
      if(!code)return;
      const holder=document.createElement('div');
      holder.className='mermaid';
      holder.textContent=code.textContent;
      node.replaceWith(holder);
    });
    window.mermaid.run({nodes:element.querySelectorAll('.mermaid')}).catch(function(){});
  }
}

  function toggleMarkdownTaskByIndex(index,checked){
    const note=getSelectedNote('regular');if(!note)return null;
    const lines=String(note.content||'').replace(/\r\n?/g,'\n').split('\n');let current=0,matched=-1;
    for(let i=0;i<lines.length;i++){
      if(/^\s*[-*+]\s+\[[ xX]\]\s+/.test(lines[i])){if(current===index){matched=i;break;}current++;}
    }
    if(matched<0)return null;
    lines[matched]=lines[matched].replace(/^(\s*[-*+]\s+)\[[ xX]\](\s+)/,(_,prefix,space)=>prefix+'['+(checked?'x':' ')+']'+space);
    const content=lines.join('\n');updateContent('regular',note.id,content);return content;
  }
  function toggleMarkdownTask(lineIndex,checked){
    const note=getSelectedNote('regular');if(!note)return null;
    const lines=String(note.content||'').replace(/\r\n?/g,'\n').split('\n');
    if(!Number.isInteger(lineIndex)||lineIndex<0||lineIndex>=lines.length)return null;
    lines[lineIndex]=lines[lineIndex].replace(/^(\s{0,3}[-*+]\s+)\[[ xX]\](\s+)/,(_,prefix,space)=>prefix+'['+(checked?'x':' ')+']'+space);
    const content=lines.join('\n');updateContent('regular',note.id,content);return content;
  }
  return {getNotes,selectedId,selectedKind,noteView,makeNoteCode,ensure,nextNumber,select,newNote,updateContent,updateFields,deleteNote,deleteAll,openByTitle,autoTitle,updateAll,getSelectedNote,getFolders,createFolder,moveToFolder,moveNoteToFolder:moveToFolder,renameFolder,deleteFolder,toggleFolder,setSearchQuery,searchNotes,highlightText,getBacklinks,getGraphLinks,recordVersion,getVersionHistory,restoreVersion,toggleMarkdownTaskByIndex,toggleMarkdownTask,markdownToHtml,renderMarkdownPreview};
}
global.LifeFlowNotesModule={createNotesController,configureRenderers,render};
})(window);
