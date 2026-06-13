import React from 'react';
import { friendlyMissing } from '../lib.js';

export default function Results({ results, enrolledIds = [] }) {
  const already = results.filter((r) => enrolledIds.includes(r.id));
  const visible = results.filter((r) => !enrolledIds.includes(r.id));
  const full = visible.filter((r) => r.status === 'full');
  const partial = visible.filter((r) => r.status === 'partial');
  const no = visible.filter((r) => r.status === 'no');

  return (
    <section className="results" aria-live="polite">
      <h2>Your results</h2>

      {already.length > 0 && (
        <p className="already">
          You are already enrolled in {already.map((r) => r.name).join(', ')}. Here is what else you may be missing.
        </p>
      )}

      {full.length > 0 && (
        <p className="summary">
          You likely qualify for <strong>{full.length}</strong> program{full.length === 1 ? '' : 's'} you may not be getting yet.
        </p>
      )}

      {full.length > 0 && (
        <div className="group">
          <h3 className="g-full">You likely qualify</h3>
          {full.map((r) => (
            <article key={r.id} className="card full">
              <div className="card-head">
                <strong>{r.name}</strong>
                {r.applyUrl && <a className="apply" href={r.applyUrl} target="_blank" rel="noreferrer">Apply</a>}
              </div>
              <p className="benefit">{r.benefitText}</p>
              {r.reasons?.length > 0 && (
                <p className="why"><span className="why-label">Why you match:</span> {r.reasons.join(' ')}</p>
              )}
            </article>
          ))}
        </div>
      )}

      {partial.length > 0 && (
        <div className="group">
          <h3 className="g-partial">You might qualify, with a couple more answers</h3>
          {partial.map((r) => (
            <article key={r.id} className="card partial">
              <div className="card-head"><strong>{r.name}</strong></div>
              <p className="benefit">{r.benefitText}</p>
              <p className="missing">We still need: {[...new Set(r.missing.map(friendlyMissing))].join(', ')}.</p>
            </article>
          ))}
        </div>
      )}

      {no.length > 0 && (
        <details className="group muted">
          <summary>{no.length} {no.length === 1 ? 'program does' : 'programs do'} not match right now</summary>
          <ul>{no.map((r) => <li key={r.id}>{r.name}</li>)}</ul>
        </details>
      )}
    </section>
  );
}
