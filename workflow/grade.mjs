// Grader - Phase 4 of the compile workflow, also runnable standalone.
// Runs the SAME engine the browser ships (app/src/match.js) over every case in
// data/test-cases.json against data/ruleset.json. Exit 0 if all pass, else 1.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { matchProgram } from '../app/src/match.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ruleset = JSON.parse(readFileSync(resolve(root, 'data/ruleset.json'), 'utf8'));
const suite = JSON.parse(readFileSync(resolve(root, 'data/test-cases.json'), 'utf8'));
const byId = Object.fromEntries(ruleset.programs.map((p) => [p.id, p]));

const setEq = (a = [], b = []) => {
  const A = [...new Set(a)].sort();
  const B = [...new Set(b)].sort();
  return A.length === B.length && A.every((x, i) => x === B[i]);
};

let passed = 0;
const failures = [];

for (const c of suite.cases) {
  const problems = [];
  for (const [pid, wantStatus] of Object.entries(c.expect)) {
    const prog = byId[pid];
    if (!prog) { problems.push(`'${pid}' not in ruleset`); continue; }
    const res = matchProgram(prog, c.answers);
    if (res.status !== wantStatus) problems.push(`${pid}: got status "${res.status}", expected "${wantStatus}"`);
    const wantMissing = c.expectMissing?.[pid];
    if (wantMissing && !setEq(res.missing, wantMissing))
      problems.push(`${pid}: got missing [${[...res.missing].sort()}], expected [${[...wantMissing].sort()}]`);
    const wantTier = c.expectTier?.[pid];
    if (wantTier && res.benefitText !== wantTier)
      problems.push(`${pid}: got tier "${res.benefitText}", expected "${wantTier}"`);
  }
  if (problems.length) failures.push({ id: c.id, problems });
  else passed++;
}

const total = suite.cases.length;
console.log(`\nGrading ${total} cases  (ruleset: ${ruleset.meta?.graderStatus || 'unknown'})\n`);
for (const f of failures) {
  console.log(`  FAIL ${f.id}`);
  for (const p of f.problems) console.log(`      - ${p}`);
}
console.log(`\n${passed}/${total} passed${failures.length ? `  (${failures.length} FAILED)` : '  ALL GREEN'}\n`);
process.exit(failures.length ? 1 : 0);
