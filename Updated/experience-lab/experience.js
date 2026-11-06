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
 const targets=document.querySelectorAll('.statement-content,.section-heading,.showcase-menu,.preview-stage,.principle-grid article,.space-art,.space-copy');
 if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('reveal','visible');observer.unobserve(entry.target);}}),{threshold:.12,rootMargin:'0px 0px -35px 0px'});
  targets.forEach((el,index)=>{el.classList.add('reveal');el.style.transitionDelay=(Math.min(index%3,2)*70)+'ms';observer.observe(el);});
 }else targets.forEach(el=>el.classList.add('visible'));

})();