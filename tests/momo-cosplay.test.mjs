import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
function setup(t) {
  const dom=new JSDOM('<body><div id="hubPet" style="left:40px;top:60px"><button></button></div><dialog id="modal"></dialog><input id="work"></body>',{url:'https://preview.test',runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  const w=dom.window,d=w.document,p={mascot:true,motion:'calm',outfit:'daily',outfitPalette:'daily',accessory:'daily',hobbies:true,patternSet:'one-piece-voyage'};
  let now=100000,owner='first',sleeping=false,busy=false,scene=null,reduced=false,ready=true;
  const media={get matches(){return reduced;},addEventListener(){}};
  w.matchMedia=()=>media;w.Date.now=()=>now;
  for(const file of ['momo-cosplay-data.js','pattern-collection.js','momo-art.js','momo-cosplay-art.js','momo-cosplay.js','momo-wardrobe.js'])w.eval(source(file));
  d.querySelector('#hubPet button').innerHTML=w.WorkHubMomoArt.svg('none');
  const life={sleeping:()=>sleeping,busy:()=>busy||!!scene,sceneAvailable:()=>!sleeping&&!busy&&!scene,hobbyAvailable:()=>!scene&&!sleeping&&!busy,sceneOwner:()=>scene?.source||'',scene(v){if(sleeping)return false;scene=v;},releaseScene(source){if(scene?.source===source)scene=null;},wake(){throw Error('Cosplay must never wake the companion');}};
  const ui=w.WorkHubMomoCosplay.install({ready:()=>ready,owner:()=>owner,prefs:()=>p,life:()=>life,tell(){}});
  ui.mount();
  return {w,d,p,ui,life,E:w.WorkHubMomoCosplay,A:w.WorkHubMomoCosplayArt,D:w.WorkHubMomoCosplayData,pet:d.getElementById('hubPet'),advance:ms=>now+=ms,setOwner:value=>owner=value,getOwner:()=>owner,apply:()=>w.WorkHubMomoWardrobe.apply(p,owner),setSleep:value=>sleeping=value,setBusy:value=>busy=value,setReduced:value=>reduced=value,setReady:value=>ready=value,
    character(name,move,outfitIndex=0){
      ui.finish();const character=w.WorkHubMomoCosplayData.CHARACTERS.find(c=>c.name===name);assert.ok(character,name);
      p.patternSet=Object.keys(w.WorkHubMomoCosplay.BACKGROUND_SERIES).find(id=>w.WorkHubMomoCosplay.BACKGROUND_SERIES[id]===character.seriesId);
      owner=name+'/'+move;w.localStorage.setItem('mm-tracker.momo-cosplay.v1:'+owner,JSON.stringify({key:character.id+'/'+character.outfits[outfitIndex].id}));ui.mount();
      const i=character.moves.indexOf(move);assert.ok(i>=0);w.Math.random=()=>((i+.1)/character.moves.length);return character;
    },
  };
}
test('cosplay catalog has 40 collections, 200 characters and 600 distinct coordinated variants',t=>{
  const h=setup(t),{D,E}=h;
  assert.equal(D.SERIES.length,40);assert.equal(D.SERIES.filter(s=>s.group==='anime').length,20);assert.equal(D.SERIES.filter(s=>s.group==='cartoon').length,20);
  assert.equal(D.CHARACTERS.length,200);assert.equal(E.looks.length,600);assert.equal(new Set(E.looks.map(l=>l.key)).size,600);
  for(const series of D.SERIES)assert.equal(D.CHARACTERS.filter(c=>c.seriesId===series.id).length,5,series.name);
  for(const c of D.CHARACTERS){
    assert.equal(c.outfits.length,3);assert.equal(new Set(c.outfits.map(o=>o.garment)).size,3,c.name);
    assert.equal(new Set(c.outfits.map(o=>o.accessories.join('|'))).size,3,c.name);
    assert.ok(c.moves.every(m=>D.MOVES.includes(m)&&E.PROFILES[m]));
    for(const o of c.outfits){assert.ok(D.GARMENTS.includes(o.garment));assert.ok(o.accessories.length>=2&&o.accessories.length<=6);assert.ok(o.accessories.every(a=>D.ACCESSORIES.includes(a)));for(const k of ['color','trim','pants'])assert.match(o[k],/^#[0-9a-f]{6}$/i);}
  }
  for(const key of ['cosplayEnabled','cosplayMoves'])assert.throws(()=>E.validate({[key]:'yes'}));
  E.validate({});E.validate({cosplayEnabled:false,cosplayMoves:true});
});
test('every costume and accessory renders on the original atlas with attached arm and leg layers',t=>{
  const h=setup(t),images=[...h.pet.querySelectorAll('.momo-part-image')],parser=new h.w.DOMParser();
  for(const id of h.D.ACCESSORIES){
    const known=h.A.head(id)+h.A.chest(id)+h.A.hand(id)+h.A.back(id);
    assert.ok(known || ['triple-swords','sandals','boots','sneakers','dress-shoes'].includes(id),id);
  }
  for(const current of h.E.looks){
    assert.equal(h.A.render(h.pet,current),true);const xml=parser.parseFromString(h.pet.querySelector('svg').outerHTML,'image/svg+xml');assert.equal(xml.querySelector('parsererror'),null,current.key);
    assert.deepEqual([...h.pet.querySelectorAll('.momo-part-image')],images);assert.equal(h.pet.querySelectorAll('.momo-sleeve-overlay').length,2);assert.equal(h.pet.querySelectorAll('.momo-foot-left > .mc-leg').length,1);assert.equal(h.pet.querySelectorAll('.momo-foot-right > .mc-leg').length,1);
  }
  const layer=h.pet.querySelector('#hubPetOutfit').firstChild,current=h.E.looks.at(-1);h.A.render(h.pet,current);assert.equal(h.pet.querySelector('#hubPetOutfit').firstChild,layer);
});
test('random rotation avoids the previous character and restores each account locally without moving the companion',t=>{
  const h=setup(t),first=h.ui.snapshot().look,seen=new Set([first.key]);
  for(let i=0;i<15;i++){const previous=h.ui.snapshot().look;assert.equal(h.ui.rotate(),true);const current=h.ui.snapshot().look;assert.notEqual(current.character.id,previous.character.id);seen.add(current.key);assert.equal(h.pet.style.left,'40px');assert.equal(h.pet.style.top,'60px');}
  assert.ok(seen.size>=9);const saved=h.ui.snapshot().look.key;h.setOwner('second');h.ui.mount();h.setOwner('first');h.ui.mount();assert.equal(h.ui.snapshot().look.key,saved);
  h.setOwner('');h.ui.mount();assert.equal(h.ui.snapshot().look,null);assert.equal(h.pet.dataset.cosplay,undefined);assert.equal(h.pet.querySelector('.mc-leg'),null);
});
test('all 40 backgrounds restrict random outfits and routines to their own cast',t=>{
  const h=setup(t),sets=h.w.WorkHubPatternCollection.SETS;
  assert.equal(Object.keys(h.E.BACKGROUND_SERIES).length,sets.length);assert.equal(new Set(Object.values(h.E.BACKGROUND_SERIES)).size,40);
  const normalize=s=>s.replaceAll('’',"'");
  for(const set of sets){
    h.p.patternSet=set.id;h.ui.mount();const expected=h.E.selectedSeries(h.p);assert.ok(expected,set.id);assert.equal(normalize(expected.name),normalize(set.series));assert.equal(expected.group,set.group);
    const cast=h.D.CHARACTERS.filter(c=>c.seriesId===expected.id);assert.equal(cast.length,5);
    for(let i=0;i<10;i++){
      const previous=h.ui.snapshot().look;assert.equal(h.ui.rotate(),true);const current=h.ui.snapshot().look;
      assert.equal(current.series.id,expected.id,set.id);assert.equal(current.character.seriesId,expected.id);assert.notEqual(current.character.id,previous.character.id);assert.ok(cast.includes(current.character));
      assert.equal(h.ui.play(),true);assert.ok(current.character.moves.includes(h.ui.snapshot().active));h.ui.finish();
    }
  }
});
test('changing backgrounds immediately cancels the old transformation and restores each collection on return',t=>{
  const h=setup(t);h.character('Goku','saiyan-blue');const goku=h.ui.snapshot().look.key;
  assert.equal(h.ui.play(),true);assert.ok(h.pet.querySelector('.mc-transform-hair path'));
  h.p.patternSet='one-piece-voyage';h.apply();assert.equal(h.ui.snapshot().active,null);assert.equal(h.life.sceneOwner(),'');assert.equal(h.pet.dataset.cosplayMove,undefined);assert.equal(h.pet.dataset.cosplaySeries,'one-piece');assert.equal(h.pet.querySelector('.mc-transform-hair').children.length,0);
  h.ui.mount();const pirate=h.ui.snapshot().look.key;h.p.patternSet='dragon-ball-orbs';h.apply();assert.equal(h.ui.snapshot().look.key,goku);assert.equal(h.pet.dataset.cosplaySeries,'dragon-ball');
  h.ui.mount();h.life.scene({source:'adventure'});h.p.patternSet='';h.apply();assert.equal(h.life.sceneOwner(),'adventure');assert.equal(h.pet.dataset.cosplay,undefined);assert.equal(h.pet.querySelector('.momo-cosplay-layer'),null);assert.equal(h.ui.play(),false);assert.equal(h.ui.rotate(),false);h.life.scene(null);
  h.p.patternSet='one-piece-voyage';h.apply();assert.equal(h.ui.snapshot().look.key,pirate);h.ui.mount();
  h.setSleep(true);h.p.patternSet='spongebob-bottom';h.apply();h.ui.mount();assert.equal(h.pet.dataset.cosplaySeries,'spongebob-squarepants');assert.equal(h.life.sleeping(),true);assert.equal(h.ui.play(),false);const asleep=h.ui.snapshot().look.key;h.advance(1000000);h.ui.tick();assert.equal(h.ui.snapshot().look.key,asleep);
});
test('old or malformed local selections never restore a character from another background',t=>{
  const h=setup(t),goku=h.E.looks.find(l=>l.character.name==='Goku'),luffy=h.E.looks.find(l=>l.character.name==='Monkey D. Luffy');
  for(const scoped of [false,true]){
    const owner='foreign-'+scoped;h.w.localStorage.setItem('mm-tracker.momo-cosplay.v1:'+owner+(scoped?':one-piece':''),JSON.stringify({key:goku.key,recent:[goku.key,'missing',luffy.key]}));h.setOwner(owner);h.ui.mount();assert.equal(h.ui.snapshot().look.series.id,'one-piece');assert.notEqual(h.ui.snapshot().look.key,goku.key);
    const saved=JSON.parse(h.w.localStorage.getItem('mm-tracker.momo-cosplay.v1:'+owner+':one-piece'));assert.ok(saved.recent.every(key=>h.E.looks.find(l=>l.key===key).series.id==='one-piece'));
  }
  h.w.localStorage.setItem('mm-tracker.momo-cosplay.v1:matching',JSON.stringify({key:luffy.key,recent:[goku.key,luffy.key]}));h.setOwner('matching');h.ui.mount();assert.equal(h.ui.snapshot().look.key,luffy.key);
  h.p.patternSet='unknown-collection';h.apply();assert.equal(h.E.activeFor(h.p),false);assert.equal(h.pet.dataset.cosplay,undefined);assert.equal(h.ui.play(),false);
});
test('ordinary backgrounds use regular wardrobe and hobbies; collection changes end automatic hobbies',t=>{
  const h=setup(t),wardrobe=h.w.WorkHubMomoWardrobe.install({ready:()=>true,owner:()=>h.getOwner(),prefs:()=>h.p,life:()=>h.life,tell(){},openModal(){},closeModal(){},appearance(){}});
  wardrobe.mount();assert.equal(wardrobe.play('reading',true),false);assert.equal(wardrobe.play('reading'),true);
  h.p.patternSet='';h.apply();wardrobe.mount();assert.equal(wardrobe.snapshot().active,null);assert.equal(h.pet.querySelector('.momo-hobby-prop'),null);assert.equal(h.pet.dataset.cosplay,undefined);assert.equal(wardrobe.play('reading',true),true);
  h.p.patternSet='naruto-clouds';h.apply();wardrobe.mount();assert.equal(wardrobe.snapshot().active,null);assert.equal(h.pet.querySelector('.momo-hobby-prop'),null);assert.equal(h.pet.dataset.cosplaySeries,'naruto');assert.equal(wardrobe.play('reading',true),false);
});
test('signature moves are finite, keep props attached and fully restore temporary transformations',t=>{
  const h=setup(t);
  for(const [name,moves] of [['Monkey D. Luffy',['stretch','gear2','gear4','gear5']],['Goku',['super-saiyan','saiyan-blue','ultra-instinct']],['Roronoa Zoro',['sword-flurry','three-sword']],['Sanji',['kick','flame-kick']]]){
    for(const move of moves){h.character(name,move,name==='Roronoa Zoro'?2:0);const look=h.ui.snapshot().look.key;assert.equal(h.ui.play(),true,move);assert.equal(h.pet.dataset.cosplayMove,move);assert.equal(h.life.sceneOwner(),'cosplay');
      if(['gear5','super-saiyan','saiyan-blue','ultra-instinct'].includes(move))assert.ok(h.pet.querySelector('.mc-transform-hair path'));
      if(move==='three-sword'){assert.equal(h.pet.querySelectorAll('.mc-routine-prop').length,3);assert.ok(h.pet.querySelector('.momo-arm-left > .mc-routine-prop'));assert.ok(h.pet.querySelector('.momo-arm-right > .mc-routine-prop'));}
      h.advance(9000);h.ui.tick();assert.equal(h.ui.snapshot().active,null,move);assert.equal(h.life.sceneOwner(),'');assert.equal(h.pet.querySelector('.mc-transform-hair').children.length,0);assert.equal(h.pet.querySelector('.mc-routine-prop'),null);assert.equal(h.ui.snapshot().look.key,look);assert.equal(h.pet.style.left,'40px');
    }
  }
});
test('signature routines activate their limb and transformation styles and leave static outfits under reduced motion',t=>{
  const h=setup(t),style=h.d.createElement('style');style.textContent=source('momo-anime.css')+source('momo-wardrobe.css')+source('momo-cosplay.css');h.d.head.append(style);
  for(const [name,move,selector,animation] of [['Monkey D. Luffy','stretch','.momo-arm-left','mc-stretch-left'],['Goku','saiyan-blue','.momo-arm-right','mc-power-right'],['Roronoa Zoro','three-sword','.momo-arm-left','mc-sword-left'],['Sanji','flame-kick','.momo-foot-right','mc-kick']]){
    h.character(name,move);assert.equal(h.ui.play(),true);assert.match(h.w.getComputedStyle(h.pet.querySelector(selector)).animation,new RegExp(animation));h.ui.finish();assert.doesNotMatch(h.w.getComputedStyle(h.pet.querySelector(selector)).animation,new RegExp(animation));
  }
  assert.equal(h.w.getComputedStyle(h.pet.querySelector('.momo-torso')).visibility,'hidden');h.p.cosplayEnabled=false;h.w.WorkHubMomoWardrobe.apply(h.p,'first');assert.equal(h.w.getComputedStyle(h.pet.querySelector('.momo-torso')).visibility,'visible');
});
test('routine and rotation guards preserve requested naps, other scenes and active work',t=>{
  const h=setup(t);h.character('Monkey D. Luffy','stretch');const initial=h.ui.snapshot().look.key;
  h.setSleep(true);assert.equal(h.ui.play(),false);assert.equal(h.ui.rotate(),false);h.advance(1000000);h.ui.tick();assert.equal(h.ui.snapshot().look.key,initial);assert.equal(h.life.sleeping(),true);h.setSleep(false);
  for(const cls of ['hub-focus','hub-private','hub-present','rest-room-open','presentation-break-open','lab-drag-active','hub-sorting']){h.d.body.classList.add(cls);assert.equal(h.ui.play(),false,cls);assert.equal(h.ui.rotate(),false,cls);h.d.body.classList.remove(cls);}
  h.d.getElementById('modal').setAttribute('open','');assert.equal(h.ui.play(),false);h.d.getElementById('modal').removeAttribute('open');
  h.d.getElementById('work').focus();assert.equal(h.ui.play(),false);h.d.activeElement.blur();
  h.setBusy(true);assert.equal(h.ui.play(),false);h.setBusy(false);
  h.life.scene({source:'another-module'});assert.equal(h.ui.play(),false);h.ui.finish();assert.equal(h.life.sceneOwner(),'another-module');h.life.scene(null);
  h.setReady(false);assert.equal(h.ui.play(),false);h.setReady(true);
  Object.defineProperty(h.d,'hidden',{configurable:true,value:true});assert.equal(h.ui.play(),false);Object.defineProperty(h.d,'hidden',{configurable:true,value:false});
  h.ui.mount();h.setSleep(true);h.ui.rotate();h.setSleep(false);h.advance(13000);h.ui.tick();assert.notEqual(h.ui.snapshot().look.key,initial);assert.equal(h.ui.snapshot().pendingRotation,false);
});
test('all interaction paths cancel routines immediately; reduced motion retains static costumes',t=>{
  const h=setup(t);h.character('Goku','super-saiyan');
  for(const type of ['pointerdown','keydown','focusin','wheel','scroll','visibilitychange']){assert.equal(h.ui.play(),true,type);h.d.dispatchEvent(new h.w.Event(type,{bubbles:true}));assert.equal(h.ui.snapshot().active,null,type);assert.equal(h.pet.dataset.cosplayMove,undefined);}
  for(const option of ['motion','cosplayMoves','reduced']){if(option==='motion')h.p.motion='off';if(option==='cosplayMoves')h.p.cosplayMoves=false;if(option==='reduced')h.setReduced(true);assert.equal(h.ui.play(),false,option);assert.equal(h.ui.rotate(),true);assert.ok(h.pet.dataset.cosplay);h.p.motion='calm';h.p.cosplayMoves=true;h.setReduced(false);}
  h.p.cosplayEnabled=false;h.w.WorkHubMomoWardrobe.apply({...h.p,outfit:'artist',outfitPalette:'rose',accessory:'party'},'first');assert.equal(h.pet.dataset.cosplay,undefined);assert.equal(h.pet.dataset.outfit,'artist');assert.equal(h.pet.dataset.accessory,'party');assert.equal(h.pet.querySelector('.momo-cosplay-layer'),null);
});
test('automatic routines wait for real idle time, finish on clock and account changes cancel without releasing another scene',t=>{
  const h=setup(t);h.character('Sanji','flame-kick');h.advance(61000);h.d.dispatchEvent(new h.w.Event('keydown'));h.ui.tick();assert.equal(h.ui.snapshot().active,null);h.advance(13000);h.ui.tick();assert.ok(h.ui.snapshot().active);h.advance(9000);h.ui.tick();assert.equal(h.ui.snapshot().active,null);
  assert.equal(h.ui.play(),true);h.life.scene({source:'adventure'});h.ui.tick();assert.equal(h.ui.snapshot().active,null);assert.equal(h.life.sceneOwner(),'adventure');h.life.scene(null);
  assert.equal(h.ui.play(),true);h.setOwner('new-owner');h.ui.mount();assert.equal(h.ui.snapshot().active,null);assert.equal(h.pet.dataset.cosplayMove,undefined);
});
