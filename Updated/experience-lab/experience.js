import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile=matchMedia('(max-width:760px)').matches;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const damp=(a,b,k,dt)=>THREE.MathUtils.damp(a,b,k,dt);
const clock=new THREE.Clock();
const loader=new GLTFLoader();
const ASSET='https://cdn.jsdelivr.net/gh/Hidencod/tge-assets@main/packs/';
const sceneState={renderer:null,scene:null,camera:null,curve:null,car:null,carFallback:null,trees:[],bushes:[],roadTiles:[],world:null};
let scrollTarget=0,scrollLive=0,lastBeat=-1,lastFeature=-1,pointer={x:0,y:0,tx:0,ty:0};
let currentSection='home',rafQueued=false;
const routePoints=[
 [5,0,38],[5,0,22],[3,0,6],[-1,0,-10],[-5,0,-27],[-5,0,-45],[-1,0,-61],[5,0,-78],[7,0,-96],[2,0,-112],[-5,0,-129],[-6,0,-147],[0,0,-164],[7,0,-180],[8,0,-198],[1,0,-216],[-6,0,-232],[-4,0,-250],[4,0,-268],[6,0,-285],[0,0,-304]
];
const curve=new THREE.CatmullRomCurve3(routePoints.map(v=>new THREE.Vector3(...v)),false,'centripetal',.46);
const beats=[
 'WHY IT EXISTS','WHO IT IS FOR','WHAT IT MANAGES','YOUR FIRST 30 SECONDS','HOW IT SHOULD FEEL','WHY FLOW','THE SIX-MONTH TEST','LOCAL BY DESIGN','NOTES MANAGER'
];
function frameAt(t){
 const p=curve.getPointAt(clamp(t)),tangent=curve.getTangentAt(clamp(t)).normalize();
 const right=new THREE.Vector3().crossVectors(tangent,new THREE.Vector3(0,1,0)).normalize();
 return {p,tangent,right};
}
function buildRoadRibbon(){
 const segments=1500,half=4.15,vertices=[],indices=[],uv=[];
 for(let i=0;i<=segments;i++){
  const t=i/segments,{p,right}=frameAt(t);
  for(let j=0;j<2;j++){
   const offset=j===0?-half:half;
   vertices.push(p.x+right.x*offset,p.y+.025,p.z+right.z*offset);
   uv.push(t*44,j);
  }
  if(i<segments){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
 }
 const g=new THREE.BufferGeometry();g.setIndex(indices);g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();
 const road=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#32392e',roughness:.94,metalness:.02,side:THREE.DoubleSide}));
 road.receiveShadow=true;sceneState.world.add(road);
 const edgeMat=new THREE.MeshStandardMaterial({color:'#b8db70',emissive:'#638b32',emissiveIntensity:.32,roughness:.45});
 for(const side of [-1,1]){
  const points=[];for(let i=0;i<=520;i++){const {p,right}=frameAt(i/520);points.push(p.clone().addScaledVector(right,side*3.97).add(new THREE.Vector3(0,.09,0)));}
  const line=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),1100,.035,6,false),edgeMat);sceneState.world.add(line);
 }
 const dashMat=new THREE.MeshStandardMaterial({color:'#d3d8c9',emissive:'#596451',emissiveIntensity:.08,roughness:.8});
 for(let i=0;i<112;i++){
  const t=.012+i*.0087,{p,tangent}=frameAt(t);
  const dash=new THREE.Mesh(new THREE.BoxGeometry(.075,.035,1.18),dashMat);
  dash.position.copy(p);dash.position.y=.08;dash.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),tangent);sceneState.world.add(dash);
 }
}
function buildTerrain(){
 const geo=new THREE.PlaneGeometry(620,680,100,115);geo.rotateX(-Math.PI/2);
 const pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getZ(i);
  const hills=Math.sin(x*.025+z*.009)*1.9+Math.cos(z*.018-x*.012)*1.35+Math.sin((x+z)*.042)*.34;
  const roadFalloff=Math.exp(-Math.abs(x)*.045);
  pos.setY(i,hills*roadFalloff-.3);
 }
 geo.computeVertexNormals();
 const terrain=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#263522',roughness:1,metalness:0,flatShading:true}));
 terrain.position.set(0,-.25,-115);terrain.receiveShadow=true;sceneState.world.add(terrain);
 const hillMat=[new THREE.MeshStandardMaterial({color:'#1b2919',roughness:1,flatShading:true}),new THREE.MeshStandardMaterial({color:'#26351f',roughness:1,flatShading:true})];
 for(let i=0;i<17;i++){
  const h=13+(i%5)*4,r=18+(i%4)*8;
  const hill=new THREE.Mesh(new THREE.ConeGeometry(r,h,7),hillMat[i%2]);
  hill.position.set((i%2?1:-1)*(32+(i%4)*14),h*.38,-25-i*18);hill.rotation.y=i*1.4;sceneState.world.add(hill);
 }
}
function addRoadside(){
 const postMat=new THREE.MeshStandardMaterial({color:'#667253',roughness:.72,metalness:.25});
 const lampMat=new THREE.MeshStandardMaterial({color:'#c7f45b',emissive:'#a4d346',emissiveIntensity:.8});
 for(let i=0;i<48;i++){
  const t=.035+i*.019,{p,right}=frameAt(t),side=i%2?1:-1;
  const x=p.clone().addScaledVector(right,side*(5.2+(i%3)*.4));
  const post=new THREE.Mesh(new THREE.BoxGeometry(.12,.8,.12),postMat);post.position.set(x.x,.36,x.z);sceneState.world.add(post);
  if(i%4===0){
   const lamp=new THREE.Mesh(new THREE.BoxGeometry(.23,.07,.18),lampMat);lamp.position.set(x.x,.79,x.z);sceneState.world.add(lamp);
   const glow=new THREE.PointLight('#c7f45b',2.2,8);glow.position.set(x.x,1.05,x.z);sceneState.world.add(glow);
  }
 }
}
function prepModel(gltf,targetHeight,kind){
 const root=gltf.scene.clone(true);root.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 root.position.sub(center);
 root.updateMatrixWorld(true);
 const maxHorizontal=Math.max(size.x,size.z);
 let s=kind==='car'?2.35/maxHorizontal:kind==='road'?8.1/maxHorizontal:targetHeight/Math.max(size.y,.001);
 root.scale.setScalar(s);
 root.updateMatrixWorld(true);
 const scaledBox=new THREE.Box3().setFromObject(root);
 root.position.y-=scaledBox.min.y;
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material.side=THREE.DoubleSide;}}});
 return {root,size,box:scaledBox};
}
function cloneTree(model,position,scale=1,rotation=0){
 const tree=model.clone(true);tree.position.copy(position);tree.scale.multiplyScalar(scale);tree.rotation.y=rotation;sceneState.world.add(tree);sceneState.trees.push(tree);return tree;
}
function cloneBush(model,position,scale=1,rotation=0){
 const b=model.clone(true);b.position.copy(position);b.scale.multiplyScalar(scale);b.rotation.y=rotation;sceneState.world.add(b);sceneState.bushes.push(b);
}
async function loadModels(){
 const modelSpecs=[
  ['car','car-kit/hatchback-sports.glb'],
  ['treeA','nature-kit/tree-detailed.glb'],
  ['treeB','nature-kit/tree-oak.glb'],
  ['bush','nature-kit/plant-bushlarge.glb'],
  ['road','city-kit-roads/road-straight.glb'],
  ['bend','city-kit-roads/road-bend.glb']
 ];
 const results=await Promise.allSettled(modelSpecs.map(async ([key,path])=>[key,await loader.loadAsync(ASSET+path)]));
 const models={};
 results.forEach((r,i)=>{if(r.status==='fulfilled')models[r.value[0]]=r.value[1];else console.warn('LifeFlow model unavailable:',modelSpecs[i][1],r.reason);});
 if(models.car){
  const data=prepModel(models.car,1.2,'car');
  const car=new THREE.Group();car.add(data.root);
  // Kenney car kit models are authored on a Z-forward axis; reverse to follow the road's -Z convention.
  if(data.size.x>data.size.z)data.root.rotation.y=Math.PI/2;
  else data.root.rotation.y=Math.PI;
  car.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  if(sceneState.carFallback){sceneState.world.remove(sceneState.carFallback);sceneState.carFallback=null;}
  sceneState.car=car;sceneState.world.add(car);
 } else createFallbackCar();
 const trees=[];
 if(models.treeA)trees.push(prepModel(models.treeA,5.1,'tree').root);
 if(models.treeB)trees.push(prepModel(models.treeB,4.2,'tree').root);
 const bush=models.bush?prepModel(models.bush,1.2,'tree').root:null;
 if(trees.length){
  for(let i=0;i<57;i++){
   const t=.025+(i/57)*.94,{p,right}=frameAt(t),side=i%2?1:-1;
   const distance=7.3+(i%5)*1.65+(i%3)*.25;
   const spot=p.clone().addScaledVector(right,side*distance);
   spot.y=-.03;
   const src=trees[i%trees.length];
   cloneTree(src,spot,.78+(i%4)*.17,(i*1.71)%Math.PI*2);
   if(bush&&i%2===0){
    const bspot=spot.clone().addScaledVector(right,side*.8).add(new THREE.Vector3((i%3-1)*.8,0,1.4));
    cloneBush(bush,bspot,.75+(i%3)*.2,i*.6);
   }
  }
 }
 if(models.road){
  const roadTemplate=prepModel(models.road,1,'road').root;
  const bendTemplate=models.bend?prepModel(models.bend,1,'road').root:null;
  const baseBounds=new THREE.Box3().setFromObject(roadTemplate),baseSize=baseBounds.getSize(new THREE.Vector3());
  const baseLongAxis=baseSize.x>baseSize.z?'x':'z';
  const baseTileLength=Math.max(baseSize.x,baseSize.z);
  const count=Math.ceil(curve.getLength()/Math.max(4,baseTileLength*.78));
  for(let i=0;i<count;i++){
   const t=(i+.5)/count,{p,tangent}=frameAt(t);
   const tA=curve.getTangentAt(clamp(t-.012)),tB=curve.getTangentAt(clamp(t+.012));
   const curvature=1-tA.dot(tB);
   const template=bendTemplate&&curvature>.018?bendTemplate:roadTemplate;
   const size=new THREE.Box3().setFromObject(template).getSize(new THREE.Vector3());
   const longAxis=size.x>size.z?'x':'z',baseAngle=longAxis==='x'?Math.PI/2:0;
   const tile=template.clone(true);tile.rotation.y=baseAngle;
   const actual=new THREE.Box3().setFromObject(tile),as=actual.getSize(new THREE.Vector3());
   tile.scale.set(tile.scale.x*(8.1/as.x),tile.scale.y,tile.scale.z*(curve.getLength()/count/as.z));
   const pathRotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),tangent);
   const localRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),baseAngle);
   tile.quaternion.copy(pathRotation).multiply(localRotation);
   tile.position.copy(p);tile.position.y=.035;
   tile.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
   sceneState.world.add(tile);sceneState.roadTiles.push(tile);
  }
 }
}
function createFallbackCar(){
 const car=new THREE.Group();
 const bodyMat=new THREE.MeshStandardMaterial({color:'#d2dfbd',metalness:.32,roughness:.25});
 const accent=new THREE.MeshStandardMaterial({color:'#c7f45b',emissive:'#7b9d38',emissiveIntensity:.35});
 const glass=new THREE.MeshStandardMaterial({color:'#27352a',metalness:.25,roughness:.16});
 const body=new THREE.Mesh(new THREE.BoxGeometry(1.55,.42,2.7),bodyMat);body.position.y=.55;car.add(body);
 const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.15,.5,1.25),glass);cabin.position.set(0,.96,.05);car.add(cabin);
 const stripe=new THREE.Mesh(new THREE.BoxGeometry(1.57,.035,1.75),accent);stripe.position.set(0,.78,-.25);car.add(stripe);
 for(const x of [-.82,.82])for(const z of [-.86,.86]){
  const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.18,20),new THREE.MeshStandardMaterial({color:'#080a08',roughness:.9}));
  wheel.rotation.z=Math.PI/2;wheel.position.set(x,.3,z);car.add(wheel);
 }
 sceneState.car=car;sceneState.carFallback=car;sceneState.world.add(car);
}
function buildCheckpointSigns(){
 for(let i=0;i<9;i++){
  const t=.09+i*.098,{p,right,tangent}=frameAt(t),side=i%2?1:-1;
  const group=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.BoxGeometry(.09,2.1,.09),new THREE.MeshStandardMaterial({color:'#7d8b66',metalness:.25,roughness:.5}));pole.position.y=1.05;group.add(pole);
  const plate=new THREE.Mesh(new THREE.BoxGeometry(1.35,.48,.08),new THREE.MeshStandardMaterial({color:'#151d13',roughness:.6,metalness:.2}));plate.position.y=2.15;group.add(plate);
  const marker=new THREE.Mesh(new THREE.BoxGeometry(.52,.05,.11),new THREE.MeshStandardMaterial({color:'#c7f45b',emissive:'#86a842',emissiveIntensity:.45}));marker.position.set(0,2.16,.07);group.add(marker);
  group.position.copy(p).addScaledVector(right,side*5.7);group.position.y=0;
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),tangent);sceneState.world.add(group);
 }
}
function initWorld(){
 const canvas=document.getElementById('worldCanvas');
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:!mobile,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 renderer.setSize(innerWidth,innerHeight,false);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
 renderer.shadowMap.enabled=!mobile;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();
 scene.background=new THREE.Color('#56624c');scene.fog=new THREE.FogExp2('#20291c',.0062);
 const camera=new THREE.PerspectiveCamera(49,innerWidth/innerHeight,.1,520);
 camera.position.set(0,5,12);
 scene.add(new THREE.HemisphereLight('#dfe8cf','#2d3b27',1.35));
 const sun=new THREE.DirectionalLight('#fff0c9',2.3);sun.position.set(-35,45,26);sun.castShadow=!mobile;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
 const fill=new THREE.DirectionalLight('#9dc17e',.65);fill.position.set(25,14,-45);scene.add(fill);
 const world=new THREE.Group();scene.add(world);
 sceneState.renderer=renderer;sceneState.scene=scene;sceneState.camera=camera;sceneState.world=world;sceneState.curve=curve;
 buildTerrain();buildRoadRibbon();addRoadside();buildCheckpointSigns();createFallbackCar();
 loadModels().catch(err=>console.warn('LifeFlow model loading failed; using fallback scene',err));
 addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();},{passive:true});
}
function placeCar(progress,dt){
 const t=.025+clamp(progress)*.94,{p,tangent,right}=frameAt(t);
 const car=sceneState.car;if(!car)return;
 car.position.copy(p);car.position.y=.07+Math.sin(clock.elapsedTime*4.2)*.025;
 const direction=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),tangent);
 car.quaternion.slerp(direction,1-Math.exp(-dt*5));
 const bend=curve.getTangentAt(clamp(t+.01)).sub(curve.getTangentAt(clamp(t-.01))).x;
 car.rotation.z=damp(car.rotation.z,-bend*.35,4,dt);
 const camera=sceneState.camera;
 const behind=p.clone().addScaledVector(tangent,-8.8);
 const cameraPosition=behind.addScaledVector(right,-3.8).add(new THREE.Vector3(0,5.4,0));
 const look=p.clone().addScaledVector(tangent,10).add(new THREE.Vector3(0,1.0,0));
 const targetFov=mobile?56:48;
 camera.fov=damp(camera.fov,targetFov,2,dt);camera.updateProjectionMatrix();
 camera.position.lerp(cameraPosition,1-Math.exp(-dt*3.1));
 camera.lookAt(look);
}
function scrollProgress(){
 const y=window.scrollY,home=document.getElementById('home'),story=document.getElementById('story');
 const homeH=home.offsetHeight,storyTop=story.offsetTop,storyRange=Math.max(1,story.offsetHeight-innerHeight);
 let drive;
 if(y<storyTop)drive=.02+.10*clamp(y/Math.max(1,homeH));
 else drive=.12+.86*clamp((y-storyTop)/storyRange);
 scrollTarget=clamp(drive,.02,.98);
 const storyRect=story.getBoundingClientRect();
 const p=clamp(-storyRect.top/Math.max(1,story.offsetHeight-innerHeight));
 const beat=Math.min(8,Math.floor(p*9));setBeat(beat);
 const total=document.documentElement.scrollHeight-innerHeight;
 document.getElementById('siteProgress').style.width=(total>0?100*y/total:0)+'%';
 const rail=document.getElementById('featureTrack'),section=document.querySelector('.feature-rail');
 const railRect=section.getBoundingClientRect(),railRange=Math.max(1,section.offsetHeight-innerHeight);
 const rp=clamp(-railRect.top/railRange);
 if(!mobile&&!reduced)rail.style.transform='translate3d('+(-rp*300)+'vw,0,0)';
 const f=Math.min(3,Math.floor(rp*4));setFeature(f);
}
function setBeat(index){
 if(index===lastBeat)return;lastBeat=index;
 document.querySelectorAll('.story-beat').forEach((el,i)=>el.classList.toggle('active',i===index));
 document.getElementById('chapterNo').textContent=String(index+1).padStart(2,'0');
 document.getElementById('storyLabel').textContent=beats[index];
 document.getElementById('storyNumber').textContent=String(index+1).padStart(2,'0')+' / 09';
 document.getElementById('storyTrack').style.width=((index+1)/9*100)+'%';
}
function setFeature(index){
 if(index===lastFeature)return;lastFeature=index;
 document.querySelectorAll('.feature-panel').forEach((el,i)=>el.classList.toggle('current',i===index));
}
function setupScroll(){
 const handler=()=>{if(rafQueued)return;rafQueued=true;requestAnimationFrame(()=>{rafQueued=false;scrollProgress();});};
 addEventListener('scroll',handler,{passive:true});scrollProgress();
 if(window.gsap&&window.ScrollTrigger&&!mobile&&!reduced){
  gsap.registerPlugin(ScrollTrigger);
  gsap.from('.home-copy .eyebrow',{y:20,autoAlpha:0,duration:.8,delay:.2});
  gsap.from('.home h1',{y:50,autoAlpha:0,duration:1.1,delay:.25,ease:'power4.out'});
  gsap.from('.home-copy>p,.start-link',{y:20,autoAlpha:0,duration:.7,stagger:.1,delay:.65});
  gsap.from('.feature-intro-copy',{y:60,autoAlpha:0,ease:'power2.out',scrollTrigger:{trigger:'.feature-intro',start:'top 80%',end:'top 40%',scrub:1}});
  gsap.from('.timeline-list article',{y:38,autoAlpha:0,stagger:.13,ease:'power2.out',scrollTrigger:{trigger:'.timeline-list',start:'top 82%',end:'bottom 60%',scrub:1}});
  gsap.from('.closing h2',{y:50,autoAlpha:0,ease:'power2.out',scrollTrigger:{trigger:'.closing',start:'top 78%',end:'center center',scrub:1}});
  ScrollTrigger.create({trigger:'.feature-rail',start:'top top',end:'bottom bottom',onUpdate:scrollProgress});
 }
}
function setupPointer(){
 if(reduced||mobile)return;
 addEventListener('pointermove',e=>{pointer.tx=(e.clientX/innerWidth-.5)*2;pointer.ty=(e.clientY/innerHeight-.5)*2;},{passive:true});
}
function animate(){
 const dt=Math.min(clock.getDelta(),.04),time=clock.elapsedTime;
 scrollLive=damp(scrollLive,scrollTarget,2.8,dt);
 if(window.scrollY<20&&!reduced)scrollLive=clamp(scrollLive+dt*.003,.02,.98);
 if(sceneState.car){
  placeCar(scrollLive,dt);
  sceneState.world.rotation.y=damp(sceneState.world.rotation.y,pointer.tx*.009,1.5,dt);
  sceneState.renderer.render(sceneState.scene,sceneState.camera);
 }
 requestAnimationFrame(animate);
}
function setupAnchors(){
 document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
  const target=document.querySelector(a.getAttribute('href'));if(!target)return;
  e.preventDefault();target.scrollIntoView({behavior:reduced?'auto':'smooth'});
 }));
}
function boot(){
 initWorld();setupScroll();setupPointer();setupAnchors();
 if(reduced){document.querySelectorAll('.story-beat').forEach(x=>x.classList.add('active'));document.querySelector('.story').style.height='auto';}
 animate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
