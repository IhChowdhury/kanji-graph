import type { JlptLevel } from '../../types/kanji'

export const jlptStyles: Record<
  JlptLevel,
  { border: string; bg: string; badge: string }
> = {
  N5: {
    border: 'border-emerald-500',
    bg: 'bg-emerald-950/40',
    badge: 'bg-emerald-500 text-emerald-950',
  },
  N4: {
    border: 'border-blue-500',
    bg: 'bg-blue-950/40',
    badge: 'bg-blue-500 text-blue-950',
  },
  N3: {
    border: 'border-orange-500',
    bg: 'bg-orange-950/40',
    badge: 'bg-orange-500 text-orange-950',
  },
  N2: {
    border: 'border-purple-500',
    bg: 'bg-purple-950/40',
    badge: 'bg-purple-500 text-purple-950',
  },
  N1: {
    border: 'border-red-500',
    bg: 'bg-red-950/40',
    badge: 'bg-red-500 text-red-950',
  },
}
