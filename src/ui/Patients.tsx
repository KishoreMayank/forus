import { useMemo, useState } from 'react';
import { useStore, type Filter } from '../store';
import { GROUP_LABEL, groupOf, sortCases, statusOf, type Group } from '../domain/view';
import { TREATMENTS } from '../domain/catalog';
import { PatientPanel } from './PatientPanel';

const GROUPS: Group[] = ['attention', 'progress', 'booked', 'closed'];

export function Patients() {
  const { state, ui, setUi } = useStore();
  const [q, setQ] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  const byGroup = useMemo(() => {
    const out: Record<Group, string[]> = { attention: [], progress: [], booked: [], closed: [] };
    for (const g of GROUPS) {
      const cases = state.caseOrder.map((id) => state.cases[id]).filter((c) => groupOf(c) === g);
      out[g] = sortCases(state, cases, g).map((c) => c.id);
    }
    return out;
  }, [state]);

  const total = state.caseOrder.length;
  const match = (id: string) => !q.trim() || state.patients[state.cases[id].patientId].name.toLowerCase().includes(q.trim().toLowerCase());
  const chips: [Filter, string, number][] = [
    ['all', 'All', total],
    ['attention', 'Needs attention', byGroup.attention.length],
    ['progress', 'In progress', byGroup.progress.length],
    ['booked', 'Booked', byGroup.booked.length],
    ...(byGroup.closed.length ? [['closed', 'Closed', byGroup.closed.length] as [Filter, string, number]] : []),
  ];
  const open = (id: string) => setUi({ selectedId: ui.selectedId === id ? null : id, tab: 'patient' });

  return (
    <section className="view">
      <header className="page-head">
        <h1>Patients</h1>
        <p>Recommended care, followed through to completion.</p>
      </header>

      <div className={`pt-layout ${ui.selectedId ? 'has-panel' : ''}`}>
        <div className="pt-list">
          <div className="count-line">{total} patients · from patient charts, last 90 days</div>
          <label className="search">
            <span className="sr">Search patients</span>
            <input type="search" placeholder="Search patients" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="toolbar">
            <div className="filters" role="tablist" aria-label="Filter by status">
              {chips.map(([f, label, n]) => (
                <button key={f} role="tab" aria-selected={ui.filter === f} onClick={() => setUi({ filter: f })}>
                  {label} <span className="cnt">{n}</span>
                </button>
              ))}
            </div>
          </div>

          {GROUPS.map((g) => {
            if (ui.filter !== 'all' && ui.filter !== g) return null;
            const ids = byGroup[g].filter(match);
            if (!ids.length) return null;
            const collapsed = g === 'closed' && ui.filter !== 'closed' && !showClosed;
            return (
              <div className="queue" key={g}>
                <div className="queue-h">
                  <span className="grp"><i className={`gdot ${g === 'attention' ? 'attn' : g === 'booked' ? 'booked' : g === 'closed' ? 'closed' : ''}`} />{GROUP_LABEL[g]}</span>
                  <span className="grp-r">
                    {g === 'booked' && <button className="link" onClick={() => setUi({ calendarOpen: true })}>Open calendar</button>}
                    {g === 'closed' && ui.filter !== 'closed' && <button className="link" onClick={() => setShowClosed((v) => !v)}>{showClosed ? 'Hide' : 'Show'}</button>}
                    <span className="cnt">{ids.length}</span>
                  </span>
                </div>
                {!collapsed && (
                  <div className="rows">
                    {ids.map((id) => <Row key={id} id={id} selected={ui.selectedId === id} onOpen={open} />)}
                  </div>
                )}
              </div>
            );
          })}
          {GROUPS.every((g) => !byGroup[g].some(match)) && <p className="empty">No patients match “{q}”.</p>}
        </div>

        {ui.selectedId && state.cases[ui.selectedId] && <PatientPanel caseId={ui.selectedId} />}
      </div>
    </section>
  );
}

function Row({ id, selected, onOpen }: { id: string; selected: boolean; onOpen: (id: string) => void }) {
  const { state } = useStore();
  const c = state.cases[id];
  const p = state.patients[c.patientId];
  const rec = state.recommendations[c.recommendationId];
  const st = statusOf(state, c);
  return (
    <button className={`q ${selected ? 'sel' : ''}`} onClick={() => onOpen(id)} aria-current={selected || undefined}>
      <span className="who">
        <span className="name">{p.name}</span>
        <span className="tx">{TREATMENTS[rec.treatment].label} · {state.providers[c.providerId].short}</span>
      </span>
      <span className="track">
        <span className={`sdot ${st.dot}`} />
        <span>{st.text}</span>
        {st.tag && <span className="flag">{st.tag}</span>}
      </span>
      <span className="chev" aria-hidden>›</span>
    </button>
  );
}
