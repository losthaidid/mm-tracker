/**
 * project-people-engine.js — Private project contacts, reporting lines and MM responsibilities.
 * Stored in the existing account document. Area IDs survive renaming; reporting lines
 * and process assignments are deliberately independent. No SAP permissions are changed.
 */
(function (root) {
  'use strict';
  const ROLES = ['Primary', 'Backup', 'Business owner', 'Key user', 'Tester', 'Approver'];
  const CARD = { width: 264, height: 268, gap: 58 };
  const LIMITS = { people: 1000, projectPeople: 100, activities: 5000, projectActivities: 300, assignments: 10000 };
  const clean = (v, max = 200) => typeof v === 'string' && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
  const id = v => clean(v, 100) && !!v.trim();
  const key = s => String(s).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const data = d => d.workhub.projectPeople;
  const project = (d, pid) => {
    const p = d.projects.find(p => p.id === pid);
    if (!p) throw Error('This project no longer exists.');
    return p;
  };
  function upgrade(d) {
    if (!d.workhub) d.workhub = {};
    if (d.workhub.projectPeople === undefined)
      d.workhub.projectPeople = { version: 1, people: [], activities: [], assignments: [] };
    return d;
  }
  function records(d, pid) {
    project(d, pid);
    const h = data(d);
    return Object.fromEntries(['people', 'activities', 'assignments'].map(k => [k, h[k].filter(r => r.projectId === pid)]));
  }
  function area(d, pid, aid) {
    const a = project(d, pid).mmAreas.find(a => a.id === aid);
    if (!a) throw Error('An MM area is used by People & Responsibilities. Reassign its activities before removing it, or hide the area.');
    return a;
  }
  const activityLabel = (d, r) => r.kind === 'area' ? area(d, r.projectId, r.areaId).name + ' · Entire area' : r.name;
  function validate(d) {
    const h = data(d);
    if (!h || h.version !== 1 || ['people', 'activities', 'assignments'].some(k => !Array.isArray(h[k]) || h[k].length > LIMITS[k]))
      throw Error('Check the People & Responsibilities records or collection limits.');
    const ps = new Map(), acts = new Map(), seen = new Set(), perProject = new Map();
    for (const p of h.people) {
      if (!p || !id(p.id) || ps.has(p.id) || !id(p.projectId) || !clean(p.name, 120) || !p.name.trim() ||
          !clean(p.email, 254) || (p.email && !root.WorkHubRecipientsEngine.email(p.email)) ||
          !clean(p.department, 120) || !clean(p.title, 160) || !clean(p.phone, 60) || !clean(p.managerId, 100) ||
          ![p.x, p.y].every(v => Number.isFinite(v) && v >= 24 && v <= 50000))
        throw Error('Check each person’s name, email, department, reporting manager and chart position.');
      project(d, p.projectId); ps.set(p.id, p);
      perProject.set(p.projectId, (perProject.get(p.projectId) || 0) + 1);
      if (perProject.get(p.projectId) > LIMITS.projectPeople) throw Error('A project supports up to 100 people.');
    }
    for (const p of h.people) {
      const visited = new Set([p.id]); let next = p.managerId;
      while (next) {
        const manager = ps.get(next);
        if (!manager || manager.projectId !== p.projectId || visited.has(next)) throw Error('Reporting lines must stay inside the project and cannot form a loop.');
        visited.add(next); next = manager.managerId;
      }
    }
    perProject.clear();
    for (const r of h.activities) {
      if (!r || !id(r.id) || acts.has(r.id) || !id(r.projectId) || !id(r.areaId) || !['area', 'activity'].includes(r.kind) ||
          !clean(r.name, 160) || !r.name.trim() || !clean(r.sourceMappingId, 100)) throw Error('Check the responsibility activities.');
      area(d, r.projectId, r.areaId);
      const unique = JSON.stringify([r.projectId, r.areaId, r.kind, r.kind === 'area' ? '' : key(r.name)]);
      if (seen.has(unique)) throw Error('That activity already exists in this MM area.');
      seen.add(unique); acts.set(r.id, r);
      perProject.set(r.projectId, (perProject.get(r.projectId) || 0) + 1);
      if (perProject.get(r.projectId) > LIMITS.projectActivities) throw Error('A project supports up to 300 activities.');
    }
    seen.clear(); const ids = new Set();
    for (const r of h.assignments) {
      const person = ps.get(r?.personId), act = acts.get(r?.activityId);
      const unique = JSON.stringify([r?.personId, r?.activityId, r?.role, key(r?.scope || '')]);
      if (!r || !id(r.id) || ids.has(r.id) || !person || !act || person.projectId !== r.projectId || act.projectId !== r.projectId ||
          !ROLES.includes(r.role) || !clean(r.scope, 200) || !clean(r.notes, 1000) || seen.has(unique))
        throw Error('Check responsibility links, roles and scope. Duplicate assignments are not allowed.');
      ids.add(r.id); seen.add(unique);
    }
    return d;
  }
  /** Only project deletion cascades. A broken reference in an import must be reported. */
  function prepare(next, previous, restoring = false) {
    if (restoring || !previous) return;
    const removed = new Set(previous.projects.filter(p => !next.projects.some(n => n.id === p.id)).map(p => p.id));
    for (const k of ['people', 'activities', 'assignments']) data(next)[k] = data(next)[k].filter(r => !removed.has(r.projectId));
  }
  function upsertPerson(d, values) {
    project(d, values.projectId);
    const h = data(d), old = h.people.find(p => p.id === values.id);
    if (old && old.projectId !== values.projectId) throw Error('This person belongs to another project.');
    if (old) h.people[h.people.indexOf(old)] = values; else h.people.push(values);
    validate(d); return values;
  }
  function upsertActivity(d, values) {
    const h = data(d), old = h.activities.find(p => p.id === values.id);
    if (old && old.projectId !== values.projectId) throw Error('This activity belongs to another project.');
    area(d, values.projectId, values.areaId);
    if (old) h.activities[h.activities.indexOf(old)] = values; else h.activities.push(values);
    validate(d); return values;
  }
  /** A whole-area chip becomes one stable activity, created only on first assignment. */
  function assign(d, pid, personId, chip, values, uid) {
    if (!chip || !['area', 'activity'].includes(chip.type) || !id(chip.id)) throw Error('Choose an MM area or activity from this project.');
    const h = data(d), p = h.people.find(p => p.id === personId && p.projectId === pid);
    if (!p) throw Error('The person no longer exists in this project.');
    let act;
    if (chip.type === 'area') {
      const a = area(d, pid, chip.id);
      act = h.activities.find(r => r.projectId === pid && r.areaId === a.id && r.kind === 'area');
      if (!act) { act = { id: uid(), projectId: pid, areaId: a.id, kind: 'area', name: 'Entire area', sourceMappingId: '' }; h.activities.push(act); }
    } else act = h.activities.find(r => r.id === chip.id && r.projectId === pid);
    if (!act) throw Error('This activity no longer exists in this project.');
    const role = values.role || 'Primary', scope = (values.scope || '').trim(), notes = (values.notes || '').trim();
    const duplicate = h.assignments.find(r => r.personId === p.id && r.activityId === act.id && r.role === role && key(r.scope) === key(scope) && r.id !== values.id);
    if (duplicate) {
      if (values.id) throw Error('Another assignment already uses that person, activity, role and scope.');
      return { assignment: duplicate, duplicate: true };
    }
    const old = values.id ? h.assignments.find(r => r.id === values.id && r.projectId === pid) : null;
    if (values.id && !old) throw Error('This assignment was removed. Reopen the person.');
    const r = { id: old?.id || uid(), projectId: pid, personId, activityId: act.id, role, scope, notes };
    if (old) h.assignments[h.assignments.indexOf(old)] = r; else h.assignments.push(r);
    validate(d); return { assignment: r, duplicate: false };
  }
  function removePerson(d, pid, id) {
    const h = data(d); records(d, pid);
    h.people = h.people.filter(p => p.id !== id || p.projectId !== pid);
    for (const p of h.people) if (p.projectId === pid && p.managerId === id) p.managerId = '';
    h.assignments = h.assignments.filter(r => r.personId !== id || r.projectId !== pid);
  }
  function removeActivity(d, pid, id) {
    const h = data(d); records(d, pid);
    h.activities = h.activities.filter(r => r.id !== id || r.projectId !== pid);
    h.assignments = h.assignments.filter(r => r.activityId !== id || r.projectId !== pid);
  }
  /** Arrange each reporting level in readable rows, including a large flat department. */
  function layout(people) {
    const ps = new Map(people.map(p => [p.id, p])), levels = new Map();
    for (const p of people) {
      let n = p, depth = 0; const visited = new Set([p.id]);
      while (n.managerId && ps.has(n.managerId)) {
        if (visited.has(n.managerId)) throw Error('Reporting lines cannot form a loop.');
        visited.add(n.managerId); n = ps.get(n.managerId); depth++;
      }
      if (!levels.has(depth)) levels.set(depth, []);
      levels.get(depth).push(p);
    }
    const result = [], widest = Math.max(1, ...[...levels.values()].map(rows => Math.min(5, rows.length))); let y = 56;
    for (const [, level] of [...levels].sort((a, b) => a[0] - b[0])) {
      level.sort((a, b) => (a.managerId + a.department + a.name).localeCompare(b.managerId + b.department + b.name));
      const columns = Math.min(5, level.length);
      const inset = (widest - columns) * (CARD.width + CARD.gap) / 2;
      for (let i = 0; i < level.length; i++) result.push({ id: level[i].id, x: 56 + inset + (i % columns) * (CARD.width + CARD.gap), y: y + Math.floor(i / columns) * (CARD.height + CARD.gap) });
      y += Math.ceil(level.length / columns) * (CARD.height + CARD.gap) + 32;
    }
    return result;
  }
  function bounds(people) {
    if (!people.length) return { x: 0, y: 0, width: 960, height: 620 };
    const x = Math.max(0, Math.min(...people.map(p => p.x)) - 40), y = Math.max(0, Math.min(...people.map(p => p.y)) - 40);
    return { x, y, width: Math.max(...people.map(p => p.x)) + CARD.width + 40 - x, height: Math.max(...people.map(p => p.y)) + CARD.height + 40 - y };
  }
  function nextPosition(people) {
    for (let i = 0; i < 600; i++) {
      const x = 56 + (i % 3) * (CARD.width + CARD.gap), y = 56 + Math.floor(i / 3) * (CARD.height + CARD.gap);
      if (!people.some(p => x < p.x + CARD.width + 20 && x + CARD.width + 20 > p.x && y < p.y + CARD.height + 20 && y + CARD.height + 20 > p.y)) return { x, y };
    }
    throw Error('Auto arrange the chart to make space for another person.');
  }
  function filter(d, pid, query = '', department = '', selectedArea = '', selectedActivity = '') {
    const r = records(d, pid), q = key(query), acts = new Map(r.activities.map(a => [a.id, a]));
    return r.people.filter(p => {
      const links = r.assignments.filter(r => r.personId === p.id);
      const names = links.map(r => activityLabel(d, acts.get(r.activityId)) + ' ' + r.role + ' ' + r.scope).join(' ');
      return (!department || p.department === department) && (!q || key([p.name, p.email, p.department, p.title, names].join(' ')).includes(q)) &&
        (!selectedArea || links.some(r => acts.get(r.activityId)?.areaId === selectedArea)) && (!selectedActivity || links.some(r => r.activityId === selectedActivity));
    });
  }
  function metrics(d, pid) {
    const r = records(d, pid), assigned = new Set(r.assignments.map(r => r.activityId));
    return { people: r.people.length, departments: new Set(r.people.map(p => p.department).filter(Boolean)).size, assignments: r.assignments.length,
      unassigned: r.activities.filter(r => !assigned.has(r.id) && r.kind === 'activity').length,
      areasWithoutPrimary: project(d, pid).mmAreas.filter(a => a.visible && !r.assignments.some(r => r.role === 'Primary' && data(d).activities.some(t => t.id === r.activityId && t.areaId === a.id))).length };
  }
  function sheets(d, pid) {
    validate(d);
    const p = project(d, pid), r = records(d, pid), ps = new Map(r.people.map(p => [p.id, p]));
    const acts = new Map(r.activities.map(r => [r.id, r])), assigned = new Set(r.assignments.map(r => r.activityId));
    return [
      { name: 'People', widths: [34, 34, 38, 30, 36, 24, 34, 38, 14], rows: [['Project', 'Name', 'Email', 'Department', 'Job title', 'Phone', 'Reports to', 'Manager email', 'Assignments'], ...r.people.map(x => [p.name, x.name, x.email, x.department, x.title, x.phone, ps.get(x.managerId)?.name || '', ps.get(x.managerId)?.email || '', r.assignments.filter(a => a.personId === x.id).length])] },
      { name: 'Responsibility Assignments', widths: [34, 30, 40, 18, 34, 38, 30, 24, 38, 70], rows: [['Project', 'MM area', 'Activity / area', 'Role', 'Person', 'Email', 'Department', 'Phone', 'Scope (company / plant / org)', 'Notes'], ...r.assignments.map(x => { const person = ps.get(x.personId), act = acts.get(x.activityId); return [p.name, area(d, pid, act.areaId).name, activityLabel(d, act), x.role, person.name, person.email, person.department, person.phone, x.scope, x.notes]; })] },
      { name: 'Unassigned Activities', widths: [34, 30, 44, 28], rows: [['Project', 'MM area', 'Activity', 'Coverage'], ...r.activities.filter(a => a.kind === 'activity' && !assigned.has(a.id)).map(a => [p.name, area(d, pid, a.areaId).name, a.name, 'No assigned person'])] },
      { name: 'Area Coverage', widths: [34, 30, 14, 34, 70, 70], rows: [['Project', 'MM area', 'Visible', 'Primary contacts', 'Other contacts', 'Coverage note'], ...p.mmAreas.map(a => {
        const links = r.assignments.filter(x => acts.get(x.activityId).areaId === a.id);
        const names = role => [...new Set(links.filter(x => role ? x.role === 'Primary' : x.role !== 'Primary').map(x => ps.get(x.personId).name))].join('; ');
        return [p.name, a.name, a.visible ? 'Yes' : 'Hidden', names(true), names(false), links.length ? 'Assignments may cover individual activities; check scope in Responsibility Assignments.' : 'No assignments in this area'];
      })] },
    ];
  }
  /** Reuse is an explicit copy into an empty destination, never a shared live directory. */
  function cloneSetup(d, sourceId, targetId, areaMap, uid) {
    if (sourceId === targetId) throw Error('Choose another project to copy.');
    const source = records(d, sourceId), target = records(d, targetId), h = data(d);
    if (target.people.length || target.activities.length || target.assignments.length) throw Error('Reuse a setup in an empty People & Responsibilities workspace.');
    const ids = new Map([...source.people, ...source.activities].map(r => [r.id, uid()]));
    for (const p of source.people) h.people.push({ ...p, id: ids.get(p.id), projectId: targetId, managerId: ids.get(p.managerId) || '' });
    for (const a of source.activities) { area(d, targetId, areaMap[a.areaId]); h.activities.push({ ...a, id: ids.get(a.id), projectId: targetId, areaId: areaMap[a.areaId], sourceMappingId: '' }); }
    for (const r of source.assignments) h.assignments.push({ ...r, id: uid(), projectId: targetId, personId: ids.get(r.personId), activityId: ids.get(r.activityId) });
    validate(d);
  }
  root.WorkHubProjectPeopleEngine = { ROLES, CARD, LIMITS, upgrade, validate, prepare, data, records, project, area, activityLabel, upsertPerson, upsertActivity, assign, removePerson, removeActivity, layout, bounds, nextPosition, filter, metrics, sheets, cloneSetup };
})(window);
