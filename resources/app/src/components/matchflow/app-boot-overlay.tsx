/** Spinner-only handoff from PHP boot shell — same background as app (#f8fafc). */
export function AppBootOverlay() {
  return (
    <div
      className="mf-app-boot"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="mf-app-boot__inner">
        <div className="mf-app-boot__spinner-wrap">
          <div className="mf-boot-glow" aria-hidden />
          <div className="mf-boot-spinner" aria-hidden />
        </div>
      </div>
    </div>
  )
}
