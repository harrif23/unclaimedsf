# Public Works - 1-minute demo video script

Live: https://unclaimedsf.org · Repo: https://github.com/harrif23/unclaimedsf

Record a screen capture of the site; voiceover below. Target ~60s. Keep cursor moving.

| Time | On screen | Voiceover |
|---|---|---|
| 0:00-0:08 | Landing page; the impact stat in view | "About 30,000 San Francisco households qualify for CalFresh but never claim it - over $100 million in food benefits left unclaimed every year. The problem isn't the money, it's discovery." |
| 0:08-0:24 | Pick household size; check **CalFresh**; results populate | "A resident answers a few plain questions. The moment they say they're on CalFresh, they instantly qualify for CARE energy discounts, a phone discount, half-off Muni, and a garbage discount - one enrollment, several benefits they never knew they had." |
| 0:24-0:38 | Hover a result card showing "Why you match" + Apply | "Every match shows the exact rule behind it and a direct link to apply. No black box, and no AI guessing at your eligibility." |
| 0:38-0:55 | Cut to the grader output (7/7 green) / ruleset.json | "The trust is in how the rules are built: Claude fans out a team of agents to read each program's official source, then independent agents adversarially verify every threshold against it. It runs offline; the live app is plain deterministic code, graded 100% green against a test suite." |
| 0:55-1:00 | Back to the site / the impact line | "We even ran that same matcher over real Census data to size the gap. Built on public data, verifiable line by line. Public Works - claim what you're owed." |

## Live-demo talking points (for the 3-min finalist round)
The brief asks you to show *how you directed Claude and how it verified its own work*. The strongest moments:
- **The sanity check caught a bad number.** First PUMS estimate said $444M; the built-in take-up check (39% vs PPIC's 81%) flagged it as implausible, which surfaced (a) a too-loose 200% screen, (b) an `ADJINC` bug that had zeroed all incomes, and (c) that the agent's PUMA list missed 5 of SF's 8 PUMAs. Fixing those gave the honest ~$115M.
- **An agent caught a false claim.** The CARE verifier returned DISAGREE on the extractor's "every figure = 200% FPL" (false for a 1-person household) - numbers kept, claim corrected.
- **Stale-data traps rejected.** Verifiers rejected a 2017 "150%" Recology figure and TY2024 CalEITC numbers mislabeled as current.
- Walk through: the brief → the rubric (`test-cases.json`) → the workflow (`compile-ruleset.mjs`) → the green grader → one verifier diff.
