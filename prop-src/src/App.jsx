import React, { useState, useEffect, useCallback, useMemo } from 'react';

// Constants
import { BANDS, getBandFromFreq } from './constants/bands.js';

// Utils
import { gridToLatLon, haversineDistance, getBearing } from './utils/geo.js';
import { getGridFromCall, getRegionFromCall } from './utils/callsigns.js';
import { buildPropagationZones, isStationInZone } from './utils/propagation.js';

// API
import { fetchGridsForCallsigns } from './api/hamdb.js';
import { parsePskReporterXml } from './api/spots.js';
import { fetchSolarData, getBandCondition } from './api/solar.js';

// Components
import { WorldMap } from './components/WorldMap.jsx';
import { GreatCirclePath } from './components/GreatCirclePath.jsx';
import { StationMarker } from './components/StationMarker.jsx';
import { PropagationZones } from './components/PropagationZones.jsx';
import { IonosondeMarkers } from './components/IonosondeMarkers.jsx';

// ============================================================================
// MAIN APP
// ============================================================================

// Load saved settings from localStorage
const loadSavedSettings = () => {
  try {
    const saved = localStorage.getItem('propSettings');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export default function App() {
  const savedSettings = loadSavedSettings();
  const [showOnboarding, setShowOnboarding] = useState(!savedSettings);
  const [userCall, setUserCall] = useState(savedSettings?.userCall || '');
  const [userGrid, setUserGrid] = useState(savedSettings?.userGrid || '');
  // Location mode: 'callsign' or 'pota'
  const [locationMode, setLocationMode] = useState(savedSettings?.locationMode || 'callsign');
  const [potaPark, setPotaPark] = useState(savedSettings?.potaPark || '');
  const [potaParkInfo, setPotaParkInfo] = useState(null);
  const [potaParkLoading, setPotaParkLoading] = useState(false);
  const [potaParkError, setPotaParkError] = useState(null);
  // Save callsign info when switching to POTA mode
  const [savedCallsignInfo, setSavedCallsignInfo] = useState(savedSettings?.savedCallsignInfo || null);
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState({
    rbn: { loading: false, done: false, error: null },
    psk: { loading: false, done: false, error: null },
    ionosonde: { loading: false, done: false, error: null },
    solar: { loading: false, done: false, error: null },
  });
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
  const [minZoneSnr, setMinZoneSnr] = useState(0); // Minimum SNR for propagation zones
  const [hoveredZone, setHoveredZone] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [showMufLayer, setShowMufLayer] = useState(true);
  const [ionosondeStations, setIonosondeStations] = useState([]);
  const [hoveredIonosonde, setHoveredIonosonde] = useState(null);
  const [selectedIonosonde, setSelectedIonosonde] = useState(null);
  const [solarData, setSolarData] = useState(null);
  const [showSolarDrawer, setShowSolarDrawer] = useState(false);
  const [spotterFilter, setSpotterFilter] = useState([]);
  const [spotterFilterInput, setSpotterFilterInput] = useState('');
  const [showSpotterPicker, setShowSpotterPicker] = useState(false);
  const [hamDbCacheVersion, setHamDbCacheVersion] = useState(0); // Increment to trigger re-render when cache updates
  // Per-band antenna capabilities: { standard: boolean, nvis: boolean }
  // Default: both false (no antenna) for all bands until user configures via onboarding
  const [antennaByBand, setAntennaByBand] = useState(() => {
    if (savedSettings?.antennaByBand) {
      // Handle migration from old string format
      const saved = savedSettings.antennaByBand;
      const firstValue = Object.values(saved)[0];
      if (typeof firstValue === 'string') {
        // Migrate from old format
        const migrated = {};
        BANDS.forEach(b => {
          const old = saved[b.name] || 'none';
          migrated[b.name] = {
            standard: old === 'lowAngle' || old === 'both',
            nvis: old === 'nvis' || old === 'both',
          };
        });
        return migrated;
      }
      return saved;
    }
    const initial = {};
    BANDS.forEach(b => {
      initial[b.name] = { standard: false, nvis: false };
    });
    return initial;
  });

  useEffect(() => { const i = setInterval(() => setCurrentTime(new Date()), 60000); return () => clearInterval(i); }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (userCall || userGrid || locationMode === 'pota') {
      localStorage.setItem('propSettings', JSON.stringify({
        userCall,
        userGrid,
        antennaByBand,
        locationMode,
        potaPark,
        savedCallsignInfo,
      }));
    }
  }, [userCall, userGrid, antennaByBand, locationMode, potaPark, savedCallsignInfo]);

  // Fetch POTA park info when park reference changes
  useEffect(() => {
    if (locationMode !== 'pota' || !potaPark) {
      setPotaParkInfo(null);
      setPotaParkError(null);
      return;
    }

    const fetchParkInfo = async () => {
      setPotaParkLoading(true);
      setPotaParkError(null);
      try {
        const response = await fetch(`https://api.pota.app/park/${encodeURIComponent(potaPark.toUpperCase())}`);
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'Park not found' : 'Failed to fetch park info');
        }
        const data = await response.json();
        setPotaParkInfo(data);
        // Update userGrid with park's grid
        if (data.grid6) {
          setUserGrid(data.grid6.toUpperCase());
        } else if (data.grid4) {
          setUserGrid(data.grid4.toUpperCase());
        }
      } catch (err) {
        setPotaParkError(err.message);
        setPotaParkInfo(null);
      } finally {
        setPotaParkLoading(false);
      }
    };

    const debounce = setTimeout(fetchParkInfo, 500);
    return () => clearTimeout(debounce);
  }, [locationMode, potaPark]);

  // Fetch ionosonde MUF data
  const fetchIonosondeData = useCallback(async () => {
    setLoadingStatus(prev => ({ ...prev, ionosonde: { loading: true, done: false, error: null } }));
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
        setLoadingStatus(prev => ({ ...prev, ionosonde: { loading: false, done: true, error: null } }));
      } else {
        setLoadingStatus(prev => ({ ...prev, ionosonde: { loading: false, done: true, error: 'Failed to fetch' } }));
      }
    } catch (e) {
      console.error('Failed to fetch ionosonde data:', e);
      setLoadingStatus(prev => ({ ...prev, ionosonde: { loading: false, done: true, error: e.message } }));
    }
  }, []);

  useEffect(() => {
    if (showMufLayer) {
      fetchIonosondeData();
      const i = setInterval(fetchIonosondeData, 15 * 60 * 1000); // Refresh every 15 min
      return () => clearInterval(i);
    }
  }, [showMufLayer, fetchIonosondeData]);

  // Fetch solar condition data
  const fetchSolarDataCallback = useCallback(async () => {
    setLoadingStatus(prev => ({ ...prev, solar: { loading: true, done: false, error: null } }));
    try {
      const data = await fetchSolarData();
      if (data.error) {
        setLoadingStatus(prev => ({ ...prev, solar: { loading: false, done: true, error: data.error } }));
      } else {
        setSolarData(data);
        setLoadingStatus(prev => ({ ...prev, solar: { loading: false, done: true, error: null } }));
      }
    } catch (e) {
      console.error('Failed to fetch solar data:', e);
      setLoadingStatus(prev => ({ ...prev, solar: { loading: false, done: true, error: e.message } }));
    }
  }, []);

  // Fetch solar data on mount and every 10 minutes
  useEffect(() => {
    fetchSolarDataCallback();
    const interval = setInterval(fetchSolarDataCallback, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchSolarDataCallback]);

  const fetchSpots = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadingStatus(prev => ({
      ...prev,
      rbn: { loading: true, done: false, error: null },
      psk: { loading: true, done: false, error: null },
    }));

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
        setLoadingStatus(prev => ({ ...prev, rbn: { loading: false, done: true, error: null, count: rbnSpots.length } }));
      } else {
        const errMsg = rbnResponse.status === 'rejected' ? rbnResponse.reason?.message : 'Failed';
        setLoadingStatus(prev => ({ ...prev, rbn: { loading: false, done: true, error: errMsg } }));
      }

      // Process PSKReporter data
      if (pskResponse.status === 'fulfilled' && pskResponse.value.ok) {
        const pskText = await pskResponse.value.text();
        const pskSpots = parsePskReporterXml(pskText);
        allSpots = [...allSpots, ...pskSpots];
        setLoadingStatus(prev => ({ ...prev, psk: { loading: false, done: true, error: null, count: pskSpots.length } }));
      } else {
        const errMsg = pskResponse.status === 'rejected' ? pskResponse.reason?.message : 'Failed';
        setLoadingStatus(prev => ({ ...prev, psk: { loading: false, done: true, error: errMsg } }));
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

  // Fetch HamDB grids for callsigns in spots (background, with caching)
  useEffect(() => {
    if (!spots.length) return;

    // Collect unique callsigns from spots (both TX and RX)
    const callsigns = new Set();
    spots.forEach(spot => {
      if (spot.callsign) callsigns.add(spot.callsign.toUpperCase());
      if (spot.spotter) callsigns.add(spot.spotter.toUpperCase());
      if (spot.de_call) callsigns.add(spot.de_call.toUpperCase());
    });

    // Fetch grids in background, then trigger re-render
    fetchGridsForCallsigns(Array.from(callsigns), () => {
      // Increment version to trigger useMemo recalculation
      setHamDbCacheVersion(v => v + 1);
    });
  }, [spots]);

  const userCoords = gridToLatLon(userGrid) || { lat: 37.5, lon: -122 };

  // Determine if it's currently daytime at user's location
  const isDaytime = useMemo(() => {
    if (!userCoords) return true;
    const now = new Date();
    // Simple approximation: daytime is 6am-6pm local solar time
    // Solar noon is when the sun is directly south (or north in southern hemisphere)
    // Local solar time offset from UTC based on longitude
    const solarTimeOffset = userCoords.lon / 15; // hours
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
    const localSolarHours = (utcHours + solarTimeOffset + 24) % 24;
    return localSolarHours >= 6 && localSolarHours < 18;
  }, [userCoords, currentTime]);

  // Compute propagation zones (always, for workability analysis)
  const propagationZones = useMemo(() => {
    if (!spots.length || !userCoords) return [];
    return buildPropagationZones(spots, userCall, userCoords, proximityRadius);
  }, [spots, userCall, userGrid, proximityRadius, hamDbCacheVersion]); // userGrid instead of userCoords to avoid new object reference each render

  // Filter propagation zones by minimum SNR
  const filteredPropagationZones = useMemo(() => {
    if (minZoneSnr <= 0) return propagationZones;
    return propagationZones.map(zone => ({
      ...zone,
      clusters: zone.clusters.filter(c => c.bestSnr >= minZoneSnr)
    })).filter(zone => zone.clusters.length > 0);
  }, [propagationZones, minZoneSnr]);

  // Build explanation for why a band has its current workability status
  const buildExplanations = (ba, distance, nearbySpotterCall, nearbySpotterDist) => {
    const factors = [];
    let primary = '';

    // SNR factor
    const snrLevel = ba.bestSnr >= 15 ? 'strong' : ba.bestSnr >= 10 ? 'good' : ba.bestSnr >= 5 ? 'moderate' : 'weak';
    factors.push({
      type: 'snr',
      value: ba.bestSnr,
      text: `SNR: ${ba.bestSnr} dB (${snrLevel} signal)`,
      positive: ba.bestSnr >= 10
    });

    // Nearby spotter factor
    if (ba.hasNearbySpot && nearbySpotterCall) {
      factors.push({
        type: 'nearby',
        value: nearbySpotterCall,
        text: `Nearby spotter: ${nearbySpotterCall} (${Math.round(nearbySpotterDist)}km away)`,
        positive: true
      });
    } else {
      factors.push({
        type: 'nearby',
        value: null,
        text: 'No nearby spotters',
        positive: false
      });
    }

    // Propagation zone factor
    const inZone = ba.inZone;
    if (inZone) {
      factors.push({
        type: 'zone',
        value: true,
        text: 'In propagation zone from your area',
        positive: true
      });
    }

    // Band conditions factor
    if (ba.bandCondition) {
      const condLower = ba.bandCondition.toLowerCase();
      factors.push({
        type: 'conditions',
        value: ba.bandCondition,
        text: `Band conditions: ${ba.bandCondition}`,
        positive: condLower === 'good' || condLower === 'fair'
      });
    }

    // Skip zone factor (negative)
    if (ba.inSkipZone) {
      const skipZone = ba.band.skipZone;
      factors.push({
        type: 'skipZone',
        value: true,
        text: `In skip zone (${skipZone.min}-${skipZone.max}km)`,
        positive: false
      });
    }

    // No antenna factor (negative)
    if (ba.noAntenna) {
      factors.push({
        type: 'antenna',
        value: true,
        text: 'No antenna for this band',
        positive: false
      });
    }

    // Determine primary reason (priority order)
    if (ba.noAntenna) {
      primary = 'No antenna';
    } else if (ba.inSkipZone) {
      primary = 'Skip zone';
    } else if (ba.degradedByConditions) {
      primary = `${ba.bandCondition} conditions`;
    } else if (ba.status === 'unlikely' && ba.bestSnr < 5) {
      primary = `Weak signal (${ba.bestSnr} dB)`;
    } else if (ba.status === 'unlikely' && !ba.hasNearbySpot && !inZone) {
      primary = 'No nearby spotters';
    } else if (ba.hasNearbySpot && nearbySpotterCall) {
      primary = `Nearby: ${nearbySpotterCall}`;
    } else if (ba.bestSnr >= 10) {
      primary = `SNR ${ba.bestSnr} dB`;
    } else {
      primary = `SNR ${ba.bestSnr} dB`;
    }

    return { primary, factors };
  };

  const stationData = useMemo(() => {
    if (!userCoords) return [];
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
        if (!bandAnalysis[band.name]) bandAnalysis[band.name] = { band, spots: [], bestSnr: -999, hasNearbySpot: false, nearbySpotterCall: null, nearbySpotterDist: null };
        bandAnalysis[band.name].spots.push(spot);
        if (spot.snr > bandAnalysis[band.name].bestSnr) bandAnalysis[band.name].bestSnr = spot.snr;
        // Check if this spot came from a nearby skimmer
        const spotterCall = spot.spotter || spot.de_call || '';
        const spotterGrid = spot.spotter_grid || spot.de_grid || getGridFromCall(spotterCall);
        const spotterCoords = spotterGrid ? gridToLatLon(spotterGrid) : null;
        if (spotterCoords) {
          const spotterDist = haversineDistance(userCoords.lat, userCoords.lon, spotterCoords.lat, spotterCoords.lon);
          if (spotterDist <= proximityRadius) {
            bandAnalysis[band.name].hasNearbySpot = true;
            if (!bandAnalysis[band.name].nearbySpotterCall || spotterDist < bandAnalysis[band.name].nearbySpotterDist) {
              bandAnalysis[band.name].nearbySpotterCall = spotterCall;
              bandAnalysis[band.name].nearbySpotterDist = spotterDist;
            }
          }
        }
      });
      Object.values(bandAnalysis).forEach(ba => {
        ba.wpm = ba.spots[0]?.wpm || 18;
        const inZone = isStationInZone(coords, propagationZones, ba.band.name);
        ba.inZone = inZone;
        const isRelevant = ba.hasNearbySpot || inZone;

        // Check antenna capabilities for this band
        const antenna = antennaByBand[ba.band.name] || { standard: false, nvis: false };
        const hasNoAntenna = !antenna.standard && !antenna.nvis;

        // No antenna = band unavailable
        if (hasNoAntenna) {
          ba.status = 'unavailable';
          ba.noAntenna = true;
          ba.inSkipZone = false;
          if (ba.bestSnr > bestSnr) { bestSnr = ba.bestSnr; bestBand = ba.band; }
          return;
        }

        // Check skip zone based on antenna capabilities
        // - NVIS covers 0-500km on NVIS-capable bands (no skip zone)
        // - Standard/low-angle has skip zone
        const skipZone = ba.band.skipZone;
        let inSkipZone = false;

        if (skipZone && distance >= skipZone.min && distance <= skipZone.max) {
          // Station is in the skip zone range
          const nvisCoverage = antenna.nvis && ba.band.nvisCapable && distance <= 500;
          if (nvisCoverage) {
            // NVIS antenna can reach within 500km on NVIS-capable bands
            inSkipZone = false;
          } else if (antenna.standard) {
            // Standard antenna only - skip zone applies
            inSkipZone = true;
          } else {
            // NVIS only but beyond coverage or not NVIS-capable band
            inSkipZone = true;
          }
        }

        ba.inSkipZone = inSkipZone;
        ba.noAntenna = false;

        if (inSkipZone) {
          ba.status = 'unlikely';
        } else if (isRelevant && ba.bestSnr >= 10) {
          ba.status = 'should';
        } else if (isRelevant && ba.bestSnr > 5) {
          ba.status = 'might';
        } else {
          ba.status = 'unlikely';
        }

        // Check band conditions from solar data
        const bandCondition = getBandCondition(solarData, ba.band.name, isDaytime);
        if (bandCondition) {
          const conditionLower = bandCondition.toLowerCase();
          if (conditionLower === 'poor' && ba.status === 'should') {
            ba.status = 'might';
            ba.degradedByConditions = true;
            ba.bandCondition = bandCondition;
          } else if (conditionLower !== 'good' && conditionLower !== 'fair') {
            // Very poor or worse
            ba.status = 'unlikely';
            ba.degradedByConditions = true;
            ba.bandCondition = bandCondition;
          } else {
            ba.bandCondition = bandCondition;
          }
        }

        // Build explanations for this band
        ba.explanations = buildExplanations(ba, distance, ba.nearbySpotterCall, ba.nearbySpotterDist);

        if (ba.bestSnr > bestSnr) { bestSnr = ba.bestSnr; bestBand = ba.band; }
      });
      // Overall status is the best status across all bands
      const bandStatuses = Object.values(bandAnalysis).map(ba => ba.status);
      const status = bandStatuses.includes('should') ? 'should' : bandStatuses.includes('might') ? 'might' : 'unlikely';
      return { call, grid, lat: coords.lat, lon: coords.lon, region, distance: Math.round(distance), status, bandAnalysis, bestBand, bestSnr: bestSnr > -999 ? bestSnr : 0, spotCount: callSpots.length, wpm: callSpots[0]?.wpm || 18 };
    }).filter(Boolean);
  }, [spots, userGrid, spotterFilter, propagationZones, proximityRadius, antennaByBand, hamDbCacheVersion, solarData, isDaytime]);

  const filteredStations = useMemo(() => {
    let f = stationData.filter(s => s.call.toUpperCase() !== userCall.toUpperCase() && s.spotCount > 0);
    if (filterBand) f = f.filter(s => s.bandAnalysis[filterBand] && s.bandAnalysis[filterBand].status !== 'unavailable');
    return f;
  }, [stationData, userCall, filterBand]);

  const groupedStations = useMemo(() => {
    const g = { should: [], might: [], unlikely: [] };
    filteredStations.forEach(s => g[filterBand && s.bandAnalysis[filterBand] ? s.bandAnalysis[filterBand].status : s.status].push(s));
    Object.keys(g).forEach(k => g[k].sort((a, b) => b.bestSnr - a.bestSnr));
    return g;
  }, [filteredStations, filterBand]);

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

  // Onboarding state for form
  const [onboardingCall, setOnboardingCall] = useState('');
  const [onboardingGrid, setOnboardingGrid] = useState('');
  const [onboardingAntennas, setOnboardingAntennas] = useState(() => {
    const initial = {};
    BANDS.forEach(b => { initial[b.name] = { standard: false, nvis: false }; });
    return initial;
  });

  // Auto-derive grid when callsign changes in onboarding
  const handleOnboardingCallChange = (call) => {
    const upperCall = call.toUpperCase();
    setOnboardingCall(upperCall);
    const derivedGrid = getGridFromCall(upperCall);
    if (derivedGrid && !onboardingGrid) {
      setOnboardingGrid(derivedGrid);
    }
  };

  const completeOnboarding = () => {
    if (onboardingCall && onboardingGrid) {
      setUserCall(onboardingCall);
      setUserGrid(onboardingGrid);
      setAntennaByBand(onboardingAntennas);
      setShowOnboarding(false);
    }
  };

  // Solar badge color thresholds
  const getSolarBadgeColor = (metric, value) => {
    if (value === null || value === undefined) return { bg: 'rgba(100,116,139,0.3)', border: 'rgba(100,116,139,0.5)', text: '#94a3b8' };

    if (metric === 'sfi') {
      if (value >= 120) return { bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.4)', text: '#22c55e' };
      if (value >= 90) return { bg: 'rgba(234,179,8,0.2)', border: 'rgba(234,179,8,0.4)', text: '#eab308' };
      return { bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.4)', text: '#ef4444' };
    }
    if (metric === 'a') {
      if (value < 10) return { bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.4)', text: '#22c55e' };
      if (value <= 30) return { bg: 'rgba(234,179,8,0.2)', border: 'rgba(234,179,8,0.4)', text: '#eab308' };
      return { bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.4)', text: '#ef4444' };
    }
    if (metric === 'k') {
      if (value < 3) return { bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.4)', text: '#22c55e' };
      if (value <= 4) return { bg: 'rgba(234,179,8,0.2)', border: 'rgba(234,179,8,0.4)', text: '#eab308' };
      return { bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.4)', text: '#ef4444' };
    }
    return { bg: 'rgba(100,116,139,0.3)', border: 'rgba(100,116,139,0.5)', text: '#94a3b8' };
  };

  const getBandConditionColor = (condition) => {
    if (!condition) return { bg: 'rgba(100,116,139,0.2)', text: '#64748b' };
    const lower = condition.toLowerCase();
    if (lower === 'good') return { bg: 'rgba(34,197,94,0.3)', text: '#22c55e' };
    if (lower === 'fair') return { bg: 'rgba(234,179,8,0.3)', text: '#eab308' };
    return { bg: 'rgba(239,68,68,0.3)', text: '#ef4444' }; // Poor or worse
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', fontFamily: "system-ui, sans-serif", color: '#e2e8f0', padding: '20px' }}>
      {/* Onboarding Modal */}
      {showOnboarding && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '16px', padding: '32px', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', background: 'linear-gradient(90deg, #f8fafc, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Welcome to Propagation Estimator</h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#94a3b8' }}>Let's set up your station to show relevant propagation data.</p>

            {/* Callsign */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: '600' }}>Your Callsign</label>
              <input
                type="text"
                value={onboardingCall}
                onChange={e => handleOnboardingCallChange(e.target.value)}
                placeholder="W1ABC"
                style={{ width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '8px', padding: '12px 14px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '16px', boxSizing: 'border-box' }}
              />
            </div>

            {/* Grid */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: '600' }}>Your Grid Square</label>
              <input
                type="text"
                value={onboardingGrid}
                onChange={e => setOnboardingGrid(e.target.value.toUpperCase())}
                placeholder="FN31"
                style={{ width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '8px', padding: '12px 14px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '16px', boxSizing: 'border-box' }}
              />
              {onboardingCall && getGridFromCall(onboardingCall) && (
                <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '6px' }}>
                  Auto-detected from callsign prefix. Edit if needed.
                </div>
              )}
            </div>

            {/* Antennas */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: '600' }}>Your Antennas (check what you have for each band)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {BANDS.map(band => {
                  const antenna = onboardingAntennas[band.name] || { standard: false, nvis: false };
                  const hasAny = antenna.standard || antenna.nvis;
                  return (
                    <div key={band.name} style={{ background: 'rgba(15,23,42,0.5)', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: band.color, fontWeight: '700', marginBottom: '6px' }}>{band.name}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: hasAny ? '#e2e8f0' : '#64748b', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={antenna.standard}
                            onChange={e => setOnboardingAntennas(prev => ({ ...prev, [band.name]: { ...prev[band.name], standard: e.target.checked } }))}
                            style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                          />
                          Standard/Low-angle
                        </label>
                        {band.nvisCapable && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: hasAny ? '#e2e8f0' : '#64748b', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={antenna.nvis}
                              onChange={e => setOnboardingAntennas(prev => ({ ...prev, [band.name]: { ...prev[band.name], nvis: e.target.checked } }))}
                              style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                            />
                            NVIS
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '8px' }}>
                Standard/Low-angle: Beams, low dipoles (DX, has skip zone) | NVIS: High dipoles, loops (regional, 0-500km, no skip zone)
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={completeOnboarding}
              disabled={!onboardingCall || !onboardingGrid}
              style={{
                width: '100%',
                background: onboardingCall && onboardingGrid ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(100,116,139,0.3)',
                border: 'none',
                borderRadius: '8px',
                padding: '14px',
                color: onboardingCall && onboardingGrid ? '#fff' : '#64748b',
                cursor: onboardingCall && onboardingGrid ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, background: 'linear-gradient(90deg, #f8fafc, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Propagation Estimator</h1>
          <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'rgba(100,116,139,0.3)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '6px', padding: '5px 10px', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}>⚙️ Settings</button>
          <button onClick={fetchSpots} disabled={loading} style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', padding: '5px 10px', color: '#22c55e', cursor: 'pointer', fontSize: '11px', opacity: loading ? 0.5 : 1 }}>{loading ? '⏳' : '🔄'} Refresh</button>
          {lastUpdate && <span style={{ fontSize: '11px', color: '#64748b' }}>Updated: {lastUpdate.toLocaleTimeString()}</span>}
          {error && <span style={{ fontSize: '11px', color: '#f87171' }}>⚠️ Demo data</span>}
          {/* Solar Condition Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
            {['sfi', 'a', 'k'].map(metric => {
              const value = metric === 'sfi' ? solarData?.solarFlux : metric === 'a' ? solarData?.aIndex : solarData?.kIndex;
              const label = metric === 'sfi' ? 'SFI' : metric === 'a' ? 'A' : 'K';
              const colors = getSolarBadgeColor(metric, value);
              return (
                <div
                  key={metric}
                  style={{
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '4px',
                    padding: '3px 6px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: colors.text,
                    fontWeight: '600',
                  }}
                >
                  {label} {value ?? '---'}
                </div>
              );
            })}
            <button
              onClick={() => setShowSolarDrawer(!showSolarDrawer)}
              style={{
                background: showSolarDrawer ? 'rgba(100,116,139,0.4)' : 'rgba(100,116,139,0.2)',
                border: '1px solid rgba(148,163,184,0.3)',
                borderRadius: '4px',
                padding: '3px 6px',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '10px',
              }}
              title="Solar conditions details"
            >
              ℹ️
            </button>
          </div>
        </div>
      </div>

      {/* Solar Conditions Drawer */}
      {showSolarDrawer && (
        <div style={{
          background: 'rgba(30,41,59,0.95)',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Left column - Values */}
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>Solar Indices</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                {[
                  { label: 'Solar Flux', value: solarData?.solarFlux, unit: '' },
                  { label: 'A-Index', value: solarData?.aIndex, unit: '' },
                  { label: 'K-Index', value: solarData?.kIndex, unit: '' },
                  { label: 'Sunspots', value: solarData?.sunspots, unit: '' },
                  { label: 'X-Ray', value: solarData?.xray, unit: '' },
                  { label: 'Geomag Field', value: solarData?.geomagField, unit: '' },
                  { label: 'Solar Wind', value: solarData?.solarWind, unit: ' km/s' },
                  { label: 'Signal Noise', value: solarData?.signalNoise, unit: '' },
                ].map(({ label, value, unit }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'rgba(15,23,42,0.5)', borderRadius: '4px' }}>
                    <span style={{ color: '#64748b' }}>{label}</span>
                    <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{value ?? '---'}{value ? unit : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column - Band Conditions */}
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>Band Conditions</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '4px', fontSize: '10px' }}>
                <div style={{ color: '#64748b', padding: '4px 8px' }}>Band</div>
                <div style={{ color: '#64748b', padding: '4px 8px', textAlign: 'center' }}>Day</div>
                <div style={{ color: '#64748b', padding: '4px 8px', textAlign: 'center' }}>Night</div>
                {['80m-40m', '30m-20m', '17m-15m', '12m-10m'].map(range => {
                  const dayCondition = solarData?.bandConditions?.day?.[range];
                  const nightCondition = solarData?.bandConditions?.night?.[range];
                  const dayColors = getBandConditionColor(dayCondition);
                  const nightColors = getBandConditionColor(nightCondition);
                  return (
                    <React.Fragment key={range}>
                      <div style={{ color: '#94a3b8', padding: '4px 8px', fontFamily: 'monospace' }}>{range}</div>
                      <div style={{ background: dayColors.bg, color: dayColors.text, padding: '4px 8px', borderRadius: '3px', textAlign: 'center' }}>{dayCondition || '---'}</div>
                      <div style={{ background: nightColors.bg, color: nightColors.text, padding: '4px 8px', borderRadius: '3px', textAlign: 'center' }}>{nightCondition || '---'}</div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(148,163,184,0.2)', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
            <span>Updated: {solarData?.updated || '---'}</span>
            <a
              href="https://www.arrl.org/files/file/Technology/tis/info/pdf/0209038.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#94a3b8' }}
            >
              Learn more about solar indices →
            </a>
          </div>
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <div style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Mode toggle */}
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Location Mode</label>
              <div style={{ display: 'flex', gap: '2px' }}>
                <button
                  onClick={() => {
                    if (locationMode === 'pota') {
                      // Restore saved callsign info
                      if (savedCallsignInfo) {
                        setUserCall(savedCallsignInfo.userCall || '');
                        setUserGrid(savedCallsignInfo.userGrid || '');
                      }
                      setLocationMode('callsign');
                    }
                  }}
                  style={{
                    background: locationMode === 'callsign' ? 'rgba(34,197,94,0.3)' : 'rgba(15,23,42,0.8)',
                    border: `1px solid ${locationMode === 'callsign' ? 'rgba(34,197,94,0.5)' : 'rgba(148,163,184,0.3)'}`,
                    borderRadius: '6px 0 0 6px',
                    padding: '6px 12px',
                    color: locationMode === 'callsign' ? '#22c55e' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: locationMode === 'callsign' ? '600' : '400'
                  }}
                >Callsign</button>
                <button
                  onClick={() => {
                    if (locationMode === 'callsign') {
                      // Save current callsign info
                      setSavedCallsignInfo({ userCall, userGrid });
                      setLocationMode('pota');
                    }
                  }}
                  style={{
                    background: locationMode === 'pota' ? 'rgba(34,197,94,0.3)' : 'rgba(15,23,42,0.8)',
                    border: `1px solid ${locationMode === 'pota' ? 'rgba(34,197,94,0.5)' : 'rgba(148,163,184,0.3)'}`,
                    borderRadius: '0 6px 6px 0',
                    padding: '6px 12px',
                    color: locationMode === 'pota' ? '#22c55e' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: locationMode === 'pota' ? '600' : '400'
                  }}
                >POTA Park</button>
              </div>
            </div>
            {/* Callsign mode inputs */}
            {locationMode === 'callsign' && (
              <>
                <div><label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Your Callsign</label><input type="text" value={userCall} onChange={e => setUserCall(e.target.value.toUpperCase())} style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '6px', padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', width: '100px' }} /></div>
              </>
            )}
            {/* POTA mode inputs */}
            {locationMode === 'pota' && (
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>POTA Park Reference</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    value={potaPark}
                    onChange={e => setPotaPark(e.target.value.toUpperCase())}
                    placeholder="US-0189"
                    style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '6px', padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', width: '100px' }}
                  />
                  {potaParkLoading && <span style={{ fontSize: '11px', color: '#fbbf24' }}>Loading...</span>}
                  {potaParkError && <span style={{ fontSize: '11px', color: '#ef4444' }}>{potaParkError}</span>}
                  {potaParkInfo && (
                    <span style={{ fontSize: '11px', color: '#22c55e', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {potaParkInfo.name} ({potaParkInfo.grid6 || potaParkInfo.grid4})
                    </span>
                  )}
                </div>
              </div>
            )}
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>{locationMode === 'pota' ? 'Park Grid' : 'Your Grid'}</label>
              <input
                type="text"
                value={userGrid}
                onChange={e => locationMode !== 'pota' && setUserGrid(e.target.value.toUpperCase())}
                readOnly={locationMode === 'pota'}
                style={{
                  background: locationMode === 'pota' ? 'rgba(15,23,42,0.4)' : 'rgba(15,23,42,0.8)',
                  border: '1px solid rgba(148,163,184,0.3)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  color: locationMode === 'pota' ? '#94a3b8' : '#e2e8f0',
                  fontFamily: 'monospace',
                  width: '80px',
                  cursor: locationMode === 'pota' ? 'not-allowed' : 'text'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={showTerminator} onChange={e => setShowTerminator(e.target.checked)} style={{ accentColor: '#22c55e' }} />Day/Night</label>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={showSpots} onChange={e => setShowSpots(e.target.checked)} style={{ accentColor: '#22c55e' }} />Spots</label>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={showAllPaths} onChange={e => setShowAllPaths(e.target.checked)} style={{ accentColor: '#22c55e' }} />All Paths</label>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={showPropagationZones} onChange={e => setShowPropagationZones(e.target.checked)} style={{ accentColor: '#22c55e' }} />Prop Zones</label>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={showMufLayer} onChange={e => setShowMufLayer(e.target.checked)} style={{ accentColor: '#22c55e' }} />MUF Data</label>
            </div>
            {showPropagationZones && (
              <>
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
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <label style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>Min SNR:</label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={minZoneSnr}
                  onChange={e => setMinZoneSnr(Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#22c55e' }}
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', minWidth: '70px' }}>{minZoneSnr} dB</span>
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
              </>
            )}
            {/* Antenna Capabilities per Band (for skip zone calculation) */}
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(148,163,184,0.2)', width: '100%' }}>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>Antenna Capabilities (affects skip zone calculation):</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {BANDS.map(band => {
                  const antenna = antennaByBand[band.name] || { standard: false, nvis: false };
                  const hasAny = antenna.standard || antenna.nvis;
                  return (
                    <div key={band.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15,23,42,0.5)', padding: '4px 8px', borderRadius: '4px' }}>
                      <span style={{ fontSize: '10px', color: band.color, fontWeight: '600', minWidth: '32px' }}>{band.name}</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px', color: hasAny ? '#e2e8f0' : '#64748b', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={antenna.standard}
                          onChange={e => setAntennaByBand(prev => ({ ...prev, [band.name]: { ...prev[band.name], standard: e.target.checked } }))}
                          style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                        />
                        Std
                      </label>
                      {band.nvisCapable && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px', color: hasAny ? '#e2e8f0' : '#64748b', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={antenna.nvis}
                            onChange={e => setAntennaByBand(prev => ({ ...prev, [band.name]: { ...prev[band.name], nvis: e.target.checked } }))}
                            style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                          />
                          NVIS
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '9px', color: '#64748b', marginTop: '6px' }}>
                Std: Standard/low-angle (DX, has skip zone) | NVIS: Regional coverage (0-500km, no skip zone)
              </div>
            </div>

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
              {BANDS.map(band => <button key={band.name} onClick={() => setFilterBand(band.name)} style={{ background: filterBand === band.name ? `linear-gradient(135deg, ${band.color}, ${band.color}dd)` : 'rgba(100,116,139,0.2)', border: 'none', borderRadius: '4px', padding: '4px 8px', color: filterBand === band.name ? '#fff' : band.color, cursor: 'pointer', fontSize: '10px', fontWeight: '600' }}>{band.name}</button>)}
            </div>
          </div>
          <div style={{ padding: '16px', position: 'relative' }}>
            {loading && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(15,23,42,0.95)', padding: '16px 24px', borderRadius: '10px', zIndex: 10, border: '1px solid rgba(148,163,184,0.2)', minWidth: '200px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: '#e2e8f0' }}>Loading Data...</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                    <span style={{ width: '16px', textAlign: 'center' }}>
                      {loadingStatus.rbn.loading ? '⏳' : loadingStatus.rbn.error ? '❌' : loadingStatus.rbn.done ? '✓' : '○'}
                    </span>
                    <span style={{ color: loadingStatus.rbn.loading ? '#fbbf24' : loadingStatus.rbn.error ? '#ef4444' : loadingStatus.rbn.done ? '#22c55e' : '#64748b' }}>
                      RBN Spots
                      {loadingStatus.rbn.done && !loadingStatus.rbn.error && loadingStatus.rbn.count !== undefined && ` (${loadingStatus.rbn.count})`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                    <span style={{ width: '16px', textAlign: 'center' }}>
                      {loadingStatus.psk.loading ? '⏳' : loadingStatus.psk.error ? '❌' : loadingStatus.psk.done ? '✓' : '○'}
                    </span>
                    <span style={{ color: loadingStatus.psk.loading ? '#fbbf24' : loadingStatus.psk.error ? '#ef4444' : loadingStatus.psk.done ? '#22c55e' : '#64748b' }}>
                      PSKReporter
                      {loadingStatus.psk.done && !loadingStatus.psk.error && loadingStatus.psk.count !== undefined && ` (${loadingStatus.psk.count})`}
                    </span>
                  </div>
                  {showMufLayer && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                      <span style={{ width: '16px', textAlign: 'center' }}>
                        {loadingStatus.ionosonde.loading ? '⏳' : loadingStatus.ionosonde.error ? '❌' : loadingStatus.ionosonde.done ? '✓' : '○'}
                      </span>
                      <span style={{ color: loadingStatus.ionosonde.loading ? '#fbbf24' : loadingStatus.ionosonde.error ? '#ef4444' : loadingStatus.ionosonde.done ? '#22c55e' : '#64748b' }}>
                        Ionosonde MUF
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                    <span style={{ width: '16px', textAlign: 'center' }}>
                      {loadingStatus.solar.loading ? '⏳' : loadingStatus.solar.error ? '❌' : loadingStatus.solar.done ? '✓' : '○'}
                    </span>
                    <span style={{ color: loadingStatus.solar.loading ? '#fbbf24' : loadingStatus.solar.error ? '#ef4444' : loadingStatus.solar.done ? '#22c55e' : '#64748b' }}>
                      Solar Conditions
                    </span>
                  </div>
                </div>
              </div>
            )}
            <WorldMap currentTime={currentTime} showTerminator={showTerminator}>
              {({ zoom }) => (
                <>
                  {/* Propagation zones (rendered first, underneath everything) */}
                  {showPropagationZones && (
                    <PropagationZones
                      zones={filteredPropagationZones}
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
                  <StationMarker lat={userCoords.lat} lon={userCoords.lon} call={locationMode === 'pota' ? potaPark : userCall} isUser={true} zoom={zoom} />
                  {showSpots && filteredStations.map(s => <StationMarker key={s.call} lat={s.lat} lon={s.lon} call={s.call} bandData={s} isSelected={selectedStation?.call === s.call} onClick={() => setSelectedStation(selectedStation?.call === s.call ? null : s)} zoom={zoom} />)}
                  {/* Always show selected station marker even if showSpots is off */}
                  {selectedStation && !showSpots && <StationMarker lat={selectedStation.lat} lon={selectedStation.lon} call={selectedStation.call} bandData={selectedStation} isSelected={true} onClick={() => setSelectedStation(null)} zoom={zoom} />}
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
                {Object.entries(selectedStation.bandAnalysis).sort((a, b) => b[1].bestSnr - a[1].bestSnr).map(([name, data]) => {
                  const bestSpot = data.spots.reduce((best, s) => s.snr > (best?.snr ?? -999) ? s : best, null);
                  const freq = bestSpot?.frequency;
                  const spotTime = bestSpot?.timestamp ? new Date(bestSpot.timestamp) : null;
                  const ageMin = spotTime ? Math.round((Date.now() - spotTime.getTime()) / 60000) : null;
                  return (
                  <div key={name} style={{ background: `${data.band.color}22`, border: `1px solid ${data.band.color}66`, borderRadius: '6px', padding: '6px 10px', minWidth: '80px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '9px', background: `${data.band.color}44`, color: data.band.color, padding: '1px 4px', borderRadius: '3px', fontWeight: '700' }}>{name}</span>
                      {ageMin !== null && <span style={{ fontSize: '9px', color: '#64748b' }}>{ageMin}m ago</span>}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#e2e8f0', fontFamily: 'monospace' }}>{freq ? freq.toFixed(1) : '?'}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{data.bestSnr}dB • {data.wpm}wpm</div>
                    <div style={{ fontSize: '9px', color: data.noAntenna ? '#64748b' : data.status === 'should' ? '#22c55e' : data.status === 'might' ? '#eab308' : '#ef4444' }}>
                      ● {data.noAntenna ? 'No antenna' : data.inSkipZone ? 'Skip zone' : data.status === 'should' ? 'Should work' : data.status === 'might' ? 'Might work' : 'Unlikely'}
                      {data.degradedByConditions && <span style={{ color: '#f97316', marginLeft: '4px' }}>⚠️ {data.bandCondition} conditions</span>}
                    </div>
                  </div>
                  );
                })}
              </div>
              {/* Explanation section */}
              {(() => {
                const bandKey = filterBand || selectedStation.bestBand?.name;
                const ba = bandKey && selectedStation.bandAnalysis[bandKey];
                if (!ba?.explanations?.factors?.length) return null;
                const statusText = ba.status === 'should' ? 'SHOULD WORK' : ba.status === 'might' ? 'MIGHT WORK' : 'UNLIKELY';
                return (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(148,163,184,0.2)' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      WHY "{statusText}" ON {bandKey}:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {ba.explanations.factors.map((factor, idx) => (
                        <div key={idx} style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: factor.positive ? '#22c55e' : '#f97316' }}>
                            {factor.positive ? '✓' : '⚠'}
                          </span>
                          <span style={{ color: '#e2e8f0' }}>{factor.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div style={{ background: 'rgba(30,41,59,0.6)', borderRadius: '10px', border: '1px solid rgba(148,163,184,0.15)', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(148,163,184,0.1)', flexShrink: 0 }}><h2 style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>QSO OPPORTUNITIES {filterBand && <span style={{ color: '#64748b', fontWeight: '400' }}>({filterBand})</span>}</h2></div>
            <div style={{ padding: '10px 14px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {['should', 'might', 'unlikely'].map(status => (
                <div key={status} style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '200px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '600', color: status === 'should' ? '#22c55e' : status === 'might' ? '#eab308' : '#ef4444', marginBottom: '6px', letterSpacing: '1px', flexShrink: 0 }}>{status === 'should' ? 'SHOULD WORK' : status === 'might' ? 'MIGHT WORK' : 'WEAK SIGNALS'} ({groupedStations[status].length})</div>
                  <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                  {groupedStations[status].map(s => {
                    const bandEntries = Object.entries(s.bandAnalysis).sort((a, b) => b[1].bestSnr - a[1].bestSnr).slice(0, 3);
                    return (
                    <div key={s.call} onClick={() => setSelectedStation(s)} style={{ background: selectedStation?.call === s.call ? `rgba(${status === 'should' ? '34,197,94' : status === 'might' ? '234,179,8' : '239,68,68'},0.2)` : `rgba(${status === 'should' ? '34,197,94' : status === 'might' ? '234,179,8' : '239,68,68'},0.05)`, borderRadius: '6px', padding: '8px 10px', marginBottom: '5px', cursor: 'pointer', borderLeft: selectedStation?.call === s.call ? `3px solid ${status === 'should' ? '#22c55e' : status === 'might' ? '#eab308' : '#ef4444'}` : '3px solid transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: '600', fontSize: '13px' }}>{s.call}</span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>{bandEntries.map(([b, data]) => {
                          const bestSpot = data.spots.reduce((best, spot) => spot.snr > (best?.snr ?? -999) ? spot : best, null);
                          const freq = bestSpot?.frequency;
                          const spotTime = bestSpot?.timestamp ? new Date(bestSpot.timestamp) : null;
                          const ageMin = spotTime ? Math.round((Date.now() - spotTime.getTime()) / 60000) : null;
                          return (
                            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ fontSize: '7px', background: `${data.band.color}44`, color: data.band.color, padding: '1px 3px', borderRadius: '2px', fontWeight: '700' }}>{b}</span>
                              <span style={{ fontSize: '11px', color: '#e2e8f0', fontFamily: 'monospace', fontWeight: '600' }}>{freq ? freq.toFixed(1) : '?'}</span>
                              {ageMin !== null && <span style={{ fontSize: '8px', color: '#64748b' }}>{ageMin}m</span>}
                            </div>
                          );
                        })}</div>
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                        {s.region} • {s.distance.toLocaleString()}km • {s.bestSnr}dB
                        {(() => {
                          const bandKey = filterBand || s.bestBand?.name;
                          const ba = bandKey && s.bandAnalysis[bandKey];
                          const primary = ba?.explanations?.primary;
                          if (!primary) return null;
                          const isNegative = ba.noAntenna || ba.inSkipZone || ba.degradedByConditions || ba.status === 'unlikely';
                          return (
                            <span style={{ color: isNegative ? '#f97316' : (ba.status === 'should' ? '#22c55e' : ba.status === 'might' ? '#eab308' : '#64748b'), marginLeft: '4px' }}>
                              • {primary}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    );
                  })}
                  {status === 'should' && groupedStations.should.length === 0 && <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>No strong signals</div>}
                  </div>
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
                  <div>Prop Zones: <span style={{ color: '#94a3b8' }}>{filteredPropagationZones.reduce((sum, z) => sum + z.clusters.length, 0)} ({filteredPropagationZones.reduce((sum, z) => sum + z.clusters.filter(c => c.bidirectional).length, 0)} 2-way)</span></div>
                  <div>Zone Spots: <span style={{ color: '#94a3b8' }}>{filteredPropagationZones.reduce((sum, z) => sum + z.clusters.reduce((s, c) => s + c.spotCount, 0), 0)}</span></div>
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
        <div>Data: <a href="https://vailrerbn.com" style={{ color: '#94a3b8' }}>VailReRBN</a> • <a href="https://pskreporter.info" style={{ color: '#94a3b8' }}>PSK Reporter</a> • <a href="https://prop.kc2g.com" style={{ color: '#94a3b8' }}>KC2G Ionosonde</a></div>
        <div>by <a href="mailto:jaysvana@gmail.com" style={{ color: '#94a3b8' }}>W6JSV</a></div>
      </div>
    </div>
  );
}
