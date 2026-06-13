import React, { useState, useMemo } from 'react';
import ruleset from '../../data/ruleset.json';
import impact from '../../data/impact.json';
import { matchAll } from './match.js';
import { enrolledProgramIds } from './lib.js';
import Questionnaire from './components/Questionnaire.jsx';
import Results from './components/Results.jsx';

export default function App() {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const results = useMemo(() => matchAll(ruleset, answers), [answers]);

  return (
    <div className="app">
      <header className="hero">
        <h1>Public&nbsp;Works</h1>
        <p className="tagline">
          Find San Francisco benefits you may be missing, with the exact rule behind every match.
        </p>
        {impact?.headline && (
          <p className="impact">
            {impact.headline}{' '}
            {impact.source?.url && (
              <a href={impact.source.url} target="_blank" rel="noreferrer">(source)</a>
            )}
          </p>
        )}
        <p className="privacy">Your answers stay on your device. Nothing is sent anywhere to show your results.</p>
      </header>

      <main>
        <Questionnaire ruleset={ruleset} answers={answers} onChange={setAnswers} />
        <button type="button" className="see-results" onClick={() => setSubmitted(true)}>
          See my results
        </button>
        {submitted && <Results results={results} enrolledIds={enrolledProgramIds(answers)} />}
      </main>

      <footer>
        <p>
          Matches are produced by deterministic rules compiled and independently double-verified
          from official sources, not by an AI guessing live. This is a screening tool, not an
          official eligibility determination.
        </p>
      </footer>
    </div>
  );
}
