We are building a benefit-eligibility finder for San Francisco residents during a one-day hackathon (submissions due 5:00 PM).

There are public assistance programs (utility discounts, transit discounts, fee waivers, etc.) that SF residents qualify for but never claim — a documented pool of unclaimed money in the hundreds of millions. The reason they go unclaimed is discovery + eligibility friction: the rules are scattered across dozens of agency webpages and PDFs, each written differently, and no resident can track which ones apply to them or that qualifying for one (e.g. CalFresh) auto-qualifies them for others (e.g. the CARE energy discount).

The product: a resident answers a handful of plain questions → a deterministic match engine checks them against a structured ruleset → returns the specific programs they qualify for, each shown with the exact rule it matched and a direct link to apply. Partial matches tell the user precisely what's missing. No match still captures their info for a future-notification feature (product feature, not part of the demo).

The defensible technical core is how the ruleset gets built: a Claude Code dynamic workflow fans out subagents to read each program's source page, extract its eligibility rules into structured JSON, has independent agents adversarially verify each extraction against the source, then grades the compiled ruleset against a hand-labeled test set. Claude does the hard reasoning offline, once. The shipped app runs plain deterministic code — no AI at runtime. This keeps it sustainable and keeps the output verifiable (no AI guessing at a resident's eligibility live).


1. The idea & intention

The problem (real, documented)


SF residents leave large sums unclaimed because they don't know what they qualify for. The SF Department of Public Health alone has flagged a 9-figure unclaimed pool, and the city openly struggles just to tell people they're eligible.
The blocker is not that the money is hidden — it's that eligibility is undiscovered. Rules live in unstructured prose across many agencies. A working adult has no realistic way to audit all of them.
A key, under-exploited fact: eligibility chains. Being enrolled in one program (CalFresh, Medi-Cal, WIC, SSI…) is itself a qualifying path into others. People who clear one bar almost never learn they've automatically cleared several more.


The intention

Turn dormant public eligibility information into a tool that does the work of matching a person to what they're owed — and produces output the person can verify for themselves (here is the rule, here is why you match), rather than advice they have to trust. The completed task — "you qualify for these N programs, here is the link to claim each" — is the product, not a recommendation.

What this is NOT


Not an AI chatbot that "advises" on benefits.
Not a dashboard (explicitly banned by the hackathon).
Not a generic federal benefits screener (those exist — mRelief, Benefits.gov). Our wedge is SF-local breadth + eligibility chaining + verifiable rule-level output + a rerunnable compile-any-city workflow.
Not a system that stores sensitive data to be impressive. Data collection is minimized and justified (see §6).



2. The output (what the user actually gets)

For a given resident, three possible results per program, all deterministic:


Full match — "You qualify for SFPUC Customer Assistance Program: 40% off your water/sewer bill. Rule matched: household income ≤ 30% of SF Area Median Income, residential single-family metered account. → [Apply here]."
Partial match — "You may qualify for CARE (30–35% off electric). We still need: are you enrolled in CalFresh, Medi-Cal, WIC, or SSI? Add that and we'll check."
No match — "Nothing matches right now. (Optional, product feature:) leave a contact and we'll notify you if a program later fits."


Every full match shows the human-readable rule that produced it. That is the trust mechanism and the whole point.

Optional finale (decide at scope time)

Once a match is found, optionally use Claude to draft the actual application (pre-fill the program's form fields from the answers already given). This is the one justified place for AI inside the product — it converts "you qualify" into "your application is ready to submit," i.e. a completed task. Treat as stretch; the demo can stand without it.


3. The experience (end-to-end)


Resident opens a web page. No signup, no login.
A short, plain-language questionnaire. Ask attributes, not identity. Income as a range / yes-no against a threshold, not an exact salary. Household size as a dropdown. Program-enrollment as checkboxes (CalFresh? Medi-Cal? WIC? SSI?). No name, no address, no SSN to get a result.
Matching runs in the browser (the compiled ruleset ships to the client). The resident's answers do not need to be sent to a server to get a result. Say this out loud in the UI — "your answers stay on your device" — it's a real differentiator vs. data-harvesting screeners.
Results render instantly: full matches (with rule + apply link), partial matches (with the precise missing input), and a clear "nothing yet" state.
(Stretch) "Draft my application" on a matched program.


Design: clean, legible, low-literacy-friendly, mobile-first (these residents are often on phones). Plain language, large tap targets, no jargon. See the frontend-design skill for styling discipline.


4. High-level implementation plan

Two clearly separated halves. This separation is the architecture and the pitch.

Half A — Offline rule compilation (the Claude-heavy part, built via dynamic workflow)

Produces a single artifact: ruleset.json — a structured, verified, version-controlled encoding of each program's eligibility logic.

Pipeline (run as a dynamic workflow, see §7):


Input: programs.json — a list of target programs, each with its official source URL(s).
Extract (fan-out): one subagent per program reads the source and emits structured rules: thresholds (e.g. % of AMI / % of FPL), household-size tables, account-type exclusions, and categorical-qualification paths (enrolled-in-X ⇒ qualifies).
Verify (adversarial): a second, independent subagent re-reads each source and challenges the first extraction — wrong thresholds, missed clauses, hallucinated rules. Disagreements are surfaced, not silently merged.
Grade: run the compiled ruleset against test-cases.json (hand-labeled residents with known-correct answers). Output pass/fail per case.
Emit: ruleset.json + a grading report. Re-runnable; point it at a new city's programs.json to recompile.


Half B — The runtime app (plain, deterministic, no AI)


Loads ruleset.json.
Renders the questionnaire from the ruleset's required-input fields.
Runs a deterministic match function: for each program, evaluate the rule against the user's answers → full / partial / no-match, and for partials compute exactly which inputs are missing.
Renders results with rule text + apply links.
(Stretch) form-draft step.


Verification / "done" definition


ruleset.json passes 100% of test-cases.json.
The app is deployed to a live, responding URL.
A fresh programs.json for a different jurisdiction recompiles without code changes (proves rerunnable orchestration).


Suggested stack


Frontend: a single static site (e.g. React or plain HTML/JS) — must deploy to a live URL fast (Vercel/Netlify/static host). The match engine is client-side JS over ruleset.json.
No backend required for the core demo (browser-only matching). If the optional notify-me or form-draft is built, add the smallest possible serverless function.



5. The two seed programs (verified source material)

Start with these two; they have hard, real, differently-shaped rules — which is exactly what makes compilation a real task. Add 2–4 more for a richer chaining demo if time allows (candidates: SF Lifeline transit pass, Hetch Hetchy Power CAP, library/fee waivers).

SFPUC Customer Assistance Program (water/sewer)


Benefit: 25% off water & sewer at ≤ 50% of SF Area Median Income; 40% off at ≤ 30% of AMI.
Criteria: full-time resident at the discount address; not claimed as a dependent on another's taxes; residential single-family, individually-metered account (fire/multi-residential/irrigation/commercial/wholesale excluded); household gross income under the published guideline.
Shape: percentage-of-AMI tiers + account-type exclusions.


CARE — electric/gas discount (CPUC; applies to SF residents)


Benefit: 30–35% off electric, 20% off natural gas.
Criteria: two independent paths — meet income limits OR be enrolled in any of Medi-Cal, WIC, NSLP free lunch, SNAP/CalFresh, LIHEAP, SSI, TANF/Tribal TANF, Head Start (Tribal), BIA General Assistance.
Shape: income-OR-categorical-enrollment. This is the chaining demo: "you're on CalFresh ⇒ you auto-qualify for CARE."



Note: CARE/CalFresh are California programs, not strictly DataSF. That's fine for the resident, but if "built on SF public data" is being scored, anchor the headline on the SFPUC city programs and treat state programs as the chaining bonus. Always cite the live official source page in the ruleset; rules change.




6. Data & privacy stance (deliberate, state it explicitly)


Collect attributes, not identity. Matching needs characteristics (household size, income band, enrollments), never who you are. Identity is only needed at the city's actual application step, which we hand off to.
Browser-only matching for the core flow. Answers don't have to leave the device to produce a result. This is both the ethical choice and a competitive differentiator — say it in the UI and the pitch.
Minimum viable questions, asked as ranges/booleans where possible (income vs. threshold, not exact salary).
The notify-me feature (which requires keeping contact info) is a stated product feature, not part of the hackathon demo — don't build storage/auth for it under time pressure.



7. Claude Code features to use (and why)

Dynamic workflows — the centerpiece

A dynamic workflow is a JavaScript orchestration script Claude writes and you can rerun; it fans out many subagents (up to 16 concurrent, 1,000 per run) with the loop/branching/intermediate-state held in the script, not the chat context. It can have independent agents adversarially review each other's findings before reporting — which is precisely our verify step and our trust story.

Use it for Half A (rule compilation). Invoke it in Claude Code with the ultracode keyword or by asking in plain words ("run this as a workflow"). Example prompt to paste:

ultracode: For each program in programs.json, fan out one subagent to read its
official source URL and extract eligibility rules into structured JSON
(income thresholds, household-size tables, account-type exclusions, and
categorical-qualification paths). Then, for each program, run a second
INDEPENDENT agent that re-reads the source and verifies the first agent's
extraction, flagging any wrong thresholds, missed clauses, or invented rules.
Merge only verified rules into ruleset.json. Finally, evaluate ruleset.json
against every case in test-cases.json and produce a pass/fail grading report.

After the run does what you want, save the script as a command (/workflows → select → s) — that saved script is the orchestration artifact judges want to see, and re-running it on a new city's programs.json demonstrates "another team could rerun this tomorrow on a new problem."

You can watch phases/agent counts/tokens live via /workflows, drill into any agent to see what it extracted, and resume after pausing.

Set up your goal and rubric

Hand Claude Code two files at kickoff:


BRIEF.md (this document) — the goal, user, and "done."
test-cases.json — the rubric: hand-labeled residents with known-correct expected results. The workflow grades against this; the green checks are the verification the judges score and the on-stage "Claude caught and fixed its own failure" moment (an agent mis-parses a threshold, the grader fails the case, a re-run fixes it).


Other Claude Code capabilities worth using for this project


Subagents — the worker primitive the workflow orchestrates (one per program is the natural unit).
Skills — reusable instructions. The bundled frontend-design skill should inform the UI build; pdf-reading is directly relevant because some program eligibility lives in PDFs (e.g. CARE/FERA fact sheets) the extract agents must parse, not just HTML.
MCP servers — you have connectors available (Hugging Face, Google Drive, Gmail, Calendar, Excalidraw). Not core to this build; ignore unless a specific need arises.
/deep-research (bundled workflow) — useful before coding to discover and verify the full set of SF programs + their current rules across many sources with cross-checking. Good way to populate programs.json quickly and defensibly.
Web fetch / search tooling inside agents — the extract agents need to actually fetch the official source pages. Add the needed domains to the allowlist before a long run so it doesn't pause for permissions mid-run.
Effort control — ultracode combines high reasoning effort with auto-orchestration; drop to /effort high for routine app code to save tokens/time. Note the $500 credit cap (24hr expiry) — workflows spawn many agents and cost more, so test on a 1–2 program slice before fanning out to all of them.



8. Hackathon rules & constraints (must comply)

Event: Claude Build Day (Cerebral Valley × Anthropic), Shack15, SF. Build day with submissions due 5:00 PM sharp; finalists 6:15 PM; top 6 demo live (3 min + 1–2 min Q&A).

Hard requirements


Public GitHub repo containing all code shown in the demo. Must be open source.
Live deployed URL for submission, plus a 1-minute demo video.
Demo must clearly show only what was built during the event — failure to distinguish your own contributions = immediate DQ. (Bringing prior projects to augment is allowed, but the submission must be extractable into its own public repo.)
Don't use code/data/assets you don't have rights to. (SF/state public data is fine; cite sources.)


Explicitly banned project types — avoid all of these:
AI Mental Health Advisor · Basic RAG apps · Streamlit apps · Image Analyzers · "AI for Education" chatbot · AI Job Application Screener · AI Nutrition Coach · Personality Analyzers · Medical advice bots · Any project where a dashboard is the main feature · Sports analyzers/coaches.
→ Our project is none of these. Watch the dashboard line: the product must be a resident-facing matching tool, not an analytics dashboard. Keep the UI task-oriented (answer → result → apply), never metric-tiles.

Scoring criteria (Round 1 weighted; Round 2 equal weight):


Impact (35%) — real-world potential, who benefits, fits a stated problem. Our angle: real unclaimed money to low-income residents; fits "the tool a nonprofit/SF deserves, built on public data they already publish."
Demo (35%) — working, impressive, holds up live, proves the impact. Our angle: one resident → "you qualify for N programs worth $X, here's the rule, here's the link," plus the live chaining reveal.
Opus 4.8 Use (15%) — creative, beyond basic integration, surprising. Our angle: adversarial multi-agent rule-compilation with self-verification.
Orchestration (15%) — simple, repeatable, "done" verifiable by the model without a human (test suite / responding URL / rubric file); could another team rerun it tomorrow on a new problem. Our angle: the saved workflow + test-cases.json grader + recompile-any-city.


For the Round 2 presentation: show how you directed Claude and how it verified its own work — walk through the brief, the rubric, the workflow script, and ideally the moment an agent caught and fixed a failure. One intro slide only; the rest is product + code on screen.


9. Suggested build order (for a 5:00 PM deadline)


Lock scope (first 15 min): confirm program count (start 2, target 4), confirm whether form-draft finale is in or out, confirm host for deploy.
Write programs.json + test-cases.json — the rubric first, so "done" is defined. Use /deep-research to verify current rules and populate sources.
Run the compilation workflow on a 1-program slice to validate the pattern + cost, then fan out to all programs. Iterate until the grader is 100% green. Save the workflow script.
Build the runtime app (deterministic matcher + questionnaire + results UI) against ruleset.json. Use frontend-design.
Deploy to a live URL. Verify it responds.
(Stretch) form-draft finale.
Record the 1-min video; push the public repo; submit. Leave buffer before 5:00.



10. First actions for Claude Code

Do not start coding yet. First:


Read this brief fully.
Ask me any clarifying questions (scope, program count, deploy target, form-draft in/out).
Propose a concrete build plan + file structure + the exact workflow script you intend to run.
Propose the schema for programs.json, ruleset.json, and test-cases.json.
Wait for my go-ahead before building.


The principle to hold throughout: the product's output must be verifiable by the user (here is the rule, here is the match), the AI does the hard work offline and verifies itself, and runtime stays deterministic. Anything that turns this into "an AI tells you what it thinks you qualify for" is a failure.
