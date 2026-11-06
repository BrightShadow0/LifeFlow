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
 const blue=new THREE.MeshPhysicalMaterial({color:'#0872bf',metalness:.48,roughness:.2,clearcoat:1,clearcoatRoughness:.07,envMapIntensity:1.8});
 const blueDark=new THREE.MeshPhysicalMaterial({color:'#064c85',metalness:.52,roughness:.25,clearcoat:1});
 const carbon=new THREE.MeshStandardMaterial({color:'#090e13',metalness:.45,roughness:.4});
 const carbonLite=new THREE.MeshStandardMaterial({color:'#1b2932',metalness:.5,roughness:.34});
 const glass=new THREE.MeshPhysicalMaterial({color:'#071923',metalness:.18,roughness:.09,clearcoat:1,clearcoatRoughness:.04,transparent:true,opacity:.96});
 const white=new THREE.MeshStandardMaterial({color:'#f1f3ef',metalness:.12,roughness:.28});
 const alloy=new THREE.MeshStandardMaterial({color:'#c8d2d8',metalness:.9,roughness:.2});
 const darkMetal=new THREE.MeshStandardMaterial({color:'#39434a',metalness:.78,roughness:.3});
 const rubber=new THREE.MeshStandardMaterial({color:'#090d10',roughness:.9});
 const rotor=new THREE.MeshStandardMaterial({color:'#78848a',metalness:.85,roughness:.35});
 const lampRed=new THREE.MeshStandardMaterial({color:'#84212a',metalness:.18,roughness:.4});
 const lampWhite=new THREE.MeshStandardMaterial({color:'#eaf7ff',emissive:'#a9dfff',emissiveIntensity:.3,roughness:.16});
 const box=(parent,size,pos,mat,rot)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);
  m.position.set(...pos);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
 };
 const mesh=(parent,geo,mat,pos,rot)=>{
  const m=new THREE.Mesh(geo,mat);m.position.set(...pos);if(rot)m.rotation.set(...rot);
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
 };
 const tube=(parent,pts,r,mat)=>{
  const path=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));
  const m=new THREE.Mesh(new THREE.TubeGeometry(path,Math.max(32,pts.length*12),r,10,false),mat);
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
 };

 // Smooth body profile: z, half-width, centre crown height, shoulder height.
 const body=[
  [-2.27,.52,.47,.39],[-2.18,.67,.53,.43],[-2.02,.77,.59,.47],
  [-1.82,.87,.66,.51],[-1.58,.96,.73,.55],[-1.40,1.015,.78,.57],
  [-1.18,.96,.74,.55],[-.94,.86,.70,.52],[-.72,.77,.72,.56],
  [-.48,.70,.88,.66],[-.22,.67,1.01,.72],[.08,.67,1.055,.75],
  [.36,.69,1.02,.74],[.62,.75,.89,.68],[.90,.86,.78,.63],
  [1.18,.97,.74,.61],[1.48,1.025,.72,.60],[1.72,1.01,.70,.59],
  [1.96,.91,.64,.53],[2.15,.76,.55,.47],[2.25,.55,.45,.40]
 ];
 const sample=(rows,z)=>{
  if(z<=rows[0][0])return rows[0].slice(1);
  if(z>=rows[rows.length-1][0])return rows[rows.length-1].slice(1);
  let i=0;while(i<rows.length-2&&rows[i+1][0]<z)i++;
  const a=rows[i],b=rows[i+1],t=(z-a[0])/(b[0]-a[0]),s=t*t*(3-2*t);
  return a.slice(1).map((v,k)=>v+(b[k+1]-v)*s);
 };
 const yAt=(rows,z,x)=>{
  const s=sample(rows,z),u=clamp(Math.abs(x)/Math.max(.001,s[0]),0,1);
  return s[2]+(s[1]-s[2])*Math.pow(Math.max(0,1-u*u),.58);
 };
 const topSkin=(rows,mat,nz=160,nx=56,offset=.012)=>{
  const z0=rows[0][0],z1=rows[rows.length-1][0],v=[],uv=[],ix=[];
  for(let i=0;i<=nz;i++){
   const z=z0+(z1-z0)*i/nz,s=sample(rows,z);
   for(let j=0;j<=nx;j++){
    const u=-1+2*j/nx,x=u*s[0],y=s[2]+(s[1]-s[2])*Math.pow(Math.max(0,1-u*u),.58)+offset;
    v.push(x,y,z);uv.push(j/nx,i/nz);
    if(i<nz&&j<nx){const a=i*(nx+1)+j,b=a+nx+1;ix.push(a,b,a+1,a+1,b,b+1);}
   }
  }
  const g=new THREE.BufferGeometry();g.setIndex(ix);g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;car.add(m);return m;
 };
 topSkin(body,blue,190,64);

 // Side panels taper with the body and contain actual wheel-arch openings.
 for(const side of [-1,1]){
  const v=[],ix=[],nz=240,ny=28,baseY=.325;
  for(let i=0;i<=nz;i++){
   const z=-2.25+4.5*i/nz,s=sample(body,z);
   for(let j=0;j<=ny;j++){
    const f=j/ny,y=baseY+(s[2]-baseY)*f;
    v.push(side*(s[0]+.012),y,z);
    if(i<nz&&j<ny){
     const mz=-2.25+4.5*(i+.5)/nz,my=baseY+(s[2]-baseY)*(j+.5)/ny;
     let cut=false;
     for(const c of [-1.43,1.43]){const d=mz-c;if(Math.abs(d)<.455&&my<.405+Math.sqrt(.455*.455-d*d))cut=true;}
     if(!cut){const a=i*(ny+1)+j,b=a+ny+1;if(side>0)ix.push(a,a+1,b,a+1,b+1,b);else ix.push(a,b,a+1,a+1,b,b+1);}
    }
   }
  }
  const g=new THREE.BufferGeometry();g.setIndex(ix);g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();
  const panel=new THREE.Mesh(g,new THREE.MeshPhysicalMaterial({color:'#0868ad',metalness:.48,roughness:.22,clearcoat:1,side:THREE.DoubleSide}));
  panel.castShadow=true;panel.receiveShadow=true;car.add(panel);
  for(const c of [-1.43,1.43]){
   const pts=[];for(let k=0;k<=32;k++){const a=Math.PI*k/32,z=c-.455*Math.cos(a),y=.405+.455*Math.sin(a);pts.push([side*(sample(body,z)[0]+.024),y,z]);}
   tube(car,pts,.018,blue);
  }
  // Side air inlet, flying rear shoulder and long carbon sill.
  const sideAt=z=>side*(sample(body,z)[0]+.018);
  box(car,[.035,.19,.61],[sideAt(.57),.625,.57],carbon,[.06,0,side*.03]);
  tube(car,[[sideAt(.23),.76,.23],[sideAt(.45),.77,.45],[sideAt(.78),.69,.78],[sideAt(.96),.54,.96]],.034,blue);
  tube(car,[[sideAt(.30),.55,.30],[sideAt(.60),.54,.60],[sideAt(.86),.57,.86]],.012,carbonLite);
  for(let n=0;n<3;n++)box(car,[.018,.016,.11],[sideAt(.42+n*.15),.62,.42+n*.15],darkMetal,[0,0,side*.08]);
  tube(car,[[sideAt(-.80),.37,-.80],[sideAt(-.20),.37,-.20],[sideAt(.50),.37,.50],[sideAt(1.18),.37,1.18]],.052,carbon);
 }

 // Teardrop glass canopy and the characteristic GT flying buttresses.
 const canopy=[
  [-.99,.24,.76,.71],[-.86,.39,.91,.80],[-.66,.49,1.045,.94],
  [-.40,.535,1.14,1.055],[-.10,.55,1.17,1.075],
  [.22,.55,1.15,1.055],[.48,.52,1.07,.97],
  [.70,.46,.94,.84],[.88,.34,.78,.71],[.96,.17,.70,.68]
 ];
 topSkin(canopy,glass,100,42,.019);
 for(const side of [-1,1]){
  tube(car,[[side*.39,.87,-.89],[side*.46,1.00,-.68],[side*.52,1.12,-.39],[side*.54,1.17,-.08]],.025,blueDark);
  tube(car,[[side*.54,1.17,-.08],[side*.53,1.15,.30],[side*.49,1.045,.58],[side*.42,.87,.84]],.022,carbonLite);
  tube(car,[[side*.43,1.00,.28],[side*.57,.98,.58],[side*.77,.86,1.02],[side*.91,.72,1.52],[side*.91,.64,2.03]],.105,blue);
  tube(car,[[side*.48,.985,.34],[side*.63,.93,.72],[side*.82,.79,1.16],[side*.93,.66,1.92]],.021,carbon);
  // Slim tinted side glass, angled to follow the canopy.
  mesh(car,new THREE.PlaneGeometry(.34,.36),glass,[side*.72,.84,.02],[0,side*Math.PI/2,side*-.12]);
 }
 // Rear engine window, dark cooling channels and centre spine.
 box(car,[.56,.026,.88],[0,.79,1.31],carbon);
 box(car,[.37,.018,.68],[0,.811,1.29],glass);
 for(let i=0;i<9;i++)box(car,[.47,.018,.025],[0,.836,.91+i*.087],carbonLite);
 box(car,[.10,.035,1.02],[0,.87,1.34],blueDark);
 for(const side of [-1,1]){
  box(car,[.18,.035,1.14],[side*.68,.75,1.34],carbon);
  tube(car,[[side*.56,.81,.76],[side*.72,.78,1.12],[side*.85,.70,1.58],[side*.89,.64,2.06]],.024,blueDark);
 }

 // Low nose, broad central grille, sculpted intakes and slim headlamps.
 box(car,[1.12,.22,.075],[0,.475,-2.205],carbon);
 box(car,[.62,.10,.035],[0,.48,-2.249],carbonLite);
 for(const side of [-1,1]){
  box(car,[.36,.17,.07],[side*.67,.49,-2.18],carbon);
  for(let n=0;n<4;n++)box(car,[.018,.125,.018],[side*(.55+n*.08),.49,-2.222],darkMetal);
  const pod=mesh(car,new THREE.SphereGeometry(1,24,16),carbon,[side*.69,.685,-1.955]);pod.scale.set(.205,.075,.31);
  tube(car,[[side*.84,.70,-2.08],[side*.76,.735,-1.99],[side*.62,.735,-1.91],[side*.53,.69,-1.82]],.022,lampWhite);
  tube(car,[[side*.52,.69,-1.83],[side*.59,.66,-1.77]],.012,alloy);
  box(car,[.16,.018,.36],[side*.43,.735,-1.43],carbon,[.04,0,side*.07]);
 }
 box(car,[1.94,.055,.42],[0,.31,-2.15],carbon);
 box(car,[1.76,.035,.24],[0,.285,-2.30],carbonLite);
 tube(car,[[-.86,.34,-2.22],[-.55,.33,-2.33],[0,.32,-2.36],[.55,.33,-2.33],[.86,.34,-2.22]],.025,carbon);

 // Twin flat white centre stripes follow the actual body and canopy surfaces.
 for(const centre of [-.135,.135]){
  const v=[],ix=[],steps=190,half=.042;
  for(let i=0;i<=steps;i++){
   const z=-2.245+4.43*i/steps;
   for(const e of [-1,1]){
    const x=centre+e*half;
    const rows=(z>=canopy[0][0]&&z<=canopy[canopy.length-1][0]&&Math.abs(x)<sample(canopy,z)[0])?canopy:body;
    v.push(x,yAt(rows,z,x)+.026,z);
   }
   if(i<steps){const a=i*2;ix.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const g=new THREE.BufferGeometry();g.setIndex(ix);g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();
  car.add(new THREE.Mesh(g,white));
 }

 // Four low-profile tyres and clean multi-spoke forged wheels.
 const wheels=[];
 for(const x of [-.99,.99])for(const z of [-1.43,1.43]){
  const w=new THREE.Group();w.position.set(x,.405,z);
  mesh(w,new THREE.CylinderGeometry(.385,.385,.275,64),rubber,[0,0,0],[0,0,Math.PI/2]);
  mesh(w,new THREE.CylinderGeometry(.326,.326,.282,64),rubber,[0,0,0],[0,0,Math.PI/2]);
  mesh(w,new THREE.CylinderGeometry(.235,.235,.024,48),rotor,[-Math.sign(x)*.105,0,0],[0,0,Math.PI/2]);
  mesh(w,new THREE.CylinderGeometry(.264,.264,.04,48),alloy,[Math.sign(x)*.145,0,0],[0,0,Math.PI/2]);
  mesh(w,new THREE.CylinderGeometry(.064,.064,.045,24),darkMetal,[Math.sign(x)*.17,0,0],[0,0,Math.PI/2]);
  for(let n=0;n<10;n++){
   const a=n*Math.PI/5;
   box(w,[.025,.245,.035],[Math.sign(x)*.174,Math.cos(a)*.12,Math.sin(a)*.12],alloy,[a,0,0]);
  }
  mesh(w,new THREE.CylinderGeometry(.045,.045,.05,24),alloy,[Math.sign(x)*.19,0,0],[0,0,Math.PI/2]);
  wheels.push(w);car.add(w);
 }

 // Rear diffuser, dual exhaust outlets, static ring tail lamps and track wing.
 box(car,[1.74,.14,.32],[0,.35,2.13],carbon);
 box(car,[1.96,.06,.16],[0,.315,2.23],carbonLite);
 for(let n=0;n<7;n++)box(car,[.045,.16,.32],[-.72+n*.24,.30,2.02],carbon,[.10,0,0]);
 for(const x of [-.37,.37]){
  mesh(car,new THREE.CylinderGeometry(.09,.09,.14,24),alloy,[x,.69,2.18],[Math.PI/2,0,0]);
  mesh(car,new THREE.CylinderGeometry(.059,.059,.145,20),carbon,[x,.69,2.19],[Math.PI/2,0,0]);
 }
 for(const x of [-.58,.58]){
  mesh(car,new THREE.TorusGeometry(.145,.034,12,40),carbon,[x,.62,2.19]);
  mesh(car,new THREE.TorusGeometry(.112,.021,10,40),lampRed,[x,.62,2.205]);
 }
 for(const x of [-.61,.61])box(car,[.055,.28,.055],[x,.92,1.82],carbon,[.08,0,0]);
 box(car,[1.58,.055,.24],[0,1.105,1.84],carbon,[.035,0,0]);
 box(car,[1.68,.035,.075],[0,1.13,1.84],carbonLite);

 // No animated red trail, light streak, guide line or path effect is used.
 car.userData.wheels=wheels;
 car.userData.previousPosition=new THREE.Vector3();
 car.scale.set(1.04,1,1.04);
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
 // Opening camera tour: begin ahead of the nose, then arc around to the rear.
 // Once the opening reveal completes, the camera follows behind the car.
 const tour=clamp(clock.elapsedTime/6.2);
 const easedTour=tour*tour*(3-2*tour);
 const frontPosition=p.clone().addScaledVector(tangent,8.4).addScaledVector(right,3.2).add(new THREE.Vector3(0,3.35,0));
 const rearPosition=p.clone().addScaledVector(tangent,-9.2).addScaledVector(right,-3.9).add(new THREE.Vector3(0,5.1,0));
 const cameraPosition=frontPosition.lerp(rearPosition,easedTour);
 const look=p.clone().add(new THREE.Vector3(0,1.0,0));
 const targetFov=mobile?55:43;
 camera.fov=damp(camera.fov,targetFov,2,dt);camera.updateProjectionMatrix();
 camera.position.lerp(cameraPosition,1-Math.exp(-dt*2.4));
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
 // The opening scene stays parked until the visitor scrolls.
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
 // Do not let browser scroll restoration reopen the experience halfway down.
 if('scrollRestoration' in history)history.scrollRestoration='manual';
 document.documentElement.style.scrollBehavior='auto';
 window.scrollTo(0,0);
 requestAnimationFrame(()=>window.scrollTo(0,0));
 try{await initWorld();animate();}
 catch(error){console.warn('LifeFlow 3D scene unavailable; keeping the experience usable.',error);}
 setupScroll();setupPointer();setupReveals();setupAnchors();setupIframeScroll();
 if(reduced){document.querySelector('.story').style.height='auto';}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
