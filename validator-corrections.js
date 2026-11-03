/** Whole-file correction planning. Source rows are immutable; uploads never leave browser memory. */
(function (root) {
  'use strict';
  const E = root.WorkHubValidatorEngine,
    T = root.WorkHubValidatorTransform;
  const reasons = [
    'One valid replacement; the combined row changes pass the selected checks.',
    'Several maintained values are valid. Choose the intended value.',
    'No clear maintained replacement. Review this field.',
    'This field identifies a unique record or combination. Review it individually.',
    'Combined fixes would introduce another issue. Review this row.',
    'Map this field to an upload column before correcting it.',
  ];
  const base = root.document?.currentScript?.src || root.location?.href;
  const signature = issue =>
    JSON.stringify([
      issue.field,
      issue.ruleId,
      issue.message,
      issue.severity,
      issue.requirementIndex,
    ]);
  const problem = message => {
    const e = Error(message);
    e.name = 'AbortError';
    return e;
  };
  async function scan(
    { schema, rows, mapping, context = {}, ignored = [] },
    { pause = () => Promise.resolve(), cancelled = () => false, progress = () => {} } = {}
  ) {
    const validate = E.createValidator(schema, context),
      suggest = E.createSuggester(schema, context, true),
      width = schema.columns.length;
    if (!Array.isArray(rows) || rows.length > E.LIMITS.rows || rows.length * width > E.LIMITS.cells)
      throw Error('Scan up to 25,000 rows and 5,000,000 cells.');
    const size = rows.length * width,
      fieldIndex = new Map(schema.columns.map((c, i) => [c.key, i])),
      flags = new Uint8Array(size),
      ignoredKeys = new Set(ignored),
      uniqueGroups = [
        ...schema.columns.filter(c => c.unique).map(c => [c.key]),
        ...schema.uniqueGroups,
      ],
      protectedFields = new Set(uniqueGroups.flat()),
      allWhen = new Set(),
      candidateCache = new Map();
    let errorCount = 0,
      work = 0;
    const active = () => {
      if (cancelled()) throw problem('Correction scan cancelled.');
    };
    const clock = () => root.performance?.now?.() ?? Date.now();
    let lastYield = clock();
    const tick = async (phase, completed, total) => {
      active();
      progress({ phase, completed, total });
      await pause();
      active();
      lastYield = clock();
    };
    const maybeTick = async (...args) => {
      active();
      if (clock() - lastYield >= 12) await tick(...args);
    };
    function mark(index, key, message, severity, ruleId, requirementIndex) {
      if (severity !== 'error') return;
      if (
        ignoredKeys.size &&
        ignoredKeys.has(
          E.issueKey({ index, field: key, message, severity, ruleId, requirementIndex })
        )
      )
        return;
      const col = fieldIndex.get(key);
      if (col === undefined) return;
      flags[index * width + col] = 1;
      errorCount++;
    }
    await tick('Checking every row', 0, rows.length);
    for (let from = 0; from < rows.length; from += 32) {
      validate(rows.slice(from, from + 32), {
        skipUnique: true,
        issueLimit: 0,
        onIssue: (i, ...issue) => mark(from + i, ...issue),
      });
      await maybeTick('Checking every row', Math.min(from + 32, rows.length), rows.length);
    }
    for (const keys of uniqueGroups) {
      const seen = new Map();
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (keys.some(k => E.blank(row[k]))) continue;
        const key = E.valueKey(
          keys.map(k => E.comparable(row[k], schema.columns[fieldIndex.get(k)], schema.mode))
        );
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key).push(i);
        if (!(i % 512)) await maybeTick('Checking duplicate records', i, rows.length);
      }
      for (const indices of seen.values())
        if (indices.length > 1)
          for (const i of indices) {
            const message =
              (keys.length === 1
                ? 'Duplicate value.'
                : 'Duplicate combination: ' + keys.join(' + ') + '.') +
              ' Also appears on row ' +
              ((indices[0] === i ? indices[1] : indices[0]) + 2) +
              '.';
            mark(i, keys[0], message, 'error', 'unique');
          }
    }
    const walk = group => {
      for (const c0 of group.conditions) {
        const c = E.resolveCondition(c0, schema);
        for (const k of [c.field, c.otherField, ...(c.pairs || []).map(p => p.field)])
          if (k) allWhen.add(k);
      }
      for (const g of group.groups) walk(g);
    };
    schema.rules.filter(r => E.ruleApplies(r, context)).forEach(r => walk(r.when));
    const dependencies = new Map(
      schema.columns.map(field => {
        const keys = new Set(allWhen);
        keys.add(field.key);
        for (const rule of schema.rules)
          for (const raw of E.requirements(rule)) {
            const c = E.resolveCondition(raw, schema);
            if (c.field !== field.key) continue;
            for (const k of [c.otherField, ...(c.pairs || []).map(p => p.field)])
              if (k) keys.add(k);
          }
        return [field.key, [...keys]];
      })
    );
    let count = 0;
    for (const flag of flags) if (flag) count++;
    const plan = {
      indices: new Uint32Array(count),
      columns: new Uint8Array(count),
      codes: new Uint8Array(count),
      values: new Uint32Array(count),
      counts: new Uint32Array(count),
      sources: new Uint32Array(count),
      texts: [''],
      sourceNames: [''],
      total: count,
      errors: errorCount,
      clear: 0,
      review: 0,
      changedRows: 0,
    };
    const textIds = new Map([['', 0]]),
      sourceIds = new Map([['', 0]]);
    const intern = (value, pool, index) => {
      value = String(value);
      if (!index.has(value)) {
        index.set(value, pool.length);
        pool.push(value);
      }
      return index.get(value);
    };
    let at = 0;
    for (let i = 0; i < rows.length; i++) {
      const pending = [];
      for (let col = 0; col < width; col++) if (flags[i * width + col]) pending.push(col);
      if (!pending.length) continue;
      const row = rows[i],
        before = validate([row], { skipUnique: true }),
        originalIssues = new Set(before.issues.map(signature)),
        trial = { ...row },
        clear = [];
      for (const col of pending) {
        const field = schema.columns[col];
        plan.indices[at] = i;
        plan.columns[at] = col;
        let code = 2,
          choice = null,
          total = 0;
        if (!Number.isInteger(Number(mapping[field.key])) || Number(mapping[field.key]) < 0)
          code = 5;
        else if (protectedFields.has(field.key)) code = 3;
        else {
          const cacheKey = JSON.stringify([
            field.key,
            dependencies.get(field.key).map(k => row[k] ?? ''),
          ]);
          let candidates = candidateCache.get(cacheKey);
          if (!candidates) {
            const extra = [];
            if (schema.mode === 'sap') {
              const formatted = T.convert(String(row[field.key] ?? ''), field, 'auto');
              if (!formatted.warning && formatted.value !== row[field.key])
                extra.push({ value: formatted.value, source: 'Configured SAP type formatting' });
            }
            candidates = suggest(row, field.key, '', extra);
            candidateCache.set(cacheKey, candidates);
            if (candidateCache.size > 2000)
              candidateCache.delete(candidateCache.keys().next().value);
          }
          total = candidates.total;
          choice = candidates.preferred?.[0] || (total === 1 ? candidates.choices[0] : null);
          if (choice) {
            code = 0;
            trial[field.key] = choice.value;
            clear.push(at);
            plan.values[at] = intern(choice.value, plan.texts, textIds);
            plan.sources[at] = intern(choice.source, plan.sourceNames, sourceIds);
          } else if (total > 1) code = 1;
        }
        plan.codes[at] = code;
        plan.counts[at] = total;
        at++;
        if (!(++work % 16)) await maybeTick('Finding clear fixes', at, count);
      }
      if (clear.length) {
        const combined = validate([trial], { skipUnique: true });
        if (
          combined.issues.some(issue => !originalIssues.has(signature(issue))) ||
          clear.some(n =>
            combined.issues.some(
              issue =>
                issue.severity === 'error' && issue.field === schema.columns[plan.columns[n]].key
            )
          )
        )
          for (const n of clear) plan.codes[n] = 4;
        else plan.changedRows++;
      }
      if (!(i % 32)) await maybeTick('Finding clear fixes', at, count);
    }
    for (const code of plan.codes)
      if (code === 0) plan.clear++;
      else plan.review++;
    plan.clearIndices = new Uint32Array(plan.clear);
    plan.reviewIndices = new Uint32Array(plan.review);
    let clearAt = 0,
      reviewAt = 0;
    for (let n = 0; n < count; n++)
      if (plan.codes[n] === 0) plan.clearIndices[clearAt++] = n;
      else plan.reviewIndices[reviewAt++] = n;
    await tick('Review ready', count, count);
    return plan;
  }
  function createRunner() {
    let current = null,
      sequence = 0;
    function cancel() {
      if (!current) return;
      const job = current;
      current = null;
      job.cancelled = true;
      job.worker?.terminate();
      job.reject?.(problem('Correction scan cancelled.'));
    }
    function run(data, onProgress = () => {}) {
      cancel();
      const job = { id: ++sequence, cancelled: false };
      current = job;
      const local = () =>
        scan(data, {
          cancelled: () => job.cancelled,
          progress: p => {
            if (current === job) onProgress(p);
          },
          pause: () => new Promise(resolve => root.setTimeout(resolve, 0)),
        });
      if (
        typeof root.Worker !== 'function' ||
        data.rows.length * data.schema.columns.length < 20000
      )
        return local().finally(() => {
          if (current === job) current = null;
        });
      return new Promise((resolve, reject) => {
        job.reject = reject;
        const finish = (fn, value) => {
          if (current !== job) return;
          current = null;
          job.worker?.terminate();
          fn(value);
        };
        const fallback = () => {
          if (job.fallback) return;
          job.fallback = true;
          job.worker?.terminate();
          job.worker = null;
          local().then(
            value => finish(resolve, value),
            error => finish(reject, error)
          );
        };
        try {
          const worker = (job.worker = new root.Worker(
            new URL('./validator-corrections-worker.js?v=20261103-bulk-fixes-1', base),
            { name: 'WorkHub correction suggestions' }
          ));
          worker.onmessage = event => {
            if (current !== job || event.data?.id !== job.id) return;
            if (event.data.progress) onProgress(event.data.progress);
            else if (event.data.error) finish(reject, Error(event.data.error));
            else finish(resolve, event.data.plan);
          };
          worker.onerror = event => {
            event.preventDefault?.();
            if (current === job) fallback();
          };
          worker.onmessageerror = worker.onerror;
          worker.postMessage({ id: job.id, data });
        } catch {
          fallback();
        }
      });
    }
    root.addEventListener?.('pagehide', cancel);
    return { run, cancel };
  }
  root.WorkHubValidatorCorrections = { scan, createRunner, reasons };
})(typeof window !== 'undefined' ? window : globalThis);
