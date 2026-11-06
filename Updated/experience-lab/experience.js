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
 asphaltTexture.repeat.set(2,1);asphaltTexture.colorSpace=THREE.SRGBColorSpace;
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
  const t=.012+i*.00985,{p,tangent}=frameAt(t);
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
 for(let i=0;i<pos.count;i++)pos.setY(i,-.045);
 geo.computeVertexNormals();
 const grassCanvas=document.createElement('canvas');grassCanvas.width=512;grassCanvas.height=512;
 const grassCtx=grassCanvas.getContext('2d');grassCtx.fillStyle='#263628';grassCtx.fillRect(0,0,512,512);
 for(let i=0;i<26000;i++){
  const shade=35+Math.random()*45,alpha=.06+Math.random()*.16;
  grassCtx.fillStyle='rgba('+Math.floor(shade-5)+','+Math.floor(shade+8)+','+Math.floor(shade-3)+','+alpha+')';
  const x=Math.random()*512,y=Math.random()*512;grassCtx.fillRect(x,y,Math.random()*2+1,Math.random()*3+1);
 }
 const grassTexture=new THREE.CanvasTexture(grassCanvas);grassTexture.wrapS=THREE.RepeatWrapping;grassTexture.wrapT=THREE.RepeatWrapping;grassTexture.repeat.set(16,22);grassTexture.colorSpace=THREE.SRGBColorSpace;
 const grass=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:grassTexture,color:'#f1f3ec',roughness:1,metalness:0}));
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
  const rail=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPoints),1000,.075,10,false),railMat);
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
 for(let i=0;i<96;i++){
  const t=.028+i*.00845,{p,right}=frameAt(t),side=i%2?1:-1;
  const height=4.2+rnd(i+3)*4.6,width=1.45+rnd(i+51)*1.05;
  const pos=p.clone().addScaledVector(right,side*(8.4+rnd(i+90)*7.2));
  const tree=new THREE.Group();tree.position.set(pos.x,-.045,pos.z);tree.rotation.y=rnd(i+17)*Math.PI*2;
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.29,height*.54,9),bark);
  trunk.position.y=height*.27;trunk.castShadow=true;tree.add(trunk);
  for(let b=0;b<3;b++){
   const branch=new THREE.Mesh(new THREE.CylinderGeometry(.045,.09,height*.22,7),bark);
   branch.position.set((rnd(i+b+11)-.5)*.8,height*(.42+b*.12),0);
   branch.rotation.z=(rnd(i+b+21)-.5)*.9;tree.add(branch);
  }
  const clusterCount=4+Math.floor(rnd(i+7)*3);
  for(let c=0;c<clusterCount;c++){
   const radius=width*(.43+rnd(i*4+c+6)*.34);
   const canopy=new THREE.Mesh(new THREE.IcosahedronGeometry(radius,2),leaves[(i+c)%leaves.length]);
   canopy.position.set((rnd(i+c+31)-.5)*width*.9,height*(.62+rnd(i+c+43)*.23),(rnd(i+c+63)-.5)*width*.8);
   canopy.scale.set(1,.78+rnd(i+c+77)*.5,.9+rnd(i+c+99)*.35);
   canopy.rotation.set(rnd(i+c+101)*.35,rnd(i+c+111)*Math.PI,rnd(i+c+121)*.35);
   canopy.castShadow=false;tree.add(canopy);
  }
  sceneState.world.add(tree);
  if(i%2===0){
   const bush=new THREE.Group();bush.position.copy(pos).addScaledVector(right,side*.9);bush.position.y=-.035;
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
 const paint=new THREE.MeshPhysicalMaterial({color:'#1766a5',metalness:.68,roughness:.2,clearcoat:1,clearcoatRoughness:.09,envMapIntensity:1.65});
 const carbon=new THREE.MeshStandardMaterial({color:'#090d10',metalness:.42,roughness:.48});
 const carbonWeave=new THREE.MeshStandardMaterial({color:'#171d20',metalness:.55,roughness:.38});
 const glass=new THREE.MeshPhysicalMaterial({color:'#0b1b24',metalness:.25,roughness:.095,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:1.8});
 const alloy=new THREE.MeshStandardMaterial({color:'#c5d0d2',metalness:.96,roughness:.19});
 const darkAlloy=new THREE.MeshStandardMaterial({color:'#303a3e',metalness:.84,roughness:.28});
 const rubber=new THREE.MeshStandardMaterial({color:'#101315',metalness:.02,roughness:.88});
 const rotorMat=new THREE.MeshStandardMaterial({color:'#8d9698',metalness:.88,roughness:.31});
 const red=new THREE.MeshStandardMaterial({color:'#c52b25',emissive:'#580b08',emissiveIntensity:.28,roughness:.3});
 const led=new THREE.MeshStandardMaterial({color:'#f5f8ed',emissive:'#dcebd4',emissiveIntensity:1.4,roughness:.12});
 const amber=new THREE.MeshStandardMaterial({color:'#e7a94d',emissive:'#7d4510',emissiveIntensity:.35});
 const addBox=(parent,geo,mat,pos,rot)=>{
  const m=new THREE.Mesh(geo,mat);m.position.set(pos[0],pos[1],pos[2]);
  if(rot)m.rotation.set(rot[0],rot[1],rot[2]);
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
 };
 const addCurve=(parent,points,radius,mat)=>{
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1],p[2])));
  const m=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(24,points.length*8),radius,8,false),mat);
  parent.add(m);return m;
 };
 const addPanel=(parent,shape,depth,mat,zOffset)=>{
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:4,bevelSize:.025,bevelThickness:.025,curveSegments:20});
  const a=g.attributes.position;
  for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i);a.setXYZ(i,z-depth/2+zOffset,a.getY(i),x);}
  g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
 };
 // GT's long, low mid-engine body: nose at -Z, rear deck at +Z.
 const shell=new THREE.Shape();
 shell.moveTo(-2.20,.37);shell.lineTo(-2.20,.52);
 shell.quadraticCurveTo(-2.12,.68,-1.86,.72);
 shell.quadraticCurveTo(-1.76,.74,-1.67,.73);
 shell.quadraticCurveTo(-1.43,.99,-1.18,.74);
 shell.quadraticCurveTo(-.98,.75,-.79,.79);
 shell.quadraticCurveTo(-.52,.84,-.30,.84);
 shell.lineTo(.48,.82);shell.quadraticCurveTo(.83,.79,1.05,.74);
 shell.quadraticCurveTo(1.19,.74,1.27,.74);
 shell.quadraticCurveTo(1.43,1.00,1.68,.73);
 shell.quadraticCurveTo(1.91,.70,2.12,.62);
 shell.quadraticCurveTo(2.20,.58,2.20,.43);
 shell.lineTo(2.05,.35);shell.lineTo(1.72,.35);
 shell.quadraticCurveTo(1.68,.76,1.43,.77);shell.quadraticCurveTo(1.17,.76,1.12,.35);
 shell.lineTo(-1.10,.35);
 shell.quadraticCurveTo(-1.16,.76,-1.43,.77);shell.quadraticCurveTo(-1.69,.76,-1.73,.35);
 shell.lineTo(-2.05,.35);shell.closePath();
 addPanel(car,shell,2.06,paint,0);
 // Carbon-fibre floor and pronounced front splitter.
 addBox(car,new THREE.BoxGeometry(1.83,.13,3.88),carbon,[0,.34,0]);
 addBox(car,new THREE.BoxGeometry(2.12,.055,.52),carbon,[0,.315,-2.03]);
 addBox(car,new THREE.BoxGeometry(1.72,.045,.22),carbonWeave,[0,.30,-2.23]);
 // Windscreen and teardrop canopy, tapered towards the rear.
 const canopy=new THREE.Shape();
 canopy.moveTo(-.77,.75);canopy.lineTo(-.53,1.04);
 canopy.quadraticCurveTo(-.40,1.15,-.19,1.16);
 canopy.lineTo(.26,1.16);canopy.quadraticCurveTo(.48,1.12,.61,.94);
 canopy.lineTo(.77,.76);canopy.lineTo(.64,.78);
 canopy.quadraticCurveTo(.44,1.04,.25,1.045);
 canopy.lineTo(-.16,1.045);canopy.quadraticCurveTo(-.37,1.04,-.53,.78);canopy.closePath();
 addPanel(car,canopy,1.78,glass,-.12);
 // Black roof panel and windscreen surround.
 addBox(car,new THREE.BoxGeometry(.92,.035,.70),carbon,[0,1.155,.12]);
 addCurve(car,[[-.73,.78,-1.0],[-.54,1.06,-.83],[-.35,1.16,-.52],[0,1.17,-.48],[.35,1.16,-.52],[.54,1.06,-.83],[.73,.78,-1.0]],.027,carbonWeave);
 // The signature flying buttresses frame two deep channels around the rear engine cover.
 for(const side of [-1,1]){
  // Sculpted flying buttress runs from the roof shoulders to each rear haunch.
  addCurve(car,[[side*.47,1.02,.28],[side*.60,.99,.62],[side*.78,.88,1.02],[side*.91,.77,1.55],[side*.95,.67,2.04]],.105,paint);
  addCurve(car,[[side*.52,.98,.32],[side*.66,.94,.70],[side*.83,.82,1.12],[side*.96,.70,1.88]],.018,carbonWeave);
  const tunnel=new THREE.Mesh(new THREE.BoxGeometry(.31,.20,1.52),carbon);
  tunnel.position.set(side*.69,.62,1.27);tunnel.rotation.x=-.08;car.add(tunnel);
  const tunnelLip=new THREE.Mesh(new THREE.BoxGeometry(.38,.035,1.58),carbonWeave);
  tunnelLip.position.set(side*.69,.73,1.27);car.add(tunnelLip);
 }
 // Rear engine window, slatted cooling deck and central spine.
 const engineGlass=new THREE.Mesh(new THREE.BoxGeometry(.70,.025,1.15),glass);
 engineGlass.position.set(0,.81,1.30);engineGlass.rotation.x=-.025;car.add(engineGlass);
 for(let i=0;i<9;i++){
  const slat=addBox(car,new THREE.BoxGeometry(.64,.018,.035),carbonWeave,[0,.84,.82+i*.115],[.04,0,0]);
 }
 addBox(car,new THREE.BoxGeometry(.12,.035,1.25),paint,[0,.87,1.28]);
 // Front clamshell creases and low wide cooling apertures.
 addCurve(car,[[-.91,.68,-1.92],[-.76,.74,-1.66],[-.56,.78,-1.30],[-.38,.80,-.96]],.012,carbonWeave);
 addCurve(car,[[.91,.68,-1.92],[.76,.74,-1.66],[.56,.78,-1.30],[.38,.80,-.96]],.012,carbonWeave);
 addBox(car,new THREE.BoxGeometry(1.50,.22,.055),carbon,[0,.49,-2.19]);
 addBox(car,new THREE.BoxGeometry(.55,.14,.04),carbonWeave,[0,.49,-2.225]);
 // Two large outer intake mouths and central grille mesh.
 for(const side of [-1,1]){
  const intake=new THREE.Mesh(new THREE.BoxGeometry(.48,.19,.07),carbon);
  intake.position.set(side*.68,.49,-2.18);car.add(intake);
  for(let i=0;i<4;i++)addBox(car,new THREE.BoxGeometry(.018,.145,.018),darkAlloy,[side*.68+(i-1.5)*.09,.49,-2.225]);
  // Signature slim, hooked LED headlamp graphic.
  addCurve(car,[[side*.78,.67,-2.14],[side*.64,.70,-2.18],[side*.51,.68,-2.18],[side*.47,.61,-2.18],[side*.43,.55,-2.17]],.025,led);
  addBox(car,new THREE.BoxGeometry(.12,.035,.03),amber,[side*.86,.63,-2.12]);
  // Front wheel arch eyebrow and sculpted shoulder highlight.
  addCurve(car,[[side*.99,.49,-1.46],[side*1.02,.77,-1.18],[side*.99,.83,-.92],[side*.98,.77,-.68],[side*.99,.48,-.47]],.026,paint);
  // Deep side air intake behind the door, with a curved carbon inlet.
  const sideIntake=new THREE.Mesh(new THREE.BoxGeometry(.075,.27,.72),carbon);
  sideIntake.position.set(side*.99,.67,.73);sideIntake.rotation.x=-.18;car.add(sideIntake);
  addCurve(car,[[side*1.015,.80,.34],[side*1.035,.79,.62],[side*1.025,.70,.98],[side*.99,.56,1.13]],.035,paint);
  addCurve(car,[[side*1.018,.55,.36],[side*1.03,.52,.67],[side*1.0,.56,1.03]],.018,carbonWeave);
  // Door cutline and mirror on a short aerodynamic stalk.
  addCurve(car,[[side*1.005,.73,-.54],[side*1.015,.70,-.12],[side*1.015,.66,.28],[side*.99,.59,.45]],.009,carbonWeave);
  addBox(car,new THREE.BoxGeometry(.13,.08,.23),paint,[side*1.08,.83,-.69],[0,side*.12,side*.08]);
  addBox(car,new THREE.BoxGeometry(.10,.04,.16),glass,[side*1.09,.84,-.69]);
  // Lower side sill and aerodynamic floor edge.
  addBox(car,new THREE.BoxGeometry(.10,.10,2.45),carbon,[side*.94,.39,.04]);
 }
 // Wide rear haunches, rear fascia, diffuser and central dual exhaust outlets.
 addBox(car,new THREE.BoxGeometry(1.72,.16,.12),carbon,[0,.48,2.19]);
 addBox(car,new THREE.BoxGeometry(1.92,.12,.35),carbon,[0,.35,2.12]);
 for(const x of [-.37,.37]){
  const exhaust=new THREE.Mesh(new THREE.CylinderGeometry(.085,.095,.13,24),alloy);
  exhaust.rotation.x=Math.PI/2;exhaust.position.set(x,.73,2.16);car.add(exhaust);
  const inner=new THREE.Mesh(new THREE.CylinderGeometry(.057,.064,.135,20),carbon);
  inner.rotation.x=Math.PI/2;inner.position.set(x,.73,2.17);car.add(inner);
  addBox(car,new THREE.BoxGeometry(.27,.11,.035),red,[x*2,.62,2.205]);
 }
 for(let i=0;i<7;i++)addBox(car,new THREE.BoxGeometry(.045,.16,.42),carbonWeave,[-.72+i*.24,.32,1.99],[.10,0,0]);
 // Four large forged multi-spoke wheels, ventilated discs and red calipers.
 const wheels=[];
 for(const x of [-1.015,1.015])for(const z of [-1.43,1.43]){
  const wheel=new THREE.Group();wheel.position.set(x,.405,z);
  const tire=new THREE.Mesh(new THREE.CylinderGeometry(.385,.385,.255,48,1),rubber);
  tire.rotation.z=Math.PI/2;tire.castShadow=true;tire.receiveShadow=true;wheel.add(tire);
  const sidewall=new THREE.Mesh(new THREE.CylinderGeometry(.315,.315,.26,48),rubber);
  sidewall.rotation.z=Math.PI/2;wheel.add(sidewall);
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(.275,.275,.265,40),alloy);
  rim.rotation.z=Math.PI/2;wheel.add(rim);
  const inner=new THREE.Mesh(new THREE.CylinderGeometry(.222,.222,.27,40),darkAlloy);
  inner.rotation.z=Math.PI/2;wheel.add(inner);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.285,24),alloy);
  hub.rotation.z=Math.PI/2;wheel.add(hub);
  for(let spoke=0;spoke<10;spoke++){
   const angle=spoke*Math.PI/5;
   const bar=new THREE.Mesh(new THREE.BoxGeometry(.022,.37,.035),alloy);
   bar.position.y=Math.cos(angle)*.145;bar.position.z=Math.sin(angle)*.145;
   bar.rotation.x=angle;wheel.add(bar);
  }
  const rotor=new THREE.Mesh(new THREE.CylinderGeometry(.205,.205,.025,40),rotorMat);
  rotor.rotation.z=Math.PI/2;rotor.position.x=-Math.sign(x)*.105;wheel.add(rotor);
  const caliper=new THREE.Mesh(new THREE.BoxGeometry(.075,.20,.10),red);
  caliper.position.set(-Math.sign(x)*.12,.13,.17);wheel.add(caliper);
  wheels.push(wheel);car.add(wheel);
 }
 // Carbon rear wing on twin swan-neck supports, a recognisable GT silhouette.
 for(const x of [-.60,.60]){
  addBox(car,new THREE.BoxGeometry(.075,.48,.075),carbon,[x,.91,1.82],[.12,0,0]);
 }
 const wing=addBox(car,new THREE.BoxGeometry(1.72,.075,.34),carbon,[0,1.14,1.83],[.04,0,0]);
 wing.scale.z=1;
 addCurve(car,[[-.90,1.13,1.80],[-.70,1.19,1.72],[0,1.21,1.68],[.70,1.19,1.72],[.90,1.13,1.80]],.018,carbonWeave);
 // Twin white over-the-top stripes reference the 2017 GT's race-bred livery.
 const stripe=new THREE.MeshStandardMaterial({color:'#e9ece4',metalness:.22,roughness:.34});
 for(const side of [-1,1]){
  addCurve(car,[[side*.13,.73,-2.13],[side*.13,.77,-1.82],[side*.13,.81,-1.40],[side*.13,.84,-.98],[side*.13,1.17,-.57],[side*.13,1.18,.18],[side*.13,.87,.82],[side*.13,.85,1.48]],.032,stripe);
 }
 // Subtle blue paint highlights, lower carbon splitter and GT-style central nose badge.
 addBox(car,new THREE.BoxGeometry(.11,.06,.025),alloy,[0,.69,-2.205]);
 car.userData.wheels=wheels;car.userData.previousPosition=new THREE.Vector3();
 car.scale.set(1.16,1,1.12);
 sceneState.car=car;sceneState.carFallback=car;sceneState.world.add(car);
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
 scene.background=null;scene.fog=new THREE.FogExp2('#26342a',.0054);
 const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,620);
 camera.position.set(0,5,12);
 scene.add(new THREE.HemisphereLight('#e4eddf','#27382d',1.75));
 const sun=new THREE.DirectionalLight('#fff2d7',2.7);sun.position.set(-35,55,30);
 sun.castShadow=!mobile;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-34;sun.shadow.camera.right=34;sun.shadow.camera.top=34;sun.shadow.camera.bottom=-34;sun.shadow.camera.near=.5;sun.shadow.camera.far=150;sun.shadow.bias=-.00022;sun.shadow.normalBias=.045;
 scene.add(sun);
 const fill=new THREE.DirectionalLight('#a6c7a8',.85);fill.position.set(28,20,-65);scene.add(fill);
 const rim=new THREE.DirectionalLight('#e6edcf',.4);rim.position.set(0,18,55);scene.add(rim);
 const skyGeo=new THREE.SphereGeometry(540,40,28);
 const skyPos=skyGeo.attributes.position,skyColors=[];
 const skyTop=new THREE.Color('#52685d'),skyHorizon=new THREE.Color('#a9ad93'),skyLow=new THREE.Color('#24382c');
 for(let i=0;i<skyPos.count;i++){
  const h=skyPos.getY(i)/540,color=new THREE.Color();
  if(h>=.04)color.lerpColors(skyHorizon,skyTop,clamp((h-.04)/.78));
  else color.lerpColors(skyLow,skyHorizon,clamp((h+1)/1.04));
  skyColors.push(color.r,color.g,color.b);
 }
 skyGeo.setAttribute('color',new THREE.Float32BufferAttribute(skyColors,3));
 const sky=new THREE.Mesh(skyGeo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,depthWrite:false,fog:false}));
 sky.frustumCulled=false;scene.add(sky);
 const pmrem=new THREE.PMREMGenerator(renderer);
 const env=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environment=env;pmrem.dispose();
 const world=new THREE.Group();scene.add(world);
 sceneState.renderer=renderer;sceneState.scene=scene;sceneState.camera=camera;sceneState.world=world;sceneState.curve=curve;
 buildTerrain();buildRoadRibbon();addRoadside();createForest();createFallbackCar();
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
 const behind=p.clone().addScaledVector(tangent,-9.2);
 const cameraPosition=behind.addScaledVector(right,-3.9).add(new THREE.Vector3(0,5.1,0));
 const look=p.clone().addScaledVector(tangent,9.5).add(new THREE.Vector3(0,1.05,0));
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
    if(['input','textarea','select','button','a'].includes(tag)||target?.isContentEditable||target?.closest?.('[role="button"]'))return;
    const keys={PageDown:innerHeight*.82,PageUp:-innerHeight*.82,ArrowDown:90,ArrowUp:-90,' ':innerHeight*.72};
    if(keys[event.key]!==undefined){event.preventDefault();window.scrollBy({top:keys[event.key],behavior:'smooth'});}
   },true);
  }catch(error){console.warn('LifeFlow parent scroll bridge unavailable for embedded sign-in.',error);}
 };
 iframe.addEventListener('load',attach);
 try{if(iframe.contentDocument?.readyState==='complete')attach();}catch(_){}
}
async function boot(){
 try{await initWorld();animate();}
 catch(error){console.warn('LifeFlow 3D scene unavailable; keeping the experience usable.',error);}
 setupScroll();setupPointer();setupReveals();setupAnchors();setupIframeScroll();
 if(reduced){document.querySelector('.story').style.height='auto';}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
