import React from 'react'
import { fmtDb, fmtW } from '../utils/calculations.js'
import { ANTENNA_BY_ID } from '../constants/antennaData.js'

// Renders a horizontal block diagram for one scenario. Loss values flow
// between blocks on the connecting "cable" segments.

const ICON_SIZE = 44

function RadioIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="4" y="8" width="9" height="5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="17" cy="10.5" r="1.6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="17" cy="15.5" r="1.2" fill="currentColor" />
      <circle cx="6" cy="15.5" r="1" fill="currentColor" />
      <circle cx="10" cy="15.5" r="1" fill="currentColor" />
    </svg>
  )
}

function AmpIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <path d="M5 4 L5 20 L20 12 Z" stroke="currentColor" strokeWidth="1.6" fill="rgba(232,122,159,0.15)" />
      <path d="M2 12 L5 12" stroke="currentColor" strokeWidth="1.6" />
      <path d="M20 12 L22 12" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function AntennaIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <path d="M12 4 L12 20" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 7 L16 7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 4 L4 1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M17 4 L20 1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 20 L15 20" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function Block({ icon, label, sublabel, accent, note }) {
  return (
    <div className={`chain-block ${accent ? 'chain-block-accent' : ''}`}>
      <div className="chain-block-icon">{icon}</div>
      <div className="chain-block-body">
        <div className="chain-block-label">{label}</div>
        {sublabel && <div className="chain-block-sublabel">{sublabel}</div>}
        {note && <div className="chain-block-note">{note}</div>}
      </div>
    </div>
  )
}

function Cable({ lossDb, label }) {
  return (
    <div className="chain-cable">
      <div className="chain-cable-line" />
      <div className="chain-cable-info">
        <div className="chain-cable-label">{label}</div>
        <div className={`chain-cable-loss ${lossDb > 1 ? 'chain-cable-loss-warn' : ''}`}>
          −{lossDb.toFixed(2)} dB
        </div>
      </div>
    </div>
  )
}

export default function SystemChain({ scenario, breakdown }) {
  const {
    txPowerW,
    coax1Id,
    coax1LengthFt,
    ampEnabled,
    ampOutputW,
    coax2Id,
    coax2LengthFt,
    antennaSwr,
  } = scenario

  return (
    <div className="chain-row">
      <Block
        icon={<RadioIcon />}
        label="Radio"
        sublabel={fmtW(txPowerW)}
        accent
      />
      <Cable
        lossDb={breakdown.coax1Db}
        label={`${coax1LengthFt} ft ${labelForCoax(coax1Id)}`}
      />
      {ampEnabled ? (
        <>
          <Block
            icon={<AmpIcon />}
            label="Amplifier"
            sublabel={`→ ${fmtW(ampOutputW)}`}
            accent
            note={`${breakdown.ampDb >= 0 ? '+' : ''}${breakdown.ampDb.toFixed(1)} dB`}
          />
          <Cable
            lossDb={breakdown.coax2Db}
            label={`${coax2LengthFt} ft ${labelForCoax(coax2Id)}`}
          />
        </>
      ) : null}
      <Block
        icon={<AntennaIcon />}
        label={ANTENNA_BY_ID[scenario.antennaId]?.short ?? 'Antenna'}
        sublabel={fmtDbi(breakdown.antGainDbi)}
        accent
        note={antennaNote(breakdown, antennaSwr)}
      />
    </div>
  )
}

function fmtDbi(gain) {
  return (gain >= 0 ? '+' : '') + gain.toFixed(1) + ' dBi'
}

function antennaNote(breakdown, antennaSwr) {
  const parts = [`SWR ${antennaSwr.toFixed(1)}:1`]
  if (breakdown.swrDb > 0.05) {
    parts.push(`(${fmtDb(-breakdown.swrDb)})`)
  }
  if (breakdown.fbDb > 0) {
    parts.push(`F/B ${breakdown.fbDb.toFixed(0)} dB`)
  }
  return parts.join(' ')
}

function labelForCoax(id) {
  const map = {
    rg174: 'RG-174',
    rg58: 'RG-58',
    rg8x: 'RG-8X',
    rg213: 'RG-213',
    lmr400: 'LMR-400',
    ldf4: 'LDF4',
  }
  return map[id] || id
}
