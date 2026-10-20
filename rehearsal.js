/** Animated personal rehearsal UI. Playback is temporary; edits use the existing private document save path. */
(function rehearsalUI(root) {
  'use strict';
  const E=root.WorkHubRehearsalEngine, esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const ICONS={task:'✓',document:'▤',decision:'◇',approval:'✦',result:'⚑'};
  function install(a) {
    let owner='',processId='',scenarioId='',selected='',editing=false,zoom=1,wasVisible=false,paused=false,raf=0,last=0,elapsed=0,index=0,loops=0,route=null,lastModel='',paintKey='',overrides={},drag=null,suppressClick=0;
    let audio=null,audioReady=false,notes=[],demo=null,editorSnapshot=null;
    const $=id=>document.getElementById(id), prefs=()=>a.state().workhub.rehearsal.preferences;
    const guard=expected=>{if(!a.ready()||!a.owner()||(expected&&expected!==a.owner()))throw Error('Sign in and reopen your rehearsal.');};
    const now=()=>new Date().toISOString(), uid=()=>root.crypto.randomUUID();
    const button=(action,label,attributes='',cls='small')=>`<button type="button" class="${cls}" data-rehearsal="${action}" ${attributes}>${label}</button>`;
    function clearAudio() {for(const n of notes){try{n.stop();}catch{}}notes=[];try{audio?.suspend()?.catch(()=>{});}catch{}}
    function resetOwner() {
      if(owner===a.owner())return;
      owner=a.owner();processId='';scenarioId='';selected='';editing=false;overrides={};lastModel='';route=null;elapsed=0;index=0;loops=0;paused=false;
      clearAudio();try{audio?.close()?.catch(()=>{});}catch{}audio=null;audioReady=false;editorSnapshot=null;drag=null;
      demo=E.seed('__demo__',now());
    }
    function model() {
      resetOwner();const rows=a.state().workhub.rehearsal.processes;
      let p=processId==='__demo__'?demo:rows.find(p=>p.id===processId);
      if(!p){p=rows[0]||demo;processId=p.id;scenarioId=p.scenarios[0].id;}
      if(!p.scenarios.some(s=>s.id===scenarioId))scenarioId=p.scenarios[0].id;
      return p;
    }
    function scenario(p=model()){return p.scenarios.find(s=>s.id===scenarioId)||p.scenarios[0];}
    function rebuild(keep=false) {
      const p=model();try{route=E.plan(p,scenario(p),overrides);}catch(err){route={entries:[],ending:'invalid',error:err.message};paused=true;}
      if(!keep){index=0;elapsed=0;}else index=Math.min(index,Math.max(0,route.entries.length-1));
      paintKey='';
    }
    function motionOff(){return a.prefs?.().motion==='off'||root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;}
    function blocked(){return document.hidden||motionOff()||editing||!!document.querySelector('dialog[open]')||document.body.matches('.hub-private,.hub-present,.hub-focus');}
    function stopFrame(){if(raf)root.cancelAnimationFrame(raf);raf=0;last=0;clearAudio();}
    function soundLabel(){return !prefs().sound?'Sound off':audioReady?'Sound on':'Sound on · tap to enable';}
    async function unlock() {
      if(!a.ready()||!$('rehearsalRoot')||!prefs().sound||motionOff()||document.hidden)return;
      const identity=a.owner();try{
        const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)return;
        if(!audio)audio=new Audio();await audio.resume();
        if(a.owner()!==identity){try{await audio.close();}catch{}audio=null;return;}
        audioReady=audio.state==='running';const label=$('rehearsalSound');if(label)label.textContent=soundLabel();
      }catch{audioReady=false;}
    }
    function tone(entry) {
      if(!audioReady||!audio||audio.state!=='running'||!prefs().sound||blocked()||prefs().volume===0)return;
      const identity=owner,frequencies=entry.outcome==='failure'?[174,146]:entry.type==='approval'?[523,659,784]:entry.type==='document'?[330,440]:[392,523];
      for(let i=0;i<frequencies.length;i++){
        const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime+i*0.065;
        osc.type=entry.outcome==='failure'?'triangle':'sine';osc.frequency.setValueAtTime(frequencies[i],t);
        gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(prefs().volume*0.065,t+0.018);gain.gain.exponentialRampToValueAtTime(0.0001,t+0.24);
        osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+0.26);notes.push(osc);
        osc.onended=()=>{osc.disconnect();gain.disconnect();notes=notes.filter(n=>n!==osc);if(identity!==owner)clearAudio();};
      }
    }
    function positions(){return new Map(model().steps.map(s=>[s.id,drag?.id===s.id?{...s,x:drag.x,y:drag.y}:s]));}
    function edges(p) {
      const map=new Map(p.steps.map(s=>[s.id,s]));
      return p.steps.flatMap(s=>[['success',s.next],['failure',s.failNext]].filter(([,id])=>id&&map.has(id)).map(([kind,id])=>
        `<path class="rehearsal-edge" data-from="${esc(s.id)}" data-to="${esc(id)}" data-kind="${kind}" d="${E.path(s,map.get(id))}" marker-end="url(#rehearsalArrow)"></path>`)).join('');
    }
    function graph(p) {
      const width=Math.max(850,...p.steps.map(s=>s.x+270)),height=Math.max(440,...p.steps.map(s=>s.y+180));
      return `<div id="rehearsalViewport" class="rehearsal-viewport" tabindex="0" aria-label="Process canvas. Scroll to explore."><div class="rehearsal-extent" style="width:${width*zoom}px;height:${height*zoom}px"><div id="rehearsalBoard" class="rehearsal-board" style="width:${width}px;height:${height}px;transform:scale(${zoom})"><svg class="rehearsal-wires" width="${width}" height="${height}" aria-hidden="true"><defs><marker id="rehearsalArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z"></path></marker></defs>${edges(p)}</svg>${p.steps.map(s=>`<article class="rehearsal-node" data-node="${esc(s.id)}" data-type="${s.type}" style="left:${s.x}px;top:${s.y}px">${p.id!=='__demo__'?`<button type="button" class="rehearsal-drag" data-rehearsal-drag="${esc(s.id)}" aria-label="Move ${esc(s.title)}. Drag or use arrow keys.">⠿</button>`:''}<button type="button" class="rehearsal-node-main" data-rehearsal="inspect" data-id="${esc(s.id)}"><span class="rehearsal-node-icon">${ICONS[s.type]}</span><span><small>${esc(s.type)}${s.tcode?' · '+esc(s.tcode):''}</small><strong>${esc(s.title)}</strong></span></button><span class="rehearsal-node-state" aria-hidden="true"></span><div class="rehearsal-particles" aria-hidden="true">${Array.from({length:6},(_,i)=>`<i style="--particle:${i}"></i>`).join('')}</div></article>`).join('')}<div id="rehearsalToken" class="rehearsal-token" aria-hidden="true"><span>▤</span></div><div class="rehearsal-scene-specks" aria-hidden="true"></div></div></div></div>`;
    }
    function render() {
      const oldForm=$('rehearsalStepForm');
      if(editing&&oldForm&&oldForm.dataset.owner===a.owner()){const clone=oldForm.cloneNode(true);for(const field of oldForm.elements){const target=clone.elements.namedItem(field.name);if(target&&'value' in target)target.value=field.value;}editorSnapshot=clone;}
      const p=model();if(!route)rebuild();
      return `<section id="rehearsalRoot" class="rehearsal-workspace" data-owner="${esc(owner)}" data-theme="${prefs().theme}" data-effects="${prefs().effects}"><header class="rehearsal-hero"><div><span class="hub-kicker">YOUR PERSONAL PROCESS THEATRE</span><h2>Process Rehearsal</h2><p>Build the flow. Watch it happen. Explore a different outcome.</p></div><div class="actions">${button('new','＋ New process','','primary')}${p.id==='__demo__'?button('keep','Save this example'):button('duplicate','Duplicate')}${p.id!=='__demo__'?button('settings','Process settings'):''}</div></header><div class="rehearsal-selection"><label>Process<select id="rehearsalProcess">${a.state().workhub.rehearsal.processes.map(x=>`<option value="${esc(x.id)}"${x.id===p.id?' selected':''}>${esc(x.name)}</option>`).join('')}<option value="__demo__"${p.id==='__demo__'?' selected':''}>Sample · Procure to pay</option></select></label><label>Scenario<select id="rehearsalScenario">${p.scenarios.map(s=>`<option value="${esc(s.id)}"${s.id===scenarioId?' selected':''}>${esc(s.name)}</option>`).join('')}</select></label>${p.id!=='__demo__'?button('scenario','Edit scenario')+button('scenario-add','＋ Scenario'):''}<span class="rehearsal-local-label">Sample playback · no SAP posting</span></div><div class="rehearsal-layout"><div class="rehearsal-stage"><div class="rehearsal-stage-bar"><div><strong>${esc(p.name)}</strong><span id="rehearsalStatus" aria-live="polite"></span></div><div class="actions">${p.id!=='__demo__'?button('add-step','＋ Step')+button('layout','Auto arrange'):''}${button('zoom-out','−','aria-label="Zoom out"')}${button('zoom-in','＋','aria-label="Zoom in"')}</div></div>${graph(p)}<div class="rehearsal-values"><div class="rehearsal-values-title"><strong>Sample values</strong><span>Changes follow your definitions</span></div><div id="rehearsalValues"></div></div><div class="rehearsal-playbar">${button('back','↶','aria-label="Previous step / rewind"')}${button('play','Pause','id="rehearsalPlay"','primary small')}${button('next','↷','aria-label="Next step"')}${button('restart','Restart')}<label>Speed<select id="rehearsalSpeed">${[0.5,1,1.5,2].map(v=>`<option value="${v}"${v===prefs().speed?' selected':''}>${v}×</option>`).join('')}</select></label>${button('sound',soundLabel(),'id="rehearsalSound" aria-label="Toggle rehearsal sound"')}<label>Volume<input id="rehearsalVolume" aria-label="Rehearsal volume" type="range" min="0" max="1" step="0.05" value="${prefs().volume}"></label></div></div><aside id="rehearsalInspector" class="rehearsal-inspector"></aside></div><div class="rehearsal-options"><label>Scenery<select id="rehearsalTheme">${[['desk','Cosy desk'],['blueprint','Blueprint'],['control','Control room']].map(([v,l])=>`<option value="${v}"${prefs().theme===v?' selected':''}>${l}</option>`).join('')}</select></label><label>Effects<select id="rehearsalEffects">${['quiet','balanced','expressive'].map(v=>`<option${prefs().effects===v?' selected':''}>${v}</option>`).join('')}</select></label><label class="check-label"><input id="rehearsalExplore" type="checkbox"${prefs().explore?' checked':''}>Explore scenarios automatically</label><span>Playback loops. Editing pauses the scene.</span></div><section class="rehearsal-journal"><div><h3>Rehearsal journal</h3><span id="rehearsalJournalHeading">Current route</span></div><ol id="rehearsalJournal" aria-live="off"></ol></section></section>`;
    }
    function detailHTML(step) {
      if(!step)return '<p>Select a step to inspect it.</p>';
      return `<span class="hub-kicker">STEP DETAILS</span><div class="rehearsal-detail-title"><span>${ICONS[step.type]}</span><h3>${esc(step.title)}</h3></div>${step.tcode?`<span class="rehearsal-tcode">${esc(step.tcode)}</span>`:''}<dl><dt>Who handles it</dt><dd>${esc(step.owner)||'Not specified'}</dd>${step.prerequisites?`<dt>Before you start</dt><dd>${esc(step.prerequisites)}</dd>`:''}<dt>Instructions</dt><dd>${esc(step.instruction)||'Add instructions for this step.'}</dd><dt>Expected result</dt><dd>${esc(step.expected)||'Not specified'}</dd>${step.failure?`<dt>If it fails</dt><dd>${esc(step.failure)}</dd>`:''}</dl>${step.image?`<a class="rehearsal-image-link" href="${esc(step.image)}" target="_blank" rel="noopener"><img src="${esc(step.image)}" alt="Reference screenshot for ${esc(step.title)}"></a>`:''}${step.link?`<a href="${esc(step.link)}" target="_blank" rel="noopener noreferrer">Open reference ↗</a>`:''}<div class="rehearsal-branches"><strong>Choose an outcome</strong>${button('success','Follow success',`data-id="${esc(step.id)}"`)}${button('failure','What if this fails?',`data-id="${esc(step.id)}"`)}</div>${model().id!=='__demo__'?button('edit-step','Edit this step',`data-id="${esc(step.id)}"`,'primary small'):'<p class="hub-meta">Save this example to edit it.</p>'}`;
    }
    function inspect(id) {
      const p=model();selected=id;paused=true;elapsed=0;const at=route.entries.findIndex(e=>e.id===id);if(at>=0)index=at;
      if(!editing)$('rehearsalInspector').innerHTML=detailHTML(p.steps.find(s=>s.id===id));paintKey='';paint();
    }
    function camera(step) {
      const view=$('rehearsalViewport');if(!view||motionOff()||prefs().effects==='quiet'||typeof view.scrollTo!=='function')return;
      view.scrollTo({left:Math.max(0,step.x*zoom-view.clientWidth/2+105*zoom),top:Math.max(0,step.y*zoom-view.clientHeight/2+50*zoom),behavior:'smooth'});
    }
    function paint() {
      const rootEl=$('rehearsalRoot');if(!rootEl||!route)return;
      const p=model(),entry=route.entries[index],display=entry||route.entries.at(-1),duration=entry?entry.duration*1000:3200,phase=entry?Math.min(1,elapsed/duration):1,key=index+'|'+(entry?phase>=0.55:'end');
      rootEl.dataset.playing=String(!paused&&!blocked());rootEl.dataset.reduced=String(motionOff());
      const play=$('rehearsalPlay');if(play)play.textContent=paused||motionOff()?'Play':'Pause';
      if(key!==paintKey) {
        const moved=paintKey.split('|')[0]!==String(index);paintKey=key;
        for(const el of rootEl.querySelectorAll('[data-node]')){
          const id=el.dataset.node,seen=route.entries.slice(0,index).some(e=>e.id===id),active=entry?.id===id;
          el.dataset.state=active?(entry.outcome==='failure'?'failed':'active'):seen?'done':'waiting';
          el.querySelector('.rehearsal-node-state').textContent=active&&phase>=0.55?(entry.outcome==='failure'?'EXCEPTION':el.dataset.type==='approval'?'APPROVED':'✓'):'';
        }
        for(const edge of rootEl.querySelectorAll('.rehearsal-edge'))edge.dataset.active=String(!!entry&&edge.dataset.from===entry.id&&edge.dataset.to===entry.nextId&&edge.dataset.kind===entry.outcome);
        const values=display?(entry&&phase<0.55?display.before:display.values):scenario(p).initial;
        $('rehearsalValues').innerHTML=Object.entries(values).map(([k,v])=>`<div class="${phase>=0.55&&display?.changes.some(c=>c.field===k)?'is-changing':''}"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')||'<p>Add sample fields in your scenario.</p>';
        $('rehearsalStatus').textContent=motionOff()?'Reduced motion · use Next to step through':route.error||(!entry?`${route.ending==='loop-guard'?'Defined loop limit reached':route.ending==='failed'?'Exception route ended':'Route complete'} · restarting…`:`${index+1}/${route.entries.length} · ${entry.outcome==='failure'?'Exception':'Running'} · ${scenario(p).name}`);
        const reached=route.entries.slice(0,Math.min(index+1,route.entries.length));
        $('rehearsalJournal').innerHTML=reached.map((e,i)=>`<li data-outcome="${e.outcome}"${i===index?' aria-current="step"':''}>${button('journal',`<span>${i+1}</span><strong>${esc(e.title)}</strong><small>${e.outcome==='failure'?'Exception':e.nextId?'Handoff':'Result'}</small>`,`data-index="${i}"`)}</li>`).join('');
        $('rehearsalJournalHeading').textContent=scenario(p).name+' · loop '+(loops+1);
        if(!editing&&display){const detailId=paused&&selected?selected:display.id;selected=detailId;$('rehearsalInspector').innerHTML=detailHTML(p.steps.find(s=>s.id===detailId));}
        if(moved&&entry){const step=p.steps.find(s=>s.id===entry.id);if(step&&!paused&&!blocked())camera(step);if(!paused)tone(entry);}
      }
      const token=$('rehearsalToken'),from=entry&&p.steps.find(s=>s.id===entry.id),to=entry&&p.steps.find(s=>s.id===entry.nextId);
      if(token){token.hidden=!entry||!from||!to||phase<0.5||motionOff();if(!token.hidden){const point=E.point(from,to,Math.min(1,(phase-0.5)*2));token.style.left=point.x+'px';token.style.top=point.y+'px';token.dataset.type=entry.type;token.dataset.outcome=entry.outcome;}}
    }
    function tick(t) {
      raf=0;if(!$('rehearsalRoot')||!a.ready()||owner!==a.owner()){stopFrame();return;}
      if(!last)last=t;const dt=Math.min(150,Math.max(0,t-last));last=t;
      if(!paused&&!blocked()&&route?.entries.length) {
        elapsed+=dt*prefs().speed;const entry=route.entries[index],duration=entry?entry.duration*1000:3200;
        if(elapsed>=duration){elapsed=0;index++;if(index>route.entries.length){loops++;if(prefs().explore){const p=model(),n=p.scenarios.findIndex(s=>s.id===scenarioId);scenarioId=p.scenarios[(n+1)%p.scenarios.length].id;overrides={};}rebuild();}}
      }
      paint();raf=root.requestAnimationFrame(tick);
    }
    function mount() {
      const field=document.querySelector('#rehearsalStepForm,#rehearsalProcessForm,#rehearsalScenarioForm,#rehearsalNewForm');
      if(field&&(!a.ready()||field.dataset.owner!==a.owner())){a.closeModal();editing=false;}
      resetOwner();const el=$('rehearsalRoot');
      if(!el||!a.ready()){wasVisible=false;stopFrame();return;}
      if(el.dataset.owner!==a.owner()){stopFrame();return;}
      const p=model(),key=owner+'|'+p.id+'|'+p.updatedAt+'|'+scenarioId;
      if(!wasVisible){paused=false;elapsed=0;index=0;}
      if(key!==lastModel||!wasVisible){lastModel=key;rebuild();}
      wasVisible=true;if(editing&&editorSnapshot&&editorSnapshot.dataset.owner===owner){$('rehearsalInspector').replaceChildren(editorSnapshot);editorSnapshot=null;}paintKey='';paint();if(!raf)raf=root.requestAnimationFrame(tick);
    }
    function saved(p){return p.id!=='__demo__';}
    function saveMutation(fn) {guard(owner);return a.mutate(d=>{const p=d.workhub.rehearsal.processes.find(p=>p.id===processId);if(!p)throw Error('Save the example before editing.');fn(p,d);p.updatedAt=now();});}
    function saveCopy(blank=false,name='') {
      guard(owner);const p=blank?E.seed(uid(),now(),true):E.copy(model());p.id=uid();p.name=name||(p.name+' · copy');p.createdAt=now();p.updatedAt=now();
      processId=p.id;scenarioId=p.scenarios[0].id;overrides={};route=null;lastModel='';paused=false;
      const ok=a.mutate(d=>d.workhub.rehearsal.processes.push(p));if(ok){a.closeModal();a.tell('Process saved.');}return ok;
    }
    function processEditor() {
      const p=model();guard(owner);if(!saved(p))throw Error('Save the example first.');
      a.openModal('Process settings',`<form id="rehearsalProcessForm" data-owner="${esc(owner)}" data-process="${esc(p.id)}" data-updated="${esc(p.updatedAt)}"><label>Process name<input name="name" required maxlength="300" value="${esc(p.name)}"></label><label>Notes<textarea name="notes" maxlength="32767">${esc(p.notes)}</textarea></label><label>Starting step<select name="startId">${p.steps.map(s=>`<option value="${esc(s.id)}"${s.id===p.startId?' selected':''}>${esc(s.title)}</option>`).join('')}</select></label><div class="modal-actions">${button('delete-process','Delete process','','danger small')}<button class="primary" type="submit">Save process</button></div></form>`);
    }
    function scenarioEditor(id=scenarioId) {
      const p=model(),s=p.scenarios.find(s=>s.id===id);guard(owner);if(!saved(p)||!s)throw Error('Save the example first.');
      a.openModal('Scenario settings',`<form id="rehearsalScenarioForm" data-owner="${esc(owner)}" data-process="${esc(p.id)}" data-id="${esc(s.id)}" data-updated="${esc(p.updatedAt)}"><label>Scenario name<input name="name" required maxlength="200" value="${esc(s.name)}"></label><label>Notes<textarea name="notes" maxlength="32767">${esc(s.notes)}</textarea></label><label>Initial sample values<textarea name="initial" rows="7">${esc(Object.entries(s.initial).map(([k,v])=>k+' = '+v).join('\n'))}</textarea></label><p class="hub-meta">One field = value per line. Numbers remain numeric; other values are text.</p><fieldset><legend>Automatic outcome at each step</legend>${p.steps.map(step=>`<label>${esc(step.title)}<select name="outcome-${esc(step.id)}"><option value="success">Success / normal path</option><option value="failure"${s.choices[step.id]==='failure'?' selected':''}>Failure / exception path</option></select></label>`).join('')}</fieldset><div class="modal-actions">${p.scenarios.length>1?button('scenario-delete','Delete scenario','','danger small'):''}<button class="primary" type="submit">Save scenario</button></div></form>`);
    }
    function checkForm(form) {
      guard(form.dataset.owner);const p=a.state().workhub.rehearsal.processes.find(p=>p.id===form.dataset.process);
      if(!p||p.id!==processId||p.updatedAt!==form.dataset.updated)throw Error('This process changed. Reopen the editor before saving.');
      return p;
    }
    function stepEditor(id) {
      const p=model(),step=p.steps.find(s=>s.id===id);guard(owner);if(!saved(p)||!step)throw Error('Step no longer exists.');
      paused=true;editing=true;selected=id;
      const field=(k,label,type='text',max=32767)=>`<label>${label}${type==='textarea'?`<textarea name="${k}" maxlength="${max}">${esc(step[k])}</textarea>`:`<input name="${k}" maxlength="${max}" value="${esc(step[k])}"${k==='title'?' required':''}${k==='tcode'?' list="rehearsalTcodes"':''}>`}</label>`;
      $('rehearsalInspector').innerHTML=`<form id="rehearsalStepForm" data-owner="${esc(owner)}" data-process="${esc(p.id)}" data-id="${esc(id)}" data-updated="${esc(p.updatedAt)}"><span class="hub-kicker">EDIT STEP · PLAYBACK PAUSED</span>${field('title','Step title','text',300)}<label>Step type<select name="type">${E.TYPES.map(t=>`<option${t===step.type?' selected':''}>${t}</option>`).join('')}</select></label>${field('tcode','SAP T-code','text',40)}<datalist id="rehearsalTcodes">${a.state().workhub.tcodes.records.filter(r=>!r.archived).map(r=>`<option value="${esc(r.code)}">${esc(r.title)}</option>`).join('')}</datalist>${field('owner','Who handles it','text',200)}${field('prerequisites','Before you start','textarea')}${field('instruction','Instructions','textarea')}${field('expected','Expected result','textarea')}${field('failure','If it fails','textarea')}<label>Normal next step<select name="next"><option value="">End route</option>${p.steps.map(s=>`<option value="${esc(s.id)}"${s.id===step.next?' selected':''}>${esc(s.title)}</option>`).join('')}</select></label><label>Failure / exception next step<select name="failNext"><option value="">Stop at the exception</option>${p.steps.map(s=>`<option value="${esc(s.id)}"${s.id===step.failNext?' selected':''}>${esc(s.title)}</option>`).join('')}</select></label><label>Sample value changes<textarea name="changes" placeholder="Received quantity += @Delivery quantity">${esc(step.changes.map(c=>c.field+(c.operator==='add'?' += ':' = ')+c.value).join('\n'))}</textarea></label><p class="hub-meta">Use = to set a value; += to add a number. @Field reads another sample field. No code is executed.</p><label>Seconds on this step (0 = automatic)<input name="duration" type="number" min="0" max="30" step="0.5" value="${step.duration}"></label>${field('link','Reference URL','text',2000)}<label>Reference screenshot<input id="rehearsalImageInput" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="hub-meta">Optimized screenshot saved with the process. Up to 2 MB of screenshots across your rehearsals.</p><input name="image" type="hidden" value="${esc(step.image)}"><div id="rehearsalImagePreview">${step.image?`<img src="${esc(step.image)}" alt="Step screenshot">`:''}</div>${button('remove-image','Remove screenshot')}<div class="actions"><button type="submit" class="primary">Save step</button>${button('cancel-edit','Cancel')}</div>${p.steps.length>1?button('delete-step','Delete step',`data-id="${esc(id)}"`,'danger small'):''}</form>`;
      $('rehearsalInspector').querySelector('[name="title"]').focus();clearAudio();
    }
    function saveForm(form) {
      const value=k=>form.elements.namedItem(k).value;
      if(form.id==='rehearsalNewForm'){guard(form.dataset.owner);saveCopy(value('template')==='blank',value('name').trim());return;}
      const p=checkForm(form);
      if(form.id==='rehearsalProcessForm') {
        const name=value('name').trim();if(!name)throw Error('Enter the process name.');
        saveMutation(row=>{row.name=name;row.notes=value('notes');row.startId=value('startId');});a.closeModal();
      } else if(form.id==='rehearsalScenarioForm') {
        const name=value('name').trim(),initial=E.values(value('initial')),choices={};if(!name)throw Error('Enter a scenario name.');
        for(const step of p.steps)if(value('outcome-'+step.id)==='failure')choices[step.id]='failure';
        const changed={id:form.dataset.id,name,notes:value('notes'),initial,choices};
        saveMutation(row=>{const i=row.scenarios.findIndex(s=>s.id===changed.id);if(i<0)throw Error('Scenario no longer exists.');row.scenarios[i]=changed;});a.closeModal();overrides={};rebuild();paint();
      } else {
        const id=form.dataset.id,old=p.steps.find(s=>s.id===id);if(!old)throw Error('Step no longer exists.');
        const step={...old,title:value('title').trim(),type:value('type'),tcode:value('tcode').trim().toUpperCase(),owner:value('owner').trim(),prerequisites:value('prerequisites'),instruction:value('instruction'),expected:value('expected'),failure:value('failure'),next:value('next'),failNext:value('failNext'),changes:E.changes(value('changes')),duration:Number(value('duration')),link:value('link').trim(),image:value('image')};
        editing=false;paused=false;
        try{saveMutation(row=>{row.steps[row.steps.findIndex(s=>s.id===id)]=step;});}catch(err){editing=true;paused=true;throw err;}
      }
      a.tell('Rehearsal saved.');
    }
    async function upload(file,form) {
      guard(form.dataset.owner);if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Choose a PNG, JPEG or WebP screenshot up to 5 MB.');
      const identity=a.owner(),input=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Screenshot could not be read.'));r.readAsDataURL(file);});
      const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Screenshot could not be opened.'));i.src=input;});
      if(!form.isConnected||a.owner()!==identity||form.dataset.owner!==identity)return;
      const canvas=document.createElement('canvas'),scale=Math.min(1,1000/Math.max(image.width,image.height));canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('This browser could not optimize the screenshot.');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      let encoded=canvas.toDataURL('image/jpeg',0.75);if(encoded.length>180000)encoded=canvas.toDataURL('image/jpeg',0.5);
      if(encoded.length>180000)throw Error('Crop or reduce the screenshot before uploading.');
      if(!form.isConnected||a.owner()!==identity)return;form.elements.namedItem('image').value=encoded;$('rehearsalImagePreview').innerHTML=`<img src="${encoded}" alt="Step screenshot">`;
    }
    function setPreference(key,value) {guard(owner);a.mutate(d=>{d.workhub.rehearsal.preferences[key]=value;});if(key==='sound'&&!value)clearAudio();}
    function moveStep(id,x,y) {paused=true;saveMutation(p=>{const s=p.steps.find(s=>s.id===id);if(!s)throw Error('Step no longer exists.');s.x=Math.max(0,Math.min(4000,x));s.y=Math.max(0,Math.min(4000,y));});}
    async function handle(el) {
      guard(owner);const identity=owner,action=el.dataset.rehearsal,id=el.dataset.id,p=model();await unlock();guard(identity);
      if(action==='new'){a.openModal('New personal process',`<form id="rehearsalNewForm" data-owner="${esc(owner)}"><label>Process name<input name="name" required maxlength="300" value="My process"></label><label>Start with<select name="template"><option value="example">Procure-to-pay example</option><option value="blank">Blank process</option></select></label><button type="submit" class="primary">Create process</button></form>`);return;}
      if(action==='keep'||action==='duplicate'){saveCopy(false,action==='keep'?'My procure-to-pay rehearsal':'');return;}
      if(action==='settings'){processEditor();return;}
      if(action==='scenario'){scenarioEditor();return;}
      if(action==='scenario-add'){const s=E.copy(scenario(p));s.id=uid();s.name+=' · variation';saveMutation(row=>row.scenarios.push(s));scenarioId=s.id;scenarioEditor(s.id);return;}
      if(action==='scenario-delete'){if(p.scenarios.length>1&&root.confirm('Delete this scenario?')){const old=scenarioId;scenarioId=p.scenarios.find(s=>s.id!==old).id;saveMutation(row=>{row.scenarios=row.scenarios.filter(s=>s.id!==old);});a.closeModal();}return;}
      if(action==='delete-process'){if(root.confirm('Delete this saved rehearsal and its screenshots?')){const old=p.id;processId='';route=null;editing=false;paused=false;a.mutate(d=>{d.workhub.rehearsal.processes=d.workhub.rehearsal.processes.filter(p=>p.id!==old);});a.closeModal();}return;}
      if(action==='add-step'){const s={...E.seed('temporary',now(),true).steps[0],id:uid(),title:'New step',next:'',x:60,y:Math.min(4000,80+p.steps.length*100)};saveMutation(row=>row.steps.push(s));stepEditor(s.id);return;}
      if(action==='layout'){saveMutation(row=>E.layout(row));return;}
      if(action==='edit-step'){stepEditor(id);return;}
      if(action==='delete-step'){
        if(p.steps.length>1&&root.confirm('Delete this step and remove its connections?')){
          editing=false;saveMutation(row=>{row.steps=row.steps.filter(s=>s.id!==id);if(row.startId===id)row.startId=row.steps[0].id;for(const s of row.steps){if(s.next===id)s.next='';if(s.failNext===id)s.failNext='';}for(const s of row.scenarios)delete s.choices[id];});
        }return;
      }
      if(action==='remove-image'){$('rehearsalStepForm').elements.namedItem('image').value='';$('rehearsalImagePreview').innerHTML='';return;}
      if(action==='cancel-edit'){editing=false;paused=true;$('rehearsalInspector').innerHTML=detailHTML(p.steps.find(s=>s.id===selected));return;}
      if(action==='inspect'){if(Date.now()<suppressClick)return;inspect(id);return;}
      if(action==='success'||action==='failure'){if(!route.entries.some(entry=>entry.id===id)){a.tell('This step is outside the current route. Choose a scenario that reaches it.');return;}overrides[id]=action;const at=index;rebuild();index=Math.min(at,route.entries.length-1);paused=false;paintKey='';paint();return;}
      if(action==='journal'){selected='';index=Math.max(0,Math.min(route.entries.length-1,Number(el.dataset.index)));elapsed=0;paused=true;editing=false;paintKey='';paint();return;}
      if(action==='play'){if(editing){a.tell('Save or cancel the step editor first.');return;}paused=!paused;selected='';paintKey='';paint();return;}
      if(action==='restart'){selected='';overrides={};rebuild();paused=false;editing=false;paint();return;}
      if(action==='back'||action==='next'){if(editing){a.tell('Save or cancel the step editor first.');return;}selected='';index=Math.max(0,Math.min(route.entries.length-1,index+(action==='back'?-1:1)));elapsed=0;paused=true;paintKey='';paint();return;}
      if(action==='sound'){setPreference('sound',!prefs().sound);if(prefs().sound)await unlock();return;}
      if(action==='zoom-in'||action==='zoom-out'){zoom=Math.max(0.5,Math.min(1.5,zoom+(action==='zoom-in'?0.1:-0.1)));a.render();}
    }
    document.addEventListener('click',event=>{
      const el=event.target.closest?.('[data-rehearsal]');if(!el)return;event.preventDefault();void handle(el).catch(err=>a.tell(err.message,true));
    });
    document.addEventListener('pointerdown',event=>{
      if($('rehearsalRoot'))void unlock();
      const handle=event.target.closest?.('[data-rehearsal-drag]');if(!handle||event.button>0)return;
      try{guard(owner);const s=model().steps.find(s=>s.id===handle.dataset.rehearsalDrag);if(!s)return;paused=true;event.preventDefault();drag={id:s.id,x:s.x,y:s.y,baseX:s.x,baseY:s.y,startX:event.clientX,startY:event.clientY,owner,process:model().id,moved:false};handle.setPointerCapture?.(event.pointerId);}catch(err){a.tell(err.message,true);}
    });
    document.addEventListener('pointermove',event=>{
      if(!drag)return;const dx=(event.clientX-drag.startX)/zoom,dy=(event.clientY-drag.startY)/zoom;drag.x=Math.max(0,Math.min(4000,drag.baseX+dx));drag.y=Math.max(0,Math.min(4000,drag.baseY+dy));drag.moved=drag.moved||Math.abs(dx)+Math.abs(dy)>4;
      const node=[...document.querySelectorAll('[data-node]')].find(n=>n.dataset.node===drag.id);if(node){node.style.left=drag.x+'px';node.style.top=drag.y+'px';}const map=positions();for(const edge of document.querySelectorAll('.rehearsal-edge')){const a=map.get(edge.dataset.from),b=map.get(edge.dataset.to);if(a&&b)edge.setAttribute('d',E.path(a,b));}
    });
    document.addEventListener('pointerup',()=>{const d=drag;drag=null;if(!d)return;if(d.moved){suppressClick=Date.now()+400;if(d.owner===a.owner()&&d.process===model().id)try{moveStep(d.id,d.x,d.y);}catch(err){a.tell(err.message,true);}}});
    document.addEventListener('pointercancel',()=>{if(!drag)return;drag=null;a.render();});
    document.addEventListener('keydown',event=>{
      const el=event.target.closest?.('[data-rehearsal-drag]');if(!el||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();try{const s=model().steps.find(s=>s.id===el.dataset.rehearsalDrag),n=event.shiftKey?30:10;if(s){moveStep(s.id,s.x+(event.key==='ArrowLeft'?-n:event.key==='ArrowRight'?n:0),s.y+(event.key==='ArrowUp'?-n:event.key==='ArrowDown'?n:0));[...document.querySelectorAll('[data-rehearsal-drag]')].find(node=>node.dataset.rehearsalDrag===s.id)?.focus();}}catch(err){a.tell(err.message,true);}
    },true);
    document.addEventListener('submit',event=>{if(!['rehearsalStepForm','rehearsalProcessForm','rehearsalScenarioForm','rehearsalNewForm'].includes(event.target.id))return;event.preventDefault();try{saveForm(event.target);}catch(err){a.tell(err.message,true);}});
    document.addEventListener('change',event=>{
      const el=event.target,id=el.id;
      try {
        if(id==='rehearsalImageInput'){void upload(el.files?.[0],el.closest('form')).catch(err=>a.tell(err.message,true));return;}
        if(id==='rehearsalProcess'){processId=el.value;scenarioId='';lastModel='';overrides={};route=null;editing=false;paused=false;
          if(processId==='__demo__'){demo=E.seed('__demo__',now());}a.render();return;}
        if(id==='rehearsalScenario'){scenarioId=el.value;lastModel='';overrides={};rebuild();paused=false;a.render();return;}
        const fields={rehearsalSpeed:'speed',rehearsalVolume:'volume',rehearsalTheme:'theme',rehearsalEffects:'effects',rehearsalExplore:'explore'},key=fields[id];if(key)setPreference(key,el.type==='checkbox'?el.checked:['speed','volume'].includes(key)?Number(el.value):el.value);
      }catch(err){a.tell(err.message,true);}
    });
    document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden)clearAudio();});
    return {render,mount,saveForm,stepEditor,scenarioEditor,model,plan:()=>route,snapshot:()=>({index,elapsed,paused,editing,scenarioId,processId,loops,sound:audioReady}),tick,stop:stopFrame};
  }
  root.WorkHubRehearsal={install};
})(window);
