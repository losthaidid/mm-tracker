// Projects workspace for discovery questions, decisions and follow-ups.
(function () {
  'use strict';

  const E = globalThis.WorkHubImplementationEngine;
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
    );
  const option = (id, label, value) =>
    `<option value="${esc(id)}"${id === value ? ' selected' : ''}>${esc(label)}</option>`;

  function install(a) {
    let account,
      view = {},
      draft;
    const section = () => document.getElementById('iwWorkspace');
    const modal = () => document.getElementById('modal');
    const getProject = () => a.project();
    function sync(project) {
      const next = a.account();
      if (account !== next || view.projectId !== project.id) {
        account = next;
        view = {
          projectId: project.id,
          workshopId: '',
          topic: E.topics[0].id,
          filter: '',
          search: '',
        };
        draft = null;
      }
      const list = E.rows(project);
      if (!list.some(row => row.id === view.workshopId)) view.workshopId = list[0]?.id || '';
      return list.find(row => row.id === view.workshopId);
    }

    function questionList(workshop) {
      const query = view.search.trim().toLowerCase();
      const includeAll = query || view.filter;
      const groups = (includeAll ? E.topics : E.topics.filter(t => t.id === view.topic)).map(
        topic => {
          const visible = E.available(topic, workshop.answers);
          const rows = visible.filter(([id, question]) => {
            const answer = workshop.answers[id];
            const status = answer?.status || 'Unanswered';
            const text = [
              topic.title,
              question,
              answer?.owner,
              answer?.requirement,
              answer?.decision,
            ].join(' ');
            return (
              (!query || text.toLowerCase().includes(query)) &&
              (!view.filter ||
                status === view.filter ||
                (view.filter === 'Follow-ups' && ['Open', 'Needs validation'].includes(status)))
            );
          });
          if (!rows.length) return '';
          const hidden = topic.questions.length - visible.length;
          return `<section class="iw-topic"><h3>${esc(topic.title)}</h3>
          ${topic.optional && !hidden ? '<p class="hint">If this topic is outside the workshop scope, mark its first question Not applicable to collapse the follow-ups.</p>' : ''}
          ${hidden ? `<p class="hint">${hidden} follow-up questions are out of scope. Change the first answer to reopen them.</p>` : ''}
          <ul>${rows
            .map(([id, question]) => {
              const answer = workshop.answers[id];
              return `<li><div><strong>${esc(question)}</strong><span class="iw-status">${esc(answer?.status || 'Unanswered')}</span>
              ${answer?.owner || answer?.due ? `<small>${[answer.owner, answer.due].filter(Boolean).map(esc).join(' · ')}</small>` : ''}
              ${answer?.decision ? `<p class="iw-decision">${esc(answer.decision)}</p>` : ''}</div>
              <button type="button" data-iw="answer" data-question="${esc(id)}">${a.can('edit') && !workshop.completion ? (answer ? 'Edit answer' : 'Answer') : 'View answer'}</button></li>`;
            })
            .join('')}</ul></section>`;
        }
      );
      return groups.join('') || '<p class="hint">No questions match your filters.</p>';
    }

    function overview(project) {
      const completed = E.rows(project).filter(workshop => workshop.completion);
      if (!completed.length) return '';
      return `<section class="panel box iw-summary"><h2>Implementation workshops</h2>
        <ul>${completed
          .map(workshop => {
            const { date, outputs } = workshop.completion;
            const items = outputs.filter(row => row.itemId).length;
            return `<li><strong>${esc(workshop.name)}</strong>${workshop.scope ? `<p>${esc(workshop.scope)}</p>` : ''}
            <small>${esc(date)} · ${outputs.length} published decision${outputs.length === 1 ? '' : 's'} · ${items} Project Item${items === 1 ? '' : 's'} created</small></li>`;
          })
          .join(
            ''
          )}</ul><div class="actions"><button type="button" data-action="project-view" data-view="implementation">Open implementation template</button>
        <button type="button" data-action="project-view" data-view="companies">View workshop decisions</button></div></section>`;
    }

    function decisions(project, data) {
      const completed = E.rows(project).filter(workshop => workshop.completion);
      if (!completed.length) return '';
      const byId = new Map(
        data.projectDecisions.filter(row => row.projectId === project.id).map(row => [row.id, row])
      );
      const companies = new Map(
        data.projectCompanies
          .filter(row => row.projectId === project.id)
          .map(row => [row.id, row.name])
      );
      return `<section class="panel box iw-summary" aria-label="Workshop decisions"><h2>Workshop decisions</h2>${completed
        .map(workshop => {
          const rows = workshop.completion.outputs
            .map(row => byId.get(row.decisionId))
            .filter(Boolean);
          return `<details><summary>${esc(workshop.name)} · ${rows.length} decision${rows.length === 1 ? '' : 's'}</summary>
          ${workshop.scope ? `<p class="iw-scope">${esc(workshop.scope)}</p>` : ''}
          ${
            rows.length
              ? `<ul>${rows
                  .map(
                    row => `<li><strong>${esc(row.category)}</strong>
            <small>${esc([companies.get(row.companyId) || 'Project-wide', row.owner, row.status, row.date].filter(Boolean).join(' · '))}</small>
            <p class="iw-decision">${esc(row.decision)}</p>${a.can('edit') ? `<button type="button" class="small" data-action="edit-decision" data-id="${esc(row.id)}">Edit decision</button>` : ''}</li>`
                  )
                  .join('')}</ul>`
              : '<p class="hint">No linked decisions remain.</p>'
          }</details>`;
        })
        .join('')}</section>`;
    }
    function render(project) {
      const workshop = sync(project);
      const newButton = a.can('edit')
        ? '<button type="button" class="primary" data-iw="workshop">New workshop</button>'
        : '';
      const header = `<div class="panel-top"><div><h2>Project implementation template</h2>
        <p class="muted">${E.questions.length} SAP MM discovery questions across ${E.topics.length} topics.</p></div>${newButton}</div>`;
      if (!workshop)
        return `<section class="panel iw-workspace" id="iwWorkspace">${header}<p>Create a workshop for the whole project or for a company, site, process, or material group.</p></section>`;
      const stats = E.progress(workshop);
      return `<section class="panel iw-workspace" id="iwWorkspace">${header}
        <div class="iw-toolbar">
          <label>Workshop<select id="iwWorkshop">${E.rows(project)
            .map(row => option(row.id, row.name, workshop.id))
            .join('')}</select></label>
          <div class="actions">${a.can('edit') && !workshop.completion ? '<button type="button" data-iw="workshop" data-edit="true">Edit scope</button>' : ''}
          ${a.can('edit') && a.can('create') && !workshop.completion ? '<button type="button" class="primary" data-iw="complete">Complete workshop</button>' : ''}
          ${a.can('export') ? '<button type="button" data-iw="export">Export CSV</button>' : ''}</div>
        </div>${workshop.scope ? `<p class="iw-scope">${esc(workshop.scope)}</p>` : ''}
        ${workshop.completion ? `<p class="iw-completion"><strong>Completed ${esc(workshop.completion.date)}</strong> · <button type="button" class="small" data-action="project-view" data-view="companies">View published decisions</button></p>` : ''}
        <div class="iw-progress"><progress max="${stats.total}" value="${stats.complete}" aria-label="Workshop questions resolved"></progress>
          <span>${stats.complete} of ${stats.total} resolved · ${stats.followUps} follow-up${stats.followUps === 1 ? '' : 's'}</span></div>
        <div class="iw-filters">
          <label>Topic<select id="iwTopic">${E.topics.map(t => option(t.id, t.title, view.topic)).join('')}</select></label>
          <label>Status across all topics<select id="iwFilter">${['', 'Follow-ups', 'Unanswered', ...E.statuses].map(value => option(value, value || 'All statuses', view.filter)).join('')}</select></label>
          <label>Search all topics<input type="search" id="iwSearch" value="${esc(view.search)}" placeholder="Question, owner or decision"></label>
        </div><div id="iwQuestions">${questionList(workshop)}</div></section>`;
    }

    function field(label, name, value, type = 'text') {
      const limit = E.limits[name];
      if (type === 'textarea') {
        return `<label class="iw-wide">${label}<textarea name="${name}" rows="3" maxlength="${limit}">${esc(value)}</textarea></label>`;
      }
      return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}"${limit ? ` maxlength="${limit}"` : ''}${name === 'name' ? ' required autofocus' : ''}></label>`;
    }

    function showForm(title, body, editable, context) {
      a.openModal(
        title,
        `<form id="iwForm" data-access-feature="specs" data-id="implementation" class="iw-form">
        <div class="iw-editor">${body}</div><div class="modal-actions">
        <button type="button" data-action="cancel">${editable ? 'Cancel' : 'Close'}</button>
        ${editable ? `<button type="submit" class="primary">${context.complete ? 'Complete and fill project' : 'Save'}</button>` : ''}</div></form>`
      );
      draft = { ...context, account: a.account(), form: document.getElementById('iwForm') };
    }

    function editWorkshop(project, workshop) {
      if (!a.can('edit')) throw Error('Project edit permission is required.');
      if (workshop?.completion) throw Error('This workshop is complete.');
      showForm(
        workshop ? 'Edit workshop scope' : 'New implementation workshop',
        field('Workshop name', 'name', workshop?.name) +
          field(
            'Companies, sites, materials or scenarios in scope',
            'scope',
            workshop?.scope,
            'textarea'
          ),
        true,
        {
          projectId: project.id,
          workshopId: workshop?.id,
          original: workshop && [workshop.name, workshop.scope],
        }
      );
    }

    function editAnswer(project, workshop, questionId) {
      const topic = E.topics.find(t => t.questions.some(([id]) => id === questionId));
      const question =
        topic && E.available(topic, workshop.answers).find(([id]) => id === questionId);
      if (!question) throw Error('Open an in-scope workshop question.');
      const current = workshop.answers[questionId];
      const answer = current || E.empty;
      const editable = a.can('edit') && !workshop.completion;
      const body = `<p class="iw-wide"><strong>${esc(question[1])}</strong></p>
        <label>Status<select name="status">${E.statuses.map(s => option(s, s, answer.status)).join('')}</select></label>
        ${field('Follow-up due date', 'due', answer.due, 'date')}
        ${field('Responsible department or person', 'owner', answer.owner)}
        ${field('Confirmed by', 'confirmedBy', answer.confirmedBy)}
        ${field('Confirmation date', 'confirmedOn', answer.confirmedOn, 'date')}
        ${field('Current process and exceptions', 'asIs', answer.asIs, 'textarea')}
        ${field('Target requirement', 'requirement', answer.requirement, 'textarea')}
        ${field('Design decision and rationale', 'decision', answer.decision, 'textarea')}
        ${field('Evidence, examples or references', 'evidence', answer.evidence, 'textarea')}
        <div class="iw-wide">${field('Project Item title (optional)', 'itemTitle', answer.itemTitle)}
        <p class="hint">Enter a title to create a Project Item for this agreed decision when you complete the workshop.</p></div>`;
      showForm(
        topic.title,
        `<fieldset class="iw-fields"${editable ? '' : ' disabled'}>${body}</fieldset>`,
        editable,
        { projectId: project.id, workshopId: workshop.id, questionId, original: current }
      );
    }

    function reviewCompletion(project, workshop) {
      if (!a.can('edit') || !a.can('create'))
        throw Error('Project edit and create permissions are required.');
      if (workshop.completion) throw Error('This workshop is already complete.');
      const agreed = E.agreedAnswers(workshop);
      if (!agreed.length) throw Error('Record an agreed decision before completing the workshop.');
      const stats = E.progress(workshop);
      if (stats.followUps) {
        view.filter = 'Follow-ups';
        view.search = '';
        section().outerHTML = render(project);
        throw Error('Resolve the open follow-ups before completing the workshop.');
      }
      const items = agreed.filter(({ answer }) => answer.itemTitle?.trim()).length;
      const companies = a
        .state()
        .projectCompanies.filter(row => row.projectId === project.id && row.active !== false);
      const types = a.state().lists.projectItemTypes;
      const defaultType = types.includes('Blueprint') ? 'Blueprint' : types[0];
      showForm(
        'Complete implementation workshop',
        `<p class="iw-wide">This will publish ${agreed.length} agreed decision${agreed.length === 1 ? '' : 's'} to Companies &amp; Processes${items ? ` and create ${items} Project Item${items === 1 ? '' : 's'}` : ''}. Your project Overview will show the completed workshop.</p>
        <p class="iw-wide hint">The completed workshop becomes a read-only record.${stats.unanswered ? ` It contains ${stats.unanswered} unanswered question${stats.unanswered === 1 ? '' : 's'}.` : ''}</p>
        <label>Company for these records<select name="companyId">${option('', 'Project-wide', '')}${companies.map(row => option(row.id, row.name, '')).join('')}</select></label>
        ${items ? `<label>Project Item type<select name="itemType" required>${types.map(type => option(type, type, defaultType)).join('')}</select></label>` : ''}`,
        true,
        {
          projectId: project.id,
          workshopId: workshop.id,
          complete: true,
          snapshot: JSON.stringify(workshop),
        }
      );
    }
    function save(form) {
      const context = draft;
      const project = getProject();
      if (
        !context ||
        context.form !== form ||
        !modal().open ||
        !a.active() ||
        context.projectId !== project?.id ||
        context.account !== a.account() ||
        !a.can('edit')
      )
        throw Error('Reopen the workshop editor for the current project.');
      const workshop = E.rows(project).find(row => row.id === context.workshopId);
      if (context.workshopId && !workshop) throw Error('This workshop is no longer available.');
      if (workshop?.completion) throw Error('This workshop is already complete.');
      const inputs = new FormData(form);
      const get = key => String(inputs.get(key) || '').trim();
      if (context.complete) {
        if (!a.can('create') || JSON.stringify(workshop) !== context.snapshot)
          throw Error(
            'The workshop changed or your permissions changed. Reopen the completion review.'
          );
        const saved = a.mutate(d =>
          E.completeWorkshop(d, project.id, workshop.id, {
            companyId: get('companyId'),
            itemType: get('itemType'),
            date: a.today(),
            uid: a.uid,
          })
        );
        if (saved) a.tell('Workshop complete. Project records created.');
      } else if (context.questionId) {
        const topic = E.topics.find(t => t.questions.some(([id]) => id === context.questionId));
        if (!E.available(topic, workshop.answers).some(([id]) => id === context.questionId))
          throw Error('This question is now out of scope. Reopen the workshop to refresh it.');
        const current = workshop.answers[context.questionId];
        const same =
          current === context.original ||
          (current &&
            context.original &&
            [...Object.keys(E.empty), 'itemTitle'].every(
              key => current[key] === context.original[key]
            ));
        if (!same) throw Error('The answer changed. Reopen it before saving.');
        const answer = Object.fromEntries(Object.keys(E.empty).map(key => [key, get(key)]));
        const itemTitle = get('itemTitle');
        if (itemTitle) answer.itemTitle = itemTitle;
        E.validateAnswer(context.questionId, answer);
        const saved = a.mutate(d => {
          d.projects
            .find(p => p.id === project.id)
            .implementationWorkshops.find(w => w.id === workshop.id).answers[context.questionId] =
            answer;
        });
        if (saved) a.tell('Workshop answer saved.');
      } else {
        if (
          workshop &&
          (workshop.name !== context.original[0] || workshop.scope !== context.original[1])
        )
          throw Error('The workshop scope changed. Reopen it before saving.');
        const next = {
          id: workshop?.id || a.uid(),
          version: 1,
          name: get('name'),
          scope: get('scope'),
          answers: workshop?.answers || {},
        };
        const saved = a.mutate(d => {
          const target = d.projects.find(p => p.id === project.id);
          target.implementationWorkshops = workshop
            ? E.rows(target).map(row =>
                row.id === next.id ? { ...next, answers: row.answers } : row
              )
            : [...E.rows(target), next];
        });
        view.workshopId = next.id;
        view.search = view.filter = '';
        const host = section();
        if (host) host.outerHTML = render(getProject());
        if (saved) a.tell('Implementation workshop saved.');
      }
      draft = null;
      a.closeModal();
    }

    function redrawQuestions(project, workshop) {
      const host = section()?.querySelector('#iwQuestions');
      if (host && project.id === view.projectId && workshop)
        host.innerHTML = questionList(workshop);
    }

    document.addEventListener('click', event => {
      const button = event.target.closest?.('#iwWorkspace [data-iw]');
      if (!button || !a.active()) return;
      const project = getProject();
      const workshop = sync(project);
      try {
        if (button.dataset.iw === 'workshop')
          editWorkshop(project, button.dataset.edit ? workshop : null);
        if (button.dataset.iw === 'answer' && workshop)
          editAnswer(project, workshop, button.dataset.question);
        if (button.dataset.iw === 'complete' && workshop) reviewCompletion(project, workshop);
        if (button.dataset.iw === 'export' && workshop) {
          a.download(
            E.csv(project, workshop),
            'sap-mm-implementation-workshop.csv',
            'text/csv;charset=utf-8',
            'specs'
          );
        }
      } catch (error) {
        a.tell(error.message, true);
      }
    });
    document.addEventListener('submit', event => {
      if (event.target.id !== 'iwForm') return;
      event.preventDefault();
      try {
        save(event.target);
      } catch (error) {
        a.tell(error.message, true);
      }
    });
    document.addEventListener('change', event => {
      if (!a.active() || !event.target.closest?.('#iwWorkspace')) return;
      const project = getProject();
      const workshop = sync(project);
      if (event.target.id === 'iwWorkshop') {
        view.workshopId = event.target.value;
        view.search = view.filter = '';
        section().outerHTML = render(project);
      }
      if (event.target.id === 'iwTopic') {
        view.topic = event.target.value;
        view.search = view.filter = '';
        section().querySelector('#iwSearch').value = '';
        section().querySelector('#iwFilter').value = '';
        redrawQuestions(project, workshop);
      }
      if (event.target.id === 'iwFilter') {
        view.filter = event.target.value;
        redrawQuestions(project, workshop);
      }
    });
    document.addEventListener('input', event => {
      if (event.target.id !== 'iwSearch' || !a.active()) return;
      const project = getProject();
      const workshop = sync(project);
      view.search = event.target.value;
      redrawQuestions(project, workshop);
    });
    return { render, overview, decisions };
  }
  globalThis.WorkHubImplementationWorkshop = { install };
})();
