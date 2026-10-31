/** Strict BIFF5/BIFF8 value adapter. Runs only inside the Excel-to-CSV worker. */
(function (root) {
  'use strict';
  const F = root.WorkHubValidatorFiles,
    L = F.CSV_LIMITS;
  const errors = Object.freeze({
    0: '#NULL!',
    7: '#DIV/0!',
    15: '#VALUE!',
    23: '#REF!',
    29: '#NAME?',
    36: '#NUM!',
    42: '#N/A',
    43: '#GETTING_DATA',
  });
  const need = (condition, message) => {
    if (!condition) throw Error(message);
  };
  const invalid =
    'The XLS workbook is incomplete or has an unsupported structure. No data was removed.';

  // Check the original BIFF records before asking the library for cell objects.
  // This catches records that a value-oriented parser could otherwise skip.
  function audit(stream) {
    const bytes = new Uint8Array(stream),
      view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      bounds = [],
      xfs = [],
      custom = new Set(),
      sheets = new Map(),
      stack = [];
    let p = 0,
      current = null,
      pending = null,
      gridCells = 0,
      records = 0;
    const u16 = at => view.getUint16(at, true),
      u32 = at => view.getUint32(at, true);
    function point(r, c, style, flag = 1) {
      need(
        r < L.rows && c < L.columns,
        'Keep up to 25,001 worksheet rows and 1,000 columns. No data was removed.'
      );
      need(Number.isInteger(style) && style >= 0, invalid);
      const s = current;
      if (!s.flags[r]) {
        s.flags[r] = new Uint8Array(256);
        s.styles[r] = new Uint16Array(256);
      }
      need(
        c < 256 && !s.flags[r][c],
        'The XLS workbook contains an invalid or duplicate cell address.'
      );
      s.flags[r][c] = flag;
      s.styles[r][c] = style;
      s.height = Math.max(s.height, r + 1);
      s.width = Math.max(s.width, c + 1);
      need(++s.cells <= L.cells, 'The XLS workbook exceeds 6,000,000 cells. No data was removed.');
    }
    while (p < bytes.length) {
      if (!stack.length && bytes[p] === 0 && bytes[p + 1] === 0) {
        need(
          bytes.subarray(p).every(v => v === 0),
          invalid
        );
        break;
      }
      need(p + 4 <= bytes.length && ++records <= 10000000, invalid);
      const start = p,
        type = u16(p),
        size = u16(p + 2),
        end = p + 4 + size;
      p += 4;
      need(end <= bytes.length, invalid);
      if (type === 0x0809) {
        need(
          size >= 4 && [0x0500, 0x0600].includes(u16(p)),
          'This XLS version is unsupported. Save it as an Excel 97–2003 XLS or XLSX workbook and retry.'
        );
        const kind = u16(p + 2);
        if (!stack.length && kind === 0x0010) {
          current = {
            offset: start,
            height: 0,
            width: 0,
            cells: 0,
            flags: [],
            styles: [],
            formulas: [],
            ranges: [],
          };
          sheets.set(start, current);
        } else if (!stack.length)
          need(
            kind === 0x0005,
            'The XLS file contains an unsupported sheet type. Save a copy with data worksheets and retry.'
          );
        stack.push(kind);
      } else if (type === 0x000a) {
        need(
          stack.length && !pending,
          'An XLS formula has no saved string result. Recalculate and save the workbook in Excel, then retry.'
        );
        stack.pop();
        if (!stack.length) current = null;
      } else {
        need(stack.length, invalid);
        if (type === 0x002f)
          throw Error(
            'The XLS workbook is password-protected. Save an unencrypted copy in Excel before converting.'
          );
        if ([0x01b0, 0x01b1, 0x0879, 0x087a, 0x087b, 0x08c4].includes(type))
          throw Error(
            'The XLS workbook uses conditional formatting that may change displayed values. Use regular number formats in an Excel copy before converting.'
          );
        if (type === 0x0085) {
          need(
            size >= 7 && bytes[p + 5] === 0 && bytes[p + 4] <= 2,
            'The XLS workbook contains an unsupported chart or macro sheet. Save a copy with data worksheets and retry.'
          );
          bounds.push({ offset: u32(p), hidden: bytes[p + 4] });
        }
        if (type === 0x00e0) {
          need(size >= 4, invalid);
          xfs.push(u16(p + 2));
        }
        if (type === 0x041e) {
          need(size >= 2, invalid);
          custom.add(u16(p));
        }
        if (current && stack.length === 1) {
          if (type === 0x0208) {
            need(
              size >= 2 && u16(p) < L.rows,
              'Keep up to 25,001 worksheet rows. No rows were removed.'
            );
            current.height = Math.max(current.height, u16(p) + 1);
          }
          const single = [0x0201, 0x0203, 0x0204, 0x0205, 0x027e, 0x00fd, 0x00d6, 0x0006].includes(
            type
          );
          if (single || type === 0x00bd || type === 0x00be) {
            need(
              !pending,
              'An XLS formula has no saved string result. Recalculate and save the workbook in Excel, then retry.'
            );
            need(size >= 6, invalid);
            const r = u16(p),
              c = u16(p + 2);
            if (single) point(r, c, u16(p + 4), type === 0x0201 ? 2 : 1);
            else {
              const last = u16(end - 2),
                stride = type === 0x00bd ? 6 : 2;
              need(last >= c && size === 6 + (last - c + 1) * stride, invalid);
              for (let x = c; x <= last; x++)
                point(r, x, u16(p + 4 + (x - c) * stride), type === 0x00be ? 2 : 1);
            }
            if (type === 0x0006) {
              need(size >= 22, invalid);
              const formula = { r, c, type: 'n', value: view.getFloat64(p + 6, true) };
              if (u16(p + 12) === 0xffff) {
                const tag = bytes[p + 6];
                need(tag <= 3, invalid);
                formula.type = ['s', 'b', 'e', 's'][tag];
                formula.value = tag === 1 ? bytes[p + 8] !== 0 : tag === 2 ? bytes[p + 8] : '';
                if (tag === 0) {
                  formula.string = true;
                  pending = formula;
                }
                if (tag === 1) need(bytes[p + 8] <= 1, invalid);
              } else
                need(
                  Number.isFinite(formula.value),
                  'An XLS formula has no readable saved result. Recalculate and save in Excel, then retry.'
                );
              current.formulas.push(formula);
            }
          }
          if (type === 0x0207) {
            need(pending && size >= 3, invalid);
            pending = null;
          }
          if (type === 0x0221 || type === 0x04bc) {
            need(size >= 6, invalid);
            const range = { r1: u16(p), r2: u16(p + 2), c1: bytes[p + 4], c2: bytes[p + 5] };
            need(range.r1 <= range.r2 && range.c1 <= range.c2 && range.r2 < L.rows, invalid);
            current.ranges.push(range);
          }
        }
      }
      p = end;
    }
    need(!stack.length && !pending && bounds.length && bounds.length === sheets.size, invalid);
    need(
      new Set(bounds.map(b => b.offset)).size === bounds.length &&
        bounds.every(b => sheets.has(b.offset)),
      invalid
    );
    for (const s of sheets.values()) {
      if (s.height && !s.width) s.width = 1;
      gridCells += s.height * s.width;
      need(
        gridCells <= L.cells,
        'The workbook used ranges exceed 6,000,000 conversion cells. No data was removed.'
      );
    }
    return { bounds, sheets, xfs, custom };
  }

  function read(buffer) {
    const X = root.XLSX;
    need(X?.version === '0.20.3', 'Refresh the page to load the XLS reader.');
    const bytes = new Uint8Array(buffer);
    need(bytes.length && bytes.length <= L.fileBytes, 'Choose an Excel workbook below 50 MB.');
    let stream = bytes;
    if (bytes[0] === 0xd0 && bytes[1] === 0xcf) {
      const cfb = X.CFB.read(bytes, { type: 'array' });
      need(cfb.FileIndex.length <= 1000, 'The XLS workbook contains too many sections.');
      const entry = X.CFB.find(cfb, '/Workbook') || X.CFB.find(cfb, '/Book');
      need(
        entry?.content && entry.size === entry.content.length,
        'No complete Excel workbook stream was found in the XLS file.'
      );
      stream = entry.content;
    } else
      need(
        bytes[0] === 0x09 && bytes[1] === 0x08,
        'This .xls file is not a binary Excel workbook. Open it in Excel and save as Excel 97–2003 XLS or XLSX, then retry.'
      );
    const checked = audit(stream);
    const wb = X.read(bytes, {
      type: 'array',
      dense: true,
      cellNF: true,
      cellText: false,
      cellStyles: true,
      cellFormula: false,
      cellDates: false,
      cellHTML: false,
      sheetStubs: true,
      bookVBA: false,
      WTF: true,
    });
    need(wb.SheetNames.length === checked.bounds.length && !wb.Encryption, invalid);
    const physical = checked.bounds.slice().sort((a, b) => a.offset - b.offset),
      mapping = new Map(physical.map((b, i) => [b.offset, wb.SheetNames[i]])),
      output = [];
    let totalText = 0;
    for (const bound of checked.bounds) {
      const name = mapping.get(bound.offset),
        sheet = wb.Sheets[name],
        info = checked.sheets.get(bound.offset),
        data = sheet?.['!data'];
      need(
        sheet && (!info.cells || data),
        'The XLS worksheet “' + name + '” could not be read completely.'
      );
      const notes = {
        formulas: info.formulas.length,
        errors: 0,
        localeFormats: false,
        hiddenRows: (sheet['!rows'] || []).filter(r => r?.hidden).length,
        hiddenColumns: (sheet['!cols'] || []).filter(c => c?.hidden).length,
        mergedRanges: (sheet['!merges'] || []).length,
      };
      for (const formula of info.formulas) {
        const cell = data?.[formula.r]?.[formula.c],
          location = name + '!' + F.col(formula.c) + (formula.r + 1);
        need(
          cell &&
            cell.t === formula.type &&
            cell.v != null &&
            (formula.string || cell.v === formula.value),
          location +
            ' has no reliable saved formula result. Recalculate and save in Excel, then retry.'
        );
      }
      let formulaArea = 0;
      for (const range of info.ranges) {
        formulaArea += (range.r2 - range.r1 + 1) * (range.c2 - range.c1 + 1);
        need(formulaArea <= L.cells, 'XLS formula ranges exceed the conversion limits.');
        for (let r = range.r1; r <= range.r2; r++)
          for (let c = range.c1; c <= range.c2; c++)
            need(
              data?.[r]?.[c] && data[r][c].t !== 'z' && data[r][c].v != null,
              name +
                '!' +
                F.col(c) +
                (r + 1) +
                ' is in a formula range without a saved result. Recalculate and save in Excel, then retry.'
            );
      }
      // The library must not introduce or silently skip source value cells.
      for (const r of Object.keys(data || []))
        for (const c of Object.keys(data[r] || [])) {
          const cell = data[r][c];
          if (cell && cell.t !== 'z')
            need(
              info.flags[r]?.[c],
              'The XLS reader found an unverified cell at ' +
                name +
                '!' +
                F.col(+c) +
                (+r + 1) +
                '.'
            );
        }
      const rows = Array.from({ length: info.height }, (_, r) =>
        Array.from({ length: info.width }, (_, c) => {
          if (!info.flags[r]?.[c]) return '';
          const cell = data?.[r]?.[c],
            location = name + '!' + F.col(c) + (r + 1);
          need(cell, location + ' could not be read. No data was removed.');
          if (cell.t === 'z') {
            need(info.flags[r][c] === 2, location + ' has an unreadable saved value.');
            return '';
          }
          need(
            ['s', 'n', 'b', 'e'].includes(cell.t) && cell.v != null,
            location + ' has an unsupported value.'
          );
          const fmtId = checked.xfs[info.styles[r][c]];
          need(Number.isInteger(fmtId), location + ' has an invalid cell format.');
          const format = checked.custom.has(fmtId) ? wb.SSF?.[fmtId] : '';
          need(
            !checked.custom.has(fmtId) || typeof format === 'string',
            location + ' has a missing number format.'
          );
          need(
            !format || format.length <= 2048,
            location + ' has an excessively long number format.'
          );
          const raw =
            cell.t === 'e'
              ? errors[cell.v]
              : cell.t === 'b'
                ? cell.v
                  ? '1'
                  : '0'
                : String(cell.v);
          need(
            raw !== undefined && (cell.t !== 'n' || Number.isFinite(cell.v)),
            location + ' has an invalid saved value.'
          );
          const value = F.formatDisplayedValue(
            raw,
            cell.t === 's' ? 'str' : cell.t,
            raw,
            fmtId,
            format || '',
            !!wb.Workbook?.WBProps?.date1904,
            location,
            notes
          );
          need(
            value.length <= 32000 && (totalText += value.length) <= L.text,
            'XLS displayed values exceed the text conversion limits. No data was removed.'
          );
          return value;
        })
      );
      output.push({
        name,
        rows,
        width: info.width,
        rowCount: info.height,
        state: bound.hidden === 2 ? 'veryHidden' : bound.hidden ? 'hidden' : 'visible',
        notes,
      });
    }
    return { sheets: output };
  }
  root.WorkHubValidatorXLSEngine = Object.freeze({ read });
})(self);
