(function(global){
'use strict';
function createTaskController(options){
  const {stateManager,getCurrentState,uid}=options||{};
  if(!stateManager||typeof stateManager.setState!=='function')throw new TypeError('Task controller requires a StateManager.');
  const getTasks=()=>stateManager.getState().tasks||[];
  function commit(tasks){
    const current=getCurrentState()||stateManager.getState();
    stateManager.setState({...current,tasks});
    stateManager.flush();
    return tasks;
  }
  function add(task){
    const tasks=getTasks();
    const next=Object.assign({id:uid(),title:'',tags:[],priority:'medium',due:null,startTime:null,endTime:null,recur:'none',status:'todo',done:false,subtasks:[]},task||{});
    commit([...tasks,next]);
    return next;
  }
  function addMany(items){
    if(!Array.isArray(items)||!items.length)return [];
    const current=getTasks();
    commit([...current,...items]);
    return items;
  }
  function toggleDone(id){
    const tasks=getTasks();
    const index=tasks.findIndex(task=>String(task.id)===String(id));
    if(index<0)return false;
    const next=tasks.map(task=>({...task,subtasks:Array.isArray(task.subtasks)?task.subtasks.map(sub=>({...sub})):[]}));
    const task=next[index];
    task.done=!task.done;
    let recurringTask=null;
    if(task.done&&task.recur!=='none'&&task.due){
      const date=new Date(task.due);
      if(task.recur==='daily')date.setDate(date.getDate()+1);
      if(task.recur==='weekly')date.setDate(date.getDate()+7);
      if(task.recur==='monthly')date.setMonth(date.getMonth()+1);
      recurringTask={title:task.title,tags:task.tags,priority:task.priority,due:date.toISOString(),startTime:task.startTime||null,endTime:task.endTime||null,recur:task.recur,status:'todo'};
      recurringTask=Object.assign({id:uid(),title:'',tags:[],priority:'medium',due:null,startTime:null,endTime:null,recur:'none',status:'todo',done:false,subtasks:[]},recurringTask);
    }
    if(recurringTask)next.push(recurringTask);
    commit(next);
    return true;
  }
  function remove(id){
    const tasks=getTasks();
    const index=tasks.findIndex(task=>String(task.id)===String(id));
    if(index<0)return null;
    const task=tasks[index];
    commit(tasks.filter((_,i)=>i!==index));
    return {task,index};
  }
  function restore(record){
    if(!record||!record.task)return false;
    const tasks=getTasks();
    if(tasks.some(task=>String(task.id)===String(record.task.id)))return false;
    const next=tasks.slice();
    next.splice(Math.min(Math.max(0,record.index||0),next.length),0,record.task);
    commit(next);
    return true;
  }
  function addSubtask(id,text){
    if(!text)return false;
    const tasks=getTasks(),index=tasks.findIndex(task=>String(task.id)===String(id));
    if(index<0)return false;
    const next=tasks.map(task=>({...task,subtasks:Array.isArray(task.subtasks)?task.subtasks.map(sub=>({...sub})):[]}));
    next[index].subtasks.push({id:uid(),text,done:false});
    commit(next);return true;
  }
  function toggleSubtask(taskId,subtaskId){
    const tasks=getTasks(),index=tasks.findIndex(task=>String(task.id)===String(taskId));
    if(index<0)return false;
    const next=tasks.map(task=>({...task,subtasks:Array.isArray(task.subtasks)?task.subtasks.map(sub=>({...sub})):[]}));
    const sub=next[index].subtasks.find(item=>String(item.id)===String(subtaskId));
    if(!sub)return false;
    sub.done=!sub.done;commit(next);return true;
  }
  function completeAll(){
    const tasks=getTasks(),remaining=tasks.filter(task=>!task.done);
    if(!remaining.length)return 0;
    commit(tasks.map(task=>task.done?task:{...task,done:true,status:'done'}));
    return remaining.length;
  }
  function clearCompleted(){
    const tasks=getTasks(),completed=tasks.filter(task=>task.done);
    if(!completed.length)return 0;
    commit(tasks.filter(task=>!task.done));
    return completed.length;
  }
  function update(id,patch){
    const tasks=getTasks(),index=tasks.findIndex(task=>String(task.id)===String(id));
    if(index<0)return false;
    const next=tasks.map(task=>({...task}));
    next[index]={...next[index],...patch};
    commit(next);return true;
  }
  function updateAll(updater){
    if(typeof updater!=='function')throw new TypeError('updateAll expects a function.');
    const next=updater(getTasks());
    if(!Array.isArray(next))throw new TypeError('Task update must return an array.');
    commit(next);return next;
  }
  return {getTasks,add,addMany,toggleDone,remove,restore,addSubtask,toggleSubtask,completeAll,clearCompleted,update,updateAll};
}
global.LifeFlowTasksModule={createTaskController};
})(window);
