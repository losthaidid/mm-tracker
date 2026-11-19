import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';
import { JSDOM } from 'jsdom';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const context = createContext({}); runInContext(read('icon-creator-engine.js'), context); const E = context.WorkHubIconEngine;
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=';
const copy = x => JSON.parse(JSON.stringify(x));
function raster(rows) { const data = new Uint8ClampedArray(rows.length * rows[0].length * 4); rows.forEach((row, y) => [...row].forEach((cell, x) => { const i = (y * row.length + x) * 4; data[i] = data[i + 1] = data[i + 2] = cell === '#' ? 0 : 255; data[i + 3] = cell === '.' ? 0 : 255; })); return data; }
test('Icon geometry fits a rectangular upload without distortion and respects padding, zoom and offsets', () => {
 const d=E.create();d.source={data:image,width:800,height:400};let box=E.fit(d);assert.equal(box.width/box.height,2);assert.equal(box.width,194.56);assert.equal(box.x,128);
 d.fit.zoom=2;d.fit.x=20;d.fit.y=-30;d.fit.rotation=45;box=E.fit(d);assert.equal(box.width,389.12);assert.equal(box.x,148);assert.equal(box.y,98);assert.equal(box.rotation,45);E.validate(d);
 const before=E.copy(d);before.fit.x=0;before.strokes.push({points:[[1,2]],size:3,color:'#112233',erase:false});assert.equal(d.fit.x,20);assert.equal(d.strokes.length,0);assert.equal(before.source,d.source);
});
test('Icon tracing preserves holes and diagonal islands, simplifies straight edges and handles transparency', () => {
 const solid=E.trace(raster(['##','##']),2,2);assert.equal((solid.match(/M/g)||[]).length,1);assert.equal((solid.match(/L/g)||[]).length,3);assert.match(solid,/256\.00/);
 const ring=E.trace(raster(['###','#.#','###']),3,3);assert.equal((ring.match(/M/g)||[]).length,2);assert.equal((ring.match(/Z/g)||[]).length,2);
 const diagonal=E.trace(raster(['#.','.#']),2,2);assert.equal((diagonal.match(/M/g)||[]).length,2);
 assert.equal(E.trace(raster(['  ','  ']),2,2),'');assert.notEqual(E.trace(raster(['  ','  ']),2,2,170,'alpha'),'');assert.equal(E.trace(raster(['..','..']),2,2,170,'alpha'),'');
 assert.throws(()=>E.trace(new Uint8Array(4),129,1),/tracing detail/);
});
test('SVG exports retain vector outlines, ordered erasers and later paint while escaping initials', t => {
 const dom=new JSDOM('');t.after(()=>dom.window.close());const d=E.create('<&"');d.mode='outline';d.source={data:image,width:96,height:96};d.background='#ffffff';d.shape='circle';d.strokes=[{points:[[10,10],[20,20]],size:5,color:'#123456',erase:false},{points:[[15,15]],size:10,color:'#123456',erase:true},{points:[[16,16]],size:2,color:'#abcdef',erase:false}];
 const svg=E.svg(d,'M10 10L200 10L200 200Z'),xml=new dom.window.DOMParser().parseFromString(svg,'image/svg+xml');assert.equal(xml.querySelector('parsererror'),null);assert.equal(xml.querySelector('image'),null);assert.ok(xml.querySelector('clipPath circle'));assert.equal(xml.querySelectorAll('mask').length,1);assert.equal(xml.querySelector('text').textContent,'<&"');assert.match(svg,/fill-rule="evenodd"/);assert.ok(svg.indexOf('fill="#abcdef"')>svg.lastIndexOf('mask="url(#erase1)"'));
 d.mode='image';assert.ok(E.svg(d).includes('<image href="data:image/png;base64,'));
 assert.throws(()=>E.svg(d,'','bad" onclick="alert(1)'),/export size/);
});
test('Icon validation rejects external image sources, unsupported properties and oversized drawings', () => {
 for(const change of [{ink:'url(javascript:1)'},{text:'abcd'},{text:'\u0000'},{background:'red'},{mode:'remote-ai'},{threshold:NaN},{source:{data:'https://example.com/picture.png',width:1,height:1}},{fit:{zoom:9}}])assert.throws(()=>E.validate({...E.create(),...change}));
 const d=E.create();d.strokes=[{points:[[NaN,0]],size:3,color:'#123456',erase:false}];assert.throws(()=>E.validate(d),/strokes/);
});
function fixture(t) {
 const dom=new JSDOM('<body><button data-ic="open">Icon Creator</button></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test'}),w=dom.window,d=w.document;t.after(()=>w.close());
 const contexts=new WeakMap(),sizes=[],downloads=[],messages=[],revoked=[];
 w.HTMLCanvasElement.prototype.getContext=function(){if(!contexts.has(this))contexts.set(this,new Proxy({getImageData(x,y,width,height){const pixels=new Uint8ClampedArray(width*height*4).fill(255);for(let yy=height/4|0;yy<height*3/4;yy++)for(let xx=width/4|0;xx<width*3/4;xx++){const i=(yy*width+xx)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}return{data:pixels};}}, {get:(o,key)=>key in o?o[key]:(()=>{})}));return contexts.get(this);};
 w.HTMLCanvasElement.prototype.toDataURL=function(){sizes.push([this.width,this.height]);return image;};w.Path2D=class{constructor(path){this.path=path;}};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.URL.createObjectURL=()=> 'blob:local-image';w.URL.revokeObjectURL=url=>revoked.push(url);
 let deferred=false;const pending=[];w.Image=class{constructor(){this.naturalWidth=800;this.naturalHeight=400;}set src(value){if(!value)return;if(deferred)pending.push(()=>this.onload?.());else w.queueMicrotask(()=>this.onload?.());}};
 w.eval(read('icon-creator-engine.js'));w.eval(read('icon-creator.js'));
 let owner='owner',generation=1,ready=true,edit=true,exporting=true,writes=0,state={workhub:{preferences:{theme:'forest',patternSet:'sailor-moon-prism',branding:{mode:'initials',initials:'WH',image:''}}}};
 const ui=w.WorkHubIconCreator.install({ready:()=>ready,owner:()=>owner,generation:()=>generation,can:(_,action)=>action==='export'?exporting:edit,prefs:()=>state.workhub.preferences,mutate(fn){const next=copy(state);fn(next);state=next;writes++;return true;},applied(){},download:(...args)=>downloads.push(args),tell:(...args)=>messages.push(args)});
 const click=action=>d.querySelector('[data-ic="'+action+'"]')?.click(),field=(name,value)=>{const el=d.querySelector('[data-ic-field="'+name+'"]');el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 return{w,d,ui,click,field,sizes,downloads,messages,revoked,state:()=>state,writes:()=>writes,deny(){edit=false;ui.sync();},denyExport(){exporting=false;},switchOwner(){owner='next-owner';generation++;ui.sync();},changeBrand(){state.workhub.preferences.branding.initials='NEW';},defer(){deferred=true;},finish(){for(const f of pending.splice(0))f();}};
}
test('Icon editor previews locally, applies only a small branding image and exports PNG plus SVG',async t=>{
 const h=fixture(t),before=copy(h.state());await h.ui.open();h.field('text','AB');h.field('shape','circle');assert.equal(h.writes(),0);assert.deepEqual(h.state(),before);
 assert.equal(h.ui.apply(),true);assert.equal(h.writes(),1);assert.equal(h.state().workhub.preferences.branding.mode,'logo');assert.equal(h.state().workhub.preferences.branding.image,image);assert.equal(h.state().workhub.preferences.patternSet,before.workhub.preferences.patternSet);assert.equal(h.state().workhub.preferences.theme,'forest');assert.ok(h.sizes.some(([w,h])=>w===96&&h===96));
 h.ui.exportFile('svg');h.ui.exportFile('png');assert.equal(h.downloads.length,2);assert.equal(h.downloads[0][1],'my-website-icon.svg');assert.match(h.downloads[0][0],/>AB<\/text>/);assert.ok(h.sizes.some(([w,h])=>w===512&&h===512));
 h.ui.close();await h.ui.open();assert.equal(h.ui.snapshot().text,'AB');
});
test('Icon upload stays local, converts to true outline paths, and revokes temporary image URLs',async t=>{
 const h=fixture(t);await h.ui.open();await h.ui.upload({type:'image/png',size:100});assert.equal(h.ui.snapshot().source.width,800);assert.equal(h.ui.snapshot().source.height,400);assert.equal(h.ui.snapshot().text,'');assert.deepEqual(h.revoked,['blob:local-image']);
 h.field('mode','outline');h.ui.exportFile('svg');const svg=h.downloads[0][0];assert.match(svg,/<path d="M/);assert.doesNotMatch(svg,/<image /);assert.equal(h.writes(),0);
 await assert.rejects(h.ui.upload({type:'image/svg+xml',size:100}),/PNG, JPG or WebP/);await assert.rejects(h.ui.upload({type:'image/png',size:11000000}),/10 MB/);
 h.click('undo');assert.equal(h.ui.snapshot().mode,'image');h.click('undo');assert.equal(h.ui.snapshot().source,null);h.click('redo');assert.equal(h.ui.snapshot().source.width,800);
});
test('Icon drawing gestures undo once, redo and cancel without saving, while colours and original draft remain editable',async t=>{
 const h=fixture(t);await h.ui.open();const canvas=h.d.getElementById('icCanvas');canvas.getBoundingClientRect=()=>({left:0,top:0,width:512,height:512});h.d.querySelector('[data-ic-tool="draw"]').click();
 const pointer=(type,x,y)=>{const e=new h.w.Event(type,{bubbles:true,cancelable:true});for(const[k,v]of Object.entries({pointerId:7,button:0,clientX:x,clientY:y}))Object.defineProperty(e,k,{value:v});(type==='pointerdown'?canvas:h.d).dispatchEvent(e);};
 pointer('pointerdown',100,100);pointer('pointermove',200,200);pointer('pointerup',200,200);assert.equal(h.ui.snapshot().strokes.length,1);assert.deepEqual(copy(h.ui.snapshot().strokes[0].points),[[50,50],[100,100]]);h.click('undo');assert.equal(h.ui.snapshot().strokes.length,0);h.click('redo');assert.equal(h.ui.snapshot().strokes.length,1);
 pointer('pointerdown',100,100);pointer('pointermove',300,300);pointer('pointercancel',300,300);assert.equal(h.ui.snapshot().strokes.length,1);assert.equal(h.writes(),0);
 h.field('ink','#ee0044');assert.equal(h.ui.snapshot().ink,'#ee0044');h.click('clear');assert.equal(h.ui.snapshot().strokes.length,0);h.click('undo');assert.equal(h.ui.snapshot().strokes.length,1);
});
test('Icon ownership, privacy, changed branding and permissions block stale saves and exports',async t=>{
 const h=fixture(t);await h.ui.open();h.changeBrand();assert.throws(()=>h.ui.apply(),/changed elsewhere/);assert.equal(h.writes(),0);h.denyExport();assert.throws(()=>h.ui.exportFile('svg'),/cannot export/);assert.equal(h.downloads.length,0);
 h.d.body.classList.add('hub-private');assert.throws(()=>h.ui.apply(),/Reopen/);h.d.body.classList.remove('hub-private');h.deny();assert.throws(()=>h.ui.apply(),/Reopen/);assert.equal(h.writes(),0);h.switchOwner();assert.equal(h.ui.snapshot(),null);assert.equal(h.d.getElementById('iconCreatorRoom'),null);
});
test('Icon tracing remains available after switching back to the photo and paint failures cannot save stale pixels',async t=>{
 const h=fixture(t);await h.ui.open();await h.ui.upload({type:'image/png',size:100});h.field('mode','outline');h.ui.exportFile('svg');h.field('mode','image');h.field('mode','outline');h.ui.exportFile('svg');assert.match(h.downloads.at(-1)[0],/<path d="M/);
 h.field('text','AB');h.d.getElementById('icCanvas').getContext('2d').drawImage=()=>{throw Error('Synthetic painting failure');};assert.throws(()=>h.ui.apply(),/painting failure/);assert.equal(h.writes(),0);h.ui.close();assert.throws(()=>h.ui.apply(),/Reopen/);
});

test('Changing accounts during image decoding cannot restore the old icon draft',async t=>{
 const h=fixture(t);await h.ui.open();h.defer();const job=h.ui.upload({type:'image/png',size:100});h.switchOwner();h.finish();await assert.rejects(job,/Reopen/);assert.equal(h.ui.snapshot(),null);assert.equal(h.writes(),0);assert.deepEqual(h.revoked,['blob:local-image']);
});
