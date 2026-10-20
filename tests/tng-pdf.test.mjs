import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { test } from 'node:test';
import * as pdfjs from '../vendor/pdfjs/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

// A small white PNG generator keeps PDF pagination tests independent of a native canvas package.
function png(width, height) {
  function chunk(type, data) {
    const body = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const size = Buffer.alloc(4), sum = Buffer.alloc(4);
    size.writeUInt32BE(data.length); sum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, body, sum]);
  }
  const header = Buffer.alloc(13), scanlines = Buffer.alloc((width * 3 + 1) * height, 255);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  for (let y = 0; y < height; y++) scanlines[y * (width * 3 + 1)] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))]);
}

function fixture() {
  const window = {};
  const document = {
    baseURI: new URL('../index.html', import.meta.url).href,
    createElement() {
      return { width: 1, height: 1, getContext: () => ({ fillRect() {}, drawImage() {} }),
        toBlob(callback) { callback(new Blob([png(this.width, this.height)], { type: 'image/png' })); } };
    },
  };
  // Browser script and ESM PDF library share a realm, as they do on the website.
  for (const file of ['claims-engine.js', 'tng-engine.js', 'tng-files.js'])
    new Function('window', 'document', readFileSync(new URL('../' + file, import.meta.url), 'utf8'))(window, document);
  const rows = Array.from({ length: 19 }, (_, i) => ({ id: 'r' + i, transactionNo: 'TX' + i,
    section: 'offline', page: 1, width: 595, height: 1200, date: '2026-10-09', postedDate: '2026-10-11',
    time: i < 16 ? '09:00:00' : '12:00:00', category: i === 18 ? 'parking' : 'toll', amountCents: 166,
    rect: { x: 20, y: 60 + i * 50, w: 555, h: 50 }, headerRect: { x: 20, y: 25, w: 555, h: 25 } }));
  return { files: window.WorkHubTngFiles, rows, session: { renderPage: async () => ({ width: 1190 }) } };
}

async function inspect(blob) {
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), useSystemFonts: true });
  try {
    const pdf = await task.promise, text = [], images = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i), content = await page.getTextContent(), ops = await page.getOperatorList();
      text.push(content.items.map(item => item.str).join(' '));
      images.push(ops.fnArray.filter(fn => fn === pdfjs.OPS.paintImageXObject).length);
    }
    return { pages: pdf.numPages, text: text.join('\n'), images };
  } finally { await task.destroy(); }
}

test('client evidence PDF keeps every crop, repeats captions on continuation and separates Return and other spending', async () => {
  const { files, rows, session } = fixture();
  const result = await inspect(await files.pdfPack(session, rows, true, () => true, { claimType: 'client-site',
    captions: { '2026-10-09|to': 'tol 4 of 4 (09/10/2026 to)' } }));
  assert.equal(result.pages, 4);
  assert.deepEqual(result.images, [13, 3, 2, 1]);
  assert.equal(result.text.match(/tol 4 of 4 \(09\/10\/2026 to\)/g).length, 2);
  assert.match(result.text, /continued/);
  assert.match(result.text, /tol 2 of 2 \(09\/10\/2026 return\)/);
  assert.match(result.text, /Other expenses \(09\/10\/2026\)/);
  assert.doesNotMatch(result.text, /11\/10\/2026/);
  await assert.rejects(() => files.pdfPack(session, [{ ...rows[0], time: '' }], true, () => true,
    { claimType: 'client-site' }), /Review missing transaction times/);
});

test('special evidence PDF retains individual evidence formatting and cancelled work produces no download bytes', async () => {
  const { files, rows, session } = fixture();
  const result = await inspect(await files.pdfPack(session, rows.slice(0, 2), true, () => true, { claimType: 'special' }));
  assert.match(result.text, /TNG expense evidence/);
  assert.match(result.text, /Source page 1/);
  assert.doesNotMatch(result.text, /tol \d+ of|Client site claims|return\)/);
  assert.equal(result.images.reduce((n, count) => n + count, 0), 2);
  await assert.rejects(() => files.pdfPack(session, rows, true, () => false, { claimType: 'client-site' }), /Export cancelled/);
});
