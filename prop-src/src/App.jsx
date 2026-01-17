import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import worldSvg from '/world.svg?url';

// ============================================================================
// SVG MAP CONFIGURATION
// The world.svg uses Mercator projection with:
// - 360° longitude starting at -169.110266°
// - Latitude from 83.600842° to -58.508473°
// ============================================================================
const MAP_CONFIG = {
  width: 1009.6727,
  height: 665.96301,
  lonMin: -169.110266,
  latMax: 83.600842,
  latMin: -58.508473,
  lonRange: 360,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const gridToLatLon = (grid) => {
  if (!grid || grid.length < 4) return null;
  const g = grid.toUpperCase();
  const lon = (g.charCodeAt(0) - 65) * 20 - 180 + (parseInt(g[2]) * 2) + 1;
  const lat = (g.charCodeAt(1) - 65) * 10 - 90 + parseInt(g[3]) + 0.5;
  return { lat, lon };
};

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const getSunPosition = (date = new Date()) => {
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const declination = -23.45 * Math.cos((360/365) * (dayOfYear + 10) * Math.PI / 180);
  const hourUTC = date.getUTCHours() + date.getUTCMinutes() / 60;
  const longitude = (12 - hourUTC) * 15;
  return { lat: declination, lon: longitude };
};

const getTerminatorPath = (sunPos, numPoints = 100) => {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const lat = -90 + (180 * i / numPoints);
    const latRad = lat * Math.PI / 180;
    const decRad = sunPos.lat * Math.PI / 180;
    const cosHA = -Math.tan(latRad) * Math.tan(decRad);
    if (Math.abs(cosHA) <= 1) {
      const ha = Math.acos(cosHA) * 180 / Math.PI;
      points.push({ lat, lonDawn: ((sunPos.lon + ha + 540) % 360) - 180, lonDusk: ((sunPos.lon - ha + 540) % 360) - 180 });
    } else {
      points.push({ lat, lonDawn: null, lonDusk: null });
    }
  }
  return points;
};

const getGreatCirclePath = (lat1, lon1, lat2, lon2, numPoints = 50) => {
  const points = [];
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const λ1 = lon1 * Math.PI / 180, λ2 = lon2 * Math.PI / 180;
  const d = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin((φ2 - φ1) / 2), 2) + Math.cos(φ1) * Math.cos(φ2) * Math.pow(Math.sin((λ2 - λ1) / 2), 2)));
  if (d === 0) return [{ lat: lat1, lon: lon1 }];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    points.push({ lat: Math.atan2(z, Math.sqrt(x*x + y*y)) * 180 / Math.PI, lon: Math.atan2(y, x) * 180 / Math.PI });
  }
  return points;
};

const getBearing = (lat1, lon1, lat2, lon2) => {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
  return ((Math.atan2(Math.sin(Δλ) * Math.cos(φ2), Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)) * 180 / Math.PI) + 360) % 360;
};

// Convert lat/lon to SVG coordinates for world.svg (Mercator projection)
const mercatorY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
const MERCATOR_Y_MAX = mercatorY(MAP_CONFIG.latMax);
const MERCATOR_Y_MIN = mercatorY(MAP_CONFIG.latMin);
const MERCATOR_Y_RANGE = MERCATOR_Y_MAX - MERCATOR_Y_MIN;

const latLonToXY = (lat, lon) => {
  // Normalize longitude to the map's coordinate system (starts at -169°, wraps around)
  let adjustedLon = lon - MAP_CONFIG.lonMin;
  if (adjustedLon < 0) adjustedLon += 360;
  if (adjustedLon >= 360) adjustedLon -= 360;

  const x = (adjustedLon / MAP_CONFIG.lonRange) * MAP_CONFIG.width;

  // Use Mercator projection for latitude
  const yMercator = mercatorY(lat);
  const y = ((MERCATOR_Y_MAX - yMercator) / MERCATOR_Y_RANGE) * MAP_CONFIG.height;

  return { x: Math.max(0, Math.min(MAP_CONFIG.width, x)), y: Math.max(0, Math.min(MAP_CONFIG.height, y)) };
};

// ============================================================================
// PROPAGATION ZONE UTILITIES
// ============================================================================

// Cluster spots by geographic proximity using DBSCAN-style algorithm
const clusterSpots = (points, thresholdKm = 1500) => {
  if (!points.length) return [];
  const visited = new Set();
  const clusters = [];

  const getNeighbors = (point) => {
    return points.filter(p =>
      p !== point &&
      !visited.has(p) &&
      haversineDistance(point.lat, point.lon, p.lat, p.lon) <= thresholdKm
    );
  };

  const expandCluster = (point, cluster) => {
    cluster.push(point);
    visited.add(point);
    const neighbors = getNeighbors(point);
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        expandCluster(neighbor, cluster);
      }
    });
  };

  points.forEach(point => {
    if (!visited.has(point)) {
      const cluster = [];
      expandCluster(point, cluster);
      if (cluster.length > 0) {
        clusters.push(cluster);
      }
    }
  });

  return clusters;
};

// Gift-wrapping algorithm for convex hull
const computeConvexHull = (points) => {
  if (points.length < 3) return points;

  // Find leftmost point
  let start = points[0];
  points.forEach(p => {
    if (p.lon < start.lon || (p.lon === start.lon && p.lat < start.lat)) {
      start = p;
    }
  });

  const hull = [];
  let current = start;
  let iterations = 0;
  const maxIterations = points.length * 2;

  do {
    hull.push(current);
    let next = points[0];

    for (let i = 1; i < points.length; i++) {
      if (next === current) {
        next = points[i];
        continue;
      }
      // Cross product to determine turn direction
      const cross = (points[i].lon - current.lon) * (next.lat - current.lat) -
                    (points[i].lat - current.lat) * (next.lon - current.lon);
      if (cross > 0 || (cross === 0 &&
          haversineDistance(current.lat, current.lon, points[i].lat, points[i].lon) >
          haversineDistance(current.lat, current.lon, next.lat, next.lon))) {
        next = points[i];
      }
    }
    current = next;
    iterations++;
  } while (current !== start && iterations < maxIterations);

  return hull;
};

// Filter spots by proximity to a reference grid
const filterByProximity = (spots, refCoords, radiusKm) => {
  return spots.filter(spot => {
    const spotCoords = spot.grid ? gridToLatLon(spot.grid) :
                       (spot.spotter_grid ? gridToLatLon(spot.spotter_grid) : null);
    if (!spotCoords) return false;
    return haversineDistance(refCoords.lat, refCoords.lon, spotCoords.lat, spotCoords.lon) <= radiusKm;
  });
};

// Build propagation zones from spots
const buildPropagationZones = (spots, userCall, userCoords, proximityKm) => {
  const zones = [];
  const userCallUpper = userCall.toUpperCase();

  // Group spots by band and direction
  const bandGroups = {};

  spots.forEach(spot => {
    const band = getBandFromFreq(spot.frequency);
    if (!band) return;

    // Get grid from spot data, or derive from callsign prefix
    const spotterCall = spot.spotter || spot.de_call || '';
    const spotterGrid = spot.spotter_grid || spot.de_grid || getGridFromCall(spotterCall);
    const txCall = (spot.callsign || spot.dx_call || '').toUpperCase();
    const txGrid = spot.grid || spot.dx_grid || getGridFromCall(txCall);
    const spotterCoords = spotterGrid ? gridToLatLon(spotterGrid) : null;
    const txCoords = txGrid ? gridToLatLon(txGrid) : null;

    // Determine if this is outbound (user/nearby TX heard elsewhere) or inbound (elsewhere heard by nearby RX)
    let direction = null;
    let targetCoords = null;

    // Outbound: user or nearby station was transmitting, spotted by distant skimmer
    if (txCoords) {
      const txDist = haversineDistance(userCoords.lat, userCoords.lon, txCoords.lat, txCoords.lon);
      if (txCall === userCallUpper || txDist <= proximityKm) {
        direction = 'outbound';
        targetCoords = spotterCoords; // Where the signal was received
      }
    }

    // Inbound: distant station heard by skimmer near user
    if (!direction && spotterCoords) {
      const rxDist = haversineDistance(userCoords.lat, userCoords.lon, spotterCoords.lat, spotterCoords.lon);
      if (rxDist <= proximityKm) {
        direction = 'inbound';
        targetCoords = txCoords; // Where the signal came from
      }
    }

    if (direction && targetCoords) {
      const key = `${band.name}-${direction}`;
      if (!bandGroups[key]) {
        bandGroups[key] = { band, direction, points: [], spots: [] };
      }
      // Store SNR with the point so we don't need to look it up later
      bandGroups[key].points.push({ ...targetCoords, snr: spot.snr || 0 });
      bandGroups[key].spots.push(spot);
    }
  });

  // Cluster and compute hulls for each group
  Object.values(bandGroups).forEach(group => {
    const clusters = clusterSpots(group.points, 1500);
    const clustersWithHulls = clusters.map(clusterPoints => {
      // Compute centroid as average of all points
      const centroid = {
        lat: clusterPoints.reduce((sum, p) => sum + p.lat, 0) / clusterPoints.length,
        lon: clusterPoints.reduce((sum, p) => sum + p.lon, 0) / clusterPoints.length
      };
      return {
        points: clusterPoints,
        hull: computeConvexHull(clusterPoints),
        spotCount: clusterPoints.length,
        bestSnr: Math.max(...clusterPoints.map(p => p.snr ?? 0)),
        centroid,
        bidirectional: false // Will be set in post-processing
      };
    });

    zones.push({
      band: group.band,
      direction: group.direction,
      clusters: clustersWithHulls,
      totalSpots: group.spots.length
    });
  });

  // Post-process: detect bidirectional zones by comparing inbound/outbound centroids
  const bidirectionalThreshold = 1500; // km, matches clustering threshold
  BANDS.forEach(band => {
    const inboundZone = zones.find(z => z.band.name === band.name && z.direction === 'inbound');
    const outboundZone = zones.find(z => z.band.name === band.name && z.direction === 'outbound');
    if (!inboundZone || !outboundZone) return;

    inboundZone.clusters.forEach(inCluster => {
      outboundZone.clusters.forEach(outCluster => {
        const dist = haversineDistance(
          inCluster.centroid.lat, inCluster.centroid.lon,
          outCluster.centroid.lat, outCluster.centroid.lon
        );
        if (dist <= bidirectionalThreshold) {
          inCluster.bidirectional = true;
          outCluster.bidirectional = true;
        }
      });
    });
  });

  return zones;
};

// ============================================================================
// BAND CONFIGURATION
// ============================================================================

const BANDS = [
  { name: '160m', min: 1800, max: 2000, color: '#ef4444' },
  { name: '80m', min: 3500, max: 4000, color: '#f97316' },
  { name: '40m', min: 7000, max: 7300, color: '#eab308' },
  { name: '30m', min: 10100, max: 10150, color: '#84cc16' },
  { name: '20m', min: 14000, max: 14350, color: '#22c55e' },
  { name: '17m', min: 18068, max: 18168, color: '#14b8a6' },
  { name: '15m', min: 21000, max: 21450, color: '#06b6d4' },
  { name: '12m', min: 24890, max: 24990, color: '#3b82f6' },
  { name: '10m', min: 28000, max: 29700, color: '#8b5cf6' },
];

const getBandFromFreq = (freq) => BANDS.find(b => freq >= b.min && freq <= b.max) || null;

// ============================================================================
// CALLSIGN DATA
// ============================================================================

const prefixToGrid = {
  'W1': 'FN31', 'K1': 'FN31', 'N1': 'FN31', 'AA1': 'FN31', 'AB1': 'FN31', 'KC1': 'FN31',
  'W2': 'FN20', 'K2': 'FN20', 'N2': 'FN20', 'AA2': 'FN20', 'AB2': 'FN20',
  'W3': 'FM19', 'K3': 'FM19', 'N3': 'FM19', 'AA3': 'FM19',
  'W4': 'EM73', 'K4': 'EM73', 'N4': 'EM73', 'AA4': 'EM73', 'KN4': 'EM73', 'KO4': 'EM73',
  'W5': 'EM12', 'K5': 'EM12', 'N5': 'EM12', 'AA5': 'EM12', 'AG5': 'EM12', 'KI5': 'EM12',
  'W6': 'CM87', 'K6': 'CM87', 'N6': 'CM87', 'AA6': 'CM87', 'AC6': 'CM87', 'KE6': 'CM87', 'KN6': 'CM87',
  'W7': 'DN31', 'K7': 'DN31', 'N7': 'DN31', 'AA7': 'DN31', 'KG7': 'DN31', 'KJ7': 'DN31',
  'W8': 'EN81', 'K8': 'EN81', 'N8': 'EN81', 'AA8': 'EN81', 'AC8': 'EN81', 'KE8': 'EN81',
  'W9': 'EN52', 'K9': 'EN52', 'N9': 'EN52', 'AA9': 'EN52', 'KD9': 'EN52',
  'W0': 'DN70', 'K0': 'DN70', 'N0': 'DN70', 'AA0': 'DN70', 'KC0': 'DN70', 'KE0': 'DN70', 'AE0': 'DN70',
  'VE1': 'FN74', 'VE2': 'FN35', 'VE3': 'FN03', 'VE4': 'EN19', 'VE5': 'DO51', 'VE6': 'DO33', 'VE7': 'CN89', 'VA': 'FN03',
  'G': 'IO91', 'M': 'IO91', '2E': 'IO91',
  'DL': 'JO51', 'DJ': 'JO51', 'DK': 'JO51', 'DF': 'JO51', 'DG': 'JO51', 'DO': 'JO51',
  'F': 'JN18', 'ON': 'JO20', 'PA': 'JO22', 'PD': 'JO22',
  'EA': 'IN80', 'I': 'JN62', 'IK': 'JN62', 'IZ': 'JN62',
  'JA': 'PM95', 'JH': 'PM95', 'JR': 'PM95', 'JE': 'PM95', 'JG': 'PM95', 'JI': 'PM95',
  'VK': 'QF22', 'VK2': 'QF56', 'VK3': 'QF22', 'VK4': 'QG62',
  'ZL': 'RF72', 'ZL1': 'RF72', 'ZL2': 'RE78',
  'LU': 'GF05', 'PY': 'GG87', 'CE': 'FF46',
  'SP': 'KO02', 'OK': 'JO70', 'OM': 'JN88', 'HA': 'JN97', 'YO': 'KN34',
  'SM': 'JO89', 'LA': 'JO59', 'OH': 'KP20', 'OZ': 'JO55',
  'KH6': 'BL10', 'KH': 'BL10', 'KP4': 'FK68', 'UA': 'KO85', 'RU': 'KO85', 'R': 'KO85',
  'BY': 'OM89', 'BV': 'PL05', 'HL': 'PM37', 'DS': 'PM37', 'YB': 'OI33', 'ZS': 'KG33',
};

const getGridFromCall = (call) => {
  if (!call) return null;
  const c = call.toUpperCase().replace(/[\/\-].*/g, '');
  for (let len = 3; len >= 1; len--) if (prefixToGrid[c.substring(0, len)]) return prefixToGrid[c.substring(0, len)];
  return prefixToGrid[c[0]] || null;
};

const getRegionFromCall = (call) => {
  if (!call) return 'Unknown';
  const c = call.toUpperCase();
  const regions = { 'W': 'USA', 'K': 'USA', 'N': 'USA', 'AA': 'USA', 'VE': 'Canada', 'VA': 'Canada', 'G': 'UK', 'M': 'UK', 'DL': 'Germany', 'DJ': 'Germany', 'DK': 'Germany', 'F': 'France', 'EA': 'Spain', 'I': 'Italy', 'JA': 'Japan', 'JH': 'Japan', 'VK': 'Australia', 'ZL': 'NZ', 'SP': 'Poland', 'SM': 'Sweden', 'LA': 'Norway', 'OH': 'Finland' };
  for (let len = 3; len >= 1; len--) if (regions[c.substring(0, len)]) return regions[c.substring(0, len)];
  return c.substring(0, 2);
};

// Parse PSKReporter XML response into spot format
const parsePskReporterXml = (xmlText) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const reports = doc.querySelectorAll('receptionReport');
  return Array.from(reports).map(r => ({
    callsign: r.getAttribute('senderCallsign'),
    grid: r.getAttribute('senderLocator')?.substring(0, 4),
    spotter: r.getAttribute('receiverCallsign'),
    spotter_grid: r.getAttribute('receiverLocator')?.substring(0, 4),
    frequency: parseInt(r.getAttribute('frequency')) / 1000,
    snr: parseInt(r.getAttribute('sNR')) || 0,
    mode: r.getAttribute('mode'),
    source: 'pskreporter'
  }));
};

// ============================================================================
// MAP COMPONENTS
// ============================================================================

const DayNightOverlay = ({ currentTime }) => {
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

const GreatCirclePath = ({ fromLat, fromLon, toLat, toLon, color, isSelected, zoom = 1 }) => {
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

const WorldMap = ({ children, currentTime, showTerminator }) => {
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

const StationMarker = ({ lat, lon, call, bandData, isUser, onClick, isSelected, zoom = 1 }) => {
  const { x, y } = latLonToXY(lat, lon);
  const s = 1 / zoom;

  if (isUser) {
    return (
      <g>
        <circle cx={x} cy={y} r={18 * s} fill="#06b6d4" opacity="0.25" />
        <circle cx={x} cy={y} r={12 * s} fill="#06b6d4" opacity="0.5" />
        <circle cx={x} cy={y} r={8 * s} fill="#06b6d4" />
        <text x={x} y={y + 28 * s} textAnchor="middle" fill="#06b6d4" fontSize={14 * s} fontFamily="monospace" fontWeight="bold">{call}</text>
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

const PropagationZones = ({ zones, visibleBands, hoveredZone, setHoveredZone, selectedZone, setSelectedZone, zoom = 1 }) => {
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
      {/* Define hatch patterns for inbound zones */}
      <defs>
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
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={zone.band.color}
                  fillOpacity={isSelected ? 0.3 : 0.15}
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
              {/* Fill */}
              <path
                d={pathD}
                fill={zone.direction === 'inbound' ? `url(#hatch-${zone.band.name})` : zone.band.color}
                fillOpacity={zone.direction === 'inbound' ? 1 : (isSelected ? 0.3 : 0.15)}
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
              {/* Stroke */}
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

// ============================================================================
// IONOSONDE MUF LAYER
// ============================================================================

// Get color for MUF value based on which band it supports
const getMufColor = (mufd) => {
  if (mufd >= 28) return '#8b5cf6';  // 10m - purple
  if (mufd >= 24.89) return '#3b82f6'; // 12m - blue
  if (mufd >= 21) return '#06b6d4';   // 15m - cyan
  if (mufd >= 18.068) return '#14b8a6'; // 17m - teal
  if (mufd >= 14) return '#22c55e';   // 20m - green
  if (mufd >= 10.1) return '#84cc16'; // 30m - lime
  if (mufd >= 7) return '#eab308';    // 40m - yellow
  if (mufd >= 3.5) return '#f97316';  // 80m - orange
  return '#ef4444';                    // 160m - red
};

const getMufBand = (mufd) => {
  if (mufd >= 28) return '10m+';
  if (mufd >= 24.89) return '12m';
  if (mufd >= 21) return '15m';
  if (mufd >= 18.068) return '17m';
  if (mufd >= 14) return '20m';
  if (mufd >= 10.1) return '30m';
  if (mufd >= 7) return '40m';
  if (mufd >= 3.5) return '80m';
  return '160m';
};

const IonosondeMarkers = ({ stations, hoveredIonosonde, setHoveredIonosonde, selectedIonosonde, setSelectedIonosonde, zoom = 1 }) => {
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

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const [userCall, setUserCall] = useState('W6JSV');
  const [userGrid, setUserGrid] = useState('CM87');
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTerminator, setShowTerminator] = useState(true);
  const [showAllPaths, setShowAllPaths] = useState(false);
  const [showSpots, setShowSpots] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [error, setError] = useState(null);
  const [filterBand, setFilterBand] = useState(null);
  const [showPropagationZones, setShowPropagationZones] = useState(true);
  const [proximityRadius, setProximityRadius] = useState(160); // km (~100 miles)
  const [hoveredZone, setHoveredZone] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [showMufLayer, setShowMufLayer] = useState(true);
  const [ionosondeStations, setIonosondeStations] = useState([]);
  const [hoveredIonosonde, setHoveredIonosonde] = useState(null);
  const [selectedIonosonde, setSelectedIonosonde] = useState(null);
  const [spotterFilter, setSpotterFilter] = useState([]);
  const [spotterFilterInput, setSpotterFilterInput] = useState('');
  const [showSpotterPicker, setShowSpotterPicker] = useState(false);

  useEffect(() => { const i = setInterval(() => setCurrentTime(new Date()), 60000); return () => clearInterval(i); }, []);

  // Fetch ionosonde MUF data
  const fetchIonosondeData = useCallback(async () => {
    try {
      const response = await fetch(`https://corsproxy.io/?${encodeURIComponent('https://prop.kc2g.com/api/stations.json')}`);
      if (response.ok) {
        const data = await response.json();
        // Filter to stations with valid MUF data from last 2 hours
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const validStations = data.filter(s =>
          s.mufd && s.mufd > 0 &&
          s.station?.latitude && s.station?.longitude &&
          new Date(s.time) > twoHoursAgo
        ).map(s => ({
          id: s.station.id,
          name: s.station.name,
          code: s.station.code,
          lat: parseFloat(s.station.latitude),
          lon: parseFloat(s.station.longitude) > 180 ? parseFloat(s.station.longitude) - 360 : parseFloat(s.station.longitude),
          mufd: s.mufd,
          fof2: s.fof2,
          confidence: s.cs,
          time: s.time
        }));
        setIonosondeStations(validStations);
      }
    } catch (e) {
      console.error('Failed to fetch ionosonde data:', e);
    }
  }, []);

  useEffect(() => {
    if (showMufLayer) {
      fetchIonosondeData();
      const i = setInterval(fetchIonosondeData, 15 * 60 * 1000); // Refresh every 15 min
      return () => clearInterval(i);
    }
  }, [showMufLayer, fetchIonosondeData]);

  const fetchSpots = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Fetch from both VailReRBN and PSKReporter in parallel
      const [rbnResponse, pskResponse] = await Promise.allSettled([
        fetch('https://vailrerbn.com/api/v1/spots?mode=CW&since=30m&limit=1000'),
        fetch(`https://corsproxy.io/?${encodeURIComponent(`https://retrieve.pskreporter.info/query?senderCallsign=${userGrid}&modify=grid&flowStartSeconds=-1800&rronly=1&appcontact=licw-sked-page`)}`)
      ]);

      let allSpots = [];

      // Process RBN data
      if (rbnResponse.status === 'fulfilled' && rbnResponse.value.ok) {
        const rbnData = await rbnResponse.value.json();
        const rbnSpots = (rbnData.spots || []).map(s => ({ ...s, source: 'rbn' }));
        allSpots = [...allSpots, ...rbnSpots];
      }

      // Process PSKReporter data
      if (pskResponse.status === 'fulfilled' && pskResponse.value.ok) {
        const pskText = await pskResponse.value.text();
        const pskSpots = parsePskReporterXml(pskText);
        allSpots = [...allSpots, ...pskSpots];
      }

      if (allSpots.length === 0) throw new Error('No data from any source');

      // Deduplicate: prefer spots with grid data
      const spotMap = new Map();
      allSpots.forEach(spot => {
        const key = `${spot.callsign?.toUpperCase()}-${Math.round(spot.frequency / 10) * 10}`;
        const existing = spotMap.get(key);
        if (!existing || (spot.grid && !existing.grid)) {
          spotMap.set(key, spot);
        }
      });

      setSpots(Array.from(spotMap.values()));
      setLastUpdate(new Date());
    } catch (e) {
      setError(e.message);
      setSpots([
        { callsign: 'K1USN', frequency: 14025, snr: 25, wpm: 22, source: 'demo' },
        { callsign: 'VE3WH', frequency: 14032, snr: 18, wpm: 20, source: 'demo' },
        { callsign: 'K6GTE', frequency: 14040, snr: 12, wpm: 18, source: 'demo' },
        { callsign: 'G4ABC', frequency: 14028, snr: 8, wpm: 16, source: 'demo' },
      ]);
    }
    setLoading(false);
  }, [userGrid]);

  useEffect(() => { fetchSpots(); const i = setInterval(fetchSpots, 60000); return () => clearInterval(i); }, [fetchSpots]);

  const stationData = useMemo(() => {
    const userCoords = gridToLatLon(userGrid); if (!userCoords) return [];
    // Filter spots by spotter callsigns if filter is active
    const filteredSpots = spotterFilter.length > 0
      ? spots.filter(s => {
          const spotter = (s.spotter || s.de_call || '').toUpperCase();
          return spotterFilter.includes(spotter);
        })
      : spots;
    // Group all spots by callsign
    const spotsByCall = {}; filteredSpots.forEach(s => { const c = s.callsign?.toUpperCase(); if (c) { if (!spotsByCall[c]) spotsByCall[c] = []; spotsByCall[c].push(s); }});
    // Build stations from all unique callsigns in spots (no member list filtering)
    return Object.entries(spotsByCall).map(([call, callSpots]) => {
      // Use grid from spot data if available, otherwise derive from callsign prefix
      const spotGrid = callSpots[0]?.grid || callSpots[0]?.dx_grid;
      const grid = spotGrid || getGridFromCall(call);
      const coords = gridToLatLon(grid); if (!coords) return null;
      const region = getRegionFromCall(call);
      const distance = haversineDistance(userCoords.lat, userCoords.lon, coords.lat, coords.lon);
      const bandAnalysis = {}; let bestBand = null, bestSnr = -999;
      callSpots.forEach(spot => {
        const band = getBandFromFreq(spot.frequency); if (!band) return;
        if (!bandAnalysis[band.name]) bandAnalysis[band.name] = { band, spots: [], bestSnr: -999 };
        bandAnalysis[band.name].spots.push(spot);
        if (spot.snr > bandAnalysis[band.name].bestSnr) bandAnalysis[band.name].bestSnr = spot.snr;
      });
      Object.values(bandAnalysis).forEach(ba => {
        ba.wpm = ba.spots[0]?.wpm || 18;
        ba.status = ba.bestSnr > 15 && distance < 15000 ? 'should' : ba.bestSnr > 5 ? 'might' : 'unlikely';
        if (ba.bestSnr > bestSnr) { bestSnr = ba.bestSnr; bestBand = ba.band; }
      });
      const status = bestSnr > 15 && distance < 15000 ? 'should' : bestSnr > 5 ? 'might' : 'unlikely';
      return { call, grid, lat: coords.lat, lon: coords.lon, region, distance: Math.round(distance), status, bandAnalysis, bestBand, bestSnr: bestSnr > -999 ? bestSnr : 0, spotCount: callSpots.length, wpm: callSpots[0]?.wpm || 18 };
    }).filter(Boolean);
  }, [spots, userGrid, spotterFilter]);

  const filteredStations = useMemo(() => {
    let f = stationData.filter(s => s.call.toUpperCase() !== userCall.toUpperCase() && s.spotCount > 0);
    if (filterBand) f = f.filter(s => s.bandAnalysis[filterBand]);
    return f;
  }, [stationData, userCall, filterBand]);

  const groupedStations = useMemo(() => {
    const g = { should: [], might: [], unlikely: [] };
    filteredStations.forEach(s => g[filterBand && s.bandAnalysis[filterBand] ? s.bandAnalysis[filterBand].status : s.status].push(s));
    Object.keys(g).forEach(k => g[k].sort((a, b) => b.bestSnr - a.bestSnr));
    return g;
  }, [filteredStations, filterBand]);

  const userCoords = gridToLatLon(userGrid) || { lat: 37.5, lon: -122 };
  const activeBands = useMemo(() => { const b = new Set(); filteredStations.forEach(s => Object.keys(s.bandAnalysis).forEach(k => b.add(k))); return BANDS.filter(x => b.has(x.name)); }, [filteredStations]);

  // Extract unique spotters from raw spots with counts
  const activeSpotters = useMemo(() => {
    const counts = {};
    spots.forEach(s => {
      const spotter = (s.spotter || s.de_call || '').toUpperCase();
      if (spotter) counts[spotter] = (counts[spotter] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([call, count]) => ({ call, count }))
      .sort((a, b) => b.count - a.count);
  }, [spots]);

  // Compute propagation zones
  const propagationZones = useMemo(() => {
    if (!showPropagationZones || !spots.length) return [];
    return buildPropagationZones(spots, userCall, userCoords, proximityRadius);
  }, [showPropagationZones, spots, userCall, userCoords, proximityRadius]);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', fontFamily: "system-ui, sans-serif", color: '#e2e8f0', padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, background: 'linear-gradient(90deg, #f8fafc, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Propagation Estimator</h1>
          <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'rgba(100,116,139,0.3)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '6px', padding: '5px 10px', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}>⚙️ Settings</button>
          <button onClick={fetchSpots} disabled={loading} style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', padding: '5px 10px', color: '#22c55e', cursor: 'pointer', fontSize: '11px', opacity: loading ? 0.5 : 1 }}>{loading ? '⏳' : '🔄'} Refresh</button>
          {lastUpdate && <span style={{ fontSize: '11px', color: '#64748b' }}>Updated: {lastUpdate.toLocaleTimeString()}</span>}
          {error && <span style={{ fontSize: '11px', color: '#f87171' }}>⚠️ Demo data</span>}
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <div style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Your Callsign</label><input type="text" value={userCall} onChange={e => setUserCall(e.target.value.toUpperCase())} style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '6px', padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', width: '100px' }} /></div>
            <div><label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Your Grid</label><input type="text" value={userGrid} onChange={e => setUserGrid(e.target.value.toUpperCase())} style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '6px', padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', width: '80px' }} /></div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={showTerminator} onChange={e => setShowTerminator(e.target.checked)} style={{ accentColor: '#22c55e' }} />Day/Night</label>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={showSpots} onChange={e => setShowSpots(e.target.checked)} style={{ accentColor: '#22c55e' }} />Spots</label>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={showAllPaths} onChange={e => setShowAllPaths(e.target.checked)} style={{ accentColor: '#22c55e' }} />All Paths</label>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={showPropagationZones} onChange={e => setShowPropagationZones(e.target.checked)} style={{ accentColor: '#22c55e' }} />Prop Zones</label>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={showMufLayer} onChange={e => setShowMufLayer(e.target.checked)} style={{ accentColor: '#22c55e' }} />MUF Data</label>
            </div>
            {showPropagationZones && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(148,163,184,0.2)' }}>
                <label style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>Proximity:</label>
                <input
                  type="range"
                  min="80"
                  max="500"
                  value={proximityRadius}
                  onChange={e => setProximityRadius(Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#22c55e' }}
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', minWidth: '70px' }}>{Math.round(proximityRadius * 0.621)}mi / {proximityRadius}km</span>
                <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#94a3b8' }}>
                    <div style={{ width: '12px', height: '12px', background: 'rgba(34,197,94,0.3)', border: '2px solid rgba(34,197,94,0.6)' }} />
                    Outbound
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#94a3b8' }}>
                    <div style={{ width: '12px', height: '12px', background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(34,197,94,0.3) 2px, rgba(34,197,94,0.3) 4px)', border: '2px dashed rgba(34,197,94,0.6)' }} />
                    Inbound
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#22c55e', fontWeight: '600' }}>
                    <div style={{ width: '12px', height: '12px', background: 'rgba(34,197,94,0.3)', border: '2px solid rgba(34,197,94,0.8)', boxShadow: '0 0 0 2px rgba(34,197,94,0.4)' }} />
                    2-way
                  </div>
                </div>
              </div>
            )}
            {/* Spotter Filter */}
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(148,163,184,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>Filter Spotters:</label>
                <input
                  type="text"
                  value={spotterFilterInput}
                  onChange={e => {
                    const val = e.target.value.toUpperCase();
                    setSpotterFilterInput(val);
                    const calls = val.split(',').map(s => s.trim()).filter(Boolean);
                    setSpotterFilter(calls);
                  }}
                  placeholder="W3LPL, K1TTT, VE7CC"
                  style={{ flex: 1, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '6px', padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '11px' }}
                />
                {spotterFilter.length > 0 && (
                  <button
                    onClick={() => { setSpotterFilter([]); setSpotterFilterInput(''); }}
                    style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '11px' }}
                  >Clear</button>
                )}
                <button
                  onClick={() => setShowSpotterPicker(!showSpotterPicker)}
                  style={{ background: 'rgba(100,116,139,0.2)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '4px', padding: '4px 8px', color: '#94a3b8', cursor: 'pointer', fontSize: '10px' }}
                >{showSpotterPicker ? 'Hide' : 'Show'} active</button>
              </div>
              {spotterFilter.length > 0 && (
                <div style={{ fontSize: '10px', color: '#22c55e', marginBottom: '8px' }}>Filtering: {spotterFilter.length} spotter{spotterFilter.length !== 1 ? 's' : ''}</div>
              )}
              {showSpotterPicker && (
                <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: '6px', padding: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {activeSpotters.slice(0, 50).map(({ call, count }) => {
                      const isSelected = spotterFilter.includes(call);
                      return (
                        <label
                          key={call}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10px',
                            color: isSelected ? '#22c55e' : '#94a3b8',
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.1)',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            border: isSelected ? '1px solid rgba(34,197,94,0.4)' : '1px solid transparent'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              let newFilter;
                              if (isSelected) {
                                newFilter = spotterFilter.filter(c => c !== call);
                              } else {
                                newFilter = [...spotterFilter, call];
                              }
                              setSpotterFilter(newFilter);
                              setSpotterFilterInput(newFilter.join(', '));
                            }}
                            style={{ accentColor: '#22c55e', width: '12px', height: '12px' }}
                          />
                          {call} <span style={{ color: '#64748b' }}>({count})</span>
                        </label>
                      );
                    })}
                  </div>
                  {activeSpotters.length > 50 && (
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>Showing top 50 of {activeSpotters.length} spotters</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
        {/* Map */}
        <div style={{ background: 'rgba(15,23,42,0.6)', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.15)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(148,163,184,0.1)', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '10px', color: '#fbbf24' }}>☀ {currentTime.toUTCString().slice(17, 22)} UTC</span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>Active: {filteredStations.length}</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button onClick={() => setFilterBand(null)} style={{ background: !filterBand ? 'linear-gradient(135deg, #64748b, #475569)' : 'rgba(100,116,139,0.2)', border: 'none', borderRadius: '4px', padding: '4px 8px', color: !filterBand ? '#fff' : '#94a3b8', cursor: 'pointer', fontSize: '10px', fontWeight: '600' }}>ALL</button>
              {activeBands.map(band => <button key={band.name} onClick={() => setFilterBand(band.name)} style={{ background: filterBand === band.name ? `linear-gradient(135deg, ${band.color}, ${band.color}dd)` : 'rgba(100,116,139,0.2)', border: 'none', borderRadius: '4px', padding: '4px 8px', color: filterBand === band.name ? '#fff' : band.color, cursor: 'pointer', fontSize: '10px', fontWeight: '600' }}>{band.name}</button>)}
            </div>
          </div>
          <div style={{ padding: '16px', position: 'relative' }}>
            {loading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(15,23,42,0.9)', padding: '12px 20px', borderRadius: '8px', zIndex: 10 }}>Loading...</div>}
            <WorldMap currentTime={currentTime} showTerminator={showTerminator}>
              {({ zoom }) => (
                <>
                  {/* Propagation zones (rendered first, underneath everything) */}
                  {showPropagationZones && (
                    <PropagationZones
                      zones={propagationZones}
                      visibleBands={filterBand ? BANDS.filter(b => b.name === filterBand) : null}
                      hoveredZone={hoveredZone}
                      setHoveredZone={setHoveredZone}
                      selectedZone={selectedZone}
                      setSelectedZone={setSelectedZone}
                      zoom={zoom}
                    />
                  )}
                  {showMufLayer && ionosondeStations.length > 0 && (
                    <IonosondeMarkers
                      stations={ionosondeStations}
                      hoveredIonosonde={hoveredIonosonde}
                      setHoveredIonosonde={setHoveredIonosonde}
                      selectedIonosonde={selectedIonosonde}
                      setSelectedIonosonde={setSelectedIonosonde}
                      zoom={zoom}
                    />
                  )}
                  {showAllPaths && filteredStations.map(s => <GreatCirclePath key={`p-${s.call}`} fromLat={userCoords.lat} fromLon={userCoords.lon} toLat={s.lat} toLon={s.lon} color={s.bestBand?.color || '#64748b'} isSelected={false} zoom={zoom} />)}
                  {selectedStation && <GreatCirclePath fromLat={userCoords.lat} fromLon={userCoords.lon} toLat={selectedStation.lat} toLon={selectedStation.lon} color={selectedStation.bestBand?.color || '#22c55e'} isSelected={true} zoom={zoom} />}
                  <StationMarker lat={userCoords.lat} lon={userCoords.lon} call={userCall} isUser={true} zoom={zoom} />
                  {showSpots && filteredStations.map(s => <StationMarker key={s.call} lat={s.lat} lon={s.lon} call={s.call} bandData={s} isSelected={selectedStation?.call === s.call} onClick={() => setSelectedStation(selectedStation?.call === s.call ? null : s)} zoom={zoom} />)}
                </>
              )}
            </WorldMap>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px', fontSize: '9px', color: '#94a3b8', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#06b6d4' }} />You</div>
              {BANDS.slice(1, 8).map(b => <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: b.color }} />{b.name}</div>)}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {selectedStation && (
            <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(30,41,59,0.8))', borderRadius: '10px', border: '1px solid rgba(6,182,212,0.3)', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div><div style={{ fontSize: '18px', fontFamily: 'monospace', fontWeight: '700', color: '#06b6d4' }}>{selectedStation.call}</div><div style={{ fontSize: '11px', color: '#94a3b8' }}>{selectedStation.region} • {selectedStation.grid}</div></div>
                <button onClick={() => setSelectedStation(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', marginBottom: '12px' }}>
                <div><span style={{ color: '#64748b' }}>Distance:</span> <span style={{ color: '#e2e8f0' }}>{selectedStation.distance.toLocaleString()} km</span></div>
                <div><span style={{ color: '#64748b' }}>Bearing:</span> <span style={{ color: '#e2e8f0' }}>{Math.round(getBearing(userCoords.lat, userCoords.lon, selectedStation.lat, selectedStation.lon))}°</span></div>
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px', fontWeight: '600' }}>SPOTTED ON:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {Object.entries(selectedStation.bandAnalysis).sort((a, b) => b[1].bestSnr - a[1].bestSnr).map(([name, data]) => (
                  <div key={name} style={{ background: `${data.band.color}22`, border: `1px solid ${data.band.color}66`, borderRadius: '6px', padding: '6px 10px', minWidth: '70px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: data.band.color }}>{name}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{data.bestSnr}dB • {data.wpm}wpm</div>
                    <div style={{ fontSize: '9px', color: data.status === 'should' ? '#22c55e' : data.status === 'might' ? '#eab308' : '#ef4444' }}>● {data.status === 'should' ? 'Should work' : data.status === 'might' ? 'Might work' : 'Unlikely'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: 'rgba(30,41,59,0.6)', borderRadius: '10px', border: '1px solid rgba(148,163,184,0.15)', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(148,163,184,0.1)', flexShrink: 0 }}><h2 style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>QSO OPPORTUNITIES {filterBand && <span style={{ color: '#64748b', fontWeight: '400' }}>({filterBand})</span>}</h2></div>
            <div style={{ padding: '10px 14px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {['should', 'might', 'unlikely'].map(status => (
                <div key={status} style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '600', color: status === 'should' ? '#22c55e' : status === 'might' ? '#eab308' : '#ef4444', marginBottom: '6px', letterSpacing: '1px' }}>{status === 'should' ? 'SHOULD WORK' : status === 'might' ? 'MIGHT WORK' : 'WEAK SIGNALS'} ({groupedStations[status].length})</div>
                  {groupedStations[status].slice(0, status === 'unlikely' ? 3 : 5).map(s => (
                    <div key={s.call} onClick={() => setSelectedStation(s)} style={{ background: selectedStation?.call === s.call ? `rgba(${status === 'should' ? '34,197,94' : status === 'might' ? '234,179,8' : '239,68,68'},0.2)` : `rgba(${status === 'should' ? '34,197,94' : status === 'might' ? '234,179,8' : '239,68,68'},0.05)`, borderRadius: '6px', padding: '8px 10px', marginBottom: '5px', cursor: 'pointer', borderLeft: selectedStation?.call === s.call ? `3px solid ${status === 'should' ? '#22c55e' : status === 'might' ? '#eab308' : '#ef4444'}` : '3px solid transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: '600', fontSize: '13px' }}>{s.call}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>{Object.keys(s.bandAnalysis).slice(0, 3).map(b => <span key={b} style={{ fontSize: '8px', background: `${s.bandAnalysis[b].band.color}44`, color: s.bandAnalysis[b].band.color, padding: '2px 4px', borderRadius: '3px', fontWeight: '600' }}>{b}</span>)}</div>
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{s.region} • {s.distance.toLocaleString()}km • {s.bestSnr}dB</div>
                    </div>
                  ))}
                  {status === 'should' && groupedStations.should.length === 0 && <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>No strong signals</div>}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '10px', padding: '12px 16px', fontSize: '10px', color: '#64748b' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>Total Spots: <span style={{ color: '#94a3b8' }}>{spots.length}</span></div>
              <div>Unique Stations: <span style={{ color: '#94a3b8' }}>{stationData.length}</span></div>
              <div>RBN: <span style={{ color: '#94a3b8' }}>{spots.filter(s => s.source === 'rbn').length}</span></div>
              <div>PSKReporter: <span style={{ color: '#94a3b8' }}>{spots.filter(s => s.source === 'pskreporter').length}</span></div>
              <div>Active on Map: <span style={{ color: '#94a3b8' }}>{filteredStations.length}</span></div>
              <div>Bands: <span style={{ color: '#94a3b8' }}>{activeBands.length}</span></div>
              {showPropagationZones && (
                <>
                  <div>Prop Zones: <span style={{ color: '#94a3b8' }}>{propagationZones.reduce((sum, z) => sum + z.clusters.length, 0)} ({propagationZones.reduce((sum, z) => sum + z.clusters.filter(c => c.bidirectional).length, 0)} 2-way)</span></div>
                  <div>Zone Spots: <span style={{ color: '#94a3b8' }}>{propagationZones.reduce((sum, z) => sum + z.totalSpots, 0)}</span></div>
                </>
              )}
              {showMufLayer && (
                <>
                  <div>Ionosondes: <span style={{ color: '#94a3b8' }}>{ionosondeStations.length}</span></div>
                  {ionosondeStations.length > 0 && (
                    <div>MUF Range: <span style={{ color: '#94a3b8' }}>{Math.min(...ionosondeStations.map(s => s.mufd)).toFixed(1)}-{Math.max(...ionosondeStations.map(s => s.mufd)).toFixed(1)} MHz</span></div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
        <div>Data: <a href="https://vailrerbn.com" style={{ color: '#94a3b8' }}>VailReRBN</a> • <a href="https://pskreporter.info" style={{ color: '#94a3b8' }}>PSK Reporter</a></div>
        <div>by <a href="mailto:jaysvana@gmail.com" style={{ color: '#94a3b8' }}>W6JSV</a></div>
      </div>
    </div>
  );
}
