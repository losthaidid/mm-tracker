// Project implementation workshop records, progress and export.
(function () {
  'use strict';

  const topics = globalThis.WorkHubImplementationTopics;
  const questions = topics.flatMap(topic => topic.questions);
  const questionIds = new Set(questions.map(([id]) => id));
  const statuses = ['Open', 'Needs validation', 'Agreed', 'Not applicable'];
  const limits = { name: 120, scope: 240, owner: 120, confirmedBy: 120, asIs: 2000, requirement: 2000, decision: 2000, evidence: 1000 };
  const empty = { status: 'Open', owner: '', due: '', confirmedBy: '', confirmedOn: '', asIs: '', requirement: '', decision: '', evidence: '' };
  const readable = (value, limit) => typeof value === 'string' && value.length <= limit &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
  const validDate = value => value === '' || (typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
  const rows = project => project.implementationWorkshops ?? [];

  function validateAnswer(id, answer) {
    if (!questionIds.has(id) || !answer || !statuses.includes(answer.status) || !validDate(answer.due) || !validDate(answer.confirmedOn) ||
      !Object.keys(empty).every(key => !(key in limits) || readable(answer[key], limits[key])))
      throw Error('Check the workshop answer and its follow-up date.');
    if (answer.status === 'Agreed' && !answer.decision.trim())
      throw Error('Enter the agreed decision before marking this question Agreed.');
  }

  function validate(projects) {
    for (const project of projects) {
      if (project.implementationWorkshops === undefined) continue;
      const workshops = project.implementationWorkshops;
      if (!Array.isArray(workshops) || workshops.length > 30)
        throw Error('Each project supports up to 30 implementation workshops.');
      const ids = new Set();
      for (const workshop of workshops) {
        if (!workshop || !readable(workshop.id, 100) || !workshop.id || ids.has(workshop.id) ||
          !readable(workshop.name, limits.name) || !workshop.name.trim() ||
          !readable(workshop.scope, limits.scope) || workshop.version !== 1 ||
          !workshop.answers || typeof workshop.answers !== 'object' || Array.isArray(workshop.answers))
          throw Error('Check the implementation workshop name, scope and answers.');
        ids.add(workshop.id);
        for (const [id, answer] of Object.entries(workshop.answers)) validateAnswer(id, answer);
      }
    }
  }

  // Marking the first question of an optional topic out of scope keeps its other answers available for later.
  function available(topic, answers) {
    return topic.optional && answers[topic.questions[0][0]]?.status === 'Not applicable'
      ? topic.questions.slice(0, 1)
      : topic.questions;
  }

  function progress(workshop) {
    const active = topics.flatMap(topic => available(topic, workshop.answers));
    const complete = active.filter(([id]) => ['Agreed', 'Not applicable'].includes(workshop.answers[id]?.status)).length;
    const followUps = active.filter(([id]) => ['Open', 'Needs validation'].includes(workshop.answers[id]?.status)).length;
    return { total: active.length, complete, followUps };
  }

  function csv(project, workshop) {
    const cells = value => {
      const text = String(value ?? '');
      return '"' + (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
    };
    const lines = [['Project', 'Workshop', 'Scope', 'Topic', 'Question', 'Status', 'Owner', 'Due date', 'Current process', 'Target requirement', 'Design decision', 'Confirmed by', 'Confirmation date', 'Evidence or references']];
    for (const topic of topics) {
      const active = new Set(available(topic, workshop.answers).map(([id]) => id));
      for (const [id, question] of topic.questions) {
        const answer = workshop.answers[id] || {};
        lines.push([project.name, workshop.name, workshop.scope, topic.title, question,
          active.has(id) ? answer.status || 'Unanswered' : 'Out of scope',
          answer.owner, answer.due, answer.asIs, answer.requirement, answer.decision, answer.confirmedBy, answer.confirmedOn, answer.evidence]);
      }
    }
    return '\uFEFF' + lines.map(line => line.map(cells).join(',')).join('\r\n') + '\r\n';
  }

  globalThis.WorkHubImplementationEngine = { topics, questions, statuses, limits, empty, rows, validate, validateAnswer, available, progress, csv };
})();
