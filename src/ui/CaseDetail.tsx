import { useEffect, useState } from 'react';
import {
  AlarmClock, ArrowRightLeft, BookOpen, Bot, Building2, CalendarCheck, CalendarClock, CalendarX, CheckCircle2, CircleSlash, Copy,
  FileText, MessageSquare, Pause, Play, Send, Stethoscope, User, UserRound, Users,
} from 'lucide-react';
import { useStore } from '../store';
import { BARRIER, STATUS, apptLabel, nextActionText } from './meta';
import { Avatar, Pill, Sources } from './bits';
import { currentAppointment } from '../domain/engine';
import { fmtDate, fmtDateTime, fmtLong, fmtRelative, fmtTime, startOfDay } from '../domain/time';
import type { CaseEvent, State } from '../domain/types';

type Tab = 'activity' | 'conversation' | 'record';

export function CaseDetail({ caseId }: { caseId: string }) {
  const { state, setUi } = useStore();
  const [tab, setTab] = useState<Tab>('activity');
  const [focus, setFocus] = useState<string | null>(null);
  const c = state.cases[caseId];
  const p = state.patients[c.patientId];
  const r = state.recommendations[c.recommendationId];
  const prov = state.providers[c.providerId];
  const note = state.notes[r.noteId];
  const st = STATUS[c.status];
  const nx = nextActionText(state, c);
  const appt = currentAppointment(state, c);
  const handoff = c.handoffId ? state.handoffs[c.handoffId] : undefined;

  useEffect(() => setFocus(null), [caseId]);
  useEffect(() => {
    if (!focus) return;
    document.getElementById(`ref-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focus, tab]);

  const openSource = (kind: 'kb' | 'note', id: string) => {
    if (kind === 'kb' && !c.kbRefs.includes(id)) {
      setUi({ page: 'knowledge', kbId: id });
      return;
    }
    setTab('record');
    setFocus(id);
  };

  return (
    <article className="detail">
      <header className="detail-head">
        <Avatar initials={p.initials} tone={st.tone} size={44} />
        <div className="detail-id">
          <h2>{p.name}</h2>
          <div className="detail-sub">{p.age} · {p.phone} · Prefers {p.channel.toLowerCase()}</div>
        </div>
        <div className="detail-status">
          <Pill tone={st.tone}>{st.label}</Pill>
          <span className="auto-badge" title="The coordinator acts without staff approval; staff can observe every step here.">
            <Bot size={13} aria-hidden /> Autonomous · no approval queue
          </span>
        </div>
      </header>

      <div className="cards">
        <section className="card card-rec">
          <h3 className="card-k">Recommendation</h3>
          <div className="card-title">{r.treatment} <span className="muted">· {r.tooth}</span></div>
          <div className="card-sub">{prov.name} · {fmtLong(r.recommendedOn)}</div>
          <div className="reason">
            <div className="reason-k"><Stethoscope size={13} aria-hidden /> Clinician-recorded reason <span className="reason-tag">Patient-specific</span></div>
            <p>{note.text}</p>
            <button className="link" onClick={() => openSource('note', note.id)}>View in record</button>
          </div>
        </section>

        <section className="card">
          <h3 className="card-k">Coordination</h3>
          <dl className="kv">
            <dt>Barrier</dt>
            <dd>{BARRIER[c.barrier]}</dd>
            <dt>Status</dt>
            <dd>{st.help}</dd>
            <dt>Next action</dt>
            <dd className="strong">{nx.label}{nx.at ? <span className="muted"> · {fmtRelative(nx.at, state.now)}</span> : null}</dd>
            {c.pausedUntil && (<><dt>Paused until</dt><dd>{fmtDateTime(c.pausedUntil)}</dd></>)}
            {c.closedReason && (<><dt>Closed</dt><dd>{c.closedReason}</dd></>)}
          </dl>
        </section>

        <section className="card">
          <h3 className="card-k">Booking</h3>
          {appt ? (
            <div className="appt">
              <CalendarCheck size={18} aria-hidden className="appt-ic" />
              <div>
                <div className="card-title">{fmtDate(appt.start)} · {fmtTime(appt.start)}</div>
                <div className="card-sub">{apptLabel(appt.type)} · {state.providers[appt.providerId].short}</div>
                <div className="card-sub">
                  {appt.status === 'booked' && 'On the practice schedule'}
                  {appt.status === 'time_passed' && (appt.type === 'consult' ? 'Discussion held · patient deciding on treatment' : 'Visit time passed · completion not yet recorded')}
                  {appt.status === 'completed' && 'Treatment completed'}
                </div>
              </div>
            </div>
          ) : (
            <div className="appt appt-none">
              <CalendarClock size={18} aria-hidden className="appt-ic" />
              <div>
                <div className="card-title">{c.status === 'completed' ? 'Completed' : 'Not scheduled'}</div>
                <div className="card-sub">{c.status === 'completed' ? 'Confirmed by the practice record' : 'Treatment appointment not on the schedule'}</div>
              </div>
            </div>
          )}
        </section>

        {handoff && (
          <section className="card card-handoff">
            <h3 className="card-k"><Users size={13} aria-hidden /> Dental team handoff · {handoff.routedTo}</h3>
            <div className="handoff-q">“{handoff.question}”</div>
            <ul className="handoff-ctx">
              {handoff.context.map((x) => <li key={x}>{x}</li>)}
            </ul>
            <div className="card-sub">
              Shared automatically {fmtDateTime(handoff.at)} ·{' '}
              {handoff.status === 'shared' ? 'awaiting discussion booking' : handoff.status === 'discussion_booked' ? 'discussion booked' : 'discussed · patient deciding'}
            </div>
          </section>
        )}
      </div>

      <div className="tabs" role="tablist">
        {(['activity', 'conversation', 'record'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'is-on' : ''}`} onClick={() => setTab(t)}>
            {t === 'activity' ? 'Activity timeline' : t === 'conversation' ? 'Conversation' : 'Record & sources'}
          </button>
        ))}
      </div>

      {tab === 'activity' && <Timeline state={state} caseId={caseId} onOpen={openSource} />}
      {tab === 'conversation' && <Conversation state={state} caseId={caseId} onOpen={openSource} />}
      {tab === 'record' && <Record state={state} caseId={caseId} focus={focus} />}
    </article>
  );
}

const EVENT_ICON: Record<CaseEvent['kind'], typeof Send> = {
  outreach: Send, message: MessageSquare, explanation: BookOpen, reply: UserRound, booking: CalendarCheck,
  cancellation: CalendarX, pause: Pause, resume: Play, suppressed: CircleSlash, handoff: ArrowRightLeft,
  completion: CheckCircle2, closed: CircleSlash, record: FileText, duplicate: Copy, schedule: AlarmClock,
};

const ACTOR: Record<CaseEvent['actor'], { label: string; icon: typeof Bot }> = {
  coordinator: { label: 'Coordinator', icon: Bot },
  patient: { label: 'Patient', icon: User },
  practice: { label: 'Practice system', icon: Building2 },
  reviewer: { label: 'Reviewer', icon: User },
};

function Timeline({ state, caseId, onOpen }: { state: State; caseId: string; onOpen: (k: 'kb' | 'note', id: string) => void }) {
  const c = state.cases[caseId];
  const events = state.events.filter((e) => e.caseId === caseId).slice().reverse();
  let lastDay = -1;
  return (
    <ol className="timeline">
      {c.next && (
        <li className="tl-item tl-next">
          <span className="tl-ic"><AlarmClock size={14} aria-hidden /></span>
          <div className="tl-body">
            <div className="tl-title">Up next: {c.next.label}</div>
            <div className="tl-why">Scheduled for {fmtDateTime(c.next.at)}. The coordinator will recheck the record before acting.</div>
          </div>
        </li>
      )}
      {events.map((e) => {
        const Icon = EVENT_ICON[e.kind];
        const day = startOfDay(e.at);
        const showDay = day !== lastDay;
        lastDay = day;
        return (
          <li key={e.id} className={`tl-item tl-${e.actor} tl-k-${e.kind}`}>
            {showDay && <div className="tl-day">{fmtDate(e.at)}</div>}
            <span className="tl-ic"><Icon size={14} aria-hidden /></span>
            <div className="tl-body">
              <div className="tl-title">{e.title}</div>
              <div className="tl-meta">{ACTOR[e.actor].label} · {fmtTime(e.at)}</div>
              <div className="tl-why"><span className="why-k">Why</span> {e.why}</div>
              {e.refs && <Sources state={state} kbIds={e.refs.kbIds} noteIds={e.refs.noteIds} onOpen={onOpen} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Conversation({ state, caseId, onOpen }: { state: State; caseId: string; onOpen: (k: 'kb' | 'note', id: string) => void }) {
  const msgs = state.messages.filter((m) => m.caseId === caseId);
  if (!msgs.length) return <p className="empty">No messages yet.</p>;
  return (
    <ol className="convo">
      {msgs.map((m) => (
        <li key={m.id} className={`cv cv-${m.from}`}>
          <div className="cv-meta">
            <span className="cv-who">{m.from === 'coordinator' ? 'Coordinator' : state.patients[state.cases[caseId].patientId].firstName}</span>
            {m.tag && <span className="cv-tag">{m.tag}</span>}
            <span>{fmtDateTime(m.at)}</span>
          </div>
          <div className="cv-text">
            {m.lead && <div className="cv-main">{m.lead}</div>}
            {m.sectionsAfter && <div className="cv-main">{m.text}</div>}
            {m.sections?.map((s, i) => (
              <div key={i} className={`sec sec-${s.kind}`}>
                <div className="sec-k">{s.label}</div>
                <div>{s.text}</div>
              </div>
            ))}
            {!m.sectionsAfter && m.text}
          </div>
          {m.sources && <Sources state={state} kbIds={m.sources.kbIds} noteIds={m.sources.noteIds} onOpen={onOpen} />}
        </li>
      ))}
    </ol>
  );
}

function Record({ state, caseId, focus }: { state: State; caseId: string; focus: string | null }) {
  const c = state.cases[caseId];
  const p = state.patients[c.patientId];
  const r = state.recommendations[c.recommendationId];
  const notes = Object.values(state.notes).filter((n) => n.patientId === c.patientId).sort((a, b) => a.date - b.date);
  const kbIds = [...new Set(c.kbRefs)];
  return (
    <div className="record">
      <section>
        <h4 className="rec-h"><Stethoscope size={14} aria-hidden /> Patient-specific record</h4>
        <p className="rec-help">The only source for why <em>this</em> patient was recommended treatment. Explanations quote the approved plain-language summary; nothing is inferred.</p>
        {notes.map((n) => (
          <div key={n.id} id={`ref-${n.id}`} className={`note ${focus === n.id ? 'is-focus' : ''}`}>
            <div className="note-head">
              <strong>{state.providers[n.providerId].name}</strong> · {n.kind === 'consult' ? 'Discussion note' : 'Exam note'} · {fmtLong(n.date)}
              {c.noteRefs.includes(n.id) && <span className="used">Cited</span>}
            </div>
            <div className="note-grid">
              <div><div className="note-k">As charted</div><p className="mono">{n.text}</p></div>
              <div><div className="note-k">Approved patient summary</div><p>{n.patientSummary}</p></div>
            </div>
            <div className="note-k">Can answer: {n.covers.map((x) => ({ why: 'why treatment was recommended', alt: 'alternatives discussed' } as Record<string, string>)[x] ?? x).join(', ')}</div>
          </div>
        ))}
        <dl className="kv kv-tight">
          <dt>Treatment plan</dt><dd>{r.treatment} · {r.tooth} · recommended {fmtLong(r.recommendedOn)}</dd>
          <dt>Contact</dt><dd>{p.channel} · {p.phone} · {p.contactWindow}</dd>
          <dt>Appointment preference</dt><dd>{p.timePreferenceLabel}</dd>
          <dt>Visit history</dt>
          <dd>
            <ul className="plain">{p.visitHistory.map((v) => <li key={v.date + v.summary}><span className="muted">{v.date}</span> · {v.summary}</li>)}</ul>
          </dd>
        </dl>
      </section>
      <section>
        <h4 className="rec-h"><BookOpen size={14} aria-hidden /> General practice knowledge used</h4>
        <p className="rec-help">Practice-approved information that applies to anyone with this treatment. Never used as a patient-specific reason.</p>
        {kbIds.length === 0 && <p className="empty">No knowledge entries used yet.</p>}
        {kbIds.map((id) => {
          const k = state.kb[id];
          return (
            <div key={id} id={`ref-${id}`} className={`kbref ${focus === id ? 'is-focus' : ''}`}>
              <div className="note-head"><strong>{k.title}</strong> <span className="muted">· {k.topic}</span></div>
              <p>{k.patientText}</p>
              <div className="note-k">{k.source} · updated {fmtLong(k.lastUpdated)}</div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
