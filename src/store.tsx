import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { dispatch as engineDispatch, type Action } from './domain/engine';
import { initialState } from './domain/init';
import { STATE_VERSION } from './domain/seed';
import type { State } from './domain/types';

const KEY = 'treatment-follow-up-demo-v2';

export type Page = 'patients' | 'knowledge';

interface Ui {
  selectedId: string;
  page: Page;
  kbId: string;
}

interface Persisted {
  state: State;
  ui: Ui;
}

const defaultUi: Ui = { selectedId: 'maya', page: 'patients', kbId: 'kb-crown' };

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      if (p.state?.version === STATE_VERSION) return { state: p.state, ui: { ...defaultUi, ...p.ui } };
    }
  } catch {
    /* storage unavailable: fall through to fresh sample data */
  }
  return { state: initialState(), ui: defaultUi };
}

export interface Toast {
  id: number;
  text: string;
  detail?: string;
}

interface Store {
  state: State;
  ui: Ui;
  setUi: (patch: Partial<Ui>) => void;
  act: (a: Action) => void;
  reset: () => void;
  toast: Toast | null;
}

const Ctx = createContext<Store | null>(null);

function summarize(prev: State, next: State): string | undefined {
  const fresh = next.events.slice(prev.events.length).filter((e) => e.actor === 'coordinator' || e.actor === 'practice');
  if (!fresh.length) return undefined;
  const names = [...new Set(fresh.map((e) => next.patients[next.cases[e.caseId].patientId].firstName))];
  return `${fresh.length} automatic step${fresh.length === 1 ? '' : 's'} for ${names.join(', ')}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [{ state, ui }, setAll] = useState<Persisted>(load);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number>();

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ state, ui }));
    } catch {
      /* ignore quota / privacy mode */
    }
  }, [state, ui]);

  const showToast = useCallback((text: string, detail?: string) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, detail });
    timer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);

  const act = useCallback(
    (a: Action) => {
      setAll((cur) => {
        const next = engineDispatch(cur.state, a);
        if (a.type !== 'reply') {
          if (a.type === 'advance' || a.type === 'jumpNext') {
            queueMicrotask(() => showToast('Time moved forward', summarize(cur.state, next) ?? 'Nothing was due.'));
          }
        }
        return { ...cur, state: next };
      });
    },
    [showToast],
  );

  const setUi = useCallback((patch: Partial<Ui>) => setAll((cur) => ({ ...cur, ui: { ...cur.ui, ...patch } })), []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setAll({ state: initialState(), ui: { ...defaultUi } });
    showToast('Demo reset', 'Sample patients restored.');
  }, [showToast]);

  const value = useMemo(() => ({ state, ui, setUi, act, reset, toast }), [state, ui, setUi, act, reset, toast]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
