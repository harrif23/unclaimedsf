// Deterministic 3-valued eligibility match engine for Public Works.
//
// Pure functions, no I/O. Imported by BOTH the browser app and workflow/grade.mjs -
// the code the grader proves green is the exact code that ships.
//
// Every rule node evaluates to TRUE, FALSE, or UNKNOWN (an input wasn't answered yet):
//   - all (AND): TRUE if all TRUE; FALSE if any FALSE; else UNKNOWN
//   - any (OR):  TRUE if any TRUE; FALSE if all FALSE; else UNKNOWN
// Program status: TRUE -> "full", FALSE -> "no", UNKNOWN -> "partial".
// For partials we collect the unanswered inputs on still-satisfiable branches -
// those become the precise "we still need: ___" prompts. No guessing.

export const TRUE = 'true';
export const FALSE = 'false';
export const UNKNOWN = 'unknown';

const STATUS = { [TRUE]: 'full', [FALSE]: 'no', [UNKNOWN]: 'partial' };

const uniq = (arr) => [...new Set(arr)];

// --- leaf evaluation --------------------------------------------------------

// { income: "<thresholdTableId>" } - matches the user's yes/no answer to
// "is your income at or below $X (for your household size)?". The dollar amount
// is rendered by the questionnaire from household_size; the engine only reads
// the boolean, so exact income is never needed here.
function evalIncome(node, answers) {
  const ans = (answers.income_at_or_below || {})[node.income];
  if (ans === true) return { value: TRUE, satisfied: [node.ruleText], missing: [] };
  if (ans === false) return { value: FALSE, satisfied: [], missing: [] };
  const missing = [];
  if (answers.household_size === undefined || answers.household_size === null) missing.push('household_size');
  missing.push('income_at_or_below.' + node.income);
  return { value: UNKNOWN, satisfied: [], missing };
}

// { enrolledAny: ["calfresh","medi_cal",...] } - categorical-qualification path.
function evalEnrolledAny(node, answers) {
  const ans = answers.enrolled_programs;
  if (ans === undefined || ans === null) return { value: UNKNOWN, satisfied: [], missing: ['enrolled_programs'] };
  const set = new Set(ans);
  const hit = node.enrolledAny.some((id) => set.has(id));
  return hit
    ? { value: TRUE, satisfied: [node.ruleText], missing: [] }
    : { value: FALSE, satisfied: [], missing: [] };
}

// { field, equals|notEquals|in } - generic scalar leaf.
function evalField(node, answers) {
  const ans = answers[node.field];
  if (ans === undefined || ans === null) return { value: UNKNOWN, satisfied: [], missing: [node.field] };
  let ok;
  if ('equals' in node) ok = ans === node.equals;
  else if ('notEquals' in node) ok = ans !== node.notEquals;
  else if ('in' in node) ok = Array.isArray(node.in) && node.in.includes(ans);
  else throw new Error('Unknown field-leaf operator: ' + JSON.stringify(node));
  return ok
    ? { value: TRUE, satisfied: [node.ruleText], missing: [] }
    : { value: FALSE, satisfied: [], missing: [] };
}

// --- tree evaluation --------------------------------------------------------

function evalNode(node, answers) {
  if (!node || typeof node !== 'object') throw new Error('Invalid rule node: ' + JSON.stringify(node));
  if (Array.isArray(node.all)) return evalAll(node.all, answers);
  if (Array.isArray(node.any)) return evalAny(node.any, answers);
  if (node.not) return evalNot(node.not, answers);
  if (typeof node.income === 'string') return evalIncome(node, answers);
  if (Array.isArray(node.enrolledAny)) return evalEnrolledAny(node, answers);
  if (typeof node.field === 'string') return evalField(node, answers);
  throw new Error('Unrecognized rule node: ' + JSON.stringify(node));
}

function evalAll(children, answers) {
  const rs = children.map((c) => evalNode(c, answers));
  if (rs.some((r) => r.value === FALSE)) return { value: FALSE, satisfied: [], missing: [] };
  const pending = rs.filter((r) => r.value === UNKNOWN);
  if (pending.length) return { value: UNKNOWN, satisfied: [], missing: uniq(pending.flatMap((r) => r.missing)) };
  return { value: TRUE, satisfied: uniq(rs.flatMap((r) => r.satisfied)), missing: [] };
}

function evalAny(children, answers) {
  const rs = children.map((c) => evalNode(c, answers));
  const won = rs.find((r) => r.value === TRUE);
  if (won) return { value: TRUE, satisfied: won.satisfied, missing: [] };
  const pending = rs.filter((r) => r.value === UNKNOWN);
  if (pending.length) return { value: UNKNOWN, satisfied: [], missing: uniq(pending.flatMap((r) => r.missing)) };
  return { value: FALSE, satisfied: [], missing: [] };
}

function evalNot(child, answers) {
  const r = evalNode(child, answers);
  if (r.value === TRUE) return { value: FALSE, satisfied: [], missing: [] };
  if (r.value === FALSE) return { value: TRUE, satisfied: [], missing: [] };
  return { value: UNKNOWN, satisfied: [], missing: r.missing };
}

// --- public API -------------------------------------------------------------

// Evaluate one program. Supports a single `eligibility` tree or tiered `tiers[]`
// (each tier { benefitText, eligibility }); for tiers, the first FULL tier wins.
export function matchProgram(program, answers) {
  if (Array.isArray(program.tiers)) {
    const evals = program.tiers.map((t) => ({ tier: t, r: evalNode(t.eligibility, answers) }));
    const full = evals.find((e) => e.r.value === TRUE);
    if (full) return { id: program.id, name: program.name, status: 'full',
      benefitText: full.tier.benefitText || program.benefitText, reasons: full.r.satisfied, missing: [], applyUrl: program.applyUrl };
    if (evals.some((e) => e.r.value === UNKNOWN)) return { id: program.id, name: program.name, status: 'partial',
      benefitText: program.benefitText, reasons: [], missing: uniq(evals.flatMap((e) => e.r.missing)), applyUrl: program.applyUrl };
    return { id: program.id, name: program.name, status: 'no', benefitText: program.benefitText, reasons: [], missing: [], applyUrl: program.applyUrl };
  }
  const r = evalNode(program.eligibility, answers);
  return { id: program.id, name: program.name, status: STATUS[r.value],
    benefitText: program.benefitText, reasons: r.satisfied, missing: r.missing, applyUrl: program.applyUrl };
}

// Evaluate every program in a ruleset.
export function matchAll(ruleset, answers) {
  return ruleset.programs.map((p) => matchProgram(p, answers));
}
