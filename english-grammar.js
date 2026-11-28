/* Searchable lessons and practice inside English Coach. */
(function (root) {
  'use strict';

  const { groups, byId, references } = root.WorkHubEnglishGrammarData;
  const levels = ['Foundations', 'Intermediate', 'Advanced'];
  const ordered = levels.flatMap(level => groups.filter(group => group.level === level));
  const sequence = ordered.flatMap(group => group.lessons.map(lesson => lesson.id));
  const $ = id => document.getElementById(id);
  const escape = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
    );
  const button = (action, label, value = '', classes = '') =>
    `<button type="button" data-eg="${action}" data-value="${escape(value)}"${classes ? ` class="${classes}"` : ''}>${escape(label)}</button>`;

  function install(a) {
    let lessonId = '',
      level = '',
      search = '',
      result = '',
      fromDraft = false;

    function reset() {
      lessonId = level = search = result = '';
      fromDraft = false;
    }

    function open(id, source = '') {
      if (!byId.has(id)) return;
      lessonId = id;
      result = '';
      fromDraft = source === 'draft';
      a.progress().last = id;
      a.save();
    }

    function results() {
      const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
      const completed = new Set(a.progress().completed);
      const results = ordered
        .filter(group => !level || group.level === level)
        .map(group => ({
          ...group,
          matches: group.lessons.filter(lesson => {
            const index = [
              group.title,
              lesson.title,
              lesson.pattern,
              lesson.explanation,
              lesson.mistake,
            ]
              .join(' ')
              .toLowerCase();
            return terms.every(term => index.includes(term));
          }),
        }))
        .filter(group => group.matches.length);
      const total = results.reduce((count, group) => count + group.matches.length, 0);
      const summary = `${total} lesson${total === 1 ? '' : 's'}`;
      const html = results
        .map((group, index) => {
          const done = group.matches.filter(row => completed.has(row.id)).length;
          return `<details class="eg-group"${terms.length || index === 0 ? ' open' : ''}>
          <summary><span><small>${escape(group.level)}</small><strong>${escape(group.title)}</strong></span><span>${done}/${group.matches.length} complete</span></summary>
          <ul>${group.matches.map(row => `<li>${button('open', row.title, row.id)}${completed.has(row.id) ? '<small>Completed</small>' : ''}</li>`).join('')}</ul></details>`;
        })
        .join('');
      return {
        summary,
        html: html || '<p class="ec-empty">No lessons match your search and level.</p>',
      };
    }

    function catalog() {
      const found = results();
      const progress = a.progress(),
        count = progress.completed.length;
      const last = byId.get(progress.last);
      return `<div class="eg-library" id="egLibrary">
        <header class="eg-intro"><div><h3 id="egHeading" tabindex="-1">Grammar Library</h3>
          <p class="muted">Study a grammar rule, see it in a work message, and try a short exercise.</p></div>
          ${last ? button('open', 'Continue ' + last.title, last.id, 'primary') : ''}</header>
        <div class="eg-progress"><progress max="${sequence.length}" value="${count}" aria-label="Grammar lessons completed"></progress>
          <span>${count} of ${sequence.length} lessons completed</span></div>
        <div class="eg-filters"><label>Find a grammar lesson<input type="search" id="egSearch" placeholder="Try past participle, nouns, or questions" maxlength="150" value="${escape(search)}"></label>
          <label>Level<select id="egLevel">${['', ...levels].map(value => `<option value="${value}"${value === level ? ' selected' : ''}>${value || 'All levels'}</option>`).join('')}</select></label></div>
        <p class="eg-result-count" id="egCount" role="status">${found.summary}</p>
        <div id="egResults">${found.html}</div>
        <details class="eg-references"><summary>Grammar references</summary><ul>${references.map(([name, url]) => `<li><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(name)}</a></li>`).join('')}</ul></details>
      </div>`;
    }

    function exerciseResult(lesson) {
      if (result === 'correct') return `Correct. ${lesson.reason}`;
      if (result === 'incorrect') return `Try again. ${lesson.reason}`;
      return '';
    }

    function article(lesson) {
      const at = sequence.indexOf(lesson.id);
      const group = groups.find(row => row.id === lesson.group);
      const answers = [
        [lesson.answer, 'correct'],
        [lesson.alternative, 'incorrect'],
      ];
      if (at % 2) answers.reverse();
      const complete = a.progress().completed.includes(lesson.id);
      return `<article class="eg-library eg-article" id="egLibrary">
        <nav class="eg-article-nav" aria-label="Grammar lesson navigation">
          ${button('all', 'All lessons')}
          ${fromDraft ? '<button type="button" data-ec="screen" data-screen="draft">Return to draft</button>' : ''}
        </nav>
        <header class="eg-intro"><div><p class="eg-meta">${escape(lesson.level)} · ${escape(group.title)}</p>
          <h3 id="egHeading" tabindex="-1">${escape(lesson.title)}</h3></div>${complete ? '<span id="egCompleted">Completed</span>' : '<span id="egCompleted" hidden>Completed</span>'}</header>
        <p class="eg-pattern">${escape(lesson.pattern)}</p><p class="eg-explanation">${escape(lesson.explanation)}</p>
        <div class="eg-examples"><section><h4>In an email</h4><p>${escape(lesson.email)}</p></section>
          <section><h4>In Teams</h4><p>${escape(lesson.teams)}</p></section></div>
        <section class="eg-mistake"><h4>Common mistake</h4><p>${escape(lesson.mistake)}</p></section>
        <section class="eg-exercise" aria-labelledby="egPracticeTitle"><h4 id="egPracticeTitle">Try it</h4><p>${escape(lesson.prompt)}</p>
          <div class="eg-answers">${answers.map(([answer, id]) => button('answer', answer, id)).join('')}</div>
          <p id="egFeedback" role="status" tabindex="-1">${escape(exerciseResult(lesson))}</p></section>
        <nav class="eg-article-nav eg-sequence" aria-label="More grammar lessons">
          ${at > 0 ? button('open', 'Previous lesson', sequence[at - 1]) : ''}
          ${at < sequence.length - 1 ? button('open', 'Next lesson', sequence[at + 1]) : ''}
        </nav></article>`;
    }

    function render() {
      const lesson = byId.get(lessonId);
      return lesson ? article(lesson) : catalog();
    }

    function redraw() {
      $('ecPane').innerHTML = render();
      $('egHeading')?.focus({ preventScroll: true });
    }

    function updateResults() {
      const found = results();
      $('egCount').textContent = found.summary;
      $('egResults').innerHTML = found.html;
    }

    document.addEventListener('click', event => {
      const target = event.target.closest?.('#egLibrary [data-eg]');
      if (!target || !a.active()) return;
      const { eg, value } = target.dataset;
      if (eg === 'open' && byId.has(value)) {
        open(value, fromDraft ? 'draft' : '');
        redraw();
      } else if (eg === 'all') {
        lessonId = result = '';
        fromDraft = false;
        redraw();
      } else if (eg === 'answer' && ['correct', 'incorrect'].includes(value)) {
        const lesson = byId.get(lessonId);
        if (!lesson) return;
        result = value;
        const feedback = $('egFeedback');
        if (result === 'correct') {
          const progress = a.progress();
          if (!progress.completed.includes(lesson.id)) {
            progress.completed.push(lesson.id);
            a.save();
          }
          $('egCompleted').hidden = false;
        }
        feedback.textContent = exerciseResult(lesson);
        feedback.focus({ preventScroll: true });
      }
    });
    document.addEventListener('input', event => {
      if (event.target.id !== 'egSearch' || !a.active()) return;
      search = event.target.value.slice(0, 150);
      updateResults();
    });
    document.addEventListener('change', event => {
      if (event.target.id !== 'egLevel' || !a.active()) return;
      level = levels.includes(event.target.value) ? event.target.value : '';
      updateResults();
    });
    return { render, open, reset };
  }

  root.WorkHubEnglishGrammar = { install };
})(globalThis);
