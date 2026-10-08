import type { FaqEntry, FaqFile } from './types';

// FAQ files are edited as markdown and stored as entries.
//   # Title
//   > Intro line
//   ## Question
//   Answer paragraph, or "→ Ask the dentist." / "→ Front desk." to hand the question off.

const ROUTE_TEXT = { dentist: '→ Ask the dentist.', front_desk: '→ Front desk.' } as const;

export function toMarkdown(f: FaqFile): string {
  const body = f.entries.map((e) => `## ${e.q}\n${e.route ? ROUTE_TEXT[e.route] : e.a ?? ''}`).join('\n\n');
  return `# ${f.title}\n> ${f.intro}\n\n${body}\n`;
}

const slug = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'q';

/** Parse edited markdown back into a file. Keys are kept by position so existing replies keep their links. */
export function fromMarkdown(md: string, prev: FaqFile): Pick<FaqFile, 'title' | 'intro' | 'entries'> {
  let title = prev.title;
  const intro: string[] = [];
  const entries: FaqEntry[] = [];
  let cur: { q: string; lines: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const text = cur.lines.join(' ').replace(/\s+/g, ' ').trim();
    const key = prev.entries[entries.length]?.key ?? slug(cur.q);
    if (/^→\s*ask the dentist/i.test(text)) entries.push({ key, q: cur.q, route: 'dentist' });
    else if (/^→\s*front desk/i.test(text)) entries.push({ key, q: cur.q, route: 'front_desk' });
    else entries.push({ key, q: cur.q, a: text });
    cur = null;
  };
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('## ')) { flush(); cur = { q: line.slice(3).trim(), lines: [] }; }
    else if (line.startsWith('# ')) title = line.slice(2).trim();
    else if (line.startsWith('>') && !cur) intro.push(line.replace(/^>\s?/, ''));
    else if (cur && line.trim()) cur.lines.push(line.trim());
  }
  flush();
  return { title, intro: intro.join(' ').trim() || prev.intro, entries };
}
