/** Private in-canvas tools. Saves one validated process transaction at the end of an edit. */
(function (root) {
  'use strict';
  const E = root.WorkHubRehearsalEngine,
    A = root.WorkHubProcessCanvasArt;
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const copy = v => JSON.parse(JSON.stringify(v));
  const id = () =>
    root.crypto?.randomUUID?.() ||
    'canvas-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  function install(a) {
    const { panel, host, stage } = a,
      doc = host.ownerDocument;
    let nodes = new Set();
    let selected = '',
      node = '',
      draft = null,
      gesture = null,
      dropPreview = null,
      frame = 0,
      process = '',
      history = [],
      editor = null,
      tool = 'move',
      linkFrom = '';
    const live = () => a.live() && !!panel.isConnected;
    const model = () => draft || a.canvas.model();
    const notify = s => {
      const n = stage.querySelector('[data-pc-notice]');
      if (n) n.textContent = s;
    };
    function collapse() {
      for (const d of stage.querySelectorAll('.pc-bubbles > details')) d.open = false;
    }
    function setTool(value) {
      a.freezeCamera?.();
      a.setTool(value === 'connect' ? 'move' : value);
      tool = value;
      if (value !== 'connect') linkFrom = '';
      host.dataset.tool = value;
      for (const b of panel.querySelectorAll('[data-presenter="tool"]'))
        b.setAttribute('aria-pressed', String(b.dataset.value === value));
      if (!['select', 'connect'].includes(value)) selected = '';
      collapse();
      a.publish();
    }
    function menu(title, nodes) {
      const d = doc.createElement('details');
      d.className = 'pc-bubble';
      d.innerHTML = '<summary>' + title + '</summary><div class="pc-bubble-menu"></div>';
      for (const n of nodes.filter(Boolean)) d.lastElementChild.append(n);
      return d;
    }
    const bubbles = doc.createElement('div');
    bubbles.className = 'pc-bubbles';
    const ink = panel.querySelector('.presenter-ink'),
      text = panel.querySelector('.presenter-text-tools');
    if (text) {
      text.querySelector('[name="annotationText"]').maxLength = 1000;
      text.querySelector('[name="annotationSize"]').max = 96;
    }
    const types = doc.createElement('div');
    types.className = 'pc-type-tray';
    types.innerHTML =
      '<p>Drag a type onto the diagram, or tap to place it. Drop onto a card to attach magnetically.</p>' +
      E.TYPES.map(
        type =>
          '<button type="button" draggable="true" data-pc-type="' +
          type +
          '"><b>' +
          E.TYPE_ICONS[type] +
          '</b>' +
          esc(E.TYPE_LABELS[type]) +
          '</button>'
      ).join('');
    const quick = doc.createElement('div');
    quick.className = 'pc-quick';
    quick.innerHTML =
      '<button type="button" data-pc="select-all">Select all steps</button><button type="button" data-pc="clear-selection">Clear selection</button><button type="button" data-pc="edit-step">Edit selected step</button><button type="button" data-pc="connect">Connect ports</button><button type="button" data-pc="finish-links">Done linking</button><button type="button" data-pc="attach">Attach note / arrow to step</button><button type="button" data-pc="detach">Detach selected</button><button type="button" data-pc="links">Project / knowledge links</button><button type="button" data-pc="undo">Undo canvas edit</button><button type="button" data-pc="copy">Save editable copy</button><button type="button" data-presenter="end">End presentation</button>';
    for (const [action, label] of [
      ['manage-connections', 'Unlink / manage connections'],
      ['delete-steps', 'Delete selected steps'],
    ]) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.dataset.pc = action;
      button.textContent = label;
      quick.prepend(button);
    }
    const canvasTools = panel.querySelector('.presenter-canvas-tools'),
      opts = panel.querySelector('.presenter-screen-options'),
      walk = panel.querySelector('.presenter-controls'),
      notes = panel.querySelector('.presenter-notes'),
      display = panel.querySelector('.presenter-display-actions'),
      status = panel.querySelector('[data-presenter-status]');
    const retry = doc.createElement('button');
    retry.type = 'button';
    retry.dataset.presenter = 'window';
    retry.setAttribute('data-presenter-retry', '');
    retry.textContent = 'Retry audience';
    if (display) display.append(retry);
    bubbles.append(
      menu('✦ Tools', [ink, text]),
      menu('＋ Steps', [types, quick]),
      menu('▷ Playback', [walk]),
      menu('◉ View & notes', [opts, notes, display, status])
    );
    const notice = doc.createElement('p');
    notice.className = 'pc-notice';
    notice.setAttribute('data-pc-notice', '');
    notice.setAttribute('role', 'status');
    stage.append(bubbles, notice);
    const dock = doc.createElement('div');
    dock.className = 'pc-playback-dock';
    dock.setAttribute('aria-label', 'Canvas playback controls');
    dock.setAttribute('role', 'group');
    if (canvasTools) dock.append(canvasTools);
    if (a.canvas.sound) {
      const sound = doc.createElement('button');
      sound.type = 'button';
      sound.dataset.pc = 'sound';
      sound.textContent = 'Enable sound';
      dock.append(sound);
    }
    stage.append(dock);
    const marquee = doc.createElement('div');
    marquee.className = 'pc-marquee';
    marquee.hidden = true;
    marquee.setAttribute('aria-hidden', 'true');
    stage.append(marquee);
    function selectionNotice() {
      notify(
        nodes.size
          ? nodes.size + ' steps selected · drag a selected step to move the group.'
          : 'Drag empty canvas to select steps. Shift / Ctrl adds steps; Ctrl / ⌘ A selects all.'
      );
    }
    const hint = panel.querySelector('.presenter-hint');
    if (hint) hint.remove();
    function position(e) {
      const svg = host.querySelector('.av-graph'),
        camera = a.camera();
      if (!svg || !camera) return null;
      return root.WorkHubAudienceView.graphPoint(
        [e.clientX, e.clientY],
        svg.getBoundingClientRect(),
        camera
      );
    }
    function schedule() {
      if (!frame)
        frame = root.requestAnimationFrame(() => {
          frame = 0;
          if (live()) a.publish();
        });
    }
    function reference(name, label, rows, value) {
      return (
        '<label>' +
        label +
        '<select name="' +
        name +
        '"><option value="">None</option>' +
        rows
          .map(
            r =>
              '<option value="' +
              esc(r.id) +
              '"' +
              (r.id === value ? ' selected' : '') +
              '>' +
              esc(r.title) +
              '</option>'
          )
          .join('') +
        (value && !rows.some(r => r.id === value)
          ? '<option selected value="' + esc(value) + '">Saved reference (unavailable)</option>'
          : '') +
        '</select></label>'
      );
    }
    function field(key, label, value = '', textarea = false, max = 32767) {
      return (
        '<label>' +
        label +
        (textarea
          ? '<textarea name="' + key + '" maxlength="' + max + '">' + esc(value) + '</textarea>'
          : '<input name="' + key + '" maxlength="' + max + '" value="' + esc(value) + '">') +
        '</label>'
      );
    }
    function openEditor(title, html) {
      editor?.remove();
      editor = doc.createElement('section');
      editor.className = 'pc-editor';
      editor.setAttribute('role', 'dialog');
      editor.setAttribute('aria-label', title);
      editor.innerHTML =
        '<header><strong>' +
        esc(title) +
        '</strong><button type="button" data-pc="cancel">✕</button></header>' +
        html;
      stage.append(editor);
      collapse();
    }
    function commit(next, before) {
      if (!live()) return false;
      E.validateCanvas(next);
      const ok = a.canvas.save(next, before);
      if (ok === false) return false;
      const after = a.canvas.model();
      history.push({ before: copy(before), after: JSON.stringify(after) });
      if (history.length > 20) history.shift();
      draft = null;
      notify('Saved with this process.');
      a.publish();
      return true;
    }
    function cleanDraft() {
      dropPreview?.remove();
      dropPreview = null;
      draft = null;
      gesture = null;
      marquee.hidden = true;
      editor?.remove();
      editor = null;
      a.publish();
    }
    function routeFields(step, p) {
      const rows = p.steps.map(s => ({ id: s.id, title: s.title })),
        answers = step.decision?.answers || [
          { label: 'Yes', next: step.next },
          { label: 'No', next: step.alternatives?.[0] || step.failNext || '' },
        ];
      return (
        '<details><summary>Connections & decision answers</summary>' +
        reference('next', 'Normal / default destination (None ends the route)', rows, step.next) +
        reference('failNext', 'Exception destination (None ends the route)', rows, step.failNext) +
        '<label>Alternative destinations<select name="alternatives" multiple size="4">' +
        rows
          .map(
            r =>
              '<option value="' +
              esc(r.id) +
              '"' +
              (step.alternatives.includes(r.id) ? ' selected' : '') +
              '>' +
              esc(r.title) +
              '</option>'
          )
          .join('') +
        '</select></label><fieldset data-pc-decision' +
        (step.type !== 'decision' ? ' hidden' : '') +
        '><legend>Named answers</legend>' +
        '<label><input type="checkbox" name="decisionEnabled"' +
        (step.decision ? ' checked' : '') +
        '>Use named answers</label>' +
        field('decisionQuestion', 'Question', step.decision?.question || step.title, false, 500) +
        '<p>Maintain 2–6 different destinations. A blank destination ends the route.</p>' +
        Array.from(
          { length: 6 },
          (_, i) =>
            field('answerLabel' + i, 'Answer ' + (i + 1), answers[i]?.label || '', false, 120) +
            reference('answerNext' + i, 'Destination ' + (i + 1), rows, answers[i]?.next || '')
        ).join('') +
        '<label>Automatic default answer<select name="defaultAnswer">' +
        Array.from(
          { length: 6 },
          (_, i) =>
            '<option value="' +
            i +
            '"' +
            (i ===
            Math.max(
              0,
              answers.findIndex(a => a.next === step.next)
            )
              ? ' selected'
              : '') +
            '>Answer ' +
            (i + 1) +
            '</option>'
        ).join('') +
        '</select></label></fieldset></details>'
      );
    }
    function stepEditor(stepId, source = model(), before = a.canvas.model()) {
      if (source.id === '__demo__') {
        notify('Choose Save editable copy in Steps before editing the example.');
        return;
      }
      a.freezeCamera?.();
      draft = copy(source);
      const s = draft.steps.find(s => s.id === stepId);
      if (!s) return;
      node = stepId;
      const refs = a.canvas.references();
      const form =
        '<form data-pc-form="step">' +
        field('title', 'Step title *', s.title, false, 500) +
        '<label>Step type<select name="type">' +
        E.TYPES.map(
          t =>
            '<option value="' +
            t +
            '"' +
            (t === s.type ? ' selected' : '') +
            '>' +
            E.TYPE_LABELS[t] +
            '</option>'
        ).join('') +
        '</select></label>' +
        field('owner', 'Who handles it', s.owner, false, 200) +
        field('instruction', 'Instructions', s.instruction, true) +
        field('audienceText', 'Explanation for the audience', s.audienceText, true) +
        field('expected', 'Expected result', s.expected, true) +
        '<details open><summary>Organization / material information</summary>' +
        E.ENTITY_FIELDS.map(([k, l]) =>
          field('entity-' + k, l, s.entity?.[k] || '', false, 300)
        ).join('') +
        '</details><details><summary>More information</summary>' +
        [
          ['tcode', 'Transaction / reference codes'],
          ['prerequisites', 'Prerequisites'],
          ['inputs', 'Inputs'],
          ['outputs', 'Outputs'],
          ['failure', 'Exceptions / errors'],
          ['configuration', 'Private configuration notes'],
          ['testing', 'Testing checklist'],
          ['system', 'System / tool'],
          ['workingTime', 'Working time'],
        ]
          .map(([k, l]) => field(k, l, s[k], true))
          .join('') +
        field(
          'changes',
          'Sample value changes',
          s.changes
            .map(c => c.field + (c.operator === 'add' ? ' += ' : ' = ') + c.value)
            .join('\n'),
          true
        ) +
        '<label>Playback seconds (0 = automatic)<input name="duration" type="number" min="0" max="30" step=".5" value="' +
        s.duration +
        '"></label></details>' +
        field('link', 'Reference URL', s.link, false, 2000) +
        routeFields(s, draft) +
        reference('projectId', 'Related project', refs.projects, s.projectId) +
        reference('noteId', 'Knowledge note', refs.notes, s.noteId) +
        '<div class="pc-editor-actions"><button type="button" data-pc="cancel">Cancel</button><button type="submit">Save step</button><button type="button" data-pc="delete-step">Delete step</button></div><p data-pc-error role="alert"></p></form>';
      openEditor('Maintain step', form);
      editor.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        try {
          if (!live()) return;
          const f = e.target,
            v = k => f.elements.namedItem(k).value;
          const row = draft.steps.find(x => x.id === stepId);
          row.title = v('title').trim();
          row.type = v('type');
          row.owner = v('owner');
          row.instruction = v('instruction');
          row.audienceText = v('audienceText');
          row.expected = v('expected');
          for (const key of [
            'tcode',
            'prerequisites',
            'inputs',
            'outputs',
            'failure',
            'configuration',
            'testing',
            'system',
            'workingTime',
            'projectId',
            'noteId',
            'link',
          ])
            row[key] = v(key);
          row.entity = Object.fromEntries(E.ENTITY_FIELDS.map(([k]) => [k, v('entity-' + k)]));
          row.duration = Number(v('duration'));
          row.changes = E.changes(v('changes'));
          row.next = v('next');
          row.failNext = v('failNext');
          row.alternatives = Array.from(f.elements.alternatives.selectedOptions)
            .map(o => o.value)
            .filter(id => id !== row.next);
          if (row.type === 'decision' && f.elements.decisionEnabled.checked) {
            const answers = Array.from({ length: 6 }, (_, i) => ({
              label: v('answerLabel' + i).trim(),
              next: v('answerNext' + i),
            }));
            const defaultAnswer = answers[Number(v('defaultAnswer'))];
            if (!defaultAnswer?.label) throw Error('Choose a maintained default answer.');
            row.decision = {
              question: v('decisionQuestion').trim(),
              answers: answers.filter(a => a.label),
            };
            row.next = defaultAnswer.next;
            row.alternatives = row.decision.answers
              .map(a => a.next)
              .filter(id => id && id !== row.next);
          } else delete row.decision;
          for (const scenario of draft.scenarios)
            if (
              scenario.routes?.[row.id] !== undefined &&
              ![row.next, ...row.alternatives].includes(scenario.routes[row.id])
            )
              delete scenario.routes[row.id];
          if (commit(draft, before)) {
            editor.remove();
            editor = null;
          }
        } catch (err) {
          e.target.querySelector('[data-pc-error]').textContent = err.message;
        }
      });
      editor.querySelector('[name="type"]').addEventListener('change', e => {
        editor.querySelector('[data-pc-decision]').hidden = e.target.value !== 'decision';
      });
      editor.dataset.step = stepId;
      editor._before = copy(before);
      a.publish();
    }
    function descendants(p, id) {
      const ids = new Set([id]);
      for (let i = 0; i < p.steps.length; i++)
        for (const s of p.steps) if (ids.has(s.stackParent)) ids.add(s.id);
      ids.delete(id);
      return ids;
    }
    function near(p, point, ignore = '') {
      return [...p.steps]
        .reverse()
        .find(
          s =>
            s.id !== ignore &&
            point.x >= s.x - 14 &&
            point.x <= s.x + 224 &&
            point.y >= s.y - 14 &&
            point.y <= s.y + 114
        );
    }
    function newStep(type, point) {
      const before = a.canvas.model();
      if (before.id === '__demo__') {
        notify('Save an editable copy before inserting steps.');
        return;
      }
      if (before.steps.length >= (before.hubId ? 200 : 80))
        throw Error('This process has reached its step limit.');
      const next = copy(before),
        base = E.seed('base', new Date().toISOString(), true).steps[0],
        parent = near(next, point),
        source = next.steps.find(s => s.id === linkFrom) || parent;
      const s = {
        ...base,
        id: id(),
        type,
        title: E.TYPE_LABELS[type],
        next: '',
        alternatives: [],
        entity: {},
        x: A.clamp(point.x, 0, 4000),
        y: A.clamp(point.y, 0, 4000),
      };
      if (parent) {
        s.x = A.clamp(parent.x + 24, 0, 4000);
        s.y = A.clamp(parent.y + 116, 0, 4000);
        s.stackParent = parent.id;
      } // destination is inserted before validating below
      next.steps.push(s);
      if (source) {
        // connect now that both endpoints exist
        if (!E.connections(source).includes(s.id)) E.connect(next, source.id, s.id);
      }
      selected = '';
      node = s.id;
      stepEditor(s.id, next, before);
    }
    function saveMark(m) {
      const before = a.canvas.model(),
        next = copy(before);
      if (before.id === '__demo__') {
        notify('Save an editable copy before adding annotations.');
        return;
      }
      if (next.annotations.length >= 100) throw Error('Keep up to 100 process annotations.');
      next.annotations.push(m);
      if (commit(next, before)) {
        selected = m.id;
        setTool('select');
      }
    }
    function select(id) {
      selected = id;
      const m = model().annotations.find(m => m.id === id);
      if (m) {
        const f = panel.querySelector('[name="annotationText"]');
        if (m.type === 'text' && f) f.value = m.text;
        const size = panel.querySelector('[name="annotationSize"]');
        if (size && m.type === 'text') size.value = m.fontSize;
        const color = panel.querySelector('[name="color"]');
        if (color) color.value = m.color;
      }
      a.publish();
    }
    function connectionEditor(source = linkFrom || node || model().steps[0]?.id) {
      const p = a.canvas.model(),
        row = p.steps.find(s => s.id === source);
      if (!row) return;
      openEditor(
        'Connections',
        '<form data-pc-form="connections">' +
          reference(
            'from',
            'Starting step',
            p.steps.map(s => ({ id: s.id, title: s.title })),
            source
          ) +
          '<div class="pc-connected-list">' +
          E.connections(row)
            .map(
              to =>
                '<div><span>' +
                esc(p.steps.find(s => s.id === to)?.title || to) +
                '</span><button type="button" data-pc="unlink-edge" data-from="' +
                esc(source) +
                '" data-to="' +
                esc(to) +
                '">Unlink</button></div>'
            )
            .join('') +
          '</div><p>Removing a link keeps both steps. Undo can restore the connection.</p></form>'
      );
      editor._before = copy(p);
      editor
        .querySelector('[name="from"]')
        .addEventListener('change', e => connectionEditor(e.target.value));
    }
    function action(name, button = null) {
      const p = a.canvas.model(),
        next = copy(p),
        m = next.annotations.find(m => m.id === selected);
      if (name === 'sound') {
        void a.canvas.sound()?.catch(err => notify(err.message));
        return;
      }
      if (name === 'manage-connections') {
        connectionEditor();
        return;
      }
      if (name === 'unlink-edge') {
        const from = button.dataset.from;
        E.disconnect(next, from, button.dataset.to);
        if (commit(next, editor._before)) {
          connectionEditor(from);
          notify('Connection removed · playback continues. Undo can restore it.');
        }
        return;
      }
      if (name === 'delete-steps') {
        if (editor) throw Error('Save or cancel step details before deleting selected steps.');
        const ids = nodes.size ? [...nodes] : node ? [node] : [];
        if (!ids.length) throw Error('Select one or more steps first.');
        if (ids.length >= p.steps.length) throw Error('Keep at least one process step.');
        if (
          !root.confirm(
            'Delete ' +
              ids.length +
              ' selected step' +
              (ids.length === 1 ? '' : 's') +
              ' and their connections? You can undo this canvas edit.'
          )
        )
          return;
        E.removeSteps(next, ids);
        if (commit(next, p)) {
          nodes.clear();
          node = '';
          selected = '';
          linkFrom = '';
          a.publish();
          notify('Steps deleted. Undo can restore them.');
        }
        return;
      }
      if (name === 'select-all' || name === 'clear-selection') {
        setTool('select');
        selected = '';
        nodes = new Set(name === 'select-all' ? model().steps.map(s => s.id) : []);
        node = [...nodes][0] || '';
        a.publish();
        selectionNotice();
        return;
      }
      if (name === 'cancel') {
        cleanDraft();
        return;
      }
      if (name === 'copy') {
        a.canvas.copy();
        cleanDraft();
        return;
      }
      if (name === 'edit-step') {
        if (node) stepEditor(node);
        else notify('Click a step first, then choose Edit selected step.');
      }
      if (name === 'connect') {
        setTool('connect');
        linkFrom = node;
        notify(
          'Click an outgoing point, then click several destinations. Or drag a point to another card. Choose a step type to add a linked step. Playback stays live.'
        );
        a.publish();
      }
      if (name === 'finish-links') {
        setTool('move');
        notify('Connections saved. Playback continues.');
      }
      if (name === 'attach') {
        if (!m) throw Error('Select a note or arrow first.');
        openEditor(
          'Attach annotation',
          '<form data-pc-form="attach">' +
            reference(
              'anchorId',
              'Anchor step',
              p.steps.map(s => ({ id: s.id, title: s.title })),
              m.anchorId || ''
            ) +
            '<p>The object keeps its current position, then follows this step.</p><div class="pc-editor-actions"><button type="button" data-pc="cancel">Cancel</button><button type="submit">Save attachment</button></div><p data-pc-error role="alert"></p></form>'
        );
        editor.querySelector('form').addEventListener('submit', e => {
          e.preventDefault();
          try {
            Object.assign(m, A.attach(m, e.target.elements.anchorId.value || null, next.steps));
            if (commit(next, p)) {
              editor.remove();
              editor = null;
            }
          } catch (err) {
            e.target.querySelector('[data-pc-error]').textContent = err.message;
          }
        });
      }
      if (name === 'detach') {
        if (m) {
          Object.assign(m, A.attach(m, null, next.steps));
          commit(next, p);
        } else if (node) {
          delete next.steps.find(s => s.id === node).stackParent;
          commit(next, p);
        }
      }
      if (name === 'undo') {
        const last = history.at(-1);
        if (!last) return;
        if (JSON.stringify(p) !== last.after)
          throw Error('The process changed after that edit. Undo was left untouched.');
        if (a.canvas.save(last.before, p) !== false) {
          history.pop();
          selected = '';
          a.publish();
        }
      }
      if (name === 'links') {
        const refs = a.canvas.references();
        openEditor(
          'Process links',
          '<form data-pc-form="links">' +
            reference('projectId', 'Related project', refs.projects, p.links.projectId) +
            reference('noteId', 'Knowledge note', refs.notes, p.links.noteId) +
            '<div class="pc-editor-actions"><button type="button" data-pc="cancel">Cancel</button><button type="submit">Save links</button></div><p data-pc-error role="alert"></p></form>'
        );
        editor.querySelector('form').addEventListener('submit', e => {
          e.preventDefault();
          try {
            const f = e.target;
            next.links = { projectId: f.elements.projectId.value, noteId: f.elements.noteId.value };
            if (commit(next, p)) {
              editor.remove();
              editor = null;
            }
          } catch (err) {
            e.target.querySelector('[data-pc-error]').textContent = err.message;
          }
        });
      }
      if (name === 'delete-step' && editor) {
        const stepId = editor.dataset.step,
          before = editor._before,
          base = copy(draft || p);
        E.removeStep(base, stepId);
        if (commit(base, before)) {
          editor.remove();
          editor = null;
          node = '';
          selected = '';
        }
      }
    }
    stage.addEventListener(
      'click',
      e => {
        const type = e.target.closest('[data-pc-type]')?.dataset.pcType;
        if (type && e.detail === 0) {
          try {
            const c = a.camera();
            newStep(type, { x: c.x + c.width / 2 - 105, y: c.y + c.height / 2 - 50 });
          } catch (err) {
            notify(err.message);
          }
          return;
        }
        const b = e.target.closest('[data-pc],[data-presenter]');
        if (!b) return;
        const name = b.dataset.pc,
          old = b.dataset.presenter;
        try {
          if (name) {
            e.preventDefault();
            e.stopImmediatePropagation();
            action(name, b);
            if (!['links', 'edit-step', 'cancel'].includes(name)) collapse();
            return;
          }
          if (old === 'tool') {
            e.preventDefault();
            e.stopImmediatePropagation();
            setTool(b.dataset.value);
            return;
          }
          if (['update-text', 'delete-mark', 'clear', 'undo'].includes(old)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (old === 'undo') {
              action('undo');
              collapse();
              return;
            }
            const before = a.canvas.model(),
              next = copy(before),
              m = next.annotations.find(m => m.id === selected);
            if (old === 'update-text') {
              if (!m || m.type !== 'text') throw Error('Select a saved text note first.');
              m.text = panel.querySelector('[name="annotationText"]').value.trim();
              m.fontSize = A.clamp(
                Number(panel.querySelector('[name="annotationSize"]').value) || 24,
                8,
                96
              );
              m.color = panel.querySelector('[name="color"]').value;
            }
            if (old === 'delete-mark')
              next.annotations = next.annotations.filter(m => m.id !== selected);
            if (old === 'clear') next.annotations = [];
            commit(next, before);
            if (old !== 'update-text') selected = '';
            collapse();
          } else if (!['screens', 'close-panel'].includes(old)) collapse();
        } catch (err) {
          notify(err.message);
        }
      },
      true
    );
    stage.addEventListener(
      'change',
      e => {
        if (!live()) return;
        const n = e.target.name;
        if (!['color', 'width'].includes(n)) return;
        e.stopImmediatePropagation();
        const before = a.canvas.model(),
          next = copy(before),
          m = next.annotations.find(m => m.id === selected);
        if (tool === 'select' && m) {
          if (n === 'color') m.color = e.target.value;
          else m.width = Number(e.target.value);
          try {
            commit(next, before);
          } catch (err) {
            notify(err.message);
          }
        }
      },
      true
    );
    stage.addEventListener(
      'wheel',
      e => {
        if (host.contains(e.target) && (gesture || !['move', 'select'].includes(tool))) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      { capture: true, passive: false }
    );
    stage.addEventListener('dragstart', e => {
      if (e.target.closest('[data-pc-type]')) e.preventDefault();
    });
    stage.addEventListener(
      'pointerdown',
      e => {
        if (!live() || e.button !== 0) return;
        const type = e.target.closest('[data-pc-type]')?.dataset.pcType;
        if (type) {
          e.preventDefault();
          e.stopImmediatePropagation();
          gesture = { kind: 'palette', type, id: e.pointerId, start: [e.clientX, e.clientY] };
          dropPreview?.remove();
          dropPreview = doc.createElement('div');
          dropPreview.className = 'pc-drop-preview';
          dropPreview.textContent = E.TYPE_ICONS[type] + ' ' + E.TYPE_LABELS[type];
          dropPreview.hidden = true;
          stage.append(dropPreview);
          try {
            stage.setPointerCapture(e.pointerId);
          } catch {}
          return;
        }
        if (!host.contains(e.target) || !position(e)) return;
        const point = position(e),
          markId = e.target.closest('[data-canvas-mark]')?.dataset.canvasMark,
          stepId = e.target.closest('[data-node]')?.dataset.node,
          port = e.target.closest('[data-pc-port]');
        if (stepId) node = stepId;
        if (tool === 'move' && !port) return;
        if (tool === 'laser') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        a.freezeCamera?.();
        const before = a.canvas.model();
        if (tool === 'select' && !stepId && !markId && !port) {
          const base = e.shiftKey || e.ctrlKey || e.metaKey ? [...nodes] : [];
          nodes = new Set(base);
          selected = node = '';
          gesture = {
            kind: 'marquee',
            id: e.pointerId,
            start: point,
            client: [e.clientX, e.clientY],
            base,
          };
          try {
            stage.setPointerCapture(e.pointerId);
          } catch {}
          host.focus({ preventScroll: true });
          a.publish();
          selectionNotice();
          return;
        }
        if (before.id === '__demo__') {
          notify('Save an editable copy to edit this canvas.');
          return;
        }
        const state = {
          id: e.pointerId,
          start: point,
          before: copy(before),
          original: copy(before),
        };
        if (port || (tool === 'connect' && stepId)) {
          gesture = {
            ...state,
            kind: 'wire',
            from: port?.dataset.pcStep || linkFrom || stepId,
            direction: port?.dataset.pcPort || 'out',
            startNode: stepId,
            moved: false,
          };
        } else if (tool === 'select' && markId) {
          selected = markId;
          nodes.clear();
          gesture = {
            ...state,
            kind: e.target.dataset.pcResize ? 'resize' : 'mark',
            handle: e.target.dataset.pcResize,
            mark: markId,
          };
          draft = copy(before);
          select(markId);
        } else if (tool === 'select' && stepId) {
          selected = '';
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            if (nodes.has(stepId)) nodes.delete(stepId);
            else nodes.add(stepId);
            a.publish();
            selectionNotice();
            return;
          }
          if (!nodes.has(stepId)) nodes = new Set([stepId]);
          gesture = { ...state, kind: 'node', node: stepId, nodes: [...nodes] };
          draft = copy(before);
        } else if (tool === 'select') {
          selected = '';
          a.publish();
        } else if (tool === 'text') {
          const value = panel.querySelector('[name="annotationText"]').value.trim();
          if (!value) {
            notify('Type your live text in the Tools bubble, then choose Text.');
            return;
          }
          const m = {
            id: id(),
            type: 'text',
            x: A.clamp(point.x, 0, 7000),
            y: A.clamp(point.y, 0, 7000),
            w: 320,
            h: 110,
            fontSize: A.clamp(
              Number(panel.querySelector('[name="annotationSize"]').value) || 24,
              8,
              96
            ),
            width: 4,
            color: panel.querySelector('[name="color"]').value,
            text: value,
          };
          const target = before.steps.find(s => s.id === stepId);
          saveMark(target ? A.attach(m, target, before.steps) : m);
          return;
        } else if (['arrow', 'pen'].includes(tool)) {
          draft = copy(before);
          const m = {
            id: id(),
            type: tool,
            x: A.clamp(point.x, 0, 7000),
            y: A.clamp(point.y, 0, 7000),
            width: Number(panel.querySelector('[name="width"]').value) || 4,
            color: panel.querySelector('[name="color"]').value,
            points: [
              [0, 0],
              [0, 0],
            ],
          };
          draft.annotations.push(m);
          selected = m.id;
          gesture = { ...state, kind: 'draw', mark: m.id, anchor: stepId };
        }
        if (gesture) {
          try {
            stage.setPointerCapture(e.pointerId);
          } catch {}
          host.focus({ preventScroll: true });
        }
        a.publish();
      },
      true
    );
    stage.addEventListener(
      'pointermove',
      e => {
        if (!gesture || gesture.id !== e.pointerId || !live()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (gesture.kind === 'palette') {
          if (Math.hypot(e.clientX - gesture.start[0], e.clientY - gesture.start[1]) > 8) {
            collapse();
            const r = stage.getBoundingClientRect();
            dropPreview.hidden = false;
            dropPreview.style.transform =
              'translate(' + (e.clientX - r.left + 16) + 'px,' + (e.clientY - r.top + 16) + 'px)';
          }
          return;
        }
        const point = position(e);
        if (!point) return;
        const dx = point.x - gesture.start.x,
          dy = point.y - gesture.start.y;
        if (gesture.kind === 'marquee') {
          const x = Math.min(point.x, gesture.start.x),
            y = Math.min(point.y, gesture.start.y),
            right = Math.max(point.x, gesture.start.x),
            bottom = Math.max(point.y, gesture.start.y);
          nodes = new Set(gesture.base);
          if (Math.hypot(e.clientX - gesture.client[0], e.clientY - gesture.client[1]) > 4)
            for (const step of model().steps)
              if (step.x <= right && step.x + 210 >= x && step.y <= bottom && step.y + 100 >= y)
                nodes.add(step.id);
          const r = stage.getBoundingClientRect();
          marquee.hidden = false;
          Object.assign(marquee.style, {
            left: Math.min(e.clientX, gesture.client[0]) - r.left + 'px',
            top: Math.min(e.clientY, gesture.client[1]) - r.top + 'px',
            width: Math.abs(e.clientX - gesture.client[0]) + 'px',
            height: Math.abs(e.clientY - gesture.client[1]) + 'px',
          });
          node = [...nodes][0] || '';
          selectionNotice();
          schedule();
          return;
        }
        if (gesture.kind === 'wire') {
          gesture.moved ||= Math.hypot(dx, dy) > 5;
          const path = host.querySelector('.pc-wire-preview'),
            from = gesture.before.steps.find(s => s.id === gesture.from);
          if (path && from) {
            path.removeAttribute('hidden');
            path.setAttribute(
              'd',
              'M' +
                (from.x + (gesture.direction === 'out' ? 210 : 0)) +
                ',' +
                (from.y + 50) +
                ' Q' +
                point.x +
                ',' +
                (from.y + 50) +
                ' ' +
                point.x +
                ',' +
                point.y
            );
          }
          return;
        }
        if (gesture.kind === 'draw') {
          const m = draft.annotations.find(m => m.id === gesture.mark),
            pt = [point.x - m.x, point.y - m.y];
          if (m.type === 'arrow') m.points = [m.points[0], pt];
          else if (m.points.length < 300) m.points.push(pt);
        } else if (gesture.kind === 'node') {
          const moving = new Set(gesture.nodes);
          for (const id of gesture.nodes)
            for (const child of descendants(gesture.original, id)) moving.add(child);
          const originals = gesture.original.steps.filter(s => moving.has(s.id)),
            mx = A.clamp(
              dx,
              -Math.min(...originals.map(s => s.x)),
              4000 - Math.max(...originals.map(s => s.x))
            ),
            my = A.clamp(
              dy,
              -Math.min(...originals.map(s => s.y)),
              4000 - Math.max(...originals.map(s => s.y))
            );
          for (const row of draft.steps)
            if (moving.has(row.id)) {
              const old = originals.find(s => s.id === row.id);
              row.x = old.x + mx;
              row.y = old.y + my;
              if (row.stackParent && !moving.has(row.stackParent)) delete row.stackParent;
            }
        } else {
          const old = gesture.original.annotations.find(m => m.id === gesture.mark),
            at = draft.annotations.findIndex(m => m.id === gesture.mark);
          draft.annotations[at] =
            gesture.kind === 'resize'
              ? A.resize(old, gesture.handle, dx, dy)
              : {
                  ...copy(old),
                  x: A.clamp(old.x + dx, -8000, 8000),
                  y: A.clamp(old.y + dy, -8000, 8000),
                };
        }
        schedule();
      },
      true
    );
    function cancel() {
      host.querySelector('.pc-wire-preview')?.setAttribute('hidden', '');
      dropPreview?.remove();
      dropPreview = null;
      if (gesture?.kind === 'marquee') nodes = new Set(gesture.base);
      gesture = null;
      draft = null;
      marquee.hidden = true;
      a.publish();
    }
    stage.addEventListener(
      'pointerup',
      e => {
        if (!gesture || gesture.id !== e.pointerId || !live()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const done = gesture,
          point = position(e);
        gesture = null;
        marquee.hidden = true;
        try {
          if (done.kind === 'marquee') {
            a.publish();
            selectionNotice();
            return;
          }
          if (done.kind === 'palette') {
            const r = host.getBoundingClientRect();
            const drop = point || { x: 100, y: 100 };
            if (Math.hypot(e.clientX - done.start[0], e.clientY - done.start[1]) <= 8) {
              const c = a.camera();
              drop.x = c.x + c.width / 2 - 105;
              drop.y = c.y + c.height / 2 - 50;
            } else if (
              e.clientX < r.left ||
              e.clientX > r.right ||
              e.clientY < r.top ||
              e.clientY > r.bottom
            )
              return;
            newStep(done.type, drop);
            return;
          }
          if (done.kind === 'wire') {
            const element = stage.ownerDocument.elementFromPoint?.(e.clientX, e.clientY),
              port = element?.closest('[data-pc-port]'),
              target =
                port?.dataset.pcStep ||
                element?.closest('[data-node]')?.dataset.node ||
                (!done.moved ? done.startNode : '');
            const source = !done.moved && done.direction === 'in' ? linkFrom : done.from;
            if (
              target &&
              target !== source &&
              (!port || port.dataset.pcPort !== done.direction || !done.moved)
            ) {
              const next = copy(done.before);
              E.connect(
                next,
                done.direction === 'out' || !done.moved ? source : target,
                done.direction === 'out' || !done.moved ? target : done.from
              );
              if (!source) throw Error('Choose an outgoing point first.');
              commit(next, done.before);
              linkFrom = done.direction === 'out' || !done.moved ? source : target;
              tool = 'connect';
              host.dataset.tool = 'connect';
              notify(
                'Connected · playback continues. Choose another destination, or a step type to add a linked step.'
              );
            } else if (done.direction === 'out') {
              linkFrom = done.from;
              tool = 'connect';
              host.dataset.tool = 'connect';
              notify(
                'Starting point selected · click more destinations, or choose a step type to add a linked step.'
              );
            } else notify('Choose an outgoing point first, then this destination.');
            host.querySelector('.pc-wire-preview')?.setAttribute('hidden', '');
            a.publish();
            return;
          }
          if (done.kind === 'draw') {
            const m = draft.annotations.find(m => m.id === done.mark);
            if (Math.hypot(...m.points.at(-1)) < 4) {
              draft = null;
              a.publish();
              return;
            }
            if (done.anchor)
              Object.assign(
                m,
                A.attach(
                  m,
                  draft.steps.find(s => s.id === done.anchor),
                  draft.steps
                )
              );
          }
          if (done.kind === 'node' && done.nodes.length === 1 && point && !e.altKey) {
            const row = draft.steps.find(s => s.id === done.node),
              parent = near(draft, point, row.id);
            if (parent) {
              const x = A.clamp(parent.x + 24, 0, 4000),
                y = A.clamp(parent.y + 116, 0, 4000);
              const children = descendants(draft, row.id);
              for (const child of draft.steps)
                if (children.has(child.id)) {
                  child.x = A.clamp(child.x + x - row.x, 0, 4000);
                  child.y = A.clamp(child.y + y - row.y, 0, 4000);
                }
              row.x = x;
              row.y = y;
              row.stackParent = parent.id;
              E.connect(draft, parent.id, row.id);
            }
          }
          commit(draft, done.before);
          if (done.kind === 'draw') setTool('select');
        } catch (err) {
          draft = null;
          notify(err.message);
          a.publish();
        } finally {
          host.querySelector('.pc-wire-preview')?.setAttribute('hidden', '');
          dropPreview?.remove();
          dropPreview = null;
          try {
            if (stage.hasPointerCapture?.(e.pointerId)) stage.releasePointerCapture(e.pointerId);
          } catch {}
        }
      },
      true
    );
    for (const type of ['pointercancel', 'lostpointercapture'])
      stage.addEventListener(
        type,
        e => {
          if (gesture?.id === e.pointerId) {
            e.stopImmediatePropagation();
            cancel();
          }
        },
        true
      );
    stage.addEventListener(
      'dblclick',
      e => {
        if (e.target.closest('[data-node]') && host.contains(e.target)) {
          e.stopImmediatePropagation();
          stepEditor(e.target.closest('[data-node]').dataset.node);
        }
      },
      true
    );
    host.addEventListener(
      'keydown',
      e => {
        if (!live()) return;
        const port = e.target.closest('[data-pc-port]');
        if (port && ['Enter', ' '].includes(e.key)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          try {
            a.freezeCamera?.();
            if (port.dataset.pcPort === 'out') {
              linkFrom = port.dataset.pcStep;
              tool = 'connect';
              host.dataset.tool = 'connect';
              notify('Starting point selected · choose one or more destinations.');
            } else if (linkFrom) {
              const before = a.canvas.model(),
                next = copy(before);
              E.connect(next, linkFrom, port.dataset.pcStep);
              commit(next, before);
              notify('Connected · choose another destination to add a branch.');
            } else notify('Choose an outgoing point first.');
            a.publish();
          } catch (err) {
            notify(err.message);
          }
          return;
        }
        if (e.key === 'Escape' && (gesture || editor)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (gesture?.kind === 'marquee') nodes = new Set(gesture.base);
          cleanDraft();
          return;
        }
        if (e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
          e.preventDefault();
          e.stopImmediatePropagation();
          setTool('select');
          selected = '';
          nodes = new Set(model().steps.map(s => s.id));
          node = [...nodes][0] || '';
          a.publish();
          selectionNotice();
          return;
        }
        if (e.key === 'Escape' && nodes.size) {
          e.preventDefault();
          e.stopImmediatePropagation();
          nodes.clear();
          node = '';
          linkFrom = '';
          a.publish();
          return;
        }
        if (tool === 'select' && selected) {
          const before = a.canvas.model(),
            next = copy(before),
            m = next.annotations.find(m => m.id === selected);
          if (!m) return;
          const delta = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
          }[e.key];
          if (delta) {
            e.preventDefault();
            e.stopImmediatePropagation();
            m.x += delta[0] * (e.shiftKey ? 10 : 2);
            m.y += delta[1] * (e.shiftKey ? 10 : 2);
            try {
              commit(next, before);
            } catch (err) {
              notify(err.message);
            }
          }
          if (['Delete', 'Backspace'].includes(e.key)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            next.annotations = next.annotations.filter(m => m.id !== selected);
            commit(next, before);
            selected = '';
          }
        }
      },
      true
    );
    return {
      sync() {
        const p = a.canvas.model();
        const sound = dock.querySelector('[data-pc="sound"]');
        if (sound && a.canvas.audio) {
          const audio = a.canvas.audio();
          sound.textContent = audio.label;
          sound.setAttribute('aria-pressed', String(audio.enabled));
        }
        if (process !== p.id) {
          process = p.id;
          history = [];
          draft = null;
          selected = '';
          node = '';
          linkFrom = '';
          nodes.clear();
          marquee.hidden = true;
          editor?.remove();
          editor = null;
        }
      },
      snapshot(snapshot) {
        if (snapshot.kind !== 'process') return snapshot;
        const p = model();
        return {
          ...snapshot,
          steps: p.steps.map(s => ({
            id: s.id,
            title: s.title,
            type: s.type,
            x: s.x,
            y: s.y,
            entity: s.entity || {},
            stackParent: s.stackParent || '',
          })),
          annotations: copy(p.annotations || []),
          edges: p.steps.flatMap(s =>
            E.connections(s).map(to => ({
              from: s.id,
              to,
              failure: to === s.failNext,
              label: E.answers(s).find(a => a.next === to)?.label || '',
            }))
          ),
        };
      },
      options: () => ({
        canvasSelection: selected,
        selectedNode: node,
        selectedNodes: [...nodes],
        connectFrom: linkFrom,
      }),
      destroy() {
        marquee.remove();
        dropPreview?.remove();
        dropPreview = null;
        if (frame) root.cancelAnimationFrame(frame);
        frame = 0;
        gesture = draft = null;
        editor?.remove();
        editor = null;
      },
      state: () => ({
        selected,
        node,
        nodes: [...nodes],
        editing: !!editor,
        dragging: !!gesture,
        linking: !!linkFrom,
      }),
    };
  }
  root.WorkHubProcessCanvas = { install };
})(window);
