// ===== FIREBASE (paste your config) =====
const FB={apiKey:"AIzaSyCgIU_85HAccqFgZd1u4BQsbOEtY4r00sE",authDomain:"livegame-2212.firebaseapp.com",databaseURL:"https://livegame-2212-default-rtdb.firebaseio.com",projectId:"livegame-2212",storageBucket:"livegame-2212.firebasestorage.app",messagingSenderId:"493917811272",appId:"1:493917811272:web:ab31d9ecc9c631fdcc1e7d"};
let auth,db,rtdb,prof=null,uid=null;
try{firebase.initializeApp(FB);auth=firebase.auth();db=firebase.firestore()}catch(e){console.warn(e)}
try{rtdb=firebase.database()}catch(e){console.warn(e)}
const $=id=>document.getElementById(id),show=id=>{['auth','menu','statp','queue'].forEach(s=>$(s).classList.add('hide'));if(id)$(id).classList.remove('hide');setPresence(id)};
const em=n=>n.toLowerCase().replace(/[^a-z0-9]/g,'')+'@54hoops.app';
const msg=e=>({
  'auth/weak-password':'Password must be at least 6 characters.',
  'auth/email-already-in-use':'That username is taken.',
  'auth/invalid-email':'Enter a username (letters or numbers).',
  'auth/missing-password':'Enter a password.',
  'auth/invalid-credential':'Wrong username or password.',
  'auth/too-many-requests':'Too many tries. Wait a bit and try again.',
  'auth/network-request-failed':'Network problem. Check your connection.'
}[e.code]||'Something went wrong. Try again.');
async function register(n,p){
  const c=await auth.createUserWithEmailAndPassword(em(n),p);
  await db.runTransaction(async t=>{const r=db.doc('counters/users'),s=await t.get(r),k=(s.exists?s.data().n:0)+1;
    t.set(r,{n:k});t.set(db.doc('users/'+c.user.uid),{id:k,name:n,ankles:0,made:0,perfects:0,blocks:0})});
}
$('reg').onclick=async()=>{try{await register($('u').value.trim(),$('p').value)}catch(e){console.error(e);$('err').textContent=msg(e)}};
$('login').onclick=async()=>{try{await auth.signInWithEmailAndPassword(em($('u').value),$('p').value)}catch(e){console.error(e);$('err').textContent=msg(e)}};
// Guests sign in anonymously so the database rules can tell players apart. If that fails, they can still play vs the bot offline.
$('guest').onclick=async()=>{prof=null;try{if(!auth)throw 0;await auth.signInAnonymously()}catch(e){$('who').textContent='Guest (offline)';show('menu')}};
$('out').onclick=()=>{inQ=false;unwatchStats();if(rtdb&&uid){rtdb.ref('presence/'+uid).remove().catch(()=>{});rtdb.ref('queue/'+uid).remove().catch(()=>{})}auth&&auth.signOut();show('auth')};
if(auth)auth.onAuthStateChanged(async u=>{if(!u)return;uid=u.uid;if(u.isAnonymous){prof=null;$('who').textContent='Guest';show('menu');return}
  for(let i=0;i<8;i++){const s=await db.doc('users/'+uid).get();if(s.exists){prof=s.data();break}await new Promise(r=>setTimeout(r,500))}
  if(prof){$('who').textContent=`#${prof.id}  ${prof.name}`;show('menu')}});
function stat(k){if(!prof)return;prof[k]++;db.doc('users/'+uid).update({[k]:firebase.firestore.FieldValue.increment(1)}).catch(()=>{})}
$('stats').onclick=()=>{if(!prof){alert('Log in to track stats');return}
  $('grid').innerHTML=[['ankles','Ankles broken'],['made','Shots made'],['perfects','Perfect shots'],['blocks','Blocks']].map(([k,l])=>`<div><b>${prof[k]}</b><span>${l}</span></div>`).join('');show('statp')};
$('back').onclick=()=>show('menu');
$('bot').onclick=()=>startGame();
// Online queue: waits until you exit (never auto-starts a bot). Live matches aren't wired yet.
$('qt').parentNode.insertAdjacentHTML('beforeend','<p class="sub" id="qs"></p><button id="qbot">Play vs bot while you wait</button><button id="qexit" class="ghost">Exit queue</button>');
let inQ=false,sw=[],SO=0,SQ=0,SG=0;
function setPresence(id){if(!rtdb||!uid||id==='auth')return;const r=rtdb.ref('presence/'+uid);r.onDisconnect().remove();r.set({s:id==='queue'?'queue':id===null?'bot':'menu'}).catch(()=>{})}
function renderStats(){$('qs').textContent=`${SO} online · ${SQ} in queue · ${SG} game${SG===1?'':'s'} in progress`}
function watchStats(){if(sw.length||!rtdb)return;const p=rtdb.ref('presence'),q=rtdb.ref('queue');
  p.on('value',s=>{SO=SG=0;s.forEach(c=>{SO++;if((c.val()||{}).s==='bot')SG++});renderStats()},()=>{});
  q.on('value',s=>{SQ=s.numChildren();renderStats();pair(s)},()=>{});sw=[p,q]}
function unwatchStats(){sw.forEach(r=>r.off());sw=[]}
function leaveQueue(){inQ=false;unwatchStats();if(rtdb&&uid)rtdb.ref('queue/'+uid).remove().catch(()=>{});show('menu')}
$('online').onclick=()=>{inQ=true;show('queue');$('qs').textContent='';
  if(rtdb&&uid){const r=rtdb.ref('queue/'+uid);r.onDisconnect().remove();r.set({name:myName(),t:firebase.database.ServerValue.TIMESTAMP}).catch(()=>{});watchStats();$('qt').textContent='Waiting for an opponent…'}
  else $('qt').textContent='Online is unavailable right now. You can still play the bot.'};
$('qexit').onclick=leaveQueue;
$('qbot').onclick=()=>startGame();
document.body.insertAdjacentHTML('beforeend','<div id="xh" style="position:fixed;left:50%;top:50%;width:8px;height:8px;margin:-4px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px #0008;display:none;z-index:5;pointer-events:none"></div>');

// ===== ONLINE 1v1 (moves + shots; possession flips after every shot; no steals/blocks yet) =====
let NET=null,JN=null,pairing=false,OPP='BOT';
const TS=()=>firebase.database.ServerValue.TIMESTAMP,rd=v=>Math.round(v*1e3)/1e3,myName=()=>prof?prof.name:'Guest '+(uid||'').slice(0,3).toUpperCase();
const PAL=[0xe03030,0x2a55d0,0x20a050,0xe0a020,0x9040d0,0x20b0c0,0xe06020,0xd040a0],hexc=c=>'#'+c.toString(16).padStart(6,'0');
function cols(a,b){const h=s=>{let x=0;for(const ch of s)x=(x*31+ch.charCodeAt(0))>>>0;return x%8};let i=h(a),j=h(b);if(i===j){if(a<b)j=(j+1)%8;else i=(i+1)%8}return[PAL[i],PAL[j]]}
function enqueue(){const r=rtdb.ref('queue/'+uid);r.onDisconnect().remove();r.set({name:myName(),t:TS()}).catch(()=>{})}
// newest joiner pairs with the oldest free waiting player; the older one just sees its queue entry get a match id
function pair(s){if(!inQ||NET||JN||pairing||!uid)return;const me=s.child(uid).val();if(!me)return;
  if(me.match){join(me.match);return}
  let best=null;s.forEach(c=>{const v=c.val();if(c.key!==uid&&v&&!v.match&&v.t<me.t&&(!best||v.t<best.v.t))best={k:c.key,v}});
  if(!best)return;pairing=true;const m=uid+'_'+best.k+'_'+Date.now();
  rtdb.ref('queue/'+best.k+'/match').set(m).then(()=>rtdb.ref('matches/'+m+'/players').set({host:uid,guest:best.k})).then(()=>join(m)).catch(()=>{pairing=false})}
function join(m){if(NET||JN)return;pairing=false;inQ=false;unwatchStats();rtdb.ref('queue/'+uid).remove().catch(()=>{});
  const [h,g]=m.split('_');const J=JN={m,base:'matches/'+m,opp:uid===h?g:h,host:uid===h,e:-1,n:0,my:0,onn:0,acc:0,hold:0,refs:[],go:false,on:''};
  const abort=()=>{if(JN!==J||J.go)return;J.refs.forEach(r=>r.off());rtdb.ref(J.base).remove().catch(()=>{});JN=null;inQ=true;enqueue();watchStats()};setTimeout(abort,15000);
  let tries=0;const put=()=>rtdb.ref(J.base+'/names/'+uid).set(myName()).then(()=>{if(JN!==J)return;rtdb.ref(J.base).onDisconnect().remove();
    const r=rtdb.ref(J.base+'/names/'+J.opp);r.on('value',s=>{if(JN===J&&!J.go&&s.val()){J.go=true;J.on=s.val();beginNet()}},()=>{});J.refs.push(r)},()=>{if(JN===J&&tries++<25)setTimeout(put,300)});put()}
function beginNet(){NET=JN;const B=NET.base,L=(p,fn)=>{const r=rtdb.ref(B+'/'+p);r.on('value',fn,()=>{});NET.refs.push(r)};
  startGame();// replaces a running bot game if there is one
  rtdb.ref(B+'/score/'+uid).set({n:0,t:TS()}).catch(()=>{});
  L('state/'+NET.opp,s=>{const v=s.val();if(v&&P[1])P[1].tgt=v});
  [[uid,0],[NET.opp,1]].forEach(([k,i])=>L('score/'+k,s=>{const n=(s.val()||{}).n||0;$('s'+i).textContent=n;if(!i)NET.my=Math.max(NET.my,n);if(n>=WIN)endGame(!i)}));
  L('ev/'+NET.opp,s=>{const v=s.val();if(!v||v.n<=NET.onn)return;NET.onn=v.n;const q=P[1],d=Math.hypot(v.x-H.x,v.z-H.z);q.ball=false;q.ch=0;flight={t:0,dur:.9,a:{x:v.x,y:2.3,z:v.z},make:!!v.k,by:q,pts:d>R3?3:2,h:1.5+d*.12,ox:v.ox,oz:v.oz}});
  L('players',s=>{if(!s.exists())endGame(true,'Opponent left')})}
function netTick(p,dt){NET.acc+=dt;if(NET.acc<.06)return;NET.acc=0;NET.sent=NET.e;rtdb.ref(NET.base+'/state/'+uid).set({x:rd(p.x),z:rd(p.z),y:rd(Math.min(1.2,p.y)),yaw:rd(p.yaw),t:TS(),e:NET.e}).catch(()=>{})}
function netShot(s){rtdb.ref(NET.base+'/ev/'+uid).set({n:++NET.n,k:s.make?1:0,x:rd(s.a.x),z:rd(s.a.z),ox:rd(s.ox),oz:rd(s.oz),t:TS()}).catch(()=>{})}
function netEnd(f){const mine=f.by===P[0];if(f.make){say(f.pts+' POINTS');if(mine){stat('made');rtdb.ref(NET.base+'/score/'+uid).set({n:NET.my+f.pts,t:TS()}).catch(()=>{})}}
  setTimeout(()=>{if(NET&&running)reset(mine?1:0)},900)}
function netClose(){const n=NET;NET=null;JN=null;if(!n)return;n.refs.forEach(r=>r.off());rtdb.ref(n.base).onDisconnect().cancel();rtdb.ref(n.base).remove().catch(()=>{})}

// ===== GAME =====
const H={x:0,z:-6.2},RIM=3.05,R3=6.75,WIN=11;
let R,S,CAM,P=[],ball,keys={},cy=0,cp=.25,running=false,last=0,loose=null,flight=null,score=[0,0],t=0,ready=false;
function tex(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const x=new THREE.CanvasTexture(c);x.anisotropy=8;return x}
function init(){
  R=new THREE.WebGLRenderer({canvas:$('c'),antialias:true});R.setPixelRatio(devicePixelRatio);R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;R.outputEncoding=THREE.sRGBEncoding;R.toneMapping=THREE.ACESFilmicToneMapping;
  S=new THREE.Scene();S.fog=new THREE.Fog(0xcfe4f5,28,75);
  // outdoor: sky dome, grass, trees
  const skyT=tex(8,256,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#3d7fd1');gr.addColorStop(.5,'#9cc7ee');gr.addColorStop(.52,'#cfe4f5');gr.addColorStop(1,'#cfe4f5');g.fillStyle=gr;g.fillRect(0,0,w,h)});
  S.add(new THREE.Mesh(new THREE.SphereGeometry(70,24,16),new THREE.MeshBasicMaterial({map:skyT,side:THREE.BackSide,fog:false,depthWrite:false})));
  const grass=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshStandardMaterial({color:0x3f7a30,roughness:1}));grass.rotation.x=-Math.PI/2;grass.position.y=-.03;grass.receiveShadow=true;S.add(grass);
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2+.2,r=15+Math.random()*8,tr=new THREE.Group(),k=new THREE.Mesh(new THREE.CylinderGeometry(.2,.3,2.2,8),new THREE.MeshStandardMaterial({color:0x5b3a1e})),l=new THREE.Mesh(new THREE.SphereGeometry(1.6+Math.random(),12,10),new THREE.MeshStandardMaterial({color:0x2f6b2f,roughness:1}));k.position.y=1.1;l.position.y=3.4;l.castShadow=k.castShadow=true;tr.add(k,l);tr.position.set(Math.cos(a)*r,0,Math.sin(a)*r+.5);S.add(tr)}
  CAM=new THREE.PerspectiveCamera(65,1,.1,100);
  const L=new THREE.DirectionalLight(0xfff4e0,1.6);L.position.set(8,18,10);L.castShadow=true;L.shadow.mapSize.set(2048,2048);const sc=L.shadow.camera;sc.left=-12;sc.right=12;sc.top=12;sc.bottom=-12;sc.far=50;sc.updateProjectionMatrix();S.add(L,new THREE.HemisphereLight(0xbfd9ff,0x4a6b3a,.9));
  const court=tex(512,512,(g,w,h)=>{g.fillStyle='#4b5260';g.fillRect(0,0,w,h);for(let j=0;j<6000;j++){g.fillStyle=Math.random()<.5?'rgba(0,0,0,.12)':'rgba(255,255,255,.07)';g.fillRect(Math.random()*w,Math.random()*h,2,2)}});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(16,16),new THREE.MeshStandardMaterial({map:court,roughness:.9,metalness:0}));floor.rotation.x=-Math.PI/2;floor.position.z=.5;floor.receiveShadow=true;S.add(floor);
  const white=new THREE.MeshBasicMaterial({color:0xffffff,side:2});
  const ring=new THREE.Mesh(new THREE.RingGeometry(R3-.04,R3+.04,96,1,Math.PI*.12,Math.PI*.76),white);ring.rotation.x=-Math.PI/2;ring.rotation.z=Math.PI/2+Math.PI*.5;ring.position.set(H.x,.01,H.z);
  // 3pt arc facing +z: rebuild as full ring clipped by court bounds
  const full=new THREE.Mesh(new THREE.RingGeometry(R3-.04,R3+.04,96),white);full.rotation.x=-Math.PI/2;full.position.set(H.x,.01,H.z);S.add(full);
  const key=new THREE.Mesh(new THREE.PlaneGeometry(4.9,5.8),new THREE.MeshBasicMaterial({color:0xb03a2e,transparent:true,opacity:.75}));key.rotation.x=-Math.PI/2;key.position.set(0,.008,H.z+2.3);S.add(key);
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
function label(t,c){const cv=document.createElement('canvas');cv.width=256;cv.height=64;const g=cv.getContext('2d');g.font='bold 34px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=7;g.strokeStyle='rgba(0,0,0,.8)';g.fillStyle=hexc(c);g.strokeText(t,128,32);g.fillText(t,128,32);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthTest:false,fog:false}));s.scale.set(1.5,.375,1);s.position.set(0,2.15,0);s.renderOrder=9;return s}
function mk(col,name){const g=new THREE.Group(),sk=0xc68642,m=c=>new THREE.MeshStandardMaterial({color:c,roughness:.6});g.rotation.order='YXZ';
  const add=(geo,c,x,y,z,pv)=>{if(pv)geo.translate(0,-pv/2,0);const o=new THREE.Mesh(geo,m(c));o.position.set(x,y,z);o.castShadow=true;g.add(o);return o};
  add(new THREE.CylinderGeometry(.24,.2,.6,20).scale(1,1,.62),col,0,1.2,0);add(new THREE.SphereGeometry(.15,20,16),sk,0,1.66,0);add(new THREE.CylinderGeometry(.2,.21,.3,20).scale(1,1,.7),0x111111,0,.85,0);add(new THREE.CylinderGeometry(.06,.07,.12,10),sk,0,1.53,0);[-.3,.3].forEach(x=>add(new THREE.SphereGeometry(.075,12,10),col,x,1.47,0));
  const legs=[-.12,.12].map(x=>add(new THREE.CylinderGeometry(.08,.06,.8,12),sk,x,.8,0,.8)),arms=[-.3,.3].map(x=>add(new THREE.CylinderGeometry(.055,.045,.55,10),sk,x,1.47,0,.55));
  legs.forEach(l=>{const s=new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),m(0xffffff));s.scale.set(1,.6,1.5);s.position.set(0,-.8,.05);s.castShadow=true;l.add(s)});
  g.add(label(name,col));S.add(g);return{g,legs,arms,x:0,z:0,y:0,vy:0,yaw:0,ty:0,ball:false,dl:4,dt:0,fall:0,cd:0,ch:0,m:0,mv:0,sw:0,ph:0,fa:0,air:false,jx:0,jz:0,dxn:0,dzn:0}}
function jump(p){if(p.y<=.01&&!p.fall){p.vy=5;p.air=true;p.jx=(p.dxn||0)*4.2;p.jz=(p.dzn||0)*4.2}}// direction locked at takeoff
function dribble(p){if(p.ball&&p.dl>0&&p.dt<=0&&!p.fall&&!p.ch){p.dl--;p.dt=.5}}
function steal(d,h){if(NET||!h||d.cd>0||d.fall>0||d.ball||Math.hypot(d.x-h.x,d.z-h.z)>1.6)return;d.cd=.7;if(!h.ball)return;
  if(h.dt>0){d.fall=1.5;d.ch=0;if(h===P[0])stat('ankles');say(h===P[0]?'ANKLES BROKEN!':'You got crossed!')}
  else{h.ball=false;h.ch=0;d.ball=true;d.dl=4;d.dt=0;$('meter').style.display='none';say(d===P[0]?'STEAL!':'Stolen!')}}
let mt;function say(s){$('msg').textContent=s;clearTimeout(mt);mt=setTimeout(()=>$('msg').textContent='',1400)}
function release(p){p.ch=0;if(p===P[0])$('meter').style.display='none';const o=P[p===P[0]?1:0],m=p.m,d=Math.hypot(p.x-H.x,p.z-H.z);
  p.ball=false;p.dxn=p.dzn=0;jump(p);
  if(!NET&&o.y>.4&&Math.hypot(o.x-p.x,o.z-p.z)<2.4){if(o===P[0])stat('blocks');say(o===P[0]?'BLOCKED!':'Shot blocked');o.ball=false;loose={x:p.x,y:2.4,z:p.z,vx:(o.x-p.x),vy:2,vz:(o.z-p.z)};return}
  // Aim is real: the ball goes where you point (the dot) and release timing sets depth. No auto-aim.
  let fx,fz;if(p===P[0]){const ax=Math.cos(cy)*.7-Math.sin(cy)*d,az=-Math.sin(cy)*.7-Math.cos(cy)*d,al=Math.hypot(ax,az)||1;fx=ax/al;fz=az/al}else{const ae=(Math.random()-.5)*.24,hx=(H.x-p.x)/d,hz=(H.z-p.z)/d;fx=hx*Math.cos(ae)-hz*Math.sin(ae);fz=hx*Math.sin(ae)+hz*Math.cos(ae)}
  const dep=Math.max(-2.5,Math.min(2.5,(m-.95)*6)),ox=p.x+fx*(d+dep)-H.x,oz=p.z+fz*(d+dep)-H.z,perfect=m>=.9&&m<=1,make=Math.hypot(ox,oz)<=.5+.04*d;
  if(p===P[0]&&perfect&&make){stat('perfects');const e=$('perfect');e.classList.remove('go');void e.offsetWidth;e.classList.add('go')}
  flight={t:0,dur:.9,a:{x:p.x,y:2.3,z:p.z},make,by:p,pts:d>R3?3:2,h:1.5+d*.12,ox:make?ox*.2:Math.max(-3,Math.min(3,ox)),oz:make?oz*.2:Math.max(-3,Math.min(3,oz))};
  if(NET&&p===P[0])netShot(flight)}
// Spawn slots. The database rules only accept a reset at x=0 with z between 1 and 4.5, so the two slots differ in z only (2m apart).
const SP={car:4.4,def:2.4,min:1.5};
function spawn(who){const c=P[who],d=P[1-who];c.x=d.x=0;c.z=SP.car;d.z=SP.def}
// Spawn check: if the opponent's spawn lands on mine (e.g. possession out of sync), the guest hops to the free slot. Only right after my own reset;
// the epoch bump keeps the database rules happy (skipped if my last bump hasn't been sent yet, since the rules want exactly +1).
function sepCheck(p,q){if(!NET||NET.host||performance.now()-NET.rt>2000||Math.hypot(p.x-q.x,p.z-q.z)>=SP.min)return;
  p.x=0;p.z=Math.abs(SP.car-q.z)>=Math.abs(SP.def-q.z)?SP.car:SP.def;if(NET.sent===NET.e)NET.e++;NET.hold=performance.now()+250}
function reset(who){// who gets ball at top of key
  P.forEach(p=>{p.ball=false;p.dl=4;p.dt=0;p.fall=0;p.ch=0});P[who].ball=true;spawn(who);loose=null;flight=null;$('meter').style.display='none';if(NET){NET.e++;NET.hold=performance.now()+250;NET.rt=performance.now()}}
function startGame(){const was=running;show(null);$('hud').classList.remove('hide');if(!ready)init();OPP=NET?NET.on:'BOT';
  const me=myName(),[c0,c1]=cols(me,OPP);P.forEach(q=>S.remove(q.g));P=[mk(c0,me),mk(c1,OPP)];P[1].rem=!!NET;score=[0,0];
  $('score').innerHTML='<small id="n0"></small> <span id="s0">0</span> : <span id="s1">0</span> <small id="n1"></small>';
  [[me,c0],[OPP,c1]].forEach(([n,c],i)=>{const e=$('n'+i);e.textContent=n;e.style.color=hexc(c)});
  reset(NET&&!NET.host?1:0);$('xh').style.display='block';running=true;last=performance.now();if(!was)requestAnimationFrame(loop)}
function endGame(w,msg){if(!running)return;running=false;document.exitPointerLock();$('hud').classList.add('hide');$('xh').style.display='none';if(NET)netClose();alert(msg||(w?'You win!':OPP+' wins'));show(inQ?'queue':'menu')}
function move(p,dx,dz,dt,sp){if(p.air){p.x+=p.jx*dt;p.z+=p.jz*dt;p.mv=0}else{const l=Math.hypot(dx,dz);if(l>0&&!p.fall){dx/=l;dz/=l;p.x+=dx*sp*dt;p.z+=dz*sp*dt;p.ty=Math.atan2(dx,dz);p.mv=1;p.dxn=dx;p.dzn=dz}else{p.mv=0;p.dxn=p.dzn=0}}p.x=Math.max(-7.5,Math.min(7.5,p.x));p.z=Math.max(-6,Math.min(8,p.z))}
function bot(b,h,dt){if(b.fall>0)return;b.ai=(b.ai||0)+dt;const tx=b.ball?0:h.ball?h.x:loose?loose.x:0,hd=Math.hypot(b.x-h.x,b.z-h.z);
  if(b.ball){const d=Math.hypot(b.x-H.x,b.z-H.z);if(!b.ch){if(d>R3-.6)move(b,H.x-b.x+Math.sin(t)*2,H.z-b.z,dt,3.4);else if(b.ai>1.6&&Math.random()<.02){b.ch=1;b.m=0}
      if(b.dl>0&&Math.random()<.012)dribble(b);if(hd<1.5&&Math.random()<.01)b.m=0}else{b.m+=dt*.85;if(b.m>=(b.tgt=b.tgt||(Math.random()<.3?.95:.8+Math.random()*.15))){const m=b.m;b.tgt=0;b.ai=0;release(b)}}}
  else if(h.ball){// hang back ~2m toward the hoop; only a close, sustained contest can steal
    const dd=Math.hypot(H.x-h.x,H.z-h.z)||1,gx=h.x+(H.x-h.x)/dd*2.1,gz=h.z+(H.z-h.z)/dd*2.1;
    if(Math.hypot(gx-b.x,gz-b.z)>.4)move(b,gx-b.x,gz-b.z,dt,2.7);else move(b,0,0,dt,0);
    b.react=hd>2?0:(b.react||0)+dt;if(hd<1.4&&h.dt<=0&&b.react>2.5&&Math.random()<.03){steal(b,h);b.react=0}
    if(h.ch&&hd<2.5&&b.y<=.01&&Math.random()<.015)jump(b)}
  else if(loose)move(b,loose.x-b.x,loose.z-b.z,dt,3.8)}
function loop(n){if(!running)return;requestAnimationFrame(loop);const dt=Math.min((n-last)/1e3,.05);last=n;t+=dt;const[p,b]=P;
  let dx=0,dz=0;const s=Math.sin(cy),c=Math.cos(cy);if(keys.KeyW){dx-=s;dz-=c}if(keys.KeyS){dx+=s;dz+=c}if(keys.KeyD){dx+=c;dz-=s}if(keys.KeyA){dx-=c;dz+=s}
  const hold=NET&&performance.now()<NET.hold;move(p,p.ch||hold?0:dx,p.ch||hold?0:dz,dt,p.ball&&p.dt>0?3.4:4.4);NET?netTick(p,dt):bot(b,p,dt);
  P.forEach(q=>{q.dt=Math.max(0,q.dt-dt);q.fall=Math.max(0,q.fall-dt);q.cd=Math.max(0,q.cd-dt);q.vy-=14*dt;q.y=Math.max(0,q.y+q.vy*dt);if(q.y===0&&q.vy<0){q.vy=0;q.air=false}
    if(q.rem&&q.tgt){const r=q.tgt;if(r.e!==q.re){q.re=r.e;q.x=r.x;q.z=r.z;sepCheck(p,q)}const k2=Math.min(1,dt*15),mx=r.x-q.x,mz=r.z-q.z;q.x+=mx*k2;q.z+=mz*k2;q.y=r.y;q.mv=Math.hypot(mx,mz)>.06?1:0;q.air=r.y>.05;q.ty=r.yaw}
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
  else if(flight){flight.t+=dt/flight.dur;const k=Math.min(1,flight.t),a=flight.a;ball.position.set(a.x+(H.x+flight.ox-a.x)*k,a.y+(RIM-a.y)*k+4*flight.h*k*(1-k),a.z+(H.z+flight.oz-a.z)*k);
    if(flight.t>=1){const f=flight;flight=null;if(NET){netEnd(f);return}if(f.make){const i=f.by===p?0:1;score[i]+=f.pts;$('s'+i).textContent=score[i];if(i===0)stat('made');say(f.pts+' POINTS');
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
