/**
 * solution-studio.js — Product discovery, AS-IS/TO-BE lanes, proposal decisions and handoff.
 * Demo records are deliberately isolated from account data. Every real edit uses mutate;
 * forms are bound to the opening account/project and an unchanged record snapshot.
 */
(function (root) {
  'use strict';
  const E = root.WorkHubSolutionEngine, D = root.WorkHubSolutionDemo, S = root.WorkHubSolutionSimulation, G = root.WorkHubSolutionGuide;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const uid = () => root.crypto?.randomUUID?.() || 'solution-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const button = (action, label, attrs = '', cls = '') => `<button type="button" class="ss-btn ${cls}" data-ss="${action}" ${attrs}>${label}</button>`;
  const option = (v, label, selected) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`;
  const input = (name, label, value = '', max = 160, required = false) => `<label>${label}<input name="${name}" maxlength="${max}" value="${esc(value)}"${required ? ' required' : ''}></label>`;
  const textarea = (name, label, value = '', max = 8000) => `<label class="ss-wide">${label}<textarea name="${name}" maxlength="${max}" rows="3">${esc(value)}</textarea></label>`;
  const select = (name, label, rows, selected = '', blank = '') => `<label>${label}<select name="${name}">${blank ? option('', blank, selected) : ''}${rows.map(([id, title]) => option(id, title, selected)).join('')}</select></label>`;
  const stamp = at => new Date(at).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' });
  function install(a) {
    let owner = '', pid = '', demo = D.create(), isDemo = true, sourceChosen = false, companyFilter = '', productId = '', processId = '', proposalId = '', pane = 'start', query = '', dialog = null, tour = -1;
    const $ = id => document.getElementById(id), state = () => isDemo ? demo : a.state(), viewPid = () => isDemo ? demo.activeProjectId : pid;
    const rows = () => E.records(state(), viewPid()), process = () => rows().processes.find(p => p.id === processId), proposal = () => rows().proposals.find(p => p.id === proposalId);
    const people = () => (state().workhub.projectPeople?.people || []).filter(p => p.projectId === viewPid());
    const companyName = r => state().projectCompanies.find(c => c.id === r.companyId)?.name || (r.companyName ? 'Former company · ' + r.companyName : 'Project-wide');
    const personName = (id, fallback = '') => people().find(p => p.id === id)?.name || fallback;
    function guard() {
      if (!a.ready() || !a.owner() || owner !== a.owner() || pid !== a.state().activeProjectId || !a.state().projects.some(p => p.id === pid)) throw Error('Reopen Solution Studio after signing in or switching projects.');
      if (document.body.classList.contains('hub-private')) throw Error('Turn off screen privacy before opening or editing business details.');
    }
    const simulator = S.install({
      context: () => ({ d: state(), owner, projectId: pid, demo: isDemo, process: process(), proposal: proposal() }), guard, tell: a.tell,
      keepRun(values) { openForm('run', 'Keep this simulation', input('title', 'Run name', values.title, 160, true) + '<p class="ss-muted">Keeps the exact profile, input transactions and rule version. Reopening replays this snapshot even after the proposal changes.</p>', null, values); },
    });
    const experience = root.WorkHubSolutionExperience.install({
      context: () => ({ owner, pid, projectId: viewPid(), isDemo, d: state(), rows: rows(), productId, process: process(), proposal: proposal() }),
      guard, save, refresh, simulator, tell: a.tell, openModal: a.openModal, closeModal: a.closeModal,
      showPane(next) { simulator.stop(); tour = -1; pane = next; refresh(); document.querySelector('#ssWorkspace .ss-pane-body, #ssWorkspace .sx-material-explorer, #ssWorkspace .sx-design-tools')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); },
      selectProcess(product, process) { simulator.reset(); productId = product; processId = process; proposalId = companyFilter = ''; tour = -1; pane = 'discovery'; refresh(); },
    });
    function selectDefaults() {
      const r = rows(), products = r.products.filter(p => !companyFilter || p.companyId === companyFilter);
      if (productId && !products.some(p => p.id === productId)) productId = '';
      const list = r.processes.filter(p => (!companyFilter || p.companyId === companyFilter) && (!productId || p.productIds.includes(productId)));
      if (!list.some(p => p.id === processId)) processId = list[0]?.id || '';
      if (!r.proposals.some(p => p.id === proposalId && p.processId === processId)) proposalId = r.proposals.find(p => p.processId === processId && p.status === 'Agreed')?.id || r.proposals.find(p => p.processId === processId)?.id || '';
    }
    function sync() {
      if (owner !== a.owner() || pid !== a.state().activeProjectId) {
        simulator.reset(); if (dialog && $('ssStudioForm')) a.closeModal();
        owner = a.owner(); pid = a.state().activeProjectId; dialog = null; query = companyFilter = productId = processId = proposalId = ''; pane = 'start'; tour = -1;
        demo = D.create(); sourceChosen = false; isDemo = !E.records(a.state(), pid).products.length && !E.records(a.state(), pid).processes.length;
        if (isDemo) { productId = 'demo-bearing'; processId = 'demo-process-spares'; }
      }
      if (!sourceChosen && isDemo && (E.records(a.state(), pid).products.length || E.records(a.state(), pid).processes.length)) {
        isDemo = false; productId = processId = proposalId = companyFilter = query = ''; simulator.reset();
      }
      if (!$('ssWorkspace')) simulator.stop();
      selectDefaults(); experience.sync();
    }
    function refresh() {
      const el = $('ssWorkspace'); if (!el) { a.render(); return; }
      const left = document.querySelector('.ss-product-list')?.scrollTop || 0, main = document.querySelector('.ss-main')?.scrollTop || 0;
      el.outerHTML = render(pid);
      if (document.querySelector('.ss-product-list')) document.querySelector('.ss-product-list').scrollTop = left;
      if (document.querySelector('.ss-main')) document.querySelector('.ss-main').scrollTop = main;
    }
    function save(fn, message = 'Blueprint saved.') {
      guard(); let ok;
      if (isDemo) { const next = E.copy(demo); fn(next); E.validate(next); demo = next; ok = true; }
      else ok = a.mutate(fn);
      if (ok) { selectDefaults(); refresh(); a.tell(isDemo ? 'Demo only · ' + message : message); }
      return ok;
    }
    function card(projectId) {
      const r = E.records(a.state(), projectId);
      return `<button class="ss-overview-card" type="button" data-action="project-view" data-view="solution"><span class="ss-overview-symbol" aria-hidden="true">◇</span><span><small>UNDERSTAND · DESIGN · DEMONSTRATE</small><strong>Product &amp; Process Solution Studio</strong><span>${r.products.length} products · ${r.processes.length} processes · ${r.proposals.filter(p => p.status === 'Agreed').length} agreed solutions</span></span><b aria-hidden="true">↗</b></button>`;
    }
    function guideContext() {
      return { isDemo, project: E.project(state(), viewPid()), rows: rows(),
        product: rows().products.find(p => p.id === productId), process: process(), proposal: proposal() };
    }
    function tourBar() { return G.tourNav(tour); }
    function productTray(r) {
      const products = r.products.filter(p => (!companyFilter || p.companyId === companyFilter) && (!query || [p.name, p.code, p.category, p.purpose].join(' ').toLowerCase().includes(query.toLowerCase())));
      const current = r.products.find(p => p.id === productId);
      return `<aside class="ss-product-tray"><div class="ss-tray-title"><span class="ss-eyebrow">START WITH THE PRODUCT</span><h3>Your business, in context</h3><label class="ss-search"><span>⌕</span><input id="ssProductSearch" type="search" maxlength="200" value="${esc(query)}" placeholder="Find a product or group" aria-label="Find a product or group"></label></div><div class="ss-product-list">${button('product-select', '<span>◈</span><span><strong>All products &amp; shared processes</strong><small>See the whole business</small></span>', 'data-id="" aria-pressed="' + !productId + '"', !productId ? 'ss-product-card is-active' : 'ss-product-card')}${products.map((p, i) => button('product-select', `<span class="ss-product-glyph tone-${i % 5}">${['▧', '▦', '◒', '⚙', '◇'][i % 5]}</span><span><small>${esc(p.category || 'Product / group')}</small><strong>${esc(p.name)}</strong><small>${esc(p.code)} · ${r.processes.filter(x => x.productIds.includes(p.id)).length} processes</small></span>`, `data-id="${esc(p.id)}" aria-pressed="${p.id === productId}"`, 'ss-product-card' + (p.id === productId ? ' is-active' : ''))).join('') || '<p class="ss-muted">No matching products.</p>'}</div><div class="ss-tray-footer">${button('product-new', '+ Product / group', '', 'ss-wide-btn')}${current ? button('product-edit', 'Edit product profile', `data-id="${esc(current.id)}"`, 'ss-wide-btn') : ''}</div>${current ? `<div class="ss-product-context"><span class="ss-eyebrow">${esc(current.code || current.category)}</span><h4>${esc(current.name)}</h4><p>${esc(current.purpose) || 'Add its business purpose.'}</p><dl><dt>Location</dt><dd>${esc(current.location) || 'Not recorded'}</dd><dt>Business owner</dt><dd>${esc(personName(current.ownerId)) || 'Not assigned'}</dd><dt>Inventory today</dt><dd>${esc(E.TRACKING[current.currentTracking])}</dd><dt>Base unit</dt><dd>${esc(current.unit)}</dd><dt>Company</dt><dd>${esc(companyName(current))}</dd></dl></div>` : ''}</aside>`;
    }
    function processStrip(r) {
      const list = r.processes.filter(p => (!companyFilter || p.companyId === companyFilter) && (!productId || p.productIds.includes(productId)));
      return `<div class="ss-process-heading"><div><span class="ss-eyebrow">CHOOSE A BUSINESS PROCESS</span><h3>${productId ? 'Follow its journey' : 'The connected process library'}</h3></div>${button('process-new', '+ Process')}</div><div class="ss-process-strip">${list.map(p => button('process-select', `<span>${p.scenario === 'procurement' ? '↗' : '◇'}</span><span><strong>${esc(p.name)}</strong><small>${p.productIds.length > 1 ? p.productIds.length + ' products · ' : ''}${p.scenario === 'procurement' ? 'MM simulation available' : 'Discovery & specialist design'}</small></span>`, `data-id="${esc(p.id)}" aria-pressed="${p.id === processId}"`, p.id === processId ? 'is-active' : '')).join('') || '<p class="ss-muted">Capture the first process for this product or company.</p>'}</div>`;
    }
    function stepCard(s, index, lane) {
      const proposed = lane === 'to', p = process();
      return `<article class="ss-step-card ${proposed ? 'is-proposed' : ''}"><button class="ss-step-open" type="button" data-ss="step-view" data-lane="${lane}" data-id="${esc(s.id)}"><span class="ss-step-number">${String(index + 1).padStart(2, '0')}</span><span><small>${esc(personName(s.actorId, s.actor) || 'Business user not assigned')}</small><strong>${esc(s.title)}</strong><span>${esc(s.detail) || 'Add process details.'}</span></span></button>${experience.ruleBadges(s.id)}${s.pain ? `<p class="ss-step-pain">${proposed ? '◇' : '!'} ${esc(s.pain)}</p>` : ''}<div class="ss-step-footer"><span>${proposed ? (s.sourceIds.length ? 'Addresses ' + s.sourceIds.map(id => p.steps.findIndex(x => x.id === id) + 1).join(', ') : 'New SAP step') : 'Current practice'}</span><div>${button('step-up', '↑', `data-lane="${lane}" data-id="${esc(s.id)}" aria-label="Move ${esc(s.title)} up"`)}${button('step-down', '↓', `data-lane="${lane}" data-id="${esc(s.id)}" aria-label="Move ${esc(s.title)} down"`)}</div></div></article>`;
    }
    function lanes(p, proposed) {
      const n = Math.max(1, p.steps.length, proposed?.steps.length || 0), height = n * 184;
      const paths = (proposed?.steps || []).flatMap((s, i) => s.sourceIds.map(id => {
        const from = p.steps.findIndex(x => x.id === id); if (from < 0) return '';
        const y = (from * 184 + 76) / height * 1000, y2 = (i * 184 + 76) / height * 1000;
        return `<path d="M0 ${y} C40 ${y},40 ${y2},80 ${y2}"/>`;
      })).join('');
      return `<div class="ss-lane-headings"><div><span class="ss-lane-dot"></span><strong>AS-IS</strong><span>How the business works today</span>${button('step-new', '+ Step', 'data-lane="as"')}</div><div><span class="ss-lane-dot to-be"></span><strong>TO-BE</strong><span>Your proposed SAP approach</span>${proposed ? button('step-new', '+ Step', 'data-lane="to"') : ''}</div></div><div class="ss-lanes" style="--ss-lane-height:${height}px"><div class="ss-lane">${p.steps.map((s, i) => stepCard(s, i, 'as')).join('') || '<div class="ss-lane-empty">Capture the current steps to understand the business.</div>'}</div><svg class="ss-mapping-lines" viewBox="0 0 80 1000" preserveAspectRatio="none" aria-label="Connections from current steps to proposed steps">${paths}</svg><div class="ss-lane">${proposed ? proposed.steps.map((s, i) => stepCard(s, i, 'to')).join('') || '<div class="ss-lane-empty">Add the SAP steps and map them to current practice.</div>' : `<div class="ss-lane-empty"><span>◇</span><h4>Make room for a better approach.</h4><p>Your current business process stays separate from each proposal.</p>${button('proposal-new', '+ First proposal', '', 'ss-primary')}</div>`}</div></div>`;
    }
    function discovery(p, proposed) {
      return `<section class="ss-discovery"><div class="ss-section-head"><div><span class="ss-eyebrow">BUSINESS DISCOVERY</span><h3>${esc(p.name)}</h3></div>${button('process-edit', 'Edit process', `data-id="${esc(p.id)}"`)}</div><p class="ss-objective">${esc(p.objective) || 'Describe the business outcome this process needs to achieve.'}</p><div class="ss-context-pills"><span>${esc(companyName(p))}</span><span>${esc(personName(p.ownerId) || 'Owner not assigned')}</span><span>${esc(E.project(state(), viewPid()).mmAreas.find(a => a.id === p.areaId)?.name || 'MM area not assigned')}</span></div>${lanes(p, proposed)}<div class="ss-discovery-bottom"><section><div class="ss-section-head"><h4>Requirements &amp; acceptance</h4>${button('requirement-new', '+ Requirement')}</div>${p.requirements.map((r, i) => `<article class="ss-requirement"><span>R${i + 1}</span><div><strong>${esc(r.text)}</strong><p>${esc(r.acceptance) || 'Define how the business will confirm success.'}</p></div>${button('requirement-edit', '✎', `data-id="${esc(r.id)}" aria-label="Edit requirement ${i + 1}"`)}</article>`).join('') || '<p class="ss-muted">Capture what the solution must achieve.</p>'}</section><section><span class="ss-eyebrow">WHAT COULD BE DIFFERENT?</span><h4>Exceptions &amp; open questions</h4><p class="ss-prewrap">${esc(p.exceptions) || 'Record unusual situations, volumes, integration questions and exceptions.'}</p></section></div></section>`;
    }
    function proposalView(p, selected) {
      const alternatives = rows().proposals.filter(x => x.processId === p.id);
      return `<div class="ss-section-head"><div><span class="ss-eyebrow">DESIGN THE ALTERNATIVES</span><h3>One business need. Different approaches.</h3></div>${button('proposal-new', '+ Proposal', '', 'ss-primary')}</div><div class="ss-proposal-cards">${alternatives.map(x => `<article class="ss-proposal-card${x.id === proposalId ? ' is-active' : ''}"><span class="ss-status ${x.status === 'Agreed' ? 'is-agreed' : ''}">${esc(x.status)}</span><h4>${esc(x.title)}</h4><span class="ss-muted">${esc(x.system)} · ${esc(E.MODES[x.profile.mode])}</span><p>${esc(x.approach)}</p><dl><dt>Benefits</dt><dd>${esc(x.benefits) || 'Not recorded'}</dd><dt>Trade-offs</dt><dd>${esc(x.limitations) || 'Not recorded'}</dd></dl><div class="ss-actions">${button('proposal-select', x.id === proposalId ? 'Selected ✓' : 'Explore this option', `data-id="${esc(x.id)}"`, x.id === proposalId ? 'ss-primary' : '')}${button('proposal-copy', 'Duplicate', `data-id="${esc(x.id)}"`)}</div></article>`).join('') || '<p class="ss-muted">Create your first proposal for this business process.</p>'}</div>${selected ? `<section class="ss-design-detail"><div class="ss-section-head"><div><span class="ss-eyebrow">SELECTED DESIGN</span><h3>${esc(selected.title)}</h3></div><div class="ss-actions">${button('proposal-edit', 'Edit proposal', `data-id="${esc(selected.id)}"`)}${button('pane', '▷ Simulate', 'data-pane="simulation"', 'ss-primary')}</div></div><div class="ss-design-grid">${[['Assumptions', selected.assumptions], ['Configuration & integration', selected.configNotes]].map(([label, value]) => `<section><h4>${label}</h4><p class="ss-prewrap">${esc(value) || 'Not recorded'}</p></section>`).join('')}</div><h4>Requirement coverage</h4>${p.requirements.map((r, i) => `<div class="ss-coverage"><span class="${selected.requirementIds.includes(r.id) ? 'is-covered' : ''}">${selected.requirementIds.includes(r.id) ? '✓' : '?'}</span><div><strong>R${i + 1} · ${esc(r.text)}</strong><p>${selected.requirementIds.includes(r.id) ? 'Claimed coverage · confirm through business review and SAP testing.' : 'Not mapped to this proposal yet.'}</p></div></div>`).join('')}<div class="ss-actions">${button('decision', 'Record business feedback', '', 'ss-primary')}${button('compare', 'Compare simulation outcomes')}</div></section>` : ''}`;
    }
    function decisionsView(p, selected) {
      const r = rows(), decisions = r.decisions.filter(x => r.proposals.some(s => s.id === x.proposalId && s.processId === p.id)), work = selected && r.deliveries.find(x => x.proposalId === selected.id);
      return `<div class="ss-section-head"><div><span class="ss-eyebrow">KEEP THE REASONING CONNECTED</span><h3>Decisions, evidence &amp; delivery</h3></div>${selected ? button('decision', '+ Business feedback', '', 'ss-primary') : ''}</div><div class="ss-review-grid"><section><h4>Business decision trail</h4>${decisions.slice().reverse().map(x => `<article class="ss-decision"><span class="ss-status${x.outcome === 'Agreed' ? ' is-agreed' : ''}">${esc(x.outcome)}</span><h4>${esc(r.proposals.find(p => p.id === x.proposalId)?.title)}</h4><p class="ss-prewrap">${esc(x.note)}</p><small>${esc(x.by)} · ${esc(stamp(x.at))} MYT</small><details><summary>Design snapshot at this decision</summary><pre>${esc(JSON.stringify(JSON.parse(x.snapshot), null, 2))}</pre></details></article>`).join('') || '<p class="ss-muted">Record business feedback, changes requested and agreement here.</p>'}</section><section class="ss-handoff"><span class="ss-eyebrow">FROM AGREEMENT TO ACTION</span><h4>${selected ? esc(selected.title) : 'Choose a proposal'}</h4><p>Create a project item and three linked tasks, with the process acceptance criteria kept as test notes.</p>${selected ? work ? `<p class="ss-success-note">Delivery work is linked. Reopening creates no duplicates.</p>${button('delivery-view', 'Open delivery links', `data-id="${esc(work.id)}"`, 'ss-primary')}` : selected.status === 'Agreed' && !isDemo ? button('delivery', 'Create delivery work ↗', '', 'ss-primary') : `<p class="ss-muted">${isDemo ? 'Demo decisions stay in the sample. Switch to My workspace to create real delivery work.' : 'Record business agreement before creating delivery work.'}</p>` : ''}<h4>Saved simulation evidence</h4><p>${r.runs.length} saved runs in this ${isDemo ? 'demo' : 'project'}. Each keeps its original profile and transactions.</p>${button('runs', 'Browse saved runs')}</section></div>`;
    }
    function render(projectId) {
      sync(); pid = projectId; selectDefaults();
      const r = rows(), p = process(), proposed = proposal(), c = guideContext(),
        companies = state().projectCompanies.filter(c => c.projectId === viewPid());
      // The welcome page keeps the tool catalogue out of the first learning step.
      let content;
      if (pane === 'start') content = G.overview(c);
      else if (pane === 'materials') content = experience.renderMaterials();
      else if (pane === 'tools') content = experience.renderTools();
      else if (!p) content = `<div class="ss-empty"><span>◇</span><h3>Begin with a product and a business process.</h3><p>Capture what the business works with, then record how the work happens today.</p><div class="ss-actions">${button('product-new', '+ Product / group', '', 'ss-primary')}${button('process-new', '+ Shared process')}${button('tour', 'Learn with the complete sample')}</div></div>`;
      else content = pane === 'discovery' ? discovery(p, proposed) : pane === 'proposals' ? proposalView(p, proposed) : pane === 'simulation' ? simulator.render() : decisionsView(p, proposed);
      const selection = pane !== 'start' && proposed ? `<div class="ss-selected-proposal"><label>Selected solution · used by the simulator<select id="ssProposalSelect">${r.proposals.filter(x => x.processId === p.id).map(x => option(x.id, x.title + ' · ' + x.status, proposalId)).join('')}</select></label><div class="ss-actions">${button('proposal-new', '+ Alternative')}${button('proposal-edit', 'Edit design', `data-id="${esc(proposed.id)}"`)}</div></div>` : '';
      const navigation = pane === 'start' ? '' : tour >= 0 ? `<div class="sg-walkthrough-screen"><span>Learning in the actual ${pane === 'simulation' ? 'simulator' : pane === 'proposals' ? 'solution options' : pane === 'decisions' ? 'review screen' : 'business process'} below</span>${button('pane', 'Start here', 'data-pane="start"')}</div>` : G.navigation(pane);
      return `<section id="ssWorkspace" class="ss-workspace sg-readable hub-sensitive">
        <header class="ss-hero${pane === 'start' ? ' sg-compact-hero' : ''}"><div><span class="ss-eyebrow">PROJECTS / SOLUTION STUDIO</span><h2>${pane === 'start' ? 'Solution Studio' : 'From a business process<br><em>to a clear SAP solution.</em>'}</h2><p>Capture today’s work, compare your options, test the consequences and keep the business decision connected.</p><div class="ss-hero-stats"><span><b>${r.products.length}</b> products / groups</span><span><b>${r.processes.length}</b> processes</span><span><b>${r.proposals.length}</b> proposed solutions</span></div></div><div class="ss-hero-art" aria-hidden="true"><i></i><span class="ss-art-card a"><small>WHAT THEY WORK WITH</small><b>▧ Product</b></span><span class="ss-art-card b"><small>HOW WORK HAPPENS</small><b>↗ Process</b></span><span class="ss-art-card c"><small>YOUR PROPOSED DESIGN</small><b>◇ SAP solution</b></span><b class="ss-hero-star">✦</b></div></header>
        <div class="ss-workspace-toolbar"><div class="ss-mode-switch" role="group" aria-label="Blueprint data source">${button('mine', 'My workspace', `aria-pressed="${!isDemo}"`, !isDemo ? 'is-active' : '')}${button('demo', '✦ Demo business', `aria-pressed="${isDemo}"`, isDemo ? 'is-active' : '')}</div><label class="ss-company-filter"><span class="ss-sr-only">Filter company</span><select id="ssCompanyFilter">${option('', 'All companies / project-wide', companyFilter)}${companies.map(c => option(c.id, c.name, companyFilter)).join('')}</select></label><div class="ss-actions">${pane === 'start' ? button('rules', 'Rules & coverage') + button('runs', 'Saved runs') : button('pane', 'Start here', 'data-pane="start"') + button('tour', 'Guided sample walkthrough') + button('glossary', 'Explain the words') + button('rules', 'Rules & coverage') + button('runs', 'Saved runs')}</div></div>
        ${isDemo ? `<div class="ss-demo-banner"><span>✦</span><div><strong>Meridian Food Manufacturing · Fictional demo business</strong><p>Explore the complete example. Demo edits stay in this page session. Use My workspace for your actual project.</p></div><div class="ss-actions">${button('sample-copy', 'Use as starting point')}${button('demo-reset', 'Reset demo')}</div></div>` : `<div class="ss-own-banner"><span>◇</span><p>Your project’s products, processes, proposals and decisions. Use the complete sample whenever you want a worked example.</p></div>`}
        ${tourBar()}
        <details class="sg-shortcuts"><summary>Quick tools · material profiles, discovery interview &amp; workshop</summary><div class="sx-entry-bar"><div class="ss-actions"><button class="ss-btn" type="button" data-sx="explorer">Material explorer</button><button class="ss-btn" type="button" data-sx="interview">Discovery interview</button><button class="ss-btn" type="button" data-sx="tools">Design tools</button><button class="ss-btn ss-primary" type="button" data-sx="workshop">Present workshop ↗</button></div></div></details>
        <div class="ss-body${pane === 'start' ? ' sg-start-layout' : ''}">${pane === 'start' ? '' : productTray(r)}<main class="ss-main">
          ${navigation}
          ${pane !== 'start' ? G.context(c) + (tour >= 0 ? G.lesson(tour, c) : G.intro(pane, c)) + processStrip(r) : ''}
          ${selection}<div class="ss-pane-body">${content}</div>
        </main></div><footer class="ss-footer"><span>Business story → solution options → test → review → delivery</span><span>${isDemo ? 'Fictional sample · local session' : 'Private project records'} · Core MM learning model</span></footer></section>`;
    }
    function openForm(kind, title, fields, row = null, extra = null) {
      guard(); const token = uid(); dialog = { kind, token, owner, pid, isDemo, id: row?.id || '', snapshot: row ? JSON.stringify(row) : '', extra, processId, proposalId };
      const collection = { product: 'products', process: 'processes', proposal: 'proposals' }[kind];
      const remove = row && collection ? button('record-delete', 'Remove record', `data-collection="${collection}" data-id="${esc(row.id)}"`) : row && kind === 'requirement' && extra.requirementId ? button('requirement-delete', 'Remove requirement', `data-id="${esc(extra.requirementId)}"`) : '';
      a.openModal(title, `<form id="ssStudioForm" class="ss-form" data-ss-token="${token}">${G.formHelp(kind)}<div class="ss-form-grid">${fields}</div><div class="ss-form-footer"><span>${isDemo ? 'Demo only · not saved to your account' : 'Saved with your private project'}</span><div class="ss-actions">${remove}${button('cancel-form', 'Cancel')}<button type="submit" class="ss-btn ss-primary">${kind === 'delivery' ? 'Create linked work' : kind === 'sample-copy' ? 'Copy sample into project' : kind === 'delete' ? 'Remove record' : 'Save'}</button></div></div></form>`);
    }
    const companyRows = () => state().projectCompanies.filter(c => c.projectId === viewPid()).map(c => [c.id, c.name]);
    const peopleRows = () => people().map(p => [p.id, p.name + (p.department ? ' · ' + p.department : '')]);
    function productEditor(id = '') {
      const old = rows().products.find(p => p.id === id), p = old || { name: '', code: '', category: '', currentTracking: 'unknown', unit: 'EA', purpose: '', location: '', ownerId: '', companyId: companyFilter };
      openForm('product', old ? 'Edit product / group' : 'Capture a product / group', input('name', 'Product / group name', p.name, 160, true) + input('code', 'Business reference / material code', p.code, 100) + select('companyId', 'Company', companyRows(), p.companyId, 'Project-wide / unassigned') + input('category', 'Product category', p.category, 120) + select('currentTracking', 'Current inventory approach', Object.entries(E.TRACKING), p.currentTracking) + input('unit', 'Base unit', p.unit, 20, true) + select('ownerId', 'Business owner', peopleRows(), p.ownerId, 'Not assigned') + input('location', 'Business location / plant / store', p.location, 200) + textarea('purpose', 'Business purpose and context', p.purpose), old);
    }
    function productChecks(selected, companyId) {
      return rows().products.filter(p => p.companyId === companyId).map(p => `<label class="ss-check"><input name="productIds" type="checkbox" value="${esc(p.id)}"${selected.includes(p.id) ? ' checked' : ''}>${esc(p.name)}</label>`).join('') || '<p class="ss-muted">No products in this company. A shared process can be captured first.</p>';
    }
    function processEditor(id = '') {
      const old = rows().processes.find(p => p.id === id), selectedProduct = rows().products.find(p => p.id === productId), p = old || { name: '', companyId: selectedProduct?.companyId || companyFilter, areaId: '', ownerId: '', objective: '', exceptions: '', scenario: 'procurement', productIds: selectedProduct ? [productId] : [] };
      const company = select('companyId', 'Company', companyRows(), p.companyId, 'Project-wide / unassigned').replace('<select ', '<select id="ssProcessCompany" ');
      openForm('process', old ? 'Edit business process' : 'Capture a business process', input('name', 'Process name', p.name, 160, true) + company + select('areaId', 'Maintained MM area', E.project(state(), viewPid()).mmAreas.map(x => [x.id, x.name + (x.visible ? '' : ' · hidden')]), p.areaId, 'Not assigned') + select('ownerId', 'Process owner', peopleRows(), p.ownerId, 'Not assigned') + select('scenario', 'Simulation coverage', [['procurement', 'Core MM procurement / inventory'], ['context', 'Discovery / specialist process · outside simulator']], p.scenario) + `<fieldset class="ss-wide"><legend>Products using this process · choose several, or leave empty for shared context</legend><div id="ssProcessProducts" class="ss-check-grid">${productChecks(p.productIds, p.companyId)}</div></fieldset>` + textarea('objective', 'Business objective / expected outcome', p.objective) + textarea('exceptions', 'Exceptions, volumes, questions and integration dependencies', p.exceptions), old);
    }
    function proposalEditor(id = '') {
      const p = process(); if (!p) throw Error('Select a business process first.');
      const currentProduct = rows().products.find(x => x.id === productId) || rows().products.find(x => p.productIds.includes(x.id));
      const old = rows().proposals.find(x => x.id === id), s = old || { title: '', status: 'Exploring', system: 'S/4HANA', release: '', approach: '', benefits: '', limitations: '', assumptions: '', configNotes: '', requirementIds: [], profile: E.profile(Object.hasOwn(E.MODES, currentProduct?.currentTracking) ? currentProduct.currentTracking : 'valuated') };
      openForm('proposal', old ? 'Edit proposed SAP solution' : 'Propose a SAP approach', input('title', 'Proposal title', s.title, 160, true) + select('status', 'Design maturity', E.STATUS.map(x => [x, x]), s.status) + select('system', 'Target SAP context', E.SYSTEMS.map(x => [x, x]), s.system) + input('release', 'Release / deployment notes', s.release, 100) + textarea('approach', 'Proposed SAP approach', s.approach) + textarea('benefits', 'Business benefits', s.benefits) + textarea('limitations', 'Trade-offs / gaps / development needs', s.limitations) + textarea('assumptions', 'Assumptions and dependencies', s.assumptions) + textarea('configNotes', 'Configuration, tcodes and integration notes', s.configNotes) + `<fieldset class="ss-wide"><legend>Requirements this proposal addresses</legend>${p.requirements.map((r, i) => `<label class="ss-check"><input name="requirementIds" type="checkbox" value="${esc(r.id)}"${s.requirementIds.includes(r.id) ? ' checked' : ''}>R${i + 1} · ${esc(r.text)}</label>`).join('') || '<p class="ss-muted">Add requirements from Current & proposed.</p>'}</fieldset><details class="ss-wide ss-profile-editor"><summary>Simulation assumptions · quantities, prices &amp; PO controls</summary><p class="ss-muted">These defaults supply the learning model for this proposal. Save the written design with the values below, or expand and review them before testing.</p>${S.profileFields(s.profile, 'ssProposal')}</details><p class="ss-wide ss-muted">Business agreement is recorded in Review & deliver. Editing an agreed proposal or its source process returns it to Under review.</p>`, old, { sourceSnapshot: JSON.stringify(p) });
    }
    function stepEditor(lane, id = '') {
      const parent = lane === 'to' ? proposal() : process(); if (!parent) throw Error('Choose a process and proposal first.');
      const old = parent.steps.find(x => x.id === id), s = old || { title: '', actorId: '', actor: '', detail: '', pain: '', sourceIds: [] };
      openForm('step', lane === 'to' ? 'Proposed SAP process step' : 'Current business process step', input('title', 'Step title', s.title, 160, true) + select('actorId', 'Responsible business user', peopleRows(), s.actorId, 'Use role / free text below') + input('actor', 'Role / person if not maintained', s.actor, 160) + textarea('detail', lane === 'to' ? 'How the proposed SAP step works' : 'What happens today · systems, documents and handovers', s.detail) + textarea('pain', lane === 'to' ? 'Design question / important note' : 'Pain point / business requirement', s.pain, 2000) + input('referenceLabel', 'Screenshot / document reference name', s.referenceLabel || '', 160) + input('referenceUrl', 'Reference link · http/https, including Drive links', s.referenceUrl || '', 2000) + (lane === 'to' ? `<fieldset class="ss-wide"><legend>Current steps addressed · select several</legend>${process().steps.map((r, i) => `<label class="ss-check"><input name="sourceIds" type="checkbox" value="${esc(r.id)}"${s.sourceIds.includes(r.id) ? ' checked' : ''}>${i + 1} · ${esc(r.title)}</label>`).join('')}</fieldset>` : ''), parent, { lane, stepId: id });
    }
    function requirementEditor(id = '') {
      const p = process(); if (!p) throw Error('Select a process.'); const old = p.requirements.find(x => x.id === id);
      openForm('requirement', 'Business requirement & acceptance', textarea('text', 'What must the solution achieve?', old?.text || '', 2000) + textarea('acceptance', 'How will the business confirm it works?', old?.acceptance || '', 2000), p, { requirementId: id });
    }
    function decisionEditor() {
      const p = proposal(); if (!p) throw Error('Select a proposal first.');
      openForm('decision', 'Record business feedback', select('outcome', 'Review outcome', [['Under review', 'Under review'], ['Changes requested', 'Changes requested'], ['Agreed', 'Agreed']], 'Under review') + input('by', 'Business reviewer / decision owner', '', 160, true) + textarea('note', 'Feedback, reasoning, open conditions and next actions'), p, { sourceSnapshot: JSON.stringify(process()) });
    }
    function showStep(lane, id) {
      const parent = lane === 'to' ? proposal() : process(), s = parent?.steps.find(x => x.id === id);
      if (!s) throw Error('This step no longer exists.');
      a.openModal(lane === 'to' ? 'Proposed SAP step' : 'Current business step', `<div class="ss-detail"><span class="ss-eyebrow">${lane === 'to' ? 'TO-BE' : 'AS-IS'} · ${esc(personName(s.actorId, s.actor) || 'Owner not assigned')}</span><h3>${esc(s.title)}</h3><p class="ss-prewrap">${esc(s.detail) || 'No details yet.'}</p><h4>${lane === 'to' ? 'Design note' : 'Pain point / requirement'}</h4><p class="ss-prewrap">${esc(s.pain) || 'Not recorded.'}</p>${lane === 'to' ? `<h4>Current steps addressed</h4><ul>${s.sourceIds.map(id => `<li>${esc(process().steps.find(x => x.id === id)?.title)}</li>`).join('') || '<li>New step / no mapping yet.</li>'}</ul>` : ''}${s.referenceUrl ? `<p><a href="${esc(s.referenceUrl)}" target="_blank" rel="noopener noreferrer">${esc(s.referenceLabel || 'Open screenshot / document')} ↗</a></p>` : ''}<div class="ss-actions">${button('step-edit', 'Edit step', `data-lane="${lane}" data-id="${esc(id)}"`, 'ss-primary')}${button('step-delete', 'Remove step', `data-lane="${lane}" data-id="${esc(id)}"`)}</div></div>`);
    }
    function openDelete(collection, id, label, child = null) {
      const row = rows()[collection].find(r => r.id === id); if (!row) throw Error('This record no longer exists.');
      openForm('delete', 'Remove blueprint record', `<p class="ss-wide">Remove <strong>${esc(label)}</strong>? ${child ? 'Any links to this step or requirement will also be removed.' : collection === 'products' ? 'Processes remain and this product is detached from them.' : collection === 'processes' ? 'Its proposals and decisions are removed. Saved simulation snapshots remain available.' : 'Its decision trail is removed. Saved simulation snapshots remain available.'} Delivery-linked proposals must be retained for traceability.</p>`, row, { collection, child });
    }
    function showRules() {
      a.openModal('Simulation rules & supported coverage', `<div class="ss-rules"><span class="ss-eyebrow">${esc(E.VERSION)} · REVIEWED 21 OCTOBER 2026</span><h3>Understand the rule before trusting the result.</h3><p>A source-based learning model for a defined core MM scenario. The ECC/S/4HANA selector records your target context; it does not reproduce every release or configuration.</p>${E.RULES.map(([code, title, detail, source]) => `<article><span>${esc(code)}</span><h4>${esc(title)}</h4><p>${esc(detail)}</p>${source >= 0 ? `<a href="${esc(E.SOURCES[source][1])}" target="_blank" rel="noopener noreferrer">SAP source · ${esc(E.SOURCES[source][0])} ↗</a>` : ''}</article>`).join('')}<article><span>DOCUMENT CONTROL</span><h4>PO goods receipt expected</h4><p>The model blocks GR when its PO profile has GR disabled. This is independent of the GR non-valuated indicator, whose accounting timing is not covered. Messages use simulator rule codes, not purported SAP message numbers.</p><a href="https://help.sap.com/docs/PRODUCT_ID/91b21005dded4984bcccf4a69ae1300c/9763bd534f22b44ce10000000a174cb4.html" target="_blank" rel="noopener noreferrer">SAP source · Planning goods receipts ↗</a></article><article><span>MODEL LIMITS</span><h4>Explicit assumptions</h4><p>One product/base unit and PO item, one plant and two existing storage locations; fixed standard price where applicable; MYR; unrestricted stock; single K cost-centre assignment; complete automatic account determination. Cumulative balances use integer sen and quantity thousandths to avoid rounding drift.</p><p>Not covered: moving-average price, invoice/credit memo, tax/freight, FX, multiple assignments, posting periods/authorisations, services, QM/EWM, special stock, cross-plant/material/stock-type transfers, two-step transfers, production orders, sales/customer returns and live SAP configuration checks. These are reported as outside the model, not as valid postings.</p><p>Cancellation is limited to the last active GR/GI/311. This is a simulator restriction. Physical supplier return 122 is a separate action and must reference an eligible successful receipt. Delivery completed is not treated as an unconditional GR block.</p></article></div>`);
    }
    function compare() {
      const p = process(), selected = proposal(); if (!p || !selected) throw Error('Choose a proposal to compare.');
      const receipt = E.action('gr', 100), actions = [receipt, E.action('issue', 30), E.action('return', 10, 'inventory', receipt.id)];
      const options = rows().proposals.filter(x => x.processId === p.id);
      a.openModal('Compare proposed scenario outcomes', `<div class="ss-comparison"><span class="ss-eyebrow">SAME QUANTITIES · DIFFERENT PROPOSALS</span><h3>Receive 100. Issue 30. Return 10.</h3><p>Receipt destination adapts to each proposal’s stock or consumption purpose. Prices, assignments and tolerances use each proposal’s own profile. A later stock issue can fail for a non-stock approach.</p><div class="ss-table-scroll"><table><thead><tr><th>Proposal</th><th>Stock quantity</th><th>Inventory value</th><th>Consumption cost</th><th>Price difference</th><th>Blocked / outside scope</th></tr></thead><tbody>${options.map(x => {
        const r = E.simulate(x.profile, actions.map(a => ({ ...a, intent: E.tracks(x.profile) ? 'inventory' : 'consumption' })), p.scenario);
        const failures = r.events.filter(e => e.status !== 'success');
        return `<tr><th>${esc(x.title)}</th><td>${S.quantity(r.final.qty)}</td><td>${S.money(r.final.inventory)}</td><td>${S.money(r.final.expense)}</td><td>${S.money(r.final.variance)}</td><td>${failures.length ? failures.map(e => esc((S.names[e.action.type] || e.action.type) + ': ' + e.message)).join('<br>') : 'All three passed'}</td></tr>`;
      }).join('')}</tbody></table></div><p class="ss-muted">This comparison explains consequences under recorded assumptions. It does not rank options automatically or verify them against a live SAP system.</p></div>`);
    }
    function showRuns() {
      const list = rows().runs.slice().reverse();
      a.openModal('Saved simulation runs', `<div class="ss-saved-runs"><span class="ss-eyebrow">INPUTS, ASSUMPTIONS &amp; RESULTS YOU CAN REPLAY</span><h3>${isDemo ? 'Demo examples' : 'Project simulation evidence'}</h3>${list.map(r => `<article><div><h4>${esc(r.title)}</h4><p>${esc(r.snapshot.productName)} · ${esc(r.snapshot.processName)}</p><small>${esc(stamp(r.at))} MYT · ${r.actions.length} transactions · ${esc(r.snapshot.engineVersion)}</small></div>${button('run-open', 'Replay ↗', `data-id="${esc(r.id)}"`, 'ss-primary')}</article>`).join('') || '<p>Keep a run from the Simulator to retain its exact inputs.</p>'}</div>`);
    }
    function showDelivery(id) {
      const work = rows().deliveries.find(x => x.id === id); if (!work) throw Error('Delivery links no longer exist.');
      const d = state(), item = d.specs.find(x => x.id === work.itemId);
      a.openModal('Solution delivery links', `<div class="ss-delivery-detail"><span class="ss-eyebrow">AGREED DESIGN → IMPLEMENTATION → TEST EVIDENCE</span><h3>Keep the business reason connected.</h3><h4>Project item</h4>${item ? button('open-item', esc(item.description) + ' ↗', `data-id="${esc(item.id)}"`) : '<p>The linked project item was removed; the original link is retained.</p>'}<h4>Tasks</h4>${work.taskIds.map(id => { const task = d.tasks.find(t => t.id === id); return task ? `<p>${button('open-task', esc(task.task) + ' ↗', `data-id="${esc(id)}"`)} <span class="ss-muted">${task.done ? 'Completed' : 'Open'}</span></p>` : '<p class="ss-muted">Linked task removed.</p>'; }).join('')}<h4>Acceptance tests captured at handoff</h4>${work.tests.map(t => `<article class="ss-requirement"><div><strong>${esc(t.title)}</strong><p>${esc(t.expected) || 'Acceptance criteria not yet recorded.'}</p></div></article>`).join('') || '<p>Add acceptance tests to the project item before SAP testing.</p>'}</div>`);
    }
    function openRun(id) {
      const run = rows().runs.find(r => r.id === id); if (!run) throw Error('This saved run no longer exists.');
      const p = rows().proposals.find(x => x.id === run.proposalId);
      if (p) { processId = p.processId; productId = companyFilter = ''; proposalId = p.id; pane = 'simulation'; a.closeModal(); refresh(); simulator.restore(run); simulator.refresh(); }
      else { simulator.restore(run); a.openModal('Archived simulation snapshot', simulator.render()); }
    }
    function moveStep(lane, id, delta) {
      const parent = lane === 'to' ? proposal() : process(), collection = lane === 'to' ? 'proposals' : 'processes';
      if (!parent) throw Error('Select the process first.'); const index = parent.steps.findIndex(x => x.id === id), target = index + delta;
      if (index < 0 || target < 0 || target >= parent.steps.length) return;
      save(d => { const next = E.copy(E.data(d)[collection].find(x => x.id === parent.id)); [next.steps[index], next.steps[target]] = [next.steps[target], next.steps[index]]; E.upsert(d, collection, next); }, 'Step order saved.');
    }
    function setTour(index) {
      simulator.stop(); sourceChosen = true; isDemo = true; tour = index; companyFilter = query = ''; productId = 'demo-bearing'; processId = 'demo-process-spares'; proposalId = 'demo-proposal-spares-valuated';
      pane = index < 2 ? 'discovery' : index === 2 ? 'proposals' : index < 5 ? 'simulation' : 'decisions';
      if (index === 4) proposalId = 'demo-proposal-spares-nonstock';
      simulator.reset(); refresh();
      if (index === 4) { const run = rows().runs.find(x => x.proposalId === 'demo-proposal-spares-nonstock'); if (run) { simulator.restore(run); simulator.refresh(); } }
      document.querySelector('.sg-lesson')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    }
    function handle(el) {
      const op = el.dataset.ss; if (!op) return false; guard();
      if (['mine', 'demo'].includes(op)) { simulator.reset(); sourceChosen = true; isDemo = op === 'demo'; productId = processId = proposalId = companyFilter = query = ''; tour = -1; pane = 'start'; refresh(); return true; }
      if (op === 'demo-reset') { simulator.reset(); demo = D.create(); productId = 'demo-bearing'; processId = 'demo-process-spares'; proposalId = ''; refresh(); return true; }
      if (op === 'pane') { simulator.stop(); tour = -1; pane = ['start','discovery','proposals','simulation','decisions','materials','tools'].includes(el.dataset.pane) ? el.dataset.pane : 'start'; refresh(); return true; }
      if (op === 'product-select') { simulator.reset(); tour = -1; pane = pane === 'start' ? 'discovery' : pane; productId = el.dataset.id; processId = proposalId = ''; refresh(); return true; }
      if (op === 'process-select') { simulator.reset(); tour = -1; pane = pane === 'start' ? 'discovery' : pane; processId = el.dataset.id; proposalId = ''; refresh(); return true; }
      if (op === 'proposal-select') { simulator.reset(); if (tour === 4) tour = -1; proposalId = el.dataset.id; refresh(); return true; }
      if (op === 'lesson-transaction') { simulator.advance(); document.querySelector('.sg-narrator')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); return true; }
      if (op === 'glossary') { simulator.stop(); a.openModal('Solution Studio · words explained', G.glossary(el.dataset.term || '')); return true; }
      if (op === 'tour-step') { const index = Number(el.dataset.index); if (!Number.isInteger(index) || index < 0 || index > 5) throw Error('Choose a lesson from the walkthrough.'); setTour(index); return true; }
      if (op === 'learn-case') {
        const mode = el.dataset.mode; if (!['valuated','quantity','nonstock'].includes(mode)) throw Error('Choose one of the three learning examples.');
        demo = D.create(); setTour(mode === 'nonstock' ? 4 : 3);
        if (mode === 'quantity') { proposalId = 'demo-proposal-spares-quantity'; simulator.reset(); refresh(); }
        simulator.advance(); document.querySelector('.sg-narrator')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); return true;
      }
      if (op === 'start-interview') {
        simulator.reset(); sourceChosen = true; isDemo = false; tour = -1; pane = 'tools'; productId = processId = proposalId = companyFilter = query = ''; refresh();
        const control = document.createElement('button'); control.dataset.sx = 'interview'; experience.handle(control); return true;
      }
      if (op === 'product-new' || op === 'product-edit') productEditor(el.dataset.id || '');
      else if (op === 'process-new' || op === 'process-edit') processEditor(el.dataset.id || '');
      else if (op === 'proposal-new' || op === 'proposal-edit') proposalEditor(el.dataset.id || '');
      else if (op === 'step-new' || op === 'step-edit') stepEditor(el.dataset.lane, el.dataset.id || '');
      else if (op === 'step-view') showStep(el.dataset.lane, el.dataset.id);
      else if (op === 'step-up' || op === 'step-down') moveStep(el.dataset.lane, el.dataset.id, op === 'step-up' ? -1 : 1);
      else if (op === 'step-delete') { const parent = el.dataset.lane === 'to' ? proposal() : process(); const step = parent.steps.find(x => x.id === el.dataset.id); openDelete(el.dataset.lane === 'to' ? 'proposals' : 'processes', parent.id, step.title, { type: 'step', id: step.id }); }
      else if (op === 'requirement-new' || op === 'requirement-edit') requirementEditor(el.dataset.id || '');
      else if (op === 'requirement-delete') { const req = process().requirements.find(x => x.id === el.dataset.id); openDelete('processes', processId, req.text, { type: 'requirement', id: req.id }); }
      else if (op === 'record-delete') { const collection = el.dataset.collection, id = el.dataset.id, r = rows()[collection]?.find(x => x.id === id); if (r) openDelete(collection, id, r.name || r.title); }
      else if (op === 'proposal-copy') {
        const old = rows().proposals.find(x => x.id === el.dataset.id); if (!old) throw Error('Proposal no longer exists.');
        const next = { ...E.copy(old), id: uid(), title: old.title.slice(0, 150) + ' · copy', status: 'Exploring', steps: old.steps.map(s => ({ ...E.copy(s), id: uid() })) };
        if (save(d => E.upsert(d, 'proposals', next), 'Independent proposal copy created.')) { proposalId = next.id; refresh(); }
      }
      else if (op === 'decision') decisionEditor();
      else if (op === 'compare') compare();
      else if (op === 'runs') showRuns();
      else if (op === 'run-open') openRun(el.dataset.id);
      else if (op === 'rules') showRules();
      else if (op === 'delivery') { if (isDemo) throw Error('Create delivery work from My workspace.'); const p = proposal(); openForm('delivery', 'Create linked delivery work', input('title', 'Project item title', process().name + ' · ' + p.title, 500, true) + '<p class="ss-wide">Creates one project item and three tasks for configuration/master data, SAP scenario testing and business acceptance. Existing requirements become acceptance-test notes. Repeating this action opens the existing links.</p>', p); }
      else if (op === 'delivery-view') showDelivery(el.dataset.id);
      else if (op === 'open-item' || op === 'open-task') { if (isDemo) throw Error('Demo work is not linked to your account.'); a.editRecord(op === 'open-item' ? 'specs' : 'tasks', el.dataset.id); }
      else if (op === 'tour') { demo = D.create(); setTour(0); }
      else if (op === 'tour-next' || op === 'tour-back') setTour(Math.max(0, Math.min(5, tour + (op === 'tour-next' ? 1 : -1))));
      else if (op === 'tour-close') { tour = -1; refresh(); }
      else if (op === 'sample-copy') {
        const companies = a.state().projectCompanies.filter(c => c.projectId === pid).map(c => [c.id, c.name]);
        openForm('sample-copy', 'Use the sample as a starting point', select('companyId', 'Destination company in your project', companies, '', 'Project-wide / unassigned') + '<p class="ss-wide">Copies the five product groups, eight processes and ten proposals into an empty Solution Studio workspace. Business-user names remain example role text. Owners, approvals and simulation evidence are not imported; proposals start as Exploring.</p>');
      }
      else if (op === 'cancel-form') { dialog = null; a.closeModal(); }
      return true;
    }
    function submit(form) {
      if (simulator.submit(form)) return true;
      if (form.id !== 'ssStudioForm') return false;
      guard(); const f = dialog;
      if (!f || !form.isConnected || form.dataset.ssToken !== f.token || f.owner !== owner || f.pid !== pid || f.isDemo !== isDemo || f.processId !== processId || f.proposalId !== proposalId) throw Error('Reopen this form after changing the business context.');
      const value = k => form.elements.namedItem(k)?.value.trim() || '', checked = k => [...form.querySelectorAll(`input[name="${k}"]:checked`)].map(x => x.value);
      const collections = { product: 'products', process: 'processes', proposal: 'proposals', decision: 'proposals', delivery: 'proposals', requirement: 'processes', step: f.extra?.lane === 'to' ? 'proposals' : 'processes', delete: f.extra?.collection };
      const collection = collections[f.kind], old = collection && rows()[collection].find(r => r.id === f.id);
      if (f.id && (!old || JSON.stringify(old) !== f.snapshot)) throw Error('This record changed. Reopen it before saving.');
      if (f.extra?.sourceSnapshot && JSON.stringify(process()) !== f.extra.sourceSnapshot) throw Error('The source business process changed. Reopen the proposal or decision.');
      const context = { projectId: viewPid() }; let target = '', deliveryId = '';
      if (f.kind === 'sample-copy') {
        if (!a.mutate(d => D.copyInto(d, pid, value('companyId'), uid))) return true;
        sourceChosen = true; isDemo = false; productId = processId = proposalId = companyFilter = query = ''; tour = -1; simulator.reset(); dialog = null; a.closeModal(); a.render(); a.tell('Sample blueprint copied. Confirm the real business requirements before using it.'); return true;
      }
      const ok = save(d => {
        const h = E.data(d);
        if (f.kind === 'product' || f.kind === 'process') {
          const companyId = value('companyId'), company = d.projectCompanies.find(c => c.id === companyId && c.projectId === context.projectId);
          const common = { id: old?.id || uid(), ...context, companyId, companyName: company?.name || '', name: value('name'), ownerId: value('ownerId') };
          const row = f.kind === 'product' ? { ...old, ...common, code: value('code'), category: value('category'), currentTracking: value('currentTracking'), unit: value('unit'), purpose: value('purpose'), location: value('location') } : { ...old, ...common, areaId: value('areaId'), productIds: checked('productIds'), objective: value('objective'), exceptions: value('exceptions'), scenario: value('scenario'), steps: old?.steps || [], requirements: old?.requirements || [] };
          E.upsert(d, collection, row); target = row.id;
        } else if (f.kind === 'proposal') {
          if (value('status') === 'Agreed' && old?.status !== 'Agreed') throw Error('Record business agreement through Review & deliver, including reviewer and reasoning.');
          const row = { ...old, id: old?.id || uid(), ...context, processId: f.processId, title: value('title'), status: value('status'), system: value('system'), release: value('release'), approach: value('approach'), benefits: value('benefits'), limitations: value('limitations'), assumptions: value('assumptions'), configNotes: value('configNotes'), requirementIds: checked('requirementIds'), steps: old?.steps || [], profile: S.readProfile(form) };
          E.upsert(d, 'proposals', row); target = row.id;
        } else if (f.kind === 'step') {
          const row = E.copy(old), actorId = value('actorId'), step = { id: f.extra.stepId || uid(), title: value('title'), actorId, actor: (d.workhub.projectPeople?.people || []).find(p => p.id === actorId)?.name || value('actor'), detail: value('detail'), pain: value('pain'), referenceLabel: value('referenceLabel'), referenceUrl: value('referenceUrl') };
          if (f.extra.lane === 'to') step.sourceIds = checked('sourceIds');
          const index = row.steps.findIndex(x => x.id === step.id); if (index >= 0) row.steps[index] = step; else row.steps.push(step);
          E.upsert(d, collection, row);
        } else if (f.kind === 'requirement') {
          const row = E.copy(old), req = { id: f.extra.requirementId || uid(), text: value('text'), acceptance: value('acceptance') };
          const index = row.requirements.findIndex(x => x.id === req.id); if (index >= 0) row.requirements[index] = req; else row.requirements.push(req);
          E.upsert(d, 'processes', row);
        } else if (f.kind === 'decision') E.decision(d, old.id, { by: value('by'), note: value('note'), outcome: value('outcome') }, uid, new Date().toISOString());
        else if (f.kind === 'run') E.saveRun(d, f.proposalId, { ...f.extra, title: value('title') }, uid, new Date().toISOString());
        else if (f.kind === 'delivery') deliveryId = E.delivery(d, old.id, { title: value('title') }, uid, new Date().toISOString()).id;
        else if (f.kind === 'delete') {
          if (!f.extra.child) E.remove(d, collection, viewPid(), old.id);
          else {
            const row = E.copy(old), child = f.extra.child;
            if (child.type === 'step') { row.steps = row.steps.filter(x => x.id !== child.id); if (collection === 'processes') for (const p of h.proposals.filter(x => x.processId === old.id)) for (const s of p.steps) s.sourceIds = s.sourceIds.filter(id => id !== child.id); }
            else { row.requirements = row.requirements.filter(x => x.id !== child.id); for (const p of h.proposals.filter(x => x.processId === old.id)) p.requirementIds = p.requirementIds.filter(id => id !== child.id); }
            E.upsert(d, collection, row);
          }
        }
      }, f.kind === 'run' ? 'Simulation snapshot kept.' : f.kind === 'decision' ? 'Business decision recorded.' : f.kind === 'delivery' ? 'Delivery work linked.' : 'Blueprint saved.');
      if (!ok) return true;
      if (f.kind === 'product' && target) { const product = rows().products.find(p => p.id === target); if (companyFilter && companyFilter !== product.companyId) companyFilter = ''; productId = target; }
      if (f.kind === 'process' && target) { const p = rows().processes.find(p => p.id === target); if (companyFilter && companyFilter !== p.companyId) companyFilter = ''; if (!p.productIds.includes(productId)) productId = p.productIds[0] || ''; processId = target; }
      if (f.kind === 'proposal' && target) { proposalId = target; pane = 'proposals'; }
      dialog = null; a.closeModal(); refresh(); if (deliveryId) { a.render(); showDelivery(deliveryId); } return true;
    }
    document.addEventListener('click', event => {
      const el = event.target.closest?.('[data-ss], [data-ss-sim]'); if (!el) return;
      event.preventDefault(); try { if (el.dataset.ssSim) simulator.handle(el); else handle(el); } catch (err) { simulator.stop(); a.tell(err.message, true); }
    });
    document.addEventListener('submit', event => {
      if (!['ssStudioForm', 'ssTransactionForm', 'ssTrialProfile'].includes(event.target.id)) return;
      event.preventDefault(); try { submit(event.target); } catch (err) { a.tell(err.message, true); }
    });
    document.addEventListener('change', event => {
      const el = event.target;
      try {
        if (el.id === 'ssCompanyFilter') { guard(); tour = -1; companyFilter = el.value; productId = processId = proposalId = ''; simulator.reset(); refresh(); }
        if (el.id === 'ssProposalSelect') { guard(); if (tour === 4) tour = -1; proposalId = el.value; simulator.reset(); refresh(); }
        if (el.id === 'ssProcessCompany') { guard(); const selected = [...el.form.querySelectorAll('[name="productIds"]:checked')].map(x => x.value); $('ssProcessProducts').innerHTML = productChecks(selected, el.value); }
      } catch (err) { a.tell(err.message, true); }
    });
    document.addEventListener('input', event => {
      if (event.target.id !== 'ssProductSearch') return;
      try { guard(); query = event.target.value; const start = event.target.selectionStart; refresh(); $('ssProductSearch')?.focus({ preventScroll: true }); $('ssProductSearch')?.setSelectionRange?.(start, start); } catch (err) { a.tell(err.message, true); }
    });
    $('modal')?.addEventListener('close', () => { dialog = null; simulator.stop(); });
    return { render, card, sync, experience, productEditor, processEditor, proposalEditor, stepEditor, requirementEditor, decisionEditor, submit, handle, simulator, context: () => ({ isDemo, owner, pid, productId, processId, proposalId, pane }), data: () => state(), showRules, showRuns };
  }
  root.WorkHubSolutionStudio = { install };
})(window);
