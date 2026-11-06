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


 // Why LifeFlow: switch between the four core reasons.
 const whyTabs=[...document.querySelectorAll('.why-tab')];
 const whyPanel=document.getElementById('why-panel');
 const whyCopy=[
  {kicker:'01 / WHY IT EXISTS',title:'Life is bigger<br>than a task list.',copy:'Planning tools can make people manage lists instead of managing their lives. LifeFlow brings tasks, commitments, time and progress together for people balancing work or study, responsibilities and personal priorities.',label:'WHAT IT HOLDS',detail:'Your time · Attention · Commitments · Progress',foot:'ONE PLACE FOR ALL THE MOVING PARTS.'},
  {kicker:'02 / YOUR EVERYDAY FLOW',title:'See what matters.<br>Know what comes next.',copy:'In your first 30 seconds, understand what needs attention today, what is already handled and where your time is going. Tasks, calendar and board bring the day into view without demanding that you constantly keep up.',label:'THE FEELING',detail:'Clear · Calm · Focused · Human · In control',foot:'LESS FRICTION. MORE ROOM TO MOVE.'},
  {kicker:'03 / THINKING THAT CONNECTS',title:'Ideas are better<br>when they connect.',copy:'Notes Manager gives you a Markdown-powered space for headings, formatting, lists, checklists, links, tables and code. Connect notes with [[Title]] links, then explore the relationships in Your Branches. Your notes, tasks and settings stay in your browser, close to you.',label:'WHY IT MATTERS',detail:'Keep ideas close · Follow the connections',foot:'LOCAL BY DESIGN. YOUR THINKING, MADE VISIBLE.'},
  {kicker:'04 / THE LONG VIEW',title:'Make space<br>for momentum.',copy:'Flow means moving through life with less friction: seeing what is next, giving attention to the right things and continuously making progress. Six months from now, success is fewer forgotten commitments, clearer days and meaningful progress, not a perfectly maintained planner.',label:'ONE PRINCIPLE',detail:'A task should help you take the next meaningful step.',foot:'LIFEFLOW SHOULD HELP YOU DECIDE, NOT JUST RECORD.'}
 ];
 function setWhy(index,focus){
  const item=whyCopy[index];if(!item)return;
  whyTabs.forEach((tab,i)=>{const active=i===index;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
  whyPanel.setAttribute('aria-labelledby','why-tab-'+index);
  document.getElementById('why-kicker').textContent=item.kicker;
  document.getElementById('why-title').innerHTML=item.title;
  document.getElementById('why-copy').textContent=item.copy;
  document.getElementById('why-detail-label').textContent=item.label;
  document.getElementById('why-detail-copy').textContent=item.detail;
  document.getElementById('why-foot').textContent=item.foot;
  document.getElementById('why-count').textContent=String(index+1).padStart(2,'0')+' / 04';
  whyPanel.classList.remove('is-changing');void whyPanel.offsetWidth;whyPanel.classList.add('is-changing');
  if(focus)whyTabs[index].focus();
 }
 whyTabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>setWhy(index,false));
  tab.addEventListener('keydown',event=>{
   if(!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
   event.preventDefault();let next=index;
   if(event.key==='ArrowDown'||event.key==='ArrowRight')next=(index+1)%whyTabs.length;
   if(event.key==='ArrowUp'||event.key==='ArrowLeft')next=(index-1+whyTabs.length)%whyTabs.length;
   if(event.key==='Home')next=0;if(event.key==='End')next=whyTabs.length-1;
   setWhy(next,true);
  });
 });
 if(whyTabs.length)setWhy(0,false);

 // The appearance preview changes accent colour without changing the real app.
 const themeButtons=[...document.querySelectorAll('.theme-options button')];
 const previewStage=document.querySelector('.preview-stage');
 themeButtons.forEach(button=>button.addEventListener('click',()=>{
  themeButtons.forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});
  if(previewStage)previewStage.style.setProperty('--lime',button.dataset.accent);
 }));

 // Make the sample task list usable: click or press Enter/Space to complete a task.
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