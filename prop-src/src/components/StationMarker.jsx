import React from 'react';
import { latLonToXY } from '../utils/geo.js';

export const StationMarker = ({ lat, lon, call, bandData, isUser, onClick, isSelected, zoom = 1 }) => {
  const { x, y } = latLonToXY(lat, lon);
  const s = 1 / zoom;

  if (isUser) {
    const size = 6 * s;
    return (
      <g>
        <rect
          x={x - size}
          y={y - size}
          width={size * 2}
          height={size * 2}
          fill="#06b6d4"
          transform={`rotate(45 ${x} ${y})`}
        />
        <text x={x} y={y + 16 * s} textAnchor="middle" fill="#06b6d4" fontSize={11 * s} fontFamily="monospace" fontWeight="bold">{call}</text>
      </g>
    );
  }

  const color = bandData?.bestBand?.color || '#64748b';
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <circle cx={x} cy={y} r={14 * s} fill={color} opacity="0.2" />
      <circle cx={x} cy={y} r={9 * s} fill={color} opacity="0.5" />
      <circle cx={x} cy={y} r={6 * s} fill={color} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2 * s} />
      <text x={x} y={y + 20 * s} textAnchor="middle" fill={color} fontSize={11 * s} fontFamily="monospace" fontWeight="600">{call}</text>
      {bandData?.bestBand && <text x={x} y={y + 32 * s} textAnchor="middle" fill={color} fontSize={10 * s} fontFamily="monospace" opacity="0.85">{bandData.bestBand.name}</text>}
    </g>
  );
};
