// Regenerates the living panels of this profile from real data.
// Run by .github/workflows/profile.yml on a schedule and on demand.
// Fail closed: if any GitHub read fails, this script exits non-zero
// before writing anything, so the published panels never go partial
// or guessed. Sources: the account's public data through the GitHub
// API, and data/roadmap.json in this repository for the ledger grid.

import fs from 'node:fs/promises';

const USER = process.env.PROFILE_USER || 'JesunAhmadUshno';
const TOKEN = process.env.GITHUB_TOKEN;

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'profile-panel-builder',
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

function ledgerSvg(projects, dark) {
  const W = 1200, cellW = 102, cellH = 62, gapX = 8, gapY = 10, cols = 10;
  const rows = Math.ceil(projects.length / cols);
  const H = rows * cellH + (rows - 1) * gapY + 8;
  const c = dark
    ? { fillBg: '#ECEEE9', fillFg: '#0C0F12', openStroke: '#3A4046', openFg: '#9AA1A8' }
    : { fillBg: '#101418', fillFg: '#FBFBF9', openStroke: '#C9CBC2', openFg: '#5F6459' };
  let cells = '';
  projects.forEach((p, i) => {
    const x = 4 + (i % cols) * (cellW + gapX);
    const y = 4 + Math.floor(i / cols) * (cellH + gapY);
    if (p.v1) {
      cells += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${c.fillBg}"/><text x="${x + cellW / 2}" y="${y + 39}" text-anchor="middle" font-family="'Segoe UI', Helvetica, Arial, sans-serif" font-size="21" fill="${c.fillFg}">${p.id}</text>`;
    } else {
      cells += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="none" stroke="${c.openStroke}"/><text x="${x + cellW / 2}" y="${y + 39}" text-anchor="middle" font-family="'Segoe UI', Helvetica, Arial, sans-serif" font-size="21" fill="${c.openFg}">${p.id}</text>`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Roadmap ledger: ${projects.filter(p => p.v1).length} of ${projects.length} projects at v1.0">\n${cells}\n</svg>\n`;
}

function swapBlock(md, tag, inner) {
  const re = new RegExp(`(<!--PROFILE:${tag}-->)[\\s\\S]*?(<!--/PROFILE:${tag}-->)`);
  if (!re.test(md)) throw new Error(`marker PROFILE:${tag} missing in README.md`);
  return md.replace(re, `$1\n${inner}\n$2`);
}

const user = await api(`/users/${USER}`);
const search = await api(`/search/issues?q=${encodeURIComponent(`author:${USER} type:pr is:merged`)}&per_page=1`);
const repos = user.public_repos;
const merged = search.total_count;
if (!Number.isInteger(repos) || !Number.isInteger(merged)) throw new Error('unexpected API shape');

const roadmap = JSON.parse(await fs.readFile('data/roadmap.json', 'utf8'));
const projects = roadmap.projects;
const atV1 = projects.filter(p => p.v1).length;

await fs.writeFile('assets/ledger-light.svg', ledgerSvg(projects, false));
await fs.writeFile('assets/ledger-dark.svg', ledgerSvg(projects, true));

const today = new Date().toISOString().slice(0, 10);
let md = await fs.readFile('README.md', 'utf8');
md = swapBlock(md, 'ROADMAP', `${atV1} of ${projects.length} projects at v1.0.`);
md = swapBlock(md, 'CONTRIBUTION', `${repos} public repositories. ${merged} merged pull requests.`);
md = swapBlock(md, 'PROVENANCE', `Panels regenerated on ${today} by the [profile workflow](.github/workflows/profile.yml). Counts are read from GitHub by that workflow, never typed by hand.`);
await fs.writeFile('README.md', md);
console.log(`panels rebuilt: repos=${repos} mergedPRs=${merged} roadmap=${atV1}/${projects.length}`);
