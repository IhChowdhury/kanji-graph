import StrokeAnimation from './StrokeAnimation'
import { useStrokeOrderSvg } from './useStrokeOrderSvg'

function StrokeOrderPanel({ character }: { character: string }) {
  const { status, svgText } = useStrokeOrderSvg(character)

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Stroke Order
      </h3>

      <div className="mt-2">
        {status === 'ready' && svgText && <StrokeAnimation svgText={svgText} />}

        {status === 'loading' && (
          <div className="flex aspect-square w-full max-w-[180px] items-center justify-center rounded-md border border-slate-700 bg-white">
            <span className="text-xs text-slate-500">Loading…</span>
          </div>
        )}

        {status === 'unavailable' && (
          <div className="flex aspect-square w-full max-w-[180px] items-center justify-center rounded-md border border-slate-700 bg-white">
            <span className="px-3 text-center text-xs text-slate-500">
              Stroke order not available
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default StrokeOrderPanel
