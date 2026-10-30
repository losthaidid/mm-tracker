/* Same deterministic engine, isolated from the page. Uploaded values stay in worker memory. */
self.window = self;
importScripts('./validator-engine.js?v=20261030-uom-versions-1');
self.onmessage = event => {
  const { id, template, rows, context } = event.data;
  try {
    self.postMessage({
      id,
      result: self.WorkHubValidatorEngine.validateRows(template, rows, context),
    });
  } catch (error) {
    self.postMessage({ id, error: error.message || 'Validation could not finish.' });
  }
};
