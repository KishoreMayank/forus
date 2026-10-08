import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { previewNext, replyOptions } from '../domain/engine';
import { activityOf, groupOf, GROUP_LABEL, nextStep, rel, systemsOf } from '../domain/view';
import { TREATMENTS } from '../domain/catalog';
import { fmtDM, fmtTime, startOfDay } from '../domain/time';
import type { Message, Part } from '../domain/types';

export function Parts({ parts }: { parts: Part[] }) {
  return <>{parts.map((p, i) => (p.src ? <span key={i} className={`src-${p.src}`} title={p.src === 'chart' ? 'From the patient’s chart' : `From ${p.ref?.split('#')[0]}.md`}>{p.t}</span> : <span key={i}>{p.t}</span>))}</>;
}

export function PatientPanel({ caseId }: { caseId: string }) {
  const { state, ui, setUi } = useStore();
  const c = state.cases[caseId];
  const p = state.patients[c.patientId];
  const rec = state.recommendations[c.recommendationId];
  const tx = TREATMENTS[rec.treatment];
  const group = groupOf(c);

  return (
    <aside className="panel" aria-label={p.name}>
      <div className="panel-head">
        <div>
          <h3>{p.name}</h3>
          <div className="p-tx">{tx.label} · {state.providers[c.providerId].short}</div>
        </div>
        <span className={`p-status ${group}`}>{GROUP_LABEL[group]}</span>
        <button className="x" aria-label="Close patient" onClick={() => setUi({ selectedId: null })}>×</button>
      </div>
      <div className="p-tabs" role="tablist">
        <button role="tab" aria-selected={ui.tab === 'patient'} onClick={() => setUi({ tab: 'patient' })}>Patient</button>
        <button role="tab" aria-selected={ui.tab === 'conversation'} onClick={() => setUi({ tab: 'conversation' })}>Conversation</button>
      </div>
      {ui.tab === 'patient' ? <PatientTab caseId={caseId} /> : <ConversationTab caseId={caseId} />}
    </aside>
  );
}

function PatientTab({ caseId }: { caseId: string }) {
  const { state } = useStore();
  const c = state.cases[caseId];
  const p = state.patients[c.patientId];
  const rec = state.recommendations[c.recommendationId];
  const note = state.notes[rec.noteId];
  const nx = nextStep(state, c);
  const isEmail = p.channel === 'email';
  return (
    <div>
      <div className="p-sec">
        <h4>From the chart</h4>
        <p className="quote">{note.text}</p>
        <p className="src-line">{state.providers[note.providerId].short} · {fmtDM(note.date)} · patient chart, synced {fmtTime(state.lastSync)}</p>
      </div>
      <div className="p-sec">
        <dl className="kvr">
          {systemsOf(state, c).map(([k, v]) => <Fragment2 key={k} k={k} v={v} />)}
        </dl>
      </div>
      <div className="p-sec">
        <dl className="kvr">
          <Fragment2 k={isEmail ? 'Email' : 'Phone'} v={isEmail ? p.email : p.phone} />
          <Fragment2 k="Best time" v={`${p.contactWindow} · ${p.timePreferenceLabel.toLowerCase()}`} />
          <Fragment2 k="Age" v={String(p.age)} />
          <Fragment2 k="Last visit" v={p.lastVisit} />
        </dl>
      </div>
      <div className="p-sec">
        <h4>Recent activity</h4>
        <ol className="act">
          {activityOf(state, c).map((a, i) => (
            <li key={i}><time>{a.at}</time><div><b>{a.title}</b><span>{a.detail}</span></div></li>
          ))}
        </ol>
        {nx && <p className="next-line">Next: <b>{nx.when}</b> · {nx.what}</p>}
        {!nx && c.closedReason && <p className="next-line">{c.closedReason}</p>}
      </div>
    </div>
  );
}

function Fragment2({ k, v }: { k: string; v: string }) {
  return <><dt>{k}</dt><dd>{v}</dd></>;
}

function ConversationTab({ caseId }: { caseId: string }) {
  const { state, ui, setUi, act } = useStore();
  const c = state.cases[caseId];
  const p = state.patients[c.patientId];
  const msgs = state.messages.filter((m) => m.caseId === caseId);
  const preview = previewNext(state, caseId);
  const draft = preview?.message;
  const options = replyOptions(state, caseId);
  const [moreOpen, setMoreOpen] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs.length, caseId]);

  let lastDay = -1;
  const notes = c.noteRefs.map((id) => state.notes[id]).filter(Boolean);
  const faqs = c.faqRefs.map((ref) => {
    const [file, key] = ref.split('#');
    const f = state.faqs[file];
    return { ref, file: f?.file, entry: f?.entries.find((e) => e.key === key) };
  }).filter((x) => x.entry);

  return (
    <div className={ui.showSources ? 'show-src' : ''}>
      <div className="thread-bar">
        <span>{p.channel === 'email' ? `Email · ${p.email}` : `Text · ${p.phone}`}</span>
        <label className="src-toggle"><input type="checkbox" checked={ui.showSources} onChange={(e) => setUi({ showSources: e.target.checked })} /> Show sources</label>
      </div>
      <div className="thread">
        {msgs.length === 0 && <div className="day-sep">Found in {p.firstName}’s chart · not contacted yet</div>}
        {msgs.map((m, i) => {
          const day = startOfDay(m.at);
          const sep = day !== lastDay;
          lastDay = day;
          const grouped = msgs[i + 1]?.from === m.from && startOfDay(msgs[i + 1].at) === day;
          return <Bubble key={m.id} m={m} sep={sep ? cap(rel(m.at, state.now, false)) : null} grouped={grouped} />;
        })}

        {c.hold && (
          <div className="hold">
            Waiting on the front desk. No messages go out until someone has called {p.firstName}.
            <div className="draft-acts"><button className="link" onClick={() => act({ type: 'resolveHold', caseId }, 'Marked as called')}>Mark as called</button></div>
          </div>
        )}
        {!c.hold && preview && draft && (
          <div className="bub out draft">
            <div className="draft-cap">Scheduled · {cap(rel(preview.at, state.now))} · {preview.label.toLowerCase()}</div>
            <div className="bb"><Parts parts={draft.parts} /></div>
            <div className="draft-acts">
              <button className="link" onClick={() => act({ type: 'sendNow', caseId, key: c.next!.key }, 'Sent now')}>Send now</button>
              {c.status !== 'paused' && <button className="link" onClick={() => act({ type: 'staffPause', caseId }, `Paused follow-up for ${p.firstName}`)}>Pause</button>}
            </div>
          </div>
        )}
        {!c.hold && preview && !draft && (
          <div className="day-sep">Next: {cap(rel(preview.at, state.now))} · {preview.label.toLowerCase()} (no message)</div>
        )}
        <div ref={end} />
      </div>

      {options.length > 0 && (
        <div className="try">
          <div className="try-h"><span>Try a patient response</span><span className="muted">Scripted demo</span></div>
          <div className="try-opts">
            {options.filter((o) => o.group !== 'more').map((o) => (
              <button key={o.id} className={`chip-btn ${o.group === 'slot' ? 'slot' : ''}`} onClick={() => act({ type: 'reply', caseId, optionId: o.id })}>{o.label}</button>
            ))}
            {options.some((o) => o.group === 'more') && (
              <button className="link more-link" onClick={() => setMoreOpen((v) => !v)}>{moreOpen ? 'Fewer choices' : 'More choices'}</button>
            )}
          </div>
          {moreOpen && (
            <div className="try-opts">
              {options.filter((o) => o.group === 'more').map((o) => (
                <button key={o.id} className={`chip-btn quiet ${o.id === 'stop' ? 'danger' : ''}`} onClick={() => act({ type: 'reply', caseId, optionId: o.id })}>{o.label}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {(notes.length > 0 || faqs.length > 0) && (
        <details className="p-sec srcs">
          <summary>Sources used · {notes.length + faqs.length}</summary>
          {notes.map((n) => (
            <div key={n.id} className="card chart"><div className="t">Chart · {state.providers[n.providerId].short} · {fmtDM(n.date)}</div><p>{n.text}</p></div>
          ))}
          {faqs.map((f) => (
            <div key={f.ref} className="card faq"><div className="t">{f.file} › {f.entry!.q}</div><p>{f.entry!.a ?? (f.entry!.route === 'dentist' ? '→ Ask the dentist.' : '→ Front desk.')}</p></div>
          ))}
        </details>
      )}
    </div>
  );
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

function Bubble({ m, sep, grouped }: { m: Message; sep: string | null; grouped: boolean }) {
  return (
    <>
      {sep && <div className="day-sep">{sep}</div>}
      <div className={`bub ${m.from === 'patient' ? 'in' : 'out'} ${grouped ? 'grouped' : ''}`}>
        <div className="bb"><Parts parts={m.parts} /></div>
        {!grouped && <div className="bt">{fmtTime(m.at)}</div>}
      </div>
    </>
  );
}
