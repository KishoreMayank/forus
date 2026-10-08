import { useStore } from '../store';
import { fmtTime } from '../domain/time';

const SYSTEMS = [
  { id: 'scheduling', name: 'Scheduling', desc: 'Appointment book for Dr. Shah & Dr. Bell', calendar: true },
  { id: 'charts', name: 'Patient charts', desc: 'Treatment plans, dentist notes and contact preferences' },
  { id: 'history', name: 'Treatment history', desc: 'Completed procedures, so finished cases close' },
  { id: 'billing', name: 'Insurance & billing', desc: 'Coverage and balances, for the front desk to quote costs' },
] as const;

export function Integrations() {
  const { state, setUi } = useStore();
  return (
    <section className="view">
      <header className="page-head">
        <h1>Integrations</h1>
        <p>Connected to the practice management system · synced {fmtTime(state.lastSync)}</p>
      </header>
      <ul className="systems">
        {SYSTEMS.map((s) => {
          const body = (
            <>
              <span className="sys-main"><b>{s.name}</b><span>{s.desc}</span></span>
              <span className="sys-status"><span className="dot" />Connected</span>
              {'calendar' in s ? <span className="sys-open">Open calendar ›</span> : <span className="sys-open" aria-hidden />}
            </>
          );
          return (
            <li key={s.id}>
              {'calendar' in s
                ? <button className="sys sys-link" onClick={() => setUi({ calendarOpen: true })}>{body}</button>
                : <div className="sys">{body}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
