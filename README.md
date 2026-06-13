# Public Works

**Find the San Francisco benefits you're entitled to — with the exact rule behind every match.**

Public Works screens a resident against real public-benefit rules and tells them, in plain language, which programs they qualify for, *why* (the specific rule that matched), and where to apply. Answer a handful of questions, learn that one enrollment (e.g. CalFresh) cascades into several more discounts you never knew you qualified for.

The defensible idea: **AI does the hard reasoning offline, once, and verifies itself; the shipped app is plain deterministic code; the resident's answers never leave the browser.**

---

## How it works — two separated halves

**Half A — offline rule compilation (AI-heavy, run once).** A dynamic workflow fans out a team of subagents: one *extracts* each program's eligibility from its official source, then a second, **independent** agent *adversarially verifies* that extraction against the same source (catching wrong thresholds, missed clauses, invented rules). Only agreed rules are compiled into `data/ruleset.json`, which is then graded against a labeled test set.

**Half B — the runtime app (deterministic, no AI).** A React app loads `ruleset.json`, generates the questionnaire from it, and runs a **3-valued match engine** (`app/src/match.js`) entirely in the browser: every rule node is TRUE / FALSE / UNKNOWN, which maps to full match / no match / partial match. Partial matches report exactly which inputs are still missing. The matcher is a pure function with no I/O — so the **same `match.js` the browser ships is the code the grader runs**.

The only place AI runs at runtime is the optional "Draft my application" button, which drafts (never decides) — see below.

```
programs.json ──▶ [extract agent] ──▶ [independent verify agent] ──▶ compile ──▶ ruleset.json ──▶ grade
                                                                                      │
                                                              app/src/match.js ◀──────┴──────▶ browser (in-device matching)
```

---

## Run it

```bash
# 1. Runtime app
cd app && npm install
npm run dev            # http://localhost:5173

# 2. Grade the ruleset (same engine the app ships)
node workflow/grade.mjs

# 3. Recompile the ruleset from sources (the dynamic workflow — see PLAN.md for the ultracode prompt)
#    Rerunnable on any city's data/programs.json.

# 4. Recompute the SF impact stat (needs a free Census key in .env)
set -a; . .env; set +a; node workflow/pums-impact.mjs
```

Environment variables (copy `.env.example` → `.env`):
- `CENSUS_API_KEY` — free, https://api.census.gov/data/key_signup.html (impact stat only)
- `ANTHROPIC_API_KEY` — for the form-draft serverless function (set in Vercel for production)

---

## Layout

```
data/        programs.json (input) · ruleset.json (compiled artifact) · test-cases.json (rubric) · impact.json
workflow/    compile-ruleset.mjs (the dynamic workflow) · grade.mjs · pums-impact.mjs · smoke-test.mjs
app/         Vite + React; src/match.js (engine, shared with the grader); api/draft-application.js (form-draft)
PLAN.md      the implementation plan · project-plan.md  the original brief
```

---

## Programs & sources (verify every number)

Six core programs, each independently double-verified. `$` figures come from the **rule source**; **Apply** is where a resident goes.

| Program | Rule source | Apply |
|---|---|---|
| CalFresh (SNAP) | CDSS ACIN I-46-25 | benefitscal.com |
| Medi-Cal | DHCS ACWDL 26-01 / Covered CA chart | benefitscal.com |
| California LifeLine | CPUC LifeLine eligibility (Admin Letter) | californialifeline.com |
| CARE / FERA | CPUC CARE/FERA program page | pge.com/care |
| Muni Lifeline / Clipper START | SFMTA Clipper START | clipperstartcard.com |
| EITC + CalEITC | IRS EITC tables / FTB CalEITC | ftb.ca.gov |

Full URLs and the deeper primary citations are in each program's `source` field in `data/ruleset.json`. Two official sites block automated fetches (clipperstartcard.com, ftb.ca.gov); those figures were cross-corroborated and are flagged in-product.

---

## The impact stat (honest by construction)

The landing figure is computed by `workflow/pums-impact.mjs`: it runs **our own matcher** over real anonymized **U.S. Census ACS 5-year PUMS** household records for all 8 SF PUMAs, and counts households that pass a CalFresh income screen but report not receiving SNAP. It is a **modeled upper bound** (a gross-income screen omits the net-income/asset tests), cross-checked against PPIC and Nourish California — and the app says so. A built-in sanity check (observed take-up vs. PPIC) is what flagged and corrected an early over-estimate.

---

## What's AI vs. deterministic

- **AI, offline:** extracting + adversarially verifying the rules (Half A).
- **Deterministic, always:** the eligibility matching a resident sees (Half B) — no AI guesses at anyone's eligibility live.
- **AI, runtime, optional:** "Draft my application" pre-fills the program's form from answers already given. It drafts only; it never decides eligibility, invents facts, or sees identity data (only attributes, with the user's click).

---

## Privacy

Matching runs entirely in the browser; answers are attributes (household size, income band, enrollments), never identity, and never leave the device. The form-draft step sends only the needed fields, on click, to a serverless function whose API key stays server-side.
