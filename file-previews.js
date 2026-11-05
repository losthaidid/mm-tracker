/* On-demand private file previews. No Google URLs, file bytes or thumbnails are persisted. */
(function (root) {
  'use strict';
  const E = root.WorkHubDriveFilesEngine,
    base = new URL('./', document.currentScript?.src || document.baseURI);
  const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const supported = f => f?.mimeType === 'application/pdf' || IMAGE_TYPES.includes(f?.mimeType);
  const esc = s =>
    String(s ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  let pdfPromise;
  async function pdfLibrary() {
    if (!pdfPromise)
      pdfPromise = import(new URL('vendor/pdfjs/pdf.min.mjs', base).href)
        .then(lib => {
          lib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.mjs', base).href;
          return lib;
        })
        .catch(() => {
          pdfPromise = null;
          throw Error('The PDF viewer could not load. Try again or open the file in Drive.');
        });
    return pdfPromise;
  }
  function create(a) {
    let epoch = 0,
      dialog = null,
      controller = null,
      task = null,
      pdf = null,
      renderTask = null,
      imageUrl = '',
      page = 1,
      zoom = 1,
      renderEpoch = 0;
    let thumbsEpoch = 0,
      thumbsController = null,
      thumbs = new Map(),
      currentContext = null;
    const context = () => a.context(),
      valid = c => a.valid() && c === context();
    function clearThumbnails() {
      thumbsEpoch++;
      thumbsController?.abort();
      thumbsController = null;
      for (const v of thumbs.values()) URL.revokeObjectURL(v);
      thumbs.clear();
    }
    function close() {
      epoch++;
      renderEpoch++;
      controller?.abort();
      controller = null;
      renderTask?.cancel();
      renderTask = null;
      const old = task;
      task = null;
      pdf = null;
      void old?.destroy()?.catch(() => {});
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      imageUrl = '';
      if (dialog) {
        const d = dialog;
        dialog = null;
        d.close();
        d.remove();
      }
    }
    function clear() {
      close();
      clearThumbnails();
      currentContext = context();
    }
    function sync() {
      const next = context();
      if (next !== currentContext || !a.valid()) {
        clear();
        currentContext = next;
      }
    }
    const canvasBlob = canvas =>
      new Promise((resolve, reject) =>
        canvas.toBlob(
          b => (b ? resolve(b) : reject(Error('Could not draw the preview.'))),
          'image/png'
        )
      );
    async function picture(blob, signal) {
      const url = URL.createObjectURL(blob),
        image = new Image();
      try {
        await new Promise((resolve, reject) => {
          const abort = () => {
            image.src = '';
            reject(Error('Preview cancelled.'));
          };
          signal?.addEventListener('abort', abort, { once: true });
          image.onload = () => {
            signal?.removeEventListener('abort', abort);
            resolve();
          };
          image.onerror = () => {
            signal?.removeEventListener('abort', abort);
            reject(Error('This image could not be decoded. Open it in Drive.'));
          };
          if (signal?.aborted) abort();
          else image.src = url;
        });
        if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 32000000)
          throw Error('This image is too large for an in-app preview.');
        return image;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    async function loadPDF(blob) {
      const lib = await (a.loadPDF || pdfLibrary)();
      return lib.getDocument({
        data: new Uint8Array(await blob.arrayBuffer()),
        isEvalSupported: false,
        enableXfa: false,
        useWasm: false,
        isImageDecoderSupported: false,
        stopAtErrors: true,
        useSystemFonts: true,
      });
    }
    function fit(viewport, maxWidth, maxHeight) {
      return Math.min(maxWidth / viewport.width, maxHeight / viewport.height, 2);
    }
    async function paintPage(c, token) {
      if (!pdf || !dialog || !valid(c) || token !== epoch) return;
      const serial = ++renderEpoch;
      renderTask?.cancel();
      const book = pdf,
        p = await book.getPage(page);
      if (!dialog || token !== epoch || serial !== renderEpoch || !valid(c)) return;
      const natural = p.getViewport({ scale: 1 }),
        scale = fit(natural, 1400 * zoom, 1900 * zoom),
        viewport = p.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'PDF page ' + page + ' of ' + book.numPages);
      canvas.style.maxWidth = zoom > 1 ? 'none' : '100%';
      canvas.style.maxHeight = zoom > 1 ? 'none' : '100%';
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('Canvas drawing is unavailable. Open the file in Drive.');
      dialog.querySelector('[data-fp-status]').textContent = 'Rendering page ' + page + '…';
      const job = p.render({ canvasContext: ctx, viewport });
      renderTask = job;
      try {
        await job.promise;
      } catch (e) {
        if (serial !== renderEpoch || token !== epoch) return;
        throw e;
      }
      if (!dialog || token !== epoch || serial !== renderEpoch || !valid(c)) return;
      renderTask = null;
      p.cleanup?.();
      dialog.querySelector('[data-fp-content]').replaceChildren(canvas);
      dialog.querySelector('[data-fp-status]').textContent =
        'Page ' + page + ' of ' + book.numPages;
      dialog.querySelector('[data-fp-page]').value = page;
      dialog.querySelector('[data-fp-prev]').disabled = page <= 1;
      dialog.querySelector('[data-fp-next]').disabled = page >= book.numPages;
    }
    async function open(file, read) {
      sync();
      if (!a.valid())
        throw Error('Connect the owning Google account and check Files export access to preview.');
      if (!supported(file)) throw Error('Preview is available for PDF, PNG, JPEG, WebP and GIF.');
      close();
      const c = context(),
        token = epoch;
      controller = new AbortController();
      const signal = controller.signal;
      page = 1;
      zoom = 1;
      const focus = document.activeElement;
      dialog = document.createElement('dialog');
      dialog.id = 'workhubFilePreview';
      dialog.className = 'fp-dialog';
      dialog.dataset.accessFeature = 'files';
      dialog.setAttribute('aria-labelledby', 'fpTitle');
      dialog.innerHTML = `<header class="fp-header"><div><span class="hub-kicker">FILE PREVIEW · ORIGINAL IN DRIVE</span><h2 id="fpTitle">${esc(file.name)}</h2></div><button type="button" data-fp-close aria-label="Close file preview">Close</button></header><div class="fp-toolbar" data-fp-toolbar hidden><button type="button" data-fp-prev>Previous page</button><label>Page <input type="number" data-fp-page min="1" value="1" aria-label="PDF page"></label><button type="button" data-fp-next>Next page</button><label>Size<select data-fp-zoom aria-label="PDF preview size"><option value="1">Fit page</option><option value="1.5">Larger</option></select></label></div><p data-fp-status role="status">Loading your file securely from Drive…</p><div class="fp-content" data-fp-content></div><footer class="fp-footer"><span>Preview only · file contents are unchanged</span><div class="actions"><button type="button" data-fp-retry hidden>Try again</button><a href="${esc(E.url(file.webViewLink))}" target="_blank" rel="noopener noreferrer">Open in Google Drive</a></div></footer>`;
      (document.fullscreenElement || document.body).append(dialog);
      dialog.showModal();
      dialog.addEventListener('keydown', e => e.stopPropagation());
      const dismiss = () => {
        close();
        if (focus?.isConnected) focus.focus?.({ preventScroll: true });
      };
      dialog.querySelector('[data-fp-close]').onclick = dismiss;
      dialog.addEventListener('cancel', e => {
        e.preventDefault();
        dismiss();
      });
      dialog.addEventListener('close', () => {
        if (dialog && !dialog.open) close();
      });
      const fail = e => {
        if (dialog && valid(c) && token === epoch) {
          dialog.querySelector('[data-fp-status]').textContent =
            e.name === 'PasswordException'
              ? 'This PDF needs a password. Open it in Google Drive.'
              : e.message;
          dialog.querySelector('[data-fp-retry]').hidden = false;
        }
      };
      dialog.querySelector('[data-fp-retry]').onclick = () => void open(file, read).catch(a.tell);
      dialog.querySelector('[data-fp-prev]').onclick = () => {
        if (page > 1) {
          page--;
          void paintPage(c, token).catch(fail);
        }
      };
      dialog.querySelector('[data-fp-next]').onclick = () => {
        if (pdf && page < pdf.numPages) {
          page++;
          void paintPage(c, token).catch(fail);
        }
      };
      dialog.querySelector('[data-fp-page]').onchange = e => {
        const n = Number(e.target.value);
        if (pdf && Number.isInteger(n) && n >= 1 && n <= pdf.numPages) {
          page = n;
          void paintPage(c, token).catch(fail);
        } else {
          e.target.value = page;
        }
      };
      dialog.querySelector('[data-fp-zoom]').onchange = e => {
        zoom = Number(e.target.value);
        void paintPage(c, token).catch(fail);
      };
      try {
        const { blob, file: verified } = await read(signal, 25 * 1024 * 1024);
        if (!dialog || !valid(c) || token !== epoch || signal.aborted) return;
        if (verified.id !== file.id || !supported(verified))
          throw Error('The file details changed. Refresh Drive before previewing.');
        if (verified.mimeType === 'application/pdf') {
          const pending = await loadPDF(blob);
          if (!valid(c) || token !== epoch) {
            void pending.destroy();
            return;
          }
          task = pending;
          pdf = await pending.promise;
          if (!dialog || !valid(c) || token !== epoch) return;
          if (pdf.numPages > 1000)
            throw Error('This PDF exceeds the 1,000-page preview limit. Open it in Drive.');
          dialog.querySelector('[data-fp-toolbar]').hidden = false;
          dialog.querySelector('[data-fp-page]').max = pdf.numPages;
          await paintPage(c, token);
        } else {
          const image = await picture(blob, signal);
          if (!dialog || !valid(c) || token !== epoch) return;
          const width = image.naturalWidth,
            height = image.naturalHeight;
          imageUrl = URL.createObjectURL(blob);
          image.src = imageUrl;
          image.alt = verified.name;
          dialog.querySelector('[data-fp-content]').replaceChildren(image);
          dialog.querySelector('[data-fp-status]').textContent = width + ' × ' + height + ' pixels';
        }
      } catch (e) {
        fail(e);
      }
    }
    async function thumbnails(files, read, onItem) {
      sync();
      clearThumbnails();
      if (!a.valid()) throw Error('Connect Google Drive to load thumbnails.');
      const token = thumbsEpoch,
        c = context();
      thumbsController = new AbortController();
      const signal = thumbsController.signal;
      const queue = files.filter(f => supported(f) && f.size <= 8 * 1024 * 1024).slice(0, 12);
      async function worker() {
        while (queue.length && token === thumbsEpoch && valid(c) && !signal.aborted) {
          const f = queue.shift();
          let loading;
          try {
            const { blob, file } = await read(f, signal, 8 * 1024 * 1024);
            if (file.id !== f.id || !supported(file)) throw Error('File details changed.');
            if (!valid(c) || token !== thumbsEpoch || signal.aborted) return;
            const canvas = document.createElement('canvas');
            canvas.width = 360;
            canvas.height = 230;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw Error('Thumbnail drawing unavailable.');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, 360, 230);
            if (file.mimeType === 'application/pdf') {
              loading = await loadPDF(blob);
              const book = await loading.promise,
                p = await book.getPage(1),
                natural = p.getViewport({ scale: 1 }),
                viewport = p.getViewport({ scale: fit(natural, 360, 230) });
              await p.render({
                canvasContext: ctx,
                viewport,
                transform: [1, 0, 0, 1, (360 - viewport.width) / 2, (230 - viewport.height) / 2],
              }).promise;
            } else {
              const image = await picture(blob, signal),
                scale = Math.min(360 / image.naturalWidth, 230 / image.naturalHeight);
              ctx.drawImage(
                image,
                (360 - image.naturalWidth * scale) / 2,
                (230 - image.naturalHeight * scale) / 2,
                image.naturalWidth * scale,
                image.naturalHeight * scale
              );
            }
            if (!valid(c) || token !== thumbsEpoch || signal.aborted) return;
            const thumbnail = await canvasBlob(canvas);
            canvas.width = canvas.height = 1;
            if (!valid(c) || token !== thumbsEpoch || signal.aborted) return;
            const url = URL.createObjectURL(thumbnail);
            thumbs.set(f.id, url);
            onItem(f.id, url, '');
          } catch (e) {
            if (valid(c) && token === thumbsEpoch && !signal.aborted) onItem(f.id, '', e.message);
          } finally {
            await loading?.destroy()?.catch(() => {});
          }
        }
      }
      await Promise.all([worker(), worker()]);
    }
    root.addEventListener('pagehide', clear);
    return { open, close, sync, clear, clearThumbnails, thumbnails };
  }
  root.WorkHubFilePreviews = { create, supported, IMAGE_TYPES };
})(globalThis);
