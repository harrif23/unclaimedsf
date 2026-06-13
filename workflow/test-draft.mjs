// End-to-end test of the form-draft serverless handler (needs ANTHROPIC_API_KEY + network).
//   set -a; . .env; set +a; node workflow/test-draft.mjs
import handler from '../app/api/draft-application.js';

let out;
const res = { status(c) { this._c = c; return this; }, json(o) { out = { code: this._c, body: o }; } };
const req = {
  method: 'POST',
  body: {
    programName: 'CARE / FERA',
    benefitText: '20% or more off your gas bill and 35% or more off your electric bill',
    ruleText: ['You are enrolled in a qualifying program such as CalFresh, Medi-Cal, SSI, or WIC (categorically eligible)'],
    answers: { household_size: 3, enrolled_programs: ['calfresh'], sf_resident: true },
  },
};

await handler(req, res);
console.log('HTTP', out.code, '\n');
console.log(out.body.draft || JSON.stringify(out.body));
