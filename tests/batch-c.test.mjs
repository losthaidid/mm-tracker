import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
import {runInNewContext} from 'node:vm';
import {deflateSync} from 'node:zlib';
import * as pdfjs from '../vendor/pdfjs/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const window={};runInNewContext(source('batch-c-engine.js'),{window});const E=window.WorkHubBatchCEngine;
const copy=x=>JSON.parse(JSON.stringify(x)),settle=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
function png(width=8,height=6){
 const chunk=(name,data)=>{const body=Buffer.concat([Buffer.from(name),data]);let crc=0xffffffff;for(const b of body){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^(crc&1?0xedb88320:0);}const size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([size,body,sum]);};
 const header=Buffer.alloc(13),rows=Buffer.alloc((width*3+1)*height,255);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;for(let y=0;y<height;y++)rows[y*(width*3+1)]=0;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
const image={src:'data:image/png;base64,'+png().toString('base64'),width:8,height:6};
const step=id=>({id,title:'Step '+id,caption:'A clear instruction.',image:copy(image),marks:[],crop:null});
const guide=()=>({kind:'workhub-screenshot-guide',version:1,title:'My guide',steps:[step('a'),step('b')]});
test('ticket twins find literal terms and codes, rank exact descriptions first and exclude the edited record',()=>{
 const tickets=[{id:'a',ticket:'T1',description:'Connection timeout during upload',history:'Resolved by changing endpoint configuration.'},{id:'b',ticket:'T2',description:'Connection timeout during upload',history:'Earlier case.'},{id:'c',ticket:'T3',description:'Missing account in ZREQ42',history:'Fixed the account mapping.'},{id:'d',ticket:'T4',description:'Colour change',history:'Updated theme'}],index=E.ticketIndex(tickets);
 assert.equal(E.twins(index,{id:'a',description:tickets[0].description})[0].ticket.id,'b');
 assert.equal(E.twins(index,{description:'ZREQ42 error'})[0].ticket.id,'c');
 assert.equal(E.twins(index,{description:'endpoint configuration'})[0].ticket.id,'a');
 assert.equal(E.twins(index,{ticket:'T3'})[0].sameId,true);
 assert.equal(E.twins(index,{description:'please check the issue'}).length,0);assert.equal(E.twins(index,{description:'[.*] <img>'}).length,0);
});
test('guide validation bounds images, annotations and text, rejects external content and strips unknown properties',()=>{
 const g=guide();g.extra='ignored';g.steps[0].marks=[{type:'cover',color:'#123456',size:.02,points:[[.1,.2],[.8,.9]]}];assert.equal(E.guide(g).extra,undefined);assert.equal(E.guide(g).steps[0].marks.length,1);
 for(const change of [g=>g.steps[0].image.src='https://example.com/private.png',g=>g.steps[0].image.src='data:image/svg+xml;base64,PHN2Zz4=',g=>g.steps[0].id=g.steps[1].id,g=>g.steps[0].marks[0].points[0][0]=-1,g=>g.steps[0].crop={x:.9,y:0,w:.5,h:1},g=>g.steps[0].caption='x'.repeat(8001),g=>g.steps=Array.from({length:25},(_,i)=>step(String(i))),g=>g.steps[0].marks=Array(201).fill(g.steps[0].marks[0])]){const bad=copy(g);change(bad);assert.throws(()=>E.guide(bad));}
 const tooBig=guide();tooBig.steps[0].image.width=2400;tooBig.steps[0].image.height=2400;tooBig.steps[1].image.width=2400;tooBig.steps[1].image.height=2400;tooBig.steps.push({...step('c'),image:{...image,width:2400,height:2400}});assert.throws(()=>E.guide(tooBig),/large/);
});
test('guide export headings retain custom Unicode and intentional blanks while legacy files get the original heading',()=>{
 const old=guide();assert.equal(E.guide(old).exportHeading,E.DEFAULT_GUIDE_HEADING);assert.equal(Object.hasOwn(old,'exportHeading'),false);
 for(const exportHeading of ['OPERATIONS / Panduan pengguna — 测试','', 'W'.repeat(180)])assert.equal(E.guide({...old,exportHeading}).exportHeading,exportHeading);
 for(const exportHeading of [null,42,{},'x'.repeat(181)])assert.throws(()=>E.guide({...old,exportHeading}),/heading/);
});
function ui(t){
 const dom=new JSDOM('<button id="launch">Studio</button><div id="host"></div>',{url:'https://losthaidid.github.io/mm-tracker/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());const w=dom.window,d=w.document;let owner='one';const blobs=[],revoked=[],renders=[],exports=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},strokeRect(){}});w.HTMLCanvasElement.prototype.setPointerCapture=function(){};w.HTMLCanvasElement.prototype.toDataURL=()=>image.src;
 w.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:local-'+blobs.length;};w.URL.revokeObjectURL=url=>revoked.push(url);w.Blob=Blob;
 w.eval(source('batch-c-engine.js'));
 w.WorkHubBatchCFiles={imageFromFile:async()=>copy(image),loadImage:async()=>({}),draw:(c,s,img,original)=>renders.push({s:copy(s),original}),release(){},raster:async()=>({width:8,height:6,toDataURL:()=>image.src}),export:async(g,format,alive)=>{exports.push({g:copy(g),format,alive});return new Blob(['clean export']);}};
 w.eval(source('batch-c.js'));const state={tickets:[{id:'t',ticket:'<T1>',description:'Connection timeout during upload',history:'Fix: <script>literal</script>',pic:'Rina',status:'Closed'}]};
 const adapter={ready:()=>!!owner,owner:()=>owner,state:()=>state,tell(){},latestHistory:t=>t.history},module=w.WorkHubBatchC.install(adapter);
 const click=(op,extra={})=>{const b=d.createElement('button');b.dataset.bc=op;Object.assign(b.dataset,extra);return module.handle(b);};
 return {w,d,module,click,blobs,revoked,renders,exports,state,account(value){owner=value;module.sync();},last:async()=>JSON.parse(await blobs.at(-1).text())};
}
test('ticket preview keeps draft fields, escapes history and remains read-only across searches and account changes',async t=>{
 const c=ui(t);c.d.getElementById('host').innerHTML='<form id="editForm" data-group="tickets" data-id=""><section class="ticket-editor-section"></section><input name="ticket" value="NEW"><textarea name="description">Connection timeout during upload</textarea></form>';
 c.module.decorateModal();assert.equal(c.d.querySelectorAll('.bc-twins article').length,1);assert.equal(c.d.querySelector('.bc-twins script'),null);assert.match(c.d.querySelector('.bc-twins').textContent,/<script>literal/);assert.equal(c.d.querySelector('[name="ticket"]').value,'NEW');assert.equal(c.state.tickets.length,1);
 c.d.querySelector('[name="description"]').value='different subject';c.module.decorateModal();assert.equal(c.d.querySelectorAll('.bc-twins article').length,0);c.account('two');assert.equal(c.d.querySelector('.bc-twins'),null);
});
test('guide builder keeps captions, reorders/removes/restores steps, and round-trips its bounded editable file',async t=>{
 const c=ui(t);c.module.open('guide');await c.module.add([{name:'first.png'},{name:'second.png'}]);let rows=c.d.querySelectorAll('[data-bc="select"]');assert.equal(rows.length,2);const first=rows[0].dataset.id,second=rows[1].dataset.id;
 const caption=c.d.querySelector('[data-bc-caption]');caption.value='Click the green button.';caption.dispatchEvent(new c.w.Event('input',{bubbles:true}));await c.click('down');await c.module.prepare('editable');let saved=await c.last();assert.equal(saved.steps[1].id,first);assert.equal(saved.steps[1].caption,'Click the green button.');assert.equal(saved.steps[0].id,second);
 await c.click('remove');assert.equal(c.d.querySelectorAll('[data-bc="select"]').length,1);await c.click('undo-remove');assert.equal(c.d.querySelectorAll('[data-bc="select"]').length,2);assert.ok(c.revoked.length);
 c.module.close();c.module.open('guide');await settle();assert.equal(c.d.querySelectorAll('[data-bc="select"]').length,2);
 await c.module.importGuide({size:JSON.stringify(saved).length,text:async()=>JSON.stringify(saved)});await settle();await c.module.prepare('editable');assert.deepEqual(await c.last(),saved);
});
test('guide heading edits update PDF/JPG exports, invalidate downloads, survive save/open and reset for another account',async t=>{
 const c=ui(t);c.module.open('guide');await c.module.add([{name:'sample.png'}]);
 const heading=c.d.querySelector('[data-bc-export-heading]');assert.equal(heading.value,E.DEFAULT_GUIDE_HEADING);
 const custom='MY TEAM / <img src=x onerror=alert(1)> — Guide';heading.value=custom;heading.dispatchEvent(new c.w.Event('input',{bubbles:true}));
 await c.module.prepare('pdf');assert.equal(c.exports.at(-1).g.exportHeading,custom);assert.ok(c.d.querySelector('[data-bc-ready] a'));
 heading.value='';heading.dispatchEvent(new c.w.Event('input',{bubbles:true}));assert.equal(c.d.querySelector('[data-bc-ready] a'),null);
 c.d.querySelector('[data-bc-format]').value='jpg-images';await c.click('export');assert.equal(c.exports.at(-1).format,'jpg-images');assert.equal(c.exports.at(-1).g.exportHeading,'');assert.match(c.d.querySelector('[data-bc-ready] a').download,/-pages\.zip$/);assert.equal(c.d.querySelector('[data-bc-ready] a').textContent,'Download JPG pages ZIP');
 heading.value=custom;heading.dispatchEvent(new c.w.Event('input',{bubbles:true}));await c.module.prepare('editable');const saved=await c.last();assert.equal(saved.exportHeading,custom);
 c.module.close();c.module.open('guide');assert.equal(c.d.querySelector('[data-bc-export-heading]').value,custom);assert.equal(c.d.querySelector('.bc-guide-fields img'),null);
 await c.module.importGuide({size:100,text:async()=>JSON.stringify(guide())});assert.equal(c.d.querySelector('[data-bc-export-heading]').value,E.DEFAULT_GUIDE_HEADING);
 await c.module.importGuide({size:JSON.stringify(saved).length,text:async()=>JSON.stringify(saved)});assert.equal(c.d.querySelector('[data-bc-export-heading]').value,custom);assert.equal(c.d.querySelector('.bc-guide-fields img'),null);
 c.account('another');c.module.open('guide');assert.equal(c.d.querySelector('[data-bc-export-heading]').value,E.DEFAULT_GUIDE_HEADING);
});
test('pointer edits, crop, original comparison and undo/redo never change the original image',async t=>{
 const c=ui(t);c.module.open('privacy');await c.module.add([{name:'private.png'}]);const canvas=c.d.querySelector('canvas');canvas.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});const pointer=(name,x,y)=>{const e=new c.w.Event(name,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,clientX:x,clientY:y,button:0,isPrimary:true});canvas.dispatchEvent(e);};
 pointer('pointerdown',10,10);pointer('pointermove',90,90);pointer('pointerup',90,90);await c.module.prepare('editable');let saved=await c.last();assert.equal(saved.steps[0].marks.length,1);assert.equal(saved.steps[0].image.src,image.src);
 await c.click('compare');assert.equal(c.renders.at(-1).original,true);await c.module.prepare('png');assert.equal(c.exports.at(-1).g.steps[0].marks.length,1);await c.click('undo');await c.module.prepare('editable');assert.equal((await c.last()).steps[0].marks.length,0);await c.click('redo');
 c.d.querySelector('[data-bc-tool="crop"]').click();pointer('pointerdown',20,20);pointer('pointermove',80,70);pointer('pointerup',80,70);await c.module.prepare('editable');saved=await c.last();assert.ok(Math.abs(saved.steps[0].crop.w-.6)<.00001);assert.equal(saved.steps[0].marks.length,1);await c.click('reset');await c.module.prepare('editable');assert.equal((await c.last()).steps[0].crop,null);
});
test('account changes cancel pending imports/exports and clear all local drafts and ready download URLs',async t=>{
 const c=ui(t);c.module.open('guide');await c.module.add([{name:'private.png'}]);await c.module.prepare('editable');assert.ok(c.d.querySelector('[data-bc-ready] a'));
 let finish;c.w.WorkHubBatchCFiles.export=async()=>new Promise(resolve=>finish=resolve);const pending=c.module.prepare('pdf');await settle();c.account('two');finish(new Blob(['old account']));await pending;assert.equal(c.d.getElementById('batchCRoom'),null);assert.ok(c.revoked.length);c.module.open('guide');assert.equal(c.d.querySelectorAll('[data-bc="select"]').length,0);
 let finishRead;const importing=c.module.importGuide({size:100,text:()=>new Promise(resolve=>finishRead=resolve)});c.account('three');finishRead(JSON.stringify(guide()));await importing;assert.equal(c.d.getElementById('batchCRoom'),null);
});
test('failed image batches and malformed editable guides leave the current local guide intact',async t=>{
 const c=ui(t);c.module.open('guide');await c.module.add([{name:'kept.png'}]);await c.module.prepare('editable');const before=await c.last();let n=0;c.w.WorkHubBatchCFiles.imageFromFile=async()=>{if(++n===2)throw Error('Corrupt image');return copy(image);};await assert.rejects(()=>c.module.add([{name:'one.png'},{name:'bad.png'}]),/Corrupt/);await c.module.prepare('editable');assert.deepEqual(await c.last(),before);const malformed=copy(before);malformed.steps[0].image.src='https://example.com/private.png';await assert.rejects(()=>c.module.importGuide({size:50,text:async()=>JSON.stringify(malformed)}),/could not be opened/);await c.module.prepare('editable');assert.deepEqual(await c.last(),before);
});
test('Move mode pans the viewport without adding a mark or changing exported images',async t=>{
 const c=ui(t);c.module.open('privacy');await c.module.add([{name:'pan.png'}]);c.d.querySelector('[data-bc-tool="move"]').click();const canvas=c.d.querySelector('canvas'),view=c.d.querySelector('[data-bc-viewport]');view.scrollLeft=80;view.scrollTop=90;const pointer=(name,x,y)=>{const event=new c.w.Event(name,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:7,clientX:x,clientY:y,button:0,isPrimary:true,pointerType:'mouse'});canvas.dispatchEvent(event);};pointer('pointerdown',80,80);pointer('pointermove',40,35);pointer('pointerup',40,35);assert.equal(view.scrollLeft,120);assert.equal(view.scrollTop,135);await c.module.prepare('editable');assert.equal((await c.last()).steps[0].marks.length,0);
});
test('adding a privacy-edited image to the guide uses a flattened image and leaves the privacy draft available',async t=>{
 const c=ui(t);c.module.open('privacy');await c.module.add([{name:'sensitive.png'}]);await c.click('to-guide');await settle();assert.match(c.d.getElementById('bcRoomTitle').textContent,/Step|step/);await c.module.prepare('editable');assert.equal((await c.last()).steps.length,1);assert.equal((await c.last()).steps[0].marks.length,0);c.module.close();c.module.open('privacy');await settle();assert.equal(c.d.querySelector('[data-bc-count]').textContent,'1 screenshot');
});
function fileFixture(){
 const calls=[],w={WorkHubBatchCEngine:E,atob:s=>Buffer.from(s,'base64').toString('binary')};
 w.Image=class{set src(value){const size=w.WorkHubBatchCFiles.dimensions(new Uint8Array(Buffer.from(value.split(',')[1],'base64')));this.naturalWidth=size.width;this.naturalHeight=size.height;queueMicrotask(()=>this.onload());}};
 const context={fillRect(...args){calls.push(['fill',this.fillStyle,...args]);},drawImage(...args){calls.push(['draw',...args]);},save(){},restore(){},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},stroke(){calls.push(['stroke']);},measureText:t=>({width:String(t).length*14}),fillText(text,x,y){calls.push(['text',text,x,y,this.font]);}};
 const document={baseURI:new URL('../index.html',import.meta.url).href,createElement:()=>({width:1,height:1,getContext:()=>context,toBlob(callback,type,quality){calls.push(['encode',type,quality]);callback(new Blob([png(this.width,this.height)],{type}));}})};
 new Function('window','document',source('batch-c-files.js'))(w,document);new Function('window','module','exports',source('vendor/jszip.min.js'))(w,undefined,undefined);
 return {F:w.WorkHubBatchCFiles,w,calls,document};
}
test('image headers reject malformed/oversized files before decoding, including PNG, JPEG and WebP dimensions',()=>{
 const {F}=fileFixture();assert.deepEqual(F.dimensions(new Uint8Array(png(17,11))),{width:17,height:11});assert.throws(()=>F.dimensions(new Uint8Array([1,2,3])),/PNG/);
 const oversized=png(1,1);oversized.writeUInt32BE(9000,16);oversized.writeUInt32BE(9000,20);assert.throws(()=>F.dimensions(new Uint8Array(oversized)),/megapixels/);
 const jpeg=Buffer.from([255,216,255,192,0,11,8,0,20,0,30,3,0,0,0]);assert.deepEqual(F.dimensions(jpeg),{width:30,height:20});const webp=Buffer.alloc(30);webp.write('RIFF');webp.write('WEBP',8);webp.write('VP8X',12);webp[24]=39;webp[27]=19;assert.deepEqual(F.dimensions(webp),{width:40,height:20});
});
test('raster export bakes covers/brushes/arrows into a new canvas and applies crop dimensions',async()=>{
 const {F,calls}=fileFixture(),s=step('a');s.marks=[{type:'cover',color:'#123456',size:.02,points:[[.1,.1],[.8,.8]]},{type:'brush',color:'#123456',size:.02,points:[[.1,.1],[.3,.3],[.8,.8]]},{type:'arrow',color:'#ff0000',size:.02,points:[[.1,.1],[.8,.8]]}];s.crop={x:0,y:0,w:.5,h:.5};const c=await F.raster(s);assert.equal(c.width,4);assert.equal(c.height,3);assert.ok(calls.some(call=>call[0]==='fill'&&call[1]==='#123456'));assert.ok(calls.filter(call=>call[0]==='stroke').length>=2);const output=await F.blob(c);assert.deepEqual(F.dimensions(new Uint8Array(await output.arrayBuffer())),{width:4,height:3});
});
test('guide PDFs and PNG ZIPs include all numbered steps and long captions paginate without losing text',async()=>{
 const {F,calls}=fileFixture(),g=guide();g.steps[0].caption=Array.from({length:180},(_,i)=>'Line '+i+' — useful instruction.').join('\n');const pdf=await F.export(g,'pdf',()=>true),task=pdfjs.getDocument({data:new Uint8Array(await pdf.arrayBuffer()),useSystemFonts:true});try{const parsed=await task.promise;assert.ok(parsed.numPages>3);assert.ok(calls.some(c=>c[0]==='text'&&c[1].includes('Line 179')));}finally{await task.destroy();}
 const zip=await F.export(guide(),'images',()=>true);const bytes=Buffer.from(await zip.arrayBuffer());assert.equal(bytes.subarray(0,2).toString(),'PK');assert.ok(bytes.includes(Buffer.from('001-guide-page.png')));assert.ok(bytes.includes(Buffer.from('002-guide-page.png')));
 const zippedPdf=Buffer.from(await (await F.export(guide(),'pdf-zip',()=>true)).arrayBuffer());assert.ok(zippedPdf.includes(Buffer.from('screenshot-guide.pdf')));await assert.rejects(()=>F.export(g,'pdf',()=>false),/cancelled/);
});
test('every continued guide page wraps a long export heading above the title, and blank headings draw no banner',async()=>{
 const {F,calls}=fileFixture(),g=guide();g.exportHeading='W'.repeat(180);g.steps[0].caption=Array.from({length:70},(_,i)=>'Instruction '+i).join('\n');let pages=0,previous=0;
 for await(const page of F.pages(E.guide(g),()=>true)){const texts=calls.slice(previous).filter(c=>c[0]==='text'),headings=texts.filter(c=>c[4]==='600 19px system-ui, sans-serif'),title=texts.find(c=>c[4]==='600 27px system-ui, sans-serif');assert.ok(headings.length>1);assert.equal(headings.map(c=>c[1]).join('').replace(/\s/g,''),g.exportHeading);assert.ok(headings.at(-1)[3]+25<=title[3]);assert.ok(headings.every(c=>c[1].length*14<=1100));previous=calls.length;pages++;F.release(page);}
 assert.ok(pages>2);assert.ok(calls.some(c=>c[0]==='text'&&c[1]==='Instruction 69'));
 calls.length=0;for await(const page of F.pages(E.guide({...guide(),exportHeading:''}),()=>true))F.release(page);assert.equal(calls.filter(c=>c[0]==='text'&&c[4]==='600 19px system-ui, sans-serif').length,0);
});
test('JPG guide pages use JPEG encoding and numbered JPG entries while PNG exports retain their format',async()=>{
 const {F,calls}=fileFixture();const jpg=Buffer.from(await(await F.export({...guide(),exportHeading:'TEAM / USER GUIDE'},'jpg-images',()=>true)).arrayBuffer());assert.ok(jpg.includes(Buffer.from('001-guide-page.jpg')));assert.ok(jpg.includes(Buffer.from('002-guide-page.jpg')));assert.equal(jpg.includes(Buffer.from('guide-page.png')),false);assert.equal(calls.filter(c=>c[0]==='encode'&&c[1]==='image/jpeg'&&c[2]===.92).length,2);assert.equal(calls.filter(c=>c[0]==='text'&&c[1]==='TEAM / USER GUIDE').length,2);
 calls.length=0;await F.export(guide(),'images',()=>true);assert.equal(calls.filter(c=>c[0]==='encode'&&c[1]==='image/png').length,2);
 await assert.rejects(()=>F.export(guide(),'jpg-images',()=>false),/cancelled/);
});
test('line breaks in imported export headings cannot consume the screenshot area or force oversized headers',async()=>{
 const {F,calls}=fileFixture(),g={...guide(),exportHeading:'TEAM\n'.repeat(30)};
 for await(const page of F.pages(E.guide(g),()=>true))F.release(page);
 const titles=calls.filter(c=>c[0]==='text'&&c[4]==='600 27px system-ui, sans-serif');assert.equal(titles.length,2);assert.ok(titles.every(c=>c[3]<250));
});
test('blur renders through bounded image resampling without depending on canvas filter support',async()=>{
 const {F,calls}=fileFixture(),s=step('blur');s.marks=[{type:'blur',color:'#123456',size:.1,points:[[0,0],[1,1]]}];await F.raster(s);const resamples=calls.filter(c=>c[0]==='draw'&&c.length===10);assert.equal(resamples.length,2);assert.equal(resamples[0].at(-2),1);assert.equal(resamples[0].at(-1),1);
});
