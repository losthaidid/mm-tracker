/** Bound JSDOM memory by running the large application suite in disjoint groups. */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const files = readdirSync(new URL('../tests/', import.meta.url))
  .filter(f => f.endsWith('.test.mjs') && f !== 'app.test.mjs')
  .sort()
  .map(f => 'tests/' + f);
const groups = [
  { label: 'Module and database tests', args: files },
  ...['^[A-Fa-f]', '^[G-Mg-m]', '^[N-Sn-s]', '^[T-Vt-v]', '^[^A-Va-v]'].map((pattern, i) => ({
    label: `Application tests · group ${i + 1}/5`,
    args: ['--test-name-pattern=' + pattern, 'tests/app.test.mjs'],
  })),
];
let failed = false;
for (const group of groups) {
  console.log(group.label);
  const run = spawnSync(process.execPath, ['--max-old-space-size=4096', '--test', ...group.args], {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });
  if (run.error) {
    console.error(run.error.message);
    failed = true;
  }
  if (run.status !== 0) {
    console.error(`${group.label} did not pass${run.signal ? ' (' + run.signal + ')' : ''}.`);
    failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
