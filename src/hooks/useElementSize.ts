import { useEffect, useRef, useState } from 'react'

interface Size {
  width: number
  height: number
}

/**
 * Tracks a ref'd element's content-box size via ResizeObserver - used by
 * PracticeScreen to size the writing-practice canvas to fill most of the
 * available screen instead of the fixed 260px desktop/tablet size.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}
