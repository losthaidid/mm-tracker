/** Build the searchable reading catalog. Long chapters are served individually when opened. */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';

const learning = new URL('../learning/', import.meta.url);
const json = async name => JSON.parse(await readFile(new URL(name, learning), 'utf8'));
const text = value => typeof value === 'string' && !!value.trim();
const words = value => value.trim().split(/\s+/u);
const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const digest = value => createHash('sha256').update(value).digest('hex');
const tiers = ['Practitioner', 'Advanced', 'Expert'];
const original = await json('mm-101.json');
const areaList = await json('mm-101-areas.json');
const areas = new Map(areaList.map(area => [area.id, area]));
const shelves = new Set(original.map(c => c.shelf));
const ids = new Set(original.map(c => c.id));
const titles = new Map(original.map(c => [normalize(c.title), c.id]));
const paragraphs = new Map();
const counts = Object.fromEntries(tiers.map(t => [t, 0]));
const covered = new Set();
const entries = [];
let wordTotal = 0;

function requireThat(condition, message) {
  if (!condition) throw Error(message);
}
function isReference(row) {
  if (!Array.isArray(row) || row.length !== 2 || !row.every(text)) return false;
  try {
    const u = new URL(row[1]);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}
function isSapReference([,link]) {
  return /^(?:.+\.)?sap\.com$/i.test(new URL(link).hostname);
}
function checkVisual(c) {
  const v = c.visual;
  requireThat(v && text(v.title) && Array.isArray(v.headers) && v.headers.length >= 2 &&
    v.headers.every(text) && Array.isArray(v.rows) && v.rows.length >= 2 &&
    v.rows.every(row => Array.isArray(row) && row.length === v.headers.length && row.every(text)),
    c.id + ' needs a complete worked table.');
  if (c.flow) requireThat(Array.isArray(c.flow) && c.flow.length >= 2 && c.flow.every(text), c.id + ' has an incomplete flow.');
  if (c.chart) {
    const [title, unit, values] = c.chart;
    requireThat(text(title) && text(unit) && Array.isArray(values) && values.length > 0 &&
      values.every(([label,n]) => text(label) && Number.isFinite(n) && n >= 0), c.id + ' has an invalid chart.');
  }
}
function indexChapter(c, raw, tier, file) {
  const source = tier + '/' + file;
  requireThat(/^[a-z0-9][a-z0-9-]{0,99}$/.test(c.id) && file === c.id + '.json' &&
    !ids.has(c.id), source + ' needs a distinct stable chapter ID.');
  requireThat(c.level === tier && shelves.has(c.shelf) && areas.has(c.area), source + ' needs a valid level, shelf and subject area.');
  requireThat([c.title,c.lead,c.topic].every(text) && !titles.has(normalize(c.title)), source + ' needs a distinct title and an introduction.');
  requireThat(Array.isArray(c.keywords) && c.keywords.length && c.keywords.every(text), source + ' needs search terms.');
  requireThat(Array.isArray(c.sections) && c.sections.length >= 2 &&
    c.sections.every(s => Array.isArray(s) && s.length === 2 && s.every(text)), source + ' has an incomplete section.');
  requireThat(Array.isArray(c.refs) && c.refs.length && c.refs.every(isReference) &&
    c.refs.some(isSapReference), source + ' needs a primary SAP reference.');
  checkVisual(c);
  const prose = [c.lead, ...c.sections.map(([,body]) => body)].join('\n\n');
  const count = words(prose).length;
  requireThat(count >= 1500 && count <= 2500, source + ' has ' + count + ' prose words (target 1500–2500).');
  for (const para of prose.split(/\n\s*\n/u)) {
    if (words(para).length < 45) continue;
    const key = digest(normalize(para));
    requireThat(!paragraphs.has(key), source + ' repeats a substantial passage from ' + paragraphs.get(key));
    paragraphs.set(key, source);
  }
  const sapTerms = prose.match(/\b[A-Z][A-Z0-9_/-]{2,24}\b/g) || [];
  const terms = [...new Set([...c.keywords, ...c.sections.map(([heading]) => heading), ...sapTerms])];
  ids.add(c.id);
  titles.set(normalize(c.title), c.id);
  covered.add(c.area);
  counts[tier]++;
  requireThat(counts[tier] <= 1000, tier + ' exceeds the approved number of chapters.');
  wordTotal += count;
  return {
    id:c.id, level:tier, shelf:c.shelf, area:areas.get(c.area).name, topic:c.topic, title:c.title,
    lead:c.lead.length > 240 ? c.lead.slice(0,237).replace(/\s+\S*$/u,'') + '…' : c.lead,
    terms:terms.join(' '), words:count, revision:digest(raw).slice(0,16),
  };
}
const readTier = async tier => {
  const dir = new URL('mm-101-chapters/' + tier.toLowerCase() + '/', learning);
  let names;
  try { names = await readdir(dir); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const rows = [];
  for (const file of names.filter(file => file.endsWith('.json')).sort()) {
    const raw = await readFile(new URL(file,dir),'utf8');
    rows.push(indexChapter(JSON.parse(raw),raw,tier,file));
  }
  return rows;
};
for (const tier of tiers) entries.push(...await readTier(tier));
entries.sort((a,b) => a.area.localeCompare(b.area, 'en') || a.title.localeCompare(b.title, 'en'));
const catalog = '[\n' + [...original, ...entries].map(row => JSON.stringify(row)).join(',\n') + '\n]\n';
const out = new URL('mm-101-index.json',learning);
if (process.argv.includes('--check') || process.argv.includes('--release')) {
  requireThat(await readFile(out,'utf8') === catalog, 'The reading index is out of date. Run node scripts/mm-101-catalog.mjs.');
} else {
  await writeFile(out,catalog);
}
console.log(JSON.stringify({existing:original.length, newChapters:entries.length, levels:counts, proseWords:wordTotal,
  areasWithChapters:covered.size, documentedAreas:areas.size}));
if (process.argv.includes('--release')) {
  requireThat(tiers.every(tier => counts[tier] === 1000), 'Single-release target: 1000 new chapters in each of the three levels.');
  const missing = areaList.filter(a => !covered.has(a.id)).map(a => a.name);
  requireThat(!missing.length,'Subject areas still awaiting coverage: ' + missing.join(', '));
}
