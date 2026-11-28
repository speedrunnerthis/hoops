// ===== FIREBASE (paste your config) =====
const FB={apiKey:"AIzaSyCgIU_85HAccqFgZd1u4BQsbOEtY4r00sE",authDomain:"livegame-2212.firebaseapp.com",databaseURL:"https://livegame-2212-default-rtdb.firebaseio.com",projectId:"livegame-2212",storageBucket:"livegame-2212.firebasestorage.app",messagingSenderId:"493917811272",appId:"1:493917811272:web:ab31d9ecc9c631fdcc1e7d"};
let auth,db,rtdb,prof=null,uid=null,svOff=0;
try{firebase.initializeApp(FB);auth=firebase.auth();db=firebase.firestore()}catch(e){console.warn(e)}
try{rtdb=firebase.database();rtdb.ref('.info/serverTimeOffset').on('value',s=>{svOff=+s.val()||0},()=>{})}catch(e){console.warn(e)}

// ===== helpers =====
const $=id=>document.getElementById(id),nowS=()=>Date.now()+svOff;
const cl=(v,a,b)=>v<a?a:v>b?b:v,lp=(a,b,k)=>a+(b-a)*k,sm=x=>{x=cl(x,0,1);return x*x*(3-2*x)};
const wr=a=>{a%=Math.PI*2;return a>Math.PI?a-Math.PI*2:a<-Math.PI?a+Math.PI*2:a};
const H={x:0,z:-6.2},RIM=3.05,R3=6.75,WIN=11,DUR=.5,SR=1.5;
let R,S,CAM,P=[],ball,keys={},cy=0,cp=.25,running=false,paused=false,last=0,loose=null,flight=null,score=[0,0],t=0,ready=false,raf=0,togSpr=false,lastUnlock=0,mt;
let NET=null,JN=null,pairing=false,OPP='BOT';
const ADM={frz:0,fly:false,dis:{shots:0,steals:0,blocks:0}};// admin effects on the local player

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
$('stats').insertAdjacentHTML('afterend','<button id="lbb">Leaderboard</button><button id="invb">Inventory and Shop</button><button id="conb" class="hide">Admin console</button><button id="opts">Settings</button>');
$('qt').parentNode.insertAdjacentHTML('beforeend','<p class="sub" id="qs"></p><ul id="qlist"></ul><button id="qbot">Play vs bot while you wait</button><button id="qexit" class="ghost">Exit queue</button>');
const SCR=['auth','menu','statp','queue','settings'];
const show=id=>{SCR.forEach(s=>$(s).classList.add('hide'));if(id)$(id).classList.remove('hide');setPresence(id)};

// ===== SETTINGS (key binds + user settings, saved in this browser) =====
const ACTS=[['fwd','Move forward'],['back','Move back'],['left','Move left'],['right','Move right'],['sprint','Sprint'],['jump','Jump / block'],['dribble','Dribble (switches hands)'],['shoot','Shoot (hold, release)'],['steal','Steal'],['cam','Change camera'],['cancel','Cancel shot (fake)']];
const DEF={binds:{fwd:['KeyW',null],back:['KeyS',null],left:['KeyA',null],right:['KeyD',null],sprint:['ShiftLeft',null],jump:['Space',null],dribble:['KeyE',null],shoot:['KeyF',null],steal:['KeyR','Mouse0'],cam:['KeyC',null],cancel:['KeyX','Mouse2']},sens:1,invert:false,toggleSprint:false,fovFx:true,cam:0,diff:1};
const RES=/^(Escape|Control|Meta|OS)/;// reserved: Esc is the menu, Ctrl/Meta are browser shortcuts
function loadSet(){const s=JSON.parse(JSON.stringify(DEF));
  try{const r=JSON.parse(localStorage.getItem('hoops.settings')||'null');if(r&&typeof r==='object'){
    if(r.binds&&typeof r.binds==='object')for(const a in s.binds){const b=r.binds[a];if(Array.isArray(b))s.binds[a]=[0,1].map(i=>typeof b[i]==='string'&&b[i].length<24&&!RES.test(b[i])?b[i]:null)}
    if(typeof r.sens==='number'&&isFinite(r.sens))s.sens=cl(r.sens,.3,2.5);s.invert=!!r.invert;s.toggleSprint=!!r.toggleSprint;if(typeof r.fovFx==='boolean')s.fovFx=r.fovFx;s.cam=cl(+r.cam>=0?+r.cam|0:0,0,3);s.diff=cl(+r.diff>=0?+r.diff|0:1,0,3)}}catch(e){}
  const seen={};for(const a in s.binds)s.binds[a]=s.binds[a].map(c=>{if(!c||seen[c])return null;seen[c]=1;return c});return s}
let set=loadSet(),cap=null,capEnd=0;
const save=()=>{try{localStorage.setItem('hoops.settings',JSON.stringify(set))}catch(e){}};
function keyName(c){if(!c)return '—';if(c==='Mouse0')return 'Left click';if(c==='Mouse1')return 'Middle click';if(c==='Mouse2')return 'Right click';if(/^Mouse/.test(c))return 'Mouse '+(+c.slice(5)+1);
  const m={ShiftLeft:'Left Shift',ShiftRight:'Right Shift',AltLeft:'Left Alt',AltRight:'Right Alt',ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right'};
  return m[c]||c.replace(/^(Key|Digit)/,'').replace(/^Numpad/,'Num ').replace(/([a-z])([A-Z])/g,'$1 $2')}
const actsOf=c=>ACTS.map(a=>a[0]).filter(a=>set.binds[a].includes(c));
const anyDown=a=>set.binds[a].some(c=>c&&keys[c]);
function updHelp(){const k=a=>keyName(set.binds[a].find(Boolean)||null);
  $('menu').querySelector('.help').textContent=`${k('fwd')} ${k('left')} ${k('back')} ${k('right')} move · Mouse look · ${k('sprint')} sprint · ${k('dribble')} dribble (switches hands, 4 max) · Hold ${k('shoot')} to shoot, release at the top (close to the hoop = layup/dunk) · ${k('cancel')} fake · ${k('steal')} steal · ${k('jump')} jump/block · ${k('cam')} camera · Esc pause`}
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

// ===== SHOP: celebrations, goal effects, basketball skins, coins, bot difficulty =====
const CELS={flex:['Flex',0],spin:['360 Spin',150],guitar:['Air Guitar',300],fall:['Faint',400]},EFFS={none:['None',0],sparks:['Sparks',200],confetti:['Confetti',350],fire:['Fire',500],lightning:['Lightning',700]},
SKNS={classic:['Classic',0,'#d9611a','#111'],street:['Street',150,'#555a63','#111'],ocean:['Ocean',250,'#1f78d1','#fff'],neon:['Neon',400,'#1a1a1a','#39ff14'],gold:['Gold',700,'#d4af37','#5a3d00']},CATS={cel:CELS,eff:EFFS,ball:SKNS},COIN={made:5,perfects:5,blocks:8,ankles:10,win:50};
let ECO={coins:0,own:['flex','none','classic'],eq:{cel:'flex',eff:'none',ball:'classic'}},ecoT=0,itab='cel';
const ek=()=>'hoops.eco.'+(prof&&uid?uid:'g');
function ecoLoad(){let r=null;try{r=JSON.parse(localStorage.getItem(ek())||'null')}catch(e){}
  if(prof&&typeof prof.coins==='number')r={coins:prof.coins,own:prof.own,eq:prof.eq};
  ECO={coins:0,own:['flex','none','classic'],eq:{cel:'flex',eff:'none',ball:'classic'}};
  if(r&&typeof r.coins==='number'&&Array.isArray(r.own)&&r.eq){ECO.coins=Math.max(0,r.coins|0);ECO.own=[...new Set([...ECO.own,...r.own.filter(x=>typeof x==='string')])];Object.assign(ECO.eq,r.eq)}
  for(const c in CATS)if(!ECO.own.includes(ECO.eq[c])||!CATS[c][ECO.eq[c]])ECO.eq[c]=Object.keys(CATS[c])[0];
  $('cn').textContent=ECO.coins;applySkin()}
function ecoSave(now){try{localStorage.setItem(ek(),JSON.stringify(ECO))}catch(e){}clearTimeout(ecoT);
  const go=()=>{if(prof&&db&&uid)db.doc('users/'+uid).set({coins:ECO.coins,own:ECO.own,eq:ECO.eq},{merge:true}).catch(()=>{})};now?go():ecoT=setTimeout(go,2500)}
function coin(k){const n=COIN[k];if(!n)return;ECO.coins+=n;$('cn').textContent=ECO.coins;const e=document.createElement('span');e.className='cgain';e.textContent='+'+n;$('coins').appendChild(e);setTimeout(()=>e.remove(),1200);ecoSave()}
function applySkin(){if(!ball)return;const s=SKNS[ECO.eq.ball]||SKNS.classic;
  ball.material.map=tex(256,256,(g,w,h)=>{g.fillStyle=s[2];g.fillRect(0,0,w,h);g.strokeStyle=s[3];g.lineWidth=5;g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.moveTo(w/2,0);g.lineTo(w/2,h);g.stroke();g.beginPath();g.arc(0,h/2,h/2,-1.2,1.2);g.arc(w,h/2,h/2,Math.PI-1.2,Math.PI+1.2);g.stroke()});
  ball.material.metalness=ECO.eq.ball==='gold'?.7:0;ball.material.needsUpdate=true}
$('hud').insertAdjacentHTML('beforeend','<div id="coins">🪙 <b id="cn">0</b></div>');
document.body.insertAdjacentHTML('beforeend','<div id="invs" class="screen hide"><div class="card wide"><h1>Inventory and Shop</h1><p class="sub">🪙 <b id="ic">0</b> coins</p><div class="tabs"><button data-c="cel" class="on">Celebrations</button><button data-c="eff">Goal effects</button><button data-c="ball">Basketballs</button></div><div id="items"></div><p class="help">Earn coins: shot +5 · perfect +5 · block +8 · ankle break +10 · win +50</p><button id="iback">Back</button></div></div>');
function renderInv(){$('ic').textContent=ECO.coins;document.querySelectorAll('#invs .tabs button').forEach(b=>b.classList.toggle('on',b.dataset.c===itab));const w=$('items');w.textContent='';
  for(const id in CATS[itab]){const v=CATS[itab][id],own=ECO.own.includes(id),on=ECO.eq[itab]===id,d=document.createElement('div'),n=document.createElement('b'),btn=document.createElement('button');
    d.className='item'+(on?' eq':'');n.textContent=v[0];btn.textContent=on?'Equipped':own?'Equip':'Buy · '+v[1]+' 🪙';btn.disabled=on;if(!own&&ECO.coins<v[1])btn.classList.add('ghost');
    btn.onclick=()=>{if(!own){if(ECO.coins<v[1])return;ECO.coins-=v[1];ECO.own.push(id)}ECO.eq[itab]=id;$('cn').textContent=ECO.coins;ecoSave(1);applySkin();renderInv()};
    if(itab==='ball'){const s=document.createElement('i');s.className='sw';s.style.background=`radial-gradient(circle at 35% 30%,${v[3]},${v[2]} 60%)`;d.appendChild(s)}
    d.append(n,btn);w.appendChild(d)}}
document.querySelectorAll('#invs .tabs button').forEach(b=>b.onclick=()=>{itab=b.dataset.c;renderInv()});
$('invb').onclick=()=>{renderInv();show('invs')};$('iback').onclick=()=>show('menu');
$('bot').insertAdjacentHTML('afterend','<div class="seg" id="diff">'+['Easy','Medium','Hard','Pro'].map((n,i)=>`<button data-d="${i}">${n}</button>`).join('')+'</div>');
const syncDiff=()=>document.querySelectorAll('#diff button').forEach(b=>b.classList.toggle('on',+b.dataset.d===set.diff));
document.querySelectorAll('#diff button').forEach(b=>b.onclick=()=>{set.diff=+b.dataset.d;save();syncDiff()});syncDiff();
document.head.appendChild(Object.assign(document.createElement('style'),{textContent:`.seg{display:flex;gap:6px}.seg button{flex:1;padding:8px 0;font-size:13px;background:transparent;border:1px solid #ffffff2a;color:#ccd}.seg button.on{background:#d9611a;border-color:#d9611a;color:#fff}
#items{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-height:46vh;overflow:auto}.item{background:#0d0d12;border:1px solid #ffffff14;border-radius:12px;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:8px}.item.eq{border-color:#ff7a2a}.item b{font-size:14px}.item button{width:100%;padding:8px 4px;font-size:13px}.item button:disabled{opacity:.6;cursor:default}.sw{width:34px;height:34px;border-radius:50%;display:block}
#coins{position:absolute;top:22px;left:22px;font-size:20px;font-weight:800;background:#000a;padding:6px 14px;border-radius:999px;color:#ffd23a}#coins b{color:#fff}.cgain{position:absolute;left:100%;margin-left:8px;color:#3dff7a;animation:cg 1.1s ease-out forwards}@keyframes cg{to{opacity:0;transform:translateY(-22px)}}
#meter::after{height:14%}`}));
SCR.push('invs');ecoLoad();
// ===== ADMIN (account #1 only) + BANS =====
const isAdmin=()=>!!prof&&prof.id===1;let conOpen=false,cmdRef=null,lastCmd=0;
const nameBanned=async n=>{try{return(await db.doc('bans/'+em(n)).get()).exists}catch(e){return false}};
function banScreen(){try{localStorage.setItem('hoops.banned','1')}catch(e){}
  if(!$('banned'))document.body.insertAdjacentHTML('beforeend','<div id="banned" style="position:fixed;inset:0;z-index:99999;background:#120000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;font-family:system-ui,sans-serif;padding:24px"><div style="font-size:64px">🚫</div><h1 style="color:#ff4a4a;font-size:44px;margin:0">You are banned</h1><p style="color:#c99;max-width:420px">Your account was removed and this device can no longer play 54’s Hoops.</p></div>');
  try{if(running)stopLoop();if(NET)netClose()}catch(e){}}
async function selfBan(){banScreen();try{if(db&&uid){await db.doc('leaderboard/'+uid).delete().catch(()=>{});await db.doc('users/'+uid).delete()}}catch(e){}try{auth.currentUser&&await auth.currentUser.delete()}catch(e){try{await auth.signOut()}catch(e2){}}}
try{if(localStorage.getItem('hoops.banned'))banScreen()}catch(e){}
document.body.insertAdjacentHTML('beforeend','<div id="con" class="hide"><div id="conlog"></div><input id="conin" placeholder="/help" autocomplete="off" spellcheck="false"></div>');
document.head.appendChild(Object.assign(document.createElement('style'),{textContent:'#con{position:fixed;left:0;right:0;bottom:0;z-index:30;background:#000d;border-top:2px solid #ff7a2a;padding:10px;font:13px ui-monospace,monospace}#conlog{max-height:30vh;overflow:auto;color:#9f9;white-space:pre-wrap;margin-bottom:6px}#conlog .bad{color:#ff7b7b}#conin{width:100%;background:#000;color:#fff;border:1px solid #ffffff30;font:inherit;padding:8px;border-radius:6px}'}));
function conLog(m,bad){const d=document.createElement('div');if(bad)d.className='bad';d.textContent=m;$('conlog').appendChild(d);$('conlog').scrollTop=1e9}
function toggleCon(on){if(on&&!isAdmin())return;conOpen=on;$('con').classList.toggle('hide',!on);if(on){keys={};try{document.exitPointerLock()}catch(e){}setTimeout(()=>$('conin').focus(),30);if(!$('conlog').childNodes.length)conLog('Admin console. Type /help')}else $('conin').blur()}
$('conin').onkeydown=e=>{e.stopPropagation();if(e.code==='Enter'){const v=$('conin').value;$('conin').value='';if(v.trim()){conLog('> '+v);runCmd(v).catch(err=>conLog('Error: '+err.message,1))}}else if(e.code==='Escape'||e.code==='Backquote'){e.preventDefault();toggleCon(false)}};
function adminInit(){$('conb').classList.toggle('hide',!isAdmin());$('conb').onclick=()=>toggleCon(true);if(!isAdmin())toggleCon(false)}
async function findUid(n){if(!n)throw new Error('Missing username');if(n.toLowerCase()==='me'||(prof&&n.toLowerCase()===String(prof.name).toLowerCase()))return uid;
  const q=await db.collection('users').where('name','==',n).limit(1).get();if(q.empty)throw new Error('No account named '+n+' (exact capitalization)');return q.docs[0].id}
function sendCmd(t,c,a){if(t===uid){applyCmd({c,a});return Promise.resolve()}return rtdb.ref('cmds/'+t).set({c,a:a||0,t:TS()})}
async function runCmd(line){if(!isAdmin())return;const w=line.trim().replace(/^\//,'').split(/\s+/),c=(w.shift()||'').toLowerCase();
  if(c==='help')return conLog('/freeze user [secs] · /unfreeze user · /ban user · /disable shots|steals|blocks for user · /enable shots|steals|blocks for user · /fly user · /win game');
  if(c==='win'){if(!running)throw new Error('No game is running');if(NET){rtdb.ref('cmds/'+NET.opp).set({c:'lose',t:TS()});setTimeout(()=>endGame(true,'Admin victory'),700)}else endGame(true,'Admin victory');return conLog('Game won')}
  if(c==='disable'||c==='enable'){const what=(w[0]||'').toLowerCase().replace(/s?$/,'s'),n=w.slice(1).filter(x=>x.toLowerCase()!=='for')[0];if(!['shots','steals','blocks'].includes(what))throw new Error('Use shots, steals or blocks');
    await sendCmd(await findUid(n),c,what);return conLog(c+'d '+what+' for '+n)}
  if(['freeze','unfreeze','ban','fly'].includes(c)){const n=w[0],t=await findUid(n);
    if(c==='ban'){if(t===uid)throw new Error("You can't ban yourself");const d={name:n,t:Date.now()};await db.doc('bans/'+t).set(d);await db.doc('bans/'+em(n)).set(d);await sendCmd(t,'ban');await db.doc('leaderboard/'+t).delete().catch(()=>{});await db.doc('users/'+t).delete();return conLog(n+' banned and wiped')}
    await sendCmd(t,c,c==='freeze'?(+w[1]||0):0);return conLog(c+' sent to '+n)}
  throw new Error('Unknown command. Type /help')}
function applyCmd(v){const c=v.c;
  if(c==='freeze'){ADM.frz=v.a>0?+v.a:-1;say('You were frozen by an admin')}
  else if(c==='unfreeze'){ADM.frz=0;say('You were unfrozen')}
  else if(c==='fly'){ADM.fly=!ADM.fly;say(ADM.fly?'Fly on · jump = up · sprint = down':'Fly off')}
  else if(c==='disable'||c==='enable'){ADM.dis[v.a]=c==='disable'?1:0;say(v.a+(c==='disable'?' disabled':' enabled')+' by an admin')}
  else if(c==='ban')selfBan();
  else if(c==='lose')endGame(false,'Game ended by an admin')}
function listenCmds(){if(!rtdb||!uid)return;ADM.frz=0;ADM.fly=false;Object.assign(ADM.dis,{shots:0,steals:0,blocks:0});if(cmdRef)cmdRef.off();cmdRef=rtdb.ref('cmds/'+uid);
  cmdRef.on('value',x=>{const v=x.val();if(!v||!v.t||nowS()-v.t>20000||v.t<=lastCmd)return;lastCmd=v.t;applyCmd(v)},()=>{})}

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
$('reg').onclick=async()=>{try{if(await nameBanned($('u').value)){banScreen();return}await register($('u').value.trim(),$('p').value)}catch(e){console.error(e);$('err').textContent=msg(e)}};
$('login').onclick=async()=>{try{if(await nameBanned($('u').value)){banScreen();return}await auth.signInWithEmailAndPassword(em($('u').value),$('p').value)}catch(e){console.error(e);$('err').textContent=msg(e)}};
$('guest').onclick=async()=>{prof=null;try{if(!auth)throw 0;await auth.signInAnonymously()}catch(e){$('who').textContent='Guest (offline)';ecoLoad();show('menu')}};
$('out').onclick=()=>{prof=null;adminInit();inQ=false;cancelJoin();unwatchStats();stopHB();if(rtdb&&uid){rtdb.ref('presence/'+uid).remove().catch(()=>{});rtdb.ref('queue/'+uid).remove().catch(()=>{})}uid=null;auth&&auth.signOut();show('auth')};
if(auth)auth.onAuthStateChanged(async u=>{if(!u)return;uid=u.uid;if(u.isAnonymous){prof=null;$('who').textContent='Guest';ecoLoad();show('menu');return}
  try{const bn=await db.doc('bans/'+uid).get();if(bn.exists){selfBan();return}}catch(e){}
  for(let i=0;i<8;i++){const s=await db.doc('users/'+uid).get();if(s.exists){prof=s.data();break}await new Promise(r=>setTimeout(r,500))}
  if(prof){$('who').textContent=`#${prof.id}  ${prof.name}`;ecoLoad();adminInit();listenCmds();syncLB();show('menu')}});
function stat(k){coin(k);if(!prof)return;prof[k]++;const inc={[k]:firebase.firestore.FieldValue.increment(1)};db.doc('users/'+uid).update(inc).catch(()=>{});db.doc('leaderboard/'+uid).update(inc).catch(()=>{})}
$('stats').onclick=()=>{if(!prof){alert('Log in to track stats');return}
  $('grid').innerHTML=[['ankles','Ankles broken'],['made','Shots made'],['perfects','Perfect shots'],['blocks','Blocks']].map(([k,l])=>`<div><b>${prof[k]}</b><span>${l}</span></div>`).join('');show('statp')};
$('back').onclick=()=>show('menu');
// ===== LEADERBOARD =====
document.body.insertAdjacentHTML('beforeend','<div id="lb" class="screen hide"><div class="card wide"><h1>Leaderboard</h1><div class="tabs" id="lbt"><button data-s="made" class="on">Shots</button><button data-s="perfects">Perfects</button><button data-s="blocks">Blocks</button><button data-s="ankles">Ankles</button></div><div id="lbl"></div><button id="lbback">Back</button></div></div>');
document.head.appendChild(Object.assign(document.createElement('style'),{textContent:'#lbl{display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow:auto;text-align:left}.lbr{display:flex;gap:12px;align-items:center;background:#0d0d12;border-radius:10px;padding:10px 14px;font-size:15px;animation:rise .4s both}.lbr.me{border:1px solid #ff7a2a}.lbr i{font-style:normal;width:28px;color:#99a;font-weight:800}.lbr:nth-child(-n+3) i{color:#ffd23a}.lbr span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbr b{color:#ff7a2a;font-size:18px}'}));
SCR.push('lb');let lbs='made';
// public copy of just the name + 4 stats, so the users collection can stay private
async function syncLB(){if(!prof||!db||!uid)return;try{const r=db.doc('leaderboard/'+uid);if(!(await r.get()).exists)await r.set({id:prof.id,name:prof.name,ankles:prof.ankles||0,made:prof.made||0,perfects:prof.perfects||0,blocks:prof.blocks||0})}catch(e){}}
async function loadLB(){const box=$('lbl');box.textContent='Loading…';document.querySelectorAll('#lbt button').forEach(b=>b.classList.toggle('on',b.dataset.s===lbs));
  try{if(!db||!uid)throw 0;const q=await db.collection('leaderboard').orderBy(lbs,'desc').limit(20).get();box.textContent='';let r=0;
    q.forEach(d=>{const v=d.data();if(!(v[lbs]>0))return;const row=document.createElement('div'),a=document.createElement('i'),n=document.createElement('span'),c=document.createElement('b');
      row.className='lbr'+(d.id===uid?' me':'');a.textContent=++r;n.textContent='#'+v.id+'  '+v.name;c.textContent=v[lbs];row.append(a,n,c);box.appendChild(row)});
    if(!r)box.textContent='No scores yet. Be the first!'}catch(e){box.textContent='Leaderboard unavailable right now.'}}
document.querySelectorAll('#lbt button').forEach(b=>b.onclick=()=>{lbs=b.dataset.s;loadLB()});
$('lbb').onclick=()=>{show('lb');loadLB()};$('lbback').onclick=()=>show('menu');
$('bot').onclick=()=>startGame();

// ===== ONLINE QUEUE =====
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
addEventListener('pagehide',()=>{if(!rtdb||!uid)return;try{rtdb.ref('queue/'+uid).remove();rtdb.ref('presence/'+uid).remove();if(NET||JN)rtdb.ref((NET||JN).base).remove()}catch(e){}});
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
  const fail=()=>{if(JN!==J||J.go)return;dodge[J.opp]=Date.now()+60000;cancelJoin();requeue()};
  J.timer=setTimeout(fail,15000);
  if(J.host)unqueue();
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
function beginNet(){const N=NET=JN,B=N.base;
  const gone=()=>{if(NET===N)endGame(!N.dropped,N.dropped?`You lost connection, so ${OPP} gets the win.`:`${OPP} left the game.`)};
  const L=(p,fn)=>{if(NET!==N)return;const r=rtdb.ref(B+'/'+p);N.refs.push(r);r.on('value',s=>{if(NET===N)fn(s)},gone)};
  startGame();
  rtdb.ref(B+'/score/'+uid).set({n:0,t:TS()}).catch(()=>{});
  L('state/'+N.opp,s=>{const v=s.val(),q=P[1];if(!v||!q)return;if(q.stale&&performance.now()<q.stale.until&&v.e===q.stale.e)return;q.tgt=v});
  [[uid,0],[N.opp,1]].forEach(([k,i])=>L('score/'+k,s=>{const n=(s.val()||{}).n||0;$('s'+i).textContent=n;if(!i)N.my=Math.max(N.my,n);if(n>=WIN)endGame(!i)}));
  L('ev/'+N.opp,s=>{const v=s.val();if(!v||v.n<=N.onn)return;N.onn=v.n;const q=P[1];q.ball=false;q.ch=0;
    startFlight(q,{x:v.x,y:2.1+q.y,z:v.z},v.ox,v.oz,!!v.k);netBlock(v)});
  L('players',s=>{if(!s.exists())gone()});
  L('act/'+N.opp,s=>onAct(s.val(),N))}
function netTick(p,dt){const N=NET;N.acc+=dt;if(N.acc<.06)return;N.acc=0;N.sent=N.e;
  rtdb.ref(N.base+'/state/'+uid).set({x:rd(p.x),z:rd(p.z),y:rd(Math.min(1.2,p.y)),yaw:rd(wr(p.yaw)),t:TS(),e:N.e,d:p.dc%100000,s:p.sp?1:0,c:p.ch?1:0}).catch(()=>{})}
function netShot(f){rtdb.ref(NET.base+'/ev/'+uid).set({n:++NET.n,k:f.make?1:0,x:rd(f.a.x),z:rd(f.a.z),ox:rd(f.lx),oz:rd(f.lz),t:TS()}).catch(()=>{})}
function netEnd(f){const N=NET,mine=f.by===P[0];
  if(f.make){say(f.pts+' POINTS');if(mine){stat('made');rtdb.ref(N.base+'/score/'+uid).set({n:N.my+f.pts,t:TS()}).catch(()=>{})}}
  setTimeout(()=>{if(NET===N&&running)reset(mine?1:0)},900)}
function netClose(){const n=NET;NET=null;JN=null;if(!n)return;clearTimeout(n.timer);n.refs.forEach(r=>r.off());
  try{const b=rtdb.ref(n.base);b.onDisconnect().cancel();b.remove().catch(()=>{})}catch(e){}}
// online steals / ankle breaks / blocks: whoever acts decides from the synced positions and sends an "act" event
function netAct(k){if(!NET)return;NET.an=(NET.an||0)+1;rtdb.ref(NET.base+'/act/'+uid).set({n:NET.an,k,t:TS()}).catch(()=>{})}
function onAct(v,N){if(!v||NET!==N||v.n<=(N.aon||0))return;N.aon=v.n;const me=P[0],q=P[1];
  if(v.k==='s'){me.ball=false;me.ch=0;me.m=0;$('meter').style.display='none';q.ball=true;q.dl=4;q.dt=0;say('Stolen!')}
  else if(v.k==='a'){q.fall=1.5;q.ch=0;stat('ankles');say('ANKLES BROKEN!')}
  else if(v.k==='b'&&flight&&flight.by===me){flight=null;loose={x:me.x,y:2.4,z:me.z,vx:q.x-me.x,vy:2,vz:q.z-me.z};say('Shot blocked')}}
function netBlock(v){const me=P[0];if(!flight||ADM.dis.blocks||me.fall>0||me.y<=.4||Math.hypot(me.x-v.x,me.z-v.z)>2.4)return;
  stat('blocks');say('BLOCKED!');netAct('b');flight=null;loose={x:v.x,y:2.4,z:v.z,vx:me.x-v.x,vy:2,vz:me.z-v.z}}

// ===== WORLD =====
const PAL=[0xe03030,0x2a55d0,0x20a050,0xe0a020,0x9040d0,0x20b0c0,0xe06020,0xd040a0],hexc=c=>'#'+c.toString(16).padStart(6,'0');
function cols(a,b){const h=s=>{let x=0;for(const ch of s)x=(x*31+ch.charCodeAt(0))>>>0;return x%8};let i=h(a),j=h(b);if(i===j){if(a<b)j=(j+1)%8;else i=(i+1)%8}return[PAL[i],PAL[j]]}
function tex(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const x=new THREE.CanvasTexture(c);x.anisotropy=8;return x}
function init(){
  R=new THREE.WebGLRenderer({canvas:$('c'),antialias:true});R.setPixelRatio(devicePixelRatio);R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;R.outputEncoding=THREE.sRGBEncoding;R.toneMapping=THREE.ACESFilmicToneMapping;
  S=new THREE.Scene();S.fog=new THREE.Fog(0xcfe4f5,28,75);
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
  ball=new THREE.Mesh(new THREE.SphereGeometry(.12,32,24),new THREE.MeshStandardMaterial({roughness:.8}));ball.castShadow=true;S.add(ball);applySkin();
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
    if(a==='jump'){if(ADM.frz===0)jump(p)}else if(a==='dribble')dribble(p);else if(a==='steal')steal(p,P[1]);else if(a==='cancel')cancelShot(p);else if(a==='cam'){set.cam=(set.cam+1)%4;save();say(CAMS[set.cam].n+' camera')}
    else if(a==='shoot'){if(ADM.dis.shots){say('Shots are disabled for you');return}if(p.ball&&!p.fall&&!p.ch&&!p.air&&!flight){p.ch=1;p.m=0;$('meter').style.display='block'}}
    else if(a==='sprint'&&set.toggleSprint)togSpr=!togSpr}
  else if(a==='shoot'&&p.ch)release(p)}
function bindInput(){
  addEventListener('keydown',e=>{
    if(cap){capKey(e);return}
    if(e.code==='Backquote'&&isAdmin()&&!conOpen){e.preventDefault();toggleCon(true);return}
    if(conOpen)return;
    if(e.code==='Escape'){if(running){e.preventDefault();if(!e.repeat){escAt=performance.now();setPause(!paused)}}return}
    if(!running)return;
    if((actsOf(e.code).length||e.code==='Space')&&!e.ctrlKey&&!e.metaKey)e.preventDefault();
    if(e.repeat||paused)return;
    keys[e.code]=1;actsOf(e.code).forEach(a=>act(a,1))});
  addEventListener('keyup',e=>{if(!keys[e.code])return;keys[e.code]=0;if(running&&!paused)actsOf(e.code).forEach(a=>act(a,0))});
  $('c').addEventListener('mousedown',e=>{if(!running||paused)return;e.preventDefault();
    if(!isLocked()){lock();return}
    const c='Mouse'+e.button;keys[c]=1;actsOf(c).forEach(a=>act(a,1))});
  addEventListener('mouseup',e=>{const c='Mouse'+e.button;if(!keys[c])return;keys[c]=0;if(running&&!paused)actsOf(c).forEach(a=>act(a,0))});
  addEventListener('contextmenu',e=>{if(cap||running)e.preventDefault()});
  addEventListener('mousedown',e=>{if(!cap)return;if(e.button===0&&e.target.closest&&e.target.closest('.key'))return;e.preventDefault();assign('Mouse'+e.button)},true);
  addEventListener('mousemove',e=>{if(isLocked()&&running&&!paused){cy-=e.movementX*.003*set.sens;cp=cl(cp+e.movementY*.003*set.sens*(set.invert?-1:1),-.5,1.25)}});
  document.addEventListener('pointerlockchange',()=>{if(isLocked()){lockHint();return}lastUnlock=performance.now();
    if(running&&!paused&&performance.now()-escAt>200)setPause(true);else lockHint()});
  addEventListener('blur',()=>{keys={}})}
bindInput();
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
function leaveGame(){stopLoop();if(NET)netClose();inQ=false;cancelJoin();unwatchStats();unqueue();$('pause').classList.add('hide');show('menu')}
$('rok').onclick=()=>setPause(false);
$('rmenu').onclick=()=>{if(running)leaveGame();else{$('pause').classList.add('hide');show(inQ?'queue':'menu')}};
function endGame(w,msg){if(!running)return;if(w&&!msg)coin('win');ecoSave(1);const o=OPP;stopLoop();if(NET)netClose();
  $('ptitle').textContent=w?'You win!':'You lose';$('psub').textContent=(msg||(w?'':`${o} wins`))+` (${$('s0').textContent} : ${$('s1').textContent})`;
  $('rok').classList.add('hide');$('phelp').classList.add('hide');$('rmenu').textContent='Main Menu';$('pause').classList.remove('hide')}

// ===== CHARACTER: jointed rig + poses =====
const A1=.28,A2=.27,T1=.43,T2=.43;
const rotX=(v,a)=>{const c=Math.cos(a),s=Math.sin(a);return[v[0],v[1]*c-v[2]*s,v[1]*s+v[2]*c]};
const rotY=(v,a)=>{const c=Math.cos(a),s=Math.sin(a);return[v[0]*c+v[2]*s,v[1],-v[0]*s+v[2]*c]};
const t2w=(q,v)=>{const a=rotX(rotY(v,q.tw),q.ln),b=rotY([a[0],a[1]+q.hy,a[2]],q.yaw);return[q.x+b[0],q.y+b[1],q.z+b[2]]};
const w2t=(q,w)=>{const b=rotY([w[0]-q.x,w[1]-q.y,w[2]-q.z],-q.yaw);return rotY(rotX([b[0],b[1]-q.hy,b[2]],-q.ln),-q.tw)};
const g2w=(q,v)=>{const b=rotY(v,q.yaw);return[q.x+b[0],q.y+b[1],q.z+b[2]]};
const SHY=.57,SHX=.3;
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
    hand:0,dh0:0,dc:0,stl:0,fol:0,hy:.935,ln:0,tw:0,cr:0,bw:null,cel:null,fin:null,warn:0}}
const bounceY=u=>{const s=2*((u%1+1)%1);return .95-.83*(s<=1?s*s:(2-s)*(2-s))};
function ballPos(q){const sd=h=>h?1:-1;let w;
  if(q.ch){const k=sm(Math.min(1,q.m/.25));w=t2w(q,[lp(0,-.07,k),lp(.36,1.0,k),lp(.34,.24,k)])}
  else if(q.dt>0){const u=1-q.dt/DUR;w=g2w(q,[lp(sd(q.dh0)*.26,sd(q.hand)*.26,sm(u)),bounceY(u),.42+.16*Math.sin(Math.PI*u)])}
  else{const hold=t2w(q,[sd(q.hand)*.22,.1,.3]);
    if(q.sw>.05){const bw=g2w(q,[sd(q.hand)*.26,bounceY(q.ph/(2*Math.PI)),.42]);w=[lp(hold[0],bw[0],q.sw),lp(hold[1],bw[1],q.sw),lp(hold[2],bw[2],q.sw)]}else w=hold}
  return w}
function ik(T){let[x,y,z]=T,D=Math.hypot(x,y,z);const mx=A1+A2-.012,mn=.2;
  if(D>mx){const f=mx/D;x*=f;y*=f;z*=f;D=mx}else if(D<mn){if(D<1e-4){x=0;y=-mn;z=0}else{const f=mn/D;x*=f;y*=f;z*=f}D=mn}
  const e=Math.acos(cl((D*D-A1*A1-A2*A2)/(2*A1*A2),-1,1)),a=A1+A2*Math.cos(e),b=A2*Math.sin(e),f=Math.asin(cl(x/Math.max(a,.05),-1,1));
  return[Math.atan2(z,y)-Math.atan2(b,-a*Math.cos(f)),f,e]}
function celArm(q,i,s){const id=q.cel.id;if(id==='fin')return[s*.28,1.3,.2];if(id==='guitar')return i?[.14,.32+.14*Math.sin(t*20),.3]:[-.18,.6,.5];if(id==='spin')return[s*.32,1.15,.1];return[s*.5,.78+.06*Math.sin(t*12),.12]}
function poseBody(q,dt,o){const k=r=>Math.min(1,dt*r),walk=q.mv&&!q.air&&!q.fall;
  q.sw+=((walk?1:0)-q.sw)*k(10);q.spw+=((q.sp&&walk?1:0)-q.spw)*k(8);
  q.fa+=(((q.fall>0||(q.cel&&q.cel.id==='fall'&&q.cel.t/q.cel.D>.15&&q.cel.t/q.cel.D<.8))?1:0)-q.fa)*k(12);
  q.ph+=dt*(10.5+4*q.spw)*(q.ball&&q.dt>0?.8:1)*q.sw;
  const sw=q.sw,sp=q.spw,fa=q.fa,ph=q.ph,ai=Math.min(1,q.y*4),holding=q.ball&&!q.ch,
    def=!q.ball&&o&&o.ball&&!q.air&&!q.fall&&Math.hypot(o.x-q.x,o.z-q.z)<4.5;q.def=def;
  let cr=(holding?.16:0)+(def?.3:0)+(q.dt>0?.18:0)+(q.cel&&q.cel.id==='guitar'?.3:0);if(q.ch)cr=.12+.3*sm(q.m/.5);cr*=1-ai*.9;q.cr+=(cr-q.cr)*k(14);
  const A=(.62+.38*sp)*sw,Kn=(.9+1.0*sp)*sw,ext=[],th=[],kn=[];
  for(let i=0;i<2;i++){const p=ph+i*Math.PI;let a=-q.cr-A*Math.sin(p),b=2*q.cr+Kn*Math.pow(Math.max(0,Math.cos(p+.35)),1.3)+.12*sw;
    a=lp(a,i?-.4:.12,ai);b=lp(b,i?.75:.4,ai);
    if(fa>.01){a=lp(a,-1+.6*Math.sin(t*13+i*2.2),fa);b=lp(b,.9+.5*Math.sin(t*11+i),fa)}
    th[i]=a;kn[i]=b;ext[i]=T1*Math.cos(a)+T2*Math.cos(a+b)}
  q.hy=Math.max(ext[0],ext[1])+.075;
  let ln=.06*sw+.34*sp+(holding?.14*(1-sp):0)+(def?.2:0)+(q.dt>0?.2:0);if(q.ch)ln=.05-.12*sm(q.m/.28);ln=lp(ln,.02,ai*.6);ln=lp(ln,0,fa);
  const tw=q.ch||fa>.5?0:-Math.sin(ph)*(.1+.16*sp)*sw;
  if(q.cel&&q.cel.id==='guitar')ln=-.22+.07*Math.sin(t*9);
  q.ln+=(ln-q.ln)*k(12);q.tw+=(tw-q.tw)*k(14);
  q.g.position.set(q.x,q.y,q.z);q.g.rotation.set(0,q.yaw+(q.cel&&q.cel.id==='spin'?Math.PI*2*sm(q.cel.t/q.cel.D*1.2):0),0);q.body.rotation.x=-1.45*fa;q.body.position.y=.16*fa;
  q.hips.position.y=q.hy;q.torso.rotation.set(q.ln,q.tw,0);
  q.legs.forEach((l,i)=>{l.hp.rotation.x=th[i];l.kn.rotation.x=kn[i];l.ft.rotation.x=cl(-(th[i]+kn[i]),-1,.9)*(1-fa*.5)});
  q.bw=q.ball?ballPos(q):null}
function poseArms(q,dt){const k=r=>Math.min(1,dt*r),sw=q.sw,sp=q.spw,fa=q.fa,ph=q.ph;
  const u=q.dt>0?1-q.dt/DUR:0;
  q.arms.forEach((ar,i)=>{const side=i?1:-1,p=ph+i*Math.PI;
    const B=(.5+.55*sp)*sw;let fr=[B*Math.sin(p)+Math.sin(t*1.7+i*2)*.03,side*(.1+.04*sp),lp(.3,1.5,sp)*(.45+.55*sw)+(.3+.25*sp)*Math.max(0,-Math.sin(p))*sw];
    if(fa>.01)fr=[lp(fr[0],-2.4+Math.sin(t*12+i*3)*.7,fa),lp(fr[1],side*(1.2+.3*Math.sin(t*9+i)),fa),lp(fr[2],.6,fa)];
    let T=null;
    if(!q.fall){
      const ballHand=()=>{const w=q.bw;return w?w2t(q,[w[0],Math.max(w[1]+.12,.62),w[2]]):null};
      if(q.cel&&q.cel.id!=='fall'){T=celArm(q,i,side)}
      else if(q.ch){const g=sm(Math.min(1,q.m/.25)),b=[lp(0,-.07,g),lp(.36,1.0,g),lp(.34,.24,g)];
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
const SP={car:4.4,def:2.4,min:1.5};
function spawn(who){const c=P[who],d=P[1-who];c.x=d.x=0;c.z=SP.car;d.z=SP.def;c.yaw=c.ty=Math.PI;d.yaw=d.ty=0}
function sepCheck(p,q){if(!NET||NET.host||performance.now()-NET.rt>2000||Math.hypot(p.x-q.x,p.z-q.z)>=SP.min)return;
  p.x=0;p.z=Math.abs(SP.car-q.z)>=Math.abs(SP.def-q.z)?SP.car:SP.def;if(NET.sent===NET.e)NET.e++;NET.hold=performance.now()+250}
function reset(who){
  P.forEach(p=>{p.ball=false;p.dl=4;p.dt=0;p.fall=0;p.ch=0;p.hand=0;p.sp=false;p.stl=0;p.fol=0;p.air=false;p.y=0;p.vy=0;p.m=0;p.cel=null;p.fin=null;if(p.warn>0){p.warn=0;tint(p,0)}});
  P[who].ball=true;spawn(who);loose=null;flight=null;$('meter').style.display='none';
  if(NET){const q=P[1];q.stale={e:q.tgt?q.tgt.e:q.re,until:performance.now()+700};q.tgt=null;q.re=-2;q.rd=undefined;
    NET.e++;NET.hold=performance.now()+250;NET.rt=performance.now()}}
function startGame(){const was=running;show(null);$('pause').classList.add('hide');paused=false;$('hud').classList.remove('hide');if(!ready)init();applySkin();OPP=NET?NET.on:'BOT';
  const me=myName(),[c0,c1]=cols(me,OPP);P.forEach(q=>S.remove(q.g));P=[mk(c0,me),mk(c1,OPP)];P[1].rem=!!NET;score=[0,0];flight=null;loose=null;togSpr=false;keys={};cy=0;
  $('score').innerHTML='<small id="n0"></small> <span id="s0">0</span> : <span id="s1">0</span> <small id="n1"></small>';
  [[me,c0],[OPP,c1]].forEach(([n,c],i)=>{const e=$('n'+i);e.textContent=n;e.style.color=hexc(c)});
  reset(NET&&!NET.host?1:0);$('xh').style.display='block';running=true;last=performance.now();
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
  lock();lockHint();if(!was)raf=requestAnimationFrame(loop)}
function jump(p){if(p.y<=.01&&!p.fall&&!p.ch&&!p.fin){p.vy=5;p.air=true;p.jx=(p.dxn||0)*4.2;p.jz=(p.dzn||0)*4.2}}
function dribble(p){if(p.ball&&p.dl>0&&p.dt<=0&&!p.fall&&!p.ch&&!p.air){p.dl--;p.dt=DUR;p.dh0=p.hand;p.hand=1-p.hand;p.dc++}}
function steal(d,h){if(!h||d.cd>0||d.fall>0||d.ball||(d===P[0]&&ADM.dis.steals))return;d.stl=.3;
  if(Math.hypot(d.x-h.x,d.z-h.z)>1.6){d.cd=.25;return}d.cd=.7;if(!h.ball)return;
  if(h.dt>0){d.fall=1.5;d.ch=0;if(h===P[0])stat('ankles');say(h===P[0]?'ANKLES BROKEN!':'You got crossed!');if(NET&&d===P[0])netAct('a')}
  else{h.ball=false;h.ch=0;d.ball=true;d.dl=4;d.dt=0;d.hand=0;$('meter').style.display='none';say(d===P[0]?'STEAL!':'Stolen!');if(NET&&d===P[0])netAct('s')}}
function say(s){$('msg').textContent=s;clearTimeout(mt);mt=setTimeout(()=>$('msg').textContent='',1400)}
const CAMS=[{n:'Shoulder',d:3.6,so:.7,h:1.7},{n:'Follow',d:4.3,so:0,h:1.9,fol:1},{n:'Wide',d:8.5,so:0,h:3.4},{n:'First person',fp:1}];
function crossYaw(p){const so=(CAMS[set.cam]||CAMS[0]).so||0,d=Math.hypot(p.x-H.x,p.z-H.z);return Math.atan2(Math.cos(cy)*so-Math.sin(cy)*d,-Math.sin(cy)*so-Math.cos(cy)*d)}
function startFlight(by,a,lx,lz,make){const d=Math.hypot(a.x-H.x,a.z-H.z),e=Math.hypot(lx,lz),rad=.5+.04*d;let kind='in',tx,tz,ty=RIM;
  if(make){tx=H.x+lx*.2;tz=H.z+lz*.2}
  else if(e<=rad+.5){kind='rim';const n=e>1e-3?[lx/e,lz/e]:[0,1];tx=H.x+n[0]*.24;tz=H.z+n[1]*.24}
  else{kind='air';tx=cl(H.x+lx,-7.4,7.4);tz=cl(H.z+lz,-5.9,7.9);ty=.12}
  flight={t:0,dur:.7,a,tx,ty,tz,make,kind,by,pts:d>R3?3:2,lx,lz,h:kind==='air'?1+Math.hypot(tx-a.x,tz-a.z)*.12:1.5+d*.12};return flight}
// Releasing within 3.8m of the hoop = layup (2.2-3.8m) or dunk (under 2.2m); further out = jump shot.
function release(p){const dd=Math.hypot(p.x-H.x,p.z-H.z);if(dd<3.8&&p.ball&&!p.air&&!p.fin&&!flight){startFin(p,dd,p===P[0]);return}releaseJump(p)}
function cancelShot(p){if(!p.ch)return;p.ch=0;p.m=0;p.fol=.35;if(p===P[0])$('meter').style.display='none'}
function releaseJump(p){p.ch=0;const me=p===P[0];if(me)$('meter').style.display='none';const o=P[me?1:0],m=p.m,d=Math.hypot(p.x-H.x,p.z-H.z),by=ball.position.y;
  p.ball=false;p.dxn=p.dzn=0;p.m=0;p.fol=.55;jump(p);
  if(!NET&&o.y>.4&&!(o===P[0]&&ADM.dis.blocks)&&Math.hypot(o.x-p.x,o.z-p.z)<2.4){if(o===P[0])stat('blocks');say(o===P[0]?'BLOCKED!':'Shot blocked');o.ball=false;loose={x:p.x,y:2.4,z:p.z,vx:(o.x-p.x),vy:2,vz:(o.z-p.z)};return}
  const yaw=me?p.yaw+cl(wr(crossYaw(p)-p.yaw),-.3,.3):Math.atan2(H.x-p.x,H.z-p.z)+(Math.random()-.5)*BD[set.diff].err;
  const dep=cl((m-.95)*6,-2.5,2.5),L=Math.max(1.2,d+dep),lx=p.x+Math.sin(yaw)*L-H.x,lz=p.z+Math.cos(yaw)*L-H.z,perfect=m>=.86&&m<=1,make=Math.hypot(lx,lz)<=.5+.04*d;
  if(me&&perfect&&make){stat('perfects');const e=$('perfect');e.classList.remove('go');void e.offsetWidth;e.classList.add('go')}
  startFlight(p,{x:p.x,y:Math.max(by,1.9),z:p.z},lx,lz,make);
  if(NET&&me)netShot(flight)}
function startFin(p,dd,me){const dunk=dd<2.2,m=p.m,perfect=m>=.86&&m<=1,make=dunk||perfect||Math.random()<cl(.55+m*.35,.55,.9),u=dd||1,tr=Math.max(0,dd-(dunk?.5:1.1));
  p.ch=0;p.m=0;if(me)$('meter').style.display='none';
  p.fin={k:dunk?'dunk':'layup',t:0,D:dunk?.62:.72,sx:p.x,sz:p.z,ex:p.x+(H.x-p.x)/u*tr,ez:p.z+(H.z-p.z)/u*tr,make,perfect};p.cel={id:'fin',t:0,D:9};p.air=true;p.jx=p.jz=0;p.ty=Math.atan2(H.x-p.x,H.z-p.z)}
function finTick(dt){if(!running||(paused&&!NET))return;for(const q of P){const f=q.fin;if(!f)continue;const me=q===P[0],dk=f.k==='dunk';f.t+=dt;const u=Math.min(1,f.t/f.D),e=sm(u);
  q.x=lp(f.sx,f.ex,e);q.z=lp(f.sz,f.ez,e);q.y=Math.sin(Math.PI*Math.min(1,u*(dk?1.12:1)))*(dk?1.1:.8);q.vy=0;q.air=true;q.jx=q.jz=0;q.ty=Math.atan2(H.x-q.x,H.z-q.z);
  if(q.ball&&!f.rel)ball.position.set(q.x+(H.x-q.x)*.1,q.y+(dk?2.2:1.9),q.z+(H.z-q.z)*.1);
  if(!f.rel&&u>=.55){f.rel=1;
    if(!q.ball){q.fin=null;q.cel=null;continue}
    q.ball=false;const o=P[me?1:0];
    if(!NET&&o.y>.4&&!(o===P[0]&&ADM.dis.blocks)&&Math.hypot(o.x-q.x,o.z-q.z)<2){if(o===P[0])stat('blocks');say(o===P[0]?'BLOCKED!':'Shot blocked');loose={x:q.x,y:2.4,z:q.z,vx:o.x-q.x,vy:2,vz:o.z-q.z}}
    else{const fl=startFlight(q,{x:q.x,y:dk?RIM+.45:q.y+2.2,z:q.z},f.make?0:.45,f.make?0:.1,f.make);fl.dur=dk?.22:.4;fl.h=dk?.12:.6;
      if(me&&f.perfect&&f.make&&!dk){stat('perfects');const el=$('perfect');el.classList.remove('go');void el.offsetWidth;el.classList.add('go')}
      if(NET&&me)netShot(fl)}}
  if(u>=1){q.fin=null;q.cel=null;q.y=0;q.vy=0;q.fol=.35}}}
function move(p,dx,dz,dt,sp){if(p.air){p.x+=p.jx*dt;p.z+=p.jz*dt;p.mv=0}else{const l=Math.hypot(dx,dz);if(l>0&&!p.fall){dx/=l;dz/=l;p.x+=dx*sp*dt;p.z+=dz*sp*dt;p.ty=Math.atan2(dx,dz);p.mv=1;p.dxn=dx;p.dzn=dz}else{p.mv=0;p.dxn=p.dzn=0}}p.x=cl(p.x,-7.5,7.5);p.z=cl(p.z,-6,8)}
// ----- bot: difficulty table, telegraphed steals (turns red), drives to the rim -----
const BD=[{spd:2.2,gap:2.8,st:.02,rt:7,jp:.004,mm:[.6,.9],pf:.05,osp:2.6,dr:.008,sh:2.2,err:.5},{spd:2.7,gap:2.1,st:.02,rt:5,jp:.015,mm:[.78,.98],pf:.2,osp:3.4,dr:.012,sh:1.6,err:.24},{spd:3.4,gap:1.7,st:.02,rt:4,jp:.03,mm:[.85,1],pf:.4,osp:3.9,dr:.02,sh:1.2,err:.14},{spd:4.2,gap:1.4,st:.02,rt:3,jp:.05,mm:[.9,1],pf:.6,osp:4.4,dr:.03,sh:.9,err:.07}];
function tint(q,on){q.g.traverse(o=>{if(o.isMesh&&o.material&&o.material.emissive){o.material.emissive.setHex(on?0xff0000:0);o.material.emissiveIntensity=on?.55+.45*Math.sin(t*22):0}})}
function bot(b,h,dt){if(b.fall>0||b.cel){if(b.warn>0){b.warn=0;tint(b,0)}return}const D=BD[set.diff],hd=Math.hypot(b.x-h.x,b.z-h.z);b.ai=(b.ai||0)+dt;
  if(b.warn>0&&(!h.ball||b.ball)){b.warn=0;tint(b,0)}if(!b.ball)b.drv=undefined;
  if(b.ball){if(b.drv===undefined)b.drv=Math.random()<[.15,.3,.4,.5][set.diff];const d=Math.hypot(b.x-H.x,b.z-H.z),goal=b.drv?2.9:R3-.6;
    if(!b.ch){if(d>goal)move(b,H.x-b.x+Math.sin(t)*(b.drv?0:2),H.z-b.z,dt,D.osp);else{move(b,0,0,dt,0);if(b.ai>D.sh&&!b.air&&Math.random()<.03){b.ch=1;b.m=0}}if(b.dl>0&&Math.random()<D.dr)dribble(b)}
    else{b.ty=Math.atan2(H.x-b.x,H.z-b.z);b.m+=dt*SR;if(b.m>=(b.tgt=b.tgt||(Math.random()<D.pf?.93+Math.random()*.06:lp(D.mm[0],D.mm[1],Math.random())))){b.tgt=0;b.ai=0;release(b)}}}
  else if(h.ball){
    if(b.warn>0){b.warn-=dt;tint(b,1);move(b,h.x-b.x,h.z-b.z,dt,D.spd*1.25);if(b.warn<=0){tint(b,0);b.react=0;if(hd<1.7)steal(b,h)}}
    else{const dd=Math.hypot(H.x-h.x,H.z-h.z)||1,gx=h.x+(H.x-h.x)/dd*D.gap,gz=h.z+(H.z-h.z)/dd*D.gap;
      if(Math.hypot(gx-b.x,gz-b.z)>.4)move(b,gx-b.x,gz-b.z,dt,D.spd);else{move(b,0,0,dt,0);b.ty=Math.atan2(h.x-b.x,h.z-b.z)}
      b.react=hd>2.6?0:(b.react||0)+dt;if(b.react>D.rt&&!h.ch&&Math.random()<D.st){b.warn=.65;b.react=0}
      if(h.ch&&hd<2.5&&b.y<=.01&&Math.random()<D.jp)jump(b)}}
  else if(loose)move(b,loose.x-b.x,loose.z-b.z,dt,D.spd+.6)}
// ----- camera modes -----
function camUpdate(p,dt){const V=CAMS[set.cam]||CAMS[0];p.g.visible=!V.fp;
  if(V.fol&&p.mv&&!p.ch&&!paused)cy+=wr(p.yaw+Math.PI-cy)*Math.min(1,dt*1.4);
  const s=Math.sin(cy),c=Math.cos(cy),pc=Math.cos(cp);
  if(V.fp){const e=new THREE.Vector3(p.x-s*.12,1.62+p.y*.6,p.z-c*.12);CAM.position.copy(e);CAM.lookAt(e.x-s*pc*3,e.y-Math.sin(cp)*3,e.z-c*pc*3);return}
  const d=V.d+(V.so?.5*p.spw:0),so=V.so,tp=new THREE.Vector3(p.x+s*d*pc+c*so,Math.max(.35,V.h+Math.sin(cp)*d),p.z+c*d*pc-s*so);
  CAM.position.lerp(tp,1-Math.exp(-dt*14));CAM.lookAt(p.x+c*so-s*3,1.5,p.z-s*so-c*3)}
// ----- made-shot celebrations + goal effects -----
function onMake(f){const me=f.by===P[0];f.by.cel={id:me?ECO.eq.cel:Object.keys(CELS)[(Math.random()*4)|0],t:0,D:NET?1:1.7};if(me)burst(ECO.eq.eff)}
const FXS={sparks:{c:[0xffd23a,0xff7a1a,0xffffff],s:5,up:3,g:9,life:1.1,sz:.1},confetti:{c:[0xff4a4a,0x4aff7a,0x4a8cff,0xffd23a,0xff4aff],s:4,up:5,g:5,life:2.2,sz:.14},fire:{c:[0xff3a00,0xff9a00,0xffd23a],s:1.6,up:5,g:-3,life:1.4,sz:.2},lightning:{c:[0xffffff,0x66b3ff,0xb98cff],s:1.5,up:16,g:0,life:.6,sz:.18}};
let PT=null;
function burst(id){const E=FXS[id];if(!E||!ready)return;const n=240;
  if(!PT){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3).fill(-99),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3),3));
    PT={o:new THREE.Points(g,new THREE.PointsMaterial({size:.14,vertexColors:true,transparent:true,depthWrite:false,fog:false})),v:new Float32Array(n*3),l:new Float32Array(n),g:0};PT.o.frustumCulled=false;S.add(PT.o)}
  PT.g=E.g;PT.o.material.size=E.sz;const A=PT.o.geometry.attributes,X=A.position.array,C=A.color.array,col=new THREE.Color();
  for(let i=0;i<n;i++){const a=Math.random()*6.283,r=Math.random()*E.s;X[i*3]=H.x;X[i*3+1]=RIM;X[i*3+2]=H.z;PT.v[i*3]=Math.cos(a)*r;PT.v[i*3+1]=E.up*(.4+Math.random()*.8);PT.v[i*3+2]=Math.sin(a)*r;PT.l[i]=E.life*(.5+Math.random()*.7);col.setHex(E.c[(Math.random()*E.c.length)|0]);C[i*3]=col.r;C[i*3+1]=col.g;C[i*3+2]=col.b}
  A.color.needsUpdate=true}
function fxTick(dt){finTick(dt);if(!PT)return;const A=PT.o.geometry.attributes.position,X=A.array;for(let i=0;i<PT.l.length;i++){if(PT.l[i]<=0){X[i*3+1]=-99;continue}PT.l[i]-=dt;PT.v[i*3+1]-=PT.g*dt;X[i*3]+=PT.v[i*3]*dt;X[i*3+1]+=PT.v[i*3+1]*dt;X[i*3+2]+=PT.v[i*3+2]*dt}A.needsUpdate=true}

function loop(n){if(!running)return;raf=requestAnimationFrame(loop);const dt=Math.min((n-last)/1e3,.05);last=n;const[p,b]=P,frozen=paused&&!NET;
 if(!frozen){t+=dt;
  let dx=0,dz=0;const s=Math.sin(cy),c=Math.cos(cy),live=!paused;
  if(live){if(anyDown('fwd')){dx-=s;dz-=c}if(anyDown('back')){dx+=s;dz+=c}if(anyDown('right')){dx+=c;dz-=s}if(anyDown('left')){dx-=c;dz+=s}}
  if(ADM.frz>0)ADM.frz=Math.max(0,ADM.frz-dt);const hold=NET&&performance.now()<NET.hold,still=p.ch||hold||p.fall||p.cel||ADM.frz!==0,want=live&&(set.toggleSprint?togSpr:anyDown('sprint'));
  if(set.toggleSprint&&!((dx||dz)&&!still))togSpr=false;
  p.sp=!!(want&&(dx||dz)&&!still&&!p.air);
  move(p,still?0:dx,still?0:dz,dt,p.sp?(p.ball?(p.dt>0?4.6:5.6):6.3):(p.ball&&p.dt>0?3.4:4.4));
  if(p.ch&&!paused)p.ty=crossYaw(p);
  NET?netTick(p,dt):bot(b,p,dt);
  P.forEach(q=>{q.dt=Math.max(0,q.dt-dt);q.fall=Math.max(0,q.fall-dt);q.cd=Math.max(0,q.cd-dt);q.stl=Math.max(0,q.stl-dt);q.fol=Math.max(0,q.fol-dt);if(q.cel){q.cel.t+=dt;if(q.cel.t>=q.cel.D)q.cel=null}
    if(q===p&&ADM.fly&&!q.fin){q.vy=((live&&anyDown('jump'))?5:0)-((live&&anyDown('sprint'))?5:0);q.y=cl(q.y+q.vy*dt,0,9);q.air=false}else{q.vy-=14*dt;q.y=Math.max(0,q.y+q.vy*dt);if(q.y===0&&q.vy<0){q.vy=0;q.air=false}}
    if(q.rem&&q.tgt){const r=q.tgt;
      if(r.e!==q.re){q.re=r.e;q.x=r.x;q.z=r.z;q.rd=r.d;sepCheck(p,q)}
      const k2=Math.min(1,dt*15),mx=r.x-q.x,mz=r.z-q.z;q.x+=mx*k2;q.z+=mz*k2;q.y=r.y;q.mv=Math.hypot(mx,mz)>.06?1:0;q.air=r.y>.05;q.ty=r.yaw;q.sp=!!r.s;
      if(q.rd!==undefined&&r.d!==q.rd){q.rd=r.d;if(q.ball){q.dh0=q.hand;q.hand=1-q.hand;q.dt=DUR}}else if(q.rd===undefined)q.rd=r.d;
      const c2=r.c?1:0;if(c2&&!q.ch)q.m=0;q.ch=c2&&q.ball?1:0}
    if(q.ch){q.m+=(q===p||q.rem?dt*SR:0);if(q===p&&q.m>1.12)release(q)}
    q.yaw+=wr(q.ty-q.yaw)*Math.min(1,dt*14)});
  P.forEach((q,i)=>{poseBody(q,dt,P[1-i]);poseArms(q,dt)});
  const o=P.find(q=>q.ball);
  if(o){ball.position.set(o.bw[0],o.bw[1],o.bw[2])}
  else if(flight){const f=flight,a=f.a;f.t+=dt/f.dur;const k=Math.min(1,f.t);
    ball.position.set(a.x+(f.tx-a.x)*k,a.y+(f.ty-a.y)*k+4*f.h*k*(1-k),a.z+(f.tz-a.z)*k);
    if(f.t>=1){flight=null;
      if(f.make){loose={x:f.tx,y:RIM,z:f.tz,vx:0,vy:-1,vz:0,dead:1};onMake(f)}
      else if(f.kind==='rim'){const e=Math.hypot(f.lx,f.lz)||1,sp=1.4+Math.random()*1.2;loose={x:f.tx,y:RIM,z:f.tz,vx:f.lx/e*sp+(Math.random()-.5),vy:2.4+Math.random()*1.2,vz:f.lz/e*sp+(Math.random()-.5)}}
      else loose={x:f.tx,y:.12,z:f.tz,vx:(f.tx-a.x)*.3,vy:1.6,vz:(f.tz-a.z)*.3};
      if(NET)netEnd(f);
      else if(f.make){const i=f.by===p?0:1;score[i]+=f.pts;$('s'+i).textContent=score[i];if(i===0)stat('made');say(f.pts+' POINTS');
        if(score[i]>=WIN)return endGame(i===0);setTimeout(()=>{if(running&&!NET)reset(1-i)},1900)}}}
  else if(loose){const l=loose;l.vy-=14*dt;l.x+=l.vx*dt;l.y+=l.vy*dt;l.z+=l.vz*dt;
    if(l.y<.12){l.y=.12;l.vy=Math.abs(l.vy)*.6;l.vx*=.9;l.vz*=.9}
    if(l.x<-7.5||l.x>7.5){l.x=cl(l.x,-7.5,7.5);l.vx*=-.5}if(l.z<-6||l.z>8){l.z=cl(l.z,-6,8);l.vz*=-.5}
    ball.position.set(l.x,l.y,l.z);
    if(!l.dead)for(const q of P)if(!q.fall&&Math.hypot(q.x-l.x,q.z-l.z)<.9&&l.y<1.8){q.ball=true;q.dl=4;q.dt=0;q.hand=0;loose=null;break}}
 }
  fxTick(dt);
  const tf=65+(set.fovFx?9*p.spw:0);if(Math.abs(CAM.fov-tf)>.05){CAM.fov+=(tf-CAM.fov)*Math.min(1,dt*6);CAM.updateProjectionMatrix()}
  camUpdate(p,dt);
  if(p.ch){const m=Math.min(p.m,1);$('fill').style.height=m*100+'%';$('fill').style.background=`hsl(${m*120},90%,50%)`}
  const arc=$('arc');if(p.ball&&!p.ch&&!paused){const v=new THREE.Vector3(p.x,0,p.z).project(CAM);arc.style.display='block';arc.style.left=(v.x*.5+.5)*innerWidth+'px';arc.style.top=(-v.y*.5+.5)*innerHeight+'px';$('arcf').style.strokeDasharray=`${p.dl/4*100} 100`}else arc.style.display='none';
  R.render(S,CAM)}
