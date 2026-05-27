import React from 'react'
import { COAX_TYPES } from '../constants/coaxData.js'
import {
  ANTENNA_TYPES,
  ANTENNA_BY_ID,
  GROUND_TYPES,
  FT_PER_LAMBDA,
} from '../constants/antennaData.js'

export default function ScenarioForm({ scenario, onChange, title, accent, freqMhz }) {
  const set = (key, val) => onChange({ ...scenario, [key]: val })
  const ant = ANTENNA_BY_ID[scenario.antennaId]
  const wavelengthFt = freqMhz ? FT_PER_LAMBDA(freqMhz) : null
  const hLambda =
    ant?.heightDependent && wavelengthFt
      ? scenario.heightFt / wavelengthFt
      : null

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
        <label className="form-label">Antenna type</label>
        <select
          className="form-input"
          value={scenario.antennaId}
          onChange={e => set('antennaId', e.target.value)}
        >
          <optgroup label="Verticals">
            {ANTENNA_TYPES.filter(a => a.category === 'vertical').map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </optgroup>
          <optgroup label="Horizontal & wire">
            {ANTENNA_TYPES.filter(a => a.category === 'horizontal' || a.category === 'small').map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </optgroup>
          <optgroup label="Directional">
            {ANTENNA_TYPES.filter(a => a.category === 'directional').map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </optgroup>
        </select>
        {ant?.notes && <p className="form-hint">{ant.notes}</p>}
      </div>

      {ant?.groundDependent && (
        <div className="form-group">
          <label className="form-label">Ground quality</label>
          <select
            className="form-input"
            value={scenario.groundType}
            onChange={e => set('groundType', e.target.value)}
          >
            {GROUND_TYPES.map(g => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        </div>
      )}

      {ant?.heightDependent && (
        <div className="form-group">
          <label className="form-label">
            Height above ground (ft)
            {hLambda != null && (
              <span className="form-label-extra">
                {' '}— {hLambda.toFixed(2)} λ at {freqMhz} MHz
              </span>
            )}
          </label>
          <input
            type="number"
            min="0"
            step="1"
            className="form-input"
            value={scenario.heightFt}
            onChange={e => set('heightFt', Math.max(0, parseFloat(e.target.value) || 0))}
          />
          {wavelengthFt && (
            <p className="form-hint">
              λ/2 at {freqMhz} MHz ={' '}
              <strong>{(wavelengthFt / 2).toFixed(0)} ft</strong>;{' '}
              λ at {freqMhz} MHz ={' '}
              <strong>{wavelengthFt.toFixed(0)} ft</strong>.
            </p>
          )}
        </div>
      )}

      {ant?.fbDb > 0 && (
        <div className="form-group">
          <label className="form-label">Front/back ratio (dB)</label>
          <input
            type="number"
            min="0"
            step="0.5"
            className="form-input"
            value={scenario.fbOverride ?? ant.fbDb}
            onChange={e => set('fbOverride', Math.max(0, parseFloat(e.target.value) || 0))}
          />
          <p className="form-hint">
            Default for {ant.short}: {ant.fbDb} dB. Override if you know yours.
          </p>
        </div>
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
