import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const window = {};
for (const file of ['solution-materials.js', 'solution-valuation.js', 'solution-engine.js', 'solution-demo.js', 'solution-guide.js'])
  runInNewContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { window });
const E = window.WorkHubSolutionEngine, G = window.WorkHubSolutionGuide;

test('solution guide: receipt and issue explanations use exact engine before/after balances', () => {
  const p = E.profile('quantity'), actions = [E.action('gr',100),E.action('issue',30)], r = E.simulate(p,actions);
  const snap = {profile:p};
  const receipt = G.narration(snap,r.events[0],2,0), issue = G.narration(snap,r.events[1],2,1);
  assert.match(receipt,/100 units/);assert.match(receipt,/RM 1,200.00/);assert.match(receipt,/\+RM 1,200.00/);
  assert.match(issue,/70 units/);assert.doesNotMatch(issue,/\+RM 1,200.00/);assert.match(issue,/No additional FI cost/i);
  assert.equal(r.events[1].after.expense,r.events[0].after.expense);
});

test('solution guide: transfer explanation exposes both locations while total stock and value stay unchanged', () => {
  const p=E.profile('valuated'),a=E.action('gr',100),b=E.action('transfer',20);b.location='MAIN';b.toLocation='LINE';
  const r=E.simulate(p,[a,b]),html=G.narration({profile:p},r.events[1],2,1);
  assert.match(html,/Stock in MAIN/);assert.match(html,/Stock in LINE/);assert.match(html,/80 units/);assert.match(html,/20 units/);assert.match(html,/No FI document/i);
  assert.equal((html.match(/No change/g)||[]).length,3);
});

test('solution guide: stopped and unsupported explanations retain their true status and escape engine text', () => {
  const p=E.profile('nonstock'),a=E.action('gr',100,'inventory'),event=E.simulate(p,[a]).events[0];
  event.fix='<img src=x onerror=alert(1)>';
  const html=G.narration({profile:p},event,1,0);
  assert.match(html,/STOPPED BY A RULE/);assert.match(html,/Balances retained/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.equal((html.match(/No change/g)||[]).length,3);
  const unsupported=E.simulate(p,[E.action('invoice',10)]).events[0],other=G.narration({profile:p},unsupported,1,0);
  assert.match(other,/OUTSIDE THIS LEARNING MODEL/);assert.doesNotMatch(other,/SUPPORTED TRANSACTION SUCCEEDED/);
});

test('solution guide: context, readiness and glossary do not invent agreement or cross-proposal evidence', () => {
  const d=window.WorkHubSolutionDemo.create(),rows=E.records(d,d.activeProjectId),process=rows.processes.find(p=>p.id==='demo-process-spares'),proposal=rows.proposals.find(p=>p.id==='demo-proposal-spares-quantity');
  const c={isDemo:true,project:{name:'Client <script>alert(1)</script>'},rows,process,proposal,product:rows.products.find(p=>p.id==='demo-bearing')};
  assert.equal(G.readiness(c)[4][1],false);assert.equal(G.readiness(c)[5][1],false);
  const html=G.context(c);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
  assert.match(G.glossary('grir'),/GR\/IR/);assert.match(G.formHelp('proposal'),/simulation profile/);assert.equal(G.lesson(50),'');
});
