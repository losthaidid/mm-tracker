/**
 * solution-simulation.js — Local trial inputs, deterministic playback and rule explanations.
 * Playback and demo runs never autosave. Save run explicitly stores bounded input snapshots.
 */
(function (root) {
  'use strict';
  const E = root.WorkHubSolutionEngine;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const option = (v, label, current) => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(label)}</option>`;
  const money = n => 'RM ' + (n / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const quantity = n => (n / 1000).toLocaleString('en-MY', { maximumFractionDigits: 3 });
  const names = { gr: 'Goods receipt · 101', issue: 'Cost-centre goods issue · 201', transfer: 'Storage-location transfer · 311', return: 'Supplier return · 122', reverse: 'Cancel last posting · 102 / 202 / 312', 'plant-transfer': 'Plant transfer · outside model', invoice: 'Invoice · outside model' };
  const button = (action, label, attrs = '', cls = '') => `<button type="button" class="ss-btn ${cls}" data-ss-sim="${action}" ${attrs}>${label}</button>`;
  function profileFields(p, prefix = 'ssTrial') {
    const number = (name, label, max, step = '.001') => `<label>${label}<input id="${prefix + name}" name="${name}" type="number" min="0" max="${max}" step="${step}" value="${p[name]}" required></label>`;
    const input = (name, label) => `<label>${label}<input name="${name}" value="${esc(p[name])}" maxlength="100"></label>`;
    const check = (name, label) => `<label class="ss-check"><input name="${name}" type="checkbox"${p[name] ? ' checked' : ''}>${label}</label>`;
    return `<div class="ss-form-grid"><label>Material capability<select name="mode">${Object.entries(E.MODES).map(([k, v]) => option(k, v, p.mode)).join('')}</select></label><label>Procurement purpose<select name="purpose">${option('stock', 'Stock procurement', p.purpose)}${option('consumption', 'Direct consumption', p.purpose)}</select></label>${number('openingQty', 'Opening inventory · main location', 1000000)}${number('poQty', 'PO order quantity', 1000000)}${input('sourceLocation', 'Main storage location · same plant')}${input('destinationLocation', 'Second storage location · same plant')}${number('standardPrice', 'Standard price · RM / base unit', 1000000, '.01')}${number('poPrice', 'PO price · RM / base unit', 1000000, '.01')}<label>PO account assignment<select name="accountCategory">${option('', 'None · stock PO', p.accountCategory)}${option('K', 'K · Cost centre', p.accountCategory)}${option('Other', 'Other · not covered', p.accountCategory)}</select></label>${input('costCenter', 'Cost centre · PO assignment / GI')}${input('glAccount', 'Consumption G/L · K-assigned PO')}${number('overTolerance', 'Overdelivery tolerance · %', 100, '.01')}</div><div class="ss-check-grid">${check('grAllowed', 'PO goods receipt expected')}${check('unlimited', 'Unlimited overdelivery')}${check('negativeConfig', 'Negative-stock Customizing in place')}${check('negativeMaterial', 'Material permits negative stock')}${check('grNonValuated', 'PO GR non-valuated · not covered')}</div><p class="ss-muted">One plant, two existing storage locations, one PO item/base unit · MYR · unrestricted stock · standard price · single K assignment. Automatic account determination and storage-location material extension are assumed complete.</p>`;
  }
  function readProfile(form) {
    const value = k => form.elements.namedItem(k)?.value || '', p = E.profile(value('mode'));
    for (const k of ['purpose', 'accountCategory', 'costCenter', 'glAccount', 'sourceLocation', 'destinationLocation']) p[k] = value(k).trim();
    for (const k of ['openingQty', 'poQty', 'standardPrice', 'poPrice', 'overTolerance']) p[k] = Number(value(k));
    for (const k of ['grAllowed', 'unlimited', 'negativeConfig', 'negativeMaterial', 'grNonValuated']) p[k] = !!form.elements.namedItem(k)?.checked;
    E.validateProfile(p); return p;
  }
  function install(a) {
    let key = '', snap = null, actions = [], cursor = -1, timer = 0, playing = false, saved = '', editing = '', loop = false;
    const $ = id => document.getElementById(id);
    const contextKey = c => JSON.stringify([c.owner, c.projectId, c.demo, c.proposal?.id, c.proposal?.profile, c.process?.scenario]);
    function stop() { if (timer) root.clearInterval(timer); timer = 0; playing = false; }
    function reset() { stop(); key = ''; snap = null; actions = []; cursor = -1; saved = editing = ''; }
    function ensure() {
      const c = a.context(), next = contextKey(c);
      if (key !== next) {
        reset(); key = next;
        if (c.proposal) { snap = E.snapshot(c.d, c.proposal.id); actions = E.defaultActions(snap.profile); }
      }
      return c;
    }
    function restore(run) { stop(); const c = a.context(); key = contextKey(c); snap = E.copy(run.snapshot); actions = E.copy(run.actions); cursor = -1; saved = run.title; editing = ''; }
    const result = () => snap ? E.simulate(snap.profile, actions, snap.scenario) : null;
    function stateNow(r) { return cursor >= 0 ? r.events[cursor]?.after || r.final : r.initial; }
    function metrics(r) {
      const s = stateNow(r);
      return [['Stock quantity', quantity(s.qty)], ['Inventory value', money(s.inventory)], ['Consumption cost', money(s.expense)], ['Net received / PO', quantity(s.netReceived) + ' / ' + snap.profile.poQty], ['Price difference', money(s.variance)], ['GR/IR balance', money(s.grir)]].map(([title, value]) => `<div><span>${title}</span><strong>${value}</strong></div>`).join('');
    }
    function stage(r) {
      const event = r.events[cursor], state = stateNow(r), status = event?.status || 'ready';
      const sourceIndex = E.RULES.find(x => x[0] === event?.code)?.[3], source = sourceIndex >= 0 ? E.SOURCES[sourceIndex] : null;
      const from = ['issue', 'transfer'].includes(event?.action.type) ? event.action.location || snap.profile.sourceLocation : event?.action.type === 'return' ? 'Warehouse / recipient' : event?.action.type === 'reverse' ? 'Original document' : 'Supplier';
      const to = event?.action.type === 'transfer' ? event.action.toLocation || snap.profile.destinationLocation : event?.action.type === 'issue' ? 'Department' : event?.action.type === 'return' ? 'Supplier' : event?.action.type === 'reverse' ? 'Reversed effects' : E.tracks(snap.profile) ? event?.action.location || snap.profile.sourceLocation : 'Department';
      return `<div class="ss-theatre is-${status}" data-sim-status="${status}"><div class="ss-theatre-label"><span>LIVE SCENARIO</span><span>${esc(snap.system)} · ${esc(E.MODES[snap.profile.mode])}</span></div><div class="ss-flow-scene" aria-hidden="true"><div class="ss-flow-node"><span>▤</span><strong>${from}</strong></div><div class="ss-flow-track"><i></i><b class="ss-moving-crate">▧</b></div><div class="ss-flow-gate"><span>${status === 'error' ? '×' : status === 'unsupported' ? '?' : status === 'success' ? '✓' : '◇'}</span><small>${event?.movement ? 'MvT ' + event.movement : status === 'ready' ? 'Ready' : 'Rule check'}</small></div><div class="ss-flow-track"><i></i></div><div class="ss-flow-node"><span>${E.tracks(snap.profile) ? '▦' : '♧'}</span><strong>${to}</strong></div><div class="ss-sparkles">${Array.from({ length: 8 }, (_, i) => `<i style="--spark:${i}"></i>`).join('')}</div></div><div class="ss-theatre-balance"><span>${quantity(state.qty)} in inventory</span><span>${money(state.inventory)} inventory value</span></div><div class="ss-location-balances">${Object.entries(state.locations).map(([name, qty]) => `<span><b>${esc(name)}</b> ${quantity(qty)} units</span>`).join('')}</div></div><div class="ss-outcome is-${status}" role="status"><span class="ss-eyebrow">${event ? `${cursor + 1} / ${actions.length} · ${esc(event.code)} · Simulator message` : 'YOUR SOLUTION, IN MOTION'}</span><h3>${esc(event?.message || 'Follow the product. Understand the consequences.')}</h3><p>${esc(event?.fix || event?.explanation || 'Play the sequence, inspect any transaction, or add your own. Quantities and values change only after a supported transaction passes its checks.')}</p>${event?.action.note ? `<p class="ss-scenario-note">${esc(event.action.note)}</p>` : ''}${source ? `<a href="${esc(source[1])}" target="_blank" rel="noopener noreferrer">SAP source · ${esc(source[0])} ↗</a>` : ''}</div>${event ? `<details class="ss-postings" open><summary>Expected symbolic accounting ${event.postings.length ? '· ' + event.postings.length + ' lines' : '· no posting'}</summary>${event.postings.length ? `<div class="ss-table-scroll"><table><thead><tr><th>Account / effect</th><th>Debit</th><th>Credit</th><th>Cost object</th></tr></thead><tbody>${event.postings.map(p => `<tr><td>${esc(p.account)}</td><td>${p.debit ? money(p.debit) : '—'}</td><td>${p.credit ? money(p.credit) : '—'}</td><td>${esc(p.costObject) || '—'}</td></tr>`).join('')}</tbody></table></div>` : `<p>${status === 'success' ? 'This transaction has no additional FI posting under the selected profile.' : 'The transaction did not change simulated stock or accounting balances.'}</p>`}<p class="ss-muted">${esc(event.explanation)} Symbolic model only; actual G/L determination, invoice, tax, freight and period controls require SAP validation.</p></details>` : ''}`;
    }
    function timeline(r) {
      return r.events.map((event, i) => `<li class="${cursor === i ? 'is-current' : ''}">${button('inspect', `<span class="ss-event-dot ${i <= cursor ? event.status : ''}">${i + 1}</span><span><strong>${esc(names[event.action.type] || event.action.type)}</strong><small>${event.action.type === 'reverse' ? 'Referenced cancellation' : event.action.qty + ' units'} · ${i <= cursor ? event.status : 'Ready to check'}</small></span>`, `data-index="${i}" aria-current="${cursor === i ? 'step' : 'false'}"`)}<div>${button('edit', '✎', `data-id="${esc(event.action.id)}" aria-label="Edit transaction ${i + 1}"`)}${button('remove', '×', `data-id="${esc(event.action.id)}" aria-label="Remove transaction ${i + 1}"`)}</div></li>`).join('') || '<li class="ss-muted">No transactions. Add one below.</li>';
    }
    function transactionForm(r) {
      const old = actions.find(x => x.id === editing), value = old || E.action('gr', 100, E.tracks(snap.profile) ? 'inventory' : 'consumption');
      const refs = [...r.activeDocuments.map(x => [x.actionId, x.document + ' · ' + (names[x.type] || x.type)]), ...r.receipts.filter(x => !r.activeDocuments.some(a => a.actionId === x.reference)).map(x => [x.reference, x.document + ' · Goods receipt'])];
      const locations = [...new Set([snap.profile.sourceLocation, snap.profile.destinationLocation])];
      return `<form id="ssTransactionForm" data-session="${esc(key)}"><h4>${old ? 'Edit transaction' : 'Try a transaction'}</h4><div class="ss-form-grid"><label>Transaction<select name="type">${Object.entries(names).map(([k, v]) => option(k, v, value.type)).join('')}</select></label><label>Quantity<input name="qty" type="number" min="0" max="1000000" step=".001" value="${value.qty}" required></label><label>Receipt destination<select name="intent">${option('inventory', 'Inventory stock', value.intent)}${option('consumption', 'Consumption', value.intent)}</select></label><label>Stock location / transfer from<select name="location">${locations.map(x => option(x, x, value.location || snap.profile.sourceLocation)).join('')}</select></label><label>Transfer to · same plant<select name="toLocation">${locations.map(x => option(x, x, value.toLocation || snap.profile.destinationLocation)).join('')}</select></label><label>Reference · return / cancellation<select name="reference">${option('', 'Choose a simulated document', value.reference)}${refs.map(([id, label]) => option(id, label, value.reference)).join('')}</select></label><label class="ss-wide">Scenario note<input name="note" maxlength="500" value="${esc(value.note)}" placeholder="What business situation are you testing?"></label></div><div class="ss-actions"><button class="ss-btn ss-primary" type="submit">${old ? 'Update & check' : '+ Add & check'}</button>${old ? button('cancel-edit', 'Cancel edit') : ''}</div></form>`;
    }
    function render() {
      ensure();
      if (!snap) return '<div class="ss-empty"><span>▷</span><h3>Give your solution a scenario.</h3><p>Create a proposal first, then explore its quantity and value effects here.</p></div>';
      const r = result();
      return `<section class="ss-simulator"><div class="ss-sim-heading"><div><span class="ss-eyebrow">${saved ? 'SAVED INPUT SNAPSHOT' : 'LOCAL WHAT-IF WORKSPACE'}</span><h3>${esc(saved || snap.proposalTitle)}</h3><p>${esc(snap.productName)} · ${esc(snap.processName)}</p></div><div class="ss-actions">${button('defaults', '↺ Proposal defaults')}${button('save', 'Keep this run', '', 'ss-primary')}</div></div><div class="ss-model-note"><strong>Core MM learning model</strong><span>Source-based rules · ${esc(E.VERSION)} · target context ${esc(snap.system)}${snap.release ? ' / ' + esc(snap.release) : ''}. Release-specific behaviour is not inferred from this selector.</span></div><div class="ss-metrics" id="ssSimMetrics">${metrics(r)}</div><div class="ss-playback"><div class="ss-actions">${button('restart', '↶', 'aria-label="Restart playback"')}${button('back', '←', 'aria-label="Previous transaction"')}${button('play', playing ? 'Ⅱ Pause' : '▶ Play', '', 'ss-primary')}${button('next', 'Next →')}<label class="ss-check"><input id="ssSimLoop" type="checkbox"${loop ? ' checked' : ''}>Loop</label></div><span id="ssPlaybackState">${cursor < 0 ? 'Ready to explore' : `${cursor + 1} of ${actions.length}`}</span></div><div class="ss-sim-columns"><div id="ssSimStage">${stage(r)}</div><aside class="ss-transaction-panel"><div class="ss-section-head"><h4>Transaction sequence</h4>${button('clear', 'Clear')}</div><ol id="ssSimTimeline" class="ss-sim-timeline">${timeline(r)}</ol>${button('invalid', '✦ Try an invalid transaction', '', 'ss-wide-btn')}${transactionForm(r)}</aside></div><details class="ss-trial-inputs"><summary>Scenario inputs &amp; document controls <span>Trial changes stay local until you keep a run</span></summary><form id="ssTrialProfile" data-session="${esc(key)}">${profileFields(snap.profile)}<button type="submit" class="ss-btn ss-primary">Apply trial inputs &amp; replay</button></form></details><p class="ss-footnote">Simulation checks run before animation. Failed and unsupported attempts leave balances unchanged. Cancelling is limited to the last active GR/GI/311 in this model; supplier return 122 is a separate transaction. Referenced transactions use stable IDs even when the sequence is edited.</p></section>`;
    }
    function refresh() { const el = document.querySelector('.ss-simulator'); if (el) el.outerHTML = render(); }
    function paint() {
      if (!$('ssSimStage') || !snap) { stop(); return; }
      const r = result(); $('ssSimStage').innerHTML = stage(r); $('ssSimMetrics').innerHTML = metrics(r); $('ssSimTimeline').innerHTML = timeline(r);
      $('ssPlaybackState').textContent = cursor < 0 ? 'Ready to explore' : `${cursor + 1} of ${actions.length}`;
      const play = document.querySelector('[data-ss-sim="play"]'); if (play) play.textContent = playing ? 'Ⅱ Pause' : '▶ Play';
    }
    function advance() {
      a.guard(); ensure();
      if (!actions.length) { stop(); paint(); return; }
      if (cursor >= actions.length - 1) { if (loop) cursor = -1; else { stop(); paint(); return; } }
      cursor++; const e = result().events[cursor]; if (e.status !== 'success') stop(); paint();
    }
    function play() {
      a.guard(); ensure();
      if (playing) { stop(); paint(); return; }
      if (cursor >= actions.length - 1) cursor = -1;
      playing = true; advance();
      if (playing) timer = root.setInterval(() => { try { if (document.hidden || !$('ssSimStage')) { stop(); return; } advance(); } catch (err) { stop(); a.tell(err.message, true); } }, 2100);
      paint();
    }
    function handle(el) {
      const op = el.dataset.ssSim; if (!op) return false;
      a.guard(); ensure(); if (!snap) return true;
      if (op === 'play') { play(); return true; }
      stop();
      if (op === 'restart') cursor = -1;
      if (op === 'back') cursor = Math.max(-1, cursor - 1);
      if (op === 'next') { advance(); return true; }
      if (op === 'inspect') cursor = Math.min(actions.length - 1, Math.max(0, Number(el.dataset.index)));
      if (op === 'defaults') { reset(); ensure(); refresh(); return true; }
      if (op === 'clear') { actions = []; cursor = -1; editing = ''; refresh(); return true; }
      if (op === 'edit' || op === 'cancel-edit') { editing = op === 'edit' ? el.dataset.id : ''; refresh(); $('ssTransactionForm')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); return true; }
      if (op === 'remove') { actions = actions.filter(x => x.id !== el.dataset.id); if (editing === el.dataset.id) editing = ''; cursor = Math.min(cursor, actions.length - 1); refresh(); return true; }
      if (op === 'invalid') {
        if (actions.length >= 40) throw Error('Remove a transaction before adding another.');
        actions.push(E.tracks(snap.profile) ? snap.profile.negativeConfig && snap.profile.negativeMaterial ? E.action('gr', 0, 'inventory', '', 'A receipt still needs a positive quantity, even when negative stock is allowed.') : E.action('issue', Math.max(1, result().final.qty / 1000 + 50), 'inventory', '', 'What happens if we withdraw more than is available?') : E.action('gr', 1, 'inventory', '', 'Can a non-stock purchase increase inventory?'));
        cursor = actions.length - 1; refresh(); return true;
      }
      if (op === 'save') { const c = a.context(); if (!c.proposal) throw Error('Select an existing proposal to keep this run.'); a.keepRun({ snapshot: E.copy(snap), actions: E.copy(actions), title: saved || snap.proposalTitle + ' · ' + new Date().toLocaleDateString('en-MY') }); return true; }
      paint(); return true;
    }
    function submit(form) {
      if (!['ssTransactionForm', 'ssTrialProfile'].includes(form.id)) return false;
      a.guard(); ensure();
      if (!form.isConnected || form.dataset.session !== key) throw Error('Reopen the simulator after changing the account, project or proposal.');
      stop(); const value = k => form.elements.namedItem(k)?.value || '';
      if (form.id === 'ssTrialProfile') { snap.profile = readProfile(form); saved = ''; cursor = -1; refresh(); return true; }
      const next = E.action(value('type'), Number(value('qty')), value('intent'), value('reference'), value('note').trim()), candidate = E.copy(actions);
      next.location = value('location'); next.toLocation = value('toLocation');
      let index = candidate.length;
      if (editing) { index = candidate.findIndex(x => x.id === editing); if (index < 0) throw Error('This transaction was removed.'); next.id = editing; candidate[index] = next; }
      else { if (actions.length >= 40) throw Error('A simulation supports up to 40 transactions.'); candidate.push(next); }
      E.validateActions(candidate); actions = candidate; cursor = index; saved = ''; editing = ''; refresh(); return true;
    }
    document.addEventListener('change', event => { if (event.target.id === 'ssSimLoop') loop = event.target.checked; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); paint(); } });
    document.addEventListener('input', event => { if (event.target.closest?.('#ssTrialProfile, #ssTransactionForm')) { stop(); const b = document.querySelector('[data-ss-sim="play"]'); if (b) b.textContent = '▶ Play'; } });
    return { render, handle, submit, stop, reset, restore, refresh, play, advance, snapshot: () => ({ key, snap: snap && E.copy(snap), actions: E.copy(actions), cursor, playing }) };
  }
  root.WorkHubSolutionSimulation = { install, profileFields, readProfile, money, quantity, names };
})(window);
