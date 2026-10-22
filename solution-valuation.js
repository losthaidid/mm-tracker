/**
 * solution-valuation.js — Pure valuation, split-stock and batch helpers.
 * Prices are RM per base unit; stock quantities are thousandths and values are sen.
 * Split valuation keeps an independent posting history for each maintained type.
 * This module never saves data or selects an SAP G/L account.
 */
(function (root) {
  'use strict';
  const VERSION = 'mm-core-2026-10-22.1';
  const safe = (s, max, required = false) =>
    typeof s === 'string' &&
    s.length <= max &&
    (!required || !!s.trim()) &&
    s === s.trim() &&
    !/[\u0000-\u001f\u007f]/.test(s) &&
    !['__proto__', 'prototype', 'constructor'].includes(s);
  const number = (n, places = 3) =>
    Number.isFinite(n) &&
    n >= 0 &&
    n <= 1000000 &&
    Math.abs(n * 10 ** places - Math.round(n * 10 ** places)) < 0.00001;
  const copy = x => JSON.parse(JSON.stringify(x));
  const defaults = () => ({
    priceControl: 'S',
    movingAveragePrice: 10,
    valuationClass: '3000',
    batchManaged: false,
    openingBatch: '',
    splitValuation: false,
    valuationCategory: '',
    valuationTypes: [],
  });
  const typeDefaults = (code = 'LOCAL') => ({
    code,
    valuationClass: '3000',
    priceControl: 'V',
    standardPrice: 10,
    movingAveragePrice: 10,
    openingQty: 0,
    openingBatch: '',
  });
  const isMAP = p => p.priceControl === 'V';
  const active = p => isMAP(p) || p.batchManaged || p.splitValuation;
  const roundRatio = (value, numerator, denominator) => {
    if (denominator <= 0) throw Error('A positive stock quantity is needed for MAP valuation.');
    const raw = BigInt(value) * BigInt(numerator),
      d = BigInt(denominator),
      sign = raw < 0n ? -1n : 1n;
    return Number(sign * ((raw * sign + d / 2n) / d));
  };
  const openingValue = (units, price) => roundRatio(Math.round(price * 10000), units, 100000);
  const price = (p, s) =>
    isMAP(p) || p.splitValuation
      ? s.qty > 0
        ? (s.inventory * 10) / s.qty
        : (s.mapPrice ?? p.movingAveragePrice ?? p.standardPrice)
      : p.standardPrice;
  function validate(p) {
    if (
      (p.priceControl !== undefined && !['S', 'V'].includes(p.priceControl)) ||
      (p.movingAveragePrice !== undefined && !number(p.movingAveragePrice, 4)) ||
      (p.valuationClass !== undefined && !safe(p.valuationClass, 4)) ||
      (p.batchManaged !== undefined && typeof p.batchManaged !== 'boolean') ||
      (p.openingBatch !== undefined && !safe(p.openingBatch, 10)) ||
      (p.splitValuation !== undefined && typeof p.splitValuation !== 'boolean') ||
      (p.valuationCategory !== undefined && !safe(p.valuationCategory, 1)) ||
      (p.valuationTypes !== undefined &&
        (!Array.isArray(p.valuationTypes) || p.valuationTypes.length > 8))
    )
      throw Error(
        'Check S/V price control, opening MAP, valuation class, batch and split-valuation settings.'
      );
    for (const t of p.valuationTypes || []) {
      if (
        !t ||
        !safe(t.code, 10, true) ||
        !safe(t.valuationClass, 4, true) ||
        !['S', 'V'].includes(t.priceControl) ||
        !number(t.standardPrice, 2) ||
        !number(t.movingAveragePrice, 4) ||
        !number(t.openingQty) ||
        !safe(t.openingBatch, 10)
      )
        throw Error(
          'Each valuation type needs a unique code (up to 10 characters), valuation class, S/V price and valid opening stock.'
        );
      if (p.batchManaged && t.openingQty > 0 && !t.openingBatch)
        throw Error('Enter an opening batch for each valuation type with opening stock.');
    }
    if (new Set((p.valuationTypes || []).map(t => t.code)).size !== (p.valuationTypes || []).length)
      throw Error('Valuation-type codes must be unique.');
    if (p.splitValuation) {
      if (
        p.mode !== 'valuated' ||
        p.purpose !== 'stock' ||
        p.priceControl !== 'V' ||
        !p.valuationCategory ||
        !p.valuationTypes?.length
      )
        throw Error(
          'Split valuation requires valuated stock procurement, a category and maintained valuation types. Its material header uses price control V.'
        );
      if (
        Math.round(p.openingQty * 1000) !==
        p.valuationTypes.reduce((n, t) => n + Math.round(t.openingQty * 1000), 0)
      )
        throw Error(
          'Opening inventory must equal the total of the valuation-type opening quantities.'
        );
      const batches = p.valuationTypes.filter(t => t.openingQty > 0).map(t => t.openingBatch);
      if (p.batchManaged && new Set(batches).size !== batches.length)
        throw Error('An opening batch cannot belong to two valuation types in the same plant.');
    } else if (p.batchManaged && p.openingQty > 0 && !p.openingBatch)
      throw Error('Enter the batch holding the opening stock.');
    if (p.batchManaged && p.sourceLocation === p.destinationLocation)
      throw Error('Use two distinct storage locations for the batch-stock model.');
  }
  function validateAction(a) {
    if (
      (a.batch !== undefined && !safe(a.batch, 10)) ||
      (a.valuationType !== undefined && !safe(a.valuationType, 10))
    )
      throw Error(
        'Batch and valuation type must be at most 10 characters, without leading/trailing spaces or control characters.'
      );
  }
  function checkVersion(p, actions, version) {
    if (version !== VERSION && (active(p) || actions.some(a => a.batch || a.valuationType)))
      throw Error(
        'MAP, batch and split valuation require the current simulation rule version. Original saved runs retain their original rules.'
      );
  }
  const batchQty = (s, batch, location) =>
    s.batches?.find(b => b.batch === batch)?.locations[location] || 0;
  function moveBatch(s, batch, location, units) {
    let row = s.batches.find(b => b.batch === batch);
    if (!row) {
      row = { batch, locations: Object.fromEntries(Object.keys(s.locations).map(k => [k, 0])) };
      s.batches.push(row);
    }
    row.locations[location] += units;
  }
  function initial(p, s) {
    if (isMAP(p) && p.mode === 'valuated') {
      s.inventory = root.WorkHubSolutionEngine.tracks(p)
        ? openingValue(s.qty, p.movingAveragePrice ?? p.standardPrice)
        : 0;
      s.mapPrice = p.movingAveragePrice ?? p.standardPrice;
    }
    if (p.batchManaged) {
      s.batches = [];
      if (s.qty) moveBatch(s, p.openingBatch, p.sourceLocation, s.qty);
    }
    return s;
  }
  function aggregate(p, segments, lastPrice) {
    const s = {
      qty: 0,
      inventory: 0,
      locations: Object.fromEntries([p.sourceLocation, p.destinationLocation].map(k => [k, 0])),
      consumedQty: 0,
      expense: 0,
      grir: 0,
      variance: 0,
      netReceived: 0,
      valuations: [],
    };
    if (p.batchManaged) s.batches = [];
    for (const { type, result } of segments) {
      const v = result.final;
      for (const key of [
        'qty',
        'inventory',
        'consumedQty',
        'expense',
        'grir',
        'variance',
        'netReceived',
      ])
        s[key] += v[key];
      for (const key of Object.keys(s.locations)) s.locations[key] += v.locations[key] || 0;
      s.valuations.push({
        ...copy(v),
        type: type.code,
        valuationClass: type.valuationClass,
        priceControl: type.priceControl,
        unitPrice: price(type, v),
      });
      if (p.batchManaged)
        for (const b of v.batches) s.batches.push({ ...copy(b), valuationType: type.code });
    }
    s.mapPrice =
      s.qty > 0
        ? (s.inventory * 10) / s.qty
        : (lastPrice ?? p.movingAveragePrice ?? p.standardPrice);
    return s;
  }
  /** Route each movement to one valuation type; enforce global PO and reference checks. */
  function split(p, actions, scenario, version, base) {
    const E = root.WorkHubSolutionEngine;
    const segments = p.valuationTypes.map(type => {
      const profile = {
        ...copy(p),
        ...copy(type),
        splitValuation: false,
        valuationTypes: [],
        valuationCategory: '',
      };
      return { type, profile, actions: [], result: base(profile, [], scenario, version) };
    });
    let current = aggregate(p, segments),
      stack = [];
    const start = copy(current),
      events = [],
      bindings = new Map();
    if (p.batchManaged)
      for (const t of p.valuationTypes) if (t.openingQty) bindings.set(t.openingBatch, t.code);
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i],
        before = copy(current),
        referenced = events.find(e => e.action.id === a.reference && e.status === 'success');
      const type =
          a.valuationType ||
          (['return', 'reverse'].includes(a.type) ? referenced?.valuationType : ''),
        segment = segments.find(s => s.type.code === type);
      let failed;
      const fail = (code, message, fix, unsupported = false) => {
        failed ||= {
          index: i,
          action: copy(a),
          status: unsupported ? 'unsupported' : 'error',
          code,
          message,
          fix,
          explanation: '',
          document: '',
          movement: '',
          postings: [],
          before,
          after: copy(before),
          valuationType: type || '',
          valuationClass: segment?.type.valuationClass || '',
          batch: a.batch || referenced?.batch || '',
        };
      };
      if (p.valuationCategory === 'X')
        fail(
          'VALUATION_SCOPE',
          'Automatic batch valuation (category X) is outside this model.',
          'Use explicit maintained valuation types for this walkthrough; verify automatic batch/type creation separately in SAP.',
          true
        );
      if (
        !['gr', 'issue', 'transfer', 'return', 'reverse'].includes(a.type) ||
        scenario !== 'procurement'
      )
        fail(
          'COVERAGE',
          'This transaction is outside the split-valuation learning model.',
          'Use a supported MM stock movement. Invoice, production and sales postings need separate SAP verification.',
          true
        );
      if (!segment)
        fail(
          'VALUATION_TYPE',
          'Choose a maintained valuation type for this stock movement.',
          'Select one of the configured valuation types. Stock and prices are managed separately for each type.'
        );
      if (referenced && ['return', 'reverse'].includes(a.type) && referenced.valuationType !== type)
        fail(
          'VALUATION_REFERENCE',
          'The reference belongs to a different valuation type.',
          'Use the original document’s valuation type.'
        );
      if (a.type === 'reverse' && stack.at(-1)?.actionId !== a.reference)
        fail(
          'CANCELLATION_SCOPE',
          'This model cancels only the last active goods receipt, issue or storage transfer.',
          'Choose the latest active document across all valuation types.',
          true
        );
      const batch = a.batch || (a.type === 'return' ? referenced?.batch : '');
      if (p.batchManaged && batch && bindings.has(batch) && bindings.get(batch) !== type)
        fail(
          'BATCH_VALUATION',
          'This batch is already assigned to another valuation type in this plant.',
          'Keep the existing batch/type assignment or receive a different batch.'
        );
      if (
        a.type === 'gr' &&
        !p.unlimited &&
        current.netReceived + Math.round(a.qty * 1000) >
          Math.floor(p.poQty * 1000 * (1 + p.overTolerance / 100) + 0.000001)
      )
        fail(
          'PO_QUANTITY',
          'The combined receipts exceed the PO quantity plus tolerance.',
          'The PO quantity is shared across valuation types. Reduce this receipt or review the PO tolerance.'
        );
      if (failed) {
        events.push(failed);
        continue;
      }
      const routed = { ...copy(a), batch: a.batch || '', valuationType: '' };
      segment.actions.push(routed);
      segment.result = base(segment.profile, segment.actions, scenario, version);
      const event = copy(segment.result.events.at(-1));
      current = aggregate(p, segments, before.mapPrice);
      Object.assign(event, {
        index: i,
        action: copy(a),
        before,
        after: copy(current),
        segmentBefore: event.before,
        segmentAfter: event.after,
        valuationType: type,
        valuationClass: segment.type.valuationClass,
        priceControl: segment.type.priceControl,
      });
      if (event.status === 'success') {
        event.document = 'SIM-' + String(i + 1).padStart(3, '0');
        if (a.type === 'reverse') {
          stack.pop();
          event.message = 'Posting cancelled with reference to ' + referenced.document + '.';
        } else {
          stack.push({
            document: event.document,
            actionId: a.id,
            type: a.type,
            valuationType: type,
          });
          if (a.type === 'return')
            event.message = 'Supplier return recorded against ' + referenced.document + '.';
          if (p.batchManaged && event.batch) bindings.set(event.batch, type);
        }
      }
      events.push(event);
    }
    const receipts = segments.flatMap(s =>
      s.result.receipts.map(r => ({
        ...r,
        document: events.find(e => e.action.id === r.reference)?.document || r.document,
        valuationType: s.type.code,
      }))
    );
    return {
      engineVersion: version,
      initial: start,
      final: copy(current),
      events,
      activeDocuments: stack,
      receipts,
    };
  }
  root.WorkHubSolutionValuation = {
    VERSION,
    defaults,
    typeDefaults,
    isMAP,
    active,
    validate,
    validateAction,
    checkVersion,
    initial,
    price,
    roundRatio,
    batchQty,
    moveBatch,
    split,
  };
})(window);
