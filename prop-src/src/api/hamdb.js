const HAMDB_CACHE_KEY = 'hamdb_grid_cache';
const HAMDB_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

// Load cache from localStorage
const loadHamDbCache = () => {
  try {
    const cached = localStorage.getItem(HAMDB_CACHE_KEY);
    if (!cached) return {};
    const parsed = JSON.parse(cached);
    // Clean expired entries
    const now = Date.now();
    const valid = {};
    for (const [call, entry] of Object.entries(parsed)) {
      if (entry.ts && now - entry.ts < HAMDB_CACHE_TTL) {
        valid[call] = entry;
      }
    }
    return valid;
  } catch {
    return {};
  }
};

// Save cache to localStorage
const saveHamDbCache = (cache) => {
  try {
    localStorage.setItem(HAMDB_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable
  }
};

// In-memory cache (loaded from localStorage on init)
let hamDbCache = loadHamDbCache();

// Track pending fetches to avoid duplicate requests
const pendingFetches = new Set();

// Fetch grid from HamDB API
export const fetchGridFromHamDb = async (call) => {
  const normalizedCall = call.toUpperCase().replace(/[\/\-].*/g, '');

  // Already cached?
  if (hamDbCache[normalizedCall]) {
    return hamDbCache[normalizedCall].grid;
  }

  // Already fetching?
  if (pendingFetches.has(normalizedCall)) {
    return null;
  }

  pendingFetches.add(normalizedCall);

  try {
    const response = await fetch(`https://api.hamdb.org/v1/${encodeURIComponent(normalizedCall)}/json`);
    if (!response.ok) return null;

    const data = await response.json();
    const rawGrid = data?.hamdb?.callsign?.grid;
    // Validate grid format: reject "NOT_FOUND" and other invalid values
    const grid = (rawGrid && /^[A-Ra-r]{2}[0-9]{2}([A-Xa-x]{2})?$/.test(rawGrid)) ? rawGrid.toUpperCase() : null;

    // Cache the result (even if null, to avoid repeated lookups)
    hamDbCache[normalizedCall] = { grid, ts: Date.now() };
    saveHamDbCache(hamDbCache);

    return grid || null;
  } catch {
    return null;
  } finally {
    pendingFetches.delete(normalizedCall);
  }
};

// Batch fetch grids for multiple callsigns (with rate limiting)
export const fetchGridsForCallsigns = async (callsigns, onProgress) => {
  const uncached = callsigns.filter(call => {
    const normalized = call.toUpperCase().replace(/[\/\-].*/g, '');
    return !hamDbCache[normalized];
  });

  // Limit to avoid hammering the API
  const toFetch = uncached.slice(0, 50);
  let completed = 0;

  for (const call of toFetch) {
    await fetchGridFromHamDb(call);
    completed++;
    if (onProgress) onProgress(completed, toFetch.length);
    // Small delay between requests
    if (completed < toFetch.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
};

// Get cached grid (synchronous, for use in existing code)
export const getCachedHamDbGrid = (call) => {
  if (!call) return null;
  const normalized = call.toUpperCase().replace(/[\/\-].*/g, '');
  return hamDbCache[normalized]?.grid || null;
};
