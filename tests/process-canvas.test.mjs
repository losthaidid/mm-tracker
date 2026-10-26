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

test('Connection layouts round-trip through both libraries, validate bounded anchors and bends, and clean up after unlink or deletion',()=>{
 const {d,p}=sample(),a=p.steps[0],b=p.steps[1],edge={from:a.id,to:b.id,style:'elbow',start:{side:'bottom',offset:.23},end:{side:'top',offset:.81},via:[{x:750,y:440}]};
 E.setConnector(p,edge);E.validate(d);E.store(d,p);assert.deepEqual(copy(E.library(d)[0].connectors),[edge]);
 const bad=fn=>{const next=copy(d);fn(next.workhub.rehearsal.processes[0].connectors[0]);assert.throws(()=>E.validate(next),/attachment|bends/);};
 bad(e=>e.start.offset=2);bad(e=>e.end.side='middle');bad(e=>e.via=[{x:Infinity,y:2}]);bad(e=>e.to='missing');bad(e=>e.style='javascript');
 const before=JSON.stringify(p);assert.throws(()=>E.setConnector(p,{...edge,via:Array.from({length:9},()=>({x:1,y:2}))}),/bends/);assert.equal(JSON.stringify(p),before);
 E.disconnect(p,a.id,b.id);assert.equal(p.connectors.length,0);E.connect(p,a.id,b.id);E.setConnector(p,edge);E.removeStep(p,b.id);assert.equal(p.connectors.length,0);E.validate(d);
});
test('Reconnecting a destination preserves named decision labels, defaults and scenario routes, while reconnecting a source is atomic',()=>{
 const {d,p}=sample(),a=p.steps[0],b=p.steps[1];p.annotations=[];
 for(const id of ['third','fourth','fifth'])p.steps.push({...copy(b),id,title:id,next:'',alternatives:[],failNext:'',x:600,y:300});
 a.type='decision';a.alternatives=['third'];a.decision={question:'Choose',defaultNext:b.id,answers:[{label:'Approved',next:b.id},{label:'Rejected',next:'third'},{label:'End',next:''}]};p.scenarios[0].routes={[a.id]:b.id};
 E.reconnect(p,a.id,b.id,a.id,'fourth');E.validate(d);
 let step=p.steps.find(s=>s.id===a.id);assert.equal(step.next,'fourth');assert.equal(step.decision.defaultNext,'fourth');assert.equal(step.decision.answers[0].label,'Approved');assert.equal(step.decision.answers[0].next,'fourth');assert.equal(p.scenarios[0].routes[a.id],'fourth');
 const before=JSON.stringify(p);assert.throws(()=>E.reconnect(p,a.id,'fourth',a.id,'third'),/already linked/);assert.equal(JSON.stringify(p),before);assert.throws(()=>E.reconnect(p,a.id,'fourth','fourth','fourth'),/different/);assert.equal(JSON.stringify(p),before);
 E.reconnect(p,a.id,'fourth','fifth','fourth');E.validate(d);assert.ok(!E.connections(p.steps.find(s=>s.id===a.id)).includes('fourth'));assert.equal(p.steps.find(s=>s.id==='fifth').next,'fourth');assert.equal(p.steps.find(s=>s.id===a.id).decision.answers.length,2);
});
test('Shared link geometry honors arbitrary edge positions and bend points, follows moved cards, and gives matching animation coordinates',()=>{
 const a={id:'a',x:80,y:70},b={id:'b',x:600,y:340},layout={from:'a',to:'b',start:{side:'bottom',offset:.2},end:{side:'top',offset:.85},via:[{x:380,y:550}]};
 assert.deepEqual(copy(A.nearestAnchor(a,{x:143,y:71})),{side:'top',offset:.3});
 for(const style of ['curve','elbow','straight']){
  const edge={...layout,style},g=A.linkGeometry(a,b,edge),start=g.point(0),end=g.point(1);assert.ok(Math.abs(start.x-122)<1e-8&&Math.abs(start.y-170)<1e-8);assert.ok(Math.abs(end.x-778.5)<1e-8&&Math.abs(end.y-340)<1e-8);assert.equal(E.path(a,b,edge),g.path);assert.deepEqual(copy(E.point(a,b,.6,edge)),copy(g.point(.6)));assert.ok(g.segments.some(s=>s[3].x===380&&s[3].y===550));
  const moved=A.linkGeometry({...a,x:180},b,edge);assert.equal(moved.start.x,222);assert.equal(moved.end.x,g.end.x);
 }
 const p={steps:[a,b],annotations:[],connectors:[{...layout,style:'curve',via:[{x:1800,y:1600}]}]};assert.ok(A.dimensions(p).width>=1800&&A.dimensions(p).height>=1600);assert.match(A.linkHandles(p,p.connectors[0]),/data-link-handle="start"/);assert.match(A.linkHandles(p,p.connectors[0]),/data-link-handle="bend-0"/);
});
test('Right-angle route bends do not retrace their incoming segment and all corners stay orthogonal',()=>{
 const a={x:50,y:235},b={x:570,y:55},edge={style:'elbow',start:{side:'right',offset:.5},end:{side:'bottom',offset:.61},via:[{x:498,y:385}]},g=A.linkGeometry(a,b,edge);
 const lines=g.segments.filter(s=>Math.hypot(s[3].x-s[0].x,s[3].y-s[0].y)>1e-8);for(const s of lines)assert.ok(s[0].x===s[3].x||s[0].y===s[3].y);
 for(let i=1;i<lines.length;i++){const a=lines[i-1],b=lines[i],u=[a[3].x-a[0].x,a[3].y-a[0].y],v=[b[3].x-b[0].x,b[3].y-b[0].y];assert.ok(u[0]*v[0]+u[1]*v[1]>=0);}
});
