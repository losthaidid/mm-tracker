import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
function setup(t,{decode,storage,refreshTheme}={}){const dom=new JSDOM('<body><dialog id="modal"><div id="modalBody"></div></dialog></body>',{url:'https://preview.test',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window,d=w.document,rows=new Map(),writes=[],messages=[],revoked=[];let owner='one';w.URL.createObjectURL=()=>`blob:picture-${Math.random()}`;w.URL.revokeObjectURL=url=>revoked.push(url);w.eval(readFileSync(new URL('../photo-background.js',import.meta.url),'utf8'));const db=storage||{read:async id=>rows.get(id),write:async row=>{writes.push(row);rows.set(row.id,row);}};const ui=w.WorkHubPhotoBackground.install({ready:()=>!!owner,owner:()=>owner,storage:db,refreshTheme,optimise:decode||(async()=>new w.Blob(['pixels'],{type:'image/jpeg'})),tell:(m)=>messages.push(m),openModal:(title,html)=>d.getElementById('modalBody').innerHTML=html,closeModal:()=>d.getElementById('modalBody').replaceChildren()});return {w,d,ui,rows,writes,messages,revoked,async account(id){owner=id;await ui.mount();}};}
test('background pictures persist per device account, can be used on the page or hero, and clear from the DOM on sign-out',async t=>{
 const h=setup(t);await h.ui.mount();await h.ui.upload({name:'Sunset <img>.png'});assert.equal(h.ui.snapshot().count,1);assert.equal(h.d.body.dataset.photoBackground,'page');await h.ui.open();assert.equal(h.d.querySelectorAll('.photo-grid article').length,1);assert.equal(h.d.querySelector('.photo-grid p').textContent,'Sunset <img>.png');const f=h.d.getElementById('photoBackgroundForm');f.elements.target.value='both';f.elements.strength.value='75';f.dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(h.d.body.dataset.photoBackground,'both');await h.account('two');assert.equal(h.ui.snapshot().count,0);assert.equal(h.d.getElementById('workspacePhoto'),null);await h.account('one');assert.equal(h.ui.snapshot().count,1);assert.equal(h.d.body.dataset.photoBackground,'both');await h.account('');assert.equal(h.d.getElementById('workspacePhoto'),null);assert.ok(h.revoked.length>0);
});
test('a decoded background from a previous account never saves into the next account',async t=>{
 let resolve;const h=setup(t,{decode:()=>new Promise(r=>resolve=r)});await h.ui.mount();const pending=h.ui.upload({name:'Private picture.png'});await settle();await h.account('two');resolve(new h.w.Blob(['pixels'],{type:'image/jpeg'}));assert.equal(await pending,false);assert.equal(h.writes.length,0);assert.equal(h.ui.snapshot().count,0);
});
test('photo gallery stays bounded and a failed write retains the previous background',async t=>{
 const h=setup(t);await h.ui.mount();for(let i=0;i<6;i++)await h.ui.upload({name:'Photo '+i});await assert.rejects(()=>h.ui.upload({name:'Too many'}),/six pictures/);assert.equal(h.ui.snapshot().count,6);
 const bad=setup(t,{storage:{read:async id=>({id,photos:[],selected:'',target:'page',strength:40}),write:async()=>{throw Error('Storage full');}}});await bad.ui.mount();await assert.rejects(()=>bad.ui.upload({name:'Picture'}),/Storage full/);assert.equal(bad.ui.snapshot().count,0);assert.equal(bad.d.getElementById('workspacePhoto'),null);
});

const savedPicture = (id = 'one', target = 'both') => ({id, photos:[{
 id:'saved-picture', name:'My landscape', blob:new Blob(['picture'],{type:'image/jpeg'}),
}], selected:'saved-picture', strength:65, target});

test('Use theme background restores the current theme before a slow device save, closes the gallery and keeps the pictures',async t=>{
 let stored=savedPicture(),complete,refreshes=0;
 const h=setup(t,{refreshTheme:()=>refreshes++,storage:{read:async()=>stored,write:next=>new Promise(resolve=>{complete=()=>{stored=next;resolve();};})}});
 await h.ui.mount();await h.ui.open();
 const photo=stored.photos[0];assert.ok(h.d.getElementById('workspacePhoto'));
 h.d.querySelector('[data-photo="theme"]').click();
 assert.equal(h.d.getElementById('workspacePhoto'),null);
 assert.equal(h.d.body.hasAttribute('data-photo-background'),false);
 assert.equal(h.d.body.style.getPropertyValue('--workspace-photo'),'');
 assert.equal(h.d.getElementById('photoBackgroundForm'),null);
 assert.equal(h.ui.snapshot().selected,'');assert.equal(h.ui.snapshot().count,1);assert.equal(refreshes,1);
 assert.equal(stored.selected,'saved-picture');
 complete();await settle();assert.equal(stored.selected,'');assert.equal(stored.photos[0],photo);
 await h.ui.open();assert.match(h.d.querySelector('[role="status"]').textContent,/Theme background active/);
 assert.equal(h.d.querySelectorAll('.photo-grid article').length,1);assert.ok(h.d.querySelector('[data-photo="use"]'));
});

test('a failed theme-background save restores the previous picture without deleting it',async t=>{
 let fail;const stored=savedPicture();
 const h=setup(t,{storage:{read:async()=>stored,write:()=>new Promise((resolve,reject)=>{fail=reject;})}});
 await h.ui.mount();await h.ui.open();h.d.querySelector('[data-photo="theme"]').click();
 assert.equal(h.d.getElementById('workspacePhoto'),null);
 fail(Error('Storage full'));await settle();
 assert.equal(h.ui.snapshot().selected,'saved-picture');assert.equal(h.ui.snapshot().count,1);
 assert.equal(h.d.body.dataset.photoBackground,'both');assert.ok(h.d.getElementById('workspacePhoto'));
 assert.match(h.d.body.style.getPropertyValue('--workspace-photo'),/^url\(/);
 assert.match(h.messages.at(-1),/Storage full/);assert.equal(stored.photos.length,1);
});

test('page, welcome and combined pictures return to the current pattern and keep the same welcome scene without reload',async t=>{
 for(const target of ['page','hero','both']){
  const h=setup(t,{storage:{read:async()=>savedPicture('one',target),write:async()=>{}}});
  const style=h.d.createElement('style');style.textContent=['studio.css','momo-wardrobe.css'].map(file=>readFileSync(new URL('../'+file,import.meta.url),'utf8')).join('\n');h.d.head.append(style);
  h.d.body.dataset.hubTheme='forest';h.d.body.dataset.hubBackground='grid';
  const hero=h.d.createElement('section');hero.className='mv-hero';hero.innerHTML='<svg class="mv-scene"></svg>';h.d.body.append(hero);
  const scene=hero.firstElementChild,pattern=h.w.getComputedStyle(h.d.body).backgroundImage;
  await h.ui.mount();
  if(target==='hero')assert.equal(h.w.getComputedStyle(h.d.body).backgroundImage,pattern);
  else assert.equal(h.w.getComputedStyle(h.d.body).backgroundImage,'none');
  await h.ui.open();h.d.querySelector('[data-photo="theme"]').click();
  assert.equal(h.w.getComputedStyle(h.d.body).backgroundImage,pattern,target+' theme pattern');
  assert.notEqual(h.w.getComputedStyle(scene).display,'none');assert.equal(hero.firstElementChild,scene);
  assert.equal(h.d.body.dataset.hubTheme,'forest');assert.equal(h.d.body.dataset.hubBackground,'grid');await settle();
 }
});

test('restoring a suspended page rebuilds active picture URLs and never brings back a picture after selecting the theme',async t=>{
 const h=setup(t);await h.ui.mount();await h.ui.upload({name:'My picture.png'});
 const before=h.d.querySelector('#workspacePhoto img').src;
 h.w.dispatchEvent(new h.w.Event('pagehide'));assert.equal(h.d.getElementById('workspacePhoto'),null);assert.ok(h.revoked.includes(before));
 h.w.dispatchEvent(new h.w.Event('pageshow'));assert.ok(h.d.getElementById('workspacePhoto'));assert.notEqual(h.d.querySelector('#workspacePhoto img').src,before);
 await h.ui.open();h.d.querySelector('[data-photo="theme"]').click();await settle();
 h.w.dispatchEvent(new h.w.Event('pagehide'));h.w.dispatchEvent(new h.w.Event('pageshow'));
 assert.equal(h.d.getElementById('workspacePhoto'),null);assert.equal(h.ui.snapshot().selected,'');assert.equal(h.ui.snapshot().count,1);
});

test('a pending picture save from an earlier account session cannot repaint after returning to that account',async t=>{
 let complete;const h=setup(t,{storage:{read:async id=>id==='one'?savedPicture():null,write:()=>new Promise(resolve=>{complete=resolve;})}});
 await h.ui.mount();const pending=h.ui.upload({name:'Pending picture.png'});await settle();assert.equal(h.ui.snapshot().count,2);
 await h.account('two');await h.account('one');assert.equal(h.ui.snapshot().count,1);assert.equal(h.ui.snapshot().selected,'saved-picture');
 complete();assert.equal(await pending,false);assert.equal(h.ui.snapshot().count,1);assert.equal(h.ui.snapshot().selected,'saved-picture');
});
