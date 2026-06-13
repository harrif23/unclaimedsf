// Smoke test: exercises the questionnaire helpers + match engine + ruleset together,
// the way the browser will. Not the grader (that's grade.mjs) — this checks the UI logic.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { matchAll } from '../app/src/match.js';
import { incomeQuestionsFor } from '../app/src/lib.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ruleset = JSON.parse(readFileSync(resolve(ROOT, 'data/ruleset.json'), 'utf8'));
const incomeInput = ruleset.inputs.find((i) => i.type === 'derived_boolean_per_threshold');

console.log('\nIncome questions a household of 4 would see (deduped by $ amount):');
for (const q of incomeQuestionsFor(ruleset, incomeInput, 4)) {
  console.log(`  $${q.amount.toLocaleString().padStart(6)}  ->  ${q.tables.join(', ')}`);
}

console.log('\nPersona: enrolled in CalFresh, household of 3 (the chaining reveal):');
for (const r of matchAll(ruleset, { sf_resident: true, enrolled_programs: ['calfresh'], household_size: 3 })) {
  const extra = r.status === 'partial' ? `(need: ${r.missing.join(', ')})` : (r.reasons[0] || '');
  console.log(`  ${r.status.toUpperCase().padEnd(8)} ${r.id.padEnd(14)} ${extra}`);
}
