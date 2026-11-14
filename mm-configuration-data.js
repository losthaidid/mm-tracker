/** Versioned SAP examples used by the Process Hub MM simulator. */
(function (root) {
  'use strict';

  const learning = 'https://learning.sap.com/courses/';
  const inventory = learning + 'inventory-management-and-physical-inventory-in-sap-s-4hana/';
  const customizing =
    learning + 'cross-functional-customizing-in-sap-s-4hana-materials-management/';
  const help = 'https://help.sap.com/docs/';
  const sources = {
    materialTypes: [
      'SAP Learning · Material type controls',
      customizing + 'creating-material-types',
    ],
    materials: ['SAP Help · Material valuation', help + 'SUPPORT_CONTENT/ldm/3363506413.html'],
    nonstock: [
      'SAP Learning · UNBW and NLAG',
      inventory + 'posting-goods-movements-for-material-types-unbw-and-nlag',
    ],
    accounting: [
      'SAP Learning · Automatic account determination',
      customizing + 'describing-automatic-account-determination',
    ],
    keys: [
      'SAP Learning · Transaction keys and posting rules',
      customizing + 'setting-up-account-determination-for-specific-transactions',
    ],
    modifiers: [
      'SAP Learning · Account grouping',
      customizing + 'subdividing-a-transaction-with-the-account-grouping-code',
    ],
    gbb: [
      'SAP Help · GBB and standard modifiers',
      help + 's4hana-best-practices/s4cld-usl/gbb-offsetting-entry-for-inventory-posting',
    ],
    moves: ['SAP Learning · Movement type settings', inventory + 'setting-up-movement-types-1'],
    moveCodes: [
      'SAP Help · Movement types and reversals',
      help +
        'SAP_S4HANA_ON-PREMISE/ee6ff9b281d8448f96b4fe6c89f2bdc8/8b7b5fe73ef54063a2bfcfbe83cebd38.html',
    ],
    doc: [
      'SAP Help · Material and accounting documents',
      help +
        'SAP_S4HANA_CLOUD/32da8359c8ee4e8b8e8c5e15cacba5aa/b19bce0a4e5f4256b101ed2be62fa94b.html',
    ],
    assignment: [
      'SAP Learning · Account assignment categories',
      learning +
        'exploring-cross-functional-customizing-in-sap-s-4hana-cloud-private-edition/creating-account-assignment-categories_a6fe21e0-ed51-4041-a5ba-12bdd7a9753c',
    ],
    item: [
      'SAP Help · PO item categories',
      help +
        'SAP_S4HANA_ON-PREMISE/af9ef57f504840d2b81be8667206d485/a37eb65334e6b54ce10000000a174cb4.html',
    ],
    assignedInvoice: [
      'SAP Help · Invoices for account-assigned POs',
      help + 'SAP_ERP_SPV/98eed63ea3a544af84eb972dc68b0e84/d339b953495bb44ce10000000a174cb4.html',
    ],
    grBased: [
      'SAP Help · GR-based invoice verification',
      help + 'SAP_ERP/7de135920d6b44298b1d498e57882cf6/a97eb65334e6b54ce10000000a174cb4.html',
    ],
    po: [
      'SAP Learning · Stock procurement process',
      learning +
        'procurement-process-overview/describing-the-direct-materials-procurement-process-in-sap-s-4hana',
    ],
    gr: [
      'SAP Learning · Goods receipt with reference',
      inventory + 'posting-a-goods-receipt-with-reference',
    ],
    noPo: [
      'SAP Learning · Goods receipt without reference',
      inventory + 'posting-a-goods-receipt-without-reference',
    ],
    noPoAccounting: [
      'SAP Help · Valuation of receipt without PO',
      help + 'SAP_ERP/c587d5cadece40a285ce9a6d4a2a4908/9a5eb6531de6b64ce10000000a174cb4.html',
    ],
    issues: ['SAP Learning · Unplanned goods issues', inventory + 'posting-unplanned-goods-issues'],
    asset: [
      'SAP Help · Warehouse issue to an asset',
      help +
        'SAP_S4HANA_ON-PREMISE/67e323b7117e4c91869c258933f47182/233fde531ed3424de10000000a174cb4.html',
    ],
    productionAccounts: [
      'SAP Help · Production cost postings',
      help +
        'SAP_S4HANA_ON-PREMISE/5e23dc8fe9be4fd496f8ab556667ea05/fcc7d8530439414de10000000a174cb4.html',
    ],
    thirdParty: [
      'SAP Help · Third-party processing in MM',
      help +
        'SAP_S4HANA_ON-PREMISE/91b21005dded4984bcccf4a69ae1300c/5513b953495bb44ce10000000a174cb4.html',
    ],
    classicService: [
      'SAP Help · Service acceptance',
      help +
        'SAP_S4HANA_ON-PREMISE/af9ef57f504840d2b81be8667206d485/c01cbf53d25ab64ce10000000a174cb4.html',
    ],
    production: [
      'SAP Learning · Production orders and goods movements',
      learning +
        'applying-business-processes-in-production-planning-and-manufacturing-operations/confirmations-and-goods-receipt_fe3853e4-4379-4482-b325-9261444b68ab',
    ],
    returns: [
      'SAP Learning · Cancellations and returns',
      inventory + 'posting-cancellations-return-deliveries-and-returns',
    ],
    sloc: [
      'SAP Help · Storage-location transfer',
      help +
        'SAP_S4HANA_ON-PREMISE/91b21005dded4984bcccf4a69ae1300c/a764bd534f22b44ce10000000a174cb4.html',
    ],
    slocTwo: [
      'SAP Learning · Transfers between storage locations',
      inventory + 'performing-stock-transfers-between-storage-locations',
    ],
    plants: [
      'SAP Learning · Transfers between plants',
      inventory + 'performing-stock-transfers-between-plants',
    ],
    stockType: ['SAP Learning · Transfer postings', inventory + 'performing-transfer-postings'],
    sto: [
      'SAP Learning · Stock transport orders',
      learning +
        'procurement-process-overview/explaining-stock-transfer-business-processes-in-sap-s-4hana',
    ],
    stoBilling: [
      'SAP Help · Stock transport with delivery and billing',
      help + 'SAP_ERP/00b86df2555f4c83b47b97a5c1223904/307ec1536ca9b54ce10000000a174cb4.html',
    ],
    inventory: [
      'SAP Learning · Physical inventory differences',
      inventory + 'conducting-physical-inventory',
    ],
    consignment: [
      'SAP Learning · Supplier consignment and settlement',
      inventory + 'performing-the-process-of-vendor-consignment',
    ],
    consignmentOwn: [
      'SAP Help · Transfer consignment into own stock',
      help + 'SAP_ERP/b704a8db767040a08100adc846218964/c361bd534f22b44ce10000000a174cb4.html',
    ],
    sub: ['SAP Learning · Subcontracting', inventory + 'performing-the-process-of-subcontracting'],
    subReceipt: [
      'SAP Help · Receipt with subcontracting components',
      help +
        'SAP_S4HANA_ON-PREMISE/91b21005dded4984bcccf4a69ae1300c/b591e33c19fc4bd7a07959bab5eb13d8.html',
    ],
    service: [
      'SAP Learning · Lean service entry sheets',
      learning +
        'business-processes-in-sap-s-4hana-sourcing-and-procurement/processing-a-service-entry-sheet_e42ab0b6-291a-4dad-9f5c-7f508d21ae5c',
    ],
    pipeline: ['SAP Learning · Pipeline withdrawals', inventory + 'operating-pipeline-processes'],
    price: [
      'SAP Help · Standard price and moving average price',
      help +
        'SAP_S4HANA_CLOUD_PE/af9ef57f504840d2b81be8667206d485/6a5eb6531de6b64ce10000000a174cb4.html',
    ],
    invoice: [
      'SAP Learning · Stock PO invoice',
      learning +
        'business-processes-in-sap-s-4hana-sourcing-and-procurement/entering-an-invoice-for-stock-material_c5215178-39f9-4023-8c54-2a8976f9566a',
    ],
    variances: [
      'SAP Help · Valuation in invoice verification',
      help + 'SUPPORT_CONTENT/spmm/3362167904.html',
    ],
    tolerance: [
      'SAP Learning · Invoice tolerances and blocks',
      learning + 'invoice-verification-in-sap-s-4hana/entering-invoices-with-variances-1',
    ],
    cancelInvoice: [
      'SAP Help · Reversing a logistics invoice',
      help +
        'SAP_S4HANA_CLOUD/0e602d466b99490187fcbb30d1dc897c/4071b6531de6b64ce10000000a174cb4.html',
    ],
    publicConfig: [
      'SAP Help · Public Edition account determination',
      help + 's4hana-best-practices/s4cld-usl/account-determination',
    ],
  };

  const checkpoints = {
    material: [
      'Material type and valuation',
      'OMS2 / OMSK',
      'Check Quantity Update and Value Update for the valuation area. The account category reference permits a set of valuation classes. The material’s Accounting view supplies the actual class. With split valuation, check the selected valuation type.',
      ['T134M', 'MBEW'],
      ['materialTypes', 'materials', 'nonstock'],
    ],
    org: [
      'Plant and company code',
      'OMWD / OBYC',
      'Check the valuation area, valuation grouping code where used, and company code’s chart of accounts. These fields feed automatic account determination.',
      ['T001W', 'T001K', 'T001', 'T030'],
      ['accounting'],
    ],
    posting: [
      'Automatic account determination',
      'OBYC',
      'Check the rule for each transaction key. A line uses valuation class, valuation grouping, general modification, or debit and credit differentiation according to that key’s configuration.',
      ['T030', 'MBEW'],
      ['keys', 'modifiers', 'publicConfig'],
    ],
    movement: [
      'Movement type control',
      'OMJJ',
      'Check the reference, permitted stock and movement context, quantity or value update, account grouping and reversal. A single movement code can behave differently by reference and special stock.',
      ['T156'],
      ['moves', 'moveCodes'],
    ],
    purchasing: [
      'Purchase requisition and purchase order',
      'ME51N / ME21N',
      'Check the document and item categories, plant, supplier and account assignment. PR or PO creation can update approvals or commitments in the relevant setup. The stock GR and invoice are the normal financial posting points.',
      ['EBAN', 'EKKO', 'EKPO'],
      ['po', 'item'],
    ],
    assignment: [
      'Goods receipt for an account-assigned item',
      'OME9 / ME22N',
      'Check that the PO item category permits receipt, then check Goods Receipt and GR Non-Valuated on the Delivery tab. Account assignment category settings can supply defaults or make indicators mandatory. The selected cost center, asset, order or WBS and its G/L assignment drive the cost posting.',
      ['EKPO', 'EKKN'],
      ['assignment', 'item', 'assignedInvoice', 'nonstock'],
    ],
    receipt: [
      'Receipt reference and stock type',
      'MIGO / ME23N',
      'Check the open PO item, delivery tolerances, plant, storage location, batch or serial requirements, and stock type. A QM inspection lot is conditional on active inspection setup and the receipt context.',
      ['EKPO', 'EKBE', 'MATDOC', 'MSEG', 'QALS'],
      ['gr', 'doc'],
    ],
    nonPo: [
      'Receipt without a purchase order',
      'MIGO / OMJJ',
      'Choose Other as the reference for 501. Confirm that the material is extended to the plant, the valuation and price are available for valuated stock, and the stock type and movement are permitted. This creates no supplier payable by itself.',
      ['MATDOC', 'MSEG', 'T156', 'T030'],
      ['noPo', 'noPoAccounting', 'gbb'],
    ],
    blocked: [
      'GR blocked stock and origin acceptance',
      'MIGO / ME23N',
      'Use 103 and 105 for non-valuated GR blocked stock. For origin acceptance, check the PO Delivery tab and use 107 and 109 for valuated GR blocked stock. For a wrong acceptance, use the appropriate reversal and reference.',
      ['EKBE', 'MATDOC', 'MSEG'],
      ['gr', 'moveCodes'],
    ],
    issue: [
      'Issue reference and availability',
      'MIGO / OMJJ',
      'Check available stock or the applicable negative stock configuration, the required cost object, reservation or order, posting date, and field selection for the movement and G/L account.',
      ['MATDOC', 'MSEG', 'RESB', 'T156', 'T030'],
      ['issues', 'moves', 'modifiers'],
    ],
    asset: [
      'Asset Accounting integration',
      'MIGO / AS03',
      'For a warehouse issue, enter a valid asset and subnumber and check the asset transaction type and account determination. A PO with account assignment A is a separate purchase path with capitalization at valuated GR or at invoice for non-valuated GR.',
      ['EKKN', 'MATDOC', 'BKPF', 'ACDOCA'],
      ['asset', 'assignment', 'assignedInvoice'],
    ],
    production: [
      'Production order and component processing',
      'CO03 / MIGO',
      'Check the order status, material and reservation. Backflush or automatic GR can be triggered by confirmation when configured. Component consumption and finished product receipt are distinct postings.',
      ['AFKO', 'AFPO', 'RESB', 'MATDOC', 'ACDOCA'],
      ['production', 'productionAccounts', 'gr'],
    ],
    transfer: [
      'Supplying and receiving locations',
      'MIGO / OMWD',
      'Check whether both locations belong to the same valuation area. In two-step movements check which location removes stock and which receives it. Separate valuation areas or price differences can change the FI posting for plant transfers.',
      ['T001W', 'T001K', 'MARD', 'MBEW', 'MATDOC'],
      ['sloc', 'slocTwo', 'plants'],
    ],
    stockType: [
      'Stock category and QM controls',
      'MIGO / QA11',
      'Check the source stock category. If QM controls inspection stock, complete the appropriate usage decision or inspection-lot stock posting for your process. For 309, check both material masters, a common base unit, and valuation.',
      ['QALS', 'QAVE', 'MARA', 'MBEW', 'MATDOC'],
      ['stockType', 'moveCodes'],
    ],
    sto: [
      'Stock transport order route',
      'ME21N / MIGO / VL02N',
      'Check supplying plant, receiving plant, document and item categories, and whether delivery is required. For delivery and billing, verify shipping data, billing relevance, and company codes. Monitor stock in transit until the receiving step.',
      ['EKKO', 'EKPO', 'EKBE', 'LIKP', 'LIPS'],
      ['sto', 'plants', 'stoBilling'],
    ],
    returns: [
      'Original posting and return reference',
      'MIGO / ME23N',
      'Check the original material document for cancellation. A return delivery references an earlier receipt, while 161 follows a returns PO item. Supplier credit or invoice cancellation is a separate step when an invoice already exists.',
      ['EKBE', 'MATDOC', 'MSEG', 'RBKP'],
      ['returns', 'cancelInvoice'],
    ],
    thirdParty: [
      'Third-party procurement',
      'ME21N / ME23N',
      'Check the third-party PO item category and account assignment from the sales order or manual requisition. The supplier ships to the customer. A statistical GR can record delivery when allowed; customer billing follows SD billing relevance.',
      ['EKKO', 'EKPO', 'EKKN', 'EKBE', 'RSEG'],
      ['thirdParty', 'item'],
    ],
    service: [
      'Service acceptance before invoice',
      'Manage Service Entry Sheets – Lean Services',
      'Check a lean service PO, its account assignment and acceptance workflow. Approval of the service entry sheet triggers the receipt in the standard lean-services process. The accounting timing follows the PO valuation settings.',
      ['EKKO', 'EKPO', 'EKBE', 'RSEG'],
      ['service', 'classicService', 'assignedInvoice'],
    ],
    inventory: [
      'Inventory count and tolerances',
      'MI01 / MI04 / MI07',
      'Create the physical inventory document, enter the count, and post the difference when authorized. Check stock status, posting period, recount requirements and tolerance groups. 701 and 702 are standard examples for unrestricted-use stock.',
      ['MATDOC', 'MSEG', 'T030'],
      ['inventory', 'gbb', 'moveCodes'],
    ],
    special: [
      'Ownership, item category and settlement',
      'ME21N / MIGO / MRKO',
      'Check the special-stock indicator, owner and purchasing info record where applicable. Supplier consignment stock remains supplier-owned until the liability-triggering withdrawal or transfer. Consignment and pipeline liabilities use settlement.',
      ['EKKO', 'EKPO', 'MATDOC', 'T030'],
      ['consignment', 'consignmentOwn', 'pipeline'],
    ],
    subcontract: [
      'Subcontracting and component provision',
      'ME21N / MIGO',
      'Use the subcontracting PO item and check the BOM or PO components, stock provided to the supplier, and component quantities at GR. The 541 provision and the component consumption at receipt are different postings.',
      ['EKPO', 'RESB', 'MATDOC', 'EKBE'],
      ['sub', 'subReceipt', 'moveCodes'],
    ],
    invoice: [
      'Invoice verification and payment block',
      'MIRO / OMR6',
      'Check the PO history, remaining quantity, GR-based invoice verification, tax and delivery costs, tolerance limits and payment blocks. Price control and remaining stock coverage affect price-difference postings.',
      ['EKBE', 'RBKP', 'RSEG', 'BKPF', 'ACDOCA'],
      ['invoice', 'variances', 'tolerance', 'grBased'],
    ],
    invoiceCancel: [
      'Invoice reversal and clearing',
      'MR8M / MIR4',
      'Check the original invoice and whether it can be reversed. The cancellation generates the corresponding invoice or credit memo document. Any clearing or payment already posted needs its own follow-up in FI.',
      ['RBKP', 'RSEG', 'BKPF', 'ACDOCA'],
      ['cancelInvoice'],
    ],
  };

  const materials = [
    ['ROH', 'Raw material', true, true, '3000'],
    ['HALB', 'Semi-finished material', true, true, ''],
    ['HIBE', 'Operating supplies', true, true, ''],
    ['VERP', 'Packaging material', true, true, ''],
    ['FERT', 'Finished product', true, true, ''],
    ['HAWA', 'Trading goods', true, true, ''],
    ['UNBW', 'Non-valuated material', true, false, ''],
    ['NLAG', 'Non-stock material', false, false, ''],
  ].map(([code, name, quantity, value, classes]) => ({
    id: '',
    kind: 'material',
    code,
    name,
    area: '',
    quantity,
    value,
    reference: '',
    classes,
    notes: '',
  }));

  const moves = [
    ['101', 'Goods receipt against order', '102', 'Order', ''],
    ['104', 'Reverse non-valuated blocked receipt', '103', 'Blocked receipt document', ''],
    [
      '106',
      'Reverse release from non-valuated GR blocked stock',
      '105',
      'Original release document',
      '',
    ],
    [
      '108',
      'Reverse acceptance into valuated GR blocked stock',
      '107',
      'Blocked receipt document',
      '',
    ],
    [
      '110',
      'Reverse release from valuated GR blocked stock',
      '109',
      'Original release document',
      '',
    ],
    ['102', 'Reverse goods receipt', '101', 'Original material document', ''],
    ['103', 'Receipt into non-valuated GR blocked stock', '104', 'Purchase order', ''],
    ['105', 'Release non-valuated GR blocked stock', '106', 'Blocked receipt document', ''],
    ['107', 'Receipt into valuated GR blocked stock', '108', 'Purchase order', ''],
    ['109', 'Release valuated GR blocked stock', '110', 'Blocked receipt document', ''],
    ['122', 'Return delivery to supplier', '123', 'Original receipt', ''],
    ['124', 'Return from non-valuated GR blocked stock', '125', 'Blocked receipt document', ''],
    ['161', 'Return against returns PO', '162', 'Returns PO item', ''],
    ['201', 'Goods issue to cost center', '202', 'Cost center', 'VBR'],
    ['202', 'Reverse issue to cost center', '201', 'Original material document', 'VBR'],
    ['221', 'Goods issue to project', '222', 'WBS element', 'VBR'],
    ['241', 'Goods issue to asset', '242', 'Asset and subnumber', ''],
    ['261', 'Goods issue to production order', '262', 'Production order or reservation', 'VBR'],
    ['301', 'Plant-to-plant transfer in one step', '302', 'Receiving plant', ''],
    ['303', 'Remove stock for two-step plant transfer', '304', 'Receiving plant', ''],
    ['305', 'Receive stock from two-step plant transfer', '306', 'Plant transfer reference', ''],
    ['309', 'Material-to-material transfer', '310', 'Receiving material', ''],
    ['311', 'Storage-location transfer in one step', '312', 'Receiving storage location', ''],
    ['313', 'Remove stock for storage-location transfer', '314', 'Receiving storage location', ''],
    ['315', 'Receive stock from storage-location transfer', '316', 'Transfer reference', ''],
    [
      '321',
      'Quality inspection to unrestricted stock',
      '322',
      'Source stock or inspection lot',
      '',
    ],
    ['343', 'Blocked to unrestricted stock', '344', 'Blocked stock', ''],
    [
      '351',
      'Goods issue for stock transport order without delivery',
      '352',
      'Stock transport order',
      '',
    ],
    [
      '411',
      'Transfer supplier consignment to own stock',
      '412',
      'Supplier and consignment stock',
      '',
    ],
    ['501', 'Goods receipt without a PO', '502', 'Other goods receipt', 'ZOB'],
    ['541', 'Provide components to subcontractor', '542', 'Supplier and components', ''],
    [
      '543',
      'Consume subcontracting components at GR',
      '544',
      'Subcontracting PO components',
      'VBO',
    ],
    [
      '551',
      'Scrap unrestricted-use stock',
      '552',
      'Stock and movement reason where required',
      'VNG',
    ],
    ['561', 'Initial entry of stock balances', '562', 'Opening stock', 'BSA'],
    ['601', 'Goods issue for outbound delivery', '602', 'Outbound delivery', 'VAX'],
    [
      '641',
      'Goods issue for intracompany stock transport delivery',
      '642',
      'Outbound delivery',
      '',
    ],
    [
      '643',
      'Goods issue for cross-company stock transport delivery',
      '644',
      'Outbound delivery',
      '',
    ],
    [
      '701',
      'Physical inventory gain, unrestricted use',
      '702',
      'Counted inventory document',
      'INV',
    ],
    [
      '702',
      'Physical inventory loss, unrestricted use',
      '701',
      'Counted inventory document',
      'INV',
    ],
    ['511', 'Free-of-charge delivery from supplier', '512', 'Supplier and receipt context', ''],
    ['512', 'Reverse free-of-charge delivery', '511', 'Original receipt document', ''],
  ].map(([code, name, reversal, required, modifier]) => ({
    id: '',
    kind: 'movement',
    code,
    name,
    base: code,
    reversal,
    required,
    modifier,
    notes: '',
  }));

  const editions = {
    s4: 'S/4HANA On-Premise / Private Edition',
    ecc: 'ECC',
    public: 'S/4HANA Cloud Public Edition',
  };
  const plants = [
    ['1000', 'Example plant 1000', '1000', '1000', 'INT', '0001'],
    ['1100', 'Example plant 1100', '1100', '1000', 'INT', '0001'],
    ['2000', 'Example plant 2000', '2000', '2000', 'INT', '0002'],
  ].map(([code, name, area, company, chart, group]) => ({
    id: '',
    kind: 'plant',
    code,
    name,
    area,
    company,
    chart,
    group,
    notes: '',
  }));

  const groups = {
    purchase: 'Purchasing & receipts',
    issue: 'Goods issues',
    transfer: 'Transfers & stock changes',
    returns: 'Returns & reversals',
    special: 'Special procurement',
    inventory: 'Physical inventory',
    invoice: 'Invoice verification',
  };
  function step(title, rule, check, movement = '', note = '', mode = '') {
    return { title, rule, check, movement, note, mode };
  }
  const pr = step('Purchase requisition', 'pr', 'purchasing');
  const po = step('Purchase order', 'po', 'purchasing');
  const gr = step('Goods receipt', 'gr', 'receipt', '101');
  const ir = step('Invoice receipt', 'invoice', 'invoice');
  const payment = step(
    'Supplier payment',
    'payment',
    'invoice',
    '',
    'The payment run or manual payment is handled in FI and clears the vendor open item when eligible.'
  );
  const leanService = [
    pr,
    po,
    step('Submit service entry sheet', 'serviceEntry', 'service'),
    step('Approve service entry and record receipt', 'serviceGr', 'service'),
    ir,
    payment,
  ];
  const scenarios = [
    ['stock-po', 'purchase', 'Purchase for stock', 'ROH', '', [pr, po, gr, ir, payment]],
    [
      'nonstock-po',
      'purchase',
      'Non-stock PO with goods receipt',
      'NLAG',
      'K',
      [pr, po, step('Goods receipt for consumption', 'gr', 'assignment', '101'), ir, payment],
    ],
    [
      'nonvaluated-po',
      'purchase',
      'Quantity-only stock with non-valuated GR',
      'UNBW',
      'K',
      [
        pr,
        po,
        step('Goods receipt into quantity-only stock', 'gr', 'assignment', '101'),
        ir,
        payment,
      ],
      { nonValuated: true },
    ],
    [
      'direct-po',
      'purchase',
      'Account-assigned PO for direct consumption',
      'ROH',
      'K',
      [pr, po, step('Goods receipt for consumption', 'gr', 'assignment', '101'), ir, payment],
      { direct: true },
    ],
    [
      'invoice-only',
      'purchase',
      'Account-assigned PO with invoice only',
      'NLAG',
      'K',
      [pr, po, ir, payment],
      { noReceipt: true },
    ],
    [
      'asset-po',
      'purchase',
      'Purchase directly for an asset',
      'ROH',
      'A',
      [pr, po, step('Goods receipt for asset', 'gr', 'asset', '101'), ir, payment],
      { direct: true },
    ],
    [
      'receipt-other',
      'purchase',
      'Receipt without a purchase order',
      'ROH',
      '',
      [
        step(
          'Other goods receipt',
          'receipt',
          'nonPo',
          '501',
          'An unplanned receipt from external procurement without a PO reference.'
        ),
      ],
    ],
    [
      'blocked-gr',
      'purchase',
      'Receipt into non-valuated GR blocked stock',
      'ROH',
      '',
      [
        po,
        step('Record blocked receipt', 'blocked', 'blocked', '103'),
        step('Release into inventory', 'gr', 'blocked', '105'),
        ir,
      ],
    ],
    [
      'origin-gr',
      'purchase',
      'Origin acceptance and delayed delivery',
      'ROH',
      '',
      [
        po,
        step(
          'Accept into valuated GR blocked stock',
          'gr',
          'blocked',
          '107',
          'Origin acceptance values the material before physical arrival.'
        ),
        step(
          'Release to warehouse stock',
          'reclass',
          'blocked',
          '109',
          'Moves accepted stock to the selected stock category.'
        ),
        ir,
      ],
    ],
    [
      'production-gr',
      'purchase',
      'Receipt from a production order',
      'FERT',
      '',
      [
        step('Production order', 'order', 'production'),
        step('Receive finished material', 'productionGr', 'production', '101'),
      ],
    ],
    [
      'cost-issue',
      'issue',
      'Warehouse issue to a cost center',
      'ROH',
      'K',
      [step('Issue to cost center', 'issue', 'issue', '201')],
    ],
    [
      'asset-issue',
      'issue',
      'Warehouse issue to an asset',
      'ROH',
      'A',
      [step('Issue to asset', 'issue', 'asset', '241', '', 'asset')],
    ],
    [
      'project-issue',
      'issue',
      'Warehouse issue to a project',
      'ROH',
      'P',
      [step('Issue to WBS element', 'issue', 'issue', '221')],
    ],
    [
      'production-issue',
      'issue',
      'Components to a production order',
      'ROH',
      'F',
      [
        step('Production order or reservation', 'order', 'production'),
        step('Issue components', 'issue', 'production', '261'),
      ],
    ],
    [
      'scrap',
      'issue',
      'Scrap unrestricted-use stock',
      'ROH',
      '',
      [step('Post scrapping', 'issue', 'issue', '551')],
    ],
    [
      'delivery-issue',
      'issue',
      'Goods issue against outbound delivery',
      'FERT',
      '',
      [
        step('Outbound delivery', 'delivery', 'issue'),
        step('Post goods issue', 'deliveryIssue', 'issue', '601'),
      ],
    ],
    [
      'storage-transfer',
      'transfer',
      'Storage-location transfer, one step',
      'ROH',
      '',
      [
        step(
          'Move between storage locations',
          'reclass',
          'transfer',
          '311',
          'Issue and receipt happen together in the same plant.'
        ),
      ],
    ],
    [
      'storage-two',
      'transfer',
      'Storage-location transfer, two steps',
      'ROH',
      '',
      [
        step(
          'Remove from issuing storage location',
          'reclass',
          'transfer',
          '313',
          'Quantity enters stock in transfer for the receiving storage location.'
        ),
        step(
          'Place into receiving storage location',
          'reclass',
          'transfer',
          '315',
          'Quantity leaves stock in transfer and enters receiving stock.'
        ),
      ],
    ],
    [
      'plant-transfer',
      'transfer',
      'Plant-to-plant transfer, one step',
      'ROH',
      '',
      [step('Move stock to receiving plant', 'transfer', 'transfer', '301')],
      { receivingPlant: true },
    ],
    [
      'plant-two',
      'transfer',
      'Plant-to-plant transfer, two steps',
      'ROH',
      '',
      [
        step(
          'Remove from supplying plant',
          'transfer',
          'transfer',
          '303',
          'Quantity enters the receiving plant’s stock in transfer.'
        ),
        step(
          'Receive from stock in transfer',
          'reclass',
          'transfer',
          '305',
          'Quantity leaves stock in transfer and enters available stock.'
        ),
      ],
      { receivingPlant: true },
    ],
    [
      'sto',
      'transfer',
      'Stock transport order without delivery',
      'ROH',
      '',
      [
        step('Stock transport order', 'sto', 'sto'),
        step('Issue to stock in transit', 'transfer', 'sto', '351'),
        step(
          'Receive from stock in transit',
          'reclass',
          'sto',
          '101',
          'Complete the receipt against the stock transport order.'
        ),
      ],
      { receivingPlant: true, route: 'same-company' },
    ],
    [
      'sto-delivery',
      'transfer',
      'Stock transport order with delivery',
      'ROH',
      '',
      [
        step('Stock transport order', 'sto', 'sto'),
        step('Outbound delivery', 'delivery', 'sto'),
        step(
          'Issue for delivery',
          'transfer',
          'sto',
          '641',
          'Classic two-step transfer between plants of the same company code.'
        ),
        step('Receive from stock in transit', 'reclass', 'sto', '101'),
      ],
      { receivingPlant: true, route: 'same-company' },
    ],
    [
      'sto-cross',
      'transfer',
      'Cross-company stock transport with billing',
      'ROH',
      '',
      [
        step('Stock transport order', 'sto', 'sto'),
        step('Outbound delivery', 'delivery', 'sto'),
        step('Issue from supplying company code', 'crossIssue', 'sto', '643'),
        step('Receive into buying company code', 'crossReceipt', 'sto', '101'),
        step('Intercompany billing', 'billing', 'sto'),
        ir,
      ],
      { receivingPlant: true, route: 'cross-company' },
    ],
    [
      'quality-release',
      'transfer',
      'Quality inspection to unrestricted use',
      'ROH',
      '',
      [
        step(
          'Release inspected stock',
          'reclass',
          'stockType',
          '321',
          'Inspection/usage-decision control applies when QM manages the stock.'
        ),
      ],
    ],
    [
      'blocked-release',
      'transfer',
      'Blocked stock to unrestricted use',
      'ROH',
      '',
      [
        step(
          'Release blocked warehouse stock',
          'reclass',
          'stockType',
          '343',
          'This is a stock type change within warehouse stock.'
        ),
      ],
    ],
    [
      'material-transfer',
      'transfer',
      'Material-to-material transfer',
      'ROH',
      '',
      [
        step(
          'Transfer to a different material',
          'materialTransfer',
          'stockType',
          '309',
          'Choose a receiving material with the same base unit of measure.'
        ),
      ],
    ],
    [
      'reverse-gr',
      'returns',
      'Reverse a stock PO receipt',
      'ROH',
      '',
      [
        step(
          'Reverse original receipt',
          'return',
          'returns',
          '102',
          'Use the original material document. Original FI lines reverse when the original receipt was valuated.'
        ),
      ],
    ],
    [
      'return-gr',
      'returns',
      'Return delivered stock to a supplier',
      'ROH',
      '',
      [
        step('Return against original receipt', 'return', 'returns', '122'),
        step('Supplier credit memo, when due', 'credit', 'invoice'),
      ],
    ],
    [
      'return-po',
      'returns',
      'Return via returns purchase order',
      'ROH',
      '',
      [
        step('Returns purchase order', 'po', 'returns'),
        step('Send goods back to supplier', 'return', 'returns', '161'),
        step('Supplier credit memo, when due', 'credit', 'invoice'),
      ],
    ],
    [
      'return-blocked',
      'returns',
      'Return from non-valuated GR blocked stock',
      'ROH',
      '',
      [step('Return unaccepted delivery', 'blockedReturn', 'returns', '124')],
    ],
    [
      'reverse-issue',
      'returns',
      'Reverse issue to cost center',
      'ROH',
      'K',
      [step('Reverse the original issue', 'reverseIssue', 'returns', '202')],
    ],
    [
      'subcontract',
      'special',
      'Subcontracting with components',
      'ROH',
      '',
      [
        po,
        step('Provide components to subcontractor', 'provision', 'subcontract', '541'),
        step(
          'Receive subcontracted material',
          'subGr',
          'subcontract',
          '101',
          'SAP can post the child component issue at the same time.'
        ),
        step('Component consumption at receipt', 'subConsumption', 'subcontract', '543'),
        ir,
      ],
    ],
    [
      'consignment',
      'special',
      'Supplier consignment and settlement',
      'ROH',
      '',
      [
        step('Consignment purchase order', 'po', 'special'),
        step('Receive supplier-owned stock', 'consignmentGr', 'special', '101', 'Special stock K.'),
        step(
          'Transfer into own valuated stock',
          'consignmentOwn',
          'special',
          '411',
          'Special stock K. The transfer creates supplier liability.'
        ),
        step('Settle supplier withdrawals', 'settlement', 'special'),
      ],
    ],
    [
      'pipeline',
      'special',
      'Pipeline consumption and settlement',
      'ROH',
      'K',
      [
        step(
          'Withdraw from supplier pipeline',
          'pipeline',
          'special',
          '201',
          'Special stock P. Pipeline consumption does not draw from own warehouse stock.'
        ),
        step('Settle supplier withdrawals', 'settlement', 'special'),
      ],
    ],
    [
      'services',
      'special',
      'Lean service procurement',
      '',
      'K',
      leanService,
      { direct: true, service: true },
    ],
    [
      'third-party',
      'special',
      'Third-party purchasing with delivery to customer',
      'NLAG',
      'X',
      [
        pr,
        step('Third-party purchase order', 'po', 'thirdParty'),
        step('Record statistical receipt when enabled', 'statisticalGr', 'thirdParty', '101'),
        ir,
        step('Customer billing when due', 'customerBilling', 'thirdParty'),
      ],
      { direct: true, nonValuated: true },
    ],
    [
      'invoice-first',
      'invoice',
      'Stock PO invoice before goods receipt',
      'ROH',
      '',
      [po, ir, gr, payment],
      { invoicePrice: 12 },
    ],
    [
      'undo-origin-gr',
      'returns',
      'Reverse origin acceptance before warehouse release',
      'ROH',
      '',
      [
        step(
          'Reverse original origin acceptance',
          'return',
          'blocked',
          '108',
          'If the goods were already released, review and reverse the follow-on movement first.'
        ),
      ],
    ],
    [
      'free-gr',
      'purchase',
      'Receive a free-of-charge delivery',
      'ROH',
      '',
      [step('Receive free material from supplier', 'freeReceipt', 'nonPo', '511')],
    ],
    [
      'opening',
      'inventory',
      'Initial stock balance',
      'ROH',
      '',
      [
        step(
          'Post opening stock',
          'receipt',
          'nonPo',
          '561',
          'Initial stock balances use a distinct offsetting account. This is commonly used for controlled migration.'
        ),
      ],
    ],
    [
      'inventory-gain',
      'inventory',
      'Physical inventory gain',
      'ROH',
      '',
      [
        step('Create physical inventory document', 'inventoryDoc', 'inventory'),
        step('Enter warehouse count', 'inventoryCount', 'inventory'),
        step('Post positive difference', 'receipt', 'inventory', '701'),
      ],
    ],
    [
      'inventory-loss',
      'inventory',
      'Physical inventory loss',
      'ROH',
      '',
      [
        step('Create physical inventory document', 'inventoryDoc', 'inventory'),
        step('Enter warehouse count', 'inventoryCount', 'inventory'),
        step('Post negative difference', 'issue', 'inventory', '702'),
      ],
    ],
    [
      'invoice-variance',
      'invoice',
      'Invoice price variance for stock PO',
      'ROH',
      '',
      [
        po,
        gr,
        step(
          'Invoice with a price difference',
          'invoice',
          'invoice',
          '',
          'Check price control, stock coverage, and whether the variance blocks payment.'
        ),
        payment,
      ],
      { invoicePrice: 12 },
    ],
    [
      'invoice-cancel',
      'invoice',
      'Cancel a posted supplier invoice',
      '',
      '',
      [step('Cancel invoice or credit memo', 'invoiceCancel', 'invoiceCancel')],
      { service: true },
    ],
  ].map(([id, group, title, material, category, steps, options = {}]) => ({
    id,
    group,
    title,
    material,
    category,
    steps,
    ...options,
  }));

  root.WorkHubMmConfigurationData = {
    sources,
    checkpoints,
    materials,
    moves,
    plants,
    editions,
    groups,
    scenarios,
  };
})(typeof window === 'undefined' ? globalThis : window);
