import { useStore } from '../store';
import { canPracticeCancel, canRecordCompletion, nextWakeAt } from '../domain/engine';
import { DAY, fmtTime, fmtWDM } from '../domain/time';

/** Reviewer-only simulation controls. Deliberately outside the product chrome. */
export function DemoBar() {
  const { state, ui, act, reset } = useStore();
  const id = ui.view === 'patients' ? ui.selectedId : null;
  const name = id ? state.patients[state.cases[id].patientId].firstName : null;
  const nextAt = nextWakeAt(state, id ?? undefined);
  const needPatient = 'Select a patient first';

  return (
    <div className="demobar" role="region" aria-label="Demo controls">
      <span className="demobar-label">Demo</span>
      <span className="demobar-clock">{fmtWDM(state.now)} · {fmtTime(state.now)}</span>
      <button onClick={() => act({ type: 'advance', ms: DAY }, 'Moved forward one day')}>+1 day</button>
      <button disabled={nextAt === undefined} onClick={() => act({ type: 'jumpNext', caseId: id ?? undefined }, name ? `Skipped to ${name}’s next step` : 'Skipped to the next step')}>
        {name ? `Skip to ${name}’s next step` : 'Skip to next step'}
      </button>
      <span className="demobar-sep" aria-hidden />
      <button disabled={!id || !canPracticeCancel(state, id)} title={id ? 'The practice cancels this appointment (dentist unavailable)' : needPatient}
        onClick={() => id && act({ type: 'practiceCancel', caseId: id }, 'Appointment cancelled by the practice')}>
        Simulate cancellation
      </button>
      <button disabled={!id || !canRecordCompletion(state, id)} title={id ? 'Treatment history records this treatment as complete' : needPatient}
        onClick={() => id && act({ type: 'recordCompletion', caseId: id }, 'Completion recorded in treatment history')}>
        Record completion
      </button>
      <button className="demobar-reset" onClick={() => { if (window.confirm('Reset all sample data?')) reset(); }}>Reset</button>
    </div>
  );
}
