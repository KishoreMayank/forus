import { useEffect, useRef, useState } from 'react';
import { CalendarX, CheckCircle2, Clock, FastForward, MoreHorizontal, RotateCcw, Repeat, SkipForward } from 'lucide-react';
import { useStore } from '../store';
import { canPracticeCancel, canRecordCompletion, nextWakeAt } from '../domain/engine';
import { DAY, fmtDate, fmtRelative, fmtShort, fmtTime } from '../domain/time';

export function SimBar() {
  const { state, ui, act, reset } = useStore();
  const [menu, setMenu] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const c = state.cases[ui.selectedId];
  const p = state.patients[c.patientId];
  const nextAt = nextWakeAt(state, c.id);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenu(false);
        setConfirmReset(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  return (
    <div className="simbar" role="region" aria-label="Reviewer simulation controls">
      <div className="simbar-inner">
        <div className="simbar-label">
          <span className="sim-dot" aria-hidden />
          <span>
            <strong>Reviewer controls</strong>
            <span className="sim-sub">Simulation · not part of the product</span>
          </span>
        </div>

        <div className="sim-clock" title="Simulated practice clock">
          <Clock size={14} aria-hidden />
          <span className="sim-clock-date">{fmtDate(state.now)}</span>
          <span className="sim-clock-time">{fmtTime(state.now)}</span>
        </div>

        <div className="sim-actions">
          <button className="sim-btn" onClick={() => act({ type: 'advance', ms: DAY })} title="Advance the clock one day and process any due actions">
            <FastForward size={14} aria-hidden /> +1 day
          </button>
          <button
            className="sim-btn sim-btn-primary"
            disabled={nextAt === undefined}
            onClick={() => act({ type: 'jumpNext', caseId: c.id })}
            title={nextAt ? `Advance to ${fmtRelative(nextAt, state.now)} and process everything due by then` : 'Nothing scheduled for this patient'}
          >
            <SkipForward size={14} aria-hidden />
            <span>
              Skip to {p.firstName}&rsquo;s next action
              {nextAt !== undefined && <span className="sim-btn-meta"> · {fmtShort(nextAt)}, {fmtTime(nextAt)}</span>}
            </span>
          </button>
          <span className="sim-sep" aria-hidden />
          <span className="sim-target">{p.firstName}:</span>
          <button className="sim-btn" disabled={!canPracticeCancel(state, c.id)} onClick={() => act({ type: 'practiceCancel', caseId: c.id })}
            title="The practice schedule cancels this patient's appointment (e.g., dentist unavailable)">
            <CalendarX size={14} aria-hidden /> Simulate cancellation
          </button>
          <button className="sim-btn" disabled={!canRecordCompletion(state, c.id)} onClick={() => act({ type: 'recordCompletion', caseId: c.id })}
            title="The practice record marks this treatment complete (crown seated)">
            <CheckCircle2 size={14} aria-hidden /> Record completion
          </button>
        </div>

        <div className="sim-menu" ref={menuRef}>
          <button className="sim-btn sim-icon" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} title="More controls">
            <MoreHorizontal size={16} aria-hidden /><span className="sr-only">More controls</span>
          </button>
          {menu && (
            <div className="sim-pop" role="menu">
              <button role="menuitem" disabled={!state.lastWake} onClick={() => { act({ type: 'replayLast' }); setMenu(false); }}>
                <Repeat size={14} aria-hidden />
                <span>Replay last event<small>Re-delivers the most recent scheduled event to show it can&rsquo;t create duplicates</small></span>
              </button>
              {!confirmReset ? (
                <button role="menuitem" onClick={() => setConfirmReset(true)}>
                  <RotateCcw size={14} aria-hidden />
                  <span>Reset demo<small>Restore every sample record and the clock</small></span>
                </button>
              ) : (
                <div className="sim-confirm">
                  <span>Reset all sample data?</span>
                  <div>
                    <button className="sim-btn" onClick={() => setConfirmReset(false)}>Keep</button>
                    <button className="sim-btn sim-btn-danger" onClick={() => { reset(); setMenu(false); setConfirmReset(false); }}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
