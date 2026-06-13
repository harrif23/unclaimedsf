import React from 'react';
import { incomeBands, incomeBooleans } from '../lib.js';

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
                  set({ [input.id]: v, _income_band: undefined, income_at_or_below: {} });
                }}
              >
                <option value="">Select</option>
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
                    <input type="checkbox" checked={cur.includes(o.id)} onChange={(e) => setEnrolled(o.id, e.target.checked)} />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </Field>
          );
        }

        if (input.type === 'derived_boolean_per_threshold') {
          const size = answers.household_size;
          if (!size) {
            return (
              <Field key={input.id} label="What is your household's total gross monthly income?">
                <p className="hint">Choose your household size first.</p>
              </Field>
            );
          }
          const bands = incomeBands(ruleset, input, size);
          return (
            <Field key={input.id} label="What is your household's total gross monthly income?" note="Used only to check against program limits. Your income is not stored.">
              <select
                value={answers._income_band ?? ''}
                onChange={(e) => {
                  if (e.target.value === '') { set({ _income_band: undefined, income_at_or_below: {} }); return; }
                  const i = Number(e.target.value);
                  set({ _income_band: i, income_at_or_below: incomeBooleans(ruleset, input, size, bands[i].upper) });
                }}
              >
                <option value="">Select your monthly income range</option>
                {bands.map((b, i) => <option key={i} value={i}>{b.label}</option>)}
              </select>
            </Field>
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
