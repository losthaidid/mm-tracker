/** Excel-to-CSV legacy upload bridge. XLS parser loads only in a cancellable worker. */
(function (root) {
  'use strict';
  const base = document.currentScript?.src || root.location.href,
    jobs = new Set();
  const cancelled = () => {
    const e = Error('Excel reading cancelled.');
    e.name = 'AbortError';
    return e;
  };
  async function read(file, { signal } = {}) {
    if (signal?.aborted) throw cancelled();
    if (
      !file ||
      !/\.xls$/i.test(file.name) ||
      file.size > root.WorkHubValidatorFiles.CSV_LIMITS.fileBytes
    )
      throw Error('Choose an XLS workbook below 50 MB.');
    if (typeof root.Worker !== 'function')
      throw Error(
        'This browser cannot start the background XLS reader. Use a current browser or save the file as XLSX in Excel.'
      );
    const buffer = await file.arrayBuffer();
    if (signal?.aborted) throw cancelled();
    return new Promise((resolve, reject) => {
      let worker,
        done = false;
      const finish = (error, result) => {
        if (done) return;
        done = true;
        worker?.terminate();
        jobs.delete(abort);
        signal?.removeEventListener('abort', abort);
        if (error) reject(error);
        else resolve(result);
      };
      const abort = () => finish(cancelled());
      jobs.add(abort);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) return abort();
      try {
        worker = new root.Worker(new URL('./validator-xls-worker.js?v=20261031-csv-xls-1', base), {
          name: 'WorkHub XLS values',
        });
        worker.onmessage = event => {
          if (event.data?.error) finish(Error(event.data.error));
          else if (Array.isArray(event.data?.result?.sheets)) finish(null, event.data.result);
          else finish(Error('The XLS reader returned incomplete data. Refresh and retry.'));
        };
        worker.onerror = event => {
          event.preventDefault?.();
          finish(Error('The background XLS reader could not start or finish. Refresh and retry.'));
        };
        worker.onmessageerror = worker.onerror;
        worker.postMessage({ buffer }, [buffer]);
      } catch {
        finish(Error('The background XLS reader is unavailable. Refresh and retry.'));
      }
    });
  }
  root.addEventListener('pagehide', () => {
    for (const abort of [...jobs]) abort();
  });
  root.WorkHubValidatorXLS = Object.freeze({ read });
})(window);
