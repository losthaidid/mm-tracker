/** Valuation controls and explanatory views. All results come from the posting engine. */
(function (root) {
  'use strict';
  const V = root.WorkHubSolutionValuation;
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const unit = n =>
    'RM ' +
    Number(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const money = n => root.WorkHubSolutionSimulation.money(n),
    qty = n => root.WorkHubSolutionSimulation.quantity(n);
  const option = (v, label, value) =>
    `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(label)}</option>`;
  function typeRow(t, enabled, batch) {
    const disabled = enabled ? '' : ' disabled';
    const input = (name, label, value, attrs = '') => {
      const inactive =
        (name === 'StandardPrice' && t.priceControl !== 'S') ||
        (name === 'MovingAveragePrice' && t.priceControl !== 'V');
      return `<label${inactive ? ' hidden' : ''}>${label}<input name="vt${name}" value="${esc(value)}" ${attrs}${!enabled || inactive ? ' disabled' : ''} required></label>`;
    };
    return `<article class="sv-type-row" data-valuation-type><div class="sv-type-row-head"><strong>Valuation type</strong><button type="button" class="ss-btn" data-ss-sim="valuation-remove" aria-label="Remove this valuation type">Remove</button></div><div class="ss-form-grid">${input('Code', 'Type code', t.code, 'maxlength="10"')}${input('Class', 'Valuation class', t.valuationClass, 'maxlength="4"')}<label>Type price control<select name="vtPriceControl"${disabled}>${option('S', 'S · Standard price', t.priceControl)}${option('V', 'V · Moving average price', t.priceControl)}</select></label>${input('StandardPrice', 'Standard price · RM / unit', t.standardPrice, 'type="number" min="0" max="1000000" step=".01"')}${input('MovingAveragePrice', 'Opening MAP · RM / unit', t.movingAveragePrice, 'type="number" min="0" max="1000000" step=".0001"')}${input('OpeningQty', 'Opening quantity · main location', t.openingQty, 'type="number" min="0" max="1000000" step=".001"')}<label class="sv-type-batch"${batch ? '' : ' hidden'}>Opening batch<input name="vtOpeningBatch" maxlength="10" value="${esc(t.openingBatch)}"${disabled}></label></div></article>`;
  }
  function fields(profile) {
    const p = { ...V.defaults(), ...profile },
      split = p.splitValuation,
      batch = p.batchManaged,
      control = p.priceControl;
    const types = p.valuationTypes.length
      ? p.valuationTypes
      : [
          V.typeDefaults('LOCAL'),
          {
            ...V.typeDefaults('IMPORT'),
            valuationClass: '3100',
            standardPrice: 14,
            movingAveragePrice: 14,
          },
        ];
    return `<fieldset class="sv-profile"><legend>Valuation &amp; batch-managed stock</legend><p>Choose how stock is valued and identified. Example keys are editable; confirm your client's material and account configuration.</p><div class="ss-form-grid"><label class="sv-header-class"${split ? ' hidden' : ''}>Valuation class<input name="valuationClass" maxlength="4" value="${esc(p.valuationClass)}" placeholder="e.g. 3000"></label><label>Material price control<select name="priceControl"${split ? ' disabled' : ''}>${option('S', 'S · Standard price', control)}${option('V', 'V · Moving average price (MAP)', control)}</select></label><label class="sv-map-opening"${control === 'V' && !split ? '' : ' hidden'}>Opening MAP · RM / base unit<input name="movingAveragePrice" type="number" min="0" max="1000000" step=".0001" value="${p.movingAveragePrice}"${control === 'V' && !split ? '' : ' disabled'} required></label><label class="ss-check"><input name="batchManaged" type="checkbox"${batch ? ' checked' : ''}>Manage stock by batch</label><label class="sv-opening-batch"${batch && !split ? '' : ' hidden'}>Opening stock batch<input name="openingBatch" maxlength="10" value="${esc(p.openingBatch)}" placeholder="Required when opening stock exists"></label><label class="ss-check"><input name="splitValuation" type="checkbox"${split ? ' checked' : ''}>Split valuation · separate valuation types</label></div><div class="sv-split-settings"${split ? '' : ' hidden'}><label>Valuation category · configured key<input name="valuationCategory" maxlength="1" value="${esc(p.valuationCategory || 'H')}"${split ? '' : ' disabled'} required></label><p>Maintain up to eight types, each with its own class, S/V price and opening stock. The material header uses V and totals the type quantities and values. Category H and LOCAL/IMPORT are illustrative origin-based keys.</p><div class="sv-types">${types.map(t => typeRow(t, split, batch)).join('')}</div><button type="button" class="ss-btn" data-ss-sim="valuation-add">+ Valuation type</button></div><details><summary>Valuation class, type and batch — what is different?</summary><p><b>Valuation class</b> participates in automatic G/L account determination. The simulator labels it but does not invent a real G/L account. <b>Valuation type</b> separates stock values and prices within a material. <b>Batch</b> identifies a physical lot. Batches share a valuation price unless split valuation separates them; a batch is assigned to one type within this plant.</p><p>Unrestricted stock only. Classification, expiry checks, automatic batch determination, category X automatic batch valuation and transfers between valuation types need separate SAP verification.</p></details></fieldset>`;
  }
  function read(form, p) {
    const value = k => form.elements.namedItem(k)?.value || '',
      E = root.WorkHubSolutionEngine;
    p.priceControl = p.mode === 'valuated' ? value('priceControl') || 'S' : 'S';
    p.movingAveragePrice = Number(value('movingAveragePrice') || p.standardPrice);
    p.valuationClass = value('valuationClass').trim();
    p.batchManaged = !!form.elements.namedItem('batchManaged')?.checked && E.tracks(p);
    p.openingBatch = p.batchManaged ? value('openingBatch').trim() : '';
    p.splitValuation = !!form.elements.namedItem('splitValuation')?.checked;
    p.valuationCategory = p.splitValuation ? value('valuationCategory').trim() : '';
    p.valuationTypes = p.splitValuation
      ? [...form.querySelectorAll('[data-valuation-type]')].map(row => {
          const get = k => row.querySelector(`[name="vt${k}"]`).value.trim();
          return {
            code: get('Code'),
            valuationClass: get('Class'),
            priceControl: get('PriceControl'),
            standardPrice: Number(get('StandardPrice')),
            movingAveragePrice: Number(get('MovingAveragePrice')),
            openingQty: Number(get('OpeningQty')),
            openingBatch: p.batchManaged ? get('OpeningBatch') : '',
          };
        })
      : [];
    if (p.splitValuation) {
      p.priceControl = 'V';
      p.openingQty =
        p.valuationTypes.reduce((n, t) => n + Math.round(t.openingQty * 1000), 0) / 1000;
      p.openingBatch = '';
    }
  }
  function sync(form) {
    if (!form?.querySelector('.sv-profile')) return;
    const input = k => form.elements.namedItem(k),
      valued = input('mode').value === 'valuated',
      stock = input('purpose').value === 'stock' && input('mode').value !== 'nonstock';
    const splitInput = input('splitValuation'),
      batchInput = input('batchManaged');
    splitInput.disabled = !valued || !stock;
    if (splitInput.disabled) splitInput.checked = false;
    batchInput.disabled = !stock;
    if (!stock) batchInput.checked = false;
    const split = splitInput.checked,
      batch = batchInput.checked;
    form.querySelector('.sv-header-class').hidden = split;
    input('valuationClass').disabled = split;
    if (split) input('priceControl').value = 'V';
    if (!valued) input('priceControl').value = 'S';
    input('priceControl').disabled = split || !valued;
    const map = valued && input('priceControl').value === 'V' && !split;
    form.querySelector('.sv-map-opening').hidden = !map;
    input('movingAveragePrice').disabled = !map;
    const standard = input('standardPrice');
    standard.closest('label').hidden = !valued || map || split;
    standard.disabled = !valued || map || split;
    form.querySelector('.sv-opening-batch').hidden = !batch || split;
    const settings = form.querySelector('.sv-split-settings');
    settings.hidden = !split;
    settings.querySelectorAll('input, select').forEach(el => {
      el.disabled = !split;
    });
    settings.querySelectorAll('.sv-type-batch').forEach(el => {
      el.hidden = !batch;
    });
    for (const row of settings.querySelectorAll('[data-valuation-type]')) {
      const control = row.querySelector('[name="vtPriceControl"]').value;
      for (const [name, active] of [
        ['vtStandardPrice', control === 'S'],
        ['vtMovingAveragePrice', control === 'V'],
      ]) {
        const el = row.querySelector(`[name="${name}"]`);
        el.closest('label').hidden = !active;
        el.disabled = !split || !active;
      }
    }
    input('openingQty').readOnly = split;
    if (split)
      input('openingQty').value =
        [...settings.querySelectorAll('[name="vtOpeningQty"]')].reduce(
          (n, el) => n + Math.round((Number(el.value) || 0) * 1000),
          0
        ) / 1000;
  }
  function editTypes(el) {
    const form = el.closest('form');
    if (!form) throw Error('Reopen the proposal or trial form.');
    const list = form.querySelector('.sv-types');
    if (el.dataset.ssSim === 'valuation-remove') {
      if (list.children.length <= 1) throw Error('Keep at least one valuation type.');
      el.closest('[data-valuation-type]').remove();
    } else {
      if (list.children.length >= 8) throw Error('A profile supports up to eight valuation types.');
      const used = new Set([...list.querySelectorAll('[name="vtCode"]')].map(el => el.value));
      let n = 1;
      while (used.has('TYPE' + n)) n++;
      list.insertAdjacentHTML(
        'beforeend',
        typeRow(V.typeDefaults('TYPE' + n), true, !!form.elements.namedItem('batchManaged').checked)
      );
    }
    sync(form);
  }
  function transactionFields(p, a, state) {
    const batches = [...new Set((state.batches || []).map(b => b.batch))];
    return `${p.splitValuation ? `<label>Valuation type<select name="valuationType">${option('', 'Choose type · references can inherit', a.valuationType || '')}${p.valuationTypes.map(t => option(t.code, t.code + ' · class ' + t.valuationClass, a.valuationType || '')).join('')}</select></label>` : ''}${p.batchManaged ? `<label>Batch number<input name="batch" maxlength="10" list="ssKnownBatches" value="${esc(a.batch)}" placeholder="Enter batch · references can inherit"><datalist id="ssKnownBatches">${batches.map(b => `<option value="${esc(b)}"></option>`).join('')}</datalist></label>` : ''}`;
  }
  function warehouseFields(p, state) {
    return `${p.splitValuation ? `<label>Valuation type<select id="ssWarehouseType">${option('', 'Choose valuation type', '')}${p.valuationTypes.map(t => option(t.code, t.code, '')).join('')}</select></label>` : ''}${p.batchManaged ? `<label>Batch to move<select id="ssWarehouseBatch">${option('', 'Choose batch', '')}${(state.batches || []).map(b => option(b.batch, b.batch + (b.valuationType ? ' · ' + b.valuationType : ''), '')).join('')}</select></label>` : ''}`;
  }
  function view(event, snap, state) {
    const p = snap.profile,
      E = root.WorkHubSolutionEngine,
      type = p.valuationTypes?.find(t => t.code === event?.valuationType),
      profile = type || p;
    const before = event?.segmentBefore || event?.before || state,
      after = event?.segmentAfter || state;
    const valued = p.mode === 'valuated' && E.tracks(p),
      label = profile.priceControl === 'V' ? 'Moving average price · V' : 'Standard price · S';
    return `${valued ? `<section class="sv-valuation"><div class="sx-section-title"><div><span class="ss-eyebrow">${p.splitValuation ? 'SPLIT VALUATION · INDEPENDENT STOCK VALUES' : 'HOW THIS STOCK IS VALUED'}</span><h4>${p.splitValuation ? 'One material. Separate valuation types.' : label}</h4></div><button type="button" class="ss-btn" data-ss="glossary" data-term="valuation">Explain valuation</button></div><div class="sv-price-cards"><article><small>${type ? esc(type.code) + ' · ' : ''}${label}</small><span>${unit(V.price(profile, before))} <i>→</i> <strong>${unit(V.price(profile, after))}</strong></span><p>${profile.priceControl === 'V' ? (after.qty > 0 ? `${money(after.inventory)} ÷ ${qty(after.qty)} units` : 'No stock · last known price retained; the next receipt supplies its value.') : 'Maintained standard price; purchase-price differences are shown separately.'}</p></article><article><small>Valuation class${type ? ' · ' + esc(type.code) : ''}</small><strong>${esc(profile.valuationClass) || 'Not recorded'}</strong><p>Account-determination attribute. BSX / WRX / PRD remain symbolic; actual G/L configuration is assumed.</p></article></div>${p.splitValuation ? `<div class="ss-table-scroll"><table class="sv-valuation-table"><thead><tr><th>Type / class</th><th>Stock</th><th>Inventory value</th><th>Price / unit</th></tr></thead><tbody>${state.valuations.map(t => `<tr class="${event?.valuationType === t.type ? 'is-selected' : ''}"><th>${esc(t.type)}<small>Class ${esc(t.valuationClass)} · ${t.priceControl}</small></th><td>${qty(t.qty)}</td><td>${money(t.inventory)}</td><td>${unit(t.unitPrice)}</td></tr>`).join('')}</tbody></table></div><p class="ss-muted">Header V price: ${unit(V.price(p, state))}. Header quantity and value total the types. A type's stock cannot cover another type's issue; 311 keeps its valuation type.</p>` : ''}</section>` : ''}${
      p.batchManaged
        ? `<section class="sv-batches"><div class="sx-section-title"><div><span class="ss-eyebrow">BATCH-MANAGED STOCK</span><h4>Find the exact lot and location.</h4></div>${event?.batch ? `<span class="sv-batch-tag">Batch ${esc(event.batch)}</span>` : ''}</div><div class="ss-table-scroll"><table><thead><tr><th>Batch${p.splitValuation ? ' / type' : ''}</th>${Object.keys(
            state.locations
          )
            .map(l => `<th>${esc(l)}</th>`)
            .join('')}<th>Total</th></tr></thead><tbody>${
            (state.batches || [])
              .map(
                b =>
                  `<tr class="${b.batch === event?.batch ? 'is-selected' : ''}"><th>${esc(b.batch)}${b.valuationType ? `<small>${esc(b.valuationType)}</small>` : ''}</th>${Object.keys(
                    state.locations
                  )
                    .map(l => `<td>${qty(b.locations[l] || 0)}</td>`)
                    .join(
                      ''
                    )}<td>${qty(Object.values(b.locations).reduce((n, q) => n + q, 0))}</td></tr>`
              )
              .join('') ||
            '<tr><td colspan="4">No batch stock yet. Receive a named batch to begin.</td></tr>'
          }</tbody></table></div><p class="ss-muted">${p.splitValuation ? 'Each batch retains its valuation type in this plant.' : 'Batch quantities are separate; valuation remains common across batches.'} Select the same batch for a location transfer. A referenced return/cancellation retains its original batch.</p></section>`
        : ''
    }`;
  }
  function summary(p) {
    return [
      [
        'Price control',
        p.splitValuation
          ? 'V · split-valuation header'
          : p.priceControl === 'V'
            ? 'V · moving average price'
            : 'S · standard price',
      ],
      ['Opening MAP per unit', unit(p.movingAveragePrice ?? p.standardPrice)],
      ['Valuation class', p.valuationClass || 'Not recorded'],
      [
        'Batch management',
        p.batchManaged
          ? 'Enabled · opening batch ' + (p.openingBatch || 'see valuation types')
          : 'Off',
      ],
      [
        'Split valuation',
        p.splitValuation
          ? 'Category ' +
            p.valuationCategory +
            '\n' +
            p.valuationTypes
              .map(
                t =>
                  `${t.code} · class ${t.valuationClass} · ${t.priceControl} · opening ${t.openingQty} · price ${unit(t.priceControl === 'V' ? t.movingAveragePrice : t.standardPrice)}${p.batchManaged ? ' · batch ' + t.openingBatch : ''}`
              )
              .join('\n')
          : 'Off',
      ],
    ]
      .map(([k, v]) => k + ': ' + v)
      .join('\n');
  }
  function examples() {
    return `<section class="sg-case sv-example-cards"><span class="sg-kicker">GO DEEPER · STOCK &amp; VALUATION</span><h3>Try the same material with different stock controls.</h3><div class="sg-case-options">${[
      [
        'map',
        'Moving average price',
        'Start with 100 units at RM10. Receive 100 at RM12, then see MAP become RM11 and watch the issue cost.',
      ],
      [
        'batch',
        'Batch-managed stock',
        'Receive LOT-B beside existing LOT-A. Transfer one batch, then try an issue that its selected batch cannot cover.',
      ],
      [
        'split',
        'Valuation types & classes',
        'Compare LOCAL with V and class 3000 against IMPORT with S and class 3100. Follow separate values, batches and a cancellation.',
      ],
    ]
      .map(
        ([kind, title, detail]) =>
          `<article><h4>${title}</h4><p>${detail}</p><button type="button" class="ss-btn" data-ss="learn-inventory" data-kind="${kind}">Open worked example →</button></article>`
      )
      .join(
        ''
      )}</div><p class="sg-caption">Each button starts a fresh fictional example. Your project records are unchanged.</p></section>`;
  }
  root.WorkHubSolutionValuationUI = {
    unit,
    fields,
    read,
    sync,
    editTypes,
    transactionFields,
    warehouseFields,
    view,
    summary,
    examples,
  };
})(window);
