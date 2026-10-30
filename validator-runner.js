/** Run large validations in a short-lived, same-origin worker. No persistence or account API. */
(function (root) {
  'use strict';
  const base = document.currentScript?.src || root.location.href;
  function create() {
    let current = null,
      sequence = 0;
    function cancel() {
      const job = current;
      if (!job) return;
      current = null;
      job.worker.terminate();
      const error = new Error('Validation cancelled.');
      error.name = 'AbortError';
      job.reject(error);
    }
    function run(template, rows, context) {
      cancel();
      const local = () => root.WorkHubValidatorEngine.validateRows(template, rows, context);
      if (typeof root.Worker !== 'function' || rows.length * template.columns.length < 20000)
        return Promise.resolve().then(local);
      return new Promise((resolve, reject) => {
        let worker;
        try {
          worker = new root.Worker(
            new URL('./validator-worker.js?v=20261030-uom-versions-1', base),
            {
              name: 'WorkHub validation',
            }
          );
        } catch {
          resolve(local());
          return;
        }
        const job = { id: ++sequence, worker, reject };
        current = job;
        const finish = fn => {
          if (current !== job) return;
          current = null;
          worker.terminate();
          fn();
        };
        worker.onmessage = event => {
          if (event.data?.id !== job.id) return;
          if (event.data.error) finish(() => reject(new Error(event.data.error)));
          else finish(() => resolve(event.data.result));
        };
        worker.onerror = event => {
          event.preventDefault?.();
          finish(() => {
            try {
              resolve(local());
            } catch (error) {
              reject(error);
            }
          });
        };
        worker.onmessageerror = worker.onerror;
        try {
          worker.postMessage({ id: job.id, template, rows, context });
        } catch {
          worker.onerror({});
        }
      });
    }
    root.addEventListener('pagehide', cancel);
    return { run, cancel };
  }
  root.WorkHubValidatorRunner = { create };
})(window);
