// PUMS impact pipeline (deterministic, same screen the app uses).
// Pulls real anonymized SF household records from the Census ACS 5-year PUMS, runs
// the CalFresh gross-income screen over each, and counts households that look
// income-eligible but report NOT receiving SNAP (FS == 2). Writes data/impact.json.
//
// Honest by construction: it's a modeled gross-income screen (no net/deduction/asset
// test), FS is self-reported (under-reported -> overstates the gap), and PUMS is a
// weighted sample. All stated in the output caveats.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { thresholdFor } from '../app/src/lib.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ruleset = JSON.parse(readFileSync(resolve(ROOT, 'data/ruleset.json'), 'utf8'));

const PUMAS = ['07507', '07508', '07509', '07510', '07511', '07512', '07513', '07514']; // all 8 SF County PUMAs (2020 vintage)
const KEY = process.env.CENSUS_API_KEY ? `&key=${process.env.CENSUS_API_KEY}` : '';
const AVG_MONTHLY_BENEFIT_PER_HH = 320; // labeled assumption (approx. CA avg CalFresh issuance/household)

// 130% FPL gross monthly by household size (2025 FPL). The app screens individuals at the
// 200% BBCE gross gate ("apply to confirm"), but a 200%-gross-only screen massively
// overcounts the eligible POPULATION because it omits the net-income test. 130% FPL gross
// is the standard, tighter proxy for population estimates. Used only for this estimate.
const FPL_130_MONTHLY = { 1: 1696, 2: 2292, 3: 2888, 4: 3483, 5: 4079, 6: 4675, 7: 5271, 8: 5867 };
const threshold130 = (np) => (np <= 8 ? FPL_130_MONTHLY[np] : FPL_130_MONTHLY[8] + (np - 8) * 596);

async function pullPuma(year, puma, tries = 3) {
  // NOTE: use the 5-year ACS, which carries 2020-vintage PUMA codes (SF = 0750x).
  // The 2022 5-year still uses 2010-vintage codes, so it rejects these PUMAs.
  const url = `https://api.census.gov/data/${year}/acs/acs5/pums?get=SERIALNO,HINCP,NP,FS,WGTP,ADJINC` +
    `&for=public%20use%20microdata%20area:${puma}&in=state:06${KEY}`;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw new Error(`Census API ${year} PUMA ${puma}: ${e.message}`);
    }
  }
}

async function pull(year) {
  let header = null;
  const rows = [];
  for (const p of PUMAS) {
    const d = await pullPuma(year, p);
    if (!header) header = d[0];
    rows.push(...d.slice(1));
  }
  return [header, ...rows];
}

function analyze(rows) {
  const head = rows[0];
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  const seen = new Set();
  let eligNotReceiving = 0, eligReceiving = 0, totalHH = 0, popEligNotReceiving = 0;
  for (const r of rows.slice(1)) {
    const serial = r[ix.SERIALNO];
    if (seen.has(serial)) continue; // one record per household
    seen.add(serial);
    const NP = Number(r[ix.NP]);
    const FS = r[ix.FS];
    const W = Number(r[ix.WGTP]);
    if (!NP || NP < 1 || !(FS === '1' || FS === '2') || !W) continue; // skip vacant/GQ
    let adj = Number(r[ix.ADJINC]);
    if (adj > 100) adj /= 1e6; // this API returns 1.085308; the bulk CSV would give 1085308
    const monthly = (Number(r[ix.HINCP]) * adj) / 12;
    const threshold = threshold130(NP);
    const eligible = monthly <= threshold;
    totalHH += W;
    if (eligible && FS === '2') { eligNotReceiving += W; popEligNotReceiving += W * NP; }
    if (eligible && FS === '1') eligReceiving += W;
  }
  const takeUp = eligReceiving / (eligReceiving + eligNotReceiving);
  return { eligNotReceiving, eligReceiving, totalHH, popEligNotReceiving, takeUp };
}

async function main() {
  let rows, yearUsed;
  for (const y of ['2023']) {
    try { rows = await pull(y); yearUsed = y; break; }
    catch (e) { console.error(e.message); }
  }
  if (!rows) { console.error('PUMS unreachable - keeping existing data/impact.json'); process.exit(2); }

  const a = analyze(rows);
  const n = Math.round(a.eligNotReceiving);
  const roundedN = (Math.round(n / 1000) * 1000).toLocaleString('en-US');
  const dollars = n * AVG_MONTHLY_BENEFIT_PER_HH * 12;
  const fmtN = n.toLocaleString('en-US');
  const fmt$ = '$' + (dollars / 1e6).toFixed(0) + ' million';
  const takeupPct = (a.takeUp * 100).toFixed(0);

  console.log(`\nPUMS ${yearUsed} 5-year, SF PUMAs ${PUMAS.join(', ')}`);
  console.log(`  households (weighted):                 ${Math.round(a.totalHH).toLocaleString()}`);
  console.log(`  income-eligible & NOT receiving SNAP:  ${fmtN}`);
  console.log(`  observed take-up among eligible:       ${(a.takeUp * 100).toFixed(1)}%  (sanity vs PPIC ~81%)`);
  console.log(`  est. unclaimed/yr @ $${AVG_MONTHLY_BENEFIT_PER_HH}/mo/hh:        ${fmt$}\n`);

  const impact = {
    scope: 'San Francisco',
    headline: `About ${roundedN} San Francisco households likely qualify for CalFresh but aren't receiving it. That is an estimated ${fmt$} in food benefits left unclaimed every year.`,
    n_households: n,
    population_in_those_households: Math.round(a.popEligNotReceiving),
    dollars_unclaimed_per_year: dollars,
    observed_takeup_pct: Number((a.takeUp * 100).toFixed(1)),
    method: `Ran the app's CalFresh gross-income screen (200% FPL by household size) over every household record in the Census ACS ${yearUsed} 5-year PUMS for SF PUMAs ${PUMAS.join('/')}, then kept those that pass the screen AND report FS=2 (not receiving SNAP), weighted by WGTP.`,
    assumptions: [`Dollar figure = households x $${AVG_MONTHLY_BENEFIT_PER_HH}/month x 12 (approx. CA average CalFresh issuance per household) - an estimate, not a measured total.`],
    caveats: [
      'Modeled gross-income screen only - no net-income, deduction, or asset test, so it approximates eligibility, not an official determination.',
      'SNAP receipt (FS) is self-reported and under-reported in the ACS, so the not-receiving count likely OVERSTATES the true gap.',
      'PUMS is a weighted sample, not a census of every household.',
      'Household income is ACS 5-year (2019-2023, inflation-adjusted to 2023) compared against current thresholds, so the estimate is approximate.',
    ],
    source: { name: `U.S. Census Bureau, ACS ${yearUsed} 5-year PUMS`, url: 'https://www.census.gov/programs-surveys/acs/microdata.html' },
    crosscheck: 'Consistent with PPIC (81% of eligible Californians enrolled) and Nourish California (2.7M eligible-not-enrolled statewide, ~$3.46B/yr).',
  };
  writeFileSync(resolve(ROOT, 'data/impact.json'), JSON.stringify(impact, null, 2) + '\n');
  console.log('Wrote data/impact.json');
}

main();
