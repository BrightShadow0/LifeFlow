(() => {
 const progress=document.getElementById('readingProgress');
 const tabs=[...document.querySelectorAll('.showcase-tab')];
 const panels=[...document.querySelectorAll('.preview-panel')];
 const eyebrow=document.getElementById('showcaseEyebrow');
 const title=document.getElementById('showcaseTitle');
 const description=document.getElementById('showcaseText');
 const copy={
  focus:{eyebrow:'TASKS / FOCUS',title:'Know what deserves your attention.',text:'Bring your priorities forward, organise the day and keep completed work in view. A clear next step is often enough.'},
  plan:{eyebrow:'CALENDAR / BOARD',title:'Give your plans a place.',text:'See how dates fit together, then move work through a simple board. Keep the schedule and the doing connected.'},
  connect:{eyebrow:'NOTES / CONNECTIONS',title:'Let one idea lead to another.',text:'Write in Markdown, link related notes and sketch out a process with Mermaid. Your Branches helps reveal the connections.'},
  personal:{eyebrow:'APPEARANCE / PREFERENCES',title:'Make the workspace feel like yours.',text:'Choose a theme, adjust ambient settings and shape the visual tone around the way you like to work.'}
 };
 function setView(name,focusTab){
  const current=copy[name];if(!current)return;
  tabs.forEach(tab=>{
   const active=tab.dataset.view===name;
   tab.classList.toggle('active',active);
   tab.setAttribute('aria-selected',String(active));
   tab.tabIndex=active?0:-1;
  });
  panels.forEach(panel=>{
   const active=panel.id==='preview-'+name;
   panel.hidden=!active;
   panel.classList.toggle('active',active);
  });
  eyebrow.textContent=current.eyebrow;
  title.textContent=current.title;
  description.textContent=current.text;
  if(focusTab)document.getElementById('tab-'+name)?.focus();
 }
 tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>setView(tab.dataset.view,false));
  tab.addEventListener('keydown',event=>{
   if(!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
   event.preventDefault();let next=index;
   if(event.key==='ArrowDown'||event.key==='ArrowRight')next=(index+1)%tabs.length;
   if(event.key==='ArrowUp'||event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;
   if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;
   setView(tabs[next].dataset.view,true);
  });
 });
 setView('focus',false);
 let ticking=false;
 function updateProgress(){
  const max=document.documentElement.scrollHeight-innerHeight;
  const value=max>0?Math.min(100,Math.max(0,scrollY/max*100)):0;
  if(progress)progress.style.width=value+'%';ticking=false;
 }
 addEventListener('scroll',()=>{if(ticking)return;ticking=true;requestAnimationFrame(updateProgress);},{passive:true});updateProgress();
 const targets=document.querySelectorAll('.why-heading,.why-selector,.why-panel,.statement-content,.section-heading,.showcase-menu,.preview-stage,.principle-grid article,.space-art,.space-copy');
 if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('reveal','visible');observer.unobserve(entry.target);}}),{threshold:.12,rootMargin:'0px 0px -35px 0px'});
  targets.forEach((el,index)=>{el.classList.add('reveal');el.style.transitionDelay=(Math.min(index%3,2)*70)+'ms';observer.observe(el);});
 }else targets.forEach(el=>el.classList.add('visible'));


 // Why LifeFlow: delegated events keep every chapter reliably clickable.
 const whySelector=document.querySelector('.why-selector');
 const whyTabs=[...document.querySelectorAll('.why-tab')];
 const whyPanel=document.getElementById('why-panel');
 const whyCopy=[
  {kicker:'01 / WHY IT EXISTS',title:'Life is bigger<br>than a task list.',copy:'Planning tools can make people manage lists instead of managing their lives. LifeFlow brings tasks, commitments, time and progress together for people balancing work or study, responsibilities and personal priorities.',label:'WHAT IT HOLDS',detail:'Your time · Attention · Commitments · Progress',foot:'ONE PLACE FOR ALL THE MOVING PARTS.'},
  {kicker:'02 / YOUR EVERYDAY FLOW',title:'See what matters.<br>Know what comes next.',copy:'In your first 30 seconds, understand what needs attention today, what is already handled and where your time is going. Tasks, calendar and board bring the day into view without demanding that you constantly keep up.',label:'THE FEELING',detail:'Clear · Calm · Focused · Human · In control',foot:'LESS FRICTION. MORE ROOM TO MOVE.'},
  {kicker:'03 / THINKING THAT CONNECTS',title:'Ideas are better<br>when they connect.',copy:'Notes Manager gives you a Markdown-powered space for headings, formatting, lists, checklists, links, tables and code. Connect notes with [[Title]] links, then explore the relationships in Your Branches. Your notes, tasks and settings stay in your browser, close to you.',label:'WHY IT MATTERS',detail:'Keep ideas close · Follow the connections',foot:'LOCAL BY DESIGN. YOUR THINKING, MADE VISIBLE.'},
  {kicker:'04 / THE LONG VIEW',title:'Make space<br>for momentum.',copy:'Flow means moving through life with less friction: seeing what is next, giving attention to the right things and continuously making progress. Six months from now, success is fewer forgotten commitments, clearer days and meaningful progress, not a perfectly maintained planner.',label:'ONE PRINCIPLE',detail:'A task should help you take the next meaningful step.',foot:'LIFEFLOW SHOULD HELP YOU DECIDE, NOT JUST RECORD.'}
 ];
 function setWhy(index,focus){
  const item=whyCopy[index];
  if(!item||!whyPanel)return;
  whyTabs.forEach((tab,i)=>{
   const active=i===index;
   tab.classList.toggle('active',active);
   tab.setAttribute('aria-selected',String(active));
   tab.tabIndex=active?0:-1;
  });
  whyPanel.setAttribute('aria-labelledby','why-tab-'+index);
  const put=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  put('why-kicker',item.kicker);
  const heading=document.getElementById('why-title');if(heading)heading.innerHTML=item.title;
  put('why-copy',item.copy);
  put('why-detail-label',item.label);
  put('why-detail-copy',item.detail);
  put('why-foot',item.foot);
  put('why-count',String(index+1).padStart(2,'0')+' / 04');
  whyPanel.classList.remove('is-changing');void whyPanel.offsetWidth;whyPanel.classList.add('is-changing');
  if(focus)whyTabs[index]?.focus();
 }
 if(whySelector){
  whySelector.addEventListener('click',event=>{
   const tab=event.target.closest('.why-tab');
   if(!tab||!whySelector.contains(tab))return;
   event.preventDefault();
   const index=whyTabs.indexOf(tab);
   if(index>=0)setWhy(index,false);
  });
  whySelector.addEventListener('keydown',event=>{
   const tab=event.target.closest('.why-tab');
   if(!tab)return;
   const index=whyTabs.indexOf(tab);
   if(index<0||!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
   event.preventDefault();let next=index;
   if(event.key==='ArrowDown'||event.key==='ArrowRight')next=(index+1)%whyTabs.length;
   if(event.key==='ArrowUp'||event.key==='ArrowLeft')next=(index-1+whyTabs.length)%whyTabs.length;
   if(event.key==='Home')next=0;
   if(event.key==='End')next=whyTabs.length-1;
   setWhy(next,true);
  });
 }
 if(whyTabs.length)setWhy(0,false);

 // The appearance preview changes accent colour without changing the real app.
 const themeButtons=[...document.querySelectorAll('.theme-options button')];
 const previewStage=document.querySelector('.preview-stage');
 themeButtons.forEach(button=>button.addEventListener('click',()=>{
  themeButtons.forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});
  if(previewStage)previewStage.style.setProperty('--lime',button.dataset.accent);
 }));

 // Make the sample task list usable: click or press Enter/Space to complete a task.
 // Calendar preview: browse months and select dates.
 const calendar=document.querySelector('.mini-calendar');
 if(calendar){const grid=calendar.querySelector('.mini-cal-grid'),label=calendar.querySelector('.cal-month-label'),selected=calendar.querySelector('.cal-selected-label'),now=new Date();let year=now.getFullYear(),month=now.getMonth(),chosen=new Date(year,month,now.getDate());const planned=new Set([5,8,12,18,24]);const key=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const render=()=>{const first=new Date(year,month,1),offset=(first.getDay()+6)%7,count=new Date(year,month+1,0).getDate(),previous=new Date(year,month,0).getDate();label.textContent=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});grid.innerHTML='';['M','T','W','T','F','S','S'].forEach(v=>{const el=document.createElement('i');el.textContent=v;grid.append(el);});
   for(let i=0;i<42;i++){let day,date,muted=false;if(i<offset){day=previous-offset+i+1;date=new Date(year,month-1,day);muted=true;}else if(i>=offset+count){day=i-offset-count+1;date=new Date(year,month+1,day);muted=true;}else{day=i-offset+1;date=new Date(year,month,day);}const b=document.createElement('button');b.type='button';b.className='cal-day'+(muted?' faded':'')+(key(date)===key(now)?' today':'')+(key(date)===key(chosen)?' selected':'');b.textContent=day;b.setAttribute('aria-label',date.toLocaleDateString(undefined,{dateStyle:'full'}));b.setAttribute('aria-pressed',String(key(date)===key(chosen)));if(!muted&&planned.has(day)){b.classList.add('marked');b.title='Planned tasks';}b.addEventListener('click',()=>{chosen=date;year=date.getFullYear();month=date.getMonth();render();});grid.append(b);}selected.textContent='Selected: '+chosen.toLocaleDateString(undefined,{month:'short',day:'numeric'});};
  calendar.querySelector('.cal-prev').addEventListener('click',()=>{month--;if(month<0){month=11;year--;}render();});calendar.querySelector('.cal-next').addEventListener('click',()=>{month++;if(month>11){month=0;year++;}render();});render();}
 // Kanban preview: drag cards between columns or tap to advance their status.
 const board=document.querySelector('.mini-board');
 if(board){let dragged=null;const columns=[...board.querySelectorAll('.board-column')],feedback=board.querySelector('.board-feedback');const update=()=>columns.forEach(c=>c.querySelector('small i').textContent=String(c.querySelectorAll('.board-card').length).padStart(2,'0'));const move=(card,col)=>{col.querySelector('.board-cards').append(card);feedback.textContent='"'+card.textContent+'" moved to '+col.dataset.status.toUpperCase()+'.';update();};
  board.querySelectorAll('.board-card').forEach(card=>{card.addEventListener('dragstart',e=>{dragged=card;card.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',card.textContent);});card.addEventListener('dragend',()=>{card.classList.remove('dragging');dragged=null;columns.forEach(c=>c.classList.remove('drop-target'));});card.addEventListener('click',()=>{const i=columns.findIndex(c=>c.contains(card));move(card,columns[(i+1)%columns.length]);});});
  columns.forEach(col=>{col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drop-target');});col.addEventListener('dragleave',e=>{if(!col.contains(e.relatedTarget))col.classList.remove('drop-target');});col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('drop-target');if(dragged)move(dragged,col);});});update();}
 document.querySelectorAll('.focus-row').forEach(row=>{
  row.tabIndex=0;row.setAttribute('role','checkbox');row.setAttribute('aria-checked',String(row.classList.contains('done')));
  const toggle=()=>{
   const done=row.classList.toggle('done');row.setAttribute('aria-checked',String(done));
   const mark=row.querySelector('i');if(mark)mark.textContent=done?'✓':'';
   const status=row.querySelector('span');if(status){status.textContent=done?'DONE':(row.dataset.originalStatus||'UP NEXT');status.classList.toggle('focus-next',!done);}
  };
  row.addEventListener('click',toggle);
  row.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}});
 });

})();