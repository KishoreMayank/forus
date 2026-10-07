import { useState } from 'react';
import { Check, ChevronDown, ListChecks } from 'lucide-react';
import { useStore } from '../store';
import type { State } from '../domain/types';

interface Step {
  title: string;
  how: string;
  where: 'phone' | 'controls' | 'auto';
  done: (s: State) => boolean;
}

const ev = (s: State, id: string) => s.events.filter((e) => e.caseId === id);
const crownBookings = (s: State, id: string) => ev(s, id).filter((e) => e.kind === 'booking' && e.title.startsWith('Crown')).length;
const practiceCancelAt = (s: State, id: string) => ev(s, id).find((e) => e.kind === 'cancellation' && e.actor === 'practice')?.at;

const MAYA: Step[] = [
  { title: 'Outreach goes out on its own', where: 'auto', how: 'Done automatically: an unscheduled recommendation triggered the first text. No approval step.', done: (s) => ev(s, 'maya').some((e) => e.kind === 'outreach') },
  { title: 'Maya asks why', where: 'phone', how: 'Tap “Why do I need a crown?”. The answer separates Dr. Shah’s note from general information, with sources.', done: (s) => s.cases.maya.asked.includes('why') },
  { title: 'She chooses to proceed and books', where: 'phone', how: 'Tap “Yes, let’s find a time”, then pick a morning slot. The worklist and timeline update instantly.', done: (s) => crownBookings(s, 'maya') >= 1 },
  { title: 'The practice cancels', where: 'controls', how: 'Reviewer controls → “Simulate cancellation”. The coordinator reopens and offers new times.', done: (s) => practiceCancelAt(s, 'maya') !== undefined },
  { title: 'Maya asks to reconnect next week', where: 'phone', how: 'Tap “Check back next week”. The pending follow-up is suppressed.', done: (s) => { const t = practiceCancelAt(s, 'maya'); return t !== undefined && ev(s, 'maya').some((e) => e.kind === 'pause' && e.at >= t); } },
  { title: 'Time passes; the coordinator remembers', where: 'controls', how: 'Reviewer controls → “Skip to Maya’s next action”. It rechecks the record, then offers fresh times.', done: (s) => ev(s, 'maya').some((e) => e.kind === 'resume' && e.title.startsWith('Resumed')) },
  { title: 'She rebooks', where: 'phone', how: 'Pick a time. Optional: skip ahead twice to see the reminder, then “Awaiting completion”. Attending is not completion.', done: (s) => crownBookings(s, 'maya') >= 2 },
  { title: 'Completion closes the case', where: 'controls', how: 'Reviewer controls → “Record completion”. All follow-up stops.', done: (s) => s.cases.maya.status === 'completed' },
];

const SUPPORT: { id: string; name: string; title: string; how: string; done: (s: State) => boolean }[] = [
  {
    id: 'daniel', name: 'Daniel', title: 'Scheduling only',
    how: 'Tap “I’m ready to schedule” and choose a time.',
    done: (s) => crownBookings(s, 'daniel') >= 1,
  },
  {
    id: 'elena', name: 'Elena', title: 'Needs clarification',
    how: 'Why → “Could a filling work instead?” → book a discussion → skip to her next action. Crown stays unscheduled until she decides.',
    done: (s) => s.cases.elena.stage === 'post_consult' || Object.values(s.handoffs).some((h) => h.caseId === 'elena' && h.status === 'discussed'),
  },
];

const WHERE = { phone: 'In the phone', controls: 'Reviewer controls', auto: 'Automatic' };

export function DemoGuide() {
  const { state, ui, setUi } = useStore();
  const [expanded, setExpanded] = useState(false);
  const doneFlags = MAYA.map((st) => st.done(state));
  const current = doneFlags.indexOf(false);
  const doneCount = doneFlags.filter(Boolean).length;
  const go = (id: string) => setUi({ selectedId: id, page: 'worklist' });
  const step = current >= 0 ? MAYA[current] : null;

  if (!ui.guideOpen) {
    return (
      <div className="guide guide-min">
        <button className="guide-collapsed" onClick={() => setUi({ guideOpen: true })}>
          <ListChecks size={14} aria-hidden /> Show demo guide · {doneCount}/{MAYA.length}
        </button>
      </div>
    );
  }

  return (
    <section className="guide" aria-label="Demo guide">
      <div className="guide-row">
        <div className="guide-k">
          <ListChecks size={14} aria-hidden /> Demo guide
          <span className="guide-dots" aria-label={`${doneCount} of ${MAYA.length} steps done`}>
            {doneFlags.map((d, i) => <span key={i} className={d ? 'on' : i === current ? 'cur' : ''} />)}
          </span>
        </div>
        {step ? (
          <div className="guide-now">
            <span className="guide-now-k">Step {current + 1} · {WHERE[step.where]}</span>
            <span className="guide-now-title">{step.title}</span>
            <span className="guide-now-how">{step.how}</span>
          </div>
        ) : (
          <div className="guide-now">
            <span className="guide-now-k is-done">Complete</span>
            <span className="guide-now-title">Maya&rsquo;s journey is done.</span>
            <span className="guide-now-how">Try Daniel (scheduling only) and Elena (needs clarification) from “All steps”.</span>
          </div>
        )}
        <div className="guide-actions">
          {step && ui.selectedId !== 'maya' && <button className="btn btn-small" onClick={() => go('maya')}>Switch to Maya</button>}
          <button className="btn btn-small" onClick={() => setExpanded((x) => !x)} aria-expanded={expanded}>
            All steps <ChevronDown size={12} className={expanded ? 'rot' : ''} aria-hidden />
          </button>
          <button className="link link-quiet" onClick={() => { setExpanded(false); setUi({ guideOpen: false }); }}>Hide</button>
        </div>
      </div>

      {expanded && (
        <div className="guide-all">
          <div>
            <div className="guide-k">Main journey · Maya · about 4 minutes</div>
            <ol className="guide-steps">
              {MAYA.map((st, i) => (
                <li key={st.title} className={doneFlags[i] ? 'is-done' : i === current ? 'is-current' : ''}>
                  <span className="gs-mark">{doneFlags[i] ? <Check size={11} aria-hidden /> : i + 1}</span>
                  <span className="gs-title">{st.title}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="guide-sub">
            <div className="guide-k">Supporting cases</div>
            {SUPPORT.map((x) => {
              const d = x.done(state);
              return (
                <div key={x.id} className={`gsup ${d ? 'is-done' : ''}`}>
                  <span className="gs-mark">{d ? <Check size={11} aria-hidden /> : '·'}</span>
                  <div>
                    <div className="gs-title">{x.name}: {x.title}</div>
                    <div className="gs-how">{d ? 'Done.' : x.how}</div>
                  </div>
                  {ui.selectedId !== x.id && <button className="link" onClick={() => go(x.id)}>Open</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
