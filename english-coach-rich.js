/* Workshop-safe rich text and clipboard formats for English Coach. */
(function (root) {
  'use strict';

  const allowed = new Set(
    'p div br b strong i em span font ul ol li table thead tbody tfoot tr th td'.split(' ')
  );
  const unwrap = new Set(
    'a u s strike small big mark blockquote pre code section article h1 h2 h3 h4 h5 h6'.split(' ')
  );
  const unsafe = new Set(
    'script style iframe object embed svg math template noscript textarea'.split(' ')
  );
  const block = new Set('p div ol ul li table thead tbody tfoot tr th td'.split(' '));
  const clipboardStyles = {
    p: 'margin:0 0 0.6em;',
    li: 'margin:0.15em 0;',
    table: 'border-collapse:collapse;margin:0.6em 0;',
    th: 'border:1px solid #94a3b8;padding:6px 9px;text-align:left;',
    td: 'border:1px solid #94a3b8;padding:6px 9px;',
  };

  function sanitize(doc, html, clipboard = false) {
    const source = doc.createElement('template'),
      result = doc.createElement('div');
    source.innerHTML = html.slice(0, 160000);
    const color = doc.createElement('span').style;
    let textLength = 0,
      nodes = 0;
    function copy(node, target, depth) {
      if (depth > 36 || ++nodes > 6000) return;
      if (node.nodeType === 3) {
        const value = node.data.slice(
          0,
          Math.max(0, root.WorkHubEnglishCoachEngine.maxText - textLength)
        );
        textLength += value.length;
        target.append(doc.createTextNode(value));
        return;
      }
      if (node.nodeType !== 1 || unsafe.has(node.localName)) return;
      const name = node.localName;
      let next = target;
      if (allowed.has(name) || (unwrap.has(name) && node.style?.color)) {
        const tag =
          { font: 'span', b: 'strong', i: 'em' }[name] || (allowed.has(name) ? name : 'span');
        next = doc.createElement(tag);
        if (clipboard && clipboardStyles[tag]) next.style.cssText = clipboardStyles[tag];
        for (const key of ['color', 'backgroundColor']) {
          color[key] = '';
          color[key] =
            node.style?.[key] ||
            (name === 'font' && key === 'color' ? node.getAttribute('color') || '' : '');
          const valid = color[key];
          if (/^(?:#[0-9a-f]{3,8}|rgba?\([\d.,% /]+\)|[a-z]{3,25})$/i.test(valid))
            next.style[key] = valid;
        }
        if (node.style?.fontWeight === 'bold' || Number(node.style?.fontWeight) >= 600)
          next.style.fontWeight = 'bold';
        if (node.style?.fontStyle === 'italic') next.style.fontStyle = 'italic';
        target.append(next);
      } else if (
        unwrap.has(name) &&
        block.has(target.localName) &&
        /^h[1-6]$|^blockquote$/.test(name)
      ) {
        next = doc.createElement('p');
        target.append(next);
      }
      for (const child of node.childNodes) copy(child, next, depth + 1);
    }
    for (const child of source.content.childNodes) copy(child, result, 0);
    return result.innerHTML;
  }

  // Keep a map to text nodes so suggestions can select the original words across formatting spans.
  function linear(editor) {
    let text = '';
    const pieces = [];
    function newline() {
      if (text && !text.endsWith('\n')) text += '\n';
    }
    function visit(node) {
      if (node.nodeType === 3) {
        pieces.push({ node, start: text.length, end: text.length + node.data.length });
        text += node.data;
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.localName;
      if (tag === 'br') {
        text += '\n';
        return;
      }
      if (block.has(tag) && tag !== 'td' && tag !== 'th') newline();
      for (const child of node.childNodes) visit(child);
      if (tag === 'td' || tag === 'th') {
        if (node.nextElementSibling) text += '\t';
      } else if (block.has(tag)) newline();
    }
    for (const node of editor.childNodes) visit(node);
    return { text, pieces };
  }

  function range(doc, pieces, issue) {
    const first = pieces.find(part => issue.start >= part.start && issue.start < part.end);
    const last = pieces.find(part => issue.end > part.start && issue.end <= part.end);
    if (!first || !last) return null;
    const value = doc.createRange();
    value.setStart(first.node, issue.start - first.start);
    value.setEnd(last.node, issue.end - last.start);
    return value;
  }

  function plainText(editor) {
    const lines = [];
    let line = '';
    const flush = (force = false) => {
      if (line || force) lines.push(line);
      line = '';
    };
    function walk(node, depth = 0) {
      if (node.nodeType === 3) {
        line += node.data.replaceAll('\u00a0', ' ');
        return;
      }
      if (node.nodeType !== 1) return;
      const name = node.localName;
      if (name === 'br') {
        flush(true);
        return;
      }
      if (name === 'table') {
        flush();
        for (const row of node.rows)
          lines.push(
            [...row.cells]
              .map(cell =>
                linear(cell)
                  .text.trim()
                  .replace(/\s*\n\s*/g, ' ')
              )
              .join('\t')
          );
        return;
      }
      if (name === 'ul' || name === 'ol') {
        flush();
        let index = 0;
        for (const child of node.children) {
          if (child.localName !== 'li') continue;
          line = '  '.repeat(depth) + (name === 'ul' ? '• ' : ++index + '. ');
          for (const value of child.childNodes) walk(value, depth + 1);
          flush();
        }
        return;
      }
      if (block.has(name)) flush();
      for (const child of node.childNodes) walk(child, depth);
      if (block.has(name)) flush();
    }
    for (const child of editor.childNodes) walk(child);
    flush();
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    const start = lines.findIndex(line => line.trim());
    return start < 0 ? '' : lines.slice(start).join('\n');
  }

  function tableHTML(rows, columns) {
    const row = tag => `<tr>${`<${tag}><br></${tag}>`.repeat(columns)}</tr>`;
    return `<table><thead>${row('th')}</thead><tbody>${row('td').repeat(rows - 1)}</tbody></table><p><br></p>`;
  }

  root.WorkHubEnglishCoachRichText = { sanitize, linear, range, plainText, tableHTML };
})(globalThis);
