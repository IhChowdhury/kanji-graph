interface EmptyStateProps {
  icon: string
  title: string
  description: string
  // Secondary status line (e.g. "No Kanji is currently selected.") - shown
  // smaller/muted below the description when present.
  note?: string
  actionLabel: string
  onAction: () => void
}

// Shared "nothing to show yet, here's what to do" placeholder - used
// wherever a mobile screen would otherwise have to render blank (Graph and
// Practice tabs with no Kanji selected). Never render an empty screen with
// no indication of what action is required.
function EmptyState({ icon, title, description, note, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span aria-hidden className="text-5xl">
        {icon}
      </span>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="text-sm text-slate-400">{description}</p>
      {note && <p className="text-sm text-slate-500">{note}</p>}
      <button
        type="button"
        onClick={onAction}
        className="mt-2 flex min-h-11 items-center justify-center rounded-lg border border-emerald-600 bg-emerald-600/20 px-5 text-sm font-medium text-emerald-300 active:bg-emerald-600/30"
      >
        {actionLabel}
      </button>
    </div>
  )
}

export default EmptyState
