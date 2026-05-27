import React from 'react'
import {
  perceptibilityVerdict,
  fmtDb,
  fmtS,
  fmtW,
  wattsToDbW,
  dbToSUnits,
} from '../utils/calculations.js'

export default function ResultsPanel({ beforeBreakdown, afterBreakdown }) {
  const deltaDb = wattsToDbW(afterBreakdown.radiatedW) - wattsToDbW(beforeBreakdown.radiatedW)
  const deltaS = dbToSUnits(deltaDb)
  const verdict = perceptibilityVerdict(deltaDb)
  const ratio = afterBreakdown.radiatedW / beforeBreakdown.radiatedW

  return (
    <div className="results-panel">
      <div className={`results-headline results-tone-${verdict.tone}`}>
        <div className="results-headline-numbers">
          <span className="results-db">{fmtDb(deltaDb)}</span>
          <span className="results-sep">·</span>
          <span className="results-s">{fmtS(deltaS)}-units</span>
        </div>
        <div className="results-verdict">{verdict.label}</div>
      </div>

      <div className="results-grid">
        <div className="results-cell">
          <div className="results-cell-tag">Before — radiated</div>
          <div className="results-cell-value">{fmtW(beforeBreakdown.radiatedW)}</div>
          <div className="results-cell-sub">
            net {fmtDb(beforeBreakdown.netDb)} vs. TX
          </div>
        </div>
        <div className="results-cell">
          <div className="results-cell-tag">After — radiated</div>
          <div className="results-cell-value">{fmtW(afterBreakdown.radiatedW)}</div>
          <div className="results-cell-sub">
            net {fmtDb(afterBreakdown.netDb)} vs. TX
          </div>
        </div>
        <div className="results-cell">
          <div className="results-cell-tag">Power ratio</div>
          <div className="results-cell-value">{ratio.toFixed(2)}×</div>
          <div className="results-cell-sub">after / before radiated</div>
        </div>
      </div>

      <div className="results-explainer">
        <strong>How to read this.</strong>{' '}
        One S-unit = 6 dB (IARU R.1). Doubling power is 3 dB, half an S-unit —
        the smallest change most people can hear on the other end. Going from
        100&nbsp;W to 1.5&nbsp;kW is about 12 dB, two S-units: clearly louder
        but not a no-copy-to-perfect transformation. Most “upgrades” live
        below one S-unit; antenna and feedline choices usually matter more
        than chasing watts.
        <br /><br />
        <strong>About S-meters.</strong>{' '}
        Real HF radios are notoriously sloppy here — many run closer to
        3–4 dB per S-unit in the middle of the scale, so the S-unit change
        a receiver actually shows can be roughly double the number here.
        The dB number is the honest one.
      </div>
    </div>
  )
}
