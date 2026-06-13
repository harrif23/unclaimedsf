import React, { useState } from 'react';
import { friendlyMissing } from '../lib.js';

function FullCard({ r, answers }) {
  const [s, setS] = useState({ status: 'idle', draft: '', error: '' });

  async function draft() {
    setS({ status: 'loading', draft: '', error: '' });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch('/api/draft-application', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ programName: r.name, benefitText: r.benefitText, ruleText: r.reasons, answers }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Couldn't draft (status ${res.status}).`);
      setS({ status: 'done', draft: data.draft || '', error: '' });
    } catch (e) {
      setS({ status: 'error', draft: '', error: e.name === 'AbortError' ? 'Drafting timed out — please try again.' : (e.message || 'Could not draft right now.') });
    } finally {
      clearTimeout(timer);
    }
  }

  return (
    <article className="card full">
      <div className="card-head">
        <strong>{r.name}</strong>
        {r.applyUrl && <a className="apply" href={r.applyUrl} target="_blank" rel="noreferrer">Apply&nbsp;→</a>}
      </div>
      <p className="benefit">{r.benefitText}</p>
      {r.reasons?.length > 0 && (
        <p className="why"><span className="why-label">Why you match:</span> {r.reasons.join(' ')}</p>
      )}
      <div className="draft-row">
        <button type="button" className="draft-btn" onClick={draft} disabled={s.status === 'loading'}>
          {s.status === 'loading' ? 'Drafting…' : '✍️ Draft my application'}
        </button>
      </div>
      {s.status === 'error' && <p className="draft-error">{s.error}</p>}
      {s.status === 'done' && (
        <div className="draft-out">
          <p className="draft-label">Draft — review and fill in the blanks before submitting:</p>
          <pre className="draft-text">{s.draft}</pre>
        </div>
      )}
    </article>
  );
}

export default function Results({ results, enrolledIds = [], answers = {} }) {
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
          ✓ You're already enrolled in {already.map((r) => r.name).join(', ')}. Here's what else you may be missing:
        </p>
      )}

      {full.length > 0 && (
        <p className="summary">
          You likely qualify for <strong>{full.length}</strong> program{full.length === 1 ? '' : 's'} you may not be getting yet.
        </p>
      )}

      {full.length > 0 && (
        <div className="group">
          <h3 className="g-full">✅ You likely qualify</h3>
          {full.map((r) => <FullCard key={r.id} r={r} answers={answers} />)}
        </div>
      )}

      {partial.length > 0 && (
        <div className="group">
          <h3 className="g-partial">🟡 You might qualify — a couple more answers needed</h3>
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
