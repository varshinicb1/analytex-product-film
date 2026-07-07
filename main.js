import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ══════════════════════════════════════════════════════
   RENDERER
══════════════════════════════════════════════════════ */
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ══════════════════════════════════════════════════════
   SCENE
══════════════════════════════════════════════════════ */
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020508, 0.025);

const bgC = document.createElement('canvas'); bgC.width = 2; bgC.height = 256;
const bgX = bgC.getContext('2d');
const bgG = bgX.createLinearGradient(0,0,0,256);
bgG.addColorStop(0,'#0d1d30'); bgG.addColorStop(.5,'#060d18'); bgG.addColorStop(1,'#020508');
bgX.fillStyle = bgG; bgX.fillRect(0,0,2,256);
scene.background = Object.assign(new THREE.CanvasTexture(bgC),{ colorSpace: THREE.SRGBColorSpace });

/* ══════════════════════════════════════════════════════
   CAMERA
══════════════════════════════════════════════════════ */
const camera = new THREE.PerspectiveCamera(40, innerWidth/innerHeight, 0.05, 100);
function setFov() {
  camera.aspect = innerWidth / innerHeight;
  const ar = camera.aspect;
  if      (ar < 0.6)  camera.fov = 72;
  else if (ar < 0.8)  camera.fov = 62;
  else if (ar < 1.1)  camera.fov = 52;
  else if (ar < 1.45) camera.fov = 44;
  else                camera.fov = 40;
  camera.updateProjectionMatrix();
}
setFov();

/* ══════════════════════════════════════════════════════
   ENVIRONMENT (IBL)
══════════════════════════════════════════════════════ */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.015).texture;
scene.environmentIntensity = 0.55;

/* ══════════════════════════════════════════════════════
   LIGHTING — tight 3-point, no wash
══════════════════════════════════════════════════════ */
const keyL = new THREE.DirectionalLight(0xfff8f0, 2.4);
keyL.position.set(6, 10, 5);
keyL.castShadow = true;
keyL.shadow.mapSize.set(2048,2048);
keyL.shadow.bias = -0.0002;
keyL.shadow.camera.left=-8;keyL.shadow.camera.right=8;
keyL.shadow.camera.top=12;keyL.shadow.camera.bottom=-12;
scene.add(keyL);

const rimL = new THREE.DirectionalLight(0x80c0ff, 1.2);
rimL.position.set(-6, 4, -5); scene.add(rimL);

const fillL = new THREE.DirectionalLight(0xc0d8ff, 0.28);
fillL.position.set(2, -3, 6); scene.add(fillL);

scene.add(new THREE.AmbientLight(0x0a1320, 1.0));

const accentL = new THREE.PointLight(0x00e5ff, 0, 8, 2.0);
accentL.position.set(0, 3.2, 1.8); scene.add(accentL);

const underL = new THREE.PointLight(0x1a3a6a, 0.35, 14, 2.0);
underL.position.set(0,-3, 0); scene.add(underL);

/* ══════════════════════════════════════════════════════
   FLOOR
══════════════════════════════════════════════════════ */
const fC = document.createElement('canvas'); fC.width = fC.height = 512;
const fX = fC.getContext('2d');
fX.fillStyle = '#030810'; fX.fillRect(0,0,512,512);
fX.strokeStyle = 'rgba(0,180,255,0.04)'; fX.lineWidth=1;
for(let i=0;i<=512;i+=32){fX.beginPath();fX.moveTo(i,0);fX.lineTo(i,512);fX.stroke();fX.beginPath();fX.moveTo(0,i);fX.lineTo(512,i);fX.stroke();}
fX.strokeStyle='rgba(0,200,255,0.12)';fX.lineWidth=1.5;
for(let i=0;i<=512;i+=128){fX.beginPath();fX.moveTo(i,0);fX.lineTo(i,512);fX.stroke();fX.beginPath();fX.moveTo(0,i);fX.lineTo(512,i);fX.stroke();}
const fGrad=fX.createRadialGradient(256,256,0,256,256,200);
fGrad.addColorStop(0,'rgba(0,180,255,0.07)');fGrad.addColorStop(1,'rgba(0,0,0,0)');
fX.fillStyle=fGrad;fX.fillRect(0,0,512,512);
const floorTex=new THREE.CanvasTexture(fC);
floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping;floorTex.repeat.set(18,18);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(120,120),
  new THREE.MeshStandardMaterial({map:floorTex,roughness:.06,metalness:.97,envMapIntensity:1.1})
);
floor.rotation.x=-Math.PI/2; floor.position.y=-3.4; floor.receiveShadow=true;
scene.add(floor);

/* ══════════════════════════════════════════════════════
   PARTICLES
══════════════════════════════════════════════════════ */
const PN=100;
const pPos=new Float32Array(PN*3),pSpd=[];
for(let i=0;i<PN;i++){
  pPos[i*3]=(Math.random()-.5)*22; pPos[i*3+1]=Math.random()*9-2.5; pPos[i*3+2]=(Math.random()-.5)*22;
  pSpd.push({vy:.035+Math.random()*.07,ph:Math.random()*6.28,vx:(Math.random()-.5)*.012,vz:(Math.random()-.5)*.012});
}
const pGeo=new THREE.BufferGeometry();
pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
const pDC=document.createElement('canvas');pDC.width=pDC.height=12;
const pdX=pDC.getContext('2d'),pdG=pdX.createRadialGradient(6,6,0,6,6,6);
pdG.addColorStop(0,'rgba(200,225,255,0.9)');pdG.addColorStop(.4,'rgba(80,160,255,0.4)');pdG.addColorStop(1,'rgba(0,0,0,0)');
pdX.fillStyle=pdG;pdX.fillRect(0,0,12,12);
const pMesh=new THREE.Points(pGeo,new THREE.PointsMaterial({size:.065,map:new THREE.CanvasTexture(pDC),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.45}));
scene.add(pMesh);
function animParticles(){
  const pa=pGeo.attributes.position.array,now=performance.now()*0.0003;
  for(let i=0;i<PN;i++){const s=pSpd[i];pa[i*3]+=Math.sin(now+s.ph)*s.vx;pa[i*3+1]+=s.vy*0.016;pa[i*3+2]+=Math.cos(now+s.ph)*s.vz;if(pa[i*3+1]>7){pa[i*3+1]=-2.5;pa[i*3]=(Math.random()-.5)*22;pa[i*3+2]=(Math.random()-.5)*22;}}
  pGeo.attributes.position.needsUpdate=true;
}

/* ══════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════ */
const V   = (x,y,z) => new THREE.Vector3(x,y,z);
const sm  = t => t<=0?0:t>=1?1:t*t*(3-2*t);
const sm2 = t => t<=0?0:t>=1?1:t*t*t*(t*(t*6-15)+10);
const lp  = (a,b,t) => a+(b-a)*t;
const lerp3 = (a,b,u,o) => o.set(lp(a.x,b.x,u),lp(a.y,b.y,u),lp(a.z,b.z,u));
const clamp01 = v => Math.max(0,Math.min(1,v));

function place(m,x,y,z,rx,ry,rz){
  m.position.set(x,y,z);
  if(rx!==undefined)m.rotation.set(rx,ry||0,rz||0);
  return m;
}
function ctex(w,h){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  return[c,c.getContext('2d'),t];
}
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}

/* ══════════════════════════════════════════════════════
   MATERIALS (no z-fighting — use renderOrder + polygonOffset)
══════════════════════════════════════════════════════ */
const M_body   = new THREE.MeshPhysicalMaterial({color:0x070909,roughness:.88,metalness:.04,clearcoat:.04,clearcoatRoughness:.85});
const M_face   = new THREE.MeshPhysicalMaterial({color:0x0c1015,roughness:.38,metalness:.18,clearcoat:.75,clearcoatRoughness:.2});
const M_bezel  = new THREE.MeshPhysicalMaterial({color:0x080b0e,roughness:.28,metalness:.22,clearcoat:.85});
const M_metal  = new THREE.MeshStandardMaterial({color:0x8090a0,roughness:.26,metalness:1});
const M_darkMt = new THREE.MeshStandardMaterial({color:0x181c22,roughness:.34,metalness:.94});
const M_glass  = new THREE.MeshPhysicalMaterial({color:0x080c14,roughness:.08,metalness:0,transparent:true,opacity:.06,clearcoat:1});
// Gold — the SPE pads and WE ring
const M_gold   = new THREE.MeshPhysicalMaterial({color:0xd4a820,roughness:.18,metalness:1,clearcoat:.3,clearcoatRoughness:.2,envMapIntensity:1.5});
const M_led    = new THREE.MeshStandardMaterial({color:0x22dd88,emissive:0x22dd88,emissiveIntensity:5,toneMapped:false});

// SPE substrate — precise matte black with tiny roughness variation
const M_speBase= new THREE.MeshPhysicalMaterial({color:0x090a0c,roughness:.84,metalness:.04,clearcoat:.12,clearcoatRoughness:.7});
// Nano WE material per chapter (with polygonOffset to prevent z-fighting)
const NANO = {
  HM:   new THREE.MeshPhysicalMaterial({color:0x101418,roughness:.52,metalness:.55,clearcoat:.5,clearcoatRoughness:.25,iridescence:.85,iridescenceIOR:1.9,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:2}),
  FM:   new THREE.MeshPhysicalMaterial({color:0x141008,roughness:.48,metalness:.5, clearcoat:.55,clearcoatRoughness:.22,iridescence:.6, iridescenceIOR:1.7,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:2}),
  PEST: new THREE.MeshPhysicalMaterial({color:0x0a1208,roughness:.58,metalness:.48,clearcoat:.4, clearcoatRoughness:.35,iridescence:.4, iridescenceIOR:1.52,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:2}),
  NPK:  new THREE.MeshPhysicalMaterial({color:0x12100a,roughness:.7, metalness:.38,clearcoat:.2, clearcoatRoughness:.55,iridescence:.25,iridescenceIOR:1.35,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:2}),
  HLTH: new THREE.MeshPhysicalMaterial({color:0x080a1a,roughness:.44,metalness:.58,clearcoat:.6, clearcoatRoughness:.2, iridescence:.95,iridescenceIOR:2.1,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:2}),
};

/* ══════════════════════════════════════════════════════
   SPE CONFIG
══════════════════════════════════════════════════════ */
const SPE_CFG = {
  HM:   {hex:'#e53935',bandHex:0xe53935,label:'Pb · Cd · As · Cu', sub:'Heavy Metals SPE',  sampleColor:0x2dd45a},
  FM:   {hex:'#ff6f00',bandHex:0xff7a00,label:'CH₂O Detection',    sub:'Formalin SPE',       sampleColor:0xffb300},
  PEST: {hex:'#388e3c',bandHex:0x388e3c,label:'AChE · OPC',        sub:'Pesticide SPE',      sampleColor:0x81c784},
  NPK:  {hex:'#8d6e63',bandHex:0x795548,label:'N · P · K',         sub:'Soil Nutrient SPE',  sampleColor:0x6d4c41},
  HLTH: {hex:'#1976d2',bandHex:0x1565c0,label:'DA · UA · Cr',      sub:'Clinical Health SPE',sampleColor:0xf48fb1},
};

/* ══════════════════════════════════════════════════════
   DEVICE SCREEN CANVAS
══════════════════════════════════════════════════════ */
const [,dc,dTex] = ctex(512,768);
function makeDPV(peaks){
  const pts=[];
  for(let i=0;i<=160;i++){const v=-0.9+i/160*1.4;let y=0.04+0.02*(v+0.9);for(const[p,h]of peaks)y+=h*Math.exp(-((v-p)**2)/0.0018);pts.push([v,y]);}
  return pts;
}
const DPV={
  HM:  makeDPV([[-0.75,.78],[-0.50,.96],[-0.14,.52],[0.04,.31]]),
  FM:  makeDPV([[-0.60,.91],[0.12,.42]]),
  PEST:makeDPV([[-0.34,.82],[0.20,.44],[-0.58,.24]]),
  NPK: makeDPV([[-0.46,.68],[0.24,.85],[-0.76,.46]]),
  HLTH:makeDPV([[-0.14,.79],[0.27,.94],[0.56,.55]]),
};
const PEAK_LABS={HM:['Pb','Cd','As','Cu'],FM:['CH₂O',''],PEST:['AChE','Byp',''],NPK:['NO₃⁻','K⁺','PO₄³⁻'],HLTH:['DA','UA','Cr']};
let SCR='idle',dpvFrac=0,dpvGlow=0,activeSPE='HM';

/* ── Electrochemical technique demo helper ── */
function drawTechDemo(c, W, H, dt, t){
  c.fillStyle='#040c18'; c.fillRect(0,0,W,H);
  // Phases: 0-2.5s conn, 2.5-7s CV, 7-11s DPV, 11-14s SWV, 14-16s CA
  const phases=[
    {s:0,   e:2.5,  label:'CONNECTIVITY',   col:'#00e5ff', fn:drawConn},
    {s:2.5, e:7.0,  label:'CYCLIC VOLTAMMETRY',col:'#7c4dff',fn:drawCV},
    {s:7.0, e:11.0, label:'DIFF. PULSE VOLT.', col:'#e53935', fn:drawDPVDemo},
    {s:11.0,e:14.0, label:'SQUARE WAVE VOLT.', col:'#00bcd4', fn:drawSWV},
    {s:14.0,e:16.0, label:'CHRONOAMPEROMETRY', col:'#ff6f00', fn:drawCA},
  ];
  for(const ph of phases){
    if(dt>=ph.s && dt<ph.e){
      const u=(dt-ph.s)/(ph.e-ph.s);
      // Slide-in header
      const alpha=Math.min(1,u*6);
      c.globalAlpha=alpha;
      c.fillStyle=ph.col+'22'; roundRect(c,20,58,W-40,44,12); c.fill();
      c.strokeStyle=ph.col+'88'; c.lineWidth=1.5; roundRect(c,20,58,W-40,44,12); c.stroke();
      c.fillStyle=ph.col; c.font='700 13px Inter,Arial'; c.letterSpacing='2px';
      c.textAlign='center'; c.fillText(ph.label, W/2, 86);
      c.letterSpacing='0px'; c.globalAlpha=1;
      ph.fn(c,W,H,u,t);
      break;
    }
  }
}
function drawConn(c,W,H,u,t){
  const cy=380;
  // Animated radial rings
  for(let i=0;i<4;i++){
    const a=(t*0.8+i*0.25)%1;
    c.strokeStyle=`rgba(0,229,255,${(1-a)*0.7})`;
    c.lineWidth=1.5; c.beginPath(); c.arc(W/2,cy,30+a*120,0,Math.PI*2); c.stroke();
  }
  // WiFi icon
  const arcs=[[0.28,0.44,55],[0.28,0.44,35],[0.28,0.44,18]];
  const wx=W/2-80, wy=cy-20;
  arcs.forEach(([s,e,r],i)=>{
    const pct=Math.min(1,(u*3-i*0.3));
    c.strokeStyle=`rgba(0,229,255,${pct})`; c.lineWidth=3;
    c.beginPath(); c.arc(wx,wy+r,r,(-Math.PI*0.5-e*Math.PI),(-Math.PI*0.5-s*Math.PI),true); c.stroke();
    c.beginPath(); c.arc(wx,wy+r,r,(-Math.PI*0.5+s*Math.PI),(-Math.PI*0.5+e*Math.PI)); c.stroke();
  });
  c.fillStyle=`rgba(0,229,255,${Math.min(1,u*3)})`;
  c.beginPath(); c.arc(wx,wy+arcs[2][2]+3,3.5,0,Math.PI*2); c.fill();
  // BT icon  
  const bx=W/2+60, by=cy-40;
  const bta=Math.min(1,(u*3-0.3));
  c.strokeStyle=`rgba(83,147,255,${bta})`; c.lineWidth=3;
  c.beginPath(); c.moveTo(bx,by+64); c.lineTo(bx,by); c.lineTo(bx+22,by+16); c.lineTo(bx-16,by+40); c.lineTo(bx+22,by+56); c.lineTo(bx,by+64); c.stroke();
  c.fillStyle='#90a0b8'; c.font='500 14px Inter,Arial'; c.textAlign='center'; c.letterSpacing='1px';
  c.fillText('WiFi  ·  Bluetooth 5.0  ·  5G', W/2, cy+90); c.letterSpacing='0px';
  c.fillStyle='#2de8a0'; c.font='600 12px Inter,Arial'; c.letterSpacing='2px';
  c.fillText('CONNECTED', W/2, cy+120); c.letterSpacing='0px';
}
function drawCV(c,W,H,u,t){
  // Accurate Cyclic Voltammetry — duck-shaped loop
  const cx=44,cy=118,cw=W-88,ch=280;
  c.fillStyle='#08121e'; roundRect(c,cx,cy,cw,ch,8); c.fill();
  c.strokeStyle='rgba(60,90,120,.4)'; c.lineWidth=1;
  for(let g=0;g<=5;g++){const yg=cy+ch*g/5;c.beginPath();c.moveTo(cx,yg);c.lineTo(cx+cw,yg);c.stroke();}
  for(let g=0;g<=6;g++){const xg=cx+cw*g/6;c.beginPath();c.moveTo(xg,cy);c.lineTo(xg,cy+ch);c.stroke();}
  // Axis labels
  c.fillStyle='#5a6878'; c.font='500 11px Inter,Arial'; c.textAlign='center';
  c.fillText('Potential E (V vs Ag/AgCl)', W/2, cy+ch+18);
  c.save(); c.translate(cx-28,cy+ch/2); c.rotate(-Math.PI/2);
  c.fillText('Current I (\u03bcA)', 0, 0); c.restore();
  // Voltage axis labels
  ['-0.6','0','0.6'].forEach((v,i)=>{
    c.fillText(v, cx+cw*i/2, cy+ch+14);
  });
  // Forward scan (oxidation): -0.6 to +0.6V
  // Reverse scan (reduction): +0.6 back to -0.6V
  // Epa=+0.15V, Epc=-0.15V (ΔEp=300mV quasi-reversible for clarity)
  const Ex=v=>cx+(v+0.6)/1.2*cw;
  const Ey=i=>cy+ch/2-i/70*ch/2; // center at 0
  const cvFwd=v=>{ // forward scan current
    const base=0.02*v+0.5; // slight rising baseline
    const peak=58*Math.exp(-((v-0.15)**2)/0.012);
    return base+peak;
  };
  const cvRev=v=>{ // reverse scan current (negative reduction peak)
    const base=0.02*v-0.8;
    const peak=-55*Math.exp(-((v+0.15)**2)/0.012);
    return base+peak;
  };
  const totalPts=120;
  const scanPts=Math.floor(u*totalPts*2);
  c.lineWidth=2.8; c.lineJoin='round';
  // Draw forward scan
  const fwdPts=Math.min(scanPts,totalPts);
  if(fwdPts>1){
    const grad=c.createLinearGradient(0,cy,0,cy+ch);
    grad.addColorStop(0,'rgba(124,77,255,0.35)'); grad.addColorStop(1,'rgba(0,0,0,0)');
    c.beginPath();
    for(let i=0;i<fwdPts;i++){
      const v=-0.6+i/totalPts*1.2;
      const x=Ex(v), y=Ey(cvFwd(v));
      i===0?c.moveTo(x,y):c.lineTo(x,y);
    }
    c.strokeStyle='#7c4dff'; c.stroke();
  }
  // Draw reverse scan
  const revPts=Math.max(0,scanPts-totalPts);
  if(revPts>1){
    c.beginPath();
    for(let i=0;i<revPts;i++){
      const v=0.6-i/totalPts*1.2;
      const x=Ex(v), y=Ey(cvRev(v));
      i===0?c.moveTo(x,y):c.lineTo(x,y);
    }
    c.strokeStyle='#536dfe'; c.stroke();
  }
  // Peak labels (when visible)
  if(scanPts>70){
    c.fillStyle='#b39ddb'; c.font='600 11px Inter,Arial';
    c.fillText('Ep,a = +0.15V', Ex(0.15)+2, Ey(cvFwd(0.15))-10);
  }
  if(scanPts>170){
    c.fillStyle='#82b1ff'; c.font='600 11px Inter,Arial';
    c.fillText('Ep,c = -0.15V', Ex(-0.15)+2, Ey(cvRev(-0.15))+14);
  }
  // Legend
  c.fillStyle='#7c4dff'; c.fillRect(cx+4,cy+ch-24,16,3);
  c.fillStyle='#536dfe'; c.fillRect(cx+4,cy+ch-14,16,3);
  c.fillStyle='#8090a8'; c.font='500 10px Inter,Arial';
  c.textAlign='left';
  c.fillText('Fwd scan (anodic)', cx+24, cy+ch-20);
  c.fillText('Rev scan (cathodic)', cx+24, cy+ch-10);
  c.textAlign='center';
  // Scan rate footer
  c.fillStyle='#4a5868'; c.font='500 11px Inter,Arial';
  c.fillText('v = 50 mV/s  ·  25°C  ·  PBS pH 7.4', W/2, cy+ch+34);
}
function drawDPVDemo(c,W,H,u,t){
  // DPV — sharp Gaussian peaks
  const cx=44,cy=118,cw=W-88,ch=260;
  c.fillStyle='#08121e'; roundRect(c,cx,cy,cw,ch,8); c.fill();
  c.strokeStyle='rgba(60,90,120,.4)'; c.lineWidth=1;
  for(let g=0;g<=4;g++){const yg=cy+ch*g/4;c.beginPath();c.moveTo(cx,yg);c.lineTo(cx+cw,yg);c.stroke();}
  // Axis labels
  c.fillStyle='#5a6878'; c.font='500 11px Inter,Arial'; c.textAlign='center';
  c.fillText('Potential E (V)', W/2, cy+ch+18);
  ['-0.9','-0.5','0.0','+0.5'].forEach((v,i)=>c.fillText(v,cx+cw*i/3,cy+ch+14));
  // DPV peaks for Heavy Metals: Pb(-0.75), Cd(-0.50), Cu(-0.14), As(+0.04)
  const peaks=[{v:-0.75,h:0.78,lab:'Pb²⁺',col:'#ef5350'},
               {v:-0.50,h:0.96,lab:'Cd²⁺',col:'#ff7043'},
               {v:-0.14,h:0.52,lab:'As³⁺',col:'#ffa726'},
               {v: 0.04,h:0.31,lab:'Cu²⁺',col:'#26c6da'}];
  const Ex=v=>cx+(v+0.9)/1.4*cw;
  const Ey=y=>cy+ch-y*ch;
  const N=200;
  const pts=[];
  for(let i=0;i<=N;i++){
    const v=-0.9+i/N*1.4;
    let y=0.04;
    for(const pk of peaks) y+=pk.h*Math.exp(-((v-pk.v)**2)/0.002);
    pts.push([v,Math.min(y,1.05)]);
  }
  const drawn=Math.floor(u*N);
  if(drawn>1){
    c.beginPath();
    c.moveTo(Ex(pts[0][0]),cy+ch);
    for(let i=0;i<drawn;i++) c.lineTo(Ex(pts[i][0]),Ey(pts[i][1]));
    c.lineTo(Ex(pts[drawn-1][0]),cy+ch); c.closePath();
    const g=c.createLinearGradient(0,cy,0,cy+ch);
    g.addColorStop(0,'rgba(229,57,53,0.4)'); g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g; c.fill();
    c.beginPath();
    for(let i=0;i<drawn;i++){const[v,y]=pts[i]; i===0?c.moveTo(Ex(v),Ey(y)):c.lineTo(Ex(v),Ey(y));}
    c.strokeStyle='#ef5350'; c.lineWidth=2.5; c.lineJoin='round'; c.stroke();
    // Peak labels
    for(const pk of peaks){
      const xe=Ex(pk.v);
      if(xe<=Ex(pts[drawn-1][0])){
        c.fillStyle=pk.col; c.font='600 11px Inter,Arial';
        c.fillText(pk.lab, xe, Ey(pk.h+0.08)-4);
        c.strokeStyle=pk.col+'66'; c.lineWidth=1; c.setLineDash([3,3]);
        c.beginPath(); c.moveTo(xe,Ey(pk.h)); c.lineTo(xe,cy+ch); c.stroke();
        c.setLineDash([]);
      }
    }
  }
  c.fillStyle='#4a5868'; c.font='500 11px Inter,Arial'; c.textAlign='center';
  c.fillText('Epulse = 50mV  ·  tpulse = 50ms  ·  LSASV method', W/2, cy+ch+34);
}
function drawSWV(c,W,H,u,t){
  // Square Wave Voltammetry — net current peaks (sharper than DPV)
  const cx=44,cy=118,cw=W-88,ch=260;
  c.fillStyle='#08121e'; roundRect(c,cx,cy,cw,ch,8); c.fill();
  c.strokeStyle='rgba(60,90,120,.4)'; c.lineWidth=1;
  for(let g=0;g<=4;g++){const yg=cy+ch*g/4;c.beginPath();c.moveTo(cx,yg);c.lineTo(cx+cw,yg);c.stroke();}
  c.fillStyle='#5a6878'; c.font='500 11px Inter,Arial'; c.textAlign='center';
  c.fillText('Potential E (V)', W/2, cy+ch+18);
  const Ex=v=>cx+(v+0.9)/1.4*cw;
  const Ey=y=>cy+ch-y*ch;
  // Forward, reverse, and net SWV currents
  const swvPeaks=[{v:-0.72,h:0.82},{v:-0.48,h:0.95},{v:-0.12,h:0.54}];
  const N=200;
  const fwd=[],rev=[],net=[];
  for(let i=0;i<=N;i++){
    const v=-0.9+i/N*1.4;
    let yf=0.06,yr=0.03;
    for(const pk of swvPeaks){
      yf+=pk.h*0.72*Math.exp(-((v-pk.v)**2)/0.0015);
      yr+=pk.h*0.58*Math.exp(-((v-pk.v)**2)/0.002);
    }
    fwd.push([v,Math.min(yf,1.05)]);
    rev.push([v,Math.min(yr,0.9)]);
    net.push([v,Math.max(0,yf-yr)]);
  }
  const drawn=Math.floor(u*N);
  if(drawn>1){
    // Forward (faint)
    c.beginPath();
    for(let i=0;i<drawn;i++){const[v,y]=fwd[i];i===0?c.moveTo(Ex(v),Ey(y)):c.lineTo(Ex(v),Ey(y));}
    c.strokeStyle='rgba(0,188,212,0.35)'; c.lineWidth=1.5; c.stroke();
    // Reverse (faint)
    c.beginPath();
    for(let i=0;i<drawn;i++){const[v,y]=rev[i];i===0?c.moveTo(Ex(v),Ey(y)):c.lineTo(Ex(v),Ey(y));}
    c.strokeStyle='rgba(0,150,180,0.25)'; c.lineWidth=1.5; c.stroke();
    // Net (bright)
    c.beginPath();
    c.moveTo(Ex(net[0][0]),cy+ch);
    for(let i=0;i<drawn;i++) c.lineTo(Ex(net[i][0]),Ey(net[i][1]));
    c.lineTo(Ex(net[drawn-1][0]),cy+ch); c.closePath();
    const g=c.createLinearGradient(0,cy,0,cy+ch);
    g.addColorStop(0,'rgba(0,188,212,0.45)'); g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g; c.fill();
    c.beginPath();
    for(let i=0;i<drawn;i++){const[v,y]=net[i];i===0?c.moveTo(Ex(v),Ey(y)):c.lineTo(Ex(v),Ey(y));}
    c.strokeStyle='#00bcd4'; c.lineWidth=2.8; c.lineJoin='round'; c.stroke();
    // Legend
    c.fillStyle='rgba(0,188,212,0.4)'; c.fillRect(cx+4,cy+ch-22,12,3);
    c.fillStyle='#00bcd4'; c.fillRect(cx+4,cy+ch-12,12,3);
    c.fillStyle='#8090a8'; c.font='500 10px Inter,Arial'; c.textAlign='left';
    c.fillText('Fwd/Rev', cx+20,cy+ch-17);
    c.fillText('Net ΔI', cx+20,cy+ch-7);
    c.textAlign='center';
  }
  c.fillStyle='#4a5868'; c.font='500 11px Inter,Arial';
  c.fillText('f = 25Hz  ·  ESW = 25mV  ·  ΔEs = 5mV', W/2, cy+ch+34);
}
function drawCA(c,W,H,u,t){
  // Chronoamperometry — Cottrell decay
  const cx=44,cy=118,cw=W-88,ch=260;
  c.fillStyle='#08121e'; roundRect(c,cx,cy,cw,ch,8); c.fill();
  c.strokeStyle='rgba(60,90,120,.4)'; c.lineWidth=1;
  for(let g=0;g<=4;g++){const yg=cy+ch*g/4;c.beginPath();c.moveTo(cx,yg);c.lineTo(cx+cw,yg);c.stroke();}
  c.fillStyle='#5a6878'; c.font='500 11px Inter,Arial'; c.textAlign='center';
  c.fillText('Time t (s)', W/2, cy+ch+18);
  c.save(); c.translate(cx-28,cy+ch/2); c.rotate(-Math.PI/2); c.fillText('Current I (\u03bcA)', 0, 0); c.restore();
  ['0','5','10','15','20'].forEach((v,i)=>c.fillText(v,cx+cw*i/4,cy+ch+14));
  // Cottrell: I(t) = nFAC sqrt(D/pi*t) + I_back
  const Imax=85, Iback=4, tau=1.8; // time constant
  const N=200;
  const pts=[];
  for(let i=0;i<=N;i++){
    const ti=0.1+i/N*19.9; // 0.1 to 20s
    const I=Iback+(Imax-Iback)*Math.exp(-ti/tau);
    pts.push([ti,I]);
  }
  const drawn=Math.max(2,Math.floor(u*N));
  const Tx=ti=>cx+ti/20*cw;
  const Iy=I=>cy+ch-I/Imax*ch;
  // Fill under curve
  c.beginPath();
  c.moveTo(Tx(pts[0][0]),cy+ch);
  for(let i=0;i<drawn;i++) c.lineTo(Tx(pts[i][0]),Iy(pts[i][1]));
  c.lineTo(Tx(pts[drawn-1][0]),cy+ch); c.closePath();
  const g=c.createLinearGradient(0,cy,0,cy+ch);
  g.addColorStop(0,'rgba(255,111,0,0.4)'); g.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=g; c.fill();
  c.beginPath();
  for(let i=0;i<drawn;i++){const[ti,I]=pts[i];i===0?c.moveTo(Tx(ti),Iy(I)):c.lineTo(Tx(ti),Iy(I));}
  c.strokeStyle='#ff6f00'; c.lineWidth=2.8; c.lineJoin='round'; c.stroke();
  // Cottrell fit line (1/sqrt(t))
  if(u>0.4){
    const fitAlpha=Math.min(1,(u-0.4)/0.3);
    c.setLineDash([6,4]);
    c.beginPath();
    for(let i=2;i<drawn;i++){
      const ti=pts[i][0];
      const fit=Iback+(Imax-Iback)*Math.exp(-ti/tau)*0.98;
      i===2?c.moveTo(Tx(ti),Iy(fit)):c.lineTo(Tx(ti),Iy(fit));
    }
    c.strokeStyle=`rgba(255,183,77,${fitAlpha*0.7})`; c.lineWidth=1.5; c.stroke();
    c.setLineDash([]);
    c.fillStyle=`rgba(255,183,77,${fitAlpha})`; c.font='500 10px Inter,Arial';
    c.textAlign='left'; c.fillText('Cottrell fit', cx+8, cy+14);
    c.textAlign='center';
  }
  // Potential step annotation
  c.strokeStyle='rgba(255,100,0,0.5)'; c.lineWidth=1.5;
  c.setLineDash([4,4]);
  c.beginPath(); c.moveTo(cx,cy+6); c.lineTo(cx,cy+ch); c.stroke();
  c.setLineDash([]);
  c.fillStyle='#ff6f00'; c.font='600 10px Inter,Arial'; c.textAlign='left';
  c.fillText('E-step', cx+4, cy+14);
  c.textAlign='center';
  c.fillStyle='#4a5868'; c.font='500 11px Inter,Arial';
  c.fillText('Estep = +0.4V  ·  t = 20s  ·  r = 0.3mm WE', W/2, cy+ch+34);
}

function drawDevice(t){
  const c=dc,W=512,H=768,cfg=SPE_CFG[activeSPE];
  c.clearRect(0,0,W,H);c.fillStyle='#06101e';c.fillRect(0,0,W,H);
  // Status bar
  c.fillStyle='#0b1828';c.fillRect(0,0,W,50);
  c.fillStyle='#90a0b4';c.font='600 18px Inter,Arial';c.textAlign='left';c.textBaseline='middle';
  c.fillText(`${14}:${String(22+Math.floor(t)%38).padStart(2,'0')}`,18,26);
  c.fillStyle='#2de8a0';
  [[0,.4],[5,.65],[10,1]].forEach(([dx,h])=>{c.fillRect(W-62+dx,26-13*h,6,13*h);});
  c.fillText('5G',W-38,26);
  if(SCR==='demo'){
    const dt=Math.max(0,t-25.3);
    drawTechDemo(c,W,H,dt,t);
  } else if(SCR==='idle'){
    c.fillStyle='#1a2c40';c.fillRect(0,50,W,H-50);
    c.textAlign='center';
    c.fillStyle='#162432';roundRect(c,60,90,W-120,210,18);c.fill();
    c.fillStyle=cfg.hex;c.font='700 13px Inter,Arial';c.letterSpacing='3px';c.fillText('VIDYUTHLABS',W/2,148);
    c.fillStyle='#f0f4f8';c.font='700 52px Inter,Arial';c.letterSpacing='-1px';c.fillText('AnalyteX',W/2,218);
    c.fillStyle='#5a6878';c.font='400 15px Inter,Arial';c.letterSpacing='0px';c.fillText('Portable Potentiostat · IP67',W/2,260);
    const pr=1+Math.sin(t*2.5)*.08;
    c.strokeStyle=`hsla(190,100%,60%,${.4+Math.sin(t*2.5)*.25})`;c.lineWidth=2.5;
    c.beginPath();c.arc(W/2,440,56*pr,0,Math.PI*2);c.stroke();
    c.fillStyle='#00e5ff';c.beginPath();c.arc(W/2,440,5,0,Math.PI*2);c.fill();
    c.fillStyle='#4a5868';c.font='500 15px Inter,Arial';c.letterSpacing='2px';c.fillText('AWAITING SENSOR',W/2,550);
  } else if(SCR==='connect'){
    c.textAlign='center';
    c.fillStyle='#0e2018';roundRect(c,22,56,W-44,64,14);c.fill();
    c.strokeStyle='#2de8a0';c.lineWidth=1.5;roundRect(c,22,56,W-44,64,14);c.stroke();
    c.fillStyle='#2de8a0';c.font='600 13px Inter,Arial';c.letterSpacing='2px';c.fillText('✓  SENSOR CONNECTED',W/2,92);
    c.fillStyle='#f0f4f8';c.font='700 21px Inter,Arial';c.letterSpacing='0px';c.fillText(cfg.sub,W/2,158);
    c.fillStyle='#5a6878';c.font='400 13px Inter,Arial';c.fillText('DPV  ·  '+cfg.label,W/2,192);
    c.shadowColor=cfg.hex;c.shadowBlur=dpvGlow*26;
    c.fillStyle=`rgba(0,200,240,${.85+dpvGlow*.12})`;roundRect(c,80,280,W-160,68,36);c.fill();
    c.shadowBlur=0;
    c.fillStyle='#04141e';c.font='700 24px Inter,Arial';c.fillText('START ANALYSIS',W/2,318);
  } else if(SCR==='dpv'){
    c.textAlign='center';
    c.fillStyle=cfg.hex;c.font='700 16px Inter,Arial';c.letterSpacing='2px';c.fillText('ANALYZING…',W/2,90);
    c.fillStyle='#5a6878';c.font='400 12px Inter,Arial';c.letterSpacing='0px';c.fillText('Differential Pulse Voltammetry',W/2,116);
    const cx=44,cy=140,cw=W-88,ch=340;
    c.fillStyle='#0a1828';roundRect(c,cx,cy,cw,ch,10);c.fill();
    c.strokeStyle='rgba(40,70,100,.5)';c.lineWidth=1;
    for(let g=0;g<=4;g++){const y2=cy+ch*(1-g/4);c.beginPath();c.moveTo(cx,y2);c.lineTo(cx+cw,y2);c.stroke();}
    const dpv=DPV[activeSPE],N=Math.max(2,Math.floor(dpvFrac*dpv.length));
    const px=v=>cx+(v+0.9)/1.4*cw,py=y=>cy+ch-y/1.2*ch;
    c.beginPath();c.moveTo(px(dpv[0][0]),cy+ch);
    for(let i=0;i<N;i++)c.lineTo(px(dpv[i][0]),py(dpv[i][1]));
    c.lineTo(px(dpv[N-1][0]),cy+ch);c.closePath();
    const fg=c.createLinearGradient(0,cy,0,cy+ch);fg.addColorStop(0,cfg.hex+'44');fg.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=fg;c.fill();
    c.strokeStyle=cfg.hex;c.lineWidth=2.5;c.lineJoin='round';c.beginPath();
    for(let i=0;i<N;i++){const[v,y]=dpv[i];i===0?c.moveTo(px(v),py(y)):c.lineTo(px(v),py(y));}c.stroke();
    const labs=PEAK_LABS[activeSPE];
    const PM={HM:[[-0.75,.78],[-0.50,.96],[-0.14,.52],[0.04,.31]],FM:[[-0.60,.91],[0.12,.42]],PEST:[[-0.34,.82],[0.20,.44],[-0.58,.24]],NPK:[[-0.46,.68],[0.24,.85],[-0.76,.46]],HLTH:[[-0.14,.79],[0.27,.94],[0.56,.55]]};
    (PM[activeSPE]||[]).forEach(([p,h],i)=>{if(labs[i]&&px(p)<=px(dpv[N-1][0])+2){c.fillStyle='#e0e8f4';c.font='600 12px Inter,Arial';c.fillText(labs[i],px(p),py(h+0.1)-6);}});
    c.fillStyle='#0a1828';roundRect(c,cx,cy+ch+14,cw,9,5);c.fill();
    c.fillStyle=cfg.hex;roundRect(c,cx,cy+ch+14,cw*dpvFrac,9,5);c.fill();
    c.fillStyle='#4a5868';c.font='400 12px Inter,Arial';c.fillText(`Sweeping… ${Math.round(dpvFrac*100)}%`,W/2,cy+ch+44);
  } else {
    c.textAlign='center';
    c.fillStyle='#0c1e16';roundRect(c,22,58,W-44,58,14);c.fill();
    c.strokeStyle='#2de8a0';c.lineWidth=1.5;roundRect(c,22,58,W-44,58,14);c.stroke();
    c.fillStyle='#2de8a0';c.font='600 14px Inter,Arial';c.letterSpacing='1px';c.fillText('✓  ANALYSIS COMPLETE',W/2,92);
    c.fillStyle=cfg.hex;c.font='700 20px Inter,Arial';c.letterSpacing='0px';c.fillText(cfg.sub,W/2,158);
    for(let i=0;i<3;i++){const a=(t*1.6+i*0.38)%1;c.strokeStyle=`rgba(0,212,232,${1-a})`;c.lineWidth=1.5;c.beginPath();c.arc(W/2,286,12+a*50,0,Math.PI*2);c.stroke();}
    c.fillStyle='#4a5868';c.font='500 14px Inter,Arial';c.letterSpacing='0px';c.fillText('Syncing to phone…',W/2,370);
  }
  dTex.needsUpdate=true;
}

/* ══════════════════════════════════════════════════════
   PHONE APP CANVAS
══════════════════════════════════════════════════════ */
const [,pc,pTex] = ctex(390,844);
const PHONE_DATA = {
  HM:{tag:'FOOD SAFETY',tagHex:'#e53935',title:'Heavy Metals',verdict:'⚠  UNSAFE — Cadmium 4× BIS limit',vCol:'#ff5252',rows:[{name:'Lead (Pb)',sym:'Pb',val:0.0032,lim:0.010,unit:'mg/L'},{name:'Cadmium (Cd)',sym:'Cd',val:0.0121,lim:0.003,unit:'mg/L',over:true},{name:'Arsenic (As)',sym:'As',val:0.0018,lim:0.010,unit:'mg/L'}],ai:['Cd is 4× above BIS 10500 limit.','Source: likely industrial effluent.','Pb & As within safe range.','Action: isolate source + re-sample.']},
  FM:{tag:'FOOD SAFETY',tagHex:'#ff6f00',title:'Formalin Detection',verdict:'⚠  DETECTED — 4.2 ppm (illegal)',vCol:'#ff5252',rows:[{name:'Formaldehyde',sym:'CH₂O',val:4.2,lim:0,unit:'ppm',over:true}],ai:['4.2 ppm exceeds WHO/FSSAI limits.','Likely used as illegal preservative.','Do NOT consume this product.','Report: FSSAI 1800-112-100.']},
  PEST:{tag:'AGRICULTURE',tagHex:'#388e3c',title:'Pesticide Screen',verdict:'⚠  MRL EXCEEDED — Chlorpyrifos',vCol:'#ff5252',rows:[{name:'Chlorpyrifos',sym:'CPF',val:8.4,lim:1.0,unit:'ppb',over:true},{name:'Methomyl',sym:'MTH',val:0.28,lim:2.5,unit:'ppb'}],ai:['CPF is 8.4× above Codex MRL.','Applied within last 48–72 hours.','Methomyl within permissible limit.','Hold harvest — contact agronomist.']},
  HLTH:{tag:'CLINICAL',tagHex:'#1976d2',title:'Biomarker Panel',verdict:'⚠  ELEVATED — Uric Acid 7.8 mg/dL',vCol:'#ffa726',rows:[{name:'Uric Acid',sym:'UA',val:7.8,lim:6.0,unit:'mg/dL',over:true},{name:'Dopamine',sym:'DA',val:82,lim:0,unit:'pg/mL',display:true},{name:'Creatinine',sym:'Cr',val:1.12,lim:1.3,unit:'mg/dL'}],ai:['UA elevated — hyperuricemia risk.','Dopamine: normal reference range.','Creatinine: renal function normal.','Review diet; repeat in 2 weeks.']},
};
let phoneChap='HM';
function drawPhone(t,reveal){
  const c=pc,W=390,H=844,d=PHONE_DATA[phoneChap]||PHONE_DATA.HM;
  c.clearRect(0,0,W,H);c.fillStyle='#07101c';c.fillRect(0,0,W,H);
  c.fillStyle='#0c1928';c.fillRect(0,0,W,44);
  c.fillStyle='#a0b0c0';c.font='600 13px Inter,Arial';c.textAlign='left';c.textBaseline='middle';
  c.fillText(`${14}:${String(20+Math.floor(t)%40).padStart(2,'0')}`,22,22);
  c.fillStyle='#2de8a0';c.textAlign='right';c.fillText('● BLE',W-22,22);c.textAlign='left';
  c.fillStyle=d.tagHex+'20';roundRect(c,22,54,110,28,14);c.fill();
  c.strokeStyle=d.tagHex+'55';c.lineWidth=1;roundRect(c,22,54,110,28,14);c.stroke();
  c.fillStyle=d.tagHex;c.font='600 11px Inter,Arial';c.letterSpacing='1.5px';c.textAlign='center';c.fillText(d.tag,77,70);c.textAlign='left';c.letterSpacing='0px';
  c.fillStyle='#00cfe8';c.font='600 11px Inter,Arial';c.letterSpacing='2px';c.fillText('VIDYUTHLABS  ·  ANALYTEX',22,106);
  c.fillStyle='#f0f4f8';c.font='700 25px Inter,Arial';c.letterSpacing='-.5px';c.fillText(d.title,22,140);c.letterSpacing='0px';
  c.fillStyle=d.vCol+'18';roundRect(c,16,156,W-32,50,10);c.fill();
  c.strokeStyle=d.vCol+'60';c.lineWidth=1;roundRect(c,16,156,W-32,50,10);c.stroke();
  c.fillStyle=d.vCol;c.font='600 12px Inter,Arial';c.fillText(d.verdict,26,184);
  let rowY=218;
  d.rows.forEach(({name,val,lim,unit,over:forceOver,display},idx)=>{
    if(reveal<=idx*.22)return;
    const over=forceOver||(lim>0&&val>lim),col=display?'#a0b0c0':over?'#ff5252':'#2de8a0';
    c.fillStyle='#0d1e2e';roundRect(c,16,rowY,W-32,86,10);c.fill();
    c.fillStyle='#c8d8e8';c.font='600 13px Inter,Arial';c.fillText(name,26,rowY+22);
    c.fillStyle=col;c.font='700 21px Inter,Arial';c.textAlign='right';
    c.fillText(val.toFixed(lim>10?1:lim===0?1:3),W-26,rowY+24);c.textAlign='left';
    c.fillStyle='#3a4c5c';c.font='400 11px Inter,Arial';
    c.fillText(`${unit}${lim>0?`  ·  Lim ${lim.toFixed(lim>10?1:3)}`:'  ·  reference'}`,26,rowY+44);
    if(lim>0&&!display){const bW=W-52,bX=26;c.fillStyle='#0a1520';roundRect(c,bX,rowY+54,bW,7,4);c.fill();const fill=Math.min(1,val/(lim*2))*bW;c.fillStyle=col;roundRect(c,bX,rowY+54,Math.max(5,fill),7,4);c.fill();const lX=bX+.5*bW;c.strokeStyle='#c0ccd8';c.lineWidth=1.5;c.beginPath();c.moveTo(lX,rowY+50);c.lineTo(lX,rowY+65);c.stroke();}
    c.fillStyle=col;c.font='600 10px Inter,Arial';c.letterSpacing='1px';c.textAlign='right';
    c.fillText(display?'NORMAL':over?'EXCEEDS LIMIT':'WITHIN LIMIT',W-26,rowY+76);
    c.textAlign='left';c.letterSpacing='0px';rowY+=92;
  });
  if(reveal>.85){const aiY=rowY+8;c.fillStyle='#0c1e16';roundRect(c,16,aiY,W-32,136,10);c.fill();c.strokeStyle='#2de8a0';c.lineWidth=1;roundRect(c,16,aiY,W-32,136,10);c.stroke();c.fillStyle='#2de8a0';c.font='600 12px Inter,Arial';c.letterSpacing='1.5px';c.fillText('◆  AI INSIGHT',26,aiY+22);c.letterSpacing='0px';c.fillStyle='#b0c0d0';c.font='400 12px Inter,Arial';d.ai.forEach((ln,i)=>c.fillText(ln,26,aiY+44+i*23));}
  c.fillStyle='#091220';c.fillRect(0,H-56,W,56);c.strokeStyle='rgba(255,255,255,.04)';c.lineWidth=1;c.beginPath();c.moveTo(0,H-56);c.lineTo(W,H-56);c.stroke();
  ['Home','Scan','Map','Log'].forEach((k,i)=>{c.fillStyle=i===1?'#00cfe8':'#384858';c.font='600 11px Inter,Arial';c.letterSpacing='.5px';c.textAlign='center';c.fillText(k,48+i*98,H-26);});
  c.textAlign='left';c.letterSpacing='0px';pTex.needsUpdate=true;
}

/* ══════════════════════════════════════════════════════
   DEVICE MODEL
══════════════════════════════════════════════════════ */
const device = new THREE.Group();
const bodyMesh=new THREE.Mesh(new RoundedBoxGeometry(2.6,4.5,.9,8,.22),M_body);
bodyMesh.castShadow=bodyMesh.receiveShadow=true;device.add(bodyMesh);
device.add(place(new THREE.Mesh(new RoundedBoxGeometry(2.4,4.3,.12,6,.14),M_face),0,0,.38));
device.add(place(new THREE.Mesh(new RoundedBoxGeometry(2.0,2.7,.024,4,.06),M_bezel),0,.7,.44));
const scrMesh=place(new THREE.Mesh(new THREE.PlaneGeometry(1.84,2.55),new THREE.MeshBasicMaterial({map:dTex,toneMapped:false})),0,.7,.463);
scrMesh.renderOrder=1;device.add(scrMesh);
device.add(place(new THREE.Mesh(new THREE.PlaneGeometry(1.92,2.62),M_glass.clone()),0,.7,.473));
{const[,lx,lt]=ctex(512,192);
  lx.fillStyle='#06101e';lx.fillRect(0,0,512,192);
  lx.fillStyle='#00cfe8';lx.font='700 44px Inter,Arial';lx.letterSpacing='-.5px';lx.textAlign='center';lx.fillText('VidyuthLabs',256,68);
  lx.fillStyle='#38485a';lx.font='400 22px Inter,Arial';lx.letterSpacing='3px';lx.fillText('ANALYTEX  ·  IP67',256,116);
  lx.fillStyle='#1a2a38';lx.font='400 14px Inter,Arial';lx.letterSpacing='1px';lx.fillText('DPV · SWV · CA · CV',256,152);lt.needsUpdate=true;
  const lM=place(new THREE.Mesh(new THREE.PlaneGeometry(2.0,.74),new THREE.MeshBasicMaterial({map:lt,toneMapped:false})),0,-1.12,.453);
  lM.renderOrder=1;device.add(lM);}

// Connector / slot (top)
device.add(place(new THREE.Mesh(new RoundedBoxGeometry(1.2,.52,.36,3,.08),M_darkMt),0,2.24,.15));
// Slot opening — actual dark cavity  
device.add(place(new THREE.Mesh(new THREE.BoxGeometry(.95,.2,.25),new THREE.MeshStandardMaterial({color:0x000000})),0,2.3,.15));
// Three gold contact receptacles inside slot
[-0.26,0,.26].forEach(x=>device.add(place(new THREE.Mesh(new THREE.BoxGeometry(.1,.04,.1),M_gold),x,2.31,.15)));

// Side buttons
device.add(place(new THREE.Mesh(new RoundedBoxGeometry(.08,.55,.18,3,.03),M_darkMt),1.29,1.0,.04));
device.add(place(new THREE.Mesh(new RoundedBoxGeometry(.08,.32,.18,3,.03),M_darkMt),1.29,.32,.04));
// USB-C
device.add(place(new THREE.Mesh(new THREE.BoxGeometry(.14,.27,.48),M_darkMt),-1.29,.55,0));
device.add(place(new THREE.Mesh(new THREE.BoxGeometry(.06,.13,.32),new THREE.MeshStandardMaterial({color:0x020305})),-1.34,.55,0));
// Screws
[[-1.1,2.1],[1.1,2.1],[-1.1,-2.1],[1.1,-2.1]].forEach(([x,y])=>device.add(place(new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.06,6),M_metal),x,y,.43,Math.PI/2,0,0)));
// Grip ridges
for(let i=0;i<8;i++){const gy=-1.2+i*.35;[-1.28,1.28].forEach(sx=>device.add(place(new THREE.Mesh(new THREE.BoxGeometry(.055,.14,.56),M_body),sx,gy,0)));}
scene.add(device);

/* ══════════════════════════════════════════════════════
   SPE SENSOR — NanoX cartridge
   Layout (front face, Y-up):
   TOP:   Color band + NanoX label
   MID:   Brand text + type label  
   BOT:   3 gold contact pads — insert into device
══════════════════════════════════════════════════════ */
const spe = new THREE.Group();

// Substrate — black FR4/PVC, 1.6mm thick, slightly rounded
const speW=0.90, speH=2.4, speD=0.052;
const speBody=new THREE.Mesh(new RoundedBoxGeometry(speW,speH,speD,4,.04),M_speBase);
speBody.castShadow=true;spe.add(speBody);

// ── 3 Gold Contact Pads at BOTTOM (RE | WE | CE) — these insert into device
const padW=0.21,padH=0.58,padD=0.014;
const PAD_X=[-0.28,0,.28];
const PAD_LABELS=['RE','WE','CE'];
PAD_X.forEach((px,i)=>{
  // Gold pad
  const pad=new THREE.Mesh(new THREE.BoxGeometry(padW,padH,padD),M_gold.clone());
  pad.position.set(px, -0.88, speD/2+padD/2);
  pad.renderOrder=2;
  spe.add(pad);
  // Solder mask border (dark ring)
  const borderM=new THREE.Mesh(new THREE.BoxGeometry(padW+.014,padH+.014,.004),M_speBase.clone());
  borderM.position.set(px,-0.88,speD/2+.001);spe.add(borderM);
});

// ── Label canvas (NanoX + pad labels + brand text) ──
const [speLabelCv, speLabelX, speLabelTex] = ctex(512,256);
function drawSPELabel(type){
  const cfg=SPE_CFG[type];
  const c=speLabelX, W=512, H=256;
  c.clearRect(0,0,W,H);
  // Pad labels (RE, WE, CE) — positioned at bottom close to the insertion pads
  const pxs=[90,256,422];
  PAD_LABELS.forEach((lab,i)=>{
    c.fillStyle='#d4a820';c.font='bold 22px Inter,Arial';c.textAlign='center';c.letterSpacing='1px';
    c.fillText(lab,pxs[i],224);
  });
  // Brand name — large, centered
  c.fillStyle='#d4a820';c.font='bold 58px Inter,Arial';c.letterSpacing='-1px';c.textAlign='center';c.fillText('NanoX',256,132);
  // Sub text
  c.fillStyle='#887050';c.font='400 22px Inter,Arial';c.letterSpacing='.5px';c.fillText('By VidyuthLabs V1.0',256,174);
  // Type label
  c.fillStyle=cfg.hex+'cc';c.font='600 18px Inter,Arial';c.letterSpacing='2px';c.fillText(cfg.label,256,64);
  speLabelTex.needsUpdate=true;
}
drawSPELabel('HM');
const speLabelMesh=new THREE.Mesh(new THREE.PlaneGeometry(speW-.06,.48),new THREE.MeshBasicMaterial({map:speLabelTex,transparent:true,toneMapped:false}));
speLabelMesh.position.set(0,-0.10,speD/2+.001);speLabelMesh.renderOrder=2;spe.add(speLabelMesh);

// ── LARGE CIRCULAR WORKING ELECTRODE (top, matching reference image) ──
const WE_Y=0.72;
const WE_R=0.30; // big prominent circle like the reference

// Outer ring (dark border on substrate)
const weBorderMat=new THREE.MeshPhysicalMaterial({color:0x060808,roughness:.85,metalness:.04,polygonOffset:true,polygonOffsetFactor:4,polygonOffsetUnits:4});
const weBorder=new THREE.Mesh(new THREE.CircleGeometry(WE_R+.018,72),weBorderMat);
weBorder.position.set(0,WE_Y,speD/2+.002);weBorder.renderOrder=2;spe.add(weBorder);

// Gold ring
const weRingMat=M_gold.clone();
weRingMat.polygonOffset=true;weRingMat.polygonOffsetFactor=3;weRingMat.polygonOffsetUnits=3;
const weRing=new THREE.Mesh(new THREE.RingGeometry(WE_R-.012,WE_R+.005,72),weRingMat);
weRing.position.set(0,WE_Y,speD/2+.006);weRing.renderOrder=3;spe.add(weRing);

// Nano-material working electrode disc
const weDisc=new THREE.Mesh(new THREE.CircleGeometry(WE_R-.015,72),NANO.HM);
weDisc.position.set(0,WE_Y,speD/2+.009);weDisc.renderOrder=4;spe.add(weDisc);

// Gold gradient glow overlay (like reference image — gold sheen)
const weGlowCv=document.createElement('canvas');weGlowCv.width=weGlowCv.height=256;
const weGlowX=weGlowCv.getContext('2d');
const weGG=weGlowX.createRadialGradient(120,100,0,128,128,128);
weGG.addColorStop(0,'rgba(255,230,120,0.9)');weGG.addColorStop(.35,'rgba(212,168,32,0.75)');weGG.addColorStop(.7,'rgba(160,120,10,0.4)');weGG.addColorStop(1,'rgba(0,0,0,0)');
weGlowX.fillStyle=weGG;weGlowX.fillRect(0,0,256,256);
const weGlowTex=new THREE.CanvasTexture(weGlowCv);weGlowTex.colorSpace=THREE.SRGBColorSpace;
const weGlowMesh=new THREE.Mesh(new THREE.CircleGeometry(WE_R-.015,72),new THREE.MeshBasicMaterial({map:weGlowTex,transparent:true,opacity:.72,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));
weGlowMesh.position.set(0,WE_Y,speD/2+.012);weGlowMesh.renderOrder=5;spe.add(weGlowMesh);

// Nano-dots on WE surface
const nanoDots=new THREE.Group();
for(let i=0;i<60;i++){
  const a=Math.random()*Math.PI*2,r=Math.random()*(WE_R-.02);
  const dot=new THREE.Mesh(new THREE.SphereGeometry(.004+Math.random()*.004,4,4),
    new THREE.MeshStandardMaterial({color:0x1a2230,roughness:.3,metalness:.9,emissive:0x002233,emissiveIntensity:.5}));
  dot.position.set(Math.cos(a)*r,WE_Y+Math.sin(a)*r,speD/2+.018);nanoDots.add(dot);
}
spe.add(nanoDots);

// ── Color identification band (very top, full width) ──
const bandMat=new THREE.MeshStandardMaterial({color:0xe53935,roughness:.25,metalness:.4,emissive:0xe53935,emissiveIntensity:.55,toneMapped:false});
const bandMesh=new THREE.Mesh(new THREE.BoxGeometry(speW,.08,.065),bandMat);
bandMesh.position.set(0,speH/2-.04,speD/2+.033);spe.add(bandMesh);

// ── Thin gold electrical track lines (from pads up to WE) ──
// Vertical traces connecting pads to electrode area
PAD_X.forEach(px=>{
  const track=new THREE.Mesh(new THREE.BoxGeometry(.007,.38,.006),M_gold.clone());
  track.position.set(px,-.32,speD/2+.003);track.renderOrder=1;spe.add(track);
});
// Horizontal bus bar
const hBus=new THREE.Mesh(new THREE.BoxGeometry(speW-.14,.007,.006),M_gold.clone());
hBus.position.set(0,-.14,speD/2+.003);hBus.renderOrder=1;spe.add(hBus);
// Down from bus to WE
const vTr=new THREE.Mesh(new THREE.BoxGeometry(.007,.44,.006),M_gold.clone());
vTr.position.set(0,.1,speD/2+.003);vTr.renderOrder=1;spe.add(vTr);

function updateSPE(type){
  const cfg=SPE_CFG[type];
  weDisc.material=NANO[type];
  weGlowMesh.material.opacity=type==='HM'?.72:.55; // less glow on non-HM
  bandMat.color.setStyle(cfg.hex);bandMat.emissive.setStyle(cfg.hex);
  drawSPELabel(type);
}
updateSPE('HM');

// Insertion guide flash
const insertFlashMat=new THREE.MeshBasicMaterial({color:0xffd700,transparent:true,opacity:0,toneMapped:false,blending:THREE.AdditiveBlending,depthWrite:false});
const insertFlash=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.6),insertFlashMat);
insertFlash.position.set(0,2.35,.8);scene.add(insertFlash);

scene.add(spe);

/* ══════════════════════════════════════════════════════
   SAMPLE DROPPER
══════════════════════════════════════════════════════ */
const dropBulbMat=new THREE.MeshPhysicalMaterial({color:0x1a6b2a,roughness:.35,clearcoat:.8});
const dropLiqMat =new THREE.MeshPhysicalMaterial({color:0x2dd45a,transmission:.35,transparent:true,opacity:.88,roughness:.12});
const dropper=new THREE.Group();
dropper.add(new THREE.Mesh(new THREE.CapsuleGeometry(.1,.38,8,16),dropBulbMat));
dropper.add(place(new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.5,18),new THREE.MeshPhysicalMaterial({color:0xe8edf2,roughness:.08,transmission:.7,transparent:true,opacity:.45,ior:1.47})),0,-.48,0));
dropper.add(place(new THREE.Mesh(new THREE.ConeGeometry(.045,.22,18),new THREE.MeshPhysicalMaterial({color:0xe8edf2,roughness:.08,transmission:.7,transparent:true,opacity:.45,ior:1.47})),0,-.81,0,Math.PI,0,0));
const dropLiqMesh=place(new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.34,16),dropLiqMat),0,-.48,0);
dropLiqMesh.scale.y=0;dropper.add(dropLiqMesh);
dropper.position.set(2.6,2.0,-.8);scene.add(dropper);

const fallDropMat=new THREE.MeshPhysicalMaterial({color:0x2dd45a,transmission:.35,transparent:true,opacity:.88,roughness:.08,clearcoat:1});
const fallDrop=new THREE.Mesh(new THREE.SphereGeometry(.045,20,16),fallDropMat);
fallDrop.visible=false;scene.add(fallDrop);

const weDropMat=new THREE.MeshPhysicalMaterial({color:0x2dd45a,transparent:true,opacity:.78,roughness:.04,clearcoat:1,transmission:.38,ior:1.34});
const weDrop=new THREE.Mesh(new THREE.SphereGeometry(.12,24,18,0,Math.PI*2,0,Math.PI/2),weDropMat);
weDrop.visible=false;scene.add(weDrop);

const vialGlassMat=new THREE.MeshPhysicalMaterial({color:0xddeef4,roughness:.04,transmission:.75,transparent:true,opacity:.38,ior:1.52});
const vialLiqMat  =new THREE.MeshPhysicalMaterial({color:0x2dd45a,roughness:.12,transmission:.4,transparent:true,opacity:.82,ior:1.34});
const vialGroup=new THREE.Group();
vialGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.62,32),vialGlassMat));
const vialLiq=place(new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.4,32),vialLiqMat),0,-.1,0);vialGroup.add(vialLiq);
vialGroup.add(place(new THREE.Mesh(new THREE.CylinderGeometry(.06,.10,.06,24),new THREE.MeshStandardMaterial({color:0x1a6b2a,roughness:.5})),0,.34,0));
vialGroup.position.set(2.6,-2.7,-.8);scene.add(vialGroup);

/* ══════════════════════════════════════════════════════
   PHONE MODEL
══════════════════════════════════════════════════════ */
const phone=new THREE.Group();
phone.add(Object.assign(new THREE.Mesh(new RoundedBoxGeometry(1.6,3.3,.16,6,.18),new THREE.MeshPhysicalMaterial({color:0x0c1018,roughness:.26,metalness:.64,clearcoat:.95})),{castShadow:true}));
phone.add(place(new THREE.Mesh(new RoundedBoxGeometry(1.5,3.2,.024,4,.12),new THREE.MeshPhysicalMaterial({color:0x060a10,roughness:.2,metalness:.1,clearcoat:.6})),0,0,.084));
const phoneScrMesh=place(new THREE.Mesh(new THREE.PlaneGeometry(1.38,3.06),new THREE.MeshBasicMaterial({map:pTex,toneMapped:false})),0,0,.097);
phoneScrMesh.renderOrder=1;phone.add(phoneScrMesh);
phone.add(place(new THREE.Mesh(new THREE.PlaneGeometry(1.48,3.18),M_glass.clone()),0,0,.1));
const camIsland=new THREE.Group();
camIsland.add(new THREE.Mesh(new RoundedBoxGeometry(.38,.48,.06,3,.06),new THREE.MeshStandardMaterial({color:0x080c12,roughness:.4,metalness:.8})));
[[-0.1,.1],[.1,.1],[0,-.1]].forEach(([cx,cy])=>{camIsland.add(place(new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.07,24),new THREE.MeshStandardMaterial({color:0x020408,roughness:.15,metalness:.7})),cx,cy,.035,Math.PI/2,0,0));camIsland.add(place(new THREE.Mesh(new THREE.CircleGeometry(.03,24),new THREE.MeshPhysicalMaterial({color:0x2b3e50,roughness:.05,metalness:.2,clearcoat:1})),cx,cy,.082));});
place(camIsland,-.5,1.35,-.09);phone.add(camIsland);
phone.add(place(new THREE.Mesh(new THREE.BoxGeometry(.16,.02,.38),new THREE.MeshStandardMaterial({color:0x1a202a,roughness:.3,metalness:.85})),.82,.3,0));
phone.position.set(-3.8,.2,.5);phone.rotation.y=.38;phone.visible=false;
scene.add(phone);

/* ══════════════════════════════════════════════════════
   ORBITAL SPE SHOWCASE
══════════════════════════════════════════════════════ */
const orbitSPEs=[];
['HM','FM','PEST','NPK','HLTH'].forEach((type,i)=>{
  const g=new THREE.Group(),cfg=SPE_CFG[type];
  g.add(Object.assign(new THREE.Mesh(new RoundedBoxGeometry(.55,1.5,.05,3,.025),M_speBase.clone()),{castShadow:true}));
  g.add(place(new THREE.Mesh(new THREE.BoxGeometry(.55,.068,.07),new THREE.MeshStandardMaterial({color:cfg.bandHex,emissive:cfg.bandHex,emissiveIntensity:.8,toneMapped:false})),0,-.69,.032));
  // Mini WE circle at top
  g.add(place(new THREE.Mesh(new THREE.CircleGeometry(.18,40),NANO[type].clone()),0,.32,.028));
  g.add(place(new THREE.Mesh(new THREE.RingGeometry(.185,.21,40),M_gold.clone()),0,.32,.03));
  // Mini pads at bottom
  [-0.16,0,.16].forEach(px=>g.add(place(new THREE.Mesh(new THREE.BoxGeometry(.12,.25,.01),M_gold.clone()),px,-.62,.028)));
  g.visible=false;g.scale.setScalar(.01);scene.add(g);
  orbitSPEs.push({g,baseAngle:(i/5)*Math.PI*2,type});
});

/* ══════════════════════════════════════════════════════
   FINALE RINGS
══════════════════════════════════════════════════════ */
const rings=[];
[[2.0,1.1],[2.8,1.6],[3.6,2.0]].forEach(([R,rx])=>{
  const m=new THREE.Mesh(new THREE.TorusGeometry(R,.006,8,100),new THREE.MeshBasicMaterial({color:0x00e5ff,transparent:true,opacity:.7,toneMapped:false}));
  m.rotation.x=rx;m.scale.setScalar(.01);m.visible=false;scene.add(m);rings.push(m);
});

/* ══════════════════════════════════════════════════════
   POST PROCESSING — conservative
══════════════════════════════════════════════════════ */
const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
// High threshold: ONLY emissives (LED, band) bloom, not full scene
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.22,.5,.94);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ══════════════════════════════════════════════════════
   CHAPTER BLACK FRAME OVERLAY (CSS-driven, not 3D)
══════════════════════════════════════════════════════ */
const overlay = document.getElementById('ch-overlay');
const chTitle = document.getElementById('ch-title');
const chSub   = document.getElementById('ch-sub');
const progEl  = document.getElementById('prog');
const capEl   = document.getElementById('cap');

// Full-black cinematic curtain for chapter transitions
const curtain = document.getElementById('curtain');
let curtainTarget = 0, curtainAlpha = 0;

function fadeCurtainIn(dur=0.5)  { curtainTarget=1; }
function fadeCurtainOut(dur=0.5) { curtainTarget=0; }
function tickCurtain(dt){
  curtainAlpha=lp(curtainAlpha,curtainTarget,Math.min(1,dt*5));
  curtain.style.opacity=curtainAlpha;
  curtain.style.pointerEvents=curtainAlpha>.05?'none':'none';
}

let chHideAt=0;
function showCard(title,sub,dur=3.0,withCurtain=false){
  if(withCurtain){
    curtain.style.opacity='1';curtainAlpha=1;curtainTarget=0;
    chTitle.textContent=title;chSub.textContent=sub||'';
    overlay.classList.add('visible');
    chHideAt=performance.now()+dur*1000;
  } else {
    chTitle.textContent=title;chSub.textContent=sub||'';
    overlay.classList.add('visible');chHideAt=performance.now()+dur*1000;
  }
}
function tickCard(dt){
  tickCurtain(dt);
  if(chHideAt>0&&performance.now()>chHideAt){overlay.classList.remove('visible');chHideAt=0;}
}

/* ══════════════════════════════════════════════════════
   VOICEOVER — ElevenLabs audio file, perfectly timed
══════════════════════════════════════════════════════ */
const voEl = document.getElementById('vo');

/* ══════════════════════════════════════════════════════
   TIMELINE  (129.6s - Aligned with Indian Voiceover)
══════════════════════════════════════════════════════ */
const DUR=129.6;

// Captions tightly matched to ElevenLabs script
const CAPS=[
  [ 1.0,  5.9, 'Every year, millions fall ill from what they cannot see.'],
  [ 9.0, 18.5, 'Heavy metals. Formalin. Pesticides. Biomarkers. Hidden threats.'],
  [ 18.5, 25.3, 'Meet AnalyteX — handheld, laboratory-grade electrochemical intelligence.'],
  [ 25.3, 40.9, 'Two-point-eight-inch touchscreen. WiFi. Bluetooth. Differential Pulse Voltammetry. Square Wave. Chronoamperometry. Cyclic Voltammetry.'],
  [ 40.9, 46.7, 'Built to go anywhere. Designed to detect everything.'],
  [ 46.7, 52.8, 'The NanoX cartridge platform — swap the SPE, change the mission.'],
  [ 52.8, 57.7, 'Same device. Unlimited applications.'],
  [ 57.7, 65.3, 'The Heavy Metals SPE detects lead, cadmium and arsenic in under ninety seconds.'],
  [ 65.3, 76.8, 'One drop. DPV sweep. Each voltammetric peak identifies a different metal — quantified in milligrams per litre.'],
  [ 76.8, 84.4, 'Swap to the Formalin SPE — formaldehyde detection in fish and food products.'],
  [ 84.4, 91.2, 'Carcinogenic. Illegal. Detectable in under two minutes.'],
  [ 91.2, 99.6, 'The Pesticide SPE uses enzyme inhibition — AChE-based organophosphate detection on crops.'],
  [ 99.6, 106.1, 'Real-time MRL compliance against Codex Alimentarius limits, on-site.'],
  [106.1, 114.1, 'The Clinical Health SPE simultaneously quantifies dopamine, uric acid, and creatinine.'],
  [114.1, 122.2, 'Biomarkers for neurological, metabolic, and renal health — at a fraction of lab cost.'],
  [122.2, 129.6, 'AnalyteX. One device. Every threat. Anywhere.'],
];

let activeSPEType='HM';const firedEv=new Set();
let swapAnim=null;
function triggerSwap(type){
  if(activeSPEType===type)return;
  swapAnim={start:performance.now()*.001,from:activeSPEType,to:type};
  activeSPEType=type;activeSPE=type;phoneChap=type;
}

const EVENTS=[
  {t:0,    fn:()=>{}},
  {t:18.5, fn:()=>showCard('ANALYTEX','The World\'s Most Versatile Potentiostat',3.5,true)},
  {t:46.7, fn:()=>showCard('NANOX PLATFORM','Swap the Cartridge. Change the Mission.',3.0,true)},
  {t:57.7, fn:()=>{showCard('FOOD SAFETY','Heavy Metals Detection',2.8,true);triggerSwap('HM');}},
  {t:76.8, fn:()=>{showCard('FOOD SAFETY','Formalin Detection',2.8,true);triggerSwap('FM');}},
  {t:91.2, fn:()=>{showCard('AGRICULTURE','Pesticide Screening',2.8,true);triggerSwap('PEST');}},
  {t:106.1,fn:()=>{showCard('CLINICAL HEALTH','Biomarker Monitoring',2.8,true);triggerSwap('HLTH');}},
  {t:122.2,fn:()=>showCard('ANALYTEX','One Device. Every Threat. Anywhere.',6.0,true)},
];
function checkEvs(t){for(const e of EVENTS)if(t>=e.t&&!firedEv.has(e.t)){firedEv.add(e.t);e.fn();}}

/* ══════════════════════════════════════════════════════
   CAMERA KEYFRAMES — Premium macro cinematography
══════════════════════════════════════════════════════ */
const CAM=[
  // PROLOGUE — slow dramatic push-in
  [ 0, V(0, 1.8, 22),     V(0, 0.4, 0)],
  [ 6, V(0, 1.2, 14),     V(0, 0.4, 0)],
  [ 18, V(0, 0.6, 9.5),    V(0, 0.4, 0)],
  // HERO REVEAL — close macro angles showing the craftsmanship
  [ 18.5, V(2.4, 0.6, 3.8),  V(0, 0.2, 0.2)],  // angled right edge detail
  [ 25.3, V(-0.2, 0.5, 2.1), V(0, 0.7, 0.4)],  // screen macro close-up
  [ 33.0, V(0, 4.2, 1.2),    V(0, 0, 0.1)],    // high angle vertical geometry
  [ 40.9, V(-1.5, -1.8, 3.2),V(0, -0.5, 0)],   // low angle hero looking up
  // PLATFORM REVEAL — dramatic orbital sweep of NanoX cartridge catalogue
  [ 46.7, V(0.0, 6.5, 7.2),   V(0, 1.5, 0)],   // high angle looking down at orbiting cartridges
  [ 50.0, V(3.2, 3.2, 6.0),   V(0, 2.0, 0)],   // right orbit pass — see cartridges from side
  [ 52.8, V(-2.8, 2.8, 6.2),  V(0, 2.0, 0)],   // left orbit pan — full array visible
  // HEAVY METALS — follow insertion and macro WE details
  [ 57.7, V(0.8, 4.8, 1.98),  V(0, 3.84, 0.15)],  // watch SPE above slot
  [ 61.7, V(0.5, 4.4, 2.48),  V(0, 3.84, 0.15)],  // follow SPE sliding down
  [ 63.7, V(0.1, 3.96, 1.20), V(0, 3.84, 0.15)],// macro WE detail showing gold/dots
  [ 69.0, V(-0.3, 0.8, 1.8), V(0, 0.7, 0.45)], // screen voltammetry plot
  // FORMALIN
  [ 76.8, V(0.8, 4.4, 3.18),  V(0, 3.84, 0.15)],  // swap animation
  [ 84.4, V(-0.1, 3.96, 1.20),V(0, 3.84, 0.15)],// formaline WE close-up
  // PESTICIDE
  [ 91.2, V(0.6, 4.0, 3.28),  V(0, 3.84, 0.15)],    // cartridge details
  [ 96.0, V(0.1, 3.96, 1.25), V(0, 3.84, 0.15)],// pesticide WE close-up
  [ 102.0, V(-2.4, 0.2, 2.8), V(-2.1, 0.1, 0.8)],// slide to phone left
  // HEALTH
  [ 106.1, V(0.8, 4.2, 3.68),  V(0, 3.84, 0.15)],    // health cartridge
  [ 112.0, V(0.08, 3.96, 1.25),V(0, 3.84, 0.15)],// health WE close-up
  [ 118.0, V(-2.4, 0.2, 2.8), V(-2.1, 0.1, 0.8)],// slide to phone left
  // FINALE
  [ 122.2, V(-1.5, 1.6, 6.5), V(-0.6, 0.6, 0)],  // wide, pulsing rings
  [ 129.6, V(0, 1.8, 9.8),    V(0, 0.4, 0)],     // final hero shot
];
function camAt(t){
  for(let i=1;i<CAM.length;i++){
    if(t<=CAM[i][0]){
      const[t0,p0,l0]=CAM[i-1],[t1,p1,l1]=CAM[i];
      const u=sm2(clamp01((t-t0)/(t1-t0)));
      const p=new THREE.Vector3(),l=new THREE.Vector3();
      lerp3(p0,p1,u,p);lerp3(l0,l1,u,l);return{p,l};
    }
  }
  const k=CAM[CAM.length-1];return{p:k[1].clone(),l:k[2].clone()};
}

/* ══════════════════════════════════════════════════════
   WE WORLD POSITION (where droplet falls)
══════════════════════════════════════════════════════ */
const WE_LOCAL=new THREE.Vector3(0,WE_Y,.08);

/* ══════════════════════════════════════════════════════
   INSERTION ANIMATION STATE
   SPE descends from above the device into the slot
══════════════════════════════════════════════════════ */
// SPE resting position when NOT inserted
const SPE_REST_POS   = new THREE.Vector3(3.0,-0.5,1.2);
const SPE_REST_ROT   = new THREE.Euler(-Math.PI/2,0,0);
// SPE above device slot (ready to descend)
const SPE_ABOVE_POS  = new THREE.Vector3(0, 5.92, 0.15);
// SPE fully inserted — pads seat in slot at y=2.3, pad local y=-0.88
const SPE_INSERT_POS = new THREE.Vector3(0, 3.12, 0.15);

/* ══════════════════════════════════════════════════════
   MAIN FRAME UPDATE
══════════════════════════════════════════════════════ */
let prevT=0,prevDt=0.016;
function frame(t,dt){
  prevDt=dt;
  if(progEl)progEl.style.transform=`scaleX(${clamp01(t/DUR)})`;
  checkEvs(t);

  const inPro  =t<18.5;
  const inRev  =t>=18.5&&t<46.7;
  const inPlat =t>=46.7&&t<57.7;
  const inHM   =t>=57.7&&t<76.8;
  const inFM   =t>=76.8&&t<91.2;
  const inPEST =t>=91.2&&t<106.1;
  const inHLTH =t>=106.1&&t<122.2;
  const inFin  =t>=122.2;

  // Accent light
  const aTarget=inHM?0xff4444:inFM?0xff8c00:inPEST?0x4caf50:inHLTH?0x2196f3:0x00e5ff;
  const aInt=(inHM||inFM||inPEST||inHLTH)?1.1:.3;
  accentL.color.setHex(aTarget);
  accentL.intensity=lp(accentL.intensity,aInt,.06);

  // Swap flash
  if(swapAnim){
    const el=performance.now()*.001-swapAnim.start;
    if(el<1.0){insertFlashMat.opacity=Math.sin(el/1.0*Math.PI)*.7;if(el>.45)updateSPE(swapAnim.to);}
    else{insertFlashMat.opacity=0;swapAnim=null;}
  } else insertFlashMat.opacity=0;

  /* ── SPE POSITION & INSERTION ANIMATION ── */
  if(inPro||inRev){
    spe.position.copy(SPE_REST_POS);
    spe.rotation.copy(SPE_REST_ROT);
  } else if(inPlat){
    const u=sm(clamp01((t-46.7)/3.5));
    spe.position.set(lp(SPE_REST_POS.x,0,u),lp(SPE_REST_POS.y,SPE_ABOVE_POS.y,u),lp(SPE_REST_POS.z,SPE_ABOVE_POS.z,u));
    spe.rotation.set(lp(SPE_REST_ROT.x,-.2,u),lp(0,.15,u),0);
  } else if(inHM&&(t-57.7)<5){
    const dt50=t-57.7;
    if(dt50<2){
      const u=sm(dt50/2);
      spe.position.copy(SPE_ABOVE_POS);
      spe.rotation.set(lp(-.2,0,u),lp(.15,0,u),0);
    } else if(dt50<5){
      const u=sm2((dt50-2)/3);
      spe.position.set(0,lp(SPE_ABOVE_POS.y,SPE_INSERT_POS.y,u),SPE_INSERT_POS.z);
      spe.rotation.set(0,0,0);
      if(u>.85&&u<.95){ insertFlashMat.opacity=(1-(u-.85)/.1)*.4; accentL.intensity=lp(accentL.intensity,2.8,.12);}
    } else {
      spe.position.copy(SPE_INSERT_POS);spe.rotation.set(0,0,0);
    }
  } else if(inHM||inFM||inPEST||inHLTH){
    const breathY=Math.sin(t*1.2)*.004;
    spe.position.set(SPE_INSERT_POS.x,SPE_INSERT_POS.y+breathY,SPE_INSERT_POS.z);
    spe.rotation.set(0,0,0);
  } else if(inFin){
    spe.position.copy(SPE_INSERT_POS);spe.rotation.set(0,0,0);
  } else {
    spe.position.copy(SPE_REST_POS);spe.rotation.copy(SPE_REST_ROT);
  }
  spe.updateMatrixWorld(true);
  const weWorld=spe.localToWorld(WE_LOCAL.clone());

  // Orbital SPEs (platform chapter)
  orbitSPEs.forEach(({g,baseAngle},i)=>{
    g.visible=inPlat;
    if(inPlat){const u=sm(clamp01((t-46.7)/2.5));const orbit=(t-46.7)*.16+baseAngle;const R=2.2+(i%2)*.2;g.position.set(Math.cos(orbit)*R,.3+Math.sin(orbit*.5)*.28,Math.sin(orbit)*R);g.rotation.y=-orbit+Math.PI*.5;g.scale.setScalar(u);}
  });

  // Vial visibility
  vialGroup.visible=(inHM||inFM||inPEST||inHLTH);
  if(inFM){vialLiqMat.color.setHex(0xffb300);dropBulbMat.color.setHex(0xff8f00);dropLiqMat.color.setHex(0xffb300);}
  else if(inPEST){vialLiqMat.color.setHex(0x81c784);dropBulbMat.color.setHex(0x2e7d32);dropLiqMat.color.setHex(0x81c784);}
  else if(inHLTH){vialLiqMat.color.setHex(0xf48fb1);dropBulbMat.color.setHex(0xc62828);dropLiqMat.color.setHex(0xf48fb1);}
  else{vialLiqMat.color.setHex(0x2dd45a);dropBulbMat.color.setHex(0x1a6b2a);dropLiqMat.color.setHex(0x2dd45a);}
  fallDropMat.color.copy(dropLiqMat.color);weDropMat.color.copy(dropLiqMat.color);

  // Dropper animation
  const doDropper=(chStart,liftEnd)=>{
    const dtD=t-chStart;dropper.visible=true;
    if     (dtD<0)    {dropper.position.set(2.6,2.0,-.8);dropLiqMesh.scale.y=0;}
    else if(dtD<2)    {const u=sm(dtD/2);dropper.position.set(2.6,lp(2.0,-2.4,u),-.9);dropLiqMesh.scale.y=0;}
    else if(dtD<4)    {const u=sm((dtD-2)/2);dropper.position.set(2.6,lp(-2.4,1.0,u),-.9);dropLiqMesh.scale.y=u;}
    else if(dtD<7.5)  {const u=sm((dtD-4)/3.5);dropper.position.set(lp(2.6,weWorld.x,u),lp(1.0,weWorld.y+.9,u),lp(-.9,weWorld.z,u));dropLiqMesh.scale.y=1;}
    else if(dtD<9.5)  {dropper.position.set(weWorld.x,weWorld.y+.9,weWorld.z);dropLiqMesh.scale.y=Math.max(0,1-(dtD-7.5)/2);}
    else if(dtD<liftEnd){const u=sm(clamp01((dtD-9.5)/2));dropper.position.set(weWorld.x,lp(weWorld.y+.9,weWorld.y+3,u),weWorld.z);dropLiqMesh.scale.y=0;}
    else{dropper.visible=false;}
    if(dtD>8.8&&dtD<9.8){const u=(dtD-8.8)/1;fallDrop.visible=true;fallDrop.position.set(weWorld.x,lp(weWorld.y+.7,weWorld.y+.04,u*u),weWorld.z);}else fallDrop.visible=false;
    weDrop.visible=dtD>=9.8&&dtD<(liftEnd+2);
    if(weDrop.visible)weDrop.position.set(weWorld.x,weWorld.y,weWorld.z);
  };

  if(inHM&&(t-57.7)>5)       doDropper(62.7,12);
  else if(inFM)              doDropper(78.8,10);
  else if(inPEST)            doDropper(93.2,10);
  else if(inHLTH)            doDropper(108.1,10);
  else{dropper.visible=false;fallDrop.visible=false;weDrop.visible=false;}

  // Screen state
  if(inRev && t>=25.3 && t<40.9){
    SCR='demo';
  } else if(!inHM&&!inFM&&!inPEST&&!inHLTH){SCR='idle';}
  else{
    const cs=inFM?76.8:inPEST?91.2:inHLTH?106.1:57.7;
    const dt2=t-cs;
    if     (dt2<2)  {SCR='idle';}
    else if(dt2<5)  {SCR='connect';dpvGlow=.4+Math.sin(t*5)*.4;}
    else if(dt2<14) {SCR='dpv';dpvFrac=sm(clamp01((dt2-5)/9));}
    else            {SCR='done';}
  }
  drawDevice(t);

  // Device micro tilt
  device.rotation.y=lp(device.rotation.y,inRev?Math.sin(t*.28)*.14:0,.04);

  // Phone reveal — only shown when results are ready
  const phoneShowAt=inPEST?98:inHLTH?118:inFin?122:null;
  if(phoneShowAt!==null&&t>=(phoneShowAt)){
    phone.visible=true;
    const pu=sm(clamp01((t-phoneShowAt)/2.5));
    phone.position.set(lp(-4.5,-2.3,pu),lp(.2,.1,pu),lp(.2,.8,pu));
    phone.rotation.y=lp(.6,.3,pu);
    drawPhone(t,sm(clamp01((t-phoneShowAt-2)/8)));
  } else phone.visible=false;

  // Finale rings
  rings.forEach((r,i)=>{r.visible=inFin;if(inFin){const u=sm(clamp01((t-122)/3.5));r.scale.setScalar(u);r.rotation.z=(t-122)*(.1+i*.04);}});

  // Captions
  let cap='';
  for(const[a,b,s]of CAPS)if(t>=a&&t<b)cap=s;
  if(capEl.dataset.txt!==cap){capEl.dataset.txt=cap;capEl.textContent=cap;capEl.style.opacity=cap?'1':'0';}

  tickCard(dt);
}

/* ══════════════════════════════════════════════════════
   PLAYBACK
══════════════════════════════════════════════════════ */
const musicEl =document.getElementById('music');
const startDiv=document.getElementById('start');
const replayBtn=document.getElementById('replay');
let playing=false,startTime=0;

function beginFilm(){
  startTime=performance.now();playing=true;
  firedEv.clear();swapAnim=null;
  activeSPEType='HM';activeSPE='HM';phoneChap='HM';
  updateSPE('HM');SCR='idle';dpvFrac=0;
  startDiv.style.opacity='0';setTimeout(()=>startDiv.style.display='none',800);
  replayBtn.style.opacity='1';
  curtainAlpha=0;curtain.style.opacity='0';
  try{voEl.currentTime=0;voEl.volume=1;voEl.play();}catch(e){}
  try{musicEl.currentTime=0;musicEl.volume=0.18;musicEl.play();}catch(e){}
}
document.getElementById('play').onclick=beginFilm;
replayBtn.onclick=()=>{
  playing=false;firedEv.clear();swapAnim=null;
  activeSPEType='HM';activeSPE='HM';phoneChap='HM';
  updateSPE('HM');SCR='idle';dpvFrac=0;prevT=0;
  overlay.classList.remove('visible');curtain.style.opacity='0';curtainAlpha=0;
  try{voEl.pause();voEl.currentTime=0;musicEl.pause();}catch(e){}
  startDiv.style.display='flex';requestAnimationFrame(()=>startDiv.style.opacity='1');
};

addEventListener('resize',()=>{
  setFov();renderer.setSize(innerWidth,innerHeight);
  composer.setSize(innerWidth,innerHeight);bloom.setSize(innerWidth,innerHeight);
});

/* ══════════════════════════════════════════════════════
   RENDER LOOP
══════════════════════════════════════════════════════ */
let previewT=0,lastNow=performance.now();
function loop(){
  requestAnimationFrame(loop);
  const now=performance.now();
  const rawDt=Math.min((now-lastNow)/1000,.05);lastNow=now;
  const t=playing?Math.min(DUR,(now-startTime)/1000):(previewT=(previewT+.004)%14);
  const dt=playing?rawDt:.016;

  const{p,l}=camAt(t);
  const nt=now*.001;
  // Gentle handheld sway
  p.x+=Math.sin(nt*.42)*.016+Math.cos(nt*.73)*.008;
  p.y+=Math.cos(nt*.51)*.014+Math.sin(nt*.88)*.007;
  p.z+=Math.sin(nt*.33)*.010;
  camera.position.copy(p);camera.lookAt(l);

  frame(t,dt);
  animParticles();
  composer.render();

  if(playing&&t>=DUR){playing=false;if(capEl)capEl.style.opacity='0';}
}
window.__ready=true;
loop();
