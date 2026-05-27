import React from 'react'
import { COAX_TYPES } from '../constants/coaxData.js'

export default function ScenarioForm({ scenario, onChange, title, accent }) {
  const set = (key, val) => onChange({ ...scenario, [key]: val })

  return (
    <div className={`scenario-card ${accent ? 'scenario-card-after' : 'scenario-card-before'}`}>
      <div className="scenario-card-header">
        <span className="scenario-tag">{title}</span>
      </div>

      <div className="form-group">
        <label className="form-label">TX power (W)</label>
        <input
          type="number"
          min="0.1"
          step="any"
          className="form-input"
          value={scenario.txPowerW}
          onChange={e => set('txPowerW', parseFloat(e.target.value) || 0)}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Coax 1 type</label>
          <select
            className="form-input"
            value={scenario.coax1Id}
            onChange={e => set('coax1Id', e.target.value)}
          >
            {COAX_TYPES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Coax 1 length (ft)</label>
          <input
            type="number"
            min="0"
            step="1"
            className="form-input"
            value={scenario.coax1LengthFt}
            onChange={e => set('coax1LengthFt', Math.max(0, parseFloat(e.target.value) || 0))}
          />
        </div>
      </div>

      <div className="form-divider" />

      <div className="form-group form-group-row">
        <label className="form-check">
          <input
            type="checkbox"
            checked={scenario.ampEnabled}
            onChange={e => set('ampEnabled', e.target.checked)}
          />
          <span>Amplifier in the chain</span>
        </label>
      </div>

      {scenario.ampEnabled && (
        <>
          <div className="form-group">
            <label className="form-label">Amplifier output (W)</label>
            <input
              type="number"
              min="1"
              step="any"
              className="form-input"
              value={scenario.ampOutputW}
              onChange={e => set('ampOutputW', Math.max(0, parseFloat(e.target.value) || 0))}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Coax 2 type</label>
              <select
                className="form-input"
                value={scenario.coax2Id}
                onChange={e => set('coax2Id', e.target.value)}
              >
                {COAX_TYPES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Coax 2 length (ft)</label>
              <input
                type="number"
                min="0"
                step="1"
                className="form-input"
                value={scenario.coax2LengthFt}
                onChange={e => set('coax2LengthFt', Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
          </div>
        </>
      )}

      <div className="form-divider" />

      <div className="form-group">
        <label className="form-label">Antenna SWR (X:1)</label>
        <input
          type="number"
          min="1"
          step="0.1"
          className="form-input"
          value={scenario.antennaSwr}
          onChange={e => set('antennaSwr', Math.max(1, parseFloat(e.target.value) || 1))}
        />
      </div>
    </div>
  )
}
