import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile=matchMedia('(max-width:760px)').matches;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const damp=(a,b,k,dt)=>THREE.MathUtils.damp(a,b,k,dt);
const clock=new THREE.Clock();
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
 const segments=1500,half=3.75,vertices=[],indices=[],uv=[];
 const textureCanvas=document.createElement('canvas');
 textureCanvas.width=512;textureCanvas.height=512;
 const ctx=textureCanvas.getContext('2d');
 ctx.fillStyle='#353a39';ctx.fillRect(0,0,512,512);
 for(let i=0;i<42000;i++){
  const shade=30+Math.random()*45,alpha=.08+Math.random()*.24;
  ctx.fillStyle='rgba('+Math.floor(shade)+','+Math.floor(shade+2)+','+Math.floor(shade+3)+','+alpha+')';
  const x=Math.random()*512,y=Math.random()*512,s=Math.random()*2.2+.3;
  ctx.fillRect(x,y,s,s*.55);
 }
 for(let i=0;i<34;i++){
  ctx.strokeStyle='rgba(8,12,12,'+(.025+Math.random()*.06)+')';
  ctx.lineWidth=Math.random()*2+.3;ctx.beginPath();
  const x=Math.random()*512,y=Math.random()*512;
  ctx.moveTo(x,y);ctx.lineTo(x+(Math.random()-.5)*110,y+(Math.random()-.5)*35);ctx.stroke();
 }
 const asphaltTexture=new THREE.CanvasTexture(textureCanvas);
 asphaltTexture.wrapS=THREE.RepeatWrapping;asphaltTexture.wrapT=THREE.RepeatWrapping;
 asphaltTexture.repeat.set(2,18);asphaltTexture.colorSpace=THREE.SRGBColorSpace;
 asphaltTexture.anisotropy=Math.min(8,sceneState.renderer.capabilities.getMaxAnisotropy());
 for(let i=0;i<=segments;i++){
  const t=i/segments,{p,right}=frameAt(t);
  for(let j=0;j<2;j++){
   const offset=j===0?-half:half;
   vertices.push(p.x+right.x*offset,p.y+.025,p.z+right.z*offset);
   uv.push(j,t*64);
  }
  if(i<segments){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
 }
 const geo=new THREE.BufferGeometry();
 geo.setIndex(indices);
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.computeVertexNormals();
 const asphalt=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:asphaltTexture,color:'#f0f0e9',roughness:.97,metalness:0,side:THREE.DoubleSide}));
 asphalt.receiveShadow=true;sceneState.world.add(asphalt);
 const makeRibbon=(inner,outer,y,material)=>{
  const v=[],ix=[];
  for(let i=0;i<=segments;i++){
   const t=i/segments,{p,right}=frameAt(t);
   for(const d of [inner,outer])v.push(p.x+right.x*d,p.y+y,p.z+right.z*d);
   if(i<segments){const a=i*2;ix.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const g=new THREE.BufferGeometry();g.setIndex(ix);g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();
  const m=new THREE.Mesh(g,material);m.receiveShadow=true;sceneState.world.add(m);
 };
 const gravelMat=new THREE.MeshStandardMaterial({color:'#514d40',roughness:1});
 makeRibbon(3.76,4.55,.012,gravelMat);makeRibbon(-4.55,-3.76,.012,gravelMat);
 const lineMat=new THREE.MeshStandardMaterial({color:'#e8e8d9',roughness:.65,metalness:.05});
 const edgeMat=new THREE.MeshStandardMaterial({color:'#b8c0a9',roughness:.65});
 for(const side of [-1,1]){
  const points=[];for(let i=0;i<=700;i++){const {p,right}=frameAt(i/700);points.push(p.clone().addScaledVector(right,side*3.48).add(new THREE.Vector3(0,.075,0)));}
  sceneState.world.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),1400,.045,8,false),edgeMat));
 }
 for(let i=0;i<116;i++){
  const t=.012+i*.00845,{p,tangent}=frameAt(t);
  const dash=new THREE.Mesh(new THREE.BoxGeometry(.12,.022,2.15),lineMat);
  dash.position.copy(p);dash.position.y=.075;
  dash.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),tangent);
  sceneState.world.add(dash);
 }
 const rumbleMat=new THREE.MeshStandardMaterial({color:'#c7c8b6',roughness:.78});
 for(let i=0;i<230;i++){
  const t=.012+i*.00425,{p,right,tangent}=frameAt(t);
  for(const side of [-1,1]){
   const strip=new THREE.Mesh(new THREE.BoxGeometry(.13,.018,.72),i%2?rumbleMat:gravelMat);
   strip.position.copy(p).addScaledVector(right,side*3.3);strip.position.y=.072;
   strip.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),tangent);sceneState.world.add(strip);
  }
 }
}
function buildTerrain(){
 const geo=new THREE.PlaneGeometry(620,720,110,130);geo.rotateX(-Math.PI/2);
 const pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getZ(i);
  const falloff=clamp((Math.abs(x)-9)/20);
  const hills=(Math.sin(x*.021+z*.008)*2.2+Math.cos(z*.017-x*.013)*1.35+Math.sin((x+z)*.035)*.55);
  pos.setY(i,-.38+hills*falloff);
 }
 geo.computeVertexNormals();
 const grass=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#263628',roughness:1,metalness:0}));
 grass.position.set(0,0,-125);grass.receiveShadow=true;sceneState.world.add(grass);
 const hillMats=[
  new THREE.MeshStandardMaterial({color:'#27372a',roughness:1}),
  new THREE.MeshStandardMaterial({color:'#344331',roughness:1}),
  new THREE.MeshStandardMaterial({color:'#1d2a22',roughness:1})
 ];
 for(let i=0;i<24;i++){
  const side=i%2?1:-1,h=12+(i%6)*3.2,r=18+(i%5)*7;
  const hill=new THREE.Mesh(new THREE.IcosahedronGeometry(r,2),hillMats[i%3]);
  hill.scale.y=.36+(i%4)*.09;
  hill.position.set(side*(29+(i%5)*13),h*.2,-18-i*14);
  hill.rotation.y=i*1.71;sceneState.world.add(hill);
 }
}
function addRoadside(){
 const railMat=new THREE.MeshStandardMaterial({color:'#66716a',metalness:.72,roughness:.36});
 const postMat=new THREE.MeshStandardMaterial({color:'#59635c',metalness:.62,roughness:.48});
 const reflectorMat=new THREE.MeshStandardMaterial({color:'#d9e4bf',emissive:'#b7d28a',emissiveIntensity:.32,roughness:.35});
 for(const side of [-1,1]){
  const railPoints=[];
  for(let i=0;i<=520;i++){
   const {p,right}=frameAt(i/520);
   railPoints.push(p.clone().addScaledVector(right,side*4.55).add(new THREE.Vector3(0,.82,0)));
  }
  const rail=new THREE.Mesh(new THREE.CatmullRomCurve3(railPoints).getPoints(1000).length?new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPoints),1000,.075,10,false):new THREE.BoxGeometry(1,1,1),railMat);
  rail.castShadow=true;sceneState.world.add(rail);
  for(let i=0;i<52;i++){
   const t=.025+i*.0182,{p,right,tangent}=frameAt(t);
   const post=new THREE.Mesh(new THREE.BoxGeometry(.10,.8,.10),postMat);
   post.position.copy(p).addScaledVector(right,side*4.55);post.position.y=.40;
   post.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),tangent);post.castShadow=true;sceneState.world.add(post);
   if(i%2===0){
    const reflector=new THREE.Mesh(new THREE.BoxGeometry(.08,.17,.025),reflectorMat);
    reflector.position.copy(post.position).add(new THREE.Vector3(0,.48,0));reflector.quaternion.copy(post.quaternion);sceneState.world.add(reflector);
   }
  }
 }
}
function createForest(){
 const bark=new THREE.MeshStandardMaterial({color:'#514337',roughness:1});
 const leaves=[
  new THREE.MeshStandardMaterial({color:'#263d2c',roughness:1}),
  new THREE.MeshStandardMaterial({color:'#38553a',roughness:1}),
  new THREE.MeshStandardMaterial({color:'#486448',roughness:1}),
  new THREE.MeshStandardMaterial({color:'#1f3328',roughness:1})
 ];
 const shrubMats=[leaves[0],leaves[1],leaves[3]];
 const rnd=(seed)=>{const v=Math.sin(seed*127.1+311.7)*43758.5453;return v-Math.floor(v);};
 for(let i=0;i<112;i++){
  const t=.028+i*.00845,{p,right}=frameAt(t),side=i%2?1:-1;
  const height=4.2+rnd(i+3)*4.6,width=1.45+rnd(i+51)*1.05;
  const pos=p.clone().addScaledVector(right,side*(8.4+rnd(i+90)*7.2));
  const tree=new THREE.Group();tree.position.set(pos.x,-.3,pos.z);tree.rotation.y=rnd(i+17)*Math.PI*2;
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.29,height*.54,9),bark);
  trunk.position.y=height*.27;trunk.castShadow=true;tree.add(trunk);
  for(let b=0;b<3;b++){
   const branch=new THREE.Mesh(new THREE.CylinderGeometry(.045,.09,height*.22,7),bark);
   branch.position.set((rnd(i+b+11)-.5)*.8,height*(.42+b*.12),0);
   branch.rotation.z=(rnd(i+b+21)-.5)*.9;tree.add(branch);
  }
  const clusterCount=5+Math.floor(rnd(i+7)*4);
  for(let c=0;c<clusterCount;c++){
   const radius=width*(.43+rnd(i*4+c+6)*.34);
   const canopy=new THREE.Mesh(new THREE.IcosahedronGeometry(radius,2),leaves[(i+c)%leaves.length]);
   canopy.position.set((rnd(i+c+31)-.5)*width*.9,height*(.62+rnd(i+c+43)*.23),(rnd(i+c+63)-.5)*width*.8);
   canopy.scale.set(1,.78+rnd(i+c+77)*.5,.9+rnd(i+c+99)*.35);
   canopy.rotation.set(rnd(i+c+101)*.35,rnd(i+c+111)*Math.PI,rnd(i+c+121)*.35);
   canopy.castShadow=true;tree.add(canopy);
  }
  sceneState.world.add(tree);
  if(i%2===0){
   const bush=new THREE.Group();bush.position.copy(pos).addScaledVector(right,side*.9);bush.position.y=-.28;
   for(let j=0;j<3;j++){
    const leaf=new THREE.Mesh(new THREE.IcosahedronGeometry(.48+rnd(i+j+151)*.27,1),shrubMats[(i+j)%shrubMats.length]);
    leaf.position.set((rnd(i+j+171)-.5)*.8,.32+rnd(i+j+181)*.28,(rnd(i+j+191)-.5)*.7);bush.add(leaf);
   }
   sceneState.world.add(bush);
  }
 }
}

function createFallbackCar(){
 const car=new THREE.Group();
 const paint=new THREE.MeshPhysicalMaterial({color:'#315d43',metalness:.72,roughness:.23,clearcoat:1,clearcoatRoughness:.13,envMapIntensity:1.2});
 const trim=new THREE.MeshStandardMaterial({color:'#111816',metalness:.35,roughness:.42});
 const glass=new THREE.MeshPhysicalMaterial({color:'#172a2c',metalness:.35,roughness:.12,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.45});
 const chrome=new THREE.MeshStandardMaterial({color:'#a7b2ae',metalness:.92,roughness:.2});
 const rubber=new THREE.MeshStandardMaterial({color:'#111314',metalness:.02,roughness:.82});
 const red=new THREE.MeshStandardMaterial({color:'#a82220',emissive:'#6b0908',emissiveIntensity:.22,roughness:.3});
 const headlamp=new THREE.MeshStandardMaterial({color:'#eff5e6',emissive:'#d5e8bd',emissiveIntensity:1.1,roughness:.16});
 const profile=new THREE.Shape();
 profile.moveTo(-1.76,.43);profile.lineTo(-1.76,.59);
 profile.quadraticCurveTo(-1.64,.70,-1.39,.72);profile.lineTo(-.84,.79);
 profile.lineTo(-.48,1.16);profile.quadraticCurveTo(-.34,1.27,-.10,1.28);
 profile.lineTo(.43,1.28);profile.quadraticCurveTo(.68,1.24,.85,1.00);
 profile.lineTo(1.06,.77);profile.lineTo(1.58,.71);
 profile.quadraticCurveTo(1.76,.66,1.76,.50);profile.lineTo(1.63,.40);
 profile.lineTo(1.34,.40);profile.quadraticCurveTo(1.28,.76,.96,.77);
 profile.quadraticCurveTo(.63,.76,.57,.40);profile.lineTo(-.57,.40);
 profile.quadraticCurveTo(-.63,.76,-.96,.77);profile.quadraticCurveTo(-1.28,.76,-1.34,.40);
 profile.lineTo(-1.76,.43);
 const bodyGeo=new THREE.ExtrudeGeometry(profile,{depth:1.78,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:.035,bevelThickness:.04,curveSegments:18});
 const bp=bodyGeo.attributes.position;
 for(let i=0;i<bp.count;i++){const x=bp.getX(i),z=bp.getZ(i);bp.setXYZ(i,z-.89,bp.getY(i),x);}
 bodyGeo.computeVertexNormals();
 const body=new THREE.Mesh(bodyGeo,paint);body.castShadow=true;body.receiveShadow=true;car.add(body);
 const cabinShape=new THREE.Shape();
 cabinShape.moveTo(-.78,.81);cabinShape.lineTo(-.45,1.16);
 cabinShape.quadraticCurveTo(-.32,1.23,-.10,1.235);cabinShape.lineTo(.40,1.235);
 cabinShape.quadraticCurveTo(.60,1.20,.75,.91);cabinShape.lineTo(.78,.82);cabinShape.closePath();
 const cabinGeo=new THREE.ExtrudeGeometry(cabinShape,{depth:1.48,bevelEnabled:true,bevelSegments:3,bevelSize:.025,bevelThickness:.025,curveSegments:14});
 const cp=cabinGeo.attributes.position;
 for(let i=0;i<cp.count;i++){const x=cp.getX(i),z=cp.getZ(i);cp.setXYZ(i,z-.74,cp.getY(i),x);}
 cabinGeo.computeVertexNormals();
 const cabin=new THREE.Mesh(cabinGeo,glass);cabin.castShadow=true;car.add(cabin);
 const roof=new THREE.Mesh(new THREE.BoxGeometry(1.38,.055,.72),paint);roof.position.set(0,1.245,-.05);roof.castShadow=true;car.add(roof);
 const under=new THREE.Mesh(new THREE.BoxGeometry(1.48,.18,2.65),trim);under.position.set(0,.36,0);car.add(under);
 // Side glazing and slim pillars make the cabin read as a real passenger car.
 for(const side of [-1,1]){
  const windowPane=new THREE.Mesh(new THREE.PlaneGeometry(.82,.30),glass);
  windowPane.position.set(side*.895,.99,-.05);windowPane.rotation.y=side*Math.PI/2;car.add(windowPane);
  const pillar=new THREE.Mesh(new THREE.BoxGeometry(.055,.43,.06),trim);
  pillar.position.set(side*.89,1.03,.42);pillar.rotation.x=-.16;car.add(pillar);
  const mirror=new THREE.Mesh(new THREE.BoxGeometry(.18,.11,.19),paint);
  mirror.position.set(side*.98,.91,-.62);mirror.castShadow=true;car.add(mirror);
  const sill=new THREE.Mesh(new THREE.BoxGeometry(.07,.08,1.85),trim);sill.position.set(side*.87,.43,.04);car.add(sill);
 }
 // Front grille, lower intake, chrome trim and lighting.
 const grille=new THREE.Mesh(new THREE.BoxGeometry(.72,.17,.045),trim);grille.position.set(0,.49,-1.79);car.add(grille);
 for(let i=0;i<5;i++){const slat=new THREE.Mesh(new THREE.BoxGeometry(.64,.012,.018),chrome);slat.position.set(0,.435+i*.027,-1.818);car.add(slat);}
 const bumper=new THREE.Mesh(new THREE.BoxGeometry(1.46,.12,.10),trim);bumper.position.set(0,.39,-1.79);car.add(bumper);
 for(const x of [-.55,.55]){
  const lamp=new THREE.Mesh(new THREE.BoxGeometry(.31,.12,.045),headlamp);lamp.position.set(x,.63,-1.77);car.add(lamp);
  const rearLamp=new THREE.Mesh(new THREE.BoxGeometry(.30,.11,.04),red);rearLamp.position.set(x,.63,1.77);car.add(rearLamp);
 }
 const rearTrim=new THREE.Mesh(new THREE.BoxGeometry(.8,.045,.025),chrome);rearTrim.position.set(0,.51,1.79);car.add(rearTrim);
 // Four detailed wheels with rubber, brake discs, hubs and multi-spoke alloys.
 const wheels=[];
 for(const x of [-.91,.91])for(const z of [-1.0,1.0]){
  const wheel=new THREE.Group();wheel.position.set(x,.37,z);
  const tire=new THREE.Mesh(new THREE.CylinderGeometry(.365,.365,.235,40,1),rubber);
  tire.rotation.z=Math.PI/2;tire.castShadow=true;tire.receiveShadow=true;wheel.add(tire);
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(.245,.245,.245,32,1),chrome);rim.rotation.z=Math.PI/2;wheel.add(rim);
  const inner=new THREE.Mesh(new THREE.CylinderGeometry(.185,.185,.252,32),trim);inner.rotation.z=Math.PI/2;wheel.add(inner);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.078,.078,.26,24),chrome);hub.rotation.z=Math.PI/2;wheel.add(hub);
  for(let s=0;s<10;s++){
   const spoke=new THREE.Mesh(new THREE.BoxGeometry(.025,.34,.035),chrome);
   spoke.position.y=Math.cos(s*Math.PI/5)*.13;spoke.position.z=Math.sin(s*Math.PI/5)*.13;
   spoke.rotation.x=s*Math.PI/5;wheel.add(spoke);
  }
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.018,32),new THREE.MeshStandardMaterial({color:'#68706d',metalness:.82,roughness:.32}));
  disc.rotation.z=Math.PI/2;disc.position.x=-Math.sign(x)*.105;wheel.add(disc);
  wheels.push(wheel);car.add(wheel);
 }
 // Subtle roof antenna, exhausts and rear diffuser.
 const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.008,.014,.22,8),trim);antenna.position.set(.3,1.34,.5);antenna.rotation.z=-.18;car.add(antenna);
 for(const x of [-.48,.48]){const exhaust=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.11,16),chrome);exhaust.rotation.x=Math.PI/2;exhaust.position.set(x,.37,1.78);car.add(exhaust);}
 car.userData.wheels=wheels;car.userData.previousPosition=new THREE.Vector3();
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
async function initWorld(){
 const canvas=document.getElementById('worldCanvas');
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:!mobile,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));
 renderer.setSize(innerWidth,innerHeight,false);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 renderer.shadowMap.enabled=!mobile;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();
 scene.background=new THREE.Color('#3c493e');scene.fog=new THREE.FogExp2('#26342a',.0054);
 const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,620);
 camera.position.set(0,5,12);
 scene.add(new THREE.HemisphereLight('#e4eddf','#27382d',1.75));
 const sun=new THREE.DirectionalLight('#fff2d7',2.7);sun.position.set(-35,55,30);
 sun.castShadow=!mobile;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-34;sun.shadow.camera.right=34;sun.shadow.camera.top=34;sun.shadow.camera.bottom=-34;sun.shadow.camera.near=.5;sun.shadow.camera.far=150;sun.shadow.bias=-.00022;sun.shadow.normalBias=.045;
 scene.add(sun);
 const fill=new THREE.DirectionalLight('#a6c7a8',.85);fill.position.set(28,20,-65);scene.add(fill);
 const rim=new THREE.DirectionalLight('#e6edcf',.4);rim.position.set(0,18,55);scene.add(rim);
 const pmrem=new THREE.PMREMGenerator(renderer);
 const env=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environment=env;pmrem.dispose();
 const world=new THREE.Group();scene.add(world);
 sceneState.renderer=renderer;sceneState.scene=scene;sceneState.camera=camera;sceneState.world=world;sceneState.curve=curve;
 buildTerrain();buildRoadRibbon();addRoadside();createForest();buildCheckpointSigns();createFallbackCar();
 addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();},{passive:true});
}
function placeCar(progress,dt){
 const t=.025+clamp(progress)*.94,{p,tangent,right}=frameAt(t);
 const car=sceneState.car;if(!car)return;
 const previous=car.position.clone();
 car.position.copy(p);car.position.y=.028;
 const distance=previous.distanceTo(p);
 if(distance<3){
  (car.userData.wheels||[]).forEach(w=>{w.rotation.x-=distance/.365;});
 }
 const direction=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),tangent);
 car.quaternion.slerp(direction,1-Math.exp(-dt*6));
 const bend=curve.getTangentAt(clamp(t+.01)).sub(curve.getTangentAt(clamp(t-.01))).x;
 car.rotation.z=damp(car.rotation.z,-bend*.16,4,dt);
 const camera=sceneState.camera;
 const behind=p.clone().addScaledVector(tangent,-11.8);
 const cameraPosition=behind.addScaledVector(right,-5.3).add(new THREE.Vector3(0,6.4,0));
 const look=p.clone().addScaledVector(tangent,13).add(new THREE.Vector3(0,1.1,0));
 const targetFov=mobile?58:43;
 camera.fov=damp(camera.fov,targetFov,2,dt);camera.updateProjectionMatrix();
 camera.position.lerp(cameraPosition,1-Math.exp(-dt*3.1));
 camera.lookAt(look);
}
function scrollProgress(){
 const y=window.scrollY,story=document.getElementById('story');
 const pageRange=Math.max(1,document.documentElement.scrollHeight-innerHeight);
 scrollTarget=.02+.96*clamp(y/pageRange);
 const storyRect=story.getBoundingClientRect();
 const p=clamp(-storyRect.top/Math.max(1,story.offsetHeight-innerHeight));
 const beat=Math.min(8,Math.floor(p*9));setBeat(beat);
 const total=document.documentElement.scrollHeight-innerHeight;
 document.getElementById('siteProgress').style.width=(total>0?100*y/total:0)+'%';
 const rail=document.getElementById('featureTrack'),section=document.querySelector('.feature-rail');
 const railRect=section.getBoundingClientRect(),railRange=Math.max(1,section.offsetHeight-innerHeight);
 const rp=clamp(-railRect.top/railRange);
 const f=Math.min(4,Math.floor(rp*5));setFeature(f);
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
}
function setupPointer(){
 if(reduced||mobile)return;
 addEventListener('pointermove',e=>{pointer.tx=(e.clientX/innerWidth-.5)*2;pointer.ty=(e.clientY/innerHeight-.5)*2;},{passive:true});
}
function animate(){
 const dt=Math.min(clock.getDelta(),.04),time=clock.elapsedTime;
 scrollLive=damp(scrollLive,scrollTarget,2.8,dt);
 if(window.scrollY<20&&!reduced)scrollLive=clamp(scrollLive+dt*.0015,.015,.98);
 if(sceneState.car){
  placeCar(scrollLive,dt);
  sceneState.world.rotation.y=damp(sceneState.world.rotation.y,pointer.tx*.009,1.5,dt);
  sceneState.renderer.render(sceneState.scene,sceneState.camera);
 }
 requestAnimationFrame(animate);
}
function setupReveals(){
 document.querySelectorAll('.latest-card,.timeline-list article,.feature-copy').forEach(el=>el.classList.add('revealed'));
}
function setupIframeScroll(){
 const iframe=document.querySelector('.access-frame iframe');if(!iframe)return;
 const attach=()=>{
  try{
   const child=iframe.contentWindow,doc=child.document;
   if(doc.__lifeFlowWheelBridge)return;doc.__lifeFlowWheelBridge=true;
   doc.addEventListener('wheel',event=>{
    if(!event.deltaY)return;
    event.preventDefault();event.stopPropagation();
    window.scrollBy({top:event.deltaY,behavior:'auto'});
   },{capture:true,passive:false});
   let touchY=0;
   doc.addEventListener('touchstart',event=>{if(event.touches.length)touchY=event.touches[0].clientY;},{passive:true,capture:true});
   doc.addEventListener('touchmove',event=>{
    if(!event.touches.length)return;
    const next=event.touches[0].clientY,delta=touchY-next;touchY=next;
    if(delta){event.preventDefault();window.scrollBy({top:delta,behavior:'auto'});}
   },{passive:false,capture:true});
   doc.addEventListener('keydown',event=>{
    const target=event.target,tag=(target&&target.tagName||'').toLowerCase();
    if(['input','textarea','select'].includes(tag)||target?.isContentEditable)return;
    const keys={PageDown:innerHeight*.82,PageUp:-innerHeight*.82,ArrowDown:90,ArrowUp:-90,' ':innerHeight*.72};
    if(keys[event.key]!==undefined){event.preventDefault();window.scrollBy({top:keys[event.key],behavior:'smooth'});}
   },true);
  }catch(error){console.warn('LifeFlow parent scroll bridge unavailable for embedded sign-in.',error);}
 };
 iframe.addEventListener('load',attach);
 try{if(iframe.contentDocument?.readyState==='complete')attach();}catch(_){}
}
async function boot(){
 await initWorld();setupScroll();setupPointer();setupReveals();setupAnchors();setupIframeScroll();
 if(reduced){document.querySelectorAll('.story-beat').forEach(x=>x.classList.add('active'));document.querySelector('.story').style.height='auto';}
 animate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
