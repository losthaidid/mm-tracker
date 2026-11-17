/* Searchable SAP MM keys and account groupings with read-only posting walkthroughs. */
(function (root) {
  'use strict';

  const { entries, refs } = root.WorkHubSapTermsData;
  const { editions, guides } = root.WorkHubMmKnowledgeData;
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const byGuide = new Map(guides.map(guide => [guide.id, guide]));
  const kindLabels = { key: 'Transaction/event keys', modifier: 'Account groupings' };
  const kinds = { key: 'Transaction/event key', modifier: 'Account grouping' };
  const inEdition = (entry, edition) =>
    !edition || (edition === 'historical' ? entry.historical : entry.editions.includes(edition));
  const displayCode = entry => (entry.modifier === '' ? entry.key + ' / blank' : entry.id);
  const fold = value =>
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const singular = word =>
    word.length > 3 ? word.replace(/(ch|sh|ss|x|z)es$/, '$1').replace(/([^su])s$/, '$1') : word;
  const stopWords = new Set(['a', 'an', 'for', 'in', 'of', 'on', 'the', 'to', 'with']);
  const index = entries.map(entry => {
    const fields = [
      [entry.id, 30],
      [entry.id.replace('/', ''), 30],
      [entry.title, 16],
      ...entry.keywords.map(text => [text, 14]),
      [
        entry.kind === 'key'
          ? 'transaction event key'
          : 'account grouping account modifier general modification',
        4,
      ],
      [entry.explanation, 8],
      [entry.demo.setup, 5],
      [entry.check, 4],
      ...entry.demo.postings.map(item => [item.title + ' ' + item.effect, 5]),
    ].map(([text, weight]) => {
      const phrase = fold(text);
      return { phrase, words: phrase.split(' ').map(singular), weight };
    });
    return { entry, fields };
  });
  function search(query = '', kind = '', edition = '') {
    const phrase = fold(query);
    const required = phrase
      .split(' ')
      .filter(word => word && !stopWords.has(word))
      .map(singular);
    return index
      .flatMap(({ entry, fields }) => {
        if ((kind && entry.kind !== kind) || !inEdition(entry, edition)) return [];
        if (!required.length) return [{ entry, score: 0 }];
        const scores = required.map(term =>
          Math.max(
            0,
            ...fields
              .filter(field =>
                field.words.some(
                  word => word === term || (/^[a-z]{3,}$/.test(term) && word.startsWith(term))
                )
              )
              .map(field => field.weight)
          )
        );
        if (scores.includes(0)) return [];
        const exactCode = [fold(entry.id), entry.id.replace('/', '').toLowerCase()].includes(
          phrase
        );
        const exactModifier = entry.modifier?.toLowerCase() === phrase;
        const score =
          scores.reduce((sum, points) => sum + points, 0) +
          (exactModifier ? 60 : 0) +
          (exactCode ? 120 : 0) +
          Math.max(
            0,
            ...fields
              .filter(field => (' ' + field.phrase + ' ').includes(' ' + phrase + ' '))
              .map(field => field.weight * 2)
          );
        return [{ entry, score }];
      })
      .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
      .map(result => result.entry);
  }

  const currency = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' });
  function highlights(entry, code) {
    if (entry.modifier === null) return code.split('/')[0] === entry.key;
    return code === (entry.modifier ? entry.id : entry.key);
  }

  function install(a, format) {
    const { esc, option, badges, reference } = format;
    const $ = id => document.getElementById(id);
    const motion = root.matchMedia?.('(prefers-reduced-motion: reduce)');
    const getReader = () => document.querySelector('#modal[open] .sapt-reader');
    let query = '',
      kind = '',
      edition = '',
      playback = null,
      timer;

    const filters = (values, current, label) =>
      option('', label, current) +
      Object.entries(values)
        .map(([value, title]) => option(value, title, current))
        .join('');
    const availability = entry =>
      entry.historical
        ? '<div class="mmk-badges"><span>Historical</span></div>'
        : badges(edition && entry.editions.includes(edition) ? [edition] : entry.editions);
    function cards(results) {
      if (!results.length)
        return '<div class="mmk-empty"><h3>No matching terms</h3><p>Try a shorter phrase or clear your filters.</p><button type="button" class="small" data-sapt="reset">Clear search and filters</button></div>';
      return results
        .map(
          entry =>
            `<article class="mmk-card sapt-card" data-sapt-card="${esc(entry.id)}"><div class="sapt-card-top"><code>${esc(displayCode(entry))}</code><span class="mmk-topic">${kinds[entry.kind]}</span></div><h3><button type="button" data-sapt="open" data-id="${esc(entry.id)}" aria-label="${esc(displayCode(entry) + ' · ' + entry.title)}"><span class="mmk-card-title">${esc(entry.title)}</span><span class="mmk-card-arrow" aria-hidden="true"></span></button></h3><p>${esc(entry.explanation)}</p>${availability(entry)}</article>`
        )
        .join('');
    }
    const count = results => results.length + (results.length === 1 ? ' term' : ' terms');
    function render() {
      const results = search(query, kind, edition);
      return `<section class="mmk-workspace sapt-workspace" data-access-feature="knowledge">
        <header class="mmk-hero sapt-hero"><div><h2>SAP Terms</h2><p>Follow the transaction key or account grouping from the SAP event to its posting.</p></div><div class="mmk-orbit" aria-hidden="true"><i></i><i></i><i></i></div></header>
        <div class="mmk-controls sapt-controls"><label>Search SAP terms<input id="saptQuery" type="search" maxlength="200" autocomplete="off" placeholder="Try GBB/VNG, 551, or freight clearing" value="${esc(query)}"></label><label>Term type<select id="saptKind">${filters(kindLabels, kind, 'All terms')}</select></label><label>SAP edition<select id="saptEdition">${filters({ ...editions, historical: 'Historical' }, edition, 'All editions')}</select></label></div>
        <div class="mmk-results-head"><h3>Account determination terms</h3><span id="saptCount" role="status">${count(results)}</span></div><div id="saptResults" class="mmk-grid">${cards(results)}</div>
      </section>`;
    }
    function updateResults() {
      const results = search(query, kind, edition);
      $('saptCount').textContent = count(results);
      $('saptResults').innerHTML = cards(results);
    }

    function ledger(entry, data) {
      if (data.lookup) {
        const { account, code } = data.lookup;
        return `<div class="sapt-lookup sapt-account" data-key-match="${highlights(entry, code)}"><span>Account selected</span><code>${esc(code)}</code><strong>${esc(account)}</strong></div>`;
      }
      const column = (label, rows) =>
        `<section class="sapt-ledger-side"><h4>${label}</h4><ul>${rows
          .map(
            ({ account, code, amount }) =>
              `<li class="sapt-account" data-key-match="${highlights(entry, code)}"><span>${esc(account)}${code ? `<code>${esc(code)}</code>` : ''}</span><strong>${currency.format(amount)}</strong></li>`
          )
          .join('')}</ul></section>`;
      return `<div class="sapt-ledger">${column('Debit', data.debit)}${column('Credit', data.credit)}</div>`;
    }
    function scene(entry, data) {
      return `<li class="sapt-scene"><div class="sapt-trigger"><h4>${esc(data.title)}</h4><p>${esc(data.effect)}</p></div><div class="sapt-signal" aria-hidden="true"><i></i></div>${ledger(entry, data)}</li>`;
    }
    function routes(entry) {
      if (entry.historical)
        return ['Trace the key in the relevant archived accounting or Material Ledger document.'];
      if (entry.lookup === 'po') return ['Purchase order item → Account Assignment → G/L Account'];
      if (entry.lookup === 'po-default')
        return [
          'Account assignment category (OME9 in classic SAP) → Account modification → GBB account determination',
        ];
      if (entry.lookup === 'condition')
        return [
          'Purchasing or settlement calculation schema → Condition account key → Account determination',
        ];
      if (entry.lookup === 'costing')
        return [
          'Actual Costing closing settings → Material Ledger posting lines and account determination',
        ];
      if (entry.lookup === 'localization')
        return [
          'Country-specific configuration → Applicable valuation or tax process → FI document',
        ];
      const chosen = inEdition(entry, edition) ? edition : '';
      const obyc = 'OBYC → ' + displayCode(entry);
      const result = [];
      if (chosen !== 'cloud' && entry.editions.some(system => system !== 'cloud'))
        result.push(
          entry.kind === 'modifier' ? 'Check the posting’s account grouping → ' + obyc : obyc
        );
      if ((!chosen || chosen === 'cloud') && entry.editions.includes('cloud'))
        result.push(
          'SAP Central Business Configuration → Automatic Account Determination → ' +
            displayCode(entry)
        );
      return result;
    }
    function details(entry) {
      const navigation = entry.demo.postings.length > 1 ? 'step' : 'phase';
      const related =
        entry.kind === 'key'
          ? entries.filter(
              item => item.kind === 'modifier' && item.key === entry.key && inEdition(item, edition)
            )
          : [byId.get(entry.key)];
      const relatedButton = item =>
        `<button type="button" class="small" data-sapt="open" data-id="${esc(item.id)}">${esc(displayCode(item))}</button>`;
      const guideButton = id =>
        `<button type="button" class="small" data-sapt="guide" data-id="${esc(id)}">${esc(byGuide.get(id).title)} ↗</button>`;
      return `<article class="mmk-reader sapt-reader" data-access-feature="knowledge" data-sapt-entry="${esc(entry.id)}">
        <section class="sapt-walkthrough" aria-labelledby="saptExampleTitle">
          <div class="sapt-scenario"><h3 id="saptExampleTitle" tabindex="-1">Worked example</h3><p>${esc(entry.demo.setup)}</p></div>
          <div id="saptPlayer" class="sapt-player" data-phase="trigger" data-playing="false">
            <div class="sapt-phase"><span id="saptPhase"></span><span id="saptPosition"></span></div>
            <ol id="saptScenes" class="sapt-scenes" role="list" aria-label="Example steps">${entry.demo.postings.map(data => scene(entry, data)).join('')}</ol>
            <div class="sapt-controls-row" role="group" aria-label="Playback controls">
              <button type="button" class="small" data-sapt="previous">Previous ${navigation}</button>
              <button type="button" class="small sapt-play" data-sapt="play">Pause</button>
              <button type="button" class="small" data-sapt="next">Next ${navigation}</button>
              <button type="button" class="small" data-sapt="restart">Restart</button>
            </div>
          </div>
        </section>
        <div class="sapt-lead"><div><span class="mmk-topic">${kinds[entry.kind]}</span><p>${esc(entry.explanation)}</p></div>${availability(entry)}</div>
        <section class="mmk-section"><h3>Where to check in SAP</h3>${routes(entry)
          .map(path => `<div class="mmk-route"><p>${esc(path)}</p></div>`)
          .join('')}<p>${esc(entry.check)}</p></section>
        ${related.length ? `<section class="mmk-section"><h3>${entry.kind === 'key' ? 'Account groupings' : 'Transaction/event key'}</h3><div class="mmk-related">${related.map(relatedButton).join('')}</div></section>` : ''}
        <section class="mmk-section"><h3>Related configuration guides</h3><div class="mmk-related">${entry.guides.map(guideButton).join('')}</div></section>
        <section class="mmk-section"><h3>References</h3><ul class="mmk-sources">${entry.sources.map(id => reference(refs[id])).join('')}</ul></section>
      </article>`;
    }

    const allowsMotion = () => !motion?.matches && document.body.dataset.motion !== 'off';
    const temporarilyPaused = () =>
      document.hidden ||
      document.body.matches('.hub-private, .hub-present, .hub-motion-paused, .rest-room-open');
    const open = () =>
      a.active() && playback && getReader()?.dataset.saptEntry === playback.entry.id;
    function stop() {
      root.clearTimeout(timer);
      timer = undefined;
    }
    function schedule() {
      stop();
      if (!open()) return;
      const playing = allowsMotion() && !temporarilyPaused() && !playback.paused;
      $('saptPlayer').dataset.playing = String(playing);
      const control = $('saptPlayer').querySelector('[data-sapt="play"]');
      control.disabled = !allowsMotion();
      control.textContent = control.disabled ? 'Motion off' : playback.paused ? 'Play' : 'Pause';
      if (playing)
        timer = root.setTimeout(
          () => {
            timer = undefined;
            if (open() && allowsMotion() && !temporarilyPaused()) go(playback.step + 1);
            else schedule();
          },
          playback.step % 2 ? 5200 : 3000
        );
    }
    function go(step) {
      if (!open()) return;
      const { postings } = playback.entry.demo;
      const phases = postings.length * 2;
      playback.step = (step + phases) % phases;
      const position = Math.floor(playback.step / 2);
      const scenes = $('saptScenes');
      const active = scenes.querySelector('[aria-current="step"]');
      const next = scenes.children[position];
      if (active !== next) {
        active?.removeAttribute('aria-current');
        next.setAttribute('aria-current', 'step');
      }
      const isTrigger = playback.step % 2 === 0;
      $('saptPlayer').dataset.phase = isTrigger ? 'trigger' : 'posting';
      $('saptPhase').textContent = isTrigger
        ? 'Trigger'
        : postings[position].lookup
          ? 'Account determination'
          : 'FI posting';
      $('saptPosition').textContent = 'Step ' + (position + 1) + ' of ' + postings.length;
      schedule();
    }
    function show(entry) {
      stop();
      playback = { entry, step: 0, paused: false };
      a.openModal(displayCode(entry) + ' · ' + entry.title, details(entry));
      $('modalBody').scrollTop = 0;
      $('saptExampleTitle').focus({ preventScroll: true });
      go(allowsMotion() ? 0 : 1);
    }
    function sync() {
      if (!a.active() && getReader()) a.closeModal();
      if (!open()) {
        stop();
        playback = null;
      } else if (timer === undefined || !allowsMotion() || temporarilyPaused()) schedule();
    }

    document.addEventListener('input', event => {
      if (a.active() && event.target.id === 'saptQuery') {
        query = event.target.value;
        updateResults();
      }
    });
    document.addEventListener('change', event => {
      if (a.active() && ['saptKind', 'saptEdition'].includes(event.target.id)) {
        kind = $('saptKind').value;
        edition = $('saptEdition').value;
        updateResults();
      }
    });
    document.addEventListener('click', event => {
      const button = event.target.closest?.('[data-sapt]');
      if (!button || !a.active()) return;
      const { sapt: action, id } = button.dataset;
      if (action === 'open' && byId.has(id)) show(byId.get(id));
      if (action === 'guide' && byGuide.has(id)) a.openGuide(id, edition);
      if (action === 'reset') {
        $('saptQuery').value = query = '';
        $('saptKind').value = kind = '';
        $('saptEdition').value = edition = '';
        updateResults();
        $('saptQuery').focus();
      }
      if (!open()) return;
      if (action === 'play') {
        playback.paused = !playback.paused;
        schedule();
      } else if (action === 'previous' || action === 'next' || action === 'restart') {
        const distance = playback.entry.demo.postings.length > 1 ? 2 : 1;
        go(
          action === 'restart' ? 0 : playback.step + (action === 'previous' ? -distance : distance)
        );
      }
    });
    document.addEventListener('visibilitychange', sync);
    $('modal').addEventListener('close', sync);
    motion?.addEventListener('change', sync);
    return {
      render,
      sync,
      reset() {
        query = kind = edition = '';
      },
    };
  }

  root.WorkHubSapTerms = Object.freeze({ install, search, highlights });
})(typeof window === 'undefined' ? globalThis : window);
