import React, { useState, useMemo } from 'react';
import ruleset from '../../data/ruleset.json';
import impact from '../../data/impact.json';
import { matchAll } from './match.js';
import { enrolledProgramIds } from './lib.js';
import Questionnaire from './components/Questionnaire.jsx';
import Results from './components/Results.jsx';

export default function App() {
  const [answers, setAnswers] = useState({});
  const results = useMemo(() => matchAll(ruleset, answers), [answers]);
  const hasAnswered = Object.keys(answers).length > 0;

  return (
    <div className="app">
      <header className="hero">
        <h1>Public&nbsp;Works</h1>
        <p className="tagline">
          Find San Francisco benefits you may be missing — with the exact rule behind every match.
        </p>
        {impact?.headline && (
          <p className="impact">
            {impact.headline}{' '}
            {impact.source?.url && (
              <a href={impact.source.url} target="_blank" rel="noreferrer">(source)</a>
            )}
          </p>
        )}
        {impact?.uiNote && <p className="impact-note">{impact.uiNote}</p>}
        <p className="privacy">🔒 Your answers stay on your device. Nothing is sent anywhere to show your results.</p>
      </header>

      <main>
        <Questionnaire ruleset={ruleset} answers={answers} onChange={setAnswers} />
        {hasAnswered && <Results results={results} enrolledIds={enrolledProgramIds(answers)} answers={answers} />}
      </main>

      <footer>
        <p>
          Matches are produced by deterministic rules compiled and independently double-verified
          from official sources — not by an AI guessing live. This is a screening tool, not an
          official eligibility determination.
        </p>
      </footer>
    </div>
  );
}
