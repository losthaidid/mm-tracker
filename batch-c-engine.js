/** Batch C: deterministic ticket discovery and bounded local screenshot-guide documents. */
(function (root) {
  'use strict';
  const DEFAULT_GUIDE_HEADING = 'WORKHUB  /  SCREENSHOT GUIDE';
  const GUIDE_LAYOUTS = {
    walkthrough: {
      label: 'Guided walkthrough',
      description: 'Numbered steps with full-width screenshots. Short steps share a page.',
    },
    split: {
      label: 'Split view',
      description:
        'Screenshots on the left, instructions on the right. Best for detailed explanations.',
    },
    compact: {
      label: 'Quick reference card',
      description:
        'Two-column step cards with unused space trimmed. Best for sharing as JPG or PNG.',
    },
  };
  const GUIDE_PALETTES = {
    green: { label: 'Green', accent: '#285b4d', paper: '#f8f7f1' },
    blue: { label: 'Blue', accent: '#245e9a', paper: '#f5f8fc' },
    purple: { label: 'Purple', accent: '#70459b', paper: '#faf7fd' },
    charcoal: { label: 'Charcoal', accent: '#3c4652', paper: '#ffffff' },
  };
  const LIMITS = { steps: 24, pixels: 12000000, imageChars: 18000000, marks: 200, points: 1200 };
  const MARK_TYPES = [
    'cover',
    'blur',
    'brush',
    'arrow',
    'number',
    'rectangle',
    'ellipse',
    'text',
    'callout',
    'spotlight',
    'inset',
  ];
  function numbering(value = {}) {
    const mode = value?.mode ?? 'screenshot',
      start = value?.start ?? 1;
    if (
      !value ||
      !['screenshot', 'guide'].includes(mode) ||
      !Number.isInteger(start) ||
      start < 1 ||
      start > 999
    )
      throw Error('Choose a numbering scope and starting number from 1 to 999.');
    return { mode, start };
  }
  function styles(value = []) {
    if (!Array.isArray(value) || value.length > 12) throw Error('Save up to 12 annotation styles.');
    const names = new Set();
    return value.map(s => {
      if (
        !s ||
        !str(s.name, 40) ||
        !s.name.trim() ||
        names.has(s.name) ||
        !/^#[0-9a-f]{6}$/i.test(s.color) ||
        !Number.isFinite(s.stroke) ||
        s.stroke < 2 ||
        s.stroke > 80 ||
        !Number.isFinite(s.marker) ||
        s.marker < 16 ||
        s.marker > 160 ||
        !Number.isFinite(s.text) ||
        s.text < 10 ||
        s.text > 120 ||
        !Number.isFinite(s.opacity) ||
        s.opacity < 0.1 ||
        s.opacity > 0.85
      )
        throw Error('Check the saved annotation style.');
      names.add(s.name);
      return {
        name: s.name,
        color: s.color.toLowerCase(),
        stroke: s.stroke,
        marker: s.marker,
        text: s.text,
        opacity: s.opacity,
      };
    });
  }
  function nextNumber(g, id) {
    const n = numbering(g.numbering),
      steps = n.mode === 'guide' ? g.steps : g.steps.filter(s => s.id === id);
    return Math.max(
      n.start,
      1 +
        steps.reduce(
          (a, s) => s.marks.reduce((v, m) => (m.type === 'number' ? Math.max(v, m.number) : v), a),
          0
        )
    );
  }
  function renumber(g, id) {
    const n = numbering(g.numbering);
    let value = n.start;
    const steps = g.steps.map(s => {
      if (n.mode !== 'guide' && s.id !== id) return s;
      const numbers = s.marks
          .map((m, i) => ({ m, i }))
          .filter(x => x.m.type === 'number')
          .sort((a, b) => a.m.number - b.m.number || a.i - b.i),
        mapped = new Map();
      for (const { m, i } of numbers) {
        if (value > 999)
          throw Error('This sequence exceeds 999. Restart numbering for each screenshot.');
        mapped.set(i, { ...m, number: value++ });
      }
      return { ...s, marks: s.marks.map((m, i) => mapped.get(i) || m) };
    });
    return guide({ ...g, steps });
  }
  function caption(step, linked = false) {
    const list = linked
      ? step.marks
          .filter(m => m.type === 'number' && m.instruction?.trim())
          .sort((a, b) => a.number - b.number)
          .map(m => m.number + '. ' + m.instruction.trim())
      : [];
    return step.caption + (list.length ? '\n\nNumbered instructions\n' + list.join('\n') : '');
  }
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
  function colours(value = GUIDE_PALETTES.green) {
    if (!value || !['accent', 'paper'].every(k => /^#[0-9a-f]{6}$/i.test(value[k])))
      throw Error('Choose valid accent and page background colours.');
    return { accent: value.accent.toLowerCase(), paper: value.paper.toLowerCase() };
  }
  function footer(value = {}) {
    if (!value || typeof value !== 'object') throw Error('Check the guide footer.');
    const text = value.text === undefined ? '' : value.text,
      align = value.align === undefined ? 'center' : value.align,
      opacity = value.opacity === undefined ? 1 : value.opacity,
      size = value.size === undefined ? 180 : value.size,
      logo = value.logo === undefined ? null : value.logo;
    if (
      !str(text, 120) ||
      !['left', 'center', 'right'].includes(align) ||
      !Number.isFinite(opacity) ||
      opacity < 0.05 ||
      opacity > 1 ||
      ![100, 180, 260].includes(size)
    )
      throw Error('Check the footer text, alignment, size and opacity.');
    if (
      logo &&
      (!Number.isInteger(logo.width) ||
        !Number.isInteger(logo.height) ||
        logo.width < 1 ||
        logo.height < 1 ||
        logo.width > 1600 ||
        logo.height > 600 ||
        !str(logo.src, 6000000) ||
        !/^data:image\/(png|webp);base64,[a-zA-Z0-9+/]+={0,2}$/.test(logo.src))
    )
      throw Error('Choose a valid embedded PNG or WebP footer logo up to 1600 × 600 pixels.');
    if (logo !== null && (!logo || typeof logo !== 'object'))
      throw Error('Choose a valid footer logo.');
    const placement = {};
    for (const key of ['widthPct', 'xPct', 'yPct'])
      if (value[key] !== undefined) {
        if (
          !Number.isFinite(value[key]) ||
          value[key] < (key === 'widthPct' ? 0.01 : 0) ||
          value[key] > 100
        )
          throw Error('Choose a logo width and position within the footer area.');
        placement[key] = value[key];
      }
    return {
      text,
      align,
      opacity,
      size,
      logo: logo ? { src: logo.src, width: logo.width, height: logo.height } : null,
      ...placement,
    };
  }
  function logoLayout(value) {
    const f = footer(value);
    if (!f.logo) return null;
    const maxWidthPct = Math.min(100, (240 * f.logo.width) / f.logo.height / 11),
      scale =
        f.widthPct === undefined
          ? Math.min(f.size / f.logo.width, { 100: 32, 180: 48, 260: 64 }[f.size] / f.logo.height)
          : Math.min((11 * f.widthPct) / f.logo.width, 240 / f.logo.height),
      width = f.logo.width * scale,
      height = f.logo.height * scale,
      xPct = f.xPct === undefined ? { left: 0, center: 50, right: 100 }[f.align] : f.xPct,
      yPct =
        f.yPct === undefined
          ? 240 === height
            ? 50
            : ((Math.min(1560, 1630 - height) - 1390) / (240 - height)) * 100
          : f.yPct;
    return {
      width,
      height,
      x: 70 + ((1100 - width) * xPct) / 100,
      y:
        f.yPct === undefined ? Math.min(1560, 1630 - height) : 1390 + ((240 - height) * yPct) / 100,
      xPct,
      yPct,
      widthPct: width / 11,
      maxWidthPct,
    };
  }
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
    if (value.exportHeading !== undefined && !str(value.exportHeading, 180))
      throw Error('Use an export heading up to 180 characters.');
    if (value.linkedInstructions !== undefined && typeof value.linkedInstructions !== 'boolean')
      throw Error('Choose whether to include linked numbered instructions.');
    const layout = value.layout === undefined ? 'classic' : value.layout;
    if (
      typeof layout !== 'string' ||
      (layout !== 'classic' && !Object.hasOwn(GUIDE_LAYOUTS, layout))
    )
      throw Error('Choose a valid guide layout.');
    const branding = footer(value.footer),
      appearance = colours(value.colours),
      ids = new Set();
    let pixels = branding.logo ? branding.logo.width * branding.logo.height : 0,
      chars = branding.logo?.src.length || 0;
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
          !MARK_TYPES.includes(m.type) ||
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
        if (
          m.type === 'number' &&
          (!Number.isInteger(m.number) ||
            m.number < 1 ||
            m.number > 999 ||
            m.points.length !== 2 ||
            m.points[0].some((v, i) => v !== m.points[1][i]))
        )
          throw Error('Check the numbered screenshot markers (1–999).');
        if (
          (m.locked !== undefined && typeof m.locked !== 'boolean') ||
          (m.instruction !== undefined && !str(m.instruction, 300)) ||
          (['text', 'callout'].includes(m.type) && (!str(m.text, 500) || !m.text.trim())) ||
          (m.type === 'inset' && !rect(m.source)) ||
          (m.type === 'spotlight' &&
            (!Number.isFinite(m.opacity) || m.opacity < 0.1 || m.opacity > 0.85))
        )
          throw Error('Check the object text, zoom source, lock and spotlight opacity.');
        if (
          ['rectangle', 'ellipse', 'text', 'callout', 'spotlight', 'inset'].includes(m.type) &&
          !rect(bounds(m.points))
        )
          throw Error('Draw an object with a visible width and height.');
        return {
          type: m.type,
          color: m.color,
          size: m.size,
          points: m.points.map(p => [...p]),
          ...(m.type === 'number' ? { number: m.number } : {}),
          ...(m.type === 'number' && m.instruction !== undefined
            ? { instruction: m.instruction }
            : {}),
          ...(['text', 'callout'].includes(m.type) ? { text: m.text } : {}),
          ...(m.type === 'inset'
            ? { source: { x: m.source.x, y: m.source.y, w: m.source.w, h: m.source.h } }
            : {}),
          ...(m.type === 'spotlight' ? { opacity: m.opacity } : {}),
          ...(m.locked !== undefined ? { locked: m.locked } : {}),
        };
      });
      if (
        s.caption.length +
          marks.reduce((n, m) => n + (m.instruction?.length || 0) + (m.text?.length || 0), 0) >
        12000
      )
        throw Error(
          'Shorten the text on this screenshot (up to 12,000 characters including captions and objects).'
        );
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
    return {
      kind: value.kind,
      version: 1,
      title: value.title,
      layout,
      exportHeading:
        value.exportHeading === undefined ? DEFAULT_GUIDE_HEADING : value.exportHeading,
      footer: branding,
      colours: appearance,
      numbering: numbering(value.numbering),
      styles: styles(value.styles),
      linkedInstructions: value.linkedInstructions === undefined ? false : value.linkedInstructions,
      steps,
    };
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
  function markBounds(m, image) {
    const w = image.width,
      h = image.height;
    if (m.type === 'number') {
      const d = Math.min(Math.max(12, m.size * w), w, h),
        r = d / 2,
        x = Math.max(r, Math.min(w - r, m.points[0][0] * w)),
        y = Math.max(r, Math.min(h - r, m.points[0][1] * h));
      return { x: (x - r) / w, y: (y - r) / h, w: d / w, h: d / h };
    }
    const xs = m.points.map(p => p[0]),
      ys = m.points.map(p => p[1]),
      x = Math.min(...xs),
      y = Math.min(...ys);
    const width = Math.max(1 / w, Math.max(...xs) - x),
      height = Math.max(1 / h, Math.max(...ys) - y);
    return { x: Math.min(x, 1 - width), y: Math.min(y, 1 - height), w: width, h: height };
  }
  function transformMark(m, image, target) {
    if (!rect(target)) throw Error('Keep the object inside the screenshot.');
    const old = markBounds(m, image);
    if (m.type === 'number') {
      const d = Math.min(target.w * image.width, target.h * image.height),
        p = [target.x + target.w / 2, target.y + target.h / 2];
      return { ...m, size: Math.max(0.00001, Math.min(0.2, d / image.width)), points: [p, [...p]] };
    }
    return {
      ...m,
      points: m.points.map(p => [
        Math.max(0, Math.min(1, target.x + ((p[0] - old.x) * target.w) / old.w)),
        Math.max(0, Math.min(1, target.y + ((p[1] - old.y) * target.h) / old.h)),
      ]),
    };
  }
  function moveMark(m, image, dx, dy) {
    const b = markBounds(m, image);
    return transformMark(m, image, {
      ...b,
      x: Math.max(0, Math.min(1 - b.w, b.x + dx)),
      y: Math.max(0, Math.min(1 - b.h, b.y + dy)),
    });
  }
  function hitMark(m, image, p, tolerance = 0.01) {
    const b = markBounds(m, image);
    return (
      p[0] >= b.x - tolerance &&
      p[0] <= b.x + b.w + tolerance &&
      p[1] >= b.y - tolerance &&
      p[1] <= b.y + b.h + tolerance
    );
  }
  const filename = s =>
    String(s || 'screenshot-guide')
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N} _-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 90) || 'screenshot-guide';
  root.WorkHubBatchCEngine = {
    DEFAULT_GUIDE_HEADING,
    GUIDE_LAYOUTS,
    GUIDE_PALETTES,
    MARK_TYPES,
    numbering,
    styles,
    nextNumber,
    renumber,
    caption,
    markBounds,
    transformMark,
    moveMark,
    hitMark,
    footer,
    logoLayout,
    colours,
    LIMITS,
    tokens,
    ticketIndex,
    twins,
    guide,
    bounds,
    filename,
  };
})(window);
