import { useState } from 'react';
import { useStore } from '../store';
import { previewAnswer } from '../domain/engine';
import { faqUses, optionForFaq } from '../domain/view';
import { toMarkdown } from '../domain/faqmd';
import { fmtDM } from '../domain/time';
import { Parts } from './PatientPanel';

const ROUTE_LABEL = { dentist: 'Handed to the dentist', front_desk: 'Handed to the front desk' } as const;

export function Knowledge() {
  const { state, ui, setUi, act } = useStore();
  const files = Object.values(state.faqs);
  const file = state.faqs[ui.faqFile] ?? files[0];
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null); // markdown while editing
  const entry = file.entries.find((e) => e.key === key) ?? file.entries[0];

  // One example patient this answer applies to; the reply is composed by the real engine.
  const example = state.caseOrder.find((id) => optionForFaq(state, state.cases[id], file.id, entry.key) !== null);
  const optionId = example ? optionForFaq(state, state.cases[example], file.id, entry.key) : null;
  const reply = example && optionId ? previewAnswer(state, example, optionId) : undefined;
  const exampleName = example ? state.patients[state.cases[example].patientId].firstName : null;

  const choose = (id: string) => { setUi({ faqFile: id }); setKey(null); setDraft(null); };
  const save = () => {
    if (draft === null) return;
    act({ type: 'editFaq', fileId: file.id, md: draft }, `Saved ${file.file}`);
    setDraft(null);
  };

  return (
    <section className="view">
      <header className="page-head">
        <h1>Knowledge</h1>
        <p>General answers written by the practice. Reasons specific to a patient always come from their chart.</p>
      </header>
      <div className="kb">
        <nav className="tree" aria-label="FAQ files">
          {files.map((f) => (
            <button key={f.id} aria-current={f.id === file.id} onClick={() => choose(f.id)}>
              {f.title}{f.draft && <span className="draft">Draft</span>}
            </button>
          ))}
        </nav>

        <div className="doc">
          <div className="doc-head">
            <div>
              <h2>{file.title}</h2>
              <p className="doc-meta">{file.file} · edited {fmtDM(file.edited)} by {file.editedBy}</p>
            </div>
            {draft === null ? (
              <button className="btn" onClick={() => setDraft(toMarkdown(file))}>Edit</button>
            ) : (
              <span className="doc-actions">
                <button className="btn quiet" onClick={() => setDraft(null)}>Cancel</button>
                <button className="btn primary" onClick={save}>Save</button>
              </span>
            )}
          </div>

          {draft !== null ? (
            <div className="editor">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck aria-label={`Edit ${file.file}`} />
              <p className="help">Start a question with <code>##</code>. To hand a question off instead of answering, write <code>→ Ask the dentist.</code> or <code>→ Front desk.</code> as its answer.</p>
            </div>
          ) : (
            <>
              <p className="doc-intro">{file.intro}</p>
              <ol className="faq-list">
                {file.entries.map((e) => {
                  const uses = faqUses(state, `${file.id}#${e.key}`);
                  return (
                    <li key={e.key}>
                      <button className={`faq ${e.key === entry.key ? 'sel' : ''}`} onClick={() => setKey(e.key)}>
                        <span className="faq-q">{e.q}</span>
                        {e.route
                          ? <span className="faq-route">{ROUTE_LABEL[e.route]}</span>
                          : <span className="faq-a">{e.a}</span>}
                        <span className="faq-uses">{uses ? `Used in ${uses} ${uses === 1 ? 'reply' : 'replies'}` : 'Not used yet'}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>

        <aside className="preview">
          <div className="k">How patients see it</div>
          {reply && exampleName ? (
            <>
              <p className="help">“{entry.q}”, answered for {exampleName}, using {exampleName}’s chart.</p>
              <div className="bub out show-src-always"><div className="bb"><Parts parts={reply.parts} /></div></div>
              <div className="legend"><span><i className="lg-chart" />From the chart</span><span><i className="lg-faq" />From this file</span></div>
            </>
          ) : (
            <p className="help">This entry isn’t a patient question. The coordinator uses it behind the scenes.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
