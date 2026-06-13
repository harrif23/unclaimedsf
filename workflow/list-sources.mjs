// Prints every link referenced in the compiled data, for human verification.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const rs = J('data/ruleset.json');
const impact = J('data/impact.json');
const progs = J('data/programs.json');

console.log('\n=== RULESET: per-program source + apply links ===');
for (const p of rs.programs) {
  console.log(`\n${p.name}  [${p.id}]  verdict: ${p.source?.verdict || '-'}`);
  console.log(`  rule source : ${p.source?.url}  (${p.source?.effectiveDate})`);
  console.log(`  apply       : ${p.applyUrl}`);
}

console.log('\n=== RULESET: threshold-table sources (where the $ figures came from) ===');
for (const [id, t] of Object.entries(rs.thresholdTables)) {
  console.log(`  ${id.padEnd(22)} ${t.source?.url}`);
}

console.log('\n=== IMPACT stat source ===');
console.log(`  ${impact.source?.url}`);

console.log('\n=== programs.json seed sources (incl. stretch + alternates) ===');
for (const p of [...progs.core, ...progs.stretch]) {
  console.log(`\n${p.name}  [${p.id}]${progs.stretch.includes(p) ? '  (stretch)' : ''}`);
  for (const s of p.sources) console.log(`  - ${s.url}${s.note ? `  (${s.note})` : ''}`);
}
