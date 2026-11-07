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
      cells += `<rect class="cell" style="animation-delay:${delay}s" x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="#FF4655" fill-opacity=".18" stroke="#FF4655"/><text x="${x + cellW / 2}" y="${y + 39}" text-anchor="middle" font-family="'Courier New', monospace" font-size="21" fill="#F5F6F8">${p.id}</text>`;
    } else {
      cells += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="none" stroke="#FF4655" stroke-opacity=".5" stroke-dasharray="5 5"/><text x="${x + cellW / 2}" y="${y + 39}" text-anchor="middle" font-family="'Courier New', monospace" font-size="21" fill="#FF8A8A">${p.id}</text>`;
    }
  });
  const style = `<style>.cell { animation: pulse 3.6s ease-in-out infinite; } @keyframes pulse { 0%, 100% { fill-opacity: .10; } 50% { fill-opacity: .30; } } @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }</style>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Roadmap ledger: ${projects.filter(p => p.v1).length} of ${projects.length} projects at v1.0">\n<rect width="${W}" height="${H}" fill="#050507"/>\n${style}\n${cells}\n</svg>\n`;
}

function chip(x, y, text) {
  const w = Math.round(text.length * 10.2) + 36;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="36" fill="#0A0C10" fill-opacity=".88" stroke="#FF4655" stroke-opacity=".65"/><circle cx="${x + 15}" cy="${y + 18}" r="4" fill="#FF4655"/><text x="${x + 27}" y="${y + 23}" font-family="'Courier New', monospace" font-size="17" fill="#F5F6F8">${esc(text)}</text></g>`;
}

function heroSvg({ repos, merged, latestRepo, portraitB64, wordmark }) {
  const COND = `'Arial Narrow','Liberation Sans Narrow',sans-serif`;
  const MONO = `'Courier New', monospace`;
  const RED = '#FF4655';
  const seed = 20261106 + repos;
  function layer(seedValue, count, linkDist, stroke, op) {
    const rand = mulberry32(seedValue);
    const ns = [];
    for (let i = 0; i < count; i++) ns.push({ x: Math.round(rand() * 1200), y: Math.round(rand() * 540), r: (1.4 + rand()).toFixed(1), d: (rand() * 4).toFixed(2) });
    let lk = '';
    for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
      const dx = ns[i].x - ns[j].x, dy = ns[i].y - ns[j].y;
      if (dx * dx + dy * dy < linkDist * linkDist) lk += `<line x1="${ns[i].x}" y1="${ns[i].y}" x2="${ns[j].x}" y2="${ns[j].y}" stroke="${stroke}" opacity="${op}"/>`;
    }
    let dt = '';
    ns.forEach((n, i) => { dt += `<circle class="tw" style="animation-delay:${n.d}s" cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${i % 7 === 6 ? RED : '#F4F4F2'}"/>`; });
    return `<g>${lk}</g><g>${dt}</g>`;
  }
  const markers =
    `<polygon points="150,52 161,58 161,71 150,77 139,71 139,58" fill="none" stroke="${RED}" stroke-opacity=".55"/>` +
    `<polygon points="1090,54 1101,76 1079,76" fill="none" stroke="#F4F4F2" stroke-opacity=".4"/>` +
    `<g stroke="${RED}" stroke-opacity=".55"><line x1="324" y1="446" x2="336" y2="458"/><line x1="336" y1="446" x2="324" y2="458"/></g>` +
    `<g stroke="#F4F4F2" stroke-opacity=".4"><line x1="684" y1="104" x2="696" y2="116"/><line x1="696" y1="104" x2="684" y2="116"/></g>`;
  const k = 1080 / wordmark.width;
  const s = wordmark.scale;
  function letters(fill, animated) {
    return wordmark.letters.map((l, i) => {
      const path = `<path d="${l.d}" fill="${fill}"/>`;
      const inner = animated ? `<g class="wl" style="animation-delay:${(i * 0.09).toFixed(2)}s">${path}</g>` : path;
      return `<g transform="translate(${(l.x * k).toFixed(1)},0) scale(${(k * s).toFixed(4)},${(-k * s).toFixed(4)})">${inner}</g>`;
    }).join('');
  }
  const word =
    `<g transform="translate(60,205)">` +
    `<g class="glW">${letters('#F4F4F2', false)}</g>` +
    `<g class="glR">${letters('#7A1420', false)}</g>` +
    `<g>${letters('url(#gradRed)', true)}</g></g>`;
  let eq = '';
  for (let i = 0; i < 14; i++) eq += `<rect class="eq" style="animation-delay:${(i * 0.13).toFixed(2)}s" x="18" y="${248 + i * 13}" width="14" height="3" fill="${RED}"/>`;
  const brackets =
    `<g fill="none" stroke="${RED}" stroke-width="3" class="brk">` +
    `<path d="M836 226 V198 H864"/><path d="M1096 198 H1124 V226"/>` +
    `<path d="M1124 458 V486 H1096"/><path d="M864 486 H836 V458"/></g>`;
  const style = `<style>` +
    `.tw { animation: twinkle 3.4s ease-in-out infinite; } @keyframes twinkle { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }` +
    `.driftA { animation: driftA 26s ease-in-out infinite; } @keyframes driftA { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-26px); } }` +
    `.driftB { animation: driftB 19s ease-in-out infinite; } @keyframes driftB { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(20px); } }` +
    `.spinC { animation: spinC 10s linear infinite; } @keyframes spinC { to { transform: rotate(360deg); } }` +
    `.ring { animation: ring 4.8s linear infinite; opacity: 0; } @keyframes ring { 0% { transform: scale(.45); opacity: .45; } 100% { transform: scale(1.9); opacity: 0; } }` +
    `.wl { animation: wlwave 7s linear infinite; } @keyframes wlwave { 0%, 76%, 100% { transform: translateY(0); } 82% { transform: translateY(-70px); } 88% { transform: translateY(14px); } 94% { transform: translateY(0); } }` +
    `.glW { animation: glW 3.8s steps(1) infinite; opacity: 0; } @keyframes glW { 0%, 89% { opacity: 0; transform: translate(0,0); } 90% { opacity: .85; transform: translate(-5px,2px); } 94% { opacity: .85; transform: translate(4px,-2px); } 97%, 100% { opacity: 0; transform: translate(0,0); } }` +
    `.glR { animation: glR 3.8s steps(1) infinite; opacity: 0; } @keyframes glR { 0%, 89% { opacity: 0; transform: translate(0,0); } 90% { opacity: .85; transform: translate(5px,-2px); } 94% { opacity: .85; transform: translate(-4px,2px); } 97%, 100% { opacity: 0; transform: translate(0,0); } }` +
    `.rotA { transform-box: fill-box; transform-origin: center; animation: rotA 40s linear infinite; } @keyframes rotA { to { transform: rotate(360deg); } }` +
    `.rotB { transform-box: fill-box; transform-origin: center; animation: rotB 64s linear infinite; } @keyframes rotB { to { transform: rotate(-360deg); } }` +
    `.scanY { animation: scanY 4.5s linear infinite; } @keyframes scanY { 0% { transform: translateY(0); } 100% { transform: translateY(258px); } }` +
    `.heroScan { animation: heroScan 8s linear infinite; } @keyframes heroScan { 0% { transform: translateY(0); } 100% { transform: translateY(540px); } }` +
    `.sweepX { animation: sweepX 6.5s linear infinite; } @keyframes sweepX { 0% { transform: translateX(-240px); } 100% { transform: translateX(1100px); } }` +
    `.eq { transform-box: fill-box; transform-origin: left center; animation: eq 2.6s ease-in-out infinite; } @keyframes eq { 0%, 100% { transform: scaleX(.35); opacity: .45; } 50% { transform: scaleX(1); opacity: .9; } }` +
    `.brk { animation: brk 3s ease-in-out infinite; } @keyframes brk { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }` +
    `@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }` +
    `</style>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 540" width="1200" height="540" role="img" aria-label="Jesun Ahmad Ushno, AI engineer, Toronto">\n` +
    `<rect width="1200" height="540" fill="#05060A"/>\n` +
    `<defs><linearGradient id="gradRed" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E8323F"/><stop offset="1" stop-color="#FF5964"/></linearGradient>` +
    `<clipPath id="photoClip"><rect x="850" y="212" width="260" height="260" rx="10"/></clipPath></defs>\n${style}\n` +
    `<g class="driftA">${layer(20261106, 30, 150, '#2E3442', '.45')}</g>` +
    `<g class="driftB">${layer(seed, 24, 170, '#3A3F4A', '.55')}</g>\n${markers}\n` +
    `<g class="spinC" style="transform-box: view-box; transform-origin: 980px 342px"><path d="M980,342 L980,72 A270,270 0 0 1 1135,160 Z" fill="${RED}" opacity=".06"/><line x1="980" y1="342" x2="980" y2="72" stroke="${RED}" opacity=".3"/></g>` +
    `<circle class="ring" style="transform-box: view-box; transform-origin: 980px 342px" cx="980" cy="342" r="120" fill="none" stroke="${RED}"/>` +
    `<circle class="ring" style="transform-box: view-box; transform-origin: 980px 342px; animation-delay:2.4s" cx="980" cy="342" r="120" fill="none" stroke="${RED}"/>\n` +
    `${word}\n` +
    `<rect x="60" y="222" width="1080" height="2" fill="#262A38"/><rect class="sweepX" x="60" y="222" width="220" height="2" fill="${RED}" opacity=".8"/>\n` +
    `<circle class="rotA" cx="980" cy="342" r="152" fill="none" stroke="#F4F4F2" stroke-opacity=".5" stroke-dasharray="4 7"/>` +
    `<circle class="rotB" cx="980" cy="342" r="178" fill="none" stroke="${RED}" stroke-opacity=".65" stroke-dasharray="2 9"/>` +
    `<image href="data:image/jpeg;base64,${portraitB64}" x="850" y="212" width="260" height="260" clip-path="url(#photoClip)" preserveAspectRatio="xMidYMid slice"/>` +
    `<g clip-path="url(#photoClip)"><rect class="scanY" x="850" y="212" width="260" height="2" fill="${RED}" opacity=".5"/></g>\n` +
    `${brackets}\n${eq}\n` +
    `${chip(770, 232, 'SUBJECT 0001 / J. A. USHNO')}${chip(512, 300, '43.65N 79.38W / TORONTO')}${chip(676, 396, 'STATUS ONLINE / FLEET LIVE')}${chip(60, 406, 'LATEST SHIP / ' + esc(latestRepo).toUpperCase())}\n` +
    `<text x="60" y="306" font-family="${COND}" font-weight="700" font-size="56" fill="#F4F4F2">JESUN.</text>` +
    `<text x="60" y="340" font-family="${COND}" font-size="26" letter-spacing="5" fill="${RED}">AI ENGINEER</text>` +
    `<text x="60" y="368" font-family="${MONO}" font-size="14" fill="#9BA0AE">PRODUCTION ML / RAG / AGENT ORCHESTRATION</text>\n` +
    `<text x="60" y="498" font-family="${COND}" font-weight="800" font-size="44" fill="${RED}">${repos}</text>` +
    `<text x="60" y="522" font-family="${MONO}" font-size="12" letter-spacing="3" fill="#F4F4F2">PUBLIC REPOSITORIES</text>` +
    `<text x="430" y="498" font-family="${COND}" font-weight="800" font-size="44" fill="${RED}">2</text>` +
    `<text x="430" y="522" font-family="${MONO}" font-size="12" letter-spacing="3" fill="#F4F4F2">PUBLISHED ML PAPERS</text>` +
    `<text x="800" y="498" font-family="${COND}" font-weight="800" font-size="44" fill="${RED}">${merged}</text>` +
    `<text x="800" y="522" font-family="${MONO}" font-size="12" letter-spacing="3" fill="#F4F4F2">MERGED PULL REQUESTS</text>\n` +
    `<rect class="heroScan" x="0" y="0" width="1200" height="2" fill="${RED}" opacity=".18"/>\n` +
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
const wordmark = JSON.parse(await fs.readFile('assets/wordmark-paths.json', 'utf8'));
const projects = roadmap.projects;
const atV1 = projects.filter(p => p.v1).length;

await fs.writeFile('assets/hero.svg', heroSvg({ repos, merged, latestRepo, portraitB64, wordmark }));
await fs.writeFile('assets/ledger-light.svg', ledgerSvg(projects, false));
await fs.writeFile('assets/ledger-dark.svg', ledgerSvg(projects, true));

const today = new Date().toISOString().slice(0, 10);
let md = await fs.readFile('README.md', 'utf8');
md = swapBlock(md, 'ROADMAP', `${atV1} of ${projects.length} projects at v1.0.`);
md = swapBlock(md, 'CONTRIBUTION', `${repos} public repositories. ${merged} merged pull requests.`);
md = swapBlock(md, 'PROVENANCE', `Panels regenerated on ${today} by the [profile workflow](.github/workflows/profile.yml). Counts are read from GitHub by that workflow, never typed by hand.`);
await fs.writeFile('README.md', md);
console.log(`panels rebuilt: repos=${repos} mergedPRs=${merged} roadmap=${atV1}/${projects.length}`);
