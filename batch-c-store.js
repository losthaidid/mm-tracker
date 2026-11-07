/** Account-scoped screenshot recovery and brand templates. Images stay in this browser. */
(function (root) {
  'use strict';
  let connection;
  function database() {
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      if (!root.indexedDB) {
        reject(Error('Browser storage is unavailable. Save an editable guide to keep your work.'));
        return;
      }
      const request = root.indexedDB.open('workhub-screenshot-guides-v1', 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('accounts', { keyPath: 'key' });
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          connection = null;
        };
        resolve(db);
      };
      request.onerror = () =>
        reject(
          Error('Browser storage could not be opened. Save an editable guide to keep your work.')
        );
      request.onblocked = () =>
        reject(Error('Close other WorkHub tabs and try browser storage again.'));
    }).catch(error => {
      connection = null;
      throw error;
    });
    return connection;
  }
  function account(owner) {
    if (typeof owner !== 'string' || !owner || owner.length > 200)
      throw Error('Sign in to access your saved guides.');
    return 'account:' + owner;
  }
  async function read(owner) {
    const key = account(owner),
      db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('accounts', 'readonly'),
        request = tx.objectStore('accounts').get(key);
      let value;
      request.onsuccess = () => {
        value = request.result;
      };
      tx.oncomplete = () => resolve(value || { key, draft: null, templates: [], autoSave: true });
      tx.onerror = tx.onabort = () => reject(Error('Saved guide settings could not be read.'));
    });
  }
  async function update(owner, mutate) {
    const key = account(owner),
      db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('accounts', 'readwrite'),
        store = tx.objectStore('accounts'),
        request = store.get(key);
      let value, error;
      request.onsuccess = () => {
        try {
          value = { draft: null, templates: [], autoSave: true, ...request.result, key };
          mutate(value);
          store.put(value);
        } catch (err) {
          error = err;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(value);
      tx.onerror = tx.onabort = () =>
        reject(
          error ||
            Error(
              'Browser storage is full or unavailable. Save an editable guide to keep your work.'
            )
        );
    });
  }
  const E = () => root.WorkHubBatchCEngine;
  root.WorkHubGuideStore = {
    read,
    saveDraft(owner, guide) {
      const snapshot = E().guide(guide);
      return update(owner, value => {
        if (value.autoSave !== false) value.draft = { guide: snapshot, savedAt: Date.now() };
      });
    },
    setAutoSave(owner, enabled) {
      return update(owner, value => {
        value.autoSave = !!enabled;
      });
    },
    clearDraft(owner) {
      return update(owner, value => {
        value.draft = null;
        value.autoSave = false;
      });
    },
    saveTemplate(owner, name, guide) {
      const template = E().brandTemplate(name, guide);
      return update(owner, value => {
        const items = (value.templates || []).filter(item => item.name !== template.name);
        if (items.length >= 12)
          throw Error('Save up to 12 brand templates. Delete one before adding another.');
        value.templates = [...items, { ...template, savedAt: Date.now() }];
      });
    },
    deleteTemplate(owner, name) {
      return update(owner, value => {
        value.templates = (value.templates || []).filter(item => item.name !== name);
      });
    },
  };
})(window);
