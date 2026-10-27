/** Private device-only picture gallery. Raster uploads are resized before IndexedDB storage. */
(function (root) {
  'use strict';
  const esc = s =>
    String(s ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const fresh = id => ({ id, photos: [], selected: '', strength: 40, target: 'page' });
  function deviceStore() {
    let pending;
    function open() {
      if (!pending)
        pending = new Promise((resolve, reject) => {
          if (!root.indexedDB)
            return reject(Error('Picture storage is unavailable in this browser.'));
          const request = root.indexedDB.open('workhub-background-pictures', 1);
          request.onupgradeneeded = () =>
            request.result.createObjectStore('accounts', { keyPath: 'id' });
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(Error('This browser could not open picture storage.'));
        });
      return pending;
    }
    async function run(mode, id, value) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('accounts', mode),
          store = tx.objectStore('accounts'),
          request = value ? store.put(value) : store.get(id);
        let result;
        request.onsuccess = () => (result = request.result);
        tx.oncomplete = () => resolve(result);
        tx.onabort = tx.onerror = () =>
          reject(Error('The picture could not be stored. Your previous background is unchanged.'));
      });
    }
    return { read: id => run('readonly', id), write: value => run('readwrite', value.id, value) };
  }
  async function optimise(file) {
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    )
      throw Error('Choose a JPEG, PNG or WebP picture up to 15 MB.');
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(Error('This picture could not be read.'));
        img.src = url;
      });
      if (
        image.naturalWidth * image.naturalHeight > 40000000 ||
        !image.naturalWidth ||
        !image.naturalHeight
      )
        throw Error('Choose a picture smaller than 40 megapixels.');
      const scale = Math.min(1, 2560 / image.naturalWidth, 1600 / image.naturalHeight),
        canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('Picture processing is unavailable.');
      ctx.fillStyle = '#f6f3ef';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      let blob;
      for (const quality of [0.86, 0.72, 0.56]) {
        blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= 1200000) break;
      }
      if (!blob || blob.size > 1200000)
        throw Error('This picture is too detailed. Try a smaller picture.');
      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function install(a) {
    const db = a.storage || deviceStore(),
      decode = a.optimise || optimise;
    let owner = '',
      generation = 0,
      row = null,
      loading = null,
      busy = false,
      applied = '',
      modalOwner = '',
      loadError = '';
    const urls = new Map();
    function live(id = owner) {
      return !!id && a.ready() && a.owner() === id && owner === id;
    }
    function clearPicture() {
      document.getElementById('workspacePhoto')?.remove();
      delete document.body.dataset.photoBackground;
      document.body.style.removeProperty('--workspace-photo');
    }
    function cleanup() {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
      clearPicture();
      applied = '';
    }
    function photoURL(photo) {
      if (!urls.has(photo.id)) urls.set(photo.id, URL.createObjectURL(photo.blob));
      return urls.get(photo.id);
    }
    function releaseUnusedURLs() {
      const kept = new Set(row.photos.map(photo => photo.id));
      for (const [id, url] of urls)
        if (!kept.has(id)) {
          URL.revokeObjectURL(url);
          urls.delete(id);
        }
    }
    function apply(force = false) {
      if (!live() || !row) return;
      const photo = row.photos.find(p => p.id === row.selected),
        key = photo ? [photo.id, row.target, row.strength].join('|') : '',
        currentLayer = document.getElementById('workspacePhoto');
      if (
        !force &&
        key === applied &&
        (photo
          ? currentLayer && document.body.dataset.photoBackground === row.target
          : !currentLayer &&
            !document.body.hasAttribute('data-photo-background') &&
            !document.body.style.getPropertyValue('--workspace-photo'))
      )
        return;
      applied = key;
      if (!photo) {
        clearPicture();
        a.refreshTheme?.();
        return;
      }
      let layer = document.getElementById('workspacePhoto');
      if (!layer) {
        layer = document.createElement('div');
        layer.id = 'workspacePhoto';
        layer.setAttribute('aria-hidden', 'true');
        layer.append(document.createElement('img'));
        document.body.prepend(layer);
      }
      layer.querySelector('img').src = photoURL(photo);
      layer.querySelector('img').alt = '';
      layer.style.setProperty('--photo-strength', row.strength / 100);
      document.body.dataset.photoBackground = row.target;
      document.body.style.setProperty('--workspace-photo', `url("${photoURL(photo)}")`);
    }
    async function mount() {
      const next = a.ready() ? a.owner() : '';
      if (next !== owner) {
        generation++;
        cleanup();
        owner = next;
        row = null;
        busy = false;
        loadError = '';
        if (modalOwner && modalOwner !== owner && document.getElementById('photoBackgroundForm'))
          a.closeModal();
        modalOwner = '';
        const epoch = generation;
        loading = owner
          ? db
              .read(owner)
              .then(value => {
                if (epoch !== generation || !live(next)) return;
                row = value || fresh(next);
                apply();
              })
              .catch(error => {
                if (epoch === generation && live(next)) {
                  row = fresh(next);
                  loadError = error.message;
                }
              })
          : Promise.resolve();
      } else if (row) apply();
      return loading;
    }
    async function save(next) {
      if (busy || !live() || !row) throw Error('Wait for the picture operation to finish.');
      busy = true;
      const id = owner,
        epoch = generation,
        previous = row;
      try {
        // Apply the choice before IndexedDB finishes writing the picture collection.
        row = next;
        apply(true);
        await db.write(next);
        if (epoch !== generation || !live(id)) return false;
        releaseUnusedURLs();
        return true;
      } catch (error) {
        if (epoch === generation && live(id)) {
          row = previous;
          apply(true);
          releaseUnusedURLs();
        }
        throw error;
      } finally {
        if (epoch === generation && live(id)) busy = false;
      }
    }
    function render() {
      if (!live() || !row) return;
      modalOwner = owner;
      a.openModal(
        'My background pictures',
        `<form id="photoBackgroundForm" data-owner="${esc(owner)}" class="photo-gallery"><span class="hub-kicker">MAKE THE VIEW YOURS</span><p>Up to six pictures, stored only on this device for this account. Pictures are resized to at most 2560 × 1600 and are not uploaded to Supabase or included in cloud backups.</p><p role="status" class="photo-background-status">${row.selected ? 'Picture active · ' + { page: 'Page background', hero: 'My Day welcome', both: 'Page and My Day welcome' }[row.target] : 'Theme background active · your pictures are kept for later.'}</p><label>Add picture<input type="file" data-photo-upload accept="image/jpeg,image/png,image/webp"></label><div class="photo-grid">${row.photos.map(p => `<article data-active="${row.selected === p.id}"><img src="${esc(photoURL(p))}" alt="${esc(p.name)}"><p>${esc(p.name)}</p><div class="actions"><button type="button" data-photo="use" data-id="${p.id}">${row.selected === p.id ? 'Selected' : 'Use picture'}</button><button type="button" data-photo="delete" data-id="${p.id}">Remove</button></div></article>`).join('') || '<p>No pictures yet. Choose a picture above.</p>'}</div><label>Use picture on<select name="target"><option value="page"${row.target === 'page' ? ' selected' : ''}>Page background</option><option value="hero"${row.target === 'hero' ? ' selected' : ''}>My Day welcome</option><option value="both"${row.target === 'both' ? ' selected' : ''}>Both</option></select></label><label>Page picture strength<input type="range" name="strength" min="20" max="100" step="5" value="${row.strength}"></label><p>Cards keep their solid backgrounds for readability. My Day welcome keeps its text shading.</p><div class="actions"><button type="button" data-photo="theme">Use theme background</button><button type="submit" class="primary">Save picture settings</button></div></form>`
      );
    }
    async function open() {
      await mount();
      if (loadError) throw Error(loadError);
      if (live() && row) render();
    }
    async function upload(file) {
      const requested = a.owner();
      await mount();
      if (!live(requested) || !row) return false;
      if (loadError) throw Error(loadError);
      const id = requested,
        epoch = generation;
      if (busy) throw Error('Wait for the current picture operation.');
      if (row.photos.length >= 6)
        throw Error('Keep up to six pictures. Remove one before adding another.');
      busy = true;
      let blob;
      try {
        blob = await decode(file);
      } finally {
        if (live(id)) busy = false;
      }
      if (epoch !== generation || !live(id)) return false;
      const photo = {
        id: root.crypto?.randomUUID?.() || 'photo-' + Date.now(),
        name: String(file.name || 'My picture').slice(0, 80),
        blob,
      };
      const saved = await save({ ...row, photos: [...row.photos, photo], selected: photo.id });
      if (saved && document.getElementById('photoBackgroundForm')) render();
      return saved;
    }
    document.addEventListener('click', event => {
      const b = event.target.closest?.('[data-photo]');
      if (!b) return;
      const action = b.dataset.photo;
      void (async () => {
        if (action === 'open') {
          await open();
          return;
        }
        if (!live() || document.getElementById('photoBackgroundForm')?.dataset.owner !== owner)
          return;
        if (busy) throw Error('Wait for the picture operation to finish.');
        let next = { ...row };
        if (action === 'use') next.selected = b.dataset.id;
        else if (action === 'theme') next.selected = '';
        else if (action === 'delete') {
          next.photos = row.photos.filter(p => p.id !== b.dataset.id);
          if (next.selected === b.dataset.id) next.selected = '';
        } else return;
        const saved = save(next);
        if (action === 'theme') a.closeModal();
        if (await saved) {
          if (action === 'theme') a.tell('Theme background restored. Your pictures are kept.');
          else render();
        }
      })().catch(error => a.tell(error.message, true));
    });
    document.addEventListener('change', event => {
      if (
        event.target.matches('[data-photo-upload]') &&
        event.target.closest('form')?.dataset.owner === owner &&
        event.target.files?.[0]
      )
        void upload(event.target.files[0]).catch(error => a.tell(error.message, true));
    });
    document.addEventListener('submit', event => {
      if (event.target.id !== 'photoBackgroundForm') return;
      event.preventDefault();
      const form = event.target;
      if (!live() || form.dataset.owner !== owner) return;
      const target = form.elements.target.value,
        strength = Number(form.elements.strength.value);
      if (
        !['page', 'hero', 'both'].includes(target) ||
        !Number.isFinite(strength) ||
        strength < 20 ||
        strength > 100
      )
        return;
      void save({ ...row, target, strength })
        .then(ok => {
          if (ok) {
            a.closeModal();
            a.tell('Picture settings saved on this device.');
          }
        })
        .catch(error => a.tell(error.message, true));
    });
    root.addEventListener('pagehide', cleanup);
    root.addEventListener('pageshow', () => {
      if (live() && row) apply(true);
    });
    return {
      mount,
      open,
      upload,
      snapshot: () => ({
        owner,
        count: row?.photos.length || 0,
        selected: row?.selected || '',
        target: row?.target || 'page',
      }),
    };
  }
  root.WorkHubPhotoBackground = { install, deviceStore, optimise };
})(window);
