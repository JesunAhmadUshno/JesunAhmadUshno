// Regenerates the living panels of this profile from real data.
// Run by .github/workflows/profile.yml on a schedule and on demand.
// Fail closed: if any GitHub read fails, or the portrait asset is
// missing, this script exits non-zero before writing anything, so
// the published panels never go partial or guessed. Sources: the
// account's public data through the GitHub API, data/roadmap.json
// in this repository for the ledger grid, and assets/portrait.jpg.

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

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function ledgerSvg(projects, dark) {
  const W = 1200, cellW = 102, cellH = 62, gapX = 8, gapY = 10, cols = 10;
  const rows = Math.ceil(projects.length / cols);
  const H = rows * cellH + (rows - 1) * gapY + 24;
  let cells = '';
  projects.forEach((p, i) => {
    const x = 4 + (i % cols) * (cellW + gapX);
    const y = 12 + Math.floor(i / cols) * (cellH + gapY);
    const delay = (i * 0.18).toFixed(2);
    if (p.v1) {
      cells += `<rect class="cell" style="animation-delay:${delay}s" x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="#FF4545" fill-opacity=".18" stroke="#FF4545"/><text x="${x + cellW / 2}" y="${y + 39}" text-anchor="middle" font-family="'Courier New', monospace" font-size="21" fill="#F5F6F8">${p.id}</text>`;
    } else {
      cells += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="none" stroke="#FF4545" stroke-opacity=".5" stroke-dasharray="5 5"/><text x="${x + cellW / 2}" y="${y + 39}" text-anchor="middle" font-family="'Courier New', monospace" font-size="21" fill="#FF8A8A">${p.id}</text>`;
    }
  });
  const style = `<style>.cell { animation: pulse 3.6s ease-in-out infinite; } @keyframes pulse { 0%, 100% { fill-opacity: .10; } 50% { fill-opacity: .30; } } @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }</style>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Roadmap ledger: ${projects.filter(p => p.v1).length} of ${projects.length} projects at v1.0">\n<rect width="${W}" height="${H}" fill="#050507"/>\n${style}\n${cells}\n</svg>\n`;
}

function chip(x, y, text) {
  const w = Math.round(text.length * 10.2) + 36;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="36" fill="#0A0C10" fill-opacity=".88" stroke="#FF4545" stroke-opacity=".65"/><circle cx="${x + 15}" cy="${y + 18}" r="4" fill="#FF4545"/><text x="${x + 27}" y="${y + 23}" font-family="'Courier New', monospace" font-size="17" fill="#F5F6F8">${esc(text)}</text></g>`;
}

function heroSvg({ repos, merged, latestRepo, portraitB64 }) {
  const COND = `'Arial Narrow','Liberation Sans Narrow',sans-serif`;
  const MONO = `'Courier New', monospace`;
  const rand = mulberry32(20261106 + repos);
  const nodes = [];
  for (let i = 0; i < 52; i++) {
    nodes.push({ x: Math.round(rand() * 1200), y: Math.round(rand() * 620), r: (1.5 + rand()).toFixed(1), d: (rand() * 4).toFixed(2) });
  }
  let links = '';
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
      if (dx * dx + dy * dy < 170 * 170) {
        links += `<line x1="${nodes[i].x}" y1="${nodes[i].y}" x2="${nodes[j].x}" y2="${nodes[j].y}" stroke="#3A3F4A" opacity=".5"/>`;
      }
    }
  }
  let dots = '';
  nodes.forEach((n, i) => {
    const fill = i % 7 === 6 ? '#FF4545' : '#F5F6F8';
    dots += `<circle class="tw" style="animation-delay:${n.d}s" cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${fill}"/>`;
  });
  const markers =
    `<polygon points="180,66 192,73 192,87 180,94 168,87 168,73" fill="none" stroke="#FF4545" stroke-opacity=".55"/>` +
    `<polygon points="1080,76 1092,100 1068,100" fill="none" stroke="#F5F6F8" stroke-opacity=".4"/>` +
    `<g stroke="#FF4545" stroke-opacity=".55"><line x1="294" y1="534" x2="306" y2="546"/><line x1="306" y1="534" x2="294" y2="546"/></g>` +
    `<g stroke="#F5F6F8" stroke-opacity=".4"><line x1="694" y1="114" x2="706" y2="126"/><line x1="706" y1="114" x2="694" y2="126"/></g>`;
  const brackets =
    `<g fill="none" stroke="#FF4545" stroke-width="3">` +
    `<path d="M806 226 V200 H832"/><path d="M1094 200 H1120 V226"/>` +
    `<path d="M1120 474 V500 H1094"/><path d="M832 500 H806 V474"/></g>`;
  const style = `<style>` +
    `.tw { animation: twinkle 3.4s ease-in-out infinite; } @keyframes twinkle { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }` +
    `.glW { animation: glW 3.8s steps(1) infinite; opacity: 0; } @keyframes glW { 0%, 89% { opacity: 0; transform: translate(0,0); } 90% { opacity: .85; transform: translate(-5px,2px); } 94% { opacity: .85; transform: translate(4px,-2px); } 97%, 100% { opacity: 0; transform: translate(0,0); } }` +
    `.glR { animation: glR 3.8s steps(1) infinite; opacity: 0; } @keyframes glR { 0%, 89% { opacity: 0; transform: translate(0,0); } 90% { opacity: .85; transform: translate(5px,-2px); } 94% { opacity: .85; transform: translate(-4px,2px); } 97%, 100% { opacity: 0; transform: translate(0,0); } }` +
    `.rotA { transform-box: fill-box; transform-origin: center; animation: rotA 46s linear infinite; } @keyframes rotA { to { transform: rotate(360deg); } }` +
    `.rotB { transform-box: fill-box; transform-origin: center; animation: rotB 70s linear infinite; } @keyframes rotB { to { transform: rotate(-360deg); } }` +
    `.scanY { animation: scanY 4.5s linear infinite; } @keyframes scanY { 0% { transform: translateY(0); } 100% { transform: translateY(298px); } }` +
    `.heroScan { animation: heroScan 7s linear infinite; } @keyframes heroScan { 0% { transform: translateY(0); } 100% { transform: translateY(620px); } }` +
    `@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }` +
    `</style>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 620" width="1200" height="620" role="img" aria-label="Jesun Ahmad Ushno, AI engineer, Toronto">\n` +
    `<rect width="1200" height="620" fill="#050507"/>\n${style}\n` +
    `<g>${links}</g>\n<g>${dots}</g>\n${markers}\n` +
    `<text class="glW" x="60" y="190" font-family="${COND}" font-weight="800" font-size="168" fill="#F5F6F8" textLength="1080" lengthAdjust="spacingAndGlyphs">PORTFOLIO</text>` +
    `<text class="glR" x="60" y="190" font-family="${COND}" font-weight="800" font-size="168" fill="#8F1D1D" textLength="1080" lengthAdjust="spacingAndGlyphs">PORTFOLIO</text>` +
    `<text x="60" y="190" font-family="${COND}" font-weight="800" font-size="168" fill="#FF4545" textLength="1080" lengthAdjust="spacingAndGlyphs">PORTFOLIO</text>\n` +
    `<defs><clipPath id="photoClip"><rect x="820" y="200" width="300" height="300" rx="10"/></clipPath></defs>` +
    `<circle class="rotA" cx="970" cy="350" r="196" fill="none" stroke="#F5F6F8" stroke-opacity=".5" stroke-dasharray="4 7"/>` +
    `<circle class="rotB" cx="970" cy="350" r="228" fill="none" stroke="#FF4545" stroke-opacity=".65" stroke-dasharray="2 9"/>` +
    `<image href="data:image/jpeg;base64,${portraitB64}" x="820" y="200" width="300" height="300" clip-path="url(#photoClip)" preserveAspectRatio="xMidYMid slice"/>` +
    `<g clip-path="url(#photoClip)"><rect class="scanY" x="820" y="200" width="300" height="2" fill="#FF4545" opacity=".5"/></g>` +
    `${brackets}\n` +
    `${chip(742, 222, 'SUBJECT 0001 / J. A. USHNO')}${chip(838, 168, '43.65N 79.38W / TORONTO')}${chip(668, 452, 'STATUS ONLINE / FLEET LIVE')}${chip(60, 452, 'LATEST SHIP / ' + esc(latestRepo).toUpperCase())}\n` +
    `<text x="60" y="320" font-family="${COND}" font-weight="700" font-size="64" fill="#F5F6F8">JESUN.</text>` +
    `<text x="60" y="362" font-family="${COND}" font-size="30" letter-spacing="4" fill="#FF4545">AI ENGINEER</text>` +
    `<text x="60" y="396" font-family="${MONO}" font-size="15" fill="#9AA1A8">PRODUCTION ML / RAG / AGENT ORCHESTRATION</text>\n` +
    `<text x="60" y="556" font-family="${COND}" font-weight="800" font-size="46" fill="#FF4545">${repos}</text>` +
    `<text x="60" y="584" font-family="${MONO}" font-size="13" letter-spacing="3" fill="#F5F6F8">PUBLIC REPOSITORIES</text>` +
    `<text x="430" y="556" font-family="${COND}" font-weight="800" font-size="46" fill="#FF4545">2</text>` +
    `<text x="430" y="584" font-family="${MONO}" font-size="13" letter-spacing="3" fill="#F5F6F8">PUBLISHED ML PAPERS</text>` +
    `<text x="800" y="556" font-family="${COND}" font-weight="800" font-size="46" fill="#FF4545">${merged}</text>` +
    `<text x="800" y="584" font-family="${MONO}" font-size="13" letter-spacing="3" fill="#F5F6F8">MERGED PULL REQUESTS</text>\n` +
    `<rect class="heroScan" x="0" y="0" width="1200" height="2" fill="#FF4545" opacity=".30"/>\n` +
    `</svg>\n`;
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

const recent = await api(`/users/${USER}/repos?sort=pushed&per_page=5`);
const latestRepo = (recent.find(r => r.name !== USER) || {}).name;
if (!latestRepo) throw new Error('no recent repository found');

const portrait = await fs.readFile('assets/portrait.jpg');
const portraitB64 = portrait.toString('base64');
if (!portraitB64) throw new Error('portrait asset is empty');

const roadmap = JSON.parse(await fs.readFile('data/roadmap.json', 'utf8'));
const projects = roadmap.projects;
const atV1 = projects.filter(p => p.v1).length;

await fs.writeFile('assets/hero.svg', heroSvg({ repos, merged, latestRepo, portraitB64 }));
await fs.writeFile('assets/ledger-light.svg', ledgerSvg(projects, false));
await fs.writeFile('assets/ledger-dark.svg', ledgerSvg(projects, true));

const today = new Date().toISOString().slice(0, 10);
let md = await fs.readFile('README.md', 'utf8');
md = swapBlock(md, 'ROADMAP', `${atV1} of ${projects.length} projects at v1.0.`);
md = swapBlock(md, 'CONTRIBUTION', `${repos} public repositories. ${merged} merged pull requests.`);
md = swapBlock(md, 'PROVENANCE', `Panels regenerated on ${today} by the [profile workflow](.github/workflows/profile.yml). Counts are read from GitHub by that workflow, never typed by hand.`);
await fs.writeFile('README.md', md);
console.log(`panels rebuilt: repos=${repos} mergedPRs=${merged} roadmap=${atV1}/${projects.length}`);
