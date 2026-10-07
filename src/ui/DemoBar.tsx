import { useStore } from '../store';
import { canPracticeCancel, canRecordCompletion, nextWakeAt } from '../domain/engine';
import { DAY, fmtDate, fmtTime } from '../domain/time';

/** Reviewer-only simulation controls. Not part of the product. */
export function DemoBar() {
  const { state, ui, act, reset } = useStore();
  const c = state.cases[ui.selectedId];
  const name = state.patients[c.patientId].firstName;
  const nextAt = nextWakeAt(state, c.id);

  return (
    <div className="demobar" role="region" aria-label="Demo controls">
      <span className="demobar-label">Demo controls</span>
      <span className="demobar-clock">{fmtDate(state.now)} · {fmtTime(state.now)}</span>
      <button onClick={() => act({ type: 'advance', ms: DAY })}>+1 day</button>
      <button disabled={nextAt === undefined} onClick={() => act({ type: 'jumpNext', caseId: c.id })}>
        Skip to {name}&rsquo;s next step
      </button>
      <button disabled={!canPracticeCancel(state, c.id)} onClick={() => act({ type: 'practiceCancel', caseId: c.id })}>
        Simulate cancellation
      </button>
      <button disabled={!canRecordCompletion(state, c.id)} onClick={() => act({ type: 'recordCompletion', caseId: c.id })}>
        Record completion
      </button>
      <button className="demobar-reset" onClick={() => { if (confirm('Reset all sample data?')) reset(); }}>Reset</button>
    </div>
  );
}
