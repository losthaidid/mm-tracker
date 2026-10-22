/**
 * solution-simulation.js — Local trial inputs, deterministic playback and rule explanations.
 * Playback and demo runs never autosave. Save run explicitly stores bounded input snapshots.
 */
(function (root) {
  'use strict';
  const E = root.WorkHubSolutionEngine, M = root.WorkHubSolutionMaterials, V = root.WorkHubSolutionTheatre, G = root.WorkHubSolutionGuide, U = root.WorkHubSolutionValuationUI;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const option = (v, label, current) => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(label)}</option>`;
  const money = n => 'RM ' + (n / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const quantity = n => (n / 1000).toLocaleString('en-MY', { maximumFractionDigits: 3 });
  const names = { gr: 'Goods receipt · 101', issue: 'Cost-centre goods issue · 201', transfer: 'Storage-location transfer · 311', return: 'Supplier return · 122', reverse: 'Cancel last posting · 102 / 202 / 312', 'plant-transfer': 'Plant transfer · outside model', invoice: 'Invoice · outside model' };
  const button = (action, label, attrs = '', cls = '') => `<button type="button" class="ss-btn ${cls}" data-ss-sim="${action}" ${attrs}>${label}</button>`;
  function profileFields(p, prefix = 'ssTrial') {
    const number = (name, label, max, step = '.001') => { const inactive = name === 'standardPrice' && (p.mode !== 'valuated' || p.priceControl === 'V' || p.splitValuation); return `<label${inactive ? ' hidden' : ''}>${label}<input id="${prefix + name}" name="${name}" type="number" min="0" max="${max}" step="${step}" value="${p[name]}"${inactive ? ' disabled' : ''}${name === 'openingQty' && p.splitValuation ? ' readonly' : ''} required></label>`; };
    const input = (name, label) => `<label>${label}<input name="${name}" value="${esc(p[name])}" maxlength="100"></label>`;
    const check = (name, label) => `<label class="ss-check"><input name="${name}" type="checkbox"${p[name] ? ' checked' : ''}>${label}</label>`;
    const t = p.materialType;
    const material = t ? `<fieldset class="sx-material-controls" data-material="${esc(JSON.stringify(t))}"><legend>${esc(t.code)} · explicit material attributes</legend><div class="ss-check-grid"><label class="ss-check"><input name="materialQuantity" type="checkbox"${t.quantityUpdate ? ' checked' : ''}>Quantity updating</label><label class="ss-check"><input name="materialValue" type="checkbox"${t.valueUpdate ? ' checked' : ''}>Value updating</label><label class="ss-check"><input name="materialService" type="checkbox"${t.service ? ' checked' : ''}>Service product</label></div><label>Permitted procurement<select name="materialProcurement">${Object.entries(M.PROCUREMENT).map(([k, v]) => option(k, v, t.procurement)).join('')}</select></label><label class="ss-check"><input name="detachMaterial" type="checkbox">Detach this profile and use the inventory-mode selector</label><p class="ss-muted">Mode derives from quantity/value attributes while attached. Changing a flag does not complete dependent PO settings for you.</p></fieldset>` : '<p class="ss-muted">No material type attached. Choose a reference profile from Material explorer to connect its attributes.</p>';
    return `${material}<div class="ss-form-grid"><label>Inventory mode${t ? ' · derived while attached' : ''}<select name="mode"${t ? ' disabled' : ''}>${Object.entries(E.MODES).map(([k, v]) => option(k, v, p.mode)).join('')}</select></label><label>Procurement purpose<select name="purpose">${option('stock', 'Stock procurement', p.purpose)}${option('consumption', 'Direct consumption', p.purpose)}</select></label>${number('openingQty', 'Opening inventory · main location', 1000000)}${number('poQty', 'PO order quantity', 1000000)}${input('sourceLocation', 'Main storage location · same plant')}${input('destinationLocation', 'Second storage location · same plant')}${number('standardPrice', 'Standard price · RM / base unit', 1000000, '.01')}${number('poPrice', 'PO price · RM / base unit', 1000000, '.01')}<label>PO account assignment<select name="accountCategory">${option('', 'None · stock PO', p.accountCategory)}${option('K', 'K · Cost centre', p.accountCategory)}${option('Other', 'Other · not covered', p.accountCategory)}</select></label>${input('costCenter', 'Cost centre · PO assignment / GI')}${input('glAccount', 'Consumption G/L · K-assigned PO')}${number('overTolerance', 'Overdelivery tolerance · %', 100, '.01')}</div>${U.fields(p)}<div class="ss-check-grid">${check('grAllowed', 'PO goods receipt expected')}${check('unlimited', 'Unlimited overdelivery')}${check('negativeConfig', 'Negative-stock Customizing in place')}${check('negativeMaterial', 'Material permits negative stock')}${check('grNonValuated', 'PO GR non-valuated · not covered')}</div><p class="ss-muted">One plant, two existing storage locations, one PO item/base unit · MYR · unrestricted stock · S/V valuation · optional batches and explicit split valuation · single K assignment. Automatic account determination and storage-location material extension are assumed complete.</p>`;
  }
  function readProfile(form) {
    const value = k => form.elements.namedItem(k)?.value || '', p = E.profile(value('mode'));
    for (const k of ['purpose', 'accountCategory', 'costCenter', 'glAccount', 'sourceLocation', 'destinationLocation']) p[k] = value(k).trim();
    for (const k of ['openingQty', 'poQty', 'standardPrice', 'poPrice', 'overTolerance']) p[k] = Number(value(k));
    for (const k of ['grAllowed', 'unlimited', 'negativeConfig', 'negativeMaterial', 'grNonValuated']) p[k] = !!form.elements.namedItem(k)?.checked;
    const material = form.querySelector('[data-material]');
    if (material && !form.elements.namedItem('detachMaterial')?.checked) {
      p.materialType = JSON.parse(material.dataset.material);
      for (const [key, field] of [['quantityUpdate', 'materialQuantity'], ['valueUpdate', 'materialValue'], ['service', 'materialService']]) p.materialType[key] = !!form.elements.namedItem(field)?.checked;
      p.materialType.procurement = value('materialProcurement'); p.mode = M.mode(p.materialType);
    }
    U.read(form, p); E.validateProfile(p); return p;
  }
  function install(a) {
    let key = '', snap = null, actions = [], cursor = -1, timer = 0, playing = false, saved = '', editing = '', loop = false, pace = 6000, flowView = 'split', baseline = null, drag = null, pointerDrag = null;
    const $ = id => document.getElementById(id);
    const contextKey = c => JSON.stringify([c.owner, c.projectId, c.demo, c.proposal?.id, c.proposal?.profile, c.process?.scenario]);
    function stop() { if (timer) root.clearInterval(timer); timer = 0; playing = false; }
    function reset() { stop(); clearStockDrag(); key = ''; snap = null; actions = []; cursor = -1; saved = editing = ''; baseline = drag = null; }
    function ensure() {
      const c = a.context(), next = contextKey(c);
      if (key !== next) {
        reset(); key = next;
        if (c.proposal) { snap = E.snapshot(c.d, c.proposal.id); actions = E.defaultActions(snap.profile); }
      }
      return c;
    }
    function restore(run) { stop(); const c = a.context(); key = contextKey(c); snap = E.copy(run.snapshot); actions = E.copy(run.actions); cursor = -1; saved = run.title; editing = ''; baseline = drag = null; }
    const result = () => snap ? E.simulate(snap.profile, actions, snap.scenario, snap.engineVersion) : null;
    function applyMaterial(type) {
      a.guard(); ensure(); if (!snap) throw Error('Create a proposal before applying a material profile.');
      stop(); baseline = { profile: E.copy(snap.profile), label: 'Before · ' + (snap.profile.materialType?.code || E.MODES[snap.profile.mode]), version: snap.engineVersion };
      snap.profile = M.applyType(type, snap.profile); snap.engineVersion = E.VERSION; saved = ''; cursor = -1;
    }
    function insert(action) {
      if (actions.length >= 40) throw Error('Remove a transaction before adding another.');
      const index = cursor + 1, candidate = E.copy(actions); candidate.splice(index, 0, action); E.validateActions(candidate); actions = candidate; cursor = index; saved = ''; editing = ''; refresh();
    }
    function transfer(from, to) {
      a.guard(); ensure(); stop();
      const qty = Number($('ssWarehouseQty')?.value);
      const action = E.action('transfer', qty, 'inventory', '', 'Warehouse sandbox · same-plant unrestricted transfer'); action.location = from; action.toLocation = to;
      if (snap.profile.batchManaged) action.batch = $('ssWarehouseBatch')?.value || '';
      if (snap.profile.splitValuation) action.valuationType = $('ssWarehouseType')?.value || '';
      insert(action);
    }
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
      return `<div class="ss-theatre is-${status}" data-sim-status="${status}"><div class="ss-theatre-label"><span>LIVE SCENARIO</span><span>${esc(snap.system)} · ${esc(E.MODES[snap.profile.mode])}</span></div><div class="ss-flow-scene" aria-hidden="true"><div class="ss-flow-node"><span>▤</span><strong>${esc(from)}</strong></div><div class="ss-flow-track"><i></i><b class="ss-moving-crate">▧</b></div><div class="ss-flow-gate"><span>${status === 'error' ? '×' : status === 'unsupported' ? '?' : status === 'success' ? '✓' : '◇'}</span><small>${event?.movement ? 'MvT ' + event.movement : status === 'ready' ? 'Ready' : 'Rule check'}</small></div><div class="ss-flow-track"><i></i></div><div class="ss-flow-node"><span>${E.tracks(snap.profile) ? '▦' : '♧'}</span><strong>${esc(to)}</strong></div><div class="ss-sparkles">${Array.from({ length: 8 }, (_, i) => `<i style="--spark:${i}"></i>`).join('')}</div></div><div class="ss-theatre-balance"><span>${quantity(state.qty)} in inventory</span><span>${money(state.inventory)} inventory value</span></div><div class="ss-location-balances">${Object.entries(state.locations).map(([name, qty]) => `<span><b>${esc(name)}</b> ${quantity(qty)} units</span>`).join('')}</div></div><div class="ss-outcome is-${status}" role="status"><span class="ss-eyebrow">${event ? `${cursor + 1} / ${actions.length} · ${esc(event.code)} · Simulator message` : 'YOUR SOLUTION, IN MOTION'}</span><h3>${esc(event?.message || 'Follow the product. Understand the consequences.')}</h3><p>${esc(event?.fix || event?.explanation || 'Play the sequence, inspect any transaction, or add your own. Quantities and values change only after a supported transaction passes its checks.')}</p>${event?.action.note ? `<p class="ss-scenario-note">${esc(event.action.note)}</p>` : ''}${source ? `<a href="${esc(source[1])}" target="_blank" rel="noopener noreferrer">SAP source · ${esc(source[0])} ↗</a>` : ''}</div>${event ? `<details class="ss-postings" open><summary>Expected symbolic accounting ${event.postings.length ? '· ' + event.postings.length + ' lines' : '· no posting'}</summary>${event.postings.length ? `<div class="ss-table-scroll"><table><thead><tr><th>Account / effect</th><th>Debit</th><th>Credit</th><th>Cost object</th></tr></thead><tbody>${event.postings.map(p => `<tr><td>${esc(p.account)}${event.valuationClass && /BSX|GBB/.test(p.account) ? `<small class="sv-posting-class">Valuation class ${esc(event.valuationClass)}${event.valuationType ? ` · ${esc(event.valuationType)}` : ''}</small>` : ''}</td><td>${p.debit ? money(p.debit) : '—'}</td><td>${p.credit ? money(p.credit) : '—'}</td><td>${esc(p.costObject) || '—'}</td></tr>`).join('')}</tbody></table></div>` : `<p>${status === 'success' ? 'This transaction has no additional FI posting under the selected profile.' : 'The transaction did not change simulated stock or accounting balances.'}</p>`}<p class="ss-muted">${esc(event.explanation)} Symbolic model only; actual G/L determination, invoice, tax, freight and period controls require SAP validation.</p></details>` : ''}`;
    }
    function visualStage(r) {
      const event = r.events[cursor], state = stateNow(r);
      return `<div class="sx-live-stage" data-flow="${flowView}">${G.narration(snap, event, actions.length, cursor)}${U.view(event, snap, state)}${stage(r)}${V.documents(event, snap)}${V.accounting(event, state)}${V.warehouse(state, snap)}</div>`;
    }
    function timeline(r) {
      return r.events.map((event, i) => `<li class="${cursor === i ? 'is-current' : ''}">${button('inspect', `<span class="ss-event-dot ${i <= cursor ? event.status : ''}">${i + 1}</span><span><strong>${esc(names[event.action.type] || event.action.type)}</strong><small>${event.action.type === 'reverse' ? 'Referenced cancellation' : event.action.qty + ' units'}${event.valuationType ? ' · ' + esc(event.valuationType) : ''}${event.batch ? ' · batch ' + esc(event.batch) : ''} · ${i <= cursor ? event.status : 'Ready to check'}</small></span>`, `data-index="${i}" aria-current="${cursor === i ? 'step' : 'false'}"`)}<div>${button('edit', '✎', `data-id="${esc(event.action.id)}" aria-label="Edit transaction ${i + 1}"`)}${button('remove', '×', `data-id="${esc(event.action.id)}" aria-label="Remove transaction ${i + 1}"`)}</div></li>`).join('') || '<li class="ss-muted">No transactions. Add one below.</li>';
    }
    function transactionForm(r) {
      const old = actions.find(x => x.id === editing), value = old || E.action('gr', 100, E.tracks(snap.profile) ? 'inventory' : 'consumption');
      const refs = r.events.filter(x => x.status === 'success' && ['gr', 'issue', 'transfer'].includes(x.action.type)).map(x => [x.action.id, x.document + ' · ' + names[x.action.type] + (x.valuationType ? ' · ' + x.valuationType : '') + (x.batch ? ' · batch ' + x.batch : '')]);
      if (value.reference && !refs.some(([id]) => id === value.reference)) refs.push([value.reference, 'Unavailable reference · select a valid document']);
      const locations = [...new Set([snap.profile.sourceLocation, snap.profile.destinationLocation])];
      return `<form id="ssTransactionForm" data-session="${esc(key)}"><h4>${old ? 'Edit transaction' : 'Try a transaction'}</h4><div class="ss-form-grid"><label>Transaction<select name="type">${Object.entries(names).map(([k, v]) => option(k, v, value.type)).join('')}</select></label><label>Quantity<input name="qty" type="number" min="0" max="1000000" step=".001" value="${value.qty}" required></label><label>Receipt destination<select name="intent">${option('inventory', 'Inventory stock', value.intent)}${option('consumption', 'Consumption', value.intent)}</select></label><label>Stock location / transfer from<select name="location">${locations.map(x => option(x, x, value.location || snap.profile.sourceLocation)).join('')}</select></label><label>Transfer to · same plant<select name="toLocation">${locations.map(x => option(x, x, value.toLocation || snap.profile.destinationLocation)).join('')}</select></label><label>Reference · return / cancellation<select name="reference">${option('', 'Choose a simulated document', value.reference)}${refs.map(([id, label]) => option(id, label, value.reference)).join('')}</select></label>${U.transactionFields(snap.profile, value, r.final)}<label class="ss-wide">Scenario note<input name="note" maxlength="500" value="${esc(value.note)}" placeholder="What business situation are you testing?"></label></div><div class="ss-actions"><button class="ss-btn ss-primary" type="submit">${old ? 'Update & check' : '+ Add & check'}</button>${old ? button('cancel-edit', 'Cancel edit') : ''}</div></form>`;
    }
    function render() {
      ensure();
      if (!snap) return '<div class="ss-empty"><span>▷</span><h3>Give your solution a scenario.</h3><p>Create a proposal first, then explore its quantity and value effects here.</p></div>';
      const r = result();
      return `<section class="ss-simulator"><div class="ss-sim-heading"><div><span class="ss-eyebrow">${saved ? 'SAVED INPUT SNAPSHOT' : 'LOCAL WHAT-IF WORKSPACE'}</span><h3>${esc(saved || snap.proposalTitle)}</h3><p>${esc(snap.productName)} · ${esc(snap.processName)}</p></div><div class="ss-actions">${button('defaults', '↺ Proposal defaults')}${button('save', 'Keep this run', '', 'ss-primary')}</div></div><div class="sv-example-links"><span>Learn with a worked example</span><button type="button" class="ss-btn" data-ss="learn-inventory" data-kind="map">Moving average price</button><button type="button" class="ss-btn" data-ss="learn-inventory" data-kind="batch">Batch-managed stock</button><button type="button" class="ss-btn" data-ss="learn-inventory" data-kind="split">Split valuation &amp; classes</button></div><details class="sg-simulation-scope"><summary>What this simulator can check · assumptions &amp; target context</summary><p>Practice core PO receipt, cost-centre issue, same-plant location transfer, supplier return and limited referenced cancellation. This is an explanatory model; it does not post to SAP. Target ${esc(snap.system)}${snap.release ? ' / ' + esc(snap.release) : ''}. Rule version ${esc(snap.engineVersion)}; the selector does not infer release-specific behaviour.</p></details><div class="ss-metrics" id="ssSimMetrics">${metrics(r)}</div><div class="ss-playback"><div class="ss-actions">${button('restart', '↶', 'aria-label="Restart playback"')}${button('back', '← Previous', 'aria-label="Previous transaction"')}${button('play', playing ? 'Ⅱ Pause' : '▶ Play', '', 'ss-primary')}${button('next', 'Next transaction →')}<label class="ss-check"><input id="ssSimLoop" type="checkbox"${loop ? ' checked' : ''}>Loop</label></div><label class="ss-learning-pace">Playback pace<select id="ssSimPace">${[[6000, 'Learning · 6 seconds'], [3500, 'Standard · 3.5 seconds'], [2100, 'Fast · 2.1 seconds']].map(([ms, title]) => option(String(ms), title, String(pace))).join('')}</select></label><span id="ssPlaybackState">${cursor < 0 ? 'Ready to explore' : `${cursor + 1} of ${actions.length}`}</span></div><div class="sx-flow-switch" role="group" aria-label="Physical and document flow">${[['physical', '▧ Physical flow'], ['documents', '▤ Document flow'], ['split', '⇄ Both together']].map(([id, label]) => button('flow', label, `data-view="${id}" aria-pressed="${flowView === id}"`, flowView === id ? 'ss-primary' : '')).join('')}</div><div id="ssTrialComparison">${V.comparison(baseline, snap, actions, snap.scenario)}</div><div class="ss-sim-columns"><div id="ssSimStage">${visualStage(r)}</div><aside class="ss-transaction-panel"><div class="ss-section-head"><h4>Transaction sequence</h4>${button('clear', 'Clear')}</div><ol id="ssSimTimeline" class="ss-sim-timeline">${timeline(r)}</ol>${button('invalid', '✦ Try an invalid transaction', '', 'ss-wide-btn')}<section class="sx-surprises"><span class="ss-eyebrow">INTRODUCE A COMPLICATION</span>${button('surprise', '⚡ Urgent withdrawal', 'data-event="urgent"', 'ss-wide-btn')}${button('surprise', '↩ Damaged delivery → return', 'data-event="damage"', 'ss-wide-btn')}${button('surprise', '▧ Another partial receipt', 'data-event="partial"', 'ss-wide-btn')}<p>Inserts after the selected step. Damage uses a referenced 122 return; quality inspection is separate scope.</p></section>${transactionForm(r)}</aside></div><details class="ss-trial-inputs"><summary>Scenario inputs &amp; document controls <span>Trial changes stay local until you keep a run</span></summary><form id="ssTrialProfile" data-session="${esc(key)}">${profileFields(snap.profile)}<button type="submit" class="ss-btn ss-primary">Apply trial inputs &amp; replay</button></form></details><p class="ss-footnote">Simulation checks run before animation. Failed and unsupported attempts leave balances unchanged. Cancelling is limited to the last active GR/GI/311 in this model; supplier return 122 is a separate transaction. Referenced transactions use stable IDs even when the sequence is edited.</p></section>`;
    }
    function refresh() { const el = document.querySelector('.ss-simulator'); if (el) el.outerHTML = render(); }
    function paint() {
      if (!$('ssSimStage') || !snap) { stop(); return; }
      const r = result(); $('ssSimStage').innerHTML = visualStage(r); if ($('ssTrialComparison')) $('ssTrialComparison').innerHTML = V.comparison(baseline, snap, actions, snap.scenario); $('ssSimMetrics').innerHTML = metrics(r); $('ssSimTimeline').innerHTML = timeline(r);
      $('ssPlaybackState').textContent = cursor < 0 ? 'Ready to explore' : `${cursor + 1} of ${actions.length}`;
      const play = document.querySelector('[data-ss-sim="play"]'); if (play) play.textContent = playing ? 'Ⅱ Pause' : '▶ Play';
    }
    function advance() {
      a.guard(); ensure();
      if (!actions.length) { stop(); paint(); return; }
      if (cursor >= actions.length - 1) { if (loop) cursor = -1; else { stop(); paint(); return; } }
      cursor++; const e = result().events[cursor]; if (e.status !== 'success') stop(); paint();
    }
    function startTimer() { timer = root.setInterval(() => { try { if (document.hidden || !$('ssSimStage')) { stop(); return; } advance(); } catch (err) { stop(); a.tell(err.message, true); } }, pace); }
    function play() {
      a.guard(); ensure();
      if (playing) { stop(); paint(); return; }
      if (cursor >= actions.length - 1) cursor = -1;
      playing = true; advance();
      if (playing) startTimer();
      paint();
    }
    function handle(el) {
      const op = el.dataset.ssSim; if (!op) return false;
      if (['valuation-add', 'valuation-remove'].includes(op)) { a.guard(); U.editTypes(el); return true; }
      a.guard(); ensure(); if (!snap) return true;
      if (op === 'play') { play(); return true; }
      stop();
      if (op === 'flow') { flowView = ['physical', 'documents', 'split'].includes(el.dataset.view) ? el.dataset.view : 'split'; refresh(); return true; }
      if (op === 'comparison-close') { baseline = null; refresh(); return true; }
      if (op === 'warehouse-transfer') { transfer(el.dataset.from, el.dataset.to); return true; }
      if (op === 'surprise') {
        const receipt = result().events.slice(0, cursor + 1).filter(e => e.status === 'success' && e.action.type === 'gr').at(-1);
        const next = el.dataset.event === 'damage' ? E.action('return', 10, E.tracks(snap.profile) ? 'inventory' : 'consumption', receipt?.action.id || '', 'Ten units arrived damaged. Test a referenced supplier return; QM is outside coverage.') : el.dataset.event === 'partial' ? E.action('gr', Math.min(20, Math.max(1, snap.profile.poQty)), E.tracks(snap.profile) ? 'inventory' : 'consumption', '', 'An additional partial delivery arrives. Check remaining PO quantity and tolerance.') : E.action('issue', 50, 'inventory', '', 'Maintenance urgently requests 50 units. Is stock available at this location?');
        if (snap.profile.batchManaged) next.batch = el.dataset.event === 'damage' ? receipt?.batch || '' : $('ssWarehouseBatch')?.value || '';
        if (snap.profile.splitValuation) next.valuationType = el.dataset.event === 'damage' ? receipt?.valuationType || '' : $('ssWarehouseType')?.value || '';
        insert(next); return true;
      }
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
        if (snap.profile.batchManaged) actions.at(-1).batch = result().final.batches?.[0]?.batch || snap.profile.openingBatch || 'BATCH-001';
        if (snap.profile.splitValuation) actions.at(-1).valuationType = snap.profile.valuationTypes[0]?.code || '';
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
      if (form.id === 'ssTrialProfile') {
        const next = readProfile(form);
        baseline = { profile: E.copy(snap.profile), label: 'Before · ' + (snap.profile.materialType?.code || E.MODES[snap.profile.mode]), version: snap.engineVersion };
        snap.profile = next; snap.engineVersion = E.VERSION; saved = ''; cursor = -1; refresh(); return true;
      }
      const next = E.action(value('type'), Number(value('qty')), value('intent'), value('reference'), value('note').trim()), candidate = E.copy(actions);
      next.location = value('location'); next.toLocation = value('toLocation');
      if (snap.profile.batchManaged) next.batch = value('batch').trim();
      if (snap.profile.splitValuation) next.valuationType = value('valuationType').trim();
      let index = candidate.length;
      if (editing) { index = candidate.findIndex(x => x.id === editing); if (index < 0) throw Error('This transaction was removed.'); next.id = editing; candidate[index] = next; }
      else { if (actions.length >= 40) throw Error('A simulation supports up to 40 transactions.'); candidate.push(next); }
      E.validateActions(candidate); actions = candidate; cursor = index; saved = ''; editing = ''; refresh(); return true;
    }
    document.addEventListener('dragstart', event => {
      const el = event.target.closest?.('[data-ss-stock]'); if (!el) return;
      if (pointerDrag) { event.preventDefault(); return; }
      try { a.guard(); ensure(); stop(); drag = { key, cursor, from: el.dataset.ssStock }; event.dataTransfer?.setData('text/plain', 'mm-studio-stock'); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'; }
      catch (err) { event.preventDefault(); a.tell(err.message, true); }
    });
    document.addEventListener('dragover', event => { if (drag && event.target.closest?.('[data-ss-drop]')) event.preventDefault(); });
    document.addEventListener('drop', event => {
      const zone = event.target.closest?.('[data-ss-drop]'); if (!zone || !drag) return;
      event.preventDefault(); const old = drag; drag = null;
      try { a.guard(); ensure(); if (old.key !== key || old.cursor !== cursor) throw Error('The scenario changed. Pick up the stock again.'); transfer(old.from, zone.dataset.ssDrop); } catch (err) { a.tell(err.message, true); }
    });
    document.addEventListener('dragend', () => { drag = null; });
    // Pointer capture also supports touch and avoids native HTML-drag differences.
    function clearStockDrag() {
      if (pointerDrag) { pointerDrag.ghost?.remove(); try { pointerDrag.source.releasePointerCapture?.(pointerDrag.pointerId); } catch {} }
      pointerDrag = null;
      document.querySelectorAll('.sx-storage-zone.is-drag-over').forEach(el => el.classList.remove('is-drag-over'));
    }
    document.addEventListener('pointerdown', event => {
      const source = event.target.closest?.('[data-ss-stock]'); if (!source || event.button > 0) return;
      try {
        a.guard(); ensure(); stop(); clearStockDrag();
        pointerDrag = { key, cursor, source, from: source.dataset.ssStock, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, ghost: null };
        source.setPointerCapture?.(event.pointerId); event.preventDefault();
      } catch (err) { clearStockDrag(); a.tell(err.message, true); }
    });
    document.addEventListener('pointermove', event => {
      const d = pointerDrag; if (!d || d.pointerId !== event.pointerId) return;
      if (!d.source.isConnected || d.key !== key || d.cursor !== cursor) { clearStockDrag(); return; }
      if (!d.moved && Math.hypot(event.clientX - d.x, event.clientY - d.y) < 7) return;
      d.moved = true; event.preventDefault();
      if (!d.ghost) { d.ghost = document.createElement('div'); d.ghost.className = 'sx-stock-ghost hub-sensitive'; d.ghost.setAttribute('aria-hidden', 'true'); d.ghost.textContent = '▧ Stock from ' + d.from; const host = $('modal')?.open ? $('modal') : document.body; host.append(d.ghost); }
      const host = d.ghost.parentElement, rect = host.getBoundingClientRect();
      d.ghost.style.left = event.clientX - rect.left + host.scrollLeft + 12 + 'px'; d.ghost.style.top = event.clientY - rect.top + host.scrollTop + 12 + 'px';
      const target = document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.('[data-ss-drop]');
      document.querySelectorAll('.sx-storage-zone.is-drag-over').forEach(el => el.classList.remove('is-drag-over')); target?.classList.add('is-drag-over');
    }, { passive: false });
    document.addEventListener('pointerup', event => {
      const d = pointerDrag; if (!d || d.pointerId !== event.pointerId) return;
      const target = document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.('[data-ss-drop]'); clearStockDrag();
      if (!d.moved || !target || target.dataset.ssDrop === d.from) return;
      try { a.guard(); ensure(); if (d.key !== key || d.cursor !== cursor) throw Error('The scenario changed. Pick up the stock again.'); transfer(d.from, target.dataset.ssDrop); } catch (err) { a.tell(err.message, true); }
    });
    document.addEventListener('pointercancel', clearStockDrag);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') clearStockDrag(); });
    document.addEventListener('change', event => {
      if (event.target.id === 'ssSimPace') {
        try { a.guard(); const next = Number(event.target.value), resume = playing; stop(); pace = [6000,3500,2100].includes(next) ? next : 6000; if (resume) { playing = true; startTimer(); } }
        catch (err) { stop(); a.tell(err.message, true); }
        return;
      }
      if (event.target.id === 'ssSimLoop') loop = event.target.checked;
      const form = event.target.form, material = event.target.closest?.('[data-material]');
      if (form && material) {
        const mode = form.elements.namedItem('mode'), detached = !!form.elements.namedItem('detachMaterial')?.checked;
        if (mode) { mode.disabled = !detached; if (!detached) mode.value = M.mode({ quantityUpdate: !!form.elements.namedItem('materialQuantity')?.checked, valueUpdate: !!form.elements.namedItem('materialValue')?.checked }); }
      }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clearStockDrag(); stop(); paint(); } });
    $('modal')?.addEventListener('close', clearStockDrag);
    document.addEventListener('input', event => { if (event.target.closest?.('#ssTrialProfile, #ssTransactionForm')) { stop(); const b = document.querySelector('[data-ss-sim="play"]'); if (b) b.textContent = '▶ Play'; } });
    document.addEventListener('change', event => { if (event.target.closest?.('#ssTrialProfile, #ssStudioForm')) U.sync(event.target.form); });
    document.addEventListener('input', event => { if (event.target.closest?.('[data-valuation-type]')) U.sync(event.target.form); });
    return { render, handle, submit, stop, reset, restore, refresh, play, advance, applyMaterial, snapshot: () => ({ key, snap: snap && E.copy(snap), actions: E.copy(actions), cursor, playing, pace }) };
  }
  root.WorkHubSolutionSimulation = { install, profileFields, readProfile, money, quantity, names };
})(window);
