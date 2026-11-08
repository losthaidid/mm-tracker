/* Written procedures use the existing Process Hub collection and permission boundary. */
(function (root) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const LIMITS = Object.freeze({ procedures: 200, steps: 100, bytes: 2097152 });
  const defaults = () => ({
    version: 1,
    category: '',
    owner: '',
    revision: '1.0',
    prerequisites: '',
  });
  const isProcedure = p => p?.kind === 'procedure';
  const rows = state => (state.workhub?.processes || []).filter(isProcedure);
  const safeText = (v, max) =>
    typeof v === 'string' && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
  const linkOK = value => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
    } catch {
      return false;
    }
  };
  function step(id) {
    return {
      id,
      title: '',
      notes: '',
      next: [],
      role: '',
      outcome: '',
      checklist: [],
      reference: '',
    };
  }
  function create(id, stepId, now) {
    return {
      id,
      kind: 'procedure',
      name: '',
      description: '',
      archived: false,
      procedure: defaults(),
      steps: [step(stepId)],
      createdAt: now,
      updatedAt: now,
    };
  }
  function validateRecord(p) {
    const m = p?.procedure;
    if (
      !isProcedure(p) ||
      !safeText(p.id, 100) ||
      !p.id ||
      !safeText(p.name, 200) ||
      !p.name.trim() ||
      !safeText(p.description, 4000) ||
      typeof p.archived !== 'boolean' ||
      p.canvas !== undefined ||
      !m ||
      m.version !== 1 ||
      !safeText(m.category, 100) ||
      !safeText(m.owner, 200) ||
      !safeText(m.revision, 60) ||
      !safeText(m.prerequisites, 4000) ||
      !Array.isArray(p.steps) ||
      !p.steps.length ||
      p.steps.length > LIMITS.steps ||
      new Set(p.steps.map(s => s?.id)).size !== p.steps.length
    )
      throw Error('Give your procedure a name and between 1 and 100 clearly titled steps.');
    for (const key of ['createdAt', 'updatedAt'])
      if (
        !safeText(p[key], 40) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p[key]) ||
        !Number.isFinite(Date.parse(p[key]))
      )
        throw Error('Check the procedure dates.');
    for (const s of p.steps)
      if (
        !s ||
        !safeText(s.id, 100) ||
        !s.id ||
        !safeText(s.title, 500) ||
        !s.title.trim() ||
        !safeText(s.notes, 8000) ||
        !Array.isArray(s.next) ||
        s.next.length ||
        !safeText(s.role, 200) ||
        !safeText(s.outcome, 2000) ||
        !safeText(s.reference, 2048) ||
        !linkOK(s.reference) ||
        !Array.isArray(s.checklist) ||
        s.checklist.length > 30 ||
        s.checklist.some(x => !safeText(x, 500) || !x.trim())
      )
        throw Error(
          'Check each step title, instructions, checklist and reference link. Links must use https:// or http://.'
        );
  }
  function validate(state) {
    const all = rows(state);
    if (all.length > LIMITS.procedures) throw Error('Keep up to 200 written procedures.');
    for (const p of all) validateRecord(p);
    if (new TextEncoder().encode(JSON.stringify(all)).length > LIMITS.bytes)
      throw Error('Written procedures support up to 2 MB of text in total.');
  }
  function example(id, uid, now) {
    const p = create(id, uid(), now);
    p.name = 'How to handle a CR Form';
    p.description =
      'An example change-request procedure. Adapt the roles, approvals and controls to your organisation before using it.';
    p.procedure = {
      ...defaults(),
      category: 'Change requests',
      owner: 'Process owner',
      prerequisites:
        'Use the current CR Form and confirm the approval and testing requirements for your organisation.',
    };
    const steps = [
      [
        'Receive the request',
        'Requester / coordinator',
        'Record the request reference, requester, business need and requested date. Confirm which form version is being used.',
        'A traceable change request is registered.',
        ['Request reference recorded', 'Business need described'],
      ],
      [
        'Review the form for completeness',
        'Coordinator',
        'Check that the request is understandable and the required sections are filled. Return missing information to the requester for clarification.',
        'The request is complete enough to assess.',
        ['Scope and expected outcome are clear', 'Supporting information is attached where needed'],
      ],
      [
        'Assess impact and effort',
        'Relevant delivery team',
        'Review affected processes, dependencies, risks, testing needs and estimated effort. Record assumptions and open questions.',
        'The impact assessment is documented.',
        ['Affected areas identified', 'Effort and risks reviewed'],
      ],
      [
        'Obtain the required approval',
        'Approver / process owner',
        'Follow your organisation’s approval route. Record the decision and any conditions. If changes are requested, return to the relevant review step.',
        'The decision and its conditions are recorded.',
        ['Required approvals recorded', 'Conditions communicated'],
      ],
      [
        'Coordinate delivery and verification',
        'Delivery and testing teams',
        'Agree the implementation and testing plan. Track the work against the approved scope and retain the required evidence.',
        'Delivery has been verified against the agreed outcome.',
        ['Testing outcome recorded', 'Required acceptance confirmed'],
      ],
      [
        'Close and retain the record',
        'Coordinator',
        'Update the request status, record the outcome and follow-up actions, and retain the final form and evidence in the agreed location.',
        'The request has a clear outcome and a retrievable record.',
        ['Final outcome recorded', 'Follow-up actions assigned if needed'],
      ],
    ];
    p.steps = steps.map(([title, role, notes, outcome, checklist]) => ({
      ...step(uid()),
      title,
      role,
      notes,
      outcome,
      checklist,
    }));
    return p;
  }
  function markdown(p) {
    validateRecord(p);
    const lines = [
      '# ' + p.name,
      '',
      p.description,
      '',
      ...[
        ['Category', p.procedure.category],
        ['Responsible role', p.procedure.owner],
        ['Version', p.procedure.revision],
      ]
        .filter(([, v]) => v)
        .map(([k, v]) => k + ': ' + v),
      '',
      ...(p.procedure.prerequisites
        ? ['## Before you begin', '', p.procedure.prerequisites, '']
        : []),
    ];
    p.steps.forEach((s, i) =>
      lines.push(
        '## ' + (i + 1) + '. ' + s.title,
        '',
        ...(s.role ? ['Responsible: ' + s.role, ''] : []),
        s.notes,
        '',
        ...s.checklist.map(x => '- [ ] ' + x),
        ...(s.outcome ? ['', 'Expected outcome: ' + s.outcome] : []),
        ...(s.reference ? ['', 'Reference: ' + s.reference] : []),
        ''
      )
    );
    return lines.join('\n');
  }
  root.WorkHubProceduresEngine = Object.freeze({
    LIMITS,
    isProcedure,
    rows,
    step,
    create,
    example,
    validateRecord,
    validate,
    markdown,
    linkOK,
    copy,
  });
})(typeof window === 'undefined' ? globalThis : window);
