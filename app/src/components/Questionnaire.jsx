import React from 'react';
import { incomeQuestionsFor } from '../lib.js';

export default function Questionnaire({ ruleset, answers, onChange }) {
  const set = (patch) => onChange({ ...answers, ...patch });

  const setEnrolled = (id, checked) => {
    let cur = Array.isArray(answers.enrolled_programs) ? [...answers.enrolled_programs] : [];
    if (id === 'none') {
      cur = checked ? ['none'] : [];
    } else {
      cur = cur.filter((x) => x !== 'none');
      cur = checked ? [...cur, id] : cur.filter((x) => x !== id);
    }
    set({ enrolled_programs: cur });
  };

  const setIncomeAnswer = (tables, value) => {
    const m = { ...(answers.income_at_or_below || {}) };
    for (const t of tables) m[t] = value;
    set({ income_at_or_below: m });
  };

  return (
    <section className="questionnaire" aria-label="Eligibility questions">
      {ruleset.inputs.map((input) => {
        if (input.type === 'boolean') {
          return (
            <Field key={input.id} label={input.label}>
              <YesNo value={answers[input.id]} onChange={(v) => set({ [input.id]: v })} />
            </Field>
          );
        }

        if (input.type === 'integer') {
          return (
            <Field key={input.id} label={input.label}>
              <select
                value={answers[input.id] ?? ''}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : undefined;
                  // Reset income answers — the dollar thresholds change with household size.
                  set({ [input.id]: v, income_at_or_below: {} });
                }}
              >
                <option value="">Select…</option>
                {Array.from({ length: input.max - input.min + 1 }, (_, i) => input.min + i).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </Field>
          );
        }

        if (input.type === 'multiselect') {
          const cur = answers[input.id] || [];
          return (
            <Field key={input.id} label={input.label} note={input.privacyNote}>
              <div className="checks">
                {input.options.map((o) => (
                  <label key={o.id} className={`check ${cur.includes(o.id) ? 'on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={cur.includes(o.id)}
                      onChange={(e) => setEnrolled(o.id, e.target.checked)}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </Field>
          );
        }

        if (input.type === 'derived_boolean_per_threshold') {
          const size = answers.household_size;
          if (!size) return null; // need household size to compute the dollar amounts
          const questions = incomeQuestionsFor(ruleset, input, size);
          return (
            <React.Fragment key={input.id}>
              {questions.map((q) => (
                <Field
                  key={q.amount}
                  label={`Is your household's total gross monthly income at or below $${q.amount.toLocaleString()}?`}
                  note={input.note}
                >
                  <YesNo
                    value={firstDefined(q.tables.map((t) => (answers.income_at_or_below || {})[t]))}
                    onChange={(v) => setIncomeAnswer(q.tables, v)}
                  />
                </Field>
              ))}
            </React.Fragment>
          );
        }

        return null;
      })}
    </section>
  );
}

function Field({ label, note, children }) {
  return (
    <div className="field">
      <p className="field-label">{label}</p>
      {note && <p className="field-note">{note}</p>}
      {children}
    </div>
  );
}

function YesNo({ value, onChange }) {
  return (
    <div className="yesno" role="group">
      <button type="button" className={value === true ? 'sel' : ''} onClick={() => onChange(true)}>Yes</button>
      <button type="button" className={value === false ? 'sel' : ''} onClick={() => onChange(false)}>No</button>
    </div>
  );
}

function firstDefined(arr) {
  return arr.find((x) => x !== undefined);
}
