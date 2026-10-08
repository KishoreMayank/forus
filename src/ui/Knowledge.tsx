import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { previewAnswer } from '../domain/engine';
import { faqUses, optionForFaq } from '../domain/view';
import { TREATMENTS } from '../domain/catalog';
import { fmtDM } from '../domain/time';
import { Parts } from './PatientPanel';

export function Knowledge() {
  const { state, ui, setUi } = useStore();
  const files = Object.values(state.faqs);
  const file = state.faqs[ui.faqFile] ?? files[0];
  const [key, setKey] = useState<string | null>(null);
  const entry = file.entries.find((e) => e.key === key) ?? file.entries[0];

  // Patients this file can be previewed with: those whose treatment uses it (or anyone, for shared files).
  const candidates = useMemo(() => state.caseOrder.filter((id) => {
    const c = state.cases[id];
    return optionForFaq(state, c, file.id, entry.key) !== null;
  }), [state, file.id, entry.key]);
  const [pv, setPv] = useState<string | null>(null);
  const caseId = pv && candidates.includes(pv) ? pv : candidates[0];
  const optionId = caseId ? optionForFaq(state, state.cases[caseId], file.id, entry.key) : null;
  const reply = !file.draft && caseId && optionId ? previewAnswer(state, caseId, optionId) : undefined;

  return (
    <section className="view">
      <header className="page-head">
        <h1>Knowledge</h1>
        <p>General answers written by the practice. Reasons specific to a patient always come from their chart.</p>
      </header>
      <div className="kb">
        <nav className="tree" aria-label="FAQ files">
          <div className="dir">faq/</div>
          {files.map((f) => (
            <button key={f.id} aria-current={f.id === file.id} onClick={() => { setUi({ faqFile: f.id }); setKey(null); }}>
              {f.file}{f.draft && <span className="draft">draft</span>}
            </button>
          ))}
        </nav>

        <div className="md">
          <div className="md-head"><span className="file">{file.file}</span><span>Edited {fmtDM(file.edited)} by {file.editedBy}</span></div>
          <div className="src">
            <span className="h"><span className="hm"># </span>{file.title}</span>{'\n'}
            <span className="bq">&gt; {file.intro}</span>{'\n\n'}
            {file.entries.map((e) => {
              const uses = faqUses(state, `${file.id}#${e.key}`);
              return (
                <button key={e.key} className={`mdq ${e.key === entry.key ? 'sel' : ''}`} onClick={() => setKey(e.key)}>
                  <span className="use">{uses ? `${uses} ${uses === 1 ? 'reply' : 'replies'}` : '—'}</span>
                  <span className="h"><span className="hm">## </span>{e.q}</span>{'\n'}
                  {e.a ? e.a : <><span className="rule">{e.route === 'dentist' ? '→ Ask the dentist.' : '→ Front desk.'}</span> Don’t answer from this file.</>}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="preview">
          <div className="k">Preview with a chart</div>
          {file.draft ? (
            <p className="help">Drafts are never used in replies.</p>
          ) : candidates.length === 0 ? (
            <p className="help">This entry isn’t a patient question. The coordinator uses it when offering times.</p>
          ) : (
            <>
              <select value={caseId} onChange={(e) => setPv(e.target.value)} aria-label="Preview patient">
                {candidates.map((id) => {
                  const c = state.cases[id];
                  return <option key={id} value={id}>{state.patients[c.patientId].name} · {TREATMENTS[state.recommendations[c.recommendationId].treatment].label}</option>;
                })}
              </select>
              <p className="help">The reply this patient would get to “{entry.q}”</p>
              {reply && <div className="bub out show-src-always"><div className="bb"><Parts parts={reply.parts} /></div></div>}
              <div className="legend"><span><i className="lg-chart" />From the chart</span><span><i className="lg-faq" />From an FAQ</span></div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
