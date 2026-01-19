import { haversineDistance, gridToLatLon } from './geo.js';
import { BANDS, getBandFromFreq } from '../constants/bands.js';
import { getGridFromCall } from './callsigns.js';

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
export const filterByProximity = (spots, refCoords, radiusKm) => {
  return spots.filter(spot => {
    const spotCoords = spot.grid ? gridToLatLon(spot.grid) :
                       (spot.spotter_grid ? gridToLatLon(spot.spotter_grid) : null);
    if (!spotCoords) return false;
    return haversineDistance(refCoords.lat, refCoords.lon, spotCoords.lat, spotCoords.lon) <= radiusKm;
  });
};

// Build propagation zones from spots
export const buildPropagationZones = (spots, userCall, userCoords, proximityKm) => {
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

// Check if station coordinates are within any zone cluster for a given band
export const isStationInZone = (stationCoords, zones, bandName) => {
  return zones
    .filter(z => z.band.name === bandName)
    .some(zone => zone.clusters.some(cluster =>
      haversineDistance(stationCoords.lat, stationCoords.lon, cluster.centroid.lat, cluster.centroid.lon) <= 1500
    ));
};
