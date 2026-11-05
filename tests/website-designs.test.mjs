import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const ids = ['home','tickets','tasks','schedule','specs','notes','knowledge','processhub','files','handover','waiting','studio','lab','validator','snippets'];
function fixture(t) {
  const dom = new JSDOM('<body><header><div id="hubSettingsAppearance"></div></header><div id="hubShell"><aside id="hubSidebar"><nav id="tabs">'+ids.map(id=>'<button data-tab="'+id+'"'+(id==='files'?' class="active"':'')+'><span class="hub-nav-label">'+id+'</span></button>').join('')+'</nav></aside><main class="page"><div id="hubToolbar"></div><div id="view"><textarea id="editor">Unfinished exact 001 / 6.00007</textarea></div></main></div></body>', {runScripts:'outside-only',url:'https://example.test'});
  const w=dom.window,d=w.document;t.after(()=>w.close());
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  let mobile=false,onMedia;w.matchMedia=()=>({get matches(){return mobile;},addEventListener(_,fn){onMedia=fn;}});
  w.eval(read('website-designs.js'));
  let state={workhub:{preferences:{theme:'forest'}},records:[{id:'001',value:'6.00007'}]},owner='a',generation=1,ready=true,canEdit=true,fail=false,writes=0;
  const messages=[];let ui;
  ui=w.WorkHubWebsiteDesigns.install({ready:()=>ready,owner:()=>owner,generation:()=>generation,prefs:()=>state.workhub.preferences,canEdit:()=>canEdit,tell:(...x)=>messages.push(x),mutate(fn){if(fail)throw Error('Synthetic save failure');const next=structuredClone(state);fn(next);state=next;writes++;assert.equal(ui.preservingContent(),true);ui.mount();return true;}});
  ui.mount();
  const select=id=>{const el=d.querySelector('[name="websiteDesign"][value="'+id+'"]');el.checked=true;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
  const submit=()=>d.querySelector('#websiteDesignChooser form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  return {w,d,ui,select,submit,messages,state:()=>state,writes:()=>writes,mobile(v){mobile=v;onMedia?.();},switchOwner(){owner='b';generation++;ui.mount();},deny(){canEdit=false;ui.mount();},fail(){fail=true;},saved(id){state.workhub.preferences.design=id;ui.mount();},signOut(){ready=false;ui.mount();}};
}
test('Website designs: legacy preferences use Current without adding a persisted field or changing a record',t=>{
  const x=fixture(t);assert.equal(x.ui.snapshot().design,'current');assert.equal(Object.hasOwn(x.state().workhub.preferences,'design'),false);assert.equal(x.writes(),0);assert.equal(x.d.getElementById('wdWorkspaceBar').hidden,true);assert.equal(x.d.querySelectorAll('#tabs > button').length,15);
});
test('Website designs: preview and cancellation retain exact editor nodes, selection, real navigation controls and records',t=>{
  const x=fixture(t),editor=x.d.getElementById('editor'),nav=[...x.d.querySelectorAll('#tabs button')],before=structuredClone(x.state());editor.value='typed 0001';editor.focus();editor.setSelectionRange(2,4);x.ui.open();
  x.select('clear-desk');assert.equal(x.ui.snapshot().design,'clear-desk');assert.equal(x.d.querySelectorAll('#tabs button').length,15);assert.ok(x.d.getElementById('wdSectionMenu'));assert.ok(nav.every(n=>n.isConnected));x.select('modern-hub');assert.equal(x.d.querySelectorAll('#tabs > button').length,15);x.ui.close();
  assert.equal(x.ui.snapshot().design,'current');assert.equal(x.d.getElementById('editor'),editor);assert.equal(editor.value,'typed 0001');assert.equal(editor.selectionStart,2);assert.equal(x.d.activeElement,editor);assert.deepEqual(x.state(),before);assert.equal(x.writes(),0);assert.deepEqual([...x.d.querySelectorAll('#tabs > button')],nav);
});
test('Website designs: approval saves only the selected account preference and keeps working content mounted',t=>{
  const x=fixture(t),editor=x.d.getElementById('editor'),before=structuredClone(x.state());x.ui.open();x.select('clear-desk');x.submit();assert.equal(x.writes(),1);assert.equal(x.ui.snapshot().saved,'clear-desk');assert.equal(x.ui.snapshot().preview,false);assert.equal(x.d.getElementById('editor'),editor);assert.deepEqual(x.state(),{...before,workhub:{preferences:{...before.workhub.preferences,design:'clear-desk'}}});assert.equal(x.ui.preservingContent(),false);
});
test('Website designs: Escape and a repeated open never queue saves; saving the active choice does not write',t=>{
  const x=fixture(t);x.ui.open();x.ui.open();assert.equal(x.d.querySelectorAll('#websiteDesignChooser').length,1);x.submit();assert.equal(x.writes(),0);x.ui.open();x.select('modern-hub');x.d.getElementById('websiteDesignChooser').dispatchEvent(new x.w.Event('cancel',{cancelable:true}));assert.equal(x.ui.snapshot().design,'current');assert.equal(x.writes(),0);
});
test('Website designs: denied and failed saves leave records untouched, and account changes discard a private preview',t=>{
  const x=fixture(t),before=structuredClone(x.state());x.ui.open();x.select('modern-hub');x.fail();x.submit();assert.match(x.d.getElementById('wdChooserStatus').textContent,/failure/);assert.equal(x.ui.preservingContent(),false);assert.equal(x.writes(),0);assert.deepEqual(x.state(),before);x.deny();x.submit();assert.match(x.messages.at(-1)[0],/does not allow/);x.switchOwner();assert.equal(x.d.getElementById('websiteDesignChooser'),null);assert.equal(x.ui.snapshot().design,'current');assert.equal(x.writes(),0);
});
test('Website designs: changed saved designs close old previews and signing out restores Current',t=>{
  const x=fixture(t);x.ui.open();x.select('clear-desk');x.saved('modern-hub');assert.equal(x.ui.snapshot().preview,false);assert.equal(x.ui.snapshot().design,'modern-hub');x.signOut();assert.equal(x.ui.snapshot().design,'current');assert.equal(x.writes(),0);
});
test('Website designs: mobile regrouping moves real buttons once and retains all sections and their access visibility',t=>{
  const x=fixture(t),nodes=[...x.d.querySelectorAll('#tabs button')];x.saved('modern-hub');x.mobile(true);assert.equal(x.d.querySelectorAll('#tabs .wd-primary-nav button').length,4);assert.equal(x.d.querySelectorAll('#tabs button').length,15);assert.ok(nodes.every(n=>n.isConnected));const menu=x.d.getElementById('wdSectionMenu');for(const n of menu.querySelectorAll('button'))n.hidden=true;x.ui.mount();assert.equal(menu.hidden,true);assert.ok([...menu.querySelectorAll('.wd-nav-group')].every(g=>g.hidden));x.saved('current');assert.deepEqual([...x.d.querySelectorAll('#tabs > button')],nodes);assert.ok(nodes.find(n=>n.dataset.tab==='files').hidden);assert.equal(x.writes(),0);
});
test('Website designs: group menu supports Escape and navigation without creating duplicate routes or record writes',t=>{
  const x=fixture(t);x.saved('clear-desk');const menu=x.d.getElementById('wdSectionMenu');menu.open=true;menu.querySelector('button').dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(menu.open,false);assert.equal(x.d.activeElement,menu.querySelector('summary'));menu.open=true;menu.querySelector('button').click();assert.equal(menu.open,false);assert.equal(new Set([...x.d.querySelectorAll('#tabs button')].map(n=>n.dataset.tab)).size,15);assert.equal(x.writes(),0);
});
test('Website designs: all six choices preview and save without replacing content or route controls',t=>{
 const x=fixture(t),nodes=[...x.d.querySelectorAll('#tabs button')],editor=x.d.getElementById('editor');x.ui.open();assert.equal(x.d.querySelectorAll('[name="websiteDesign"]').length,6);x.ui.close();
 for(const design of ['editorial','canvas','compact-pro']){const before=structuredClone(x.state()),writes=x.writes();x.ui.open();x.select(design);assert.equal(x.ui.snapshot().design,design);assert.deepEqual(x.state(),before);assert.equal(x.writes(),writes);assert.ok(nodes.every(n=>n.isConnected));assert.equal(x.d.getElementById('editor'),editor);x.submit();assert.equal(x.ui.snapshot().saved,design);assert.equal(x.writes(),writes+1);}
});
test('Website designs: Editorial and Compact Pro group visibility follows the original section permissions',t=>{
 const x=fixture(t);for(const design of ['editorial','compact-pro']){x.saved(design);const groups=[...x.d.querySelectorAll('#tabs > .wd-nav-group')];assert.equal(groups.length,3);const group=groups[1];for(const node of group.querySelectorAll('button'))node.hidden=true;x.ui.mount();assert.equal(group.hidden,true);assert.equal(x.d.querySelector('[data-tab="tasks"]').hidden,false);assert.equal(x.writes(),0);for(const node of group.querySelectorAll('button'))node.hidden=false;}
});
test('Website designs: collapsing Compact Pro is local, keeps labels and buttons, survives renders and resets for another account',t=>{
 const x=fixture(t);x.saved('compact-pro');const nodes=[...x.d.querySelectorAll('#tabs button')],toggle=x.d.getElementById('wdNavToggle'),before=structuredClone(x.state());assert.equal(toggle.hidden,false);toggle.click();assert.equal(x.d.body.dataset.wdNavCollapsed,'true');assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.equal(toggle.getAttribute('aria-label'),'Expand navigation');assert.ok(nodes.every(n=>n.isConnected&&n.title&&n.querySelector('.hub-nav-label')));x.ui.mount();assert.equal(x.d.body.dataset.wdNavCollapsed,'true');assert.deepEqual([...x.d.querySelectorAll('#tabs button')],nodes);assert.deepEqual(x.state(),before);assert.equal(x.writes(),0);x.mobile(true);assert.equal(toggle.hidden,true);assert.equal(x.d.querySelectorAll('#wdSectionMenu button').length,15);assert.equal(x.d.body.dataset.wdNavCollapsed,'false');x.mobile(false);assert.equal(x.d.body.dataset.wdNavCollapsed,'true');x.switchOwner();assert.equal(x.d.body.dataset.wdNavCollapsed,'false');x.saved('current');assert.equal(toggle.hidden,true);assert.equal(x.d.body.hasAttribute('data-wd-nav-collapsed'),false);assert.ok(nodes.every(n=>!n.title));
});
test('Website designs: all three new mobile layouts retain every original section in an accessible menu',t=>{
 const x=fixture(t),nodes=[...x.d.querySelectorAll('#tabs button')];x.mobile(true);for(const design of ['editorial','canvas','compact-pro']){x.saved(design);const menu=x.d.getElementById('wdSectionMenu');assert.ok(menu);assert.equal(menu.querySelectorAll('button').length,15);assert.ok(nodes.every(n=>n.isConnected));menu.open=true;menu.querySelector('summary').dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(menu.open,false);assert.equal(x.d.activeElement,menu.querySelector('summary'));}assert.equal(x.writes(),0);
});
