/** Lossless JSON and dynamic IDoc XML reading. No saved state, network or business-rule inference. */
(function (root) {
  'use strict';
  const LIMITS = {
    bytes: 2 * 1024 * 1024,
    nodes: 30000,
    depth: 64,
    reportCells: 60000,
    pathChars: 8 * 1024 * 1024,
  };
  const LABELS = {
    DOCNUM: 'IDoc number',
    IDOCTYP: 'IDoc type',
    MESTYP: 'Message type',
    MANDT: 'Client',
    DOCREL: 'SAP release',
    DIRECT: 'Direction code',
    SNDPOR: 'Sender port',
    SNDPRN: 'Sender partner',
    SNDPRT: 'Sender partner type',
    RCVPOR: 'Receiver port',
    RCVPRN: 'Receiver partner',
    RCVPRT: 'Receiver partner type',
    CREDAT: 'Creation date',
    CRETIM: 'Creation time',
    STATUS: 'Status code',
    LOGDAT: 'Log date',
    LOGTIM: 'Log time',
    STATXT: 'Status text',
    STAMID: 'Message class',
    STAMNO: 'Message number',
    STATYP: 'Message type code',
    UNAME: 'User',
    REPID: 'Program',
    SEGNUM: 'Segment number',
    BUKRS: 'Company code',
    GJAHR: 'Fiscal year',
    POSNR: 'Item number',
    EDI_DC40: 'Control record',
    EDI_DS40: 'Status record',
    '#text': 'Text content',
  };
  const label = (key, aliases = {}) =>
    (Object.hasOwn(aliases, key) && aliases[key]) ||
    (Object.hasOwn(LABELS, key) && LABELS[key]) ||
    (/[_\s-]|[a-z]/.test(key)
      ? key
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/[_-]+/g, ' ')
          .replace(/^./, c => c.toUpperCase())
      : key);
  const blank = n =>
    !['object', 'array', 'segment', 'null'].includes(n.type) &&
    !n.children.length &&
    n.value.trim() === '';
  const scalar = n =>
    n.children.length || ['object', 'array', 'segment'].includes(n.type)
      ? '[' + n.type + ': ' + n.children.length + ' entries]'
      : n.type === 'null'
        ? 'null'
        : n.value;
  const visibleText = value =>
    String(value).replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,
      c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
    );
  function parse(source, name = '') {
    if (typeof source !== 'string' || !source.trim())
      throw Error('Paste JSON or an IDoc XML file first.');
    if (new TextEncoder().encode(source).length > LIMITS.bytes)
      throw Error('Open files up to 2 MB. Split larger exports into smaller files.');
    const content = source.replace(/^\uFEFF/, ''),
      nodes = [],
      byId = new Map();
    let pathChars = 0;
    function make(key, type, value, children, path, depth, attrs = []) {
      if (key.length > 512)
        throw Error(
          'Field and segment names support up to 512 characters. Shorten the name or open a smaller export.'
        );
      pathChars += path.length;
      if (pathChars > LIMITS.pathChars)
        throw Error(
          'This document expands into too many long paths. Open a smaller or less deeply nested export.'
        );
      if (nodes.length >= LIMITS.nodes)
        throw Error('This file exceeds 30,000 values and sections. Open a smaller export.');
      if (depth > LIMITS.depth) throw Error('This file is nested more than 64 levels deep.');
      const n = { id: 'dr' + nodes.length, key, type, value, children, path, attrs };
      nodes.push(n);
      byId.set(n.id, n);
      return n;
    }
    let kind,
      roots,
      wrapper,
      duplicates = 0;
    if (content.trimStart().startsWith('<')) {
      kind = 'idoc';
      if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(content))
        throw Error('Use an IDoc XML export without a DTD or entity declaration.');
      const xml = new root.DOMParser().parseFromString(content, 'application/xml');
      if (
        xml.getElementsByTagNameNS(
          'http://www.mozilla.org/newlayout/xml/parsererror.xml',
          'parsererror'
        ).length
      )
        throw Error(
          'The XML is not well formed. Check matching tags, escaped characters and the file’s closing tags.'
        );
      const idocs = Array.from(xml.getElementsByTagNameNS('*', 'IDOC')).filter(el => {
        for (let p = el.parentElement; p; p = p.parentElement)
          if (p.localName === 'IDOC') return false;
        return true;
      });
      if (!idocs.length)
        throw Error(
          'No IDOC elements were found. Choose an IDoc XML export or JSON. Fixed-width IDoc text needs segment definitions.'
        );
      wrapper = xml.documentElement.nodeName;
      function walk(el, path, depth) {
        if (depth > LIMITS.depth) throw Error('This file is nested more than 64 levels deep.');
        const n = make(
          el.nodeName,
          el.hasAttribute('SEGMENT') ? 'segment' : el.children.length ? 'object' : 'field',
          Array.from(el.childNodes)
            .filter(x => x.nodeType === 3 || x.nodeType === 4)
            .map(x => x.nodeValue)
            .join(''),
          [],
          path,
          depth,
          Array.from(el.attributes).map(a => [a.name, a.value])
        );
        n.localName = el.localName;
        const counts = new Map();
        for (const child of el.children) {
          const index = (counts.get(child.nodeName) || 0) + 1;
          counts.set(child.nodeName, index);
          n.children.push(walk(child, path + '/' + child.nodeName + '[' + index + ']', depth + 1));
        }
        if (n.type !== 'field' && n.value.trim())
          n.children.unshift(make('#text', 'field', n.value, [], path + '/text()', depth + 1));
        return n;
      }
      roots = idocs.map(el => {
        const path = [];
        for (let p = el; p; p = p.parentElement) {
          const siblings = p.parentElement
            ? Array.from(p.parentElement.children).filter(c => c.nodeName === p.nodeName)
            : [p];
          path.unshift(p.nodeName + '[' + (siblings.indexOf(p) + 1) + ']');
        }
        return walk(el, '/' + path.join('/'), 0);
      });
    } else {
      kind = 'json';
      wrapper = 'JSON';
      let p = 0;
      const fail = message => {
        const before = content.slice(0, p),
          line = before.split('\n').length,
          column = p - before.lastIndexOf('\n');
        throw Error(message + ' at line ' + line + ', column ' + column + '.');
      };
      const space = () => {
        while (/[ \t\r\n]/.test(content[p] || '') && p < content.length) p++;
      };
      function string() {
        const start = p++;
        while (p < content.length) {
          if (content[p] === '\\') {
            p += 2;
            continue;
          }
          if (content[p++] === '"') {
            try {
              return JSON.parse(content.slice(start, p));
            } catch {
              fail('Invalid JSON string');
            }
          }
        }
        fail('Unclosed JSON string');
      }
      function value(key, path, depth) {
        space();
        const c = content[p],
          n = make(
            key,
            c === '{' ? 'object' : c === '[' ? 'array' : c === '"' ? 'string' : 'number',
            '',
            [],
            path,
            depth
          );
        if (c === '{' || c === '[') {
          p++;
          space();
          const close = c === '{' ? '}' : ']',
            keys = new Map();
          if (content[p] === close) {
            p++;
            return n;
          }
          while (p < content.length) {
            space();
            let childKey;
            if (c === '{') {
              if (content[p] !== '"') fail('Expected a quoted field name');
              childKey = string();
              space();
              if (content[p++] !== ':') fail('Expected a colon');
              if (keys.has(childKey)) duplicates++;
              keys.set(childKey, (keys.get(childKey) || 0) + 1);
            } else childKey = String(n.children.length);
            const suffix =
              c === '{'
                ? '[' +
                  JSON.stringify(childKey) +
                  ']' +
                  (keys.get(childKey) > 1 ? '#' + keys.get(childKey) : '')
                : '[' + childKey + ']';
            n.children.push(value(childKey, path + suffix, depth + 1));
            space();
            if (content[p] === close) {
              p++;
              return n;
            }
            if (content[p++] !== ',') fail('Expected a comma or closing bracket');
          }
          fail('Unclosed JSON section');
        }
        if (c === '"') n.value = string();
        else if (content.startsWith('true', p) || content.startsWith('false', p)) {
          n.type = 'boolean';
          n.value = content.startsWith('true', p) ? 'true' : 'false';
          p += n.value.length;
        } else if (content.startsWith('null', p)) {
          n.type = 'null';
          n.value = 'null';
          p += 4;
        } else {
          const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(content.slice(p));
          if (!number) fail('Expected a JSON value');
          n.value = number[0];
          p += n.value.length; // Retain number tokens exactly, including unsafe integers.
        }
        return n;
      }
      roots = [value('Document', '$', 0)];
      space();
      if (p !== content.length) fail('Unexpected content after the JSON value');
    }
    return {
      kind,
      name: name || (kind === 'idoc' ? 'Pasted IDoc.xml' : 'Pasted data.json'),
      source,
      roots,
      nodes,
      byId,
      wrapper,
      duplicates,
      fields: nodes.filter(n => !n.children.length).length,
    };
  }
  const local = n => n.localName || n.key;
  function field(n, key) {
    return n?.children.find(c => local(c) === key)?.value.trim() || '';
  }
  function idocInfo(n) {
    const control = n.children.find(c => local(c) === 'EDI_DC40'),
      statuses = n.children.filter(c => local(c) === 'EDI_DS40');
    const status = field(control, 'STATUS'),
      matching = statuses.filter(s => field(s, 'STATUS') === status).at(-1);
    return {
      control,
      statuses,
      number: field(control, 'DOCNUM'),
      type: field(control, 'IDOCTYP'),
      message: field(control, 'MESTYP'),
      sender: field(control, 'SNDPRN'),
      receiver: field(control, 'RCVPRN'),
      status,
      statusText: field(matching, 'STATXT'),
      date: field(control, 'CREDAT'),
      time: field(control, 'CRETIM'),
    };
  }
  function hint(n) {
    const v = n.value.trim(),
      k = local(n);
    if (['CREDAT', 'LOGDAT'].includes(k) && /^\d{8}$/.test(v)) return date(v);
    if (['CRETIM', 'LOGTIM'].includes(k) && /^\d{6}$/.test(v)) return time(v);
    if (/(?:TIME|TIMESTAMP)$/.test(k) && /^\d{14}$/.test(v)) {
      const d = date(v.slice(0, 8)),
        t = time(v.slice(8));
      return d && t ? d + ', ' + t + ' · source time' : '';
    }
    return '';
  }
  function date(v) {
    if (!/^\d{8}$/.test(v) || v === '00000000') return '';
    const y = +v.slice(0, 4),
      m = +v.slice(4, 6),
      d = +v.slice(6),
      check = new Date(Date.UTC(y, m - 1, d));
    if (
      y < 100 ||
      check.getUTCFullYear() !== y ||
      check.getUTCMonth() !== m - 1 ||
      check.getUTCDate() !== d
    )
      return '';
    return (
      d +
      ' ' +
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] +
      ' ' +
      y
    );
  }
  function time(v) {
    return /^\d{6}$/.test(v) && +v.slice(0, 2) < 24 && +v.slice(2, 4) < 60 && +v.slice(4) < 60
      ? v.match(/../g).join(':')
      : '';
  }
  /** Group only siblings at this exact parent. Namespace names and repeated field occurrences remain distinct. */
  function groups(n) {
    const result = new Map();
    for (const c of n.children.filter(
      c => c.children.length || c.type === 'segment' || c.type === 'object' || c.type === 'array'
    )) {
      if (!result.has(c.key)) result.set(c.key, []);
      result.get(c.key).push(c);
    }
    return Array.from(result, ([key, records]) => ({ key, records }));
  }
  function table(records, hideEmpty = false) {
    const keys = [],
      titles = new Map(),
      rows = [],
      identities = [];
    for (const n of records) {
      const counts = new Map(),
        cells = new Map(),
        ids = new Map();
      const fields = n.children.length ? n.children : [{ ...n, key: 'Value' }];
      for (const c of fields) {
        const index = (counts.get(c.key) || 0) + 1;
        counts.set(c.key, index);
        const key = JSON.stringify([c.key, index]);
        if (!titles.has(key)) {
          titles.set(key, c.key + (index > 1 ? ' [' + index + ']' : ''));
          keys.push(key);
        }
        cells.set(key, c);
        ids.set(key, c.id);
      }
      rows.push({ record: n, cells });
      identities.push(ids);
    }
    const columns = keys.filter(
      key => !hideEmpty || rows.some(r => r.cells.has(key) && !blank(r.cells.get(key)))
    );
    return {
      columns: columns.map(key => ({ key, title: titles.get(key), original: JSON.parse(key)[0] })),
      rows,
    };
  }
  function sections(start, options = {}) {
    const out = [],
      selected = options.selected ? new Set(options.selected) : null;
    let cells = 0;
    const add = (id, title, source, columns, rows) => {
      if (selected && !selected.has(id)) return;
      cells += columns.length * rows.length;
      if (cells > LIMITS.reportCells || out.length >= 500)
        throw Error(
          'This report is too large. Select a smaller section in Explore or fewer report sections.'
        );
      out.push({ id, title, source, columns, rows });
    };
    function walk(n, depth) {
      const scalars =
        n.type === 'array'
          ? []
          : n.children.filter(
              c =>
                !c.children.length &&
                !['segment', 'array', 'object'].includes(c.type) &&
                (!options.hideEmpty || !blank(c))
            );
      if (
        !n.children.length &&
        !['array', 'object', 'segment'].includes(n.type) &&
        (!options.hideEmpty || !blank(n))
      )
        scalars.push(n);
      if (scalars.length)
        add(
          n.id,
          label(n.key, options.aliases),
          n.path,
          ['Field', 'Value', 'Type'],
          scalars.map(c => [
            (options.friendly === false ? c.key : label(local(c), options.aliases)) +
              (options.friendly === false || label(local(c), options.aliases) === c.key
                ? ''
                : ' [' + c.key + ']'),
            visibleText(c.value),
            c.type,
          ])
        );
      if (depth >= LIMITS.depth) return;
      if (n.type === 'array' && n.children.length) {
        const t = table(n.children, options.hideEmpty);
        add(
          n.id + '-rows',
          label(n.key, options.aliases),
          n.path,
          [
            'Record',
            ...t.columns.map(c =>
              options.friendly === false
                ? c.title
                : label(c.original, options.aliases) +
                  (c.title !== c.original ? c.title.slice(c.original.length) : '')
            ),
          ],
          t.rows.map((r, i) => [
            String(i + 1),
            ...t.columns.map(c =>
              r.cells.has(c.key) ? visibleText(scalar(r.cells.get(c.key))) : '[not present]'
            ),
          ])
        );
        for (const child of n.children)
          if (child.children.some(c => c.children.length)) walk(child, depth + 1);
      } else
        for (const g of groups(n)) {
          if (g.records.length > 1) {
            const t = table(g.records, options.hideEmpty);
            add(
              g.records[0].id + '-rows',
              label(local(g.records[0]), options.aliases) + ' · ' + g.records.length + ' records',
              n.path + '/' + g.key,
              [
                'Record',
                ...t.columns.map(c =>
                  options.friendly === false
                    ? c.title
                    : label(c.original, options.aliases) +
                      (c.title !== c.original ? c.title.slice(c.original.length) : '')
                ),
              ],
              t.rows.map((r, i) => [
                String(i + 1),
                ...t.columns.map(c =>
                  r.cells.has(c.key) ? visibleText(scalar(r.cells.get(c.key))) : '[not present]'
                ),
              ])
            );
            for (const record of g.records)
              if (record.children.some(c => c.children.length)) walk(record, depth + 1);
          } else walk(g.records[0], depth + 1);
        }
    }
    walk(start, 0);
    return out;
  }
  function csv(rows) {
    return (
      '\uFEFF' +
      rows
        .map(row =>
          row
            .map(v => {
              let s = String(v ?? '');
              if (/^\s*[=+@-]/.test(s)) s = "'" + s;
              return '"' + s.replace(/"/g, '""') + '"';
            })
            .join(',')
        )
        .join('\r\n')
    );
  }
  function sample(kind) {
    if (kind === 'json')
      return JSON.stringify(
        {
          project_name: 'A calmer workspace',
          owner: 'Sample user',
          active: true,
          tasks: [
            { id: '0001', title: 'Review the notes', hours: 2.5 },
            { id: '0002', title: 'Share the update', hours: 1, optional_note: '' },
          ],
          settings: { notifications: false, review_date: null },
        },
        null,
        2
      );
    return (
      '<ZDEMO_ACK><IDOC BEGIN="1"><EDI_DC40 SEGMENT="1"><DOCNUM>0000000000000042</DOCNUM><IDOCTYP>ZDEMO_ACK</IDOCTYP><MESTYP>ZDEMO_MESSAGE</MESTYP><STATUS>03</STATUS><SNDPRN>DEMO_SOURCE</SNDPRN><RCVPRN>DEMO_TARGET</RCVPRN><CREDAT>20261028</CREDAT><CRETIM>091500</CRETIM></EDI_DC40><ZDEMO_HEADER SEGMENT="1"><SERVICE_NAME><![CDATA[ DEMO_ACK_SERVICE ]]></SERVICE_NAME><STATUS>S</STATUS><MESSAGE>Sample acknowledgement received.</MESSAGE></ZDEMO_HEADER>' +
      ['0001', '0002', '0003', '0004']
        .map(
          (id, i) =>
            '<ZDEMO_ITEM SEGMENT="1"><REFERENCE_ID>DEMO.' +
            id +
            '</REFERENCE_ID><POSNR>0001</POSNR><DOC_NUMBER>' +
            (i ? '4900000002' : '4900000001') +
            '</DOC_NUMBER><STATUS>S</STATUS><NOTE>' +
            (i === 1 ? '' : 'Sample item') +
            '</NOTE></ZDEMO_ITEM>'
        )
        .join('') +
      ['01', '30', '03']
        .map(
          code =>
            '<EDI_DS40 SEGMENT="1"><STATUS>' +
            code +
            '</STATUS><LOGDAT>20261028</LOGDAT><LOGTIM>091500</LOGTIM><STATXT>' +
            (code === '03' ? 'Sample dispatch message' : 'Sample processing entry') +
            '</STATXT></EDI_DS40>'
        )
        .join('') +
      '</IDOC></ZDEMO_ACK>'
    );
  }
  root.WorkHubDataReaderEngine = {
    LIMITS,
    parse,
    label,
    blank,
    scalar,
    visibleText,
    idocInfo,
    field,
    local,
    hint,
    date,
    time,
    groups,
    table,
    sections,
    csv,
    sample,
  };
})(window);
