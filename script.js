// ===== FIREBASE (paste your config) =====
const FB={apiKey:"AIzaSyCgIU_85HAccqFgZd1u4BQsbOEtY4r00sE",authDomain:"livegame-2212.firebaseapp.com",databaseURL:"https://livegame-2212-default-rtdb.firebaseio.com",projectId:"livegame-2212",storageBucket:"livegame-2212.firebasestorage.app",messagingSenderId:"493917811272",appId:"1:493917811272:web:ab31d9ecc9c631fdcc1e7d"};
let auth,db,rtdb,prof=null,uid=null;
try{firebase.initializeApp(FB);auth=firebase.auth();db=firebase.firestore()}catch(e){console.warn(e)}
try{rtdb=firebase.database()}catch(e){console.warn(e)}
const $=id=>document.getElementById(id),show=id=>{['auth','menu','statp','queue'].forEach(s=>$(s).classList.add('hide'));if(id)$(id).classList.remove('hide')};
const em=n=>n.toLowerCase().replace(/[^a-z0-9]/g,'')+'@54hoops.app';
async function register(n,p){
  const c=await auth.createUserWithEmailAndPassword(em(n),p);
  await db.runTransaction(async t=>{const r=db.doc('counters/users'),s=await t.get(r),k=(s.exists?s.data().n:0)+1;
    t.set(r,{n:k});t.set(db.doc('users/'+c.user.uid),{id:k,name:n,ankles:0,made:0,perfects:0,blocks:0})});
}
$('reg').onclick=async()=>{try{await register($('u').value.trim(),$('p').value)}catch(e){$('err').textContent=e.message}};
$('login').onclick=async()=>{try{await auth.signInWithEmailAndPassword(em($('u').value),$('p').value)}catch(e){$('err').textContent=e.message}};
// Guests sign in anonymously so the database rules can tell players apart. If that fails, they can still play vs the bot offline.
$('guest').onclick=async()=>{prof=null;try{if(!auth)throw 0;await auth.signInAnonymously()}catch(e){$('who').textContent='Guest (offline)';show('menu')}};
$('out').onclick=()=>{auth&&auth.signOut();show('auth')};
if(auth)auth.onAuthStateChanged(async u=>{if(!u)return;uid=u.uid;if(u.isAnonymous){prof=null;$('who').textContent='Guest';show('menu');return}
  for(let i=0;i<8;i++){const s=await db.doc('users/'+uid).get();if(s.exists){prof=s.data();break}await new Promise(r=>setTimeout(r,500))}
  if(prof){$('who').textContent=`#${prof.id}  ${prof.name}`;show('menu')}});
function stat(k){if(!prof)return;prof[k]++;db.doc('users/'+uid).update({[k]:firebase.firestore.FieldValue.increment(1)}).catch(()=>{})}
$('stats').onclick=()=>{if(!prof){alert('Log in to track stats');return}
  $('grid').innerHTML=[['ankles','Ankles broken'],['made','Shots made'],['perfects','Perfect shots'],['blocks','Blocks']].map(([k,l])=>`<div><b>${prof[k]}</b><span>${l}</span></div>`).join('');show('statp')};
$('back').onclick=()=>show('menu');
$('bot').onclick=()=>startGame();
// Matchmaking queue: joins queue, looks for another waiting player, falls back to bot.
$('online').onclick=async()=>{show('queue');let found=null,t0=Date.now();
  try{if(uid)await db.doc('queue/'+uid).set({t:Date.now(),name:prof?prof.name:'guest'})}catch(e){}
  const iv=setInterval(async()=>{try{const q=await db.collection('queue').orderBy('t').limit(5).get();q.forEach(d=>{if(d.id!==uid)found=d.data().name})}catch(e){}
    if(found)$('qt').textContent='Opponent found: '+found;
    if(Date.now()-t0>8000||found){clearInterval(iv);try{uid&&db.doc('queue/'+uid).delete()}catch(e){}
      $('qt').textContent=found?'Opponent found: '+found+' (live netcode not wired yet - starting vs bot)':'No players online - starting vs bot';setTimeout(startGame,1200)}},2000)};

// ===== GAME =====
const H={x:0,z:-6.2},RIM=3.05,R3=6.75,WIN=11;
let R,S,CAM,P=[],ball,keys={},cy=0,cp=.25,running=false,last=0,loose=null,flight=null,score=[0,0],t=0,ready=false;
function tex(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const x=new THREE.CanvasTexture(c);x.anisotropy=8;return x}
function init(){
  R=new THREE.WebGLRenderer({canvas:$('c'),antialias:true});R.setPixelRatio(devicePixelRatio);R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;R.outputEncoding=THREE.sRGBEncoding;R.toneMapping=THREE.ACESFilmicToneMapping;
  S=new THREE.Scene();S.background=new THREE.Color(0x0d0d12);S.fog=new THREE.Fog(0x0d0d12,18,45);
  CAM=new THREE.PerspectiveCamera(65,1,.1,100);
  const L=new THREE.SpotLight(0xfff0d8,2.2,60,1,.5);L.position.set(0,16,0);L.castShadow=true;L.shadow.mapSize.set(2048,2048);S.add(L,new THREE.HemisphereLight(0xaabbdd,0x442200,.5));
  const wood=tex(1024,1024,(g,w,h)=>{for(let i=0;i<16;i++){g.fillStyle=`hsl(32,${50+Math.random()*10}%,${52+Math.random()*10}%)`;g.fillRect(i*w/16,0,w/16-2,h);for(let j=0;j<60;j++){g.fillStyle='#0002';g.fillRect(i*w/16+Math.random()*60,Math.random()*h,1,40)}}});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(16,16),new THREE.MeshStandardMaterial({map:wood,roughness:.35,metalness:.1}));floor.rotation.x=-Math.PI/2;floor.position.z=.5;floor.receiveShadow=true;S.add(floor);
  const white=new THREE.MeshBasicMaterial({color:0xffffff,side:2});
  const ring=new THREE.Mesh(new THREE.RingGeometry(R3-.04,R3+.04,96,1,Math.PI*.12,Math.PI*.76),white);ring.rotation.x=-Math.PI/2;ring.rotation.z=Math.PI/2+Math.PI*.5;ring.position.set(H.x,.01,H.z);
  // 3pt arc facing +z: rebuild as full ring clipped by court bounds
  const full=new THREE.Mesh(new THREE.RingGeometry(R3-.04,R3+.04,96),white);full.rotation.x=-Math.PI/2;full.position.set(H.x,.01,H.z);S.add(full);
  const key=new THREE.Mesh(new THREE.PlaneGeometry(4.9,5.8),new THREE.MeshBasicMaterial({color:0x7a1f1f,transparent:true,opacity:.55}));key.rotation.x=-Math.PI/2;key.position.set(0,.008,H.z+2.3);S.add(key);
  const bb=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.05,.05),new THREE.MeshStandardMaterial({color:0xdde8ff,transparent:true,opacity:.7}));bb.position.set(H.x,RIM+.5,H.z-.45);bb.castShadow=true;
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.23,.015,12,32),new THREE.MeshStandardMaterial({color:0xff4a1a}));rim.rotation.x=Math.PI/2;rim.position.set(H.x,RIM,H.z);
  const net=new THREE.Mesh(new THREE.CylinderGeometry(.23,.13,.4,16,1,true),new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true}));net.position.set(H.x,RIM-.2,H.z);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,RIM+.6),new THREE.MeshStandardMaterial({color:0x222}));pole.position.set(H.x,(RIM+.6)/2,H.z-.9);S.add(bb,rim,net,pole);
  const bt=tex(256,256,(g,w,h)=>{g.fillStyle='#d9611a';g.fillRect(0,0,w,h);g.strokeStyle='#111';g.lineWidth=5;g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.moveTo(w/2,0);g.lineTo(w/2,h);g.stroke();g.beginPath();g.arc(0,h/2,h/2,-1.2,1.2);g.arc(w,h/2,h/2,Math.PI-1.2,Math.PI+1.2);g.stroke()});
  ball=new THREE.Mesh(new THREE.SphereGeometry(.12,32,24),new THREE.MeshStandardMaterial({map:bt,roughness:.8}));ball.castShadow=true;S.add(ball);
  addEventListener('resize',rs);rs();
  addEventListener('keydown',e=>{if(e.repeat)return;keys[e.code]=1;if(!running)return;const p=P[0];
    if(e.code==='KeyQ')jump(p);if(e.code==='KeyE')dribble(p);if(e.code==='KeyR')steal(p,P[1]);if(e.code==='KeyF'&&p.ball&&!p.fall){p.ch=1;p.m=0;$('meter').style.display='block'}});
  addEventListener('keyup',e=>{keys[e.code]=0;if(e.code==='KeyF'&&P[0]&&P[0].ch)release(P[0])});
  $('c').addEventListener('mousedown',()=>{if(!running)return;$('c').requestPointerLock();steal(P[0],P[1])});
  addEventListener('mousemove',e=>{if(document.pointerLockElement){cy-=e.movementX*.003;cp=Math.max(-.2,Math.min(.8,cp+e.movementY*.003))}});
  ready=true}
function rs(){R.setSize(innerWidth,innerHeight);CAM.aspect=innerWidth/innerHeight;CAM.updateProjectionMatrix()}
function mk(col){const g=new THREE.Group(),sk=0xc68642,m=c=>new THREE.MeshStandardMaterial({color:c,roughness:.6});g.rotation.order='YXZ';
  const add=(geo,c,x,y,z,pv)=>{if(pv)geo.translate(0,-pv/2,0);const o=new THREE.Mesh(geo,m(c));o.position.set(x,y,z);o.castShadow=true;g.add(o);return o};
  add(new THREE.BoxGeometry(.5,.6,.28),col,0,1.2,0);add(new THREE.SphereGeometry(.14,16,12),sk,0,1.65,0);add(new THREE.BoxGeometry(.5,.3,.28),0x111111,0,.85,0);
  const legs=[-.14,.14].map(x=>add(new THREE.BoxGeometry(.16,.8,.16),sk,x,.8,0,.8)),arms=[-.32,.32].map(x=>add(new THREE.BoxGeometry(.12,.55,.12),sk,x,1.47,0,.55));
  S.add(g);return{g,legs,arms,x:0,z:0,y:0,vy:0,yaw:0,ty:0,ball:false,dl:4,dt:0,fall:0,cd:0,ch:0,m:0,mv:0,sw:0,ph:0,fa:0,air:false,jx:0,jz:0,dxn:0,dzn:0}}
function jump(p){if(p.y<=.01&&!p.fall){p.vy=5;p.air=true;p.jx=(p.dxn||0)*4.2;p.jz=(p.dzn||0)*4.2}}// direction locked at takeoff
function dribble(p){if(p.ball&&p.dl>0&&p.dt<=0&&!p.fall&&!p.ch){p.dl--;p.dt=.5}}
function steal(d,h){if(!h||d.cd>0||d.fall>0||d.ball||Math.hypot(d.x-h.x,d.z-h.z)>1.6)return;d.cd=.7;if(!h.ball)return;
  if(h.dt>0){d.fall=1.5;d.ch=0;if(h===P[0])stat('ankles');say(h===P[0]?'ANKLES BROKEN!':'You got crossed!')}
  else{h.ball=false;h.ch=0;d.ball=true;d.dl=4;d.dt=0;$('meter').style.display='none';say(d===P[0]?'STEAL!':'Stolen!')}}
let mt;function say(s){$('msg').textContent=s;clearTimeout(mt);mt=setTimeout(()=>$('msg').textContent='',1400)}
function release(p){p.ch=0;if(p===P[0])$('meter').style.display='none';const o=P[p===P[0]?1:0],m=p.m,d=Math.hypot(p.x-H.x,p.z-H.z);
  p.ball=false;p.dxn=p.dzn=0;jump(p);
  if(o.y>.4&&Math.hypot(o.x-p.x,o.z-p.z)<2.4){if(o===P[0])stat('blocks');say(o===P[0]?'BLOCKED!':'Shot blocked');o.ball=false;loose={x:p.x,y:2.4,z:p.z,vx:(o.x-p.x),vy:2,vz:(o.z-p.z)};return}
  const perfect=m>=.9&&m<=1,acc=perfect?1:Math.max(.05,Math.min(.85,1-Math.abs(m-.95)*2.2))*(d>R3?.8:1),make=p===P[0]?Math.random()<acc:Math.random()<(m>=.9?1:.4);
  if(p===P[0]&&perfect){stat('perfects');const e=$('perfect');e.classList.remove('go');void e.offsetWidth;e.classList.add('go')}
  flight={t:0,dur:.9,a:{x:p.x,y:2.3,z:p.z},make,by:p,pts:d>R3?3:2,h:1.5+d*.12,off:make?0:.35}}
function reset(who){// who gets ball at top of key
  P[0].x=0;P[0].z=3;P[1].x=0;P[1].z=1.2;P.forEach(p=>{p.ball=false;p.dl=4;p.dt=0;p.fall=0;p.ch=0});P[who].ball=true;P[who].x=0;P[who].z=4;P[1-who].z=2.8;loose=null;flight=null;$('meter').style.display='none'}
function startGame(){show(null);$('hud').classList.remove('hide');if(!ready)init();if(!P.length){P=[mk(0xe03030),mk(0x2a55d0)]}score=[0,0];$('s0').textContent=$('s1').textContent=0;reset(0);running=true;last=performance.now();requestAnimationFrame(loop)}
function endGame(w){running=false;document.exitPointerLock();$('hud').classList.add('hide');alert(w?'You win!':'Bot wins');show('menu')}
function move(p,dx,dz,dt,sp){if(p.air){p.x+=p.jx*dt;p.z+=p.jz*dt;p.mv=0}else{const l=Math.hypot(dx,dz);if(l>0&&!p.fall){dx/=l;dz/=l;p.x+=dx*sp*dt;p.z+=dz*sp*dt;p.ty=Math.atan2(dx,dz);p.mv=1;p.dxn=dx;p.dzn=dz}else{p.mv=0;p.dxn=p.dzn=0}}p.x=Math.max(-7.5,Math.min(7.5,p.x));p.z=Math.max(-6,Math.min(8,p.z))}
function bot(b,h,dt){if(b.fall>0)return;b.ai=(b.ai||0)+dt;const tx=b.ball?0:h.ball?h.x:loose?loose.x:0,hd=Math.hypot(b.x-h.x,b.z-h.z);
  if(b.ball){const d=Math.hypot(b.x-H.x,b.z-H.z);if(!b.ch){if(d>R3-.6)move(b,H.x-b.x+Math.sin(t)*2,H.z-b.z,dt,3.4);else if(b.ai>1.6&&Math.random()<.02){b.ch=1;b.m=0}
      if(b.dl>0&&Math.random()<.012)dribble(b);if(hd<1.5&&Math.random()<.01)b.m=0}else{b.m+=dt*.85;if(b.m>=(b.tgt=b.tgt||(Math.random()<.3?.95:.8+Math.random()*.15))){const m=b.m;b.tgt=0;b.ai=0;release(b)}}}
  else if(h.ball){move(b,h.x-b.x,h.z-b.z,dt,3.6);b.react=(b.react||0)+dt;if(hd<1.5&&h.dt<=0&&b.react>.5){steal(b,h);b.react=0}if(h.ch&&hd<2.5&&b.y<=.01&&Math.random()<.04)jump(b)}
  else if(loose)move(b,loose.x-b.x,loose.z-b.z,dt,3.8)}
function loop(n){if(!running)return;requestAnimationFrame(loop);const dt=Math.min((n-last)/1e3,.05);last=n;t+=dt;const[p,b]=P;
  let dx=0,dz=0;const s=Math.sin(cy),c=Math.cos(cy);if(keys.KeyW){dx-=s;dz-=c}if(keys.KeyS){dx+=s;dz+=c}if(keys.KeyD){dx+=c;dz-=s}if(keys.KeyA){dx-=c;dz+=s}
  move(p,p.ch?0:dx,p.ch?0:dz,dt,p.ball&&p.dt>0?3.4:4.4);bot(b,p,dt);
  P.forEach(q=>{q.dt=Math.max(0,q.dt-dt);q.fall=Math.max(0,q.fall-dt);q.cd=Math.max(0,q.cd-dt);q.vy-=14*dt;q.y=Math.max(0,q.y+q.vy*dt);if(q.y===0&&q.vy<0){q.vy=0;q.air=false}
    if(q.ch){q.m+=q===p?dt*.85:0;if(q===p&&q.m>1.12)release(q)}
    const k=Math.min(1,dt*14),da=((q.ty-q.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;q.yaw+=da*k;
    q.sw+=((q.mv&&!q.air?1:0)-q.sw)*Math.min(1,dt*10);q.ph+=dt*(q.ball&&q.dt>0?7:10)*q.sw;q.fa+=((q.fall>0?1:0)-q.fa)*Math.min(1,dt*12);
    q.g.position.set(q.x,q.y+.25*q.fa,q.z);q.g.rotation.set(-1.4*q.fa,q.yaw,0);
    const w=Math.sin(q.ph)*.7*q.sw,ai=Math.min(1,q.y*3),up=ai*2.4*(q.ch?1:.4);
    q.legs[0].rotation.x=w*(1-ai)+ai*.5;q.legs[1].rotation.x=-w*(1-ai)-ai*.3;q.arms[1].rotation.x=-w*.7-up;
    const at=q.ball?(q.ch?-2.7:-.5-(q.dt>0?Math.abs(Math.sin((.5-q.dt)/.5*Math.PI*1.5))*.7:q.mv?Math.abs(Math.sin(t*5))*.3:0)):w*.7-up;
    q.arms[0].rotation.x+=(at-q.arms[0].rotation.x)*Math.min(1,dt*20)});
  // ball
  const o=P.find(q=>q.ball);
  if(o){const f=o.yaw,hx=o.x+Math.sin(f)*.45-Math.cos(f)*.3,hz=o.z+Math.cos(f)*.45+Math.sin(f)*.3;let y;
    if(o.ch)y=1.9+o.y;else if(o.dt>0)y=.12+Math.abs(Math.sin((.5-o.dt)/.5*Math.PI*1.5))*.95;// real dribble: deep, fast, hard to steal
    else if(o.mv)y=.45+Math.abs(Math.sin(t*5))*.4;// walking bounce (no dribble used)
    else y=1.0;ball.position.set(hx,y,hz)}
  else if(flight){flight.t+=dt/flight.dur;const k=Math.min(1,flight.t),a=flight.a;ball.position.set(a.x+(H.x+flight.off-a.x)*k,a.y+(RIM-a.y)*k+4*flight.h*k*(1-k),a.z+(H.z-a.z)*k);
    if(flight.t>=1){const f=flight;flight=null;if(f.make){const i=f.by===p?0:1;score[i]+=f.pts;$('s'+i).textContent=score[i];if(i===0)stat('made');say(f.pts+' POINTS');
      if(score[i]>=WIN)return endGame(i===0);setTimeout(()=>reset(1-i),900);loose={x:H.x,y:RIM,z:H.z,vx:0,vy:-1,vz:0,dead:1}}else loose={x:H.x,y:RIM,z:H.z,vx:(Math.random()-.5)*3,vy:2,vz:2+Math.random()*2}}}
  else if(loose){const l=loose;l.vy-=14*dt;l.x+=l.vx*dt;l.y+=l.vy*dt;l.z+=l.vz*dt;if(l.y<.12){l.y=.12;l.vy=Math.abs(l.vy)*.6;l.vx*=.9;l.vz*=.9}ball.position.set(l.x,l.y,l.z);
    if(!l.dead)for(const q of P)if(Math.hypot(q.x-l.x,q.z-l.z)<.9&&l.y<1.8){q.ball=true;q.dl=4;loose=null;break}}
  // camera (over-the-shoulder, DBD style)
  const d=3.6,tx=p.x,tz=p.z;const tp=new THREE.Vector3(tx+Math.sin(cy)*d*Math.cos(cp)+Math.cos(cy)*.7,1.7+Math.sin(cp)*d,tz+Math.cos(cy)*d*Math.cos(cp)-Math.sin(cy)*.7);CAM.position.lerp(tp,Math.min(1,dt*16));
  CAM.lookAt(tx+Math.cos(cy)*.7-Math.sin(cy)*3,1.5,tz-Math.sin(cy)*.7-Math.cos(cy)*3);
  // HUD
  if(p.ch||(b.ch&&false)){const m=Math.min(p.m,1);$('fill').style.height=m*100+'%';$('fill').style.background=`hsl(${m*120},90%,50%)`}
  const arc=$('arc');if(p.ball&&!p.ch){const v=new THREE.Vector3(p.x,0,p.z).project(CAM);arc.style.display='block';arc.style.left=(v.x*.5+.5)*innerWidth+'px';arc.style.top=(-v.y*.5+.5)*innerHeight+'px';$('arcf').style.strokeDasharray=`${p.dl/4*100} 100`}else arc.style.display='none';
  R.render(S,CAM)}
