import * as THREE from 'three';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const clamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const damp = (a,b,k,dt)=>THREE.MathUtils.damp(a,b,k,dt);
const canvases = {};
const scenes = {};
let targetProgress=0, liveProgress=0, pointer={x:0,y:0,tx:0,ty:0};
let activeSections={hero:true,journey:false,closing:false};
const clock=new THREE.Clock();

function makeRenderer(canvas){
  try{
    const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:!coarsePointer,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.setSize(canvas.clientWidth||canvas.parentElement.clientWidth,canvas.clientHeight||canvas.parentElement.clientHeight,false);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.18;
    return renderer;
  }catch(e){canvas.classList.add('no-webgl');return null;}
}
function resizeRenderer(renderer,camera,canvas){
  if(!renderer)return;
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
function material(color,emissive=color,opacity=1){
 return new THREE.MeshPhysicalMaterial({color,emissive,emissiveIntensity:.12,metalness:.42,roughness:.3,clearcoat:.9,clearcoatRoughness:.2,transparent:opacity<1,opacity});
}
function addDust(scene,count=750,spread=9){
 const g=new THREE.BufferGeometry(),p=new Float32Array(count*3),c=new Float32Array(count*3),sizes=new Float32Array(count);
 const green=new THREE.Color('#c9ff58'),white=new THREE.Color('#b9d3c4');
 for(let i=0;i<count;i++){
  const r=2+Math.random()*spread,t=Math.random()*Math.PI*2,u=Math.acos(2*Math.random()-1);
  p[i*3]=r*Math.sin(u)*Math.cos(t);p[i*3+1]=r*Math.cos(u);p[i*3+2]=r*Math.sin(u)*Math.sin(t);
  const col=Math.random()>.78?green:white;c[i*3]=col.r;c[i*3+1]=col.g;c[i*3+2]=col.b;sizes[i]=Math.random();
 }
 g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));g.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
 const m=new THREE.PointsMaterial({size:.023,vertexColors:true,transparent:true,opacity:.72,depthWrite:false,sizeAttenuation:true});
 const pts=new THREE.Points(g,m);scene.add(pts);return pts;
}
function createCore(group,scale=1){
 const core=new THREE.Group();group.add(core);
 const geo=new THREE.IcosahedronGeometry(1,5);
 const shell=new THREE.Mesh(geo,material('#648c45','#345a27'));
 shell.scale.setScalar(scale);core.add(shell);
 const wire=new THREE.Mesh(new THREE.IcosahedronGeometry(1.025,2),new THREE.MeshBasicMaterial({color:'#dcff9b',wireframe:true,transparent:true,opacity:.075}));
 wire.scale.setScalar(scale);core.add(wire);
 const inner=new THREE.Mesh(new THREE.SphereGeometry(.63,48,48),new THREE.MeshStandardMaterial({color:'#15271a',metalness:.7,roughness:.18,emissive:'#476b23',emissiveIntensity:.5}));
 inner.scale.setScalar(scale);core.add(inner);
 const rings=[];
 [1.48,1.78,2.05].forEach((r,i)=>{
  const ring=new THREE.Mesh(new THREE.TorusGeometry(r*scale,.007+(i===1?.004:0),8,180),new THREE.MeshBasicMaterial({color:i===1?'#c9ff58':'#a9d9b2',transparent:true,opacity:i===1?.62:.27}));
  ring.rotation.set(.5+i*.48,.25+i*.7,.18+i*.4);core.add(ring);rings.push(ring);
 });
 const halo=new THREE.Mesh(new THREE.TorusGeometry(2.35*scale,.002,6,180),new THREE.MeshBasicMaterial({color:'#c9ff58',transparent:true,opacity:.28}));
 halo.rotation.x=Math.PI/2.4;core.add(halo);rings.push(halo);
 return {core,shell,wire,inner,rings};
}
function initHero(){
 const canvas=document.getElementById('hero-canvas');if(!canvas)return;
 const renderer=makeRenderer(canvas);if(!renderer){canvas.parentElement.classList.add('webgl-fallback');return;}
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#07100d',.025);
 const camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(0,.15,8.1);
 const ambient=new THREE.AmbientLight('#b7d9bd',.72);scene.add(ambient);
 const key=new THREE.PointLight('#c9ff58',48,18);key.position.set(3,4,4);scene.add(key);
 const rim=new THREE.PointLight('#407d91',55,18);rim.position.set(-4,-2,-3);scene.add(rim);
 const root=new THREE.Group();scene.add(root);
 root.position.x=.72;const c=createCore(root,.86);
 const dust=addDust(scene,1050,8);
 const nodes=[];
 for(let i=0;i<9;i++){
  const n=new THREE.Mesh(new THREE.SphereGeometry(.035+(i%3)*.012,16,16),new THREE.MeshBasicMaterial({color:i%3===0?'#c9ff58':'#a5c8aa'}));
  const a=i/9*Math.PI*2,r=2.65+(i%2)*.26;n.position.set(Math.cos(a)*r,Math.sin(a*1.6)*.5,Math.sin(a)*r);root.add(n);nodes.push(n);
 }
 const linePositions=new Float32Array(nodes.length*6);const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.BufferAttribute(linePositions,3));
 const line=new THREE.LineSegments(lineGeo,new THREE.LineBasicMaterial({color:'#c9ff58',transparent:true,opacity:.13}));root.add(line);
 scenes.hero={renderer,scene,camera,root,c,dust,nodes,line,canvas};
}
function initJourney(){
 const canvas=document.getElementById('journey-canvas');if(!canvas)return;
 const renderer=makeRenderer(canvas);if(!renderer){canvas.parentElement.classList.add('webgl-fallback');return;}
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(0,0,8.5);
 scene.add(new THREE.AmbientLight('#c7d8c9',1.25));
 const light=new THREE.PointLight('#c9ff58',100,20);light.position.set(2,4,5);scene.add(light);
 const blue=new THREE.PointLight('#497a84',75,20);blue.position.set(-4,-2,-3);scene.add(blue);
 const root=new THREE.Group();scene.add(root);
 const c=createCore(root,.88);
 const dust=addDust(scene,1300,9);
 const nodes=[],initial=[],organized=[],graph=[];
 const count=16;
 for(let i=0;i<count;i++){
  const n=new THREE.Mesh(new THREE.IcosahedronGeometry(.055+(i%4)*.009,1),new THREE.MeshStandardMaterial({color:i%4===0?'#d9ff8c':'#98bfa5',metalness:.5,roughness:.25,emissive:'#37522c',emissiveIntensity:.55}));
  root.add(n);nodes.push(n);
  initial.push(new THREE.Vector3((Math.random()-.5)*7,(Math.random()-.5)*5,(Math.random()-.5)*4));
  const a=i/count*Math.PI*2,rr=2.15+(i%3)*.12;
  organized.push(new THREE.Vector3(Math.cos(a)*rr,Math.sin(a)*rr*.7,Math.sin(a*2)*.5));
  const ga=i%4,gb=Math.floor(i/4);
  graph.push(new THREE.Vector3((ga-1.5)*1.05,(1.5-gb)*.9,Math.sin(i*2.7)*.28));
 }
 const edgePairs=[];for(let i=0;i<count;i++){edgePairs.push([i,(i+1)%count]);if(i%2===0)edgePairs.push([i,(i+5)%count]);}
 const edgeGeo=new THREE.BufferGeometry();const positions=new Float32Array(edgePairs.length*6);edgeGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const edges=new THREE.LineSegments(edgeGeo,new THREE.LineBasicMaterial({color:'#c9ff58',transparent:true,opacity:.35,depthWrite:false}));root.add(edges);
 const explodeBits=[];
 for(let i=0;i<6;i++){
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(1.2+i*.13,.008,8,120),new THREE.MeshBasicMaterial({color:i%2?'#d1e5c8':'#c9ff58',transparent:true,opacity:.55}));
  mesh.rotation.set(.4+i*.2,.5*i,.3*i);root.add(mesh);explodeBits.push(mesh);
 }
 scenes.journey={renderer,scene,camera,root,c,dust,nodes,initial,organized,graph,edgePairs,edgeGeo,edges,explodeBits,canvas};
}
function initClosing(){
 const canvas=document.getElementById('closing-canvas');if(!canvas)return;
 const renderer=makeRenderer(canvas);if(!renderer){canvas.parentElement.classList.add('webgl-fallback');return;}
 const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(35,1,.1,100);camera.position.set(0,0,7.2);
 scene.add(new THREE.AmbientLight('#d9f0d8',1.4));
 const light=new THREE.PointLight('#c9ff58',110,18);light.position.set(2,3,4);scene.add(light);
 const root=new THREE.Group();scene.add(root);const c=createCore(root,1.18);const dust=addDust(scene,900,7);
 scenes.closing={renderer,scene,camera,root,c,dust,canvas};
}
function updateEdges(s){
 const arr=s.edgeGeo.attributes.position.array;
 s.edgePairs.forEach(([a,b],i)=>{
  const pa=s.nodes[a].position,pb=s.nodes[b].position,k=i*6;
  arr[k]=pa.x;arr[k+1]=pa.y;arr[k+2]=pa.z;arr[k+3]=pb.x;arr[k+4]=pb.y;arr[k+5]=pb.z;
 });
 s.edgeGeo.attributes.position.needsUpdate=true;s.edgeGeo.computeBoundingSphere();
}
function updateJourney(p,dt){
 const s=scenes.journey;if(!s)return;
 const q=clamp(p);s.root.rotation.y=damp(s.root.rotation.y,.12+q*1.7,2.2,dt);s.root.rotation.x=damp(s.root.rotation.x,Math.sin(q*Math.PI)*.24,2,dt);
 const scatter=clamp(1-q*4),order=clamp(1-Math.abs(q-.34)*5),network=clamp(1-Math.abs(q-.67)*5),flow=clamp((q-.73)*4);
 const arrange=clamp(q*3.3);
 s.nodes.forEach((n,i)=>{
  const a=s.initial[i],b=s.organized[i],g=s.graph[i];
  const mid=a.clone().lerp(b,arrange);
  const late=clamp((q-.48)*3.4);mid.lerp(g,late);
  const final=clamp((q-.75)*4.0);
  const orbitAngle=i/ s.nodes.length*Math.PI*2+q*1.2;
  const orbit=new THREE.Vector3(Math.cos(orbitAngle)*2.05,Math.sin(orbitAngle)*1.35,Math.sin(orbitAngle*2)*.36);
  mid.lerp(orbit,final);
  n.position.lerp(mid,1-Math.exp(-dt*4.5));
  const sc=1+Math.sin(q*18+i)*.08;n.scale.setScalar(sc);
  n.material.opacity=1;
 });
 updateEdges(s);
 s.edges.material.opacity=.08+network*.58+flow*.3;
 s.c.core.scale.setScalar(.86);
 s.c.shell.material.emissiveIntensity=.22+q*.58;
 s.c.rings.forEach((r,i)=>{
  const separation=1+Math.sin(q*Math.PI*2+i*.5)*.12;
  r.scale.setScalar(separation+(q>.4&&q<.62?.24:0));
  r.rotation.z+=dt*(i%2?.09:-.07);
  r.rotation.x+=dt*.025;
  r.material.opacity=.2+q*.4;
 });
 s.explodeBits.forEach((m,i)=>{
  const phase=clamp(1-Math.abs(q-.52)*3);
  const scatterDist=1+phase*(.16+i*.035);
  m.scale.setScalar(scatterDist);
  m.rotation.x+=dt*(.045+i*.012);m.rotation.z+=dt*(.065+i*.018);
  m.position.set(Math.sin(i*1.7)*phase*.36,Math.cos(i*2.1)*phase*.32,Math.sin(i)*phase*.3);
 });
 s.dust.rotation.y+=dt*.02;
 s.camera.position.z=damp(s.camera.position.z,8.5,2,dt);
 s.camera.position.x=damp(s.camera.position.x,Math.sin(q*Math.PI*2)*.12,2,dt);
 s.camera.position.y=damp(s.camera.position.y,Math.cos(q*Math.PI)*.08,2,dt);
 s.camera.lookAt(0,0,0);
}
function animate(){
 const dt=Math.min(clock.getDelta(),.04),t=clock.elapsedTime;
 pointer.x=damp(pointer.x,pointer.tx,5,dt);pointer.y=damp(pointer.y,pointer.ty,5,dt);
 const hero=scenes.hero;
 if(hero&&activeSections.hero){
  hero.root.rotation.y+=dt*.16;hero.root.rotation.x=damp(hero.root.rotation.x,pointer.y*.18,3,dt);
  hero.root.rotation.z=damp(hero.root.rotation.z,pointer.x*.11,3,dt);
  hero.c.core.rotation.y+=dt*.12;hero.c.rings.forEach((r,i)=>{r.rotation.z+=dt*(i%2?.09:-.07);r.rotation.x+=dt*.025});
  hero.c.shell.material.emissiveIntensity=.2+Math.sin(t*.75)*.12;
  hero.nodes.forEach((n,i)=>{const a=t*.16+i/hero.nodes.length*Math.PI*2,r=2.7+(i%2)*.23;n.position.set(Math.cos(a)*r,Math.sin(a*1.7)*.42,Math.sin(a)*r)});
  const a=hero.line.geometry.attributes.position.array;
  hero.nodes.forEach((n,i)=>{const b=hero.nodes[(i+1)%hero.nodes.length],k=i*6;a[k]=n.position.x;a[k+1]=n.position.y;a[k+2]=n.position.z;a[k+3]=b.position.x;a[k+4]=b.position.y;a[k+5]=b.position.z});
  hero.line.geometry.attributes.position.needsUpdate=true;hero.dust.rotation.y+=dt*.008;
  hero.camera.position.x=damp(hero.camera.position.x,pointer.x*.4,2,dt);hero.camera.position.y=damp(hero.camera.position.y,-pointer.y*.25,2,dt);hero.camera.lookAt(0,0,0);
  hero.renderer.render(hero.scene,hero.camera);
 }
 if(scenes.journey&&activeSections.journey){liveProgress=damp(liveProgress,targetProgress,5,dt);updateJourney(liveProgress,dt);const s=scenes.journey;s.dust.rotation.y+=dt*.009;s.renderer.render(s.scene,s.camera);}
 const close=scenes.closing;
 if(close&&activeSections.closing){close.root.rotation.y+=dt*.1;close.c.core.rotation.x+=dt*.09;close.c.rings.forEach((r,i)=>{r.rotation.z+=dt*(i%2?.07:-.055);r.rotation.y+=dt*.025});close.c.shell.material.emissiveIntensity=.34+Math.sin(t*.8)*.1;close.dust.rotation.y+=dt*.006;close.camera.lookAt(0,0,0);close.renderer.render(close.scene,close.camera);}
 requestAnimationFrame(animate);
}
let lastChapter = -1;
function setChapter(index){
 const copies=[...document.querySelectorAll('.chapter-copy')];
 const count=Math.max(0,Math.min(copies.length-1,index));
 if(count===lastChapter)return;
 lastChapter=count;
 copies.forEach((el,i)=>{
  const is=i===count;el.classList.toggle('active',is);
  if(window.gsap){gsap.to(el,{autoAlpha:is?1:0,y:is?0:-22,duration:.42,ease:'power2.out',overwrite:true});}
  else{el.style.opacity=is?'1':'0';el.style.visibility=is?'visible':'hidden';}
 });
 const names=['01 — WHY IT EXISTS','02 — WHO IT IS FOR','03 — WHAT IT MANAGES','04 — YOUR FIRST 30 SECONDS','05 — HOW IT SHOULD FEEL','06 — WHY FLOW','07 — THE SIX-MONTH TEST','08 — LOCAL BY DESIGN','09 — MARKDOWN NOTES MANAGER'];
 const hints=['SCATTERED → IN FOCUS','MANY ROLES → ONE SPACE','TASKS → PERSPECTIVE','UNCERTAINTY → CLARITY','FRICTION → FLOW','MOTION → MOMENTUM','PERFECTION → PROGRESS','CENTRAL SERVER → YOUR SPACE','IDEAS → CONNECTIONS'];
 const tags=['DISPERSED','BALANCING','PRIORITISING','CLARITY','CALM','FLOW','MOMENTUM','LOCAL','CONNECTED'];
 const total=String(copies.length).padStart(2,'0');
 const counter=String(count+1).padStart(2,'0');
 document.getElementById('journeyKicker').textContent=names[count];
 document.getElementById('journeyHint').textContent=hints[count];
 document.getElementById('visualTag').lastChild.textContent=' SYSTEM / '+tags[count];
 document.getElementById('journeyCounter').innerHTML=counter+' <i>/</i> '+total;
 document.getElementById('visualCoord').textContent=String(count+1).padStart(3,'0');
 document.getElementById('flowIndex').innerHTML=String(Math.round((count+1)/copies.length*100)).padStart(2,'0')+'<span>%</span>';
 document.getElementById('flowBar').style.width=((count+1)/copies.length*100)+'%';
}
function setupAnimations(){
 const gs=window.gsap,ST=window.ScrollTrigger;
 if(!gs||!ST){
  document.getElementById('journey').style.height='auto';
  document.querySelector('.journey-pin').style.height='auto';
  document.querySelectorAll('.chapter-copy').forEach(el=>{el.style.position='relative';el.style.top='auto';el.style.display='block';el.style.opacity='1';el.style.visibility='visible';el.style.transform='none';});
  return;
 }
 gs.registerPlugin(ST);
 const isMobile=window.matchMedia('(max-width:760px)').matches;
 if(reduceMotion){document.getElementById('journey').style.height='auto';document.querySelector('.journey-pin').style.height='auto';document.querySelectorAll('.chapter-copy').forEach(el=>{el.style.position='relative';el.style.top='auto';el.style.opacity='1';el.style.visibility='visible';el.style.transform='none';});return;}
 if(isMobile){document.querySelectorAll('.chapter-copy').forEach(el=>gs.fromTo(el,{y:35,autoAlpha:0},{y:0,autoAlpha:1,ease:'none',scrollTrigger:{trigger:el,start:'top 88%',end:'top 62%',scrub:.7}}));setChapter(0);}
 if(!reduceMotion){
  gs.from('.hero-copy .overline',{y:18,autoAlpha:0,duration:.8,delay:.25,ease:'power3.out'});
  gs.from('.hero h1',{y:70,autoAlpha:0,duration:1.2,delay:.3,ease:'power4.out'});
  gs.from('.hero-lead,.hero-scroll',{y:24,autoAlpha:0,duration:.8,stagger:.12,delay:.75,ease:'power3.out'});
  gs.from('.hero-scene',{scale:.82,autoAlpha:0,duration:1.5,delay:.25,ease:'power3.out'});
  const state={p:0};
  const taskX=gs.quickTo('.ui-task','x',{duration:.42,ease:'power2.out'});
  const taskY=gs.quickTo('.ui-task','y',{duration:.42,ease:'power2.out'});
  const taskR=gs.quickTo('.ui-task','rotation',{duration:.42,ease:'power2.out'});
  const noteX=gs.quickTo('.ui-note','x',{duration:.42,ease:'power2.out'});
  const noteY=gs.quickTo('.ui-note','y',{duration:.42,ease:'power2.out'});
  const noteR=gs.quickTo('.ui-note','rotation',{duration:.42,ease:'power2.out'});
  if(!isMobile)gs.to(state,{p:1,ease:'none',scrollTrigger:{
    trigger:'#journey',start:'top top',end:'bottom bottom',pin:'.journey-pin',pinSpacing:false,scrub:1.05,anticipatePin:1,invalidateOnRefresh:true,
    onUpdate:self=>{
      targetProgress=state.p= self.progress;
      const chapterCount=document.querySelectorAll('.chapter-copy').length;const active=Math.min(chapterCount-1,Math.floor(self.progress*chapterCount+0.0001));setChapter(active);
      document.getElementById('chapterProgress').style.width=(self.progress*100)+'%';
      document.getElementById('flowIndex').innerHTML=String(Math.round(self.progress*100)).padStart(2,'0')+'<span>%</span>';
      document.getElementById('flowBar').style.width=(self.progress*100)+'%';
      document.getElementById('readingProgress').style.width=((window.scrollY/(document.documentElement.scrollHeight-innerHeight))*100)+'%';
      const velocity=Math.min(1,Math.abs(self.getVelocity())/2600);
      document.documentElement.style.setProperty('--scroll-velocity',velocity.toFixed(3));
      taskX(Math.sin(self.progress*Math.PI*4)*18);taskY(Math.cos(self.progress*Math.PI*3)*11);taskR(-4+self.progress*8);
      noteX(-Math.sin(self.progress*Math.PI*3)*20);noteY(Math.cos(self.progress*Math.PI*4)*12);noteR(4-self.progress*8);
    }
  }});
  gs.from('.manifesto-title h2',{y:90,autoAlpha:0,duration:1,ease:'power3.out',scrollTrigger:{trigger:'.manifesto-title',start:'top 78%',end:'top 35%',scrub:1}});
  gs.from('.manifesto-statement',{y:55,autoAlpha:0,stagger:.16,ease:'power2.out',scrollTrigger:{trigger:'.manifesto-grid',start:'top 82%',end:'bottom 60%',scrub:1}});
  gs.from('.closing-copy',{scale:.84,y:45,autoAlpha:0,ease:'power3.out',scrollTrigger:{trigger:'#closing',start:'top 78%',end:'center center',scrub:1}});
  gs.from('.access-frame',{y:70,scale:.96,autoAlpha:0,ease:'power2.out',scrollTrigger:{trigger:'#access',start:'top 70%',end:'top 25%',scrub:1}});
 }else{setChapter(0);}
 ST.refresh();
}
function fallbackScroll(){
 const section=document.getElementById('journey');
 const update=()=>{const r=section.getBoundingClientRect(),p=clamp(-r.top/(r.height-innerHeight));targetProgress=p;setChapter(Math.min(document.querySelectorAll('.chapter-copy').length-1,Math.floor(p*document.querySelectorAll('.chapter-copy').length+0.0001)));document.getElementById('chapterProgress').style.width=(p*100)+'%';};
 addEventListener('scroll',update,{passive:true});update();
}
function setupObservers(){
 const map=[['hero','hero'],['journey','journey'],['closing','closing']];
 const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){activeSections[e.target.id]=true}else{activeSections[e.target.id]=false}}),{threshold:.02});
 map.forEach(([id])=>{const el=document.getElementById(id);if(el)io.observe(el)});
 const bar=document.getElementById('readingProgress');
 addEventListener('scroll',()=>{const max=document.documentElement.scrollHeight-innerHeight;bar.style.width=(max>0?scrollY/max*100:0)+'%'},{passive:true});
}
function setupPointer(){
 if(reduceMotion)return;
 addEventListener('pointermove',e=>{pointer.tx=(e.clientX/innerWidth-.5)*2;pointer.ty=(e.clientY/innerHeight-.5)*2;},{passive:true});
 const hero=document.querySelector('.hero-scene');
 if(hero&&!coarsePointer)hero.addEventListener('pointermove',e=>{const r=hero.getBoundingClientRect();hero.style.setProperty('--pointer-x',((e.clientX-r.left)/r.width-.5).toFixed(3));hero.style.setProperty('--pointer-y',((e.clientY-r.top)/r.height-.5).toFixed(3));},{passive:true});
 document.querySelectorAll('.float-ui').forEach(el=>el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect();el.style.transform='translate3d('+((e.clientX-r.left)/r.width-.5)*8+'px,'+((e.clientY-r.top)/r.height-.5)*8+'px,0)';}));
}
function setupLinkMotion(){
 document.querySelectorAll('a').forEach(a=>{if(a.hash){a.addEventListener('click',e=>{const target=document.querySelector(a.hash);if(target){e.preventDefault();target.scrollIntoView({behavior:reduceMotion?'auto':'smooth'});}})}});
}
function boot(){
 initHero();initJourney();initClosing();
 const sizes=()=>{Object.values(scenes).forEach(s=>resizeRenderer(s.renderer,s.camera,s.canvas));if(window.ScrollTrigger)ScrollTrigger.refresh();};
 addEventListener('resize',sizes,{passive:true});setupObservers();setupPointer();setupLinkMotion();setupAnimations();
 animate();
 const loader=document.getElementById('loader'),fill=document.getElementById('loaderFill');
 if(fill)fill.style.width='100%';
 setTimeout(()=>loader?.classList.add('done'),650);
}
document.addEventListener('DOMContentLoaded',boot);
