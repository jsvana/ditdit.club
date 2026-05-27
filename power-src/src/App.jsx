import React, { useMemo, useState } from 'react'
import { BAND_PRESETS } from './constants/coaxData.js'
import { computeChain, scenarioWarnings } from './utils/calculations.js'
import SystemChain from './components/SystemChain.jsx'
import ScenarioForm from './components/ScenarioForm.jsx'
import ResultsPanel from './components/ResultsPanel.jsx'
import StageBreakdown from './components/StageBreakdown.jsx'
import WarningsBanner from './components/WarningsBanner.jsx'

const DEFAULT_BEFORE = {
  txPowerW: 5,
  coax1Id: 'rg8x',
  coax1LengthFt: 25,
  ampEnabled: false,
  ampOutputW: 100,
  coax2Id: 'rg8x',
  coax2LengthFt: 25,
  antennaSwr: 1.5,
}

const DEFAULT_AFTER = {
  txPowerW: 100,
  coax1Id: 'lmr400',
  coax1LengthFt: 50,
  ampEnabled: false,
  ampOutputW: 600,
  coax2Id: 'lmr400',
  coax2LengthFt: 50,
  antennaSwr: 1.2,
}

const PRESETS = [
  {
    id: 'qrp-to-100w',
    name: 'QRP → 100 W',
    blurb: 'The classic "should I get a bigger radio?" question',
    before: { ...DEFAULT_BEFORE, txPowerW: 5 },
    after: { ...DEFAULT_BEFORE, txPowerW: 100 },
  },
  {
    id: '100w-to-amp',
    name: '100 W → 600 W amp',
    blurb: 'A typical solid-state amp upgrade',
    before: { ...DEFAULT_BEFORE, txPowerW: 100, antennaSwr: 1.2 },
    after: { ...DEFAULT_BEFORE, txPowerW: 100, ampEnabled: true, ampOutputW: 600, antennaSwr: 1.2 },
  },
  {
    id: '100w-to-legal',
    name: '100 W → 1500 W',
    blurb: 'Stock radio vs. legal limit',
    before: { ...DEFAULT_BEFORE, txPowerW: 100, antennaSwr: 1.2 },
    after: { ...DEFAULT_BEFORE, txPowerW: 100, ampEnabled: true, ampOutputW: 1500, antennaSwr: 1.2 },
  },
  {
    id: 'cheap-coax',
    name: 'RG-58 → LMR-400',
    blurb: 'How much does the feedline really matter?',
    before: { ...DEFAULT_BEFORE, txPowerW: 100, coax1Id: 'rg58', coax1LengthFt: 100 },
    after: { ...DEFAULT_BEFORE, txPowerW: 100, coax1Id: 'lmr400', coax1LengthFt: 100 },
  },
  {
    id: 'fix-swr',
    name: 'Fix that bad SWR',
    blurb: '3:1 mismatch vs. a properly tuned antenna',
    before: { ...DEFAULT_BEFORE, txPowerW: 100, antennaSwr: 3.0 },
    after: { ...DEFAULT_BEFORE, txPowerW: 100, antennaSwr: 1.2 },
  },
]

export default function App() {
  const [freqMhz, setFreqMhz] = useState(14)
  const [before, setBefore] = useState(DEFAULT_BEFORE)
  const [after, setAfter] = useState(DEFAULT_AFTER)

  const beforeBreakdown = useMemo(
    () => computeChain({ ...before, freqMhz }),
    [before, freqMhz]
  )
  const afterBreakdown = useMemo(
    () => computeChain({ ...after, freqMhz }),
    [after, freqMhz]
  )
  const beforeWarnings = useMemo(
    () => scenarioWarnings(before, beforeBreakdown),
    [before, beforeBreakdown]
  )
  const afterWarnings = useMemo(
    () => scenarioWarnings(after, afterBreakdown),
    [after, afterBreakdown]
  )

  function applyPreset(preset) {
    setBefore(preset.before)
    setAfter(preset.after)
  }

  return (
    <div className="app">
      <header className="app-hero">
        <a href="/" className="back-link">← ditdit.club</a>
        <h1 className="app-title">Power Budget</h1>
        <p className="app-tagline">
          See what your station upgrade actually buys you. In dB, in S-units,
          and in honest perspective.
        </p>
      </header>

      <section className="freq-strip">
        <label className="freq-strip-label">Band / frequency</label>
        <div className="freq-strip-controls">
          <select
            className="form-input freq-strip-select"
            value={freqMhz}
            onChange={e => setFreqMhz(parseFloat(e.target.value))}
          >
            {BAND_PRESETS.map(b => (
              <option key={b.mhz} value={b.mhz}>{b.label}</option>
            ))}
          </select>
          <span className="freq-strip-or">or</span>
          <input
            type="number"
            min="0.1"
            step="any"
            className="form-input freq-strip-input"
            value={freqMhz}
            onChange={e => setFreqMhz(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
          />
          <span className="freq-strip-unit">MHz</span>
        </div>
      </section>

      <section className="presets">
        <div className="presets-label">Quick scenarios:</div>
        <div className="presets-row">
          {PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              className="preset-chip"
              onClick={() => applyPreset(p)}
              title={p.blurb}
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      <section className="diagram-section">
        <h2 className="section-title">Before</h2>
        <SystemChain scenario={before} breakdown={beforeBreakdown} />
        <WarningsBanner warnings={beforeWarnings} />
        <h2 className="section-title section-title-after">After</h2>
        <SystemChain scenario={after} breakdown={afterBreakdown} />
        <WarningsBanner warnings={afterWarnings} />
      </section>

      <section className="results-section">
        <ResultsPanel
          beforeBreakdown={beforeBreakdown}
          afterBreakdown={afterBreakdown}
        />
      </section>

      <section className="scenarios">
        <div className="scenarios-grid">
          <ScenarioForm
            title="Before"
            scenario={before}
            onChange={setBefore}
          />
          <ScenarioForm
            title="After"
            scenario={after}
            onChange={setAfter}
            accent
          />
        </div>
      </section>

      <section className="breakdown-section">
        <h2 className="section-title">Stage-by-stage breakdown</h2>
        <div className="breakdown-grid">
          <div>
            <h3 className="breakdown-subtitle">Before</h3>
            <StageBreakdown breakdown={beforeBreakdown} />
          </div>
          <div>
            <h3 className="breakdown-subtitle">After</h3>
            <StageBreakdown breakdown={afterBreakdown} />
          </div>
        </div>
      </section>

      <footer className="app-footer">
        <p>
          Coax loss values are nominal, from manufacturer datasheets, with
          per-band loss interpolated in √f to track skin-effect physics. Real
          cable varies with age, weather, and connector quality. SWR mismatch
          loss uses the simple feedpoint formula and ignores the extra coax
          round-trip loss from reflected waves — a warning surfaces when
          that effect is large enough to matter.
        </p>
        <p className="app-footer-link">
          <a href="/">← back to ditdit.club</a>
        </p>
      </footer>
    </div>
  )
}
