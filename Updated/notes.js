(function(global){
'use strict';
function createNotesController(options){
  const {stateManager,getCurrentState,uid}=options||{};
  if(!stateManager||typeof stateManager.setState!=='function')throw new TypeError('Notes controller requires a StateManager.');
  const snapshot=()=>stateManager.getState();
  const noteKey=kind=>kind==='code'?'codeNotes':'notes';
  function commit(patch){stateManager.setState({...getCurrentState(),...patch});}
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
    ['notes','codeNotes'].forEach(key=>{
      const list=Array.isArray(current[key])?current[key]:[];
      const next=list.map(note=>{if(note.noteCode)return note;changed=true;return {...note,noteCode:makeNoteCode()};});
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
  function select(id,kind='regular',view='edit'){
    commit({selectedNoteId:id??null,selectedNoteKind:kind==='code'?'code':'regular',noteView:view==='preview'?'preview':'edit'});
    return id??null;
  }
  function newNote(kind='regular'){
    ensure();const number=kind==='regular'?nextNumber(kind):null;
    const note={id:uid(),noteCode:makeNoteCode(),title:kind==='code'?'Untitled Code Note':'Untitled Note '+number,noteNumber:number,content:'',code:'',language:'javascript',createdAt:Date.now(),updatedAt:Date.now()};
    commit({[noteKey(kind)]:[note,...getNotes(kind)],selectedNoteId:note.id,selectedNoteKind:kind==='code'?'code':'regular',noteView:'edit'});
    return note;
  }
  function updateContent(kind,id,value){
    const key=noteKey(kind);let found=false;
    const next=getNotes(kind).map(note=>{
      if(String(note.id)!==String(id))return note;
      found=true;return {...note,[kind==='code'?'code':'content']:value,updatedAt:Date.now()};
    });
    if(found)commit({[key]:next});return found;
  }
  function updateFields(kind,id,patch){
    const key=noteKey(kind);let found=false;
    const next=getNotes(kind).map(note=>{
      if(String(note.id)!==String(id))return note;
      found=true;return {...note,...patch,updatedAt:Date.now()};
    });
    if(found)commit({[key]:next});return found;
  }
  function deleteNote(kind,id){
    const key=noteKey(kind),list=getNotes(kind),next=list.filter(note=>String(note.id)!==String(id));
    if(next.length===list.length)return false;
    commit({[key]:next,selectedNoteId:null});return true;
  }
  function deleteAll(kind){
    const key=noteKey(kind),count=getNotes(kind).length;if(!count)return 0;
    commit({[key]:[],selectedNoteId:null,noteView:'edit'});return count;
  }
  function openByTitle(title){
    const clean=String(title||'').trim();if(!clean)return null;
    let note=getNotes('regular').find(item=>String(item.title||'').trim().toLowerCase()===clean.toLowerCase());
    if(!note){
      note={id:uid(),noteCode:makeNoteCode(),title:clean,noteNumber:null,content:'',code:'',language:'javascript',createdAt:Date.now(),updatedAt:Date.now()};
      commit({notes:[note,...getNotes('regular')]});
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
  function updateAll(kind,updater){
    const list=getNotes(kind),next=updater(list);
    if(!Array.isArray(next))throw new TypeError('Notes update must return an array.');
    commit({[noteKey(kind)]:next});return next;
  }
  function getSelectedNote(kind='regular'){
    const id=selectedId();return getNotes(kind).find(note=>String(note.id)===String(id))||getNotes(kind)[0]||null;
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
  return {getNotes,selectedId,selectedKind,noteView,makeNoteCode,ensure,nextNumber,select,newNote,updateContent,updateFields,deleteNote,deleteAll,openByTitle,autoTitle,updateAll,getSelectedNote,toggleMarkdownTaskByIndex,toggleMarkdownTask};
}
global.LifeFlowNotesModule={createNotesController};
})(window);
