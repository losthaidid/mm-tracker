(function learningCore(root) {
  'use strict';
  const escape = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  function asset(file) {
    let data,
      pending,
      failure = false;
    function load(refresh) {
      if (data || pending || failure) return;
      pending = Promise.resolve()
        .then(() =>
          root.fetch('./learning/' + file + '?v=20261123-1', { credentials: 'same-origin' })
        )
        .then(response => {
          if (!response.ok) throw Error('Could not load learning content.');
          return response.json();
        })
        .then(value => {
          if (!Array.isArray(value) || !value.length) throw Error('Invalid learning content.');
          data = value;
        })
        .catch(() => {
          failure = true;
        })
        .finally(() => {
          pending = null;
          refresh();
        });
    }
    return {
      get rows() {
        return data || [];
      },
      get loaded() {
        return !!data;
      },
      get failed() {
        return failure;
      },
      load,
      retry(refresh) {
        failure = false;
        load(refresh);
      },
    };
  }
  const option = (value, label, current) =>
    `<option value="${escape(value)}"${value === current ? ' selected' : ''}>${escape(label)}</option>`;
  const button = (attr, action, label, id = '', extra = '') =>
    `<button type="button" data-${attr}="${escape(action)}" data-id="${escape(id)}" ${extra}>${escape(label)}</button>`;
  const references = rows =>
    `<ul class="learn-refs">${rows.map(([label, href]) => `<li><a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a></li>`).join('')}</ul>`;
  function matrix(title, headers, rows) {
    return `<div class="learn-table"><table><caption>${escape(title)}</caption><thead><tr>${headers.map(h => `<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => (i ? `<td>${escape(cell)}</td>` : `<th scope="row">${escape(cell)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  root.WorkHubLearning = Object.freeze({ escape, asset, option, button, references, matrix });
})(globalThis);
