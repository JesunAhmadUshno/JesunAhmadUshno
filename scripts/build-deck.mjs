// Regenerates assets/deck.svg from live GitHub data.
// Run by .github/workflows/deck.yml on a schedule, so the profile reports
// what is actually true at render time rather than what was true when it
// was written by hand.
//
// Starfield geometry is seeded from a constant so only the live numbers
// change between runs, keeping the commit diffs small and readable.

import fs from 'node:fs/promises';

const USER = process.env.PROFILE_USER || 'JesunAhmadUshno';
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = 'assets/deck.svg';

// The orbitals are curated, not ranked. Star count alone would surface a
// one-star scaffold over real work, so the flagships are named here and the
// build only pulls their live stats. Any that vanish are backfilled by
// recency, skipping the profile repo and anything with no substance in it.
const FEATURED = [
  'PRISM',
  'BigFish',
  'NoPara',
  'TriDrop',
  'dingdong-bms',
  'SonicClear-AI-Studio-Grade-Audio-Enhancer',
];

const EXCLUDE = new Set([
  USER, // the profile repo itself
  'AI-WRITTER-BY-THETRIMATRIXLAB',
  'Linux-Files',
  'Indoor-Localisation-Using-Unity-AR',
  'podcast-test',
  'SecureStep',
  'skills-introduction-to-github',
]);

// Display names for labels whose real names do not fit their chip or orbital.
const LANG_ALIAS = { 'Jupyter Notebook': 'Jupyter' };
const REPO_ALIAS = { 'SonicClear-AI-Studio-Grade-Audio-Enhancer': 'SonicClear' };

/* ------------------------------------------------------------------ data */

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'profile-deck-builder',
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function collect() {
  const repos = [];
  for (let page = 1; page <= 4; page++) {
    const batch = await api(`/users/${USER}/repos?per_page=100&page=${page}&sort=pushed`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }

  const own = repos.filter((r) => !r.fork && !r.archived);
  const stars = repos.reduce((s, r) => s + r.stargazers_count, 0);

  const langCount = new Map();
  for (const r of own) {
    if (!r.language) continue;
    langCount.set(r.language, (langCount.get(r.language) || 0) + 1);
  }
  const languages = [...langCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Orbital bodies: the curated flagships in order, then recency backfill.
  const byName = new Map(own.map((r) => [r.name, r]));
  const bodies = FEATURED.map((n) => byName.get(n)).filter(Boolean);

  if (bodies.length < 6) {
    const taken = new Set(bodies.map((r) => r.name));
    const backfill = own
      .filter((r) => !taken.has(r.name) && !EXCLUDE.has(r.name) && r.description)
      .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
    bodies.push(...backfill.slice(0, 6 - bodies.length));
  }

  const lastPush = own.reduce((m, r) => (r.pushed_at > m ? r.pushed_at : m), '');

  return { total: repos.length, own: own.length, stars, languages, bodies, lastPush };
}

/* -------------------------------------------------------------- starfield */

function mulberry(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function starfield(count, w, h) {
  const rnd = mulberry(20260913);
  const out = [];
  for (let i = 0; i < count; i++) {
    const x = +(rnd() * w).toFixed(1);
    const y = +(rnd() * h).toFixed(1);
    const r = +(rnd() * 1.15 + 0.25).toFixed(2);
    const o = +(rnd() * 0.65 + 0.12).toFixed(2);
    if (rnd() > 0.9) {
      const dur = +(rnd() * 4 + 2.5).toFixed(1);
      out.push(
        `<circle cx="${x}" cy="${y}" r="${r}" fill="#cbd5e1" opacity="${o}">` +
          `<animate attributeName="opacity" values="${o};${(o * 0.15).toFixed(2)};${o}" dur="${dur}s" repeatCount="indefinite"/></circle>`
      );
    } else {
      out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#94a3b8" opacity="${o}"/>`);
    }
  }
  return out.join('');
}

/* ------------------------------------------------------------------ svg */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PALETTE = ['#67e8f9', '#5eead4', '#fbbf24', '#a78bfa', '#f472b6', '#4ade80'];

function orbitals(bodies) {
  const cx = 600;
  const cy = 268;
  let defs = '';
  let rings = '';
  let planets = '';

  bodies.forEach((repo, i) => {
    const rx = 78 + i * 34;
    const ry = Math.round(rx * 0.42);
    const dur = 16 + i * 9;
    const color = PALETTE[i % PALETTE.length];
    const id = `orb${i}`;

    defs +=
      `<path id="${id}" fill="none" d="M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0"/>`;

    rings +=
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${color}" ` +
      `stroke-width="1" opacity="${(0.3 - i * 0.03).toFixed(2)}"/>`;

    const size = Math.max(3.2, 6 - i * 0.45);
    planets +=
      `<g>` +
      `<animateMotion dur="${dur}s" repeatCount="indefinite" rotate="0"><mpath xlink:href="#${id}"/></animateMotion>` +
      `<circle r="${size + 4}" fill="${color}" opacity="0.16"/>` +
      `<circle r="${size}" fill="${color}" filter="url(#soft)"/>` +
      `<text class="mono" x="0" y="${-size - 8}" font-size="9.5" letter-spacing="1.2" ` +
      `fill="${color}" text-anchor="middle" opacity="0.95">${esc(REPO_ALIAS[repo.name] || repo.name.slice(0, 22))}</text>` +
      `</g>`;
  });

  return { defs, rings, planets };
}

function render(d) {
  const W = 1200;
  const H = 560;
  const { defs, rings, planets } = orbitals(d.bodies);
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  const langChips = d.languages
    .map(([raw, n], i) => {
      const name = LANG_ALIAS[raw] || raw;
      const x = 52 + (i % 3) * 118;
      const y = 402 + Math.floor(i / 3) * 30;
      const c = PALETTE[i % PALETTE.length];
      return (
        `<g transform="translate(${x} ${y})">` +
        `<rect width="110" height="22" rx="3" fill="#020609" stroke="${c}" stroke-opacity="0.5"/>` +
        `<circle cx="11" cy="11" r="3.2" fill="${c}"/>` +
        `<text class="mono" x="22" y="15" font-size="9" letter-spacing="1" fill="#94a3b8">${esc(name.slice(0, 11))} ${n}</text>` +
        `</g>`
      );
    })
    .join('');

  const ticker = d.bodies.map((r) => esc((REPO_ALIAS[r.name] || r.name).toUpperCase())).join('  ◆  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Live orchestration deck for ${esc(USER)}.">
<defs>
<radialGradient id="space" cx="0.5" cy="0.48" r="0.75">
<stop offset="0" stop-color="#071426"/><stop offset="0.55" stop-color="#03070f"/><stop offset="1" stop-color="#000103"/>
</radialGradient>
<linearGradient id="cyan" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#22d3ee"/><stop offset="0.5" stop-color="#67e8f9"/><stop offset="1" stop-color="#2dd4bf"/>
</linearGradient>
<linearGradient id="sweep" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#22d3ee" stop-opacity="0"/><stop offset="1" stop-color="#a5f3fc" stop-opacity="0.65"/>
</linearGradient>
<radialGradient id="corona"><stop offset="0" stop-color="#a5f3fc" stop-opacity="0.85"/><stop offset="0.45" stop-color="#22d3ee" stop-opacity="0.28"/><stop offset="1" stop-color="#0891b2" stop-opacity="0"/></radialGradient>
<radialGradient id="vig" cx="0.5" cy="0.5" r="0.8"><stop offset="0.42" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.82"/></radialGradient>
<filter id="glow" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="3.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="soft" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<clipPath id="frame"><rect width="${W}" height="${H}" rx="10"/></clipPath>
<clipPath id="tick"><rect x="40" y="512" width="1120" height="26"/></clipPath>
<clipPath id="tA"><rect x="52" y="236" width="0" height="26"><animate attributeName="width" values="0;0;330" keyTimes="0;0.14;0.42" dur="9s" repeatCount="indefinite"/></rect></clipPath>
${defs}
<style>
.mono{font-family:ui-monospace,"SFMono-Regular","SF Mono",Menlo,Consolas,"Liberation Mono",monospace}
.blink{animation:bl 1.05s steps(1) infinite}@keyframes bl{0%,49%{opacity:1}50%,100%{opacity:0}}
.flick{animation:fl 6s ease-in-out infinite}@keyframes fl{0%,92%,100%{opacity:1}93%{opacity:.5}94.5%{opacity:1}96%{opacity:.72}97%{opacity:1}}
.pulse{animation:pu 2.6s ease-in-out infinite}@keyframes pu{0%,100%{opacity:.35}50%{opacity:1}}
</style>
</defs>
<g clip-path="url(#frame)">
<rect width="${W}" height="${H}" fill="url(#space)"/>
${starfield(150, W, H)}

<line x1="0" y1="44" x2="${W}" y2="44" stroke="#0e7490" opacity="0.45"/>
<text class="mono" x="40" y="29" font-size="11" letter-spacing="3" fill="#0e7490">ORCHESTRATION DECK // LIVE TELEMETRY</text>
<circle cx="1006" cy="25" r="3.5" fill="#4ade80" class="pulse"/>
<text class="mono" x="1020" y="29" font-size="11" letter-spacing="3" fill="#4ade80">SYNCED ${esc(stamp)}</text>

<!-- orbital system -->
<circle cx="600" cy="268" r="118" fill="url(#corona)" opacity="0.55"><animate attributeName="opacity" values="0.35;0.7;0.35" dur="5s" repeatCount="indefinite"/></circle>
${rings}
<g filter="url(#glow)">
<polygon points="600,244 620,256 620,280 600,292 580,280 580,256" fill="#022c34" stroke="#67e8f9" stroke-width="1.6"/>
<polygon points="600,253 612,260 612,276 600,283 588,276 588,260" fill="#0891b2" opacity="0.55"><animate attributeName="opacity" values="0.25;0.9;0.25" dur="2.8s" repeatCount="indefinite"/></polygon>
</g>
${planets}

<!-- identity -->
<rect x="34" y="84" width="2" height="290" fill="url(#cyan)" opacity="0.6"/>
<text class="mono" x="52" y="110" font-size="11" letter-spacing="3.4" fill="#0e7490">OPERATOR // CLEARANCE: ROOT</text>
<g class="flick">
<text class="mono" x="50" y="158" font-size="35" font-weight="700" fill="url(#cyan)" filter="url(#glow)">JESUN AHMAD</text>
<text class="mono" x="50" y="196" font-size="35" font-weight="700" fill="url(#cyan)" filter="url(#glow)">USHNO</text>
</g>
<g clip-path="url(#tA)"><text class="mono" x="52" y="255" font-size="15" fill="#94a3b8"><tspan fill="#2dd4bf">&gt;</tspan> orchestrating agent fleets</text></g>
<rect x="360" y="240" width="8" height="17" fill="#67e8f9" class="blink"/>

<!-- live counters -->
<g class="mono">
<text x="52" y="300" font-size="9" letter-spacing="2" fill="#134e4a">REPOSITORIES</text>
<text x="52" y="330" font-size="30" font-weight="700" fill="#a5f3fc" filter="url(#soft)">${d.total}</text>
<text x="160" y="300" font-size="9" letter-spacing="2" fill="#134e4a">AUTHORED</text>
<text x="160" y="330" font-size="30" font-weight="700" fill="#5eead4" filter="url(#soft)">${d.own}</text>
<text x="268" y="300" font-size="9" letter-spacing="2" fill="#134e4a">STARS</text>
<text x="268" y="330" font-size="30" font-weight="700" fill="#fbbf24" filter="url(#soft)">${d.stars}</text>
<text x="52" y="364" font-size="9" letter-spacing="2" fill="#134e4a">LAST DEPLOY &#183; ${esc((d.lastPush || '').slice(0, 10))}</text>
<text x="52" y="392" font-size="9" letter-spacing="2" fill="#134e4a">LANGUAGE DISTRIBUTION</text>
</g>
${langChips}

<!-- status rail -->
<g class="mono" font-size="10" letter-spacing="1.8">
<g transform="translate(880 400)"><rect width="122" height="24" rx="3" fill="#022c34" stroke="#0e7490"/><text x="61" y="16" fill="#5eead4" text-anchor="middle">LOCAL-FIRST</text></g>
<g transform="translate(1012 400)"><rect width="122" height="24" rx="3" fill="#1c1408" stroke="#b45309"/><text x="61" y="16" fill="#fbbf24" text-anchor="middle">MULTI-AGENT</text></g>
<g transform="translate(880 432)"><rect width="122" height="24" rx="3" fill="#022c34" stroke="#0e7490"/><text x="61" y="16" fill="#5eead4" text-anchor="middle">ZERO-TRUST</text></g>
<g transform="translate(1012 432)"><rect width="122" height="24" rx="3" fill="#022c1a" stroke="#15803d"/><text x="61" y="16" fill="#4ade80" text-anchor="middle">EGRESS DENY</text></g>
</g>

<rect x="0" y="-70" width="${W}" height="70" fill="url(#sweep)" opacity="0.28"><animate attributeName="y" values="-70;${H}" dur="6s" repeatCount="indefinite"/></rect>

<line x1="0" y1="502" x2="${W}" y2="502" stroke="#0e7490" opacity="0.45"/>
<g clip-path="url(#tick)"><g><animateTransform attributeName="transform" type="translate" from="1160 0" to="-1500 0" dur="24s" repeatCount="indefinite"/>
<text class="mono" x="0" y="530" font-size="11" letter-spacing="2.4" fill="#0e7490">${ticker}  ◆  EGRESS DENY ALL  ◆  SHA-256 ANCHORED  ◆  AUTO / SIGNOFF / ANCHORED</text></g></g>

<rect width="${W}" height="${H}" fill="url(#vig)"/>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="none" stroke="#155e75"/>
</g>
</svg>
`;
}

/* ----------------------------------------------------------------- main */

const data = await collect();
await fs.mkdir('assets', { recursive: true });
await fs.writeFile(OUT, render(data), 'utf8');

console.log(
  `deck rebuilt: ${data.total} repos, ${data.own} authored, ${data.stars} stars, ` +
    `${data.bodies.length} orbitals, last push ${data.lastPush.slice(0, 10)}`
);
