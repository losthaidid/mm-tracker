/** Synthetic validator benchmark. Optional args: engine source path, case name. */
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';

const source = process.argv[2] || fileURLToPath(new URL('../validator-engine.js', import.meta.url));
const scope = vm.createContext({});
vm.runInContext(fs.readFileSync(source, 'utf8'), scope);
const E = scope.WorkHubValidatorEngine,
  count = 12000,
  width = 100;
const choices = Array.from({ length: 32 }, (_, i) => 'V' + String(i).padStart(2, '0'));
for (const name of ['general', 'sap', 'sap-plain']) {
  if (process.argv[3] && process.argv[3] !== name) continue;
  const template = E.create('Synthetic ' + name);
  template.mode = name === 'general' ? 'general' : 'sap';
  template.columns = Array.from({ length: width }, (_, i) => ({
    ...E.column(i),
    key: 'C' + i,
    label: 'Column ' + i,
    values: i && name !== 'sap-plain' ? choices.join(',') : '',
    sapType: name === 'sap-plain' && i ? ['CHAR', 'NUMC', 'DEC', 'INT8'][i % 4] : 'CHAR',
    sapLength: name === 'sap-plain' && i ? [30, 4, 18, 19][i % 4] : 30,
    sapDecimals: name === 'sap-plain' && i % 4 === 2 ? 4 : '',
  }));
  template.columns[0].unique = true;
  const rows = Array.from({ length: count }, (_, i) =>
    Object.fromEntries(
      template.columns.map((c, j) => {
        const n = (i + j) % choices.length;
        return [
          c.key,
          !j
            ? String(i).padStart(8, '0')
            : c.sapType === 'NUMC'
              ? String(n).padStart(4, '0')
              : c.sapType === 'DEC'
                ? n + '.2500'
                : c.sapType === 'INT8'
                  ? '9223372036854775807'
                  : choices[n],
        ];
      })
    )
  );
  E.validateRows(template, rows.slice(0, 100));
  const times = [];
  let result;
  for (let sample = 0; sample < 3; sample++) {
    const start = performance.now();
    result = E.validateRows(template, rows);
    times.push(performance.now() - start);
    if (result.errors || result.warnings) throw Error('Synthetic records should pass.');
  }
  times.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      name,
      rows: count,
      columns: width,
      medianMs: Math.round(times[1]),
      samplesMs: times.map(Math.round),
      resultSha256: createHash('sha256').update(JSON.stringify(result)).digest('hex'),
    })
  );
}
