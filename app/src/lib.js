// UI helpers for the questionnaire + results. Pure functions, no React.

export function thresholdFor(ruleset, tableId, size) {
  const t = ruleset.thresholdTables[tableId];
  if (!t) return null;
  const direct = t.byHouseholdSize[String(size)];
  if (direct != null) return direct;
  const maxSize = Math.max(...Object.keys(t.byHouseholdSize).map(Number));
  return t.byHouseholdSize[String(maxSize)] + (size - maxSize) * (t.eachAdditionalPerson || 0);
}

// Income ranges for a household size: one option per distinct program threshold, so the
// resident picks a single range instead of answering many yes/no questions. Exact income
// is never collected; the chosen range maps deterministically to each program limit.
export function incomeBands(ruleset, input, size) {
  const thresholds = [...new Set(input.tables.map((t) => thresholdFor(ruleset, t, size)).filter((v) => v != null))].sort((a, b) => a - b);
  const bands = [];
  let lower = 0;
  for (const t of thresholds) {
    bands.push({ upper: t, label: `$${lower.toLocaleString()} to $${t.toLocaleString()}` });
    lower = t + 1;
  }
  const max = thresholds[thresholds.length - 1];
  bands.push({ upper: Infinity, label: `More than $${max.toLocaleString()}` });
  return bands;
}

// Given the selected range's upper bound, derive the yes/no the match engine expects for
// each threshold table (income at or below that table's limit).
export function incomeBooleans(ruleset, input, size, selectedUpper) {
  const m = {};
  for (const tableId of input.tables) {
    const v = thresholdFor(ruleset, tableId, size);
    if (v != null) m[tableId] = selectedUpper <= v;
  }
  return m;
}

const FRIENDLY = {
  household_size: 'your household size',
  enrolled_programs: 'which programs you are enrolled in',
  has_earned_income: 'whether you have earned income',
  will_file_taxes: 'whether you will file a tax return',
  sf_resident: 'whether you live in San Francisco',
};

export function friendlyMissing(field) {
  if (field.startsWith('income_at_or_below')) return 'your income';
  return FRIENDLY[field] || field;
}

const ENROLLED_TO_PROGRAM = { calfresh: 'calfresh', medi_cal: 'medi-cal' };
export function enrolledProgramIds(answers) {
  return (answers.enrolled_programs || []).map((id) => ENROLLED_TO_PROGRAM[id]).filter(Boolean);
}
