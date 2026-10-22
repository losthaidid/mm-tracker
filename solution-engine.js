/**
 * solution-engine.js — Product/process blueprints and a bounded SAP MM learning model.
 * Definitions and saved run inputs use the existing private account document. Playback
 * is pure: it never calls SAP, writes stock, or silently invents a posting rule.
 * Money is integer sen; quantities use thousandths. See docs/SOLUTION-STUDIO.md.
 */
(function (root) {
  'use strict';
  const V = root.WorkHubSolutionValuation, VERSION = V.VERSION;
  const VERSIONS = ['mm-core-2026-10-21.1', 'mm-core-2026-10-21.2', VERSION];
  const MODES = { valuated: 'Valuated stock', quantity: 'Quantity-only stock · UNBW', nonstock: 'Non-stock · NLAG' };
  const STATUS = ['Exploring', 'Proposed', 'Under review', 'Agreed'];
  const SYSTEMS = ['ECC', 'S/4HANA'];
  const TRACKING = { manual: 'Spreadsheet / manual stock', valuated: 'SAP valuated stock', quantity: 'SAP quantity-only stock', nonstock: 'Direct consumption / non-stock', unknown: 'Not confirmed' };
  const LIMITS = { products: 1000, processes: 1500, proposals: 4000, decisions: 4000, runs: 500, deliveries: 2000, materialTypes: 1000, businessRules: 4000, workshopNotes: 4000, preparations: 4000 };
  const SOURCES = [
    ['Stock and consumption', 'https://learning.sap.com/courses/business-processes-in-sap-s-4hana-sourcing-procurement/comparing-procurement-processes-for-stock-and-consumption'],
    ['UNBW and NLAG', 'https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/posting-goods-movements-for-material-types-unbw-and-nlag'],
    ['Purchasing material masters', 'https://learning.sap.com/courses/purchasing-in-sap-s-4hana/creating-material-master-records-for-purchasing'],
    ['Standard-price valuation', 'https://learning.sap.com/courses/implementing-sap-s-4hana-cloud-public-edition-sourcing-and-procurement/maintaining-product-master-data_d2afaa5c-c344-4d00-851f-f117ad075d77'],
    ['Receipt tolerances', 'https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/applying-tolerances-and-the-delivery-completed-indicator'],
    ['Negative stock', 'https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/allowing-negative-stock'],
    ['Cancellations and returns', 'https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/posting-cancellations-return-deliveries-and-returns'],
    ['Storage-location transfers', 'https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/performing-stock-transfers-between-storage-locations'],
    ['S/V price control and MAP', 'https://learning.sap.com/courses/business-processes-in-sap-s-4hana-sourcing-procurement/analyzing-material-valuation'],
    ['Batch management', 'https://learning.sap.com/courses/optimizing-advanced-logistics-and-analytics-in-sap-s-4hana-cloud-public-edition/exploring-batch-management-blf-_a5f5f6ac-d3ac-489c-954a-6e3079e8cd0c'],
    ['Split valuation', 'https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/configuring-split-valuation'],
  ];
  const RULES = [
    ['INVENTORY_CAPABILITY', 'Receipt destination', 'NLAG does not update inventory. A PO receipt for consumption remains possible.', 1],
    ['ACCOUNT_ASSIGNMENT', 'Consumption procurement', 'The supported K profile requires a cost centre and consumption G/L account.', 0],
    ['STANDARD_PRICE', 'Valuated stock', 'Inventory uses standard price; GR/IR uses PO price; the difference is shown separately.', 3],
    ['UNBW_COST_TIMING', 'Quantity-only stock', 'Account-assigned PO GR records cost; later GI changes quantity without charging the cost again.', 2],
    ['PO_QUANTITY', 'Partial / excess receipt', 'Partial receipts are allowed. Net receipts are checked against the PO tolerance.', 4],
    ['NEGATIVE_STOCK', 'Goods issue', 'Negative unrestricted stock needs both the model’s configuration and material permissions.', 5],
    ['REFERENCE', 'Returns / cancellation', 'Return delivery and cancellation are distinct. The initial model cancels only the last active GR/GI/311.', 6],
    ['STORAGE_TRANSFER', 'One-step transfer 311', 'Move unrestricted stock between two configured storage locations in the same plant. Plant quantity and value stay unchanged; no FI posting.', 7],
    ['MOVING_AVERAGE', 'Moving average price · V', 'PO receipts add receipt value; issues consume at the current average stock value. Prices remain separate per valuation type.', 8],
    ['BATCH_REQUIRED', 'Batch-managed stock', 'Identify the batch for stock movements; availability is checked for that batch and location.', 9],
    ['BATCH_STOCK', 'Batch availability', 'Stock in another batch cannot cover a withdrawal from the selected batch.', 9],
    ['VALUATION_TYPE', 'Split valuation', 'Select a maintained valuation type. Each type has independent quantity, value, price control and valuation class.', 10],
    ['BATCH_VALUATION', 'Batch and valuation type', 'A batch retains one valuation-type assignment within this one-plant model.', 10],
    ['COVERAGE', 'Supported boundary', 'One product, one PO item, unrestricted stock, S/V price, optional batches and explicit split valuation, single K assignment, MYR; no invoice, tax, QM/EWM or special stock.', -1],
  ];
  const copy = x => JSON.parse(JSON.stringify(x));
  const text = (v, n = 8000) => typeof v === 'string' && v.length <= n && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
  const id = v => text(v, 100) && !!v.trim() && !/\s/.test(v);
  const num = (n, max, places = 3) => Number.isFinite(n) && n >= 0 && n <= max && Math.abs(n * 10 ** places - Math.round(n * 10 ** places)) < 0.00001;
  const date = s => text(s, 40) && /^\d{4}-\d\d-\d\dT/.test(s) && Number.isFinite(Date.parse(s));
  const data = d => d.workhub.solutionStudio;
  const project = (d, pid) => { const p = d.projects.find(p => p.id === pid); if (!p) throw Error('This project no longer exists.'); return p; };
  function upgrade(d) {
    if (!d.workhub) d.workhub = {};
    if (d.workhub.solutionStudio === undefined) d.workhub.solutionStudio = { version: 1, products: [], processes: [], proposals: [], decisions: [], runs: [], deliveries: [] };
    // Additive upgrade: older backups retain their saved runs and core definitions.
    for (const k of ['materialTypes', 'businessRules', 'workshopNotes', 'preparations']) if (d.workhub.solutionStudio[k] === undefined) d.workhub.solutionStudio[k] = [];
    return d;
  }
  const records = (d, pid) => { project(d, pid); return Object.fromEntries(Object.keys(LIMITS).map(k => [k, data(d)[k].filter(r => r.projectId === pid)])); };
  const profile = mode => ({ mode: mode || 'valuated', purpose: mode === 'nonstock' ? 'consumption' : 'stock', openingQty: 0, sourceLocation: 'MAIN', destinationLocation: 'LINE', standardPrice: 10, poPrice: 12, poQty: 100, grAllowed: true, grNonValuated: false, accountCategory: mode && mode !== 'valuated' ? 'K' : '', costCenter: 'MAINT-1100', glAccount: mode && mode !== 'valuated' ? 'Consumption account' : '', overTolerance: 0, unlimited: false, negativeConfig: false, negativeMaterial: false, ...V.defaults() });
  function validateProfile(p) {
    if (!p || !Object.hasOwn(MODES, p.mode) || !['stock', 'consumption'].includes(p.purpose) || !['', 'K', 'Other'].includes(p.accountCategory) ||
      !text(p.costCenter, 100) || !text(p.glAccount, 100) || ['sourceLocation', 'destinationLocation'].some(k => !text(p[k], 40) || !p[k].trim() || ['__proto__', 'prototype', 'constructor'].includes(p[k])) || !num(p.openingQty, 1000000) || !num(p.poQty, 1000000) ||
      !num(p.standardPrice, 1000000, 2) || !num(p.poPrice, 1000000, 2) || !num(p.overTolerance, 100, 2) ||
      ['grAllowed', 'grNonValuated', 'unlimited', 'negativeConfig', 'negativeMaterial'].some(k => typeof p[k] !== 'boolean'))
      throw Error('Check the simulation profile: quantities (up to 3 decimals), prices (up to 2), tolerance and document controls.');
    if (p.materialType !== undefined) root.WorkHubSolutionMaterials.validateType(p.materialType);
    V.validate(p);
  }
  function validateActions(actions) {
    if (!Array.isArray(actions) || actions.length > 40) throw Error('A simulation supports up to 40 transactions.');
    if (new Set(actions.map(x => x?.id)).size !== actions.length) throw Error('Simulation transaction IDs must be unique.');
    for (const x of actions) if (!x || !id(x.id) || !text(x.type, 40) || !text(x.intent, 40) || !text(x.reference, 100) || !text(x.location, 40) || !text(x.toLocation, 40) || !num(x.qty, 1000000) || !text(x.note, 500)) throw Error('Check the simulation transactions.');
    for (const x of actions) V.validateAction(x);
  }
  function validate(d) {
    const h = data(d);
    if (!h || h.version !== 1 || Object.entries(LIMITS).some(([k, n]) => !Array.isArray(h[k]) || h[k].length > n)) throw Error('Check the Solution Studio records or collection limits.');
    const maps = {}, ids = new Set();
    for (const k of Object.keys(LIMITS)) {
      maps[k] = new Map(); const counts = new Map();
      for (const r of h[k]) {
        if (!r || !id(r.id) || ids.has(r.id) || !id(r.projectId)) throw Error('Solution Studio records need unique IDs and a project.');
        project(d, r.projectId); ids.add(r.id); maps[k].set(r.id, r);
        counts.set(r.projectId, (counts.get(r.projectId) || 0) + 1);
        if (counts.get(r.projectId) > ({ products: 200, processes: 250, proposals: 600, decisions: 600, runs: 100, deliveries: 300, materialTypes: 100, businessRules: 600, workshopNotes: 600, preparations: 600 }[k])) throw Error('This project has reached its Solution Studio collection limit.');
      }
    }
    const person = (pid, who) => !who || (d.workhub.projectPeople?.people || []).some(p => p.id === who && p.projectId === pid);
    const company = r => { const c = (d.projectCompanies || []).find(c => c.id === r.companyId); if (!text(r.companyId, 100) || !text(r.companyName, 200) || (r.companyId && (!c || c.projectId !== r.projectId))) throw Error('Choose a company from this project.'); };
    const steps = (rows, r, proposed = false) => {
      if (!Array.isArray(rows) || rows.length > 40) throw Error('A process lane supports up to 40 steps.');
      const seen = new Set();
      for (const s of rows) {
        if (!s || !id(s.id) || seen.has(s.id) || !text(s.title, 160) || !s.title.trim() || !text(s.detail) || !text(s.pain, 2000) || !text(s.actor, 160) || !text(s.actorId, 100) || !person(r.projectId, s.actorId) || (s.referenceLabel !== undefined && !text(s.referenceLabel, 160)) || (s.referenceUrl !== undefined && (!text(s.referenceUrl, 2000) || (s.referenceUrl && !/^https?:\/\/\S+$/i.test(s.referenceUrl))))) throw Error('Check the process steps, business users and http/https reference links.');
        seen.add(s.id);
        if (proposed && (!Array.isArray(s.sourceIds) || new Set(s.sourceIds).size !== s.sourceIds.length || s.sourceIds.some(id => !maps.processes.get(r.processId).steps.some(x => x.id === id)))) throw Error('Map proposed steps to current steps from the same process.');
      }
    };
    for (const r of h.products) {
      company(r);
      if (!text(r.name, 160) || !r.name.trim() || !text(r.code, 100) || !text(r.category, 120) || !Object.hasOwn(TRACKING, r.currentTracking) || !text(r.unit, 20) || !r.unit.trim() || !text(r.purpose) || !text(r.location, 200) || !text(r.ownerId, 100) || !person(r.projectId, r.ownerId)) throw Error('Check the product/group name, inventory approach, unit and business owner.');
    }
    for (const r of h.processes) {
      company(r);
      if (!text(r.name, 160) || !r.name.trim() || !text(r.objective) || !text(r.exceptions) || !text(r.areaId, 100) || (r.areaId && !project(d, r.projectId).mmAreas.some(a => a.id === r.areaId)) || !text(r.ownerId, 100) || !person(r.projectId, r.ownerId) || !['procurement', 'context'].includes(r.scenario) || !Array.isArray(r.productIds) || new Set(r.productIds).size !== r.productIds.length || r.productIds.length > 200 || r.productIds.some(id => { const p = maps.products.get(id); return !p || p.projectId !== r.projectId || p.companyId !== r.companyId; })) throw Error('Processes and their products, company, MM area and owner must belong to the same project.');
      steps(r.steps, r);
      if (!Array.isArray(r.requirements) || r.requirements.length > 40 || new Set(r.requirements.map(x => x.id)).size !== r.requirements.length || r.requirements.some(x => !id(x.id) || !text(x.text, 2000) || !x.text.trim() || !text(x.acceptance, 2000))) throw Error('Check the business requirements and acceptance criteria.');
    }
    for (const r of h.proposals) {
      const p = maps.processes.get(r.processId);
      if (!p || p.projectId !== r.projectId || !text(r.title, 160) || !r.title.trim() || !STATUS.includes(r.status) || !SYSTEMS.includes(r.system) || !text(r.release, 100) || ['approach', 'benefits', 'limitations', 'assumptions', 'configNotes'].some(k => !text(r[k])) || !Array.isArray(r.requirementIds) || new Set(r.requirementIds).size !== r.requirementIds.length || r.requirementIds.some(id => !p.requirements.some(x => x.id === id))) throw Error('Check proposal context, requirements and design notes.');
      validateProfile(r.profile); steps(r.steps, r, true);
    }
    const agreed = h.proposals.filter(r => r.status === 'Agreed').map(r => r.processId);
    if (new Set(agreed).size !== agreed.length) throw Error('Keep one agreed proposal per business process.');
    for (const r of h.decisions) {
      const p = maps.proposals.get(r.proposalId);
      if (!p || p.projectId !== r.projectId || !['Agreed', 'Changes requested', 'Under review'].includes(r.outcome) || !text(r.by, 160) || !r.by.trim() || !text(r.note) || !date(r.at) || !text(r.snapshot, 60000)) throw Error('Check the recorded solution decisions.');
      let snapshot; try { snapshot = JSON.parse(r.snapshot); } catch { throw Error('Check the decision design snapshot.'); }
      if (snapshot?.proposal?.id !== r.proposalId || snapshot.proposal.projectId !== r.projectId || !Array.isArray(snapshot.requirements) || snapshot.requirements.length > 40) throw Error('Check the decision design snapshot.');
    }
    for (const p of h.proposals.filter(p => p.status === 'Agreed')) if (!h.decisions.some(r => r.proposalId === p.id && r.outcome === 'Agreed' && JSON.stringify(JSON.parse(r.snapshot).proposal) === JSON.stringify(p))) throw Error('Record agreement for the current proposal design before marking it Agreed.');
    for (const r of h.runs) {
      const p = maps.proposals.get(r.proposalId), s = r.snapshot;
      if (!text(r.proposalId, 100) || (p && p.projectId !== r.projectId) || !text(r.title, 160) || !r.title.trim() || !date(r.at) || !s || !text(s.productName, 2000) || !text(s.processName, 160) || !text(s.proposalTitle, 160) || !SYSTEMS.includes(s.system) || !text(s.release, 100) || !VERSIONS.includes(s.engineVersion) || !['procurement', 'context'].includes(s.scenario)) throw Error('Check saved simulation snapshots.');
      validateProfile(s.profile); validateActions(r.actions);
      if (s.engineVersion === VERSIONS[0] && s.profile.materialType) throw Error('Material attributes require the current simulation rule version.');
      V.checkVersion(s.profile, r.actions, s.engineVersion);
    }
    for (const r of h.deliveries) {
      const p = maps.proposals.get(r.proposalId);
      const item = (d.specs || []).find(x => x.id === r.itemId);
      if (!p || p.projectId !== r.projectId || !id(r.itemId) || (item && item.projectId !== r.projectId) || !date(r.at) || !Array.isArray(r.taskIds) || r.taskIds.length > 10 || new Set(r.taskIds).size !== r.taskIds.length || r.taskIds.some(x => { const t = (d.tasks || []).find(t => t.id === x); return !id(x) || (t && (t.taskType !== 'Project' || t.linkId !== r.projectId)); }) || !Array.isArray(r.tests) || r.tests.length > 40 || r.tests.some(x => !text(x.title, 2000) || !text(x.expected, 2000))) throw Error('Check linked solution delivery work.');
    }
    if (new Set(h.deliveries.map(r => r.proposalId)).size !== h.deliveries.length) throw Error('This proposal already has linked delivery work.');
    root.WorkHubSolutionMaterials?.validateRecords(d, h, maps);
    return d;
  }
  /** Clean only deliberate deletions; malformed imported references still fail validation. */
  function prepare(next, previous, restoring = false) {
    if (restoring || !previous) return;
    const removed = new Set(previous.projects.filter(p => !next.projects.some(n => n.id === p.id)).map(p => p.id));
    const h = data(next);
    for (const k of Object.keys(LIMITS)) h[k] = h[k].filter(r => !removed.has(r.projectId));
    const lostCompanies = new Map((previous.projectCompanies || []).filter(c => !(next.projectCompanies || []).some(n => n.id === c.id)).map(c => [c.id, c.name]));
    const lostPeople = new Set((previous.workhub.projectPeople?.people || []).filter(p => !(next.workhub.projectPeople?.people || []).some(n => n.id === p.id)).map(p => p.id));
    const review = new Set();
    for (const r of [...h.products, ...h.processes]) {
      if (lostCompanies.has(r.companyId)) { r.companyName = lostCompanies.get(r.companyId); r.companyId = ''; if (h.processes.includes(r)) review.add(r.id); }
      if (lostPeople.has(r.ownerId)) { r.ownerId = ''; if (h.processes.includes(r)) review.add(r.id); }
    }
    for (const r of [...h.processes, ...h.proposals]) for (const s of r.steps) if (lostPeople.has(s.actorId)) { s.actorId = ''; review.add(r.processId || r.id); }
    for (const p of h.proposals) if (review.has(p.processId) && p.status === 'Agreed') p.status = 'Under review';
  }
  function upsert(d, collection, row) {
    const h = data(d), old = h[collection].find(r => r.id === row.id);
    if (!['products', 'processes', 'proposals'].includes(collection) || (old && old.projectId !== row.projectId)) throw Error('Reopen this Solution Studio record.');
    if (old && JSON.stringify(old) !== JSON.stringify(row)) {
      if (collection === 'proposals' && old.status === 'Agreed') row.status = 'Under review';
      if (collection === 'processes') for (const p of h.proposals) if (p.processId === row.id && p.status === 'Agreed') p.status = 'Under review';
      if (collection === 'products') for (const p of h.proposals) if (p.status === 'Agreed' && h.processes.some(x => x.id === p.processId && x.productIds.includes(row.id))) p.status = 'Under review';
    }
    if (old) h[collection][h[collection].indexOf(old)] = row; else h[collection].push(row);
    if (collection === 'processes') for (const r of h.businessRules.filter(r => r.processId === row.id)) r.stepIds = r.stepIds.filter(id => row.steps.some(s => s.id === id));
    validate(d); return row;
  }
  function remove(d, collection, pid, id) {
    const h = data(d), r = h[collection]?.find(r => r.id === id && r.projectId === pid);
    if (!r || !['products', 'processes', 'proposals'].includes(collection)) throw Error('This blueprint record no longer exists.');
    const proposalIds = new Set(collection === 'processes' ? h.proposals.filter(p => p.processId === id).map(p => p.id) : collection === 'proposals' ? [id] : []);
    if (h.deliveries.some(x => proposalIds.has(x.proposalId))) throw Error('Keep proposals with delivery links for traceability.');
    h[collection] = h[collection].filter(x => x.id !== id);
    if (collection === 'products') for (const p of h.processes) if (p.productIds.includes(id)) { p.productIds = p.productIds.filter(x => x !== id); for (const s of h.proposals) if (s.processId === p.id && s.status === 'Agreed') s.status = 'Under review'; }
    if (proposalIds.size) {
      h.proposals = h.proposals.filter(x => !proposalIds.has(x.id));
      h.decisions = h.decisions.filter(x => !proposalIds.has(x.proposalId));
      h.preparations = h.preparations.filter(x => !proposalIds.has(x.proposalId));
    }
    if (collection === 'processes') for (const k of ['businessRules', 'workshopNotes']) h[k] = h[k].filter(x => x.processId !== id);
    validate(d);
  }
  function decision(d, proposalId, values, uid, at) {
    const h = data(d), p = h.proposals.find(p => p.id === proposalId);
    if (!p) throw Error('This proposal no longer exists.');
    if (values.outcome === 'Agreed') for (const other of h.proposals) if (other.processId === p.processId && other.status === 'Agreed') other.status = 'Under review';
    p.status = values.outcome === 'Changes requested' ? 'Exploring' : values.outcome;
    h.decisions.push({ id: uid(), projectId: p.projectId, proposalId, by: values.by.trim(), note: values.note.trim(), outcome: values.outcome, at, snapshot: JSON.stringify({ proposal: p, requirements: h.processes.find(r => r.id === p.processId).requirements }) });
    validate(d);
  }
  function snapshot(d, proposalId) {
    const h = data(d), p = h.proposals.find(p => p.id === proposalId), process = h.processes.find(x => x.id === p?.processId);
    if (!p || !process) throw Error('Select a proposal first.');
    return { productName: h.products.filter(x => process.productIds.includes(x.id)).map(x => x.name).join(', ') || 'Shared process', processName: process.name, proposalTitle: p.title, system: p.system, release: p.release, profile: copy(p.profile), scenario: process.scenario, engineVersion: VERSION };
  }
  function saveRun(d, proposalId, values, uid, at) {
    const p = data(d).proposals.find(x => x.id === proposalId);
    if (!p) throw Error('Select a proposal first.');
    const run = { id: uid(), projectId: p.projectId, proposalId, title: values.title.trim(), at, snapshot: values.snapshot ? copy(values.snapshot) : snapshot(d, proposalId), actions: copy(values.actions) };
    data(d).runs.push(run); validate(d); return run;
  }
  function delivery(d, proposalId, values, uid, at) {
    const h = data(d), p = h.proposals.find(x => x.id === proposalId), old = h.deliveries.find(x => x.proposalId === proposalId);
    if (!p || p.status !== 'Agreed') throw Error('Record business agreement before creating delivery work.');
    if (old) return old;
    if (!text(values.title, 500) || !values.title.trim()) throw Error('Enter a project item title of up to 500 characters.');
    const process = h.processes.find(x => x.id === p.processId), itemId = uid();
    const notes = `${process.objective}\n\nAgreed solution: ${p.title}\n${p.approach}\n\nAssumptions: ${p.assumptions}`;
    d.specs.push({ id: itemId, itemType: d.lists.projectItemTypes[0], itemId: '', ricefw: '', description: values.title.trim(), status: 'Not yet Started', priority: 'B', expectedDate: '', dueDate: '', remarks: notes, feedback: '', reference: 'Solution Studio · ' + process.name, url: '', projectId: p.projectId, companyId: process.companyId, subItems: [] });
    const taskIds = [];
    for (const title of ['Confirm master data and configuration', 'Validate the agreed scenario in SAP', 'Review business acceptance criteria']) {
      const id = uid(); taskIds.push(id);
      d.tasks.push({ id, number: String(Math.max(0, ...d.tasks.map(t => +t.number || 0)) + 1), task: title + ' · ' + p.title, taskType: 'Project', linkId: p.projectId, customLink: '', priority: 'Medium', dueDate: '', done: false, doneDate: '', remarks: notes, feedback: '', subTasks: [], boardStatus: 'todo', archived: false, archivedAt: '' });
    }
    const r = { id: uid(), projectId: p.projectId, proposalId, itemId, taskIds, at, tests: process.requirements.map(r => ({ title: r.text, expected: r.acceptance })) };
    h.deliveries.push(r); validate(d); return r;
  }
  const q = n => Math.round(n * 1000), cents = n => Math.round(n * 100);
  const amount = (units, price) => {
    const raw = BigInt(units) * BigInt(cents(price)), sign = raw < 0n ? -1n : 1n;
    return Number(sign * ((raw * sign + 500n) / 1000n));
  };
  const tracks = p => p.mode !== 'nonstock' && p.purpose === 'stock';
  function initial(p) { return V.initial(p, { qty: tracks(p) ? q(p.openingQty) : 0, inventory: tracks(p) && p.mode === 'valuated' ? amount(q(p.openingQty), p.standardPrice) : 0, locations: Object.fromEntries([[p.destinationLocation, 0], [p.sourceLocation, tracks(p) ? q(p.openingQty) : 0]]), consumedQty: 0, expense: 0, grir: 0, variance: 0, netReceived: 0 }); }
  let serial = 0;
  const action = (type = 'gr', qty = 100, intent = 'inventory', reference = '', note = '') => ({ id: 'txn-' + (++serial) + '-' + Math.random().toString(36).slice(2, 9), type, qty, intent, reference, location: '', toLocation: '', note });
  function defaultActions(p) {
    const inventory = tracks(p), qty = Math.min(100, p.poQty);
    const receipt = action('gr', qty, inventory ? 'inventory' : 'consumption');
    const rest = inventory ? [action('transfer', Math.min(20, qty), 'inventory'), action('issue', Math.min(30, Math.max(0, qty - 20)), 'inventory'), action('return', Math.min(10, Math.max(0, qty - 50)), 'inventory', receipt.id)] : [action('return', Math.min(10, qty), 'consumption', receipt.id)];
    const actions = [receipt, ...rest.filter(x => x.qty > 0)];
    for (const a of actions) { if (p.batchManaged) a.batch = 'BATCH-001'; if (p.splitValuation) a.valuationType = p.valuationTypes[0]?.code || ''; }
    return actions;
  }
  /** Every unsuccessful transaction leaves the entire simulated state untouched. */
  function simulate(p, actions, scenario = 'procurement', version = VERSION) {
    validateProfile(p); validateActions(actions);
    if (!VERSIONS.includes(version)) throw Error('This saved rule version is not supported.');
    if (version === VERSIONS[0] && p.materialType) throw Error('Material attributes require the current simulation rule version.');
    V.checkVersion(p, actions, version);
    if (p.splitValuation) return V.split(p, actions, scenario, version, simulate);
    let current = initial(p); const start = copy(current), events = [], receipts = new Map(), stack = [];
    const posting = (account, signed, costObject = '') => ({ account, debit: Math.max(0, signed), credit: Math.max(0, -signed), costObject });
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i], before = copy(current), doc = 'SIM-' + String(i + 1).padStart(3, '0');
      let error = null, status = 'error', code = '', message = '', fix = '', postings = [], movement = '', explanation = '', reverseTarget = null;
      const fail = (rule, why, remedy, unsupported = false) => { if (!error) { error = true; code = rule; message = why; fix = remedy; status = unsupported ? 'unsupported' : 'error'; } };
      if (scenario !== 'procurement') fail('COVERAGE', 'This process needs a production, quality or sales model.', 'Keep documenting this process. Use a procurement process for the supported MM simulator.', true);
      if (version !== VERSIONS[0] && p.materialType) {
        const why = root.WorkHubSolutionMaterials.coverage(p.materialType);
        if (why) fail('MATERIAL_SCOPE', why, 'Review the material attributes or document this specialist process outside the core PO model.', true);
        if (root.WorkHubSolutionMaterials.mode(p.materialType) !== p.mode) fail('MATERIAL_ATTRIBUTES', 'The inventory mode does not match the explicit quantity/value attributes.', 'Apply the material profile again, or adjust its explicit attributes in the material controls.');
      }
      if (p.grNonValuated || p.accountCategory === 'Other') fail('COVERAGE', 'This profile uses posting behaviour outside the initial model.', 'Use valuated PO goods receipt and either no assignment or a single K assignment. Non-valuated PO GR timing and other assignments are not covered.', true);
      if ((p.mode === 'nonstock' && p.purpose !== 'consumption') || (p.mode === 'quantity' && p.purpose !== 'stock')) fail('PROFILE_PURPOSE', 'Product capability and procurement purpose do not match this supported profile.', p.mode === 'nonstock' ? 'Choose direct consumption for NLAG.' : 'Choose stock procurement for the quantity-only UNBW profile.');
      if (!tracks(p) && p.openingQty !== 0) fail('OPENING_STOCK', 'This scenario does not maintain an inventory balance.', 'Set opening inventory quantity to zero, or choose an inventory profile.');
      if (!['gr', 'issue', 'transfer', 'return', 'reverse'].includes(a.type)) fail('COVERAGE', 'This transaction has not been modelled.', 'Supported: PO goods receipt, cost-centre issue, same-plant one-step storage-location transfer, referenced supplier return and last-posting cancellation.', true);
      const units = q(a.qty), inventory = tracks(p), assigned = p.mode !== 'valuated' || p.purpose === 'consumption', location = a.location || p.sourceLocation, toLocation = a.toLocation || p.destinationLocation;
      if (inventory && a.type !== 'reverse' && (!Object.hasOwn(current.locations, location) || (a.type === 'transfer' && !Object.hasOwn(current.locations, toLocation)))) fail('STORAGE_TRANSFER', 'This storage location is not defined in the same-plant model.', 'Use the two configured storage locations. Their SAP existence/extension is an explicit scenario prerequisite.');
      const negativeAllowed = p.negativeConfig && p.negativeMaterial;
      if (a.type !== 'reverse' && units <= 0) fail('QUANTITY', 'Enter a quantity greater than zero.', 'Use up to three decimal places.');
      if (a.type === 'gr' && !p.grAllowed) fail('GR_ELIGIBILITY', 'The PO profile does not expect a goods receipt.', 'Review the PO item’s GR setting. This is separate from the GR non-valuated indicator.');
      if (a.type === 'gr' && a.intent !== (inventory ? 'inventory' : 'consumption')) fail('INVENTORY_CAPABILITY', inventory ? 'This PO profile expects a receipt into inventory.' : 'This profile cannot receive into inventory stock.', inventory ? 'Choose inventory receipt, or design a direct-consumption proposal.' : 'Receive for consumption against the account-assigned PO; no inventory balance will be created.');
      if (['gr', 'return'].includes(a.type) && assigned && (p.accountCategory !== 'K' || !p.costCenter.trim() || !p.glAccount.trim())) fail('ACCOUNT_ASSIGNMENT', 'The supported consumption PO requires K, a cost centre and a consumption G/L account.', 'Complete the account assignment in the proposal profile.');
      if (a.type === 'gr' && !assigned && p.accountCategory !== '') fail('PROCUREMENT_PURPOSE', 'This stock PO profile has an account assignment.', 'Choose direct consumption for an account-assigned valuated purchase, or remove the assignment for stock procurement.');
      if (a.type === 'gr' && !p.unlimited && current.netReceived + units > Math.floor(q(p.poQty) * (1 + p.overTolerance / 100) + 0.000001)) fail('PO_QUANTITY', 'The receipt exceeds the ordered quantity plus overdelivery tolerance.', 'Reduce the receipt, review the tolerance, or explicitly allow unlimited overdelivery in this scenario.');
      if (a.type === 'issue' && !inventory) fail('INVENTORY_CAPABILITY', 'There is no inventory balance to issue in this procurement scenario.', 'Consumption is recorded at the receipt. Choose a stock profile if later inventory issues are required.');
      if (a.type === 'issue' && !p.costCenter.trim()) fail('COST_CENTER', 'A cost-centre issue needs a receiving cost centre.', 'Enter the cost centre in the simulation profile.');
      if (a.type === 'issue' && units > (current.locations[location] || 0) && !negativeAllowed) fail('NEGATIVE_STOCK', 'Insufficient unrestricted stock in ' + location + ' for this issue.', 'Reduce the quantity or receive/transfer stock into this location first. Negative stock requires both configured permissions in this model.');
      if (a.type === 'transfer') {
        if (!inventory) fail('INVENTORY_CAPABILITY', 'This non-inventory procurement scenario has no stock to transfer.', 'Use a quantity-managed stock profile if storage-location transfers are required.');
        if (location === toLocation) fail('STORAGE_TRANSFER', 'Source and destination storage locations must differ.', 'Choose two distinct configured locations within the same plant.');
        if (units > (current.locations[location] || 0) && !negativeAllowed) fail('NEGATIVE_STOCK', 'Insufficient unrestricted stock in ' + location + ' for this transfer.', 'Receive stock or reduce the transfer quantity.');
      }
      const receipt = receipts.get(a.reference);
      let batch = a.batch || (a.type === 'return' ? receipt?.batch : '') || '';
      if (p.batchManaged) {
        if (!inventory) fail('BATCH_SCOPE', 'Batch-stock tracking requires a quantity-managed inventory scenario.', 'Use stock procurement. Batch tracking for direct consumption is outside this learning model.', true);
        if (a.type !== 'reverse' && !batch) fail('BATCH_REQUIRED', 'Choose a batch for this stock movement.', 'Enter a batch at receipt, then use that batch for issue or transfer. Referenced returns inherit their original batch.');
        if (['issue', 'transfer', 'return'].includes(a.type) && units > V.batchQty(current, batch, location)) fail('BATCH_STOCK', 'Insufficient stock for batch ' + batch + ' in ' + location + '.', 'Choose a batch with enough stock in this location or receive/transfer the same batch first. Other batches do not cover this withdrawal.');
        if (a.type === 'return' && receipt?.batch && receipt.batch !== batch) fail('BATCH_REFERENCE', 'This return uses a different batch from its original receipt.', 'Use the batch on the referenced goods receipt.');
      } else if (a.batch) fail('BATCH_NOT_ACTIVE', 'Batch management is not enabled for this profile.', 'Clear the batch or enable batch-managed stock in the scenario inputs.');
      const map = V.isMAP(p) && p.mode === 'valuated' && inventory;
      if (a.valuationType) fail('VALUATION_TYPE', 'This profile does not use split valuation.', 'Clear the valuation type or enable split valuation and maintain its types.');
      if (map && ['issue', 'transfer', 'return'].includes(a.type) && units > current.qty) fail('MAP_SCOPE', 'Negative total stock with MAP is outside this learning model.', 'Receive enough stock before withdrawing. Negative-stock valuation and its price-difference rules need separate SAP verification.', true);
      if (map && a.type === 'return' && receipt && units <= receipt.available) {
        const value = amount(current.netReceived, p.poPrice) - amount(current.netReceived - units, p.poPrice), remainder = current.inventory - value;
        if (remainder < 0 || (current.qty === units && remainder !== 0)) fail('MAP_SCOPE', 'This return needs stock-coverage or residual-value accounting outside the model.', 'Use a smaller return or verify the required inventory/price-difference posting in SAP. No simulated balances will change.', true);
      }
      if (a.type === 'return') {
        if (!receipt || units > receipt.available) fail('REFERENCE', 'Choose a successful goods receipt with enough quantity still eligible for return.', 'Reference its SIM document and reduce the return quantity if needed.');
        if (inventory && units > (current.locations[location] || 0) && !negativeAllowed) fail('NEGATIVE_STOCK', 'Not enough available stock in ' + location + ' for this supplier return.', 'Return only the available quantity from this location.');
      }
      if (a.type === 'reverse') {
        reverseTarget = stack.at(-1);
        if (!reverseTarget || reverseTarget.actionId !== a.reference || !['gr', 'issue', 'transfer'].includes(reverseTarget.type)) fail('CANCELLATION_SCOPE', 'This model cancels only the last active goods receipt, issue or storage transfer.', 'Select that document, or reset and replay the earlier sequence. This is a simulator limit, not a universal SAP restriction.', true);
      }
      if (!error) {
        status = 'success'; code = a.type === 'gr' ? assigned ? 'ACCOUNT_ASSIGNMENT' : 'STANDARD_PRICE' : a.type === 'transfer' ? 'STORAGE_TRANSFER' : a.type === 'issue' ? p.mode === 'quantity' ? 'UNBW_COST_TIMING' : 'NEGATIVE_STOCK' : 'REFERENCE';
        const priorReceipts = [...receipts].map(([id, r]) => [id, copy(r)]);
        if (a.type === 'reverse') {
          current = copy(reverseTarget.before); receipts.clear(); for (const [id, r] of reverseTarget.receipts) receipts.set(id, copy(r)); stack.pop();
          postings = reverseTarget.postings.map(x => ({ ...x, debit: x.credit, credit: x.debit }));
          movement = reverseTarget.type === 'gr' ? '102' : reverseTarget.type === 'transfer' ? '312' : '202';
          message = 'Posting cancelled with reference to ' + reverseTarget.doc + '.'; explanation = 'The original quantity and symbolic accounting effects are reversed. Last-active-posting scope only.';
          batch = reverseTarget.batch || '';
        } else {
          const sign = a.type === 'return' ? -1 : 1,
            poValue = sign * (amount(current.netReceived + sign * units, p.poPrice) - current.grir),
            stockValue = map ? a.type === 'issue' ? V.roundRatio(current.inventory, units, current.qty) : poValue : a.type === 'issue'
              ? current.inventory - amount(current.qty - units, p.standardPrice)
              : sign * (amount(current.qty + sign * units, p.standardPrice) - current.inventory);
          if (a.type === 'gr' || a.type === 'return') {
            current.netReceived += sign * units;
            if (inventory) { current.qty += sign * units; current.locations[location] += sign * units; }
            current.grir += sign * poValue;
            if (inventory && p.mode === 'valuated') {
              current.inventory += sign * stockValue; current.variance += sign * (poValue - stockValue);
              postings = [posting('Inventory · BSX', sign * stockValue), posting('Price difference · PRD', sign * (poValue - stockValue)), posting('GR/IR · WRX', -sign * poValue)];
            } else {
              current.expense += sign * poValue;
              if (!inventory) current.consumedQty += sign * units;
              postings = [posting(p.glAccount || 'Consumption', sign * poValue, p.costCenter), posting('GR/IR · WRX', -sign * poValue)];
            }
            if (a.type === 'gr') { movement = '101'; receipts.set(a.id, { available: units, document: doc, ...(p.batchManaged ? { batch } : {}) }); message = inventory ? 'Goods received into ' + (p.mode === 'quantity' ? 'quantity-only stock.' : 'valuated stock.') : 'Goods received for direct consumption.'; }
            else { movement = '122'; receipt.available -= units; message = 'Supplier return recorded against ' + receipt.document + '.'; }
            explanation = map ? 'Stock and GR/IR use the PO receipt value in this no-invoice scenario. Moving average price is the remaining inventory value divided by stock quantity; a referenced return removes its PO receipt value.' : inventory && p.mode === 'valuated' ? 'Stock uses standard price; GR/IR uses PO price. Any difference is shown in price differences.' : inventory ? 'UNBW: quantity is tracked. Purchase cost is recognised at GR; a later GI does not charge it again.' : 'No inventory quantity or inventory value is created. The cost is assigned to the consumption account and cost centre.';
          } else if (a.type === 'transfer') {
            movement = '311'; current.locations[location] -= units; current.locations[toLocation] += units;
            message = 'Stock transferred from ' + location + ' to ' + toLocation + '.';
            explanation = 'One-step unrestricted transfer within the same plant and valuation area. Location quantities change; total quantity and inventory value stay unchanged. No FI document is created.';
          } else {
            movement = '201'; current.qty -= units; current.locations[location] -= units; current.consumedQty += units;
            if (p.mode === 'valuated') { current.inventory -= stockValue; current.expense += stockValue; postings = [posting('Consumption · GBB/VBR', stockValue, p.costCenter), posting('Inventory · BSX', -stockValue)]; }
            message = 'Goods issued to ' + p.costCenter + '.'; explanation = p.mode === 'quantity' ? 'Quantity and consumption statistics change. No additional FI cost is posted: the purchase cost was recognised at GR.' : map ? 'The issue uses the current moving average cost from inventory value and quantity. Consumption increases by that issue value. Monetary rounding is applied once to the posting.' : 'Stock quantity and standard-price inventory value decrease. Consumption cost increases by the same standard value.';
          }
          if (p.batchManaged) {
            if (a.type === 'gr' || a.type === 'return') V.moveBatch(current, batch, location, (a.type === 'gr' ? 1 : -1) * units);
            else { V.moveBatch(current, batch, location, -units); if (a.type === 'transfer') V.moveBatch(current, batch, toLocation, units); }
          }
          if (map && current.qty > 0) current.mapPrice = current.inventory * 10 / current.qty;
          stack.push({ doc, actionId: a.id, type: a.type, before, receipts: priorReceipts, postings: copy(postings), batch });
        }
      }
      if (!error && map && a.type === 'gr') code = 'MOVING_AVERAGE';
      events.push({ index: i, document: error ? '' : doc, movement, action: copy(a), status, code, message, fix, explanation, postings: postings.filter(x => x.debit || x.credit), before, after: copy(current), ...(version === VERSION ? { batch, valuationClass: p.valuationClass || '', valuationType: '', priceControl: p.priceControl || 'S' } : {}) });
    }
    return { engineVersion: version, initial: start, events, final: copy(current), activeDocuments: stack.map(x => ({ document: x.doc, type: x.type, actionId: x.actionId })), receipts: [...receipts].map(([reference, r]) => ({ reference, document: r.document, available: r.available / 1000 })) };
  }
  root.WorkHubSolutionEngine = { VERSION, VERSIONS, MODES, STATUS, SYSTEMS, TRACKING, LIMITS, SOURCES, RULES, copy, data, project, records, profile, tracks, upgrade, validate, validateProfile, validateActions, prepare, upsert, remove, decision, snapshot, saveRun, delivery, action, defaultActions, simulate };
})(window);
