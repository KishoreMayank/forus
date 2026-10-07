import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { BARRIER, STATUS, apptLabel, nextActionText } from './meta';
import { currentAppointment, replyOptions } from '../domain/engine';
import { fmtDate, fmtDateTime, fmtLong, fmtRelative, fmtShort, fmtTime } from '../domain/time';
import type { CaseEvent, Message, State } from '../domain/types';

// Events that add information beyond the messages themselves.
const SHOWN_EVENTS: CaseEvent['kind'][] = ['booking', 'cancellation', 'pause', 'resume', 'suppressed', 'handoff', 'completion', 'closed', 'record'];

type FeedItem = { kind: 'msg'; at: number; m: Message } | { kind: 'event'; at: number; e: CaseEvent };

export function CaseView() {
  const { state, ui, act } = useStore();
  const c = state.cases[ui.selectedId];
  const p = state.patients[c.patientId];
  const r = state.recommendations[c.recommendationId];
  const prov = state.providers[c.providerId];
  const note = state.notes[r.noteId];
  const st = STATUS[c.status];
  const nx = nextActionText(state, c);
  const appt = currentAppointment(state, c);
  const handoff = c.handoffId ? state.handoffs[c.handoffId] : undefined;
  const options = replyOptions(state, c.id);
  const endRef = useRef<HTMLDivElement>(null);

  const feed: FeedItem[] = [
    ...state.messages.filter((m) => m.caseId === c.id).map((m) => ({ kind: 'msg' as const, at: m.at, m })),
    ...state.events.filter((e) => e.caseId === c.id && SHOWN_EVENTS.includes(e.kind)).map((e) => ({ kind: 'event' as const, at: e.at, e })),
  ].sort((a, b) => a.at - b.at || (a.kind === 'msg' ? -1 : 1));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [feed.length, c.id]);

  return (
    <section className="case">
      <header className="case-head">
        <div>
          <h1>{p.name}</h1>
          <div className="muted">{r.treatment} · {r.tooth} · recommended by {prov.name} on {fmtLong(r.recommendedOn)}</div>
        </div>
        <span className={`pill tone-${st.tone}`}>{st.label}</span>
      </header>

      <dl className="facts">
        <div><dt>Next step</dt><dd>{nx.label}{nx.at ? <span className="muted"> · {fmtRelative(nx.at, state.now)}</span> : null}</dd></div>
        <div><dt>Appointment</dt><dd>{appt ? <>{fmtDateTime(appt.start)} <span className="muted">· {apptLabel(appt.type)}</span></> : <span className="muted">Not scheduled</span>}</dd></div>
        <div><dt>What&rsquo;s holding them back</dt><dd>{BARRIER[c.barrier]}</dd></div>
      </dl>

      <div className="reason">
        <div className="reason-k">Why {prov.short} recommended it · from the chart, {fmtShort(note.date)}</div>
        <p>{note.text}</p>
      </div>

      {handoff && (
        <div className="handoff">
          <div className="reason-k">Question sent to {handoff.routedTo}</div>
          <p>“{handoff.question}” The record doesn&rsquo;t answer this, so a discussion with the dentist was offered instead of guessing.</p>
        </div>
      )}

      <h2 className="feed-h">Conversation</h2>
      <div className="feed">
        {feed.map((it) =>
          it.kind === 'msg' ? <Bubble key={it.m.id} m={it.m} state={state} /> : <EventLine key={it.e.id} e={it.e} />,
        )}
        <div ref={endRef} />
      </div>

      <div className="replybox">
        <div className="replybox-k">Choose {p.firstName}&rsquo;s reply <span className="muted">(stands in for the patient texting back)</span></div>
        {options.length ? (
          <div className="replies">
            {options.map((o) => (
              <button key={o.id} className={`reply reply-${o.group} ${o.id === 'stop' ? 'reply-stop' : ''}`} onClick={() => act({ type: 'reply', caseId: c.id, optionId: o.id })}>
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">No reply needed. {c.status === 'completed' ? 'Treatment is complete and follow-up has stopped.' : ''}</p>
        )}
      </div>
    </section>
  );
}

function Bubble({ m, state }: { m: Message; state: State }) {
  const notes = (m.sources?.noteIds ?? []).filter((id) => state.notes[id]);
  const kbs = m.sources?.kbIds ?? [];
  return (
    <div className={`msg msg-${m.from}`}>
      <div className="msg-meta">{m.from === 'coordinator' ? 'Coordinator' : 'Patient'} · {fmtDate(m.at)}, {fmtTime(m.at)}</div>
      <div className="msg-body">
        {m.lead && <p>{m.lead}</p>}
        {m.sectionsAfter && <p>{m.text}</p>}
        {m.sections?.map((s, i) => (
          <div key={i} className={`sec sec-${s.kind}`}>
            <div className="sec-k">{s.label}</div>
            <p>{s.text}</p>
          </div>
        ))}
        {!m.sectionsAfter && <p>{m.text}</p>}
      </div>
      {(notes.length > 0 || kbs.length > 0) && (
        <div className="msg-src">
          Sources:{' '}
          {[
            ...notes.map((id) => `${state.providers[state.notes[id].providerId].short}'s note (${fmtShort(state.notes[id].date)})`),
            ...kbs.map((id) => `“${state.kb[id].title}”`),
          ].join(' · ')}
        </div>
      )}
    </div>
  );
}

function EventLine({ e }: { e: CaseEvent }) {
  return (
    <div className={`evt evt-${e.kind}`}>
      <div className="evt-title">{e.title}</div>
      <div className="evt-why">{e.why}</div>
    </div>
  );
}
