import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';

const source = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/141.0 Mobile/15E148 Safari/604.1';
const settle = async () => {for(let i=0;i<12;i++) await Promise.resolve();};
function setup(t, {ua=iphone,platform='iPhone',styles=false}={}) {
  const dom = new JSDOM('<body data-motion="playful"><nav id="tabs"><button>Next section</button></nav><main id="view"><section>'+Array.from({length:24},(_,i)=>`<article class="hub-card"><button>Card ${i}</button><input value="Keep my text"></article>`).join('')+'</section></main><div class="fx-ribbon"></div><div class="mv-widget-shell"><span class="hub-sensitive">Private note</span></div><div class="rest-room" data-phase="complete"><div class="rest-moon"></div></div></body>',{url:'https://losthaidid.github.io/mm-tracker/',runScripts:'outside-only',pretendToBeVisual:true});
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
  assert.equal(document.querySelectorAll('#hubSpectacle .fx-ribbon').length,2);
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
  const cards=[...document.querySelectorAll('.hub-card')];observers[0].callback(cards.map(target=>({target,isIntersecting:true})));
  assert.equal(document.querySelectorAll('.hub-card.fx-visible').length,24);
  document.querySelector('#tabs button').click();assert.ok(document.querySelector('.fx-scene-sweep'));
  assert.equal(window.WorkHubRenderProfile.iphone,false);
});

test('iPhone CSS removes expensive blur and 3D card layers while preserving private-text redaction',async t=>{
  const {window,document}=setup(t,{styles:true});await settle();
  assert.equal(window.getComputedStyle(document.querySelector('.fx-ribbon')).filter,'none');
  assert.equal(window.getComputedStyle(document.querySelector('.mv-widget-shell')).transform,'none');
  assert.equal(window.getComputedStyle(document.querySelector('.mv-widget-shell')).backdropFilter,'none');
  assert.equal(window.getComputedStyle(document.querySelector('.rest-moon')).boxShadow, 'none');
  document.body.classList.add('hub-private');await settle();
  assert.match(window.getComputedStyle(document.querySelector('.hub-sensitive')).filter,/blur/);
  const full=setup(t,{styles:true,ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel'});await settle();
  assert.match(full.window.getComputedStyle(full.document.querySelector('.fx-ribbon')).filter,/blur/);
});
