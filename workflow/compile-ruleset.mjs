#!/usr/bin/env node
/**
 * compile-ruleset.mjs - Public Works rule-compilation workflow (Half A).
 *
 * The rerunnable orchestration the demo saves as a /command. Point it at a different
 * city's data/programs.json and it recompiles with NO code changes.
 *
 * Per program in data/programs.json:
 *   1. EXTRACT - one subagent reads the official source(s) and emits rules in the
 *                ruleset schema (extractPrompt).
 *   2. VERIFY  - a second, INDEPENDENT subagent re-derives from the source and
 *                challenges the extraction: AGREE | DISAGREE + diffs (verifyPrompt).
 *   3. COMPILE - merge only verified rules into data/ruleset.json (compile).
 *   4. GRADE   - run workflow/grade.mjs (the SAME match.js the browser ships).
 *
 * The fan-out (steps 1-2) is run by the Claude Code workflow runtime, which provides
 * runAgent(role, prompt). Invoke the whole thing with the `ultracode` keyword (prompt
 * in PLAN.md) or `node workflow/compile-ruleset.mjs` under the agent runtime. Steps
 * 3-4 are plain deterministic Node and run anywhere.
 *
 * Design rule: the eligibility TREE SHAPE for each program is fixed by us (a product
 * decision - a deterministic screen) and pinned in programs.json; agents fill in the
 * verified threshold tables, ruleText, sources, and caveats. Disagreements are
 * surfaced (verdict: DISAGREE-reconciled), never silently merged.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

const SCHEMA = `Node types: { "any": [...] } (OR), { "all": [...] } (AND).
Leaf types: { "income": "<thresholdTableId>", "ruleText": "..." } |
            { "enrolledAny": ["calfresh","medi_cal","ssi","wic","calworks"], "ruleText": "..." } |
            { "field": "<id>", "equals": <value>, "ruleText": "..." }.
Threshold tables are gross MONTHLY income by household size (1-8 + eachAdditionalPerson); if a
source publishes annual, divide by 12 and cite the annual figure + effective date.`;

export function extractPrompt(p) {
  return `You are the EXTRACT agent. Today is ${new Date().toISOString().slice(0, 10)}.
Read the official source(s) for "${p.name}" and extract a deterministic eligibility SCREEN.
Sources: ${p.sources.map((s) => s.url).join(', ')}.
Keep this eligibility tree shape EXACTLY (fill only ruleText + any threshold table it references):
${JSON.stringify(p.eligibilityShape, null, 2)}
${SCHEMA}
Return ONE fenced json block: { programId, thresholdTable|null, program{ id,name,benefitText,applyUrl,source{url,effectiveDate,verifiedBy:[]},eligibility }, caveats[], citations[{url,supports,quote}] }.
Every $ figure must come from a page you fetched - quote it with its household size. Flag anything unverifiable. Your output will be adversarially checked.`;
}

export function verifyPrompt(p, extraction) {
  return `You are the independent ADVERSARIAL VERIFIER. Today is ${new Date().toISOString().slice(0, 10)}.
Re-derive "${p.name}" eligibility YOURSELF from official/primary sources, THEN challenge the extraction below. Do not rubber-stamp.
Sources: ${p.sources.map((s) => s.url).join(', ')}.
Scrutinize: exact threshold figures, the FPL vintage / effective date, the categorical paths, and that only-noted-as-caveats clauses are correctly excluded.
=== EXTRACTION ===
${typeof extraction === 'string' ? extraction : JSON.stringify(extraction, null, 2)}
Return ONE fenced json block: { verdict:"AGREE|DISAGREE", independentTable{...}|null, tableMatches:bool, discrepancies[{field,extraction,correct,primarySource,severity}], categoricalConfirmed:bool, recommendedFinal{...} }.
Quote exact figures from each primary page. If you cannot verify from a primary source, say so explicitly.`;
}

// COMPILE - merge verified results into ruleset.json (deterministic).
export function compile(programs, results, base) {
  const ruleset = base || { meta: {}, thresholdTables: {}, inputs: [], programs: [] };
  ruleset.meta = { ...ruleset.meta, compiledAt: new Date().toISOString().slice(0, 10) };
  for (const { extraction, verdict } of results) {
    const merged = verdict.verdict === 'DISAGREE'
      ? applyVerifierCorrections(extraction, verdict) // keep numbers, fix flagged claims
      : extraction;
    if (merged.thresholdTable) ruleset.thresholdTables[merged.thresholdTable.id] = merged.thresholdTable;
    merged.program.source.verdict = verdict.verdict === 'AGREE' ? 'AGREE' : 'DISAGREE-reconciled';
    upsert(ruleset.programs, merged.program);
  }
  return ruleset;
}

function applyVerifierCorrections(extraction, verdict) {
  if (verdict.recommendedFinal?.byHouseholdSize && extraction.thresholdTable)
    extraction.thresholdTable.byHouseholdSize = verdict.recommendedFinal.byHouseholdSize;
  return extraction;
}
function upsert(arr, item) {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.push(item);
}

async function main() {
  const { core } = read('data/programs.json');
  if (typeof globalThis.runAgent !== 'function') {
    console.log('This workflow fans out subagents (extract + independent verify) and must run under the\n' +
      'Claude Code workflow runtime - invoke it with the `ultracode` prompt in PLAN.md.\n' +
      'Steps 3-4 (compile + grade) are deterministic: `node workflow/grade.mjs` runs standalone.');
    return;
  }
  const results = [];
  // Phase 1+2: fan out (extract, then independent verify) per program.
  for (const p of core) {
    const extraction = parseJsonBlock(await globalThis.runAgent(`extract-${p.id}`, extractPrompt(p)));
    const verdict = parseJsonBlock(await globalThis.runAgent(`verify-${p.id}`, verifyPrompt(p, extraction)));
    results.push({ extraction, verdict });
  }
  // Phase 3: compile only verified rules.
  const ruleset = compile(core, results, read('data/ruleset.json'));
  writeFileSync(resolve(ROOT, 'data/ruleset.json'), JSON.stringify(ruleset, null, 2));
  // Phase 4: grade.
  execSync('node workflow/grade.mjs', { cwd: ROOT, stdio: 'inherit' });
}

function parseJsonBlock(text) {
  const m = String(text).match(/```json\s*([\s\S]*?)```/);
  return JSON.parse(m ? m[1] : text);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
