import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

test('implementation workshops scope questions, preserve decisions, and guard project changes', () => {
  const root = createContext({});
  for (const path of ['workshop-catalog.js', 'workshop-engine.js', 'workshop-ui.js'])
    runInContext(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), root);
  const { equal, ok, throws } = assert;
  const E = root.WorkHubImplementationEngine;
  const UI = root.WorkHubImplementationWorkshop;
  const data = { projects: [{ id: 'north', name: 'North plant' }, { id: 'south', name: 'South plant' }] };
  const [north, south] = data.projects;
  const batch = E.topics.find(topic => topic.id === 'batch');
  const batchScope = batch.questions[0][0];
  const scopeButton = edit => ({ dataset: { iw: 'workshop', edit } });
  const answerButton = id => ({ dataset: { iw: 'answer', question: id } });
  const listeners = new Map();
  let active = north, account = 1, canEdit = true, output, opened, form, rendered, report, message;
  const workspace = {
    set outerHTML(html) { rendered = html; },
    querySelector(id) {
      if (id === '#iwQuestions') return { set innerHTML(html) { output = html; } };
      return { value: '' };
    },
  };
  root.document = {
    addEventListener(kind, fn) { listeners.set(kind, fn); },
    getElementById(id) {
      return { iwWorkspace: workspace, modal: { open: opened }, iwForm: form }[id];
    },
  };
  root.FormData = class {
    constructor(values) { this.values = values; }
    get(key) { return this.values[key]; }
  };
  let ids = 0;
  const ui = UI.install({
    project: () => active, active: () => true, account: () => account,
    can: action => action !== 'edit' || canEdit,
    openModal(title, html) { opened = true; form = { id:'iwForm' }; output = html; },
    closeModal() { opened = false; },
    uid: () => 'workshop-' + ++ids,
    mutate(fn) {
      const copy = JSON.parse(JSON.stringify(data));
      fn(copy);
      E.validate(copy.projects);
      data.projects.forEach((p, i) => Object.assign(p, copy.projects[i]));
      rendered = ui.render(active);
      return true;
    },
    tell(text) { message = text; },
    download(text) { report = text; },
  });
  const click = target => listeners.get('click')({ target: { closest: () => target } });
  const submit = values => listeners.get('submit')({ target: Object.assign(form, values), preventDefault() {} });
  const change = (id, value) => listeners.get('change')({ target: { id, value, closest: () => true } });

  E.validate(data.projects);
  equal(E.questions.length, 223);
  equal(new Set(E.questions.map(([id]) => id)).size, 223);
  ok(ui.render(north).includes('New workshop'));
  click(scopeButton(false));
  submit({ name: 'Local sourcing', scope: 'North / fasteners' });
  equal(message, 'Implementation workshop saved.');
  equal(north.implementationWorkshops.length, 1);
  change('iwTopic', 'batch');
  ok(output.includes('shelf life'));
  click(answerButton(batchScope));
  submit({ status: 'Agreed' });
  ok(message.includes('Enter the agreed decision'));
  submit({ status: 'Agreed', decision: 'Track shelf life', owner: 'Warehouse', due: '2026-12-04', confirmedBy: 'Inventory lead', confirmedOn: '2026-11-27', requirement: 'Expiry trace' });
  equal(message, 'Workshop answer saved.');
  ok(rendered.includes('Track shelf life'));
  click(answerButton(batch.questions[1][0]));
  submit({ status: 'Open', owner: 'Warehouse', decision: '=2+2' });
  change('iwFilter', 'Follow-ups');
  ok(output.includes('=2+2'));
  ok(!output.includes('Track shelf life'));
  change('iwFilter', '');
  click(answerButton(batchScope));
  submit({ status:'Not applicable' });
  ok(rendered.includes('follow-up questions are out of scope'));
  ok(!rendered.includes('=2+2'));
  click({ dataset: { iw: 'export' } });
  ok(report.includes('Out of scope') && report.includes(`"'=2+2"`) && report.includes('Confirmed by'));
  click(answerButton(batchScope));
  submit({ status:'Open' });
  ok(rendered.includes('=2+2'));

  click(scopeButton(false));
  submit({ name:'Other material group', scope:'Consumables' });
  ok(!rendered.includes('=2+2'));
  change('iwWorkshop', north.implementationWorkshops[0].id);
  ok(rendered.includes('=2+2'));
  click(answerButton(batchScope));
  account++;
  submit({ status:'Open', decision:'Stale modal' });
  ok(message.includes('Reopen'));
  equal(north.implementationWorkshops[0].answers[batchScope].decision, '');
  canEdit = false;
  ok(!ui.render(north).includes('New workshop'));
  click(answerButton(batchScope));
  ok(output.includes('disabled'));
  active = south;
  ok(!ui.render(south).includes('Local sourcing'));
  const legacy = JSON.parse(JSON.stringify(data));
  E.validate(legacy.projects);
  legacy.projects[0].implementationWorkshops[0].answers[batchScope].due = '2026-02-31';
  throws(() => E.validate(legacy.projects), /follow-up date/);
});
