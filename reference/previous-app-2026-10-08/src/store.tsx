import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { dispatch as engineDispatch, type Action } from './domain/engine';
import { initialState } from './domain/init';
import { STATE_VERSION } from './domain/seed';
import type { State } from './domain/types';

const KEY = 'harbor-follow-up';

export type View = 'patients' | 'knowledge' | 'integrations';
export type Filter = 'all' | 'attention' | 'progress' | 'booked' | 'closed';

export interface Ui {
  view: View;
  selectedId: string | null;
  tab: 'patient' | 'conversation';
  filter: Filter;
  faqFile: string;
  calendarOpen: boolean;
  showSources: boolean;
}

const defaultUi: Ui = {
  view: 'patients', selectedId: null, tab: 'patient', filter: 'all', faqFile: 'crowns',
  calendarOpen: false, showSources: false,
};

interface Persisted { state: State; ui: Ui }

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      if (p.state?.version === STATE_VERSION) return { state: p.state, ui: defaultUi }; // progress is kept; the app always opens on Patients
    }
  } catch {
    /* storage unavailable: start from the sample practice */
  }
  return { state: initialState(), ui: defaultUi };
}

export interface Toast { id: number; text: string; detail?: string }

interface Store {
  state: State;
  ui: Ui;
  setUi: (patch: Partial<Ui>) => void;
  act: (a: Action, toast?: string) => void;
  reset: () => void;
  notify: (text: string, detail?: string) => void;
  toast: Toast | null;
}

const Ctx = createContext<Store | null>(null);

function summarize(prev: State, next: State): string | undefined {
  const fresh = next.events.slice(prev.events.length).filter((e) => e.actor === 'coordinator' || e.actor === 'practice');
  if (!fresh.length) return undefined;
  const names = [...new Set(fresh.map((e) => next.patients[next.cases[e.caseId].patientId].firstName))];
  return `${fresh.length} automatic step${fresh.length === 1 ? '' : 's'} · ${names.join(', ')}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [{ state, ui }, setAll] = useState<Persisted>(load);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number>();

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ state }));
    } catch {
      /* ignore quota / private mode */
    }
  }, [state]);

  const notify = useCallback((text: string, detail?: string) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, detail });
    timer.current = window.setTimeout(() => setToast(null), 3600);
  }, []);

  const act = useCallback((a: Action, label?: string) => {
    setAll((cur) => {
      const next = engineDispatch(cur.state, a);
      if (label) {
        const detail = summarize(cur.state, next) ?? 'Nothing else was due.';
        queueMicrotask(() => notify(label, detail));
      }
      return { ...cur, state: next };
    });
  }, [notify]);

  const setUi = useCallback((patch: Partial<Ui>) => setAll((cur) => ({ ...cur, ui: { ...cur.ui, ...patch } })), []);

  const reset = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    setAll({ state: initialState(), ui: defaultUi });
    notify('Demo reset', 'Sample practice restored to Mon 12 Oct, 9:30 AM.');
  }, [notify]);

  const value = useMemo(() => ({ state, ui, setUi, act, reset, notify, toast }), [state, ui, setUi, act, reset, notify, toast]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
