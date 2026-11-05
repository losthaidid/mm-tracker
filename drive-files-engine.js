/* Google Drive metadata only. File bytes and OAuth tokens never enter the workspace document. */
(function (root) {
  'use strict';
  const MAX_FILES = 2000,
    MAX_BYTES = 50 * 1024 * 1024;
  const sourceKinds = ['tasks', 'tickets', 'specs', 'processhub', 'waiting'];
  const copy = v => JSON.parse(JSON.stringify(v));
  const text = (v, n = 500) =>
    typeof v === 'string' && v.length <= n && !/[\u0000-\u001f\u007f]/.test(v);
  const id = v => text(v, 160) && /^[a-zA-Z0-9_-]+$/.test(v);
  function clientId(v) {
    return (
      v === '' || (text(v, 250) && /^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(v))
    );
  }
  function url(v) {
    try {
      const u = new URL(v);
      return u.protocol === 'https:' &&
        !u.username &&
        !u.password &&
        !u.port &&
        ['drive.google.com', 'drive.usercontent.google.com', 'docs.google.com'].includes(
          u.hostname
        ) &&
        !/[?&](access_token|id_token|token)=/i.test(v) &&
        text(v, 3000)
        ? u.href
        : '';
    } catch {
      return '';
    }
  }
  function upgrade(d) {
    if (d?.workhub && d.workhub.driveFiles === undefined)
      d.workhub.driveFiles = { version: 1, clientId: '', files: [] };
    return d;
  }
  function validate(d) {
    const h = d.workhub?.driveFiles;
    if (h === undefined) return;
    if (
      !h ||
      Array.isArray(h) ||
      h.version !== 1 ||
      !clientId(h.clientId) ||
      Object.keys(h).some(k => !['version', 'clientId', 'files'].includes(k)) ||
      !Array.isArray(h.files) ||
      h.files.length > MAX_FILES
    )
      throw Error('Check the Google Drive setup and file list (up to 2,000 files).');
    const seen = new Set();
    for (const f of h.files) {
      if (
        !f ||
        !id(f.id) ||
        seen.has(f.id) ||
        !text(f.name, 255) ||
        !f.name.trim() ||
        !text(f.mimeType, 160) ||
        !Number.isSafeInteger(f.size) ||
        f.size < 0 ||
        !text(f.createdAt, 50) ||
        !Number.isFinite(Date.parse(f.createdAt)) ||
        !id(f.googleUserId) ||
        !['upload', 'process', 'handover'].includes(f.sourceType) ||
        !url(f.webViewLink) ||
        (f.webContentLink !== '' && !url(f.webContentLink)) ||
        !text(f.projectId, 100) ||
        !text(f.scope, 50) ||
        (f.managedShareId !== '' && !id(f.managedShareId)) ||
        Object.keys(f).some(
          k =>
            ![
              'id',
              'name',
              'mimeType',
              'size',
              'createdAt',
              'googleUserId',
              'sourceType',
              'source',
              'projectId',
              'scope',
              'webViewLink',
              'webContentLink',
              'managedShareId',
            ].includes(k)
        ) ||
        (f.source !== null &&
          (!f.source ||
            !sourceKinds.includes(f.source.kind) ||
            !text(f.source.id, 100) ||
            Object.keys(f.source).some(k => !['kind', 'id'].includes(k))))
      )
        throw Error(
          'Check the Google Drive file details. Only file metadata and Drive links can be saved.'
        );
      seen.add(f.id);
    }
    if (new TextEncoder().encode(JSON.stringify(h)).length > 3 * 1024 * 1024)
      throw Error('The file list is full. File contents stay in Drive.');
  }
  function metadata(f, googleUserId) {
    const p = f.appProperties || {};
    const result = {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType || 'application/octet-stream',
      size: Number(f.size || 0),
      createdAt: f.createdTime,
      googleUserId,
      sourceType: ['process', 'handover'].includes(p.sourceType) ? p.sourceType : 'upload',
      source:
        sourceKinds.includes(p.sourceKind) && p.sourceId
          ? { kind: p.sourceKind, id: p.sourceId }
          : null,
      projectId: p.projectId || '',
      scope: p.scope || '',
      webViewLink: url(f.webViewLink),
      webContentLink: url(f.webContentLink) || '',
      managedShareId: '',
    };
    validate({ workhub: { driveFiles: { version: 1, clientId: '', files: [result] } } });
    return result;
  }
  function merge(current, incoming) {
    const next = copy(current),
      byId = new Map(next.files.map(f => [f.id, f]));
    for (const f of incoming)
      byId.set(f.id, { ...f, managedShareId: byId.get(f.id)?.managedShareId || '' });
    next.files = [...byId.values()];
    validate({ workhub: { driveFiles: next } });
    return next;
  }
  function size(n) {
    return n >= 1048576
      ? (n / 1048576).toFixed(1) + ' MB'
      : n >= 1024
        ? (n / 1024).toFixed(1) + ' KB'
        : n + ' B';
  }
  root.WorkHubDriveFilesEngine = {
    MAX_FILES,
    MAX_BYTES,
    sourceKinds,
    copy,
    clientId,
    url,
    id,
    upgrade,
    validate,
    metadata,
    merge,
    size,
  };
})(globalThis);
