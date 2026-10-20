/** Maintainable personal SAP T-code desk. No SAP session or posting is performed. */
(function sapTcodesUI(root) {
  'use strict';
  const E=root.WorkHubSapTcodesEngine, esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  function install(a) {
    let owner='',filters={query:'',system:'',category:'',favorite:false,archived:false};
    const guard=expected=>{if(!a.ready()||!a.owner()||(expected&&expected!==a.owner()))throw Error('Sign in and reopen the T-code library.');};
    const button=(action,label,attrs='',cls='small')=>`<button type="button" class="${cls}" data-tcodes="${action}" ${attrs}>${label}</button>`;
    function resetOwner() {if(owner!==a.owner()){owner=a.owner();filters={query:'',system:'',category:'',favorite:false,archived:false};}}
    function render() {
      resetOwner();
      const rows=E.query(a.state(),filters),categories=[...new Set(a.state().workhub.tcodes.records.map(r=>r.category))].sort(),groups=[...new Set(rows.map(r=>r.category))];
      return `<section id="sapTcodesRoot" class="tcodes-workspace" data-owner="${esc(owner)}"><div class="tcodes-hero"><div><span class="hub-kicker">YOUR SAP MM REFERENCE DESK</span><h2>SAP T-code library</h2><p>Find the right transaction. Keep the notes that matter to you.</p></div>${button('add','＋ Add T-code','','primary')}</div><div class="tcodes-tools"><label>Search<input id="tcodesSearch" type="search" value="${esc(filters.query)}" placeholder="Code, purpose, area or your notes"></label><label>System<select id="tcodesSystem"><option value="">ECC + S/4HANA</option><option value="ECC"${filters.system==='ECC'?' selected':''}>ECC</option><option value="S4"${filters.system==='S4'?' selected':''}>S/4HANA</option></select></label><label>Group<select id="tcodesCategory"><option value="">All groups</option>${categories.map(c=>`<option${filters.category===c?' selected':''}>${esc(c)}</option>`).join('')}</select></label><label class="check-label"><input id="tcodesFavorites" type="checkbox"${filters.favorite?' checked':''}>Favourites</label><label class="check-label"><input id="tcodesArchived" type="checkbox"${filters.archived?' checked':''}>Archived</label></div><p class="tcodes-scope">${rows.length} entries · Starter reference checked 21 Oct 2026. S/4HANA guidance targets on-premise/private edition; availability depends on release, configuration and authorization. Public Cloud access differs.</p>${groups.map(category=>`<section class="tcodes-group"><div class="tcodes-group-heading"><h3>${esc(category)}</h3><span>${rows.filter(r=>r.category===category).length}</span></div><div class="tcodes-grid">${rows.filter(r=>r.category===category).map(card).join('')}</div></section>`).join('')||'<div class="tcodes-empty"><h3>No matching T-codes</h3><p>Change the filters or add your own entry.</p></div>'}</section>`;
    }
    function card(r) {
      return `<article class="tcode-card" data-tcode-id="${esc(r.id)}"><div class="tcode-card-head"><span class="tcode-code">${esc(r.code)}</span>${button('favorite',r.favorite?'★':'☆',`data-id="${esc(r.id)}" aria-label="${r.favorite?'Unfavourite':'Favourite'} ${esc(r.code)}" aria-pressed="${r.favorite}"`)}</div><h4>${esc(r.title)}</h4><div class="tcode-tags"><span>${esc(r.area)||'General'}</span>${r.systems.map(s=>`<span>${s==='S4'?'S/4HANA':'ECC'}</span>`).join('')}</div>${r.notes?`<p class="tcode-notes">${esc(r.notes)}</p>`:''}${r.eccNote||r.s4Note?`<details><summary>Version notes</summary>${r.eccNote?`<p><strong>ECC:</strong> ${esc(r.eccNote)}</p>`:''}${r.s4Note?`<p><strong>S/4HANA:</strong> ${esc(r.s4Note)}</p>`:''}</details>`:''}<div class="tcode-source">${r.sourceUrl?`<a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(r.sourceTitle)||'Reference'} ↗</a>`:'Personal reference'}${r.origin!=='starter'?'<span>Personalized entry</span>':''}</div><div class="actions">${button('copy','Copy code',`data-id="${esc(r.id)}"`)}${button('edit','Edit',`data-id="${esc(r.id)}"`)}${button('archive',r.archived?'Restore':'Archive',`data-id="${esc(r.id)}"`)}</div></article>`;
    }
    function refresh() {a.render();}
    function editor(id='') {
      guard(owner);
      const old=a.state().workhub.tcodes.records.find(r=>r.id===id),r=old||{code:'',title:'',category:'Transactions',area:'',systems:['ECC','S4'],notes:'',eccNote:'',s4Note:'',sourceTitle:'',sourceUrl:''};
      if(id&&!old)throw Error('T-code no longer exists.');
      const field=(key,label,type='text',max=300)=>`<label>${label}${type==='textarea'?`<textarea name="${key}" maxlength="${max}">${esc(r[key])}</textarea>`:`<input name="${key}" type="${type}" maxlength="${max}" value="${esc(r[key])}"${['code','title','category'].includes(key)?' required':''}>`}</label>`;
      a.openModal(old?'Edit T-code':'Add T-code',`<form id="tcodeForm" data-id="${esc(id)}" data-owner="${esc(a.owner())}"><div class="tcodes-editor-grid">${field('code','T-code','text',40)}${field('title','Purpose / title')}${field('category','Group','text',80)}${field('area','Functional area','text',100)}</div><fieldset><legend>Show under</legend><label class="check-label"><input name="ecc" type="checkbox"${r.systems.includes('ECC')?' checked':''}>ECC</label><label class="check-label"><input name="s4" type="checkbox"${r.systems.includes('S4')?' checked':''}>S/4HANA</label></fieldset>${field('notes','My notes','textarea',32767)}${field('eccNote','ECC notes','textarea',32767)}${field('s4Note','S/4HANA notes','textarea',32767)}${field('sourceTitle','Reference title')}${field('sourceUrl','Reference URL','url',2000)}<div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Save T-code</button></div></form>`);
    }
    function save(form) {
      guard(form.dataset.owner);const value=k=>form.elements.namedItem(k).value.trim(),id=form.dataset.id,old=a.state().workhub.tcodes.records.find(r=>r.id===id);
      if(id&&!old)throw Error('T-code no longer exists.');
      const record={id:id||root.crypto.randomUUID(),code:value('code').toUpperCase(),title:value('title'),category:value('category'),area:value('area'),
        systems:['ECC','S4'].filter(s=>form.elements.namedItem(s==='ECC'?'ecc':'s4').checked),notes:value('notes'),eccNote:value('eccNote'),s4Note:value('s4Note'),
        favorite:old?.favorite||false,archived:old?.archived||false,sourceTitle:value('sourceTitle'),sourceUrl:value('sourceUrl'),
        origin:old?'personalised':'custom',checkedAt:old?.checkedAt||'',updatedAt:new Date().toISOString()};
      const ok=a.mutate(d=>{const rows=d.workhub.tcodes.records;if(old)rows[rows.findIndex(r=>r.id===id)]=record;else rows.push(record);});
      if(ok){a.closeModal();a.tell('T-code saved.');}
    }
    document.addEventListener('click',event=>{
      const el=event.target.closest?.('[data-tcodes]');if(!el)return;event.preventDefault();
      try {
        guard(owner);const action=el.dataset.tcodes,id=el.dataset.id,r=a.state().workhub.tcodes.records.find(r=>r.id===id);
        if(action==='add'||action==='edit'){editor(action==='edit'?id:'');return;}
        if(!r)throw Error('T-code no longer exists.');
        if(action==='favorite'||action==='archive'){a.mutate(d=>{const row=d.workhub.tcodes.records.find(r=>r.id===id);if(action==='favorite')row.favorite=!row.favorite;else row.archived=!row.archived;});}
        if(action==='copy') {
          const identity=a.owner(),fallback=()=>{if(a.owner()===identity)a.openModal('Copy T-code',`<label for="tcodeCopy">T-code</label><textarea id="tcodeCopy" readonly>${esc(r.code)}</textarea>`);};
          if(root.navigator?.clipboard?.writeText)root.navigator.clipboard.writeText(r.code).then(()=>{if(a.owner()===identity)a.tell('T-code copied.');}).catch(fallback);else fallback();
        }
      }catch(err){a.tell(err.message,true);}
    });
    document.addEventListener('input',event=>{
      if(event.target.id!=='tcodesSearch')return;
      filters.query=event.target.value;const start=event.target.selectionStart;refresh();const input=document.getElementById('tcodesSearch');input?.focus();input?.setSelectionRange(start,start);
    });
    document.addEventListener('change',event=>{
      const fields={tcodesSystem:'system',tcodesCategory:'category',tcodesFavorites:'favorite',tcodesArchived:'archived'},key=fields[event.target.id];
      if(!key)return;filters[key]=event.target.type==='checkbox'?event.target.checked:event.target.value;refresh();
    });
    document.addEventListener('submit',event=>{if(event.target.id!=='tcodeForm')return;event.preventDefault();try{save(event.target);}catch(err){a.tell(err.message,true);}});
    function mount() {
      const form=document.getElementById('tcodeForm'),view=document.getElementById('sapTcodesRoot');
      if((form&&form.dataset.owner!==a.owner())||(view&&view.dataset.owner!==a.owner())||(!a.ready()&&(form||view)))a.closeModal();
      resetOwner();
    }
    return {render,mount,editor,save};
  }
  root.WorkHubSapTcodes={install};
})(window);
