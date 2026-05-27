import React from 'react'
import {
  perceptibilityVerdict,
  fmtDb,
  fmtS,
  fmtW,
  wattsToDbW,
  dbToSUnits,
  txDeltaDb,
  rxSnrDeltaDb,
  FB_NOISE_CREDIT_FRACTION,
} from '../utils/calculations.js'

export default function ResultsPanel({ beforeBreakdown, afterBreakdown }) {
  const txDb = txDeltaDb(beforeBreakdown, afterBreakdown)
  const txS = dbToSUnits(txDb)
  const rxDb = rxSnrDeltaDb(beforeBreakdown, afterBreakdown)
  const rxS = dbToSUnits(rxDb)
  const fbDiffers = afterBreakdown.fbDb !== beforeBreakdown.fbDb

  const verdict = perceptibilityVerdict(txDb)
  const ratio = afterBreakdown.peakEirpW / beforeBreakdown.peakEirpW

  return (
    <div className="results-panel">
      <div className={`results-headline results-tone-${verdict.tone}`}>
        <div className="results-headline-label">TX peak EIRP change</div>
        <div className="results-headline-numbers">
          <span className="results-db">{fmtDb(txDb)}</span>
          <span className="results-sep">·</span>
          <span className="results-s">{fmtS(txS)}-units</span>
        </div>
        <div className="results-verdict">{verdict.label}</div>
      </div>

      {fbDiffers && (
        <div className="results-secondary">
          <div className="results-secondary-label">
            RX SNR change in a noisy QTH
            <span className="results-tooltip">
              (forward gain + {Math.round(FB_NOISE_CREDIT_FRACTION * 100)}% of F/B improvement)
            </span>
          </div>
          <div className="results-secondary-numbers">
            <span className="results-db">{fmtDb(rxDb)}</span>
            <span className="results-sep">·</span>
            <span className="results-s">{fmtS(rxS)}-units</span>
          </div>
        </div>
      )}

      <div className="results-grid">
        <div className="results-cell">
          <div className="results-cell-tag">Before — peak EIRP</div>
          <div className="results-cell-value">{fmtW(beforeBreakdown.peakEirpW)}</div>
          <div className="results-cell-sub">
            net {fmtDb(beforeBreakdown.netDb)} vs. TX · ant {fmtDbi(beforeBreakdown.antGainDbi)}
          </div>
        </div>
        <div className="results-cell">
          <div className="results-cell-tag">After — peak EIRP</div>
          <div className="results-cell-value">{fmtW(afterBreakdown.peakEirpW)}</div>
          <div className="results-cell-sub">
            net {fmtDb(afterBreakdown.netDb)} vs. TX · ant {fmtDbi(afterBreakdown.antGainDbi)}
          </div>
        </div>
        <div className="results-cell">
          <div className="results-cell-tag">Power ratio</div>
          <div className="results-cell-value">{ratio.toFixed(2)}×</div>
          <div className="results-cell-sub">after / before EIRP</div>
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
        <strong>Peak EIRP</strong>{' '}
        bundles your TX output, every dB the chain costs you, and your
        antenna's forward gain into one number — the equivalent isotropic
        power radiated in the antenna's favored direction. It's what a
        receiver lined up with your beam actually sees.
        <br /><br />
        <strong>RX SNR change in a noisy QTH.</strong>{' '}
        A directional antenna doesn't just concentrate your signal — it
        rejects noise coming from behind. We credit half the F/B difference
        as effective SNR improvement when receiving, on the assumption that
        roughly half the environmental noise in a typical noisy location
        comes from non-forward directions. The TX figure is the honest
        signal-strength number; the RX figure tells you what it'll
        <em>feel</em> like at the radio.
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

function fmtDbi(gain) {
  return (gain >= 0 ? '+' : '') + gain.toFixed(1) + ' dBi'
}
