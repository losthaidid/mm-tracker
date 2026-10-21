/** project-people-files.js — Local PNG drawing and text-safe Excel exports; no uploads. */
(function (root) {
  'use strict';
  const E = root.WorkHubProjectPeopleEngine;
  const tones = ['#e2eee5', '#e8e4f4', '#f5e9d6', '#dfeef0', '#f5e3e0'];
  const tone = name => tones[Array.from(name || 'People').reduce((n, c) => n + c.charCodeAt(0), 0) % tones.length];
  const initials = name => name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  function short(ctx, text, width) {
    let s = String(text || '');
    if (ctx.measureText(s).width <= width) return s;
    while (s.length && ctx.measureText(s + '…').width > width) s = s.slice(0, -1);
    return s + '…';
  }
  function round(ctx, x, y, w, h, r = 16) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  /** All text comes from a validated snapshot. Canvas avoids fragile foreignObject screenshots. */
  async function image(d, pid, personIds, options = {}) {
    E.validate(d);
    const r = E.records(d, pid), wanted = new Set(personIds), people = r.people.filter(p => wanted.has(p.id));
    if (!people.length) throw Error('Add or select a person before exporting a picture.');
    const b = E.bounds(people), worldWidth = Math.max(640, b.width + 64), worldHeight = b.height + 184;
    const scale = Math.min(2, 8192 / worldWidth, 8192 / worldHeight, Math.sqrt(16000000 / (worldWidth * worldHeight)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(worldWidth * scale)); canvas.height = Math.max(1, Math.ceil(worldHeight * scale));
    const c = canvas.getContext('2d');
    if (!c) throw Error('Your browser could not open the image exporter. Try Excel instead.');
    c.scale(scale, scale); c.fillStyle = '#f5f6ef'; c.fillRect(0, 0, worldWidth, worldHeight);
    const g = c.createLinearGradient(0, 0, worldWidth, 150); g.addColorStop(0, '#e1eee4'); g.addColorStop(1, '#ebe6f4');
    c.fillStyle = g; c.fillRect(0, 0, worldWidth, 128);
    c.fillStyle = '#567060'; c.font = '600 11px system-ui, sans-serif'; c.fillText('PEOPLE & RESPONSIBILITIES', 32, 34);
    c.fillStyle = '#29483d'; c.font = '600 25px system-ui, sans-serif'; c.fillText(short(c, E.project(d, pid).name, worldWidth - 64), 32, 72);
    c.fillStyle = '#5c7064'; c.font = '12px system-ui, sans-serif';
    c.fillText(people.length + ' people · ' + new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date()) + (options.emails ? ' · Email details included' : ' · Email details hidden'), 32, 102);
    c.save(); c.translate(32 - b.x, 144 - b.y);
    const ps = new Map(people.map(p => [p.id, p])), all = new Map(r.people.map(p => [p.id, p]));
    c.strokeStyle = '#97b3a2'; c.lineWidth = 2;
    for (const p of people) {
      const manager = ps.get(p.managerId); if (!manager) continue;
      const x = manager.x + E.CARD.width / 2, y = manager.y + E.CARD.height;
      c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x, y + 32, p.x + E.CARD.width / 2, p.y - 32, p.x + E.CARD.width / 2, p.y); c.stroke();
    }
    const acts = new Map(r.activities.map(a => [a.id, a]));
    for (const p of people) {
      const x = p.x, y = p.y, links = r.assignments.filter(a => a.personId === p.id);
      c.fillStyle = '#fffefa'; c.strokeStyle = '#d4dfd3'; round(c, x, y, E.CARD.width, E.CARD.height); c.fill(); c.stroke();
      c.fillStyle = tone(p.department); round(c, x + 16, y + 16, 42, 42, 14); c.fill();
      c.fillStyle = '#385846'; c.font = '600 15px system-ui, sans-serif'; c.fillText(initials(p.name), x + 25, y + 43);
      c.fillStyle = '#637567'; c.font = '11px system-ui, sans-serif'; c.fillText(short(c, p.department || 'Department not set', 170), x + 70, y + 31);
      c.fillStyle = '#2a493b'; c.font = '600 16px system-ui, sans-serif'; c.fillText(short(c, p.name, 172), x + 70, y + 53);
      c.fillStyle = '#66766b'; c.font = '12px system-ui, sans-serif'; c.fillText(short(c, p.title || 'Job title not set', 232), x + 16, y + 83);
      c.fillText(short(c, options.emails ? p.email || 'Email not set' : links.length + ' responsibilities', 232), x + 16, y + 105);
      c.strokeStyle = '#e7eae1'; c.beginPath(); c.moveTo(x + 16, y + 120); c.lineTo(x + 248, y + 120); c.stroke();
      for (const [i, a] of links.slice(0, 2).entries()) {
        const ay = y + 134 + i * 39; c.fillStyle = '#edf2e8'; round(c, x + 14, ay, 236, 33, 8); c.fill();
        c.fillStyle = '#355943'; c.font = '600 11px system-ui, sans-serif'; c.fillText(short(c, E.activityLabel(d, acts.get(a.activityId)), 216), x + 24, ay + 14);
        c.fillStyle = '#68776a'; c.font = '10px system-ui, sans-serif'; c.fillText(short(c, a.role + (a.scope ? ' · ' + a.scope : ''), 216), x + 24, ay + 27);
      }
      if (!links.length) { c.fillStyle = '#8a7d62'; c.font = '12px system-ui, sans-serif'; c.fillText('No responsibilities assigned', x + 16, y + 158); }
      c.fillStyle = '#6e7a6c'; c.font = '10px system-ui, sans-serif';
      c.fillText(short(c, (links.length > 2 ? '+' + (links.length - 2) + ' more · ' : '') + (all.get(p.managerId)?.name ? 'Reports to ' + all.get(p.managerId).name : 'No reporting manager'), 232), x + 16, y + 246);
    }
    c.restore(); c.fillStyle = '#647365'; c.font = '11px system-ui, sans-serif';
    c.fillText(short(c, 'Reporting lines · Up to two responsibilities shown per card · Full details in Excel', worldWidth - 64), 32, worldHeight - 15);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('Image export failed. Try a smaller selection.')), 'image/png'));
    return { blob, width: canvas.width, height: canvas.height, scaled: scale < 1 };
  }
  root.WorkHubProjectPeopleFiles = { tone, initials, image, excel: (d, pid) => root.WorkHubValidatorFiles.workbook(E.sheets(d, pid)) };
})(window);
