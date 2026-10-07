import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useStore } from '../store';
import { FILTERS, STATUS, BARRIER, nextActionText, type Filter } from './meta';
import { fmtDayRelative, fmtRelative } from '../domain/time';
import { isOpen } from '../domain/engine';
import { CaseDetail } from './CaseDetail';
import { Avatar, Pill } from './bits';

export function Worklist() {
  const { state, ui, setUi } = useStore();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [mobileDetail, setMobileDetail] = useState(false);

  const cases = state.caseOrder.map((id) => state.cases[id]);
  const counts = useMemo(() => {
    const auto = state.events.filter((e) => e.actor === 'coordinator' && e.kind !== 'duplicate' && e.kind !== 'suppressed').length;
    return {
      active: cases.filter(isOpen).length,
      booked: cases.filter((c) => c.status === 'booked' || c.status === 'visit_passed').length,
      completed: cases.filter((c) => c.status === 'completed').length,
      auto,
    };
  }, [state, cases]);

  const filtered = cases.filter((c) => {
    const f = FILTERS.find((x) => x.id === filter)!;
    if (!f.match(c)) return false;
    if (!q.trim()) return true;
    const p = state.patients[c.patientId];
    const r = state.recommendations[c.recommendationId];
    const hay = `${p.name} ${r.treatment} ${r.tooth} ${STATUS[c.status].label} ${BARRIER[c.barrier]}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const select = (id: string) => {
    setUi({ selectedId: id });
    setMobileDetail(true);
  };

  return (
    <div className={`worklist ${mobileDetail ? 'show-detail' : ''}`}>
      <div className="summary" aria-label="Practice summary">
        <Stat label="Active cases" value={counts.active} sub="being coordinated" />
        <Stat label="Booked" value={counts.booked} sub="treatment on schedule" />
        <Stat label="Completed" value={counts.completed} sub="confirmed by record" />
        <Stat label="Automated steps" value={counts.auto} sub="0 needed staff approval" />
        <p className="summary-note">Sample data · counts are simulated activity, not evidence of impact.</p>
      </div>

      <div className="wl-grid">
        <section className="wl-list" aria-label="Patient worklist">
          <div className="wl-tools">
            <label className="search">
              <Search size={15} aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patients, status, barrier" aria-label="Search patients" />
              {q && (
                <button className="icon-btn" onClick={() => setQ('')} aria-label="Clear search"><X size={14} /></button>
              )}
            </label>
            <div className="filters" role="tablist" aria-label="Filter by status">
              {FILTERS.map((f) => {
                const n = cases.filter(f.match).length;
                return (
                  <button key={f.id} role="tab" aria-selected={filter === f.id} className={`chip ${filter === f.id ? 'is-on' : ''}`} onClick={() => setFilter(f.id)}>
                    {f.label} <span className="chip-n">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <ul className="rows">
            {filtered.length === 0 && <li className="empty">No patients match.</li>}
            {filtered.map((c) => {
              const p = state.patients[c.patientId];
              const r = state.recommendations[c.recommendationId];
              const st = STATUS[c.status];
              const nx = nextActionText(state, c);
              return (
                <li key={c.id}>
                  <button className={`row ${ui.selectedId === c.id ? 'is-sel' : ''}`} onClick={() => select(c.id)} aria-current={ui.selectedId === c.id}>
                    <Avatar initials={p.initials} tone={st.tone} />
                    <div className="row-main">
                      <div className="row-top">
                        <span className="row-name">{p.name}</span>
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </div>
                      <div className="row-sub">
                        {c.script !== 'background' && <span className="demo-tag">{c.script === 'main' ? 'Main journey' : c.script === 'scheduling' ? 'Scheduling only' : 'Needs clarification'}</span>}
                        {r.treatment} · {r.tooth.split(' ·')[0]} <span className="dot">·</span> Barrier: {BARRIER[c.barrier]}
                      </div>
                      <div className="row-meta">
                        <span><span className="k">Last</span> {c.lastAction ? `${c.lastAction.label} · ${fmtDayRelative(c.lastAction.at, state.now)}` : '—'}</span>
                        <span><span className="k">Next</span> {nx.label}{nx.at ? ` · ${fmtRelative(nx.at, state.now)}` : ''}</span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="wl-detail" aria-label="Case detail">
          <button className="back-btn" onClick={() => setMobileDetail(false)}>← All patients</button>
          <CaseDetail caseId={ui.selectedId} />
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-sub">{sub}</span>
    </div>
  );
}
