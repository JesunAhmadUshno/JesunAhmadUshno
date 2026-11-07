// Pre-commit checks for the profile. Any failure blocks the commit,
// locally and in the profile workflow. Mirrors the refresh brief:
// no dash characters beyond the hyphen, no hype words, neither of the
// two excluded brand names in any form, no third-party card services,
// and every relative image path must resolve inside this repository.
import fs from 'node:fs/promises';

const files = ['README.md', 'assets/lab-wall.svg', 'assets/hero.svg', 'assets/ledger-light.svg', 'assets/ledger-dark.svg', 'assets/divider.svg', 'assets/footer.svg'];
const bannedWords = ['pioneer', 'premium', 'cutting-edge', 'world-class',
  'enterprise-grade', 'production-grade', 'passionate', 'innovative',
  'seamless', 'revolutionary', 'game-changing', 'rockstar', 'ninja', 'guru'];
const bannedHosts = ['img.shields.io', 'github-readme-stats', 'komarev.com',
  'readme-typing-svg', 'github-profile-trophy'];
let fail = 0;
for (const f of files) {
  let text;
  try { text = await fs.readFile(f, 'utf8'); } catch { continue; }
  if (text.includes('\u2014') || text.includes('\u2013')) { console.error(`${f}: dash character found`); fail = 1; }
  const lower = text.toLowerCase();
  for (const w of bannedWords) if (lower.includes(w)) { console.error(`${f}: banned word "${w}"`); fail = 1; }
  if (/jesun[\s.\-_]?ai\b/.test(lower) || /jesun[\s.\-_]?code\b/.test(lower)) { console.error(`${f}: excluded brand name found`); fail = 1; }
  for (const h of bannedHosts) if (lower.includes(h)) { console.error(`${f}: third-party host ${h}`); fail = 1; }
  for (const m of text.matchAll(/srcset="([^"]+)"|src="([^"]+)"/g)) {
    const p = m[1] || m[2];
    if (p && !p.startsWith('http')) {
      try { await fs.access(p); } catch { console.error(`${f}: image path does not resolve: ${p}`); fail = 1; }
    }
  }
}
if (fail) process.exit(1);
console.log('profile checks pass');
