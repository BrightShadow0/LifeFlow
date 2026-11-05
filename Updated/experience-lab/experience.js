import * as THREE from 'three';

const prefersReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile=matchMedia('(max-width:760px)').matches;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const damp=(a,b,k,dt)=>THREE.MathUtils.damp(a,b,k,dt);
const clock=new THREE.Clock();
const scenes={};
let scrollTarget=0,scrollLive=0,lastChapter=-1;
const active={hero:true,journey:false,closing:false};

function createRibbonGeometry(segments=180,slices=18){
 const geometry=new THREE.BufferGeometry();
 const positions=new Float32Array((segments+1)*(slices+1)*3);
 const uvs=new Float32Array((segments+1)*(slices+1)*2);
 const indices=[];
 for(let i=0;i<=segments;i++)for(let j=0;j<=slices;j++){
  const k=i*(slices+1)+j;uvs[k*2]=i/segments;uvs[k*2+1]=j/slices;
  if(i<segments&&j<slices){const a=k,b=k+slices+1;indices.push(a,b,a+1,b,b+1,a+1);}
 }
 geometry.setIndex(indices);
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
 return geometry;
}
function updateRibbon(mesh,progress,time,variant=0){
 const geo=mesh.geometry,pos=geo.attributes.position.array;
 const segments=180,slices=18,phase=progress*Math.PI*2;
 const center=(t)=>{
  const x=(t-.5)*6.1;
  const y=Math.sin(t*Math.PI*2+phase*.72+variant)*(.42+.11*Math.sin(phase))+
          Math.sin(t*Math.PI*4-phase*.34)*.10;
  const z=Math.cos(t*Math.PI*2+phase*.48+variant)*(.66+.12*Math.cos(phase))+
          Math.sin(t*Math.PI*3+variant)*.13;
  return new THREE.Vector3(x,y,z);
 };
 for(let i=0;i<=segments;i++){
  const t=i/segments,c=center(t),tangent=center(Math.min(1,t+.002)).sub(center(Math.max(0,t-.002))).normalize();
  let widthDir=new THREE.Vector3().crossVectors(tangent,new THREE.Vector3(0,0,1)).normalize();
  if(widthDir.lengthSq()<.01)widthDir.set(0,1,0);
  const depthDir=new THREE.Vector3().crossVectors(tangent,widthDir).normalize();
  const width=(.34+.11*Math.sin(t*Math.PI*2+phase*.4+variant))*(.55+Math.pow(Math.sin(Math.PI*t),.42)*.7);
  const twist=Math.sin(t*Math.PI*2+phase*.58+variant)*(.72+progress*.24);
  for(let j=0;j<=slices;j++){
   const v=j/slices-.5;
   const rolled=widthDir.clone().multiplyScalar(Math.cos(twist)).addScaledVector(depthDir,Math.sin(twist)).normalize();
   const p=c.clone().addScaledVector(rolled,v*width*2);
   p.z+=Math.sin(t*Math.PI*2+time*.12)*Math.pow(Math.abs(v)*2,2)*.035;
   const k=(i*(slices+1)+j)*3;pos[k]=p.x;pos[k+1]=p.y;pos[k+2]=p.z;
  }
 }
 geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();
}
function createScene(canvasId,kind){
 const canvas=document.getElementById(canvasId);if(!canvas)return null;
 let renderer;
 try{
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:!isMobile,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  renderer.setSize(Math.max(1,canvas.clientWidth),Math.max(1,canvas.clientHeight),false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
 }catch(e){canvas.parentElement.classList.add('webgl-fallback');return null;}
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(35,1,.1,50);
 camera.position.set(0,.12,kind==='journey'?8.7:8.0);
 scene.add(new THREE.AmbientLight('#d4dfd0',.9));
 const key=new THREE.DirectionalLight('#e3f3c7',2.0);key.position.set(-3,5,5);scene.add(key);
 const fill=new THREE.PointLight('#93b982',18,18);fill.position.set(3,-2,3);scene.add(fill);
 const rim=new THREE.DirectionalLight('#a6c6a0',.75);rim.position.set(1,-3,-4);scene.add(rim);
 const group=new THREE.Group();scene.add(group);
 const geometry=createRibbonGeometry();
 const material=new THREE.MeshPhysicalMaterial({color:'#839e65',metalness:.22,roughness:.34,clearcoat:.95,clearcoatRoughness:.24,side:THREE.DoubleSide});
 const ribbon=new THREE.Mesh(geometry,material);group.add(ribbon);
 const edgeMaterial=new THREE.MeshBasicMaterial({color:'#c5dc9a',transparent:true,opacity:.18,side:THREE.DoubleSide});
 // A restrained central sheen, not a second shape.
 const sheen=new THREE.Mesh(geometry,edgeMaterial);sheen.scale.set(1.001,1.001,1.001);group.add(sheen);
 const sceneState={canvas,renderer,scene,camera,group,ribbon,sheen,kind};
 const ro=new ResizeObserver(()=>resize(sceneState));ro.observe(canvas.parentElement);
 resize(sceneState);updateRibbon(ribbon,kind==='hero'?.17:kind==='closing'?.72:0,0,kind==='closing'?.8:0);
 scenes[kind]=sceneState;
 return sceneState;
}
function resize(s){
 if(!s||!s.renderer)return;
 const w=Math.max(1,s.canvas.clientWidth),h=Math.max(1,s.canvas.clientHeight);
 s.renderer.setSize(w,h,false);s.camera.aspect=w/h;s.camera.updateProjectionMatrix();
}
function initScenes(){createScene('hero-canvas','hero');createScene('journey-canvas','journey');createScene('closing-canvas','closing');}
function updateScene(s,progress,time,dt){
 if(!s||!s.renderer)return;
 const variant=s.kind==='closing'?.85:s.kind==='hero'?.12:progress*.7;
 updateRibbon(s.ribbon,progress,time,variant);
 s.group.rotation.y=damp(s.group.rotation.y,(s.kind==='hero'?.18:0)+Math.sin(progress*Math.PI*2)*.08,2,dt);
 s.group.rotation.x=damp(s.group.rotation.x,Math.sin(progress*Math.PI)*.08,2,dt);
 s.group.rotation.z=damp(s.group.rotation.z,Math.sin(progress*Math.PI*2)*.025,2,dt);
 const scale=s.kind==='journey'?1.08:s.kind==='hero'?1.12:1.16;
 s.group.scale.setScalar(scale);
 s.camera.lookAt(0,0,0);
 s.renderer.render(s.scene,s.camera);
}
function setChapter(index){
 const copies=[...document.querySelectorAll('.chapter-copy')];
 const n=Math.max(0,Math.min(copies.length-1,index));
 if(n===lastChapter)return;lastChapter=n;
 copies.forEach((el,i)=>{
  if(isMobile||prefersReduced){el.classList.add('active');el.style.opacity='1';el.style.visibility='visible';el.style.transform='none';return;}
  const show=i===n;el.classList.toggle('active',show);
  if(window.gsap)gsap.to(el,{autoAlpha:show?1:0,y:show?0:-17,duration:.38,ease:'power2.out',overwrite:true});
  else{el.style.opacity=show?'1':'0';el.style.visibility=show?'visible':'hidden';el.style.transform=show?'none':'translateY(-17px)';}
 });
 const names=['01 — WHY IT EXISTS','02 — WHO IT IS FOR','03 — WHAT IT MANAGES','04 — YOUR FIRST 30 SECONDS','05 — HOW IT SHOULD FEEL','06 — WHY FLOW','07 — THE SIX-MONTH TEST','08 — LOCAL BY DESIGN','09 — MARKDOWN NOTES MANAGER'];
 const hints=['SCATTERED → IN FOCUS','MANY ROLES → ONE SPACE','TASKS → PERSPECTIVE','UNCERTAINTY → CLARITY','FRICTION → FLOW','MOTION → MOMENTUM','PERFECTION → PROGRESS','CENTRAL SERVER → YOUR SPACE','IDEAS → CONNECTIONS'];
 const count=String(n+1).padStart(2,'0'),total=String(copies.length).padStart(2,'0');
 document.getElementById('journeyKicker').textContent=names[n];
 document.getElementById('journeyHint').textContent=hints[n];
 document.getElementById('journeyCounter').innerHTML=count+' <i>/</i> '+total;
 const cap=document.getElementById('ribbonCaption');if(cap)cap.textContent='THE FORM / '+count;
 document.getElementById('chapterProgress').style.width=((n+1)/copies.length*100)+'%';
}
function setupScroll(){
 const gs=window.gsap,ST=window.ScrollTrigger;
 const chapters=document.querySelectorAll('.chapter-copy');
 if(prefersReduced||isMobile||!gs||!ST){
  document.getElementById('journey').style.height='auto';
  document.querySelector('.journey-pin').style.height='auto';
  chapters.forEach(el=>{el.style.position='relative';el.style.top='auto';el.style.display='block';el.style.opacity='1';el.style.visibility='visible';el.style.transform='none';el.classList.add('active');});
  const kicker=document.getElementById('journeyKicker');kicker.textContent='THE LIFEFLOW STORY';
  return;
 }
 gs.registerPlugin(ST);
 gs.from('.hero-copy .overline',{y:14,autoAlpha:0,duration:.7,delay:.15,ease:'power3.out'});
 gs.from('.hero h1',{y:38,autoAlpha:0,duration:1,delay:.2,ease:'power3.out'});
 gs.from('.hero-lead,.hero-scroll',{y:16,autoAlpha:0,duration:.7,stagger:.12,delay:.55});
 gs.from('.hero-scene',{autoAlpha:0,x:25,duration:1.1,delay:.2,ease:'power2.out'});
 const proxy={progress:0};
 gs.to(proxy,{progress:1,ease:'none',scrollTrigger:{
  trigger:'#journey',start:'top top',end:'bottom bottom',pin:'.journey-pin',pinSpacing:false,scrub:1.15,anticipatePin:1,invalidateOnRefresh:true,
  onUpdate:self=>{
   scrollTarget=self.progress;
   const index=Math.min(chapters.length-1,Math.floor(self.progress*chapters.length));
   setChapter(index);
   const progress=document.getElementById('chapterProgress');progress.style.width=(self.progress*100)+'%';
  }
 }});
 gs.from('.closing-copy',{y:36,autoAlpha:0,ease:'power2.out',scrollTrigger:{trigger:'#closing',start:'top 76%',end:'center center',scrub:1}});
 gs.from('.access-frame',{y:38,autoAlpha:0,ease:'power2.out',scrollTrigger:{trigger:'#access',start:'top 85%',end:'top 45%',scrub:1}});
 ST.refresh();
}
function observeSections(){
 const observer=new IntersectionObserver(entries=>entries.forEach(e=>{active[e.target.id]=e.isIntersecting;}),{threshold:.01});
 ['hero','journey','closing'].forEach(id=>{const el=document.getElementById(id);if(el)observer.observe(el);});
 const bar=document.getElementById('readingProgress');
 addEventListener('scroll',()=>{const max=document.documentElement.scrollHeight-innerHeight;bar.style.width=(max>0?scrollY/max*100:0)+'%'},{passive:true});
}
function pointerEffects(){
 if(prefersReduced||isMobile)return;
 const target={x:0,y:0},live={x:0,y:0};
 addEventListener('pointermove',e=>{target.x=(e.clientX/innerWidth-.5)*2;target.y=(e.clientY/innerHeight-.5)*2;},{passive:true});
 scenes.hero.canvas.parentElement.addEventListener('pointermove',e=>{const r=e.currentTarget.getBoundingClientRect();target.x=((e.clientX-r.left)/r.width-.5)*1.3;target.y=((e.clientY-r.top)/r.height-.5)*1.3;},{passive:true});
 scenes.hero.pointer={target,live};
}
function animate(){
 const dt=Math.min(clock.getDelta(),.04),time=clock.elapsedTime;
 Object.entries(scenes).forEach(([name,s])=>{
  if(!s||!active[name])return;
  if(name==='journey'){scrollLive=damp(scrollLive,scrollTarget,3.5,dt);updateScene(s,scrollLive,time,dt);}
  else updateScene(s,name==='hero'?.17:.72,time,dt);
 });
 if(scenes.hero?.pointer){
  const {target,live}=scenes.hero.pointer;
  live.x=damp(live.x,target.x,3,dt);live.y=damp(live.y,target.y,3,dt);
  scenes.hero.group.rotation.y+=live.x*dt*.12;
  scenes.hero.group.rotation.x+=live.y*dt*.08;
 }
 requestAnimationFrame(animate);
}
function setupLinks(){
 document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
  const target=document.querySelector(a.getAttribute('href'));if(!target)return;
  e.preventDefault();target.scrollIntoView({behavior:prefersReduced?'auto':'smooth'});
 }));
}
function boot(){
 initScenes();observeSections();pointerEffects();setupLinks();setupScroll();
 const loader=document.getElementById('loader'),fill=document.getElementById('loaderFill');
 if(fill)fill.style.width='100%';setTimeout(()=>loader?.classList.add('done'),500);
 animate();
}
document.addEventListener('DOMContentLoaded',boot);
