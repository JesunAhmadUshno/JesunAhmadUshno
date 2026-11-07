// Run: node --test scripts/lab.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardFromReadme, ciSummary, state, group, wilson, applyVote, tally, voteUrl, boardMd, judgeMd } from './lab.mjs';

test('dashboard link is the first URL on the live dashboard line', () => {
  assert.equal(dashboardFromReadme('# X\n**Live dashboard:** [jesunahmadushno.github.io/x](https://jesunahmadushno.github.io/x/), more'), 'https://jesunahmadushno.github.io/x/');
  assert.equal(dashboardFromReadme('<strong>Live dashboard: <a href="https://a.io/d/">x</a></strong>'), 'https://a.io/d/');
  assert.equal(dashboardFromReadme('**Live dashboard: https://a.io/lab/**.'), 'https://a.io/lab/');
  assert.equal(dashboardFromReadme('no link here'), null);
});

test('ci uses only the latest finished run of each workflow', () => {
  const s = ciSummary([
    { name: 'CI', status: 'in_progress', conclusion: null },
    { name: 'CI', status: 'completed', conclusion: 'success' },
    { name: 'CI', status: 'completed', conclusion: 'failure' },
    { name: 'Pages', status: 'completed', conclusion: 'failure' },
  ]);
  assert.deepEqual(s, { total: 2, passing: 1, failing: ['Pages'] });
});

test('state: down site or failing check needs attention', () => {
  assert.equal(state({ url: 'u', siteUp: true, ci: { failing: [] } }), 'live');
  assert.equal(state({ url: 'u', siteUp: false, ci: { failing: [] } }), 'attn');
  assert.equal(state({ url: 'u', siteUp: true, ci: { failing: ['CI'] } }), 'attn');
  assert.equal(state({ url: null, ci: { failing: [] } }), 'src');
});

test('group: archived split out, unplaced repos surface as other', () => {
  const g = group([{ name: 'a' }, { name: 'b', archived: true }, { name: 'c' }, { name: 'skip' }],
    { exclude: ['skip'], tracks: [{ id: 't', title: 'T', repos: ['a', 'b'] }] });
  assert.deepEqual(g.tracks[0].projects.map(p => p.name), ['a']);
  assert.deepEqual(g.archived.map(p => p.name), ['b']);
  assert.deepEqual(g.other.map(p => p.name), ['c']);
});

test('wilson interval matches the textbook value', () => {
  const [lo, hi] = wilson(8, 10);
  assert.ok(Math.abs(lo - 0.4902) < 1e-3 && Math.abs(hi - 0.9433) < 1e-3);
  assert.equal(wilson(0, 0), null);
});

test('one vote per person per case; a re-vote replaces, case-insensitively', () => {
  let v = applyVote({}, 'c1', 'Ann', 'agree');
  v = applyVote(v, 'c1', 'ann', 'disagree');
  v = applyVote(v, 'c1', 'bo', 'disagree');
  v = applyVote(v, 'c1', 'cy', 'agree');
  const t = tally(v);
  assert.deepEqual([t.total, t.agree, t.people, t.settled, t.matched], [3, 1, 3, 1, 0]);
});

test('vote link encodes a parseable title', () => {
  const u = new URL(voteUrl({ id: 'squad-1' }, 'agree'));
  assert.equal(u.searchParams.get('title'), 'judge: squad-1 agree');
});

test('markdown cells escape pipes and brackets from untrusted text', () => {
  const md = boardMd({ tracks: [{ title: 'T', projects: [{ name: 'a|b]', full_name: 'u/a', pushed_at: '2026-11-07T00:00:00Z', url: null, ci: { total: 0, failing: [] } }] }], archived: [] });
  assert.match(md, /a\\\|b\\\]/);
  const j = judgeMd({ source: { file: 'f', repo: 'r', commit: 'abcdef0', judge: 'j' }, cases: [{ n: 1, id: 'x', question: 'q | <script>', gold: 'g', answer: 'a', judge: 'PASS' }] }, {}, 0);
  assert.ok(!j.includes('<script>'));
});
