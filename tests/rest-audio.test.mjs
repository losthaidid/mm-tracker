import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';

test('rest-only compositions are distinct stereo loops with soft boundaries and unclipped signal',t=>{
 const dom=new JSDOM('',{runScripts:'outside-only'});t.after(()=>dom.window.close());dom.window.eval(readFileSync(new URL('../rest-audio.js',import.meta.url),'utf8'));const E=dom.window.WorkHubRestAudio;
 const context={sampleRate:8000,createBuffer(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length));return{length,sampleRate:rate,getChannelData:i=>data[i]};}},signals=[];
 assert.equal(Object.keys(E.TRACKS).length,3);
 for(const id of Object.keys(E.TRACKS)){const b=E.createBuffer(context,id),left=b.getChannelData(0),right=b.getChannelData(1);assert.equal(b.length,8000*24);let peak=0,energy=0,stereo=0;for(let i=0;i<left.length;i++){assert.ok(Number.isFinite(left[i])&&Number.isFinite(right[i]));peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));energy+=left[i]**2;stereo+=Math.abs(left[i]-right[i]);}assert.ok(peak<.75&&peak>.02);assert.ok(energy/left.length>.0001);assert.ok(stereo>1);assert.equal(Math.abs(left[0]),0);assert.ok(Math.abs(left.at(-1))<.001);signals.push(left);}
 for(let i=1;i<signals.length;i++){let distance=0;for(let j=0;j<signals[0].length;j+=31)distance+=Math.abs(signals[0][j]-signals[i][j]);assert.ok(distance>10);}
});
