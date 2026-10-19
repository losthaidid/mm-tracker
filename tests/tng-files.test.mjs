import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const window = {};
runInNewContext(readFileSync(new URL('../tng-files.js', import.meta.url), 'utf8'), {
  window,
  URL,
  document: { baseURI: 'https://example.com/mm-tracker/' },
});
const { readTextItems } = window.WorkHubTngFiles;

// Deliberately no Symbol.asyncIterator: this is the Safari capability gap.
function pageStream(read) {
  const calls = { cancelled: 0, released: 0 };
  const reader = {
    read,
    async cancel() { calls.cancelled++; },
    releaseLock() { calls.released++; },
  };
  return {
    calls,
    reader,
    page: {
      getTextContent() { throw Error('The incompatible API must not be called.'); },
      streamTextContent() { return { getReader: () => reader }; },
    },
  };
}

test('PDF text extraction reads all chunks without stream async iteration', async () => {
  const first = { str: 'Entry', transform: [1, 0, 0, 1, 25, 700] };
  const second = { str: '1.66', transform: [1, 0, 0, 1, 480, 700] };
  const chunks = [{ value: { items: [first] } }, { value: { items: [] } }, { value: { items: [second] } }, { done: true }];
  const fixture = pageStream(async () => chunks.shift());
  assert.equal(fixture.page.streamTextContent()[Symbol.asyncIterator], undefined);
  assert.deepEqual(Array.from(await readTextItems(fixture.page)), [first, second]);
  assert.deepEqual(fixture.calls, { cancelled: 0, released: 1 });
});

test('PDF text extraction cancels a stale account read and releases its lock', async () => {
  let alive = true;
  const fixture = pageStream(async () => {
    alive = false;
    return { value: { items: [{ str: 'Private record' }] } };
  });
  await assert.rejects(() => readTextItems(fixture.page, () => alive), /Import cancelled/);
  assert.deepEqual(fixture.calls, { cancelled: 1, released: 1 });
});

test('PDF text extraction preserves read failures even when cancellation fails', async () => {
  const original = Error('Broken text stream');
  const fixture = pageStream(async () => { throw original; });
  fixture.reader.cancel = async () => { fixture.calls.cancelled++; throw Error('Cancel rejected'); };
  await assert.rejects(() => readTextItems(fixture.page), error => error === original);
  assert.deepEqual(fixture.calls, { cancelled: 1, released: 1 });
});
