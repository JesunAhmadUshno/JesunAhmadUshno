// One-off, reproducible: picks the Judge the Judge cases from the
// rag-eval-harness run of record. Usage:
//   node scripts/extract-cases.mjs <path to rag-eval-harness checkout>
// Source: real-data/results_real.json, SQuAD, span answers, no rerank.
// Picks 15 cases the judge passed and 15 it failed, ordered by a hash of
// the case id, so the set is fixed and not hand-chosen.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.argv[2];
if (!root) throw new Error('usage: extract-cases.mjs <rag-eval-harness dir>');
const file = 'real-data/results_real.json';
const run = JSON.parse(fs.readFileSync(`${root}/${file}`, 'utf8')).datasets.squad.span_without_rerank;
const commit = execFileSync('git', ['-C', root, 'log', '-1', '--format=%H', '--', file]).toString().trim();
const h = id => crypto.createHash('sha256').update(id).digest('hex');
const usable = run.results.filter(r => r.system_answer.trim() && r.question.length <= 140 && r.gold_answer.length <= 80);
const pick = pass => usable.filter(r => r.model_judge_pass === pass).sort((a, b) => h(a.id) < h(b.id) ? -1 : 1).slice(0, 15);
const cases = [...pick(true), ...pick(false)].sort((a, b) => h(a.id) < h(b.id) ? -1 : 1).map((r, i) => ({
  n: i + 1,
  id: r.id,
  question: r.question,
  gold: r.gold_answer,
  answer: r.system_answer.trim(),
  judge: r.model_judge_pass ? 'PASS' : 'FAIL',
}));
fs.writeFileSync('data/judge-cases.json', JSON.stringify({
  source: { repo: 'JesunAhmadUshno/rag-eval-harness', file, commit, run: 'datasets.squad.span_without_rerank', judge: 'embedding judge, minishlab/potion-base-8M' },
  cases,
}, null, 1) + '\n');
console.log(`wrote ${cases.length} cases from ${commit.slice(0, 7)}`);
