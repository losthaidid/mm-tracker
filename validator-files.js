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
  async function part(zip, path) {
    const e = zip.file(path);
    if (!e) throw Error('Missing workbook part: ' + path);
    if (Number(e._data?.uncompressedSize) > 12000000)
      throw Error('A workbook section is too large.');
    const s = await e.async('string');
    if (s.length > 12000000) throw Error('A workbook section is too large.');
    return parse(s);
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
    if (!file || file.size > 10000000) throw Error('Choose a file below 10 MB.');
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
      entries.reduce((n, e) => n + (Number(e._data?.uncompressedSize) || 0), 0) > 40000000
    )
      throw Error('The workbook expands beyond the supported size.');
    const book = await part(zip, 'xl/workbook.xml'),
      rels = await part(zip, 'xl/_rels/workbook.xml.rels'),
      links = new Map(
        nodes(rels, 'Relationship')
          .filter(r => r.getAttribute('TargetMode') !== 'External')
          .map(r => [r.getAttribute('Id'), path(r.getAttribute('Target') || '')])
      );
    const shared = zip.file('xl/sharedStrings.xml')
      ? nodes(await part(zip, 'xl/sharedStrings.xml'), 'si').map(si =>
          nodes(si, 't')
            .map(t => t.textContent)
            .join('')
        )
      : [];
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
      const doc = await part(zip, target),
        rows = [];
      let cells = 0,
        last = -1;
      for (const c of nodes(doc, 'c')) {
        const ref = c.getAttribute('r') || '',
          match = ref.match(/^([A-Z]+)(\d+)$/i);
        if (!match) continue;
        const x = index(match[1]),
          y = +match[2] - 1;
        if (x >= E().LIMITS.columns || y > 5000)
          throw Error('Use up to 200 columns and 5,000 data rows.');
        if (++cells > E().LIMITS.cells + E().LIMITS.columns)
          throw Error('Use up to 200,000 data cells.');
        if (first(c, 'f'))
          throw Error(
            sheet.getAttribute('name') +
              '!' +
              ref +
              ' contains a formula. Paste formulas as values before uploading.'
          );
        const type = c.getAttribute('t'),
          raw = content(c, 'v');
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
        if (!rows[y]) rows[y] = [];
        rows[y][x] = String(value);
        if (value !== '') last = Math.max(last, y);
      }
      const filled = Array.from({ length: last + 1 }, (_, i) => rows[i] || []);
      sheets.push({ name: sheet.getAttribute('name') || 'Sheet', rows: filled });
    }
    if (!sheets.length) throw Error('No readable worksheets were found.');
    return { sheets };
  }
  const STYLES =
    '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="' +
    NS +
    '"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><fonts count="3"><font><sz val="11"/><color rgb="FF314B4A"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF8C3438"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF356C62"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFCE6E6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF1D0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="6"><xf numFmtId="49" applyNumberFormat="1" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="49" applyNumberFormat="1" fontId="1" fillId="2" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="49" applyNumberFormat="1" fontId="2" fillId="3" borderId="0" xfId="0"><alignment wrapText="1"/></xf><xf numFmtId="49" applyNumberFormat="1" fontId="0" fillId="4" borderId="0" xfId="0"><alignment wrapText="1"/></xf><xf numFmtId="0" applyNumberFormat="1" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" applyNumberFormat="1" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  async function workbook(sheets) {
    if (!root.JSZip) throw Error('The Excel writer is unavailable. Refresh the page.');
    const zip = new root.JSZip(),
      names = new Set();
    sheets = sheets.map((s, i) => {
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
    for (const [i, s] of sheets.entries()) {
      const width = Math.max(1, ...s.rows.map(r => r.length)),
        end = col(width - 1) + Math.max(1, s.rows.length);
      zip.file(
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
          s.rows
            .map(
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
            )
            .join('') +
          '</sheetData>' +
          (s.rows.length > 1 ? '<autoFilter ref="A1:' + end + '"/>' : '') +
          '</worksheet>'
      );
    }
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
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
  async function report(t, rows, result, acceptedOnly = false) {
    const data = [
        t.columns
          .map(c => c.label)
          .concat(acceptedOnly ? [] : ['Validation status', 'Errors', 'Warnings']),
      ],
      styles = new Map();
    for (const x of result.issues) {
      const key = x.index + '\0' + x.field;
      if (x.severity === 'error' || !styles.has(key))
        styles.set(key, x.severity === 'error' ? 2 : 3);
    }
    rows.forEach((r, i) => {
      if (acceptedOnly && result.status[i].errors) return;
      const values = t.columns.map(c =>
        typed(r[c.key], c, acceptedOnly ? 0 : styles.get(i + '\0' + c.key) || 0)
      );
      if (!acceptedOnly)
        values.push(
          result.status[i].errors
            ? 'Needs correction'
            : result.status[i].warnings
              ? 'Review warnings'
              : 'Passed',
          result.status[i].errors,
          result.status[i].warnings
        );
      data.push(values);
    });
    const sheets = [{ name: acceptedOnly ? 'Accepted data' : 'Validated data', rows: data }];
    if (!acceptedOnly)
      sheets.push({
        name: 'Issues',
        rows: [
          ['Excel row', 'Column', 'Technical field', 'Severity', 'Rule', 'Value', 'Message'],
          ...result.issues.map(x => [
            x.row,
            x.column,
            x.field,
            x.severity,
            x.rule,
            x.value,
            x.message,
          ]),
        ],
        widths: [13, 24, 24, 14, 35, 35, 70],
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
        ['Issues listed', result.issues.length],
        ['Issues truncated', result.truncated ? 'Yes; split the file for the full report.' : 'No'],
        ['Generated', new Date().toISOString()],
      ],
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
    return workbook(sheets);
  }
  root.WorkHubValidatorFiles = Object.freeze({
    read,
    workbook,
    template,
    report,
    describeGroup,
    col,
    excelDate,
  });
})(window);
