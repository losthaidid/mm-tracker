import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
const window={};
for (const file of ['rehearsal-engine.js','process-canvas-art.js'])
  runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{window});
const E=window.WorkHubRehearsalEngine,A=window.WorkHubProcessCanvasArt,copy=x=>JSON.parse(JSON.stringify(x)),stamp='2026-10-25T00:00:00.000Z';
function sample(){
  const d={workhub:{}};E.upgrade(d);
  const p=E.normalize(E.seed('canvas',stamp,true));d.workhub.rehearsal.processes.push(p);
  p.steps[0].type='material';p.steps[0].entity={materialCode:'MAT-001',materialType:'ROH',batch:'LOT-A',valuationClass:'3000',valuationType:'LOCAL'};
  p.links={projectId:'project-a',noteId:'knowledge-a'};
  p.annotations=[{id:'note',type:'text',text:'Receiving guidance <script>alert(1)</script>',x:25,y:120,w:250,h:120,fontSize:22,width:3,color:'#f4dfa1',anchorId:p.steps[0].id},
    {id:'arrow',type:'arrow',x:180,y:160,width:4,color:'#e5ca82',points:[[0,0],[120,80]]}];
  return{d,p};
}
test('Process canvas data: new step types, entity fields, links and anchored annotations round-trip without changing older processes',()=>{
  const{d,p}=sample();E.validate(d);const original=JSON.stringify(p);
  E.store(d,p);E.validate(d);const reopened=E.library(d)[0];
  assert.deepEqual(copy(reopened),copy(p));assert.equal(JSON.stringify(p),original);
  assert.ok(['organization','company','plant','storage','material','batch','valuation'].every(t=>E.TYPES.includes(t)));
  const legacy=copy(p);delete legacy.annotations;delete legacy.links;delete legacy.steps[0].entity;
  d.workhub.rehearsal.processes=[legacy];E.validate(d);
  assert.equal(E.library(d)[0].annotations.length,0);assert.equal(legacy.annotations,undefined);
});
test('Process canvas validation rejects dangling anchors, cyclic stacks, unsupported metadata and oversized drawings',()=>{
  const{d,p}=sample(),bad=mutate=>{const next=copy(d);mutate(next.workhub.rehearsal.processes[0]);assert.throws(()=>E.validate(next));};
  bad(p=>p.annotations[0].anchorId='foreign');bad(p=>p.annotations.push(copy(p.annotations[0])));
  bad(p=>p.annotations[0].fontSize=1000);bad(p=>p.annotations[1].points=[[0,0],[Infinity,0]]);
  bad(p=>p.annotations[0].color='url(https://example.com)');bad(p=>p.steps[0].entity.script='no');
  bad(p=>{p.steps[0].stackParent=p.steps[1].id;p.steps[1].stackParent=p.steps[0].id;});
  bad(p=>p.annotations=Array.from({length:101},(_,i)=>({...p.annotations[0],id:'n'+i})));
  bad(p=>p.links.noteId={bad:true});E.validate(d);
});
test('Process canvas geometry: attaching and detaching preserve world position; moving a step carries its note; text and arrow resize preserve anchors',()=>{
  const{p}=sample(),m=p.annotations[0],before=A.box(m,p.steps);
  const attached=A.attach(m,p.steps[1].id,p.steps);
  assert.equal(attached.anchorId,p.steps[1].id);assert.deepEqual(copy(A.box(attached,p.steps)),copy(before));
  const detached=A.attach(attached,null,p.steps);assert.deepEqual(copy(A.box(detached,p.steps)),copy(before));
  const larger=A.resize(m,'se',100,60);assert.ok(larger.w>m.w&&larger.h>m.h&&larger.fontSize>m.fontSize);assert.equal(larger.anchorId,m.anchorId);
  const edge=A.resize(m,'e',70,0);assert.equal(edge.fontSize,m.fontSize);assert.equal(edge.h,m.h);assert.equal(edge.w,m.w+70);
  const arrow=A.resize(p.annotations[1],'end',60,40);assert.deepEqual(copy(arrow.points.at(-1)),[180,120]);
  p.steps[0].x+=80;assert.equal(A.box(m,p.steps).x,before.x+80);
});
test('Process canvas removal detaches notes in place, removes magnetic parents and repairs decision defaults and scenarios',()=>{
  const{d,p}=sample(),removed=p.steps[1],first=p.steps[0];
  p.steps.push({...copy(first),id:'third',type:'result',next:'',failNext:'',alternatives:[],x:600,y:300});
  first.type='decision';first.next=removed.id;first.alternatives=[p.steps[2].id];
  first.decision={question:'Proceed?',defaultNext:removed.id,answers:[{label:'A',next:removed.id},{label:'B',next:p.steps[2].id},{label:'C',next:''}]};
  p.steps[2].stackParent=removed.id;p.annotations[0].anchorId=removed.id;
  const before=A.box(p.annotations[0],p.steps);p.scenarios[0].routes={[first.id]:removed.id};
  E.removeStep(p,removed.id);E.validate(d);
  assert.deepEqual(copy(A.box(p.annotations[0],p.steps)),copy(before));assert.equal(p.annotations[0].anchorId,undefined);
  assert.equal(p.steps[1].stackParent,undefined);assert.equal(first.decision.defaultNext,first.next);
  assert.equal(first.decision.answers.length,2);assert.equal(p.scenarios[0].routes[first.id],undefined);
  assert.ok(p.steps.every(s=>!E.connections(s).includes(removed.id)));
});
test('Process canvas rendering escapes saved text, hides editing handles from audience and includes annotations in file drawing',()=>{
  const{p}=sample(),html=A.svg(p,'note',true);
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('data-pc-resize'));
  assert.ok(!A.svg(p,'note',false).includes('data-pc-resize'));
  const drawn=[],ctx=new Proxy({measureText:s=>({width:s.length*10})},{get:(o,k)=>k in o?o[k]:(...args)=>drawn.push([k,...args]),set:(o,k,v)=>(o[k]=v,true)});
  A.draw(ctx,p);assert.ok(drawn.some(x=>x[0]==='fillText'&&String(x[1]).includes('Receiving')));
  assert.ok(drawn.some(x=>x[0]==='lineTo'));assert.ok(A.dimensions(p).width>=850);
});

test('Connection removal preserves both steps, repairs normal and scenario routes, and detaches only the matching magnetic group',()=>{
 const {d,p}=sample(),first=p.steps[0],second=p.steps[1];
 p.steps.push({...copy(second),id:'third',title:'Alternative',next:'',alternatives:[],x:600,y:300});
 first.alternatives=['third'];first.failNext=second.id;second.stackParent=first.id;p.scenarios[0].routes={[first.id]:second.id};
 const notes=JSON.stringify(p.annotations),entity=JSON.stringify(first.entity);
 assert.equal(E.disconnect(p,first.id,second.id),true);E.validate(d);
 assert.equal(p.steps.length,3);assert.equal(first.next,'third');assert.equal(first.failNext,'');assert.deepEqual(copy(first.alternatives),[]);
 assert.equal(p.scenarios[0].routes[first.id],undefined);assert.equal(second.stackParent,undefined);assert.equal(JSON.stringify(p.annotations),notes);assert.equal(JSON.stringify(first.entity),entity);
 const before=JSON.stringify(p);assert.equal(E.disconnect(p,first.id,second.id),false);assert.equal(JSON.stringify(p),before);
 assert.throws(()=>E.disconnect(p,'foreign',second.id),/existing/);
});
test('Connection removal repairs named decision defaults and keeps remaining answers valid',()=>{
 const {d,p}=sample(),first=p.steps[0],second=p.steps[1];
 p.steps.push({...copy(second),id:'third',title:'Alternative',next:'',alternatives:[],x:600,y:300});
 first.type='decision';first.decision={question:'Choose a path',defaultNext:second.id,answers:[{label:'A',next:second.id},{label:'B',next:'third'},{label:'End',next:''}]};first.alternatives=['third'];
 E.disconnect(p,first.id,second.id);E.validate(d);assert.equal(first.next,'third');assert.equal(first.decision.defaultNext,'third');assert.equal(first.decision.answers.length,2);
 E.disconnect(p,first.id,'third');E.validate(d);assert.equal(first.next,'');assert.equal(first.decision,undefined);
});
test('Bulk step deletion validates the whole selection before changing records and repairs references in one graph mutation',()=>{
 const {d,p}=sample(),first=p.steps[0];
 p.steps.push({...copy(p.steps[1]),id:'third',title:'Keep me',next:'',alternatives:[],x:600,y:300});first.alternatives=['third'];
 const before=JSON.stringify(p);assert.throws(()=>E.removeSteps(p,p.steps.map(s=>s.id)),/at least one/);assert.equal(JSON.stringify(p),before);
 E.removeSteps(p,[first.id,p.steps[1].id,first.id]);E.validate(d);assert.equal(p.steps.length,1);assert.equal(p.startId,'third');assert.equal(p.annotations[0].anchorId,undefined);assert.deepEqual(copy(E.connections(p.steps[0])),[]);
});
