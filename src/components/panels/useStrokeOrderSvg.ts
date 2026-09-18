import { useEffect, useState } from 'react'

export type StrokeOrderStatus = 'loading' | 'ready' | 'unavailable'

interface StrokeOrderSvgResult {
  status: StrokeOrderStatus
  svgText: string | null
}

export function useStrokeOrderSvg(character: string): StrokeOrderSvgResult {
  const [svgText, setSvgText] = useState<string | null>(null)
  const [status, setStatus] = useState<StrokeOrderStatus>('loading')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setSvgText(null)

    const url = `${import.meta.env.BASE_URL}stroke-order/${encodeURIComponent(character)}.svg`

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Stroke order SVG not found: ${url}`)
        return response.text()
      })
      .then((text) => {
        if (cancelled) return
        setSvgText(text)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('unavailable')
      })

    return () => {
      cancelled = true
    }
  }, [character])

  return { status, svgText }
}
