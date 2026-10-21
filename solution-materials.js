/**
 * solution-materials.js — editable material-type reference profiles and design helpers.
 * A type code is a label, not a posting rule. Explicit attributes plus the PO and
 * movement context determine the bounded simulation. No customer configuration is read.
 */
(function (root) {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  const SOURCES = [
    ['Material-type controls', 'https://learning.sap.com/courses/exploring-cross-functional-customizing-in-sap-s-4hana-cloud-private-edition/creating-material-types_b436b76f-8a33-4454-8732-f482b11b3a01'],
    ['Standard material types · ERP', 'https://help.sap.com/docs/SAP_ERP/96bf9ad642cf4b26a29595e3d573fb8c/9d7cbd534f22b44ce10000000a174cb4.html'],
    ['Purchasing views, UNBW, NLAG and SERV', 'https://learning.sap.com/courses/purchasing-in-sap-s-4hana/creating-material-master-records-for-purchasing'],
    ['Quantity-only and non-stock movements', 'https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/posting-goods-movements-for-material-types-unbw-and-nlag'],
    ['Valuation classes and account category references', 'https://learning.sap.com/courses/exploring-cross-functional-customizing-in-sap-s-4hana-cloud-private-edition/creating-valuation-classes-and-account-category-references_a3106dcc-2802-4317-b5eb-ed61d837aabc'],
    ['SERV in S/4HANA · Simplification List', 'https://help.sap.com/doc/f2591a6901344c97a5e2029cc8f3703e/2021/en-US/SIMPL_OP2021.pdf'],
  ];
  const PROCUREMENT = { external: 'External purchasing', internal: 'In-house production', both: 'Internal + external', none: 'No procurement' };
  const VIEWS = ['Basic data', 'Purchasing', 'MRP', 'Storage', 'Accounting', 'Sales', 'Work scheduling'];
  const CATALOG = [
    ['ROH', 'Raw materials', 'Ingredients and inputs used in production.', 'external', true, true, false, ['Basic data', 'Purchasing', 'MRP', 'Storage', 'Accounting']],
    ['HAWA', 'Trading goods', 'Goods purchased for resale.', 'external', true, true, false, ['Basic data', 'Purchasing', 'Sales', 'MRP', 'Storage', 'Accounting']],
    ['HALB', 'Semi-finished products', 'Intermediate products made internally or purchased.', 'both', true, true, false, ['Basic data', 'Purchasing', 'MRP', 'Storage', 'Accounting', 'Work scheduling']],
    ['FERT', 'Finished products', 'Internally manufactured finished products in this reference profile.', 'internal', true, true, false, ['Basic data', 'MRP', 'Storage', 'Accounting', 'Sales', 'Work scheduling']],
    ['ERSA', 'Spare parts', 'Parts held for maintenance and replacement; stock-oriented example.', 'external', true, true, false, ['Basic data', 'Purchasing', 'MRP', 'Storage', 'Accounting']],
    ['HIBE', 'Operating supplies', 'Supplies used to operate the business; stock-oriented example.', 'external', true, true, false, ['Basic data', 'Purchasing', 'MRP', 'Storage', 'Accounting']],
    ['VERP', 'Packaging materials', 'Packaging used to protect or prepare goods; stock-oriented example.', 'external', true, true, false, ['Basic data', 'Purchasing', 'MRP', 'Storage', 'Accounting', 'Sales']],
    ['UNBW', 'Non-valuated materials', 'Keep stock quantities without an inventory asset value.', 'external', true, false, false, ['Basic data', 'Purchasing', 'MRP', 'Storage']],
    ['NLAG', 'Non-stock materials', 'Regular purchases for consumption without an inventory balance.', 'external', false, false, false, ['Basic data', 'Purchasing', 'Accounting']],
    ['DIEN', 'Services · ERP reference', 'Service design; also usable in S/4HANA outside lean-service specifics.', 'external', false, false, true, ['Basic data', 'Purchasing', 'Sales', 'Accounting']],
    ['SERV', 'Services · S/4HANA reference', 'Service product type group 2 with reduced fields. Review lean-service requirements.', 'external', false, false, true, ['Basic data', 'Purchasing', 'Sales', 'Accounting']],
  ].map(([code, name, purpose, procurement, quantityUpdate, valueUpdate, service, views]) => ({ code, name, purpose, procurement, quantityUpdate, valueUpdate, service, views, system: code === 'SERV' ? 'S/4HANA' : 'Both', referenceCode: code, notes: code === 'NLAG' ? 'An Accounting view can hold a PR valuation price; it does not mean inventory value updating is enabled.' : code === 'UNBW' ? 'Reference UNBW has no Accounting data. Account-assigned purchasing records cost at GR in the supported model.' : code === 'FERT' ? 'Production and its receipts are outside the PO model. Override procurement only after confirming client configuration.' : 'Reference profile only. Verify permitted views, procurement and quantity/value updates for the relevant valuation area.' }));
  const text = (s, n) => typeof s === 'string' && s.length <= n && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s);
  function validateType(t) {
    if (!t || !text(t.code, 40) || !t.code.trim() || !text(t.name, 160) || !t.name.trim() || !text(t.purpose, 2000) || !text(t.notes, 4000) || !text(t.referenceCode, 40) || !['Both', 'ECC', 'S/4HANA'].includes(t.system) || !Object.hasOwn(PROCUREMENT, t.procurement) || ['quantityUpdate', 'valueUpdate', 'service'].some(k => typeof t[k] !== 'boolean') || !Array.isArray(t.views) || t.views.length > VIEWS.length || new Set(t.views).size !== t.views.length || t.views.some(v => !VIEWS.includes(v))) throw Error('Check the material-type code, explicit attributes, views and reference notes.');
    return t;
  }
  const reference = code => clone(CATALOG.find(t => t.code === code) || CATALOG[4]);
  function mode(t) { return t.quantityUpdate ? t.valueUpdate ? 'valuated' : 'quantity' : 'nonstock'; }
  function applyType(t, base) {
    validateType(t); const E = root.WorkHubSolutionEngine, next = { ...clone(base || E.profile(mode(t))), mode: mode(t), materialType: clone(t) };
    if (t.service || !t.quantityUpdate) { next.purpose = 'consumption'; next.openingQty = 0; }
    if (next.mode === 'quantity') next.purpose = 'stock';
    if (next.mode !== 'valuated' || next.purpose === 'consumption') { next.accountCategory = 'K'; next.glAccount ||= 'Consumption account'; }
    else next.accountCategory = '';
    return next;
  }
  function coverage(t) {
    if (t.service) return 'Service acceptance needs its own model; physical inventory postings are outside this simulator.';
    if (t.valueUpdate && !t.quantityUpdate) return 'Value-only updating is outside this quantity-based inventory model.';
    if (!['external', 'both'].includes(t.procurement)) return 'This reference does not permit external PO procurement. Production receipts are outside this simulator.';
    return '';
  }
  function recommend(answers) {
    const { stored, valued, route, kind } = answers;
    const code = kind === 'service' ? 'SERV' : !stored ? 'NLAG' : !valued ? 'UNBW' : route === 'internal' ? 'FERT' : route === 'both' ? 'HALB' : kind === 'resale' ? 'HAWA' : kind === 'spares' ? 'ERSA' : kind === 'supplies' ? 'HIBE' : 'ROH';
    return { type: reference(code), reason: kind === 'service' ? 'Treat this as a service design, then confirm the target release and service process.' : !stored ? 'You do not need an inventory balance; investigate consumption procurement.' : !valued ? 'You need quantity visibility without inventory value; confirm Finance acceptance of cost timing.' : 'You need quantity and inventory value. The product purpose and procurement route guide this candidate.', checks: ['Confirm material-type configuration in the client system.', 'Confirm the relevant plant / valuation area.', route !== 'external' ? 'Production execution is a separate simulation scope.' : 'Confirm PO purpose and account assignment.'] };
  }
  function checklist(t, profile) {
    return [
      ['identity', 'Product identity', 'Description, material group, base unit and alternative-unit conversions.'],
      ['type', 'Material-type attributes', 'Confirm reference code, field selection, number range and account category reference in OMS2.'],
      ['organisation', 'Organisational levels', 'Confirm plant / valuation area, purchasing organisation and relevant storage locations.'],
      ['procurement', 'Procurement route', PROCUREMENT[t.procurement] + '; confirm permitted and material-specific procurement settings.'],
      ...(t.views.includes('Purchasing') ? [['purchasing', 'Purchasing data', 'Purchasing group, order unit, planned delivery time and receipt tolerances.']] : []),
      ...(t.quantityUpdate ? [['stock', 'Inventory setup', 'Maintain required storage views/extensions, issue unit and stock controls.']] : []),
      ...(t.valueUpdate ? [['valuation', 'Valuation setup', 'Confirm valuation class, price control, price and automatic account determination. The model uses standard price.']] : []),
      ...(!t.valueUpdate || profile?.purpose === 'consumption' ? [['assignment', 'Consumption assignment', 'Confirm the PO account assignment and cost object. This model supports single K and a consumption G/L.']] : []),
      ...(t.service ? [['service', 'Service acceptance design', 'Confirm service product group, item category, acceptance and invoice process with the relevant team.']] : []),
      ['testing', 'SAP acceptance tests', 'Verify the agreed scenarios and accounting in the target SAP system.'],
    ].map(([id, title, detail]) => ({ id, title, detail }));
  }
  const CHECK_IDS = new Set(['identity', 'type', 'organisation', 'procurement', 'purchasing', 'stock', 'valuation', 'assignment', 'service', 'testing']);
  function dependencies(t, p) {
    return [
      ['Material type / valuation area', `Quantity updating ${t.quantityUpdate ? 'on' : 'off'} · value updating ${t.valueUpdate ? 'on' : 'off'}. Allowed departments and procurement are configurable.`, 'type'],
      ['Material / plant', 'Maintain the views and organisational extensions. Price control, valuation class, procurement type and negative-stock permission also need confirmation.', 'material'],
      ['Purchase-order item', `Purpose: ${p.purpose}. Account assignment: ${p.accountCategory || 'none'}. GR expected: ${p.grAllowed ? 'yes' : 'no'}. PO price and tolerances affect the result.`, 'po'],
      ['Movement + available stock', 'The movement and its reference determine the effect. A transfer checks the source location; cancellation checks its original document.', 'movement'],
      ['Account determination', 'Material type → account category reference → permitted valuation classes. Valuation class and posting context participate in G/L determination. PO category K is a different control.', 'account'],
    ];
  }
  function perspective(level, product, process, proposal) {
    if (!proposal) return 'Create a proposal to explain the proposed design.';
    const p = proposal.profile, t = p.materialType, subject = product?.name || 'The selected products';
    if (t && coverage(t)) return `${subject} · ${t.code}: ${coverage(t)} ${level === 'finance' ? 'Confirm the cost-recognition, valuation and reconciliation design with Finance in the target system.' : level === 'consultant' ? `Target ${proposal.system}; confirm the specialist process, material attributes, item category and document controls before testing.` : 'The business process can be documented here; its posting consequences need confirmation in SAP.'}`;
    if (level === 'finance') return `${subject}: ${p.mode === 'valuated' && p.purpose === 'stock' ? 'inventory is carried at the model’s standard price; PO-price differences are separated. Consumption moves value to expense.' : p.mode === 'quantity' ? 'purchase cost is expensed at GR in the supported K scenario; subsequent quantity issues create no second expense.' : 'the account-assigned receipt records consumption cost without building inventory.'} GR/IR is shown separately; invoices, tax and moving-average valuation are outside the model. Confirm G/L determination and cost ownership.`;
    if (level === 'consultant') return `${proposal.system} · ${t?.code || p.mode} · ${p.purpose} procurement · ${p.accountCategory || 'no'} PO assignment. ${t ? `Explicit quantity/value updating: ${t.quantityUpdate}/${t.valueUpdate}. ` : ''}${process?.objective || ''} Confirm material views, valuation-area settings, account determination and PO controls. ${proposal.assumptions || 'Record the configuration assumptions before agreement.'}`;
    return `${subject}: ${proposal.approach || (p.mode === 'nonstock' ? 'purchase for immediate use' : 'record receipts and later withdrawals')}. ${p.mode === 'valuated' && p.purpose === 'stock' ? 'The team can see remaining quantity and stock value.' : p.mode === 'quantity' ? 'The team can see remaining quantity, while purchase costs are recognised earlier.' : 'Purchases go to consumption; this proposal keeps no inventory balance.'} ${proposal.benefits || ''}`;
  }
  function validateRecords(d, h, maps) {
    for (const t of h.materialTypes) validateType(t);
    for (const p of h.products) if (p.materialType !== undefined) validateType(p.materialType);
    for (const p of h.processes) if (p.interview !== undefined) {
      const fields = ['product', 'buy', 'store', 'consume', 'make', 'sell', 'pain'];
      if (!p.interview || Object.keys(p.interview).some(k => !fields.includes(k)) || fields.some(k => !text(p.interview[k], 2000))) throw Error('Check the business discovery answers.');
    }
    for (const p of h.proposals) if (p.preparation !== undefined && (!Array.isArray(p.preparation) || p.preparation.length > CHECK_IDS.size || new Set(p.preparation).size !== p.preparation.length || p.preparation.some(k => !CHECK_IDS.has(k)))) throw Error('Check the material-master preparation checklist.');
    for (const r of h.businessRules) {
      const p = maps.processes.get(r.processId);
      if (!p || p.projectId !== r.projectId || !text(r.title, 160) || !r.title.trim() || !text(r.condition, 2000) || !text(r.response, 2000) || !text(r.owner, 160) || !['Configuration', 'Workflow', 'Manual control', 'To confirm'].includes(r.implementation) || !Array.isArray(r.stepIds) || new Set(r.stepIds).size !== r.stepIds.length || r.stepIds.length > 40 || r.stepIds.some(id => !p.steps.some(s => s.id === id))) throw Error('Check the business rule and its process-step links.');
    }
    for (const n of h.workshopNotes) {
      const p = maps.processes.get(n.processId);
      if (!p || p.projectId !== n.projectId || !['Question', 'Decision', 'Action'].includes(n.kind) || !text(n.text, 2000) || !n.text.trim() || !text(n.by, 160) || !text(n.at, 40) || !Number.isFinite(Date.parse(n.at))) throw Error('Check the workshop note and its process context.');
    }
    if (new Set(h.preparations.map(r => r.proposalId)).size !== h.preparations.length) throw Error('Keep one preparation checklist per proposal.');
    for (const r of h.preparations) {
      const p = maps.proposals.get(r.proposalId);
      if (!p || p.projectId !== r.projectId || !text(r.profile, 12000) || !Array.isArray(r.checked) || r.checked.length > CHECK_IDS.size || new Set(r.checked).size !== r.checked.length || r.checked.some(k => !CHECK_IDS.has(k))) throw Error('Check the preparation checklist and proposal context.');
    }
  }
  root.WorkHubSolutionMaterials = { CATALOG, SOURCES, PROCUREMENT, VIEWS, CHECK_IDS, reference, validateType, applyType, coverage, mode, recommend, checklist, dependencies, perspective, validateRecords };
})(window);
