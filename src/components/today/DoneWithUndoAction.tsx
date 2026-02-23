interface DoneWithUndoActionProps {
  onUndo: () => void;
  doneLabel?: string;
  undoLabel?: string;
  compact?: boolean;
}

export function DoneWithUndoAction({
  onUndo,
  doneLabel = "Done",
  undoLabel = "Undo",
  compact = false,
}: DoneWithUndoActionProps) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={`inline-flex items-center justify-center bg-accent text-white font-medium shadow-sm ${
          compact
            ? "rounded-lg px-3 py-2 text-sm"
            : "min-h-[44px] rounded-xl px-4 py-2.5 text-sm"
        }`}
      >
        {doneLabel}
      </span>
      <button
        type="button"
        onClick={onUndo}
        className="rounded-lg border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
      >
        {undoLabel}
      </button>
    </div>
  );
}
