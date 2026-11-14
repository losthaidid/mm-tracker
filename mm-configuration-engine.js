/** Deterministic examples. Saved configuration is a private overlay on the reference data. */
(function (root) {
  'use strict';
  const D = root.WorkHubMmConfigurationData;
  const kinds = {
    material: 'materials',
    movement: 'movements',
    plant: 'plants',
    account: 'accounts',
  };
  const moveByCode = new Map(D.moves.map(move => [move.code, move]));
  const scenarioById = new Map(D.scenarios.map(scenario => [scenario.id, scenario]));
  const code = value =>
    String(value ?? '')
      .trim()
      .toUpperCase();
  const fields = value => [
    ...new Set(
      code(value)
        .split(/[\s,]+/)
        .filter(Boolean)
    ),
  ];
  const text = (value, max, required = false) =>
    typeof value === 'string' && value.length <= max && (!required || !!value.trim());
  const token = (value, max, optional = false) =>
    text(value, max) && ((optional && value === '') || /^[A-Z0-9_]+$/.test(value));
  const fixed = (value, length, optional = false) =>
    token(value, length, optional) && (value.length === length || (optional && value === ''));
  const docRows = (d, kind) => d.workhub?.mmConfiguration?.[kinds[kind]] || [];

  const recordFields = {
    material: ['code', 'name', 'area', 'quantity', 'value', 'reference', 'classes'],
    movement: ['code', 'name', 'base', 'reversal', 'required', 'modifier'],
    plant: ['code', 'name', 'area', 'company', 'chart', 'group'],
    account: ['name', 'chart', 'key', 'group', 'modifier', 'valuationClass', 'side', 'gl'],
  };

  function validate(d) {
    const profile = d.workhub?.mmConfiguration;
    if (profile === undefined) return;
    if (
      !profile ||
      Array.isArray(profile) ||
      typeof profile !== 'object' ||
      Object.keys(profile).some(key => !Object.values(kinds).includes(key))
    ) {
      throw Error('Check the saved MM Configuration.');
    }
    for (const [kind, collection] of Object.entries(kinds)) {
      const rows = profile[collection];
      if (rows === undefined) continue;
      if (!Array.isArray(rows) || rows.length > 500)
        throw Error('MM Configuration supports up to 500 entries per list.');
      const ids = new Set();
      const identities = new Set();
      const allowedFields = new Set(['id', 'kind', 'notes', ...recordFields[kind]]);
      for (const row of rows) {
        if (
          !row ||
          row.kind !== kind ||
          !text(row.id, 100, true) ||
          ids.has(row.id) ||
          !text(row.notes, 2000) ||
          Object.keys(row).some(field => !allowedFields.has(field)) ||
          !validators[kind](row)
        ) {
          throw Error('Check the saved ' + kind + ' configuration.');
        }
        const identity = recordKey(row);
        if (identities.has(identity))
          throw Error('A ' + kind + ' entry already uses this combination.');
        ids.add(row.id);
        identities.add(identity);
      }
    }
  }

  const validators = {
    material: row =>
      fixed(row.code, 4) &&
      text(row.name, 120, true) &&
      fixed(row.area, 4, true) &&
      typeof row.quantity === 'boolean' &&
      typeof row.value === 'boolean' &&
      (!row.value || row.quantity) &&
      fixed(row.reference, 4, true) &&
      text(row.classes, 150) &&
      fields(row.classes).every(value => fixed(value, 4)),
    movement: row =>
      fixed(row.code, 3) &&
      text(row.name, 120, true) &&
      moveByCode.has(row.base) &&
      (moveByCode.has(row.code) ? row.base === row.code : /^[9XYZ]/.test(row.code)) &&
      fixed(row.reversal, 3, true) &&
      token(row.modifier, 3, true) &&
      text(row.required, 180),
    plant: row =>
      fixed(row.code, 4) &&
      text(row.name, 120, true) &&
      fixed(row.area, 4) &&
      fixed(row.company, 4) &&
      token(row.chart, 4) &&
      token(row.group, 4, true),
    account: row =>
      token(row.chart, 4) &&
      fixed(row.key, 3) &&
      token(row.group, 4, true) &&
      token(row.modifier, 3, true) &&
      fixed(row.valuationClass, 4, true) &&
      ['both', 'debit', 'credit'].includes(row.side) &&
      token(row.gl, 10) &&
      text(row.name, 120),
  };

  function recordKey(row) {
    if (row.kind === 'material') return row.code + '/' + row.area;
    if (row.kind === 'account')
      return [row.chart, row.key, row.group, row.modifier, row.valuationClass, row.side].join('/');
    return row.code;
  }

  function save(d, row) {
    const entry = { ...row };
    for (const key of [
      'code',
      'area',
      'reference',
      'classes',
      'base',
      'reversal',
      'modifier',
      'company',
      'chart',
      'group',
      'key',
      'valuationClass',
      'gl',
    ]) {
      if (Object.hasOwn(entry, key)) entry[key] = code(entry[key]);
    }
    const collection = kinds[row.kind];
    if (entry.kind === 'material' && entry.value && !entry.quantity)
      throw Error(
        'Enable Quantity Update before enabling Value Update for this inventory material.'
      );
    if (!collection || !validators[row.kind](entry))
      throw Error('Check the required fields and SAP code lengths.');
    const config = (d.workhub.mmConfiguration ||= {});
    const rows = (config[collection] ||= []);
    const index = rows.findIndex(record => record.id === entry.id);
    if (rows.some(record => record.id !== entry.id && recordKey(record) === recordKey(entry)))
      throw Error('This combination already exists. Open it to edit the saved settings.');
    if (index < 0) rows.push(entry);
    else rows[index] = entry;
    validate(d);
  }

  function remove(d, kind, id) {
    const collection = kinds[kind];
    if (collection && d.workhub.mmConfiguration?.[collection])
      d.workhub.mmConfiguration[collection] = docRows(d, kind).filter(row => row.id !== id);
  }

  function entries(d, kind) {
    const defaults = { material: D.materials, movement: D.moves, plant: D.plants }[kind] || [];
    const saved = docRows(d, kind);
    return [...defaults, ...saved].sort((a, b) => recordKey(a).localeCompare(recordKey(b)));
  }

  function choices(d, kind, area = '') {
    const saved = docRows(d, kind).filter(
      row => kind !== 'material' || !row.area || row.area === area
    );
    const standard = { material: D.materials, movement: D.moves, plant: D.plants }[kind] || [];
    const byCode = new Map();
    for (const row of [...standard, ...saved]) {
      const current = byCode.get(row.code);
      if (kind !== 'material' || !current?.area || row.area) byCode.set(row.code, row);
    }
    return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  function blank(kind, d, plantCode) {
    const plant = choices(d, 'plant').find(row => row.code === plantCode);
    const common = { id: '', kind, notes: '' };
    if (kind === 'material')
      return {
        ...D.materials[0],
        ...common,
        code: '',
        name: '',
        area: plant?.area || '',
        classes: '',
      };
    if (kind === 'movement') return { ...D.moves[0], ...common, code: '', name: '' };
    if (kind === 'plant')
      return { ...common, code: '', name: '', area: '', company: '', chart: '', group: '' };
    return {
      ...common,
      key: 'BSX',
      name: '',
      chart: plant?.chart || '',
      group: plant?.group || '',
      modifier: '',
      valuationClass: '',
      side: 'both',
      gl: '',
    };
  }

  function defaults(scenario) {
    return {
      edition: 's4',
      plant: '1000',
      receivingPlant: scenario.route === 'cross-company' ? '2000' : '1100',
      material: scenario.material,
      valuationClass: '',
      movements: {},
      targetMaterialCode: scenario.material,
      quantity: '10',
      priceControl: 'S',
      poPrice: '10',
      stockPrice: '10',
      invoicePrice: String(scenario.invoicePrice ?? 10),
      stockCoverage: '100',
      category: scenario.category,
      costAccount: '',
      accountObject: '',
      assignmentModifier: '',
      receiptEnabled: !scenario.noReceipt,
      nonValuated: !!scenario.nonValuated,
      grBased: false,
      qm: false,
      blockedInvoice: false,
      referenceReady: true,
      itemAllowsReceipt: true,
      sameUnit: true,
    };
  }

  const label = {
    bsx: 'Inventory',
    wrx: 'GR/IR clearing',
    vendor: 'Supplier reconciliation',
    prd: 'Price difference',
    cost: 'Consumption / cost account',
    asset: 'Fixed asset',
  };
  const amount = value =>
    value == null || !Number.isFinite(value)
      ? null
      : Math.round((value + Number.EPSILON) * 100) / 100;
  const makeLine = (side, name, key = '', modifier = '', value = null, scope = '') => ({
    side,
    name,
    key,
    modifier,
    amount: amount(value),
    scope,
  });

  function inventoryPair(c, side, offset, key, modifier, value = c.stockTotal) {
    if (!amount(value)) return [];
    const inventory = makeLine(side, label.bsx, 'BSX', '', value);
    const matching = makeLine(side === 'debit' ? 'credit' : 'debit', offset, key, modifier, value);
    return side === 'debit' ? [inventory, matching] : [matching, inventory];
  }

  function difference(lines, value, name, key) {
    if (amount(value))
      lines.push(makeLine(value > 0 ? 'debit' : 'credit', name, key, '', Math.abs(value)));
  }

  function goodsReceipt(c, direction = 1) {
    if (c.nonValuated) return [];
    const debit = direction > 0 ? 'debit' : 'credit';
    const credit = direction > 0 ? 'credit' : 'debit';
    if (c.assigned && !c.crossReceipt) {
      const to = c.category === 'A' ? label.asset : label.cost;
      return c.poTotal
        ? [
            makeLine(debit, to, '', '', c.poTotal, 'assignment'),
            makeLine(credit, label.wrx, 'WRX', '', c.poTotal),
          ]
        : [];
    }
    if (!c.material?.value) return [];
    const standard = c.priceControl === 'S';
    const clearingValue = c.invoicePosted ? c.invoiceTotal : c.poTotal;
    const inventoryValue = standard ? c.stockTotal : clearingValue;
    const lines = [
      makeLine(debit, label.bsx, 'BSX', '', inventoryValue),
      makeLine(credit, label.wrx, 'WRX', '', clearingValue),
    ];
    if (standard) difference(lines, (clearingValue - c.stockTotal) * direction, label.prd, 'PRD');
    return lines.filter(line => line.amount !== 0);
  }

  function supplierInvoice(c, direction = 1) {
    const total = c.invoiceTotal;
    const debit = direction > 0 ? 'debit' : 'credit';
    const credit = direction > 0 ? 'credit' : 'debit';
    const payable = makeLine(credit, label.vendor, '', '', total, 'supplier');
    if (c.assigned && (c.nonValuated || !c.receiptEnabled)) {
      const to = c.category === 'A' ? label.asset : label.cost;
      return [makeLine(debit, to, '', '', total, 'assignment'), payable];
    }
    if (!c.receiptPosted && c.scenario.group !== 'returns')
      return [makeLine(debit, label.wrx, 'WRX', '', total), payable];
    const lines = [makeLine(debit, label.wrx, 'WRX', '', c.poTotal)];
    const variance = (total - c.poTotal) * direction;
    if (c.assigned) {
      if (amount(variance))
        lines.push(
          makeLine(
            variance > 0 ? 'debit' : 'credit',
            c.category === 'A' ? label.asset : label.cost,
            '',
            '',
            Math.abs(variance),
            'assignment'
          )
        );
    } else if (c.priceControl === 'V') {
      const toStock = amount((variance * c.stockCoverage) / 100);
      difference(lines, toStock, label.bsx, 'BSX');
      difference(lines, variance - toStock, label.prd, 'PRD');
    } else {
      difference(lines, variance, label.prd, 'PRD');
    }
    return [...lines, payable];
  }

  const documents = {
    material: 'Material document',
    fi: 'FI accounting document',
    poHistory: 'PO history updated',
    invoice: 'Supplier invoice document',
    ses: 'Service entry sheet',
    lot: 'QM inspection lot (when triggered)',
  };

  const outcome = (
    summary,
    docs,
    stock = 'Unchanged',
    value = 'Unchanged',
    lines = [],
    notes = []
  ) => ({ summary, docs, stock, value, lines, notes, status: 'completed' });
  const skipped = (summary, status = 'blocked') => ({ ...outcome(summary, []), status });
  const materialDocs = fi => [documents.material, ...(fi ? [documents.fi] : [])];
  function stockReceipt(c, lines) {
    if (c.assigned && (c.direct || !c.material?.quantity || c.material.value) && !c.crossReceipt)
      return {
        stock: c.isService
          ? 'No inventory quantity'
          : 'Received for consumption or account assignment',
        value: 'Unchanged',
      };
    return {
      stock: c.material?.quantity ? '+' + c.qty + ' to stock' : 'Unchanged',
      value: lines.some(line => line.key === 'BSX') ? 'Increases' : 'Unchanged',
    };
  }

  function purchasingBlock(c) {
    if (!c.assigned && (c.direct || (!c.isService && !c.material?.value)))
      return 'Choose a PO account assignment category. The selected material or scenario requires an account assignment for this purchase.';
    return '';
  }
  function issueOffset(s) {
    if (s.mode === 'asset') return ['Asset acquisition', '', ''];
    if (s.movement === '551') return ['Scrapping expense', 'GBB', s.move.modifier];
    if (s.movement === '702') return ['Inventory difference expense', 'GBB', s.move.modifier];
    return [label.cost, 'GBB', s.move.modifier];
  }
  function movementContext(s) {
    if (s.move?.id && s.move.required)
      return 'Verify the required reference for ' + s.move.code + ' — ' + s.move.required + '.';
    return '';
  }

  const rules = {
    pr(c) {
      const reason = purchasingBlock(c);
      return reason
        ? skipped(reason)
        : outcome('Record the requirement for purchasing.', ['Purchase requisition']);
    },
    po(c) {
      const reason = purchasingBlock(c);
      return reason
        ? skipped(reason)
        : outcome(
            c.assigned
              ? 'Create the PO with its account assignment. Review the proposed G/L or asset.'
              : 'Create the purchase order for the supplier or relevant purchasing flow.',
            ['Purchase order']
          );
    },
    sto() {
      return outcome('The receiving plant orders stock from the supplying plant.', [
        'Stock transport order',
      ]);
    },
    order() {
      return outcome('Use the order or reservation as the reference for the material movement.', [
        'Production order / reservation reference',
      ]);
    },
    delivery() {
      return outcome('Create or reference the outbound delivery for picking and goods issue.', [
        'Outbound delivery',
      ]);
    },
    gr(c, s) {
      const reason = purchasingBlock(c);
      if (reason) return skipped(reason);
      if (!c.itemAllowsReceipt)
        return skipped(
          'The selected PO item category does not permit a goods receipt. Check the item and account assignment category combination.',
          'skipped'
        );
      if (!c.receiptEnabled)
        return skipped(
          'Goods Receipt is off on the PO item. Check the item category and PO Delivery tab.',
          'skipped'
        );
      if (s.movement === '107' && (c.nonValuated || !c.material?.value || c.assigned))
        return skipped(
          'This origin-acceptance example requires a valuated stock PO with origin acceptance.'
        );
      const lines = goodsReceipt(c);
      const impact = stockReceipt(c, lines);
      if (s.movement === '107') impact.stock = '+' + c.qty + ' in valuated GR blocked stock';
      const docs = [...materialDocs(lines.length), documents.poHistory];
      if (c.qm && s.movement !== '107') docs.push(documents.lot);
      return outcome(
        c.nonValuated
          ? 'Record the receipt now. For an account-assigned PO, the value posts at invoice receipt.'
          : c.assigned
            ? 'Post the valuated receipt to the account assignment from the PO.'
            : 'Receive into inventory and post the corresponding GR/IR amount.',
        docs,
        impact.stock,
        impact.value,
        lines
      );
    },
    statisticalGr(c) {
      if (!c.receiptEnabled)
        return skipped(
          'The third-party PO allows invoicing without this statistical receipt.',
          'skipped'
        );
      return outcome(
        'Record the supplier delivery to the customer as a statistical receipt.',
        [documents.material, documents.poHistory],
        'Own stock unchanged',
        'Unchanged'
      );
    },
    customerBilling() {
      return outcome(
        'Create SD billing when the sales item is billing relevant.',
        ['Customer billing document when applicable', 'FI posting from billing when relevant'],
        'Unchanged',
        'Unchanged',
        [],
        ['Check whether customer billing is based on order quantity or the supplier invoice.']
      );
    },
    freeReceipt(c) {
      if (!c.material?.quantity)
        return skipped('The selected material has no inventory quantity update.');
      const valuedAtStandard = c.material.value && c.priceControl === 'S';
      const lines = valuedAtStandard
        ? inventoryPair(c, 'debit', 'Revenue from price differences', 'PRD', '')
        : [];
      return outcome(
        'Receive free stock from a supplier. The material’s price control determines the valuation effect.',
        materialDocs(lines.length),
        '+' + c.qty + ' to stock',
        valuedAtStandard ? 'Increases' : 'Unchanged',
        lines,
        [
          c.material?.value && c.priceControl === 'V'
            ? 'Stock quantity increases at zero incoming value. Moving average price can decrease.'
            : '',
          'Check the price-difference account used by your system for a standard-price 511 receipt.',
        ].filter(Boolean)
      );
    },
    blocked(c) {
      if (!c.itemAllowsReceipt || !c.receiptEnabled)
        return skipped('The selected PO settings do not allow goods receipt.');
      if (c.assigned || !c.material?.value)
        return skipped('This GR blocked stock example uses a valuated stock PO.');
      return outcome(
        'Record the conditional delivery. Stock and value update at release with 105.',
        [documents.material, documents.poHistory],
        '+' + c.qty + ' recorded as GR blocked'
      );
    },
    blockedReturn(c) {
      return outcome(
        'Return the unaccepted delivery from non-valuated GR blocked stock.',
        [documents.material, documents.poHistory],
        'GR blocked quantity decreases by ' + c.qty
      );
    },
    receipt(c, s) {
      if (!c.material?.quantity)
        return skipped('The material has no inventory quantity update for this valuation area.');
      const offset =
        s.movement === '701'
          ? 'Inventory difference gain'
          : s.movement === '561'
            ? 'Opening stock offset'
            : 'Stock change account';
      const lines = c.material.value
        ? inventoryPair(c, 'debit', offset, 'GBB', s.move.modifier)
        : [];
      return outcome(
        'Post the incoming quantity at the existing valuation price when value updating applies.',
        materialDocs(lines.length),
        '+' + c.qty + ' to stock',
        lines.length ? 'Increases' : 'Unchanged',
        lines
      );
    },
    productionGr(c, s) {
      if (!c.material?.quantity)
        return skipped('This finished-material receipt requires quantity-managed stock.');
      const lines = c.material.value
        ? inventoryPair(
            c,
            'debit',
            'Production order offset',
            'GBB',
            s.move.id ? s.move.modifier : 'AUF'
          )
        : [];
      return outcome(
        'Receive the finished product. Order credit and costing follow production accounting.',
        [...materialDocs(lines.length), 'Production order updated'],
        '+' + c.qty + ' to stock',
        lines.length ? 'Increases' : 'Unchanged',
        lines
      );
    },
    issue(c, s) {
      if (!c.material?.quantity)
        return skipped('No quantity-managed warehouse stock is available for this material type.');
      const [name, key, modifier] = issueOffset(s);
      const lines = c.material.value ? inventoryPair(c, 'credit', name, key, modifier) : [];
      if (s.mode === 'asset' && lines.length) lines[0].scope = 'asset';
      return outcome(
        'Remove the quantity from warehouse stock. The movement determines the offset where FI applies.',
        materialDocs(lines.length),
        '−' + c.qty + ' from stock',
        lines.length ? 'Decreases' : 'Unchanged',
        lines
      );
    },
    reverseIssue(c, s) {
      if (!c.material?.quantity)
        return skipped('Select the material used in the original stock issue.');
      const lines = c.material.value
        ? inventoryPair(c, 'debit', label.cost, 'GBB', s.move.modifier)
        : [];
      return outcome(
        'Reverse the cost-center issue against the original material document.',
        materialDocs(lines.length),
        '+' + c.qty + ' back to stock',
        lines.length ? 'Increases' : 'Unchanged',
        lines
      );
    },
    deliveryIssue(c, s) {
      if (!c.material?.quantity)
        return skipped('The outbound delivery example requires quantity-managed own stock.');
      const lines = c.material.value
        ? inventoryPair(
            c,
            'credit',
            'Cost of goods sold',
            'GBB',
            s.move.modifier || (s.movement === '643' ? 'VAX' : '')
          )
        : [];
      return outcome(
        'Post goods issue against the delivery. Billing and revenue follow the sales flow.',
        [...materialDocs(lines.length), 'Outbound delivery updated'],
        '−' + c.qty + ' from stock',
        lines.length ? 'Decreases' : 'Unchanged',
        lines,
        ['Check the SD account assignment and special stock when determining the exact offset.']
      );
    },
    reclass(c, s) {
      if (!c.material?.quantity)
        return skipped('Select a quantity-managed material for this transfer.');
      if (s.movement === '109')
        return outcome(
          'Release the accepted quantity into warehouse stock. Value was posted at origin acceptance.',
          [documents.material, documents.poHistory],
          c.qty + ' moves to warehouse stock'
        );
      const stock =
        {
          313: c.qty + ' to stock in transfer',
          315: c.qty + ' from stock in transfer to receiving location',
          305: c.qty + ' from stock in transfer to receiving plant',
          101: c.qty + ' from stock in transit to receiving plant',
        }[s.movement] || c.qty + ' moves between stock locations or categories';
      return outcome(
        'Update stock quantities within this scenario. The stock reclassification adds no FI posting.',
        [documents.material, ...(s.movement === '101' ? [documents.poHistory] : [])],
        stock
      );
    },
    transfer(c, s) {
      if (!c.material?.quantity || !c.targetMaterial?.quantity)
        return skipped('Check quantity-managed stock and the material extension for both plants.');
      if (!c.sameArea && c.material.value !== c.targetMaterial?.value)
        return skipped(
          'Check the material’s value update and accounting settings for both valuation areas.'
        );
      const differentAreas = !c.sameArea && c.material.value;
      const lines = differentAreas
        ? [
            makeLine('debit', 'Receiving plant inventory', 'BSX', '', c.stockTotal, 'receiving'),
            makeLine('credit', 'Supplying plant inventory', 'BSX', '', c.stockTotal),
          ]
        : [];
      const notes = differentAreas
        ? [
            'Illustration uses the same unit value in both valuation areas. Check transfer-price or clearing differences and the number of FI documents in SAP.',
          ]
        : [];
      const stock =
        s.movement === '301'
          ? c.qty + ' moves immediately to the receiving plant'
          : c.qty + ' enters stock in transfer or in transit';
      return outcome(
        differentAreas
          ? 'Move value between valuation areas as well as shifting stock.'
          : 'Move quantity using the selected transfer route.',
        materialDocs(lines.length),
        stock,
        differentAreas ? 'Moves between valuation areas' : 'Unchanged',
        lines,
        notes
      );
    },
    materialTransfer(c) {
      if (!c.material?.quantity || !c.targetMaterial?.quantity)
        return skipped('Both materials need quantity-managed stock and valid valuation settings.');
      if (!c.sameUnit)
        return skipped('Movement 309 requires the same base unit of measure for both materials.');
      if (c.material.value !== c.targetMaterial.value)
        return skipped('Verify the value update for both materials before modeling this transfer.');
      const lines = c.material.value
        ? [
            makeLine(
              'debit',
              'Receiving material inventory',
              'BSX',
              '',
              c.stockTotal,
              'targetMaterial'
            ),
            makeLine('credit', 'Issuing material inventory', 'BSX', '', c.stockTotal),
          ]
        : [];
      return outcome(
        'Decrease the sending material and increase the receiving material.',
        materialDocs(lines.length),
        c.qty + ' shifts to the receiving material',
        lines.length ? 'Moves between materials' : 'Unchanged',
        lines,
        [
          'Check the valuation class and price control of both materials. An additional difference posting can apply.',
        ]
      );
    },
    crossIssue(c, s) {
      const result = rules.deliveryIssue(c, s);
      result.notes.push(
        'The supplying company posts its goods issue. The receiving company values its PO receipt separately.'
      );
      return result;
    },
    crossReceipt(c) {
      if (!c.targetMaterial?.quantity || !c.targetMaterial?.value)
        return skipped('The buying company must have a valuated stock material for this example.');
      const lines = goodsReceipt({ ...c, material: c.targetMaterial, crossReceipt: true }).map(
        line => ({ ...line, scope: 'receiving' })
      );
      return outcome(
        'Post the goods receipt in the buying company against its PO.',
        [...materialDocs(lines.length), documents.poHistory],
        '+' + c.qty + ' in receiving stock',
        'Increases in buying company',
        lines
      );
    },
    billing(c) {
      return outcome(
        'Bill the buying company from the supplying company when the delivery is billing relevant.',
        ['Intercompany billing document', documents.fi],
        'Unchanged',
        'Unchanged',
        [],
        ['Exact revenue, reconciliation and clearing accounts depend on SD and FI configuration.']
      );
    },
    return(c, s) {
      if (!c.material?.quantity && !c.assigned)
        return skipped('Select the original stock or account-assigned receipt conditions.');
      const lines = goodsReceipt(c, -1);
      const receipt = stockReceipt(c, lines);
      const stock =
        s.movement === '108'
          ? '−' + c.qty + ' from valuated GR blocked stock'
          : receipt.stock.startsWith('+')
            ? '−' + c.qty + ' from stock'
            : 'Reverse the received quantity on the PO item';
      return outcome(
        ['102', '108'].includes(s.movement)
          ? 'Cancel the original goods receipt.'
          : 'Post the supplier return. The credit memo is a separate invoice step when required.',
        [...materialDocs(lines.length), documents.poHistory],
        stock,
        receipt.value === 'Increases' ? 'Decreases' : 'Unchanged',
        lines,
        [
          'For a reversal, SAP uses the original document. This illustration uses the quantities and prices entered above.',
        ]
      );
    },
    provision(c) {
      if (!c.material?.quantity)
        return skipped('Check which components are quantity-managed and available for provision.');
      return outcome(
        'Provide components while retaining ownership of the stock.',
        materialDocs(false),
        'Component quantity moves to stock provided to supplier'
      );
    },
    subGr(c) {
      if (!c.material?.value || !c.material.quantity)
        return skipped('This example receives a valuated subcontracted product into own stock.');
      return outcome(
        'Receive the subcontracted material. SAP valuates the service and components.',
        [...materialDocs(true), documents.poHistory],
        '+' + c.qty + ' to stock',
        'Increases',
        [],
        [
          'The purchasing condition and each component valuation determine the exact posting. Check BSX, WRX and the applicable subcontracting keys.',
        ]
      );
    },
    subConsumption(c) {
      return outcome(
        'Record components consumed from stock provided to the supplier at the 101 receipt.',
        [
          'Component lines in the receipt document',
          'FI postings included in the receipt when relevant',
        ],
        'Component stock decreases',
        'Component value decreases for valuated stock',
        [],
        [
          'Check the component quantity, valuation class and GBB account modifier for each component.',
        ]
      );
    },
    consignmentGr(c) {
      if (!c.material?.quantity)
        return skipped('Supplier consignment requires quantity-managed stock in this example.');
      return outcome(
        'Receive into supplier-owned special stock K.',
        [...materialDocs(false), documents.poHistory],
        '+' + c.qty + ' in supplier consignment stock'
      );
    },
    consignmentOwn(c) {
      if (!c.material?.value || !c.material.quantity)
        return skipped('Transfer to a quantity- and value-managed own-stock material.');
      const lines = inventoryPair(c, 'debit', 'Consignment liability', 'KON', '', c.poTotal);
      return outcome(
        'Move supplier-owned stock to own stock and recognize the liability.',
        materialDocs(lines.length),
        c.qty + ' moves from consignment to own stock',
        'Own stock value increases',
        lines,
        [
          'Example assumes the consignment price is the inventory valuation amount. Check the info record, price control and any difference postings.',
        ]
      );
    },
    pipeline(c) {
      if (!c.assigned) return skipped('Choose the receiving cost object for pipeline consumption.');
      const lines = [
        makeLine('debit', label.cost, 'GBB', 'VBR', c.poTotal),
        makeLine('credit', 'Pipeline liability', 'KON', '', c.poTotal),
      ];
      return outcome(
        'Record direct consumption and supplier liability at the pipeline price.',
        materialDocs(lines.length),
        'Own warehouse stock unchanged',
        'Unchanged',
        lines
      );
    },
    settlement(c) {
      const lines = [
        makeLine('debit', 'Consignment / pipeline liability', 'KON', '', c.poTotal),
        makeLine('credit', label.vendor, '', '', c.poTotal, 'supplier'),
      ];
      return outcome(
        'Settle eligible supplier withdrawals through consignment or pipeline settlement.',
        [documents.invoice, documents.fi],
        'Unchanged',
        'Unchanged',
        lines,
        ['Illustration assumes one eligible withdrawal and excludes tax.']
      );
    },
    serviceEntry(c) {
      if (!c.assigned) return skipped('Add the service PO account assignment first.');
      return outcome(
        'Record the service performed against the service PO and submit it for acceptance.',
        [documents.ses]
      );
    },
    serviceGr(c) {
      if (!c.assigned) return skipped('Check the service PO account assignment.');
      if (!c.receiptEnabled)
        return skipped('This lean service example requires a service receipt enabled on the PO.');
      const lines = goodsReceipt(c);
      return outcome(
        'Approve the lean service entry sheet and record the service receipt.',
        [...materialDocs(lines.length), documents.poHistory],
        'No inventory quantity',
        'Unchanged',
        lines
      );
    },
    inventoryDoc() {
      return outcome('Create a count document for the material and stock segment.', [
        'Physical inventory document',
      ]);
    },
    inventoryCount() {
      return outcome('Save the actual count and compare it with SAP’s book quantity.', [
        'Count recorded in physical inventory document',
      ]);
    },
    invoice(c) {
      const reason =
        c.isService && !c.assigned
          ? 'Choose the service PO account assignment.'
          : purchasingBlock(c);
      if (reason) return skipped(reason);
      if (c.grBased && (!c.receiptEnabled || !c.receiptPosted))
        return skipped(
          'GR-based invoice verification requires an eligible receipt. Check the PO item and post or release the receipt first.'
        );
      const lines = supplierInvoice(c).map(line =>
        c.scenario.route === 'cross-company' && line.key ? { ...line, scope: 'receiving' } : line
      );
      const notes = c.blockedInvoice
        ? [
            'The invoice is posted with a payment block in this example. Check the block reason and the OMR6 tolerance rules.',
          ]
        : [];
      const inventoryChange = lines.find(line => line.key === 'BSX');
      return outcome(
        'Post the supplier invoice against the purchasing reference.',
        [documents.invoice, documents.fi, documents.poHistory],
        'Unchanged',
        inventoryChange
          ? inventoryChange.side === 'debit'
            ? 'Increases'
            : 'Decreases'
          : 'Unchanged',
        lines,
        notes
      );
    },
    credit(c) {
      const lines = supplierInvoice(c, -1);
      return outcome(
        'Record the supplier credit against the corresponding purchasing reference when due.',
        ['Supplier credit memo', documents.fi, documents.poHistory],
        'Unchanged',
        lines.some(line => line.key === 'BSX') ? 'Adjusts for price variance' : 'Unchanged',
        lines
      );
    },
    invoiceCancel() {
      return outcome(
        'Reverse the original logistics invoice or supplier credit document.',
        ['Invoice cancellation document', documents.fi, documents.poHistory],
        'Unchanged',
        'Reverses original stock value adjustment if applicable',
        [],
        [
          'SAP derives the reversal lines from the original invoice. Review linked clearing or payment in FI.',
        ]
      );
    },
    payment(c) {
      if (c.blockedInvoice)
        return skipped(
          'The posted invoice is blocked for payment. Resolve the block before payment.'
        );
      const lines = [
        makeLine('debit', label.vendor, '', '', c.invoiceTotal, 'supplier'),
        makeLine('credit', 'Bank or cash clearing', '', '', c.invoiceTotal, 'fi'),
      ];
      return outcome(
        'Pay and clear the supplier open item when eligible.',
        ['FI payment and clearing document'],
        'Unchanged',
        'Unchanged',
        lines,
        [
          'Check FI payment methods, due date, bank determination, and any tax or exchange-rate adjustments.',
        ]
      );
    },
  };

  function accountFor(d, c, line) {
    if (line.scope === 'assignment' && c.category !== 'A')
      return c.costAccount
        ? { gl: c.costAccount, name: 'G/L supplied for this PO' }
        : c.assignmentAccount;
    if (!line.key) return undefined;
    const receiving = line.scope === 'receiving';
    const plant = receiving ? c.targetPlant : c.sourcePlant;
    if (!plant?.chart) return undefined;
    const cls = receiving || line.scope === 'targetMaterial' ? c.targetClass : c.valuationClass;
    const matches = docRows(d, 'account').filter(
      row =>
        row.key === line.key &&
        row.chart === plant.chart &&
        (!row.group || row.group === plant.group) &&
        row.modifier === line.modifier &&
        (!row.valuationClass || row.valuationClass === cls) &&
        (row.side === 'both' || row.side === line.side)
    );
    if (!matches.length) return undefined;
    const specificity = row =>
      Number(!!row.group) + Number(!!row.valuationClass) + Number(row.side !== 'both');
    const rank = Math.max(...matches.map(specificity));
    const best = matches.filter(row => specificity(row) === rank);
    return best.length === 1 ? best[0] : { ambiguous: true };
  }

  function number(value, fallback, max = 1e7, minimum = 0) {
    const n = value === '' || value == null ? NaN : Number(value);
    return Number.isFinite(n) && n >= minimum && n <= max ? n : fallback;
  }
  function matchingMoves(d, step) {
    return choices(d, 'movement').filter(move => move.base === step.movement);
  }
  const receiptRules = new Set(['gr', 'crossReceipt', 'subGr', 'serviceGr', 'statisticalGr']);
  const independent = new Set(['invoice', 'invoiceCancel', 'credit']);
  function run(d, scenarioId, input = {}) {
    const scenario = scenarioById.get(scenarioId) || D.scenarios[0];
    const options = { ...defaults(scenario), ...input };
    const sourcePlant = choices(d, 'plant').find(p => p.code === options.plant);
    const targetPlant = choices(d, 'plant').find(p => p.code === options.receivingPlant);
    const material = choices(d, 'material', sourcePlant?.area).find(
      m => m.code === options.material
    );
    const targetArea = scenario.receivingPlant ? targetPlant?.area : sourcePlant?.area;
    const targetCode =
      scenario.id === 'material-transfer' ? options.targetMaterialCode : options.material;
    const targetMaterial = choices(d, 'material', targetArea).find(m => m.code === targetCode);
    const qty = number(options.quantity, null, 1e6, 0.001);
    const poPrice = number(options.poPrice, null);
    const stockPrice = number(options.stockPrice, null);
    const invoicePrice = number(options.invoicePrice, null);
    const chosen = code(options.valuationClass);
    const classes = fields(material?.classes);
    const assigned = !!options.category;
    const nonValuated = assigned && (options.nonValuated || scenario.id === 'third-party');
    const c = {
      ...options,
      scenario,
      sourcePlant,
      targetPlant,
      material,
      targetMaterial,
      qty,
      assigned,
      nonValuated,
      valuationClass: chosen || classes[0] || '',
      targetClass: fields(targetMaterial?.classes)[0] || chosen,
      accountObject: String(options.accountObject || '').trim(),
      sameArea: sourcePlant?.area === targetPlant?.area,
      isService: !!scenario.service,
      direct: !!scenario.direct,
      stockCoverage: number(options.stockCoverage, 100, 100),
      stockTotal: amount(qty * stockPrice),
      poTotal: amount(qty * poPrice),
      invoiceTotal: amount(qty * invoicePrice),
      receiptPosted: false,
      invoicePosted: false,
      receiptEnabled: options.receiptEnabled && options.itemAllowsReceipt,
    };
    c.assignmentAccount =
      assigned && options.category !== 'A' && options.assignmentModifier
        ? accountFor(d, c, makeLine('debit', label.cost, 'GBB', code(options.assignmentModifier)))
        : undefined;
    const errors = [];
    if (!sourcePlant) errors.push('Select a supplying or purchasing plant.');
    if (!scenario.service && !material)
      errors.push('Select a material maintained for this valuation area.');
    if (chosen && classes.length && !classes.includes(chosen))
      errors.push('The selected valuation class is outside the material type’s permitted list.');
    if ([qty, poPrice, stockPrice, invoicePrice].includes(null))
      errors.push('Enter a positive quantity and non-negative prices within the displayed limits.');
    if (scenario.receivingPlant && (!targetPlant || sourcePlant?.code === targetPlant.code))
      errors.push('Select a different receiving plant.');
    if (scenario.route === 'same-company' && sourcePlant?.company !== targetPlant?.company)
      errors.push('This stock transport route requires plants in the same company code.');
    if (scenario.route === 'cross-company' && sourcePlant?.company === targetPlant?.company)
      errors.push('The billing route requires plants in different company codes.');
    if (scenario.id === 'third-party' && options.category !== 'X')
      errors.push('This example uses third-party account assignment X.');
    if (['asset-po', 'asset-issue'].includes(scenario.id) && options.category !== 'A')
      errors.push('Select asset account assignment A for this example.');
    if (
      (scenario.id === 'origin-gr' || scenario.id === 'undo-origin-gr') &&
      (assigned || options.nonValuated || !material?.value)
    )
      errors.push('This origin-acceptance example uses a valuated stock PO.');
    if (!assigned && options.nonValuated && scenario.steps.some(step => step.rule === 'gr'))
      errors.push('Select a PO account assignment for the GR Non-Valuated example.');
    let previousBlocked = false;
    let canInvoiceWithoutReceipt = true;
    const availableMoves = new Map(choices(d, 'movement').map(move => [move.code, move]));
    const steps = scenario.steps.map((step, index) => {
      const configured = availableMoves.get(options.movements?.[index]);
      const move =
        configured?.base === step.movement ? configured : availableMoves.get(step.movement);
      const s = { ...step, move };
      let result;
      if (errors.length) result = skipped(errors[0]);
      else if (step.rule === 'invoice' && previousBlocked && !canInvoiceWithoutReceipt)
        result = skipped(
          'The scenario needs its preceding purchasing step before invoice receipt.',
          'waiting'
        );
      else if (previousBlocked && !independent.has(step.rule))
        result = skipped('Complete the preceding required step first.', 'waiting');
      else if (step.movement && !c.referenceReady)
        result = skipped(
          'The required reference is missing. Check this movement’s reference and selection requirements.'
        );
      else if (step.rule === 'payment' && !c.invoicePosted)
        result = skipped('Post an eligible supplier invoice first.', 'waiting');
      else result = rules[step.rule](c, s);
      if (result.status === 'blocked' && !independent.has(step.rule)) {
        previousBlocked = true;
        if (['pr', 'po', 'sto', 'serviceEntry', 'crossReceipt', 'subGr'].includes(step.rule))
          canInvoiceWithoutReceipt = false;
      }
      if (result.status === 'completed') {
        if (
          receiptRules.has(step.rule) ||
          (step.rule === 'reclass' && ['101', '109'].includes(step.movement))
        )
          c.receiptPosted = true;
        if (step.rule === 'invoice') c.invoicePosted = true;
      }
      if (step.rule === 'gr' && c.invoicePosted && result.status === 'completed')
        result.notes.push(
          'The example assumes an invoice for the full quantity was posted first. The receipt clears the applicable GR/IR amount.'
        );
      if (
        step.rule === 'invoice' &&
        !c.receiptPosted &&
        !c.grBased &&
        !c.assigned &&
        result.status === 'completed'
      )
        result.notes.push(
          'This example invoices before receipt. The modeled amount is recorded to GR/IR at the invoice price. A later receipt uses the covered invoice value where SAP applies it.'
        );
      const ref = movementContext(s);
      if (ref) result.notes.push(ref);
      return {
        ...s,
        ...result,
        lines: result.lines.map(line => ({
          ...line,
          reference:
            c.accountObject &&
            (['assignment', 'asset'].includes(line.scope) ||
              (step.rule === 'issue' && line.key === 'GBB'))
              ? c.accountObject
              : '',
          account: accountFor(d, c, line),
        })),
      };
    });
    return { scenario, context: c, steps, errors };
  }

  const publicTable = table =>
    ({
      EKKO: 'I_PurchaseOrderAPI01',
      EKPO: 'I_PurchaseOrderItemAPI01',
      MSEG: 'I_MaterialDocumentItem_2',
      MATDOC: 'I_MaterialDocumentItem_2',
      QALS: 'I_InspectionLot',
      QAVE: 'I_InspLotUsageDecision',
    })[table];
  const publicChecks = check => {
    if (['org', 'posting'].includes(check))
      return 'Configuration activity · Automatic Account Determination';
    if (
      [
        'movement',
        'issue',
        'transfer',
        'returns',
        'receipt',
        'nonPo',
        'blocked',
        'stockType',
      ].includes(check)
    )
      return 'Relevant Public Edition goods movement app and configuration activity for the movement and scope item.';
    if (check === 'service') return 'Manage Service Entry Sheets – Lean Services';
    if (['invoice', 'invoiceCancel'].includes(check))
      return 'Supplier Invoice apps and the applicable configuration activity';
    return 'Check the corresponding process and configuration activity for your Public Edition scope.';
  };
  root.WorkHubMmConfigurationEngine = {
    validate,
    entries,
    choices,
    save,
    remove,
    defaults,
    blank,
    matchingMoves,
    publicTable,
    publicChecks,
    run,
  };
})(typeof window === 'undefined' ? globalThis : window);
