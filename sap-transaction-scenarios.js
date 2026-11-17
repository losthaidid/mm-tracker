/* Business scenarios for the SAP Terms reference. Journals reuse the standard MM models. */
(function (root) {
  'use strict';

  const { entries, refs, example, line, posting, pair } = root.WorkHubSapTermsData;
  const config = root.WorkHubMmConfigurationData;
  const engine = root.WorkHubMmConfigurationEngine;
  const terms = new Map(entries.map(entry => [entry.id, entry]));
  const classic = ['ecc', 's4'];
  const all = [...classic, 'cloud'];
  const groups = {
    receipt: 'Goods receipt',
    issue: 'Goods issue',
    adjustment: 'Inventory adjustments and valuation',
    transfer: 'Transfer postings and stock transport',
    return: 'Returns and reversals',
    special: 'Special procurement and services',
    invoice: 'Invoices, clearing, and settlement',
    delivery: 'Delivery costs and freight',
    closing: 'Production settlement and period-end',
    legacy: 'Retail rebates, localization, and historical postings',
  };
  const entriesByScenario = [];
  const byId = new Map();
  const movementSource = [
    'SAP Help · Goods movement types',
    'https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/ee6ff9b281d8448f96b4fe6c89f2bdc8/8b7b5fe73ef54063a2bfcfbe83cebd38.html',
  ];
  const supportedMoves = [
    'SAP Help · Supporting movement codes and reversals',
    'https://help.sap.com/docs/IRPA_S4HANA/18862e3cddb74ce7ac751f49e568c1e0/a99a1bcb969f4939957469ea7d251e78.html',
  ];
  const assetSource = [
    'SAP Help · Consumption by asset (241)',
    'https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/1dad2180e6f34b75ac77afce5cb5eda1/24fafa70cd8311dc2b8d000f20fcb6a9.html',
  ];
  const movementPublic = [
    'SAP Help · Materials document movements in Public Edition',
    'https://help.sap.com/docs/SAP_S4HANA_CLOUD/3f57e7df4a114edabffe8b2d581a59ed/8bb0d08295044ee3af444b4f2a6e4457.html',
  ];
  const physicalSource = [
    'SAP Help · Physical inventory and stock-type movement codes',
    'https://help.sap.com/docs/SAP_ERP/486a00b003484f8e982245cb8d61a3bd/96d7c353b677b44ce10000000a174cb4.html',
  ];
  const cloudMovementCatalog = [
    'SAP KBA · Standard movement type examples for Public Edition',
    'https://userapps.support.sap.com/sap/support/knowledge/en/3697643',
  ];
  const customerReturnSource = [
    'SAP Help · Goods movement types for customer returns',
    'https://help.sap.com/docs/SAP_S4HANA_CLOUD/c0c54048d35849128be8e872df5bea6d/8b7b5fe73ef54063a2bfcfbe83cebd38.html',
  ];

  function movementResult(title, effect, document = 'Material document') {
    return { title, effect, outcome: document };
  }
  function add(group, id, label, movements, demo, options = {}) {
    const {
      editions = classic,
      sources = [movementSource],
      guides = ['automatic-postings'],
      modelId,
    } = options;
    const codes = [
      ...new Set(
        demo.postings
          .flatMap(row =>
            row.lookup
              ? [row.lookup.code]
              : [...(row.debit || []), ...(row.credit || [])].map(item => item.code)
          )
          .filter(Boolean)
      ),
    ];
    const entry = { group, id, label, movements, demo, editions, sources, guides, modelId, codes };
    entriesByScenario.push(entry);
    byId.set(id, entry);
    return entry;
  }
  function termDetails(termId) {
    const term = terms.get(termId);
    return {
      editions: term.editions,
      sources: term.sources.map(id => refs[id]),
      guides: term.guides,
    };
  }
  function fromTerm(group, id, label, movements, termId, options = {}) {
    return add(group, id, label, movements, terms.get(termId).demo, {
      ...termDetails(termId),
      ...options,
    });
  }
  function modelStep(row) {
    const title = row.movement ? row.title + ' · ' + row.movement : row.title;
    const note = row.note || row.summary;
    if (!row.lines.length)
      return movementResult(title, note, row.docs.join(' · ') || 'Business process step');
    const lines = side =>
      row.lines
        .filter(item => item.side === side)
        .map(item =>
          line(
            item.name,
            item.key && [item.key, item.modifier].filter(Boolean).join('/'),
            item.amount
          )
        );
    return posting(title, note, lines('debit'), lines('credit'));
  }
  function fromModel(group, id, label, modelId, rules, setup, guides, options = {}) {
    const result = engine.run({ workhub: {} }, modelId);
    const steps = result.steps.filter(
      row => rules.includes(row.rule) && (!row.movement || row.move)
    );
    const sources = [...new Set(steps.flatMap(row => config.checkpoints[row.check][4]))].map(
      name => config.sources[name]
    );
    const movements = [...new Set(steps.map(row => row.movement).filter(Boolean))];
    return add(group, id, label, movements, example(setup, ...steps.map(modelStep)), {
      modelId,
      sources,
      guides,
      ...options,
    });
  }

  fromTerm('receipt', 'po-stock', 'With PO — valuated inventory', ['101'], 'BSX', {
    modelId: 'stock-po',
  });
  fromTerm('receipt', 'without-po', 'Without PO — other goods receipt', ['501'], 'GBB/ZOB', {
    modelId: 'receipt-other',
  });
  fromTerm('receipt', 'po-use', 'With PO — valuated direct consumption', ['101'], 'KBS', {
    modelId: 'direct-po',
  });
  fromModel(
    'receipt',
    'po-nonstock',
    'With PO — non-stock item with valuated receipt',
    'nonstock-po',
    ['gr', 'invoice'],
    'Receive and invoice an account-assigned non-stock purchase with a valuated goods receipt.',
    ['account-assignment', 'stock-gr']
  );
  fromModel(
    'receipt',
    'po-nonvaluated',
    'With PO — non-valuated receipt',
    'nonvaluated-po',
    ['gr', 'invoice'],
    'Receive a quantity-managed item with a non-valuated goods receipt. The PO’s cost assignment is charged at invoice receipt.',
    ['non-valuated-gr', 'account-assignment']
  );
  fromModel(
    'receipt',
    'po-fixed-asset',
    'With PO — purchase directly for an asset',
    'asset-po',
    ['gr', 'invoice'],
    'The PO refers to a fixed asset and uses a valuated receipt. The acquisition account follows asset accounting.',
    ['account-assignment', 'stock-gr']
  );
  fromTerm(
    'receipt',
    'po-price-difference',
    'With PO — standard-price variance at receipt',
    ['101'],
    'PRD'
  );
  fromModel(
    'receipt',
    'po-gr-blocked',
    'PO receipt into non-valuated GR blocked stock',
    'blocked-gr',
    ['blocked', 'gr'],
    'Register a delivery pending acceptance. Compare the initial record and its release into valuated stock.',
    ['gr-blocked-stock', 'stock-gr']
  );
  fromModel(
    'receipt',
    'po-origin-acceptance',
    'PO origin acceptance and valuated release',
    'origin-gr',
    ['gr', 'reclass'],
    'Value the accepted quantity before warehouse arrival. Release it to warehouse stock after delivery.',
    ['gr-blocked-stock', 'stock-gr']
  );
  fromTerm('receipt', 'production-gr', 'From a production order', ['101'], 'GBB/AUF', {
    modelId: 'production-gr',
  });
  fromTerm(
    'receipt',
    'production-no-order',
    'Production output without an order',
    ['521'],
    'GBB/ZOF'
  );
  fromModel(
    'receipt',
    'free-gr',
    'Free-of-charge receipt',
    'free-gr',
    ['freeReceipt'],
    'Receive free units into valuated stock at standard price. The example uses a material with a nonzero standard value.',
    ['gr-without-po', 'price-control']
  );
  fromTerm('receipt', 'opening', 'Initial stock balance', ['561'], 'GBB/BSA', {
    modelId: 'opening',
  });
  fromTerm(
    'receipt',
    'purchase-reporting',
    'Purchase account reporting and freight',
    ['101'],
    'EIN'
  );

  fromModel(
    'issue',
    'cost-center',
    'To a cost center',
    'cost-issue',
    ['issue'],
    'Issue RM100 of own valuated stock with movement 201 and a valid cost center.',
    ['goods-issue', 'account-modifiers'],
    { editions: all, sources: [supportedMoves, refs.grouping, movementPublic] }
  );
  fromModel(
    'issue',
    'fixed-asset',
    'To a fixed asset',
    'asset-issue',
    ['issue'],
    'Issue RM100 of own valuated stock to an eligible fixed asset and subnumber with movement 241.',
    ['goods-issue', 'automatic-postings'],
    {
      editions: all,
      sources: [
        assetSource,
        movementPublic,
        [
          'SAP KBA · Goods issue to an asset and Material Ledger',
          'https://userapps.support.sap.com/sap/support/knowledge/en/2254029',
        ],
      ],
    }
  );
  fromModel(
    'issue',
    'production-issue',
    'To a production order',
    'production-issue',
    ['issue'],
    'Issue RM100 of components from valuated stock to a production order.',
    ['production-issue', 'goods-issue'],
    { editions: all, sources: [supportedMoves, refs.grouping, movementPublic] }
  );
  fromModel(
    'issue',
    'project-issue',
    'To a project WBS element',
    'project-issue',
    ['issue'],
    'Issue RM100 of own valuated stock to a valid project WBS element.',
    ['goods-issue', 'account-modifiers'],
    { editions: all, sources: [assetSource, supportedMoves, movementPublic] }
  );
  fromTerm('issue', 'scrap', 'Scrap or write-off of unrestricted stock', ['551'], 'GBB/VNG', {
    modelId: 'scrap',
  });
  fromTerm(
    'issue',
    'sales-issue',
    'Goods issue for an outbound sales delivery',
    ['601'],
    'GBB/VAX',
    { modelId: 'delivery-issue' }
  );
  fromTerm('issue', 'sales-with-object', 'Sales goods issue with a cost object', [], 'GBB/VAY');
  fromTerm('issue', 'sampling', 'Sample withdrawal without a cost object', ['331'], 'GBB/VQP');
  fromTerm('issue', 'sampling-assigned', 'Sample withdrawal with a cost object', [], 'GBB/VQY');
  fromTerm('issue', 'issue-price-difference', 'Goods issue with a price difference', [], 'PRD/PRA');

  fromModel(
    'adjustment',
    'adjustment-in',
    'Adjustment in — physical count surplus',
    'inventory-gain',
    ['receipt'],
    'Counted unrestricted-use stock exceeds the book quantity. Post the difference for valuated own stock.',
    ['physical-inventory', 'account-modifiers'],
    {
      editions: all,
      sources: [
        physicalSource,
        refs.grouping,
        ...config.checkpoints.inventory[4].map(id => config.sources[id]),
      ],
    }
  );
  fromTerm(
    'adjustment',
    'adjustment-out',
    'Adjustment out — physical count shortage',
    ['702'],
    'GBB/INV',
    {
      modelId: 'inventory-loss',
      sources: [physicalSource, refs.grouping],
    }
  );
  fromTerm('adjustment', 'value-adjustment', 'Stock value revaluation', [], 'UMB');
  fromTerm(
    'adjustment',
    'external-product-adjustment',
    'Valuation adjustment for external products',
    [],
    'BSK'
  );

  fromModel(
    'transfer',
    'plant-one',
    'Plant to plant — one step',
    'plant-transfer',
    ['transfer'],
    'Transfer valuated material between plants with separate valuation areas under the same company code.',
    ['transfer-postings']
  );
  fromModel(
    'transfer',
    'plant-two',
    'Plant to plant — issue and receipt',
    'plant-two',
    ['transfer', 'reclass'],
    'Send material using a two-step plant transfer. The receiving plant takes the material from stock in transfer into available stock.',
    ['transfer-postings']
  );
  fromModel(
    'transfer',
    'storage-one',
    'Storage location to storage location — one step',
    'storage-transfer',
    ['reclass'],
    'Move a material between storage locations within one plant and valuation area.',
    ['transfer-postings']
  );
  fromModel(
    'transfer',
    'storage-two',
    'Storage location transfer — issue and receipt',
    'storage-two',
    ['reclass'],
    'Move stock between storage locations in one plant. Record the removal and the placement separately.',
    ['transfer-postings']
  );
  fromModel(
    'transfer',
    'material-transfer',
    'Material to material — equal values',
    'material-transfer',
    ['materialTransfer'],
    'Transfer own valuated stock to another material with the same unit of measure and equal value.',
    ['transfer-postings', 'price-control']
  );
  fromTerm(
    'transfer',
    'material-variance',
    'Material to material — transfer variance',
    ['309'],
    'AUM'
  );
  fromTerm(
    'transfer',
    'transfer-external-value',
    'Transfer with external amount and a PRD difference',
    [],
    'PRD/PRU'
  );
  fromModel(
    'transfer',
    'quality-release',
    'Release quality inspection stock',
    'quality-release',
    ['reclass'],
    'Release inspected stock into unrestricted use within the same valuation area.',
    ['transfer-postings', 'qm-gr-inspection']
  );
  fromModel(
    'transfer',
    'blocked-release',
    'Release blocked warehouse stock',
    'blocked-release',
    ['reclass'],
    'Release blocked warehouse stock into unrestricted use within the same valuation area.',
    ['transfer-postings']
  );
  fromModel(
    'transfer',
    'sto-without-delivery',
    'STO without outbound delivery',
    'sto',
    ['transfer', 'reclass'],
    'Move valuated stock between plants in the same company code with an STO and separate issue and receipt.',
    ['stock-transport', 'transfer-postings']
  );
  fromModel(
    'transfer',
    'sto-with-delivery',
    'STO with outbound delivery',
    'sto-delivery',
    ['transfer', 'reclass'],
    'Post goods issue against an outbound delivery and receive against an STO in the same company code.',
    ['stock-transport', 'transfer-postings']
  );
  fromModel(
    'transfer',
    'sto-intercompany',
    'Cross-company STO with intercompany billing',
    'sto-cross',
    ['crossIssue', 'crossReceipt', 'billing', 'invoice'],
    'The supplying and buying plants belong to different company codes. Compare their inventory and invoice events.',
    ['stock-transport', 'invoice-verification']
  );

  fromModel(
    'return',
    'cancel-po-gr',
    'Reverse a stock PO receipt',
    'reverse-gr',
    ['return'],
    'Reverse an original valuated PO receipt using its material document and the original values.',
    ['return-reversal', 'stock-gr']
  );
  fromModel(
    'return',
    'supplier-return',
    'Return delivered material to the supplier',
    'return-gr',
    ['return', 'credit'],
    'Return stock with reference to its original valuated receipt. Record the corresponding supplier credit in this example.',
    ['return-reversal', 'invoice-verification']
  );
  fromModel(
    'return',
    'returns-po',
    'Return using a returns purchase order',
    'return-po',
    ['return', 'credit'],
    'Return valuated stock against a returns PO item. The vendor issues a matching credit memo.',
    ['return-reversal', 'invoice-verification']
  );
  fromModel(
    'return',
    'blocked-return',
    'Return from non-valuated GR blocked stock',
    'return-blocked',
    ['blockedReturn'],
    'Return goods recorded in non-valuated receipt blocked stock before accepting them into inventory.',
    ['return-reversal', 'gr-blocked-stock']
  );
  fromModel(
    'return',
    'cancel-accepted-gr',
    'Reverse a valuated origin acceptance',
    'undo-origin-gr',
    ['return'],
    'Reverse an accepted origin receipt before releasing it into warehouse stock.',
    ['return-reversal', 'gr-blocked-stock']
  );
  fromModel(
    'return',
    'reverse-cost-center',
    'Reverse an issue to a cost center',
    'reverse-issue',
    ['reverseIssue'],
    'Reverse a valuated warehouse issue to a cost center with the original material document.',
    ['return-reversal', 'goods-issue']
  );

  fromModel(
    'special',
    'provide-components',
    'Provide components to a subcontractor',
    'subcontract',
    ['provision'],
    'Transfer components to supplier special stock with company ownership retained.',
    ['subcontracting', 'transfer-postings']
  );
  fromTerm(
    'special',
    'subcontract-receipt',
    'Subcontracting receipt and component consumption',
    ['101', '543'],
    'BSV'
  );
  fromTerm(
    'special',
    'subcontract-freight',
    'Subcontracting receipt with delivery costs',
    ['101', '543'],
    'FRN'
  );
  fromModel(
    'special',
    'consignment-receipt',
    'Receive vendor consignment stock',
    'consignment',
    ['consignmentGr'],
    'Receive vendor-owned stock into consignment special stock. Valuation begins when the stock is taken into company ownership or used.',
    ['consignment']
  );
  fromTerm(
    'special',
    'consignment-own',
    'Transfer consignment into own stock',
    ['411 K'],
    'KON/blank'
  );
  fromTerm(
    'special',
    'consignment-variance',
    'Consignment takeover with price variance',
    ['411 K'],
    'AKO'
  );
  fromModel(
    'special',
    'consignment-settlement',
    'Settle vendor consignment withdrawals',
    'consignment',
    ['settlement'],
    'An eligible consignment withdrawal has already created a supplier liability. Settlement moves that value to vendor payable.',
    ['consignment', 'invoice-verification']
  );
  fromTerm(
    'special',
    'pipeline-issue',
    'Pipeline withdrawal for consumption',
    ['201 P'],
    'KON/PIP'
  );
  fromModel(
    'special',
    'pipeline-settlement',
    'Settle pipeline withdrawals',
    'pipeline',
    ['settlement'],
    'Settle existing unbilled pipeline withdrawal liabilities after consuming the material.',
    ['pipeline', 'invoice-verification']
  );
  fromModel(
    'special',
    'lean-service',
    'Lean service entry, acceptance, and invoice',
    'services',
    ['serviceEntry', 'serviceGr', 'invoice'],
    'Record and accept a lean service with an account-assigned PO, then post the matching invoice.',
    ['lean-services', 'invoice-verification'],
    { editions: ['s4', 'cloud'] }
  );
  fromModel(
    'special',
    'third-party',
    'Third-party delivery to a customer',
    'third-party',
    ['statisticalGr', 'invoice', 'customerBilling'],
    'The supplier delivers directly to the customer. Follow the statistical receipt, supplier invoice and SD billing event.',
    ['supplier-to-customer', 'account-assignment']
  );
  fromTerm(
    'special',
    'sales-account-default',
    'Default a PO G/L from a sales order assignment',
    ['101'],
    'GBB/VKA'
  );
  fromTerm(
    'special',
    'project-account-default',
    'Default a PO G/L from a project assignment',
    ['101'],
    'GBB/VKP'
  );

  fromTerm('invoice', 'matched-invoice', 'Match a stock PO invoice to a receipt', [], 'WRX');
  fromModel(
    'invoice',
    'invoice-only',
    'Invoice an account-assigned PO without goods receipt',
    'invoice-only',
    ['invoice'],
    'Post the invoice against a PO item configured for invoice receipt without a goods receipt.',
    ['account-assignment', 'invoice-verification']
  );
  fromModel(
    'invoice',
    'invoice-first',
    'Invoice a stock PO before goods receipt',
    'invoice-first',
    ['invoice', 'gr'],
    'Post an eligible invoice before receipt on a PO item where GR-based invoice verification is inactive.',
    ['invoice-verification', 'gr-ir-clearing']
  );
  fromModel(
    'invoice',
    'invoice-variance',
    'Post a supplier invoice price variance',
    'invoice-variance',
    ['gr', 'invoice'],
    'A stock PO’s valuated receipt is followed by a higher-priced supplier invoice for a standard-price material.',
    ['invoice-variances', 'price-control']
  );
  fromTerm(
    'invoice',
    'small-difference',
    'Post an invoice within small-difference tolerance',
    [],
    'DIF'
  );
  fromTerm('invoice', 'exchange-difference', 'Post an invoice exchange-rate difference', [], 'KDM');
  fromTerm(
    'invoice',
    'exchange-rounding',
    'Post an invoice exchange-rounding difference',
    [],
    'KDR'
  );
  fromTerm('invoice', 'invoice-reduction', 'Reduce an invoice and post a credit memo', [], 'RKA');
  fromTerm(
    'invoice',
    'invoice-retroactive',
    'Revalue goods or services after invoicing',
    [],
    'RAP'
  );
  const matchedInvoice = terms.get('WRX').demo.postings[1];
  add(
    'invoice',
    'cancel-invoice',
    'Cancel a posted supplier invoice',
    [],
    example(
      'A matched stock PO invoice of RM100 is cancelled with reference to the original invoice.',
      posting(
        'Cancel the matching invoice',
        'The reversal reduces the vendor payable and restores the original GR/IR balance.',
        matchedInvoice.credit,
        matchedInvoice.debit
      )
    ),
    {
      modelId: 'invoice-cancel',
      editions: all,
      sources: [refs.wrx, refs.matching],
      guides: ['invoice-cancellation', 'invoice-verification'],
    }
  );
  add(
    'invoice',
    'grir-maintenance',
    'Clear a residual GR/IR balance',
    [],
    example(
      'A PO item still has a GR/IR balance after its final receipt and invoice. Review the PO history and clear the eligible difference in MR11.',
      {
        title: 'Review the balance in MR11',
        effect:
          'Check the open quantity or delivery-cost difference for the PO item before posting account maintenance.',
        lookup: { account: 'GR/IR clearing', code: 'WRX' },
      },
      movementResult(
        'Post the cleared difference',
        'The process posts the eligible correction with the offset determined by the item and its valuation.',
        'GR/IR account maintenance document'
      )
    ),
    {
      editions: all,
      sources: [
        refs.matching,
        [
          'SAP Help · Clear GR/IR Clearing Account',
          'https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/af9ef57f504840d2b81be8667206d485/72256b54f94c8f4ce10000000a4450e5.html',
        ],
      ],
      guides: ['gr-ir-clearing', 'invoice-verification'],
    }
  );
  fromModel(
    'invoice',
    'supplier-payment',
    'Pay a supplier open item',
    'stock-po',
    ['payment'],
    'Clear an existing eligible supplier payable through a payment posting in Financial Accounting.',
    ['gr-ir-clearing', 'invoice-verification']
  );

  fromTerm('delivery', 'freight-clearing', 'Planned freight receipt and billing', ['101'], 'FR1');
  fromTerm('delivery', 'freight-accrual', 'Accrue freight and clear the provision', ['101'], 'FR2');
  fromTerm(
    'delivery',
    'customs-billing',
    'Planned customs duty receipt and billing',
    ['101'],
    'FR3'
  );
  fromTerm('delivery', 'customs-accrual', 'Accrue customs duty', ['101'], 'FR4');
  fromTerm('delivery', 'delivery-accrual', 'Accrue other delivery costs', ['101'], 'RUE');
  fromTerm('delivery', 'unplanned-delivery-costs', 'Invoice unplanned delivery costs', [], 'UPF');
  fromTerm('delivery', 'allocated-freight', 'Allocate and clear freight costs', ['101'], 'RUA');
  fromTerm('delivery', 'tm-freight', 'Transportation Management freight clearing', [], 'TM1');

  fromTerm('closing', 'production-settlement', 'Settle production order variances', [], 'GBB/AUA');
  fromTerm('closing', 'actual-activity', 'Allocate actual activity price differences', [], 'PRL');
  fromTerm('closing', 'closing-stock', 'Close actual costing differences for inventory', [], 'LKW');
  fromTerm('closing', 'revalue-consumption', 'Revalue consumption at actual cost', [], 'COC');
  fromTerm('closing', 'material-wip', 'Revalue and release material work in process', [], 'WPM');
  fromTerm('closing', 'activity-wip', 'Revalue and release activity work in process', [], 'WPA');
  fromTerm(
    'closing',
    'alternative-valuation',
    'Allocate differences in alternative valuation',
    [],
    'PRC'
  );
  fromTerm(
    'closing',
    'alternative-consumption',
    'Revalue consumption price differences in alternative valuation',
    [],
    'PRG'
  );
  fromTerm(
    'closing',
    'alternative-exchange',
    'Revalue consumption exchange differences in alternative valuation',
    [],
    'KDG'
  );
  fromTerm('closing', 'hierarchy-settle', 'Settle cost object hierarchy differences', [], 'PRK');
  fromTerm('closing', 'balance-sheet-stock', 'Post supplementary stock valuation', [], 'BSD');

  fromTerm('legacy', 'agency-income', 'Settle agency commission income', [], 'AG1');
  fromTerm('legacy', 'agency-turnover', 'Post turnover in agency business', [], 'AG2');
  fromTerm('legacy', 'agency-expense', 'Settle agency commission expense', [], 'AG3');
  fromTerm('legacy', 'agency-guarantee', 'Post del credere commission', [], 'DEL');
  fromTerm('legacy', 'rebate-accrual', 'Accrue a rebate in subsequent settlement', ['101'], 'BO1');
  fromTerm('legacy', 'rebate-settlement', 'Settle a purchase rebate', [], 'BO2');
  fromTerm('legacy', 'late-rebate', 'Handle a receipt after rebate settlement', ['101'], 'BO3');
  fromTerm('legacy', 'settlement-tax', 'Post input tax on purchasing settlement', [], 'VST');
  fromTerm('legacy', 'brazil-transfer-tax', 'Determine Brazilian stock transfer tax', [], 'TXO');
  fromTerm('legacy', 'inflation-close', 'Post a period-end inflation adjustment', [], 'WGB');
  fromTerm('legacy', 'inflation-issue', 'Revalue a goods issue for inflation', [], 'WGI');
  fromTerm('legacy', 'inflation-receipt', 'Revalue a transfer receipt for inflation', [], 'WGR');
  fromTerm('legacy', 'collected-cost', 'Historical product cost collector settlement', [], 'PRP', {
    editions: ['historical'],
  });
  fromTerm('legacy', 'legacy-lower-price', 'Historical lower-level price difference', [], 'PRV', {
    editions: ['historical'],
  });
  fromTerm(
    'legacy',
    'legacy-lower-exchange',
    'Historical lower-level exchange difference',
    [],
    'KDV',
    { editions: ['historical'] }
  );
  fromTerm('legacy', 'legacy-gr-ir', 'Historical Material Ledger GR/IR', [], 'WRY', {
    editions: ['historical'],
  });

  const stock = ['Inventory', 'BSX'];
  const journal = (group, id, label, movement, setup, effect, debit, credit, options = {}) =>
    add(
      group,
      id,
      label,
      [movement],
      example(setup, pair('Post movement ' + movement, effect, debit, credit)),
      options
    );
  const stockChange = (group, id, label, movement, setup, effect, guides = ['transfer-postings']) =>
    add(
      group,
      id,
      label,
      [movement],
      example(setup, movementResult('Post movement ' + movement, effect)),
      { guides, sources: [movementSource, physicalSource] }
    );

  for (const [name, id, otherReceipt, openingStock, scrapCode, inventoryIn, inventoryOut] of [
    ['quality inspection stock', 'qi', '503', '563', '553', '703', '704'],
    ['blocked stock', 'blocked', '505', '565', '555', '707', '708'],
  ]) {
    const position = [name.charAt(0).toUpperCase() + name.slice(1), 'BSX'];
    journal(
      'receipt',
      'without-po-' + id,
      'Without PO — ' + name,
      otherReceipt,
      'Receive RM100 of valuated material into ' + name + ' without a PO.',
      'The stock increases, with the offset determined by the receipt-without-PO grouping.',
      position,
      ['Receipt offset', 'GBB/ZOB'],
      {
        editions: all,
        sources: [movementSource, cloudMovementCatalog, refs.gbb],
        guides: ['gr-without-po', 'account-modifiers'],
      }
    );
    journal(
      'receipt',
      'opening-' + id,
      'Initial balance in ' + name,
      openingStock,
      'Load a RM100 opening balance of ' + name + ' when the material is valuated.',
      'Value enters inventory and the opening stock offset is credited.',
      position,
      ['Opening balance offset', 'GBB/BSA'],
      { sources: [physicalSource, refs.gbb], guides: ['physical-inventory', 'account-modifiers'] }
    );
    journal(
      'issue',
      'scrap-' + id,
      'Scrap ' + name,
      scrapCode,
      'Scrap RM100 of own valuated ' + name + ' under the standard scrap grouping.',
      'The scrap expense account takes the loss and the original stock value decreases.',
      ['Scrap expense', 'GBB/VNG'],
      position,
      { sources: [physicalSource, refs.gbb], guides: ['goods-issue', 'account-modifiers'] }
    );
    const adjustment = {
      guides: ['physical-inventory', 'account-modifiers'],
      sources: [physicalSource, refs.grouping],
    };
    journal(
      'adjustment',
      'adjustment-in-' + id,
      'Adjustment in — ' + name,
      inventoryIn,
      'A physical count finds RM100 more ' +
        name +
        ' than the recorded balance, for own valuated stock.',
      'The increase is posted to stock and the count difference account.',
      position,
      ['Stock count gain', 'GBB/INV'],
      adjustment
    );
    journal(
      'adjustment',
      'adjustment-out-' + id,
      'Adjustment out — ' + name,
      inventoryOut,
      'A physical count finds RM100 less ' +
        name +
        ' than the recorded balance, for own valuated stock.',
      'The stock count difference absorbs the loss in value.',
      ['Stock count loss', 'GBB/INV'],
      position,
      adjustment
    );
  }
  journal(
    'receipt',
    'by-product',
    'Production by-product receipt',
    '531',
    'Receive RM100 of a valuated by-product during a production process.',
    'The by-product’s stock value increases and the inventory offset follows the configured production reference.',
    ['By-product inventory', 'BSX'],
    ['Production or order stock offset', 'GBB'],
    { sources: [supportedMoves, refs.gbb], guides: ['production-issue', 'account-modifiers'] }
  );
  journal(
    'issue',
    'sales-order-consumption',
    'To a sales order without delivery',
    '231',
    'Issue RM100 of own valuated stock against a sales order account assignment directly in Inventory Management.',
    'The configured sales order cost account receives the issue value.',
    ['Sales order cost', 'GBB'],
    stock,
    { sources: [assetSource, refs.gbb], guides: ['goods-issue', 'account-modifiers'] }
  );
  journal(
    'issue',
    'network',
    'To a network',
    '281',
    'Issue RM100 of own valuated components to a valid network activity.',
    'The network receives the consumption cost. Inventory is credited.',
    ['Network consumption', 'GBB'],
    stock,
    { sources: [movementSource, refs.gbb], guides: ['goods-issue', 'account-modifiers'] }
  );
  stockChange(
    'transfer',
    'move-quality',
    'Move inspection stock between storage locations',
    '323',
    'Transfer quality inspection stock within the same valuation area.',
    'The quantity moves between storage locations while its inspection status is retained.'
  );
  stockChange(
    'transfer',
    'move-blocked',
    'Move blocked stock between storage locations',
    '325',
    'Transfer blocked stock within the same valuation area.',
    'The quantity moves to the other location and stays in blocked stock.'
  );
  stockChange(
    'transfer',
    'blocked-to-quality',
    'Move blocked stock into quality inspection',
    '349',
    'Reclassify blocked stock to quality inspection in the same valuation area.',
    'The stock category changes and the material document records the quantity.'
  );
  add(
    'special',
    'subcontract-adjustment',
    'Subcontracting subsequent component adjustment',
    ['121', '543', '544'],
    example(
      'After the subcontracted material was received, the supplier reports additional consumption of components. The valuated component cost is RM100.',
      pair(
        'Post an additional consumption adjustment',
        'SAP posts the additional component consumption against the company-owned component stock at the subcontractor.',
        ['Component consumption', 'GBB/VBO'],
        ['Component inventory', 'BSX']
      )
    ),
    { sources: [movementSource, refs.subcontract], guides: ['subcontracting', 'account-modifiers'] }
  );

  add(
    'return',
    'customer-return-pending',
    'Receive a customer return pending acceptance',
    ['651'],
    example(
      'A sales returns delivery is received for inspection into non-valuated returns stock.',
      movementResult(
        'Receive the returned goods · 651',
        'SAP records the returned quantity as returns stock pending the follow-on disposition.'
      )
    ),
    { editions: all, sources: [customerReturnSource], guides: ['return-reversal', 'stock-gr'] }
  );
  for (const [movement, name, stockName] of [
    ['653', 'unrestricted-use stock', 'Inventory'],
    ['655', 'quality inspection stock', 'Inspection stock'],
    ['657', 'blocked stock', 'Blocked stock'],
  ]) {
    journal(
      'return',
      'customer-return-' + movement,
      'Receive a customer return into ' + name,
      movement,
      'Receive RM100 of a valuated customer return against a referenced sales returns delivery into ' +
        name +
        '.',
      'Inventory takes the returned value and the configured cost-of-sales offset is credited in this example.',
      [stockName, 'BSX'],
      ['Returns inventory offset', 'GBB'],
      {
        sources: [movementSource, customerReturnSource, refs.gbb],
        guides: ['return-reversal', 'account-modifiers'],
      }
    );
  }

  const reversals = [
    ['po-gr-blocked', 0, '104', 'Reverse a non-valuated blocked receipt'],
    ['po-gr-blocked', 1, '106', 'Reverse the release of a blocked receipt'],
    ['po-origin-acceptance', 1, '110', 'Reverse release from valuated GR blocked stock'],
    ['supplier-return', 0, '123', 'Reverse a return delivery to a supplier'],
    ['blocked-return', 0, '125', 'Reverse a blocked-stock return'],
    ['returns-po', 0, '162', 'Reverse a returns PO goods movement'],
    ['project-issue', 0, '222', 'Reverse an issue to a project'],
    ['sales-order-consumption', 0, '232', 'Reverse an issue to a sales order'],
    ['fixed-asset', 0, '242', 'Reverse an issue to a fixed asset'],
    ['production-issue', 0, '262', 'Reverse an issue to a production order'],
    ['network', 0, '282', 'Reverse an issue to a network'],
    ['plant-one', 0, '302', 'Reverse a one-step plant transfer'],
    ['plant-two', 0, '304', 'Reverse removal for a two-step plant transfer'],
    ['plant-two', 1, '306', 'Reverse receipt for a two-step plant transfer'],
    ['material-transfer', 0, '310', 'Reverse a material-to-material transfer'],
    ['storage-one', 0, '312', 'Reverse a one-step storage-location transfer'],
    ['storage-two', 0, '314', 'Reverse a storage-location removal'],
    ['storage-two', 1, '316', 'Reverse a storage-location placement'],
    ['quality-release', 0, '322', 'Reverse a quality inspection release'],
    ['move-quality', 0, '324', 'Reverse an inspection stock location transfer'],
    ['move-blocked', 0, '326', 'Reverse a blocked stock location transfer'],
    ['blocked-release', 0, '344', 'Reverse release of blocked stock'],
    ['blocked-to-quality', 0, '350', 'Reverse blocked-to-quality reclassification'],
    ['sto-without-delivery', 0, '352', 'Reverse STO issue without outbound delivery'],
    ['consignment-own', 0, '412 K', 'Reverse the consignment takeover'],
    ['without-po', 0, '502', 'Reverse a receipt without a PO'],
    ['without-po-qi', 0, '504', 'Reverse a non-PO receipt into inspection stock'],
    ['without-po-blocked', 0, '506', 'Reverse a non-PO receipt into blocked stock'],
    ['free-gr', 0, '512', 'Reverse a free-of-charge receipt'],
    ['production-no-order', 0, '522', 'Reverse a receipt without a production order'],
    ['by-product', 0, '532', 'Reverse a production by-product receipt'],
    ['provide-components', 0, '542', 'Reverse the provision of subcontracting components'],
    ['subcontract-adjustment', 0, '544', 'Reverse subcontracting component consumption'],
    ['scrap', 0, '552', 'Reverse scrapping of unrestricted stock'],
    ['scrap-qi', 0, '554', 'Reverse scrapping of inspection stock'],
    ['scrap-blocked', 0, '556', 'Reverse scrapping of blocked stock'],
    ['opening', 0, '562', 'Reverse the initial stock balance'],
    ['opening-qi', 0, '564', 'Reverse the initial inspection stock balance'],
    ['opening-blocked', 0, '566', 'Reverse the initial blocked stock balance'],
    ['sales-issue', 0, '602', 'Reverse a sales delivery goods issue'],
    ['sto-with-delivery', 0, '642', 'Reverse a same-company STO delivery issue'],
    ['sto-intercompany', 0, '644', 'Reverse an intercompany STO delivery issue'],
  ];
  for (const [sourceId, index, movement, label] of reversals) {
    const base = byId.get(sourceId);
    const original = base.demo.postings[index];
    const title = 'Post the reversal · ' + movement;
    const undo = original.outcome
      ? movementResult(
          title,
          'SAP reverses the selected quantity or stock category update.',
          original.outcome
        )
      : posting(
          title,
          'SAP swaps the debit and credit sides of the original movement in this example.',
          original.credit,
          original.debit
        );
    add(
      'return',
      'reverse-' + movement.toLowerCase().replace(' ', '-'),
      label,
      [movement],
      example(
        'Use the original material document to reverse this movement. The example assumes the original quantities and values are still eligible for reversal.',
        undo
      ),
      {
        editions: base.editions,
        sources: [...base.sources, supportedMoves],
        guides: [...new Set(['return-reversal', ...base.guides])],
      }
    );
  }

  root.WorkHubSapTransactionScenarios = Object.freeze({
    groups,
    scenarios: entriesByScenario,
    byId,
  });
})(typeof window === 'undefined' ? globalThis : window);
