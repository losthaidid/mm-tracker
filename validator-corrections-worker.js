/* Isolated, cancellable suggestion scan. No network or account client. */
self.window = self;
importScripts(
  './validator-engine.js?v=20261103-bulk-fixes-1',
  './validator-transform.js?v=20261103-explode-recombined-1',
  './validator-corrections.js?v=20261103-bulk-fixes-1'
);
self.onmessage = async event => {
  const { id, data } = event.data;
  try {
    const plan = await self.WorkHubValidatorCorrections.scan(data, {
      pause: () => new Promise(resolve => setTimeout(resolve, 0)),
      progress: progress => self.postMessage({ id, progress }),
    });
    self.postMessage({ id, plan });
  } catch (error) {
    self.postMessage({ id, error: error.message || 'Correction scan could not finish.' });
  }
};
