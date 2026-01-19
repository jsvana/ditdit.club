import { MAP_CONFIG } from '../constants/map.js';

export const gridToLatLon = (grid) => {
  if (!grid || grid.length < 4) return null;
  const g = grid.toUpperCase();
  // Validate grid format: first 2 chars must be A-R, next 2 must be digits 0-9
  const fieldLon = g.charCodeAt(0);
  const fieldLat = g.charCodeAt(1);
  const squareLon = g.charCodeAt(2);
  const squareLat = g.charCodeAt(3);
  // A-R for field (65-82), 0-9 for square (48-57)
  if (fieldLon < 65 || fieldLon > 82 || fieldLat < 65 || fieldLat > 82) return null;
  if (squareLon < 48 || squareLon > 57 || squareLat < 48 || squareLat > 57) return null;
  const lon = (fieldLon - 65) * 20 - 180 + ((squareLon - 48) * 2) + 1;
  const lat = (fieldLat - 65) * 10 - 90 + (squareLat - 48) + 0.5;
  return { lat, lon };
};

export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

export const getBearing = (lat1, lon1, lat2, lon2) => {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
  return ((Math.atan2(Math.sin(Δλ) * Math.cos(φ2), Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)) * 180 / Math.PI) + 360) % 360;
};

export const getGreatCirclePath = (lat1, lon1, lat2, lon2, numPoints = 50) => {
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

// Convert lat/lon to SVG coordinates for world.svg (Mercator projection)
export const mercatorY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));

const MERCATOR_Y_MAX = mercatorY(MAP_CONFIG.latMax);
const MERCATOR_Y_MIN = mercatorY(MAP_CONFIG.latMin);
const MERCATOR_Y_RANGE = MERCATOR_Y_MAX - MERCATOR_Y_MIN;

export const latLonToXY = (lat, lon) => {
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
