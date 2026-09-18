import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

import { useMediaQuery } from '../../hooks/useMediaQuery'

export type SheetSnap = 'peek' | 'half' | 'full'

const SNAP_FRACTIONS: Record<SheetSnap, number> = {
  peek: 0.14,
  half: 0.55,
  full: 0.92,
}

// Wide-short viewports (mobile landscape) shouldn't let "full" cover the
// entire screen - there's no room above it to show any context at all.
const LANDSCAPE_FULL_FRACTION = 0.8

const SNAP_ORDER: SheetSnap[] = ['peek', 'half', 'full']

interface BottomSheetProps {
  open: boolean
  snap: SheetSnap
  onSnapChange: (snap: SheetSnap) => void
  onClose: () => void
  title: string
  children: ReactNode
}

function BottomSheet({ open, snap, onSnapChange, onClose, title, children }: BottomSheetProps) {
  const isLandscapeShort = useMediaQuery('(max-height: 500px) and (orientation: landscape)')
  const fullFraction = isLandscapeShort ? LANDSCAPE_FULL_FRACTION : SNAP_FRACTIONS.full
  const fractions: Record<SheetSnap, number> = { ...SNAP_FRACTIONS, full: fullFraction }

  const sheetRef = useRef<HTMLDivElement | null>(null)
  const dragStartYRef = useRef<number | null>(null)
  const startFractionRef = useRef(0)
  const [dragFraction, setDragFraction] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (open && snap === 'full') {
      sheetRef.current?.focus()
    }
  }, [open, snap])

  if (!open) return null

  const currentFraction = dragFraction ?? fractions[snap]

  const handlePointerDown = (event: ReactPointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartYRef.current = event.clientY
    startFractionRef.current = fractions[snap]
  }

  const handlePointerMove = (event: ReactPointerEvent) => {
    if (dragStartYRef.current === null) return
    const deltaPx = event.clientY - dragStartYRef.current
    const deltaFraction = deltaPx / window.innerHeight
    setDragFraction(Math.max(0, startFractionRef.current - deltaFraction))
  }

  const handlePointerUp = () => {
    if (dragStartYRef.current === null) return
    const finalFraction = dragFraction ?? fractions[snap]
    dragStartYRef.current = null
    setDragFraction(null)

    if (finalFraction < fractions.peek * 0.6) {
      onClose()
      return
    }

    let nearest: SheetSnap = 'peek'
    let bestDiff = Infinity
    for (const candidate of SNAP_ORDER) {
      const diff = Math.abs(fractions[candidate] - finalFraction)
      if (diff < bestDiff) {
        bestDiff = diff
        nearest = candidate
      }
    }
    onSnapChange(nearest)
  }

  const handleHandleKeyDown = (event: ReactKeyboardEvent) => {
    const index = SNAP_ORDER.indexOf(snap)
    if (event.key === 'ArrowUp' && index < SNAP_ORDER.length - 1) {
      onSnapChange(SNAP_ORDER[index + 1])
    } else if (event.key === 'ArrowDown') {
      if (index === 0) onClose()
      else onSnapChange(SNAP_ORDER[index - 1])
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-950/50 transition-opacity"
        style={{ opacity: Math.min(1, currentFraction / fractions.half) }}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal={snap === 'full'}
        aria-label={title}
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border-t border-slate-700 bg-slate-900 shadow-[0_-8px_30px_rgba(0,0,0,0.4)] outline-none"
        style={{
          height: `${currentFraction * 100}vh`,
          paddingBottom: 'env(safe-area-inset-bottom)',
          transition: dragFraction === null ? 'height 220ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
        }}
      >
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleHandleKeyDown}
          aria-label={`Drag to resize ${title} panel`}
          className="flex h-11 w-full shrink-0 touch-none items-center justify-center"
        >
          <span className="h-1.5 w-12 rounded-full bg-slate-600" />
        </button>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
      </div>
    </>
  )
}

export default BottomSheet
