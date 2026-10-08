import { useEffect, useRef, useState } from 'react';
import { useStore, type View } from './store';
import { DemoBar } from './ui/DemoBar';
import { Patients } from './ui/Patients';
import { Knowledge } from './ui/Knowledge';
import { Integrations } from './ui/Integrations';
import { CalendarModal } from './ui/Calendar';
import { PRACTICE } from './domain/seed';
import { fmtTime } from './domain/time';

const NAV: [View, string][] = [['patients', 'Patients'], ['knowledge', 'Knowledge'], ['integrations', 'Integrations']];

export function App() {
  const { ui, setUi, toast } = useStore();
  return (
    <div className="app">
      <DemoBar />
      <div className="product">
        <header className="bar">
          <span className="practice">{PRACTICE.name}<span>/</span>Follow-up</span>
          <nav className="nav" aria-label="Product">
            {NAV.map(([v, label]) => (
              <button key={v} aria-current={ui.view === v ? 'page' : undefined} onClick={() => setUi({ view: v })}>{label}</button>
            ))}
          </nav>
          <SyncStatus />
        </header>
        {ui.view === 'patients' && <Patients />}
        {ui.view === 'knowledge' && <Knowledge />}
        {ui.view === 'integrations' && <Integrations />}
        {ui.calendarOpen && <CalendarModal />}
      </div>
      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <strong>{toast.text}</strong>
          {toast.detail && <span>{toast.detail}</span>}
        </div>
      )}
    </div>
  );
}

function SyncStatus() {
  const { state, setUi } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const sources: [string, string][] = [
    ['Scheduling', 'Appointment book'],
    ['Patient charts', 'Treatment plans and dentist notes'],
    ['Treatment history', 'Completed procedures'],
    ['Insurance & billing', 'Coverage and balances'],
  ];
  return (
    <div className="sync" ref={ref}>
      <button aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="dot" />Synced {fmtTime(state.lastSync)}
      </button>
      {open && (
        <ul className="pop">
          {sources.map(([name, sub]) => (
            <li key={name}><span className="dot" /><b>{name}</b><small>{sub}</small></li>
          ))}
          <li className="pop-foot"><button className="link" onClick={() => { setOpen(false); setUi({ view: 'integrations' }); }}>Manage integrations →</button></li>
        </ul>
      )}
    </div>
  );
}
