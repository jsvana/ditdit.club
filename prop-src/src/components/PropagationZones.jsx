import React from 'react';
import { BANDS } from '../constants/bands.js';
import { MAP_CONFIG } from '../constants/map.js';
import { latLonToXY } from '../utils/geo.js';

export const PropagationZones = ({ zones, visibleBands, hoveredZone, setHoveredZone, selectedZone, setSelectedZone, zoom = 1 }) => {
  // Sort zones so lower bands render first (underneath)
  const sortedZones = [...zones].sort((a, b) => {
    const aIdx = BANDS.findIndex(band => band.name === a.band.name);
    const bIdx = BANDS.findIndex(band => band.name === b.band.name);
    return aIdx - bIdx;
  });

  // Scale factor for zoom - shapes get smaller in viewBox coordinates as zoom increases
  const s = 1 / zoom;

  return (
    <g>
      {/* Define filters and patterns */}
      <defs>
        {/* Gaussian blur filter for soft edges */}
        <filter id="zone-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={8 * s} />
        </filter>
        {/* Hatch patterns for inbound zones */}
        {BANDS.map(band => (
          <pattern
            key={`hatch-${band.name}`}
            id={`hatch-${band.name}`}
            patternUnits="userSpaceOnUse"
            width={8 * s}
            height={8 * s}
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2={8 * s} stroke={band.color} strokeWidth={2 * s} strokeOpacity="0.3" />
          </pattern>
        ))}
      </defs>

      {sortedZones.map((zone, zoneIdx) => {
        // Filter by visible bands
        if (visibleBands && !visibleBands.some(b => b.name === zone.band.name)) return null;

        return zone.clusters.map((cluster, clusterIdx) => {
          if (cluster.hull.length < 3) {
            // Render as circle for small clusters
            const center = cluster.points[0];
            if (!center) return null;
            const { x, y } = latLonToXY(center.lat, center.lon);
            const zoneKey = `${zone.band.name}-${zone.direction}-${clusterIdx}`;
            const isHovered = hoveredZone === zoneKey;
            const isSelected = selectedZone === zoneKey;
            const isActive = isHovered || isSelected;
            // Scale radius by SNR for single spots (10-35px based on SNR -10 to 30+)
            const baseRadius = cluster.points.length === 1
              ? Math.max(10, Math.min(35, 15 + (cluster.bestSnr ?? 0) * 0.6))
              : 25;
            const radius = baseRadius * s;
            const isBidirectional = cluster.bidirectional;
            return (
              <g key={zoneKey}>
                {/* Blurred fill for soft edges */}
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={zone.band.color}
                  fillOpacity={isSelected ? 0.4 : 0.25}
                  stroke="none"
                  filter="url(#zone-blur)"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Outer glow stroke for bidirectional zones */}
                {isBidirectional && (
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill="none"
                    stroke={zone.band.color}
                    strokeOpacity={0.4}
                    strokeWidth={5 * s}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {/* Crisp stroke and hit area */}
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill="transparent"
                  stroke={zone.band.color}
                  strokeOpacity={isActive ? 0.9 : (isBidirectional ? 0.8 : 0.5)}
                  strokeWidth={(isActive ? 3 : (isBidirectional ? 2.5 : 2)) * s}
                  strokeDasharray={isBidirectional ? 'none' : (zone.direction === 'inbound' ? `${6*s},${4*s}` : 'none')}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredZone && setHoveredZone(zoneKey)}
                  onMouseLeave={() => setHoveredZone && setHoveredZone(null)}
                  onClick={() => setSelectedZone && setSelectedZone(isSelected ? null : zoneKey)}
                />
                {isActive && (
                  <text
                    x={x}
                    y={y - radius - 5 * s}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={11 * s}
                    fontFamily="monospace"
                    fontWeight="600"
                    style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                  >
                    {zone.band.name} {isBidirectional ? 'bidirectional' : zone.direction} - {cluster.spotCount} spots, {cluster.bestSnr}dB
                  </text>
                )}
              </g>
            );
          }

          // Convert hull points to SVG path, handling wrap-around
          const hullXY = cluster.hull.map(p => latLonToXY(p.lat, p.lon));

          // Check for wrap-around (large x jumps)
          let hasWrap = false;
          for (let i = 1; i < hullXY.length; i++) {
            if (Math.abs(hullXY[i].x - hullXY[i-1].x) > MAP_CONFIG.width * 0.5) {
              hasWrap = true;
              break;
            }
          }

          // If wrap-around detected, skip rendering this hull (edge case)
          if (hasWrap) return null;

          const pathD = `M ${hullXY.map(p => `${p.x},${p.y}`).join(' L ')} Z`;
          const zoneKey = `${zone.band.name}-${zone.direction}-${clusterIdx}`;
          const isHovered = hoveredZone === zoneKey;
          const isSelected = selectedZone === zoneKey;
          const isActive = isHovered || isSelected;
          const isBidirectional = cluster.bidirectional;

          return (
            <g key={zoneKey}>
              {/* Blurred fill for soft edges (outbound only, inbound uses hatch pattern) */}
              {zone.direction !== 'inbound' && (
                <path
                  d={pathD}
                  fill={zone.band.color}
                  fillOpacity={isSelected ? 0.4 : 0.25}
                  stroke="none"
                  filter="url(#zone-blur)"
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {/* Hatch pattern fill for inbound zones (no blur) */}
              {zone.direction === 'inbound' && (
                <path
                  d={pathD}
                  fill={`url(#hatch-${zone.band.name})`}
                  fillOpacity={1}
                  stroke="none"
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {/* Invisible hit area for interaction */}
              <path
                d={pathD}
                fill="transparent"
                stroke="none"
                style={{ pointerEvents: 'visibleFill', cursor: 'pointer' }}
                onMouseEnter={() => setHoveredZone && setHoveredZone(zoneKey)}
                onMouseLeave={() => setHoveredZone && setHoveredZone(null)}
                onClick={() => setSelectedZone && setSelectedZone(isSelected ? null : zoneKey)}
              />
              {/* Outer glow stroke for bidirectional zones */}
              {isBidirectional && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={zone.band.color}
                  strokeOpacity={0.4}
                  strokeWidth={5 * s}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {/* Crisp stroke */}
              <path
                d={pathD}
                fill="none"
                stroke={zone.band.color}
                strokeOpacity={isActive ? 0.9 : (isBidirectional ? 0.8 : 0.5)}
                strokeWidth={(isActive ? 3 : (isBidirectional ? 2.5 : 2)) * s}
                strokeDasharray={isBidirectional ? 'none' : (zone.direction === 'inbound' ? `${6*s},${4*s}` : 'none')}
                style={{ pointerEvents: 'none' }}
              />
              {/* Tooltip on hover or selected */}
              {isActive && (
                <text
                  x={hullXY.reduce((sum, p) => sum + p.x, 0) / hullXY.length}
                  y={hullXY.reduce((sum, p) => sum + p.y, 0) / hullXY.length}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize={11 * s}
                  fontFamily="monospace"
                  fontWeight="600"
                  style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                >
                  {zone.band.name} {isBidirectional ? 'bidirectional' : zone.direction} - {cluster.spotCount} spots, {cluster.bestSnr}dB
                </text>
              )}
            </g>
          );
        });
      })}
    </g>
  );
};
