/** SAP table and CDS reference metadata. Only personal entries and annotations are saved. */
(function (root) {
  'use strict';

  const systems = {
    ecc: 'ECC',
    s4: 'S/4HANA On-Premise / Private Edition',
    public: 'S/4HANA Cloud Public Edition',
  };
  const modules = {
    MM: 'Materials Management',
    FI: 'Financial Accounting',
    CO: 'Controlling',
    BP: 'Business Partner',
    SD: 'Sales & Distribution',
    PP: 'Production Planning',
    QM: 'Quality Management',
    WM: 'Warehouse Management',
    EWM: 'Extended Warehouse Management',
    PS: 'Project System',
  };
  const sap = 'https://help.sap.com/';
  const community = 'https://community.sap.com/t5/';
  const cloud = sap + 'docs/SAP_S4HANA_CLOUD/c0c54048d35849128be8e872df5bea6d/';
  const onPremise = sap + 'docs/SAP_S4HANA_ON-PREMISE/';
  const sources = {
    purchasing: [
      'SAP Help · Purchase order CDS and table fields',
      onPremise + 'af9ef57f504840d2b81be8667206d485/1d6f6bea1c3b4f049742e15a81ff86a0.html',
    ],
    history: [
      'SAP Help · Purchase order history (EKBE/EKBZ)',
      sap + 'docs/SUPPORT_CONTENT/spmm/3362168326.html',
    ],
    mm: [
      'SAP Community · MM standard tables',
      community + 'enterprise-resource-planning-q-a/mm-std-tables/qaq-p/3684755',
    ],
    mmMaster: [
      'SAP Community · Material master tables',
      community +
        'enterprise-resource-planning-q-a/sap-tables-categorized-by-module-for-sap-mm-pp-fico-and-pm/qaa-p/14180305/highlight/true',
    ],
    grLegacy: [
      'SAP Help · ECC material movement fields',
      sap + 'saphelp_scm700_ehp02/helpdata/en/e4/497053bbe77c1ee10000000a174cb4/content.htm',
    ],
    inventory: [
      'SAP Community (SAP) · S/4HANA inventory data model',
      community +
        'enterprise-resource-planning-blog-posts-by-sap/sap-s-4hana-inventory-management-tables-new-simplified-data-model-nsdm/ba-p/13497469',
    ],
    conversion: [
      'SAP Help · S/4HANA conversion guide',
      sap + 'doc/pdfe68bfa55e988410ee10000000a441470/1511%20001/en-US/CONV_OP1511_FPS01.pdf',
    ],
    invoice: [
      'SAP Help · Supplier invoice and accounting document reference',
      onPremise + '71224de1c7064fc280a3851775c32ebd/3d375e53460d0450e10000a44176d.html',
    ],
    grfi: [
      'SAP Community · ECC material document reference in FI',
      community +
        'enterprise-resource-planning-q-a/awkey-for-awtyp-bkpf-and-awtyp-mkpf-in-bkpf-table/qaq-p/1773183',
    ],
    accounting: [
      'SAP Help · Accounting CDS views and their data sources',
      sap +
        'docs/sap_s4hana_cloud/90c07e91c7a64f328be3fd6b48955b13/bdff67aa4ec449928c87b03ac1a0ed88.html',
    ],
    obyc: [
      'SAP Help · OBYC, T030 and WRX',
      sap + 'docs/SUPPORT_CONTENT/fiaccounting/3361880193.html',
    ],
    gl: [
      'SAP Help · G/L account master tables and fields',
      sap +
        'docs/signavio-process-insights/administration-guide/be4b0a35f6d048eb979899f569509c78.html',
    ],
    quantityValue: [
      'SAP Help · Quantity and value update (T134M)',
      sap +
        'docs/BI_CONTENT_757/d1e4c9f0ffc047ec9f945e64026ffab1/e5f09440f76d406d8d09d481a6d713c1.html',
    ],
    assignment: [
      'SAP Help · Purchasing account assignment fields',
      onPremise + 'af9ef57f504840d2b81be8667206d485/a1cfb17cbdfa48418b665ae94c15dc79.html',
    ],
    grValue: [
      'SAP Help · Valuated and non-valuated goods receipt',
      sap +
        'docs/SAP_ERP/967e1c2a6a8c4183b7e07d28e7574445/b47db65334e6b54ce10000000a174cb4-103.html',
    ],
    plant: [
      'SAP Community · Plant, valuation area and company code',
      community +
        'application-development-and-automation-discussions/company-code-and-plant/m-p/10308144',
    ],
    sloc: [
      'SAP Help · Plant and storage location fields',
      sap +
        'docs/SAP%20Fieldglass%20Integration%20Add-On/e745d2cc4d114bbf92d2eea49eda9af4/acb15c6130f647dcb11f494901fbb1b7.html',
    ],
    movement: [
      'SAP Help · Goods movement type field mapping',
      sap +
        'docs/SAP_SUS_SDI/b15a1be1941c44d4be60ba206536283d/01d91254f0e84fd0ae09e60d04e74721.html',
    ],
    supplier: [
      'SAP Help · Supplier master tables and keys',
      sap + 'docs/SUPPORT_CONTENT/sd/3362915361.html',
    ],
    bp: [
      'SAP Help · Business Partner and Customer/Supplier Integration',
      onPremise + '7b24a64d9d0941bda1afa753263d9e39/25b46c8241fd4852bf7876d87bed8fd0.html',
    ],
    cvi: [
      'SAP Community (SAP) · Partner GUID and supplier mapping',
      community +
        'enterprise-resource-planning-blog-posts-by-sap/resolving-inconsistencies-in-cvi-tables/ba-p/13574488',
    ],
    cost: [
      'SAP Help · Cost centre key and validity',
      sap +
        'docs/PRODUCT_ID/e745d2cc4d114bbf92d2eea49eda9af4/7731721708554d2aa347a6abcab1fc39.html',
    ],
    wbs: [
      'SAP Community · Purchase orders by WBS element',
      community +
        'application-development-and-automation-discussions/get-purchase-order-list-from-project/m-p/9133806/highlight/true',
    ],
    sto: [
      'SAP Help · Stock transport order with delivery via Shipping',
      onPremise + '2d95c3180a974e0aad07556ee4d28e94/f960b6531de6b64ce10000000a174cb4.html',
    ],
    shipping: [
      'SAP Help · STO shipping data (EKPV)',
      sap + 'docs/SUPPORT_CONTENT/erpscm/3362168266.html',
    ],
    sd: [
      'SAP Community · SD and MM document flow and delivery fields',
      community + 'enterprise-resource-planning-q-a/sd-mm-flow/qaq-p/2543529',
    ],
    pp: [
      'SAP Community · Production orders and reservations',
      community +
        'application-development-and-automation-discussions/production-orders-line-item-data/m-p/2505477',
    ],
    components: [
      'SAP Help · Manufacturing order reservation items (RESB)',
      onPremise + '6b356c79dea443c4bbeeaf0865e04207/d821563df8ef4ecb9a5fedc2bacda6fe.html',
    ],
    qm: [
      'SAP Help · Inspection at goods receipt',
      onPremise + '2bc3ee8d1c83404e8cf62418640004f2/2514c453f57eb44ce10000000a174cb4.html',
    ],
    qmFields: [
      'SAP Community · Inspection lot and usage decision fields',
      community + 'enterprise-resource-planning-q-a/pending-goods-reciept/qaq-p/4068599',
    ],
    qamb: [
      'SAP Community · Inspection lot to material document fields',
      community +
        'application-development-and-automation-discussions/nested-select-qurey-to-convert-into-normal/m-p/3355169/highlight/true',
    ],
    wm: [
      'SAP Community · Classic warehouse transfer order tables',
      community +
        'enterprise-resource-planning-q-a/tables-and-flow-in-warehouse-management/qaa-p/2150940/highlight/true',
    ],
    stockRoom: [
      'SAP Help · Stock Room Management and putaway',
      onPremise + 'c7894a248ca14f74aca67f97528e5ad7/0577b6535fe6b74ce10000000a174cb4.html',
    ],
    ewm: [
      'SAP Help · Confirmed EWM warehouse task storage',
      sap +
        'docs/SAP_SUPPLY_CHAIN_MANAGEMENT/57574d15fa1d414792d74047b66c3e41/4e41413f8fab3c44e10000000a15822b.html',
    ],
    ewmDelivery: [
      'SAP Community · EWM delivery and warehouse task fields',
      community +
        'supply-chain-management-q-a/outbound-delivery-and-warehouse-tasks-table-relations/qaq-p/11445927',
    ],
    ewmOpen: [
      'SAP Community · Open EWM warehouse tasks',
      community + 'abap-forum/tip-for-abapers-working-with-door-assignment-in-sap-ewm/m-p/14238070',
    ],
    cloudPO: [
      'SAP Help · Public Edition purchase order view',
      cloud + 'ae766bee9c7b4e938098c935f5962814.html',
    ],
    cloudPOItem: [
      'SAP Help · Public Edition purchase order item view',
      cloud + '33192c1211354eed9e40fac66e55fcc1.html',
    ],
    poHistoryCDS: [
      'SAP Help · Purchase order history view',
      onPremise + 'ee6ff9b281d8448f96b4fe6c89f2bdc8/1c5ef1f414f74b1bba6967346c59c1d6.html',
    ],
    movementCDS: [
      'SAP Help · Public Edition material document item view',
      cloud + '14305f6e8cb842bbb1647ffd5a30ca31.html?locale=en-US',
    ],
    documentHeaderCDS: [
      'SAP Help · S/4HANA material document header view',
      onPremise + 'ee6ff9b281d8448f96b4fe6c89f2bdc8/9a4ee78fc8de46ed8cdf081e266a8f94.html',
    ],
    stockCDS: [
      'SAP Help · Material Stock 2 successor view',
      cloud + '4c7f68579552346ae10000000a4450e5.html',
    ],
    inspectionCDS: [
      'SAP Help · Public Edition inspection lot view',
      cloud + '0518ea2b71a645988865a2816b238071.html',
    ],
    usageCDS: [
      'SAP Help · Public Edition inspection lot usage decision view',
      cloud + '4fe05bc9f82345d28847d780ce2d160a.html',
    ],
    viewBrowser: [
      'SAP Help · View Browser and supported capabilities',
      sap +
        'docs/SAP_S4HANA_CLOUD/a630d57fc5004c6383e7a81efee7a8bb/0bde695751505c08e10000000a441470.html',
    ],
  };

  const both = ['ecc', 's4'];
  const s4 = ['s4'];
  const s4Cloud = ['s4', 'public'];
  const tables = [];
  function add(group, module, defaultSources, entries) {
    for (const [code, title, fields, description, options = {}] of entries) {
      tables.push({
        code,
        title,
        group,
        module,
        fields: fields.split(' '),
        description,
        kind: 'table',
        systems: both,
        sources: defaultSources,
        ...options,
      });
    }
  }

  add(
    'Purchasing',
    'MM',
    ['purchasing', 'mm'],
    [
      [
        'EBAN',
        'Purchase requisition item',
        'BANFN BNFPO MATNR WERKS',
        'Check the requested material, quantity, plant and procurement details before a purchase order is created.',
      ],
      [
        'EBKN',
        'Purchase requisition account assignment',
        'BANFN BNFPO ZEBKN SAKTO KOSTL',
        'Find the account assignment splits on a requisition item.',
      ],
      [
        'EKKO',
        'Purchasing document header',
        'EBELN BSTYP BUKRS LIFNR EKORG KNUMV',
        'Start here for the purchasing document category, supplier, company code and header data.',
        { alternative: 'I_PurchaseOrderAPI01' },
      ],
      [
        'EKPO',
        'Purchasing document item',
        'EBELN EBELP MATNR WERKS LGORT BANFN BNFPO KNTTP WEUNB',
        'Check the ordered material, plant, storage location and goods receipt settings. WEUNB is the non-valuated GR indicator.',
        { alternative: 'I_PurchaseOrderItemAPI01', sources: ['purchasing', 'grValue'] },
      ],
      [
        'EKET',
        'Purchasing schedule lines',
        'EBELN EBELP ETENR EINDT MENGE',
        'Check delivery dates and quantities by schedule line.',
      ],
      [
        'EKKN',
        'Purchasing document account assignment',
        'EBELN EBELP ZEKKN SAKTO KOSTL KOKRS AUFNR PS_PSP_PNR',
        'Check the maintained G/L account, cost centre, order or WBS element for each applicable assignment split.',
        { sources: ['purchasing', 'assignment'] },
      ],
      [
        'EKBE',
        'Purchase order history',
        'EBELN EBELP ZEKKN VGABE BEWTP GJAHR BELNR BUZEI',
        'Trace goods receipts, invoice receipts and other history events for a PO item. Interpret the document reference using the history event first.',
        { alternative: 'I_PurchaseOrderHistoryAPI01', sources: ['purchasing', 'history'] },
      ],
      [
        'EKBZ',
        'Purchase order history for delivery costs',
        'EBELN EBELP VGABE BELNR GJAHR',
        'Use alongside EKBE when investigating planned delivery costs posted against a PO.',
        { sources: ['history'] },
      ],
      [
        'EKES',
        'Supplier confirmations',
        'EBELN EBELP ETENS EBTYP EINDT',
        'Check confirmation categories, dates and quantities confirmed for a purchasing document item.',
      ],
      [
        'EORD',
        'Source list',
        'MATNR WERKS ZEORD VDATU BDATU LIFNR',
        'See approved or fixed sources for a material and plant within a validity period.',
        { sources: ['mm'] },
      ],
      [
        'EINA',
        'Purchasing info record general data',
        'INFNR MATNR LIFNR',
        'Find the supplier and material relationship for an info record.',
        { sources: ['mm'] },
      ],
      [
        'EINE',
        'Purchasing info record purchasing data',
        'INFNR EKORG ESOKZ WERKS',
        'Check purchasing organisation, info record category and plant details for an info record.',
        { sources: ['mm'] },
      ],
      [
        'EKPV',
        'Stock transport order shipping data',
        'EBELN EBELP',
        'Check shipping data when the supplying plant is expected to generate a delivery for an STO.',
        { sources: ['shipping', 'sto'] },
      ],
    ]
  );

  add(
    'Material master & stock',
    'MM',
    ['mmMaster', 'inventory'],
    [
      [
        'MARA',
        'Material master general data',
        'MATNR MTART MATKL MEINS',
        'Check the material type, material group and base unit of measure.',
      ],
      [
        'MAKT',
        'Material descriptions',
        'MATNR SPRAS MAKTX',
        'Check the material short text for the required language.',
      ],
      [
        'MARC',
        'Material master plant data',
        'MATNR WERKS DISMM BESKZ',
        'Check plant-specific planning and procurement fields.',
      ],
      [
        'MARD',
        'Material data by storage location',
        'MATNR WERKS LGORT LABST INSME',
        'Check the storage-location segment. In S/4HANA, stock quantities read through the compatibility model are derived rather than maintained as classic stock aggregates.',
        { alternative: 'I_MaterialStock_2' },
      ],
      [
        'MARM',
        'Material units of measure',
        'MATNR MEINH UMREZ UMREN',
        'Look up alternative units and their conversion to the base unit.',
      ],
      [
        'MBEW',
        'Material valuation',
        'MATNR BWKEY BWTAR BKLAS VPRSV',
        'Check valuation class and price control by valuation area and, for split valuation, valuation type.',
      ],
      [
        'T001W',
        'Plant configuration',
        'WERKS BWKEY',
        'Use the configured BWKEY to find the valuation area for a plant.',
        { sources: ['plant'] },
      ],
      [
        'T001L',
        'Storage locations',
        'WERKS LGORT LGOBE',
        'Check the description of a storage location within its plant. Storage location codes can repeat across plants.',
        { sources: ['sloc'] },
      ],
      [
        'T001K',
        'Valuation areas',
        'BWKEY BUKRS BWMOD',
        'Resolve the company code and valuation grouping code for a valuation area.',
        { sources: ['plant', 'obyc'] },
      ],
      [
        'T134M',
        'Material type quantity and value updates',
        'MTART BWKEY MENGU WERTU',
        'Check quantity and value update by material type and valuation area. Start with MARA-MTART and the plant’s configured valuation area.',
        { sources: ['quantityValue'] },
      ],
    ]
  );

  add(
    'Goods movements',
    'MM',
    ['grLegacy', 'inventory'],
    [
      [
        'MKPF',
        'Material document header',
        'MBLNR MJAHR BUDAT BLDAT',
        'Check ECC material document header dates. In S/4HANA, treat legacy reads as compatibility access to the material document data model.',
        {
          compatibility: true,
          alternative: 'I_MaterialDocumentHeader_2',
          sources: ['grLegacy', 'inventory', 'conversion'],
        },
      ],
      [
        'MSEG',
        'Material document item',
        'MBLNR MJAHR ZEILE BWART MATNR WERKS LGORT EBELN EBELP AUFNR',
        'Read the ECC movement line, its PO or order reference, and quantity. Use MATDOC or an appropriate CDS view for S/4HANA reporting.',
        {
          compatibility: true,
          alternative: 'I_MaterialDocumentItem_2',
          sources: ['grLegacy', 'inventory', 'conversion'],
        },
      ],
      [
        'MATDOC',
        'Material document storage in S/4HANA',
        'MBLNR MJAHR ZEILE BWART MATNR WERKS LGORT EBELN EBELP AUFNR',
        'Use the business document number, year and item to trace a goods movement. MATDOC includes technical records and fields. For reporting, prefer the relevant CDS view over treating every physical row as a posted line.',
        {
          systems: s4,
          alternative: 'I_MaterialDocumentItem_2',
          sources: ['inventory', 'conversion', 'movementCDS'],
        },
      ],
      [
        'T156',
        'Movement type configuration',
        'BWART',
        'Identify the movement type behind a goods receipt, goods issue, transfer or reversal.',
        { sources: ['movement'] },
      ],
    ]
  );

  add(
    'Invoice verification',
    'MM',
    ['invoice', 'purchasing'],
    [
      [
        'RBKP',
        'Logistics invoice header',
        'BELNR GJAHR BUKRS LIFNR',
        'Check the supplier invoice document number, year and company code. The document number belongs to Logistics Invoice Verification.',
      ],
      [
        'RSEG',
        'Logistics invoice item',
        'BELNR GJAHR BUZEI EBELN EBELP LFBNR LFGJA LFPOS',
        'Check the invoiced PO item and, where populated, the referenced goods receipt item.',
      ],
    ]
  );

  add(
    'Accounting & controlling',
    'FI',
    ['accounting'],
    [
      [
        'BKPF',
        'Accounting document header',
        'BUKRS BELNR GJAHR AWTYP AWKEY',
        'Find an accounting document by company code, document number and fiscal year. Use the source reference type and key to trace back to Logistics.',
        { sources: ['accounting', 'invoice', 'grfi'] },
      ],
      [
        'BSEG',
        'Accounting document entry-view line items',
        'BUKRS BELNR GJAHR BUZEI HKONT KOSTL',
        'Use for entry-view details such as the G/L account on an FI line. Universal Journal lines in S/4HANA can have a different granularity.',
        { sources: ['accounting'] },
      ],
      [
        'ACDOCA',
        'Universal Journal line items',
        'RLDNR RBUKRS GJAHR BELNR DOCLN RACCT',
        'Use the ledger, company code, fiscal year and journal-entry identifiers in S/4HANA. Some journal entries have no corresponding BSEG line.',
        { systems: s4 },
      ],
      [
        'T030',
        'Automatic account determination',
        'KTOPL KTOSL BWMOD KOMOK BKLAS',
        'Trace an OBYC posting using the chart of accounts, transaction key and any configured valuation grouping, general modification and valuation class. Common examples are BSX for stock and WRX for GR/IR.',
        { sources: ['obyc', 'assignment'] },
      ],
      [
        'SKA1',
        'G/L account master by chart of accounts',
        'KTOPL SAKNR XBILK',
        'Check chart-of-accounts data for a G/L account used by OBYC or a purchasing account assignment.',
        { sources: ['gl', 'assignment'] },
      ],
      [
        'SKB1',
        'G/L account master by company code',
        'BUKRS SAKNR',
        'Check whether the G/L account is maintained in the posting company code and review its company-code settings.',
        { sources: ['gl'] },
      ],
      [
        'CSKS',
        'Cost centre master data',
        'KOKRS KOSTL DATAB DATBI',
        'Check the cost centre in its controlling area and on the relevant posting date.',
        { module: 'CO', sources: ['cost'] },
      ],
      [
        'PRPS',
        'WBS element master data',
        'PSPNR POSID',
        'Resolve the internal WBS identifier to the external WBS element ID used by project teams.',
        { module: 'PS', sources: ['wbs'] },
      ],
    ]
  );

  add(
    'Suppliers & business partners',
    'MM',
    ['supplier', 'bp'],
    [
      [
        'LFA1',
        'Supplier general data',
        'LIFNR NAME1 LAND1',
        'Look up general supplier data. S/4HANA maintains suppliers through Business Partner roles and synchronizes the supplier data through CVI.',
      ],
      [
        'LFB1',
        'Supplier company code data',
        'LIFNR BUKRS AKONT ZTERM',
        'Check the supplier reconciliation account, payment terms and company code settings.',
        { module: 'FI' },
      ],
      [
        'LFM1',
        'Supplier purchasing organisation data',
        'LIFNR EKORG WAERS ZTERM',
        'Check purchasing organisation settings such as order currency and payment terms.',
      ],
      [
        'BUT000',
        'Business Partner general data',
        'PARTNER PARTNER_GUID',
        'Start with the BP number or GUID in S/4HANA. Use CVI to resolve the supplier number.',
        { module: 'BP', systems: s4, sources: ['bp', 'cvi'] },
      ],
      [
        'CVI_VEND_LINK',
        'CVI supplier-to-business-partner link',
        'PARTNER_GUID VENDOR',
        'Resolve the link between supplier account and BP using the supplier number and business partner GUID.',
        { module: 'BP', systems: s4, sources: ['bp', 'cvi'] },
      ],
    ]
  );

  add(
    'Sales & shipping',
    'SD',
    ['sd', 'sto'],
    [
      [
        'VBAK',
        'Sales document header',
        'VBELN AUART',
        'Find the sales document header for sales-order-driven procurement or delivery checks.',
      ],
      [
        'VBAP',
        'Sales document item',
        'VBELN POSNR MATNR WERKS',
        'Use for material and plant details on the sales-order item linked to an account assignment.',
      ],
      [
        'LIKP',
        'Delivery header',
        'VBELN LFART WADAT_IST',
        'Find the delivery type and actual goods movement date at delivery header level.',
      ],
      [
        'LIPS',
        'Delivery item',
        'VBELN POSNR VGBEL VGPOS MATNR WERKS LGORT',
        'Identify the preceding document item, plant and storage location. The predecessor can be a sales order or an STO, depending on the process.',
      ],
      [
        'VBFA',
        'Sales and delivery document flow',
        'VBELV POSNV VBELN POSNN VBTYP_V VBTYP_N',
        'Trace preceding and subsequent SD documents using document categories and item numbers.',
      ],
    ]
  );

  add(
    'Production',
    'PP',
    ['pp', 'components'],
    [
      [
        'AFKO',
        'Production order header data',
        'AUFNR RSNUM',
        'Use the production order to find its component reservation number.',
      ],
      [
        'AFPO',
        'Production order item',
        'AUFNR POSNR MATNR',
        'Check the product and item of the manufacturing order. For component requirements, follow the reservation.',
      ],
      [
        'RESB',
        'Reservation and dependent requirements',
        'RSNUM RSPOS RSART MATNR WERKS LGORT AUFNR',
        'Check components, required quantities and storage locations. Reservations can also originate outside production.',
      ],
    ]
  );

  add(
    'Quality management',
    'QM',
    ['qm', 'qmFields'],
    [
      [
        'QALS',
        'Inspection lot record',
        'PRUEFLOS MATNR WERK HERKUNFT',
        'Check the inspection lot triggered by an applicable goods receipt, or another configured inspection origin.',
        { alternative: 'I_InspectionLot' },
      ],
      [
        'QAVE',
        'Inspection lot usage decision',
        'PRUEFLOS KZART ZAEHLER VCODE',
        'Check the recorded usage decision. Account for the decision type and counter when multiple records exist.',
        { alternative: 'I_InspLotUsageDecision', sources: ['qmFields', 'usageCDS'] },
      ],
      [
        'QAMB',
        'Inspection lot and material document link',
        'PRUEFLOS MBLNR MJAHR ZEILE',
        'Trace material document items connected to an inspection lot, including follow-on stock postings as applicable.',
        { sources: ['qamb', 'qm'] },
      ],
    ]
  );

  add(
    'Warehouse management',
    'WM',
    ['wm', 'stockRoom'],
    [
      [
        'LTAK',
        'Classic WM transfer order header',
        'LGNUM TANUM',
        'Use for the configured classic WM process in ECC or applicable Stock Room Management scope in S/4HANA.',
      ],
      [
        'LTAP',
        'Classic WM transfer order item',
        'LGNUM TANUM TAPOS MATNR VLTYP VLPLA NLTYP NLPLA',
        'Review source and destination storage types or bins on a transfer order item.',
      ],
    ]
  );

  add(
    'Warehouse management',
    'EWM',
    ['ewm', 'ewmDelivery'],
    [
      [
        '/SCWM/ORDIM_C',
        'Confirmed EWM warehouse task',
        'LGNUM TANUM TAPOS RDOCID RITMID',
        'Open in the relevant embedded or decentralised EWM system. Use its delivery document and item GUIDs for delivery-related tasks.',
        { systems: s4 },
      ],
      [
        '/SCWM/ORDIM_O',
        'Open EWM warehouse task',
        'LGNUM TANUM TAPOS RDOCID RITMID',
        'Check tasks that are still open in the EWM system. Older decentralised EWM can coexist with ECC, depending on the landscape.',
        { systems: s4, sources: ['ewmOpen', 'ewmDelivery'] },
      ],
      [
        '/SCDL/DB_DLVH_O',
        'EWM outbound delivery order header',
        'DOCID DOCNO',
        'Look up the outbound delivery order in the EWM system. Use EWM identifiers to trace its warehouse tasks.',
        { systems: s4, sources: ['ewmDelivery'] },
      ],
      [
        '/SCDL/DB_DLVI_O',
        'EWM outbound delivery order item',
        'DOCID ITEMID',
        'Find the EWM delivery item GUID for the warehouse task reference.',
        { systems: s4, sources: ['ewmDelivery'] },
      ],
    ]
  );

  add(
    'CDS views',
    'MM',
    ['viewBrowser'],
    [
      [
        'I_PurchaseOrderAPI01',
        'Purchase order header view',
        'PurchaseOrder',
        'Review purchase order header data in SAP’s Virtual Data Model.',
        { kind: 'cds', systems: s4Cloud, sources: ['cloudPO', 'purchasing', 'viewBrowser'] },
      ],
      [
        'I_PurchaseOrderItemAPI01',
        'Purchase order item view',
        'PurchaseOrder PurchaseOrderItem',
        'Read purchase order items using document and item identifiers.',
        { kind: 'cds', systems: s4Cloud, sources: ['cloudPOItem', 'purchasing', 'viewBrowser'] },
      ],
      [
        'I_PurchaseOrderHistoryAPI01',
        'Purchase order history view',
        'PurchaseOrder PurchaseOrderItem PurchasingHistoryDocumentType PurchasingHistoryDocumentYear PurchasingHistoryDocument PurchasingHistoryDocumentItem',
        'Review goods and invoice receipts, delivery costs and other history. Check release and supported capabilities in View Browser for your edition.',
        { kind: 'cds', systems: s4, sources: ['poHistoryCDS', 'purchasing', 'viewBrowser'] },
      ],
      [
        'I_MaterialDocumentHeader_2',
        'Material document header view',
        'MaterialDocumentYear MaterialDocument',
        'Read material document header details for the supported business documents and release.',
        { kind: 'cds', systems: s4, sources: ['documentHeaderCDS', 'viewBrowser'] },
      ],
      [
        'I_MaterialDocumentItem_2',
        'Material document item view',
        'MaterialDocumentYear MaterialDocument MaterialDocumentItem',
        'Look up inventory movement documents through the CDS business object. Check release and supported capabilities in View Browser.',
        { kind: 'cds', systems: s4Cloud, sources: ['movementCDS', 'viewBrowser'] },
      ],
      [
        'I_MaterialStock_2',
        'Material stock view',
        'Material Plant StorageLocation',
        'Use the successor to the deprecated I_MaterialStock view for stock reporting. Check supported capabilities for your release.',
        { kind: 'cds', systems: s4Cloud, sources: ['stockCDS', 'viewBrowser'] },
      ],
      [
        'I_InspectionLot',
        'Inspection lot view',
        'InspectionLot',
        'Read inspection lot data through the released QM view.',
        { kind: 'cds', module: 'QM', systems: s4Cloud, sources: ['inspectionCDS', 'viewBrowser'] },
      ],
      [
        'I_InspLotUsageDecision',
        'Inspection lot usage decision view',
        'InspectionLot',
        'Review inspection lot usage decisions using the released QM view for your SAP release.',
        { kind: 'cds', module: 'QM', systems: s4Cloud, sources: ['usageCDS', 'viewBrowser'] },
      ],
    ]
  );

  const relationships = [
    [
      'EKKO',
      'EKPO',
      'Header → items',
      'EBELN',
      'One purchasing document can have multiple items.',
      'purchasing',
    ],
    [
      'EKPO',
      'EBAN',
      'Purchase requisition reference',
      'BANFN + BNFPO',
      'Only applies when the PO item refers to a purchase requisition.',
      'mm',
    ],
    [
      'EBAN',
      'EBKN',
      'Requisition account assignment',
      'BANFN + BNFPO',
      'Read all assignment splits for the requested item.',
      'mm',
    ],
    [
      'EKPO',
      'EKET',
      'Delivery schedule lines',
      'EBELN + EBELP',
      'Use EKET-ETENR to distinguish multiple schedule lines.',
      'purchasing',
    ],
    [
      'EKPO',
      'EKKN',
      'Account assignment splits',
      'EBELN + EBELP',
      'Use EKKN-ZEKKN to distinguish splits. Check the item account assignment category first.',
      'assignment',
    ],
    [
      'EKPO',
      'EKBE',
      'Goods and invoice receipts',
      'EBELN + EBELP',
      'Filter purchase order history by the event type before using the follow-on document number.',
      'purchasing',
    ],
    [
      'EKPO',
      'EKBZ',
      'Planned delivery cost history',
      'EBELN + EBELP',
      'Applies to delivery costs posted against the item.',
      'history',
    ],
    [
      'EKPO',
      'EKES',
      'Supplier confirmations',
      'EBELN + EBELP',
      'Only relevant when confirmations are maintained for the item.',
      'mm',
    ],
    [
      'EINA',
      'EINE',
      'Purchasing organisation data',
      'INFNR',
      'Select purchasing organisation, info record category and plant as applicable.',
      'mm',
    ],
    [
      'MARA',
      'EORD',
      'Source list by plant',
      'MATNR; filter EORD-WERKS',
      'Check validity dates and supplier or supplying plant.',
      'mm',
    ],
    [
      'MARA',
      'MAKT',
      'Material description',
      'MATNR; filter MAKT-SPRAS',
      'Select the language you want to display.',
      'mmMaster',
    ],
    [
      'MARA',
      'MARM',
      'Alternative units',
      'MATNR',
      'Select the alternative unit (MEINH) for conversion factors.',
      'mmMaster',
    ],
    [
      'MARA',
      'MARC',
      'Material by plant',
      'MATNR; filter MARC-WERKS',
      'Plant-level settings can differ for the same material.',
      'mmMaster',
    ],
    [
      'MARC',
      'MARD',
      'Material by storage location',
      'MATNR + WERKS',
      'Use LGORT to distinguish locations within the plant.',
      'mmMaster',
    ],
    [
      'MARD',
      'T001L',
      'Storage location description',
      'WERKS + LGORT',
      'Storage location identifiers are scoped to the plant.',
      'sloc',
    ],
    [
      'MARC',
      'T001W',
      'Plant attributes',
      'WERKS',
      'Read T001W-BWKEY before looking up valuation.',
      'plant',
    ],
    [
      'T001W',
      'T001K',
      'Valuation area and company code',
      'BWKEY',
      'Use the configured valuation area for the plant.',
      'plant',
    ],
    [
      'MBEW',
      'T001K',
      'Valuation area attributes',
      'BWKEY',
      'Use the company code and valuation grouping data for account determination.',
      'plant',
    ],
    [
      'MBEW',
      'T030',
      'OBYC lookup',
      'MBEW-BKLAS → T030-BKLAS when the rule uses valuation class',
      'Also determine the chart of accounts, transaction key, valuation grouping and general modification as configured. Some keys, such as WRX, can be configured without a valuation class dependency.',
      'obyc',
    ],
    [
      'MARA',
      'T134M',
      'Quantity and value update',
      'MTART; choose T134M-BWKEY',
      'Use the valuation area of the relevant plant to review MENGU and WERTU.',
      'quantityValue',
    ],
    [
      'BSEG',
      'SKB1',
      'Posted G/L account in company code',
      'BUKRS + HKONT → BUKRS + SAKNR',
      'For an FI entry-view line, use the company code and G/L account to check its master data.',
      'gl',
    ],
    [
      'EKKN',
      'SKA1',
      'G/L account on a purchasing assignment',
      'EKKN-SAKTO → SKA1-SAKNR; choose SKA1-KTOPL',
      'Resolve the chart of accounts for the PO company code. This traces the maintained assignment account.',
      'assignment',
    ],
    [
      'EKBE',
      'MSEG',
      'Goods receipt item in ECC',
      'BELNR → MBLNR · GJAHR → MJAHR · BUZEI → ZEILE',
      'For the goods receipt history event, use the material document number, year and item.',
      'grLegacy',
      ['ecc'],
    ],
    [
      'EKBE',
      'MATDOC',
      'Goods receipt item in S/4HANA',
      'BELNR → MBLNR · GJAHR → MJAHR · BUZEI → ZEILE',
      'Use for the goods receipt history event and interpret the references as material document business identifiers.',
      'purchasing',
      s4,
    ],
    [
      'EKBE',
      'RSEG',
      'Invoice receipt item',
      'BELNR + GJAHR + BUZEI',
      'Use for the invoice receipt event. For credit memos or subsequent debits and credits, check the event and posting sign.',
      'purchasing',
    ],
    [
      'MKPF',
      'MSEG',
      'Material document header → items',
      'MBLNR + MJAHR',
      'ECC table relationship. S/4HANA provides compatibility reads.',
      'grLegacy',
      ['ecc'],
    ],
    [
      'MSEG',
      'MATDOC',
      'S/4HANA data model',
      'MBLNR + MJAHR + ZEILE (business reference)',
      'Use this as a release transition, with the S/4HANA material-document model and reporting views.',
      'inventory',
      s4,
    ],
    [
      'MSEG',
      'T156',
      'Movement type',
      'BWART',
      'Interpret the movement type on the material document line.',
      'movement',
    ],
    [
      'MATDOC',
      'T156',
      'Movement type',
      'BWART',
      'Interpret the movement type on the material document line.',
      'movement',
      s4,
    ],
    [
      'MKPF',
      'BKPF',
      'FI posting for valuated goods movement',
      'BKPF-AWTYP = MKPF · AWKEY uses MBLNR + MJAHR',
      'Check the reference using the internal number format. A non-valuated goods receipt can have a material document without an FI posting.',
      'grfi',
      ['ecc'],
    ],
    [
      'MATDOC',
      'BKPF',
      'FI posting for valuated goods movement',
      'Material document + year → accounting source reference',
      'When a financial posting exists, inspect the accounting document’s original reference for the posting scenario. In classic MM-IM references it uses the MKPF origin and material document number plus year.',
      'inventory',
      s4,
    ],
    [
      'RBKP',
      'RSEG',
      'Invoice header → items',
      'BELNR + GJAHR',
      'Both identifiers belong to Logistics Invoice Verification.',
      'invoice',
    ],
    [
      'RSEG',
      'EKPO',
      'Invoiced purchase order item',
      'EBELN + EBELP',
      'Applies to invoice lines that reference a PO item.',
      'invoice',
    ],
    [
      'RBKP',
      'BKPF',
      'Finance document from Logistics Invoice Verification',
      'BKPF-AWTYP = RMRP · AWKEY uses RBKP-BELNR + RBKP-GJAHR',
      'Use the Logistics invoice reference to find the FI header. A posted invoice can have a different document number in FI.',
      'invoice',
    ],
    [
      'BKPF',
      'BSEG',
      'FI entry view',
      'BUKRS + BELNR + GJAHR',
      'Use BUZEI to identify an entry-view line within the accounting document.',
      'accounting',
    ],
    [
      'BKPF',
      'ACDOCA',
      'Universal Journal',
      'BUKRS → RBUKRS · BELNR + GJAHR',
      'Choose the ledger (RLDNR) and use DOCLN for line detail. Document-level trace only, as entry view and ledger line items can differ.',
      'accounting',
      s4,
    ],
    [
      'EKKN',
      'CSKS',
      'Cost centre assignment',
      'KOKRS + KOSTL',
      'Check the account assignment category and the cost centre validity on the posting date.',
      'cost',
    ],
    [
      'EKKN',
      'PRPS',
      'WBS assignment',
      'PS_PSP_PNR → PSPNR',
      'Where a WBS element is assigned, use PRPS-POSID for the external project code.',
      'wbs',
    ],
    [
      'EKKO',
      'LFA1',
      'Supplier general data',
      'LIFNR',
      'For a supplier-based purchasing document, use the supplier number from the header.',
      'supplier',
    ],
    [
      'LFA1',
      'LFB1',
      'Supplier accounting data',
      'LIFNR; choose LFB1-BUKRS',
      'Use the company code for reconciliation account and payment details.',
      'supplier',
    ],
    [
      'LFA1',
      'LFM1',
      'Supplier purchasing data',
      'LIFNR; choose LFM1-EKORG',
      'Choose the purchasing organisation for local purchasing settings.',
      'supplier',
    ],
    [
      'LFA1',
      'CVI_VEND_LINK',
      'Supplier-to-BP mapping',
      'LIFNR → VENDOR',
      'CVI uses the supplier account number, which can differ from the BP number.',
      'cvi',
      s4,
    ],
    [
      'CVI_VEND_LINK',
      'BUT000',
      'Business Partner GUID',
      'PARTNER_GUID',
      'Resolve the BP number from the GUID carried by the supplier link.',
      'cvi',
      s4,
    ],
    [
      'EKPO',
      'EKPV',
      'STO shipping settings',
      'EBELN + EBELP',
      'Check when an STO uses a delivery via Shipping.',
      'shipping',
    ],
    [
      'EKPO',
      'LIPS',
      'STO delivery item',
      'EBELN → VGBEL · EBELP → VGPOS (SAP item format)',
      'Only use when the delivery item references the STO as its preceding document. Match SAP’s internal item formatting, including leading zeroes, and check the document category.',
      'sto',
    ],
    [
      'LIKP',
      'LIPS',
      'Delivery header → items',
      'VBELN',
      'Use POSNR to identify the delivery item.',
      'sd',
    ],
    [
      'VBAK',
      'VBAP',
      'Sales document header → items',
      'VBELN',
      'Use POSNR to identify the sales item.',
      'sd',
    ],
    [
      'VBAP',
      'LIPS',
      'Delivery from sales order',
      'VBELN → VGBEL · POSNR → VGPOS',
      'Use when the delivery item references the sales order item.',
      'sd',
    ],
    [
      'LIKP',
      'VBFA',
      'Delivery document flow',
      'LIKP-VBELN ↔ VBFA-VBELV or VBFA-VBELN',
      'Choose the predecessor or successor field based on the direction of the trace and filter the document categories.',
      'sd',
    ],
    [
      'AFKO',
      'AFPO',
      'Order product items',
      'AUFNR',
      'Use AFPO-POSNR for the production order item.',
      'pp',
    ],
    [
      'AFKO',
      'RESB',
      'Production order components',
      'RSNUM',
      'Identify component lines using the reservation item, scope and type.',
      'pp',
    ],
    [
      'MSEG',
      'AFKO',
      'Production goods movement',
      'AUFNR',
      'Use when the material movement references a production order. Check BWART for issue, receipt or reversal.',
      'grLegacy',
      ['ecc'],
    ],
    [
      'MATDOC',
      'AFKO',
      'Production goods movement',
      'AUFNR',
      'Use when the movement carries a production order reference.',
      'components',
      s4,
    ],
    [
      'QALS',
      'QAVE',
      'Inspection lot usage decision',
      'PRUEFLOS',
      'Check the type and counter if several usage decision records exist.',
      'qmFields',
    ],
    [
      'QALS',
      'QAMB',
      'Goods movement links',
      'PRUEFLOS',
      'Check whether the link corresponds to the original receipt or a later stock posting.',
      'qamb',
    ],
    [
      'QAMB',
      'MSEG',
      'Material document item in ECC',
      'MBLNR + MJAHR + ZEILE',
      'Use the document year and item to identify the movement line.',
      'qamb',
      ['ecc'],
    ],
    [
      'QAMB',
      'MATDOC',
      'Material document item in S/4HANA',
      'MBLNR + MJAHR + ZEILE (business reference)',
      'Use the material document references for the inspection lot and confirm the movement type.',
      'qamb',
      s4,
    ],
    [
      'LTAK',
      'LTAP',
      'Warehouse transfer order items',
      'LGNUM + TANUM',
      'Use TAPOS for the line in classic WM or applicable Stock Room Management.',
      'wm',
    ],
    [
      'LIPS',
      '/SCDL/DB_DLVI_O',
      'ERP outbound delivery → EWM delivery',
      'ERP delivery/item reference → EWM delivery/item GUID',
      'Follow the EWM delivery reference or warehouse monitor for the integrated delivery. The ERP VBELN is not the EWM DOCID.',
      'ewmDelivery',
      s4,
    ],
    [
      '/SCDL/DB_DLVH_O',
      '/SCDL/DB_DLVI_O',
      'EWM delivery header → items',
      'DOCID',
      'These are EWM GUIDs in the warehouse system.',
      'ewmDelivery',
      s4,
    ],
    [
      '/SCDL/DB_DLVI_O',
      '/SCWM/ORDIM_O',
      'Open delivery warehouse tasks',
      'DOCID → RDOCID · ITEMID → RITMID',
      'Use for open tasks that reference the outbound delivery order.',
      'ewmDelivery',
      s4,
    ],
    [
      '/SCDL/DB_DLVI_O',
      '/SCWM/ORDIM_C',
      'Confirmed delivery warehouse tasks',
      'DOCID → RDOCID · ITEMID → RITMID',
      'Use for confirmed tasks with the corresponding EWM delivery reference and document category.',
      'ewmDelivery',
      s4,
    ],
    [
      'I_PurchaseOrderAPI01',
      'I_PurchaseOrderItemAPI01',
      'Purchase order items',
      'PurchaseOrder',
      'Select the item with PurchaseOrderItem.',
      'cloudPOItem',
      s4Cloud,
    ],
    [
      'I_PurchaseOrderItemAPI01',
      'I_PurchaseOrderHistoryAPI01',
      'History for the purchase order item',
      'PurchaseOrder + PurchaseOrderItem',
      'Check whether both views are available and released for your use case in View Browser.',
      'poHistoryCDS',
      s4,
    ],
    [
      'I_InspectionLot',
      'I_InspLotUsageDecision',
      'Inspection lot usage decision',
      'InspectionLot',
      'Apply the view’s supported capabilities and authorizations for your release.',
      'usageCDS',
      s4Cloud,
    ],
  ].map(([from, to, title, fields, note, source, scope]) => ({
    from,
    to,
    title,
    fields,
    note,
    source,
    systems: scope || both,
  }));

  const workflows = {
    p2p: {
      label: 'PO, GR, IR & accounting',
      detail:
        'Start with the PO item and its history. Follow the goods or invoice receipt by its event type, then check the FI document if one was posted.',
      codes: [
        'EKPO',
        'EKBE',
        'MSEG',
        'MATDOC',
        'RBKP',
        'RSEG',
        'BKPF',
        'BSEG',
        'ACDOCA',
        'I_PurchaseOrderItemAPI01',
        'I_PurchaseOrderHistoryAPI01',
        'I_MaterialDocumentItem_2',
      ],
    },
    obyc: {
      label: 'Valuation & OBYC',
      detail:
        'Find the plant’s valuation area and the material’s valuation class. Check the posting rule in T030 using the applicable chart of accounts and transaction key.',
      codes: ['MARC', 'T001W', 'T001K', 'MBEW', 'T030'],
    },
    sto: {
      label: 'STO, delivery & warehouse',
      detail:
        'Use the STO item as the starting point. When the STO uses Shipping, follow its delivery. Follow the warehouse branch that applies to your landscape.',
      codes: [
        'EKKO',
        'EKPO',
        'EKPV',
        'LIPS',
        'LIKP',
        'LTAK',
        'LTAP',
        '/SCDL/DB_DLVI_O',
        '/SCWM/ORDIM_C',
      ],
    },
    qm: {
      label: 'Goods receipt & inspection',
      detail:
        'For a receipt that triggers inspection, trace the material document to its inspection lot and usage decision.',
      codes: [
        'MSEG',
        'MATDOC',
        'QAMB',
        'QALS',
        'QAVE',
        'I_InspectionLot',
        'I_InspLotUsageDecision',
      ],
    },
    pp: {
      label: 'Production order & components',
      detail:
        'Use the order’s reservation to find its components, then check related goods issues or receipts.',
      codes: ['AFKO', 'AFPO', 'RESB', 'MSEG', 'MATDOC'],
    },
    bp: {
      label: 'Supplier & business partner',
      detail:
        'Look up supplier general, purchasing and accounting data. In S/4HANA, use the CVI link to resolve the Business Partner.',
      codes: ['LFA1', 'LFB1', 'LFM1', 'CVI_VEND_LINK', 'BUT000'],
    },
  };
  const checkedAt = '2026-11-14';
  root.WorkHubSapTablesData = {
    systems,
    modules,
    sources,
    tables,
    relationships,
    workflows,
    checkedAt,
  };
})(window);
