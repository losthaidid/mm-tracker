/* Small, cancellable adventures. Only an explicit rename changes account data. */
(function(root){
'use strict';
const STORE='mm-tracker.momo-adventures.v1',FINALES=['balloons','cranes','rainbow','trophy','flowers','moon','ducks','galaxy'];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BALL='<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="#fffdf2" stroke="#385465" stroke-width="2"/><path d="m32 20 12 9-5 14H25l-5-14ZM12 12l9 3-3 13-14 4m48-20-9 3 3 13 14 4M12 53l3-13 13 7 4 14m20-8-3-13-13 7" fill="#355466"/><path d="m21 15 11 5 11-5M18 28l2 1m24 0 2-1M15 40l10 3m14 0 10-3m-21 7-3-4m11 4 3-4" fill="none" stroke="#829a9d" stroke-width="1.3"/></svg>';
function install(a){
 const $=id=>document.getElementById(id),pet=()=>$('hubPet'),random=(lo,hi)=>lo+Math.random()*(hi-lo),name=()=>a.prefs().mascotName||'Momo',person=()=>a.prefs().name?.trim()||'Haidid';
 const defaults={greetings:true,antics:true,reminders:true,chases:true};let preferences={...defaults},owner=null,pendingGreeting=true,greetAt=Date.now()+2500,nextAntic=Date.now()+random(45000,95000),nextReminder=Date.now()+random(180000,300000),active=null,raf=0,pendingVisitor=null,lastReminder='',lastAntic='',lastGreeting=-1,finaleBag=[],lastFinale='',round=0,labelName='';
 try{const p=JSON.parse(localStorage.getItem(STORE)||'null');for(const k of Object.keys(defaults))if(typeof p?.[k]==='boolean')preferences[k]=p[k];}catch{}
 try{const p=JSON.parse(localStorage.getItem(STORE+'.finales')||'null');if(p&&Array.isArray(p.bag)&&new Set(p.bag).size===p.bag.length&&p.bag.every(k=>FINALES.includes(k)))finaleBag=p.bag;if(FINALES.includes(p?.last))lastFinale=p.last;}catch{}
 const viewport=()=>{const v=root.visualViewport;return{x:v?.offsetLeft||0,y:v?.offsetTop||0,w:v?.width||root.innerWidth||375,h:v?.height||root.innerHeight||667};};
 const motion=()=>a.prefs().motion!=='off'&&!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const quiet=()=>{try{return localStorage.getItem('mm-tracker.momo-chatter.v1')==='quiet';}catch{return false;}};
 const editing=()=>!!document.querySelector('dialog[open]')||!!document.activeElement?.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
 function safe(auto=false){return a.ready()&&a.prefs().mascot&&!document.hidden&&!document.body.matches('.hub-private,.hub-present,.hub-focus,.hub-sorting,.lab-drag-active')&&!editing()&&!$('hubMomoMenu')&&(!auto||!quiet()&&$('musicCorner')?.dataset.playing!=='true');}
 function position(){return{x:parseFloat(pet()?.style.left)||0,y:parseFloat(pet()?.style.top)||0};}
 function setPose(pose,expression='curious'){if(pet()){pet().dataset.pose=pose;pet().dataset.expression=expression;}}
 function shuffle(xs){const out=xs.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
 function finish(restore=false){
  const was=active;active=null;if(raf)root.cancelAnimationFrame(raf);raf=0;
  $('momoElasticCard')?.remove();$('momoSoccerStage')?.remove();pet()?.removeAttribute('data-adventure');pet()?.removeAttribute('data-facing');pet()?.removeAttribute('data-juggle-side');
  if(was){a.life()?.scene(null);if(restore&&was.previous)a.move(was.previous);}
 }
 function begin(kind,pose,duration,extra={}){
  if(!safe()||!pet()||!motion()||a.life()?.sceneAvailable?.()===false)return false;
  finish();a.moments()?.finish(false);a.stop();active={kind,previous:position(),start:root.performance.now(),started:Date.now(),duration,...extra};a.life()?.scene({pose,expression:'delighted'});pet().dataset.adventure=kind;raf=root.requestAnimationFrame(frame);return true;
 }
 function elapsed(t){return Math.max(0,t-active.start,Date.now()-active.started);}
 function followPath(points,q){const n=points.length-1,p=Math.min(n-.000001,Math.max(0,q)*n),i=Math.floor(p),f=p-i;return{x:points[i].x+(points[i+1].x-points[i].x)*f,y:points[i].y+(points[i+1].y-points[i].y)*f};}
 function moveToward(point){const before=position();pet().dataset.facing=point.x<before.x?'left':'right';a.move(point);}
 function frame(t){raf=0;advance(t);if(active)raf=root.requestAnimationFrame(frame);}
 function advance(t){
  if(!active)return;if(!safe()||!motion()){finish();return;}
  const s=active,ms=elapsed(t),q=Math.min(1,ms/s.duration);
  if(s.kind==='sprint')moveToward(followPath(s.points,q));
  if(s.kind==='chase'){
   const world=a.atmosphere(),visitor=world?.snapshot().visitor;if(!visitor||visitor.greeted){finish();return;}
   const lead=followPath(s.points,q),tail=followPath(s.points,Math.max(0,q-.09));world.positionVisitor(lead.x,lead.y);moveToward({x:tail.x-s.size*.3,y:tail.y-s.size*.3});
  }
  if(s.kind==='window'&&!s.anchor.isConnected){finish(true);return;}
  if(s.kind==='juggle'){
   if(!s.finalised){
    const count=Math.min(s.count,Math.floor(ms/650));s.kicks=count;$('momoJuggleCount').textContent=count+' / '+s.count;pet().dataset.juggleSide=count%2?'right':'left';
    const ball=$('momoSoccerBall'),phase=(ms%650)/650;ball.style.setProperty('--ball-hop',(-Math.sin(phase*Math.PI)*62)+'px');ball.style.setProperty('--ball-roll',(ms/5)+'deg');ball.style.setProperty('--ball-sway',(Math.sin(ms/650*Math.PI)*16)+'px');
    if(count===s.count)revealFinale();
   }
  }
  if(q>=1)finish(['window','pull'].includes(s.kind));
 }
 function greet(){
  if(!safe(true)||!preferences.greetings||a.life()?.busy()||active)return false;
  const lines=[`Hey ${person()}! ${name()} reporting for a little desk adventure.`,`Welcome back, ${person()}! I saved you a cosy corner.`,`Hi ${person()}! Ready for a small win and a tiny bit of mischief?`,`There you are, ${person()}! Your little teammate is here.`,`Hello, ${person()}! I have been practising my very best welcome wave.`,`Hey ${person()}! Fresh page, fresh possibilities. I brought enthusiasm.`];
  let i=Math.floor(Math.random()*lines.length);if(i===lastGreeting)i=(i+1)%lines.length;lastGreeting=i;
  if(motion()){if(!begin('greeting','idle-wave',4300))return false;}a.react('happy',lines[i],6500);pendingGreeting=false;return true;
 }
 function sprint(){
  if(!safe()||!motion())return false;const v=viewport(),size=parseFloat(pet()?.style.width)||144;if(v.w<size+80)return false;
  const from=position(),to={x:from.x>v.x+v.w/2?v.x+12:v.x+v.w-size-12,y:Math.max(v.y+12,Math.min(v.y+v.h-size-12,from.y))};
  if(!begin('sprint','run',Math.max(650,Math.min(1550,Math.abs(to.x-from.x)/.75)),{points:[from,to]}))return false;
  if(!quiet())a.react('happy',['Zoom! Important tiny business!','Fast feet, absolutely no destination plan.','One lap of the desk. For science!','Catch that pixel!'][Math.floor(Math.random()*4)],3000);return true;
 }
 function visitorArrived(kind){pendingVisitor={kind,after:Date.now()+4000,until:Date.now()+9000};}
 function visitorEnd(){pendingVisitor=null;if(active?.kind==='chase')finish();}
 function chaseVisitor(){
  const world=a.atmosphere(),visit=world?.snapshot().visitor;if(!visit||visit.greeted||!preferences.chases||!a.prefs().roaming||a.moments()?.snapshot().preferences.visitors===false||!safe(true)||!motion()||active)return false;
  const other=a.moments()?.snapshot().active;if(other&&other.kind!=='visitor'||!other&&a.life()?.busy())return false;
  const v=viewport(),size=parseFloat(pet()?.style.width)||144,from=world.visitorPoint();if(!from||v.w<320||v.h<340)return false;
  const right=v.x+v.w-68,left=v.x+20,low=v.y+v.h-78,high=v.y+Math.max(85,Math.min(v.h*.32,180)),points=[from,{x:from.x<v.x+v.w/2?right:left,y:low},{x:from.x<v.x+v.w/2?left:right,y:high},{x:from.x<v.x+v.w/2?right:left,y:low}];
  if(!begin('chase','run',9600,{points,size}))return false;pendingVisitor=null;
  if(!quiet())a.react('happy',`Hey, little ${visit.kind}! Wait for me!`,4500);return true;
 }
 function watchWindow(){
  if(!safe()||!motion())return false;const v=viewport(),anchor=[$('hubAtmosphereCard'),$('hubAtmospherePocket')].find(el=>{const r=el?.getBoundingClientRect();return el&&!el.hidden&&r.width>30&&r.height>25&&r.top>=v.y&&r.bottom<=v.y+v.h;});if(!anchor)return false;
  const r=anchor.getBoundingClientRect(),size=parseFloat(pet()?.style.width)||144;
  if(!begin('window','window-watch',6500,{anchor}))return false;a.move({x:r.right+8+size<v.x+v.w?r.right-10:r.left-size+18,y:r.top+r.height-size*.65});
  const weather=a.atmosphere()?.snapshot().weather;const lines={rain:'Little raindrops racing down the glass. I am cheering for the wobbly one.',snow:'Snowflakes! Every one of them looks like it has taken the afternoon off.',rainbow:'The sky has brought all its favourite colours.',aurora:'The sky is doing a very slow, very fancy dance.',fog:'The view has wrapped itself in a soft blanket.',breeze:'The leaves are dancing. I should learn that move.',cloudy:'That cloud looks like a biscuit. Most clouds do, if you believe enough.',sunny:'A little sunshine and a very serious window inspection.'};
  if(!quiet())a.react('happy',lines[weather]||'Just checking what the sky is up to.',6000);return true;
 }
 function pullSection(){
  if(!safe()||!motion())return false;const v=viewport(),size=parseFloat(pet()?.style.width)||144;
  const choices=[...document.querySelectorAll('#view [data-widget],#view .task-main-card,#view .ticket-card,#view .hub-card,#view .item-card')].map(el=>({el,r:el.getBoundingClientRect()})).filter(({el,r})=>!el.contains(document.activeElement)&&!el.closest('dialog')&&r.width>150&&r.width<v.w*.85&&r.height>60&&r.height<400&&r.left>=v.x+8&&r.right+size*.55<v.x+v.w-8&&r.top>=v.y+60&&r.bottom<v.y+v.h-15);
  if(!choices.length)return false;const target=choices[Math.floor(Math.random()*choices.length)];
  if(!begin('pull','mischief-pull',4600))return false;
  const clone=target.el.cloneNode(true);for(const el of [clone,...clone.querySelectorAll('*')]){for(const attr of [...el.attributes])if(attr.name==='id'||attr.name==='name'||attr.name==='autofocus'||attr.name==='for'||attr.name.startsWith('data-')||attr.name.startsWith('on'))el.removeAttribute(attr.name);if(el.matches('button,input,textarea,select'))el.disabled=true;if(el.matches('button,input,textarea,select,a,[tabindex]'))el.tabIndex=-1;}
  clone.id='momoElasticCard';clone.classList.add('momo-elastic-card');clone.setAttribute('aria-hidden','true');clone.setAttribute('inert','');Object.assign(clone.style,{position:'fixed',left:target.r.left+'px',top:target.r.top+'px',width:target.r.width+'px',height:target.r.height+'px',margin:'0',pointerEvents:'none',zIndex:'84'});document.body.append(clone);a.move({x:target.r.right-size*.3,y:target.r.top+Math.min(target.r.height*.45,100)-size*.45});
  if(!quiet())a.react('happy',['Just borrowing this corner… boing!','This section has excellent stretch. Purely a scientific observation.','I tried to move the whole card. The card has other ideas.','A tiny tug. A surprisingly stretchy website.'][Math.floor(Math.random()*4)],4300);return true;
 }
 function reminderCandidates(){
  const d=a.state(),today=a.today(),out=[],snoozed=(kind,id)=>(d.workhub.reminders||[]).some(r=>r.kind===kind&&r.recordId===id&&r.until>today),projectClosed=id=>{const p=d.projects.find(p=>p.id===id);return p&&(p.archived||/^(completed|closed|cancelled|canceled)$/i.test(p.status||p.phase||''));};
  for(const kind of ['tasks','tickets','specs','projects'])for(const r of d[kind]||[]){
   if(r.archived||r.done||/^(done|completed|closed|resolved|cancelled|canceled)$/i.test(r.status||r.boardStatus||r.phase||'')||snoozed(kind,r.id)||kind!=='projects'&&r.projectId&&(snoozed('projects',r.projectId)||projectClosed(r.projectId)))continue;
   const projectId=kind==='tasks'&&r.taskType==='Project'?r.linkId:r.projectId;if(kind!=='projects'&&projectId&&(snoozed('projects',projectId)||projectClosed(projectId)))continue;
   const title=r.task||r.description||r.name||r.title||r.ticket;if(!title)continue;const due=r.dueDate||r.deadline||r.targetDate||'';out.push({kind,id:r.id,title:String(title),due,key:kind+':'+r.id});
  }
  return out.sort((x,y)=>(x.due&&x.due<=today?0:1)-(y.due&&y.due<=today?0:1)||(x.due||'9999').localeCompare(y.due||'9999'));
 }
 function nudge(automatic=false){
  if(!safe(automatic)||automatic&&(!preferences.reminders||active||a.life()?.busy()))return false;
  const all=reminderCandidates(),pool=all.filter(x=>x.key!==lastReminder),r=(pool.length?pool:all)[Math.floor(Math.random()*(pool.length||all.length))];nextReminder=Date.now()+random(240000,420000);
  if(!r){if(!automatic)a.react('happy',`Hey ${person()}, no open items need a nudge right now. A little breathing room!`,5000);return false;}
  lastReminder=r.key;const lines=[`Hey ${person()}, don’t forget about “${r.title.length>160?r.title.slice(0,157)+'…':r.title}”. One little next step?`,`A gentle nudge, ${person()}: “${r.title}” is still open.`,`${person()}, shall we give “${r.title}” a little attention when you’re ready?`,`Psst, ${person()}. I saved you a reminder about “${r.title}”.`];a.react('busy',lines[Math.floor(Math.random()*lines.length)],11000);
  const b=document.createElement('button');b.type='button';b.className='momo-nudge-open';b.dataset.adventure='open-record';b.dataset.kind=r.kind;b.dataset.id=r.id;b.textContent='Open '+({tasks:'task',tickets:'ticket',specs:'project item',projects:'project'})[r.kind];$('hubPetBubble')?.append(b);return true;
 }
 function nextFinale(){
  if(!finaleBag.length){finaleBag=shuffle(FINALES);if(finaleBag[finaleBag.length-1]===lastFinale)[finaleBag[0],finaleBag[finaleBag.length-1]]=[finaleBag[finaleBag.length-1],finaleBag[0]];}
  const result=finaleBag.pop();lastFinale=result;try{localStorage.setItem(STORE+'.finales',JSON.stringify({bag:finaleBag,last:lastFinale}));}catch{}return result;
 }
 function juggle(count){
  if(!Number.isInteger(count)||count<1||count>50)throw Error('Choose a whole number from 1 to 50.');
  if(!safe()||!motion())return false;const v=viewport(),size=parseFloat(pet()?.style.width)||144,w=Math.min(254,v.w-24),h=Math.min(278,v.h-24);if(v.h<300||v.w<270)return false;
  const p=position(),x=Math.max(v.x+12,Math.min(v.x+v.w-w-12,p.x-w*.25)),y=Math.max(v.y+12,Math.min(v.y+v.h-h-12,p.y-45));
  if(!begin('juggle','juggle',count*650+4700,{count,kicks:0,finalised:false}))return false;
  const stage=document.createElement('aside');stage.id='momoSoccerStage';stage.setAttribute('aria-label',name()+'’s soccer trick');stage.innerHTML='<div class="momo-soccer-roof"><span>A LITTLE FOOTBALL MAGIC</span><button type="button" data-adventure="stop" aria-label="Stop soccer trick">×</button></div><div class="momo-soccer-floor" aria-hidden="true"></div><div id="momoSoccerBall">'+BALL+'</div><p id="momoJuggleCount" aria-live="off">0 / '+count+'</p><div id="momoFinale" aria-hidden="true"></div>';Object.assign(stage.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});document.body.append(stage);a.move({x:x+(w-size)/2,y:y+h-size-42});a.react('happy',`${count} ${count===1?'kick':'kicks'}! Stay for my little surprise.`,4000);return true;
 }
 function revealFinale(){
  if(active?.kind!=='juggle'||active.finalised)return;active.finalised=true;const kind=nextFinale(),box=$('momoFinale'),seed=++round,hue=Math.floor(Math.random()*360);box.dataset.finale=kind;box.style.setProperty('--finale-hue',hue);box.className='momo-finale is-revealed';
  const symbols={balloons:['◉','♡','◉','✦'],cranes:['✧','◇','✧','◇'],rainbow:['🌈','✦','♡','✧'],trophy:['🏆','★','✦','★'],flowers:['✿','❀','✿','❁'],moon:['☾','✦','★','✧'],ducks:['🦆','⚽','🦆','★'],galaxy:['◌','✧','○','✦']};
  for(let i=0;i<12;i++){const s=document.createElement('span');s.textContent=symbols[kind][(i+seed)%4];if(root.WorkHubMomoWorldArt?.finales?.[kind])s.innerHTML=root.WorkHubMomoWorldArt.finales[kind];s.style.setProperty('--i',i);s.style.setProperty('--burst-x',((i%4)-1.5)*45+'px');s.style.setProperty('--burst-y',(-40-Math.floor(i/4)*45)+'px');box.append(s);}
  const captions={balloons:'A tiny balloon parade! The ball invited everyone.',cranes:'A flock of paper wishes. Make a little one for yourself.',rainbow:'A rainbow goal! The sky is on our team.',trophy:'The miniature World Cup! You are officially my coach.',flowers:'A pocket garden of flower fireworks. For you!',moon:'A moonlit goal! That kick has reached the stars.',ducks:'The duck referees award you ten out of quack.',galaxy:'A bubble galaxy! Every kick made a new little world.'};setPose('idle-wave','delighted');a.react('happy',`${name()}: ${active.count} ${active.count===1?'kick':'kicks'}! ${captions[kind]}`,6500);
 }
 function offerTrick(){if(!safe(true))return false;a.react('happy',`Coach ${person()}, how many kicks should I try? I have a little surprise waiting.`,10000);const b=document.createElement('button');b.type='button';b.dataset.adventure='trick';b.className='momo-nudge-open';b.textContent='Pick my trick';$('hubPetBubble')?.append(b);return true;}
 function trickForm(){
  finish();a.moments()?.finish(false);if(!a.ready()||!a.prefs().mascot)return;
  a.openModal(name()+'’s soccer surprise',`<form id="momoJuggleForm"><div class="momo-trick-intro"><div aria-hidden="true">${BALL}</div><span class="hub-kicker">YOU CALL THE TRICK</span><h3>How many times should I juggle?</h3><p>I’ll count every kick, then bring out a little surprise. The finale changes each time.</p></div><label for="momoKickCount">Number of kicks</label><input id="momoKickCount" name="count" type="number" min="1" max="50" step="1" value="5" required inputmode="numeric"><p class="hub-meta">1–50 kicks. Escape or the close button stops the show.</p>${motion()?'':'<p class="hub-meta">Turn on animations to play this moving trick.</p>'}<div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary"${motion()?'':' disabled'}>Let’s see your trick!</button></div></form>`);
 }
 function renameForm(){
  finish();a.openModal('A name for your little teammate',`<form id="momoNameForm"><span class="hub-kicker">HELLO, MY NAME IS…</span><h3>What would you like to call me?</h3><label for="momoCustomName">Companion name</label><input id="momoCustomName" name="mascotName" maxlength="32" value="${esc(name())}" required autocomplete="off"><p class="hub-meta">This name follows your account and is included in your backup.</p><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Save my name</button></div></form>`);
 }
 function settings(){
  if($('settingsMenu'))$('settingsMenu').open=false;finish();a.openModal(name()+'’s adventures',`<form id="momoAdventuresForm"><div class="momo-trick-intro"><span class="hub-kicker">A LITTLE MORE LIFE</span><h3>Company at your pace.</h3><p>These moments wait while you type, use Focus or present your work. Quiet time pauses automatic greetings, chats and nudges.</p></div>${[['greetings','Wave and greet me when I open the website'],['antics','Occasional sprints, window watching and stretchy-card mischief'],['chases','Play chase with tiny visitors'],['reminders','Gentle nudges about my open tasks, tickets and project items']].map(([k,l])=>`<label class="check-label"><input type="checkbox" name="${k}"${preferences[k]?' checked':''}>${l}</label>`).join('')}<p class="hub-meta">These choices stay on this device. Work nudges appear only while this page is open and skip snoozed or closed work.</p><div class="actions"><button type="button" data-adventure="rename">Change my name</button><button type="button" data-adventure="trick">Try a soccer surprise</button></div><div class="modal-actions"><button type="submit" class="primary">Save adventures</button></div></form>`);
 }
 function decorateMenu(){
  const menu=$('hubMomoMenu');if(!menu||menu.querySelector('[data-adventure]'))return;finish();
  const title=menu.querySelector('strong');if(title)title.textContent='A little time with '+name();menu.setAttribute('aria-label','Play with '+name());
  const add=document.createElement('div');add.className='momo-adventure-actions';add.innerHTML='<span class="hub-kicker">LET’S MAKE A LITTLE MISCHIEF</span>'+[['trick','⚽ Soccer surprise'],['sprint','↝ A speedy lap'],['window','☁ Look out the window'],['pull','↔ A tiny tug'],['visitor','✦ Meet a visitor'],['nudge','◷ A work nudge'],['rename','✎ Change my name'],['settings','⚙ Adventure settings']].map(([k,l])=>'<button type="button" data-adventure="'+k+'">'+l+'</button>').join('');menu.insertBefore(add,menu.querySelector('.momo-menu-actions'));a.life()?.layout();
  for(const node of menu.querySelectorAll('[data-momo="theatre"],[data-momo="close"]')){if(node.dataset.momo==='theatre')node.textContent=name()+'’s tiny theatre';else node.setAttribute('aria-label','Close '+name()+' controls');}
 }
 function mount(){
  const next=a.ready()?a.owner():'';if(next!==owner){finish();pendingVisitor=null;owner=next;pendingGreeting=!!next;greetAt=Date.now()+2500;lastReminder='';nextAntic=Date.now()+random(45000,95000);nextReminder=Date.now()+random(180000,300000);labelName='';const bubble=$('hubPetBubble');if(bubble){bubble.hidden=true;bubble.replaceChildren();}}
  if(!a.ready()){finish();return;}if(labelName!==name()){labelName=name();pet()?.querySelector(':scope > button')?.setAttribute('aria-label',name()+', your floating companion. Drag to pick up, tap for play controls, or use arrow keys.');const home=$('hubMomoHome');if(home){home.title='Drag to move '+name()+'’s home · tap to rest or wake';home.setAttribute('aria-label',name()+'’s home. Drag or use arrow keys to move it. Tap to rest or wake '+name()+'.');}}
  const settingsGroup=$('hubSettingsAppearance');if(settingsGroup&&!$('momoAdventureSettings')){const b=document.createElement('button');b.type='button';b.id='momoAdventureSettings';b.dataset.adventure='settings';settingsGroup.append(b);}if($('momoAdventureSettings'))$('momoAdventureSettings').textContent=name()+' · name & adventures';if(!safe()||!motion())finish();
 }
 function tick(){
  mount();if(!a.ready())return;if(active){advance(root.performance.now());return;}
  if(!safe(true))return;if(pendingGreeting&&preferences.greetings&&Date.now()>=greetAt){if(greet())return;}
  if(pendingVisitor){if(Date.now()>pendingVisitor.until)pendingVisitor=null;else if(Date.now()>=pendingVisitor.after&&chaseVisitor())return;}
  if(Date.now()>=nextReminder&&preferences.reminders&&!a.life()?.busy()){if(nudge(true))return;}
  if(!preferences.antics||!motion()||a.life()?.busy()||a.moments()?.snapshot().active||Date.now()<nextAntic||!$('hubPetBubble')?.hidden)return;
  nextAntic=Date.now()+random(65000,130000);const kinds=[...(a.prefs().roaming?['window','pull','sprint']:[]),'gesture','offer'];let kind=kinds[Math.floor(Math.random()*kinds.length)];if(kind===lastAntic)kind=kinds[(kinds.indexOf(kind)+1)%kinds.length];lastAntic=kind;
  if(kind==='window')watchWindow();if(kind==='pull')pullSection();if(kind==='sprint')sprint();if(kind==='gesture')a.life()?.gesture();if(kind==='offer')offerTrick();
 }
 root.addEventListener('workhub:momo-menu',decorateMenu);
 document.addEventListener('click',event=>{const b=event.target.closest?.('[data-adventure]');if(!b)return;event.preventDefault();event.stopImmediatePropagation();$('hubMomoMenu')?.remove();const k=b.dataset.adventure;
  try{if(k==='stop')finish();else if(k==='rename')renameForm();else if(k==='settings')settings();else if(k==='trick')trickForm();else if(k==='open-record'){const r=reminderCandidates().find(r=>r.kind===b.dataset.kind&&r.id===b.dataset.id);if(r)a.workbench()?.openRecord(r.kind,r.id);}
   else{if($('momoAdventuresForm'))a.closeModal();const ok=k==='sprint'?sprint():k==='window'?watchWindow():k==='pull'?pullSection():k==='visitor'?a.atmosphere()?.invite():k==='nudge'?nudge():false;if(!ok&&k!=='nudge')a.tell('I’ll need a little room, animations on, and a clear workspace for that.');}
  }catch(error){a.tell(error.message,true);}
 },true);
 document.addEventListener('submit',event=>{
  if(!['momoNameForm','momoJuggleForm','momoAdventuresForm'].includes(event.target.id))return;event.preventDefault();event.stopImmediatePropagation();const form=event.target;
  try{if(form.id==='momoNameForm'){const value=form.elements.namedItem('mascotName').value.trim();if(!value||value.length>32||/[\u0000-\u001f\u007f]/.test(value))throw Error('Choose a name with 1–32 characters on one line.');if(a.mutate(d=>{d.workhub.preferences.mascotName=value;})){a.closeModal();labelName='';mount();a.react('happy',value+'! I like the sound of that. Same little teammate, new name.',5500);}}
   else if(form.id==='momoAdventuresForm'){for(const k of Object.keys(defaults))preferences[k]=form.elements.namedItem(k).checked;try{localStorage.setItem(STORE,JSON.stringify(preferences));}catch{}a.closeModal();a.tell('Adventure choices saved on this device.');}
   else{const count=Number(form.elements.namedItem('count').value);if(!Number.isInteger(count)||count<1||count>50)throw Error('Choose a whole number from 1 to 50.');a.closeModal();if(!juggle(count))a.tell('Give me a clear workspace with animations on, then try again.');}
  }catch(error){a.tell(error.message,true);}
 },true);
 document.addEventListener('pointerdown',event=>{if(active&&!event.target.closest?.('#momoSoccerStage'))finish();},{capture:true,passive:true});
 document.addEventListener('focusin',event=>{if(event.target.matches?.('input,textarea,select,[contenteditable]'))finish();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'||['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&event.target.closest?.('#hubPet>button'))finish();});
 const sync=()=>{if(!safe()||!motion())finish();};new root.MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class','data-motion']});if($('modal'))new root.MutationObserver(sync).observe($('modal'),{attributes:true,attributeFilter:['open']});root.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',sync);
 document.addEventListener('visibilitychange',sync);root.addEventListener('resize',()=>finish(true));root.visualViewport?.addEventListener('resize',()=>finish(true));root.addEventListener('pagehide',()=>finish());root.addEventListener('scroll',()=>{if(['pull','window'].includes(active?.kind))finish(true);},{passive:true});
 return{mount,tick,greet,offerTrick,sprint,chaseVisitor,watchWindow,pullSection,nudge,reminderCandidates,juggle,trickForm,renameForm,settings,finish,visitorArrived,visitorEnd,snapshot:()=>({preferences:{...preferences},name:name(),pendingGreeting,active:active?{kind:active.kind,count:active.count,kicks:active.kicks,finalised:active.finalised,duration:active.duration}:null,finale:lastFinale,finalesRemaining:finaleBag.length})};
}
root.WorkHubMomoAdventures={install};
})(window);
