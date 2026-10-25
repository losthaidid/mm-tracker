import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
const source=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
function setup(t){const dom=new JSDOM('<body><div id="hubPet"><button></button></div><dialog id="modal"></dialog></body>',{url:'https://preview.test',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());const w=dom.window;w.matchMedia=()=>({matches:false});w.eval(source('momo-wardrobe.js'));w.eval(source('momo-art.js'));w.document.querySelector('#hubPet button').innerHTML=w.WorkHubMomoArt.svg('none');return {w,d:w.document,E:w.WorkHubMomoWardrobe,p:{outfit:'daily',outfitPalette:'daily',accessory:'daily',hobbies:true,mascot:true,motion:'calm'}};}
test('automatic wardrobe changes morning, afternoon and night, keeps each night through midnight and rotates distinct pajamas',t=>{
 const h=setup(t),seen=new Set(),nightSeen=new Set();
 for(let i=0;i<138;i++){
  const morning=h.E.look(h.p,'owner',new Date(2026,0,1+i,6));
  const lateMorning=h.E.look(h.p,'owner',new Date(2026,0,1+i,11,59));
  const afternoon=h.E.look(h.p,'owner',new Date(2026,0,1+i,12));
  const night=h.E.look(h.p,'owner',new Date(2026,0,1+i,19));
  const midnight=h.E.look(h.p,'owner',new Date(2026,0,2+i,0));
  const nextNight=h.E.look(h.p,'owner',new Date(2026,0,2+i,19));
  assert.equal(morning.key,lateMorning.key);assert.notEqual(morning.outfit,afternoon.outfit);
  assert.equal(morning.period,'morning');assert.equal(afternoon.period,'afternoon');assert.equal(night.period,'night');
  assert.ok(night.outfit.startsWith('pyjamas'));assert.notEqual(night.outfit,nextNight.outfit);
  assert.equal(night.key,midnight.key);assert.equal(night.accessory,'none');
  seen.add(morning.outfit+'|'+morning.palette[0]);seen.add(afternoon.outfit+'|'+afternoon.palette[0]);
  if(i<96)nightSeen.add(night.outfit+'|'+night.palette[0]);
 }
 assert.equal(seen.size,276);assert.equal(nightSeen.size,96);
 const look=h.E.look({...h.p,outfit:'artist',outfitPalette:'rose',accessory:'party'},'owner',new Date(2026,0,1,22));
 assert.equal(look.outfit,'artist');assert.equal(look.palette[0],'rose');assert.equal(look.accessory,'party');
 h.E.validate(h.p);assert.throws(()=>h.E.validate({...h.p,outfit:'unknown'}));
});
test('all wardrobe accessories have distinct artwork; Party Hat never falls back to glasses or mandatory headphones',t=>{
 const h=setup(t),art=h.w.WorkHubMomoArt,all=h.E.ACCESSORIES.filter(x=>!['daily','none'].includes(x[0]));assert.equal(all.length,33);const marks=all.map(([id])=>art.accessory(id));assert.ok(marks.every(Boolean));assert.equal(new Set(marks).size,33);assert.match(art.accessory('party'),/66-4/);assert.equal(art.accessory('party'),art.accessory('partyhat'));assert.equal(art.accessory('unknown'),'');assert.doesNotMatch(art.svg('none'),/class="momo-headphones"/);assert.match(art.svg('headphones'),/class="momo-headphones"/);
});
test('wardrobe application keeps the original atlas and updates only changed garment layers',t=>{
 const h=setup(t);h.E.apply(h.p,'owner');const pet=h.d.getElementById('hubPet'),images=[...pet.querySelectorAll('.momo-part-image')],garment=pet.querySelector('#hubPetOutfit').firstChild;h.E.apply(h.p,'owner');assert.equal(pet.querySelector('#hubPetOutfit').firstChild,garment);assert.deepEqual([...pet.querySelectorAll('.momo-part-image')],images);assert.equal(pet.querySelectorAll('.momo-sleeve-overlay').length,2);h.E.apply({...h.p,outfit:'gardener',accessory:'none'},'owner');assert.equal(pet.dataset.outfit,'gardener');assert.equal(pet.querySelector('#hubPetAccessory').children.length,0);
});
test('hobbies are finite and in-place, defer to work and nap, and clear after account changes',t=>{
 const h=setup(t);let now=100000,owner='one',sleeping=false,scene=null;h.w.Date.now=()=>now;const life={sleeping:()=>sleeping,sceneAvailable:()=>!scene&&!sleeping,hobbyAvailable:()=>!scene&&!sleeping,busy:()=>!!scene,scene:v=>scene=v};const ui=h.E.install({ready:()=>true,owner:()=>owner,prefs:()=>h.p,life:()=>life,tell(){},openModal(){},closeModal(){},appearance(){}});ui.mount();assert.equal(ui.play('reading'),true);assert.equal(h.d.querySelector('.momo-hobby-prop').parentElement.classList.contains('pet-body'),true);assert.equal(h.d.getElementById('hubPet').style.left,'');now+=13000;ui.tick();assert.equal(ui.snapshot().active,null);assert.equal(h.d.querySelector('.momo-hobby-prop'),null);sleeping=true;assert.equal(ui.play('painting'),false);sleeping=false;h.d.body.classList.add('hub-focus');assert.equal(ui.play('music'),false);h.d.body.classList.remove('hub-focus');assert.equal(ui.play('origami'),true);owner='two';ui.mount();assert.equal(ui.snapshot().active,null);assert.equal(h.d.querySelector('.momo-hobby-prop'),null);
});
