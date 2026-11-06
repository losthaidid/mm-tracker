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
test('guide branding defaults preserve legacy exports and reject malformed logo, footer and colour values',()=>{
 const old=E.guide(guide());assert.deepEqual(copy(old.footer),{text:'',align:'center',size:180,opacity:1,logo:null});assert.deepEqual(copy(old.colours),{accent:'#285b4d',paper:'#f8f7f1'});
 const logo=copy(image),footer={text:'My team',align:'right',size:260,opacity:.2,logo};const g=E.guide({...guide(),footer,colours:{accent:'#336699',paper:'#fffaff'}});assert.deepEqual(copy(g.footer),footer);assert.equal(g.colours.accent,'#336699');
 for(const change of [f=>f.text='x'.repeat(121),f=>f.align='top',f=>f.opacity=0,f=>f.opacity=1.1,f=>f.size=999,f=>f.logo.src='https://example.com/logo.png',f=>f.logo.src='data:image/svg+xml;base64,PHN2Zz4=',f=>f.logo.width=1601,f=>f.logo=false]){const f=copy(footer);change(f);assert.throws(()=>E.guide({...guide(),footer:f}));}
 for(const colours of [null,{}, {accent:'red',paper:'#ffffff'}, {accent:'#123456',paper:'url(example.com)'}])assert.throws(()=>E.guide({...guide(),colours}),/colour/);
});
function ui(t){
 const dom=new JSDOM('<button id="launch">Studio</button><div id="host"></div>',{url:'https://losthaidid.github.io/mm-tracker/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());const w=dom.window,d=w.document;let owner='one';const blobs=[],revoked=[],renders=[],exports=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},strokeRect(){},drawImage(){}});w.HTMLCanvasElement.prototype.setPointerCapture=function(){};w.HTMLCanvasElement.prototype.toDataURL=()=>image.src;
 w.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:local-'+blobs.length;};w.URL.revokeObjectURL=url=>revoked.push(url);w.Blob=Blob;
 w.eval(source('batch-c-engine.js'));
 w.WorkHubBatchCFiles={imageFromFile:async()=>copy(image),logoFromFile:async()=>copy(image),loadImage:async()=>({}),draw:(c,s,img,original)=>renders.push({s:copy(s),original}),release(){},raster:async()=>({width:8,height:6,toDataURL:()=>image.src}),export:async(g,format,alive)=>{exports.push({g:copy(g),format,alive});return new Blob(['clean export']);}};
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
test('footer/logo/colours survive editable save-open and edits invalidate prepared exports without changing account records',async t=>{
 const c=ui(t),before=copy(c.state);c.module.open('guide');await c.module.add([{name:'sample.png'}]);await c.module.addLogo({name:'logo.png'});
 const edit=(selector,value,type='input')=>{const el=c.d.querySelector(selector);el.value=value;el.dispatchEvent(new c.w.Event(type,{bubbles:true}));};
 edit('[data-bc-footer-text]','My team / Internal');edit('[data-bc-footer-align]','right','change');edit('[data-bc-footer-size]','260','change');edit('[data-bc-footer-opacity]','20');edit('[data-bc-palette]','blue','change');
 await c.module.prepare('pdf');assert.equal(c.exports.at(-1).g.footer.opacity,.2);assert.equal(c.exports.at(-1).g.colours.accent,'#245e9a');
 edit('[data-bc-paper]','#202030');assert.equal(c.d.querySelector('[data-bc-ready] a'),null);assert.equal(c.d.querySelector('[data-bc-palette]').value,'custom');
 await c.module.prepare('editable');const saved=await c.last();assert.equal(saved.footer.logo.src,image.src);assert.equal(saved.footer.align,'right');assert.equal(saved.colours.paper,'#202030');
 c.module.close();await c.module.importGuide({size:JSON.stringify(saved).length,text:async()=>JSON.stringify(saved)});assert.equal(c.d.querySelector('[data-bc-footer-text]').value,'My team / Internal');assert.equal(c.d.querySelector('[data-bc-footer-preview]').src,image.src);assert.equal(c.d.querySelector('[data-bc-footer-preview]').style.opacity,'0.2');
 await c.click('remove-logo');await c.module.prepare('editable');assert.equal((await c.last()).footer.logo,null);assert.deepEqual(c.state,before);
 c.account('other');c.module.open('guide');assert.equal(c.d.querySelector('[data-bc-footer-text]').value,'');assert.equal(c.d.querySelector('[data-bc-paper]').value,'#f8f7f1');assert.equal(c.d.querySelector('[data-bc-footer-preview]').hasAttribute('src'),false);
});
test('failed or cancelled logo loads leave existing branding intact and cannot populate another account',async t=>{
 const c=ui(t);c.module.open('guide');await c.module.add([{name:'sample.png'}]);await c.module.addLogo({name:'logo.png'});await c.module.prepare('editable');const before=await c.last();
 c.w.WorkHubBatchCFiles.logoFromFile=async()=>{throw Error('Corrupt logo');};await assert.rejects(()=>c.module.addLogo({}),/Corrupt/);await c.module.prepare('editable');assert.deepEqual(await c.last(),before);
 let finish;c.w.WorkHubBatchCFiles.logoFromFile=()=>new Promise(resolve=>finish=resolve);const pending=c.module.addLogo({});c.account('next');finish(copy(image));await pending;c.module.open('guide');assert.equal(c.d.querySelector('[data-bc-footer-preview]').hasAttribute('src'),false);
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
 const stack=[],context={globalAlpha:1,fillRect(...args){calls.push(['fill',this.fillStyle,...args]);},drawImage(...args){calls.push(['draw',...args],['alpha-draw',this.globalAlpha,...args]);},save(){stack.push({globalAlpha:this.globalAlpha,font:this.font,fillStyle:this.fillStyle});},restore(){Object.assign(this,stack.pop());},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},stroke(){calls.push(['stroke']);},measureText:t=>({width:String(t).length*14}),fillText(text,x,y){calls.push(['text',text,x,y,this.font,this.fillStyle,this.globalAlpha]);}};
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
test('footer branding repeats on continuation pages without covering captions or fading page numbers',async()=>{
 const {F,calls}=fileFixture(),g=guide();g.footer={...copy(E.footer()),text:'PRIVATE / MY TEAM',logo:copy(image),opacity:.2,align:'right',size:260};g.colours=E.colours(E.GUIDE_PALETTES.blue);g.steps[0].caption=Array.from({length:80},(_,i)=>'Instruction '+i).join('\n');let count=0;
 for await(const page of F.pages(E.guide(g),()=>true)){count++;F.release(page);}
 assert.ok(count>2);const captions=calls.filter(c=>c[0]==='text'&&/^Instruction/.test(c[1]));assert.ok(captions.every(c=>c[3]<=1510));assert.ok(captions.some(c=>c[1]==='Instruction 79'));
 const footer=calls.filter(c=>c[0]==='text'&&c[1]==='PRIVATE / MY TEAM');assert.equal(footer.length,count);assert.ok(footer.every(c=>c[3]===1650&&c[6]===.2));
 const logos=calls.filter(c=>c[0]==='alpha-draw'&&c[4]===1560);assert.equal(logos.length,count);assert.ok(logos.every(c=>c[1]===.2&&c[3]>=70&&c[5]<=260&&c[6]<=64));assert.ok(calls.filter(c=>c[0]==='text'&&/^Page /.test(c[1])).every(c=>c[6]===1));
 assert.ok(calls.some(c=>c[0]==='text'&&c[5]==='#245e9a'));
});
test('custom page colours keep readable text and logo imports reject formats without alpha support',async()=>{
 const {F}=fileFixture();assert.equal(F.palette({accent:'#ffffff',paper:'#ffffff'}).accent,'#17232d');assert.equal(F.palette({accent:'#111111',paper:'#111111'}).ink,'#fffdf7');
 for(const p of Object.values(E.GUIDE_PALETTES))assert.equal(F.palette(p).accent,p.accent);
 await assert.rejects(()=>F.logoFromFile({type:'image/jpeg',size:10}),/PNG or WebP/);await assert.rejects(()=>F.logoFromFile({type:'image/png',size:3*1024*1024}),/2 MB/);
 await assert.rejects(()=>F.loadImage({...image,width:7},()=>true,600),/dimensions/);
 await assert.rejects(()=>F.loadImage({src:'data:image/png;base64,'+png(700,1).toString('base64'),width:600,height:1},()=>true,600),/oversized footer/);
});
test('footer size controls resize tall/square logos instead of only changing their maximum width',async()=>{
 const {F,calls}=fileFixture(),heights=[];
 for(const size of [100,180,260]){calls.length=0;for await(const page of F.pages(E.guide({...guide(),footer:{logo:copy(image),size}}),()=>true))F.release(page);heights.push(calls.find(c=>c[0]==='alpha-draw'&&c[4]===1560)[6]);}
 assert.deepEqual(heights,[32,48,64]);
});
test('fine logo placement preserves legacy positions, supports full-width banners and stays in the reserved footer',()=>{
 const legacy=E.logoLayout({logo:copy(image)});assert.equal(legacy.y,1560);assert.equal(legacy.height,48);
 const wide={...copy(image),width:1600,height:100};
 for(const widthPct of [.1,20,100])for(const xPct of [0,50,100])for(const yPct of [0,50,100]){const layout=E.logoLayout({logo:wide,widthPct,xPct,yPct});assert.ok(layout.x>=70-1e-9);assert.ok(layout.x+layout.width<=1170+1e-9);assert.ok(layout.y>=1390-1e-9);assert.ok(layout.y+layout.height<=1630+1e-9);assert.ok(Math.abs(layout.width/layout.height-16)<1e-8);}
 const full=E.logoLayout({logo:wide,widthPct:100});assert.equal(full.width,1100);assert.equal(full.x,70);
 for(const [key,value]of [['widthPct',0],['widthPct',101],['xPct',-1],['yPct',101],['xPct',null]])assert.throws(()=>E.footer({[key]:value}),/position/);
});
test('fine logo adjustments persist through save/open and reset without changing other branding',async t=>{
 const c=ui(t);c.module.open('guide');await c.module.add([{name:'sample.png'}]);await c.module.addLogo({});
 const edit=(key,value)=>{const el=c.d.querySelector('[data-bc-logo-'+key+']');el.value=value;el.dispatchEvent(new c.w.Event('input',{bubbles:true}));};
 edit('width','18.5');edit('x','72.5');edit('y','15.1');await c.module.prepare('editable');const saved=await c.last();assert.equal(saved.footer.widthPct,18.5);assert.equal(saved.footer.xPct,72.5);assert.equal(saved.footer.yPct,15.1);
 await c.module.importGuide({size:100,text:async()=>JSON.stringify(saved)});assert.equal(c.d.querySelector('[data-bc-footer-size]').value,'custom');assert.equal(+c.d.querySelector('[data-bc-logo-x]').value,72.5);
 await c.click('reset-logo-layout');await c.module.prepare('editable');const reset=await c.last();assert.equal(reset.footer.widthPct,undefined);assert.equal(reset.footer.xPct,undefined);assert.equal(reset.footer.yPct,undefined);assert.equal(reset.footer.logo.src,image.src);
});
test('live page preview is read-only, supports both views and releases stale work after an account change',async t=>{
 const c=ui(t);c.module.open('guide');await c.module.add([{name:'sample.png'}]);await c.module.prepare('editable');const before=await c.last();const frames=[],released=[];
 c.w.WorkHubBatchCFiles.preview=async(g,alive)=>{frames.push(copy(g));assert.ok(alive());return {width:1240,height:1754};};c.w.WorkHubBatchCFiles.release=page=>released.push(page);
 c.d.querySelector('.bc-branding').open=true;await c.module.preview();assert.equal(c.d.querySelector('[data-bc-page-sheet]').hidden,false);assert.equal(c.d.querySelector('[data-bc-page-preview]').height,877);await c.click('preview-footer');assert.equal(c.d.querySelector('[data-bc-page-preview]').height,207);assert.equal(c.exports.length,0);await c.module.prepare('editable');assert.deepEqual(await c.last(),before);
 let finish;c.w.WorkHubBatchCFiles.preview=()=>new Promise(resolve=>finish=resolve);const pending=c.module.preview();await settle();c.account('other');finish({width:1240,height:1754});await pending;c.module.open('guide');assert.equal(c.d.querySelector('[data-bc-page-sheet]').hidden,true);assert.ok(released.length>=2);
});
test('preview renders only the first export page and raised logos reserve caption space on every continuation',async()=>{
 const {F,calls}=fileFixture(),g=guide();g.footer={logo:copy(image),widthPct:80,xPct:100,yPct:0};g.steps[0].caption=Array.from({length:80},(_,i)=>'Caption '+i).join('\n');
 const preview=await F.preview(g,()=>true);assert.equal(preview.width,1240);assert.equal(preview.height,1754);assert.equal(calls.some(c=>c[0]==='text'&&c[1].startsWith('02')),false);
 const firstLogo=calls.find(c=>c[0]==='alpha-draw'&&c[4]>=1390);F.release(preview);calls.length=0;
 for await(const page of F.pages(E.guide(g),()=>true))F.release(page);
 const logos=calls.filter(c=>c[0]==='alpha-draw'&&c[4]>=1390);assert.ok(logos.length>2);assert.deepEqual(logos[0].slice(3),firstLogo.slice(3));assert.ok(calls.filter(c=>c[0]==='text'&&/^Caption/.test(c[1])).every(c=>c[3]<=1350));assert.ok(calls.some(c=>c[0]==='text'&&c[1]==='Caption 79'));
 await assert.rejects(()=>F.preview(g,()=>false),/cancelled/);
});
test('blur renders through bounded image resampling without depending on canvas filter support',async()=>{
 const {F,calls}=fileFixture(),s=step('blur');s.marks=[{type:'blur',color:'#123456',size:.1,points:[[0,0],[1,1]]}];await F.raster(s);const resamples=calls.filter(c=>c[0]==='draw'&&c.length===10);assert.equal(resamples.length,2);assert.equal(resamples[0].at(-2),1);assert.equal(resamples[0].at(-1),1);
});
test('layout choices validate, round-trip and preserve original saved guides',()=>{
 assert.equal(E.guide(guide()).layout,'classic');
 for(const layout of ['walkthrough','split','compact'])assert.equal(E.guide({...guide(),layout}).layout,layout);
 for(const layout of [null,{},42,'__proto__','unknown'])assert.throws(()=>E.guide({...guide(),layout}),/layout/);
});
test('layout selection opens the full-page live preview, invalidates downloads and survives save/open',async t=>{
 const c=ui(t),before=copy(c.state),frames=[];c.module.open('guide');await c.module.add([{name:'a.png'},{name:'b.png'}]);
 c.w.WorkHubBatchCFiles.preview=async g=>{frames.push(copy(g));return {width:1240,height:g.layout==='compact'?900:1754};};
 const select=c.d.querySelector('[data-bc-layout]');assert.equal(select.options.length,3);assert.equal(select.value,'walkthrough');
 await c.module.addLogo({});
 for(const layout of ['split','compact','walkthrough']){
  await c.module.prepare('pdf');assert.ok(c.d.querySelector('[data-bc-ready] a'));
  select.value=layout;select.dispatchEvent(new c.w.Event('change',{bubbles:true}));
  assert.equal(c.d.querySelector('[data-bc-ready] a'),null);assert.equal(c.d.querySelector('.bc-branding').open,true);
  await c.module.preview();assert.equal(frames.at(-1).layout,layout);assert.equal(c.d.querySelector('[data-bc-page-preview]').height,layout==='compact'?450:877);
  for(const format of ['pdf','jpg-images','images']){await c.module.prepare(format);assert.equal(c.exports.at(-1).g.layout,layout);assert.equal(c.exports.at(-1).g.footer.logo.src,image.src);}
 }
 select.value='compact';select.dispatchEvent(new c.w.Event('change',{bubbles:true}));await c.module.prepare('editable');const saved=await c.last();assert.equal(saved.layout,'compact');
 await c.module.importGuide({size:100,text:async()=>JSON.stringify(saved)});assert.equal(c.d.querySelector('[data-bc-layout]').value,'compact');
 await c.module.importGuide({size:100,text:async()=>JSON.stringify(guide())});assert.equal(c.d.querySelector('[data-bc-layout]').value,'classic');
 c.account('next');c.module.open('guide');assert.equal(c.d.querySelector('[data-bc-layout]').value,'walkthrough');assert.deepEqual(c.state,before);
});
test('three designed layouts pack steps, place split instructions beside screenshots and trim compact pages',async()=>{
 const {F,calls}=fileFixture(),heights={};
 for(const layout of ['walkthrough','split','compact']){
  calls.length=0;const pages=[];for await(const page of F.pages({...guide(),layout},()=>true)){pages.push({width:page.width,height:page.height});F.release(page);}
  assert.equal(pages.length,1,layout+' packs short steps together');heights[layout]=pages[0].height;
  const text=calls.find(c=>c[0]==='text'&&c[1]==='A clear instruction.');assert.equal(text[2],layout==='split'?712:90);
  const titles=calls.filter(c=>c[0]==='text'&&/^0[12] +/.test(c[1]));assert.equal(titles.length,2);
  assert.equal(titles[1][2],layout==='compact'?656:90);
 }
 assert.equal(heights.walkthrough,1754);assert.equal(heights.split,1754);assert.ok(heights.compact<1200);
});
test('all layouts preserve long captions across bounded pages and keep raised footer logos clear',async()=>{
 for(const layout of ['walkthrough','split','compact']){
  const {F,calls}=fileFixture(),g={...guide(),layout,footer:{logo:copy(image),text:'My team',widthPct:20,yPct:0}};
  g.exportHeading='Long heading '.repeat(12);g.title='A maintained guide title '.repeat(6);g.steps[0].title='Detailed step title '.repeat(8);
  g.steps[0].caption=Array.from({length:100},(_,i)=>'Unique line '+i).join('\n');let count=0;
  for await(const page of F.pages(g,()=>true)){assert.ok(page.height<=1754);F.release(page);count++;}
  assert.ok(count>2);const lines=calls.filter(c=>c[0]==='text'&&/^Unique line/.test(c[1]));assert.equal(lines.length,100);assert.equal(lines.at(-1)[1],'Unique line 99');assert.ok(lines.every(c=>c[3]<=1326));
  assert.equal(calls.filter(c=>c[0]==='text'&&c[1]==='My team').length,count);
  assert.ok(calls.some(c=>c[0]==='text'&&c[1].includes('continued')));
  await assert.rejects(()=>F.preview(g,()=>false),/cancelled/);
 }
});
test('compact PDFs match their trimmed image proportions and the preview uses that same page',async()=>{
 const {F}=fileFixture(),g={...guide(),layout:'compact'};
 const preview=await F.preview(g,()=>true);assert.ok(preview.height<1754);
 const task=pdfjs.getDocument({data:new Uint8Array(await(await F.export(g,'pdf',()=>true)).arrayBuffer()),useSystemFonts:true});
 try{const doc=await task.promise,page=await doc.getPage(1),box=page.getViewport({scale:1});assert.ok(Math.abs(box.height/box.width-preview.height/preview.width)<.00001);}finally{await task.destroy();F.release(preview);}
});
