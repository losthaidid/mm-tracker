/* Deterministic sentence rules. No network, generated code, or AI. */
(function (root) {
  'use strict';
  const E = root.WorkHubRehearsalEngine;
  const copy = v => JSON.parse(JSON.stringify(v));
  const norm = v => String(v).trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const text = (v, n) =>
    typeof v === 'string' && v.length <= n && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
  const keyOK = v =>
    /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(v) &&
    !['constructor', 'prototype', '__proto__'].includes(v);
  const re = v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const LIMITS = { fields: 30, actions: 40, patterns: 100, values: 200, input: 12000, steps: 80 };
  function defaults() {
    return {
      version: 1,
      fields: [
        {
          key: 'quantity',
          label: 'Quantity',
          kind: 'number',
          target: 'Quantity',
          aliases: ['quantity', 'qty'],
          values: [],
        },
        {
          key: 'SLoc',
          label: 'Storage location',
          kind: 'entity',
          target: 'storageLocation',
          aliases: ['SLoc', 'storage location'],
          values: [],
        },
        {
          key: 'fromSLoc',
          label: 'Source storage location',
          kind: 'entity',
          target: 'storageLocation',
          aliases: ['fromSLoc'],
          values: [],
        },
        {
          key: 'material',
          label: 'Material',
          kind: 'entity',
          target: 'materialCode',
          aliases: ['material', 'item'],
          values: [],
        },
        {
          key: 'person',
          label: 'Person responsible',
          kind: 'person',
          target: '',
          aliases: ['person', 'responsible person'],
          values: [],
        },
        {
          key: 'department',
          label: 'Department responsible',
          kind: 'department',
          target: '',
          aliases: ['department', 'team'],
          values: [],
        },
        {
          key: 'status',
          label: 'Status',
          kind: 'text',
          target: 'Status',
          aliases: ['status'],
          values: [],
        },
      ],
      actions: [
        {
          key: 'receive',
          label: 'Receive',
          aliases: ['receive', 'received'],
          type: 'document',
          effect: 'add',
          quantity: 'quantity',
          counter: 'Received quantity',
        },
        {
          key: 'issue',
          label: 'Issue',
          aliases: ['issue', 'issued'],
          type: 'task',
          effect: 'add',
          quantity: 'quantity',
          counter: 'Issued quantity',
        },
        {
          key: 'transfer',
          label: 'Transfer',
          aliases: ['transfer', 'move'],
          type: 'task',
          effect: 'add',
          quantity: 'quantity',
          counter: 'Transferred quantity',
        },
        {
          key: 'review',
          label: 'Review',
          aliases: ['review', 'check', 'verify', 'validate'],
          type: 'task',
          effect: 'none',
          quantity: '',
          counter: '',
        },
        {
          key: 'approval',
          label: 'Approval',
          aliases: ['approve', 'request approval', 'send for approval', 'obtain approval'],
          type: 'approval',
          effect: 'none',
          quantity: '',
          counter: '',
        },
        {
          key: 'notify',
          label: 'Notify',
          aliases: ['notify', 'send', 'email', 'inform'],
          type: 'task',
          effect: 'none',
          quantity: '',
          counter: '',
        },
        {
          key: 'close',
          label: 'Close',
          aliases: ['close', 'finish', 'complete', 'archive'],
          type: 'result',
          effect: 'none',
          quantity: '',
          counter: '',
        },
      ],
      patterns: [
        {
          key: 'receiveSloc',
          label: 'Receive into a storage location',
          action: 'receive',
          pattern: '{action} {quantity} into SLoc {SLoc}',
        },
        {
          key: 'receiveShort',
          label: 'Receive into a location',
          action: 'receive',
          pattern: '{action} {quantity} into {SLoc}',
        },
        {
          key: 'receiveIn',
          label: 'Receive in a location',
          action: 'receive',
          pattern: '{action} {quantity} in {SLoc}',
        },
        {
          key: 'receiveDept',
          label: 'Receive by a department',
          action: 'receive',
          pattern: '{action} {quantity} into SLoc {SLoc} by {department}',
        },
        {
          key: 'receiveMaterial',
          label: 'Receive a material',
          action: 'receive',
          pattern: '{action} {quantity} of {material} into SLoc {SLoc}',
        },
        {
          key: 'issueSloc',
          label: 'Issue from a location',
          action: 'issue',
          pattern: '{action} {quantity} from SLoc {SLoc}',
        },
        {
          key: 'transferSloc',
          label: 'Transfer between locations',
          action: 'transfer',
          pattern: '{action} {quantity} from {fromSLoc} to {SLoc}',
        },
        {
          key: 'reviewPerson',
          label: 'Review by a person',
          action: 'review',
          pattern: '{action} the CR Form by {person}',
        },
      ],
    };
  }
  function validateRules(r) {
    if (
      !r ||
      r.version !== 1 ||
      !Array.isArray(r.fields) ||
      !Array.isArray(r.actions) ||
      !Array.isArray(r.patterns) ||
      r.fields.length > 30 ||
      r.actions.length > 40 ||
      r.patterns.length > 100
    )
      throw Error('Keep up to 30 terms, 40 actions and 100 sentence patterns.');
    for (const list of [r.fields, r.actions, r.patterns])
      if (
        new Set(list.map(x => x?.key)).size !== list.length ||
        list.some(x => !x || !keyOK(x.key) || !text(x.label, 100) || !x.label.trim())
      )
        throw Error('Use unique rule keys and non-empty labels.');
    const aliases = new Set();
    for (const f of r.fields) {
      if (
        !['number', 'text', 'entity', 'person', 'department'].includes(f.kind) ||
        !text(f.target, 80) ||
        (['number', 'text'].includes(f.kind) &&
          (!f.target.trim() || ['__proto__', 'constructor', 'prototype'].includes(f.target))) ||
        (f.kind === 'entity' && !E.ENTITY_FIELDS.some(([k]) => k === f.target)) ||
        !Array.isArray(f.aliases) ||
        f.aliases.length > 20 ||
        !Array.isArray(f.values) ||
        f.values.length > 200
      )
        throw Error('Check term types, target fields and value-list limits.');
      for (const a of [f.key, ...f.aliases]) {
        if (!text(a, 80) || !a.trim()) throw Error('Use short, non-empty aliases.');
        const k = norm(a);
        if (aliases.has(k) && !f.aliases.some(x => norm(x) === k) && k !== norm(f.key))
          throw Error('A term alias is assigned twice.');
      }
      for (const a of new Set([f.key, ...f.aliases].map(norm))) {
        if (aliases.has(a)) throw Error('Assign each term alias to one field only: ' + a);
        aliases.add(a);
      }
      const seen = new Set();
      for (const v of f.values) {
        if (
          !v ||
          !text(v.value, 200) ||
          !v.value.trim() ||
          !text(v.label, 200) ||
          !Array.isArray(v.aliases) ||
          v.aliases.length > 10 ||
          v.aliases.some(a => !text(a, 100) || !a.trim()) ||
          seen.has(norm(v.value))
        )
          throw Error('Use unique maintained values with optional labels and aliases.');
        seen.add(norm(v.value));
      }
    }
    for (const a of r.actions)
      if (
        !Array.isArray(a.aliases) ||
        !a.aliases.length ||
        a.aliases.length > 20 ||
        a.aliases.some(x => !text(x, 80) || !x.trim()) ||
        !E.TYPES.includes(a.type) ||
        !['none', 'set', 'add', 'subtract'].includes(a.effect) ||
        !text(a.counter, 80) ||
        !text(a.quantity, 40) ||
        (a.effect !== 'none' &&
          (!a.counter.trim() ||
            ['__proto__', 'constructor', 'prototype'].includes(a.counter) ||
            !r.fields.some(f => f.key === a.quantity && f.kind === 'number')))
      )
        throw Error('Check action aliases, step types and numeric effects.');
    for (const p of r.patterns) {
      if (!text(p.pattern, 600) || !p.pattern.trim() || !r.actions.some(a => a.key === p.action))
        throw Error('Choose an action and a sentence pattern.');
      compile(p, r);
    }
    if (new TextEncoder().encode(JSON.stringify(r)).length > 500000)
      throw Error('Sentence rules support up to 500 KB of text.');
  }
  function compile(p, r) {
    const action = r.actions.find(a => a.key === p.action),
      fields = [];
    const slots = [...p.pattern.matchAll(/\{([^{}]+)\}/g)];
    if (/[{}]/.test(p.pattern.replace(/\{[^{}]+\}/g, '')))
      throw Error('Check the braces around pattern terms.');
    for (const slot of slots) {
      if (slot[1] === 'action') {
        if (slot.index !== 0 || slots.filter(x => x[1] === 'action').length > 1)
          throw Error('Place {action} once, at the start of a pattern.');
      } else {
        if (!r.fields.some(f => f.key === slot[1]) || fields.includes(slot[1]))
          throw Error(
            'Use each maintained {termKey} once per pattern. Use {action} for action aliases.'
          );
        fields.push(slot[1]);
      }
    }
    if (fields.length > 10) throw Error('Use up to ten term placeholders per sentence pattern.');
    const clean = value => value.replace(/\s+/g, ' ').trim();
    const variants = (
      p.pattern.includes('{action}')
        ? action.aliases.slice().sort((a, b) => b.length - a.length)
        : ['']
    ).map(alias => {
      const pattern = clean(p.pattern.replace('{action}', alias));
      const found = [...pattern.matchAll(/\{([^{}]+)\}/g)],
        literals = [];
      let at = 0;
      for (const m of found) {
        literals.push(pattern.slice(at, m.index));
        at = m.index + m[0].length;
      }
      literals.push(pattern.slice(at));
      if (literals.slice(1, -1).some(x => !x))
        throw Error('Separate term placeholders with literal words or punctuation.');
      return literals;
    });
    function exec(raw) {
      const input = clean(raw),
        lower = input.toLowerCase();
      for (const literals of variants) {
        if (!lower.startsWith(literals[0].toLowerCase())) continue;
        let cursor = literals[0].length,
          valid = true;
        const captures = [];
        for (let i = 0; i < fields.length; i++) {
          const delimiter = literals[i + 1].toLowerCase();
          let end;
          if (input[cursor] === '\"') {
            const closing = input.indexOf('\"', cursor + 1);
            end = closing < 0 ? -1 : closing + 1;
            if (end >= 0 && !lower.startsWith(delimiter, end)) end = -1;
          } else end = delimiter ? lower.indexOf(delimiter, cursor) : input.length;
          if (end < cursor || end === cursor || end - cursor > 300) {
            valid = false;
            break;
          }
          captures.push(input.slice(cursor, end));
          cursor = end + delimiter.length;
        }
        if (valid && cursor === input.length) return [raw, ...captures];
      }
      return null;
    }
    return { fields, regex: { exec, test: input => !!exec(input) } };
  }
  function valueRows(f, processes = []) {
    const out = f.values.map((v, i) => ({
      key: 'saved:' + f.key + ':' + i,
      value: v.value,
      label: v.label || v.value,
      aliases: [v.value, v.label, ...v.aliases].filter(Boolean),
    }));
    for (const p of processes)
      for (const s of p.steps) {
        let value =
          f.kind === 'entity'
            ? s.entity?.[f.target]
            : f.kind === 'department'
              ? s.owner?.startsWith('Department: ')
                ? s.owner.slice(12)
                : ''
              : f.kind === 'person' && !s.owner?.startsWith('Department: ')
                ? (s.owner || '').replace(/^Person: /, '')
                : '';
        if (!value) continue;
        const entity = f.kind === 'entity' ? copy(s.entity || {}) : {},
          label = value + ' · ' + p.name + (entity.plant ? ' · Plant ' + entity.plant : '');
        if (
          out.some(
            v => v.value === value && JSON.stringify(v.entity || {}) === JSON.stringify(entity)
          )
        )
          continue;
        out.push({
          key: 'step:' + p.id + ':' + s.id,
          value,
          label,
          aliases: [value, ...(f.kind === 'entity' ? [s.title] : [])],
          entity,
        });
      }
    return out.slice(0, 1000);
  }
  function split(raw) {
    const s = raw.replace(/\r/g, '').replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '');
    let buf = '',
      quote = false;
    const parts = [];
    const push = () => {
      if (buf.trim()) parts.push(buf.trim());
      buf = '';
    };
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"') {
        quote = !quote;
        buf += c;
        continue;
      }
      if (!quote) {
        const tail = s.slice(i),
          boundary = i === 0 || /\s/.test(s[i - 1]);
        const connector =
          boundary && tail.match(/^(?:and\s+then|then|next|after\s+that|afterwards|finally)\b\s*/i);
        const and =
          boundary &&
          tail.match(
            /^and\s+(?=(?:receive|check|review|send|submit|approve|create|update|record|implement|test|verify|return|notify|close|save|archive|assign|upload|request|transfer|move|issue|complete)\b)/i
          );
        const otherwise = boundary && tail.match(/^(?:otherwise|else)\b/i);
        if (connector || and) {
          push();
          i += (connector || and)[0].length - 1;
          continue;
        }
        if (otherwise && buf.trim()) {
          push();
        }
        if (c === '\n' || c === ';' || c === '→' || tail.startsWith('->')) {
          push();
          if (tail.startsWith('->')) i++;
          continue;
        }
        if (c === ',' && !(/\d/.test(s[i - 1] || '') && /\d/.test(s[i + 1] || ''))) {
          push();
          continue;
        }
        if (c === '.' && (!s[i + 1] || /\s/.test(s[i + 1]))) {
          push();
          continue;
        }
      }
      buf += c;
    }
    if (quote) throw Error('Close the double quotation marks in your description.');
    push();
    return parts;
  }
  function opposite(a, b) {
    const strip = x =>
      norm(x).replace(/^(?:the request is|the form is|it is|request is|form is)\s+/, '');
    a = strip(a);
    b = strip(b);
    return (
      b === 'not ' + a ||
      a === 'not ' + b ||
      [
        ['approved', 'rejected'],
        ['complete', 'incomplete'],
        ['valid', 'invalid'],
        ['accepted', 'declined'],
        ['passed', 'failed'],
        ['yes', 'no'],
      ].some(p => p.includes(a) && p.includes(b) && a !== b)
    );
  }
  function analyse(input, r, processes = [], choices = {}, sample = {}) {
    validateRules(r);
    if (!text(input, 12000) || !input.trim())
      throw Error('Describe the steps using then, arrows or separate lines.');
    const parts = split(input);
    if (parts.length > 100) throw Error('Use up to 80 steps in one description.');
    const nodes = [],
      warnings = [],
      unmaintainedOwners = new Set(),
      issues = [],
      initial = copy(sample),
      bindings = [];
    const paths = { main: [], yes: [], no: [], join: [] };
    let branch = 'main',
      condition = '',
      decision = null;
    const fieldByAlias = label =>
      r.fields.find(f => [f.key, ...f.aliases].some(a => norm(a) === norm(label)));
    const unquote = x => x.trim().replace(/^"(.*)"$/s, '$1');
    function bind(f, raw, index) {
      raw = unquote(raw);
      const k = index + ':' + f.key,
        rows = valueRows(f, processes);
      let value = raw,
        match;
      if (f.kind === 'number') {
        const n = raw.replace(/,/g, '');
        if (
          !/^-?\d+(?:\.\d+)?$/.test(n) ||
          !Number.isFinite(Number(n)) ||
          Math.abs(Number(n)) > 1e12
        )
          issues.push('Enter a valid number for ' + f.label + ' in step ' + (index + 1) + '.');
        else value = Number(n);
      } else if (['entity', 'person', 'department'].includes(f.kind) || rows.length) {
        const hits = rows.filter(v => v.aliases.some(a => norm(a) === norm(raw)));
        match = choices[k]
          ? rows.find(v => v.key === choices[k])
          : hits.length === 1
            ? hits[0]
            : null;
        if (!match)
          issues.push(
            (hits.length > 1 ? 'Choose the matching ' : 'Maintain or choose a value for ') +
              f.label +
              ' in step ' +
              (index + 1) +
              '.'
          );
        else value = match.value;
      }
      const b = {
        key: k,
        field: f.key,
        label: f.label,
        kind: f.kind,
        target: f.target,
        raw,
        value,
        match: match || null,
        options: rows,
      };
      bindings.push(b);
      return b;
    }
    function action(textValue) {
      let owner = '',
        body = textValue;
      const role = /^([^:]{1,120}):\s+(.+)$/s.exec(body);
      if (role && !/^https?$/i.test(role[1])) {
        owner = role[1].trim();
        body = role[2];
      }
      const matches = [];
      for (const p of r.patterns) {
        const compiled = compile(p, r),
          m = compiled.regex.exec(body);
        if (m) matches.push({ p, compiled, m });
      }
      const specificity = m => m.p.pattern.replace(/\{[^}]+\}/g, '').trim().length;
      const best = Math.max(-1, ...matches.map(specificity));
      const unique = matches
        .filter(m => specificity(m) === best)
        .filter(
          (m, i, all) =>
            all.findIndex(
              x =>
                x.p.action === m.p.action &&
                JSON.stringify(x.compiled.fields) === JSON.stringify(m.compiled.fields) &&
                JSON.stringify(x.m.slice(1)) === JSON.stringify(m.m.slice(1))
            ) === i
        );
      if (unique.length > 1)
        issues.push(
          'More than one sentence pattern matches “' +
            body.slice(0, 70) +
            '”. Make those patterns distinct.'
        );
      const m = unique[0];
      const actionMatches = r.actions
        .map(a => ({
          a,
          length: Math.max(
            -1,
            ...a.aliases
              .filter(alias => new RegExp('^' + re(alias) + '(?:\\s|$)', 'i').test(body))
              .map(alias => alias.length)
          ),
        }))
        .filter(x => x.length >= 0)
        .sort((a, b) => b.length - a.length);
      if (!m && actionMatches.length > 1 && actionMatches[0].length === actionMatches[1].length)
        issues.push(
          'Action wording matches more than one rule in “' +
            body.slice(0, 70) +
            '”. Make the action aliases distinct.'
        );
      const a = m ? r.actions.find(a => a.key === m.p.action) : actionMatches[0]?.a;
      const n = {
        id: 'n' + nodes.length,
        title: body.slice(0, 200),
        instruction: body,
        owner,
        type: a?.type || 'task',
        action: a?.key || '',
        pattern: m?.p.label || '',
        entity: {},
        changes: [],
        bindings: [],
        next: '',
      };
      if (m)
        for (const [i, key] of m.compiled.fields.entries()) {
          const f = r.fields.find(f => f.key === key),
            b = bind(f, m.m[i + 1], nodes.length);
          n.bindings.push(b);
          if (f.kind === 'entity') {
            Object.assign(n.entity, b.match?.entity || {});
            n.entity[f.target] = String(b.value);
          } else if (['person', 'department'].includes(f.kind))
            n.owner = (f.kind === 'department' ? 'Department: ' : 'Person: ') + b.value;
          else initial[f.target] = b.value;
        }
      if (m) {
        const verb =
          a.aliases
            .slice()
            .sort((x, y) => y.length - x.length)
            .find(alias => new RegExp('^' + re(alias) + '(?:\\s|$)', 'i').test(body)) || a.label;
        const canonical = m.p.pattern.replace(/\{([^{}]+)\}/g, (_, key) =>
          key === 'action' ? verb : String(n.bindings.find(b => b.field === key)?.value ?? '')
        );
        n.title = (canonical.charAt(0).toUpperCase() + canonical.slice(1)).slice(0, 200);
        n.instruction = canonical;
      }
      if (owner) {
        const known = r.fields
          .filter(f => ['person', 'department'].includes(f.kind))
          .flatMap(f => valueRows(f, processes).map(v => ({ f, v })))
          .filter(({ v }) => v.aliases.some(x => norm(x) === norm(owner)));
        if (known.length === 1)
          n.owner =
            (known[0].f.kind === 'department' ? 'Department: ' : 'Person: ') + known[0].v.value;
        else if (known.length > 1)
          warnings.push(
            'The responsibility “' +
              owner +
              '” is kept as typed because several maintained entries match.'
          );
        else unmaintainedOwners.add(owner);
      }
      if (a?.effect !== 'none' && a?.effect) {
        const q = n.bindings.find(b => b.field === a.quantity);
        if (q && typeof q.value === 'number') {
          if (q.value < 0) issues.push('Use a non-negative action quantity.');
          initial[a.counter] ??= 0;
          n.changes.push({
            field: a.counter,
            operator: a.effect === 'set' ? 'set' : 'add',
            value: q.value * (a.effect === 'subtract' ? -1 : 1),
          });
        } else
          warnings.push(
            'No quantity effect was applied to “' +
              body.slice(0, 60) +
              '”. Add a matching sentence pattern with {' +
              a.quantity +
              '}.'
          );
      }
      if (!m && /\b(?:SLoc|qty|quantity)\b/i.test(body))
        warnings.push(
          'No sentence pattern matched “' +
            body.slice(0, 70) +
            '”; it remains an instruction without inferred fields.'
        );
      if (/\{[^}]+\}/.test(body))
        issues.push('Replace template placeholders with actual values before generating.');
      nodes.push(n);
      paths[branch].push(n.id);
    }
    for (let part of parts) {
      if (/^(?:after both routes|both routes)\s*:/i.test(part)) {
        if (!decision || !paths.no.length)
          throw Error('Place “After both routes:” after both decision branches.');
        branch = 'join';
        part = part.replace(/^[^:]+:\s*/, '');
        if (part) action(part);
        continue;
      }
      part = part.replace(/^else\s+if\b/i, 'If');
      const ifPart = /^if\s+(.+)$/i.exec(part);
      if (ifPart) {
        const [head, ...rest] = ifPart[1].split(/:\s*/);
        const body = rest.join(': ');
        if (!decision) {
          condition = head.trim();
          if (condition.length > 160) throw Error('Keep decision conditions under 160 characters.');
          decision = {
            id: 'n' + nodes.length,
            title: condition + '?',
            type: 'decision',
            instruction: 'Follow the condition or choose an answer in interactive playback.',
            owner: '',
            entity: {},
            changes: [],
            bindings: [],
            next: '',
            conditionText: condition,
          };
          nodes.push(decision);
          branch = 'yes';
        } else if (branch === 'yes' && opposite(condition, head)) {
          branch = 'no';
          decision.noLabel = head.trim();
        } else
          throw Error(
            'Use one If / Otherwise decision per description. Add further decisions in the canvas editor.'
          );
        if (body) action(body);
        continue;
      }
      if (/^(?:otherwise|else)\b/i.test(part)) {
        if (!decision || branch !== 'yes')
          throw Error('Place Otherwise after the first decision branch.');
        branch = 'no';
        part = part.replace(/^(?:otherwise|else)\s*:?\s*/i, '');
        if (part) action(part);
        continue;
      }
      action(part);
    }
    if (!nodes.length) throw Error('Add at least one process step.');
    if (nodes.length > 80) throw Error('Use up to 80 steps including the decision.');
    function chain(ids, next = '') {
      ids.forEach((id, i) => {
        nodes.find(n => n.id === id).next = ids[i + 1] || next;
      });
    }
    if (decision) {
      if (!paths.yes.length || !paths.no.length)
        throw Error(
          'Add instructions for both If and Otherwise. Separate the condition from its action using a comma, colon or then.'
        );
      chain(paths.main, decision.id);
      chain(paths.yes, paths.join[0]);
      chain(paths.no, paths.join[0]);
      chain(paths.join);
      decision.next = paths.yes[0];
      decision.answers = [
        { label: condition.slice(0, 120), next: paths.yes[0] },
        { label: (decision.noLabel || 'Otherwise').slice(0, 120), next: paths.no[0] },
      ];
      const comparison =
        /^(.+?)\s*(>=|<=|!=|>|<|=|\b(?:exceeds|is greater than|is less than|is not equal to|does not equal|is not|is equal to|equals|is)\b)\s*(.+)$/i.exec(
          condition
        );
      if (comparison) {
        const f = fieldByAlias(unquote(comparison[1]));
        if (!f || !['text', 'number'].includes(f.kind))
          issues.push(
            'Maintain the decision field “' + comparison[1] + '” as a number or text term.'
          );
        else {
          let value = unquote(comparison[3]);
          const number = value.replace(/,/g, '');
          if (f.kind === 'number') {
            if (!/^-?\d+(?:\.\d+)?$/.test(number))
              issues.push('Use a numeric value in the decision condition.');
            else value = Number(number);
          }
          const operators = {
            '>': 'gt',
            '<': 'lt',
            '>=': 'ge',
            '<=': 'le',
            '=': 'eq',
            '!=': 'ne',
            exceeds: 'gt',
            'is greater than': 'gt',
            'is less than': 'lt',
            equals: 'eq',
            'is equal to': 'eq',
            'is not': 'ne',
            'does not equal': 'ne',
            'is not equal to': 'ne',
            is: 'eq',
          };
          decision.conditionRule = {
            field: f.target,
            operator: operators[norm(comparison[2])],
            value,
          };
          if (!Object.hasOwn(initial, f.target))
            issues.push('Provide an initial sample value for ' + f.target + ' below.');
        }
      } else
        warnings.push(
          '“' +
            condition +
            '” is an interactive decision. Automatic playback follows its default; choose an answer or scenario route to explore the alternative.'
        );
    } else chain(paths.main);
    if (nodes.length === 1)
      warnings.push(
        'Only one step was found. Add then, arrows or new lines to describe more steps.'
      );
    if (unmaintainedOwners.size)
      warnings.push(
        'Responsibilities kept as typed: ' +
          [...unmaintainedOwners].join(', ') +
          '. Add them to People & departments for reusable matching.'
      );
    return {
      source: input,
      nodes,
      bindings,
      initial,
      issues: [...new Set(issues)],
      warnings: [...new Set(warnings)],
      startId: paths.main[0] || decision?.id,
    };
  }
  function build(result, { id, uid, at, name = '', owner = '', initial = {} }) {
    if (result.issues.length)
      throw Error('Resolve the highlighted matches before opening the draft.');
    const p = E.normalize(E.seed(id, at, true)),
      ids = new Map(result.nodes.map(n => [n.id, uid()])),
      base = p.steps[0];
    p.name = name.trim() || result.nodes[0].title.slice(0, 200);
    p.notes = result.source;
    p.processOwner = owner;
    p.steps = result.nodes.map(n => {
      const s = {
        ...copy(base),
        id: ids.get(n.id),
        title: n.title,
        type: n.type,
        instruction: n.instruction,
        owner: n.owner || owner,
        entity: copy(n.entity),
        changes: copy(n.changes),
        next: ids.get(n.next) || '',
        failNext: '',
        alternatives: [],
      };
      if (n.answers) {
        s.decision = {
          question: n.title,
          answers: n.answers.map(a => ({ label: a.label, next: ids.get(a.next) })),
        };
        s.alternatives = s.decision.answers.slice(1).map(a => a.next);
        if (n.conditionRule) s.sentenceCondition = copy(n.conditionRule);
      }
      return s;
    });
    p.startId = ids.get(result.startId);
    p.scenarios = [
      {
        id: uid(),
        name: 'From your description',
        notes: 'Review sample values and decision routes before presenting.',
        initial: { ...result.initial, ...initial },
        choices: {},
        routes: {},
      },
    ];
    for (const s of p.steps)
      if (s.sentenceCondition && !Object.hasOwn(p.scenarios[0].initial, s.sentenceCondition.field))
        throw Error('Provide an initial value for ' + s.sentenceCondition.field + '.');
    E.layout(p);
    return p;
  }
  root.WorkHubProcessSentenceEngine = {
    LIMITS,
    defaults,
    validateRules,
    compile,
    valueRows,
    split,
    analyse,
    build,
    copy,
  };
})(window);
