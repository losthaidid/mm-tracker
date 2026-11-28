/* English Coach inside Knowledge. Drafts and practice progress stay in this browser. */
(function (root) {
  'use strict';

  const E = root.WorkHubEnglishCoachEngine;
  const R = root.WorkHubEnglishCoachRichText;
  const $ = id => document.getElementById(id);
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
    );
  const button = (action, label, attributes = '') =>
    `<button type="button" data-ec="${action}" ${attributes}>${label}</button>`;
  const commands = {
    bold: 'Bold',
    italic: 'Italic',
    insertUnorderedList: 'Bullets',
    insertOrderedList: 'Numbered list',
  };
  const colours = [
    ['#1f2937', 'Black'],
    ['#1d4ed8', 'Blue'],
    ['#991b1b', 'Red'],
    ['#166534', 'Green'],
    ['#6b21a8', 'Purple'],
  ];
  const highlights = [
    ['#fef08a', 'Yellow'],
    ['#bbf7d0', 'Green'],
    ['#bfdbfe', 'Blue'],
    ['#fecdd3', 'Pink'],
    ['transparent', 'Clear highlight'],
  ];
  const options = rows =>
    rows.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  const sizes = max => options(Array.from({ length: max }, (_, i) => [i + 1, i + 1]));

  function install(a) {
    let owner = '',
      state = E.validState(),
      screen = 'draft',
      editor,
      selection,
      composing = false;
    let timer,
      draftDirty = false,
      saved = true,
      issues = [],
      dismissed = new Set();
    let lessonId = Object.keys(E.lessons)[0],
      exerciseResult,
      editingCard = null,
      recall = 0,
      revealed = false;
    const key = () => 'workhub.english-coach.v1:' + encodeURIComponent(owner);
    const permitted = () => !!owner && a.active();
    const grammar = root.WorkHubEnglishGrammar?.install({
      active: () => screen === 'grammar' && permitted(),
      progress: () => state.grammar,
      save,
    });
    const ruleLinks = root.WorkHubEnglishGrammarData?.ruleLinks || {};
    const putStatus = (message, error = false) => {
      const status = $('ecStatus');
      if (!status) return;
      status.textContent = message;
      status.classList.toggle('ec-error', error);
    };

    function save() {
      if (!owner) return;
      try {
        root.localStorage.setItem(key(), JSON.stringify(state));
        saved = true;
      } catch {
        saved = false;
      }
    }
    function flush() {
      clearTimeout(timer);
      if (!editor || !draftDirty || !owner) return;
      state.draft = R.sanitize(document, editor.innerHTML);
      draftDirty = false;
      save();
    }
    function sync(account) {
      if (account === owner) return;
      flush();
      owner = account;
      editor = selection = null;
      draftDirty = composing = false;
      screen = 'draft';
      grammar?.reset();
      lessonId = Object.keys(E.lessons)[0];
      exerciseResult = editingCard = null;
      recall = 0;
      revealed = false;
      saved = true;
      issues = [];
      dismissed = new Set();
      try {
        state = E.validState(owner ? JSON.parse(root.localStorage.getItem(key())) : null);
      } catch {
        state = E.validState();
        saved = false;
      }
    }
    function render() {
      return `<section class="panel ec-workspace" id="ecWorkspace" data-access-feature="knowledge">
        <header class="panel-top ec-header"><div><h2>English Coach</h2><p class="muted">Practise English with the emails and Teams replies you write at work.</p></div></header>
        <div class="ec-content"><div class="mmk-tabs ec-tabs" role="group" aria-label="English Coach sections">${[
          ['draft', 'Write a draft'],
          ...(grammar ? [['grammar', 'Grammar Library']] : []),
          ['practice', 'Practice'],
          ['vocabulary', 'Vocabulary'],
        ]
          .map(([id, label]) =>
            button('screen', label, `data-screen="${id}" aria-pressed="${screen === id}"`)
          )
          .join('')}</div>
        <div id="ecPane"></div><p id="ecStatus" class="ec-status" role="status"></p></div></section>`;
    }
    function editorMarkup() {
      return `<div class="ec-draft-layout">
        <section class="ec-draft"><div class="ec-draft-head"><h3 id="ecDraftLabel">Draft</h3><label>Writing style
          <select id="ecMode"><option value="email"${state.mode === 'email' ? ' selected' : ''}>Email</option><option value="teams"${state.mode === 'teams' ? ' selected' : ''}>Teams reply</option></select></label></div>
        <div class="ec-toolbar" role="group" aria-label="Draft formatting">
          ${Object.entries(commands)
            .map(([cmd, label]) =>
              button(
                'format',
                label,
                `data-command="${cmd}" ` +
                  (['bold', 'italic'].includes(cmd) ? 'aria-pressed="false"' : '')
              )
            )
            .join('')}
          <select id="ecColour" aria-label="Font colour"><option value="">Font colour</option>${options(colours)}</select>
          <select id="ecHighlight" aria-label="Highlight colour"><option value="">Highlight colour</option>${options(highlights)}</select>
          ${button('table-controls', 'Table', 'id="ecTableToggle" aria-expanded="false" aria-controls="ecTableControls"')}
        </div>
        <div class="ec-toolbar ec-table-toolbar" id="ecTableControls" hidden>
          <div class="ec-table-insert"><label>Rows<select id="ecRows">${sizes(12)}</select></label>
          <label>Columns<select id="ecCols">${sizes(8)}</select></label>
          ${button('insert-table', 'Insert table')}</div><div id="ecTableEdit" hidden>
          ${[
            ['row-add', 'Add row'],
            ['row-remove', 'Remove row'],
            ['column-add', 'Add column'],
            ['column-remove', 'Remove column'],
          ]
            .map(([id, label]) => button(id, label))
            .join('')}</div>
        </div>
        <div id="ecEditor" class="ec-editor" role="textbox" aria-labelledby="ecDraftLabel" aria-describedby="ecStorage" aria-multiline="true" contenteditable="true" lang="en-GB" spellcheck="true"></div>
        <footer class="ec-copy-bar"><div class="actions">${button('copy-rich', 'Copy all', 'class="primary"')}${button('copy-plain', 'Copy as plain text')}</div>
          <small id="ecStorage">Draft and practice progress are saved in this browser. WorkHub checks run on this device.</small></footer></section>
        <section class="ec-review" aria-labelledby="ecReviewTitle"><div class="ec-review-head"><h3 id="ecReviewTitle">Writing feedback</h3>
          <span id="ecCount" class="ec-count" aria-live="polite"></span></div><div id="ecIssues"></div></section></div>`;
    }

    function renderPane() {
      flush();
      editor = selection = null;
      composing = false;
      const pane = $('ecPane');
      if (!pane || !permitted()) return;
      if (screen === 'draft') {
        pane.innerHTML = editorMarkup();
        editor = $('ecEditor');
        editor.innerHTML = R.sanitize(document, state.draft);
        $('ecRows').value = '3';
        $('ecCols').value = '2';
        refresh();
      } else if (screen === 'grammar') pane.innerHTML = grammar.render();
      else if (screen === 'practice') showPractice();
      else showVocabulary();
      if (!saved)
        putStatus(
          'Browser storage is unavailable. Copy your draft before closing this page.',
          true
        );
    }

    function currentText() {
      return editor ? R.linear(editor) : { text: '', pieces: [] };
    }
    const issueKey = issue => `${issue.id}|${issue.start}|${issue.original}`;
    function highlight(pieces) {
      if (!root.CSS?.highlights || !root.Highlight) return;
      const ranges = issues.map(issue => R.range(document, pieces, issue)).filter(Boolean);
      root.CSS.highlights.set('ec-review', new root.Highlight(...ranges));
    }
    function refresh() {
      if (!editor?.isConnected || !permitted() || composing) return;
      flush();
      const { text, pieces } = currentText();
      issues = E.check(text.replaceAll('\u00a0', ' '), state.mode).filter(
        issue => !dismissed.has(issueKey(issue))
      );
      highlight(pieces);
      const count = $('ecCount'),
        host = $('ecIssues');
      count.textContent = issues.length
        ? `${issues.length} suggestion${issues.length === 1 ? '' : 's'}`
        : '';
      host.innerHTML = issues.length
        ? `<ul class="ec-issues">${issues
            .map(
              (issue, index) =>
                `<li><span class="ec-category">${issue.type}</span><div class="ec-change"><del>${esc(issue.original)}</del><ins>${esc(issue.replacement)}</ins></div>
        <p>${esc(issue.reason)}</p><div class="actions">
          ${button('apply', 'Apply', `data-issue="${index}" class="small"`)}
          ${button('locate', 'Find in draft', `data-issue="${index}" class="small"`)}
          ${button('dismiss', 'Dismiss', `data-issue="${index}" class="small"`)}
          ${button('practice-rule', 'Practise this', `data-issue="${index}" class="small"`)}
          ${grammar && ruleLinks[issue.id] ? button('read-rule', 'Read lesson', `data-issue="${index}" class="small"`) : ''}
        </div></li>`
            )
            .join('')}</ul>`
        : `<p class="ec-empty">${
            text.trim()
              ? 'No suggestions from the current checks. Read through the draft once before copying.'
              : 'Start typing to see suggestions and short explanations here.'
          }</p>`;
      if (!saved)
        putStatus(
          'Browser storage is unavailable. Copy your draft before closing this page.',
          true
        );
    }
    function changed() {
      draftDirty = true;
      clearTimeout(timer);
      if (!composing) timer = setTimeout(refresh, 320);
    }
    function saveSelection() {
      if (!editor?.isConnected || !permitted()) return;
      const value = root.getSelection();
      if (value?.rangeCount && editor.contains(value.getRangeAt(0).commonAncestorContainer))
        selection = value.getRangeAt(0).cloneRange();
      for (const cmd of ['bold', 'italic']) {
        $('ecWorkspace')
          .querySelector(`[data-command="${cmd}"]`)
          ?.setAttribute('aria-pressed', String(document.queryCommandState?.(cmd) || false));
      }
      $('ecTableEdit').hidden = !tableCell();
    }
    function tableCell() {
      const node = selection?.startContainer;
      const cell = (node?.nodeType === 1 ? node : node?.parentElement)?.closest('td,th');
      return editor?.contains(cell) ? cell : null;
    }
    function chooseRange() {
      if (selection && editor.contains(selection.commonAncestorContainer)) return selection;
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      return range;
    }
    function place(range) {
      editor.focus({ preventScroll: true });
      const value = root.getSelection();
      value.removeAllRanges();
      value.addRange(range);
      selection = range.cloneRange();
    }
    function command(name, value = null, range = chooseRange()) {
      place(range);
      if (!document.execCommand?.(name, false, value)) {
        if (!['insertText', 'insertHTML'].includes(name)) return false;
        range.deleteContents();
        const node =
          name === 'insertText'
            ? document.createTextNode(value)
            : range.createContextualFragment(value);
        const last = node.lastChild || node;
        range.insertNode(node);
        range.setStartAfter(last);
        range.collapse(true);
        place(range);
      }
      saveSelection();
      changed();
      return true;
    }

    function tableAction(action) {
      const cell = tableCell();
      if (action === 'insert-table') {
        if (cell)
          return putStatus('Place the cursor outside the table to insert another one.', true);
        if (R.linear(editor).text.length >= E.maxText)
          return putStatus('This draft has reached its length limit.', true);
        command('insertHTML', R.tableHTML(Number($('ecRows').value), Number($('ecCols').value)));
        putStatus('Table inserted. Place the cursor in a cell to add or remove rows and columns.');
        return;
      }
      if (!cell) return;
      const row = cell.parentElement,
        table = row.closest('table'),
        index = cell.cellIndex;
      const rows = Array.from(table.rows);
      if (
        (rows.length === 1 && action === 'row-remove') ||
        (row.cells.length === 1 && action === 'column-remove')
      )
        return putStatus('Keep at least one row and one column in the table.', true);
      const otherRows = rows.filter(other => other !== row);
      const blank = newCell => {
        newCell.append(document.createElement('br'));
        return newCell;
      };
      let next = cell;
      if (action === 'row-add') {
        if (rows.length >= 20) return putStatus('Tables support up to 20 rows.', true);
        const added = document.createElement('tr');
        for (const unused of row.cells) blank(added.insertCell());
        if (row.parentElement.localName === 'thead') {
          const body = table.tBodies[0] || table.createTBody();
          body.prepend(added);
        } else row.after(added);
        next = added.cells[Math.min(index, added.cells.length - 1)];
      } else if (action === 'row-remove') {
        next = (rows[row.rowIndex + 1] || otherRows.at(-1)).cells[index] || otherRows[0].cells[0];
        row.remove();
      } else if (action === 'column-add') {
        if (rows.some(other => other.cells.length >= 12))
          return putStatus('Tables support up to 12 columns.', true);
        for (const other of rows) {
          const anchor = other.cells[index];
          const added = blank(document.createElement(anchor?.localName === 'th' ? 'th' : 'td'));
          if (anchor) anchor.after(added);
          else other.append(added);
          if (other === row) next = added;
        }
      } else if (action === 'column-remove') {
        if (rows.some(other => other.cells[index] && other.cells.length === 1))
          return putStatus('Keep at least one cell in each row.', true);
        for (const other of rows) other.cells[index]?.remove();
        next = row.cells[Math.min(index, row.cells.length - 1)];
      }
      if (next) {
        const range = document.createRange();
        range.selectNodeContents(next);
        range.collapse(true);
        place(range);
      }
      changed();
    }

    function counters(id) {
      return (state.counts[id] ??= { seen: 0, right: 0, attempts: 0 });
    }
    function feedback(action, index) {
      const issue = issues[index];
      if (!issue) return;
      const { text, pieces } = currentText();
      if (text.slice(issue.start, issue.end).replaceAll('\u00a0', ' ') !== issue.original)
        return refresh();
      if (action === 'dismiss') {
        dismissed.add(issueKey(issue));
        refresh();
        return;
      }
      if (action === 'read-rule' && grammar && ruleLinks[issue.id]) {
        grammar.open(ruleLinks[issue.id], 'draft');
        switchScreen('grammar');
        $('egHeading')?.focus({ preventScroll: true });
        return;
      }
      if (action === 'practice-rule') {
        counters(issue.id).seen++;
        save();
        lessonId = issue.id;
        exerciseResult = null;
        switchScreen('practice');
        return;
      }
      const selected = R.range(document, pieces, issue);
      if (!selected || selected.toString().replaceAll('\u00a0', ' ') !== issue.original)
        return refresh();
      if (action === 'locate') {
        place(selected);
        selected.startContainer.parentElement?.scrollIntoView({ block: 'nearest' });
      } else if (command('insertText', issue.replacement, selected)) {
        counters(issue.id).seen++;
        refresh();
        putStatus('Suggestion applied.');
      }
    }

    async function copyDraft(rich) {
      const source = editor,
        account = owner;
      const html = R.sanitize(document, source.innerHTML, true);
      const clean = document.createElement('div');
      clean.innerHTML = html;
      const text = R.plainText(clean);
      if (!text && !clean.querySelector('table')) return putStatus('Write a draft first.', true);
      if (!a.canExport()) return putStatus('Copy is disabled for your account.', true);
      const pipeline = root.navigator.clipboard;
      const current = () => editor === source && owner === account && permitted();
      try {
        if (rich && pipeline?.write && root.ClipboardItem) {
          await pipeline.write([
            new root.ClipboardItem({
              'text/html': new Blob([html], { type: 'text/html' }),
              'text/plain': new Blob([text], { type: 'text/plain' }),
            }),
          ]);
        } else if (!rich && pipeline?.writeText) await pipeline.writeText(text);
        else throw Error('Clipboard unavailable');
        if (current()) putStatus(rich ? 'Formatted draft copied.' : 'Plain text copied.');
      } catch {
        if (!current()) return;
        if (rich) {
          const range = document.createRange();
          range.selectNodeContents(source);
          place(range);
          putStatus('Draft selected. Use your browser’s copy shortcut to copy it with formatting.');
        } else {
          const fallback = document.createElement('textarea');
          fallback.value = text;
          fallback.readOnly = true;
          fallback.setAttribute('aria-label', 'Plain text draft');
          fallback.className = 'ec-copy-fallback';
          const pane = $('ecPane');
          pane.querySelector('.ec-copy-fallback')?.remove();
          pane.append(fallback);
          fallback.select();
          if (document.execCommand?.('copy')) {
            fallback.remove();
            putStatus('Plain text copied.');
          } else putStatus('Plain text selected. Use your browser’s copy shortcut.');
        }
      }
    }

    function showPractice() {
      const lessons = Object.values(E.lessons).sort(
        (a, b) => (state.counts[b.id]?.seen || 0) - (state.counts[a.id]?.seen || 0)
      );
      const lesson = E.lessons[lessonId];
      const stats = state.counts[lessonId] || { seen: 0, right: 0, attempts: 0 };
      const choices = [...lesson.choices];
      if (Object.keys(E.lessons).indexOf(lessonId) % 2) choices.reverse();
      $('ecPane').innerHTML =
        `<section class="ec-study"><h3>Practise a writing rule</h3><p class="muted">Rules you review in your drafts appear first.</p>
        <label>Practice topic<select id="ecLesson">${lessons.map(row => `<option value="${row.id}"${row.id === lessonId ? ' selected' : ''}>${esc(row.title)}${state.counts[row.id]?.seen ? ' · from your drafts' : ''}</option>`).join('')}</select></label>
        <p class="ec-practice-prompt">${esc(lesson.prompt)}</p>
        <div class="ec-choices">${choices.map(choice => button('exercise', esc(choice), `data-choice="${lesson.choices.indexOf(choice)}"`)).join('')}</div>
        <p role="status" class="ec-practice-result" tabindex="-1">${
          exerciseResult === null || exerciseResult === undefined
            ? ''
            : exerciseResult
              ? `Correct. ${esc(lesson.reason)}`
              : `Try again. ${esc(lesson.reason)}`
        }</p>
        ${stats.attempts ? `<p class="muted">${stats.right} correct out of ${stats.attempts} attempts${stats.seen ? ` · Reviewed ${stats.seen} times from drafts` : ''}</p>` : ''}
        ${button('next-lesson', 'Next exercise')}</section>`;
    }

    function showVocabulary() {
      const card = state.vocab[recall];
      const edit = state.vocab[editingCard] || {};
      $('ecPane').innerHTML = `<div class="ec-vocab-layout">
        <section class="ec-study"><h3>Your vocabulary</h3>
          <form id="ecVocabForm" class="ec-vocab-form"><label>Word or phrase<input name="term" maxlength="120" value="${esc(edit.term)}" required></label>
            <label>Meaning or when to use it<input name="meaning" maxlength="300" value="${esc(edit.meaning)}" required></label>
            <label>Example sentence<textarea name="example" rows="2" maxlength="500">${esc(edit.example)}</textarea></label>
            <div class="actions"><button type="submit" class="primary">${editingCard === null ? 'Save phrase' : 'Update phrase'}</button>
            ${editingCard === null ? '' : button('cancel-vocab', 'Cancel edit')}</div></form>
          ${
            state.vocab.length
              ? `<ul class="ec-vocab-list">${state.vocab
                  .map(
                    (
                      entry,
                      i
                    ) => `<li><strong>${esc(entry.term)}</strong><p>${esc(entry.meaning)}</p>
            ${entry.example ? `<small>${esc(entry.example)}</small>` : ''}<div class="actions">${button('edit-vocab', 'Edit', `data-index="${i}" class="small"`)}${button('remove-vocab', 'Remove', `data-index="${i}" class="small"`)}</div></li>`
                  )
                  .join('')}</ul>`
              : `<p class="ec-empty">Save your own phrase or choose one from the work phrases.</p>`
          }</section>
        <div><section class="ec-study"><h3>Recall practice</h3>${
          card
            ? `<p>${esc(card.meaning)}</p><p class="ec-recall-answer">${revealed ? esc(card.term) : 'Try to recall the phrase, then reveal it.'}</p>
           ${revealed && card.example ? `<p>${esc(card.example)}</p>` : ''}
           <div class="actions">${button('reveal', revealed ? 'Hide answer' : 'Reveal answer')}${state.vocab.length > 1 ? button('recall-next', 'Next phrase') : ''}</div>`
            : '<p class="ec-empty">Save a phrase to practise it here.</p>'
        }</section>
        <section class="ec-study"><h3>Useful work phrases</h3><ul class="ec-vocab-list">${E.phrases
          .map(
            ([term, meaning, example], i) =>
              `<li><strong>${esc(term)}</strong><p>${esc(meaning)}</p><small>${esc(example)}</small>
          ${state.vocab.some(c => c.term === term) ? '' : button('save-example', 'Save phrase', `data-index="${i}" class="small"`)}</li>`
          )
          .join('')}</ul></section></div></div>`;
    }
    function switchScreen(next) {
      if (!['draft', 'practice', 'vocabulary', ...(grammar ? ['grammar'] : [])].includes(next))
        return;
      screen = next;
      $('ecWorkspace')
        .querySelectorAll('[data-screen]')
        .forEach(node => node.setAttribute('aria-pressed', String(node.dataset.screen === next)));
      root.CSS?.highlights?.delete('ec-review');
      putStatus('');
      renderPane();
    }
    function vocabulary(action, index) {
      if (action === 'edit-vocab' && state.vocab[index]) editingCard = index;
      else if (action === 'remove-vocab' && state.vocab[index]) {
        state.vocab.splice(index, 1);
        editingCard = null;
        recall = Math.min(recall, Math.max(0, state.vocab.length - 1));
        revealed = false;
        save();
      } else if (action === 'save-example' && E.phrases[index]) {
        if (state.vocab.length >= 200)
          return putStatus('The vocabulary list supports up to 200 phrases.', true);
        const [term, meaning, example] = E.phrases[index];
        if (!state.vocab.some(row => row.term === term))
          state.vocab.push({ term, meaning, example });
        save();
      } else if (action === 'cancel-vocab') editingCard = null;
      else if (action === 'reveal') revealed = !revealed;
      else if (action === 'recall-next' && state.vocab.length) {
        recall = (recall + 1) % state.vocab.length;
        revealed = false;
      }
      showVocabulary();
      if (action === 'edit-vocab') $('ecVocabForm')?.elements.term.focus();
    }
    function mount() {
      if (!permitted()) {
        flush();
        editor = selection = null;
        root.CSS?.highlights?.delete('ec-review');
        return;
      }
      if ($('ecPane') && !$('ecPane').childElementCount) renderPane();
    }

    document.addEventListener('selectionchange', saveSelection);
    root.addEventListener('pagehide', flush);
    document.addEventListener('mousedown', event => {
      if (permitted() && event.target.closest?.('.ec-toolbar button')) event.preventDefault();
    });
    document.addEventListener('click', event => {
      const target = event.target.closest?.('#ecWorkspace [data-ec]');
      if (!target || !permitted()) return;
      const action = target.dataset.ec;
      if (action === 'screen') switchScreen(target.dataset.screen);
      else if (action === 'format' && editor && Object.hasOwn(commands, target.dataset.command))
        command(target.dataset.command);
      else if (action === 'table-controls') {
        const controls = $('ecTableControls');
        controls.hidden = !controls.hidden;
        target.setAttribute('aria-expanded', String(!controls.hidden));
        $('ecTableEdit').hidden = !tableCell();
      } else if (
        editor &&
        ['insert-table', 'row-add', 'row-remove', 'column-add', 'column-remove'].includes(action)
      )
        tableAction(action);
      else if (
        editor &&
        ['apply', 'locate', 'dismiss', 'practice-rule', 'read-rule'].includes(action)
      )
        feedback(action, Number(target.dataset.issue));
      else if (editor && ['copy-rich', 'copy-plain'].includes(action))
        void copyDraft(action === 'copy-rich');
      else if (action === 'exercise' && screen === 'practice') {
        exerciseResult = target.dataset.choice === '0';
        const row = counters(lessonId);
        row.attempts++;
        if (exerciseResult) row.right++;
        save();
        showPractice();
        document.querySelector('.ec-practice-result')?.focus({ preventScroll: true });
      } else if (action === 'next-lesson' && screen === 'practice') {
        const select = $('ecLesson');
        lessonId = select.options[(select.selectedIndex + 1) % select.options.length].value;
        exerciseResult = null;
        showPractice();
      } else if (screen === 'vocabulary') vocabulary(action, Number(target.dataset.index));
    });
    document.addEventListener('change', event => {
      if (!permitted()) return;
      const el = event.target;
      if (el.id === 'ecMode') {
        state.mode = el.value === 'teams' ? 'teams' : 'email';
        dismissed.clear();
        save();
        refresh();
      } else if (el.id === 'ecLesson' && Object.hasOwn(E.lessons, el.value)) {
        lessonId = el.value;
        exerciseResult = null;
        showPractice();
      } else if (editor && (el.id === 'ecColour' || el.id === 'ecHighlight') && el.value) {
        const textColour = el.id === 'ecColour';
        if ((textColour ? colours : highlights).some(([value]) => value === el.value)) {
          document.execCommand?.('styleWithCSS', false, true);
          command(textColour ? 'foreColor' : 'hiliteColor', el.value);
        }
        el.value = '';
      }
    });
    document.addEventListener('submit', event => {
      if (!permitted() || event.target.id !== 'ecVocabForm') return;
      event.preventDefault();
      const form = new FormData(event.target);
      const read = (key, max) =>
        String(form.get(key) || '')
          .trim()
          .slice(0, max);
      const card = {
        term: read('term', 120),
        meaning: read('meaning', 300),
        example: read('example', 500),
      };
      if (!card.term || !card.meaning) return putStatus('Enter a phrase and what it means.', true);
      if (
        state.vocab.some(
          (row, i) => i !== editingCard && row.term.toLowerCase() === card.term.toLowerCase()
        )
      )
        return putStatus('This phrase is already saved.', true);
      if (editingCard === null) {
        if (state.vocab.length >= 200)
          return putStatus('The vocabulary list supports up to 200 phrases.', true);
        state.vocab.unshift(card);
        recall = 0;
      } else state.vocab[editingCard] = card;
      editingCard = null;
      revealed = false;
      save();
      showVocabulary();
      putStatus(saved ? 'Phrase saved.' : 'Could not save to browser storage.', !saved);
    });
    document.addEventListener('beforeinput', event => {
      if (event.target !== editor || !permitted() || !event.cancelable) return;
      if (
        event.inputType?.startsWith('insert') &&
        currentText().text.length +
          (event.data?.length || 1) -
          (root.getSelection()?.toString().length || 0) >
          E.maxText
      ) {
        event.preventDefault();
        putStatus('This draft has reached its length limit.', true);
      }
    });
    document.addEventListener('input', event => {
      if (event.target === editor && permitted()) {
        dismissed.clear();
        changed();
      }
    });
    document.addEventListener('compositionstart', event => {
      if (event.target === editor) composing = true;
    });
    document.addEventListener('compositionend', event => {
      if (event.target !== editor || !permitted()) return;
      composing = false;
      changed();
    });
    document.addEventListener('paste', event => {
      if (!editor?.contains(event.target) || !permitted()) return;
      event.preventDefault();
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const formatted = clipboard.getData('text/html');
      const plain = clipboard.getData('text/plain');
      const remaining =
        E.maxText - currentText().text.length + (root.getSelection()?.toString().length || 0);
      const html = formatted && R.sanitize(document, formatted);
      const staged = document.createElement('div');
      if (html) staged.innerHTML = html;
      if (html && remaining >= R.linear(staged).text.length) command('insertHTML', html);
      else if (plain && remaining > 0) command('insertText', plain.slice(0, remaining));
      else putStatus('The clipboard content could not fit into the draft.', true);
    });
    document.addEventListener('drop', event => {
      if (editor?.contains(event.target) && permitted()) event.preventDefault();
    });
    return { render, mount, sync, flush };
  }
  root.WorkHubEnglishCoach = { install };
})(globalThis);
