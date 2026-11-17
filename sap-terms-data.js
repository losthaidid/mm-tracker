/* SAP MM account determination examples. Example account names and amounts are illustrative. */
(function (root) {
  'use strict';

  const classic = ['ecc', 's4'];
  const all = [...classic, 'cloud'];
  const refs = {
    img: [
      'Configure Automatic Postings · IMG help reproduced in SAP Community',
      'https://community.sap.com/t5/enterprise-resource-planning-q-a/account-modifier/qaq-p/3218102',
    ],
    catalog: [
      'Configure Automatic Postings · transaction key documentation excerpt',
      'https://ganeshsapscm.com/2026/08/20/details-about-transaction-keys-in-obyc/',
    ],
    gbb: [
      'SAP Help · GBB and standard account groupings',
      'https://help.sap.com/docs/s4hana-best-practices/ycoa/gbb-offsetting-entry-for-inventory-posting',
    ],
    grouping: [
      'SAP Learning · Account grouping examples',
      'https://learning.sap.com/courses/exploring-cross-functional-customizing-in-sap-s-4hana-cloud-private-edition/subdividing-a-transaction-with-the-account-grouping-code_b471cc3a-c757-43dd-b0f0-18294f8d7d37',
    ],
    assignment: [
      'SAP Learning · Default account on account-assigned purchasing documents',
      'https://learning.sap.com/courses/cross-functional-customizing-in-sap-s-4hana-materials-management/adjusting-account-determination-for-special-cases',
    ],
    wrx: [
      'SAP Help · WRX posting example',
      'https://help.sap.com/docs/s4hana-best-practices/ycoa-1f2ae10b96f740759d66e695f953aa8f/wrx-gr-ir-clearing-account',
    ],
    public: [
      'SAP Help · Automatic Account Determination in Public Edition',
      'https://help.sap.com/docs/s4hana-best-practices/s4cld-usl/account-determination',
    ],
    publicGbb: [
      'SAP Help · GBB in a Public Edition reference chart',
      'https://help.sap.com/docs/s4hana-best-practices/s4cld-usl/gbb-offsetting-entry-for-inventory-posting',
    ],
    price: [
      'SAP Help · Posting price variances',
      'https://help.sap.com/docs/SAP_S4HANA_CLOUD_PE/af9ef57f504840d2b81be8667206d485/5a70b6531de6b64ce10000000a174cb4.html',
    ],
    priceExample: [
      'SAP Help · Material Ledger price determination postings',
      'https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/5e23dc8fe9be4fd496f8ab556667ea05/59a677829c5d4d31bdfd3b075cc2b6f0.html',
    ],
    accounts: [
      'SAP Help · Example G/L accounts and transaction keys',
      'https://help.sap.com/docs/s4hana-best-practices/ycoa-1f2ae10b96f740759d66e695f953aa8f/list-of-accounts',
    ],
    prdGroups: [
      'SAP PRESS · Price difference account groupings',
      'https://s3-eu-west-1.amazonaws.com/gxmedia.galileo-press.de/leseproben/2137/sappress_optimizing_value_flows.pdf',
    ],
    subcontract: [
      'SAP Help · Subcontracting receipt and invoice postings',
      'https://help.sap.com/docs/SAP_ERP/98eed63ea3a544af84eb972dc68b0e84/eba8b9537cceb44ce10000000a174cb4.html',
    ],
    delivery: [
      'SAP Learning · Entering delivery costs',
      'https://learning.sap.com/courses/invoice-verification-in-sap-s-4hana/entering-delivery-costs-1',
    ],
    matching: [
      'SAP Learning · Clearing the GR/IR account',
      'https://learning.sap.com/courses/invoice-verification-in-sap-s-4hana/performing-gr-ir-account-maintenance',
    ],
    tolerance: [
      'SAP Learning · Invoice differences and tolerances',
      'https://learning.sap.com/courses/invoice-verification-in-sap-s-4hana/handling-of-variances-without-reference-to-an-item',
    ],
    production: [
      'SAP Help · Production order and settlement postings',
      'https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/5e23dc8fe9be4fd496f8ab556667ea05/fcc7d8530439414de10000000a174cb4.html',
    ],
    wip: [
      'SAP Help · Work-in-process revaluation',
      'https://help.sap.com/docs/SAP_S4HANA_ON-PREMI-SE/af9ef57f504840d2b81be8667206d485/9587d353c6244308e10000000a174cb4.html',
    ],
    rebate: [
      'SAP Help · Subsequent settlement in SAP ERP',
      'https://help.sap.com/docs/SAP_ERP_SPV/65b1545de4cf409db91e81c6da53db5a/4d703ae3a9e24cb2e10000000a42189c.html',
    ],
    purchaseAccounting: [
      'SAP Help · Purchase Account Management and freight',
      'https://help.sap.com/docs/s4hana-best-practices/s4cld-usl/fre-purchasing-freight-account',
    ],
    consignment: [
      'SAP Learning · Vendor consignment and settlement',
      'https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/performing-the-process-of-vendor-consignment',
    ],
    pipeline: [
      'SAP Learning · Pipeline consumption',
      'https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/operating-pipeline-processes',
    ],
    tmAccounts: [
      'SAP Help · MM freight clearing accounts in the Public Edition reference chart',
      'https://help.sap.com/docs/s4hana-best-practices/s4cld-usl/list-of-accounts-2892f87ccb874e69a2c1fa2d5f0d1c4f?locale=en-US&version=LATEST',
    ],
    ein: [
      'SAP Help · Purchase Account Management goods receipt example',
      'https://help.sap.com/docs/s4hana-best-practices/ycoa-1f2ae10b96f740759d66e695f953aa8f/ein-purchase-account?locale=en-US&version=2025-FPS1',
    ],
    bsk: [
      'SAP Help · Inventory value adjustment for external products',
      'https://help.sap.com/docs/s4hana-best-practices/ycoa-1f2ae10b96f740759d66e695f953aa8f/52541500-gain-inventory-value-adjustment-ext-prod-bsk',
    ],
  };
  const line = (account, code, amount) => ({ account, code, amount });
  const posting = (title, effect, debit, credit) => ({ title, effect, debit, credit });
  const pair = (title, effect, debit, credit, amount = 100) =>
    posting(title, effect, [line(...debit, amount)], [line(...credit, amount)]);
  const example = (setup, ...postings) => ({ setup, postings });
  const entries = [];
  function add(key, modifier, title, explanation, demo, options) {
    const {
      editions = classic,
      keywords = [],
      check,
      sources = ['catalog'],
      guides = ['automatic-postings'],
      historical = false,
      lookup = 'automatic',
    } = options;
    const kind = modifier === null ? 'key' : 'modifier';
    const id = kind === 'key' ? key : key + '/' + (modifier || 'blank');
    entries.push({
      id,
      kind,
      key,
      modifier,
      title,
      explanation,
      demo,
      editions,
      keywords,
      check,
      sources,
      guides,
      historical,
      lookup,
    });
  }
  const key = (code, ...entry) => add(code, null, ...entry);
  const modifier = (parent, code, ...entry) => add(parent, code, ...entry);

  const inventory = ['Inventory', 'BSX'];
  const grir = ['GR/IR clearing', 'WRX'];
  const vendor = ['Vendor payable', ''];
  const receipt = pair(
    'Receive the purchase order',
    'Stock value increases. The receipt creates the credit that the matching invoice will clear.',
    inventory,
    grir
  );
  const invoice = pair(
    'Post the matching invoice',
    'The invoice reverses the GR/IR balance for this quantity and creates the amount owed to the vendor.',
    grir,
    vendor
  );
  const standardPO = example(
    'Receive 10 valuated units at RM10 each against a stock purchase order. The invoice matches and taxes are omitted.',
    receipt,
    invoice
  );
  const productionIssue = example(
    'Withdraw RM100 of components from your own valuated stock for a production order.',
    pair(
      'Post movement 261',
      'The production order receives the consumption cost. Inventory value falls.',
      ['Material consumption', 'GBB/VBR'],
      inventory
    )
  );
  const scrap = example(
    'A warehouse scraps RM100 of damaged goods in its own unrestricted-use stock.',
    pair(
      'Post movement 551',
      'The configured scrap account receives the loss. Inventory value falls.',
      ['Scrap expense', 'GBB/VNG'],
      inventory
    )
  );
  const stocktake = example(
    'A count finds RM20 less stock than the system shows for unrestricted-use stock.',
    pair(
      'Post movement 702',
      'The inventory difference account receives the shortage cost and SAP reduces stock value.',
      ['Inventory count difference', 'GBB/INV'],
      inventory,
      20
    )
  );
  const productionReceipt = example(
    'A production order delivers RM100 of finished product at standard price.',
    pair(
      'Post production receipt 101',
      'Finished stock increases and the order is credited through the change-in-stock account.',
      ['Finished inventory', 'BSX'],
      ['Production stock change', 'GBB/AUF']
    )
  );
  const settlement = example(
    'A finished order has a RM10 unfavorable variance after its standard-price receipt. The settlement uses the order-settlement grouping.',
    pair(
      'Settle the production order',
      'The variance posts to the price difference account and the settlement offset credits the order.',
      ['Production price difference', 'PRD/PRF'],
      ['Order settlement offset', 'GBB/AUA'],
      10
    )
  );
  const activity = example(
    'Actual costing allocates RM10 of additional activity price difference from a cost center to material.',
    pair(
      'Settle actual activity differences',
      'Material Ledger receives the activity difference while the cost center receives the offset.',
      ['Activity price difference', 'PRL'],
      ['Cost center activity adjustment', 'GBB/AUI'],
      10
    )
  );
  const consignment = example(
    'Take RM100 of vendor-owned consignment stock into own valuated stock. Consignment price equals stock value.',
    pair(
      'Post movement 411 K',
      'The stock becomes company-owned and a consignment liability is created for settlement.',
      inventory,
      ['Consignment liability', 'KON']
    )
  );
  const pipeline = example(
    'Withdraw RM100 of material from a vendor pipeline into a cost-center consumption posting.',
    pair(
      'Post pipeline consumption',
      'SAP records the expense and a pipeline liability. The PIP grouping can give pipeline liabilities their own account.',
      ['Pipeline consumption', 'GBB/VBR'],
      ['Pipeline liability', 'KON/PIP']
    )
  );
  const poExpense = (assignment, account, mod) =>
    example(
      'A valuated, direct-consumption purchase order assigns RM100 to ' +
        assignment +
        '. Account determination defaults its expense account.',
      {
        title: 'Default the PO account',
        effect:
          'The account assignment category and the applicable valuation class supply the GBB lookup. The result is copied into the PO item.',
        lookup: { account, code: mod },
      },
      pair(
        'Post the valuated receipt',
        'The receipt uses the account from the PO. The other line is the GR/IR credit.',
        [account, 'KBS'],
        grir
      )
    );
  const poVariance = example(
    'A stock PO costs RM110. At receipt the material is held at its RM100 standard price.',
    posting(
      'Receive the purchase order',
      'Stock is posted at standard price and the RM10 difference goes to PRD.',
      [line('Inventory', 'BSX', 100), line('Purchase price difference', 'PRD', 10)],
      [line('GR/IR clearing', 'WRX', 110)]
    )
  );
  const subcontract = (withFreight = false) => {
    const finished = withFreight ? 210 : 200;
    const costs = withFreight ? [line('Subcontract freight expense', 'FRN', 10)] : [];
    const clearing = withFreight ? [line('Freight clearing', 'FR1', 10)] : [];
    return example(
      'An outside supplier processes RM120 of your components for an RM80 fee' +
        (withFreight ? ', plus RM10 of planned freight.' : '.'),
      posting(
        'Receive the subcontracted material',
        'The finished item is received and provided components are consumed. The subcontracting and delivery charges have separate posting lines.',
        [
          line('Finished inventory', 'BSX', finished),
          line('Component consumption', 'GBB/VBO', 120),
          line('Subcontract service expense', 'FRL', 80),
          ...costs,
        ],
        [
          line('Stock change', 'BSV', finished),
          line('Component inventory', 'BSX', 120),
          line('GR/IR clearing', 'WRX', 80),
          ...clearing,
        ]
      )
    );
  };
  const deliveryCost = (label, code, provision = false) =>
    example(
      'A valuated stock PO includes an RM10 ' +
        label.toLowerCase() +
        ' condition assigned to ' +
        code +
        '.',
      pair(
        'Receive the purchase order',
        'The planned charge adds to inventory value in this example. The condition supplies its offset account.',
        inventory,
        [label, code],
        10
      ),
      provision
        ? pair(
            'Clear the provision',
            'In this illustration the accrued amount is reversed against settlement clearing after the charge is accounted for.',
            [label, code],
            ['Delivery cost settlement clearing', ''],
            10
          )
        : pair(
            'Post the delivery cost invoice',
            'The separate supplier invoice clears the planned charge.',
            [label, code],
            vendor,
            10
          )
    );

  key(
    'BSX',
    'Inventory posting',
    'SAP uses BSX for the stock value that goes into or comes out of inventory.',
    standardPO,
    {
      editions: all,
      keywords: [
        'stock value',
        'inventory account',
        'goods issue',
        '101',
        'goods receipt',
        'valuation class',
      ],
      check:
        'In account determination, check BSX for the material valuation class and valuation grouping used by the posting.',
      sources: ['wrx', 'gbb', 'publicGbb'],
      guides: ['automatic-postings', 'valuation-classes', 'stock-gr'],
    }
  );
  key(
    'WRX',
    'GR/IR clearing',
    'This is the bridge between a valuated goods receipt and its supplier invoice.',
    standardPO,
    {
      editions: all,
      keywords: [
        'GRIR',
        'goods receipt invoice receipt',
        'MIGO',
        'MIRO',
        'clearing',
        'pay vendor',
        '101',
      ],
      check:
        'Compare the PO item’s receipt and invoice history. The vendor balance is created by the invoice, and GR/IR is cleared by matching the receipt and invoice.',
      sources: ['wrx', 'matching', 'public'],
      guides: ['gr-ir-clearing', 'stock-gr', 'invoice-verification'],
    }
  );
  key(
    'GBB',
    'Offset to inventory postings',
    'GBB picks the account on the other side of many stock postings, including consumption, scrapping and inventory adjustments.',
    productionIssue,
    {
      editions: all,
      keywords: ['offsetting entry', 'stock offset', 'scrap', 'account modifier'],
      check:
        'Open the movement type’s account grouping for the exact posting combination, then look up GBB and that modifier in account determination.',
      sources: ['gbb', 'grouping', 'publicGbb'],
      guides: ['account-modifiers', 'goods-issue', 'physical-inventory'],
    }
  );
  key(
    'PRD',
    'Price differences',
    'PRD captures the part of a price difference that SAP posts separately from inventory value.',
    poVariance,
    {
      editions: all,
      keywords: [
        'price variance',
        'standard price',
        'MAP',
        'purchase price difference',
        'insufficient stock coverage',
      ],
      check:
        'Review price control, stock coverage, and whether the transaction key’s rules use general modification for this posting.',
      sources: ['price', 'wrx', 'prdGroups'],
      guides: ['automatic-postings', 'invoice-variances'],
    }
  );
  key(
    'KBS',
    'Account-assigned purchase order',
    'KBS identifies a goods receipt line whose G/L account comes from the PO item.',
    poExpense('a cost center', 'Maintenance supplies expense', 'GBB/VBR'),
    {
      keywords: [
        'direct consumption',
        'cost center',
        'purchase order account assignment',
        'valuated goods receipt',
      ],
      lookup: 'po',
      check:
        'Inspect the G/L account and account assignment on the purchase order. Check OME9 and GBB if the original account default is the issue.',
      sources: ['img', 'assignment'],
      guides: ['account-assignment', 'account-modifiers', 'non-valuated-gr'],
    }
  );
  key(
    'KON',
    'Consignment and pipeline liabilities',
    'KON holds the amount owed when you use or take ownership of supplier-owned material.',
    consignment,
    {
      keywords: ['consignment stock', '411 K', 'pipeline', 'vendor stock', 'MRKO'],
      check:
        'Check ownership, the consignment or pipeline price and the KON rules. Use the empty general modification for consignment where the grouping rule is active.',
      sources: ['catalog', 'prdGroups'],
      guides: ['consignment', 'pipeline', 'automatic-postings'],
    }
  );
  key(
    'AKO',
    'Consignment price variance',
    'AKO takes the difference when consignment cost and your material’s standard price differ.',
    example(
      'You take ownership of standard-price consignment stock valued at RM100. The vendor price is RM110.',
      posting(
        'Post movement 411 K',
        'The RM10 difference is an expense in this case.',
        [line('Inventory', 'BSX', 100), line('Consignment price difference', 'AKO', 10)],
        [line('Consignment liability', 'KON', 110)]
      )
    ),
    {
      keywords: ['consignment', '411 K', 'consignment difference'],
      check:
        'Compare the vendor consignment price with the standard price and verify the AKO account for the posting.',
      guides: ['consignment', 'automatic-postings'],
    }
  );
  key(
    'AUM',
    'Transfer posting difference',
    'AUM takes the portion of the issuing value that the receiving material cannot absorb in a transfer.',
    example(
      'Transfer stock from one material to another. The issuing value is RM110 and the receiving material takes RM100 at standard price.',
      posting(
        'Post the material transfer',
        'The difference is booked to the transfer variance account for the receiving material.',
        [line('Receiving stock', 'BSX', 100), line('Transfer posting expense', 'AUM', 10)],
        [line('Issuing stock', 'BSX', 110)]
      )
    ),
    {
      keywords: ['transfer posting', 'material to material', '309', 'transfer valuation'],
      check:
        'Compare both materials’ prices and valuation data, then inspect AUM for the receiving material’s posting context.',
      guides: ['transfer-postings', 'automatic-postings'],
    }
  );
  key(
    'BSV',
    'Change in stock for subcontracting',
    'BSV is the stock-change offset on the receipt of a subcontracted product.',
    subcontract(),
    {
      keywords: ['subcontract receipt', 'subcontract PO', '101', 'stock change', '543'],
      check:
        'Review the subcontracting PO and the receipt’s BSV line. For a cost-relevant account, check any required controlling assignment.',
      sources: ['catalog', 'subcontract'],
      guides: ['subcontracting', 'automatic-postings'],
    }
  );
  key(
    'FRL',
    'External subcontracting service',
    'FRL identifies the cost of the outside processing service on a subcontracting PO.',
    subcontract(),
    {
      keywords: ['outside processing', 'external activity', 'subcontracting service', '101', '543'],
      check:
        'Separate the supplier processing charge from provided components and planned delivery costs in the PO.',
      sources: ['subcontract', 'accounts'],
      guides: ['subcontracting', 'automatic-postings'],
    }
  );
  key(
    'FRN',
    'Subcontracting delivery costs',
    'FRN is the expense-side key for applicable planned delivery charges on a subcontracting PO.',
    subcontract(true),
    {
      keywords: ['subcontracting freight', 'planned delivery costs', 'external service'],
      check:
        'Inspect the planned conditions on the subcontracting PO and the delivery cost accounts used at receipt.',
      sources: ['catalog', 'subcontract', 'delivery'],
      guides: ['subcontracting', 'delivery-costs'],
    }
  );
  key(
    'FR1',
    'Freight clearing',
    'FR1 holds the planned freight amount between the receipt and the freight invoice.',
    deliveryCost('Freight clearing', 'FR1'),
    {
      keywords: ['planned freight', 'delivery cost', 'shipping charge'],
      check: 'Check the freight condition and account key in the purchasing calculation schema.',
      sources: ['catalog', 'delivery'],
      guides: ['delivery-costs', 'purchasing-pricing'],
    }
  );
  key(
    'FR2',
    'Freight provision',
    'FR2 sets aside the planned freight charge when the condition uses a provision account.',
    deliveryCost('Freight provision', 'FR2', true),
    {
      keywords: ['shipping accrual', 'freight accrual'],
      check:
        'Inspect the provision key on the freight condition and the settled or reversed provision balance.',
      sources: ['catalog', 'delivery'],
      guides: ['delivery-costs'],
    }
  );
  key(
    'FR3',
    'Customs duty clearing',
    'FR3 holds a planned customs charge until the applicable duty invoice clears it.',
    deliveryCost('Customs duty clearing', 'FR3'),
    {
      keywords: ['import duty', 'customs broker', 'planned delivery cost'],
      check:
        'Check the customs duty condition and the supplier or broker used for invoice verification.',
      sources: ['catalog', 'delivery'],
      guides: ['delivery-costs'],
    }
  );
  key(
    'FR4',
    'Customs duty provision',
    'FR4 records an estimate for customs charges using the provision assigned to the condition.',
    deliveryCost('Customs duty provision', 'FR4', true),
    {
      keywords: ['import provision', 'customs accrual'],
      check: 'Verify the condition’s accrual key and the rule used to clear the customs provision.',
      sources: ['catalog', 'delivery'],
      guides: ['delivery-costs'],
    }
  );
  key(
    'RUE',
    'Provisions for delivery costs',
    'RUE lets a PO condition accrue delivery costs that need separate clearing.',
    deliveryCost('Delivery cost provision', 'RUE', true),
    {
      keywords: ['delivery cost accrual', 'planned procurement charge'],
      check:
        'Check the PO condition’s provision setting and the manual clearing when verifying the invoice.',
      sources: ['catalog', 'delivery'],
      guides: ['delivery-costs'],
    }
  );
  key(
    'UPF',
    'Unplanned delivery costs',
    'UPF records a surprise freight or duty charge when the invoice posts it to a separate account.',
    example(
      'The invoice includes RM10 of extra freight that was absent from the PO. Unplanned delivery costs are configured for a separate account.',
      posting(
        'Post the invoice',
        'The extra freight is charged to UPF. The original cost is cleared against GR/IR.',
        [line('GR/IR clearing', 'WRX', 100), line('Unplanned freight expense', 'UPF', 10)],
        [line('Vendor payable', '', 110)]
      )
    ),
    {
      keywords: ['unexpected freight', 'unplanned freight', 'MIRO'],
      check:
        'Check whether invoice verification distributes unplanned costs or posts them separately.',
      sources: ['delivery', 'catalog'],
      guides: ['delivery-costs', 'invoice-verification'],
    }
  );
  key(
    'DIF',
    'Small invoice differences',
    'DIF takes a small invoice imbalance when the configured tolerance permits automatic posting.',
    example(
      'The entered invoice total is RM100.50 and the matched item is RM100. The RM0.50 small difference is within the permitted tolerance.',
      posting(
        'Post the invoice',
        'SAP adds the small difference line to balance the invoice.',
        [line('GR/IR clearing', 'WRX', 100), line('Small invoice difference', 'DIF', 0.5)],
        [line('Vendor payable', '', 100.5)]
      )
    ),
    {
      keywords: ['small amount', 'tolerance', 'rounding', 'OMR6', 'BD', 'MIRO'],
      check:
        'Review the small-difference tolerance (BD) and the DIF account. Compare the entered gross amount with the calculated item and tax amounts.',
      sources: ['tolerance', 'catalog'],
      guides: ['invoice-variances', 'invoice-verification'],
    }
  );
  key(
    'KDM',
    'Exchange rate differences on open items',
    'KDM takes a currency difference that cannot be absorbed by stock under the applicable invoice rules.',
    example(
      'The same foreign-currency amount was RM100 at receipt and is RM110 at invoice. The standard-price scenario posts the currency difference separately.',
      posting(
        'Post the supplier invoice',
        'The RM10 exchange variance is debited to KDM in this example.',
        [line('GR/IR clearing', 'WRX', 100), line('Currency difference', 'KDM', 10)],
        [line('Vendor payable', '', 110)]
      )
    ),
    {
      keywords: ['foreign currency', 'exchange rate', 'exchange variance', 'MIRO'],
      check:
        'Compare receipt and invoice exchange rates, fixed-rate settings, price control, and exchange-difference customizing.',
      guides: ['invoice-variances', 'invoice-verification'],
    }
  );
  key(
    'KDR',
    'Exchange rounding differences',
    'KDR balances a small remainder caused by rounding individual converted invoice lines.',
    example(
      'Local-currency conversion leaves RM0.01 between the rounded item total and the rounded payable.',
      posting(
        'Convert and post invoice lines',
        'The extra rounding line makes the local-currency document balance.',
        [line('GR/IR clearing', 'WRX', 100), line('Exchange rounding', 'KDR', 0.01)],
        [line('Vendor payable', '', 100.01)]
      )
    ),
    {
      keywords: ['exchange rounding', 'rounding difference', 'local currency', 'MIRO'],
      check:
        'Check the rounded local-currency amounts per line and review the exchange rounding account determination.',
      guides: ['invoice-variances'],
    }
  );
  key(
    'RKA',
    'Invoice reduction clearing',
    'RKA temporarily holds the amount reduced when SAP creates a vendor invoice and its associated credit memo.',
    example(
      'A vendor bills RM120. The accepted amount is RM100 and invoice reduction is used for the RM20 difference.',
      posting(
        'Record the invoice',
        'The full billed amount appears on the vendor line. The reduction is temporarily debited to RKA.',
        [line('GR/IR clearing', 'WRX', 100), line('Invoice reduction clearing', 'RKA', 20)],
        [line('Vendor payable', '', 120)]
      ),
      pair(
        'Record the reduction credit memo',
        'The credit memo reduces the vendor payable and clears RKA.',
        vendor,
        ['Invoice reduction clearing', 'RKA'],
        20
      )
    ),
    {
      keywords: ['invoice reduction', 'credit memo', 'invoice dispute', 'MIRO'],
      check:
        'Compare the two FI documents generated for the invoice reduction. The RKA lines should offset each other.',
      guides: ['invoice-verification', 'invoice-variances'],
    }
  );
  key(
    'RAP',
    'Retroactive price revaluation',
    'RAP posts the adjustment when an agreed price changes after the supplied goods or service was invoiced.',
    example(
      'A settled delivery is revalued after the supplier’s price increases by RM10.',
      pair(
        'Post the retroactive adjustment',
        'SAP records the additional expense and the extra payable under the revaluation process.',
        ['Retroactive price expense', 'RAP'],
        vendor,
        10
      )
    ),
    {
      keywords: ['retroactive price', 'revaluation', 'settled invoice', 'price adjustment'],
      check:
        'Review the revaluation list and the changed price condition. Check RAP accounts for the relevant adjustment direction.',
      guides: ['invoice-verification', 'purchasing-pricing'],
    }
  );

  const classicRebate = {
    editions: ['ecc'],
    sources: ['rebate', 'catalog'],
    guides: ['purchasing-pricing'],
    lookup: 'condition',
  };
  key(
    'AG1',
    'Agency business commission income',
    'AG1 selects the revenue account for commission earned in agency business.',
    example(
      'In configured agency business, the intermediary earns a commission for guaranteeing payment.',
      pair(
        'Settle RM20 commission income',
        'The agency pricing or settlement schema chooses the commission revenue account.',
        ['Agency settlement receivable', ''],
        ['Agency commission income', 'AG1'],
        20
      )
    ),
    {
      ...classicRebate,
      keywords: ['commission revenue', 'del credere', 'agency business'],
      check: 'Check which income condition uses AG1 in the agency settlement schema.',
    }
  );
  key(
    'AG2',
    'Agency business turnover',
    'AG2 selects an account for turnover postings enabled for the agency settlement type.',
    example('A settlement type records RM100 of business volume as a turnover posting.', {
      title: 'Determine the turnover account',
      effect:
        'The billing type’s turnover key supplies the account. The settlement type determines its debit and credit lines.',
      lookup: { account: 'Agency turnover account', code: 'AG2' },
    }),
    {
      ...classicRebate,
      keywords: ['payment type', 'business volume', 'agency business'],
      check:
        'Verify that turnover posting is active for the payment type and that AG2 is assigned in the billing type.',
    }
  );
  key(
    'AG3',
    'Agency business commission expense',
    'AG3 selects the expense account for commission your company pays.',
    example(
      'An agency settlement includes an RM20 commission payable.',
      pair(
        'Record the commission charge',
        'The schema routes the cost to the commission expense account.',
        ['Agency commission expense', 'AG3'],
        ['Agency settlement payable', ''],
        20
      )
    ),
    {
      ...classicRebate,
      keywords: ['commission expense', 'agency business'],
      check: 'Inspect the expense condition and account key in the agency settlement schema.',
    }
  );
  key(
    'DEL',
    'Del credere commission',
    'DEL is an income key used in purchasing payment or invoice lists for a payment guarantee commission.',
    example(
      'A configured purchasing invoice list calculates RM15 in payment guarantee commission.',
      pair(
        'Settle the commission',
        'The payment-list schema determines the commission income account from DEL.',
        ['Settlement receivable', ''],
        ['Del credere commission income', 'DEL'],
        15
      )
    ),
    {
      ...classicRebate,
      keywords: ['payment guarantee', 'invoice list', 'commission'],
      check: 'Inspect the DEL condition in the calculation schema for payment or settlement lists.',
    }
  );
  key(
    'BO1',
    'Subsequent settlement accrual',
    'BO1 tracks an earned rebate estimate during the classic subsequent settlement process.',
    example(
      'A PO receipt qualifies for an RM5 volume rebate accrual under a legacy condition arrangement.',
      {
        title: 'Accrue the expected rebate',
        effect:
          'When accrual is enabled, the receipt uses the condition’s BO1 account. The rebate schema supplies the counterpart.',
        lookup: { account: 'Accrued rebate provision', code: 'BO1' },
      }
    ),
    {
      ...classicRebate,
      keywords: ['rebate accrual', 'B01', 'volume rebate', 'purchase rebate'],
      check:
        'Check the accrual indicator on the condition, arrangement validity, and the receipt included in business volume.',
    }
  );
  key(
    'BO2',
    'Subsequent settlement income',
    'BO2 routes the income from the actual settlement of a classic rebate.',
    example(
      'The period closes and a vendor confirms RM30 in earned rebates.',
      pair(
        'Settle the rebate',
        'In this income example the vendor balance is debited and the rebate income account is credited.',
        vendor,
        ['Rebate income', 'BO2'],
        30
      )
    ),
    {
      ...classicRebate,
      keywords: ['rebate income', 'B02', 'vendor rebate', 'period settlement'],
      check:
        'Verify the settlement document, the rebate amount, and the BO2 key in the settlement schema.',
    }
  );
  key(
    'BO3',
    'Rebate income after settlement',
    'BO3 gives a late receipt a separate account when its legacy rebate arrangement has already been settled.',
    example(
      'A late goods receipt carries an RM5 rebate after the rebate arrangement was settled.',
      {
        title: 'Evaluate the late receipt',
        effect:
          'The separate BO3 account keeps the late adjustment distinguishable from the closed arrangement’s accruals.',
        lookup: { account: 'Late rebate provision or income', code: 'BO3' },
      }
    ),
    {
      ...classicRebate,
      keywords: ['B03', 'late goods receipt', 'rebate provision'],
      check:
        'Check the arrangement’s settled status and the condition key used by the follow-on receipt.',
    }
  );
  key(
    'VST',
    'Input tax in purchasing settlement',
    'VST selects the input tax account in applicable purchasing settlement conditions.',
    example(
      'An applicable debit-side settlement has a base charge of RM100 and recoverable input tax of RM6.',
      posting(
        'Post the settlement',
        'The tax condition sends the recoverable amount to the input tax account.',
        [line('Settlement expense', '', 100), line('Recoverable input tax', 'VST', 6)],
        [line('Settlement payable', '', 106)]
      )
    ),
    {
      ...classicRebate,
      keywords: ['tax account', 'input tax', 'debit-side settlement'],
      check:
        'Check the tax code and tax condition in the settlement schema for the applicable country and posting scenario.',
    }
  );

  const purchaseAccounts = example(
    'A company uses Purchase Account Management. It receives RM100 of goods plus RM10 of planned freight.',
    posting(
      'Receive the stock purchase',
      'The purchase reporting lines accompany the inventory and clearing entries.',
      [
        line('Inventory', 'BSX', 110),
        line('Purchases', 'EIN', 100),
        line('Freight purchases', 'FRE', 10),
      ],
      [
        line('GR/IR clearing', 'WRX', 100),
        line('Freight clearing', 'FR1', 10),
        line('Purchase offset', 'EKG', 110),
      ]
    )
  );
  const purchaseOptions = {
    editions: all,
    sources: ['ein', 'purchaseAccounting', 'catalog'],
    guides: ['stock-gr', 'delivery-costs', 'automatic-postings'],
  };
  key(
    'EIN',
    'Purchase reporting account',
    'EIN reports externally purchased goods when Purchase Account Management is active.',
    purchaseAccounts,
    {
      ...purchaseOptions,
      keywords: ['purchase accounting', 'localization', 'purchase account'],
      check:
        'Confirm Purchase Account Management is activated in the company code and inspect the receipt’s supplemental purchase entries.',
    }
  );
  key(
    'EKG',
    'Purchase reporting offset',
    'EKG balances the supplemental purchase entries when Purchase Account Management is active.',
    purchaseAccounts,
    {
      ...purchaseOptions,
      keywords: ['purchase offsetting account', 'localization', 'purchase accounting'],
      check:
        'Compare EKG against the purchase and freight purchase reporting entries for the same goods receipt.',
    }
  );
  key(
    'FRE',
    'Freight purchase reporting',
    'FRE reports planned freight as part of external purchases under Purchase Account Management.',
    purchaseAccounts,
    {
      ...purchaseOptions,
      keywords: ['freight purchase account', 'purchase accounting', 'localization'],
      check:
        'Check whether Purchase Account Management applies and whether the delivery charge posts with the freight purchase reporting account.',
    }
  );

  const costing = {
    sources: ['catalog', 'priceExample'],
    guides: ['material-ledger', 'price-control'],
    lookup: 'costing',
  };
  const wipOptions = { ...costing, sources: ['wip', 'catalog'] };
  const closeStock = example(
    'Actual costing finds RM20 of additional period cost attributable to closing stock. The run leaves closing inventory at its existing value.',
    pair(
      'Close the costing run',
      'The difference goes to a separate account for closing stock under this run option.',
      ['Closing stock accrual', 'LKW'],
      ['Material Ledger price difference', 'PRY'],
      20
    )
  );
  key(
    'LKW',
    'Closing stock accrual in Material Ledger',
    'LKW holds closing-stock differences when the costing run leaves the stock value unchanged.',
    closeStock,
    {
      ...costing,
      keywords: ['accrual deferral', 'actual costing', 'without stock revaluation'],
      check:
        'Review the closing entry option for inventory revaluation. LKW applies when closing stock is left at its existing value.',
    }
  );
  key(
    'PRY',
    'Material Ledger price differences',
    'PRY is used for price differences distributed when the Material Ledger closes actual costing.',
    closeStock,
    {
      ...costing,
      keywords: ['material ledger settlement', 'actual costing', 'periodic unit price'],
      check:
        'Use the material price analysis to trace which difference and recipient account were included in the closing entry.',
    }
  );
  key(
    'COC',
    'Consumption revaluation account',
    'COC is the common account for consumption adjustments when actual costing collects them in one account.',
    example(
      'Actual costing allocates RM10 of additional cost to previously consumed material and uses a common account.',
      pair(
        'Revalue consumption',
        'The extra cost is booked to the configured consumption revaluation account.',
        ['Consumption revaluation', 'COC'],
        ['Material Ledger price difference', 'PRY'],
        10
      )
    ),
    {
      ...costing,
      keywords: ['consumption revaluation', 'header account', 'single level'],
      check:
        'Check the consumption revaluation option that directs the differences to a collective account or to the original accounts.',
    }
  );
  key(
    'PRL',
    'Activity price differences',
    'PRL records the Material Ledger side of actual cost differences for activities such as machine time.',
    activity,
    {
      ...wipOptions,
      keywords: ['actual activity', 'cost center activity', 'actual costing'],
      check:
        'Compare actual and planned activity prices and trace the settlement from the cost center to material.',
    }
  );
  const wipMaterial = example(
    'The costing run allocates RM12 more material cost to work in process. In a later period that WIP is released.',
    pair(
      'Revalue material WIP',
      'The material portion of work in process increases by its allocated difference.',
      ['Material work in process', 'WPM'],
      ['Material Ledger price difference', 'PRY'],
      12
    ),
    pair(
      'Release the older WIP',
      'The earlier WIP adjustment is transferred back into the material price difference flow.',
      ['Released WIP material difference', 'PRM'],
      ['Material work in process', 'WPM'],
      12
    )
  );
  const wipActivity = example(
    'The costing run allocates RM8 of activity cost to work in process. In a later period that WIP is released.',
    pair(
      'Revalue activity WIP',
      'The activity portion of work in process increases by the allocated difference.',
      ['Activity work in process', 'WPA'],
      ['Material Ledger price difference', 'PRL'],
      8
    ),
    pair(
      'Release the older WIP',
      'The earlier activity adjustment is transferred back into the activity price difference flow.',
      ['Released WIP activity difference', 'PRA'],
      ['Activity work in process', 'WPA'],
      8
    )
  );
  key(
    'WPM',
    'Material differences in WIP',
    'WPM holds the share of material price and currency differences assigned to new work in process.',
    wipMaterial,
    {
      ...wipOptions,
      keywords: ['work in process', 'material variance', 'new WIP'],
      check: 'Review the material component allocation and the WIP revaluation closing entry.',
    }
  );
  key(
    'WPA',
    'Activity differences in WIP',
    'WPA holds the share of activity price differences assigned to new work in process.',
    wipActivity,
    {
      ...wipOptions,
      keywords: ['work in process', 'internal activity', 'new WIP'],
      check: 'Trace the activity variance and the quantity of WIP receiving it.',
    }
  );
  key(
    'PRM',
    'Released WIP material differences',
    'PRM carries the material price and currency differences released from older WIP.',
    wipMaterial,
    {
      ...wipOptions,
      keywords: ['exploded WIP', 'old WIP', 'material variance'],
      check: 'Review the WIP release from previous periods and its original material portion.',
    }
  );
  key(
    'PRA',
    'Released WIP activity differences',
    'The standalone PRA key carries activity-price differences released from older WIP.',
    wipActivity,
    {
      ...wipOptions,
      keywords: ['exploded WIP', 'released WIP', 'actual activity'],
      check:
        'Check the activity portion of the WIP revaluation and its release in the costing run.',
    }
  );
  key(
    'PRG',
    'Consumption price differences in an alternative valuation run',
    'PRG is the account credited when price differences move from material to consumption in an alternative valuation.',
    example(
      'An alternative valuation run transfers RM10 of additional material price differences to single-level consumption.',
      pair(
        'Revalue the consumption',
        'The price difference line offsets the allocated consumption adjustment.',
        ['Revalued consumption', 'COC'],
        ['AVR price differences', 'PRG'],
        10
      )
    ),
    {
      ...costing,
      keywords: ['AVR', 'alternative valuation run', 'single level'],
      check: 'Check the alternative valuation run settings and the consumption revaluation result.',
    }
  );
  key(
    'KDG',
    'Consumption exchange differences in an alternative valuation run',
    'KDG is the exchange-rate counterpart used when currency differences move to consumption in an alternative valuation.',
    example(
      'An alternative valuation run reallocates RM10 of exchange differences to single-level consumption.',
      pair(
        'Revalue the consumption',
        'The currency difference line offsets the allocated consumption adjustment.',
        ['Revalued consumption', 'COC'],
        ['AVR exchange differences', 'KDG'],
        10
      )
    ),
    {
      ...costing,
      keywords: ['AVR', 'foreign currency', 'single level', 'alternative valuation run'],
      check: 'Trace the exchange-rate portion of the differences in the alternative run.',
    }
  );
  key(
    'PRC',
    'Alternative valuation price differences',
    'PRC participates in the allocation of differences to semi-finished or finished material in an alternative valuation run.',
    example(
      'An alternative valuation run allocates a material-related difference from a cost center to the finished product.',
      {
        title: 'Apply the alternative valuation',
        effect:
          'PRC identifies the price difference account used in the allocation. The run’s valuation and settlement rules provide the complete posting.',
        lookup: { account: 'Alternative valuation price difference', code: 'PRC' },
      }
    ),
    {
      ...costing,
      keywords: ['AVR', 'alternative valuation run', 'variance allocation'],
      check:
        'Check which differences the alternative run allocates and which valuation view is being closed.',
    }
  );
  const costHierarchy = example(
    'A cost object hierarchy has an RM15 unfavorable difference to settle after its material postings.',
    pair(
      'Settle hierarchy differences',
      'The hierarchy difference and its configured offset form the illustrated posting pair.',
      ['Hierarchy price difference', 'PRK'],
      ['Hierarchy settlement offset', 'KTR'],
      15
    )
  );
  key(
    'PRK',
    'Cost object hierarchy price differences',
    'PRK holds the price difference from settlement of a cost object hierarchy.',
    costHierarchy,
    {
      ...costing,
      keywords: ['cost object hierarchy', 'settlement variance'],
      check:
        'Check the hierarchy settlement and the price difference after settlement via the materials.',
    }
  );
  key(
    'KTR',
    'Cost object hierarchy offset',
    'KTR balances the PRK price difference entry when the hierarchy is settled.',
    costHierarchy,
    {
      ...costing,
      keywords: ['cost object hierarchy', 'contra entry', 'settlement offset'],
      check: 'Compare the PRK and KTR lines in the settlement document.',
    }
  );
  const balanceValuation = example(
    'A balance-sheet valuation run calculates a RM20 increase above the inventory’s book value for one valuation basis.',
    pair(
      'Post the valuation difference',
      'The stock supplement holds the adjustment. The paired revaluation account offsets it.',
      ['Supplementary inventory', 'BSD'],
      ['Revaluation income', 'UMD'],
      20
    )
  );
  key(
    'BSD',
    'Supplementary inventory',
    'BSD records a separate inventory adjustment in a balance-sheet valuation close.',
    balanceValuation,
    {
      ...costing,
      keywords: ['cumulation run', 'closing entry', 'balance sheet valuation', 'LIFO'],
      check:
        'Review the closing calculation and the valuation area used for the supplementary account.',
    }
  );
  key(
    'UMD',
    'Offset for supplementary inventory',
    'UMD is the posting counterpart for a BSD stock adjustment in a balance-sheet valuation close.',
    balanceValuation,
    {
      ...costing,
      keywords: ['cumulation run', 'balance sheet valuation', 'supplementary stock'],
      check: 'Confirm that BSD and UMD are maintained for the same valuation context.',
    }
  );
  key(
    'UMB',
    'Inventory revaluation gain or loss',
    'UMB records revaluation when valuation changes require an adjustment to stock value.',
    example(
      'An opening quantity of inventory needs an upward revaluation of RM10 after the applicable price changes.',
      pair(
        'Record the inventory value increase',
        'Stock gains value and the revaluation result is credited in this example.',
        inventory,
        ['Inventory revaluation income', 'UMB'],
        10
      )
    ),
    {
      ...costing,
      keywords: ['previous period', 'standard price change', 'MR21', 'revaluation'],
      check:
        'Compare the standard prices and posting periods. A backdated movement or invoice at the prior price can also produce a UMB line.',
    }
  );

  const historical = {
    editions: [],
    historical: true,
    sources: ['catalog'],
    guides: ['material-ledger'],
    lookup: 'historical',
  };
  const historicCollector = example(
    'In the older product-cost-collector process, settlement of valuated sales-order stock produces an RM15 unfavorable difference.',
    pair(
      'Read the archived settlement',
      'The old pricing-difference entry and its offset appear together.',
      ['Collector price difference', 'PRP'],
      ['Collector settlement offset', 'PRQ'],
      15
    )
  );
  key(
    'PRP',
    'Historical product cost collector differences',
    'Older repetitive manufacturing used PRP for differences on valuated sales-order stock during collector settlement.',
    historicCollector,
    {
      ...historical,
      keywords: ['repetitive manufacturing', 'product cost collector', 'legacy'],
      check:
        'Use this key to interpret archives from the corresponding legacy release or industry solution.',
    }
  );
  key(
    'PRQ',
    'Historical product cost collector offset',
    'PRQ was the counterpart to the price difference posted with PRP in the older collector process.',
    historicCollector,
    {
      ...historical,
      keywords: ['repetitive manufacturing', 'product cost collector', 'legacy'],
      check: 'Read the corresponding PRP line in the archived settlement.',
    }
  );
  key(
    'PRV',
    'Historical lower-level price differences',
    'Earlier Material Ledger settlement used PRV when price differences moved up from components to higher-level materials.',
    example(
      'In a legacy multilevel settlement, RM10 of a component’s price difference flows to a finished material.',
      {
        title: 'Trace the old allocation',
        effect:
          'Read the lower-level price-difference account on the archived settlement and follow the receiving material.',
        lookup: { account: 'Lower-level price differences', code: 'PRV' },
      }
    ),
    {
      ...historical,
      keywords: ['legacy', 'multilevel', 'component price difference'],
      check:
        'Use this historical key when reading old documents. The current close uses its supported Material Ledger posting rules.',
    }
  );
  key(
    'KDV',
    'Historical lower-level exchange differences',
    'Earlier Material Ledger settlement used KDV when component exchange differences moved to higher-level materials.',
    example(
      'In a legacy multilevel settlement, a currency difference on a component flows to the finished material.',
      {
        title: 'Trace the old exchange difference',
        effect:
          'Read the KDV account line in the archived settlement and trace it to the receiving material.',
        lookup: { account: 'Lower-level exchange differences', code: 'KDV' },
      }
    ),
    {
      ...historical,
      keywords: ['legacy', 'multilevel', 'currency difference'],
      check: 'Confirm the release and period of the archived Material Ledger document.',
    }
  );
  key(
    'WRY',
    'Historical Material Ledger GR/IR clearing',
    'WRY was a separate GR/IR key for Material Ledger in releases before R/3 4.0.',
    example(
      'An archived receipt in an older Material Ledger system carries a RM100 GR/IR balance.',
      pair(
        'Read the old receipt',
        'The GR/IR balance sits under the older key. Later releases handle parallel currencies under WRX.',
        inventory,
        ['Older Material Ledger GR/IR', 'WRY']
      )
    ),
    {
      ...historical,
      keywords: ['legacy', 'parallel currency', 'GRIR'],
      check:
        'When tracing a migrated balance, check the legacy WRY account and its transfer to WRX.',
      guides: ['gr-ir-clearing', 'material-ledger'],
    }
  );

  const localization = {
    sources: ['catalog'],
    guides: ['automatic-postings', 'posting-periods'],
    lookup: 'localization',
  };
  key(
    'TXO',
    'Brazil stock transfer tax',
    'TXO helps determine the tax account for applicable goods issues and receipts in Brazilian stock transfers.',
    example(
      'A Brazilian inter-plant transfer triggers applicable tax under its nota fiscal scenario.',
      {
        title: 'Determine the stock-transfer tax account',
        effect:
          'The configured transfer and tax direction determine which account applies. The nota fiscal and tax setup supply the complete FI document.',
        lookup: { account: 'Stock-transfer tax account', code: 'TXO' },
      }
    ),
    {
      ...localization,
      keywords: ['Brazil', 'nota fiscal', 'transfer tax', 'goods issue goods receipt'],
      check: 'Check the Brazilian localization, transfer tax treatment and issued nota fiscal.',
    }
  );
  key(
    'WGB',
    'Inflation adjustment at period close',
    'WGB sends the inflation adjustment to its dedicated account when the country-specific closing process is used.',
    example(
      'A localized period-close run calculates an additional value for stock under inflation accounting.',
      {
        title: 'Select the period-close account',
        effect:
          'The inflation method supplies the adjustment direction and WGB determines the dedicated posting account.',
        lookup: { account: 'Period-close inflation adjustment', code: 'WGB' },
      }
    ),
    {
      ...localization,
      keywords: ['inflation accounting', 'period-end'],
      check:
        'Verify the country-specific inflation procedure and which posting accounts it determines.',
    }
  );
  key(
    'WGI',
    'Inflation revaluation of goods issues',
    'WGI is the issuing-side account key when a posted goods issue is revalued for inflation.',
    example(
      'A localized run revalues an issue after updating the market price used for inflation accounting.',
      {
        title: 'Revalue the issuing plant',
        effect: 'The issuing-side difference is routed to the WGI account in this local process.',
        lookup: { account: 'Issuing-side revaluation', code: 'WGI' },
      }
    ),
    {
      ...localization,
      keywords: ['inflation', 'issuing plant', 'goods issue'],
      check: 'Verify the original goods issue and the market price used by the localized run.',
    }
  );
  key(
    'WGR',
    'Inflation revaluation of transfer receipts',
    'WGR is the receiving-side account key for inflation revaluation of a completed transfer.',
    example(
      'A localized run revalues the receiving plant’s part of a completed transfer after the market price changes.',
      {
        title: 'Revalue the receiving plant',
        effect: 'The receiving-side difference is routed to WGR in this local process.',
        lookup: { account: 'Receiving-side revaluation', code: 'WGR' },
      }
    ),
    {
      ...localization,
      keywords: ['inflation', 'receiving plant', 'goods receipt'],
      check:
        'Verify both plants, the completed transfer and the price used in the revaluation run.',
    }
  );

  key(
    'BSK',
    'Inventory adjustment for external products',
    'BSK can determine the gain or loss account for inventory value adjustments to externally procured products in the documented S/4HANA chart.',
    example(
      'A supported adjustment increases the valuation of an external product by RM10 and the scenario selects the BSK gain account.',
      pair(
        'Post the value adjustment',
        'The product’s inventory value increases and the configured gain account receives the offset.',
        inventory,
        ['External product valuation gain', 'BSK'],
        10
      )
    ),
    {
      editions: ['s4'],
      keywords: ['external products', 'value adjustment', 'inventory gain'],
      check:
        'Review which valuation process chose BSK and the gain or loss account maintained there.',
      sources: ['bsk', 'accounts'],
      guides: ['price-control', 'material-ledger'],
    }
  );
  key(
    'RUA',
    'Freight clearing for allocation',
    'RUA identifies an MM freight clearing account used in supported freight allocation scenarios.',
    deliveryCost('Freight clearing', 'RUA'),
    {
      editions: ['s4', 'cloud'],
      keywords: ['freight allocation', 'transportation management', '5JH', '5JI'],
      check:
        'Check the freight cost conditions, allocation scenario and RUA account in your chart and activated scope.',
      sources: ['tmAccounts', 'public'],
      guides: ['delivery-costs'],
    }
  );
  key(
    'TM1',
    'Transportation freight intermediate clearing',
    'TM1 identifies an intermediate account in two-step Transportation Management freight allocation.',
    example(
      'A freight settlement uses two-step allocation to carry the freight cost from transportation settlement to MM.',
      {
        title: 'Determine the intermediate account',
        effect:
          'The TM freight allocation uses the TM1 clearing account. The settlement and allocation documents supply the full offsetting lines.',
        lookup: { account: 'TM freight intermediate clearing', code: 'TM1' },
      }
    ),
    {
      editions: ['s4', 'cloud'],
      keywords: ['freight cost allocation', 'transportation management', '4CV', '4CW'],
      check:
        'Trace the two freight allocation steps and compare the clearing account in both documents.',
      sources: ['tmAccounts', 'public'],
      guides: ['delivery-costs', 'automatic-postings'],
    }
  );

  const grouping = {
    editions: all,
    sources: ['gbb', 'grouping', 'publicGbb'],
    guides: ['account-modifiers', 'movement-type'],
  };
  modifier(
    'GBB',
    'AUA',
    'Order settlement',
    'AUA gives the offset in production order settlement a dedicated account.',
    settlement,
    {
      ...grouping,
      keywords: ['production variance', 'settlement', 'KO88'],
      check:
        'Review the order settlement document. SAP can use GBB/AUF for settlement when the AUA account is not maintained.',
      sources: ['production', 'gbb', 'publicGbb'],
      guides: ['account-modifiers', 'production-issue', 'material-ledger'],
    }
  );
  modifier(
    'GBB',
    'AUF',
    'Receipt from an order',
    'AUF selects the stock change account on a production-order receipt and can act as the settlement fallback.',
    productionReceipt,
    {
      ...grouping,
      keywords: ['101', 'production order', 'stock increase', 'settlement fallback'],
      check:
        'Check that the receipt references a production order. For settlement, check whether the AUA account has been maintained.',
      sources: ['production', 'gbb', 'publicGbb'],
      guides: ['account-modifiers', 'production-issue'],
    }
  );
  modifier(
    'GBB',
    'AUI',
    'Actual activity allocation adjustment',
    'AUI selects the cost-center offset when an actual activity price difference is allocated to a material.',
    activity,
    {
      ...grouping,
      keywords: ['cost center activity', 'material ledger', 'actual costing', 'PRL'],
      check:
        'Trace the cost center, activity type and actual costing allocation. The other side of this example is PRL.',
      sources: ['catalog', 'accounts', 'publicGbb'],
      guides: ['material-ledger', 'account-modifiers'],
    }
  );
  modifier(
    'GBB',
    'BSA',
    'Opening stock balances',
    'BSA selects the offset account when you load an opening inventory balance.',
    example(
      'At cutover, the company loads RM100 of its own valuated stock into SAP.',
      pair(
        'Post movement 561',
        'Inventory increases and the opening balance is credited to the migration offset account.',
        inventory,
        ['Opening stock offset', 'GBB/BSA']
      )
    ),
    {
      ...grouping,
      keywords: ['561', 'cutover', 'migration', 'initial stock'],
      check:
        'Confirm the opening quantity and value. Reconcile the offset against the opening balance migration.',
    }
  );
  modifier(
    'GBB',
    'INV',
    'Stocktake differences',
    'INV selects the gain or loss account for a posted physical inventory difference.',
    stocktake,
    {
      ...grouping,
      keywords: ['701', '702', 'stocktake', 'cycle count', 'shortage', 'inventory differences'],
      check:
        'Compare the physical count with book stock and confirm which difference movement the count produces.',
      guides: ['physical-inventory', 'account-modifiers'],
    }
  );
  modifier(
    'GBB',
    'VAX',
    'Sales issue without a cost object',
    'VAX selects cost of goods sold for a sales issue that has no separate account assignment object.',
    example(
      'A delivery issues RM100 of valuated own stock under the VAX rule, without an account assignment object.',
      pair(
        'Post the goods issue',
        'SAP records cost of goods sold and reduces inventory.',
        ['Cost of goods sold', 'GBB/VAX'],
        inventory
      )
    ),
    {
      ...grouping,
      keywords: ['sales order', '601', 'delivery', 'COGS'],
      check:
        'Check the delivery movement and its account assignment before comparing the VAX and VAY settings.',
    }
  );
  modifier(
    'GBB',
    'VAY',
    'Sales issue with a cost object',
    'VAY selects the cost-of-sales account when the issue uses an account assignment object.',
    example(
      'A sales delivery issues RM100 of material and its posting carries the account assignment required by the VAY rule.',
      pair(
        'Post the assigned sales issue',
        'The cost-of-sales line carries the applicable controlling assignment and stock value decreases.',
        ['Assigned cost of goods sold', 'GBB/VAY'],
        inventory
      )
    ),
    {
      ...grouping,
      keywords: ['sales order account assignment object', 'controlling', 'cost element', 'COGS'],
      check:
        'Confirm the cost object from the sales posting and the account assignment required by the mapped account.',
    }
  );
  modifier(
    'GBB',
    'VBO',
    'Subcontract component consumption',
    'VBO selects the cost account when components you provided to a subcontractor are consumed.',
    subcontract(),
    {
      ...grouping,
      keywords: ['543', 'subcontracting', 'component stock', 'stock at vendor'],
      check:
        'Inspect the component consumption that accompanies the finished-item receipt. Reconcile its cost against the components removed from stock.',
      sources: ['subcontract', 'gbb', 'publicGbb'],
      guides: ['subcontracting', 'account-modifiers'],
    }
  );
  modifier(
    'GBB',
    'VBR',
    'Internal consumption',
    'VBR selects the material consumption account for common internal goods issues, such as a cost center or production order.',
    example(
      'Post two independent RM100 issues from your own valuated stock to see how the same modifier applies.',
      pair(
        'Issue to production with 261',
        'Debit material consumption on the production order and reduce inventory.',
        ['Production consumption', 'GBB/VBR'],
        inventory
      ),
      pair(
        'Issue to cost center with 201',
        'Debit consumption to the receiving cost center and reduce inventory.',
        ['Cost-center consumption', 'GBB/VBR'],
        inventory
      )
    ),
    {
      ...grouping,
      keywords: [
        '201',
        '261',
        'cost center',
        'production order',
        'goods issue',
        'expense',
        'direct consumption',
      ],
      check:
        'Check the movement’s general modification and the material valuation class. For a purchasing default, check the category in OME9.',
      guides: ['goods-issue', 'account-modifiers', 'account-assignment'],
    }
  );
  modifier(
    'GBB',
    'VKA',
    'Sales order account assignment',
    'VKA can default a G/L account for an account-assigned purchase linked to a sales order.',
    poExpense('a sales order item', 'Sales order purchase expense', 'GBB/VKA'),
    {
      ...grouping,
      keywords: ['sales order account assignment', 'individual PO', 'PO default'],
      lookup: 'po-default',
      check:
        'Review the sales order assignment, whether stock is valuated separately, and the account grouping on the purchasing account assignment category.',
      sources: ['assignment', 'gbb', 'publicGbb'],
      guides: ['account-assignment', 'account-modifiers'],
    }
  );
  modifier(
    'GBB',
    'VKP',
    'Project account assignment',
    'VKP can default the G/L account for an account-assigned purchase linked to a project.',
    poExpense('a project WBS element', 'Project material expense', 'GBB/VKP'),
    {
      ...grouping,
      keywords: ['project stock', 'WBS element', 'project account assignment', 'PO default'],
      lookup: 'po-default',
      check:
        'Review the WBS assignment and whether the project uses valuated stock or direct consumption.',
      sources: ['assignment', 'gbb', 'publicGbb'],
      guides: ['account-assignment', 'account-modifiers'],
    }
  );
  modifier(
    'GBB',
    'VNG',
    'Scrap or destruction',
    'VNG selects the expense account used when SAP writes off material scrapped from inventory.',
    scrap,
    {
      ...grouping,
      keywords: ['551', 'scrapping', 'damage', 'write off', 'scrap expense', 'destruction'],
      check:
        'Confirm the movement’s stock type and the VNG account grouping, then inspect the material and FI documents.',
      guides: ['goods-issue', 'account-modifiers'],
    }
  );
  modifier(
    'GBB',
    'VQP',
    'Sample withdrawal without a cost object',
    'VQP selects the offset account for a valuated sample withdrawal without a separate account assignment.',
    example(
      'Quality takes a sample worth RM10 from valuated quality-inspection stock under the sample withdrawal rule.',
      pair(
        'Post the sample withdrawal',
        'Stock value falls and the sample cost goes to the configured account.',
        ['Sample expense', 'GBB/VQP'],
        inventory,
        10
      )
    ),
    {
      ...grouping,
      keywords: ['331', 'sample removal', 'quality inspection', 'sampling'],
      check:
        'Review the stock type, sample movement and cost object requirement for the actual posting.',
      guides: ['qm-gr-inspection', 'account-modifiers'],
    }
  );
  modifier(
    'GBB',
    'VQY',
    'Sample withdrawal with a cost object',
    'VQY selects the sample expense account when the withdrawal carries a cost object.',
    example(
      'A configured sample withdrawal consumes RM10 of valuated material and includes the required cost assignment.',
      pair(
        'Post the assigned sample withdrawal',
        'The receiving object takes the sample cost and SAP credits stock.',
        ['Assigned sample expense', 'GBB/VQY'],
        inventory,
        10
      )
    ),
    {
      ...grouping,
      keywords: ['sample removal', 'quality', 'account assigned sample'],
      check:
        'Verify that the movement uses VQY and that the required cost object and valuation are present.',
      guides: ['qm-gr-inspection', 'account-modifiers'],
    }
  );
  modifier(
    'GBB',
    'ZOB',
    'Receipt without a purchase order',
    'ZOB selects the balancing account when valuated stock is received without a PO reference.',
    example(
      'The warehouse receives RM100 of valuated material without a purchase order.',
      pair(
        'Post movement 501',
        'Inventory increases and the offset goes to the configured non-PO receipt account.',
        inventory,
        ['Receipt without PO offset', 'GBB/ZOB']
      )
    ),
    {
      ...grouping,
      keywords: ['501', 'GR without PO', 'non PO receipt'],
      check:
        'Review the valuation amount and how the company accounts for any supplier invoice outside this receipt.',
      guides: ['gr-without-po', 'account-modifiers'],
    }
  );
  modifier(
    'GBB',
    'ZOF',
    'Receipt without a production order',
    'ZOF selects the balancing account when production output is received without a production order reference.',
    example(
      'The warehouse receives RM100 of own valuated production output without an order reference.',
      pair(
        'Post movement 521',
        'Finished stock increases and the configured non-order production offset is credited.',
        inventory,
        ['Receipt without production order offset', 'GBB/ZOF']
      )
    ),
    {
      ...grouping,
      keywords: ['521', 'production receipt without order', 'finished goods'],
      check:
        'Verify the goods receipt reference and movement grouping before checking the offset account.',
    }
  );

  const prd = {
    sources: ['catalog', 'price', 'prdGroups'],
    guides: ['price-control', 'account-modifiers'],
  };
  modifier(
    'PRD',
    '',
    'Purchase price difference with blank grouping',
    'When PRD uses general modification, ordinary purchase receipts and invoices can use the blank row.',
    poVariance,
    {
      ...prd,
      keywords: [
        'blank modifier',
        'empty general modification',
        'goods receipt invoice receipt',
        'purchase price difference',
      ],
      check:
        'Review the PRD rules and the blank general modification row for the purchase’s valuation context.',
    }
  );
  modifier(
    'PRD',
    'PRA',
    'Price difference on goods issues and other movements',
    'PRA can separate price differences arising on goods issues or other eligible movements from purchase price differences.',
    example(
      'An eligible issue uses an entered consumption value of RM90 while stock decreases by RM100 at standard price.',
      posting(
        'Post the goods issue with the entered value',
        'RM10 goes to the issue price difference account when the selected movement uses PRD/PRA.',
        [
          line('Material consumption', 'GBB/VBR', 90),
          line('Issue price difference', 'PRD/PRA', 10),
        ],
        [line('Inventory', 'BSX', 100)]
      )
    ),
    {
      ...prd,
      keywords: ['goods issue', 'entered amount', 'variance', 'price difference'],
      check:
        'Check the actual movement combination and the PRD general modification rule that applies.',
    }
  );
  modifier(
    'PRD',
    'PRF',
    'Production price differences',
    'PRF separates price differences arising from production receipts or production order settlement when PRD uses modifiers.',
    settlement,
    {
      ...prd,
      keywords: ['settlement variance', 'production order', 'goods receipt', 'KO88'],
      check:
        'Compare the actual and standard amounts on the production order, then check PRF in account determination.',
      sources: ['production', 'catalog', 'prdGroups'],
      guides: ['production-issue', 'account-modifiers'],
    }
  );
  modifier(
    'PRD',
    'PRU',
    'Transfer price differences with an external amount',
    'PRU can separate a price difference on a qualifying transfer that uses an externally entered value.',
    example(
      'A qualifying transfer credits RM110 of issuing inventory and adds RM100 to receiving inventory. The movement’s price-difference rule selects PRD/PRU.',
      posting(
        'Post the transfer',
        'The resulting RM10 difference is booked separately in this example.',
        [line('Receiving inventory', 'BSX', 100), line('Transfer price difference', 'PRD/PRU', 10)],
        [line('Issuing inventory', 'BSX', 110)]
      )
    ),
    {
      ...prd,
      keywords: ['transfer posting', 'external amount', 'price difference', 'transfer variance'],
      check:
        'Check the value string and whether the scenario selects PRD/PRU or uses AUM for the transfer difference.',
      guides: ['transfer-postings', 'account-modifiers'],
    }
  );
  modifier(
    'KON',
    '',
    'Consignment liability with blank grouping',
    'When KON uses general modification, a standard consignment liability can use the blank row.',
    consignment,
    {
      keywords: ['blank modifier', '411 K', 'take ownership', 'vendor consignment'],
      check:
        'Check the vendor consignment price and the blank KON setting when the rule uses general modification.',
      sources: ['catalog', 'consignment'],
      guides: ['consignment', 'account-modifiers'],
    }
  );
  modifier(
    'KON',
    'PIP',
    'Pipeline liability',
    'PIP can route pipeline withdrawals to a liability account set aside for pipeline material.',
    pipeline,
    {
      keywords: ['pipeline vendor liability', 'pipeline withdrawal', 'MRKO'],
      check:
        'Review the pipeline price and withdrawal. Check that general modification is enabled for KON and that PIP is maintained.',
      sources: ['catalog', 'pipeline'],
      guides: ['pipeline', 'account-modifiers'],
    }
  );

  root.WorkHubSapTermsData = Object.freeze({ entries, refs });
})(typeof window === 'undefined' ? globalThis : window);
