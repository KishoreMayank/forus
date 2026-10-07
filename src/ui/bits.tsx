import type { ReactNode } from 'react';
import { BookOpen, Stethoscope } from 'lucide-react';
import type { Tone } from './meta';
import type { State } from '../domain/types';
import { fmtShort } from '../domain/time';

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`pill tone-${tone}`}>{children}</span>;
}

export function Avatar({ initials, tone = 'gray', size = 36 }: { initials: string; tone?: Tone; size?: number }) {
  return (
    <span className={`avatar tone-${tone}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {initials}
    </span>
  );
}

/** Compact source references for a message or event. */
export function Sources({ state, kbIds = [], noteIds = [], onOpen }: { state: State; kbIds?: string[]; noteIds?: string[]; onOpen?: (kind: 'kb' | 'note', id: string) => void }) {
  if (!kbIds.length && !noteIds.length) return null;
  return (
    <div className="sources">
      {noteIds.filter((id) => state.notes[id]).map((id) => {
        const n = state.notes[id];
        return (
          <button key={id} className="src src-note" onClick={() => onOpen?.('note', id)} type="button" title="Patient-specific: clinician-recorded">
            <Stethoscope size={12} aria-hidden /> {state.providers[n.providerId].short} {n.kind === 'consult' ? 'discussion' : 'exam'} note · {fmtShort(n.date)}
          </button>
        );
      })}
      {kbIds.map((id) => (
        <button key={id} className="src src-kb" onClick={() => onOpen?.('kb', id)} type="button" title="General practice knowledge">
          <BookOpen size={12} aria-hidden /> {state.kb[id].title}
        </button>
      ))}
    </div>
  );
}
