import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen, CalendarDays, ChevronDown, Lock, Stethoscope, Info } from 'lucide-react';
import { useStore } from '../store';
import { replyOptions } from '../domain/engine';
import { fmtDate, fmtTime, startOfDay } from '../domain/time';
import type { Message } from '../domain/types';
import { PRACTICE } from '../domain/seed';

export function PatientPhone() {
  const { state, ui, setUi, act } = useStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set());
  const c = state.cases[ui.selectedId];
  const p = state.patients[c.patientId];
  const msgs = state.messages.filter((m) => m.caseId === c.id);
  const options = replyOptions(state, c.id);
  const slots = options.filter((o) => o.group === 'slot');
  const primary = options.filter((o) => o.group === 'primary');
  const more = options.filter((o) => o.group === 'more');
  const lastCase = useRef<string | null>(null);
  if (lastCase.current !== c.id) {
    // Switching patients (or first paint): show history without entrance animation.
    lastCase.current = c.id;
    msgs.forEach((m) => seen.current.add(m.id));
  }

  useEffect(() => setMoreOpen(false), [c.id, msgs.length]);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: seen.current.size ? 'smooth' : 'auto' });
  }, [msgs.length, c.id, ui.pane, ui.page]);
  useEffect(() => {
    // Mark messages as seen after paint so only genuinely new ones animate in.
    const id = requestAnimationFrame(() => msgs.forEach((m) => seen.current.add(m.id)));
    return () => cancelAnimationFrame(id);
  });

  let lastDay = -1;
  const closedNote =
    c.status === 'completed' ? 'Treatment complete. No further follow-up.'
    : c.status === 'visit_passed' ? 'Nothing needed from you right now.'
    : null;

  return (
    <div className="phone-wrap">
      <div className="phone-top">
        <label className="viewas">
          <span>Patient view</span>
          <select value={c.id} onChange={(e) => setUi({ selectedId: e.target.value })} aria-label="Choose which patient's phone to view">
            {state.caseOrder.map((id) => (
              <option key={id} value={id}>{state.patients[state.cases[id].patientId].name}</option>
            ))}
          </select>
        </label>
        <span className="viewas-hint">Tap a reply to respond as the patient</span>
      </div>

      <div className="phone" aria-label={`${p.firstName}'s phone`}>
        <div className="phone-status">
          <span>{fmtTime(state.now).replace(/\s?[AP]M/, '')}</span>
          <span className="notch" aria-hidden />
          <span className="phone-sig" aria-hidden>●●●</span>
        </div>
        <div className="phone-head">
          <span className="ph-avatar" aria-hidden>HD</span>
          <div>
            <div className="ph-name">{PRACTICE.name}</div>
            <div className="ph-sub">Text message · to {p.firstName}</div>
          </div>
        </div>

        <div className="thread" ref={scroller}>
          {msgs.length === 0 && <div className="thread-empty">No messages yet.</div>}
          {msgs.map((m) => {
            const day = startOfDay(m.at);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <div key={m.id} className={`bubble-row from-${m.from} ${seen.current.has(m.id) ? '' : 'is-new'}`}>
                {showDay && <div className="thread-day">{fmtDate(m.at)}</div>}
                <Bubble m={m} />
              </div>
            );
          })}
        </div>

        <div className="replies">
          {c.status === 'opted_out' && <div className="replies-note"><Lock size={12} aria-hidden /> Messages stopped. Only START will reopen.</div>}
          {closedNote && <div className="replies-note"><Info size={12} aria-hidden /> {closedNote}</div>}
          {slots.length > 0 && (
            <div className="slot-grid">
              {slots.map((o) => (
                <button key={o.id} className="slot" onClick={() => act({ type: 'reply', caseId: c.id, optionId: o.id })}>
                  <CalendarDays size={14} aria-hidden />
                  <span>{o.label}</span>
                </button>
              ))}
            </div>
          )}
          {primary.length > 0 && (
            <div className="reply-list">
              {primary.map((o) => (
                <button key={o.id} className="reply" onClick={() => act({ type: 'reply', caseId: c.id, optionId: o.id })}>{o.label}</button>
              ))}
            </div>
          )}
          {more.length > 0 && (
            <div className="more">
              <button className="more-toggle" onClick={() => setMoreOpen((x) => !x)} aria-expanded={moreOpen}>
                {moreOpen ? 'Fewer options' : 'Pause, decline, or stop'} <ChevronDown size={12} className={moreOpen ? 'rot' : ''} aria-hidden />
              </button>
              {moreOpen && (
                <div className="reply-list">
                  {more.map((o) => (
                    <button key={o.id} className={`reply reply-quiet ${o.id === 'stop' ? 'reply-stop' : ''}`} onClick={() => act({ type: 'reply', caseId: c.id, optionId: o.id })} title={o.hint}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {options.length === 0 && !closedNote && <div className="replies-note">Conversation closed.</div>}
        </div>
      </div>
      <p className="phone-foot">Scripted replies · fictional patient · simulated texting</p>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  return (
    <div className={`bubble b-${m.from}`}>
      {m.lead && <div className="btext blead">{m.lead}</div>}
      {m.sectionsAfter && <div className="btext">{m.text}</div>}
      {m.sections?.map((s, i) => (
        <div key={i} className={`bsec bsec-${s.kind}`}>
          <div className="bsec-k">
            {s.kind === 'clinician' ? <Stethoscope size={11} aria-hidden /> : s.kind === 'general' ? <BookOpen size={11} aria-hidden /> : <Info size={11} aria-hidden />}
            {s.label}
          </div>
          <div>{s.text}</div>
        </div>
      ))}
      {!m.sectionsAfter && <div className="btext">{m.text}</div>}
      <div className="btime">{fmtTime(m.at)}</div>
    </div>
  );
}
