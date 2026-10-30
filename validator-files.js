/**
 * validator-files.js
 * CSV/TSV/XLSX reading and template/result workbook exports.
 * Uses validator-engine.js and vendor/jszip.min.js for local file processing.
 * Preserve leading-zero identifiers, date interpretation and spreadsheet text escaping.
 * File map: docs/FILE-MAP.md
 */
/* CSV/TSV and value-only XLSX import, plus native Excel exports. */
(function (root) {
  'use strict';
  const E = () => root.WorkHubValidatorEngine;
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const xml = s =>
    String(s ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]
    );
  const nodes = (el, name) => Array.from(el.getElementsByTagNameNS('*', name));
  const first = (el, name) => nodes(el, name)[0];
  const content = (el, name) => first(el, name)?.textContent || '';
  function parse(text) {
    const d = new root.DOMParser().parseFromString(text, 'application/xml');
    if (d.getElementsByTagName('parsererror').length)
      throw Error('The workbook contains invalid XML.');
    return d;
  }
  function col(index) {
    let s = '';
    for (index++; index; index = Math.floor((index - 1) / 26))
      s = String.fromCharCode(65 + ((index - 1) % 26)) + s;
    return s;
  }
  function index(ref) {
    let n = 0;
    for (const c of ref.toUpperCase()) n = n * 26 + c.charCodeAt(0) - 64;
    return n - 1;
  }
  async function partText(zip, path, limit = 2000000) {
    const e = zip.file(path);
    if (!e) throw Error('Missing workbook part: ' + path);
    if (Number(e._data?.uncompressedSize) > limit) throw Error('A workbook section is too large.');
    const s = await e.async('string');
    if (s.length > limit) throw Error('A workbook section is too large.');
    return s;
  }
  async function part(zip, path) {
    return parse(await partText(zip, path));
  }
  // Inflate incrementally and parse bounded XML blocks, keeping millions of
  // spreadsheet cells out of a single DOM or uncompressed XML string.
  async function blocks(zip, path, tag, consume) {
    const entry = zip.file(path);
    if (!entry) throw Error('Missing workbook part: ' + path);
    if (Number(entry._data?.uncompressedSize) > 600000000)
      throw Error('A workbook section is too large.');
    let buffer = '',
      outline = '',
      block = '',
      batch = '',
      opener = '',
      closer = '',
      depth = 0,
      batchCount = 0,
      expanded = 0;
    const ancestors = [];
    const flush = () => {
      if (!batchCount) return;
      const doc = parse(opener + batch + closer);
      for (const node of nodes(doc, tag)) consume(node);
      batch = '';
      batchCount = 0;
    };
    const append = text => {
      if (depth) {
        block += text;
        if (block.length > 8000000) throw Error('A workbook row is too large.');
      } else {
        outline += text;
        if (outline.length > 2000000) throw Error('Workbook metadata is too large.');
      }
    };
    const feed = chunk => {
      expanded += chunk.length;
      if (expanded > 600000000) throw Error('A workbook section is too large.');
      buffer += chunk;
      let cursor = 0;
      while (cursor < buffer.length) {
        const start = buffer.indexOf('<', cursor);
        if (start < 0) {
          append(buffer.slice(cursor));
          cursor = buffer.length;
          break;
        }
        append(buffer.slice(cursor, start));
        cursor = start;
        const rest = buffer.slice(start);
        let length;
        if ('<!--'.startsWith(rest) || '<![CDATA['.startsWith(rest)) break;
        if (rest.startsWith('<!--')) {
          const end = rest.indexOf('-->');
          if (end < 0) break;
          length = end + 3;
        } else if (rest.startsWith('<![CDATA[')) {
          const end = rest.indexOf(']]>');
          if (end < 0) break;
          length = end + 3;
        } else {
          const token = rest.match(/^<(?:[^>"']|"[^"]*"|'[^']*')*>/);
          if (!token) break;
          length = token[0].length;
        }
        const token = rest.slice(0, length);
        if (/^<!DOCTYPE|^<!ENTITY/i.test(token))
          throw Error('Workbook entity declarations are not supported.');
        const match = token.match(/^<(\/?)([\w.:-]+)(?:\s|\/?>)/);
        if (match) {
          const closing = !!match[1],
            name = match[2],
            local = name.split(':').at(-1),
            selfClosing = /\/\s*>$/.test(token);
          if (local === tag) {
            if (closing && !depth) throw Error('The workbook contains invalid XML.');
            if (!closing && depth) throw Error('The workbook contains nested data blocks.');
            if (!closing && !batchCount) {
              opener = ancestors.map(n => n.token).join('');
              closer = ancestors
                .slice()
                .reverse()
                .map(n => '</' + n.name + '>')
                .join('');
            }
            if (!closing) depth++;
            block += token;
            if (closing || selfClosing) depth--;
            if (!depth) {
              batch += block;
              block = '';
              batchCount++;
              if (batchCount >= 64 || batch.length > 1000000) flush();
            }
          } else {
            if (!depth) {
              flush();
              if (closing) {
                if (ancestors.pop()?.name !== name)
                  throw Error('The workbook contains invalid XML.');
              } else if (!selfClosing) ancestors.push({ name, token });
            }
            append(token);
          }
        } else append(token);
        cursor += length;
      }
      buffer = buffer.slice(cursor);
      if (buffer.length > 8000000) throw Error('A workbook XML token is too large.');
    };
    await new Promise((resolve, reject) => {
      let failed = false;
      const stream = entry.internalStream('string');
      stream.on('data', chunk => {
        if (failed) return;
        try {
          feed(chunk);
        } catch (error) {
          failed = true;
          stream.pause();
          reject(error);
        }
      });
      stream.on('error', reject);
      stream.on('end', () => {
        if (failed) return;
        try {
          if (depth || buffer || ancestors.length)
            throw Error('The workbook contains invalid XML.');
          flush();
          const skeleton = parse(outline);
          if (nodes(skeleton, tag).length || (tag === 'row' && nodes(skeleton, 'c').length))
            throw Error('The workbook contains cells outside readable rows.');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      stream.resume();
    });
  }
  function path(target) {
    if (/^[a-z]+:/i.test(target)) return '';
    const out = [];
    for (const p of (target.startsWith('/') ? target.slice(1) : 'xl/' + target).split('/')) {
      if (p === '..') out.pop();
      else if (p !== '.' && p) out.push(p);
    }
    return out.join('/');
  }
  function excelDate(raw, is1904) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || (!is1904 && n === 60))
      throw Error('The workbook contains an unsupported Excel date.');
    const offset = is1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31),
      adjusted = is1904 ? n : n >= 60 ? n - 1 : n;
    const d = new Date(offset + Math.floor(adjusted) * 86400000);
    if (!Number.isFinite(d.getTime())) throw Error('Invalid workbook date.');
    return d.toISOString().slice(0, 10);
  }
  async function read(file) {
    if (!file || file.size > E().LIMITS.fileBytes) throw Error('Choose a file below 50 MB.');
    if (/\.(csv|tsv)$/i.test(file.name)) {
      return {
        sheets: [
          {
            name: 'Data',
            rows: E().parseCSV(await file.text(), /\.tsv$/i.test(file.name) ? '\t' : ''),
          },
        ],
      };
    }
    if (!/\.xlsx$/i.test(file.name))
      throw Error('Use .xlsx, .csv or .tsv. Save legacy Excel files as .xlsx first.');
    if (!root.JSZip) throw Error('The Excel reader is unavailable. Refresh the page.');
    const zip = await root.JSZip.loadAsync(new root.Uint8Array(await file.arrayBuffer())),
      entries = Object.values(zip.files);
    if (
      entries.length > 1000 ||
      entries.reduce((n, e) => n + (Number(e._data?.uncompressedSize) || 0), 0) > 700000000
    )
      throw Error('The workbook expands beyond the supported size.');
    const book = await part(zip, 'xl/workbook.xml'),
      rels = await part(zip, 'xl/_rels/workbook.xml.rels'),
      links = new Map(
        nodes(rels, 'Relationship')
          .filter(r => r.getAttribute('TargetMode') !== 'External')
          .map(r => [r.getAttribute('Id'), path(r.getAttribute('Target') || '')])
      );
    const shared = [];
    let sharedText = 0,
      uploadText = 0;
    if (zip.file('xl/sharedStrings.xml'))
      await blocks(zip, 'xl/sharedStrings.xml', 'si', si => {
        const value = nodes(si, 't')
          .map(t => t.textContent)
          .join('');
        sharedText += value.length;
        if (
          value.length > 32000 ||
          shared.length >= E().LIMITS.cells + E().LIMITS.columns ||
          sharedText > E().LIMITS.text
        )
          throw Error('Shared strings exceed the upload limits.');
        shared.push(value);
      });
    const styles = zip.file('xl/styles.xml') ? await part(zip, 'xl/styles.xml') : null;
    const formats = new Map(
      styles
        ? nodes(styles, 'numFmt').map(f => [
            +f.getAttribute('numFmtId'),
            f.getAttribute('formatCode'),
          ])
        : []
    );
    const styleIds = styles
      ? Array.from(first(styles, 'cellXfs')?.children || []).map(n => +n.getAttribute('numFmtId'))
      : [];
    const is1904 = ['1', 'true'].includes(first(book, 'workbookPr')?.getAttribute('date1904')),
      sheets = [];
    for (const sheet of nodes(book, 'sheet')) {
      const target = links.get(sheet.getAttributeNS(REL, 'id') || sheet.getAttribute('r:id'));
      if (!target || !zip.file(target)) continue;
      const rows = [];
      let cells = 0,
        last = -1;
      await blocks(zip, target, 'row', row => {
        for (const c of nodes(row, 'c')) {
          const ref = c.getAttribute('r') || '',
            match = ref.match(/^([A-Z]+)(\d+)$/i);
          if (!match) throw Error('A workbook cell has an invalid row or column address.');
          const x = index(match[1]),
            y = +match[2] - 1;
          if (x >= E().LIMITS.columns || !Number.isSafeInteger(y) || y < 0 || y > E().LIMITS.rows)
            throw Error('Use up to 200 columns and 25,000 data rows.');
          if (++cells > E().LIMITS.cells + E().LIMITS.columns)
            throw Error('Use up to 5,000,000 data cells.');
          if (first(c, 'f'))
            throw Error(
              sheet.getAttribute('name') +
                '!' +
                ref +
                ' contains a formula. Paste formulas as values before uploading.'
            );
          const type = c.getAttribute('t'),
            raw = content(c, 'v');
          if (type === 's' && (!/^\d+$/.test(raw) || Number(raw) >= shared.length))
            throw Error('A workbook cell points to an invalid shared string.');
          let value =
            type === 'inlineStr'
              ? nodes(c, 't')
                  .map(t => t.textContent)
                  .join('')
              : type === 's'
                ? (shared[Number(raw)] ?? '')
                : type === 'b'
                  ? raw === '1'
                    ? 'true'
                    : 'false'
                  : raw;
          if (type === 'e')
            throw Error(sheet.getAttribute('name') + '!' + ref + ' contains an Excel error.');
          const fmtId = styleIds[+(c.getAttribute('s') || 0)] || 0,
            fmt = formats.get(fmtId) || '';
          if (
            !type &&
            raw !== '' &&
            ([14, 15, 16, 17, 22, 27, 30, 36, 50, 57].includes(fmtId) ||
              /[dy]/i.test(fmt.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')))
          )
            value = excelDate(raw, is1904);
          else if (!type && /^0{2,}$/.test(fmt) && /^\d+$/.test(raw))
            value = raw.padStart(fmt.length, '0');
          if (String(value).length > 32000) throw Error('A cell exceeds 32,000 characters.');
          uploadText += String(value).length;
          if (uploadText > E().LIMITS.text)
            throw Error('Upload values exceed 50 million text characters.');
          if (!rows[y]) rows[y] = [];
          if (Object.hasOwn(rows[y], x))
            throw Error('The workbook contains a duplicate cell address.');
          rows[y][x] = String(value);
          if (value !== '') last = Math.max(last, y);
        }
      });
      const filled = Array.from({ length: last + 1 }, (_, i) => rows[i] || []);
      sheets.push({ name: sheet.getAttribute('name') || 'Sheet', rows: filled });
    }
    if (!sheets.length) throw Error('No readable worksheets were found.');
    return { sheets };
  }
  const STYLES =
    '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="' +
    NS +
    '"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><fonts count="3"><font><sz val="11"/><color rgb="FF314B4A"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF8C3438"/><name val="Calibri"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF356C62"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFCE6E6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF1D0"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3EFFA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="7"><xf numFmtId="49" applyNumberFormat="1" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="49" applyNumberFormat="1" fontId="1" fillId="2" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="49" applyNumberFormat="1" fontId="2" fillId="3" borderId="0" xfId="0"><alignment wrapText="1"/></xf><xf numFmtId="49" applyNumberFormat="1" fontId="0" fillId="4" borderId="0" xfId="0"><alignment wrapText="1"/></xf><xf numFmtId="0" applyNumberFormat="1" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" applyNumberFormat="1" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" applyNumberFormat="1" fontId="0" fillId="5" borderId="0" xfId="0"><alignment wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const SHEET_CELLS = 1000000;
  function splitSheets(sheets) {
    return sheets.flatMap(s => {
      const width = s.width || s.rows.reduce((n, r) => Math.max(n, r.length), 1),
        count = s.rowCount ?? s.rows.length,
        per = Math.max(1, Math.floor(SHEET_CELLS / width));
      if (count <= per + 1) return [{ ...s, width }];
      let iterator, header;
      return Array.from({ length: Math.ceil((count - 1) / per) }, (_, part) => ({
        ...s,
        name: s.name + (part ? ' ' + (part + 1) : ''),
        width,
        rowCount: Math.min(per, count - 1 - part * per) + 1,
        rows: function* () {
          if (!iterator) {
            iterator = (typeof s.rows === 'function' ? s.rows() : s.rows)[Symbol.iterator]();
            header = iterator.next().value;
          }
          yield header;
          for (let i = 0; i < Math.min(per, count - 1 - part * per); i++) {
            const next = iterator.next();
            if (next.done) throw Error('Report rows are incomplete.');
            yield next.value;
          }
        },
      }));
    });
  }
  // Compress each worksheet before generating the next. Join ordinary ZIP
  // members by relocating their central-directory offsets (PKWARE APPNOTE 4.3).
  // This avoids retaining every worksheet's uncompressed XML at once.
  function archive() {
    const local = [],
      central = [];
    let offset = 0;
    return {
      async file(name, data) {
        const one = new root.JSZip();
        one.file(name, data, { createFolders: false });
        const bytes = await one.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }),
          view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
          end = bytes.length - 22;
        if (view.getUint32(end, true) !== 0x06054b50 || view.getUint16(end + 10, true) !== 1)
          throw Error('Could not assemble the report archive.');
        const start = view.getUint32(end + 16, true),
          size = view.getUint32(end + 12, true),
          directory = bytes.slice(start, start + size);
        if (new DataView(directory.buffer).getUint32(0, true) !== 0x02014b50)
          throw Error('Invalid report archive directory.');
        new DataView(directory.buffer).setUint32(42, offset, true);
        local.push(bytes.subarray(0, start));
        central.push(directory);
        offset += start;
        if (offset > 500000000 || central.length > 60000)
          throw Error('The report archive is too large. Export fewer files together.');
      },
      finish() {
        const size = central.reduce((n, b) => n + b.length, 0),
          end = new Uint8Array(22),
          view = new DataView(end.buffer);
        view.setUint32(0, 0x06054b50, true);
        view.setUint16(8, central.length, true);
        view.setUint16(10, central.length, true);
        view.setUint32(12, size, true);
        view.setUint32(16, offset, true);
        return new root.Blob([...local, ...central, end], { type: 'application/zip' });
      },
    };
  }
  async function workbook(sheets) {
    if (!root.JSZip) throw Error('The Excel writer is unavailable. Refresh the page.');
    const metadata = [],
      zip = { file: (name, data) => metadata.push([name, data]) },
      output = archive(),
      names = new Set();
    sheets = splitSheets(sheets).map((s, i) => {
      let name = String(s.name || 'Sheet ' + (i + 1))
        .replace(/[\\/?*:[\]]/g, ' ')
        .slice(0, 31);
      while (names.has(name.toLowerCase())) name = name.slice(0, 27) + ' ' + (i + 1);
      names.add(name.toLowerCase());
      return { ...s, name };
    });
    zip.file(
      '[Content_Types].xml',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map(
            (s, i) =>
              '<Override PartName="/xl/worksheets/sheet' +
              (i + 1) +
              '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
          )
          .join('') +
        '</Types>'
    );
    zip.file(
      '_rels/.rels',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' +
        REL +
        '/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    );
    zip.file(
      'xl/workbook.xml',
      '<workbook xmlns="' +
        NS +
        '" xmlns:r="' +
        REL +
        '"><sheets>' +
        sheets
          .map(
            (s, i) =>
              '<sheet name="' +
              xml(s.name) +
              '" sheetId="' +
              (i + 1) +
              '" r:id="rId' +
              (i + 1) +
              '"/>'
          )
          .join('') +
        '</sheets></workbook>'
    );
    zip.file(
      'xl/_rels/workbook.xml.rels',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets
          .map(
            (s, i) =>
              '<Relationship Id="rId' +
              (i + 1) +
              '" Type="' +
              REL +
              '/worksheet" Target="worksheets/sheet' +
              (i + 1) +
              '.xml"/>'
          )
          .join('') +
        '<Relationship Id="styles" Type="' +
        REL +
        '/styles" Target="styles.xml"/></Relationships>'
    );
    zip.file('xl/styles.xml', STYLES);
    for (const [name, data] of metadata) await output.file(name, data);
    for (const [i, s] of sheets.entries()) {
      const width = s.width || s.rows.reduce((max, row) => Math.max(max, row.length), 1),
        rowCount = s.rowCount ?? s.rows.length,
        end = col(width - 1) + Math.max(1, rowCount);
      await output.file(
        'xl/worksheets/sheet' + (i + 1) + '.xml',
        '<worksheet xmlns="' +
          NS +
          '"><dimension ref="A1:' +
          end +
          '"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>' +
          Array.from(
            { length: width },
            (_, n) =>
              '<col min="' +
              (n + 1) +
              '" max="' +
              (n + 1) +
              '" width="' +
              (s.widths?.[n] || 24) +
              '" customWidth="1" style="0"/>'
          ).join('') +
          '</cols><sheetData>' +
          Array.from(
            typeof s.rows === 'function' ? s.rows() : s.rows,
            (row, y) =>
              '<row r="' +
              (y + 1) +
              '"' +
              (!y ? ' ht="32" customHeight="1"' : '') +
              '>' +
              row
                .map((value, x) => {
                  const data = value && typeof value === 'object' ? value : { value },
                    v = data.value ?? '',
                    style = y === 0 ? 1 : data.style || 0;
                  return (
                    '<c r="' +
                    col(x) +
                    (y + 1) +
                    '" s="' +
                    style +
                    '"' +
                    (typeof v === 'number' ? '' : ' t="inlineStr"') +
                    '>' +
                    (typeof v === 'number'
                      ? '<v>' + v + '</v>'
                      : '<is><t xml:space="preserve">' + xml(v) + '</t></is>') +
                    '</c>'
                  );
                })
                .join('') +
              '</row>'
          ).join('') +
          '</sheetData>' +
          (rowCount > 1 ? '<autoFilter ref="A1:' + end + '"/>' : '') +
          '</worksheet>'
      );
    }
    return output.finish();
  }
  function typed(value, c, style = 0) {
    if (style) return { value: String(value ?? ''), style };
    if (
      !E().blank(value) &&
      ['integer', 'decimal'].includes(c.type) &&
      /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(String(value)) &&
      String(value).split(/[eE]/)[0].replace(/\D/g, '').replace(/^0+/, '').length <= 15
    )
      return { value: Number(value), style: 4 };
    if (
      c.type === 'date' &&
      String(value) >= '1900-01-01' &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ) {
      const n = Date.parse(value + 'T00:00:00Z');
      if (Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value)
        return {
          value: (n - Date.UTC(1899, 11, 31)) / 86400000 + (value >= '1900-03-01' ? 1 : 0),
          style: 5,
        };
    }
    return { value: String(value ?? ''), style: 0 };
  }
  async function template(t) {
    E().checkSchema(t);
    const sheets = [
      { name: 'Upload', rows: [t.columns.map(c => c.label)], widths: t.columns.map(() => 26) },
      {
        name: 'Field guide',
        rows: [
          [
            'Column',
            'Technical field',
            'Type',
            'Required',
            'Unique',
            'Limits',
            'Allowed values',
            'Format',
            'Notes',
            'Template type',
            'SAP length',
            'SAP decimals',
            'Currency/unit field',
          ],
          ...t.columns.map(c => [
            c.label,
            c.key,
            t.mode === 'sap' ? E().sapSettings(c).type : c.type,
            c.required ? 'Yes' : 'No',
            c.unique ? 'Yes' : 'No',
            t.mode === 'sap'
              ? 'DDIC length ' +
                E().sapSettings(c).length +
                '; decimals ' +
                E().sapSettings(c).decimals
              : [
                  c.minLength !== '' ? 'Min length ' + c.minLength : '',
                  c.maxLength !== '' ? 'Max length ' + c.maxLength : '',
                  c.min !== '' ? 'Min ' + c.min : '',
                  c.max !== '' ? 'Max ' + c.max : '',
                ]
                  .filter(Boolean)
                  .join('; '),
            c.values,
            t.mode === 'sap' ? E().sapSettings(c).spec.format : c.format,
            c.description,
            t.mode || 'general',
            t.mode === 'sap' ? E().sapSettings(c).length : '',
            t.mode === 'sap' ? E().sapSettings(c).decimals : '',
            t.mode === 'sap' ? c.sapReference || '' : '',
          ]),
        ],
        widths: [28, 24, 16, 12, 12, 35, 35, 20, 55, 18, 16, 16, 24],
      },
      {
        name: 'Conditions',
        rows: [
          ['Rule', 'Severity', 'When', 'Requirement', 'Message', 'Company scope'],
          ...t.rules
            .filter(r => r.enabled)
            .map(r => [
              r.name,
              r.severity,
              describeGroup(r.when, t),
              E().describe(r.assertion, t),
              r.message,
              r.companyScope === 'selected'
                ? r.companies.map(c => c.name).join(', ')
                : 'All companies',
            ]),
        ],
        widths: [30, 14, 60, 60, 65, 40],
      },
    ];
    if (t.projectId)
      sheets.push({
        name: 'Project scope',
        rows: [
          ['Item', 'Value'],
          ['Project', t.projectName || t.projectId],
          [
            'Validation company',
            'Choose one active company in Studio before validating. Each file is checked for one company.',
          ],
          [
            'Shared checks',
            'Column checks and all-company conditions apply alongside selected-company conditions.',
          ],
        ],
        widths: [25, 100],
      });
    if (t.columnGroups?.length)
      sheets.push({
        name: 'Column groups',
        rows: [
          ['Group', 'Value set', 'Technical field', 'Allowed values'],
          ...t.columnGroups.flatMap(g =>
            g.sets.flatMap(v => g.fields.map(key => [g.name, v.name, key, v.values[key]]))
          ),
        ],
        widths: [28, 28, 28, 60],
      });
    for (const l of t.lookups) sheets.push({ name: 'Ref ' + l.name, rows: [l.headers, ...l.rows] });
    return workbook(sheets);
  }
  function describeGroup(g, t) {
    const values = [
      ...g.conditions.map(c => E().describe(c, t)),
      ...g.groups.map(child => '(' + describeGroup(child, t) + ')'),
    ];
    return values.length ? values.join(g.join === 'all' ? ' AND ' : ' OR ') : 'Every row';
  }
  // Compare literal upload text. Validation normalization must not hide spaces,
  // case, leading zeros or changes to columns outside the template mapping.
  function comparison(t, upload, result) {
    const { headers, originalRows, preparedRows, sourceRows, origins, mapping, headerRow } = upload;
    if (
      !headers?.length ||
      !originalRows ||
      !preparedRows ||
      !sourceRows ||
      preparedRows.length !== sourceRows.length ||
      origins?.length !== sourceRows.length
    )
      throw Error('The original upload comparison is unavailable. Upload the file again.');
    const fields = headers.map((header, index) => {
      const column = t.columns.find(c => Number(mapping[c.key]) === index);
      return { index, header, key: column?.key || '', label: column?.label || header };
    });
    const report = {
      upload,
      fields,
      result,
      rows: [],
      changedRows: 0,
      changedCells: 0,
      preparedCells: 0,
      correctedCells: 0,
      splitRows: 0,
      affectedRows: 0,
      unmappedFields: t.columns.filter(c => !fields.some(f => f.key === c.key)).map(c => c.key),
      issues: new Map(),
    };
    for (const issue of result.issues) {
      const key = issue.index + ':' + issue.field;
      if (!report.issues.has(key)) report.issues.set(key, []);
      report.issues.get(key).push(issue);
    }
    sourceRows.forEach((row, index) => {
      const origin = origins[index],
        originalIndex = origin.row - headerRow - 1;
      if (!Number.isInteger(originalIndex) || !originalRows[originalIndex])
        throw Error('A working row has no original source row. Upload the file again.');
      const summary = { index, originalIndex, origin, changed: 0, prepared: 0, corrected: 0 };
      report.rows.push(summary);
      for (const field of fields) {
        const before = String(originalRows[originalIndex][field.index] ?? ''),
          prepared = String(preparedRows[index][field.index] ?? ''),
          current = String(row[field.index] ?? '');
        if (before !== current) summary.changed++;
        if (before !== prepared) summary.prepared++;
        if (prepared !== current) summary.corrected++;
      }
      report.changedCells += summary.changed;
      report.preparedCells += summary.prepared;
      report.correctedCells += summary.corrected;
      if (summary.changed) report.changedRows++;
      if (origin.part) report.splitRows++;
      if (summary.prepared || summary.corrected) report.affectedRows++;
    });
    return report;
  }
  function comparisonCell(report, index, fieldIndex) {
    const { upload, fields, rows } = report,
      field = fields[fieldIndex],
      row = rows[index];
    const original = String(upload.originalRows[row.originalIndex][fieldIndex] ?? ''),
      prepared = String(upload.preparedRows[index][fieldIndex] ?? ''),
      current = String(upload.sourceRows[index][fieldIndex] ?? ''),
      preparedChange = original !== prepared,
      corrected = prepared !== current,
      changed = original !== current,
      issues = field.key ? report.issues.get(index + ':' + field.key) || [] : [],
      errors = issues.filter(i => !i.ignored && i.severity === 'error').length,
      warnings = issues.filter(i => !i.ignored && i.severity === 'warning').length,
      ignored = issues.filter(i => i.ignored).length;
    const kind =
      !changed && (preparedChange || corrected)
        ? 'restored'
        : preparedChange && corrected
          ? 'prepared-corrected'
          : corrected
            ? 'corrected'
            : preparedChange
              ? 'prepared'
              : 'unchanged';
    return {
      original,
      prepared,
      current,
      changed,
      preparedChange,
      corrected,
      kind,
      errors,
      warnings,
      ignored,
      label: {
        restored: 'Returned to original',
        'prepared-corrected': 'Prepared + corrected',
        corrected: 'Corrected',
        prepared: 'Preparation change',
        unchanged: 'Unchanged',
      }[kind],
      check: !field.key
        ? 'Not checked · column not mapped'
        : errors
          ? errors + ' error(s)'
          : warnings
            ? warnings + ' warning(s)'
            : ignored
              ? ignored + ' ignored issue(s)'
              : report.result.truncated &&
                  (report.result.status[index].errors || report.result.status[index].warnings)
                ? 'Row has issues · field listing incomplete'
                : 'No listed issue',
    };
  }
  function comparisonSheets(t, upload, result) {
    const report = comparison(t, upload, result),
      wide = report.rows.length * report.fields.length > 50000,
      marked = (value, style) => ({ value, style }),
      differences = [
        [
          'Working data row (1-based)',
          'Working Excel row',
          'Original worksheet',
          'Original Excel row',
          'Split part',
          'Upload column',
          'Technical field',
          'Comparison',
          'Original value',
          'Prepared value',
          'Validated value',
          'Field check',
        ],
      ],
      rowReport = [
        [
          'Working data row (1-based)',
          'Working Excel row',
          'Original worksheet',
          'Original Excel row',
          'Split part',
          'Fields different from original',
          'Preparation changes',
          'Corrections since preparation',
          'Validation status',
          'Errors',
          'Warnings',
          'Ignored issues',
        ],
      ];
    for (const row of report.rows) {
      const status = result.status[row.index];
      rowReport.push([
        row.index + 1,
        upload.headerRow + row.index + 1,
        upload.sheet,
        row.origin.row,
        row.origin.part || 'Unsplit',
        marked(row.changed, row.changed ? 3 : 0),
        row.prepared,
        marked(row.corrected, row.corrected ? 3 : 0),
        status.errors
          ? 'Needs correction'
          : status.warnings
            ? 'Review warnings'
            : status.ignored
              ? 'Accepted with ignored issues'
              : 'Passed',
        status.errors,
        status.warnings,
        status.ignored || 0,
      ]);
    }
    function* fieldRows() {
      yield differences[0];
      for (const row of report.rows) {
        for (const field of report.fields) {
          const cell = comparisonCell(report, row.index, field.index);
          // Large original list cells can be repeated thousands of times after an
          // explosion. Keep their exact value once in Original upload, with a clear
          // locator rather than expanding the report by hundreds of megabytes.
          const original =
            cell.original.length > 1000
              ? cell.original.slice(0, 240) +
                '… [Full value: ' +
                originalLocation(row.originalIndex, field.index) +
                ']'
              : cell.original;
          yield [
            row.index + 1,
            upload.headerRow + row.index + 1,
            upload.sheet,
            row.origin.row,
            row.origin.part || 'Unsplit',
            col(field.index) + ' · ' + field.header,
            field.key || 'Not mapped',
            cell.label,
            marked(original, cell.changed ? 3 : 0),
            marked(cell.prepared, cell.preparedChange ? 6 : 0),
            marked(
              cell.current,
              cell.errors ? 2 : cell.corrected || cell.warnings ? 3 : cell.changed ? 6 : 0
            ),
            cell.check,
          ];
        }
      }
    }
    function originalLocation(index, field) {
      const per = Math.max(1, Math.floor(SHEET_CELLS / upload.headers.length)),
        part = Math.floor(index / per);
      return (
        'Original upload' + (part ? ' ' + (part + 1) : '') + '!' + col(field) + ((index % per) + 2)
      );
    }
    function* wideFields() {
      yield [
        'Working data row (1-based)',
        'Working Excel row',
        'Original worksheet',
        'Original Excel row',
        'Split part',
        ...report.fields.flatMap(f =>
          ['Original', 'Prepared', 'Validated', 'Change', 'Field check'].map(
            label => (f.key || f.header) + ' · ' + label
          )
        ),
      ];
      for (const row of report.rows) {
        const values = [
          row.index + 1,
          upload.headerRow + row.index + 1,
          upload.sheet,
          row.origin.row,
          row.origin.part || 'Unsplit',
        ];
        for (const field of report.fields) {
          const cell = comparisonCell(report, row.index, field.index),
            original =
              cell.original.length > 1000
                ? cell.original.slice(0, 240) +
                  '… [Full value: ' +
                  originalLocation(row.originalIndex, field.index) +
                  ']'
                : cell.original;
          values.push(
            marked(original, cell.changed ? 3 : 0),
            marked(cell.prepared, cell.preparedChange ? 6 : 0),
            marked(
              cell.current,
              cell.errors ? 2 : cell.corrected || cell.warnings ? 3 : cell.changed ? 6 : 0
            ),
            cell.label,
            cell.check
          );
        }
        yield values;
      }
    }
    const sheets = [
      {
        name: 'Comparison summary',
        widths: [38, 105],
        rows: [
          ['Item', 'Value'],
          ['File', upload.fileName || 'Uploaded data'],
          ['Original worksheet', upload.sheet],
          ['Original header row', upload.headerRow],
          ['Original rows', upload.originalRows.length],
          ['Validated working rows', upload.sourceRows.length],
          ['Split output rows', report.splitRows],
          ['Rows different from original', report.changedRows],
          ['Fields different from original', report.changedCells],
          ['Preparation changes', report.preparedCells],
          ['Corrections since preparation', report.correctedCells],
          ['Upload columns compared', report.fields.length],
          [
            'Comparison layout',
            wide
              ? 'Side-by-side field groups; numbered worksheets continue the complete data.'
              : 'One row per field',
          ],
          ['Template fields not mapped', report.unmappedFields.join(', ') || 'None'],
          [
            'Comparison policy',
            'Exact text: spaces, case, blanks and leading zeros are significant. Preparation changes are expected transformations; they are not validation failures.',
          ],
          [
            'Prepared value',
            'Snapshot after the latest preparation, including any earlier corrections. Without preparation this is the original upload.',
          ],
          [
            'Highlight key',
            'Blue = preparation change. Amber = correction or difference from original. Red = unresolved validation error. Labels also identify each change.',
          ],
          [
            'Field comparison',
            'Every upload field for every working row, including unchanged values and listed validation issues. Original cells longer than 1,000 characters are previewed here with their full-value location.',
          ],
          [
            'Original upload',
            'Full literal source values. Data row 2 here corresponds to the first row below the selected original header. Use Row comparison for the original worksheet row number.',
          ],
          [
            'Validation issue listing',
            result.truncated
              ? 'Issue listing is truncated; comparison still covers every uploaded row and field.'
              : 'Complete',
          ],
        ],
      },
      {
        name: 'Row comparison',
        rows: rowReport,
        widths: [20, 20, 28, 20, 16, 24, 24, 28, 32, 12, 12, 16],
      },
      {
        name: 'Field comparison',
        rows: wide ? wideFields : fieldRows,
        width: wide ? 5 + report.fields.length * 5 : 12,
        rowCount: wide ? report.rows.length + 1 : 1 + report.rows.length * report.fields.length,
        widths: wide ? [] : [20, 20, 28, 20, 16, 30, 26, 30, 48, 48, 48, 42],
      },
      {
        name: 'Original upload',
        width: upload.headers.length,
        rowCount: upload.originalRows.length + 1,
        rows: function* () {
          yield upload.headers;
          for (const row of upload.originalRows) yield row.map(String);
        },
      },
    ];
    if (upload.steps.length)
      sheets.push({
        name: 'Prepared baseline',
        width: upload.headers.length,
        rowCount: upload.preparedRows.length + 1,
        rows: function* () {
          yield upload.headers;
          for (let i = 0; i < upload.preparedRows.length; i++)
            yield upload.preparedRows[i].map((v, j) =>
              marked(v, comparisonCell(report, i, j).preparedChange ? 6 : 0)
            );
        },
      });
    sheets.push({
      name: 'Validated upload',
      width: upload.headers.length,
      rowCount: upload.sourceRows.length + 1,
      rows: function* () {
        yield upload.headers;
        for (let i = 0; i < upload.sourceRows.length; i++)
          yield upload.sourceRows[i].map((v, j) => {
            const cell = comparisonCell(report, i, j);
            return marked(
              v,
              cell.errors ? 2 : cell.corrected || cell.warnings ? 3 : cell.changed ? 6 : 0
            );
          });
      },
    });
    return sheets;
  }
  async function report(t, rows, result, acceptedOnly = false, preparation = null) {
    const header = t.columns
        .map(c => c.label)
        .concat(acceptedOnly ? [] : ['Validation status', 'Errors', 'Warnings', 'Ignored issues']),
      styles = new Map();
    for (const x of result.issues) {
      if (x.ignored) continue;
      const key = x.index + '\0' + x.field;
      if (x.severity === 'error' || !styles.has(key))
        styles.set(key, x.severity === 'error' ? 2 : 3);
    }
    function* dataRows() {
      yield header;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (acceptedOnly && result.status[i].errors) continue;
        const values = t.columns.map(c =>
          t.mode === 'sap'
            ? {
                value: String(r[c.key] ?? ''),
                style: acceptedOnly ? 0 : styles.get(i + '\0' + c.key) || 0,
              }
            : typed(r[c.key], c, acceptedOnly ? 0 : styles.get(i + '\0' + c.key) || 0)
        );
        if (!acceptedOnly)
          values.push(
            result.status[i].errors
              ? 'Needs correction'
              : result.status[i].warnings
                ? 'Review warnings'
                : result.status[i].ignored
                  ? 'Accepted with ignored issues'
                  : 'Passed',
            result.status[i].errors,
            result.status[i].warnings,
            result.status[i].ignored || 0
          );
        yield values;
      }
    }
    const sheets = [
      {
        name: acceptedOnly ? 'Accepted data' : 'Validated data',
        rows: dataRows,
        width: header.length,
        rowCount: (acceptedOnly ? result.passed : rows.length) + 1,
      },
    ];
    if (result.setup) {
      sheets.push({
        name: 'Validation setup',
        rows: [
          ['Profile / run setup', result.setup.name],
          ['Base column checks', 'Always active'],
          ['Conditions active', result.setup.conditions.length],
          ['Reference checks active', result.setup.references.length],
          ['Conditions skipped', result.setup.skipped.length],
          ['Check', 'Status', 'Detail'],
          ...result.setup.conditions.map(r => [r.name, 'Active condition', '']),
          ...result.setup.references.map(r => [
            r.field + ' → ' + r.name,
            'Active reference check',
            r.column + ' · ' + r.requiredBy,
          ]),
          ...result.setup.skipped.map(r => [r.name, 'Skipped', r.reason]),
        ],
      });
    }
    if (preparation) {
      const indices = rows.map((r, i) => i).filter(i => !acceptedOnly || !result.status[i].errors);
      sheets.push({
        name: 'Prepared upload',
        width: preparation.headers.length,
        rowCount: indices.length + 1,
        rows: function* () {
          yield preparation.headers;
          for (const i of indices) yield preparation.sourceRows[i].map(String);
        },
      });
      sheets.push({
        name: 'Row origins',
        rows: [
          [
            'Exported data row (1-based)',
            'Working data row (1-based)',
            'Original worksheet',
            'Original Excel row',
            'Split part',
          ],
          ...indices.map((i, n) => [
            n + 1,
            i + 1,
            preparation.sheet,
            preparation.origins[i].row,
            preparation.origins[i].part || 'Unsplit',
          ]),
        ],
      });
    }
    if (!acceptedOnly)
      sheets.push({
        name: 'Issues',
        rows: [
          [
            preparation ? 'Working Excel row' : 'Excel row',
            'Column',
            'Technical field',
            'Severity',
            'Rule',
            'Value',
            'Message',
            'Review status',
            'Ignore reason',
          ],
          ...result.issues.map(x => [
            x.row,
            x.column,
            x.field,
            x.severity,
            x.rule,
            x.value,
            x.message,
            x.ignored ? 'Ignored' : 'Unresolved',
            x.ignoreReason || '',
          ]),
        ],
        widths: [13, 24, 24, 14, 35, 35, 70, 20, 50],
      });
    sheets.push({
      name: 'Run details',
      rows: [
        ['Item', 'Value'],
        ['Template', t.name],
        ...(result.context?.projectId
          ? [
              ['Project', result.context.projectName],
              ['Project ID', result.context.projectId],
              ['Company', result.context.companyName],
              ['Company ID', result.context.companyId],
              ['Conditions applied', result.appliedRules],
            ]
          : []),
        ['Rows checked', result.rows],
        ['Rows without errors', result.passed],
        ['Errors', result.errors],
        ['Warnings', result.warnings],
        ['Ignored issues', result.ignored || 0],
        ['Ignored errors', result.ignoredErrors || 0],
        ['Ignored warnings', result.ignoredWarnings || 0],
        [
          'Review policy',
          'Ignored issues are excluded from unresolved totals. Uploaded values and validation rules are unchanged.',
        ],
        ['Issues listed', result.issues.length],
        ['Issues truncated', result.truncated ? 'Yes; split the file for the full report.' : 'No'],
        ['Generated', new Date().toISOString()],
        ...(preparation
          ? [
              [
                'Data preparation',
                preparation.steps
                  .map(s => (s.kind === 'sap' ? 'SAP formatting' : 'Explode & map'))
                  .join(' → ') || 'None',
              ],
              [
                'Prepared upload',
                'All original upload columns are retained in Prepared upload. Row origins links working data rows to the original worksheet and Excel rows.',
              ],
            ]
          : []),
      ],
    });
    if (result.ignored)
      sheets.push({
        name: 'Ignored issues',
        rows: [
          [
            'Excel row',
            'Column',
            'Technical field',
            'Severity',
            'Rule',
            'Value',
            'Message',
            'Ignore reason',
          ],
          ...result.issues
            .filter(x => x.ignored)
            .map(x => [
              x.row,
              x.column,
              x.field,
              x.severity,
              x.rule,
              x.value,
              x.message,
              x.ignoreReason || '',
            ]),
        ],
        widths: [13, 24, 24, 14, 35, 35, 70, 50],
      });
    if (t.lookups.some(l => l.nameColumn || l.descriptionColumns?.length)) {
      const matches = [
          [
            'Data row (1-based)',
            'Reference',
            'Code',
            'Display name',
            'Description',
            'Reference row',
            'Matching rows',
            'Upload fields',
          ],
        ],
        cache = new Map();
      let truncated = false;
      for (let i = 0; i < rows.length; i++) {
        if (acceptedOnly && result.status[i].errors) continue;
        for (const m of E().referenceDetails(t, rows[i], cache, result.context)) {
          if (matches.length > 10000) {
            truncated = true;
            break;
          }
          matches.push([
            i + 1,
            m.reference,
            m.code,
            m.displayName,
            m.description,
            m.sourceRow,
            m.matchCount,
            m.fields.join(' + '),
          ]);
        }
        if (truncated) break;
      }
      sheets.push({
        name: 'Reference matches',
        rows: matches,
        widths: [20, 28, 24, 35, 65, 18, 18, 40],
      });
      if (truncated)
        sheets
          .find(s => s.name === 'Run details')
          .rows.push([
            'Reference matches truncated',
            'First 10,000 matches shown. Split the file to export more.',
          ]);
    }
    if (!acceptedOnly && preparation?.originalRows) {
      const comparison = comparisonSheets(t, preparation, result);
      preparation.comparisonFirst ? sheets.unshift(...comparison) : sheets.push(...comparison);
    }
    return workbook(sheets);
  }
  root.WorkHubValidatorFiles = Object.freeze({
    read,
    workbook,
    template,
    report,
    comparison,
    comparisonCell,
    describeGroup,
    col,
    excelDate,
  });
})(window);
