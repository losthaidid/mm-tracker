import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';

const source = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/141.0 Mobile/15E148 Safari/604.1';
const settle = async () => {for(let i=0;i<12;i++) await Promise.resolve();};
function setup(t, {ua=iphone,platform='iPhone',styles=false}={}) {
  const dom = new JSDOM('<body data-motion="playful"><nav id="tabs"><button>Next section</button></nav><main id="view"><section>'+Array.from({length:24},(_,i)=>`<article class="hub-card"><button>Card ${i}</button><input value="Keep my text"></article>`).join('')+'</section></main><div class="mv-atmosphere"><i></i></div><div class="mv-widget-shell"><span class="hub-sensitive">Private note</span></div><div class="rest-room" data-phase="complete"><div class="rest-moon"></div></div></body>',{url:'https://losthaidid.github.io/mm-tracker/',runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  const {window}=dom, {document}=window;
  Object.defineProperty(window.navigator,'userAgent',{value:ua,configurable:true});
  Object.defineProperty(window.navigator,'platform',{value:platform,configurable:true});
  window.matchMedia=()=>({matches:false,addEventListener(){}});
  window.setTimeout=()=>0;
  const observers=[];
  window.IntersectionObserver=class {
    constructor(callback){this.callback=callback;this.targets=new Set();observers.push(this);}
    observe(el){this.targets.add(el);}unobserve(el){this.targets.delete(el);}disconnect(){this.targets.clear();}
  };
  if(styles){const style=document.createElement('style');style.textContent=['base.css','studio.css','my-day-visuals.css','rest-room.css','dramatic-motion.css','iphone-motion.css'].map(source).join('\n');document.head.append(style);}
  window.eval(source('render-profile.js'));
  window.eval(source('dramatic-motion.js'));
  return {window,document,observers};
}

test('render profile targets iPhone browsers and keeps iPad, Android, Mac and desktop browsers full',t=>{
  const {window,document}=setup(t);
  const {detect}=window.WorkHubRenderProfile;
  for(const browser of ['Version/26.0 Mobile Safari/604.1','CriOS/141.0 Mobile Safari/604.1','FxiOS/144.0 Mobile Safari/605.1.15','EdgiOS/141.0 Mobile Safari/605.1.15']) assert.equal(detect({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) '+browser}),true);
  assert.equal(detect({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'iPhone'}),true,'desktop-request mode retains the iPhone platform signal');
  for(const device of [{userAgent:'Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X)',platform:'iPad'},{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel',maxTouchPoints:5},{userAgent:'Mozilla/5.0 (Linux; Android 16)',platform:'Linux armv8l'},{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',platform:'Win32'},{}])assert.equal(detect(device),false);
  assert.equal(document.documentElement.dataset.renderProfile,'iphone');
  const html=source('index.html');assert.ok(html.indexOf('render-profile.js')<html.indexOf('<link rel="stylesheet"'));
});

test('iPhone effects cap simultaneous glints and reactions, survive navigation, and preserve form content',async t=>{
  const {window,document,observers}=setup(t);await settle();
  assert.equal(document.querySelectorAll('#hubSpectacle .fx-dust').length,12);
  assert.equal(document.querySelectorAll('#hubSpectacle .fx-ribbon').length,0);
  const cards=[...document.querySelectorAll('.hub-card')],io=observers[0];
  io.callback(cards.map(target=>({target,isIntersecting:true})));
  assert.equal(document.querySelectorAll('.hub-card.fx-visible').length,6);
  io.callback(cards.slice(0,6).map(target=>({target,isIntersecting:false})));
  assert.equal(document.querySelectorAll('.hub-card.fx-visible').length,6);
  assert.equal(cards[6].classList.contains('fx-visible'),true);
  for(let i=0;i<40;i++)document.querySelector('#tabs button').click();
  assert.ok(document.querySelector('.fx-reactions').childElementCount<=28);
  assert.equal(document.querySelector('.fx-scene-sweep'),null);
  assert.ok([...document.querySelectorAll('input')].every(el=>el.value==='Keep my text'));
  document.getElementById('view').innerHTML='<section><article class="hub-card">A different section</article></section>';await settle();
  assert.ok([...io.targets].every(el=>el.isConnected));
  document.body.dataset.motion='off';window.WorkHubSpectacle.sync();
  assert.equal(document.getElementById('hubSpectacle').hidden,true);
  assert.equal(document.querySelector('.fx-reactions').childElementCount,0);
});

test('full rendering keeps its particle count, unlimited visible panels and navigation sweep',async t=>{
  const {window,document,observers}=setup(t,{ua:'Mozilla/5.0 (Linux; Android 16)',platform:'Linux armv8l'});await settle();
  assert.equal(document.documentElement.dataset.renderProfile,'full');
  assert.equal(document.querySelectorAll('#hubSpectacle .fx-dust').length,32);
  assert.equal(document.querySelector('#hubSpectacle .fx-ribbon'),null);
  const cards=[...document.querySelectorAll('.hub-card')];observers[0].callback(cards.map(target=>({target,isIntersecting:true})));
  assert.equal(document.querySelectorAll('.hub-card.fx-visible').length,24);
  document.querySelector('#tabs button').click();assert.ok(document.querySelector('.fx-scene-sweep'));
  assert.equal(window.WorkHubRenderProfile.iphone,false);
});

test('iPhone CSS removes expensive blur and 3D card layers while preserving private-text redaction',async t=>{
  const {window,document}=setup(t,{styles:true});await settle();
  assert.equal(window.getComputedStyle(document.querySelector('.mv-atmosphere i')).filter,'none');
  assert.equal(window.getComputedStyle(document.querySelector('.mv-widget-shell')).transform,'none');
  assert.equal(window.getComputedStyle(document.querySelector('.mv-widget-shell')).backdropFilter,'none');
  assert.equal(window.getComputedStyle(document.querySelector('.rest-moon')).boxShadow, 'none');
  document.body.classList.add('hub-private');await settle();
  assert.match(window.getComputedStyle(document.querySelector('.hub-sensitive')).filter,/blur/);
  const full=setup(t,{styles:true,ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel'});await settle();
  assert.doesNotMatch(full.window.getComputedStyle(full.document.querySelector('.mv-atmosphere i')).filter,/blur/);
});

test('small UI updates inspect only their changed branch and new modal cards still receive decoration',async t=>{
  const {window,document,observers}=setup(t);await settle();
  const query=document.querySelectorAll.bind(document);let documentScans=0;
  document.querySelectorAll=selector=>{if(selector.startsWith('.hub-card,.mv-widget-shell,'))documentScans++;return query(selector);};
  const first=document.querySelector('.hub-card');
  for(let i=0;i<20;i++){const note=document.createElement('span');note.textContent='Updated label';first.append(note);await settle();note.remove();await settle();}
  document.body.classList.add('unrelated-ui-state');await settle();
  assert.equal(documentScans,0,'small updates and unrelated body state must not rescan the workspace');
  const modal=document.createElement('dialog');modal.innerHTML='<article class="hub-card">A newly opened card</article>';document.body.append(modal);await settle();
  const card=modal.querySelector('.hub-card');assert.ok(card.classList.contains('fx-surface'));assert.equal(card.querySelectorAll(':scope > .fx-panel-aura').length,1);assert.ok(observers[0].targets.has(card));assert.equal(documentScans,0);
  modal.remove();await settle();assert.ok(!observers[0].targets.has(card));
  document.body.dataset.motion='off';window.WorkHubSpectacle.sync();document.body.dataset.motion='playful';window.WorkHubSpectacle.sync();await settle();assert.equal(documentScans,1);assert.ok(observers[0].targets.has(first));assert.equal(first.querySelectorAll(':scope > .fx-panel-aura').length,1);
});

test('offscreen and covered workspace animation pauses without pausing the visible rest scene',async t=>{
  const {window,document}=setup(t,{styles:true});await settle();
  const card=document.querySelector('.hub-card');card.classList.add('mv-out-of-view');
  assert.equal(window.getComputedStyle(card.querySelector('button')).animationPlayState,'paused');
  document.body.classList.add('rest-room-open');
  assert.equal(window.getComputedStyle(document.querySelector('#view')).animationPlayState,'paused');
  assert.notEqual(window.getComputedStyle(document.querySelector('.rest-moon')).animationPlayState,'paused');
  document.body.classList.remove('rest-room-open');card.classList.remove('mv-out-of-view');
  assert.notEqual(window.getComputedStyle(card.querySelector('button')).animationPlayState,'paused');
});
test('plain section headings never receive the animated rectangular card border while real cards retain it',async t=>{
 const {document}=setup(t,{ua:'Desktop',platform:'Win32'}),view=document.getElementById('view');for(const text of ['Knowledge notebook','Waiting on','Studio']){const head=document.createElement('div');head.className='hub-head';head.textContent=text;view.firstElementChild.append(head);}await settle();for(const head of document.querySelectorAll('.hub-head'))assert.equal(head.querySelector('.fx-panel-aura'),null);assert.ok(document.querySelector('.hub-card .fx-panel-aura'));
});
