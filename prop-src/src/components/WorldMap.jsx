import React, { useState, useEffect, useCallback, useRef } from 'react';
import worldSvg from '/world.svg?url';
import { MAP_CONFIG } from '../constants/map.js';
import { DayNightOverlay } from './DayNightOverlay.jsx';

export const WorldMap = ({ children, currentTime, showTerminator }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  // Use ref-based event listener for wheel to properly prevent default
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.max(1, Math.min(10, z * delta)));
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      const maxPanX = MAP_CONFIG.width * (zoom - 1) / 2;
      const maxPanY = MAP_CONFIG.height * (zoom - 1) / 2;
      const newX = Math.max(-maxPanX, Math.min(maxPanX, e.clientX - panStart.x));
      const newY = Math.max(-maxPanY, Math.min(maxPanY, e.clientY - panStart.y));
      setPan({ x: newX, y: newY });
    }
  }, [isPanning, panStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Clamp pan when zoom changes
  useEffect(() => {
    const maxPanX = MAP_CONFIG.width * (zoom - 1) / 2;
    const maxPanY = MAP_CONFIG.height * (zoom - 1) / 2;
    setPan(p => ({
      x: Math.max(-maxPanX, Math.min(maxPanX, p.x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, p.y))
    }));
  }, [zoom]);

  // Calculate viewBox based on zoom and pan
  const viewBoxWidth = MAP_CONFIG.width / zoom;
  const viewBoxHeight = MAP_CONFIG.height / zoom;
  const viewBoxX = (MAP_CONFIG.width - viewBoxWidth) / 2 - pan.x / zoom;
  const viewBoxY = (MAP_CONFIG.height - viewBoxHeight) / 2 - pan.y / zoom;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        ref={svgRef}
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        style={{
          width: '100%',
          height: '100%',
          background: '#0a1628',
          cursor: isPanning ? 'grabbing' : 'grab'
        }}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Ocean background */}
        <rect width={MAP_CONFIG.width} height={MAP_CONFIG.height} fill="#0d1f35" />

        {/* Load the world.svg as an image */}
        <image
          href={worldSvg}
          width={MAP_CONFIG.width}
          height={MAP_CONFIG.height}
          style={{ filter: 'saturate(0.6) brightness(0.8) hue-rotate(10deg)' }}
        />

        {/* Day/Night terminator */}
        {showTerminator && <DayNightOverlay currentTime={currentTime} />}

        {typeof children === 'function' ? children({ zoom }) : children}
      </svg>
      {zoom > 1 && (
        <button
          onClick={resetView}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(148,163,184,0.3)',
            borderRadius: '4px',
            padding: '4px 8px',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          Reset ({zoom.toFixed(1)}x)
        </button>
      )}
    </div>
  );
};
