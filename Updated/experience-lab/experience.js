import * as THREE from 'three';

const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile=matchMedia('(max-width:760px)').matches;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const damp=(a,b,k,dt)=>THREE.MathUtils.damp(a,b,k,dt);
const up=new THREE.Vector3(0,1,0);
const worlds={};
const clock=new THREE.Clock();
let targetProgress=0,liveProgress=0,lastChapter=-1;
let scrollQueued=false;
const active={home:true,journey:false};

const routePoints=[
 [0,0,28],[0,0,13],[1.2,0,-2],[4.5,.15,-18],[5,.1,-34],
 [2,.3,-48],[-3.6,.2,-63],[-5,.05,-79],[-1,.1,-94],[4,.18,-110],
 [4.5,.1,-126],[.5,0,-141],[-3.5,.18,-157],[0,.25,-174],[3.5,.12,-190],[1,-.05,-210]
];
function makeRoute(){
 const points=routePoints.map(p=>new THREE.Vector3(p[0],p[1],p[2]));
 return new THREE.CatmullRomCurve3(points,false,'centripetal',.45);
}
function routeFrame(curve,t){
 const p=curve.getPointAt(clamp(t)),tangent=curve.getTangentAt(clamp(t)).normalize();
 const right=new THREE.Vector3().crossVectors(tangent,up).normalize();
 return {p,tangent,right};
}
function roadGeometry(curve){
 const segments=1300,width=2.15,positions=new Float32Array((segments+1)*2*3),uvs=new Float32Array((segments+1)*2*2),indices=[];
 for(let i=0;i<=segments;i++){
  const t=i/segments,{p,right}=routeFrame(curve,t);
  for(let side=0;side<2;side++){
   const k=(i*2+side),offset=side?width:-width;
   positions[k*3]=p.x+right.x*offset;positions[k*3+1]=p.y+.055;positions[k*3+2]=p.z+right.z*offset;
   uvs[k*2]=t*30;uvs[k*2+1]=side;
  }
  if(i<segments){const a=i*2,b=a+2;indices.push(a,b,a+1,b,b+1,a+1);}
 }
 const g=new THREE.BufferGeometry();g.setIndex(indices);g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('uv',new THREE.BufferAttribute(uvs,2));g.computeVertexNormals();return g;
}
function makeLine(curve,offset,color,radius,opacity=1){
 const pts=[];
 for(let i=0;i<=500;i++){const {p,right}=routeFrame(curve,i/500);pts.push(p.clone().addScaledVector(right,offset).add(new THREE.Vector3(0,.11,0)));}
 const lineCurve=new THREE.CatmullRomCurve3(pts);
 const mesh=new THREE.Mesh(new THREE.TubeGeometry(lineCurve,900,radius,6,false),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:opacity>.5?.25:.08,roughness:.46,metalness:.18,transparent:opacity<1,opacity}));
 return mesh;
}
function makeCar(){
 const car=new THREE.Group();
 const bodyMat=new THREE.MeshStandardMaterial({color:'#252d21',metalness:.38,roughness:.28});
 const accentMat=new THREE.MeshStandardMaterial({color:'#c7f45b',emissive:'#779d2d',emissiveIntensity:.4,metalness:.24,roughness:.25});
 const glassMat=new THREE.MeshStandardMaterial({color:'#82917b',metalness:.2,roughness:.18,transparent:true,opacity:.82});
 const body=new THREE.Mesh(new THREE.BoxGeometry(1.34,.34,2.35),bodyMat);body.position.y=.34;car.add(body);
 const bonnet=new THREE.Mesh(new THREE.BoxGeometry(1.18,.12,.68),accentMat);bonnet.position.set(0,.55,-.72);car.add(bonnet);
 const cabin=new THREE.Mesh(new THREE.BoxGeometry(.94,.4,1.05),glassMat);cabin.position.set(0,.68,.06);car.add(cabin);
 const roof=new THREE.Mesh(new THREE.BoxGeometry(.98,.07,.95),bodyMat);roof.position.set(0,.91,.08);car.add(roof);
 const nose=new THREE.Mesh(new THREE.BoxGeometry(1.08,.07,.2),accentMat);nose.position.set(0,.38,-1.17);car.add(nose);
 const wheelMat=new THREE.MeshStandardMaterial({color:'#090b09',roughness:.88,metalness:.08});
 const hubMat=new THREE.MeshStandardMaterial({color:'#a9c56b',metalness:.65,roughness:.24});
 for(const x of [-.72,.72])for(const z of [-.72,.72]){
  const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,.16,20),wheelMat);
  wheel.rotation.z=Math.PI/2;wheel.position.set(x,.24,z);car.add(wheel);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.168,16),hubMat);
  hub.rotation.z=Math.PI/2;hub.position.set(x*1.02,.24,z);car.add(hub);
 }
 const tail=new THREE.Mesh(new THREE.BoxGeometry(1.24,.06,.12),accentMat);tail.position.set(0,.48,1.19);car.add(tail);
 car.scale.setScalar(.76);
 return car;
}
function makeCheckpoint(curve,t,index,group){
 const {p,right,tangent}=routeFrame(curve,t);
 const side=index%2===0?1:-1;
 const post=new THREE.Group();
 const foot=new THREE.Mesh(new THREE.BoxGeometry(.5,.11,.5),new THREE.MeshStandardMaterial({color:'#31392a',roughness:.6}));
 foot.position.y=.1;post.add(foot);
 const column=new THREE.Mesh(new THREE.BoxGeometry(.14,1.55,.14),new THREE.MeshStandardMaterial({color:'#82945b',metalness:.3,roughness:.4,emissive:'#425b20',emissiveIntensity:.18}));
 column.position.y=.9;post.add(column);
 const cap=new THREE.Mesh(new THREE.BoxGeometry(.3,.22,.3),new THREE.MeshStandardMaterial({color:'#c7f45b',emissive:'#8bbd3c',emissiveIntensity:.8,metalness:.3,roughness:.25}));
 cap.position.y=1.72;post.add(cap);
 const label=new THREE.Mesh(new THREE.BoxGeometry(.52,.18,.055),new THREE.MeshBasicMaterial({color:'#c7f45b'}));
 label.position.y=1.36;label.position.z=-.09;post.add(label);
 post.position.copy(p).addScaledVector(right,side*3.35);post.position.y=-.02;
 post.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),tangent);
 group.add(post);
}
function createWorld(canvas,kind){
 let renderer;
 try{
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:!mobile,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(Math.max(1,canvas.clientWidth),Math.max(1,canvas.clientHeight),false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
 }catch(e){canvas.parentElement.classList.add('no-webgl');return null;}
 const scene=new THREE.Scene();scene.background=null;scene.fog=new THREE.FogExp2('#0a0d08',.008);
 const camera=new THREE.PerspectiveCamera(kind==='journey'?42:40,1,.1,500);
 scene.add(new THREE.HemisphereLight('#e3e7d4','#242c1c',1.05));
 const key=new THREE.DirectionalLight('#f4f3d6',2.1);key.position.set(-8,15,12);scene.add(key);
 const lime=new THREE.PointLight('#c7f45b',32,45);lime.position.set(5,7,-12);scene.add(lime);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(700,500),new THREE.MeshStandardMaterial({color:'#10160f',roughness:1,metalness:0}));
 ground.rotation.x=-Math.PI/2;ground.position.set(0,-.42,-90);scene.add(ground);
 const curve=makeRoute(),world=new THREE.Group();scene.add(world);
 const road=new THREE.Mesh(roadGeometry(curve),new THREE.MeshStandardMaterial({color:'#30372b',roughness:.88,metalness:.08,side:THREE.DoubleSide}));world.add(road);
 world.add(makeLine(curve,-2.12,'#c7f45b',.035,.82));
 world.add(makeLine(curve,2.12,'#c7f45b',.035,.82));
 world.add(makeLine(curve,-1.86,'#abb49a',.012,.48));
 world.add(makeLine(curve,1.86,'#abb49a',.012,.48));
 const dashMat=new THREE.MeshStandardMaterial({color:'#e0e4d3',emissive:'#737c69',emissiveIntensity:.12,roughness:.7});
 const dashGeo=new THREE.BoxGeometry(.045,.028,1.25);
 for(let i=0;i<90;i++){
  const t=.018+i*.0108,{p,tangent}=routeFrame(curve,t);
  const dash=new THREE.Mesh(dashGeo,dashMat);dash.position.copy(p);dash.position.y=.105;
  dash.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),tangent);world.add(dash);
 }
 for(let i=0;i<9;i++)makeCheckpoint(curve,.055+i*.108,i,world);
 const car=makeCar();world.add(car);
 // Quiet, low architectural forms give the route depth without clutter.
 const scenery=new THREE.Group();world.add(scenery);
 const blockMat=new THREE.MeshStandardMaterial({color:'#1c2618',roughness:.9,metalness:.04});
 for(let i=0;i<44;i++){
  const t=.025+(i/44)*.94,{p,right}=routeFrame(curve,t),side=i%2?1:-1;
  const height=.7+(i%5)*.43,width=.45+(i%3)*.4;
  const block=new THREE.Mesh(new THREE.BoxGeometry(width,height,width),blockMat);
  block.position.copy(p).addScaledVector(right,side*(5.6+(i%4)*.45));block.position.y=height/2-.24;
  block.rotation.y=(i%3)*.2;scenery.add(block);
 }
 const state={canvas,renderer,scene,camera,curve,world,car,kind,progress:0};
 resize(state);return state;
}
function resize(s){
 if(!s?.renderer)return;
 const w=Math.max(1,s.canvas.clientWidth),h=Math.max(1,s.canvas.clientHeight);
 s.renderer.setSize(w,h,false);s.camera.aspect=w/h;s.camera.updateProjectionMatrix();
}
function renderWorld(s,p,dt){
 if(!s?.renderer)return;
 const t=.025+clamp(p)*.93;
 const {p:position,tangent,right}=routeFrame(s.curve,t);
 const carPos=position.clone();carPos.y=.2;
 s.car.position.copy(carPos);
 const forward=position.clone().add(tangent);
 s.car.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),tangent);
 s.car.position.y+=Math.sin(clock.elapsedTime*2.2)*.018;
 const cameraPosition=position.clone().addScaledVector(right, s.kind==='hero'?5.6:5.0).add(new THREE.Vector3(0,s.kind==='hero'?5.0:4.3,0)).addScaledVector(tangent,-(s.kind==='hero'?9.5:8.2));
 const lookAt=position.clone().addScaledVector(tangent,9.5);
 s.camera.position.lerp(cameraPosition,1-Math.exp(-dt*3.2));
 s.camera.lookAt(lookAt);
 s.world.rotation.y=Math.sin(clock.elapsedTime*.22)*.012;
 s.renderer.render(s.scene,s.camera);
}
const chapterNames=['THE PURPOSE','WHO IT IS FOR','WHAT IT MANAGES','YOUR FIRST 30 SECONDS','HOW IT SHOULD FEEL','WHY FLOW','THE SIX-MONTH TEST','LOCAL BY DESIGN','NOTES MANAGER'];
function setChapter(n){
 const beats=[...document.querySelectorAll('.beat')];n=clamp(n,0,beats.length-1);
 if(n===lastChapter)return;lastChapter=n;
 beats.forEach((el,i)=>{el.classList.toggle('active',i===n);});
 document.getElementById('chapterNumber').textContent=String(n+1).padStart(2,'0');
 document.getElementById('journeyLabel').textContent=chapterNames[n];
 document.getElementById('journeyPercent').textContent=String(n+1).padStart(2,'0')+' / 09';
 document.getElementById('routePoint').textContent='CHECKPOINT '+String(n+1).padStart(2,'0');
 document.getElementById('trackProgress').style.width=((n+1)/9*100)+'%';
}
function updateScroll(){
 const section=document.getElementById('journey'),r=section.getBoundingClientRect();
 const max=Math.max(1,section.offsetHeight-innerHeight);
 const p=clamp(-r.top/max);
 targetProgress=p;
 const n=Math.min(8,Math.floor(p*9));
 setChapter(n);
 const total=document.documentElement.scrollHeight-innerHeight;
 document.getElementById('topProgress').style.width=(total>0?scrollY/total*100:0)+'%';
}
function setupScroll(){
 const update=()=>{scrollQueued=false;updateScroll();};
 addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(update);}},{passive:true});
 updateScroll();
 if(reduced||mobile){
  const pin=document.querySelector('.journey-pin');pin.classList.add('flow-mobile');
  document.querySelector('.journey').style.height='auto';
  document.querySelectorAll('.beat').forEach(el=>el.classList.add('mobile-visible'));
 }
}
function setupObservers(){
 const io=new IntersectionObserver(entries=>entries.forEach(e=>{
  if(e.target.id==='home')active.home=e.isIntersecting;
  if(e.target.id==='journey')active.journey=e.isIntersecting;
 }),{threshold:.01});
 io.observe(document.getElementById('home'));io.observe(document.getElementById('journey'));
}
function setupLinks(){
 document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
  const target=document.querySelector(a.getAttribute('href'));if(!target)return;
  e.preventDefault();target.scrollIntoView({behavior:reduced?'auto':'smooth'});
 }));
}
function animate(){
 const dt=Math.min(clock.getDelta(),.04);
 if(worlds.hero&&active.home)renderWorld(worlds.hero,.035,dt);
 if(worlds.journey&&active.journey){
  liveProgress=damp(liveProgress,targetProgress,3.8,dt);
  renderWorld(worlds.journey,liveProgress,dt);
 }
 requestAnimationFrame(animate);
}
function boot(){
 const load=document.getElementById('loadProgress');
 worlds.hero=createWorld(document.getElementById('driveCanvas'),'hero');
 worlds.journey=createWorld(document.getElementById('journeyCanvas'),'journey');
 setupScroll();setupObservers();setupLinks();
 if(load)load.style.width='100%';
 setTimeout(()=>document.getElementById('loading')?.classList.add('done'),480);
 const onResize=()=>{Object.values(worlds).forEach(resize);updateScroll();};addEventListener('resize',onResize,{passive:true});
 animate();
}
document.addEventListener('DOMContentLoaded',boot);
