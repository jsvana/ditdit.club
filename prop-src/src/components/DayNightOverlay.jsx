import React from 'react';
import { MAP_CONFIG } from '../constants/map.js';
import { getSunPosition, getTerminatorPath } from '../utils/sun.js';
import { latLonToXY } from '../utils/geo.js';

export const DayNightOverlay = ({ currentTime }) => {
  const sunPos = getSunPosition(currentTime);
  const terminator = getTerminatorPath(sunPos);
  const dawnPoints = [], duskPoints = [];
  terminator.forEach(p => {
    if (p.lonDawn !== null) {
      dawnPoints.push(latLonToXY(p.lat, p.lonDawn));
      duskPoints.push(latLonToXY(p.lat, p.lonDusk));
    }
  });
  const sunXY = latLonToXY(sunPos.lat, sunPos.lon);

  return (
    <g>
      <defs>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(251,191,36,0.7)" />
          <stop offset="100%" stopColor="rgba(251,191,36,0)" />
        </radialGradient>
      </defs>
      {duskPoints.length > 2 && (
        <path
          d={`M ${duskPoints.map(p => `${p.x},${p.y}`).join(' L ')} L ${MAP_CONFIG.width},${duskPoints[duskPoints.length-1].y} L ${MAP_CONFIG.width},0 L 0,0 L 0,${MAP_CONFIG.height} L ${MAP_CONFIG.width},${MAP_CONFIG.height} L ${MAP_CONFIG.width},${dawnPoints[dawnPoints.length-1].y} L ${[...dawnPoints].reverse().map(p => `${p.x},${p.y}`).join(' L ')} Z`}
          fill="rgba(10,15,30,0.45)"
          style={{ pointerEvents: 'none' }}
        />
      )}
      <path d={`M ${dawnPoints.map(p => `${p.x},${p.y}`).join(' L ')}`} fill="none" stroke="rgba(251,191,36,0.6)" strokeWidth="2.5" strokeDasharray="8,5" />
      <path d={`M ${duskPoints.map(p => `${p.x},${p.y}`).join(' L ')}`} fill="none" stroke="rgba(147,51,234,0.6)" strokeWidth="2.5" strokeDasharray="8,5" />
      <circle cx={sunXY.x} cy={sunXY.y} r="35" fill="url(#sunGlow)" />
      <circle cx={sunXY.x} cy={sunXY.y} r="10" fill="#fbbf24" />
    </g>
  );
};
