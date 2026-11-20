// Builds the public Literature Watch page from the paper files in content/.
// Netlify runs this automatically (see netlify.toml). No packages needed.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const out = path.join(root, 'dist');
const tabs = ['latest', 'sentinel-head-neck', 'sentinel-thyroid'];

function toPage(p) {
  const pico = {};
  (p.pico || []).forEach(x => { pico[x.label] = x.text || ''; });
  const appraisal = {};
  (p.appraisal || []).forEach(s => {
    appraisal[s.heading] = (s.points && s.points.length) ? s.points : (s.text || '');
  });
  const page = {
    id: p.id, site: p.site, discipline: p.discipline || [], type: p.type,
    depth: p.depth || 'full', reviewed: !!p.reviewed, journal: p.journal || '',
    date: p.date, added: p.added || p.date, title: p.title, authors: p.authors || '',
    doi: p.doi || '', pmid: p.pmid || '', pico,
    bottom: p.bottom || '',
    checks: (p.checks || []).map(c => [c.label, c.answer]),
    appraisal
  };
  if (p.flag) page.flag = p.flag;
  if (p.related && p.related.length) page.related = p.related;
  return page;
}

function loadTab(tab) {
  const dir = path.join(root, 'content', tab);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => (a.order || 9999) - (b.order || 9999) || String(b.date).localeCompare(String(a.date)))
    .map(toPage);
}

const safe = d => JSON.stringify(d).replace(/</g, '\\u003c');
let html = fs.readFileSync(path.join(root, 'src', 'template.html'), 'utf8');
tabs.forEach(t => { html = html.replace(`/*DATA:${t}*/`, safe(loadTab(t))); });
html = html.replace('/*DATA:trials*/', safe(JSON.parse(fs.readFileSync(path.join(root, 'content', 'trials.json'), 'utf8'))));
if (html.includes('/*DATA:')) throw new Error('A data placeholder was not filled');

fs.mkdirSync(path.join(out, 'admin'), { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
['index.html', 'config.yml'].forEach(f => fs.copyFileSync(path.join(root, 'admin', f), path.join(out, 'admin', f)));
console.log('Built dist/index.html with', tabs.map(t => `${t}: ${loadTab(t).length}`).join(', '));
