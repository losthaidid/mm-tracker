/* Read-only SAP MM guides. Search and reading state stay in this browser session. */
(function (root) {
  'use strict';

  const { editions, areas, guides, sources } = root.WorkHubMmKnowledgeData;
  const byId = new Map(guides.map(guide => [guide.id, guide]));
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const fold = value =>
    String(value)
      .normalize('NFKD')
      .toLowerCase()
      .replace(/\p{M}/gu, '')
      .replace(/\bs\s*[/ -]?\s*4\s*[/ -]?\s*hana\b/g, 's4hana')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const stopWords = new Set([
    'a',
    'an',
    'at',
    'for',
    'in',
    'is',
    'of',
    'on',
    'the',
    'to',
    'when',
    'with',
  ]);
  const wordKey = word =>
    /^[a-z]{4,}$/.test(word)
      ? word.replace(/(ch|sh|ss|x|z)es$/, '$1').replace(/([^su])s$/, '$1')
      : word;
  function tokens(query) {
    const words = fold(query).split(' ').filter(Boolean);
    const useful = words.filter(word => !stopWords.has(word));
    return [...new Set((useful.length ? useful : words).map(wordKey))];
  }
  const matchingEdition = (entry, edition) => !edition || entry.editions.includes(edition);
  const index = guides.map(guide => {
    const fields = [
      [guide.title, 16],
      [guide.purpose, 10],
      ...guide.terms.map(value => [value, 15]),
      [areas[guide.area], 2],
      ...guide.editions.map(edition => [editions[edition], 2, [edition]]),
      ...guide.notes.map(value => [value, 8, guide.editions, true]),
      ...guide.prerequisites.map(value => [value, 4]),
      ...guide.steps.map(value => [value, 4]),
      ...guide.test.map(value => [value, 4]),
      ...guide.checks.flat().map(value => [value, 5]),
      ...guide.routes.map(route => [route.path + ' ' + route.detail, 8, route.editions]),
      ...guide.tools.map(tool => [tool.code + ' ' + tool.name + ' ' + tool.use, 12, tool.editions]),
    ].map(([value, weight, systems = guide.editions, note = false]) => {
      const normalized = fold(value);
      return {
        value,
        normalized,
        words: new Set(normalized.split(' ').map(wordKey)),
        weight,
        editions: systems,
        note,
      };
    });
    return { guide, fields };
  });
  const vocabulary = new Set(
    index.flatMap(({ fields }) => fields.flatMap(field => [...field.words]))
  );
  const mayComplete = term => !vocabulary.has(term) && /^[a-z]{3,}$/.test(term);
  const compatibleWord = (word, term) =>
    word === term || (mayComplete(term) && word.startsWith(term));
  const contains = (field, term) =>
    field.words.has(term) ||
    (mayComplete(term) && [...field.words].some(word => word.startsWith(term)));
  function search(query = '', edition = '', area = '') {
    const terms = tokens(query),
      phrase = fold(query);
    const results = [];
    for (const { guide, fields } of index) {
      if ((area && guide.area !== area) || !matchingEdition(guide, edition)) continue;
      if (!terms.length) {
        results.push({ guide, note: guide.notes[0], score: 0 });
        continue;
      }
      const checked = fields.filter(field => matchingEdition(field, edition));
      const scores = terms.map(term =>
        Math.max(0, ...checked.filter(field => contains(field, term)).map(field => field.weight))
      );
      if (scores.includes(0)) continue;
      const includesPhrase = field => ` ${field.normalized} `.includes(` ${phrase} `);
      const score =
        scores.reduce((sum, value) => sum + value, 0) +
        Math.max(0, ...checked.filter(includesPhrase).map(field => field.weight * 3));
      const excerpts = checked
        .filter(field => field.note)
        .map(field => ({
          field,
          score:
            (includesPhrase(field) ? 99 : 0) + terms.filter(term => contains(field, term)).length,
        }))
        .sort((a, b) => b.score - a.score);
      results.push({ guide, note: excerpts[0]?.field.value || guide.notes[0], score });
    }
    return results.sort((a, b) => b.score - a.score);
  }

  function marked(value, terms) {
    if (!terms.length) return esc(value);
    let output = '',
      cursor = 0;
    for (const hit of value.matchAll(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu)) {
      const word = wordKey(fold(hit[0]));
      if (!terms.some(term => compatibleWord(word, term))) continue;
      output += esc(value.slice(cursor, hit.index)) + '<mark>' + esc(hit[0]) + '</mark>';
      cursor = hit.index + hit[0].length;
    }
    return output + esc(value.slice(cursor));
  }
  const option = (value, label, current) =>
    `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`;
  const list = (values, ordered = false) => {
    const tag = ordered ? 'ol' : 'ul';
    return `<${tag}>${values.map(value => `<li>${esc(value)}</li>`).join('')}</${tag}>`;
  };
  const badges = systems =>
    `<div class="mmk-badges">${systems.map(edition => `<span>${esc(editions[edition])}</span>`).join('')}</div>`;
  function reference(source) {
    const [name, url, release] = source;
    return `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)} ↗</a>${release ? `<small>${esc(release)}</small>` : ''}</li>`;
  }

  function install(a) {
    const $ = id => document.getElementById(id);
    let identity = '',
      mode = 'notes',
      query = '',
      edition = '',
      area = '';
    const mayRead = () => a.ready() && a.canView();
    const selected = () => mode === 'reference' && mayRead();

    function sync() {
      const now = mayRead() ? JSON.stringify([a.owner(), a.generation()]) : '';
      if (now !== identity) {
        if (document.querySelector('#modal[open] .mmk-reader')) a.closeModal();
        identity = now;
        mode = 'notes';
        query = edition = area = '';
      }
      if (!a.active() && document.querySelector('#modal[open] .mmk-reader')) a.closeModal();
    }

    function tabs() {
      sync();
      if (!mayRead()) return '';
      return `<div class="mmk-tabs" role="group" aria-label="Knowledge section" data-access-feature="knowledge">${[
        ['notes', 'Knowledge notes'],
        ['reference', 'MM Configuration'],
      ]
        .map(
          ([id, title]) =>
            `<button type="button" data-mmk="tab" data-mode="${id}" aria-pressed="${mode === id}">${title}</button>`
        )
        .join('')}</div>`;
    }
    function cards(results) {
      if (!results.length)
        return `<div class="mmk-empty"><h3>No matching guides</h3><p>Try a shorter phrase or clear your filters.</p><button type="button" data-mmk="reset" class="small">Clear search and filters</button></div>`;
      const terms = tokens(query);
      return results
        .map(
          ({ guide, note }) =>
            `<article class="mmk-card" data-mmk-card="${esc(guide.id)}"><span class="mmk-topic">${esc(areas[guide.area])}</span><h3><button type="button" data-mmk="open" data-id="${esc(guide.id)}"><span class="mmk-card-title">${marked(guide.title, terms)}</span><span class="mmk-card-arrow" aria-hidden="true"></span></button></h3><p class="mmk-purpose">${marked(guide.purpose, terms)}</p><p class="mmk-excerpt"><span>Note</span> ${marked(note, terms)}</p>${badges(edition ? [edition] : guide.editions)}</article>`
        )
        .join('');
    }
    const resultLabel = results => `${results.length} ${results.length === 1 ? 'guide' : 'guides'}`;
    function render() {
      const switcher = tabs();
      if (!selected()) return '';
      const results = search(query, edition, area);
      return `${switcher}<section class="mmk-workspace" data-access-feature="knowledge"><header class="mmk-hero"><div><h2>SAP MM Configuration</h2><p>Look up the settings, maintenance screens, and checks for your SAP process.</p></div><div class="mmk-orbit" aria-hidden="true"><i></i><i></i><i></i></div></header>
      <div class="mmk-controls"><label>Search the reference<input id="mmkQuery" type="search" placeholder="Try batch maintenance, earliest expiry, or OBYC" maxlength="200" value="${esc(query)}" autocomplete="off"></label><label>SAP edition<select id="mmkEdition">${option('', 'All editions', edition)}${Object.entries(
        editions
      )
        .map(([value, label]) => option(value, label, edition))
        .join(
          ''
        )}</select></label><label>Topic<select id="mmkArea">${option('', 'All topics', area)}${Object.entries(
        areas
      )
        .map(([value, label]) => option(value, label, area))
        .join('')}</select></label></div>
      <div class="mmk-results-head"><h3>Configuration guides</h3><span id="mmkCount" role="status">${resultLabel(results)}</span></div><div class="mmk-grid" id="mmkResults">${cards(results)}</div></section>`;
    }
    function updateResults() {
      const results = search(query, edition, area);
      $('mmkCount').textContent = resultLabel(results);
      $('mmkResults').innerHTML = cards(results);
    }
    function articleDetails(guide, system) {
      const routes = guide.routes.filter(route => matchingEdition(route, system));
      const tools = guide.tools.filter(tool => matchingEdition(tool, system));
      const related = guide.related.map(id => byId.get(id));
      return `<section class="mmk-section"><h3>Prerequisites</h3>${list(guide.prerequisites)}</section>
      <section class="mmk-section"><h3>Where to configure</h3>${routes.length ? routes.map(route => `<div class="mmk-route">${badges(system ? [system] : route.editions)}<p>${esc(route.path)}</p>${route.detail ? `<small>${esc(route.detail)}</small>` : ''}</div>`).join('') : '<p>Use the referenced setup guides for configuration in this edition.</p>'}${list(guide.steps, true)}</section>
      ${tools.length ? `<section class="mmk-section"><h3>Direct maintenance and verification</h3><dl class="mmk-tools">${tools.map(tool => `<div><dt>${tool.code ? `<code>${esc(tool.code)}</code> ` : ''}${esc(tool.name)}</dt><dd>${esc(tool.use)}${badges(system ? [system] : tool.editions)}</dd></div>`).join('')}</dl></section>` : ''}
      <section class="mmk-section"><h3>Notes</h3>${list(guide.notes)}</section>
      <section class="mmk-section mmk-test"><h3>How to test it</h3><p>${esc(guide.test[0])}</p><p><strong>Expected result</strong> ${esc(guide.test[1])}</p></section>
      <section class="mmk-section"><h3>If the result differs</h3><dl class="mmk-checks">${guide.checks.map(([symptom, check]) => `<div><dt>${esc(symptom)}</dt><dd>${esc(check)}</dd></div>`).join('')}</dl></section>
      ${related.length ? `<section class="mmk-section"><h3>Related guides</h3><div class="mmk-related">${related.map(row => `<button type="button" class="small" data-mmk="open" data-id="${esc(row.id)}">${esc(row.title)} ↗</button>`).join('')}</div></section>` : ''}
      <section class="mmk-section"><h3>SAP references</h3><ul class="mmk-sources">${guide.refs.map(id => reference(sources[id])).join('')}</ul></section>`;
    }
    function openGuide(guide, preferredEdition) {
      const system = guide.editions.includes(preferredEdition) ? preferredEdition : '';
      a.openModal(
        guide.title,
        `<article class="mmk-reader" data-access-feature="knowledge" data-guide="${esc(guide.id)}"><div class="mmk-guide-lead"><div><span class="mmk-topic">${esc(areas[guide.area])}</span><p id="mmkGuidePurpose" tabindex="-1">${esc(guide.purpose)}</p></div><label>SAP edition<select id="mmkGuideEdition">${option('', 'All available editions', system)}${guide.editions.map(value => option(value, editions[value], system)).join('')}</select></label></div><div id="mmkArticleDetails">${articleDetails(guide, system)}</div></article>`
      );
      const body = $('modalBody');
      if (body) body.scrollTop = 0;
      $('mmkGuidePurpose')?.focus({ preventScroll: true });
    }
    document.addEventListener('click', event => {
      const button = event.target.closest?.('[data-mmk]');
      if (!button || !a.active() || !mayRead()) return;
      const action = button.dataset.mmk;
      if (action === 'tab') {
        const next = button.dataset.mode;
        if (!['notes', 'reference'].includes(next) || next === mode) return;
        mode = next;
        a.render();
        document.querySelector('.mmk-tabs [aria-pressed="true"]')?.focus({ preventScroll: true });
      } else if (selected() && action === 'open') {
        const guide = byId.get(button.dataset.id);
        if (guide) openGuide(guide, $('mmkGuideEdition')?.value ?? edition);
      } else if (selected() && action === 'reset') {
        $('mmkQuery').value = query = '';
        $('mmkEdition').value = edition = '';
        $('mmkArea').value = area = '';
        updateResults();
        $('mmkQuery').focus();
      }
    });
    document.addEventListener('input', event => {
      if (event.target.id === 'mmkQuery' && selected()) {
        query = event.target.value;
        updateResults();
      }
    });
    document.addEventListener('change', event => {
      if (!selected()) return;
      const control = event.target;
      if (control.id === 'mmkGuideEdition') {
        const guide = byId.get(control.closest('.mmk-reader')?.dataset.guide);
        if (guide) $('mmkArticleDetails').innerHTML = articleDetails(guide, control.value);
      } else if (control.id === 'mmkEdition' || control.id === 'mmkArea') {
        edition = $('mmkEdition').value;
        area = $('mmkArea').value;
        updateResults();
      }
    });
    const visibility = () =>
      document.documentElement.classList.toggle('mmk-page-hidden', document.hidden);
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return {
      tabs,
      render,
      sync,
      selected,
      patchRender() {
        sync();
        return selected() && !!$('mmkResults');
      },
    };
  }

  root.WorkHubMmKnowledge = Object.freeze({ install, search });
})(typeof window === 'undefined' ? globalThis : window);
