// Handles one "judge: <case id> agree|disagree" issue from a visitor.
// Run by .github/workflows/judge-vote.yml on issues opened. The issue
// title is untrusted: it is read from the event file here, never from
// the shell, and must match the exact pattern below. Valid votes update
// data/votes.json and the README panel; every judge issue gets a reply
// and is closed. Accounts younger than 7 days are not counted.
import fs from 'node:fs/promises';
import { applyVote, judgeMd, tally, swapBlock, PROFILE_REPO } from './lab.mjs';

const TOKEN = process.env.GITHUB_TOKEN;
async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'judge-vote', authorization: `Bearer ${TOKEN}`, ...(init.body ? { 'content-type': 'application/json' } : {}) },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const event = JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
const issue = event.issue;
const data = JSON.parse(await fs.readFile('data/judge-cases.json', 'utf8'));
const m = /^judge: ([a-z0-9-]{1,64}) (agree|disagree)$/.exec(issue.title.trim());
const known = m && data.cases.find(c => c.id === m[1]);

let reply;
if (!known) {
  reply = 'I could not read a vote from this title. Use one of the vote links on the profile page; they fill the title in for you.';
} else if (issue.user.type !== 'User') {
  reply = 'Only personal accounts can vote.';
} else {
  const user = await gh(`/users/${encodeURIComponent(issue.user.login)}`);
  if (Date.now() - Date.parse(user.created_at) < 7 * 86400000) {
    reply = 'Thanks. Accounts younger than 7 days are not counted, to keep the record honest.';
  } else {
    const votes = applyVote(JSON.parse(await fs.readFile('data/votes.json', 'utf8')), known.id, issue.user.login, m[2]);
    await fs.writeFile('data/votes.json', JSON.stringify(votes, null, 1) + '\n');
    let md = await fs.readFile('README.md', 'utf8');
    await fs.writeFile('README.md', swapBlock(md, 'JUDGE', judgeMd(data, votes, Date.now())));
    const t = tally(votes);
    reply = `Recorded: you ${m[2]} with the judge on case ${known.n} (the judge said ${known.judge}). Running record: ${t.total} ${t.total === 1 ? 'vote' : 'votes'} from ${t.people} ${t.people === 1 ? 'person' : 'people'}, ${Math.round(100 * t.agree / t.total)}% agreeing with the judge. Thank you for being part of the check.`;
  }
}
await gh(`/repos/${PROFILE_REPO}/issues/${issue.number}/comments`, { method: 'POST', body: JSON.stringify({ body: reply }) });
await gh(`/repos/${PROFILE_REPO}/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: known ? 'completed' : 'not_planned' }) });
console.log(reply);
