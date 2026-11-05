import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import jsQR from 'jsqr';
await import('../drive-files-engine.js');
await import('../drive-files-api.js');
await import('../handover-engine.js');
const E=globalThis.WorkHubDriveFilesEngine,H=globalThis.WorkHubHandoverEngine,A=globalThis.WorkHubDriveAPI;
const clientId='123456789-test_web.apps.googleusercontent.com';
const file=(overrides={})=>({id:'file_001',name:'001_6.00007.xlsx',mimeType:'application/vnd.ms-excel',size:'4',createdTime:'2026-11-05T08:00:00Z',ownedByMe:true,trashed:false,webViewLink:'https://drive.google.com/file/d/file_001/view?resourcekey=0-EXACT',webContentLink:'https://drive.google.com/uc?id=file_001&export=download&resourcekey=0-EXACT',appProperties:{workhubOwner:'owner_1',sourceType:'upload'},capabilities:{canShare:true,canDownload:true},...overrides});
function document(){return{projects:[{id:'p',name:'Plant setup'}],tasks:[{id:'t1',number:'001',task:'Material 6.00007',done:false,boardStatus:'doing',taskType:'Project',linkId:'p',remarks:'Parent notes',feedback:'Parent feedback',dueDate:'2026-11-15',references:[{label:'Source',url:'https://example.test/source'}],subTasks:[{id:'s1',title:'Correct description for 001',status:'In progress',feedback:'Own feedback',owner:'A',dueDate:'2026-11-11'},{id:'s2',title:'Already done',status:'Completed',feedback:'Sibling feedback',owner:'B'}]}],tickets:[{id:'tk',ticket:'T-001',description:'Investigate',status:'Pending',history:'- Old [01-11-2026]\n- Latest 001 [05-11-2026]'}],specs:[{id:'i1',itemId:'006',projectId:'p',description:'Storage locations',status:'In progress',subItems:[{id:'is1',title:'QA00, QA01',status:'Not started',feedback:'Only this child'}]}],workhub:{waiting:[{id:'w1',title:'Approval',person:'Team',notes:'Review',followUp:'2026-11-20',resolved:false}],batchA:{records:[{id:'tasks:t1',nextStep:'Confirm with owner',pause:{active:true,reason:'approval',notes:'Awaiting QA'}}]}}};}
function transport(handler){
 let owner='owner_1',ready=true;const calls=[],configs=[];
 const oauth={initTokenClient(config){configs.push(config);return{requestAccessToken(){queueMicrotask(()=>config.callback({access_token:'IN_MEMORY_SECRET',expires_in:3600,scope:A.SCOPE}));}};}};
 const api=A.create({owner:()=>owner,ready:()=>ready},{load:async()=>{},oauth,fetch:async(url,options)=>{
  calls.push({url,options});const u=new URL(url);let result;
  if(u.pathname.endsWith('/about'))result={user:{permissionId:'google_1',emailAddress:'owner@example.test',displayName:'Owner'}};
  else result=await handler(u,options,calls);
  if(result instanceof Response)return result;
  return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
 }});
 return{api,calls,configs,setOwner:v=>owner=v,setReady:v=>ready=v};
}
test('Drive metadata: originals, leading zeros, provider resource keys and backups round trip without tokens',()=>{
 const d={workhub:{}};E.upgrade(d);d.workhub.driveFiles.clientId=clientId;d.workhub.driveFiles.files.push(E.metadata(file(),'google_1'));E.validate(d);
 const restored=JSON.parse(JSON.stringify(d));E.validate(restored);assert.equal(restored.workhub.driveFiles.files[0].name,'001_6.00007.xlsx');assert.match(restored.workhub.driveFiles.files[0].webContentLink,/resourcekey=0-EXACT/);assert.equal(E.clientId('secret'),false);
 for(const key of ['accessToken','refresh_token','clientSecret']){const bad=structuredClone(d);bad.workhub.driveFiles[key]='SECRET';assert.throws(()=>E.validate(bad));}
 const next=E.merge(d.workhub.driveFiles,[{...d.workhub.driveFiles.files[0],name:'New exact name'}]);assert.equal(next.files.length,1);assert.equal(d.workhub.driveFiles.files[0].name,'001_6.00007.xlsx');
});
test('Drive metadata: unsafe links, token links, duplicate IDs and file data are rejected',()=>{
 for(const value of ['javascript:alert(1)','https://drive.google.com.attacker.test/x','https://user:pass@drive.google.com/x','https://drive.google.com:444/x','https://drive.google.com/x?access_token=SECRET'])assert.equal(E.url(value),'');
 const m=E.metadata(file(),'google_1');
 for(const row of [{...m,bytes:'RAW FILE'},{...m,size:Infinity},{...m,source:{kind:'workspace',id:'x'}},{...m,webContentLink:'https://evil.test/file'}])assert.throws(()=>E.validate({workhub:{driveFiles:{version:1,clientId:'',files:[row]}}}));
 assert.throws(()=>E.validate({workhub:{driveFiles:{version:1,clientId:'',files:[m,m]}}}));
});
test('Drive API: connection uses only drive.file and tokens never enter returned account data',async()=>{
 const t=transport(()=>({files:[]}));assert.equal(t.calls.length,0);assert.equal(t.api.connected(),false);const who=await t.api.connect(clientId);
 assert.equal(t.configs[0].scope,A.SCOPE);assert.equal(t.configs[0].include_granted_scopes,false);assert.deepEqual(who,{id:'google_1',email:'owner@example.test',name:'Owner'});assert.doesNotMatch(JSON.stringify(who),/IN_MEMORY_SECRET/);
 assert.equal(t.calls[0].options.headers.Authorization,'Bearer IN_MEMORY_SECRET');t.api.clear();assert.equal(t.api.connected(),false);await assert.rejects(t.api.list(),/Account changed|expired/);
});
test('Drive API: XLS binary bytes and filename survive upload unchanged; metadata registered only after verification',async()=>{
 let saved;const original=new Uint8Array([0,255,128,13,10,0,49,48,48,49]);
 const t=transport(async(u,o)=>{
  if(u.searchParams.get('q')?.includes("mimeType='application/vnd.google-apps.folder'"))return{files:[{id:'folder_1',ownedByMe:true}]};
  if(u.pathname.endsWith('generateIds'))return{ids:['file_001']};
  if(u.pathname.includes('/upload/')){const bytes=Buffer.from(await o.body.arrayBuffer());const marker=Buffer.from('Content-Type: application/vnd.ms-excel\r\n\r\n');const start=bytes.indexOf(marker)+marker.length;assert.ok(start>=marker.length);assert.deepEqual(bytes.subarray(start,start+original.length),Buffer.from(original));const tail=bytes.subarray(start+original.length).toString();assert.match(tail,/^\r\n--workhub_file_001--\r\n$/);const metadata=JSON.parse(bytes.toString().split('\r\n\r\n')[1].split('\r\n--')[0]);assert.equal(metadata.name,'001_6.00007.xls');assert.equal(metadata.mimeType,'application/vnd.ms-excel');saved=file({...metadata,size:String(original.length)});return saved;}
  throw Error('Unexpected request '+u);
 });await t.api.connect(clientId);
 const f=await t.api.upload(new Blob([original],{type:'application/vnd.ms-excel'}),'001_6.00007.xls',{sourceType:'upload',source:{kind:'tasks',id:'t1'}});
 assert.equal(f.name,'001_6.00007.xls');assert.equal(f.appProperties.sourceId,'t1');assert.equal(t.calls.filter(c=>c.options.method==='POST').length,1);assert.doesNotMatch(JSON.stringify(saved),/IN_MEMORY_SECRET/);
});
test('Drive API: uncertain upload recovers its allocated file ID and never repeats the upload',async()=>{
 const t=transport((u,o)=>{
  if(u.searchParams.get('q'))return{files:[{id:'folder_1',ownedByMe:true}]};
  if(u.pathname.endsWith('generateIds'))return{ids:['file_001']};
  if(u.pathname.includes('/upload/'))throw Error('Connection reset after upload');
  if(u.pathname.endsWith('/file_001'))return file();throw Error('Unexpected');
 });await t.api.connect(clientId);const r=await t.api.upload(new Blob(['0010']),'source.bin');assert.equal(r.id,'file_001');assert.equal(t.calls.filter(c=>c.options.method==='POST').length,1);
});
test('Drive API: wrong upload size and account changes fail before returning verified metadata',async()=>{
 const t=transport((u)=>u.searchParams.get('q')?{files:[{id:'folder_1',ownedByMe:true}]}:u.pathname.endsWith('generateIds')?{ids:['file_001']}:file({size:'999'}));await t.api.connect(clientId);await assert.rejects(t.api.upload(new Blob(['0010']),'source.bin'),/could not be verified/);
 let release;const changed=transport(u=>u.pathname.endsWith('/files')?new Promise(r=>release=r):{});await changed.api.connect(clientId);const pending=changed.api.list();await Promise.resolve();changed.setOwner('owner_2');release({files:[file()]});await assert.rejects(pending,/Account changed/);assert.equal(changed.api.connected(),false);
});
test('Drive API: refresh is paginated and filters out foreign, unowned and non-app files',async()=>{
 const t=transport(u=>u.searchParams.has('pageToken')?{files:[file({id:'other',ownedByMe:false})]}:{files:[file(),file({id:'foreign',appProperties:{workhubOwner:'another'}})],nextPageToken:'next'});await t.api.connect(clientId);assert.deepEqual((await t.api.list()).map(f=>f.id),['file_001']);assert.equal(t.calls.filter(c=>c.url.includes('/files?')).length,2);
 assert.match(decodeURIComponent(t.calls[1].url),/workhubOwner/);assert.ok(!t.calls.some(c=>c.url.includes('IN_MEMORY_SECRET')));
});
test('Drive API: explicit sharing creates only a file reader link and disabling targets only its managed permission',async()=>{
 let shared=false;const t=transport((u,o)=>{
  if(u.pathname.endsWith('/permissions/managed_1')){assert.equal(o.method,'DELETE');shared=false;return new Response(null,{status:204});}
  if(u.pathname.endsWith('/permissions')){if(o.method==='POST'){assert.deepEqual(JSON.parse(o.body),{type:'anyone',role:'reader',allowFileDiscovery:false});shared=true;return{id:'managed_1',type:'anyone',role:'reader'};}return{permissions:[{id:'existing_user',type:'user',role:'writer'},...(shared?[{id:'managed_1',type:'anyone',role:'reader'}]:[])]};}
  return file();
 });await t.api.connect(clientId);const result=await t.api.share('file_001');assert.equal(result.managedShareId,'managed_1');await t.api.unshare('file_001',result.managedShareId);assert.equal(shared,false);assert.equal(t.calls.filter(c=>c.options.method==='DELETE').length,1);assert.ok(t.calls.filter(c=>c.options.method==='POST'||c.options.method==='DELETE').every(c=>c.url.includes('/files/file_001/permissions')));
});
test('Drive API: existing public access is preserved; broader and inherited permissions cannot be removed as app shares',async()=>{
 for(const role of ['reader','writer']){const t=transport(u=>u.pathname.endsWith('/permissions')?{permissions:[{id:'external_anyone',type:'anyone',role,permissionDetails:[{inherited:true}]}]}:file());await t.api.connect(clientId);if(role==='reader'){const r=await t.api.share('file_001');assert.equal(r.existing,true);assert.equal(r.managedShareId,'');}else await assert.rejects(t.api.share('file_001'),/broader public access/);await assert.rejects(t.api.unshare('file_001','external_anyone'),/changed or is inherited/);assert.equal(t.calls.filter(c=>c.options.method==='POST'||c.options.method==='DELETE').length,0);}
});
test('Drive API: permissions errors, foreign ownership and empty/oversize inputs never trigger uploads',async()=>{
 const t=transport(()=>new Response('{}',{status:403}));await t.api.connect(clientId);await assert.rejects(t.api.list(),/denied/);await assert.rejects(t.api.upload(new Blob([]),'empty.xls'),/non-empty/);assert.equal(t.calls.filter(c=>c.options.method==='POST').length,0);
 const foreign=transport(()=>file({ownedByMe:false}));await foreign.api.connect(clientId);await assert.rejects(foreign.api.share('file_001'),/not an available WorkHub file/);
});
test('QR: independent decoder recovers the exact Drive download URL and resource key',()=>{
 const context=vm.createContext({URL,WorkHubDriveFilesEngine:E});vm.runInContext(readFileSync(new URL('../vendor/qrcode/qrcode.js',import.meta.url),'utf8'),context);vm.runInContext(readFileSync(new URL('../files-library.js',import.meta.url),'utf8'),context);
 for(const value of [file().webContentLink,'https://drive.google.com/file/d/001/view?resourcekey=0-AB_cd-123&usp=sharing']){
  const qr=context.WorkHubFilesLibrary.matrix(value),n=qr.getModuleCount(),scale=8,w=(n+8)*scale,pixels=new Uint8ClampedArray(w*w*4);pixels.fill(255);
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const i=(((r+4)*scale+dy)*w+(c+4)*scale+dx)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}
  assert.equal(jsQR(pixels,w,w)?.data,value);
 }
});
test('Handover snapshot: each child preserves the correct parent, description, identifiers, dates and own feedback',()=>{
 const d=document(),before=structuredClone(d),rows=H.collect(d),child=rows.find(r=>r.childId==='s1');assert.equal(child.parent.title,'Material 6.00007');assert.equal(child.parent.identifier,'001');assert.equal(child.feedback,'Own feedback');assert.equal(child.due,'2026-11-11');assert.equal(child.owner,'A');assert.equal(child.notes,'');assert.equal(child.nextStep,'');assert.equal(rows.find(r=>r.childId==='s2').open,false);
 const main=rows.find(r=>r.kind==='tasks'&&!r.childId);assert.equal(main.nextStep,'Confirm with owner');assert.equal(main.blocker,'Awaiting QA');const pack=H.snapshot(d,[main.key,child.key],{title:'001 Handover',from:'A',to:'B'});d.tasks[0].task='Changed after preview';d.tasks[0].subTasks[0].feedback='Later update';assert.equal(pack.records[0].title,'Material 6.00007');assert.equal(pack.records[1].feedback,'Own feedback');assert.deepEqual(before.tasks[0].subTasks[1],d.tasks[0].subTasks[1]);assert.equal(H.filename(pack).slice(0,12),'001-Handover');
});
test('Handover snapshot: source permissions, completion, archived rows and optional fields are respected',()=>{
 const d=document();d.tasks.push({id:'archived',task:'Hidden',archived:true});const can=(k,a)=>k!=='tickets'&&k!=='files';const rows=H.collect(d,can);assert.ok(!rows.some(r=>r.kind==='tickets'||r.id==='archived'));const keys=rows.map(r=>r.key);const pack=H.snapshot(d,keys,{notes:false,feedback:false,nextSteps:false,references:false},can);assert.ok(pack.records.every(r=>!r.notes&&!r.feedback&&!r.nextStep&&!r.blocker&&!r.references.length));assert.equal(H.allowed(pack,(k)=>k!=='tasks'),false);assert.throws(()=>H.snapshot(d,['missing'],{},can),/no longer available/);assert.throws(()=>H.snapshot(d,[],{},can),/between 1 and 500/);assert.throws(()=>H.snapshot(d,keys,{},()=>false),/disabled/);
});
test('Handover snapshot: exported content is detached, exact strings remain text, and oversized content is rejected, not shortened',()=>{
 const d=document();const row=H.collect(d).find(r=>r.id==='i1'&&!r.childId);const before=structuredClone(d);const p=H.snapshot(d,[row.key],{},()=>true,'2026-11-05T08:00:00Z');assert.deepEqual(d,before);assert.equal(p.records[0].identifier,'006');assert.equal(p.createdAt,'2026-11-05T08:00:00Z');d.specs[0].remarks='x'.repeat(H.MAX_CHARS);assert.throws(()=>H.snapshot(d,[row.key]),/too large/);
});
test('Drive API: sharing sees existing public access on later permission pages and prevents blind mutation',async()=>{
 const t=transport(u=>u.pathname.endsWith('/permissions')?(u.searchParams.has('pageToken')?{permissions:[{id:'external_anyone',type:'anyone',role:'reader'}]}:{permissions:[{id:'user_1',type:'user',role:'writer'}],nextPageToken:'next_permissions'}):file());await t.api.connect(clientId);const result=await t.api.share('file_001');assert.equal(result.existing,true);assert.equal(t.calls.filter(c=>c.options.method==='POST').length,0);assert.ok(t.calls.every(c=>c.options.redirect==='error'));
});
test('Handover PDF: full long fields paginate into a valid PDF without losing final text or parent identifiers',async t=>{
 const {PDFDocument}=await import('pdf-lib');const painted=[];const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ZkAAAAASUVORK5CYII=','base64');
 const prior=globalThis.document;t.after(()=>{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;});
 globalThis.document={currentScript:{src:new URL('../handover-files.js',import.meta.url).href},baseURI:new URL('../',import.meta.url).href,fonts:{ready:Promise.resolve()},createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},measureText:s=>({width:s.length*12}),fillText:s=>painted.push(s)}),toBlob:cb=>cb(new Blob([png],{type:'image/png'}))})};
 await import('../handover-files.js');const d=document(),child=H.collect(d).find(r=>r.childId==='s1');d.tasks[0].subTasks[0].remarks=('Long exact field 001 / 6.00007 / µL — 原文\n').repeat(180)+'FINAL_VALUE_DO_NOT_TRUNCATE';const pack=H.snapshot(d,[child.key],{},()=>true,'2026-11-05T08:00:00Z');const blob=await globalThis.WorkHubHandoverFiles.pdf(pack);const pdf=await PDFDocument.load(await blob.arrayBuffer());assert.ok(pdf.getPageCount()>3);assert.equal(pdf.getTitle(),'Handover pack');assert.ok(painted.includes('FINAL_VALUE_DO_NOT_TRUNCATE'));assert.ok(painted.some(s=>s.includes('001')&&s.includes('Material 6.00007')));assert.equal(blob.type,'application/pdf');assert.ok(painted.filter(s=>s.includes('Long exact field')).length>=180);
 await assert.rejects(globalThis.WorkHubHandoverFiles.pdf(pack,{alive:()=>false}),/Export stopped/);
});
