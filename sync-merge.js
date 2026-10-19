/**
 * sync-merge.js
 * Three-way conflict merging for private cloud record documents.
 * Inputs: last shared document, local edits and remote edits. Output: merged data plus conflicts.
 * Keep unresolved edits visible for review; do not silently choose an account record winner.
 * File map: docs/FILE-MAP.md
 */
/* Conservative three-way merging: unchanged fields follow the cloud;
   independent record edits combine; competing edits remain for review. */
(function (root) {
  'use strict';
  const missing = Symbol('missing');
  function stable(value) {
    if (value === undefined || value === missing) return 'undefined';
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object')
      return (
        '{' +
        Object.keys(value)
          .sort()
          .map(key => JSON.stringify(key) + ':' + stable(value[key]))
          .join(',') +
        '}'
      );
    return JSON.stringify(value);
  }
  const equal = (a, b) => stable(a) === stable(b);
  function recordData(document) {
    const data = JSON.parse(JSON.stringify(document?.data || {}));
    delete data.calendarMonth;
    delete data.activeProjectId;
    return data;
  }
  function sameRecords(a, b) {
    return equal(recordData(a), recordData(b));
  }
  function merge(base, local, remote) {
    const conflicts = [];
    function combine(b, l, r, path) {
      if (equal(l, b)) return r;
      if (equal(r, b) || equal(l, r)) return l;
      if (l === missing || r === missing || b === missing) {
        conflicts.push(path);
        return l;
      }
      if (Array.isArray(b) && Array.isArray(l) && Array.isArray(r)) {
        const all = [...b, ...l, ...r];
        const key = all.every(x => x && typeof x === 'object' && typeof x.id === 'string')
          ? x => x.id
          : path === 'schedule' && all.every(x => x?.date && x?.time)
            ? x => x.date + '|' + x.time
            : null;
        if (key && [b, l, r].every(a => new Set(a.map(key)).size === a.length)) {
          const maps = [b, l, r].map(a => new Map(a.map(x => [key(x), x]))),
            order = [...new Set([...r, ...l].map(key))],
            out = [];
          for (const id of order) {
            const v = combine(
              ...maps.map(m => (m.has(id) ? m.get(id) : missing)),
              path + '[' + id + ']'
            );
            if (v !== missing) out.push(v);
          }
          return out;
        }
      }
      if (b && l && r && ![b, l, r].some(x => Array.isArray(x) || typeof x !== 'object')) {
        const out = {};
        for (const k of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
          const v = combine(
            ...[b, l, r].map(x => (Object.hasOwn(x, k) ? x[k] : missing)),
            path ? path + '.' + k : k
          );
          if (v !== missing) out[k] = v;
        }
        return out;
      }
      conflicts.push(path);
      return l;
    }
    const data = combine(recordData(base), recordData(local), recordData(remote), '');
    return {
      data: {
        ...data,
        calendarMonth: local.data.calendarMonth,
        activeProjectId: local.data.activeProjectId,
      },
      conflicts,
    };
  }
  root.MMTrackerMerge = { stable, equal, sameRecords, merge };
})(window);
