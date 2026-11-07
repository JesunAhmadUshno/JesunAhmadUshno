// Pure rendering and scoring for the lab wall, the status board, the
// recently-shipped strip and the Judge the Judge panel. No network here:
// build-profile.mjs and vote.mjs feed it data, lab.test.mjs checks it.

export const PROFILE_REPO = 'JesunAhmadUshno/JesunAhmadUshno';
const RED = '#FF4655', AMBER = '#FFB547', DIM = '#9BA0AE', INK = '#F4F4F2';
const MONO = `'Courier New', monospace`, COND = `'Arial Narrow','Liberation Sans Narrow',sans-serif`;
const DAY = 86400000;

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mdText = s => String(s).replace(/[|\\`*_[\]<>]/g, c => '\\' + c).replace(/\s+/g, ' ').trim();

// First https URL on the first README line that mentions "live dashboard".
export function dashboardFromReadme(md) {
  const line = String(md || '').split('\n').find(l => /live dashboard/i.test(l));
  const m = line && line.match(/https:\/\/[^\s)"'<>\]]+/);
  return m ? m[0].replace(/[*.,;:!]+$/, '') : null;
}

// Latest run per workflow on the default branch; only finished runs count.
export function ciSummary(runs) {
  const latest = new Map();
  for (const r of runs) if (r.status === 'completed' && !latest.has(r.name)) latest.set(r.name, r.conclusion);
  const ok = c => ['success', 'skipped', 'neutral'].includes(c);
  const failing = [...latest].filter(([, c]) => !ok(c)).map(([n]) => n);
  return { total: latest.size, passing: latest.size - failing.length, failing };
}

// live: site answers 200 and nothing failing. attn: site down or a check failing. src: no site.
export function state(p) {
  if (p.siteUp === false || (p.ci && p.ci.failing.length)) return 'attn';
  return p.url ? 'live' : 'src';
}

export function group(repos, tracks) {
  const placed = new Set(tracks.tracks.flatMap(t => t.repos));
  const skip = new Set(tracks.exclude);
  const byName = new Map(repos.map(r => [r.name, r]));
  const out = tracks.tracks.map(t => ({ ...t, projects: t.repos.map(n => byName.get(n)).filter(r => r && !r.archived) }));
  const archived = repos.filter(r => r.archived && !skip.has(r.name));
  const other = repos.filter(r => !r.archived && !skip.has(r.name) && !placed.has(r.name));
  return { tracks: out, archived, other };
}

const ago = (iso, now) => Math.max(0, Math.floor((now - Date.parse(iso)) / DAY));

export function wallSvg(groups, now, checkedAt) {
  const cols = groups.tracks, W = 1200, colW = W / cols.length, rowH = 26, top = 140;
  const rows = Math.max(...cols.map(c => c.projects.length));
  const H = top + rows * rowH + 56;
  const all = cols.flatMap(c => c.projects);
  const count = s => all.filter(p => state(p) === s).length;
  const colour = { live: RED, attn: AMBER, src: 'none' };
  let body = '';
  cols.forEach((c, ci) => {
    const x = ci * colW + 16;
    const live = c.projects.filter(p => state(p) === 'live').length;
    const attn = c.projects.filter(p => state(p) === 'attn').length;
    body += `<text x="${x}" y="84" font-family="${COND}" font-weight="700" font-size="24" fill="${INK}">${esc(c.title.toUpperCase())}</text>`;
    body += `<text x="${x}" y="104" font-family="${MONO}" font-size="12" fill="${DIM}">${live} LIVE${attn ? ` / ${attn} ATTN` : ''} / ${c.projects.length}</text>`;
    c.projects.forEach((p, i) => {
      const y = top + i * rowH, s = state(p), fresh = ago(p.pushed_at, now) <= 7;
      const name = p.name.length > 23 ? p.name.slice(0, 22) + '.' : p.name;
      body += `<circle${fresh ? ` class="fresh" style="animation-delay:${(i * 0.21).toFixed(2)}s"` : ''} cx="${x + 5}" cy="${y - 4}" r="5" fill="${colour[s]}" stroke="${s === 'src' ? DIM : colour[s]}"/>`;
      body += `<text x="${x + 18}" y="${y}" font-family="${MONO}" font-size="12" fill="${s === 'src' ? DIM : INK}">${esc(name)}</text>`;
      body += `<text x="${x + colW - 28}" y="${y}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${DIM}">${ago(p.pushed_at, now)}d</text>`;
    });
  });
  const legendY = H - 22;
  const legend = `<g font-family="${MONO}" font-size="12" fill="${DIM}">` +
    `<circle cx="28" cy="${legendY - 4}" r="5" fill="${RED}"/><text x="40" y="${legendY}">LIVE, CHECKS GREEN</text>` +
    `<circle cx="228" cy="${legendY - 4}" r="5" fill="${AMBER}"/><text x="240" y="${legendY}">NEEDS ATTENTION</text>` +
    `<circle cx="408" cy="${legendY - 4}" r="5" fill="none" stroke="${DIM}"/><text x="420" y="${legendY}">CODE ONLY</text>` +
    `<text x="560" y="${legendY}">PULSE = SHIPPED THIS WEEK / Nd = DAYS SINCE LAST PUSH</text></g>`;
  const style = `<style>.fresh { animation: fresh 2.4s ease-in-out infinite; } @keyframes fresh { 0%, 100% { opacity: 1; } 50% { opacity: .3; } } .scan { animation: scan 9s linear infinite; } @keyframes scan { from { transform: translateY(0); } to { transform: translateY(${H}px); } } @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }</style>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Lab status: ${all.length} projects, ${count('live')} live with checks green, ${count('attn')} need attention">\n` +
    `<rect width="${W}" height="${H}" fill="#05060A"/>\n${style}\n` +
    `<text x="22" y="38" font-family="${MONO}" font-size="14" letter-spacing="2" fill="${RED}">LAB STATUS / ${all.length} PROJECTS / ${count('live')} LIVE / ${count('attn')} NEED ATTENTION / ${count('src')} CODE ONLY</text>` +
    `<text x="${W - 22}" y="38" text-anchor="end" font-family="${MONO}" font-size="12" fill="${DIM}">CHECKED ${esc(checkedAt)}</text>` +
    `<rect x="22" y="52" width="${W - 44}" height="1" fill="#262A38"/>\n${body}\n${legend}\n` +
    `<rect class="scan" x="0" y="0" width="${W}" height="2" fill="${RED}" opacity=".12"/>\n</svg>\n`;
}

const dot = { live: '🟢', attn: '🟠', src: '⚪' };
function row(p) {
  const site = p.url ? `[open](${p.url})` : '·';
  const up = p.url ? (p.siteUp ? '🟢 up' : '🟠 down') : '·';
  const ci = p.ci && p.ci.total ? `${p.ci.failing.length ? '🟠' : '🟢'} ${p.ci.passing}/${p.ci.total}${p.ci.failing.length ? ' (' + mdText(p.ci.failing.join(', ')) + ')' : ''}` : '·';
  return `| ${dot[state(p)]} [${mdText(p.name)}](https://github.com/${p.full_name}) | ${site} | ${up} | ${ci} | ${p.pushed_at.slice(0, 10)} |`;
}
const table = ps => `| Project | Live | Site | Checks | Updated |\n| :--- | :--- | :--- | :--- | :--- |\n${ps.map(row).join('\n')}`;

export function boardMd(groups) {
  const parts = groups.tracks.map((t, i) => {
    const live = t.projects.filter(p => state(p) === 'live').length;
    return `<details${i === 0 ? ' open' : ''}>\n<summary><b>${esc(t.title)}</b> · ${live} of ${t.projects.length} live</summary>\n\n${table(t.projects)}\n\n</details>`;
  });
  if (groups.archived.length) parts.push(`<details>\n<summary><b>Archive</b> · ${groups.archived.length} read-only projects</summary>\n\n${table(groups.archived)}\n\n</details>`);
  return parts.join('\n\n');
}

export function recentMd(groups, n = 5) {
  const all = [...groups.tracks.flatMap(t => t.projects), ...groups.archived];
  return all.sort((a, b) => b.pushed_at.localeCompare(a.pushed_at)).slice(0, n)
    .map(p => `- \`${p.pushed_at.slice(0, 10)}\` [${mdText(p.name)}](https://github.com/${p.full_name})${p.url ? ` · [live](${p.url})` : ''}`).join('\n');
}

// Wilson score interval, 95%.
export function wilson(k, n) {
  if (!n) return null;
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

// votes: { caseId: { login: 'agree' | 'disagree' } }. One vote per person per case; a new vote replaces the old.
export function applyVote(votes, caseId, login, choice) {
  const next = structuredClone(votes);
  (next[caseId] ||= {})[login.toLowerCase()] = choice;
  return next;
}

export function tally(votes) {
  let agree = 0, total = 0, settled = 0, matched = 0;
  const people = new Set();
  for (const per of Object.values(votes)) {
    const vs = Object.entries(per);
    vs.forEach(([who]) => people.add(who));
    const a = vs.filter(([, c]) => c === 'agree').length;
    agree += a; total += vs.length;
    if (vs.length >= 3 && a !== vs.length - a) { settled++; if (a > vs.length - a) matched++; }
  }
  return { agree, total, people: people.size, settled, matched, ci: wilson(agree, total) };
}

export const caseOfDay = (cases, now) => cases[Math.floor(now / DAY) % cases.length];

export function voteUrl(c, choice) {
  const title = encodeURIComponent(`judge: ${c.id} ${choice}`);
  const body = encodeURIComponent('Press "Submit new issue" to cast this vote. A bot records it within a minute, replies with the running tally, and closes the issue.');
  return `https://github.com/${PROFILE_REPO}/issues/new?title=${title}&body=${body}`;
}

const pct = x => `${Math.round(x * 100)}%`;
export function judgeMd(data, votes, now) {
  const c = caseOfDay(data.cases, now), t = tally(votes), mine = votes[c.id] || {};
  const a = Object.values(mine).filter(v => v === 'agree').length, d = Object.values(mine).length - a;
  const s = data.source;
  const lines = [
    `**Case ${c.n} of ${data.cases.length}** · a new case every day`,
    '',
    `> **Question:** ${mdText(c.question)}<br>`,
    `> **Reference answer:** ${mdText(c.gold)}<br>`,
    `> **System answered:** ${mdText(c.answer)}<br>`,
    `> **The judge said:** **${c.judge}**`,
    '',
    `Is the judge right? &nbsp; [**Yes, the judge is right**](${voteUrl(c, 'agree')}) &nbsp;·&nbsp; [**No, the judge is wrong**](${voteUrl(c, 'disagree')})`,
    '',
    `This case so far: ${a} agree, ${d} disagree.`,
    '',
    t.total
      ? `**Across all cases:** ${t.total} votes from ${t.people} ${t.people === 1 ? 'person' : 'people'}. People agree with the judge ${pct(t.agree / t.total)} of the time (95% Wilson interval ${pct(t.ci[0])} to ${pct(t.ci[1])}; votes by the same person are not independent, so read the interval as approximate). Cases settled by at least 3 votes with a clear majority: ${t.settled}, and the judge matched the majority on ${t.matched}.`
      : `**Across all cases:** no votes yet. The first vote starts the record.`,
    '',
    `<sub>Cases: ${data.cases.length} fixed SQuAD items (15 the judge passed, 15 it failed, chosen by id hash) from [${s.file}](https://github.com/${s.repo}/blob/${s.commit}/${s.file}) at \`${s.commit.slice(0, 7)}\`. Judge: ${esc(s.judge)}. Votes live in [data/votes.json](data/votes.json), one per GitHub account per case.</sub>`,
  ];
  return lines.join('\n');
}

export function swapBlock(md, tag, inner) {
  const re = new RegExp(`(<!--PROFILE:${tag}-->)[\\s\\S]*?(<!--/PROFILE:${tag}-->)`);
  if (!re.test(md)) throw new Error(`marker PROFILE:${tag} missing in README.md`);
  return md.replace(re, (_, a, b) => `${a}\n${inner}\n${b}`);
}
