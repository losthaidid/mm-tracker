import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';

function audio(t) {
  const dom=new JSDOM('<body><div id="modalBody"></div></body>',{url:'https://losthaidid.github.io/mm-tracker/',runScripts:'outside-only'});
  t.after(()=>dom.window.close());
  const {window}=dom,contexts=[];
  const param=()=>({value:0,cancelScheduledValues(){},setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;}});
  class Context {
    constructor(){this.sampleRate=8000;this.currentTime=0;this.state='suspended';this.destination={};this.nodes=[];contexts.push(this);}
    node(extra={}){const n={connect(next){this.next=next;},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;},...extra};this.nodes.push(n);return n;}
    createGain(){return this.node({gain:param()});}
    createBufferSource(){return this.node({source:true,playbackRate:param()});}
    createBiquadFilter(){return this.node({frequency:param(),Q:param()});}
    createDynamicsCompressor(){return this.node({compressor:true,threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()});}
    createBuffer(numberOfChannels,length,sampleRate){const data=Array.from({length:numberOfChannels},()=>new Float32Array(length));return{numberOfChannels,length,sampleRate,getChannelData:i=>data[i]};}
    resume(){this.state='running';return Promise.resolve();}
    close(){this.state='closed';return Promise.resolve();}
  }
  window.AudioContext=Context;
  for(const file of ['lofi-engine.js','soundscape.js','rest-audio.js'])window.eval(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  return{window,document:window.document,contexts};
}

test('every focus track receives a higher music level through the existing compressor, with mute and volume still effective',async t=>{
  const {window,document,contexts}=audio(t),ui=window.WorkHubSoundscape.install({ready:()=>true,tell(){},openModal(title,body){document.getElementById('modalBody').innerHTML=body;}});
  ui.preset('lofi');await ui.start();ui.open();const context=contexts[0];
  for(const track of Object.keys(window.WorkHubLofi.TRACKS)){
    const select=document.getElementById('soundscapeTrack');select.value=track;select.dispatchEvent(new window.Event('change',{bubbles:true}));
    const music=context.nodes.findLast(n=>n.source&&n.buffer?.numberOfChannels===2&&!n.stopped),channel=music.next.next,output=channel.next,compressor=output.next;
    assert.ok(channel.gain.value>1.8*.85*1.4,'music is at least 40% louder at the same slider positions');
    assert.equal(compressor.compressor,true);assert.ok(compressor.threshold.value<0&&compressor.ratio.value>1);assert.equal(compressor.next,context.destination);
    ui.setMaster(0);assert.equal(output.gain.value,0);ui.setMaster(45);const level=output.gain.value;ui.setMuted(true);assert.equal(output.gain.value,0);ui.setMuted(false);assert.equal(output.gain.value,level);
  }
  ui.stop();assert.equal(context.state,'closed');
});

test('the upbeat preset and track picker work before and during playback and reopen with the saved mix',async t=>{
  const {window,document,contexts}=audio(t),options={ready:()=>true,tell(){},openModal(title,body){document.getElementById('modalBody').innerHTML=body;}};
  const ui=window.WorkHubSoundscape.install(options);ui.open();
  const select=document.getElementById('soundscapeTrack');
  const choose=id=>{select.value=id;select.dispatchEvent(new window.Event('change',{bubbles:true}));};
  const preset=id=>document.querySelector(`[data-preset="${id}"]`).click();
  assert.deepEqual([...select.querySelectorAll('optgroup[label="Upbeat"] option')].map(o=>o.value),['sunrise','city','neon']);
  choose('city');assert.equal(ui.snapshot().mix.lofi,85);assert.equal(ui.snapshot().mix.rain,45);
  preset('upbeat');assert.equal(select.value,'city');assert.equal(ui.snapshot().mix.rain,0);
  assert.equal(contexts.length,0);
  await ui.start();const context=contexts[0];
  const source=()=>context.nodes.findLast(n=>n.buffer?.numberOfChannels===2&&!n.stopped);
  const first=source();assert.equal(first.loop,true);
  const level=document.querySelector('[data-sound-level="lofi"]');level.value='39';level.dispatchEvent(new window.Event('input',{bubbles:true}));
  choose('neon');assert.equal(first.stopped,true);assert.equal(first.disconnected,true);assert.equal(ui.snapshot().mix.lofi,39);
  assert.equal(ui.snapshot().trackName,'Neon run');assert.match(document.getElementById('soundscapeStatus').textContent,/Neon run/);
  const music=source(),left=music.buffer.getChannelData(0),right=music.buffer.getChannelData(1);
  assert.ok(Math.abs(music.buffer.length/music.buffer.sampleRate-48*60/124)<0.002);
  assert.equal(left[0],left.at(-1));assert.equal(right[0],right.at(-1));
  ui.stop();assert.equal(music.stopped,true);assert.equal(context.state,'closed');
  const reopened=window.WorkHubSoundscape.install(options);reopened.open();
  assert.equal(document.getElementById('soundscapeTrack').value,'neon');assert.equal(reopened.snapshot().mix.lofi,39);assert.equal(reopened.snapshot().playing,false);
  reopened.preset('lofi');assert.equal(document.getElementById('soundscapeTrack').value,'lantern');
  reopened.preset('upbeat');assert.equal(document.getElementById('soundscapeTrack').value,'sunrise');assert.equal(contexts.length,1);
});

test('all rest tracks are louder at equal slider levels, stay below clipping at full volume and pause or stop normally',async t=>{
  const {window,contexts}=audio(t),ui=window.WorkHubRestAudio.install({ready:()=>true});await ui.start();ui.change('volume',100);const context=contexts[0];
  for(const track of Object.keys(window.WorkHubRestAudio.TRACKS)){
    ui.change('track',track);const music=context.nodes.findLast(n=>n.source&&n.buffer?.numberOfChannels===2&&!n.stopped),gain=music.next,master=gain.next;
    assert.ok(gain.gain.value>1.6*1.7,'rest music is at least 70% louder at equal volume');
    let peak=0;for(const channel of [0,1])for(const sample of music.buffer.getChannelData(channel))peak=Math.max(peak,Math.abs(sample)*gain.gain.value*master.gain.value);
    assert.ok(peak>0.1&&peak<0.85,'full-volume output has headroom');
    ui.change('volume',0);assert.equal(master.gain.value,0);ui.change('volume',100);ui.pause(true);assert.equal(gain.gain.value,0);ui.pause(false);assert.ok(gain.gain.value>0);
  }
  ui.finish();const alarm=context.nodes.findLast(n=>n.source&&!n.stopped);assert.equal(alarm.loop,true);assert.equal(alarm.next.next,context.destination);ui.stop();assert.equal(alarm.stopped,true);assert.equal(context.state,'closed');
});
