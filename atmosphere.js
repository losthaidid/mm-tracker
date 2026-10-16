/* Daylight and tiny visitors: browser-local scenery, without network requests. */
(function(root){
'use strict';
const STORE='mm-tracker.atmosphere.v1';
const DEFAULTS={mode:'auto',rain:false,visitors:true};
const PHASES={morning:'Morning light',afternoon:'Afternoon glow',evening:'Evening warmth',night:'A little starlight',off:'Your saved theme'};
function normalise(value){return{mode:['auto',...Object.keys(PHASES)].includes(value?.mode)?value.mode:DEFAULTS.mode,rain:typeof value?.rain==='boolean'?value.rain:DEFAULTS.rain,visitors:typeof value?.visitors==='boolean'?value.visitors:DEFAULTS.visitors};}
function phaseAt(date=new root.Date()){const h=date.getHours();return h>=5&&h<11?'morning':h>=11&&h<17?'afternoon':h>=17&&h<20?'evening':'night';}
let sceneId=0;
function scene(){const id='ambient-window-'+(++sceneId);return `<svg class="ambient-landscape" viewBox="0 0 240 132" fill="none" aria-hidden="true"><defs><clipPath id="${id}-clip"><rect x="4" y="4" width="232" height="120" rx="17"/></clipPath><radialGradient id="${id}-glow"><stop stop-color="#ffedba" stop-opacity=".8"/><stop offset="1" stop-color="#ffedba" stop-opacity="0"/></radialGradient><linearGradient id="${id}-glass" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".24"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></linearGradient></defs><g clip-path="url(#${id}-clip)"><rect class="ambient-sky" width="240" height="132"/><g class="ambient-stars" fill="#fff5cd">${[[27,22],[49,39],[93,19],[126,34],[154,15],[202,30],[216,56]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i%2?1.1:1.7}" style="--star-delay:${i*.7}s"/>`).join('')}<path d="m63 21 1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5-4.5-1.5 4.5-1.5z"/></g><g class="ambient-solar-orbit"><g class="ambient-sun"><circle cx="176" cy="39" r="43" fill="url(#${id}-glow)"/><g class="ambient-sun-rays" stroke="#ffe3a5" stroke-width="1.5" opacity=".65">${Array.from({length:12},(_,i)=>`<path d="M176 12v-5" transform="rotate(${i*30} 176 39)"/>`).join('')}</g><circle cx="176" cy="39" r="17" fill="#ffda86"/><circle cx="171" cy="34" r="12" fill="#ffe6ab" opacity=".35"/></g></g><g class="ambient-lunar-orbit"><g class="ambient-moon"><circle cx="185" cy="37" r="33" fill="#e5e5ff" opacity=".08"/><path d="M187 18a21 21 0 1 0 12 35 22 22 0 0 1-12-35Z" fill="#fff3d2"/><circle cx="173" cy="36" r="3.5" fill="#c5bfbc" opacity=".3"/><circle cx="179" cy="48" r="2" fill="#c5bfbc" opacity=".25"/></g></g><g class="ambient-clouds" fill="#fffdf2"><g class="ambient-cloud-back"><path d="M-38 45c-3-12 12-20 20-10 5-15 28-12 28 4 16-4 23 14 8 18h-52c-10-1-13-10-4-12Z" opacity=".6"/><path d="M144 31c-2-9 11-14 16-6 4-12 23-10 23 3 12-3 18 11 6 14h-42c-9-1-11-8-3-11Z" opacity=".4"/></g><g class="ambient-cloud-front"><path d="M31 48c-2-11 12-16 17-8 5-11 22-8 22 4 10-2 14 10 5 13H34c-8-1-10-8-3-9Z"/><path d="M143 69c-1-7 8-10 12-5 4-7 13-5 14 2 8-1 10 7 3 9h-27c-6-1-7-5-2-6Z" opacity=".7"/></g></g><path class="ambient-hill-back" d="M4 100C35 67 53 67 86 92c35-42 61-44 94-12 23-17 40-11 56 3v41H4Z"/><path class="ambient-hill-front" d="M4 110c42-25 75-19 112 0 43-23 74-27 120-4v30H4Z"/><g class="ambient-tree" stroke="#315c50" stroke-width="2" fill="#88b89a" stroke-linecap="round"><path d="M31 117V84m0 10c-10-2-11-9-8-12 6-2 10 5 8 12Zm1-5c0-9 6-11 9-7 3 5-3 8-9 7Z"/></g><path d="M3 7h233v115H3Z" fill="url(#${id}-glass)"/><path d="m15 8-12 38M33 5 4 87" stroke="#fff" opacity=".13" stroke-width="8"/></g><rect x="4" y="4" width="232" height="120" rx="17" stroke="currentColor" stroke-width="5"/><path d="M120 5v118M5 75h230" stroke="currentColor" stroke-width="5"/><path d="M7 128h226" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg>`;}

const ART={
 butterfly:`<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><g class="visitor-wing visitor-wing-left"><path d="M31 30C7-5-7 28 20 37 1 39 13 62 30 39Z" fill="#b8a4f5" stroke="#6a58a4" stroke-width="1.5"/><path d="M29 30C14 10 9 22 24 29" stroke="#f6edff" stroke-width="4" stroke-linecap="round"/><circle cx="22" cy="44" r="3" fill="#f7d5dc"/></g><g class="visitor-wing visitor-wing-right"><path d="M33 30C57-5 71 28 44 37 63 39 51 62 34 39Z" fill="#eab4cf" stroke="#9e6789" stroke-width="1.5"/><path d="M35 30C50 10 55 22 40 29" stroke="#fff0f6" stroke-width="4" stroke-linecap="round"/><circle cx="42" cy="44" r="3" fill="#f8dfa3"/></g><path d="m30 24-4-7m8 7 4-7" stroke="#4b425e" stroke-width="1.8" stroke-linecap="round"/><path d="M32 26v20" stroke="#4b425e" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="25" r="4" fill="#4b425e"/></svg>`,
 bird:`<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="m17 39-9-3 5 13 12-5" fill="#709aa7" stroke="#395d6c" stroke-width="1.5"/><path d="M16 35c0-14 14-19 24-11 14 5 11 25-4 28-12 2-21-5-20-17Z" fill="#92bfc8" stroke="#395d6c" stroke-width="1.5"/><path d="M28 40c3-9 15-8 17-1 1 13-18 13-17 1Z" fill="#ffe6c3"/><g class="visitor-bird-wing"><path d="M28 36C-2 10 8 6 28 23c8-17 18-9 8 11Z" fill="#c0dfe2" stroke="#395d6c" stroke-width="1.5"/></g><path d="m47 30 10 4-10 3Z" fill="#e8ad66" stroke="#96642e" stroke-width="1.2"/><circle cx="42" cy="28" r="3" fill="#263a48"/><circle cx="43" cy="27" r="1" fill="white"/><path d="m31 51-2 6m9-6 1 6" stroke="#96642e" stroke-width="2" stroke-linecap="round"/><ellipse cx="44" cy="36" rx="3" ry="2" fill="#eaaeb5"/></svg>`,
 firefly:`<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle class="visitor-glow" cx="32" cy="42" r="20" fill="#f4df86" opacity=".25"/><g class="visitor-wing visitor-wing-left"><ellipse cx="22" cy="26" rx="7" ry="14" transform="rotate(-35 22 26)" fill="#d7ece6" stroke="#6f9294" stroke-width="1.2"/></g><g class="visitor-wing visitor-wing-right"><ellipse cx="42" cy="26" rx="7" ry="14" transform="rotate(35 42 26)" fill="#d7ece6" stroke="#6f9294" stroke-width="1.2"/></g><ellipse cx="32" cy="40" rx="9" ry="13" fill="#f5db7d" stroke="#9b8748" stroke-width="1.5"/><path d="M24 35h16v7H24Z" fill="#6a8170"/><path d="m28 21-4-6m12 6 4-6" stroke="#425953" stroke-width="1.8" stroke-linecap="round"/><circle cx="32" cy="25" r="8" fill="#6a8170"/><circle cx="29" cy="24" r="1.5" fill="#fff"/><circle cx="35" cy="24" r="1.5" fill="#fff"/><path d="M30 28q2 2 4 0" stroke="#fff" stroke-linecap="round"/></svg>`
};
function install(a){
 const $=id=>document.getElementById(id),random=(min,max)=>min+Math.random()*(max-min);
 let preferences={...DEFAULTS},phase='',active=null,nextVisit=root.Date.now()+random(12000,22000),quietUntil=0,pointerHeld=false,lastMinute='';
 try{preferences=normalise(JSON.parse(localStorage.getItem(STORE)||'null'));}catch{}
 const media=root.matchMedia?.('(prefers-reduced-motion: reduce)');
 const reduced=()=>!!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const motion=()=>a.prefs().motion!=='off'&&!reduced();
 const editing=()=>document.activeElement?.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
 const quiet=()=>!a.ready()||document.hidden||!motion()||document.body.matches('.hub-present,.hub-private,.hub-focus,.hub-sorting')||!!document.querySelector('dialog[open]')||editing()||pointerHeld||root.Date.now()<quietUntil;
 const viewport=()=>{const v=root.visualViewport;return{x:v?.offsetLeft||0,y:v?.offsetTop||0,w:v?.width||root.innerWidth||375,h:v?.height||root.innerHeight||667};};
 function clearVisitor(){
  if(!active)return;const previous=active,hadFocus=previous.el===document.activeElement;active=null;previous.el.remove();a.visitorEnd?.();
  if(hadFocus){const card=$('hubAtmosphereCard');(card?.getBoundingClientRect().width?card:$('settingsMenu')?.querySelector('summary'))?.focus({preventScroll:true});}
 }
 function sync(){
  const date=new root.Date(),hours=date.getHours()+date.getMinutes()/60,day=Math.max(0,Math.min(1,(hours-6)/13)),night=((hours+4)%24)/10;document.body.style.setProperty('--ambient-sun-x',Math.round(-115+day*150)+'px');document.body.style.setProperty('--ambient-sun-y',Math.round(40-Math.sin(day*Math.PI)*40)+'px');document.body.style.setProperty('--ambient-moon-x',Math.round(-60+Math.min(1,night)*75)+'px');document.body.style.setProperty('--ambient-moon-y',Math.round(13-Math.sin(Math.min(1,night)*Math.PI)*15)+'px');
  const next=preferences.mode==='auto'?phaseAt(date):preferences.mode;document.body.dataset.atmospherePaused=String(document.hidden||!motion());if(preferences.mode!=='auto'){const fixed={morning:[-65,14],afternoon:[-15,-4],evening:[12,36],night:[0,0]}[next]||[0,0];document.body.style.setProperty('--ambient-sun-x',fixed[0]+'px');document.body.style.setProperty('--ambient-sun-y',fixed[1]+'px');}
  if(phase!==next){phase=next;clearVisitor();}
  if(document.body.dataset.atmosphere!==phase)document.body.dataset.atmosphere=phase;
  const ready=a.ready(),present=document.body.classList.contains('hub-present'),paused=quiet();
  const layer=$('hubAtmosphere');if(layer){layer.hidden=!ready||present||phase==='off';layer.dataset.rain=String(preferences.rain);layer.dataset.paused=String(paused);}
  const visitors=$('hubVisitors');if(visitors)visitors.hidden=!ready||paused||!preferences.visitors;
  if(paused||!preferences.visitors)clearVisitor();
  const card=$('hubAtmosphereCard');if(card){card.hidden=!ready||present||phase==='off';card.dataset.phase=phase;card.dataset.paused=String(paused);card.setAttribute('aria-label',PHASES[phase]+'. Change atmosphere and visitors.');}
  const pocket=$('hubAtmospherePocket');if(pocket){pocket.hidden=!ready||present||phase==='off';pocket.dataset.phase=phase;pocket.dataset.paused=String(paused);pocket.setAttribute('aria-label',PHASES[phase]+'. Open atmosphere settings.');}
  const badge=$('hubAtmosphereBadge');if(badge){badge.hidden=!ready||present||phase==='off';badge.textContent=PHASES[phase];}
  if($('atmosphereSettings'))$('atmosphereSettings').hidden=!ready;
  const minute=date.toDateString()+':'+date.getHours()+':'+date.getMinutes();
  if(lastMinute!==minute||$('hubAtmosphereCaption')?.dataset.phase!==phase){lastMinute=minute;const caption=$('hubAtmosphereCaption');if(caption){caption.dataset.phase=phase;caption.textContent=PHASES[phase];}$('hubAtmosphereClock')?.replaceChildren(document.createTextNode(date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+(preferences.mode==='auto'?' · Local time':' · Your scene')));}
 }
 function mount(){
  if(!$('hubAtmosphere')){const el=document.createElement('div');el.id='hubAtmosphere';el.setAttribute('aria-hidden','true');el.innerHTML='<div class="ambient-haze"></div><div class="ambient-rain">'+Array.from({length:14},(_,i)=>`<i style="--drop:${i}"></i>`).join('')+'</div>';document.body.prepend(el);}
  if(!$('hubVisitors')){const el=document.createElement('div');el.id='hubVisitors';el.setAttribute('aria-label','Tiny workspace visitors');document.body.append(el);}
  const settings=$('hubSettingsAppearance');if(settings&&!$('atmosphereSettings')){const b=document.createElement('button');b.type='button';b.id='atmosphereSettings';b.dataset.atmosphereAction='settings';b.textContent='Atmosphere & visitors';settings.append(b);}
  const sidebar=$('hubSidebar');if(sidebar&&!$('hubAtmosphereCard')){const b=document.createElement('button');b.id='hubAtmosphereCard';b.type='button';b.dataset.atmosphereAction='settings';b.innerHTML=scene()+'<span id="hubAtmosphereCaption"></span><small id="hubAtmosphereClock"></small>';sidebar.insertBefore(b,sidebar.querySelector('.hub-side-note'));}
  const brand=document.querySelector('.hub-header-copy');if(brand&&!$('hubAtmosphereBadge')){const badge=document.createElement('span');badge.id='hubAtmosphereBadge';badge.setAttribute('aria-hidden','true');brand.append(badge);}
  if(brand&&!$('hubAtmospherePocket')){const pocket=document.createElement('button');pocket.id='hubAtmospherePocket';pocket.type='button';pocket.dataset.atmosphereAction='settings';pocket.innerHTML=scene();brand.append(pocket);}
  sync();
 }
 function settings(){
  if(!a.ready())return;if($('settingsMenu'))$('settingsMenu').open=false;
  const p=preferences;
  a.openModal('Atmosphere & tiny visitors',`<form id="atmosphereForm"><div class="ambient-preview" id="atmospherePreview" data-phase="${phase}">${scene()}<div><span class="hub-kicker">A LITTLE WINDOW INTO YOUR DAY</span><h3 id="atmospherePreviewTitle">${PHASES[phase]}</h3><p>Small moments of nature, right at your desk.</p></div></div><label for="atmosphereMode">Your atmosphere</label><select id="atmosphereMode" name="mode">${[['auto','Follow my local time'],['morning','Morning light'],['afternoon','Afternoon glow'],['evening','Evening warmth'],['night','Starlight'],['off','Off · use my saved theme']].map(([id,label])=>`<option value="${id}"${p.mode===id?' selected':''}>${label}</option>`).join('')}</select><div class="ambient-switches"><label class="check-label"><input type="checkbox" name="rain"${p.rain?' checked':''}><span><strong>Gentle rain</strong><small>A quiet visual drizzle. No sound or weather lookup.</small></span></label><label class="check-label"><input type="checkbox" name="visitors"${p.visitors?' checked':''}><span><strong>Tiny visitors</strong><small>Butterflies by morning, little birds by afternoon, fireflies after dusk. Tap one to say hello.</small></span></label></div><p class="hub-meta">These choices are remembered on this device. Visitors and rain pause while you type, use Focus or Present, or leave this page. Reduced motion and Animations Off keep the scenery still.</p><p id="atmosphereMotionNote" class="hub-meta"${motion()?' hidden':''}>Your motion setting is keeping visitors and rain paused.</p><div class="modal-actions"><button type="button" data-atmosphere-action="cancel">Cancel</button><button type="submit" name="action" value="visit"${motion()?'':' disabled'}>Save & meet a visitor</button><button type="submit" class="primary" name="action" value="save">Save atmosphere</button></div></form>`);
 }
 function landing(){
  const v=viewport(),size=48;if(v.w<300||v.h<320)return null;
  const left=v.x+10,right=v.x+v.w-size-10,top=v.y+12,bottom=v.y+v.h-size-24;
  const card=$('hubAtmosphereCard'),r=card?.getBoundingClientRect(),points=[];
  if(v.w>900&&r?.width&&r.top>=v.y&&r.bottom<=v.y+v.h)points.push({x:r.left+r.width*.55-size/2,y:r.top+24});
  points.push({x:left,y:bottom},{x:right,y:bottom},{x:right,y:top+v.h*.3},{x:left,y:top+v.h*.45});
  const obstacles=[...document.querySelectorAll('#hubPet,#musicCorner,#hubTimerBar,#hubMomoBall,#hubMomoHome,#hubMomoMenu,.toast:not([hidden]),button,input,select,textarea,a,summary,[role="button"]')].filter(el=>!el.closest('#hubAtmosphereCard,#hubVisitors')).map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
  return points.find(p=>p.x>=v.x+8&&p.x+size<=v.x+v.w-8&&p.y>=v.y+8&&p.y+size<=v.y+v.h-8&&!obstacles.some(r=>p.x<r.right+6&&p.x+size>r.left-6&&p.y<r.bottom+6&&p.y+size>r.top-6))||null;
 }
 function invite(){
  sync();if(!preferences.visitors||quiet()||active)return false;
  const v=viewport(),kind=phase==='morning'?'butterfly':phase==='afternoon'?'bird':phase==='evening'||phase==='night'?'firefly':(phaseAt()==='morning'?'butterfly':phaseAt()==='afternoon'?'bird':'firefly');
  const perch=a.visitor?.(kind)||landing();if(!perch){nextVisit=root.Date.now()+15000;return false;}
  const el=document.createElement('button');el.type='button';el.className='hub-visitor';el.dataset.visitor=kind;el.setAttribute('aria-label',`Say hello to the ${kind}. Escape lets it fly away.`);el.title='A tiny visitor · tap to say hello';el.innerHTML='<span class="visitor-art">'+ART[kind]+'</span><span class="visitor-heart" aria-hidden="true">♡</span>';
  const fromLeft=perch.x<v.x+v.w/2;
  el.style.setProperty('--visitor-from-x',(fromLeft?v.x-65:v.x+v.w+12)+'px');el.style.setProperty('--visitor-from-y',Math.max(v.y+12,perch.y-110)+'px');el.style.setProperty('--visitor-x',perch.x+'px');el.style.setProperty('--visitor-y',perch.y+'px');el.style.setProperty('--visitor-out-x',(fromLeft?v.x+v.w+12:v.x-65)+'px');el.style.setProperty('--visitor-out-y',Math.max(v.y+12,perch.y-160)+'px');el.style.setProperty('--visitor-direction',fromLeft?'1':'-1');
  $('hubVisitors').append(el);active={el,kind,expires:root.Date.now()+19000,greeted:false};nextVisit=root.Date.now()+random(65000,120000);return true;
 }
 function hello(){
  if(!active||active.greeted)return;const r=active.el.getBoundingClientRect();active.greeted=true;active.expires=root.Date.now()+1600;
  active.el.style.left=r.left+'px';active.el.style.top=r.top+'px';active.el.classList.add('is-greeted');
  a.react('happy',({butterfly:'A tiny colleague! No meeting invite needed.',bird:'Our new teammate works for breadcrumbs.',firefly:'A little light for your next bright idea.'})[active.kind],3500);
 }
 function tick(){sync();if(active&&root.Date.now()>=active.expires&&(active.greeted||document.activeElement!==active.el))clearVisitor();if(!active&&!quiet()&&root.Date.now()>=nextVisit)invite();}
 document.addEventListener('click',event=>{const visitor=event.target.closest?.('.hub-visitor');if(visitor&&visitor===active?.el){hello();return;}const action=event.target.closest?.('[data-atmosphere-action]')?.dataset.atmosphereAction;if(action==='settings')settings();else if(action==='cancel')a.closeModal();});
 document.addEventListener('submit',event=>{
  if(event.target.id!=='atmosphereForm')return;event.preventDefault();
  const form=event.target;preferences=normalise({mode:form.elements.namedItem('mode').value,rain:form.elements.namedItem('rain').checked,visitors:form.elements.namedItem('visitors').checked});
  let remembered=true;try{localStorage.setItem(STORE,JSON.stringify(preferences));}catch{remembered=false;}
  a.closeModal();quietUntil=0;sync();if(event.submitter?.value==='visit'){if(!preferences.visitors)a.tell('Turn on Tiny visitors to invite one.');else if(!invite())a.tell('Your visitor will stop by when there is a little room and motion is enabled.');}else a.tell(remembered?'Atmosphere saved on this device.':'Atmosphere applied for this visit. This browser could not remember the setting.',!remembered);
 });
 document.addEventListener('change',event=>{if(event.target.id!=='atmosphereMode')return;const previewPhase=event.target.value==='auto'?phaseAt():event.target.value;$('atmospherePreview').dataset.phase=previewPhase;$('atmospherePreviewTitle').textContent=PHASES[previewPhase];});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){clearVisitor();nextVisit=root.Date.now()+65000;}});
 document.addEventListener('focusin',()=>{if(editing()){quietUntil=root.Date.now()+8000;sync();}else if(document.activeElement===active?.el)active.el.classList.add('is-held');});
 document.addEventListener('focusout',event=>{if(event.target===active?.el){active.el.classList.remove('is-held');if(active.greeted)clearVisitor();}});
 document.addEventListener('input',()=>{quietUntil=root.Date.now()+8000;sync();});
 document.addEventListener('pointerdown',event=>{if(event.target.closest?.('.hub-visitor'))return;pointerHeld=true;quietUntil=root.Date.now()+6000;sync();},{passive:true});
 const release=()=>{pointerHeld=false;};document.addEventListener('pointerup',release);document.addEventListener('pointercancel',release);
 root.addEventListener('blur',release);
 const relayout=()=>{clearVisitor();quietUntil=root.Date.now()+3000;sync();};root.addEventListener('resize',relayout);root.visualViewport?.addEventListener('resize',relayout);root.visualViewport?.addEventListener('scroll',relayout);
 root.addEventListener('scroll',()=>{quietUntil=root.Date.now()+3000;sync();},{passive:true});
 document.addEventListener('visibilitychange',()=>{pointerHeld=false;if(!document.hidden){quietUntil=root.Date.now()+3000;nextVisit=Math.max(nextVisit,quietUntil);}sync();});root.addEventListener('pagehide',clearVisitor);root.addEventListener('pageshow',sync);
 new root.MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class','data-motion']});if($('modal'))new root.MutationObserver(sync).observe($('modal'),{attributes:true,attributeFilter:['open']});media?.addEventListener?.('change',sync);
 root.addEventListener('storage',event=>{if(event.key!==STORE&&event.key!==null)return;try{preferences=normalise(JSON.parse(localStorage.getItem(STORE)||'null'));}catch{preferences={...DEFAULTS};}sync();});
 return{mount,sync,tick,settings,invite,snapshot:()=>({preferences:{...preferences},phase,reduced:reduced(),paused:!!quiet(),visitor:active?{kind:active.kind,greeted:active.greeted}:null})};
}
root.WorkHubAtmosphere={install,phaseAt};
})(window);
