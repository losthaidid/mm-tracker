/** Batch C: deterministic ticket discovery and bounded local screenshot-guide documents. */
(function (root) {
  'use strict';
  const LIMITS = { steps: 24, pixels: 12000000, imageChars: 18000000, marks: 200, points: 1200 };
  const stop = new Set(
    'a an the and or but for to of in on at by is are was were be been being with without from this that these those it its as i we you they our your their please issue error problem when after before cannot unable not have has had can could should would will do does did no yes need check ticket test system user request failed failure'.split(
      ' '
    )
  );
  const tokens = text =>
    [
      ...new Set(
        (
          String(text || '')
            .normalize('NFKC')
            .toLowerCase()
            .match(/[\p{L}\p{N}_/-]+/gu) || []
        ).filter(s => s.length >= 3 && s.length <= 80 && !stop.has(s) && !/^\d+$/.test(s))
      ),
    ].slice(0, 80);
  const normal = text =>
    String(text || '')
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  function ticketIndex(tickets) {
    const frequency = new Map();
    const rows = tickets.slice(0, 5000).map(ticket => {
      const title = String(ticket.description || '').slice(0, 12000),
        history = String(ticket.history || '').slice(0, 32767),
        terms = new Set(tokens(title + ' ' + history)),
        heading = new Set(tokens(title));
      for (const term of terms) frequency.set(term, (frequency.get(term) || 0) + 1);
      return { ticket, title, terms, heading };
    });
    return { rows, frequency };
  }
  function twins(index, draft, limit = 6) {
    const query = tokens(draft.description),
      phrase = normal(draft.description),
      ticketNo = normal(draft.ticket);
    if (!query.length && !ticketNo) return [];
    return index.rows
      .filter(r => r.ticket.id !== draft.id)
      .map(r => {
        const shared = query.filter(s => r.terms.has(s)),
          sameId = !!ticketNo && ticketNo === normal(r.ticket.ticket),
          sameDescription = phrase.length >= 12 && phrase === normal(r.title),
          distinctive = shared.some(
            s =>
              (/\p{L}/u.test(s) && /\d/.test(s)) ||
              (s.length >= 6 && index.frequency.get(s) <= Math.max(2, index.rows.length / 5))
          );
        if (!sameId && !sameDescription && shared.length < 2 && !distinctive) return null;
        const score =
          (sameId ? 100 : 0) +
          (sameDescription ? 80 : 0) +
          shared.reduce(
            (n, s) =>
              n +
              (r.heading.has(s) ? 5 : 2) * Math.log(2 + index.rows.length / index.frequency.get(s)),
            0
          );
        return { ticket: r.ticket, shared: shared.slice(0, 8), sameId, sameDescription, score };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.score - a.score || String(a.ticket.ticket).localeCompare(String(b.ticket.ticket))
      )
      .slice(0, limit);
  }
  const str = (s, max) => typeof s === 'string' && s.length <= max;
  const unit = x => Number.isFinite(x) && x >= 0 && x <= 1;
  const point = p => Array.isArray(p) && p.length === 2 && p.every(unit);
  const rect = p =>
    p &&
    ['x', 'y', 'w', 'h'].every(k => unit(p[k])) &&
    p.w > 0 &&
    p.h > 0 &&
    p.x + p.w <= 1.000001 &&
    p.y + p.h <= 1.000001;
  function guide(value) {
    if (
      !value ||
      value.kind !== 'workhub-screenshot-guide' ||
      value.version !== 1 ||
      !str(value.title, 180) ||
      !Array.isArray(value.steps) ||
      value.steps.length > LIMITS.steps
    )
      throw Error('Choose a valid WorkHub guide file with up to 24 steps.');
    const ids = new Set();
    let pixels = 0,
      chars = 0;
    const steps = value.steps.map(s => {
      if (
        !s ||
        !str(s.id, 100) ||
        !s.id ||
        ids.has(s.id) ||
        !str(s.title, 180) ||
        !str(s.caption, 8000) ||
        !s.image ||
        !Number.isInteger(s.image.width) ||
        !Number.isInteger(s.image.height) ||
        s.image.width < 1 ||
        s.image.height < 1 ||
        s.image.width > 2400 ||
        s.image.height > 2400 ||
        !str(s.image.src, LIMITS.imageChars) ||
        !/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/]+={0,2}$/.test(s.image.src) ||
        !Array.isArray(s.marks) ||
        s.marks.length > LIMITS.marks ||
        (s.crop !== null && !rect(s.crop))
      )
        throw Error('Check the guide images, step text and crop areas.');
      ids.add(s.id);
      pixels += s.image.width * s.image.height;
      chars += s.image.src.length;
      const marks = s.marks.map(m => {
        if (
          !m ||
          !['cover', 'blur', 'brush', 'arrow'].includes(m.type) ||
          !/^#[0-9a-f]{6}$/i.test(m.color) ||
          !unit(m.size) ||
          m.size <= 0 ||
          m.size > 0.2 ||
          !Array.isArray(m.points) ||
          m.points.length < 2 ||
          m.points.length > LIMITS.points ||
          !m.points.every(point)
        )
          throw Error('Check the screenshot annotations.');
        return { type: m.type, color: m.color, size: m.size, points: m.points.map(p => [...p]) };
      });
      return {
        id: s.id,
        title: s.title,
        caption: s.caption,
        image: { src: s.image.src, width: s.image.width, height: s.image.height },
        marks,
        crop: s.crop ? { x: s.crop.x, y: s.crop.y, w: s.crop.w, h: s.crop.h } : null,
      };
    });
    if (pixels > LIMITS.pixels || chars > LIMITS.imageChars)
      throw Error('This guide is too large. Use fewer or smaller screenshots.');
    return { kind: value.kind, version: 1, title: value.title, steps };
  }
  const bounds = points => {
    const [a, b] = [points[0], points.at(-1)];
    return {
      x: Math.min(a[0], b[0]),
      y: Math.min(a[1], b[1]),
      w: Math.abs(b[0] - a[0]),
      h: Math.abs(b[1] - a[1]),
    };
  };
  const filename = s =>
    String(s || 'screenshot-guide')
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N} _-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 90) || 'screenshot-guide';
  root.WorkHubBatchCEngine = { LIMITS, tokens, ticketIndex, twins, guide, bounds, filename };
})(window);
