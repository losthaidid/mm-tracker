/** SAP MM starter reference. Summarized from linked SAP sources; checked 21 October 2026. */
(function sapTcodeData(root) {
  'use strict';
  const sources = {
    po: ['SAP: purchase order transactions', 'https://help.sap.com/docs/SAP_ERP/314543b557664914af50fde2261cea57/8780b65334e6b54ce10000000a174cb4.html'],
    docs: ['SAP: purchasing document transactions', 'https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/9905622a5c1f49ba84e9076fc83a9c2c/028f6754e90d8c4ce10000000a4450e5.html'],
    reports: ['SAP: materials management reports', 'https://help.sap.com/docs/PRODUCT_ID/9905622a5c1f49ba84e9076fc83a9c2c/42e8e557f828ef32e10000000a441470.html'],
    material: ['SAP: material master transactions', 'https://help.sap.com/docs/SUPPORT_CONTENT/ldm/3363506423.html'],
    product: ['SAP: S/4HANA product master', 'https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/95ad0cb1c441447888d695da7f3fd3d9/dbf1c759001b4cf2b40aa976d214884b.html'],
    inventory: ['SAP: ERP inventory and support transactions', 'https://help.sap.com/docs/SUPPORT_CONTENT/sewm/3900061781.html'],
    stock: ['SAP: S/4HANA inventory reporting', 'https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/95f56a29a41e4861ba3424598848ee2b/4d70f69ead444195e10000000a42189c.html?locale=en-US'],
    invoice: ['SAP: invoice document processing', 'https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/ed84b70c199d4470ae2e5ccb93b2e45b/7c71b6531de6b64ce10000000a174cb4.html'],
    mrbr: ['SAP: releasing invoices', 'https://help.sap.com/docs/SAP_ERP/248c3cdd7e6548999a7f5b95118f4522/3a26f3673c9943aea594b39ec1074acb.html'],
    grir: ['SAP: GR/IR account maintenance', 'https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/e3dc5400c1cc41d1bc0ae0e7fd9aa5a2/a15c5c723b9646fb89079190ba482f23.html'],
    release: ['SAP: classic release strategy transactions', 'https://help.sap.com/docs/SUPPORT_CONTENT/spmm/3362168095.html'],
    info: ['SAP: purchasing information records', 'https://help.sap.com/docs/CARAB/e95c8443f589486bbfec99331049704a/0f29f462b9334f0e9ec9ec93f910013e.html'],
    vendor: ['SAP: supplier maintenance and BP simplification', 'https://help.sap.com/doc/f2591a6901344c97a5e2029cc8f3703e/2021/en-US/SIMPL_OP2021.pdf'],
    rfq: ['SAP: classic RFQ transaction scope', 'https://help.sap.com/doc/PRODUCTION/pdfa4322f56824ae221e10000000a4450e5/1610%20001/en-US/SIMPL_OP1610_FPS01.pdf'],
    account: ['SAP: automatic account determination', 'https://help.sap.com/docs/SUPPORT_CONTENT/fiaccounting/3361880193.html'],
    movement: ['SAP: movement type configuration', 'https://help.sap.com/docs/SUPPORT_CONTENT/sewm/5597019225.html?locale=en-US'],
    support: ['SAP: on-premise troubleshooting tools', 'https://help.sap.com/docs/signavio-process-intelligence/onboarding-and-data-integration-guide/troubleshooting-data-collection-sap-on-premise-systems']
  };
  const rows = [];
  function add(category, area, source, entries, systems = ['ECC', 'S4'], s4Note = '') {
    for (const [code, title] of entries) rows.push({
      id: 'sap-' + code.toLowerCase(), code, title, category, area, systems: [...systems],
      eccNote: '', s4Note, notes: '', favorite: false, archived: false,
      sourceTitle: sources[source][0], sourceUrl: sources[source][1], origin: 'starter',
      checkedAt: '2026-10-21', updatedAt: ''
    });
  }
  add('Transactions', 'Purchasing', 'po', [['ME21N','Create purchase order'],['ME22N','Change purchase order'],['ME23N','Display purchase order']]);
  add('Transactions', 'Purchasing', 'docs', [['ME51N','Create purchase requisition'],['ME52N','Change purchase requisition'],['ME53N','Display purchase requisition'],['ME31K','Create purchasing contract'],['ME32K','Change purchasing contract'],['ME33K','Display purchasing contract'],['ME31L','Create scheduling agreement'],['ME32L','Change scheduling agreement'],['ME33L','Display scheduling agreement'],['ME38','Maintain agreement delivery schedule']]);
  add('Transactions', 'Approvals & services', 'release', [['ME54N','Release purchase requisition'],['ME55','Collectively release requisitions'],['ME29N','Release purchase order'],['ME28','Collectively release purchase orders'],['ME35K','Release purchasing contract'],['ME35L','Release scheduling agreement'],['ML81N','Maintain service entry sheet'],['ML85','Release service entry sheets']], ['ECC','S4'], 'Classic release/service-entry reference. Flexible workflow and lean-service apps depend on configuration and release.');
  add('Transactions', 'Inventory', 'inventory', [['MIGO','Post or display goods movement'],['MB21','Create reservation'],['MB22','Change reservation'],['MB23','Display reservation']]);
  add('Transactions', 'Invoice verification', 'invoice', [['MIRO','Enter supplier invoice'],['MIR7','Park supplier invoice'],['MIR4','Display supplier invoice'],['MR8M','Cancel supplier invoice']]);
  add('Transactions', 'Invoice verification', 'mrbr', [['MRBR','Release blocked invoices']]);
  add('Transactions', 'Invoice verification', 'grir', [['MR11','Maintain GR/IR clearing account']]);
  add('Master data', 'Materials', 'material', [['MM01','Create material'],['MM02','Change material'],['MM03','Display material'],['MM04','Display material changes'],['MM06','Flag material for deletion'],['MM17','Mass-maintain materials']]);
  add('Master data', 'Purchasing', 'info', [['ME11','Create purchasing info record'],['ME12','Change purchasing info record'],['ME13','Display purchasing info record']]);
  add('Master data', 'Suppliers', 'vendor', [['XK01','Create supplier centrally'],['XK02','Change supplier centrally'],['XK03','Display supplier centrally'],['MK01','Create supplier purchasing data'],['MK02','Change supplier purchasing data'],['MK03','Display supplier purchasing data']], ['ECC'], 'Use the Business Partner (BP) supplier interface in S/4HANA; classic codes can redirect to BP.');
  add('Master data', 'Suppliers', 'vendor', [['BP','Maintain business partner / supplier']], ['S4'], 'Primary supplier maintenance interface in S/4HANA. Required business-partner roles depend on configuration.');
  add('Reporting', 'Purchasing', 'reports', [['ME2N','Purchasing documents by document number'],['ME2L','Purchase orders by supplier'],['ME2M','Purchase orders by material'],['ME2K','Purchasing documents by account assignment'],['ME2C','Purchase orders by material group'],['ME2B','Purchasing documents by tracking number'],['ME2W','Purchasing documents by supplying plant'],['ME5A','Purchase requisition list']]);
  add('Reporting', 'Inventory', 'inventory', [['MB51','Material document list'],['MB52','Warehouse stock list'],['MB5B','Stock on posting date'],['MB24','Reservation list'],['MB5L','Stock value balances'],['MB54','Consignment stock list'],['MB56','Batch where-used list']]);
  add('Reporting', 'Materials', 'material', [['MMBE','Stock overview'],['MM60','Material list']]);
  add('Transactions', 'RFQ & quotations', 'rfq', [['ME41','Create request for quotation'],['ME42','Change request for quotation'],['ME43','Display request for quotation'],['ME47','Maintain quotation'],['ME48','Display quotation']], ['ECC','S4'], 'Classic RFQ reference. SAP identifies these as non-strategic; evaluate the RFQ/Fiori process for your S/4HANA release.');
  add('Reporting', 'RFQ & quotations', 'rfq', [['ME49','Compare quotation prices']], ['ECC','S4'], 'Classic quotation comparison; assess the sourcing apps in your S/4HANA release.');
  add('Configuration', 'MM configuration', 'account', [['SPRO','Open SAP Reference IMG'],['OBYC','Configure MM automatic postings']]);
  add('Configuration', 'Inventory', 'movement', [['OMJJ','Maintain movement type settings']]);
  add('Support', 'Troubleshooting', 'support', [['SLG1','Analyze application log'],['ST22','Analyze ABAP runtime errors'],['SU53','Inspect failed authorization checks']]);
  add('Support', 'Integration', 'inventory', [['SMQ1','Monitor outbound qRFC queue'],['SMQ2','Monitor inbound qRFC queue'],['SE93','Inspect transaction definition']]);
  root.WorkHubSapTcodeData = { rows, sources, checkedAt: '2026-10-21' };
})(window);
