import type { ReactNode } from 'react';
import { useStore } from '../store';
import { rel } from '../domain/view';
import type { State } from '../domain/types';

const Icon = ({ children }: { children: ReactNode }) => (
  <span className="sys-icon" aria-hidden>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  </span>
);
const ICONS = {
  calendar: <Icon><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></Icon>,
  chart: <Icon><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z" /><path d="M14 3.5V8h4M9 12.5h6M9 16h6" /></Icon>,
  history: <Icon><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 4v4.5h4.5M12 8v4.5l3 2" /></Icon>,
  billing: <Icon><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10.5h18M7 15h4" /></Icon>,
};

const lastEvent = (s: State, kinds: string[], test?: (why: string) => boolean) =>
  [...s.events].reverse().find((e) => kinds.includes(e.kind) && (!test || test(e.title + e.why)));
const who = (s: State, caseId: string) => s.patients[s.cases[caseId].patientId].name;

interface System {
  id: string; name: string; from: string; icon: ReactNode; does: string;
  latest: (s: State) => string;
  calendar?: boolean;
}

const SYSTEMS: System[] = [
  {
    id: 'charts', name: 'Patient charts', from: 'Practice management system', icon: ICONS.chart,
    does: 'Reads treatment plans, the dentist’s note for each, and contact preferences. Never edits the chart.',
    latest: (s) => `Latest records received ${rel(s.lastSync, s.now)}`,
  },
  {
    id: 'scheduling', name: 'Scheduling', from: 'Practice calendar', icon: ICONS.calendar, calendar: true,
    does: 'Reads open times. Books, reschedules and cancels appointments only after the patient confirms.',
    latest: (s) => {
      const e = lastEvent(s, ['booking']);
      return e ? `Last booking ${rel(e.at, s.now)} · ${who(s, e.caseId)}` : 'No bookings yet';
    },
  },
  {
    id: 'history', name: 'Treatment history', from: 'Practice management system', icon: ICONS.history,
    does: 'Reads completed procedures, so a case closes only when the work is charted as done, not when a visit is attended.',
    latest: (s) => {
      const done = s.caseOrder.filter((id) => s.cases[id].status === 'completed').length;
      return `Last checked ${rel(s.lastSync, s.now)}${done ? ` · ${done} completed through follow-up` : ''}`;
    },
  },
  {
    id: 'billing', name: 'Insurance & billing', from: 'Practice management system', icon: ICONS.billing,
    does: 'Gives the front desk coverage and balances to quote an exact cost. The coordinator hands cost questions to them instead of answering.',
    latest: (s) => {
      const e = lastEvent(s, ['handoff'], (t) => t.includes('front desk'));
      return e ? `Last cost question handed off ${rel(e.at, s.now)} · ${who(s, e.caseId)}` : 'No cost questions yet';
    },
  },
];

export function Integrations() {
  const { state, setUi } = useStore();
  return (
    <section className="view">
      <header className="page-head">
        <h1>Integrations</h1>
        <p>The systems that supply patient context and carry out follow-up.</p>
      </header>
      <p className="sys-lede">Four connections support this workflow. Each has one job, and staff can see what is read and what can be changed.</p>

      <ul className="systems">
        {SYSTEMS.map((sys) => (
          <li key={sys.id} className="sys">
            {sys.icon}
            <div className="sys-name">
              <b>{sys.name}</b>
              <span>{sys.from}</span>
            </div>
            <div className="sys-does">
              <p>{sys.does}</p>
              <p className="sys-latest">{sys.latest(state)}</p>
              {sys.calendar && <button className="link" onClick={() => setUi({ calendarOpen: true })}>Open calendar ›</button>}
            </div>
            <span className="sys-status"><span className="dot" />Connected</span>
          </li>
        ))}
      </ul>

      <section className="sys-how">
        <h2>How the records become follow-up</h2>
        <ol>
          <li>Find a recommended treatment with nothing booked in the patient chart.</li>
          <li>Check scheduling for an existing appointment, and the patient’s permission to be contacted.</li>
          <li>Follow up by text or email, answering from the chart and the practice’s FAQs.</li>
          <li>Keep the case open until treatment history shows the work is done.</li>
        </ol>
      </section>

      <p className="sys-foot">Interactive prototype · fictional records · no live messages or system connections.</p>
    </section>
  );
}
