/* Browser-only Drive transport. OAuth bearer tokens live only inside this closure. */
(function (root) {
  'use strict';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FIELDS =
    'id,name,mimeType,size,createdTime,webViewLink,webContentLink,resourceKey,appProperties,ownedByMe,trashed,capabilities(canShare,canDownload)';
  let scriptPromise;
  function load() {
    if (root.google?.accounts?.oauth2) return Promise.resolve();
    if (!scriptPromise)
      scriptPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        const timer = setTimeout(() => {
          s.remove();
          scriptPromise = null;
          reject(Error('Google did not load. Check your connection and try again.'));
        }, 20000);
        s.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        s.onerror = () => {
          clearTimeout(timer);
          s.remove();
          scriptPromise = null;
          reject(Error('Google could not load. Allow accounts.google.com and try again.'));
        };
        document.head.append(s);
      });
    return scriptPromise;
  }
  function create(a, env = {}) {
    const E = root.WorkHubDriveFilesEngine,
      request = env.fetch || ((...args) => root.fetch(...args));
    let token = '',
      expires = 0,
      identity = null,
      folder = '',
      generation = 0,
      account = '',
      controllers = new Set();
    const owner = () => a.owner();
    function clear() {
      generation++;
      token = '';
      expires = 0;
      identity = null;
      folder = '';
      account = '';
      for (const c of controllers) c.abort();
      controllers.clear();
    }
    function sync() {
      if (account && account !== owner()) clear();
    }
    function check(g) {
      sync();
      if (g !== generation || !a.ready() || !account || account !== owner())
        throw Error('Account changed. Reconnect Google Drive.');
      if (!token || Date.now() >= expires)
        throw Error('Your Google connection has expired. Select Connect Google Drive again.');
    }
    function connected() {
      sync();
      return !!(token && Date.now() < expires && identity && account === owner());
    }
    async function api(path, options = {}, g = generation, upload = false) {
      check(g);
      if (!/^\/(?:files|permissions|about)(?:[/?]|$)/.test(path))
        throw Error('Unsupported Drive request.');
      const c = new AbortController();
      controllers.add(c);
      const timer = setTimeout(() => c.abort(), upload ? 180000 : 30000);
      try {
        const res = await request(
          (upload
            ? 'https://www.googleapis.com/upload/drive/v3'
            : 'https://www.googleapis.com/drive/v3') + path,
          {
            ...options,
            redirect: 'error',
            signal: c.signal,
            headers: { ...options.headers, Authorization: 'Bearer ' + token },
          }
        );
        check(g);
        if (!res.ok) {
          if (res.status === 401) {
            token = '';
            expires = 0;
            throw Error('Your Google connection has expired. Connect again.');
          }
          if (res.status === 403)
            throw Error(
              'Google Drive denied this action. Check your file permissions, storage quota or Workspace sharing policy.'
            );
          if (res.status === 404)
            throw Error(
              'This file is unavailable in this Google account. It may have been removed or created with another Google client.'
            );
          throw Error(
            'Google Drive could not finish (' +
              res.status +
              '). Refresh Drive to check before trying again.'
          );
        }
        if (res.status === 204) return null;
        const value = await res.json();
        check(g);
        return value;
      } catch (e) {
        if (e.name === 'AbortError')
          throw Error(
            'The Drive request stopped or timed out. Refresh Drive to check the result before retrying.'
          );
        throw e;
      } finally {
        clearTimeout(timer);
        controllers.delete(c);
      }
    }
    async function connect(clientId) {
      if (!E.clientId(clientId) || !clientId)
        throw Error('Add your Google Web client ID in Settings first.');
      clear();
      account = owner();
      const g = generation;
      if (!account || !a.ready()) throw Error('Sign in to WorkHub first.');
      await (env.load || load)();
      if (g !== generation || account !== owner() || !a.ready()) throw Error('Account changed.');
      const oauth = env.oauth || root.google.accounts.oauth2;
      // The library is prepared by an earlier explicit click. Reconnect calls execute the popup in that click.
      const response = await new Promise((resolve, reject) => {
        const client = oauth.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          include_granted_scopes: false,
          callback: r =>
            r.error
              ? reject(Error('Google connection was not approved. Try again when ready.'))
              : resolve(r),
          error_callback: () =>
            reject(
              Error('The Google popup was closed or blocked. Allow popups and connect again.')
            ),
        });
        client.requestAccessToken({ prompt: 'select_account' });
      });
      if (g !== generation || account !== owner() || !a.ready()) throw Error('Account changed.');
      if (!response.access_token || (response.scope && !response.scope.split(' ').includes(SCOPE)))
        throw Error('Google Drive file access was not granted.');
      token = response.access_token;
      expires = Date.now() + Math.max(1, Number(response.expires_in || 3600) - 60) * 1000;
      try {
        const about = await api('/about?fields=user(permissionId,emailAddress,displayName)', {}, g);
        check(g);
        if (!E.id(about.user?.permissionId))
          throw Error('Could not identify this Google Drive account.');
        identity = {
          id: about.user.permissionId,
          email: about.user.emailAddress || '',
          name: about.user.displayName || '',
        };
        return { ...identity };
      } catch (e) {
        if (g === generation) clear();
        throw e;
      }
    }
    async function disconnect() {
      const previous = token;
      clear();
      if (previous && root.google?.accounts?.oauth2)
        await new Promise(resolve => {
          const timer = setTimeout(resolve, 5000);
          root.google.accounts.oauth2.revoke(previous, () => {
            clearTimeout(timer);
            resolve();
          });
        });
    }
    const quote = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    function filter() {
      return (
        "trashed=false and appProperties has { key='workhubOwner' and value='" +
        quote(account) +
        "' }"
      );
    }
    async function list() {
      const g = generation,
        out = [],
        seen = new Set();
      let page = '';
      do {
        if (seen.has(page) || seen.size >= 100)
          throw Error('Google returned an incomplete file list. Refresh Drive again later.');
        seen.add(page);
        const r = await api(
          '/files?' +
            new URLSearchParams({
              q: filter() + " and mimeType!='application/vnd.google-apps.folder'",
              fields: 'nextPageToken,files(' + FIELDS + ')',
              pageSize: '100',
              ...(page ? { pageToken: page } : {}),
            }),
          {},
          g
        );
        check(g);
        for (const f of r.files || [])
          if (f.ownedByMe && f.appProperties?.workhubOwner === account) out.push(f);
        if (out.length > E.MAX_FILES)
          throw Error(
            'The Drive library exceeds 2,000 files. Open Google Drive to manage older files.'
          );
        page = r.nextPageToken || '';
      } while (page);
      return out;
    }
    async function ensureFolder(g) {
      if (folder) return folder;
      const r = await api(
        '/files?' +
          new URLSearchParams({
            q: filter() + " and mimeType='application/vnd.google-apps.folder'",
            fields: 'files(id,ownedByMe)',
            pageSize: '100',
          }),
        {},
        g
      );
      check(g);
      folder = (r.files || []).find(f => f.ownedByMe)?.id || '';
      if (!folder) {
        const f = await api(
          '/files?fields=id',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'My WorkHub files',
              mimeType: 'application/vnd.google-apps.folder',
              appProperties: { workhubOwner: account },
            }),
          },
          g
        );
        check(g);
        folder = f.id;
      }
      if (!E.id(folder)) throw Error('Could not create the WorkHub folder.');
      return folder;
    }
    async function get(id, g = generation) {
      if (!E.id(id)) throw Error('Invalid Drive file.');
      const f = await api('/files/' + id + '?fields=' + encodeURIComponent(FIELDS), {}, g);
      check(g);
      if (!f.ownedByMe || f.trashed || f.appProperties?.workhubOwner !== account)
        throw Error('This is not an available WorkHub file owned by the connected Google account.');
      return f;
    }
    async function upload(blob, name, context = {}) {
      const g = generation;
      check(g);
      if (
        !blob ||
        !Number.isSafeInteger(blob.size) ||
        blob.size < 1 ||
        blob.size > E.MAX_BYTES ||
        typeof blob.arrayBuffer !== 'function'
      )
        throw Error('Choose a non-empty file up to 50 MB.');
      if (
        typeof name !== 'string' ||
        !name.trim() ||
        name.length > 255 ||
        /[\u0000-\u001f\u007f]/.test(name)
      )
        throw Error('Use a file name up to 255 characters.');
      const parent = await ensureFolder(g),
        ids = await api('/files/generateIds?count=1&space=drive&type=files', {}, g);
      check(g);
      const fileId = ids.ids?.[0];
      if (!E.id(fileId)) throw Error('Could not prepare the Drive upload.');
      const props = { workhubOwner: account, sourceType: context.sourceType || 'upload' };
      if (context.source) {
        props.sourceKind = context.source.kind;
        props.sourceId = context.source.id;
      }
      if (context.projectId) props.projectId = context.projectId;
      if (context.scope) props.scope = context.scope;
      const metadata = {
        id: fileId,
        name,
        mimeType: blob.type || 'application/octet-stream',
        parents: [parent],
        appProperties: props,
      };
      const boundary = 'workhub_' + fileId;
      const body = new Blob([
        '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(metadata),
        '\r\n--' + boundary + '\r\nContent-Type: ' + metadata.mimeType + '\r\n\r\n',
        blob,
        '\r\n--' + boundary + '--\r\n',
      ]);
      let result;
      try {
        result = await api(
          '/files?uploadType=multipart&fields=' + encodeURIComponent(FIELDS),
          {
            method: 'POST',
            headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
            body,
          },
          g,
          true
        );
      } catch (e) {
        check(g);
        try {
          result = await get(fileId, g);
        } catch {
          throw Error(
            e.message + ' If the file appears in Drive, use Refresh Drive to restore its listing.'
          );
        }
      }
      check(g);
      if (
        result.id !== fileId ||
        Number(result.size) !== blob.size ||
        result.appProperties?.workhubOwner !== account ||
        !result.ownedByMe
      )
        throw Error('Drive upload could not be verified. Refresh Drive before retrying.');
      return result;
    }
    async function permissions(id) {
      const g = generation,
        file = await get(id, g),
        permissions = [],
        seen = new Set();
      let page = '';
      do {
        if (seen.has(page) || seen.size >= 100)
          throw Error(
            'Google returned an incomplete permissions list. Review access in Google Drive.'
          );
        seen.add(page);
        const r = await api(
          '/files/' +
            id +
            '/permissions?' +
            new URLSearchParams({
              fields:
                'nextPageToken,permissions(id,type,role,allowFileDiscovery,permissionDetails(inherited))',
              pageSize: '100',
              ...(page ? { pageToken: page } : {}),
            }),
          {},
          g
        );
        check(g);
        permissions.push(...(r.permissions || []));
        page = r.nextPageToken || '';
      } while (page);
      return { file, permissions };
    }
    async function share(id) {
      const g = generation,
        before = await permissions(id);
      check(g);
      const any = before.permissions.find(p => p.type === 'anyone');
      if (any) {
        if (any.role !== 'reader')
          throw Error(
            'This file already has broader public access. Review its permissions in Google Drive.'
          );
        return { file: before.file, managedShareId: '', existing: true };
      }
      if (!before.file.capabilities?.canShare)
        throw Error('Google Drive does not allow sharing this file.');
      let p;
      try {
        p = await api(
          '/files/' + id + '/permissions?fields=id,type,role',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'anyone', role: 'reader', allowFileDiscovery: false }),
          },
          g
        );
      } catch (e) {
        throw Error(
          e.message + ' Sharing may have changed; review permissions before trying again.'
        );
      }
      check(g);
      return { file: await get(id, g), managedShareId: p.id, existing: false };
    }
    async function unshare(id, permissionId) {
      const g = generation;
      if (!E.id(permissionId))
        throw Error('No app-managed sharing permission is recorded. Review access in Drive.');
      const before = await permissions(id);
      check(g);
      const p = before.permissions.find(p => p.id === permissionId);
      if (!p) return before.file;
      if (
        p.type !== 'anyone' ||
        p.role !== 'reader' ||
        p.permissionDetails?.some(d => d.inherited) ||
        !before.file.capabilities?.canShare
      )
        throw Error('This permission changed or is inherited. Review sharing in Google Drive.');
      await api('/files/' + id + '/permissions/' + permissionId, { method: 'DELETE' }, g);
      check(g);
      return await get(id, g);
    }
    return {
      connect,
      disconnect,
      connected,
      sync,
      clear,
      list,
      get,
      upload,
      permissions,
      share,
      unshare,
      identity: () => (connected() ? { ...identity } : null),
    };
  }
  root.WorkHubDriveAPI = { create, load, SCOPE, FIELDS };
})(globalThis);
