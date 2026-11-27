// ===== FIREBASE (paste your config) =====
const FB={apiKey:"AIzaSyCgIU_85HAccqFgZd1u4BQsbOEtY4r00sE",authDomain:"livegame-2212.firebaseapp.com",databaseURL:"https://livegame-2212-default-rtdb.firebaseio.com",projectId:"livegame-2212",storageBucket:"livegame-2212.firebasestorage.app",messagingSenderId:"493917811272",appId:"1:493917811272:web:ab31d9ecc9c631fdcc1e7d"};
let auth,db,rtdb,prof=null,uid=null,svOff=0;
try{firebase.initializeApp(FB);auth=firebase.auth();db=firebase.firestore()}catch(e){console.warn(e)}
try{rtdb=firebase.database();rtdb.ref('.info/serverTimeOffset').on('value',s=>{svOff=+s.val()||0},()=>{})}catch(e){console.warn(e)}

// ===== helpers =====
const $=id=>document.getElementById(id),nowS=()=>Date.now()+svOff;
const cl=(v,a,b)=>v<a?a:v>b?b:v,lp=(a,b,k)=>a+(b-a)*k,sm=x=>{x=cl(x,0,1);return x*x*(3-2*x)};
const wr=a=>{a%=Math.PI*2;return a>Math.PI?a-Math.PI*2:a<-Math.PI?a+Math.PI*2:a};
const mx3=(a,b,k)=>[lp(a[0],b[0],k),lp(a[1],b[1],k),lp(a[2],b[2],k)];
// game state (declared early so the input handlers below can use it)
const H={x:0,z:-6.2},RIM=3.05,R3=6.75,WIN=11,DUR=.5;
let R,S,CAM,P=[],ball,keys={},cy=0,cp=.25,running=false,paused=false,last=0,loose=null,flight=null,score=[0,0],t=0,ready=false,raf=0,togSpr=false,lastUnlock=0,mt;
let NET=null,JN=null,pairing=false,OPP='BOT';

// ===== UI added by this script (settings, Esc menu, queue list) =====
document.body.insertAdjacentHTML('beforeend',`
<div id="settings" class="screen hide"><div class="card wide">
<h1>Settings</h1>
<div class="tabs"><button id="tabc" class="on">Controls</button><button id="tabu">User settings</button></div>
<div id="pc"><div id="binds"></div><p class="help" id="bindnote"></p><button id="resetb" class="ghost">Reset controls</button></div>
<div id="pu" class="hide"><p class="sub" id="acct"></p>
<label class="opt">Mouse sensitivity <b id="sensv"></b><input id="sens" type="range" min="0.3" max="2.5" step="0.05"></label>
<label class="opt check"><input id="inv" type="checkbox">Invert vertical look</label>
<label class="opt check"><input id="togs" type="checkbox">Toggle sprint (tap to start and stop)</label>
<label class="opt check"><input id="fx" type="checkbox">Widen the view while sprinting</label></div>
<button id="sback">Back</button></div></div>
<div id="pause" class="screen hide"><div class="card"><h1 id="ptitle">Paused</h1><p class="sub" id="psub"></p>
<button id="rok">Continue</button><button id="rmenu" class="ghost">Main Menu</button><p class="help" id="phelp">Press Esc again to continue</p></div></div>
<div id="lockhint" class="hide">Click the game to capture your mouse</div>
<div id="xh" style="position:fixed;left:50%;top:50%;width:8px;height:8px;margin:-4px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px #0008;display:none;z-index:5;pointer-events:none"></div>`);
$('stats').insertAdjacentHTML('afterend','<button id="opts">Settings</button>');
$('qt').parentNode.insertAdjacentHTML('beforeend','<p class="sub" id="qs"></p><ul id="qlist"></ul><button id="qbot">Play vs bot while you wait</button><button id="qexit" class="ghost">Exit queue</button>');
const SCR=['auth','menu','statp','queue','settings'];
const show=id=>{SCR.forEach(s=>$(s).classList.add('hide'));if(id)$(id).classList.remove('hide');setPresence(id)};

// ===== SETTINGS (key binds + user settings, saved in this browser) =====
const ACTS=[['fwd','Move forward'],['back','Move back'],['left','Move left'],['right','Move right'],['sprint','Sprint'],['jump','Jump / block'],['dribble','Dribble (switches hands)'],['shoot','Shoot (hold, release)'],['steal','Steal']];
const DEF={binds:{fwd:['KeyW',null],back:['KeyS',null],left:['KeyA',null],right:['KeyD',null],sprint:['ShiftLeft',null],jump:['Space',null],dribble:['KeyE',null],shoot:['KeyF',null],steal:['KeyR','Mouse0']},sens:1,invert:false,toggleSprint:false,fovFx:true};
const RES=/^(Escape|Control|Meta|OS)/;// reserved: Esc is the menu, Ctrl/Meta are browser shortcuts
function loadSet(){const s=JSON.parse(JSON.stringify(DEF));
  try{const r=JSON.parse(localStorage.getItem('hoops.settings')||'null');if(r&&typeof r==='object'){
    if(r.binds&&typeof r.binds==='object')for(const a in s.binds){const b=r.binds[a];if(Array.isArray(b))s.binds[a]=[0,1].map(i=>typeof b[i]==='string'&&b[i].length<24&&!RES.test(b[i])?b[i]:null)}
    if(typeof r.sens==='number'&&isFinite(r.sens))s.sens=cl(r.sens,.3,2.5);s.invert=!!r.invert;s.toggleSprint=!!r.toggleSprint;if(typeof r.fovFx==='boolean')s.fovFx=r.fovFx}}catch(e){}
  const seen={};for(const a in s.binds)s.binds[a]=s.binds[a].map(c=>{if(!c||seen[c])return null;seen[c]=1;return c});return s}
let set=loadSet(),cap=null,capEnd=0;
const save=()=>{try{localStorage.setItem('hoops.settings',JSON.stringify(set))}catch(e){}};
function keyName(c){if(!c)return '—';if(c==='Mouse0')return 'Left click';if(c==='Mouse1')return 'Middle click';if(c==='Mouse2')return 'Right click';if(/^Mouse/.test(c))return 'Mouse '+(+c.slice(5)+1);
  const m={ShiftLeft:'Left Shift',ShiftRight:'Right Shift',AltLeft:'Left Alt',AltRight:'Right Alt',ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right'};
  return m[c]||c.replace(/^(Key|Digit)/,'').replace(/^Numpad/,'Num ').replace(/([a-z])([A-Z])/g,'$1 $2')}
const actsOf=c=>ACTS.map(a=>a[0]).filter(a=>set.binds[a].includes(c));
const anyDown=a=>set.binds[a].some(c=>c&&keys[c]);
function updHelp(){const k=a=>keyName(set.binds[a].find(Boolean)||null);
  $('menu').querySelector('.help').textContent=`${k('fwd')} ${k('left')} ${k('back')} ${k('right')} move · Mouse look · ${k('sprint')} sprint · ${k('dribble')} dribble (switches hands, 4 max) · Hold ${k('shoot')} to shoot, release at the top · ${k('steal')} steal · ${k('jump')} jump/block · Esc pause`}
function missing(){const m=ACTS.filter(([a])=>!set.binds[a].some(Boolean)).map(x=>x[1]);return m.length?'No key set for: '+m.join(', '):''}
function renderBinds(){const b=$('binds');b.textContent='';
  ACTS.forEach(([a,l])=>{const r=document.createElement('div');r.className='bind';const s=document.createElement('span');s.textContent=l;r.appendChild(s);
    [0,1].forEach(i=>{const on=cap&&cap.a===a&&cap.i===i,k=document.createElement('button');k.className='key'+(on?' on':'');k.dataset.a=a;k.dataset.i=i;k.textContent=on?'Press a key…':keyName(set.binds[a][i]);k.onclick=()=>startCap(a,i);r.appendChild(k)});b.appendChild(r)})}
function startCap(a,i){if(performance.now()-capEnd<300)return;cap={a,i,t:performance.now()};$('bindnote').textContent='Press a key or mouse button. Esc cancels · Delete clears.';renderBinds()}
function assign(code){// a key can only do one thing, so it is taken from any other action
  if(code){for(const a in set.binds)set.binds[a]=set.binds[a].map(c=>c===code?null:c);set.binds[cap.a][cap.i]=code}else set.binds[cap.a][cap.i]=null;
  cap=null;capEnd=performance.now();save();renderBinds();updHelp();$('bindnote').textContent=missing()}
function capKey(e){e.preventDefault();
  if(e.code==='Escape'){cap=null;renderBinds();$('bindnote').textContent=missing();return}
  if(e.code==='Delete'||e.code==='Backspace')return assign(null);
  if(RES.test(e.code)){$('bindnote').textContent='Esc, Ctrl and Meta keys are reserved. Pick another key.';return}
  assign(e.code)}
function tab(x){$('pc').classList.toggle('hide',x!=='c');$('pu').classList.toggle('hide',x!=='u');$('tabc').classList.toggle('on',x==='c');$('tabu').classList.toggle('on',x==='u')}
function syncUser(){$('acct').textContent=prof?'Signed in as '+prof.name:'Playing as a guest';$('sens').value=set.sens;$('sensv').textContent=set.sens.toFixed(2)+'x';$('inv').checked=set.invert;$('togs').checked=set.toggleSprint;$('fx').checked=set.fovFx}
$('opts').onclick=()=>{cap=null;tab('c');renderBinds();syncUser();$('bindnote').textContent=missing();show('settings')};
$('sback').onclick=()=>{cap=null;show('menu')};
$('tabc').onclick=()=>{cap=null;renderBinds();tab('c')};$('tabu').onclick=()=>{cap=null;syncUser();tab('u')};
$('resetb').onclick=()=>{set.binds=JSON.parse(JSON.stringify(DEF.binds));cap=null;save();renderBinds();updHelp();$('bindnote').textContent=''};
$('sens').oninput=()=>{set.sens=cl(+$('sens').value||1,.3,2.5);$('sensv').textContent=set.sens.toFixed(2)+'x';save()};
$('inv').onchange=()=>{set.invert=$('inv').checked;save()};$('togs').onchange=()=>{set.toggleSprint=$('togs').checked;togSpr=false;save()};$('fx').onchange=()=>{set.fovFx=$('fx').checked;save()};
updHelp();

// ===== LOGIN / MENU =====
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
$('out').onclick=()=>{inQ=false;cancelJoin();unwatchStats();stopHB();if(rtdb&&uid){rtdb.ref('presence/'+uid).remove().catch(()=>{});rtdb.ref('queue/'+uid).remove().catch(()=>{})}uid=null;auth&&auth.signOut();show('auth')};
if(auth)auth.onAuthStateChanged(async u=>{if(!u)return;uid=u.uid;if(u.isAnonymous){prof=null;$('who').textContent='Guest';show('menu');return}
  for(let i=0;i<8;i++){const s=await db.doc('users/'+uid).get();if(s.exists){prof=s.data();break}await new Promise(r=>setTimeout(r,500))}
  if(prof){$('who').textContent=`#${prof.id}  ${prof.name}`;show('menu')}});
function stat(k){if(!prof)return;prof[k]++;db.doc('users/'+uid).update({[k]:firebase.firestore.FieldValue.increment(1)}).catch(()=>{})}
$('stats').onclick=()=>{if(!prof){alert('Log in to track stats');return}
  $('grid').innerHTML=[['ankles','Ankles broken'],['made','Shots made'],['perfects','Perfect shots'],['blocks','Blocks']].map(([k,l])=>`<div><b>${prof[k]}</b><span>${l}</span></div>`).join('');show('statp')};
$('back').onclick=()=>show('menu');
$('bot').onclick=()=>startGame();

// ===== ONLINE QUEUE =====
// A waiting player sends a heartbeat. Entries that stop beating are hidden from the list and ignored when pairing, then deleted by
// whoever else is waiting. A background tab may only run its timers about once a minute, so both cutoffs are longer than that.
const TS=()=>firebase.database.ServerValue.TIMESTAMP,rd=v=>Math.round(v*1e3)/1e3;
const myName=()=>(prof?String(prof.name):'Guest '+(uid||'').slice(0,3).toUpperCase()).slice(0,20)||'Player';
const BEAT=10000,LIVE=75000,DEAD=82000,dodge={};
let inQ=false,sw=[],SO=0,SG=0,QS=null,hbT=0,connected=false;
try{rtdb&&rtdb.ref('.info/connected').on('value',s=>{connected=!!s.val();if(!connected&&NET)NET.dropped=true},()=>{})}catch(e){}
function setPresence(id){if(!rtdb||!uid||id==='auth')return;const r=rtdb.ref('presence/'+uid);r.onDisconnect().remove();r.set({s:id==='queue'?'queue':id===null?'bot':'menu'}).catch(()=>{})}
const lastSeen=v=>v.hb||v.t||0;
function waiting(){const a=[],now=nowS();
  if(QS)QS.forEach(c=>{const v=c.val();if(v&&v.name&&typeof v.t==='number'&&!v.match&&(c.key===uid||now-lastSeen(v)<LIVE))a.push({k:c.key,v})});
  return a.sort((x,y)=>x.v.t-y.v.t||(x.k<y.k?-1:1))}
function renderQueue(){if(!QS)return;const w=waiting(),ul=$('qlist');
  $('qs').textContent=`${SO} online · ${w.length} in queue · ${SG} playing`;ul.textContent='';
  w.forEach(e=>{const li=document.createElement('li');li.textContent=e.k===uid?e.v.name+' (you)':e.v.name;if(e.k===uid)li.className='me';ul.appendChild(li)})}
function sweep(){if(!QS)return;const now=nowS();QS.forEach(c=>{if(c.key!==uid&&now-lastSeen(c.val()||{})>DEAD)rtdb.ref('queue/'+c.key).remove().catch(()=>{})})}
function enqueue(){if(!rtdb||!uid)return;const r=rtdb.ref('queue/'+uid);r.onDisconnect().remove();r.set({name:myName(),t:TS(),hb:TS()}).catch(()=>{})}
function unqueue(){if(!rtdb||!uid)return;const r=rtdb.ref('queue/'+uid);r.onDisconnect().cancel();r.remove().catch(()=>{})}
function stopHB(){clearInterval(hbT);hbT=0}
function startHB(){stopHB();hbT=setInterval(()=>{if(!inQ||!uid||!connected||!QS)return;
  if(QS.child(uid).val())rtdb.ref('queue/'+uid+'/hb').set(TS()).catch(()=>{});else if(!JN&&!NET)enqueue()},BEAT)}
function watchStats(){if(sw.length||!rtdb)return;const p=rtdb.ref('presence'),q=rtdb.ref('queue');sw=[p,q];
  p.on('value',s=>{SO=SG=0;s.forEach(c=>{SO++;if((c.val()||{}).s==='bot')SG++});renderQueue()},()=>{});
  q.on('value',s=>{QS=s;renderQueue();sweep();pair()},()=>{});startHB()}
function unwatchStats(){sw.forEach(r=>r.off());sw=[];QS=null;stopHB()}
function leaveQueue(){inQ=false;cancelJoin();unwatchStats();unqueue();show('menu')}
$('online').onclick=()=>{inQ=true;show('queue');$('qs').textContent='';$('qlist').textContent='';
  if(rtdb&&uid){$('qt').textContent='Waiting for an opponent…';enqueue();watchStats()}
  else $('qt').textContent='Online is unavailable right now. You can still play the bot.'};
$('qexit').onclick=leaveQueue;
$('qbot').onclick=()=>startGame();
// Closing the tab: onDisconnect already cleans up on the server, this just makes it instant when the browser lets us.
addEventListener('pagehide',()=>{if(!rtdb||!uid)return;try{rtdb.ref('queue/'+uid).remove();rtdb.ref('presence/'+uid).remove();if(NET||JN)rtdb.ref((NET||JN).base).remove()}catch(e){}});

// The newest joiner pairs with the oldest live waiting player. The older one just sees a match id appear on its queue entry.
// Only the first claim on an entry wins (the rules allow the match id to be written once), so two newcomers can't both take one player.
function pair(){if(!inQ||NET||JN||pairing||!uid||!QS)return;const me=QS.child(uid).val();if(!me||typeof me.t!=='number')return;
  if(me.match){join(me.match);return}
  const now=Date.now();let best=null;
  waiting().forEach(e=>{if(!best&&e.k!==uid&&!(dodge[e.k]>now)&&e.v.t<me.t)best=e});
  if(!best)return;pairing=true;const m=uid+'_'+best.k+'_'+now;
  rtdb.ref('queue/'+best.k+'/match').set(m)
    .then(()=>rtdb.ref('matches/'+m+'/players').set({host:uid,guest:best.k}))
    .then(()=>{pairing=false;join(m)})
    .catch(()=>{pairing=false})}
function join(m){if(NET||JN)return;pairing=false;
  const[h,g]=String(m).split('_');
  const requeue=()=>{inQ=true;enqueue();watchStats()};
  if(!h||!g||(uid!==h&&uid!==g)){inQ=true;unwatchStats();requeue();return}
  inQ=false;unwatchStats();
  const J=JN={m,base:'matches/'+m,opp:uid===h?g:h,host:uid===h,e:-1,n:0,my:0,onn:0,acc:0,hold:0,rt:0,sent:-1,refs:[],go:false,on:'',timer:0,dropped:false};
  // if the other side never shows up (or the match is deleted first), skip them for a minute and queue again
  const fail=()=>{if(JN!==J||J.go)return;dodge[J.opp]=Date.now()+60000;cancelJoin();requeue()};
  J.timer=setTimeout(fail,15000);
  if(J.host)unqueue();// the guest's entry stays until it has joined: the rules check it when the host creates the match
  let tries=0;
  const put=()=>{if(JN!==J)return;rtdb.ref(J.base+'/names/'+uid).set(myName()).then(()=>{if(JN!==J)return;
      unqueue();rtdb.ref(J.base).onDisconnect().remove();
      const r=rtdb.ref(J.base+'/names/'+J.opp);J.refs.push(r);
      r.on('value',s=>{if(JN===J&&!J.go&&s.val()){J.go=true;J.on=String(s.val());clearTimeout(J.timer);beginNet()}},fail)
    },()=>{if(JN===J&&tries++<25)setTimeout(put,300)})};
  put()}
function cancelJoin(){const J=JN;if(!J)return;clearTimeout(J.timer);J.refs.forEach(r=>r.off());JN=null;if(NET===J)NET=null;pairing=false;
  try{const b=rtdb.ref(J.base);b.onDisconnect().cancel();b.remove().catch(()=>{})}catch(e){}}

// ===== ONLINE 1v1 =====
// Moves and shots are sent as they happen. Possession flips after every shot. The rules in database.rules.json check the
// movement speed (about 8 m/s), the spawn slots, the shot timing and the score steps, so sprinting stays under that.
function beginNet(){const N=NET=JN,B=N.base;
  // The match is deleted when someone leaves or closes the game: whoever is still here wins. Firebase then either sends an empty
  // value or cancels the listener (the rules only let the players of an existing match read it), so both have to be handled.
  const gone=()=>{if(NET===N)endGame(!N.dropped,N.dropped?`You lost connection, so ${OPP} gets the win.`:`${OPP} left the game.`)};
  const L=(p,fn)=>{if(NET!==N)return;const r=rtdb.ref(B+'/'+p);N.refs.push(r);r.on('value',s=>{if(NET===N)fn(s)},gone)};
  startGame();// replaces a running bot game if there is one
  rtdb.ref(B+'/score/'+uid).set({n:0,t:TS()}).catch(()=>{});
  L('state/'+N.opp,s=>{const v=s.val(),q=P[1];if(!v||!q)return;if(q.stale&&performance.now()<q.stale.until&&v.e===q.stale.e)return;q.tgt=v});
  [[uid,0],[N.opp,1]].forEach(([k,i])=>L('score/'+k,s=>{const n=(s.val()||{}).n||0;$('s'+i).textContent=n;if(!i)N.my=Math.max(N.my,n);if(n>=WIN)endGame(!i)}));
  L('ev/'+N.opp,s=>{const v=s.val();if(!v||v.n<=N.onn)return;N.onn=v.n;const q=P[1];q.ball=false;q.ch=0;
    startFlight(q,{x:v.x,y:2.1+q.y,z:v.z},v.ox,v.oz,!!v.k)});
  L('players',s=>{if(!s.exists())gone()})}
function netTick(p,dt){const N=NET;N.acc+=dt;if(N.acc<.06)return;N.acc=0;N.sent=N.e;
  rtdb.ref(N.base+'/state/'+uid).set({x:rd(p.x),z:rd(p.z),y:rd(Math.min(1.2,p.y)),yaw:rd(wr(p.yaw)),t:TS(),e:N.e,d:p.dc%100000,s:p.sp?1:0,c:p.ch?1:0}).catch(()=>{})}
function netShot(f){rtdb.ref(NET.base+'/ev/'+uid).set({n:++NET.n,k:f.make?1:0,x:rd(f.a.x),z:rd(f.a.z),ox:rd(f.lx),oz:rd(f.lz),t:TS()}).catch(()=>{})}
function netEnd(f){const N=NET,mine=f.by===P[0];
  if(f.make){say(f.pts+' POINTS');if(mine){stat('made');rtdb.ref(N.base+'/score/'+uid).set({n:N.my+f.pts,t:TS()}).catch(()=>{})}}
  setTimeout(()=>{if(NET===N&&running)reset(mine?1:0)},900)}
function netClose(){const n=NET;NET=null;JN=null;if(!n)return;clearTimeout(n.timer);n.refs.forEach(r=>r.off());
  try{const b=rtdb.ref(n.base);b.onDisconnect().cancel();b.remove().catch(()=>{})}catch(e){}}

// ===== WORLD =====
const PAL=[0xe03030,0x2a55d0,0x20a050,0xe0a020,0x9040d0,0x20b0c0,0xe06020,0xd040a0],hexc=c=>'#'+c.toString(16).padStart(6,'0');
function cols(a,b){const h=s=>{let x=0;for(const ch of s)x=(x*31+ch.charCodeAt(0))>>>0;return x%8};let i=h(a),j=h(b);if(i===j){if(a<b)j=(j+1)%8;else i=(i+1)%8}return[PAL[i],PAL[j]]}
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
  const full=new THREE.Mesh(new THREE.RingGeometry(R3-.04,R3+.04,96),white);full.rotation.x=-Math.PI/2;full.position.set(H.x,.01,H.z);S.add(full);
  const key=new THREE.Mesh(new THREE.PlaneGeometry(4.9,5.8),new THREE.MeshBasicMaterial({color:0xb03a2e,transparent:true,opacity:.75}));key.rotation.x=-Math.PI/2;key.position.set(0,.008,H.z+2.3);S.add(key);
  const bb=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.05,.05),new THREE.MeshStandardMaterial({color:0xdde8ff,transparent:true,opacity:.7}));bb.position.set(H.x,RIM+.5,H.z-.45);bb.castShadow=true;
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.23,.015,12,32),new THREE.MeshStandardMaterial({color:0xff4a1a}));rim.rotation.x=Math.PI/2;rim.position.set(H.x,RIM,H.z);
  const net=new THREE.Mesh(new THREE.CylinderGeometry(.23,.13,.4,16,1,true),new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true}));net.position.set(H.x,RIM-.2,H.z);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,RIM+.6),new THREE.MeshStandardMaterial({color:0x222}));pole.position.set(H.x,(RIM+.6)/2,H.z-.9);S.add(bb,rim,net,pole);
  const bt=tex(256,256,(g,w,h)=>{g.fillStyle='#d9611a';g.fillRect(0,0,w,h);g.strokeStyle='#111';g.lineWidth=5;g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.moveTo(w/2,0);g.lineTo(w/2,h);g.stroke();g.beginPath();g.arc(0,h/2,h/2,-1.2,1.2);g.arc(w,h/2,h/2,Math.PI-1.2,Math.PI+1.2);g.stroke()});
  ball=new THREE.Mesh(new THREE.SphereGeometry(.12,32,24),new THREE.MeshStandardMaterial({map:bt,roughness:.8}));ball.castShadow=true;S.add(ball);
  addEventListener('resize',rs);rs();ready=true}
function rs(){R.setSize(innerWidth,innerHeight);CAM.aspect=innerWidth/innerHeight;CAM.updateProjectionMatrix()}
function label(t,c){const cv=document.createElement('canvas');cv.width=256;cv.height=64;const g=cv.getContext('2d');g.font='bold 34px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=7;g.strokeStyle='rgba(0,0,0,.8)';g.fillStyle=hexc(c);g.strokeText(t,128,32);g.fillText(t,128,32);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthTest:false,fog:false}));s.scale.set(1.5,.375,1);s.position.set(0,2.15,0);s.renderOrder=9;return s}

// ===== INPUT, PAUSE, POINTER LOCK =====
let escAt=0;
const isLocked=()=>document.pointerLockElement===$('c');
function lockHint(){$('lockhint').classList.toggle('hide',!running||paused||isLocked())}
function lock(){try{const r=$('c').requestPointerLock();if(r&&r.catch)r.catch(()=>{})}catch(e){}setTimeout(lockHint,60)}
function act(a,down){if(!running||paused)return;const p=P[0];if(!p)return;
  if(down){
    if(a==='jump')jump(p);else if(a==='dribble')dribble(p);else if(a==='steal')steal(p,P[1]);
    else if(a==='shoot'){if(p.ball&&!p.fall&&!p.ch&&!p.air&&!flight){p.ch=1;p.m=0;$('meter').style.display='block'}}
    else if(a==='sprint'&&set.toggleSprint)togSpr=!togSpr}
  else if(a==='shoot'&&p.ch)release(p)}
function bindInput(){
  addEventListener('keydown',e=>{
    if(cap){capKey(e);return}
    if(e.code==='Escape'){if(running){e.preventDefault();if(!e.repeat){escAt=performance.now();setPause(!paused)}}return}
    if(!running)return;
    if((actsOf(e.code).length||e.code==='Space')&&!e.ctrlKey&&!e.metaKey)e.preventDefault();// Space would otherwise press the focused button
    if(e.repeat||paused)return;
    keys[e.code]=1;actsOf(e.code).forEach(a=>act(a,1))});
  addEventListener('keyup',e=>{if(!keys[e.code])return;keys[e.code]=0;if(running&&!paused)actsOf(e.code).forEach(a=>act(a,0))});
  $('c').addEventListener('mousedown',e=>{if(!running||paused)return;e.preventDefault();
    if(!isLocked()){lock();return}// the first click only captures the mouse
    const c='Mouse'+e.button;keys[c]=1;actsOf(c).forEach(a=>act(a,1))});
  addEventListener('mouseup',e=>{const c='Mouse'+e.button;if(!keys[c])return;keys[c]=0;if(running&&!paused)actsOf(c).forEach(a=>act(a,0))});
  addEventListener('contextmenu',e=>{if(cap||running)e.preventDefault()});
  addEventListener('mousedown',e=>{if(!cap)return;if(e.button===0&&e.target.closest&&e.target.closest('.key'))return;e.preventDefault();assign('Mouse'+e.button)},true);
  addEventListener('mousemove',e=>{if(isLocked()&&running&&!paused){cy-=e.movementX*.003*set.sens;cp=cl(cp+e.movementY*.003*set.sens*(set.invert?-1:1),-.2,.8)}});
  // Esc while the mouse is captured is eaten by the browser (it only releases the mouse), so a lost lock opens the menu too.
  document.addEventListener('pointerlockchange',()=>{if(isLocked()){lockHint();return}lastUnlock=performance.now();
    if(running&&!paused&&performance.now()-escAt>200)setPause(true);else lockHint()});
  addEventListener('blur',()=>{keys={}})}
bindInput();// listeners are registered once at load, so the Settings screen can capture keys before any game has started
function setPause(on){if(!running||paused===on)return;paused=on;keys={};const p=P[0];
  if(on){if(p&&p.ch){p.ch=0;p.m=0;$('meter').style.display='none'}
    try{document.exitPointerLock()}catch(e){}
    $('ptitle').textContent='Paused';$('psub').textContent=NET?`The match keeps going while you are here. Leaving gives ${OPP} the win.`:'';
    $('rok').classList.remove('hide');$('rmenu').textContent='Main Menu';$('phelp').classList.remove('hide');$('phelp').textContent='Press Esc again to continue';
    $('pause').classList.remove('hide')}
  else{$('pause').classList.add('hide');last=performance.now();lock()}
  lockHint()}
function stopLoop(){running=false;paused=false;cancelAnimationFrame(raf);try{document.exitPointerLock()}catch(e){}
  $('hud').classList.add('hide');$('xh').style.display='none';$('lockhint').classList.add('hide');$('meter').style.display='none';$('arc').style.display='none'}
// Main Menu from the pause menu: leaving an online match deletes it, which makes the other player the winner.
function leaveGame(){stopLoop();if(NET)netClose();inQ=false;cancelJoin();unwatchStats();unqueue();$('pause').classList.add('hide');show('menu')}
$('rok').onclick=()=>setPause(false);
$('rmenu').onclick=()=>{if(running)leaveGame();else{$('pause').classList.add('hide');show(inQ?'queue':'menu')}};
function endGame(w,msg){if(!running)return;const o=OPP;stopLoop();if(NET)netClose();
  $('ptitle').textContent=w?'You win!':'You lose';$('psub').textContent=(msg||(w?'':`${o} wins`))+` (${$('s0').textContent} : ${$('s1').textContent})`;
  $('rok').classList.add('hide');$('phelp').classList.add('hide');$('rmenu').textContent='Main Menu';$('pause').classList.remove('hide')}

// ===== CHARACTER: jointed rig + poses =====
// Facing is +z at yaw 0 and the model's left hand is +x. Arms hang along -y; rotation.x > 0 swings a limb backwards.
// Each arm is a shoulder joint (x = swing, z = out to the side) and an elbow that bends forwards, so a hand target can be solved exactly (ik).
const A1=.28,A2=.27,T1=.43,T2=.43;
const rotX=(v,a)=>{const c=Math.cos(a),s=Math.sin(a);return[v[0],v[1]*c-v[2]*s,v[1]*s+v[2]*c]};
const rotY=(v,a)=>{const c=Math.cos(a),s=Math.sin(a);return[v[0]*c+v[2]*s,v[1],-v[0]*s+v[2]*c]};
const t2w=(q,v)=>{const a=rotX(rotY(v,q.tw),q.ln),b=rotY([a[0],a[1]+q.hy,a[2]],q.yaw);return[q.x+b[0],q.y+b[1],q.z+b[2]]};// torso space -> world
const w2t=(q,w)=>{const b=rotY([w[0]-q.x,w[1]-q.y,w[2]-q.z],-q.yaw);return rotY(rotX([b[0],b[1]-q.hy,b[2]],-q.ln),-q.tw)};
const g2w=(q,v)=>{const b=rotY(v,q.yaw);return[q.x+b[0],q.y+b[1],q.z+b[2]]};// body-facing space -> world
const SHY=.57,SHX=.3;// shoulder position in torso space
function mk(col,name){
  const g=new THREE.Group(),body=new THREE.Group(),hips=new THREE.Group(),torso=new THREE.Group();
  const M=c=>new THREE.MeshStandardMaterial({color:c,roughness:.65}),skin=M(0xc68642),shirt=M(col),shorts=M(0x1b1b1f),shoe=M(0xffffff);
  const part=(geo,mat,par,x,y,z,sx,sy,sz)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);if(sx)o.scale.set(sx,sy,sz);o.castShadow=true;par.add(o);return o};
  g.rotation.order='YXZ';g.add(body);body.add(hips);hips.add(torso);
  part(new THREE.CylinderGeometry(.235,.2,.6,20),shirt,torso,0,.3,0,1,1,.62);
  part(new THREE.CylinderGeometry(.05,.06,.12,10),skin,torso,0,.64,0);
  part(new THREE.SphereGeometry(.15,20,16),skin,torso,0,.78,0);
  part(new THREE.CylinderGeometry(.2,.215,.34,20),shorts,hips,0,-.1,0,1,1,.7);
  const legs=[-.1,.1].map(x=>{const hp=new THREE.Group(),kn=new THREE.Group(),ft=new THREE.Group();hp.position.set(x,-.02,0);hips.add(hp);
    part(new THREE.CylinderGeometry(.075,.06,T1,12),skin,hp,0,-T1/2,0);kn.position.y=-T1;hp.add(kn);
    part(new THREE.SphereGeometry(.062,10,8),skin,kn,0,0,0);part(new THREE.CylinderGeometry(.06,.045,T2,12),skin,kn,0,-T2/2,0);
    ft.position.y=-T2;kn.add(ft);part(new THREE.SphereGeometry(.07,12,8),shoe,ft,0,-.02,.05,1,.55,1.7);return{hp,kn,ft}});
  const arms=[-SHX,SHX].map(x=>{const sh=new THREE.Group(),el=new THREE.Group();sh.position.set(x,SHY,0);torso.add(sh);
    part(new THREE.SphereGeometry(.08,12,10),shirt,sh,0,0,0);part(new THREE.CylinderGeometry(.052,.044,A1,10),skin,sh,0,-A1/2,0);
    el.position.y=-A1;sh.add(el);part(new THREE.SphereGeometry(.048,10,8),skin,el,0,0,0);part(new THREE.CylinderGeometry(.045,.038,A2,10),skin,el,0,-A2/2,0);
    part(new THREE.SphereGeometry(.058,10,8),skin,el,0,-A2-.01,0);return{sh,el,a:[0,0,.3]}});
  g.add(label(name,col));S.add(g);
  return{g,body,hips,torso,legs,arms,x:0,z:0,y:0,vy:0,yaw:0,ty:0,ball:false,dl:4,dt:0,fall:0,cd:0,ch:0,m:0,mv:0,sp:false,sw:0,spw:0,ph:0,fa:0,air:false,jx:0,jz:0,dxn:0,dzn:0,
    hand:0,dh0:0,dc:0,stl:0,fol:0,hy:.935,ln:0,tw:0,cr:0,bw:null}}
// Where the ball is, depending on what the player is doing: in the shooting pocket, mid crossover, or carried in one hand.
const bounceY=u=>{const s=2*((u%1+1)%1);return .95-.83*(s<=1?s*s:(2-s)*(2-s))};
function ballPos(q){const sd=h=>h?1:-1;let w;
  if(q.ch){const k=sm(Math.min(1,q.m/.45));w=t2w(q,[lp(0,-.07,k),lp(.36,1.0,k),lp(.34,.24,k)])}
  else if(q.dt>0){const u=1-q.dt/DUR;w=g2w(q,[lp(sd(q.dh0)*.26,sd(q.hand)*.26,sm(u)),bounceY(u),.42+.16*Math.sin(Math.PI*u)])}
  else{const hold=t2w(q,[sd(q.hand)*.22,.1,.3]);
    if(q.sw>.05){const bw=g2w(q,[sd(q.hand)*.26,bounceY(q.ph/(2*Math.PI)),.42]);w=[lp(hold[0],bw[0],q.sw),lp(hold[1],bw[1],q.sw),lp(hold[2],bw[2],q.sw)]}else w=hold}
  return w}
// Two-link arm solve. T is the hand target relative to the shoulder in torso space. Returns [shoulder swing, shoulder out, elbow bend].
function ik(T){let[x,y,z]=T,D=Math.hypot(x,y,z);const mx=A1+A2-.012,mn=.2;
  if(D>mx){const f=mx/D;x*=f;y*=f;z*=f;D=mx}else if(D<mn){if(D<1e-4){x=0;y=-mn;z=0}else{const f=mn/D;x*=f;y*=f;z*=f}D=mn}
  const e=Math.acos(cl((D*D-A1*A1-A2*A2)/(2*A1*A2),-1,1)),a=A1+A2*Math.cos(e),b=A2*Math.sin(e),f=Math.asin(cl(x/Math.max(a,.05),-1,1));
  return[Math.atan2(z,y)-Math.atan2(b,-a*Math.cos(f)),f,e]}
function poseBody(q,dt,o){const k=r=>Math.min(1,dt*r),walk=q.mv&&!q.air&&!q.fall;
  q.sw+=((walk?1:0)-q.sw)*k(10);q.spw+=((q.sp&&walk?1:0)-q.spw)*k(8);q.fa+=((q.fall>0?1:0)-q.fa)*k(12);
  q.ph+=dt*(10.5+4*q.spw)*(q.ball&&q.dt>0?.8:1)*q.sw;
  const sw=q.sw,sp=q.spw,fa=q.fa,ph=q.ph,ai=Math.min(1,q.y*4),holding=q.ball&&!q.ch,
    def=!q.ball&&o&&o.ball&&!q.air&&!q.fall&&Math.hypot(o.x-q.x,o.z-q.z)<4.5;q.def=def;
  // crouch (radians at the thigh): ready stance with the ball, defence, dribble dip, loading a shot
  let cr=(holding?.16:0)+(def?.3:0)+(q.dt>0?.18:0);if(q.ch)cr=.12+.3*sm(q.m/.9);cr*=1-ai*.9;q.cr+=(cr-q.cr)*k(14);
  const A=(.62+.38*sp)*sw,Kn=(.9+1.0*sp)*sw,ext=[],th=[],kn=[];
  for(let i=0;i<2;i++){const p=ph+i*Math.PI;let a=-q.cr-A*Math.sin(p),b=2*q.cr+Kn*Math.pow(Math.max(0,Math.cos(p+.35)),1.3)+.12*sw;
    a=lp(a,i?-.4:.12,ai);b=lp(b,i?.75:.4,ai);
    if(fa>.01){a=lp(a,-1+.6*Math.sin(t*13+i*2.2),fa);b=lp(b,.9+.5*Math.sin(t*11+i),fa)}
    th[i]=a;kn[i]=b;ext[i]=T1*Math.cos(a)+T2*Math.cos(a+b)}
  q.hy=Math.max(ext[0],ext[1])+.075;
  let ln=.06*sw+.34*sp+(holding?.14*(1-sp):0)+(def?.2:0)+(q.dt>0?.2:0);if(q.ch)ln=.05-.12*sm(q.m/.5);ln=lp(ln,.02,ai*.6);ln=lp(ln,0,fa);
  const tw=q.ch||fa>.5?0:-Math.sin(ph)*(.1+.16*sp)*sw;
  q.ln+=(ln-q.ln)*k(12);q.tw+=(tw-q.tw)*k(14);
  q.g.position.set(q.x,q.y,q.z);q.g.rotation.set(0,q.yaw,0);q.body.rotation.x=-1.45*fa;q.body.position.y=.16*fa;
  q.hips.position.y=q.hy;q.torso.rotation.set(q.ln,q.tw,0);
  q.legs.forEach((l,i)=>{l.hp.rotation.x=th[i];l.kn.rotation.x=kn[i];l.ft.rotation.x=cl(-(th[i]+kn[i]),-1,.9)*(1-fa*.5)});
  q.bw=q.ball?ballPos(q):null}
function poseArms(q,dt){const k=r=>Math.min(1,dt*r),sw=q.sw,sp=q.spw,fa=q.fa,ph=q.ph;
  const u=q.dt>0?1-q.dt/DUR:0;
  q.arms.forEach((ar,i)=>{const side=i?1:-1,p=ph+i*Math.PI;
    // free swinging arm (no ball): swing opposite the leg on the same side, more bent and bigger when sprinting
    const B=(.5+.55*sp)*sw;let fr=[B*Math.sin(p)+Math.sin(t*1.7+i*2)*.03,side*(.1+.04*sp),lp(.3,1.5,sp)*(.45+.55*sw)+(.3+.25*sp)*Math.max(0,-Math.sin(p))*sw];
    if(fa>.01)fr=[lp(fr[0],-2.4+Math.sin(t*12+i*3)*.7,fa),lp(fr[1],side*(1.2+.3*Math.sin(t*9+i)),fa),lp(fr[2],.6,fa)];
    let T=null;
    if(!q.fall){
      const ballHand=()=>{const w=q.bw;return w?w2t(q,[w[0],Math.max(w[1]+.12,.62),w[2]]):null};
      if(q.ch){const g=sm(Math.min(1,q.m/.45)),b=[lp(0,-.07,g),lp(.36,1.0,g),lp(.34,.24,g)];
        T=i===0?[b[0]+lp(-.13,-.03,g),b[1]+lp(0,-.11,g),b[2]-.03]:[b[0]+.13,b[1]+lp(0,.01,g),b[2]-.02]}
      else if(q.fol>0)T=i===0?[-.12,1.0,.55]:[.3,.35,.25];
      else if(q.stl>0){const s=sm(1-q.stl/.3);T=i===0?[lp(-.45,.35,s),.45,.5]:[.42,.38,.3]}
      else if(q.ball){const mine=q.dt>0?((i===q.dh0&&u<.55)||(i===q.hand&&u>.35)):i===q.hand;T=mine?ballHand():[side*.42,.38,.3]}
      else if(q.def)T=[side*.62,.3,.25];
      else if(q.air)T=[side*.3,1.15,.1]}
    const des=T?ik([T[0]-side*SHX,T[1]-SHY,T[2]]):fr,r=q.dt>0?30:18;
    for(let j=0;j<3;j++)ar.a[j]+=wr(des[j]-ar.a[j])*k(r);
    ar.sh.rotation.set(ar.a[0],0,ar.a[1]);ar.el.rotation.x=-ar.a[2]})}

// ===== GAME =====
// Spawn slots. The database rules only accept a reset at x=0 with z between 1 and 4.5, so the two slots differ in z only (2m apart).
const SP={car:4.4,def:2.4,min:1.5};
function spawn(who){const c=P[who],d=P[1-who];c.x=d.x=0;c.z=SP.car;d.z=SP.def;c.yaw=c.ty=Math.PI;d.yaw=d.ty=0}
// If the opponent's spawn lands on mine (possession out of sync), the guest hops to the free slot. Only right after my own reset;
// the epoch bump keeps the database rules happy (skipped if my last bump hasn't been sent yet, since the rules want exactly +1).
function sepCheck(p,q){if(!NET||NET.host||performance.now()-NET.rt>2000||Math.hypot(p.x-q.x,p.z-q.z)>=SP.min)return;
  p.x=0;p.z=Math.abs(SP.car-q.z)>=Math.abs(SP.def-q.z)?SP.car:SP.def;if(NET.sent===NET.e)NET.e++;NET.hold=performance.now()+250}
function reset(who){// who gets the ball at the top of the key
  P.forEach(p=>{p.ball=false;p.dl=4;p.dt=0;p.fall=0;p.ch=0;p.hand=0;p.sp=false;p.stl=0;p.fol=0;p.air=false;p.y=0;p.vy=0;p.m=0});
  P[who].ball=true;spawn(who);loose=null;flight=null;$('meter').style.display='none';
  if(NET){const q=P[1];q.stale={e:q.tgt?q.tgt.e:q.re,until:performance.now()+700};q.tgt=null;q.re=-2;q.rd=undefined;
    NET.e++;NET.hold=performance.now()+250;NET.rt=performance.now()}}
function startGame(){const was=running;show(null);$('pause').classList.add('hide');paused=false;$('hud').classList.remove('hide');if(!ready)init();OPP=NET?NET.on:'BOT';
  const me=myName(),[c0,c1]=cols(me,OPP);P.forEach(q=>S.remove(q.g));P=[mk(c0,me),mk(c1,OPP)];P[1].rem=!!NET;score=[0,0];flight=null;loose=null;togSpr=false;keys={};cy=0;
  $('score').innerHTML='<small id="n0"></small> <span id="s0">0</span> : <span id="s1">0</span> <small id="n1"></small>';
  [[me,c0],[OPP,c1]].forEach(([n,c],i)=>{const e=$('n'+i);e.textContent=n;e.style.color=hexc(c)});
  reset(NET&&!NET.host?1:0);$('xh').style.display='block';running=true;last=performance.now();
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();// so Space can't press a menu button
  lock();lockHint();if(!was)raf=requestAnimationFrame(loop)}
function jump(p){if(p.y<=.01&&!p.fall&&!p.ch){p.vy=5;p.air=true;p.jx=(p.dxn||0)*4.2;p.jz=(p.dzn||0)*4.2}}// direction locked at takeoff
function dribble(p){if(p.ball&&p.dl>0&&p.dt<=0&&!p.fall&&!p.ch&&!p.air){p.dl--;p.dt=DUR;p.dh0=p.hand;p.hand=1-p.hand;p.dc++}}// every dribble switches hands
function steal(d,h){if(NET||!h||d.cd>0||d.fall>0||d.ball)return;d.stl=.3;
  if(Math.hypot(d.x-h.x,d.z-h.z)>1.6){d.cd=.25;return}d.cd=.7;if(!h.ball)return;
  if(h.dt>0){d.fall=1.5;d.ch=0;if(h===P[0])stat('ankles');say(h===P[0]?'ANKLES BROKEN!':'You got crossed!')}
  else{h.ball=false;h.ch=0;d.ball=true;d.dl=4;d.dt=0;d.hand=0;$('meter').style.display='none';say(d===P[0]?'STEAL!':'Stolen!')}}
function say(s){$('msg').textContent=s;clearTimeout(mt);mt=setTimeout(()=>$('msg').textContent='',1400)}
// Where the crosshair points on the floor (a distance d ahead of the camera, 0.7m to its right), as an angle like the player's yaw.
function crossYaw(p){const d=Math.hypot(p.x-H.x,p.z-H.z);return Math.atan2(Math.cos(cy)*.7-Math.sin(cy)*d,-Math.sin(cy)*.7-Math.cos(cy)*d)}
// A shot is a flight from the hands to where the ball would come down: through the hoop (make), onto the rim and out (rim), or to the floor (air).
// lx,lz = where it would land relative to the hoop. Nothing teleports: a miss lands where it was aimed.
function startFlight(by,a,lx,lz,make){const d=Math.hypot(a.x-H.x,a.z-H.z),e=Math.hypot(lx,lz),rad=.5+.04*d;let kind='in',tx,tz,ty=RIM;
  if(make){tx=H.x+lx*.2;tz=H.z+lz*.2}
  else if(e<=rad+.5){kind='rim';const n=e>1e-3?[lx/e,lz/e]:[0,1];tx=H.x+n[0]*.24;tz=H.z+n[1]*.24}
  else{kind='air';tx=cl(H.x+lx,-7.4,7.4);tz=cl(H.z+lz,-5.9,7.9);ty=.12}
  flight={t:0,dur:.9,a,tx,ty,tz,make,kind,by,pts:d>R3?3:2,lx,lz,h:kind==='air'?1+Math.hypot(tx-a.x,tz-a.z)*.12:1.5+d*.12};return flight}
function release(p){p.ch=0;const me=p===P[0];if(me)$('meter').style.display='none';const o=P[me?1:0],m=p.m,d=Math.hypot(p.x-H.x,p.z-H.z),by=ball.position.y;
  p.ball=false;p.dxn=p.dzn=0;p.m=0;p.fol=.55;jump(p);
  if(!NET&&o.y>.4&&Math.hypot(o.x-p.x,o.z-p.z)<2.4){if(o===P[0])stat('blocks');say(o===P[0]?'BLOCKED!':'Shot blocked');o.ball=false;loose={x:p.x,y:2.4,z:p.z,vx:(o.x-p.x),vy:2,vz:(o.z-p.z)};return}
  // The ball goes the way the player is facing. The crosshair gets some say (up to ~17 degrees either way), and release timing sets depth.
  const yaw=me?p.yaw+cl(wr(crossYaw(p)-p.yaw),-.3,.3):Math.atan2(H.x-p.x,H.z-p.z)+(Math.random()-.5)*.24;
  const dep=cl((m-.95)*6,-2.5,2.5),L=Math.max(1.2,d+dep),lx=p.x+Math.sin(yaw)*L-H.x,lz=p.z+Math.cos(yaw)*L-H.z,perfect=m>=.9&&m<=1,make=Math.hypot(lx,lz)<=.5+.04*d;
  if(me&&perfect&&make){stat('perfects');const e=$('perfect');e.classList.remove('go');void e.offsetWidth;e.classList.add('go')}
  startFlight(p,{x:p.x,y:Math.max(by,1.9),z:p.z},lx,lz,make);
  if(NET&&me)netShot(flight)}
function move(p,dx,dz,dt,sp){if(p.air){p.x+=p.jx*dt;p.z+=p.jz*dt;p.mv=0}else{const l=Math.hypot(dx,dz);if(l>0&&!p.fall){dx/=l;dz/=l;p.x+=dx*sp*dt;p.z+=dz*sp*dt;p.ty=Math.atan2(dx,dz);p.mv=1;p.dxn=dx;p.dzn=dz}else{p.mv=0;p.dxn=p.dzn=0}}p.x=cl(p.x,-7.5,7.5);p.z=cl(p.z,-6,8)}
function bot(b,h,dt){if(b.fall>0)return;b.ai=(b.ai||0)+dt;const hd=Math.hypot(b.x-h.x,b.z-h.z);
  if(b.ball){const d=Math.hypot(b.x-H.x,b.z-H.z);
    if(!b.ch){if(d>R3-.6)move(b,H.x-b.x+Math.sin(t)*2,H.z-b.z,dt,3.4);else{move(b,0,0,dt,0);if(b.ai>1.6&&!b.air&&Math.random()<.02){b.ch=1;b.m=0}}
      if(b.dl>0&&Math.random()<.012)dribble(b)}
    else{b.ty=Math.atan2(H.x-b.x,H.z-b.z);b.m+=dt*.85;if(b.m>=(b.tgt=b.tgt||(Math.random()<.3?.95:.8+Math.random()*.15))){b.tgt=0;b.ai=0;release(b)}}}
  else if(h.ball){// hang back ~2m toward the hoop; only a close, sustained contest can steal
    const dd=Math.hypot(H.x-h.x,H.z-h.z)||1,gx=h.x+(H.x-h.x)/dd*2.1,gz=h.z+(H.z-h.z)/dd*2.1;
    if(Math.hypot(gx-b.x,gz-b.z)>.4)move(b,gx-b.x,gz-b.z,dt,2.7);else{move(b,0,0,dt,0);b.ty=Math.atan2(h.x-b.x,h.z-b.z)}
    b.react=hd>2?0:(b.react||0)+dt;if(hd<1.4&&h.dt<=0&&b.react>2.5&&Math.random()<.03){steal(b,h);b.react=0}
    if(h.ch&&hd<2.5&&b.y<=.01&&Math.random()<.015)jump(b)}
  else if(loose)move(b,loose.x-b.x,loose.z-b.z,dt,3.8)}
function loop(n){if(!running)return;raf=requestAnimationFrame(loop);const dt=Math.min((n-last)/1e3,.05);last=n;const[p,b]=P,frozen=paused&&!NET;
 if(!frozen){t+=dt;
  // input: while the pause menu is open in an online match the game keeps running, but the controls are off
  let dx=0,dz=0;const s=Math.sin(cy),c=Math.cos(cy),live=!paused;
  if(live){if(anyDown('fwd')){dx-=s;dz-=c}if(anyDown('back')){dx+=s;dz+=c}if(anyDown('right')){dx+=c;dz-=s}if(anyDown('left')){dx-=c;dz+=s}}
  const hold=NET&&performance.now()<NET.hold,still=p.ch||hold||p.fall,want=live&&(set.toggleSprint?togSpr:anyDown('sprint'));
  if(set.toggleSprint&&!((dx||dz)&&!still))togSpr=false;
  p.sp=!!(want&&(dx||dz)&&!still&&!p.air);
  // sprint tops out at 6.3 m/s, under the ~8 m/s the online rules allow
  move(p,still?0:dx,still?0:dz,dt,p.sp?(p.ball?(p.dt>0?4.6:5.6):6.3):(p.ball&&p.dt>0?3.4:4.4));
  if(p.ch&&!paused)p.ty=crossYaw(p);
  NET?netTick(p,dt):bot(b,p,dt);
  P.forEach(q=>{q.dt=Math.max(0,q.dt-dt);q.fall=Math.max(0,q.fall-dt);q.cd=Math.max(0,q.cd-dt);q.stl=Math.max(0,q.stl-dt);q.fol=Math.max(0,q.fol-dt);
    q.vy-=14*dt;q.y=Math.max(0,q.y+q.vy*dt);if(q.y===0&&q.vy<0){q.vy=0;q.air=false}
    if(q.rem&&q.tgt){const r=q.tgt;
      if(r.e!==q.re){q.re=r.e;q.x=r.x;q.z=r.z;q.rd=r.d;sepCheck(p,q)}
      const k2=Math.min(1,dt*15),mx=r.x-q.x,mz=r.z-q.z;q.x+=mx*k2;q.z+=mz*k2;q.y=r.y;q.mv=Math.hypot(mx,mz)>.06?1:0;q.air=r.y>.05;q.ty=r.yaw;q.sp=!!r.s;
      if(q.rd!==undefined&&r.d!==q.rd){q.rd=r.d;if(q.ball){q.dh0=q.hand;q.hand=1-q.hand;q.dt=DUR}}else if(q.rd===undefined)q.rd=r.d;
      const c2=r.c?1:0;if(c2&&!q.ch)q.m=0;q.ch=c2&&q.ball?1:0}
    if(q.ch){q.m+=(q===p||q.rem?dt*.85:0);if(q===p&&q.m>1.12)release(q)}
    q.yaw+=wr(q.ty-q.yaw)*Math.min(1,dt*14)});
  P.forEach((q,i)=>{poseBody(q,dt,P[1-i]);poseArms(q,dt)});
  // ball
  const o=P.find(q=>q.ball);
  if(o){ball.position.set(o.bw[0],o.bw[1],o.bw[2])}
  else if(flight){const f=flight,a=f.a;f.t+=dt/f.dur;const k=Math.min(1,f.t);
    ball.position.set(a.x+(f.tx-a.x)*k,a.y+(f.ty-a.y)*k+4*f.h*k*(1-k),a.z+(f.tz-a.z)*k);
    if(f.t>=1){flight=null;
      if(f.make)loose={x:f.tx,y:RIM,z:f.tz,vx:0,vy:-1,vz:0,dead:1};
      else if(f.kind==='rim'){const e=Math.hypot(f.lx,f.lz)||1,sp=1.4+Math.random()*1.2;loose={x:f.tx,y:RIM,z:f.tz,vx:f.lx/e*sp+(Math.random()-.5),vy:2.4+Math.random()*1.2,vz:f.lz/e*sp+(Math.random()-.5)}}
      else loose={x:f.tx,y:.12,z:f.tz,vx:(f.tx-a.x)*.3,vy:1.6,vz:(f.tz-a.z)*.3};
      if(NET)netEnd(f);
      else if(f.make){const i=f.by===p?0:1;score[i]+=f.pts;$('s'+i).textContent=score[i];if(i===0)stat('made');say(f.pts+' POINTS');
        if(score[i]>=WIN)return endGame(i===0);setTimeout(()=>{if(running&&!NET)reset(1-i)},900)}}}
  else if(loose){const l=loose;l.vy-=14*dt;l.x+=l.vx*dt;l.y+=l.vy*dt;l.z+=l.vz*dt;
    if(l.y<.12){l.y=.12;l.vy=Math.abs(l.vy)*.6;l.vx*=.9;l.vz*=.9}
    if(l.x<-7.5||l.x>7.5){l.x=cl(l.x,-7.5,7.5);l.vx*=-.5}if(l.z<-6||l.z>8){l.z=cl(l.z,-6,8);l.vz*=-.5}
    ball.position.set(l.x,l.y,l.z);
    if(!l.dead)for(const q of P)if(!q.fall&&Math.hypot(q.x-l.x,q.z-l.z)<.9&&l.y<1.8){q.ball=true;q.dl=4;q.dt=0;q.hand=0;loose=null;break}}
 }
  // camera (over-the-shoulder, DBD style)
  const tf=65+(set.fovFx?9*p.spw:0);if(Math.abs(CAM.fov-tf)>.05){CAM.fov+=(tf-CAM.fov)*Math.min(1,dt*6);CAM.updateProjectionMatrix()}
  const d=3.6+.5*p.spw,tx=p.x,tz=p.z;const tp=new THREE.Vector3(tx+Math.sin(cy)*d*Math.cos(cp)+Math.cos(cy)*.7,1.7+Math.sin(cp)*d,tz+Math.cos(cy)*d*Math.cos(cp)-Math.sin(cy)*.7);CAM.position.lerp(tp,Math.min(1,dt*16));
  CAM.lookAt(tx+Math.cos(cy)*.7-Math.sin(cy)*3,1.5,tz-Math.sin(cy)*.7-Math.cos(cy)*3);
  // HUD
  if(p.ch){const m=Math.min(p.m,1);$('fill').style.height=m*100+'%';$('fill').style.background=`hsl(${m*120},90%,50%)`}
  const arc=$('arc');if(p.ball&&!p.ch&&!paused){const v=new THREE.Vector3(p.x,0,p.z).project(CAM);arc.style.display='block';arc.style.left=(v.x*.5+.5)*innerWidth+'px';arc.style.top=(-v.y*.5+.5)*innerHeight+'px';$('arcf').style.strokeDasharray=`${p.dl/4*100} 100`}else arc.style.display='none';
  R.render(S,CAM)}
