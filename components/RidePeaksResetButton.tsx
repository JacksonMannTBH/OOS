export function RidePeaksResetButton({ label, onClick, busy = false, disabled = false, className = "" }: {
  label: string; onClick: () => void; busy?: boolean; disabled?: boolean; className?: string;
}) {
  return <button type="button" className={`ss-ride-peaks-reset ${className}`}
    aria-label={label} title={label} aria-busy={busy} disabled={busy || disabled} onClick={onClick}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 12a9 9 0 0 1 15.7-5.7L21 9M21 3v6h-6M21 12a9 9 0 0 1-15.7 5.7L3 15M3 21v-6h6" />
    </svg>
  </button>;
}
