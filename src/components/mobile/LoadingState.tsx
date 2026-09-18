// Shared loading placeholder - shown instead of rendering an empty view
// while kanji/graph data is still being fetched.
function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span aria-hidden className="animate-spin text-3xl">
        ⏳
      </span>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}

export default LoadingState
