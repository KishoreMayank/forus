import { useStore } from '../store';
import { PRACTICE } from '../domain/seed';
import { rel } from '../domain/view';
import { fmtTime, startOfDay } from '../domain/time';
import type { State } from '../domain/types';

interface Integration {
  id: string; mono: string; name: string; purpose: string; sub: string;
  reads: string[]; writes: string[];
  foot: (s: State) => string;
  log: (s: State) => [string, string][];
  action: 'sync' | 'calendar' | null;
}

const who = (s: State, caseId: string) => s.patients[s.cases[caseId].patientId].name;
const recentEvents = (s: State, kinds: string[]) => s.events.filter((e) => kinds.includes(e.kind)).slice(-4).reverse();
const sent = (s: State, channel: 'text' | 'email') => s.messages.filter((m) => m.from === 'coordinator' && m.channel === channel);

const INTEGRATIONS: Integration[] = [
  {
    id: 'charts', mono: 'PC', name: 'Patient charts', purpose: 'Who needs follow-up', sub: 'Practice management system',
    reads: ['Treatment plans with nothing booked', 'The dentist’s note for each plan', 'Contact details and preferences'], writes: [],
    foot: (s) => { const n = s.events.filter((e) => e.kind === 'found' && startOfDay(e.at) === startOfDay(s.now)).length; return n ? `${n} new plan${n === 1 ? '' : 's'} today` : 'No new plans today'; },
    log: (s) => recentEvents(s, ['found']).map((e) => [rel(e.at, s.now), `Found a treatment plan: ${who(s, e.caseId)}`]),
    action: 'sync',
  },
  {
    id: 'history', mono: 'TH', name: 'Treatment history', purpose: 'Whether treatment is done', sub: 'Practice management system',
    reads: ['Completed procedures', 'Past visits'], writes: [],
    foot: (s) => { const n = s.caseOrder.filter((id) => s.cases[id].status === 'completed').length; return `${n} completed`; },
    log: (s) => recentEvents(s, ['completion', 'record']).map((e) => [rel(e.at, s.now), `${who(s, e.caseId)}: ${e.title.toLowerCase()}`]),
    action: 'sync',
  },
  {
    id: 'scheduling', mono: 'SC', name: 'Scheduling', purpose: 'When patients can come in', sub: 'Appointment book for Dr. Shah & Dr. Bell',
    reads: ['Open times', 'Existing appointments', 'Cancellations'], writes: ['Appointments patients choose', 'Cancellations they ask for'],
    foot: (s) => { const n = Object.values(s.appointments).filter((a) => a.status === 'booked').length; return `${n} upcoming booking${n === 1 ? '' : 's'}`; },
    log: (s) => recentEvents(s, ['booking', 'cancellation']).map((e) => [rel(e.at, s.now), `${who(s, e.caseId)} · ${e.title}`]),
    action: 'calendar',
  },
  {
    id: 'sms', mono: 'TX', name: 'Text messages', purpose: PRACTICE.textNumber, sub: PRACTICE.textNumber,
    reads: ['Patient replies', 'STOP and START'], writes: ['Texts on weekdays, 9–6', 'A first text and up to 2 follow-ups'],
    foot: (s) => { const m = sent(s, 'text').at(-1); return m ? `Last sent ${rel(m.at, s.now)}` : 'Nothing sent yet'; },
    log: (s) => sent(s, 'text').slice(-4).reverse().map((m) => [rel(m.at, s.now), `Sent to ${who(s, m.caseId)}${m.tag ? ` · ${m.tag.toLowerCase()}` : ''}`]),
    action: null,
  },
  {
    id: 'email', mono: 'EM', name: 'Email', purpose: PRACTICE.email, sub: PRACTICE.email,
    reads: ['Patient replies', 'Unsubscribes'], writes: ['Emails to patients who prefer email', 'Same rules as texts'],
    foot: (s) => { const n = Object.values(s.patients).filter((p) => p.channel === 'email').length; return `For ${n} patient${n === 1 ? '' : 's'} who prefer email`; },
    log: (s) => {
      const out = sent(s, 'email').slice(-4).reverse().map((m) => [rel(m.at, s.now), `Sent to ${who(s, m.caseId)}`] as [string, string]);
      const queued = s.caseOrder.filter((id) => s.patients[s.cases[id].patientId].channel === 'email' && s.cases[id].next?.type === 'outreach');
      return [...queued.map((id) => [rel(s.cases[id].next!.at, s.now), `First email to ${who(s, id)} scheduled`] as [string, string]), ...out];
    },
    action: null,
  },
];

export function Integrations() {
  const { state, ui, setUi, act, notify } = useStore();
  const open = INTEGRATIONS.find((i) => i.id === ui.integration);

  return (
    <section className="view">
      <header className="page-head">
        <h1>Integrations</h1>
        <p>Where patients, appointments and messages come from. All {INTEGRATIONS.length} connected · synced {fmtTime(state.lastSync)}.</p>
      </header>
      <div className={`ig-layout ${open ? 'has-panel' : ''}`}>
        <div>
          <div className="tiles">
            {INTEGRATIONS.map((i) => (
              <button key={i.id} className={`tile ${open?.id === i.id ? 'sel' : ''}`} onClick={() => setUi({ integration: open?.id === i.id ? null : i.id })}>
                <span className="tile-top"><span className="mono">{i.mono}</span><span className="ok"><span className="dot" />Connected</span></span>
                <b>{i.name}</b>
                <small>{i.purpose}</small>
                <span className="tile-foot">{i.foot(state)}</span>
              </button>
            ))}
          </div>

          <div className="ig-group">Not connected</div>
          <ul className="ig-off">
            <li className="ig-mini"><div><b>Insurance eligibility</b><small>Needed before costs.md can answer cost questions. Until then, they go to the front desk.</small></div><span className="soon">Not connected</span></li>
            <li className="ig-mini"><div><b>Phone calls</b><small>Not available yet</small></div><span className="soon">Planned</span></li>
          </ul>

          <div className="never">
            <div className="ig-group" style={{ margin: '0 0 6px' }}>Never, whatever is connected</div>
            <ul>
              <li>Changes a treatment plan or clinical note</li>
              <li>Answers a clinical question the chart doesn’t</li>
              <li>Books outside the scheduling rules</li>
              <li>Messages anyone who opted out</li>
            </ul>
          </div>
        </div>

        {open && (
          <aside className="panel ig-detail" aria-label={open.name}>
            <div className="panel-head">
              <div><h3>{open.name}</h3><div className="p-tx">{open.sub} · synced {fmtTime(state.lastSync)}</div></div>
              <button className="x" aria-label="Close" onClick={() => setUi({ integration: null })}>×</button>
            </div>
            <div className="p-sec ig-rw">
              <div><div className="k">Reads</div><ul>{open.reads.map((r) => <li key={r}>{r}</li>)}</ul></div>
              <div><div className="k">Writes</div><ul>{open.writes.length ? open.writes.map((w) => <li key={w}>{w}</li>) : <li className="muted">Nothing</li>}</ul></div>
            </div>
            {open.action && (
              <div className="p-sec">
                {open.action === 'sync'
                  ? <button className="btn" onClick={() => { act({ type: 'sync' }); notify(`${open.name} synced`, 'No changes since the last sync.'); }}>Sync now</button>
                  : <button className="btn" onClick={() => setUi({ calendarOpen: true })}>Open calendar</button>}
              </div>
            )}
            <div className="p-sec">
              <div className="k">Activity</div>
              <ol className="ig-log">
                {open.log(state).map(([t, x], n) => <li key={n}><time>{t}</time>{x}</li>)}
                {open.log(state).length === 0 && <li className="muted">Nothing yet</li>}
              </ol>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
