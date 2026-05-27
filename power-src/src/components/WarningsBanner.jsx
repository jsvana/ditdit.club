import React from 'react'

export default function WarningsBanner({ warnings }) {
  if (!warnings || warnings.length === 0) return null
  return (
    <div className="warnings">
      {warnings.map((w, i) => (
        <div key={i} className={`warning warning-${w.tone}`}>
          <span className="warning-icon">{w.tone === 'warn' ? '⚠' : 'ⓘ'}</span>
          <span className="warning-text">{w.text}</span>
        </div>
      ))}
    </div>
  )
}
