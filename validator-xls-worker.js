/* A fresh local reader per XLS file. No network/account APIs or formula evaluation. */
self.window = self;
importScripts(
  './vendor/sheetjs/xlsx.full.min.js?v=0.20.3',
  './vendor/ssf.js?v=0.11.2',
  './validator-engine.js?v=20261030-uom-versions-1',
  './validator-files.js?v=20261031-compare-xls-1',
  './validator-xls-engine.js?v=20261031-compare-xls-1'
);
self.onmessage = event => {
  try {
    self.postMessage({
      result: self.WorkHubValidatorXLSEngine.read(event.data.buffer, {
        valuesOnly: event.data.valuesOnly === true,
      }),
    });
  } catch (error) {
    self.postMessage({
      error: ['TypeError', 'RangeError', 'SyntaxError'].includes(error.name)
        ? 'The XLS workbook could not be read completely. Open and save a copy in Excel, then retry. No data was accepted.'
        : error.message || 'The XLS workbook could not be read safely.',
    });
  }
};
