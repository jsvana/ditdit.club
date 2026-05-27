import React from 'react'
import { fmtDb, fmtW } from '../utils/calculations.js'

// Per-stage table for one scenario so people can see where the watts go.

export default function StageBreakdown({ breakdown }) {
  const rows = []
  rows.push({ label: 'TX output', dB: null, watts: breakdown.txPowerW })
  rows.push({
    label: 'After coax 1',
    dB: -breakdown.coax1Db,
    watts: breakdown.afterCoax1W,
  })
  if (breakdown.ampEnabled) {
    rows.push({
      label: 'After amplifier',
      dB: breakdown.ampDb,
      watts: breakdown.afterAmpW,
    })
    rows.push({
      label: 'After coax 2',
      dB: -breakdown.coax2Db,
      watts: breakdown.afterCoax2W,
    })
  }
  rows.push({
    label: 'After SWR mismatch',
    dB: -breakdown.swrDb,
    watts: breakdown.radiatedW,
  })

  return (
    <div className="stage-breakdown">
      <table>
        <thead>
          <tr>
            <th>Stage</th>
            <th>Δ</th>
            <th>Power</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i === rows.length - 1 ? 'stage-final' : ''}>
              <td>{row.label}</td>
              <td className="stage-delta">
                {row.dB === null ? '—' : fmtDb(row.dB)}
              </td>
              <td className="stage-power">{fmtW(row.watts)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
