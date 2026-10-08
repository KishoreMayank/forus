import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { slotsBetween, takenElsewhere } from '../domain/slots';
import { TREATMENTS } from '../domain/catalog';
import { DAY, addDays, fmtDM, startOfDay } from '../domain/time';

const START_H = 8;
const END_H = 18;
const PX = 48; // per hour

function mondayOf(t: number) {
  const d = new Date(startOfDay(t));
  const dow = (d.getDay() + 6) % 7;
  return addDays(d.getTime(), -dow);
}

/** Read-only view of the practice's appointment book. Follow-up bookings are coloured. */
export function CalendarModal() {
  const { state, setUi } = useStore();
  const [week, setWeek] = useState(() => mondayOf(state.now));
  const [onlyOurs, setOnlyOurs] = useState(false);
  const close = () => setUi({ calendarOpen: false });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const days = [0, 1, 2, 3, 4].map((i) => addDays(week, i));
  const weekEnd = addDays(week, 5);
  const ours = Object.values(state.appointments).filter((a) => a.status !== 'cancelled' && a.start >= week && a.start < weekEnd);
  const busy = slotsBetween(week, weekEnd).filter((s) => takenElsewhere(s.id) && !state.bookedSlots[s.id]);
  const top = (t: number) => ((new Date(t).getHours() + new Date(t).getMinutes() / 60) - START_H) * PX;

  return (
    <>
      <div className="scrim" id="calScrim" onClick={close} />
      <div className="modal" role="dialog" aria-modal="true" aria-label="Appointment book">
        <div className="modal-head">
          <div className="modal-k">Scheduling · appointment book</div>
          <button className="x" aria-label="Close calendar" onClick={close} autoFocus>×</button>
        </div>
        <div className="ig-cal-head">
          <h3>{fmtDM(week)} – {fmtDM(addDays(week, 4))}</h3>
          <span className="sub">Dr. Shah &amp; Dr. Bell</span>
          <div className="cal-tools">
            <div className="seg">
              <button aria-pressed={!onlyOurs} onClick={() => setOnlyOurs(false)}>All appointments</button>
              <button aria-pressed={onlyOurs} onClick={() => setOnlyOurs(true)}>Booked by follow-up</button>
            </div>
            <button className="arrow" aria-label="Previous week" disabled={week <= mondayOf(state.now)} onClick={() => setWeek(addDays(week, -7))}>‹</button>
            <button className="arrow" aria-label="Next week" onClick={() => setWeek(addDays(week, 7))}>›</button>
          </div>
        </div>
        <div className={`cal ${onlyOurs ? 'only-ours' : ''}`}>
          <div />
          {days.map((d) => (
            <div key={d} className={`dh ${startOfDay(d) === startOfDay(state.now) ? 'today' : ''}`}><b>{new Date(d).toLocaleDateString('en-US', { weekday: 'short' })}</b>{new Date(d).getDate()}</div>
          ))}
          <div className="times" style={{ height: (END_H - START_H) * PX }}>
            {Array.from({ length: END_H - START_H }, (_, i) => START_H + i).map((h) => (
              <span key={h} style={{ top: (h - START_H) * PX }}>{h > 12 ? h - 12 : h}{h >= 12 ? 'pm' : 'am'}</span>
            ))}
          </div>
          {days.map((d) => (
            <div key={d} className="day" style={{ height: (END_H - START_H) * PX, backgroundSize: `100% ${PX}px` }}>
              {busy.filter((s) => s.start >= d && s.start < d + DAY).map((s) => (
                <div key={s.id} className="ap busy" style={{ top: top(s.start) + 1, height: Math.max(((s.end - s.start) / 3_600_000) * PX - 3, 16) }} />
              ))}
              {ours.filter((a) => a.start >= d && a.start < d + DAY).map((a) => {
                const c = state.cases[a.caseId];
                const p = state.patients[c.patientId];
                const tx = TREATMENTS[state.recommendations[c.recommendationId].treatment];
                const fresh = a.bookedAt > state.now - DAY;
                return (
                  <button key={a.id} className={`ap ours ${a.type === 'consult' ? 'consult' : ''}`}
                    style={{ top: top(a.start) + 1, height: Math.max(((a.end - a.start) / 3_600_000) * PX - 3, 22) }}
                    onClick={() => setUi({ calendarOpen: false, view: 'patients', selectedId: c.id, tab: 'patient' })}
                    title={`Open ${p.name}`}>
                    <b>{p.name}</b>{a.type === 'consult' ? 'Call' : tx.label} · {state.providers[a.providerId].short}
                    {fresh && <><br /><span className="new">New · booked by {p.channel === 'email' ? 'email' : 'text'}</span></>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cal-legend">
          <span><i style={{ background: 'var(--teal)' }} />Booked by a patient over text or email</span>
          <span><i style={{ background: 'var(--amber-wash)', border: '1px solid #EAD6B8' }} />Call with a dentist</span>
          <span><i style={{ background: '#F0F2F3' }} />Other appointments</span>
        </div>
      </div>
    </>
  );
}
