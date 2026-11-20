// Builds the public Literature Watch page from the paper files in content/.
// Netlify runs this automatically (see netlify.toml). No packages needed.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const out = path.join(root, 'dist');
const tabs = ['latest', 'sentinel-head-neck', 'sentinel-thyroid'];

// Netlify sets CONTEXT: 'production' for the live site, 'deploy-preview' for draft previews.
// On the live site the main Literature Watch tab only shows clinician-reviewed papers.
// Previews show everything, so reviewers can see a draft card before it goes live.
const isLive = (process.env.CONTEXT || 'production') === 'production';
const reviewedOnly = ['latest'];

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
    .filter(p => !(isLive && reviewedOnly.includes(tab) && !p.reviewed))
    .sort((a, b) => (a.order || 9999) - (b.order || 9999) || String(b.date).localeCompare(String(a.date)))
    .map(toPage);
}

const safe = d => JSON.stringify(d).replace(/</g, '\\u003c');
let html = fs.readFileSync(path.join(root, 'src', 'template.html'), 'utf8');
tabs.forEach(t => { html = html.replace(`/*DATA:${t}*/`, safe(loadTab(t))); });
html = html.replace('/*DATA:trials*/', safe(JSON.parse(fs.readFileSync(path.join(root, 'content', 'trials.json'), 'utf8'))));
if (html.includes('/*DATA:')) throw new Error('A data placeholder was not filled');
html = html.replace("'No papers appraised yet'", "'New papers appear here once they have been clinician reviewed.'");
// "Also on the radar" lists stay in draft previews for reviewers but are left off the live site.
if (isLive) {
  html = html.replace(/\s*<section class="radar"[\s\S]*?<\/section>/g, '');
}
if (!isLive) {
  html = html.replace(/<body([^>]*)>/, '<body$1><div style="background:#fff3cd;color:#664d03;padding:8px 14px;font:14px system-ui;text-align:center">Preview only: includes cards awaiting clinician review. Not the live site.</div>');
}

fs.mkdirSync(path.join(out, 'admin'), { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
['index.html', 'config.yml'].forEach(f => fs.copyFileSync(path.join(root, 'admin', f), path.join(out, 'admin', f)));
console.log((isLive ? 'LIVE' : 'PREVIEW') + ' build:', tabs.map(t => `${t}: ${loadTab(t).length}`).join(', '));
