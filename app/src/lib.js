// UI helpers for the questionnaire + results. Pure functions, no React.

// Look up a threshold-table's dollar amount for a household size, extrapolating
// past the published max with eachAdditionalPerson.
export function thresholdFor(ruleset, tableId, size) {
  const t = ruleset.thresholdTables[tableId];
  if (!t) return null;
  const direct = t.byHouseholdSize[String(size)];
  if (direct != null) return direct;
  const maxSize = Math.max(...Object.keys(t.byHouseholdSize).map(Number));
  return t.byHouseholdSize[String(maxSize)] + (size - maxSize) * (t.eachAdditionalPerson || 0);
}

// Collapse the per-program income thresholds into the smallest set of yes/no
// questions: one per distinct dollar amount (privacy-preserving — the resident
// answers a few "at or below $X?" questions, never an exact income).
export function incomeQuestionsFor(ruleset, input, size) {
  const byAmount = new Map();
  for (const tableId of input.tables) {
    const amt = thresholdFor(ruleset, tableId, size);
    if (amt == null) continue;
    if (!byAmount.has(amt)) byAmount.set(amt, []);
    byAmount.get(amt).push(tableId);
  }
  return [...byAmount.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([amount, tables]) => ({ amount, tables }));
}

const FRIENDLY = {
  household_size: 'your household size',
  enrolled_programs: 'which programs you’re enrolled in',
  has_earned_income: 'whether you have earned income',
  will_file_taxes: 'whether you’ll file a tax return',
  sf_resident: 'whether you live in San Francisco',
};

// Turn a missing-field id into a plain-language phrase for partial matches.
export function friendlyMissing(field) {
  if (field.startsWith('income_at_or_below')) return 'your income';
  return FRIENDLY[field] || field;
}

// Map programs a resident already has to our program ids, so results show
// "already enrolled" instead of telling them to apply for something they have.
const ENROLLED_TO_PROGRAM = { calfresh: 'calfresh', medi_cal: 'medi-cal' };
export function enrolledProgramIds(answers) {
  return (answers.enrolled_programs || []).map((id) => ENROLLED_TO_PROGRAM[id]).filter(Boolean);
}
