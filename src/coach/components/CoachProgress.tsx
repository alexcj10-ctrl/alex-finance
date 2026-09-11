export function CoachProgress({ value, label }: { value: number; label?: string }) {
  const safeValue = Math.min(Math.max(Math.round(value), 0), 100);

  return (
    <div className="coach-progress">
      {label ? <span className="coach-progress-label">{label}</span> : null}
      <span className="coach-progress-value">{safeValue}%</span>
      <progress
        className="coach-progress-track"
        value={safeValue}
        max={100}
        aria-label={label ?? `Progresso ${safeValue}%`}
      />
    </div>
  );
}
