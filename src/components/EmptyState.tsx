export function EmptyState({
  emoji,
  title,
  hint,
}: {
  emoji: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span
        className="flex size-16 items-center justify-center rounded-full bg-muted text-3xl"
        aria-hidden
      >
        {emoji}
      </span>
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-xs text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
