# Public Works - Implementation Plan

SF benefit-eligibility finder. **AI does the hard reasoning offline, once, and verifies itself; the shipped app is plain deterministic JS over a compiled `ruleset.json`; the resident's answers never leave the browser; every match is shown with the exact rule that produced it.**

> This is the canonical, decision-locked plan - verify work against it.
> The source brief (the *why* + hackathon rules) is `project-plan.md`. This doc is the *how*.
> Deadline: submissions due **5:00 PM on build day**. Keep a buffer.

---

## 1. Locked decisions

| Decision | Choice |
|---|---|
| **Anchor program** | **CalFresh** (pivoted from the brief's SFPUC/CARE seeds - see §2 rationale) |
| **Program set** | Core 6, get **4 green first**, stretch toward 8-9 only if ahead |
| **Frontend** | React + Vite (static build) |
| **Host** | Vercel |
| **Form-draft finale** | **In scope** - Vercel serverless function (the one justified runtime AI call; drafts the form, never decides eligibility) |
| **Impact narrative + test set** | **US Census ACS PUMS** - real anonymized SF household microdata |
| **Determinism principle** | Runtime is 100% deterministic. AI appears only offline (compile + adversarial verify) and in the single form-draft step. |
| **Complex programs** | Run an eligibility **screen** ("you appear eligible - apply to confirm"), not a final determination. Honest, matches real screeners, keeps "rule shown = rule applied" true. |

---

## 2. Scope - programs

**Why the pivot:** SFPUC CAP + CARE were the brief's seeds, but CARE is ~90%+ already enrolled (tiny unclaimed pool) and SFPUC's payout/take-up is unpublished. The real unclaimed money is **CalFresh** (~$3.46B/yr unclaimed in CA ⚑) and **EITC/CalEITC**. CalFresh is also the **master key**: one enrollment categorically qualifies a household for several downstream programs - the chaining demo.

**Core 6** (impact × eligibility-chaining):

| id | Program | Role | Rule shape | Chains from |
|---|---|---|---|---|
| `calfresh` | CalFresh (SNAP) | **Anchor + master key**; drives the PUMS stat (PUMS has a SNAP-receipt flag) | gross ≤200% FPL + net ≤100% FPL by household size (SCREEN) | - |
| `medi-cal` | Medi-Cal | Second anchor; highest *value*; SSI auto-enrolls | income ≤138% FPL (adults) by size; categorical | SSI |
| `ca-lifeline` | California LifeLine (phone/broadband) | **Largest take-up gap (~77% unenrolled ⚑)** | income OR categorical | CalFresh, Medi-Cal, SSI, WIC |
| `care-fera` | CARE/FERA (energy) | Clean chaining demo (~$500/yr ⚑) | income ≤200% FPL OR categorical | CalFresh, Medi-Cal, SSI, WIC |
| `muni-lifeline` | Muni Lifeline / Clipper START | Keeps it visibly **SF** | income ≤200% FPL OR categorical (Clipper START) | CalFresh, Medi-Cal |
| `eitc-caleitc` | Federal EITC + CalEITC (+YCTC) | **Cash headline** (does NOT chain - needs tax filing) | earned-income phase-in/out; must file | - |

**Stretch** (add as pure data, no code change, only if green with time): `recology` (refuse discount), `sf-school-meals` (universal), `sfpuc-cap` (water/sewer), `wic`.

> ⚑ = figure/URL to confirm during extraction. Muni Lifeline is **transitioning to Clipper START (no new Lifeline apps after 2026-05-01)** - verify current rule. Threshold tables (FPL/AMI by household size) change yearly; extraction must cite source + effective date.

---

## 3. Architecture - two separated halves

```
  HALF A  (offline, AI-heavy, run once)         HALF B  (runtime, deterministic, no AI)
  ┌─────────────────────────────────┐           ┌──────────────────────────────────┐
  │ programs.json (seed + sources)  │           │ React app loads ruleset.json     │
  │            │                    │           │   → generates questionnaire from │
  │   ▼ EXTRACT  (1 subagent/program)│           │     ruleset.inputs               │
  │   ▼ VERIFY   (independent agent  │  ruleset  │   → match.js (3-valued) per prog │
  │              re-reads, challenges)│  ──────►  │   → full / partial / no-match    │
  │   ▼ COMPILE  (merge verified)   │   .json   │     + ruleText + applyUrl        │
  │   ▼ GRADE    (match.js vs        │           │   browser-only; answers stay on  │
  │              test-cases.json)    │           │     device                       │
  └─────────────────────────────────┘           └──────────────────────────────────┘
              │  imports                                    ▲  imports
              └──────────────  app/src/match.js  ───────────┘   (SAME engine grades & ships)

  PUMS IMPACT (offline, deterministic):  Census ACS PUMS records ─► match.js ─► impact.json
                                         ("~N real SF households leave ~$X unclaimed")
  FORM-DRAFT (runtime, the one AI call): matched program + answers ─► Vercel fn ─► drafted form
```

**Load-bearing detail:** the grader (Half A, Phase 4) and the browser (Half B) import the **same `app/src/match.js`**. The code judges watch go green is the code that ships.

---

## 4. Data model / schemas

**`data/programs.json`** - workflow INPUT. Seed list only: `{id, name, agency, level, role, benefitSummary, ruleShape, chainsFrom[], sources[{type,url,note}]}`. Rule *details* are intentionally absent - they get extracted + verified from sources.

**`data/ruleset.json`** - workflow OUTPUT, the artifact. Shape:
- `meta` - jurisdiction, compiledAt, graderStatus.
- `thresholdTables` - named tables `{description, source{url,effectiveDate}, byHouseholdSize{1:…,2:…}}` (FPL and AMI based).
- `inputs[]` - drives the generated questionnaire (see canonical input ids below).
- `programs[]` - each `{id, name, benefitText, applyUrl, source, eligibility}` (or `tiers[]` for tiered benefits). `eligibility` is a boolean tree:
  - `{ "all": [...] }` (AND) · `{ "any": [...] }` (OR) · `{ "not": ... }`
  - leaf: `{ field, op, value | table, ruleText, source }` - every leaf carries human-readable `ruleText` (the trust mechanism) and a source citation.

**`data/test-cases.json`** - the RUBRIC. `cases[]` of `{id, description, answers, expect{programId: "full"|"partial"|"no"}, expectMissing{}, expectTier{}}`. Grader = match.js over these; **100% pass = done**. Seeded by hand (boundary cases) + PUMS-derived personas.

**`data/impact.json`** - PUMS OUTPUT. `{n_households, dollars_unclaimed_per_year, program, method, source, caveats[]}`.

**Canonical input ids** (referenced by test-cases and ruleset.inputs):
`household_size` (int) · `enrolled_programs` (multiselect: `calfresh|medi_cal|wic|ssi|calworks|medicare|none`) · `income_at_or_below` (map of thresholdTable id → bool; app computes $ from household size and asks yes/no - exact income never collected) · `has_earned_income` (bool) · `will_file_taxes` (bool) · `child_under_6` (bool) · `child_under_5` (bool) · `age_65_plus` (bool) · `has_disability` (bool) · `sf_resident` (bool). Optional/secondary inputs (e.g., SFPUC `account_type`, `claimed_as_dependent`) drive *partial* matches.

---

## 5. Match engine (`app/src/match.js`) - 3-valued logic

Every node evaluates to **TRUE / FALSE / UNKNOWN** (input unanswered):
- `all`: TRUE if all TRUE; FALSE if any FALSE; else UNKNOWN.
- `any`: TRUE if any TRUE; FALSE if all FALSE; else UNKNOWN.

Result mapping: tree TRUE → **full match**; FALSE → **no match**; UNKNOWN → **partial match**. For partials, walk the still-satisfiable branches and collect unanswered leaves → the precise "we still need: ___" prompts. No guessing, fully deterministic, pure function (same inputs → same output), no I/O - so it runs identically in the browser and in the grader.

---

## 6. Repo structure

```
public-works/
├─ project-plan.md            # source brief (the why)
├─ PLAN.md                    # this doc (the how)
├─ README.md                  # public repo: what was built + how to recompile
├─ data/
│  ├─ programs.json           # workflow input
│  ├─ ruleset.json            # workflow output (the artifact)
│  ├─ test-cases.json         # rubric
│  └─ impact.json             # PUMS headline stat
├─ workflow/
│  ├─ compile-ruleset.mjs     # the dynamic workflow (saved as a /command)
│  ├─ pums-impact.mjs         # deterministic PUMS pull + match → impact.json
│  ├─ grade.mjs               # imports app/src/match.js, runs test-cases
│  ├─ extractions/<id>.json   # per-program extractor output (intermediate)
│  ├─ verifications/<id>.json # per-program adversarial verdict (intermediate)
│  └─ grading-report.json     # pass/fail per case
└─ app/
   ├─ index.html · vite.config.js · package.json
   ├─ src/
   │  ├─ match.js             # 3-valued engine - imported by grade.mjs & pums-impact.mjs too
   │  ├─ App.jsx · main.jsx
   │  └─ components/ Questionnaire.jsx · Results.jsx · ProgramCard.jsx
   └─ api/
      └─ draft-application.js # Vercel serverless fn (form-draft; holds ANTHROPIC_API_KEY)
```

---

## 7. The compile workflow (Half A)

Run via `ultracode` (high reasoning + auto-orchestration), then save as a `/command`. Re-runnable on any city's `programs.json`.
1. **Extract** (fan out, 1 subagent/program): fetch official source (web fetch + `pdf-reading` skill) → emit `extractions/<id>.json` in the rule schema, citing source + effective date.
2. **Verify** (independent agent, same source, blind to extractor's reasoning): re-extract, diff against the extraction, flag wrong thresholds / missed clauses / invented rules → `verifications/<id>.json` with AGREE | DISAGREE(diffs). **Disagreements are surfaced, never silently merged.**
3. **Compile**: merge only AGREE'd rules → `ruleset.json`.
4. **Grade**: `grade.mjs` (imports `match.js`) runs every `test-cases.json` case → `grading-report.json`. Failures loop back (the "Claude caught and fixed its own failure" moment).

**Discipline:** validate on a **1-program slice** first (pattern + token cost), then fan out. Pre-approve source domains in the allowlist so the run doesn't pause for permissions (§11).

---

## 8. PUMS impact pipeline (`workflow/pums-impact.mjs`)

- Source: US Census ACS **5-year PUMS**, `ST=06`, SF PUMAs `07507, 07508, 07509`. Free [API](https://api.census.gov/data/key_signup.html). Public domain.
- Variables: `HINCP` (hh income), `NP` (hh size), `FS` (SNAP receipt 1/2), `PAP`, `SSIP`, `AGEP`, `ADJINC` (apply to income), `WGTP` (hh weight).
- Method: for each real household, run **our matcher** for CalFresh, filter to income-eligible **AND `FS == 2` (not receiving)**, sum `WGTP` → N households; × published avg benefit → $ unclaimed.
- Cross-check vs PPIC (81% enrolled) and Nourish California (2.7M eligible-not-enrolled, $3.46B/yr) for sanity.
- Doubles as `test-cases.json` personas (transcribe sampled records; stratify to hit threshold edges).

---

## 9. Privacy & honesty stance (state out loud)

- **On-device matching** for the core flow; collect **attributes, not identity**; income asked as yes/no against computed thresholds, never exact salary.
- **Form-draft caveat:** matching stays on device, but if the resident clicks "draft my application," only the needed fields are sent (with consent) to the serverless function. The AI there **drafts the form only - it never decides eligibility.**
- **PUMS caveats:** it's a *modeled screen* not an official determination; SNAP receipt is self-reported (under-reported → likely overstates the gap); it's a weighted *sample*, not every household. Say "estimated eligible," not "eligible." No real applicants were used.

---

## 10. Build order & definition of done

1. ✅ Lock scope. 2. ✅ Write `programs.json` + `test-cases.json` (rubric first). 3. Build `match.js` + `grade.mjs`; validate engine on a hand-stub ruleset. 4. Run compile workflow on a 1-program slice → fan out to 4 → iterate to 100% green → save as `/command`. 5. PUMS impact pipeline → `impact.json`. 6. React app (questionnaire + results) over `ruleset.json`; `frontend-design` skill. 7. Deploy to Vercel; verify URL responds. 8. Form-draft serverless fn. 9. Stretch programs if green. 10. 1-min video + public repo + submit (with buffer).

**Done =** `ruleset.json` passes **100%** of `test-cases.json` · app live at a responding URL · a fresh `programs.json` recompiles with no code change.

---

## 11. Claude Code feature playbook (maps to scoring)

| Feature | Use | Scoring |
|---|---|---|
| **Dynamic workflow** (`ultracode`, saved `/command`) | Half A extract→verify→compile→grade; rerun on new city | Opus Use 15% + Orchestration 15% |
| **Subagents** | extractor + adversarial verifier per program | Orchestration |
| **`pdf-reading` skill** | CARE/FERA, Medi-Cal fact sheets are PDFs | - |
| **`frontend-design` skill** | the React UI (mobile-first, low-literacy) | Demo 35% |
| **`/deep-research`** | optional deeper rule verification (one pass done) | Impact 35% |
| **Web allowlist** | extract agents fetch official pages without pausing | Orchestration |
| **Effort control** | `ultracode` for workflow; `/effort high` for app code | cost/time |
| **`/workflows`** | watch phases/agents/tokens live; drill in; save script | Orchestration |
| **Memory + Tasks** | persist decisions; track build phases | - |

---

## 12. Hackathon compliance checklist

- [ ] Public GitHub repo with all demo code (open source).
- [ ] Live deployed URL + 1-minute demo video.
- [ ] Demo shows **only** what was built during the event.
- [ ] Cite all SF/state public-data sources in the ruleset.
- [ ] **Not a banned type** - must read as a resident-facing *matching tool*, never a metrics dashboard.

---

## 13. Prerequisites needed to run unattended

1. **Web-domain allowlist** for extract agents: `cdss.ca.gov`, `dhcs.ca.gov`, `cpuc.ca.gov`, `pge.com`, `irs.gov`, `ftb.ca.gov`, `ssa.gov`, `sfmta.com`, `clipperstartcard.com`, `sf.gov`, `sfpuc.gov`, `calfresh.guide`, `api.census.gov` (+ `phfewic.org`, `sfusd.edu` for stretch).
2. **Census API key** (free) - optional; PUMS API works without one at low volume.
3. **Anthropic API key** as a Vercel env var - for the form-draft function (step 8 only).
4. **Vercel login** - at deploy time (step 7).
5. **Credit discipline** - slice-test before fan-out ($500 / 24h cap).

---

## 14. Open risks

- Threshold-table freshness (FPL/AMI change yearly) → extraction must cite effective date.
- Muni Lifeline → Clipper START transition (post 2026-05-01) → verify current path.
- Complex net-income programs (CalFresh/Medi-Cal/EITC) → screen, not determination.
- CARE has low marginal gap → keep as the chaining *demo*, not an impact claim.
