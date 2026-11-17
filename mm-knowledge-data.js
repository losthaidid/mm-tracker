/* SAP MM Knowledge. Technical routes and examples are authored from the linked SAP references. */
(function (root) {
  'use strict';

  const editions = { ecc: 'ECC', s4: 'S/4HANA on-prem / Private', cloud: 'S/4HANA Public' };
  const areas = {
    structure: 'Enterprise structure',
    master: 'Master data',
    purchasing: 'Purchasing',
    inventory: 'Inventory management',
    batch: 'Batch and classification',
    valuation: 'Valuation and accounts',
    special: 'Special procurement',
    invoice: 'Invoice verification',
    integration: 'Integration',
  };
  const all = Object.keys(editions),
    classic = ['ecc', 's4'],
    s4 = ['s4'],
    cloud = ['cloud'],
    ecc = ['ecc'];
  const sapHelp = 'https://help.sap.com/docs/';
  const learn = 'https://learning.sap.com/courses/';
  const sources = {
    ...root.WorkHubMmConfigurationData.sources,
    orgImg: [
      'SAP Help · Plant setup and assignments',
      'https://help.sap.com/doc/10fb6f18721645edbb1d7a2ba2494212/2023/en-US/DSC_Edition_cross-solution_guide_v04.pdf',
      'SAP ERP and SAP S/4HANA',
    ],
    orgPublic: [
      'SAP Help · Creating an organizational structure',
      sapHelp +
        'SAP_S4HANA_CLOUD/b249d650b15e4b3d9fc2077ee921abd0/e4f3db048a544f70aff470d4bfa131f5.html',
      'SAP S/4HANA Cloud Public Edition',
    ],
    purchOrg: [
      'SAP Learning · Organizational units in Materials Management',
      learn +
        'cross-functional-customizing-in-sap-s-4hana-materials-management/defining-organizational-units-in-materials-management',
      'SAP S/4HANA',
    ],
    eccPurchOrg: [
      'SAP Help · Purchasing organization',
      sapHelp + 'SAP_ERP/cb7b96d71e9c486e897c8fb57d5669a8/a314c453f57eb44ce10000000a174cb4.html',
      'SAP ERP',
    ],
    materialImg: [
      'SAP Learning · Material master records for purchasing',
      learn + 'purchasing-in-sap-s-4hana/creating-material-master-records-for-purchasing',
      'SAP S/4HANA',
    ],
    materialFields: [
      'SAP Learning · Field selection for material master data',
      learn +
        'exploring-cross-functional-customizing-in-sap-s-4hana-cloud-private-edition/configuring-field-selection-for-material-master-data_d73a44d2-0e7d-41d1-bda0-3e91cd2b3d68',
      'SAP S/4HANA Cloud Private Edition',
    ],
    bp: [
      'SAP Help · Supplier business partner role',
      sapHelp +
        's4hana-best-practices/setting-up-supply-chain-automation-with-sap-business-network-5i2/enable-business-partner',
      'S/4HANA Cloud Public Edition 2608',
    ],
    cvi: [
      'SAP Help · Business Partner approach and Customer/Supplier Integration',
      sapHelp +
        'SAP_S4HANA_ON-PREMISE/7b24a64d9d0941bda1afa753263d9e39/25b46c8241fd4852bf7876d87bed8fd0.html',
      'SAP S/4HANA conversion',
    ],
    cviImg: [
      'SAP Help · Make settings for Customer/Vendor Integration',
      sapHelp +
        'SAP_S4HANA_ON-PREMISE/79781e03a08248de96ff4d84863488ef/5c8189abfed6435b854f6e73cd53f2f4.html',
      'SAP S/4HANA',
    ],
    materialTypeCloud: [
      'SAP Help · Material type configuration activity example',
      sapHelp +
        'SAP_S4HANA_CLOUD/64609d0ecac54654b0837cba34555b82/1397c7536e8e2a4be10000000a174cb4.html',
      'SAP S/4HANA Cloud Public Edition',
    ],
    prTypes: [
      'SAP Help · Document types for purchase requisitions',
      sapHelp +
        'SAP_S4HANA_ON-PREMISE/fe39e10a9a864a8f8dc9537704f0fa13/cfabce5314894208e10000000a174cb4.html',
      'SAP S/4HANA',
    ],
    poTypesCloud: [
      'SAP KBA · Purchase order configuration activities and IDs',
      'https://userapps.support.sap.com/sap/support/knowledge/en/3735134',
      'SAP S/4HANA Cloud Public Edition',
    ],
    infoRecord: [
      'SAP Help · Maintain purchasing info record',
      sapHelp +
        'SAP_S4HANA_ON-PREMISE/8a57feade137489098f59374c06f1e0e/6e07b753128eb44ce10000000a174cb4.html',
      'SAP S/4HANA',
    ],
    quota: [
      'SAP Help · Maintain quota arrangement',
      sapHelp +
        'SAP_S4HANA_ON-PREMISE/8a57feade137489098f59374c06f1e0e/f006b753128eb44ce10000000a174cb4.html',
      'SAP S/4HANA',
    ],
    quotaLogic: [
      'SAP Help · How quota arrangements determine sources',
      sapHelp + 'SAP_ERP/65b1545de4cf409db91e81c6da53db5a/31a0c7536e8e2a4be10000000a174cb4.html',
      'SAP ERP',
    ],
    pricing: [
      'SAP Learning · Purchasing price determination',
      learn + 'purchasing-in-sap-s-4hana/analyzing-price-determination-basics',
      'SAP S/4HANA',
    ],
    classicRelease: [
      'SAP Help · Classic purchasing release procedures',
      sapHelp + 'SUPPORT_CONTENT/spmm/3362167789.html',
      'Classic SAP Purchasing',
    ],
    flexible: [
      'SAP Help · Flexible workflow for purchase orders',
      sapHelp +
        'SAP_S4HANA_ON-PREMISE/af9ef57f504840d2b81be8667206d485/7921e8c7ef4b4722b54b997639a6a0ad.html',
      'SAP S/4HANA on-premise',
    ],
    flexiblePublic: [
      'SAP Help · Configure flexible workflow for purchase order',
      sapHelp +
        's4hana-cloud-best-practices/automation-of-source-to-pay-with-sap-business-network-42k-tr/configure-flexible-workflow-for-purchase-order',
      'SAP S/4HANA Cloud Public Edition',
    ],
    outputImg: [
      'SAP Help · S/4HANA output management IMG example',
      sapHelp +
        'sisgw/sap-ariba-cloud-integration-gateway-configuration-guide/how-to-enable-brfplus-in-sap-s-4hana',
      'SAP S/4HANA on-premise',
    ],
    outputParameters: [
      'SAP Help · Set up output parameter determination',
      sapHelp + 'ariba/f5681fbd739744be88f4f5e8f8a49ead/045036b2603e49c1837fe0d2a82195ed.html',
      'SAP S/4HANA output management',
    ],
    scheduling: [
      'SAP Help · Manage purchase scheduling agreements',
      sapHelp +
        'SAP_S4HANA_ON-PREMISE/af9ef57f504840d2b81be8667206d485/8ae073c0bcd544e8ae1ee973b5181485.html',
      'SAP S/4HANA',
    ],
    assignmentEcc: [
      'SAP Help · Entering account assignments',
      sapHelp +
        'SAP_ERP/967e1c2a6a8c4183b7e07d28e7574445/b47db65334e6b54ce10000000a174cb4-103.html',
      'SAP ERP',
    ],
    assignmentCloud: [
      'SAP Help · Maintain account assignment categories',
      sapHelp +
        's4hana-cloud-best-practices/procurement-for-service-management-3ni-ie/maintain-account-assignment-category-optional',
      'SAP S/4HANA Cloud Public Edition',
    ],
    nonValAsset: [
      'SAP Help · Goods and invoice receipt for an asset',
      sapHelp + 'SAP_ERP/b350210eef6443b6bb3a155840ff905c/113fde531ed3424de10000000a174cb4.html',
      'SAP ERP',
    ],
    movementApps: [
      'SAP Help · Feature comparison for goods movement',
      sapHelp +
        'SAP_S4HANA_ON-PREMISE/91b21005dded4984bcccf4a69ae1300c/de29287f0c0840caacbbc6f79c8d6242.html',
      'SAP S/4HANA',
    ],
    stockReceiptCloud: [
      'SAP Help · Post Goods Receipt for Purchasing Document (F0843)',
      sapHelp +
        'SAP_S4HANA_CLOUD/32da8359c8ee4e8b8e8c5e15cacba5aa/9ddf815494758c4ce10000000a4450e5.html',
      'SAP S/4HANA Cloud Public Edition',
    ],
    invTolerance: [
      'SAP Learning · Physical inventory tolerances',
      learn +
        'exploring-foundations-of-physical-inventory-in-sap-s-4hana-cloud-private-edition/defining-tolerances-and-clearances',
      'SAP S/4HANA Cloud Private Edition',
    ],
    qm: [
      'SAP Help · Inspection for a goods receipt',
      sapHelp +
        'SAP_S4HANA_ON-PREMISE/2bc3ee8d1c83404e8cf62418640004f2/2514c453f57eb44ce10000000a174cb4.html',
      'SAP S/4HANA',
    ],
    ewm: [
      'SAP Help · Inbound delivery and warehouse request',
      sapHelp +
        'SAP_S4HANA_ON-PREMISE/9832125c23154a179bfa1784cdc9577a/38c8cb53ad377114e10000000a174cb4.html',
      'SAP S/4HANA Extended Warehouse Management',
    ],
    split: [
      'SAP Learning · Configuring split valuation',
      learn +
        'inventory-management-and-physical-inventory-in-sap-s-4hana/configuring-split-valuation',
      'SAP S/4HANA',
    ],
    valuationClasses: [
      'SAP Learning · Valuation classes and account category references',
      learn +
        'cross-functional-customizing-in-sap-s-4hana-materials-management/creating-valuation-classes-and-account-category-references',
      'SAP S/4HANA',
    ],
    materialLedger: [
      'SAP Help · Actual Costing and Material Ledger installation',
      sapHelp +
        'SAP_S4HANA_ON-PREMI-SE/af9ef57f504840d2b81be8667206d485/97f1d353ca9f4408e10000000a174cb4.html',
      'SAP S/4HANA',
    ],
    stoConfig: [
      'SAP Help · Stock transport customizing example',
      'https://help.sap.com/doc/4560ca299f7448398f681c4ffe58dbb1/2026/en-US/CPP%28Config%29html5EN.pdf',
      'SAP S/4HANA 2026',
    ],
    invoiceApps: [
      'SAP Help · Supplier Invoice app feature comparison',
      sapHelp +
        'SAP_S4HANA_CLOUD/0e602d466b99490187fcbb30d1dc897c/0bb08d1f74cb44ed807f215496c443a1.html',
      'SAP S/4HANA Cloud Public Edition',
    ],
    invoiceTolerance: [
      'SAP Learning · Invoice tolerance customizing',
      learn +
        'invoice-verification-in-sap-s-4hana/handling-of-variances-without-reference-to-an-item',
      'SAP S/4HANA',
    ],
    invoiceToleranceCloud: [
      'SAP KBA · Invoice tolerance activity 101947',
      'https://userapps.support.sap.com/sap/support/knowledge/en/3052672',
      'SAP S/4HANA Cloud Public Edition',
    ],
    grir: [
      'SAP Learning · GR/IR account maintenance',
      learn + 'invoice-verification-in-sap-s-4hana/performing-gr-ir-account-maintenance',
      'SAP S/4HANA',
    ],
    errorM8147: [
      'SAP KBA · M8 147 account determination',
      'https://userapps.support.sap.com/sap/support/knowledge/en/3742885',
      'SAP ERP and SAP S/4HANA',
    ],
    batchStock: [
      'SAP Help · Working with batches',
      sapHelp + 'SAP_ERP/96bf9ad642cf4b26a29595e3d573fb8c/d664bd534f22b44ce10000000a174cb4.html',
      'ECC 6.0 EHP8',
    ],
    batchClass: [
      'SAP Help · Classification of batches',
      sapHelp + 'SUPPORT_CONTENT/sapclass/3363506314.html',
      'Classic Classification System',
    ],
    batchClassPublic: [
      'SAP Help · Batch classification',
      sapHelp +
        'SAP_S4HANA_CLOUD/32da8359c8ee4e8b8e8c5e15cacba5aa/7e40bd53e3acb64ce10000000a174cb4.html',
      'S/4HANA Cloud Public Edition 2608',
    ],
    classification: [
      'SAP Help · Classification transactions',
      sapHelp + 'SAP_ERP/cf37e689fcbb4b67a4197897e0622b5f/f786c4535cdeb44ce10000000a174cb4.html',
      'SAP ERP',
    ],
    classAssignments: [
      'SAP Help · Assign objects to a class with CL24N',
      sapHelp + 'nullSUPPORT_CONTENT/plm/3363506676.html',
      'Classic Classification System',
    ],
    batchPath: [
      'SAP Help · IMG path for allocating the IM search procedure',
      'https://help.sap.com/doc/63ca0759c6b5450ea8171341a694f865/6.4/en-US/Release_Notes_SAP_AFS_64E.PDF',
      'ECC 6.0 EHP4 example, section 1.8.1.1',
    ],
    batchCheckS4: [
      'SAP Help · Checking manually specified batches',
      sapHelp +
        'SAP_S4HANA_ON-PREMISE/4eb099dbc8a6435c9b36a854a7e05522/22feb753128eb44ce10000000a174cb4.html',
      'S/4HANA 2025 FPS02',
    ],
    batchStrategyEcc: [
      'SAP Help · Inventory management batch search strategies',
      sapHelp + 'SAP_ERP/96bf9ad642cf4b26a29595e3d573fb8c/fa60bd534f22b44ce10000000a174cb4.html',
      'ECC 6.0 EHP8',
    ],
    batchStrategyPublic: [
      'SAP Help · Batch search strategy and configuration activities',
      sapHelp +
        'SAP_S4HANA_CLOUD/2bba750d1e124e1ea2a039bb1cd9b6c5/16feb753128eb44ce10000000a174cb4.html?version=2608.500',
      'S/4HANA Cloud Public Edition 2608',
    ],
    batchActivityId: [
      'SAP KBA · Inventory batch search procedure activity 102148',
      'https://userapps.support.sap.com/sap/support/knowledge/en/3741030',
      'SAP S/4HANA Cloud Public Edition',
    ],
    batchRecordsPublic: [
      'SAP Help · Inventory batch search strategy records',
      sapHelp +
        's4hana-cloud-best-practices/create-batch-management-master-data-mds-2zw/create-batch-search-strategy-records-for-inventory-management',
      'S/4HANA Cloud Public Edition 2608',
    ],
    batchSort: [
      'SAP Help · Batch sort sequences',
      sapHelp +
        'SAP_S4HANA_ON-PREMISE/4eb099dbc8a6435c9b36a854a7e05522/9d6c49f60a1840959a70a852f5db168f.html',
      'SAP S/4HANA',
    ],
    batchTroubleshoot: [
      'SAP Help · Batch determination troubleshooting and transactions',
      sapHelp + 'SUPPORT_CONTENT/batchman/3363505730.html',
      'SAP ERP and SAP S/4HANA guidance',
    ],
    batchAnalysis: [
      'SAP Help · Display batch determination information',
      sapHelp +
        'SAP_S4HANA_CLOUD/32da8359c8ee4e8b8e8c5e15cacba5aa/2bfeb753128eb44ce10000000a174cb4.html',
      'S/4HANA Cloud Public Edition 2608',
    ],
    batchApp: [
      'SAP Help · Manage Batches',
      sapHelp +
        'SAP_S4HANA_CLOUD/32da8359c8ee4e8b8e8c5e15cacba5aa/34b021588aee0a02e10000000a44147b.html',
      'SAP S/4HANA Cloud Public Edition',
    ],
    mrp: [
      'SAP Learning · Procurement type and MRP',
      learn + 'exploring-production-planning-in-sap-s-4hana/understanding-mrp-in-sap-s-4hana',
      'SAP S/4HANA',
    ],
    qmActivation: [
      'SAP Help · Activate inspection types',
      sapHelp +
        'SAP_S4HANA_ON-PREMISE/2bc3ee8d1c83404e8cf62418640004f2/e722bd534f22b44ce10000000a174cb4.html',
      'SAP S/4HANA 2025 FPS01',
    ],
    period: [
      'SAP Help · Product master authorizations and period apps',
      sapHelp +
        'SAP_S4HANA_CLOUD/f86dc2eb1f8b48c880a7607213104b27/44084e4522434d54ae04a6f24ba1b1f5.html',
      'SAP S/4HANA Cloud Public Edition',
    ],
    deliveryCosts: [
      'SAP Learning · Planned and unplanned delivery costs',
      learn + 'invoice-verification-in-sap-s-4hana/entering-delivery-costs-1',
      'SAP S/4HANA',
    ],
    lean: [
      'SAP Help · Manage Service Entry Sheets – Lean Services',
      sapHelp +
        'SAP_S4HANA_CLOUD_PE/af9ef57f504840d2b81be8667206d485/4ac8acf820ad41a8a5841420085ba68d.html',
      'SAP S/4HANA Cloud Private Edition',
    ],
  };

  const img = (path, detail = '', systems = classic) => ({
    editions: systems,
    path: 'SPRO → SAP Reference IMG → ' + path,
    detail,
  });
  const activity = (name, detail = '') => ({
    editions: cloud,
    path: 'SAP Central Business Configuration → Configuration Activities → ' + name,
    detail,
  });
  const tool = (code, name, use, systems = classic) => ({ code, name, use, editions: systems });
  const app = (name, use, code = '') => tool(code, name, use, cloud);
  const mm = 'Materials Management → ';
  const purchasing = mm + 'Purchasing → ';
  const im = mm + 'Inventory Management and Physical Inventory → ';
  const invoiceImg = mm + 'Logistics Invoice Verification → ';
  const val = mm + 'Valuation and Account Assignment → ';
  const batch = 'Logistics – General → Batch Management → ';
  const batchSearch = batch + 'Batch Determination and Batch Check → ';
  const r = {
    plant: img(
      'Enterprise Structure → Definition → Logistics – General → Define, copy, delete, check plant'
    ),
    assignPlant: img(
      'Enterprise Structure → Assignment → Logistics – General → Assign plant to company code'
    ),
    cloudOrg: {
      editions: cloud,
      path: 'SAP Central Business Configuration → Set Up Organizational Structure',
      detail: 'Create or assign the organizational units in the activated scope.',
    },
    storage: img(
      'Enterprise Structure → Definition → Materials Management → Maintain Storage Location'
    ),
    purchOrg: img(
      'Enterprise Structure → Definition → Materials Management → Maintain Purchasing Organization'
    ),
    purchPlant: img(
      'Enterprise Structure → Assignment → Materials Management → Assign purchasing organization to plant'
    ),
    material: img(
      'Logistics – General → Material Master → Basic Settings → Material Types → Define Attributes of Material Types',
      'Shortcut OMS2.'
    ),
    field: img(
      'Logistics – General → Material Master → Field Selection → Maintain Field Selection for Data Screens',
      'Shortcut OMS9.'
    ),
    pr: img(purchasing + 'Purchase Requisition → Define Document Types'),
    po: img(purchasing + 'Purchase Order → Define Document Types'),
    cloudPo: activity('Define Document Types for Purchase Orders', 'Activity 102909.'),
    assign: img(
      purchasing + 'Account Assignment → Maintain Account Assignment Categories',
      'Shortcut OME9.'
    ),
    cloudAssign: activity('Maintain Account Assignment Categories'),
    pricing: img(
      purchasing +
        'Conditions → Define Price Determination Process → Set Calculation Schema – Purchasing',
      'Review the schema determination activities in the same branch.'
    ),
    movement: img(im + 'Movement Types → Copy, Change Movement Types', 'Shortcut OMJJ.'),
    accounts: img(
      val +
        'Account Determination → Account Determination Without Wizard → Configure Automatic Postings',
      'Shortcut OBYC.'
    ),
    cloudAccounts: activity(
      'Automatic Account Determination',
      'Select the valuation and chart-of-accounts context used for the transaction.'
    ),
    valuationClass: img(
      val +
        'Account Determination → Account Determination Without Wizard → Define Valuation Classes',
      'Shortcut OMSK. Maintain the class and its account category reference.'
    ),
    invTolerance: img(
      im + 'Physical Inventory → Define Tolerances for Physical Inventory Differences'
    ),
    split: img(val + 'Split Valuation → Configure Split Valuation', 'Shortcut OMWC.'),
    sto: img(
      purchasing + 'Purchase Order → Set Up Stock Transport Order',
      'Use Define Shipping Data for Plants when the process uses delivery.'
    ),
    tolerance: img(invoiceImg + 'Invoice Block → Set Tolerance Limits', 'Shortcut OMR6.'),
    cloudTolerance: activity('Set Tolerance Limits', 'Activity 101947.'),
    batchLevel: img(
      batch + 'Specify Batch Level and Activate Status Management',
      'Review batch level with OMCT before choosing the batch class type.'
    ),
    batchRules: img(
      batchSearch +
        'Batch Search Procedure Definition → Define Inventory Management Search Procedure'
    ),
    batchAssign: img(
      batchSearch +
        'Batch Search Procedure Allocation and Check Activation → Allocate IM Search Procedure/Activate Check'
    ),
    cloudBatchAssign: activity('Allocate IM Search Procedure/Activate Check', 'Activity 102148.'),
    cloudBatchRules: activity('Define Inventory Management Search Procedure'),
    cloudBatchType: activity('Define Inventory Management Strategy Types'),
    cloudBatchAccess: activity('Define Inventory Management Access Sequences'),
  };
  const t = {
    mm: tool(
      'MM01 / MM02 / MM03',
      'Material master',
      'Create, change or display the material in the required plant and valuation context.'
    ),
    product: app('Manage Product Master Data', 'Maintain the product and its plant-level data.'),
    po: tool(
      'ME21N / ME22N / ME23N',
      'Purchase order',
      'Create, change or display the purchase order and inspect its item details and history.'
    ),
    poPublic: app(
      'Manage Purchase Orders',
      'Open the purchase order and verify the item, delivery, approval and history where available.'
    ),
    pr: tool(
      'ME51N / ME52N / ME53N',
      'Purchase requisition',
      'Create, change or display the requisition and review its document type, items and source.'
    ),
    ir: tool(
      'MIRO / MIR4',
      'Logistics invoice',
      'Enter or display the invoice and review its reference, items and posting results.'
    ),
    irPublic: app(
      'Manage Supplier Invoices',
      'Create or review a supplier invoice in the supported scenario.',
      'F0859'
    ),
    post: tool(
      'MIGO',
      'Goods movement',
      'Select the movement and reference, check the item and review the material document after posting.'
    ),
    postCloud: app(
      'Post Goods Receipt for Purchasing Document',
      'Receive against a PO in scenarios supported by the app.',
      'F0843'
    ),
    stock: tool(
      'MMBE',
      'Stock overview',
      'Check plant, storage location, batch and stock type before or after posting.'
    ),
    class: tool(
      'CL01 / CL02 / CL03',
      'Class',
      'Create, change or display the class, its class type and assigned characteristics.'
    ),
    characteristic: tool(
      'CT04',
      'Characteristics',
      'Maintain the characteristic definition and allowed values where applicable.'
    ),
    batch: tool(
      'MSC1N / MSC2N / MSC3N',
      'Batch master',
      'Create, change or display the batch and check its classification or status.'
    ),
    strategy: tool(
      'MBC1 / MBC2 / MBC3',
      'Inventory management batch search strategy',
      'Create, change or display the strategy record, its validity and selection or sorting criteria.'
    ),
    strategyPublic: app(
      'Manage Search Strategies – Inventory Management',
      'Maintain IM search strategy records for a configured strategy type and key combination.',
      'MBC2'
    ),
  };

  const guides = [];
  function add(id, area, title, purpose, spec) {
    const { routes = [], tools = [] } = spec;
    const supported = [...routes, ...tools].some(entry => entry.editions.includes('cloud'))
      ? all
      : classic;
    guides.push({
      id,
      area,
      title,
      purpose,
      editions: supported,
      terms: [],
      routes,
      tools,
      related: [],
      ...spec,
    });
  }

  add(
    'plant-assignment',
    'structure',
    'Plants and company code assignments',
    'Set up the plant that owns inventory movements and connect it to the company code used for valuation and posting.',
    {
      terms: [
        'enterprise structure',
        'OX10',
        'OX18',
        'valuation area',
        'company code plant assignment',
      ],
      prerequisites: [
        'A company code and the intended valuation level exist. Agree on the plant key, address, country and highest relevant organizational assignments.',
      ],
      routes: [r.plant, r.assignPlant, r.cloudOrg],
      tools: [
        tool(
          'OX10 / OX18',
          'Plant and company code assignment',
          'Open plant definition and confirm its company code assignment.'
        ),
        t.mm,
      ],
      steps: [
        'Define the plant with the intended organizational data.',
        'Assign the plant to its company code and verify the valuation area used by MM.',
        'Extend the material, supplier and purchasing organization to the views or assignments needed for the process.',
      ],
      notes: [
        'The plant on a purchasing item drives the organizational context of receipt. The company code must follow the plant assignment.',
        'A cross-company transfer can have different follow-on documents from a same-company transfer.',
      ],
      test: [
        'Create a test PO for one material in the new plant and inspect the company code and valuation context before receipt.',
        'The selected plant resolves to the intended company code and supports the purchasing organization used.',
      ],
      checks: [
        [
          'Plant does not appear',
          'Check the organizational assignment and user authorization. Verify that the material was extended to the plant.',
        ],
        [
          'Wrong company code appears',
          'Confirm the plant entered on the PO and its assignment before reviewing document type or account determination.',
        ],
      ],
      related: [
        'purchasing-organization',
        'storage-location',
        'valuation-grouping',
        'stock-transport',
      ],
      refs: ['orgImg', 'purchOrg', 'orgPublic'],
    }
  );
  add(
    'purchasing-organization',
    'structure',
    'Purchasing organization and purchasing group',
    'Connect buyers and purchasing organizations to the plants they procure for.',
    {
      terms: [
        'purchasing group buyer',
        'central purchasing',
        'plant-specific purchasing organization',
        'cross company code purchasing',
        'OX08',
        'OME4',
      ],
      prerequisites: [
        'Plant and company-code assignments are available. Decide whether purchasing is plant-specific, centralized within a company code or cross-company.',
      ],
      routes: [r.purchOrg, r.purchPlant, img(purchasing + 'Create Purchasing Groups'), r.cloudOrg],
      tools: [
        t.po,
        tool(
          'OME4',
          'Purchasing groups',
          'Maintain the purchasing group and its buyer contact details.'
        ),
      ],
      steps: [
        'Define or select the purchasing organization and assign its permitted plants.',
        'Use the company-code assignment when your purchasing model requires it.',
        'Maintain purchasing groups and extend the supplier to the purchasing organization used by the document.',
      ],
      notes: [
        'A purchasing group identifies a buyer or group of buyers. The purchasing organization and plant assignments control organizational scope.',
      ],
      test: [
        'Create a purchase order with a valid supplier for the plant and purchasing organization and confirm the buyer is shown.',
        'The order accepts the organizational combination and retrieves the expected supplier purchasing data.',
      ],
      checks: [
        [
          'Supplier is missing purchasing data',
          'Check the purchasing organization on the PO and the supplier extension to that organization.',
        ],
        [
          'Wrong purchasing group defaults',
          'Compare the purchasing view on the material and any defaults from reference documents or user settings.',
        ],
      ],
      related: ['plant-assignment', 'supplier-business-partner', 'po-types'],
      refs: ['purchOrg', 'eccPurchOrg', 'orgPublic'],
    }
  );
  add(
    'storage-location',
    'structure',
    'Storage locations and stock visibility',
    'Define where stock is managed within a plant and use the correct location in receipts, issues and transfers.',
    {
      terms: ['sloc', 's loc', 'storage location', 'OX09', 'stock in wrong location'],
      prerequisites: [
        'The plant is defined. Determine the physical location, stock types and warehouse integration before using the new key.',
      ],
      routes: [r.storage, r.cloudOrg],
      tools: [
        tool(
          'OX09',
          'Storage location',
          'Define or verify the storage-location key within the plant.'
        ),
        t.stock,
        t.post,
      ],
      steps: [
        'Define the location against the intended plant.',
        'Check whether material storage-location data is extended or created at posting in your setup.',
        'For a managed warehouse, check its plant and storage-location assignment and supported receipt path.',
      ],
      notes: [
        'Two plants can use the same four-character storage-location key. Always check plant and location together.',
        'Visible stock in one location may be unavailable to an issue in another location.',
      ],
      test: [
        'Receive test stock into location A and check the stock overview for A and B.',
        'The balance changes in location A and the material document records that location.',
      ],
      checks: [
        [
          'Stock shown in a different location',
          'Review the material document item. Use the appropriate transfer process for a genuine physical transfer.',
        ],
        [
          'Location cannot be selected',
          'Check plant assignment, authorization and, where relevant, warehouse mapping.',
        ],
      ],
      related: ['plant-assignment', 'transfer-postings', 'warehouse-integration'],
      refs: ['orgImg', 'orgPublic', 'slocTwo'],
    }
  );

  add(
    'material-type-updates',
    'master',
    'Material type and quantity/value updating',
    'Choose whether stock quantity and inventory value are managed for the material type in the valuation area.',
    {
      terms: [
        'OMS2',
        'quantity update',
        'value update',
        'UNBW',
        'NLAG',
        'ROH',
        'HALB',
        'FERT',
        'ZCCM',
        'no accounting document',
        'T134M',
      ],
      prerequisites: [
        'Confirm the valuation area and the intended procurement scenario. Check that the relevant material views and allowed valuation classes can be maintained.',
      ],
      routes: [
        r.material,
        activity(
          'Define Attributes of Material Types',
          'Review the controls available for your activated business scope.'
        ),
      ],
      tools: [
        tool(
          'OMS2',
          'Material type attributes',
          'Review Quantity Updating and Value Updating for the material type and valuation area.'
        ),
        t.mm,
        t.product,
      ],
      steps: [
        'Open the material type and choose its quantity/value updating settings.',
        'Check the target valuation area, permitted views and account category reference where valuation applies.',
        'Test with a sample material and review stock quantity, value and document effects separately.',
      ],
      notes: [
        'SAP’s standard UNBW example can manage stock quantity with zero inventory value. NLAG is generally used for direct consumption without stock updates.',
        'The purchase-order GR Non-Valuated indicator is an item-level receipt control. A material type’s value-update flag belongs to material valuation.',
      ],
      test: [
        'Receive the same small quantity for a valuated stock material and a test UNBW material using appropriate orders.',
        'The quantity-managed stock increases for both. Only the valuated stock receipt increases inventory value. Review account assignment and invoice behavior for the UNBW item.',
      ],
      checks: [
        [
          'Accounting view is unavailable',
          'Check material type views and the valuation area, then verify field selection and authorization.',
        ],
        [
          'GR posted without an accounting document',
          'Check whether it is a non-valuated material or item receipt. Verify movement type, PO account assignment and the posting stage before diagnosing OBYC.',
        ],
      ],
      related: [
        'material-master-fields',
        'account-assignment',
        'non-valuated-gr',
        'valuation-classes',
      ],
      refs: ['materialImg', 'materialTypes', 'materialTypeCloud', 'nonstock', 'assignment'],
    }
  );
  add(
    'material-master-fields',
    'master',
    'Material master field selection and views',
    'Control which material fields are mandatory, optional, display-only or hidden for a given maintenance context.',
    {
      editions: classic,
      terms: [
        'OMS9',
        'required field',
        'field status',
        'material master view',
        'hide field',
        'field reference',
      ],
      prerequisites: [
        'Identify the exact material, transaction, view, organizational level and field. Find its field selection group before changing a field reference.',
      ],
      routes: [
        r.field,
        img(
          'Logistics – General → Material Master → Field Selection → Assign Fields to Field Selection Groups'
        ),
      ],
      tools: [
        t.mm,
        tool(
          'OMS9',
          'Material master field selection',
          'Compare the field group across the relevant field references.'
        ),
      ],
      steps: [
        'Locate the field group and the field references applicable to your material type and transaction.',
        'Inspect the combined result before changing field status for a shared group.',
        'Test material creation and change for at least one unaffected material type as well as the target type.',
      ],
      notes: [
        'A field group can contain multiple fields. A single field-status change can have a wider impact than one screen.',
        'Missing material data may come from an unextended view, an organizational level or authorization.',
      ],
      test: [
        'Open a new sample material in the intended material type and plant using the normal maintenance transaction.',
        'The field status matches the intended behavior across create and change for the selected context.',
      ],
      checks: [
        [
          'Field is missing entirely',
          'Check the selected material view, plant or valuation area and whether the material type permits the view.',
        ],
        [
          'Unexpected required field',
          'Review all applicable field references and the table field group, then check enhancements for customer rules.',
        ],
      ],
      related: ['material-type-updates', 'plant-assignment'],
      refs: ['materialFields', 'materialImg'],
    }
  );
  add(
    'supplier-business-partner',
    'master',
    'Supplier and Business Partner setup',
    'Prepare supplier purchasing and company-code data so orders and invoices can select the same trading partner.',
    {
      terms: [
        'vendor master',
        'supplier master',
        'business partner',
        'BP',
        'XK01',
        'MK01',
        'FLVN01',
        'FLVN00',
        'CVI',
      ],
      prerequisites: [
        'Know the target company code and purchasing organization. Maintain grouping and number ranges, required supplier data and legal identifiers according to the business process.',
      ],
      routes: [
        img(
          purchasing + 'Vendor Master → Define Account Groups and Field Selection (Vendor)',
          'Classic supplier master settings.',
          ecc
        ),
        img(
          'Cross-Application Components → Master Data Synchronization → Customer/Vendor Integration → Business Partner Settings → Settings for Vendor Integration',
          'Relevant to Business Partner synchronization and conversion.',
          s4
        ),
      ],
      tools: [
        tool(
          'XK01 / XK02 / XK03',
          'Central vendor master',
          'Maintain the classic vendor across purchasing and company-code segments.',
          ecc
        ),
        tool(
          'BP',
          'Business Partner',
          'Review supplier roles and company-code and purchasing-organization segments.',
          s4
        ),
        app(
          'Maintain Business Partner',
          'Open the supplier role and maintain the organizational data needed by the scenario.'
        ),
      ],
      steps: [
        'Choose the supplier account group or BP grouping and maintain general data.',
        'Extend the purchasing segment for ordering and maintain company-code data needed for invoice and payment.',
        'For a conversion, reconcile CVI mappings and resolve synchronization errors before validating a converted supplier.',
      ],
      notes: [
        'In an S/4HANA BP, FLVN01 supplies the purchasing role and FLVN00 the financial supplier role. Check the actual organizational data within each role.',
        'A supplier can be selectable in a PO while invoice posting needs company-code data or unblocked status.',
      ],
      test: [
        'Create a test PO for the supplier and company-code context, then simulate a supplier invoice.',
        'The purchasing data is available and the invoice finds the supplier’s financial segment.',
      ],
      checks: [
        [
          'Supplier cannot be selected in a PO',
          'Check purchasing organization, supplier role or segment, blocks and authorization.',
        ],
        [
          'Converted supplier has an incomplete BP',
          'Review CVI synchronization messages, grouping/account-group mapping and mandatory fields.',
        ],
      ],
      related: ['purchasing-organization', 'purchasing-info-record', 'invoice-verification'],
      refs: ['bp', 'cvi', 'cviImg', 'po', 'invoice'],
    }
  );
  add(
    'purchasing-info-record',
    'master',
    'Purchasing info records',
    'Maintain supplier-specific procurement data, such as price, planned delivery time and order units for a material.',
    {
      terms: [
        'ME11',
        'ME12',
        'ME13',
        'PIR',
        'info record',
        'vendor price',
        'supplier planned delivery time',
      ],
      prerequisites: [
        'A valid supplier and material or material-group scenario exist. Determine the purchasing organization, optional plant, and procurement category.',
      ],
      routes: [r.pricing],
      tools: [
        tool(
          'ME11 / ME12 / ME13',
          'Purchasing info record',
          'Maintain or display supplier-material purchasing information and conditions.'
        ),
      ],
      steps: [
        'Select the supplier, material, purchasing organization and the info category.',
        'Maintain the organizational data and set price conditions with the relevant currency, price unit and validity.',
        'Confirm the purchasing scope and whether the PO can adopt these records through its source and pricing rules.',
      ],
      notes: [
        'Info record conditions depend on the chosen purchasing organization, plant scope, date and info category. The current PO can carry different conditions.',
        'For consignment, maintain the correct consignment category and price for settlement.',
      ],
      test: [
        'Create a PO item for the same supplier and material on a date inside the condition validity.',
        'Review the net price and Conditions tab to confirm the intended record was picked up.',
      ],
      checks: [
        [
          'Price is blank or stale',
          'Check the pricing date, info category, organizational key, unit and validity before changing the calculation schema.',
        ],
        [
          'Wrong supplier is chosen',
          'Check source list, quota arrangement and fixed-source or contract references.',
        ],
      ],
      related: [
        'supplier-business-partner',
        'source-list-quota',
        'purchasing-pricing',
        'consignment',
      ],
      refs: ['infoRecord', 'pricing', 'consignment'],
    }
  );
  add(
    'source-list-quota',
    'master',
    'Source lists and quota arrangements',
    'Control which sources are eligible for procurement and how demand can be apportioned among them.',
    {
      terms: [
        'ME01',
        'ME03',
        'MEQ1',
        'source determination',
        'fixed supplier',
        'blocked source',
        'quota rating',
        'MRP source list',
      ],
      prerequisites: [
        'Extend the material to the plant and maintain valid supplier, info record or outline agreement sources for the process.',
      ],
      routes: [
        img(
          purchasing + 'Source List → Define Source List Requirement at Plant Level',
          'Check the material-level source list requirement too.'
        ),
      ],
      tools: [
        tool(
          'ME01 / ME03',
          'Source list',
          'Maintain or display valid sources for the material and plant.'
        ),
        tool(
          'MEQ1 / MEQ3',
          'Quota arrangement',
          'Maintain or display the quota validity and allocation data.'
        ),
      ],
      steps: [
        'Check whether the material or plant requires a source list.',
        'Maintain date ranges, fixed or blocked sources and MRP relevance as applicable.',
        'For quota-based selection, maintain quota usage and valid alternatives, then review which source was selected by the specific transaction.',
      ],
      notes: [
        'A source list restricts or prioritizes eligible sources over a date range. A quota arrangement distributes demand among defined sources under the applicable sourcing rules.',
      ],
      test: [
        'Create a test requisition inside the validity period and attempt source determination using the intended plant.',
        'The requisition proposes an eligible source and honors the relevant fixed-source or quota setup.',
      ],
      checks: [
        [
          'No valid source found',
          'Check plant, delivery date, the source-list validity and block indicator, then confirm the contract or info record is usable.',
        ],
        [
          'Quota picks an unexpected source',
          'Check quota usage, quota rating inputs and the sources eligible for that requirement.',
        ],
      ],
      related: ['purchasing-info-record', 'purchase-requisition', 'outline-agreement'],
      refs: ['quotaLogic', 'quota', 'infoRecord', 'purchOrg'],
    }
  );
  add(
    'order-units',
    'master',
    'Order units, price units and conversion',
    'Keep procurement quantities and invoice prices consistent when the supplier orders or prices using a different unit.',
    {
      terms: [
        'UOM',
        'unit of measure',
        'CUNI',
        'order price unit',
        'base unit',
        'alternative units conversion',
        'case pack',
      ],
      prerequisites: [
        'Agree the base stock unit, purchasing unit and supplier price unit. Obtain the actual conversion for the physical pack size.',
      ],
      routes: [
        img(
          'SAP NetWeaver → General Settings → Check Units of Measurement',
          'Use CUNI for unit definitions where available. Maintain product-specific conversions on the material.'
        ),
      ],
      tools: [
        tool('CUNI', 'Units of measurement', 'Review global units and dimension setup.'),
        t.mm,
        t.po,
        t.product,
      ],
      steps: [
        'Verify the unit configuration and material alternative-unit conversion.',
        'Set the purchasing unit and check the PO’s order price unit and conversion.',
        'Verify that receipt quantity in the base unit and invoice amount reflect the actual pack and price units.',
      ],
      notes: [
        'An order unit controls quantity entry. An order price unit controls how the PO price is expressed. Neither alone defines the stock balance unit.',
      ],
      test: [
        'Order two cases of ten each in a sample PO. Enter the receipt in cases and inspect the posted quantity and pricing.',
        'The stock quantity increases by twenty each and the order value follows the maintained price basis.',
      ],
      checks: [
        [
          'Unexpected quantity at GR',
          'Compare the order unit to base-unit conversion on the material and the PO history.',
        ],
        [
          'Unexpected net value',
          'Review price unit, order price unit, conversion and pricing conditions before changing the PO quantity.',
        ],
      ],
      related: ['material-type-updates', 'purchasing-info-record', 'purchasing-pricing'],
      refs: ['materialImg', 'pricing', 'gr'],
    }
  );

  add(
    'purchase-requisition',
    'purchasing',
    'Purchase requisition document types and sourcing',
    'Set the controls for creating a request and converting it into procurement.',
    {
      terms: [
        'PR',
        'ME51N',
        'purchase requisition',
        'document type',
        'NB',
        'item category',
        'source of supply',
      ],
      prerequisites: [
        'The requester knows the material or free-text requirement, quantity, plant and delivery date. Confirm the intended procurement or account assignment scenario.',
      ],
      routes: [r.pr],
      tools: [
        t.pr,
        app(
          'Manage Purchase Requisitions – Professional',
          'Review and maintain requisitions in the supported purchasing scenario.'
        ),
      ],
      steps: [
        'Set the requisition document type, number assignment and permitted item categories for the intended process.',
        'Check document links and the source-determination rules used when the item is converted.',
        'Review the approval process for the document type and whether requisitions created by planning use the same settings.',
      ],
      notes: [
        'The requisition expresses a requirement. Its sourcing and approval can influence whether a follow-on PO can be created.',
        'System-generated requisitions can use a different document type or derivation from the one chosen by a buyer.',
      ],
      test: [
        'Create a material PR with the intended type, assign a valid source, approve it where required, and adopt it into a test PO.',
        'The PR can be selected for conversion and the item copies to the expected purchasing document.',
      ],
      checks: [
        [
          'Requisition is missing from conversion list',
          'Check release status, open quantity, source assignment, plant and relevant buyer selection.',
        ],
        [
          'Item category is rejected',
          'Compare the allowed categories for both the PR and the intended follow-on document.',
        ],
      ],
      related: [
        'po-types',
        'source-list-quota',
        'classic-release',
        'flexible-workflow',
        'mrp-procurement',
      ],
      refs: ['prTypes', 'po', 'classicRelease'],
    }
  );
  add(
    'po-types',
    'purchasing',
    'Purchase order document types and item categories',
    'Choose controls for the order header and the item behavior, such as standard stock, subcontracting, consignment or services.',
    {
      terms: [
        'PO type',
        'NB',
        'UB',
        'document type',
        'item category L K D S U',
        'purchase order field selection',
        'ME21N',
      ],
      prerequisites: [
        'Identify the process and the intended supplier, plant, purchasing organization and required account assignment or product type.',
      ],
      routes: [r.po, r.cloudPo],
      tools: [t.po, t.poPublic],
      steps: [
        'Define the type and review number ranges, field selection and allowed item categories.',
        'Choose the category that supports the intended goods receipt or service entry and invoice behavior.',
        'Test the entire document chain before copying a standard type for a customer scenario.',
      ],
      notes: [
        'Document type governs header controls. Item category influences the processing of each item, including which follow-on actions are allowed.',
        'An account assignment category supplies different controls from the item category. Both can be relevant to one PO item.',
      ],
      test: [
        'Create a standard stock item and the intended special item in orders with the relevant type. Review the delivery and invoice indicators.',
        'Each item supports the expected follow-on document and the PO history reflects the process used.',
      ],
      checks: [
        [
          'Item category unavailable',
          'Check allowed categories for the document type and whether the app and business scope support the scenario.',
        ],
        [
          'Unexpected GR or invoice indicator',
          'Review item category, account assignment category, material settings and the PO item fields.',
        ],
      ],
      related: [
        'purchase-requisition',
        'account-assignment',
        'subcontracting',
        'consignment',
        'lean-services',
        'stock-transport',
      ],
      refs: ['item', 'po', 'stoConfig', 'poTypesCloud'],
    }
  );
  add(
    'account-assignment',
    'purchasing',
    'Account assignment categories and cost objects',
    'Define which cost object is required and the purchasing controls for account-assigned items.',
    {
      terms: [
        'OME9',
        'K cost center',
        'A asset',
        'F order',
        'P project WBS',
        'account assignment G/L',
        'consumption',
        'GR Non-Valuated',
      ],
      prerequisites: [
        'Identify the receiving cost object and ensure FI/CO master data is valid for the company code and date. Check the purchasing item category.',
      ],
      routes: [r.assign, r.cloudAssign],
      tools: [
        tool(
          'OME9',
          'Account assignment categories',
          'Review control and defaults for the account assignment category.'
        ),
        t.po,
        t.poPublic,
      ],
      steps: [
        'Choose the account assignment category for the process.',
        'Review field selection and the delivery and invoice controls, including GR and GR Non-Valuated defaults where applicable.',
        'Enter or verify the cost object and G/L on the purchase order, including split distributions if relevant.',
      ],
      notes: [
        'A direct-consumption item uses a cost object, such as a cost center, asset, order or WBS element. Check the G/L assigned to that PO item.',
        'A plant’s quantity and value settings can affect stock valuation independently of the account assignment category.',
        'For the asset scenario, the accounting result depends on the valuation setting at receipt and whether the item posts to asset accounting at invoice.',
      ],
      test: [
        'Create a PO for a sample cost center or asset and compare a valuated receipt with a permitted non-valuated one.',
        'The account assignment is accepted and the resulting document hits the intended cost object at the expected posting stage.',
      ],
      checks: [
        [
          'Account assignment is rejected',
          'Check the cost object’s validity, company code and status, the G/L field requirements and the relevant item-category combination.',
        ],
        [
          'Wrong expense account is used',
          'Review the PO account assignment and G/L proposal, along with the valuation and account determination applicable to that scenario.',
        ],
      ],
      related: ['po-types', 'non-valuated-gr', 'automatic-postings', 'invoice-verification'],
      refs: ['assignment', 'assignmentEcc', 'assignmentCloud', 'item', 'nonValAsset'],
    }
  );
  add(
    'purchasing-pricing',
    'purchasing',
    'Purchasing price calculation and schema determination',
    'Choose the condition sequence and groups that calculate net price, discounts, surcharges or delivery costs on a purchasing item.',
    {
      terms: [
        'M/08',
        'M08',
        'condition type',
        'access sequence',
        'schema determination',
        'pricing procedure',
        'PB00',
        'condition record',
      ],
      prerequisites: [
        'Know the purchasing organization and supplier schema groups, the required price elements and the source for each condition.',
      ],
      routes: [r.pricing],
      tools: [
        tool(
          'M/08',
          'Purchasing calculation schema',
          'Review the sequence, requirements and calculation rules for the purchasing schema.'
        ),
        t.po,
      ],
      steps: [
        'Define or verify condition types and their access logic.',
        'Maintain the calculation schema in processing order and check account-related keys for conditions that affect postings.',
        'Review schema determination and maintain valid condition or info records for the intended pricing keys.',
      ],
      notes: [
        'Pricing is date- and context-dependent. A valid condition record can lose precedence to another access in the configured sequence.',
        'Use the PO Conditions analysis to check whether the issue comes from the selected schema, a missing record, or a requirement that was not met.',
      ],
      test: [
        'Create a test item with a base price and a discount. Compare the Conditions analysis, price unit, net price and planned costs.',
        'SAP finds the expected condition records and the net value agrees with the configured sequence.',
      ],
      checks: [
        [
          'Condition is missing',
          'Check the actual schema, pricing date, access keys, validity, unit and any requirement assigned at the step.',
        ],
        [
          'Different price appears after copying the item',
          'Review the pricing type used for the copy and compare each condition with the source PO or agreement.',
        ],
      ],
      related: ['purchasing-info-record', 'order-units', 'invoice-variances', 'delivery-costs'],
      refs: ['pricing', 'infoRecord'],
    }
  );
  add(
    'classic-release',
    'purchasing',
    'Classic purchasing release strategy',
    'Use release criteria and approval codes to govern when a requisition or order can proceed.',
    {
      editions: classic,
      terms: [
        'release strategy',
        'release group',
        'release code',
        'release indicator',
        'CEBAN',
        'CEKKO',
        'CT04',
        'CL02',
        'workflow',
      ],
      prerequisites: [
        'Confirm the purchasing document uses the classic release model. Identify the approval criteria, approver codes and characteristics supported by the applicable communication structure.',
      ],
      routes: [
        img(
          purchasing +
            'Purchase Requisition → Release Procedure → Set up Procedure with Classification'
        ),
        img(
          purchasing +
            'Purchase Order → Release Procedure for Purchase Orders → Define Release Procedure'
        ),
      ],
      tools: [
        t.characteristic,
        t.class,
        tool(
          'ME54N / ME29N',
          'Release purchasing document',
          'Release a requisition or order as applicable and check its recorded status.'
        ),
        t.po,
      ],
      steps: [
        'Define characteristics, release class, codes and prerequisites for your document.',
        'Maintain the release strategy conditions and release indicator behavior on changes.',
        'Test values inside and outside the release conditions to confirm successful strategy selection and role assignment.',
      ],
      notes: [
        'Purchase requisition and purchase order classification use different communication structures. Evaluate the actual field values passed for the test document.',
        'Reapproval on change depends on the release indicator and the changed values.',
      ],
      test: [
        'Create two representative documents around a release threshold and inspect their strategies and approval steps.',
        'The qualifying document uses the configured release sequence for its actual classification values.',
      ],
      checks: [
        [
          'Release strategy is missing',
          'Check value ranges, units/currency, document conditions and whether the relevant communication structure field is populated.',
        ],
        [
          'Release button is unavailable',
          'Verify the release code, prerequisite approvals, authorization and current document state.',
        ],
      ],
      related: ['purchase-requisition', 'po-types', 'flexible-workflow', 'class-assignment'],
      refs: ['classicRelease', 'classification', 'flexible'],
    }
  );
  add(
    'flexible-workflow',
    'purchasing',
    'Flexible workflow for purchase orders',
    'Route purchasing approvals using S/4HANA workflow conditions, recipients and step rules.',
    {
      editions: ['s4', 'cloud'],
      terms: [
        'approve purchase order',
        'flexible workflow',
        'approval flow',
        'Manage Workflows for Purchase Orders',
        'My Inbox',
        'restart workflow',
      ],
      prerequisites: [
        'The purchase document type is enabled for the relevant workflow and approvers have the required roles and business assignments.',
      ],
      routes: [
        img(
          purchasing +
            'Purchase Order → Flexible Workflow for Purchase Orders → Activate Flexible Workflow for Purchase Orders',
          'Verify the document type and the workflow setup for your release.',
          s4
        ),
        activity('Activate Flexible Workflow for Purchase Orders'),
      ],
      tools: [
        tool(
          '',
          'Manage Workflows for Purchase Orders',
          'Set the start conditions, priority order and approval steps.',
          ['s4', 'cloud']
        ),
        tool('', 'My Inbox', 'Review the work item and complete it with an assigned approver.', [
          's4',
          'cloud',
        ]),
      ],
      steps: [
        'Activate the workflow in the intended purchasing context.',
        'Maintain rules, step recipients and a suitable fallback in the workflow app.',
        'Create sample orders and check start conditions, recipients and status in the PO.',
      ],
      notes: [
        'Workflow order matters when more than one active definition can match. Test the fallback path as well as the expected path.',
        'An approval may wait because the recipient cannot be determined or the approver lacks access to the work item.',
      ],
      test: [
        'Submit an order that matches an approval threshold and open the work item with the intended approver.',
        'The purchase order moves to the expected status and My Inbox shows the correct step and recipient.',
      ],
      checks: [
        [
          'PO never reaches the workflow',
          'Check document type activation, workflow order and whether any start conditions match.',
        ],
        [
          'No approver receives the item',
          'Check agent determination, responsibility or manager assignments, business roles and workflow log.',
        ],
      ],
      related: ['po-types', 'classic-release'],
      refs: ['flexible', 'flexiblePublic'],
    }
  );
  add(
    'po-output',
    'purchasing',
    'Purchase order output and messages',
    'Determine when an order is sent, which recipient and channel it uses, and which form or template is rendered.',
    {
      terms: [
        'NAST',
        'BRFplus',
        'BRF+',
        'OPD',
        'output parameter determination',
        'message control',
        'MN04',
        'NEU',
        'purchase order print email',
      ],
      prerequisites: [
        'Identify the active output framework for the document and edition. Confirm recipient/contact data, channel and form availability.',
      ],
      routes: [
        img(
          purchasing + 'Messages → Output Control',
          'Classic message control. Verify message type, schema and condition records for the application.',
          ecc
        ),
        img(
          purchasing + 'Messages → Output Control',
          'Use this branch for documents still using classic message control.',
          s4
        ),
      ],
      tools: [
        tool(
          'MN04 / MN05 / MN06',
          'Purchase order output condition records',
          'Create, change or display a classic message condition record.'
        ),
        tool(
          '',
          'Output Parameter Determination',
          'Maintain output rules for the supported PO object and active output framework.',
          ['s4', 'cloud']
        ),
        t.po,
      ],
      steps: [
        'Identify the framework assigned to the document.',
        'Maintain the applicable output rule or condition with the correct partner, channel, timing and template.',
        'Generate and inspect a preview or test output and review its processing log.',
      ],
      notes: [
        'S/4HANA on-premise can use different output frameworks depending on the document and configuration. Check which one your PO actually uses.',
        'A determined output can still fail due to recipient data, an email or spool issue, or a form rendering error.',
      ],
      test: [
        'Generate a test PO for the intended partner and preview the output in the configured channel.',
        'The expected form, language and recipient are selected and the processing status can be explained.',
      ],
      checks: [
        [
          'No output item is determined',
          'Check the active framework, matching settings and whether a release or dispatch condition is unmet.',
        ],
        [
          'Output fails after determination',
          'Review the processing log, recipient address, assigned form, channel and email or spool processing.',
        ],
      ],
      related: ['po-types', 'flexible-workflow', 'supplier-business-partner'],
      refs: ['outputImg', 'outputParameters'],
    }
  );
  add(
    'outline-agreement',
    'purchasing',
    'Contracts and scheduling agreements',
    'Set up a purchasing agreement for repeat procurement and control source selection, dates and consumption.',
    {
      terms: [
        'outline agreement',
        'contract',
        'scheduling agreement',
        'ME31K',
        'ME31L',
        'call-off',
        'target quantity',
        'schedule line',
      ],
      prerequisites: [
        'Agree the supplier, material or service, validity and targets. Verify the purchasing organization and whether a release process applies.',
      ],
      routes: [
        img(purchasing + 'Contract → Define Document Types'),
        img(purchasing + 'Scheduling Agreement → Define Document Types'),
      ],
      tools: [
        tool(
          'ME31K / ME32K',
          'Purchasing contract',
          'Create or change a contract and review its validity and items.'
        ),
        tool(
          'ME31L / ME32L',
          'Purchase scheduling agreement',
          'Create or change the scheduling agreement and its items.'
        ),
        tool(
          '',
          'Manage Purchase Scheduling Agreements',
          'Maintain purchasing scheduling agreements for supported document types.',
          ['s4', 'cloud']
        ),
      ],
      steps: [
        'Choose an agreement type and maintain the relevant validity, quantities or values and terms.',
        'Make it eligible for source determination where required.',
        'Create a test release order or maintain a schedule line and inspect the agreement’s document history.',
      ],
      notes: [
        'A contract is called off through a release order. A scheduling agreement uses schedule lines for delivery quantities and dates.',
        'Target quantities, validity and release requirements may prevent further use of an agreement.',
      ],
      test: [
        'Use a test requirement dated within the agreement validity and verify the order or schedule line references the right agreement item.',
        'The agreement supplies the expected conditions and its history records the consumption or schedule.',
      ],
      checks: [
        [
          'Agreement is not proposed',
          'Check validity, purchasing organization, plant, supplier, source-list status and whether the item is still open.',
        ],
        [
          'Agreement is found with the wrong price',
          'Review its valid conditions and the purchasing framework’s price-date and reference behavior.',
        ],
      ],
      related: ['purchase-requisition', 'source-list-quota', 'purchasing-pricing'],
      refs: ['scheduling', 'pricing', 'quotaLogic'],
    }
  );

  add(
    'batch-master',
    'batch',
    'Batch maintenance and batch master records',
    'Create and maintain batch-level data so receipts, stock visibility and goods issues use the correct batch.',
    {
      terms: [
        'Batch Maintenance',
        'batch master',
        'batch managed material',
        'batch level',
        'batch status',
        'MSC1N',
        'MSC2N',
        'MSC3N',
        'OMCT',
        'batch 022 023',
      ],
      prerequisites: [
        'Decide the batch level and number-assignment policy for the system. The material must be batch-managed for the relevant organizational context.',
      ],
      routes: [
        r.batchLevel,
        img(
          batch + 'Batch Number Assignment → Activate Internal Batch Number Assignment',
          'Check the number range and external assignment policy before testing.'
        ),
      ],
      tools: [
        t.mm,
        t.batch,
        t.stock,
        app('Manage Batches', 'Create or review batch master data in the available scope.'),
        t.product,
      ],
      steps: [
        'Verify the batch level, batch management indicator and number assignment for the material and movement.',
        'Create or open the batch and fill the master data, characteristic values and date fields required by the process.',
        'Use the correct plant, storage location and stock type when receiving or reviewing stock.',
      ],
      notes: [
        'Batch maintenance includes the batch master and its classification values. Stock availability also depends on plant, storage location and stock type.',
        'For class types 022/023, maintain characteristic values through the batch master transaction MSC2N in classic GUI systems.',
        'The batch management flag and the batch master describe different things. Check both before investigating search strategy.',
      ],
      test: [
        'Create or receive one batch-managed material and record its batch number, manufacture or expiration date where relevant, and classification.',
        'The material document references the batch, and its stock can be found in the expected location and stock type.',
      ],
      checks: [
        [
          'Batch field is missing',
          'Check batch management in the material/product and whether the transaction and item support it.',
        ],
        [
          'Batch exists but cannot be issued',
          'Check stock and quantity in the issuing location, applicable batch status and selection criteria, then examine the material movement and strategy.',
        ],
      ],
      related: [
        'batch-classes',
        'batch-procedure-allocation',
        'batch-strategy-records',
        'batch-shelf-life',
      ],
      refs: ['batchClass', 'batchStock', 'batchClassPublic', 'batchApp'],
    }
  );
  add(
    'batch-classes',
    'batch',
    'Batch classes and characteristics',
    'Define the properties, such as quality grade or expiry, that describe batches and can be used in selection.',
    {
      terms: [
        'Class for Batch',
        'batch class',
        'batch classification',
        'classification',
        'class type 022',
        'class type 023',
        'characteristic',
        'CT04',
        'CL02',
        'batch maintenance',
      ],
      prerequisites: [
        'Confirm the batch level for your system and the correct class type. Design characteristic names, data types, allowed values and any standard reference characteristics.',
      ],
      routes: [r.batchLevel],
      tools: [
        t.characteristic,
        t.class,
        t.batch,
        t.mm,
        app(
          'Manage Characteristics',
          'Maintain characteristic definitions and inspect field references.',
          'CT04'
        ),
        app(
          'Manage Class Assignments',
          'Assign the applicable class to the material using the supported classification app.'
        ),
      ],
      steps: [
        'Define the characteristics and create the appropriate class for the batch-managed product.',
        'Assign the class in the applicable material or batch maintenance flow and set the batch’s characteristic values.',
        'If using automatic selection, check which characteristics belong to the strategy selection class.',
      ],
      notes: [
        'Class for batch refers to the class holding the batch characteristics. In classic systems, plant-level batches use class type 022 and material/client-level batches use class type 023.',
        'SAP documents class type 023 for material-level batches in Public Edition.',
        'Use MSC2N for changes to batch characteristic values for batch classes 022/023. Class definitions and object assignments have their own maintenance screens.',
      ],
      test: [
        'Create two batches with different values for one selection characteristic. Review both batches and run a search strategy that requires just one value.',
        'The batch with the matching value qualifies when the other availability and selection criteria are met.',
      ],
      checks: [
        [
          'Characteristic is absent on the batch',
          'Check the material’s class assignment, class type and whether the characteristic belongs to the class.',
        ],
        [
          'Batch values do not match the search',
          'Review the selection class, required values or range and the actual characteristic values of the batch.',
        ],
      ],
      related: ['batch-master', 'class-assignment', 'batch-strategy-records', 'batch-shelf-life'],
      refs: ['batchClass', 'batchClassPublic', 'classification', 'batchStrategyPublic'],
    }
  );
  add(
    'class-assignment',
    'batch',
    'Class assignments and object classification',
    'Use the appropriate object-first or class-first screen to check how a material or other classifiable object is assigned.',
    {
      terms: [
        'classification',
        'CL20N',
        'CL24N',
        'class for batch',
        'object assignments',
        'assign object to class',
        'assign several materials to class',
      ],
      prerequisites: [
        'The class, class type and object exist. Verify the object type supports the intended assignment.',
        'For batch-specific values, identify the individual batch and use the appropriate batch master maintenance.',
      ],
      tools: [
        tool(
          'CL20N',
          'Assign object to class',
          'Start from one supported object and review or maintain its class assignments.'
        ),
        tool(
          'CL24N',
          'Assign objects or classes to class',
          'Start from a class and manage which supported objects are assigned to it.'
        ),
        t.class,
        t.batch,
        app(
          'Manage Class Assignments',
          'Review class assignments in the supported product classification context.'
        ),
      ],
      steps: [
        'Choose a supported class type and decide whether you are starting from the object or the class.',
        'Check existing assignments, then maintain the required assignment in the supported maintenance screen.',
        'For batch classes 022/023, use the batch master to maintain batch characteristic values.',
      ],
      notes: [
        'CL20N starts from the object. CL24N starts from the class and can handle assignments for multiple supported objects.',
        'Batch classes 022/023 have special maintenance rules. To change values on a batch record, use MSC2N in the classic GUI.',
      ],
      test: [
        'For a supported object, display its assignment by object and then confirm the same assignment from the class side.',
        'Both views show the expected object/class relationship for the class type.',
      ],
      checks: [
        [
          'Object cannot be classified in this screen',
          'Verify object type and class type. For a batch or a material master scenario, open the designated master-data maintenance.',
        ],
        [
          'An object is missing from the class',
          'Check the object key, class type, validity or organizational context and whether an assignment actually exists.',
        ],
      ],
      related: ['batch-classes', 'batch-master', 'classic-release'],
      refs: ['classification', 'classAssignments', 'batchClass', 'batchClassPublic'],
    }
  );
  add(
    'batch-condition-access',
    'batch',
    'Batch determination condition tables and access sequences',
    'Choose which business fields form the key and the order SAP uses to look up batch search strategy records.',
    {
      terms: [
        'batch determination',
        'condition technique',
        'batch search access sequence',
        'condition table batch',
        'plant movement type material',
      ],
      prerequisites: [
        'List the business conditions needed for batch selection, such as movement type, plant and material. Confirm the fields are available in the inventory-management context.',
      ],
      routes: [
        img(
          batchSearch + 'Condition Tables',
          'Choose the Inventory Management condition table activities.'
        ),
        img(batchSearch + 'Access Sequences → Define Inventory Management Access Sequences'),
        activity('Create Condition Tables to Determine Batches for Inventory Management'),
        r.cloudBatchAccess,
      ],
      tools: [t.strategy, t.strategyPublic],
      steps: [
        'Select or create the appropriate condition table for the required key fields.',
        'Set the lookup order in an Inventory Management access sequence.',
        'Assign it to the strategy type and create sample strategy records for the intended keys.',
      ],
      notes: [
        'The keys can be specific, such as plant, movement type and material, or broader, depending on the condition table and access sequence.',
        'A valid strategy record can be bypassed when SAP finds another qualifying entry through an earlier access.',
      ],
      test: [
        'Create broad and material-specific records for a test plant and run batch selection for two materials.',
        'The strategy analysis explains which access found the record and why the more specific or general rule was selected.',
      ],
      checks: [
        [
          'The desired key combination does not appear',
          'Check the strategy type, access sequence, condition table and whether the fields are supported for inventory management.',
        ],
        [
          'SAP picks a broad record',
          'Check access order and whether the more specific record matches on all keys and validity.',
        ],
      ],
      related: ['batch-strategy-types', 'batch-strategy-records', 'batch-procedure-allocation'],
      refs: ['batchStrategyPublic', 'batchStrategyEcc', 'batchAnalysis', 'batchPath'],
    }
  );
  add(
    'batch-strategy-types',
    'batch',
    'Inventory batch strategy types and search procedure',
    'Set processing defaults and the order in which SAP tries strategy types for an inventory transaction.',
    {
      terms: [
        'batch determination',
        'inventory management search procedure',
        'strategy type',
        'search sequence',
        'OMCY',
        'batch search procedure',
      ],
      prerequisites: [
        'The condition tables and access sequences for the selection keys are available. Agree the intended default selection and sort rules.',
      ],
      routes: [
        img(batchSearch + 'Strategy Types → Define Inventory Management Strategy Types'),
        r.batchRules,
        r.cloudBatchType,
        r.cloudBatchRules,
      ],
      tools: [
        tool(
          'OMCY',
          'Inventory Management search procedure',
          'Review the strategy types and their sequence in the procedure.'
        ),
        t.strategy,
        t.strategyPublic,
      ],
      steps: [
        'Define or select the strategy type and check the access sequence and selection defaults.',
        'Place the strategy types in the required order in an Inventory Management search procedure.',
        'Allocate the procedure to the movement type and maintain appropriate strategy records.',
      ],
      notes: [
        'The procedure orders strategy types. A valid record for a strategy type provides the criteria for the actual posting.',
        'For a no batch proposed diagnosis, check whether SAP found a strategy before reviewing the availability of matching batches.',
      ],
      test: [
        'Prepare two eligible strategy records in different strategy types for a sample movement.',
        'Strategy analysis shows which strategy type and valid record the procedure selected first.',
      ],
      checks: [
        [
          'No batch proposed',
          'Check whether a search procedure was allocated, the strategy type exists in it, and a matching record can be found.',
        ],
        [
          'Wrong rules run',
          'Check the strategy-type order, access sequence and key values used in the posting.',
        ],
      ],
      related: [
        'batch-condition-access',
        'batch-procedure-allocation',
        'batch-strategy-records',
        'batch-shelf-life',
      ],
      refs: ['batchPath', 'batchStrategyEcc', 'batchStrategyPublic', 'batchAnalysis'],
    }
  );
  add(
    'batch-procedure-allocation',
    'batch',
    'Assign IM batch search procedure to a movement type',
    'Connect inventory batch determination to the movement and control manual batch checks where the process uses them.',
    {
      terms: [
        'batch determination',
        'allocate IM search procedure activate check',
        'assign batch search procedure',
        'OMCG',
        'movement type 201',
        '201',
        'no batch proposed',
        'batch check',
      ],
      prerequisites: [
        'An IM search procedure, relevant strategy record and batch-managed material exist. Prepare eligible stock and record the plant and movement type for the test.',
      ],
      routes: [r.batchAssign, r.cloudBatchAssign],
      tools: [
        tool(
          'OMCG',
          'Allocate IM Search Procedure/Activate Check',
          'Check the search procedure assignment for the movement type and the manual check control.'
        ),
        t.strategy,
        t.strategyPublic,
        t.post,
      ],
      steps: [
        'Identify the exact Inventory Management movement type used by the posting.',
        'Allocate the search procedure and maintain manual batch checking as required by the design.',
        'Run batch determination for a test movement and review which strategy and batches SAP finds.',
      ],
      notes: [
        'Allocation determines which procedure is used, for example for a 201 cost-center issue. Maintain a valid strategy record for the posting context.',
        'The batch check indicator governs checking a manually entered batch in the supported application. Search and manual batch verification serve different steps.',
      ],
      test: [
        'Test a 201 issue for a batch-managed material with matching stock, then test a manually entered nonmatching batch if the check is active.',
        'A qualifying batch can be proposed, and the configured manual check evaluates the specified batch against the criteria.',
      ],
      checks: [
        [
          'No batch proposed',
          'Check actual movement, plant, storage location and stock first. Use strategy analysis to determine whether the procedure or record was found before changing customizing.',
        ],
        [
          'Specific manual batch is rejected',
          'Check the manual batch check setting, class characteristics, criteria and stock eligibility.',
        ],
      ],
      related: ['batch-strategy-types', 'batch-strategy-records', 'batch-master', 'goods-issue'],
      refs: [
        'batchPath',
        'batchCheckS4',
        'batchStrategyEcc',
        'batchStrategyPublic',
        'batchActivityId',
        'batchAnalysis',
        'batchTroubleshoot',
      ],
    }
  );
  add(
    'batch-strategy-records',
    'batch',
    'Maintain inventory batch search strategy records',
    'Maintain the effective selection criteria, validity and sorting for a specific inventory movement.',
    {
      terms: [
        'batch determination',
        'batch search strategy',
        'batch strategy record',
        'batch maintenance',
        'MBC1',
        'MBC2',
        'MBC3',
        'earliest expiry',
        'plant movement type material',
      ],
      prerequisites: [
        'The strategy type, condition key and search procedure are configured. Understand the available class characteristics and which business keys the target movement passes.',
      ],
      routes: [r.batchRules, r.batchAssign, r.cloudBatchRules, r.cloudBatchAssign],
      tools: [t.strategy, t.strategyPublic, t.batch],
      steps: [
        'Open the maintenance transaction, select the strategy type and key combination, then enter the plant, movement type and material as applicable.',
        'Maintain validity, selection characteristic values and the sort sequence. Review quantity and split controls when used.',
        'Test with matching and nonmatching batches. Open strategy analysis to see which record was found.',
      ],
      notes: [
        'The record controls selection for its key and dates. A plant + movement type record can apply broadly, while a material-specific key can narrow it.',
        'Use the sort rule for earliest expiry when the objective is to propose the earliest eligible shelf-life expiration date. Check selection criteria separately for acceptable remaining life.',
      ],
      test: [
        'Create a record for a single test material and plant. Post or simulate a goods issue within the validity period with expected stock available.',
        'The correct record appears in strategy analysis and the eligible batches are proposed in the intended order.',
      ],
      checks: [
        [
          'Strategy is not found',
          'Check strategy type, actual key, validity date, procedure allocation and whether another record takes precedence.',
        ],
        [
          'Strategy is found and no batches are proposed',
          'Check the available quantity, stock type, location, status, class and remaining shelf-life criteria for the batches.',
        ],
      ],
      related: [
        'batch-condition-access',
        'batch-procedure-allocation',
        'batch-classes',
        'batch-shelf-life',
      ],
      refs: ['batchStrategyEcc', 'batchStrategyPublic', 'batchRecordsPublic', 'batchAnalysis'],
    }
  );
  add(
    'batch-shelf-life',
    'batch',
    'Shelf life, earliest expiry and batch sort rules',
    'Control how eligible batches are ranked and verify the expiry data and remaining shelf life used during selection.',
    {
      terms: [
        'earliest expiry',
        'FEFO',
        'shelf life expiration date',
        'SLED',
        'sort rule',
        'sort sequence',
        'CU70',
        'LOBM_RLZ',
        'batch determination',
        'batch maintenance',
      ],
      prerequisites: [
        'The products and batch records have reliable date data. A valid search strategy is available for the intended transaction.',
      ],
      routes: [r.batchRules, r.batchAssign, r.cloudBatchRules],
      tools: [
        tool(
          'CU70 / CU71 / CU72',
          'Sort sequence',
          'Create, change or display a sort sequence for classification-based selection.'
        ),
        t.strategy,
        t.strategyPublic,
        t.batch,
      ],
      steps: [
        'Choose a sort characteristic carrying the required expiry date and set its direction.',
        'Put the rule on the relevant strategy record. Maintain selection criteria for remaining life if the process requires them.',
        'Verify the actual batch’s expiry date, availability and proposed order for the same posting date.',
      ],
      notes: [
        'For earliest expiry, sort by shelf-life expiration date in ascending order among eligible batches.',
        'Selection decides which batches qualify. Sorting orders the batches after they qualify.',
        'Check the source of the actual expiry value before investigating the fallback or sort order.',
      ],
      test: [
        'Create two eligible batches with different shelf-life expiration dates and one with too little remaining life for the scenario.',
        'The earliest eligible expiry is proposed first when sorting is enabled, and the batch outside the selection criteria is excluded.',
      ],
      checks: [
        [
          'Later expiry appears first',
          'Confirm the strategy actually found, sort assignment, sort direction and the date stored on each eligible batch.',
        ],
        [
          'A batch is skipped completely',
          'Check selection criteria, stock type, quantity, status and any remaining shelf-life rule for the posting.',
        ],
      ],
      related: ['batch-master', 'batch-strategy-records', 'batch-classes'],
      refs: [
        'batchSort',
        'batchStrategyPublic',
        'batchClassPublic',
        'batchAnalysis',
        'batchTroubleshoot',
      ],
    }
  );

  add(
    'movement-type',
    'inventory',
    'Movement type controls and reversal settings',
    'Control how an inventory movement updates stock, proposes account grouping and can be reversed.',
    {
      terms: [
        'OMJJ',
        'movement type',
        'movement code',
        'account modifier',
        'reversal movement',
        'special stock',
        'T156',
        'MIGO',
      ],
      prerequisites: [
        'Identify the intended transaction, reference, stock type, special stock and accounting outcome. Start from a standard movement closest to the scenario.',
      ],
      routes: [r.movement],
      tools: [
        tool(
          'OMJJ',
          'Movement type customizing',
          'Review field selection, reversal, account grouping and allowed transaction settings.'
        ),
        t.post,
        t.stock,
      ],
      steps: [
        'Inspect the standard movement and its reversal in the intended scenario.',
        'Compare quantity and value behavior, the stock/reference combination and account grouping before copying a movement type.',
        'Test original and reversal in a non-production system and inspect both material and FI documents.',
      ],
      notes: [
        'A movement type is used together with reference, special stock and other posting context. Review the exact combination when checking account grouping.',
        'Quantity and value behavior also depends on material valuation and the transaction context.',
      ],
      test: [
        'Post a sample movement with a known quantity and then reverse it using the material document reference.',
        'The stock positions reconcile and both documents use the intended movement types and accounting treatment.',
      ],
      checks: [
        [
          'Movement is unavailable',
          'Check the action, reference document, app scope, permitted movement and authorization.',
        ],
        [
          'Unexpected G/L is used',
          'Check the applicable transaction key and general modification, valuation class and chart of accounts.',
        ],
      ],
      related: ['stock-gr', 'goods-issue', 'return-reversal', 'automatic-postings'],
      refs: ['moves', 'moveCodes', 'movementApps', 'keys'],
    }
  );
  add(
    'stock-gr',
    'inventory',
    'Goods receipt against a stock purchase order',
    'Receive a standard PO item into stock and verify the quantity, valuation and purchasing history.',
    {
      terms: [
        'GR',
        'goods receipt',
        'goods receipt with PO',
        '101',
        'MIGO',
        'stock procurement',
        'material document',
        'GR IR',
      ],
      prerequisites: [
        'An open PO item supports goods receipt. Verify approval, plant, storage location, order quantity and any required batch or serial data. Check valuation and open posting period.',
      ],
      routes: [r.po, r.movement, r.accounts, r.cloudAccounts],
      tools: [t.po, t.post, t.postCloud, t.stock],
      steps: [
        'Check the PO’s Delivery and Invoice details and the open quantity.',
        'Post the PO receipt for the correct stock type and review the material document.',
        'For a valuated receipt, open the FI document and compare the inventory and GR/IR entries with the intended settings.',
      ],
      notes: [
        'A normal valuated 101 stock receipt creates a material document and typically an FI posting to stock and GR/IR. Price differences depend on valuation and price control.',
        'Receipt to quality inspection stock and the creation of an inspection lot depend on the quality settings and scenario.',
      ],
      test: [
        'Receive part of an open order for a valuated stock material and review the stock balance, PO history and FI document.',
        'The received quantity appears in the intended stock type and PO history. Inventory value and GR/IR reflect the posting rules.',
      ],
      checks: [
        [
          'Item cannot be received',
          'Check open quantity, delivery controls, release status, posting date, item selection and movement authorization.',
        ],
        [
          'GR posted without an accounting document',
          'Verify whether receipt was non-valuated or posted to non-valuated GR blocked stock, then check material valuation and movement type.',
        ],
      ],
      related: [
        'po-types',
        'non-valuated-gr',
        'gr-blocked-stock',
        'automatic-postings',
        'qm-gr-inspection',
      ],
      refs: ['gr', 'po', 'doc', 'movementApps', 'stockReceiptCloud', 'qm'],
    }
  );
  add(
    'gr-without-po',
    'inventory',
    'Receipts without a purchase order',
    'Choose the appropriate receipt movement when there is no purchase order to reference.',
    {
      terms: [
        'GR without PO',
        'goods receipt without purchase order',
        '501',
        '511',
        '561',
        'free of charge',
        'initial stock',
      ],
      prerequisites: [
        'The physical receipt is approved by the business. Verify the material, plant, storage location, stock type, valuation and required batch or serial data.',
      ],
      routes: [r.movement, r.accounts, r.cloudAccounts],
      tools: [t.post, t.stock, t.mm],
      steps: [
        'Identify whether the receipt is miscellaneous, free-of-charge or a controlled opening balance, and choose the corresponding movement.',
        'Enter the quantity, organizational data and required identifiers.',
        'Check stock and the material and accounting documents to confirm any value and offsetting account.',
      ],
      notes: [
        'Standard classic examples include 501 for a receipt without PO, 511 for a free-of-charge receipt, and 561 for initial stock. The business reason determines which movement fits.',
        'Without a PO, valuation follows the movement and material price rules. A normal PO-history and GR/IR chain is not involved.',
      ],
      test: [
        'Post a permitted miscellaneous receipt for one valuated material without a PO reference.',
        'The material document records the movement and quantity. Review any FI posting against the applicable offsetting rules.',
      ],
      checks: [
        [
          'Posting asks for a missing field',
          'Check movement field selection and required plant, location, valuation type or batch data.',
        ],
        [
          'Financial offset differs from a PO receipt',
          'Check the movement’s offsetting account and valuation rules. Compare the scenario with a 101 PO receipt.',
        ],
      ],
      related: ['movement-type', 'automatic-postings', 'stock-gr'],
      refs: ['noPo', 'noPoAccounting', 'moveCodes'],
    }
  );
  add(
    'non-valuated-gr',
    'inventory',
    'Non-valuated goods receipt for an account-assigned item',
    'Record receipt on the PO while recognizing the expense or asset value at invoice in the applicable scenario.',
    {
      terms: [
        'GR Non-Valuated',
        'non-valuated GR',
        'nonvaluated goods receipt',
        'GR posted without an accounting document',
        'no FI document',
        'direct consumption',
        'OME9',
        'NLAG',
        'UNBW',
        'asset',
      ],
      prerequisites: [
        'The item category and account assignment support goods receipt and the non-valuated option for the scenario. Maintain the cost object and G/L required for invoice posting.',
      ],
      routes: [r.assign, r.cloudAssign, r.po, r.cloudPo],
      tools: [t.po, t.poPublic, t.post, t.ir, t.irPublic],
      steps: [
        'Open the order item and review the Goods Receipt and GR Non-Valuated fields on Delivery, plus the account assignment.',
        'Review account assignment category settings when an indicator defaults, is required or is unavailable.',
        'Post the receipt and then the invoice in the test flow. Inspect FI documents at each step.',
      ],
      notes: [
        'GR posted without an accounting document can be expected when the PO item has a non-valuated goods receipt. The material document or PO history can still evidence receipt.',
        'For a direct-consumption item, validate the cost object and invoice posting. For an asset, check the purchasing and Asset Accounting integration for the selected receipt treatment.',
        'UNBW quantity/value updating is a material-type setting. GR Non-Valuated is a separate purchase-order item control.',
      ],
      test: [
        'Receive an account-assigned PO item with the non-valuated indicator and then enter the supplier invoice.',
        'The GR records the receipt without FI value from that GR. In the supported example, the invoice recognizes the expense or asset and supplier liability.',
      ],
      checks: [
        [
          'GR Non-Valuated is unavailable',
          'Check item and account assignment category, the GR indicator, field control and the selected app’s support.',
        ],
        [
          'Invoice posts to the wrong object',
          'Check PO account assignment, G/L and object validity. Compare the invoice posting rather than the non-valuated GR.',
        ],
      ],
      related: ['account-assignment', 'material-type-updates', 'stock-gr', 'invoice-verification'],
      refs: ['nonValAsset', 'assignment', 'assignmentCloud', 'assignedInvoice', 'nonstock'],
    }
  );
  add(
    'gr-blocked-stock',
    'inventory',
    'Goods receipt blocked stock and release',
    'Record acceptance in stages and choose when the quantity and valuation are recognized.',
    {
      terms: [
        'GR blocked stock',
        'goods receipt blocked stock',
        '103 105',
        '107 109',
        'origin acceptance',
        'valuated GR blocked stock',
        'no accounting document',
      ],
      prerequisites: [
        'The PO remains open and the selected receiving process supports the blocked-stock variant. Agree whether valuation is required at origin acceptance.',
      ],
      routes: [r.po, r.movement, r.accounts, r.cloudAccounts],
      tools: [
        t.post,
        t.po,
        tool(
          'MB5OA',
          'Valuated GR blocked stock',
          'Inspect the balance held in valuated GR blocked stock in supported GUI systems.'
        ),
      ],
      steps: [
        'Choose the approved two-step process and post the correct first movement against the PO.',
        'Review PO history and the appropriate blocked-stock balance after the first movement.',
        'Post the matching release once accepted and compare quantity, value and documents between steps.',
      ],
      notes: [
        '103/105 is the classic non-valuated GR blocked stock process. 107/109 supports valuated GR blocked stock in the relevant procurement scenario.',
        'Check which step first creates a valuation posting. Ordinary blocked stock and GR blocked stock are separate concepts.',
      ],
      test: [
        'For an applicable valuated item, compare a 103/105 receipt with a 107/109 origin-acceptance test.',
        'The posting and value timing match the selected process, and release moves the quantity into the intended stock.',
      ],
      checks: [
        [
          'Release movement will not post',
          'Check the original receipt reference, unreleased quantity, valuation variant and posting period.',
        ],
        [
          'FI document appears at the first step',
          'Check whether the actual posting was a valuated origin-acceptance receipt, such as 107.',
        ],
      ],
      related: ['stock-gr', 'non-valuated-gr', 'return-reversal', 'qm-gr-inspection'],
      refs: ['gr', 'moveCodes', 'doc'],
    }
  );
  add(
    'goods-issue',
    'inventory',
    'Goods issue to a cost center, order, project or asset',
    'Select and verify the consumption movement and accounting object for inventory leaving stock.',
    {
      terms: [
        'GI',
        'goods issue',
        '201',
        '221',
        '241',
        '261',
        'cost center',
        'production order',
        'WBS',
        'asset',
        'stock deficit',
      ],
      prerequisites: [
        'Stock is available in the required location, batch and stock type. Confirm the cost object, reservation or order reference and posting period.',
      ],
      routes: [r.movement, r.accounts, r.cloudAccounts],
      tools: [
        t.post,
        t.stock,
        tool(
          'KSB1',
          'Cost center actual line items',
          'Review cost center impact where the classic CO line-item report is used.'
        ),
      ],
      steps: [
        'Match the goods issue to its destination object and reference.',
        'Check stock type, batch and quantity, then post the issue in the target context.',
        'Inspect the material document and any FI/CO or asset posting to confirm the account and object.',
      ],
      notes: [
        '201 is a standard cost-center issue and 261 is used for a production/order issue in common inventory scenarios. Asset and project issues use their own movement and object requirements.',
        'A valuated issue usually credits inventory and posts the offset to the applicable expense, order or asset. Verify the actual movement and account rule.',
      ],
      test: [
        'Issue available valuated stock to a valid test cost center, then compare with an issue referencing an order.',
        'The quantity decreases and the financial or controlling impact reaches the intended object in each case.',
      ],
      checks: [
        [
          'Deficit or no batch proposed',
          'Check the plant/storage location, batch, available quantity, stock type, reservations and search strategy.',
        ],
        [
          'Cost object unavailable or posting refused',
          'Check the object’s status, dates, account assignment requirements, authorization and FI/MM periods.',
        ],
      ],
      related: [
        'movement-type',
        'batch-procedure-allocation',
        'automatic-postings',
        'production-issue',
      ],
      refs: ['issues', 'asset', 'productionAccounts', 'moveCodes'],
    }
  );
  add(
    'transfer-postings',
    'inventory',
    'Stock transfer and transfer posting',
    'Choose the movement for a change of location, plant, stock type or stock ownership.',
    {
      terms: [
        'transfer posting',
        'stock transfer',
        '311',
        '313',
        '315',
        '301',
        '303',
        '305',
        'quality to unrestricted',
        'stock in transfer',
      ],
      prerequisites: [
        'Identify sending and receiving plants or storage locations, valuation areas, batches, stock types and warehouse assignments.',
      ],
      routes: [r.storage, r.movement, r.accounts],
      tools: [t.post, t.stock],
      steps: [
        'Select one-step or two-step processing to match the actual handover.',
        'Choose the standard movement that fits the stock and location change and post with correct origin and destination.',
        'Reconcile the receiving balance or stock in transfer and review any valuation effect.',
      ],
      notes: [
        '311 is the standard one-step transfer between storage locations in the same plant. In the two-step 313/315 process, follow the removal with the putaway movement.',
        'A plant-to-plant transfer can cross valuation areas and may have an FI effect. A stock-type change may be controlled by QM or warehouse processes.',
      ],
      test: [
        'Move a small quantity between two locations with a two-step flow and check the stock after each step.',
        'The first movement reduces available source stock and shows the transfer quantity. The second completes it into the receiving location.',
      ],
      checks: [
        [
          'Quantity is stuck in transfer',
          'Find the originating document and check whether the receiving movement and location match.',
        ],
        [
          'Posting rejected at destination',
          'Check receiving stock data, batch or valuation type, organization and warehouse integration.',
        ],
      ],
      related: ['storage-location', 'stock-transport', 'movement-type', 'qm-gr-inspection'],
      refs: ['sloc', 'slocTwo', 'plants', 'stockType', 'moveCodes'],
    }
  );
  add(
    'return-reversal',
    'inventory',
    'Returns, cancellations and reversal movements',
    'Choose the right process to correct a posting or physically send received goods back to the supplier.',
    {
      terms: [
        '102',
        '122',
        '161',
        'reverse MIGO',
        'cancel goods receipt',
        'return delivery',
        'returns purchase order',
      ],
      prerequisites: [
        'Identify the original material document, PO history and stock remaining. Review follow-on invoice, QM and warehouse actions before reversing.',
      ],
      routes: [r.movement, r.po],
      tools: [t.post, t.po, t.stock],
      steps: [
        'Identify whether the action corrects a prior posting, returns goods from a previous receipt, or follows a returns PO.',
        'Select the corresponding movement and original reference. Address dependent postings if the process requires reversal in order.',
        'Inspect the original and follow-on document chain and verify stock and value reconcile.',
      ],
      notes: [
        'Common standard mappings include 102 for reversing a 101 receipt, 122 for return delivery, and 161 for a returns PO item. Review the context and actual reversal configuration.',
        'A reversal needs sufficient stock in the required location and stock type even when the original receipt is visible.',
      ],
      test: [
        'Post a test 101 receipt and correct it with a material-document cancellation. Compare the result with a test return delivery.',
        'Stock and PO history reflect the intended correction or physical return. FI and linked documents reconcile for the selected process.',
      ],
      checks: [
        [
          'Original posting cannot be reversed',
          'Check whether stock was consumed or moved, whether follow-on activity exists, and whether the intended MM/FI periods are open.',
        ],
        [
          'Credit memo or return is not linked',
          'Check PO history, returns indicator and the reference used by the follow-on document.',
        ],
      ],
      related: ['stock-gr', 'gr-blocked-stock', 'invoice-verification', 'warehouse-integration'],
      refs: ['returns', 'moveCodes', 'gr'],
    }
  );
  add(
    'physical-inventory',
    'inventory',
    'Physical inventory and difference tolerances',
    'Control how counts are recorded and who can post differences between book and counted stock.',
    {
      terms: [
        'physical inventory',
        'cycle counting',
        'MI01',
        'MI04',
        'MI07',
        '701',
        '702',
        'count difference',
        'tolerance group',
      ],
      prerequisites: [
        'Identify count scope and dates, stock types, material valuation and user tolerance-group assignments. Verify whether the location uses warehouse-managed counting.',
      ],
      routes: [r.invTolerance, img(im + 'Physical Inventory → Assign User to Tolerance Group')],
      tools: [
        tool(
          'MI01 / MI04 / MI07',
          'Inventory count and differences',
          'Create a physical inventory document, enter the count and post differences.'
        ),
        t.stock,
      ],
      steps: [
        'Set the threshold for posting count differences and assign the relevant users.',
        'Create the inventory document and enter a valid recorded count.',
        'Review variances and post or recount according to the tolerance and procedure.',
      ],
      notes: [
        'Tolerance may depend on user group and the value of differences. Count entry and posting the difference are distinct actions.',
        'The stock type and count scope control the relevant difference movement.',
      ],
      test: [
        'Count eight units against a book quantity of ten for a sample unrestricted stock item and review the difference before posting.',
        'The document shows a two-unit difference and posting adjusts stock, with a value effect when applicable.',
      ],
      checks: [
        [
          'User cannot post the difference',
          'Check count status, tolerance group, authorization, inventory and posting periods, and whether the difference exceeds allowed values.',
        ],
        [
          'Difference changes unexpectedly',
          'Review intervening movements and whether book inventory was frozen or a posting block was active in the chosen process.',
        ],
      ],
      related: ['movement-type', 'automatic-postings', 'warehouse-integration'],
      refs: ['inventory', 'invTolerance', 'moveCodes'],
    }
  );

  add(
    'valuation-grouping',
    'valuation',
    'Valuation area, valuation grouping and chart of accounts',
    'Determine which organizational settings an inventory posting uses when selecting G/L accounts.',
    {
      terms: [
        'OX14',
        'OMWD',
        'valuation grouping code',
        'valuation modifier',
        'valuation area plant',
        'chart of accounts',
        'T001K',
        'T030',
      ],
      prerequisites: [
        'Confirm the plant, company code, chart of accounts and valuation level for the deployment. Identify whether grouped account determination is in use.',
      ],
      routes: [
        img(
          'Enterprise Structure → Definition → Logistics – General → Define Valuation Level',
          'Review the established valuation level as part of system design.'
        ),
        img(
          val +
            'Account Determination → Account Determination Without Wizard → Group Together Valuation Areas',
          'Shortcut OMWD.'
        ),
        r.cloudAccounts,
      ],
      tools: [
        tool(
          'OMWD',
          'Valuation area grouping',
          'Confirm the valuation area and grouping code used for account determination.'
        ),
        tool(
          'OBYC',
          'Automatic postings',
          'Compare account entries for the chart and valuation grouping.'
        ),
        t.mm,
      ],
      steps: [
        'Resolve the test plant to its valuation area and company code.',
        'Identify the chart of accounts and valuation grouping used by the posting rule.',
        'Use these actual values when verifying the account record for the movement or invoice.',
      ],
      notes: [
        'Plant, valuation area and company code are related organizational keys. Confirm the design before changing an account determination entry.',
        'A valuation grouping code lets several areas use the same determination entries when the rule uses that grouping.',
      ],
      test: [
        'Compare equivalent stock receipts for two sample plants. Resolve the context used by each before checking the FI documents.',
        'Similar plants use the intended shared accounts or distinct G/L accounts according to their design.',
      ],
      checks: [
        [
          'One plant works and the other fails',
          'Compare plant assignments, chart of accounts, grouping code and whether the relevant posting rule has an account for both.',
        ],
        [
          'Accounts appear under the wrong chart',
          'Check the company code reached by the valuation area before copying an account entry.',
        ],
      ],
      related: ['plant-assignment', 'valuation-classes', 'automatic-postings'],
      refs: ['orgImg', 'accounting', 'keys', 'publicConfig'],
    }
  );
  add(
    'valuation-classes',
    'valuation',
    'Valuation classes and account category references',
    'Control which valuation classes a material type can use and which class the material actually supplies to account determination.',
    {
      terms: [
        'OMSK',
        'OMS2',
        'valuation class',
        'account category reference',
        'ACR',
        'material accounting view',
        'MBEW',
      ],
      prerequisites: [
        'Know the intended material type and valuation area. Check the account category reference, inventory G/L design and whether split valuation is active.',
      ],
      routes: [r.valuationClass, r.material, r.accounts, r.cloudAccounts],
      tools: [
        tool(
          'OMSK / OMS2',
          'Valuation classes and material type',
          'Assign classes to the account category reference and check which reference the material type uses.'
        ),
        t.mm,
      ],
      steps: [
        'Define or review the valuation class and permitted account category reference.',
        'Confirm the material type uses the intended reference and maintain the actual valuation class on the material.',
        'Check the relevant transaction key in automatic account determination and test the receipt and issue.',
      ],
      notes: [
        'The account category reference permits choices. The valuation class on the material accounting data supplies the actual value for a posting rule that uses it.',
        'A split-valuated material can use a valuation class for the relevant valuation type.',
      ],
      test: [
        'Compare two materials with different valuation classes in the same valuation area and perform the same valuated receipt.',
        'Where the transaction key is configured by valuation class, each material selects its intended inventory account.',
      ],
      checks: [
        [
          'Valuation class is unavailable',
          'Check the account category reference for the material type and the relevant valuation views and valuation type.',
        ],
        [
          'An existing material cannot change its class',
          'Check current stock and relevant open documents or postings, and review the conditions for changing valuation data.',
        ],
      ],
      related: ['material-type-updates', 'automatic-postings', 'split-valuation'],
      refs: ['valuationClasses', 'materialTypes', 'accounting', 'keys'],
    }
  );
  add(
    'automatic-postings',
    'valuation',
    'Automatic account determination and OBYC',
    'Translate an MM posting’s transaction keys and valuation context into the correct G/L lines.',
    {
      terms: [
        'OBYC',
        'BSX',
        'WRX',
        'GBB',
        'PRD',
        'account determination',
        'automatic postings',
        'configure automatic postings',
        'G/L',
        'M8147',
        'M8 147',
        'account determination for entry not possible',
        'T030',
      ],
      prerequisites: [
        'The material valuation, chart of accounts, plant/valuation area and intended movement or invoice scenario are known. Obtain the transaction key and other fields from the actual posting or error.',
      ],
      routes: [r.accounts, r.cloudAccounts, r.valuationClass],
      tools: [
        tool(
          'OBYC',
          'Configure automatic postings',
          'Maintain the G/L account for the transaction key and its configured rule fields.'
        ),
        tool(
          'FS00',
          'G/L account',
          'Verify the account exists in the chart and company code with the appropriate controls.'
        ),
        t.post,
        t.ir,
      ],
      steps: [
        'Identify the posting event and transaction keys, such as BSX for stock, WRX for GR/IR, GBB for an inventory offset, and PRD for price differences where used.',
        'Read the key’s rule and use the actual chart, valuation grouping, class and general modification where the rule calls for them.',
        'Check the mapped G/L and test with a representative movement or invoice. Compare the resulting lines with the expected scenario.',
      ],
      notes: [
        'M8 147 means account determination for the shown entry is missing or cannot be resolved. Read the reported key and values before maintaining a mapping.',
        'WRX and the other keys can use different rule fields. Check each key’s rule in the relevant configuration.',
        'For a PO item with direct account assignment, check the item’s G/L and cost object as part of diagnosing the posting.',
      ],
      test: [
        'Post a standard valuated stock receipt and an inventory issue in a test system, then review the resulting FI lines.',
        'The receipt uses the expected stock and GR/IR entries. The issue uses the intended stock and applicable offsetting account.',
      ],
      checks: [
        [
          'M8 147 or account determination for entry not possible',
          'Record the full entry from the message. Resolve the plant, chart, key, grouping, valuation class and modifier from the real context and check the exact rule combination.',
        ],
        [
          'The account is found but FI rejects the posting',
          'Check G/L company-code data, field status, allowable account assignment and posting periods.',
        ],
      ],
      related: [
        'valuation-grouping',
        'valuation-classes',
        'account-modifiers',
        'account-assignment',
        'stock-gr',
      ],
      refs: ['accounting', 'keys', 'modifiers', 'publicConfig', 'errorM8147'],
    }
  );
  add(
    'account-modifiers',
    'valuation',
    'Movement account modifiers for GBB and related offsets',
    'Separate different inventory offsets so consumption, count differences and opening balances reach the appropriate G/L accounts.',
    {
      terms: [
        'account modifier',
        'account grouping',
        'general modification',
        'GBB',
        'VBR',
        'INV',
        'BSA',
        'OMJJ',
        'OMWB',
        'OBYC',
      ],
      prerequisites: [
        'Identify the exact movement and reference, special-stock and value context. Verify the post’s valuation class and organizational settings.',
      ],
      routes: [r.movement, r.accounts, r.cloudAccounts],
      tools: [
        tool(
          'OMJJ / OBYC',
          'Movement account grouping and G/L assignment',
          'Trace the movement’s account grouping into the actual account entry.'
        ),
        t.post,
      ],
      steps: [
        'Look up the movement’s account grouping for the applicable posting context.',
        'In automatic postings, open GBB or the relevant key and confirm the configured modifier and valuation conditions.',
        'Post a test issue or difference and review the offset in the FI document.',
      ],
      notes: [
        'Examples of standard GBB modifiers include VBR for internal consumption, INV for physical inventory differences and BSA for initial stock balance postings. Verify the actual movement configuration.',
        'The modifier refines the transaction key. The posting still needs the account assignment and rule inputs required by that key.',
      ],
      test: [
        'Compare a cost-center issue with a count difference for the same valuated material.',
        'Each movement can select a different offset account from its configured modifier, even with the same valuation class.',
      ],
      checks: [
        [
          'Several movements use the same wrong account',
          'Check whether they share a modifier or the same account entry under the rule. Compare representative actual documents.',
        ],
        [
          'New movement does not use expected modifier',
          'Check the copied movement’s account grouping for actual stock and reference, and verify the test is using that movement.',
        ],
      ],
      related: ['automatic-postings', 'movement-type', 'goods-issue', 'physical-inventory'],
      refs: ['gbb', 'modifiers', 'keys', 'moves'],
    }
  );
  add(
    'price-control',
    'valuation',
    'Standard price, moving average price and price differences',
    'Understand whether a receipt or invoice changes inventory value at standard cost or updates the moving price in the supported scenario.',
    {
      terms: [
        'price control S V',
        'standard price',
        'moving average price',
        'MAP',
        'PRD',
        'stock coverage',
        'MR21',
        'invoice variance',
      ],
      prerequisites: [
        'Check the material accounting view, price control, price unit, current stock and valuation type. Know the PO and invoice prices.',
      ],
      routes: [r.material, r.accounts, r.cloudAccounts],
      tools: [
        t.mm,
        t.product,
        tool(
          'MR21',
          'Change material price',
          'Review the controlled price-maintenance function where appropriate in your release.'
        ),
        t.po,
        t.ir,
      ],
      steps: [
        'Identify the material’s price control and unit of valuation.',
        'Compare actual PO or invoice values with the material price and current stock position.',
        'Review inventory value and price-difference postings at receipt and at invoice.',
      ],
      notes: [
        'With standard price, inventory is normally valued at the standard amount and differences can go to price difference accounts. With moving average, relevant transaction differences may affect stock value and the moving price.',
        'Stock coverage, timing and valuation context influence how an invoice difference is distributed.',
      ],
      test: [
        'Use equivalent S and V test materials and receive against a PO price that differs from the current material price.',
        'The FI and stock-value outcomes show the different pricing behavior. Confirm the price difference accounts and inventory value for each.',
      ],
      checks: [
        [
          'Moving price looks unexpectedly high or low',
          'Review the price unit, receipt and invoice history, stock coverage, negative-stock conditions if used and recent revaluations.',
        ],
        [
          'Expected variance is missing',
          'Check posted valuation, the applicable transaction key, currency and the actual document price.',
        ],
      ],
      related: ['valuation-classes', 'automatic-postings', 'invoice-variances', 'material-ledger'],
      refs: ['price', 'variances', 'keys', 'accounting'],
    }
  );
  add(
    'split-valuation',
    'valuation',
    'Split valuation categories and valuation types',
    'Allow the same material to carry separate values for distinct stocks such as origin or procurement type.',
    {
      terms: [
        'OMWC',
        'split valuation',
        'valuation category',
        'valuation type',
        'BWTAR',
        'different prices same material',
      ],
      prerequisites: [
        'Choose the business split and use a material suitable for testing. Check stock and open documents before changing valuation structure for an existing material.',
      ],
      routes: [r.split, r.valuationClass],
      tools: [
        tool(
          'OMWC',
          'Configure split valuation',
          'Check global and local categories and which valuation types are enabled for the valuation area.'
        ),
        t.mm,
        t.post,
      ],
      steps: [
        'Define the category and types, then make the required types available in the valuation area.',
        'Maintain the material’s valuation-category header and the accounting data for each relevant type.',
        'Enter or verify the valuation type on the receipt and review the quantity and value at that level.',
      ],
      notes: [
        'A valuation category describes the split criterion. The valuation type identifies the part of stock selected in the posting.',
        'Split valuation and batch management can interact in some scenarios. Verify the stock’s valuation type and batch independently when diagnosing postings.',
      ],
      test: [
        'Receive two quantities for the same material into different valuation types with distinct prices.',
        'The material’s valuation shows both stocks and their separate values. The posting selects the expected valuation type.',
      ],
      checks: [
        [
          'Valuation type is missing or invalid',
          'Check the material’s category, local valuation settings, valuation-type accounting record and entries on the source document.',
        ],
        [
          'FI posts using the wrong valuation class',
          'Check the class for the actual valuation type and the posting rule inputs.',
        ],
      ],
      related: ['valuation-classes', 'price-control', 'stock-gr', 'batch-master'],
      refs: ['split', 'valuationClasses', 'price'],
    }
  );
  add(
    'material-ledger',
    'valuation',
    'Material Ledger and actual costing',
    'Review the valuation currencies and ledger setup used by materials, and the optional closing process for actual costing.',
    {
      editions: classic,
      terms: [
        'Material Ledger',
        'actual costing',
        'CKM3N',
        'CKMLCP',
        'valuation currency',
        'periodic unit price',
        'CKMSTART',
      ],
      prerequisites: [
        'Agree the currency and valuation approaches with FI/CO, confirm valuation areas and establish whether actual costing is required. Check migration or productive-start status.',
      ],
      routes: [
        img(
          'Controlling → Product Cost Controlling → Actual Costing/Material Ledger → Basic Settings',
          'Use the SAP installation guidance for your release and conversion status.'
        ),
      ],
      tools: [
        tool(
          'CKM3N',
          'Material price analysis',
          'Inspect the material’s quantities, values and differences where supported.'
        ),
        tool(
          'CKMLCP',
          'Actual costing run',
          'Review the configured costing and closing flow for actual costing when active.'
        ),
      ],
      steps: [
        'Review the existing valuation-area activation and currency/valuation settings for the installation.',
        'Decide where actual costing is in scope and maintain its settings with the costing team.',
        'Test procurement and period-end reconciliation in the configured ledgers. Use the release-specific installation process for productive changes.',
      ],
      notes: [
        'Material Ledger is mandatory in S/4HANA. Actual costing is optional and has its own activation and period-end procedures.',
        'In ECC, verify whether Material Ledger is active for the valuation area before drawing conclusions from the price analysis tools.',
      ],
      test: [
        'Post a test receipt and invoice variance and inspect the material price analysis for the relevant currencies.',
        'The postings reconcile to the expected valuation and ledger amounts. If actual costing is active, verify its closing workflow for the test period.',
      ],
      checks: [
        [
          'Material price analysis lacks expected data',
          'Check period, valuation area, activation, currency and actual costing scope.',
        ],
        [
          'Closing differs between two plants',
          'Compare ledger activation and startup, costing settings, price-control and period status for both plants.',
        ],
      ],
      related: ['valuation-grouping', 'price-control', 'invoice-variances'],
      refs: ['materialLedger', 'price', 'variances'],
    }
  );

  add(
    'subcontracting',
    'special',
    'Subcontracting and components provided to supplier',
    'Order an assembly from a supplier while controlling the components supplied and consumed for it.',
    {
      terms: [
        'subcontract',
        'subcontracting',
        'item category L',
        '541',
        '543',
        'supplier special stock O',
        'components BOM',
      ],
      prerequisites: [
        'The supplier, assembly material and components are available. Maintain the component list or BOM and check the supply plant and planned quantities.',
      ],
      routes: [r.po, r.movement, r.accounts, r.cloudAccounts],
      tools: [t.po, t.poPublic, t.post, t.stock],
      steps: [
        'Create the subcontracting item and verify the supplied components on the PO.',
        'Provide stock to the supplier using the intended movement and verify the supplier special stock.',
        'Receive the assembly and compare the component consumption with the expected quantities. Adjust differences using the appropriate follow-up procedure.',
      ],
      notes: [
        'In the standard pattern, 541 provides components to the supplier and the subcontracting GR posts component consumption with 543. Check the actual posting history.',
        'Review components and finished material as separate lines when confirming valuation. The subcontracting price covers the processing agreed with the supplier.',
      ],
      test: [
        'Supply two components, receive one subcontracted assembly and inspect the material document and supplier stock.',
        'The assembly receipt and component consumption are recorded together according to the maintained component requirements.',
      ],
      checks: [
        [
          'GR fails on component shortage',
          'Check the component list, required quantities, supplier special stock, plant, unit and actual batch.',
        ],
        [
          'Wrong components are consumed',
          'Compare the PO’s component items and dates with the intended BOM and the quantities recorded at receipt.',
        ],
      ],
      related: ['po-types', 'movement-type', 'stock-gr', 'automatic-postings'],
      refs: ['sub', 'subReceipt', 'item', 'moveCodes'],
    }
  );
  add(
    'consignment',
    'special',
    'Supplier consignment, withdrawals and settlement',
    'Manage stock owned by a supplier and recognize settlement-relevant value when it is withdrawn or taken into own stock.',
    {
      terms: [
        'consignment',
        'K item category',
        'K special stock',
        '411 K',
        'MRKO',
        'supplier owned stock',
      ],
      prerequisites: [
        'Maintain the consignment supplier/material relationship and valid price in the correct purchasing and plant scope. Verify the financial design for settlement.',
      ],
      routes: [r.po, r.movement, r.accounts, r.cloudAccounts],
      tools: [
        t.po,
        tool(
          'ME11 / ME12',
          'Consignment info record',
          'Maintain the supplier’s consignment price and validity for the correct key.'
        ),
        t.post,
        tool(
          'MRKO',
          'Settle consignment and pipeline liabilities',
          'Review and settle qualifying withdrawals for the supplier.'
        ),
      ],
      steps: [
        'Create the consignment PO and receive into supplier-owned special stock.',
        'Withdraw or transfer consignment stock using the supported movement and supplier context.',
        'Check the liability from the withdrawal and run the applicable settlement process.',
      ],
      notes: [
        'A standard receipt into supplier consignment updates the supplier-owned stock balance. Settlement is normally driven by eligible withdrawals or transfers to own stock.',
        'Keep separate track of the consignment item category and the special stock indicator even when both are shown as K.',
      ],
      test: [
        'Receive ten units into consignment stock and transfer two to own stock with the supported process.',
        'Supplier-owned stock decreases by two, own stock increases, and the transfer is available for applicable settlement.',
      ],
      checks: [
        [
          'Withdrawal has no valid price',
          'Check the info record category, supplier, plant, currency, unit and price validity.',
        ],
        [
          'Settlement shows no items',
          'Check whether the withdrawals qualify, their posting or settlement dates and whether they were already settled.',
        ],
      ],
      related: ['purchasing-info-record', 'transfer-postings', 'automatic-postings'],
      refs: ['consignment', 'consignmentOwn', 'item'],
    }
  );
  add(
    'stock-transport',
    'special',
    'Stock transport orders within or across company codes',
    'Plan and track transfers using a purchase order, with delivery and billing when the chosen scenario requires them.',
    {
      terms: [
        'STO',
        'stock transport order',
        'intercompany stock transfer',
        'intracompany stock transfer',
        'UB',
        '351',
        '641',
        '643',
        'stock in transit',
      ],
      prerequisites: [
        'Supplying and receiving plants are set up. For delivery and intercompany scenarios, check shipping data, business partner relationships and sales/plant assignments as applicable.',
      ],
      routes: [r.sto, r.po],
      tools: [
        t.po,
        t.poPublic,
        t.post,
        tool(
          'VL10B',
          'Purchasing documents due for delivery',
          'Review STOs for delivery creation in a supported delivery scenario.'
        ),
      ],
      steps: [
        'Select the approved stock transfer scenario and document type for the supplying and receiving plants.',
        'Maintain shipping and partner settings when the STO generates a delivery.',
        'Post goods issue and receiving GR and check in-transit quantities, history and any billing or FI documents.',
      ],
      notes: [
        'An STO can use different issue movements for transfer with or without delivery. Check the actual plant and document setup before expecting a particular movement.',
        'Intercompany transfers can involve pricing, delivery and billing in addition to the receiving PO and GR.',
      ],
      test: [
        'Create a representative STO, issue a partial quantity, then receive it at the destination plant.',
        'The document flow and in-transit quantity reconcile. In a billing scenario, the expected intercompany documents are available.',
      ],
      checks: [
        [
          'Delivery is not created for the STO',
          'Check shipping data for both plants, document and item settings, sourcing, due dates and delivery relevance.',
        ],
        [
          'Receiving GR cannot find the quantity',
          'Check goods issue status, reference, plant and whether the receiving process uses a delivery or the PO.',
        ],
      ],
      related: ['plant-assignment', 'transfer-postings', 'po-types', 'warehouse-integration'],
      refs: ['sto', 'stoBilling', 'stoConfig', 'moveCodes'],
    }
  );
  add(
    'classic-services',
    'special',
    'Classic external services and service entry sheets',
    'Record services under a classic service PO and use acceptance as the basis for downstream processing.',
    {
      editions: classic,
      terms: [
        'classic services',
        'external services',
        'ML81N',
        'item category D',
        'service acceptance',
        'service entry sheet',
      ],
      prerequisites: [
        'Prepare the service specifications or limits, supplier and account assignments. Verify PO service item settings and who accepts the work.',
      ],
      routes: [r.po, r.assign, img(mm + 'External Services Management → Service Entry Sheet')],
      tools: [
        t.po,
        tool(
          'ML81N',
          'Service entry and acceptance',
          'Maintain and review the service entry sheet for a supported classic service order.'
        ),
        t.ir,
      ],
      steps: [
        'Create the classic service item with the applicable account assignment, service details or limits.',
        'Record the performed services and have the entry accepted in the appropriate workflow.',
        'Review the purchasing history and invoice eligibility after acceptance.',
      ],
      notes: [
        'Service entry and acceptance document the work performed. Review the PO’s receipt and invoice settings for the accounting and follow-on treatment.',
        'Services and service limits have their own value/quantity checks. Confirm the performed line and contract before changing approval settings.',
      ],
      test: [
        'Enter an agreed portion of a sample service order, accept the sheet and simulate the associated invoice.',
        'The accepted quantity or value is visible in PO history and the eligible amount can be referenced at invoicing.',
      ],
      checks: [
        [
          'Service entry fails a limit check',
          'Compare the entered lines, PO services and the remaining limits or quantities before checking configuration.',
        ],
        [
          'Invoice cannot reference accepted service',
          'Check acceptance and release status, GR-based invoice settings, item selection and PO history.',
        ],
      ],
      related: ['account-assignment', 'lean-services', 'invoice-verification'],
      refs: ['classicService', 'item', 'assignment', 'assignedInvoice'],
    }
  );
  add(
    'lean-services',
    'special',
    'Lean services in S/4HANA',
    'Procure a service product, record its delivery, and approve the service entry sheet using the S/4HANA apps.',
    {
      editions: ['s4', 'cloud'],
      terms: [
        'lean services',
        'Manage Service Entry Sheets',
        'service product',
        'product type group service',
        'Fiori service entry sheet',
      ],
      prerequisites: [
        'The lean service process is supported in your release and scope. Prepare the service product or free-text service PO and the appropriate account assignment.',
      ],
      routes: [
        img(
          purchasing + 'Purchase Order → Define Document Types',
          'Check the scope and item support for the lean service process.',
          s4
        ),
      ],
      tools: [
        tool(
          '',
          'Manage Purchase Orders',
          'Prepare a supported service item for the planned work.',
          ['s4', 'cloud']
        ),
        tool(
          '',
          'Manage Service Entry Sheets – Lean Services',
          'Record performed services against the PO and submit or review acceptance.',
          ['s4', 'cloud']
        ),
        t.irPublic,
      ],
      steps: [
        'Create a supported lean service PO with the relevant service type, quantities or limits and account assignment.',
        'Enter the performed work in the lean service entry app and complete approval as configured.',
        'Check PO history and invoice eligibility for the accepted service.',
      ],
      notes: [
        'Lean services use their own entry-sheet app and process scope. Check the PO item and supported business scenario for the S/4HANA release.',
      ],
      test: [
        'Create and approve a lean service entry against a sample service PO and inspect the follow-on history.',
        'The accepted entry is available for the applicable invoice process and the PO shows the recorded service.',
      ],
      checks: [
        [
          'PO item is absent from service entry app',
          'Check service scope, PO approval, remaining amount and whether the item is supported by the lean service app.',
        ],
        [
          'Submitted sheet remains pending',
          'Review workflow status, recipient determination and any missing role, acceptance or accounting data.',
        ],
      ],
      related: [
        'classic-services',
        'account-assignment',
        'flexible-workflow',
        'invoice-verification',
      ],
      refs: ['lean', 'service', 'assignment'],
    }
  );
  add(
    'supplier-to-customer',
    'special',
    'Third-party procurement and sales order flow',
    'Source a customer requirement from a supplier that delivers directly to the customer.',
    {
      terms: [
        'third party procurement',
        'direct delivery to customer',
        'SD MM integration',
        'third-party order',
        'item category S',
      ],
      prerequisites: [
        'Check sales item and schedule-line determination, the supplier and customer addresses and the process-specific purchasing and invoicing rules.',
      ],
      routes: [r.pr, r.po],
      tools: [
        tool(
          'VA03',
          'Display sales order',
          'Trace the source sales item and its linked purchasing requirement.'
        ),
        t.pr,
        t.po,
        t.ir,
      ],
      steps: [
        'Confirm the sales item and schedule line generate the intended purchasing document.',
        'Convert the linked requirement to a supplier order and verify the ship-to address.',
        'Track the supplier confirmation, invoice and any relevant sales billing state through the document flow.',
      ],
      notes: [
        'Third-party processing can result in the supplier shipping directly to the customer. Follow the configured receipt and billing basis for that sales scenario.',
      ],
      test: [
        'Create a representative sales order for a third-party item and trace its requisition, PO and invoice flow.',
        'The purchasing document carries the intended sales reference and ship-to data, with follow-on status matching the scenario.',
      ],
      checks: [
        [
          'Sales order does not create a PR',
          'Check sales item and schedule-line category and the actual procurement setup on the item.',
        ],
        [
          'Supplier or billing status is unexpected',
          'Review source selection and document flow, and confirm receiving and billing rules for the exact scenario.',
        ],
      ],
      related: ['purchase-requisition', 'po-types', 'invoice-verification'],
      refs: ['thirdParty', 'item', 'po'],
    }
  );
  add(
    'pipeline',
    'special',
    'Pipeline withdrawal and supplier settlement',
    'Post consumption from a supplier pipeline and settle usage under the relevant purchasing and accounting rules.',
    {
      terms: [
        'pipeline procurement',
        'pipeline material',
        'special stock P',
        'pipeline info record',
        'MRKO',
      ],
      prerequisites: [
        'Confirm the material and supplier pipeline setup, source and price validity. Agree how consumption is measured and charged.',
      ],
      routes: [r.material, r.movement, r.accounts],
      tools: [
        t.mm,
        tool(
          'ME11 / ME12',
          'Pipeline purchasing info record',
          'Maintain the pipeline supplier, unit and price used for settlement.'
        ),
        t.post,
        tool('MRKO', 'Pipeline settlement', 'Review and settle eligible pipeline withdrawals.'),
      ],
      steps: [
        'Check pipeline-relevant material data and valid source and price.',
        'Post the actual withdrawal to the appropriate cost object using the supported movement.',
        'Verify the expense or liability and select the eligible withdrawals in settlement.',
      ],
      notes: [
        'Pipeline procurement is designed around withdrawals and settlement. Validate the pricing unit used by the supplier and the quantity measured by the business.',
      ],
      test: [
        'Post a small test withdrawal from a configured source to a cost center.',
        'The correct consumption and supplier liability are shown and the item is eligible for the configured settlement.',
      ],
      checks: [
        [
          'Supplier or price cannot be determined',
          'Check the pipeline source and the info record’s scope, validity and price unit.',
        ],
        [
          'Withdrawal does not appear for settlement',
          'Check the special-stock context, supplier, posting dates and settlement status.',
        ],
      ],
      related: ['consignment', 'purchasing-info-record', 'goods-issue', 'automatic-postings'],
      refs: ['pipeline', 'consignment', 'infoRecord'],
    }
  );

  add(
    'invoice-verification',
    'invoice',
    'Logistics invoice verification and GR-based IV',
    'Match supplier invoices to purchasing documents and, where required, to specific goods receipts or accepted services.',
    {
      terms: [
        'MIRO',
        'MIR4',
        'invoice receipt',
        'IR',
        'GR-based IV',
        'invoice before GR',
        'GR IR',
        'supplier invoice',
        'F0859',
      ],
      prerequisites: [
        'The supplier has the required company-code data. Check reference PO, invoice-receipt flag, tax, accepted quantity and the GR-based invoice indicator.',
      ],
      routes: [r.assign, r.tolerance, r.accounts, r.cloudAccounts],
      tools: [t.ir, t.irPublic, t.po, t.poPublic],
      steps: [
        'Review the PO history, receipt reference and GR-based invoice setting before entering the invoice.',
        'Enter the invoice with the correct reference and compare quantity, price, tax and account assignment.',
        'Simulate or review the accounting outcome and check posting and payment-block status after entry.',
      ],
      notes: [
        'GR-based invoice verification refers the invoice item to an individual receipt. Check the item’s invoice settings and receipt history when a reference is unavailable.',
        'Whether an invoice can precede goods receipt depends on the PO item’s matching settings and the applicable business controls.',
        'A non-valuated GR can record receipt, with the expense or asset posting occurring at invoice for the applicable account-assigned scenario.',
      ],
      test: [
        'Receive half of a sample GR-based PO and enter an invoice referencing the accepted quantity.',
        'The invoice matches the relevant receipt and produces the expected accounting and PO history entries.',
      ],
      checks: [
        [
          'Invoice cannot find the receipt',
          'Check GR-Based IV, PO item and GR reference, history and whether the quantity was already invoiced.',
        ],
        [
          'Invoice posts to an unexpected account or object',
          'Review valuation, GR treatment, PO account assignment, transaction key and the actual invoice lines.',
        ],
      ],
      related: ['stock-gr', 'non-valuated-gr', 'invoice-variances', 'gr-ir-clearing'],
      refs: ['grBased', 'invoice', 'invoiceApps', 'assignedInvoice'],
    }
  );
  add(
    'invoice-variances',
    'invoice',
    'Invoice tolerances, price and quantity blocks',
    'Control when a difference can be posted and when a supplier invoice needs a payment-block review.',
    {
      terms: [
        'OMR6',
        'MRBR',
        'invoice blocked',
        'payment block',
        'price variance',
        'quantity variance',
        'PP tolerance',
        'DQ tolerance',
        'duplicate invoice',
      ],
      prerequisites: [
        'Review the company code, matching bases, expected tolerance limits and roles for invoice review and release.',
      ],
      routes: [r.tolerance, r.cloudTolerance, r.accounts, r.cloudAccounts],
      tools: [
        tool(
          'OMR6',
          'Set tolerance limits',
          'Review the threshold and whether it is active for the applicable tolerance key and company code.'
        ),
        t.ir,
        tool(
          'MRBR',
          'Release Blocked Invoices',
          'Review the reason for blocking and process eligible releases.',
          all
        ),
        t.irPublic,
      ],
      steps: [
        'Identify the actual variance category and its company-code tolerance key.',
        'Compare invoice, order and receipt quantities or prices and the relevant units and currency.',
        'Resolve the discrepancy and verify the block status before following the authorized invoice-release process.',
      ],
      notes: [
        'An invoice can be posted with a payment block. A posting error and a payment block call for different checks.',
        'Price-control and stock coverage affect value postings. Invoice tolerance controls review and blocking behavior.',
      ],
      test: [
        'Enter two sample invoices with variances on either side of the applicable threshold and inspect the messages and payment status.',
        'The configured tolerances produce the expected acceptance or block for the actual variance calculation.',
      ],
      checks: [
        [
          'Invoice blocked unexpectedly',
          'Review the block reasons, tolerance key, PO history, price unit and delivered versus invoiced amount.',
        ],
        [
          'Release does not remove the block',
          'Check whether the discrepancy still exists, whether multiple reasons apply and whether the releasing user has the relevant role.',
        ],
      ],
      related: ['invoice-verification', 'price-control', 'delivery-costs', 'posting-periods'],
      refs: ['invoiceTolerance', 'invoiceToleranceCloud', 'tolerance', 'invoiceApps', 'variances'],
    }
  );
  add(
    'gr-ir-clearing',
    'invoice',
    'GR/IR clearing and open items',
    'Use the receipt and invoice history to explain a residual GR/IR balance and choose the correct reconciliation action.',
    {
      terms: [
        'GR IR',
        'GR/IR',
        'WRX',
        'MR11',
        'clearing account',
        'open GRIR balance',
        'invoice receipt variance',
      ],
      prerequisites: [
        'Collect the PO history and related receipt/invoice lines, account assignment and currency. Confirm whether another receipt, invoice or return is expected.',
      ],
      routes: [r.accounts, r.cloudAccounts],
      tools: [
        t.po,
        t.ir,
        tool(
          'MR11',
          'GR/IR account maintenance',
          'Review and clear eligible final differences when the business process is complete.'
        ),
      ],
      steps: [
        'Reconcile quantities and values by PO item and identify the unmatched receipt, invoice or correction.',
        'Correct a missing or incorrect business document using the supported process.',
        'Use account maintenance for reviewed, final eligible differences and reconcile the resulting FI entries.',
      ],
      notes: [
        'An open GR/IR balance can be expected while a receipt or invoice is still outstanding. Read the PO history before interpreting the clearing balance.',
        'Planned delivery costs can create a separate clearing discrepancy when posted quantities differ.',
      ],
      test: [
        'Receive ten units for a sample order and invoice only six. Trace the four-unit difference through purchasing history and the clearing account.',
        'The residual is explainable and can be cleared by the remaining business posting or the applicable final reconciliation process.',
      ],
      checks: [
        [
          'WRX balance remains after invoice',
          'Compare missing receipts/invoices, returns, quantities, currency, valuation and clearing lines for the same PO item.',
        ],
        [
          'Account maintenance item is absent',
          'Check selection, company code, open quantities and the applicable agreement or clearing conditions.',
        ],
      ],
      related: [
        'automatic-postings',
        'invoice-verification',
        'delivery-costs',
        'invoice-cancellation',
      ],
      refs: ['grir', 'invoice', 'keys'],
    }
  );
  add(
    'delivery-costs',
    'invoice',
    'Planned and unplanned delivery costs',
    'Control how freight or other delivery charges are captured and posted in purchasing and invoice verification.',
    {
      terms: [
        'freight',
        'planned delivery costs',
        'unplanned delivery costs',
        'delivery costs invoice',
        'pricing condition',
        'invoice overhead cost',
      ],
      prerequisites: [
        'Agree whether the cost is known at PO creation, its supplier and currency, and whether it should flow to inventory, consumption or a separate account.',
      ],
      routes: [
        r.pricing,
        r.accounts,
        r.cloudAccounts,
        img(
          invoiceImg + 'Incoming Invoice',
          'Review the treatment configured for unplanned delivery costs.'
        ),
      ],
      tools: [t.po, t.ir, t.irPublic],
      steps: [
        'For planned charges, maintain the relevant condition on the PO and check its processing and account settings.',
        'Enter applicable planned or unplanned costs in the invoice and review how the amounts are allocated.',
        'Compare the clearing, inventory or expense lines against the agreed design.',
      ],
      notes: [
        'Planned delivery costs are included through purchasing conditions. Unplanned delivery costs are entered at invoicing and can be distributed or posted separately depending on configuration.',
      ],
      test: [
        'Compare a sample PO with planned freight and an invoice with an additional unplanned charge.',
        'The posted freight and additional charge can each be traced to the expected condition, allocation or G/L.',
      ],
      checks: [
        [
          'Freight is missing from the invoice selection',
          'Check PO conditions, supplier assignment and receipt or invoice reference for the planned cost.',
        ],
        [
          'Charge goes to the wrong account',
          'Review the pricing/account settings and the treatment of unplanned costs for the company code.',
        ],
      ],
      related: ['purchasing-pricing', 'invoice-verification', 'gr-ir-clearing'],
      refs: ['deliveryCosts', 'pricing', 'grir'],
    }
  );
  add(
    'invoice-cancellation',
    'invoice',
    'Invoice cancellation, credit memos and corrections',
    'Choose the right way to reverse an incorrect invoice or record a supplier credit while preserving the purchasing history.',
    {
      terms: [
        'MR8M',
        'cancel invoice',
        'reversal invoice',
        'credit memo',
        'supplier credit',
        'invoice correction',
      ],
      prerequisites: [
        'Find the original invoice, fiscal year and related PO and receipt history. Check clearing/payment status and the open reversal period.',
      ],
      routes: [r.tolerance, r.accounts, r.cloudAccounts],
      tools: [
        tool(
          'MR8M',
          'Cancel invoice document',
          'Reverse an eligible logistics invoice using the original document reference.'
        ),
        t.ir,
        t.irPublic,
        t.po,
      ],
      steps: [
        'Determine whether the business action is cancellation or a supplier credit/adjustment.',
        'Use the documented process, specify the original reference and choose the correct reversal or credit date.',
        'Verify the linked invoice and FI documents and reconcile updated PO history and clearing.',
      ],
      notes: [
        'A cancellation creates a reversal for the original invoice. A business credit memo records a supplier credit against the relevant purchasing context.',
        'Payments or clearing can influence the correction sequence. Check the FI status and intended reconciliation before processing.',
      ],
      test: [
        'Reverse an eligible sample posted invoice and review the original, reversal and PO history.',
        'The documents reconcile in the intended period and preserve the original posting reference.',
      ],
      checks: [
        [
          'Cancellation unavailable',
          'Verify invoice type, document and fiscal year, status, reversal date and user authorization.',
        ],
        [
          'GR/IR remains open after correction',
          'Compare original and reversal postings and the quantity still received or invoiced on the PO item.',
        ],
      ],
      related: ['invoice-verification', 'return-reversal', 'gr-ir-clearing', 'posting-periods'],
      refs: ['cancelInvoice', 'invoiceApps', 'grir'],
    }
  );

  add(
    'qm-gr-inspection',
    'integration',
    'Quality inspection at goods receipt',
    'Route a qualifying purchase receipt to quality inspection and use its inspection lot to control stock release.',
    {
      terms: [
        'QM integration',
        'inspection type 01',
        'inspection lot',
        'quality inspection stock',
        'QA32',
        'QA11',
        'usage decision',
      ],
      prerequisites: [
        'Maintain the required inspection setup on the material for the plant and the intended receipt scenario. Check whether inspection stock should be used and whether an inspection plan or other QM data is required.',
      ],
      routes: [
        r.movement,
        img(
          'Quality Management → Quality Inspection → Inspection Lot Creation',
          'Choose the inspection-type and origin settings relevant to the receipt.'
        ),
      ],
      tools: [
        t.mm,
        t.product,
        t.post,
        t.postCloud,
        tool(
          'QA32 / QA11',
          'Inspection lot and usage decision',
          'Find the lot and review or record the usage decision in the supported process.'
        ),
      ],
      steps: [
        'Check the inspection type and stock-posting setup for the material and plant.',
        'Post a test purchase receipt and link the inspection lot to the material document.',
        'Record the results and usage decision, then verify the intended stock posting.',
      ],
      notes: [
        'A GR inspection lot depends on active inspection data and the posting context. When QM controls inspection stock, use the appropriate usage decision process to release it.',
        'An inspection lot can be created with different stock relevance depending on the receipt and setup.',
      ],
      test: [
        'Receive a sample inspection-relevant material and process its lot through the agreed usage decision.',
        'The inspection lot is created for the receipt and stock moves according to the intended decision and stock-posting rules.',
      ],
      checks: [
        [
          'No inspection lot is created',
          'Check material QM view, plant, active inspection type, stock type, movement and any controls for the PO receipt.',
        ],
        [
          'Stock stays in quality inspection',
          'Check lot status, results and usage decision including the stock posting quantities.',
        ],
      ],
      related: ['stock-gr', 'gr-blocked-stock', 'batch-classes', 'transfer-postings'],
      refs: ['qm', 'qmActivation', 'gr'],
    }
  );
  add(
    'mrp-procurement',
    'integration',
    'MRP inputs for external procurement',
    'Generate purchasing requirements from planning and make the intended external source available for conversion.',
    {
      terms: [
        'MRP',
        'procurement type F',
        'special procurement',
        'MRP Live',
        'MD01N',
        'MD04',
        'planning purchase requisition',
        'lot size',
      ],
      prerequisites: [
        'The material has the appropriate plant MRP data, demand or reorder signal, lead times and available source records. Confirm whether planning should generate a requisition or another proposal.',
      ],
      routes: [
        img(
          'Production → Material Requirements Planning → Master Data → Check MRP Types',
          'Also review relevant plant and special procurement settings.'
        ),
        r.pr,
      ],
      tools: [
        t.mm,
        t.product,
        tool(
          'MD04',
          'Stock/requirements list',
          'Review demand, receipts and planned procurement proposals for the material.'
        ),
        tool(
          'MD01N',
          'MRP Live',
          'Run planning in a supported S/4HANA system and review its logs.',
          s4
        ),
      ],
      steps: [
        'Maintain the appropriate MRP type, procurement type, lot-sizing and scheduling parameters on the material.',
        'Prepare an eligible source and run planning under the correct settings and scope.',
        'Review the generated proposal and date in the stock/requirements list, then test conversion.',
      ],
      notes: [
        'Procurement type F is used for external procurement. Exact proposal creation also depends on MRP settings and the planning run.',
        'A planning result can be influenced by existing stock, receipts, firmed proposals, lot sizing and planning horizon.',
      ],
      test: [
        'Create a test shortage for an externally procured material with a known source and run planning.',
        'Review the quantity, date and source of the resulting purchasing proposal and confirm it can be used.',
      ],
      checks: [
        [
          'No requisition is generated',
          'Check shortage, MRP type, planning scope, procurement type and whether SAP created a planned order or used an existing receipt.',
        ],
        [
          'Wrong source appears after planning',
          'Check source eligibility, special procurement, source list and quota settings for the relevant plant and date.',
        ],
      ],
      related: ['purchase-requisition', 'source-list-quota', 'plant-assignment'],
      refs: ['mrp', 'prTypes', 'quotaLogic'],
    }
  );
  add(
    'production-issue',
    'integration',
    'Production reservations, backflush and component issues',
    'Link component consumption and batch selection to a production or process order.',
    {
      terms: [
        'PP MM integration',
        '261 262',
        'production order',
        'reservation',
        'backflush',
        'CO03',
        'CO11N',
      ],
      prerequisites: [
        'The order is released and its components, storage location and reservation quantities are known. Check stock and batch availability and whether backflush applies.',
      ],
      routes: [r.movement, r.batchAssign, r.accounts, r.cloudAccounts],
      tools: [
        tool(
          'CO03',
          'Display production order',
          'Review components, reservations and order status.'
        ),
        tool(
          'CO11N',
          'Production order confirmation',
          'Check goods movements proposed or posted by confirmation where applicable.'
        ),
        t.post,
        t.stock,
      ],
      steps: [
        'Verify the components and reservation before consumption.',
        'Post or confirm the intended issue and review which movement, batch and storage location were used.',
        'Compare the stock and actual costs and review any failed or reprocessed goods movements.',
      ],
      notes: [
        '261 is the common standard order issue and 262 its reversal. An automatic issue can come from confirmation/backflush with a different selection context from a manual IM issue.',
        'Check the batch determination setup for the application that triggered the proposal.',
      ],
      test: [
        'Issue or backflush a known test quantity against a production order and review the linked material document.',
        'The component stock decreases and the consumption attaches to the intended order in the configured workflow.',
      ],
      checks: [
        [
          'Backflush fails after confirmation',
          'Review the goods-movement error, available component stock, batch, location and reservation or order status.',
        ],
        [
          'An unexpected batch was consumed',
          'Identify where the determination ran and check the corresponding production, IM or warehouse search strategy.',
        ],
      ],
      related: ['goods-issue', 'batch-procedure-allocation', 'movement-type', 'automatic-postings'],
      refs: ['production', 'productionAccounts', 'issues', 'batchStrategyPublic'],
    }
  );
  add(
    'warehouse-integration',
    'integration',
    'Warehouse integration for MM receipts and issues',
    'Trace when a movement is processed directly in inventory management and when delivery and warehouse follow-on steps apply.',
    {
      terms: [
        'WM',
        'EWM',
        'warehouse management',
        'inbound delivery',
        'warehouse task',
        'putaway',
        'warehouse queue',
        'plant storage location mapping',
      ],
      prerequisites: [
        'Know the warehouse model and whether it is embedded or decentralized. Verify plant/storage-location mapping, product data and delivery or warehouse process settings.',
      ],
      routes: [
        r.storage,
        img(
          'Extended Warehouse Management → Cross-Process Settings → Warehouse Task → Define Warehouse Process Type',
          'Use the relevant embedded or decentralized EWM scope.',
          s4
        ),
      ],
      tools: [
        t.po,
        t.post,
        tool(
          '/SCWM/MON',
          'Warehouse Management Monitor',
          'Review deliveries, warehouse tasks and relevant warehouses in a supported EWM system.',
          s4
        ),
      ],
      steps: [
        'Check the material, plant and location against the warehouse assignment.',
        'Use the applicable inbound or outbound reference and trace it from ERP into the warehouse flow.',
        'Confirm the warehouse action and compare delivery status, posting and resulting inventory.',
      ],
      notes: [
        'In EWM, an inbound delivery can create a warehouse request and lead to a warehouse task. Review the document flow and posting status to identify where processing stopped.',
        'Classic WM, embedded EWM and decentralized EWM use their own document and configuration scope. Start with the active warehouse model.',
      ],
      test: [
        'Receive a test delivery for a warehouse-managed location and trace its warehouse request, task and stock update.',
        'The documents reconcile between ERP/MM and the warehouse and the stock shows in the intended location and status.',
      ],
      checks: [
        [
          'No warehouse task created',
          'Review delivery status, warehouse process type, product data and location mapping. Check for communication issues where the flow spans systems.',
        ],
        [
          'Inventory and warehouse quantities differ',
          'Inspect warehouse and ERP posting statuses, open tasks, failed messages and actual stock type and unit.',
        ],
      ],
      related: ['storage-location', 'stock-gr', 'stock-transport', 'return-reversal'],
      refs: ['ewm', 'gr', 'stoConfig'],
    }
  );
  add(
    'posting-periods',
    'integration',
    'MM and FI posting periods and authorization checks',
    'Validate posting dates, open periods, permissions and object status before treating a rejected movement or invoice as a configuration issue.',
    {
      terms: [
        'posting only possible in periods',
        'posting period',
        'MMPV',
        'MMRV',
        'OB52',
        'SU53',
        'FI period',
        'MM period',
        'authorization',
      ],
      prerequisites: [
        'Capture the full SAP message, transaction or app, posting date, company code, plant, document and user context.',
      ],
      routes: [
        img(
          'Financial Accounting → Financial Accounting Global Settings → Ledgers → Fiscal Year and Posting Periods',
          'Review the applicable posting period variant and account controls for the release.'
        ),
      ],
      tools: [
        tool(
          'MMRV',
          'Allow posting to previous period',
          'Review current and previous material periods and the authorized previous-period setting.'
        ),
        tool(
          'MMPV',
          'Close material period',
          'Use the material period closing process under your period-end controls.'
        ),
        tool(
          'OB52',
          'FI posting periods',
          'Review the posting period variant and the relevant account type or range.'
        ),
        tool(
          'SU53',
          'Authorization check',
          'Review the last failed authorization check after reproducing the action in the GUI.'
        ),
      ],
      steps: [
        'Compare document date and posting date, then determine which company code and valuation area the posting uses.',
        'Verify the MM material period and any FI posting periods relevant to a financial document.',
        'If periods are open, review authorization, document and cost-object status and the business message details.',
      ],
      notes: [
        'MM and FI period controls can both matter when an inventory or invoice posting creates an accounting document.',
        'Authorization, locks, document status or an expired cost object can explain a failure even when the customizing values match the design.',
      ],
      test: [
        'In a test system compare a posting dated within the approved open period and the same posting dated outside it.',
        'The open-date posting reaches the usual validation steps. The closed-date posting identifies the period control that needs review.',
      ],
      checks: [
        [
          'Only one user receives the error',
          'Compare the exact action, organizational context and roles. Review the failed authorization check immediately after reproducing it.',
        ],
        [
          'Movement works for one date and fails for another',
          'Verify MM and FI period controls, posting date and cost-object validity for both dates.',
        ],
      ],
      related: ['stock-gr', 'goods-issue', 'invoice-verification', 'automatic-postings'],
      refs: ['period', 'doc', 'invoiceApps'],
    }
  );

  root.WorkHubMmKnowledgeData = Object.freeze({ editions, areas, sources, guides });
})(typeof window === 'undefined' ? globalThis : window);
