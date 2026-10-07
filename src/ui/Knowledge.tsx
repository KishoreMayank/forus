import { BookOpen, ShieldCheck } from 'lucide-react';
import { useStore } from '../store';
import { fmtLong } from '../domain/time';

export function Knowledge() {
  const { state, ui, setUi } = useStore();
  const entries = Object.values(state.kb);
  const k = state.kb[ui.kbId] ?? entries[0];
  const usedBy = state.caseOrder.filter((id) => state.cases[id].kbRefs.includes(k.id)).map((id) => state.patients[state.cases[id].patientId]);

  return (
    <div className="kb">
      <header className="kb-head">
        <div>
          <h1>Knowledge library</h1>
          <p className="muted">Practice-approved, general information the coordinator may use in explanations and scheduling. Patient-specific reasons come only from clinician notes in each patient&rsquo;s record.</p>
        </div>
        <div className="kb-rule"><ShieldCheck size={16} aria-hidden /> If neither the library nor the record answers a question, the coordinator says so and offers a discussion with the dentist.</div>
      </header>

      <div className="kb-grid">
        <ul className="kb-list" aria-label="Knowledge entries">
          {entries.map((e) => (
            <li key={e.id}>
              <button className={`kb-item ${e.id === k.id ? 'is-sel' : ''}`} onClick={() => setUi({ kbId: e.id })} aria-current={e.id === k.id}>
                <span className="kb-topic">{e.topic}</span>
                <span className="kb-title">{e.title}</span>
                <span className="kb-meta">{e.source.split(' · ')[0]} · Updated {fmtLong(e.lastUpdated)}</span>
              </button>
            </li>
          ))}
          <li className="kb-more muted">Sample library · 3 entries. A pilot would add cost and insurance explanations, more treatments, and other languages.</li>
        </ul>

        <article className="kb-entry">
          <div className="kb-topic">{k.topic}</div>
          <h2><BookOpen size={18} aria-hidden /> {k.title}</h2>
          <dl className="kv kv-inline">
            <dt>Source</dt><dd>{k.source}</dd>
            <dt>Owner</dt><dd>{k.owner}</dd>
            <dt>Last updated</dt><dd>{fmtLong(k.lastUpdated)}</dd>
          </dl>
          <p className="kb-summary">{k.summary}</p>
          {k.body.map((b) => (
            <section key={b.heading}>
              <h3>{b.heading}</h3>
              <p>{b.text}</p>
            </section>
          ))}
          <section className="kb-patient">
            <h3>Approved patient-facing wording</h3>
            <blockquote>{k.patientText}</blockquote>
          </section>
          <section>
            <h3>Cited in conversations</h3>
            {usedBy.length ? (
              <div className="kb-used">
                {usedBy.map((p) => (
                  <button key={p.id} className="chip" onClick={() => setUi({ page: 'patients', selectedId: p.id })}>{p.name}</button>
                ))}
              </div>
            ) : (
              <p className="muted">Not cited yet. It appears here as soon as a conversation uses it.</p>
            )}
          </section>
        </article>
      </div>
    </div>
  );
}
