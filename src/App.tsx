import { useStore } from './store';
import { DemoBar } from './ui/DemoBar';
import { PatientList } from './ui/PatientList';
import { CaseView } from './ui/CaseView';
import { Knowledge } from './ui/Knowledge';
import { PRACTICE } from './domain/seed';

export function App() {
  const { ui, setUi, toast } = useStore();
  return (
    <div className="app">
      <DemoBar />
      <header className="topbar">
        <div className="brand">
          <b>Treatment Follow-Up</b>
          <span className="muted">{PRACTICE.name} (sample practice)</span>
        </div>
        <nav className="nav">
          <button className={ui.page === 'patients' ? 'is-on' : ''} onClick={() => setUi({ page: 'patients' })}>Patients</button>
          <button className={ui.page === 'knowledge' ? 'is-on' : ''} onClick={() => setUi({ page: 'knowledge' })}>Knowledge library</button>
        </nav>
      </header>

      {ui.page === 'patients' ? (
        <main className="main">
          <PatientList />
          <CaseView />
        </main>
      ) : (
        <main className="main-kb"><Knowledge /></main>
      )}

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <strong>{toast.text}</strong>
          {toast.detail && <span>{toast.detail}</span>}
        </div>
      )}
    </div>
  );
}
