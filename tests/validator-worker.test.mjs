import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8'),
  clone = v => JSON.parse(JSON.stringify(v));
function setup(t) {
  const dom = new JSDOM('', { url: 'https://example.test/workhub/', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.Blob = Blob;
  w.eval(source('validator-engine.js'));
  w.eval(source('validator-runner.js'));
  const E = w.WorkHubValidatorEngine,
    tpl = E.example(),
    rows = Array.from({ length: 3500 }, (_, i) => ({
      REQUEST_ID: String(i),
      TYPE: 'Standard',
      OWNER: 'Aisha',
      AMOUNT: '25',
      START_DATE: '2026-10-20',
      END_DATE: '2026-10-21',
    }));
  return { w, E, tpl, rows, runner: w.WorkHubValidatorRunner.create() };
}
test('validation worker uses the production engine with matching duplicate, format and company-scoped results', t => {
  const { E, tpl, rows } = setup(t),
    messages = [];
  tpl.projectId = 'project';
  tpl.columns[0].unique = true;
  rows[1].REQUEST_ID = rows[0].REQUEST_ID;
  rows[2].AMOUNT = 'bad';
  const scoped = E.rule('OWNER');
  scoped.companyScope = 'selected';
  scoped.companies = [{ id: 'c', name: 'Company' }];
  scoped.assertion = { ...E.condition('OWNER'), operator: 'eq', value: 'Mira' };
  scoped.additionalAssertions = [{ ...E.condition('AMOUNT'), operator: 'gte', value: '0' }];
  tpl.rules.push(scoped);
  const context = { projectId: 'project', companyId: 'c' };
  const sandbox = { Blob, console, postMessage: value => messages.push(value) };
  sandbox.self = sandbox;
  sandbox.importScripts = url => {
    assert.equal(url, './validator-engine.js?v=20261030-uom-versions-1');
    vm.runInContext(source('validator-engine.js'), scope);
  };
  const scope = vm.createContext(sandbox);
  vm.runInContext(source('validator-worker.js'), scope);
  sandbox.onmessage({ data: { id: 7, template: clone(tpl), rows: clone(rows), context } });
  assert.equal(messages[0].id, 7);
  assert.deepEqual(clone(messages[0].result), clone(E.validateRows(tpl, rows, context)));
  sandbox.onmessage({ data: { id: 8, template: {}, rows: [], context: {} } });
  assert.equal(typeof messages[1].error, 'string');
  assert.equal(messages[1].result, undefined);
});
test('large validation jobs copy their inputs to a worker and terminate it on completion', async t => {
  const x = setup(t),
    workers = [];
  x.w.Worker = class {
    constructor(url) {
      assert.equal(new URL(url).origin, 'https://example.test');
      workers.push(this);
    }
    postMessage(message) {
      this.packet = clone(message);
      queueMicrotask(() =>
        this.onmessage({
          data: {
            id: message.id,
            result: clone(x.E.validateRows(message.template, message.rows, message.context)),
          },
        })
      );
    }
    terminate() {
      this.stopped = true;
    }
  };
  const before = clone(x.rows),
    result = await x.runner.run(x.tpl, x.rows, {});
  assert.equal(workers.length, 1);
  assert.equal(result.rows, x.rows.length);
  assert.equal(workers[0].stopped, true);
  assert.deepEqual(x.rows, before);
});
test('unsupported or blocked workers preserve validation semantics and small jobs stay local', async t => {
  const x = setup(t),
    expected = clone(x.E.validateRows(x.tpl, x.rows, {}));
  assert.deepEqual(clone(await x.runner.run(x.tpl, x.rows, {})), expected);
  let count = 0;
  x.w.Worker = class {
    constructor() {
      count++;
      throw Error('Worker blocked');
    }
  };
  assert.deepEqual(clone(await x.runner.run(x.tpl, x.rows, {})), expected);
  assert.equal(count, 1);
  await x.runner.run(x.tpl, x.rows.slice(0, 3), {});
  assert.equal(count, 1);
});
test('worker initialization and message errors fall back locally but engine validation errors remain visible', async t => {
  const x = setup(t),
    workers = [];
  x.w.Worker = class {
    constructor() {
      workers.push(this);
    }
    postMessage(packet) {
      this.packet = packet;
      queueMicrotask(() => this.onerror({ preventDefault() {} }));
    }
    terminate() {
      this.stopped = true;
    }
  };
  assert.equal((await x.runner.run(x.tpl, x.rows, {})).rows, x.rows.length);
  assert.equal(workers[0].stopped, true);
  x.w.Worker = class {
    postMessage(packet) {
      queueMicrotask(() =>
        this.onmessage({ data: { id: packet.id, error: 'Check the template definition.' } })
      );
    }
    terminate() {}
  };
  await assert.rejects(x.runner.run(x.tpl, x.rows, {}), /template definition/);
});
test('cancelling or replacing a job terminates old workers and ignores late results', async t => {
  const x = setup(t),
    workers = [];
  x.w.Worker = class {
    constructor() {
      workers.push(this);
    }
    postMessage(packet) {
      this.packet = packet;
    }
    terminate() {
      this.stopped = true;
    }
  };
  const first = x.runner.run(x.tpl, x.rows, {}),
    rejection = assert.rejects(first, { name: 'AbortError' });
  const second = x.runner.run(x.tpl, x.rows, {});
  await rejection;
  assert.equal(workers[0].stopped, true);
  workers[0].onmessage({ data: { id: workers[0].packet.id, result: { rows: -1 } } });
  workers[1].onmessage({ data: { id: workers[1].packet.id, result: { rows: 3500 } } });
  assert.equal((await second).rows, 3500);
  assert.equal(workers[1].stopped, true);
  const last = x.runner.run(x.tpl, x.rows, {}),
    cancelled = assert.rejects(last, { name: 'AbortError' });
  x.w.dispatchEvent(new x.w.Event('pagehide'));
  await cancelled;
  assert.equal(workers[2].stopped, true);
});
