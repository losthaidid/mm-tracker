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
 w.eval(source('audience-view.js'));w.eval(source('audience.js'));
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
 assert.doesNotMatch(h.document.body.textContent,/Public information|Public request flow/);assert.match(h.document.body.textContent,/disconnected/);
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
