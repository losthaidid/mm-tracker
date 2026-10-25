import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
const source=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const token='audience-test-123456789', origin='https://preview.test';
function audience(t){
 const dom=new JSDOM(source('audience.html'),{url:origin+'/audience.html#'+token,runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,timers=new Map(),out=[],opener={closed:false,postMessage:(m,o)=>out.push({m,o})};let now=10000;
 w.opener=opener;w.Date.now=()=>now;w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
 w.setInterval=fn=>{timers.set(1,fn);return 1;};w.clearInterval=id=>timers.delete(id);
 Object.defineProperty(w,'localStorage',{get(){throw Error('Audience must not access account storage');}});
 w.eval(source('process-canvas-art.js'));w.eval(source('audience-view.js'));w.eval(source('audience.js'));
 const receive=(data,from=opener,site=origin)=>w.dispatchEvent(new w.MessageEvent('message',{origin:site,source:from,data:{token,...data}}));
 return {w,document:w.document,opener,timers,out,receive,advance(ms){now+=ms;for(const fn of timers.values())fn();}};
}
const processSnapshot=()=>({kind:'process',title:'Public request flow',playing:false,reduced:false,phase:0,speed:1,duration:3,count:1,total:2,active:'a',next:'b',steps:[{id:'a',title:'Start',type:'task',x:50,y:55},{id:'b',title:'Finish',type:'result',x:310,y:55}],edges:[{from:'a',to:'b',label:'Continue'}],detail:{title:'Start',explanation:'Public information',expected:'Ready'},decision:null});
test('audience accepts only its opener, exact origin and current token; ending clears content and rejects stale updates',t=>{
 const h=audience(t),snapshot=processSnapshot();
 assert.equal(h.out[0].m.type,'workhub-audience-ready');
 h.receive({type:'workhub-audience-state',snapshot},{});assert.doesNotMatch(h.document.body.textContent,/Public request flow/);
 h.receive({type:'workhub-audience-state',snapshot},h.opener,'https://other.test');assert.doesNotMatch(h.document.body.textContent,/Public request flow/);
 h.receive({type:'workhub-audience-state',snapshot,token:'wrong'});assert.doesNotMatch(h.document.body.textContent,/Public request flow/);
 h.receive({type:'workhub-audience-state',snapshot});assert.match(h.document.body.textContent,/Public request flow/);
 h.receive({type:'workhub-audience-end'});assert.doesNotMatch(h.document.body.textContent,/Public request flow/);assert.match(h.document.body.textContent,/has ended/);
 h.receive({type:'workhub-audience-state',snapshot});assert.doesNotMatch(h.document.body.textContent,/Public request flow/);
});
test('audience covers stale or closed presenter content and heartbeat requests never send content back',t=>{
 const h=audience(t);h.receive({type:'workhub-audience-state',snapshot:processSnapshot()});h.advance(6500);
 assert.doesNotMatch(h.document.body.textContent,/Public information|Public request flow/);assert.match(h.document.body.textContent,/paused|disconnected/);
 assert.ok(h.out.every(({m,o})=>o===origin && Object.keys(m).sort().join(',')==='token,type'));
 h.receive({type:'workhub-audience-state',snapshot:processSnapshot()});h.opener.closed=true;h.advance(1000);assert.doesNotMatch(h.document.body.textContent,/Public information/);
});
test('audience renderer escapes text, bounds annotations and renders a paused break at zero until explicitly changed',t=>{
 const h=audience(t),snapshot=processSnapshot();snapshot.title='<img src=x onerror=alert(1)>';snapshot.detail.explanation='<script>bad()</script>';
 h.receive({type:'workhub-audience-state',snapshot,marks:[{type:'arrow',color:'#edab32',width:4,points:[[.1,.1],[.4,.4]]},{type:'pen',color:'red" onload="bad()',width:4,points:[[.1,.1],[.4,.4]]},{type:'pen',color:'#ffffff',width:4,points:[[-1,1],[2,3]]}]});
 assert.equal(h.document.querySelectorAll('img,script:not([src])').length,0);assert.match(h.document.querySelector('.av-header h1').textContent,/<img/);assert.equal(h.document.querySelectorAll('.av-annotations polyline').length,1);
 h.receive({type:'workhub-audience-state',snapshot:{kind:'break',message:'Please wait',seconds:0,paused:true,completeMessage:'Ready when you are',scene:'stars'}});
 assert.equal(h.document.querySelector('.av-clock').textContent,'00:00');assert.match(h.document.body.textContent,/Ready when you are/);
});
test('audience text is escaped and bounded; authenticated laser updates are transient and clear on disconnect',t=>{
 const h=audience(t),snapshot=processSnapshot();h.receive({type:'workhub-audience-state',snapshot,marks:[{type:'text',text:'Review <script>alert(1)</script> here',fontSize:24,color:'#ffe0aa',width:4,points:[[.9,.9]]},{type:'text',text:'x'.repeat(241),fontSize:24,color:'#ffe0aa',width:4,points:[[.1,.1]]}]});
 assert.equal(h.document.querySelectorAll('.av-text-note').length,1);assert.match(h.document.querySelector('.av-text-note text').textContent,/<script>/);assert.equal(h.document.querySelectorAll('script:not([src])').length,0);
 h.receive({type:'workhub-audience-pointer',pointer:[.3,.4]},{});assert.equal(h.document.querySelector('.av-laser'),null);h.receive({type:'workhub-audience-pointer',pointer:[.3,.4]});assert.equal(h.document.querySelector('.av-laser').hidden,false);
 h.receive({type:'workhub-audience-pointer',pointer:[2,-1]});assert.equal(h.document.querySelector('.av-laser').hidden,true);h.advance(7000);assert.equal(h.document.querySelector('.av-laser'),null);
});

test('audience content has no fullscreen, stay-windowed, laser or other controls',t=>{
 const h=audience(t);h.receive({type:'workhub-audience-state',snapshot:processSnapshot()});
 assert.equal(h.document.querySelectorAll('button,input,select,textarea').length,0);
 assert.equal(h.document.querySelector('#audienceStage').getAttribute('data-kind'),'process');
});
test('audience canvas geometry keeps annotations inside the stage and accounts for SVG letterboxing during zoom and pan',t=>{
 const h=audience(t),V=h.w.WorkHubAudienceView;
 const mark={type:'text',text:'A note near the edge',fontSize:24,color:'#ffffff',width:4,points:[[.98,.98]]},b=V.textBox(mark);
 assert.equal(V.hitMark([mark],[(b.x+20)/1000,(b.y+20)/562.5]),0);
 const moved=V.moveMark(mark,-.2,-.2),m=V.textBox(moved);assert.ok(Math.abs(m.x-(b.x-200))<1e-8);assert.ok(Math.abs(m.y-(b.y-112.5))<1e-8);
 const arrow={type:'arrow',color:'#ffffff',width:4,points:[[.1,.2],[.4,.5]]},a=V.moveMark(arrow,3,-3);
 assert.ok(Math.abs((a.points[1][0]-a.points[0][0])-.3)<1e-8);assert.ok(a.points.every(p=>p.every(n=>n>=0&&n<=1)));
 const p=V.graphPoint([500,300],{left:0,top:0,width:1000,height:600},{x:100,y:200,width:1000,height:300});assert.equal(p.x,600);assert.equal(p.y,350);
 const stage=h.document.getElementById('audienceStage'),view=V.create(stage),snapshot=processSnapshot();
 view.update(snapshot,[],{overview:false});const node=stage.querySelector('.av-node');view.update(snapshot,[],{overview:true,camera:{x:50,y:70,width:600,height:300},mapOnly:true});assert.equal(stage.querySelector('.av-node'),node);assert.equal(stage.querySelector('.av-graph').getAttribute('viewBox'),'50 70 600 300');view.update(snapshot,[],{overview:true});assert.equal(stage.querySelector('.av-graph').getAttribute('viewBox'),'0 0 850 450');view.destroy();
});
