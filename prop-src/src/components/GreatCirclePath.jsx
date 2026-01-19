import React from 'react';
import { MAP_CONFIG } from '../constants/map.js';
import { getGreatCirclePath, latLonToXY } from '../utils/geo.js';

export const GreatCirclePath = ({ fromLat, fromLon, toLat, toLon, color, isSelected, zoom = 1 }) => {
  const pathPoints = getGreatCirclePath(fromLat, fromLon, toLat, toLon, 50);
  const segments = [];
  let seg = [];
  const s = 1 / zoom;

  pathPoints.forEach((p, i) => {
    const xy = latLonToXY(p.lat, p.lon);
    if (i > 0) {
      const prevXY = latLonToXY(pathPoints[i-1].lat, pathPoints[i-1].lon);
      // Detect wrap-around (large x jump)
      if (Math.abs(xy.x - prevXY.x) > MAP_CONFIG.width * 0.5) {
        if (seg.length) segments.push([...seg]);
        seg = [];
      }
    }
    seg.push(xy);
  });
  if (seg.length) segments.push(seg);

  return (
    <g style={{ pointerEvents: 'none' }}>
      {segments.map((seg, i) => (
        <g key={i}>
          <path d={`M ${seg.map(p => `${p.x},${p.y}`).join(' L ')}`} fill="none" stroke={color} strokeWidth={(isSelected ? 10 : 5) * s} strokeOpacity="0.2" strokeLinecap="round" />
          <path d={`M ${seg.map(p => `${p.x},${p.y}`).join(' L ')}`} fill="none" stroke={color} strokeWidth={(isSelected ? 3.5 : 2) * s} strokeOpacity={isSelected ? 0.9 : 0.6} strokeDasharray={isSelected ? "none" : `${10*s},${6*s}`} strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
};
