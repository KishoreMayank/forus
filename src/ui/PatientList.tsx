import { useStore } from '../store';
import { STATUS, nextActionText } from './meta';
import { isOpen } from '../domain/engine';
import { fmtRelative } from '../domain/time';

export function PatientList() {
  const { state, ui, setUi } = useStore();
  const cases = state.caseOrder.map((id) => state.cases[id]);
  const count = (f: (s: string) => boolean) => cases.filter((c) => f(c.status)).length;

  return (
    <aside className="list">
      <div className="counts">
        <div><b>{cases.filter(isOpen).length}</b> active</div>
        <div><b>{count((s) => s === 'booked' || s === 'visit_passed')}</b> booked</div>
        <div><b>{count((s) => s === 'completed')}</b> completed</div>
      </div>
      <ul>
        {cases.map((c) => {
          const p = state.patients[c.patientId];
          const r = state.recommendations[c.recommendationId];
          const st = STATUS[c.status];
          const nx = nextActionText(state, c);
          return (
            <li key={c.id}>
              <button className={`list-row ${ui.selectedId === c.id ? 'is-sel' : ''}`} onClick={() => setUi({ selectedId: c.id })}>
                <div className="list-top">
                  <span className="list-name">{p.name}</span>
                  <span className={`pill tone-${st.tone}`}>{st.label}</span>
                </div>
                <div className="list-sub">{r.treatment} · {r.tooth.split(' ·')[0]}</div>
                <div className="list-next">Next: {nx.label}{nx.at ? ` · ${fmtRelative(nx.at, state.now)}` : ''}</div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="list-note">Sample patients. All data is fictional.</p>
    </aside>
  );
}
