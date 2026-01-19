import React from 'react';
import { latLonToXY } from '../utils/geo.js';
import { getMufColor, getMufBand } from '../api/ionosonde.js';

export const IonosondeMarkers = ({ stations, hoveredIonosonde, setHoveredIonosonde, selectedIonosonde, setSelectedIonosonde, zoom = 1 }) => {
  const s = 1 / zoom;

  return (
    <g>
      {stations.map(station => {
        const { x, y } = latLonToXY(station.lat, station.lon);
        const color = getMufColor(station.mufd);
        const isHovered = hoveredIonosonde === station.id;
        const isSelected = selectedIonosonde === station.id;
        const isActive = isHovered || isSelected;
        const radius = isActive ? 8 : 5;

        // Calculate tooltip width based on content
        const nameLen = station.name.length;
        const tooltipWidth = Math.max(160, nameLen * 7 + 20);

        return (
          <g key={station.id}>
            {/* Glow effect */}
            <circle
              cx={x}
              cy={y}
              r={(radius + 4) * s}
              fill={color}
              fillOpacity={isSelected ? 0.4 : 0.2}
              style={{ pointerEvents: 'none' }}
            />
            {/* Main marker */}
            <circle
              cx={x}
              cy={y}
              r={radius * s}
              fill={color}
              fillOpacity={0.9}
              stroke={isSelected ? '#fff' : color}
              strokeWidth={(isSelected ? 2.5 : 1.5) * s}
              strokeOpacity={isSelected ? 1 : 0.8}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredIonosonde(station.id)}
              onMouseLeave={() => setHoveredIonosonde(null)}
              onClick={() => setSelectedIonosonde(isSelected ? null : station.id)}
            />
            {/* Tooltip */}
            {isActive && (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={x + 10 * s}
                  y={y - 40 * s}
                  width={tooltipWidth * s}
                  height={58 * s}
                  rx={4 * s}
                  fill="rgba(15,23,42,0.95)"
                  stroke={color}
                  strokeWidth={1 * s}
                />
                <text x={x + 16 * s} y={y - 24 * s} fill="#fff" fontSize={10 * s} fontFamily="monospace" fontWeight="600">
                  {station.name}
                </text>
                <text x={x + 16 * s} y={y - 8 * s} fill={color} fontSize={11 * s} fontFamily="monospace" fontWeight="700">
                  MUF: {station.mufd.toFixed(1)} MHz ({getMufBand(station.mufd)})
                </text>
                <text x={x + 16 * s} y={y + 8 * s} fill="#94a3b8" fontSize={9 * s} fontFamily="monospace">
                  {new Date(station.time).toLocaleTimeString()} • {station.confidence > 0 ? `${station.confidence}%` : 'N/A'}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
};
