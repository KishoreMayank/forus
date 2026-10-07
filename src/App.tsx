import { LayoutList, Library, MessageSquareText, MonitorSmartphone } from 'lucide-react';
import { useStore } from './store';
import { SimBar } from './ui/SimBar';
import { Worklist } from './ui/Worklist';
import { Knowledge } from './ui/Knowledge';
import { PatientPhone } from './ui/PatientPhone';
import { DemoGuide } from './ui/DemoGuide';
import { PRACTICE } from './domain/seed';

export function App() {
  const { ui, setUi, toast } = useStore();
  return (
    <div className="app">
      <SimBar />
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <div>
            <div className="brand-name">Treatment Follow-Up</div>
            <div className="brand-sub">{PRACTICE.name} · Sample practice</div>
          </div>
        </div>
        <nav className="nav" aria-label="Product">
          <button className={`nav-btn ${ui.page === 'worklist' ? 'is-on' : ''}`} onClick={() => setUi({ page: 'worklist', pane: 'admin' })} aria-current={ui.page === 'worklist' ? 'page' : undefined}>
            <LayoutList size={15} aria-hidden /> Worklist
          </button>
          <button className={`nav-btn ${ui.page === 'knowledge' ? 'is-on' : ''}`} onClick={() => setUi({ page: 'knowledge', pane: 'admin' })} aria-current={ui.page === 'knowledge' ? 'page' : undefined}>
            <Library size={15} aria-hidden /> Knowledge library
          </button>
        </nav>
        <div className="topbar-right">
          <span className="sample-badge" title="All patients, notes, and schedules are fictional">Sample data</span>
        </div>
      </header>

      <div className="pane-switch" role="tablist" aria-label="Choose view">
        <button role="tab" aria-selected={ui.pane === 'admin'} className={ui.pane === 'admin' ? 'is-on' : ''} onClick={() => setUi({ pane: 'admin' })}>
          <MonitorSmartphone size={15} aria-hidden /> Practice view
        </button>
        <button role="tab" aria-selected={ui.pane === 'patient'} className={ui.pane === 'patient' ? 'is-on' : ''} onClick={() => setUi({ pane: 'patient' })}>
          <MessageSquareText size={15} aria-hidden /> Patient phone
        </button>
      </div>

      <DemoGuide />

      <main className={`main pane-${ui.pane}`}>
        <section className="admin">{ui.page === 'worklist' ? <Worklist /> : <Knowledge />}</section>
        <aside className="patient" aria-label="Patient view">
          <PatientPhone />
        </aside>
      </main>

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <strong>{toast.text}</strong>
          {toast.detail && <span>{toast.detail}</span>}
        </div>
      )}
    </div>
  );
}
