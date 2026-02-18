import { useState, useRef, useCallback, useEffect, useMemo } from "react";

const BANDS = [
  { start: 3, end: 30, label: "VLF", service: "navigation", color: "#4a6741",
    details: "Very Low Frequency", users: "Military, submarine comms, navigation beacons (OMEGA, Alpha)", activities: "Long-range submarine communication, navigation, time signals", propagation: "Ground wave; penetrates seawater to ~20m", notes: "Extremely long antennas required (km-scale). Used by navies worldwide." },
  { start: 30, end: 300, label: "LF", service: "navigation", color: "#4a6741",
    details: "Low Frequency", users: "LORAN-C, NDBs, time stations (WWVB, DCF77, MSF)", activities: "Navigation, AM broadcasting (EU/Asia Longwave), time signal distribution", propagation: "Ground wave dominant, reliable to ~2000 km day/night", notes: "WWVB at 60 kHz syncs millions of 'atomic' clocks in the US." },
  { start: 135.7, end: 137.8, label: "2200m", service: "amateur", color: "#c4a24e",
    details: "2200 Meter Amateur Band", users: "Amateur radio operators", activities: "CW, WSPR, experimental narrowband digital modes", propagation: "Ground wave, stable long-distance", notes: "Newest amateur allocation. Max 1W EIRP in US. WSPR beacons common." },
  { start: 300, end: 3000, label: "MF", service: "broadcast", color: "#7a8c6e",
    details: "Medium Frequency", users: "AM broadcasters, maritime, NDBs, amateur radio", activities: "AM broadcasting, marine CW/voice, direction finding", propagation: "Ground wave (day), skywave via E/F layer (night)", notes: "AM broadcast band (530-1700 kHz). Nighttime skip can reach 1000s of km." },
  { start: 472, end: 479, label: "630m", service: "amateur", color: "#c4a24e",
    details: "630 Meter Amateur Band", users: "Amateur radio operators", activities: "CW, WSPR, JT9, narrowband digital", propagation: "Ground wave + nighttime skywave", notes: "Max 5W EIRP in US. Growing WSPR activity. Must notify ARRL UTC database." },
  { start: 1800, end: 2000, label: "160m", service: "amateur", color: "#c4a24e",
    details: "160 Meter 'Top Band'", users: "Amateur radio operators (all license classes above Technician)", activities: "CW (1800–1840), Digital (1840–1850), SSB (1843–2000), DXing, contesting", propagation: "Ground wave + nighttime skywave. Best in winter.", notes: "Known as 'Top Band' or 'Gentleman's Band'. DX window 1830–1840 CW. Challenging but rewarding DXing." },
  { start: 3000, end: 30000, label: "HF", service: "utility", color: "#6b7c62",
    details: "High Frequency", users: "Amateur, shortwave broadcast, military, aviation, maritime, CODAR", activities: "Worldwide communication, broadcasting, emergency comms", propagation: "Skywave via ionospheric refraction (F1/F2 layers)", notes: "The 'shortwave' bands. Propagation varies with solar cycle, season, time of day." },
  { start: 3500, end: 4000, label: "80m", service: "amateur", color: "#c4a24e",
    details: "80 Meter Amateur Band", users: "Amateur radio (General+)", activities: "CW (3500–3600), Digital (3570–3600), SSB Phone (3600–4000), ragchewing, nets", propagation: "NVIS daytime (regional), skywave night (continental+)", notes: "Shared with Fixed service outside Region 2. Popular for regional nets and ragchewing. Noisy in summer." },
  { start: 3900, end: 4000, label: "75m Phone", service: "amateur", color: "#b8963f",
    details: "75 Meter Phone Subband", users: "Amateur radio (General/Extra)", activities: "SSB voice, AM, nets, ragchewing, emergency traffic", propagation: "NVIS daytime, long-distance skywave at night", notes: "The 'ragchew' portion of 80m. Lots of net activity. Extra class gets 3600–3700 too." },
  { start: 5330.5, end: 5405, label: "60m", service: "amateur", color: "#c4a24e",
    details: "60 Meter Amateur Band", users: "Amateur radio (General+)", activities: "USB voice, CW, digital (5 channelized frequencies in US)", propagation: "NVIS — excellent for regional emergency comms", notes: "Shared with government. US: 5 discrete channels at 100W ERP. ITU: 15 kHz allocation at 5351.5." },
  { start: 7000, end: 7300, label: "40m", service: "amateur", color: "#c4a24e",
    details: "40 Meter Amateur Band", users: "Amateur radio (General+, Tech CW below 7.125)", activities: "CW (7000–7125), Digital/RTTY (7070–7125), SSB (7125–7300), contesting, DX", propagation: "Skywave day & night. 'Workhorse' DX band.", notes: "Best all-around HF band. Excellent for POTA/SOTA. FT8 at 7074 kHz. CW DX window 7000–7025." },
  { start: 7300, end: 7600, label: "41m SW", service: "broadcast", color: "#7a8c6e",
    details: "41 Meter Shortwave Broadcast", users: "International broadcasters", activities: "Shortwave broadcasting, religious programming, propaganda", propagation: "Skywave, good nighttime coverage", notes: "Used by major international broadcasters for continental coverage." },
  { start: 9400, end: 9900, label: "31m SW", service: "broadcast", color: "#7a8c6e",
    details: "31 Meter Shortwave Broadcast", users: "International broadcasters (BBC, VOA, CRI, etc.)", activities: "International shortwave broadcasting", propagation: "Skywave, excellent medium-distance", notes: "One of the most popular SW broadcast bands." },
  { start: 10100, end: 10150, label: "30m", service: "amateur", color: "#c4a24e",
    details: "30 Meter Amateur Band (WARC)", users: "Amateur radio (General+)", activities: "CW, digital modes (FT8 at 10136), WSPR", propagation: "Excellent skywave, open day and night", notes: "WARC band — no contests allowed. CW/digital only. FT8 very active. Great for POTA." },
  { start: 11600, end: 12100, label: "25m SW", service: "broadcast", color: "#7a8c6e",
    details: "25 Meter Shortwave Broadcast", users: "International broadcasters", activities: "International shortwave broadcasting, daytime propagation", propagation: "Skywave, best during daylight hours", notes: "Daytime band for medium to long distance broadcasting." },
  { start: 14000, end: 14350, label: "20m", service: "amateur", color: "#c4a24e",
    details: "20 Meter Amateur Band", users: "Amateur radio (General+)", activities: "CW (14000–14150), SSB (14150–14350), RTTY/Digital, DXing, contesting", propagation: "Primary DX band. F2 layer. Open most of the day during solar max.", notes: "The 'King of DX' bands. FT8 at 14074. Beacon network at 14100. Most popular HF DX band." },
  { start: 15100, end: 15800, label: "19m SW", service: "broadcast", color: "#7a8c6e",
    details: "19 Meter Shortwave Broadcast", users: "International broadcasters", activities: "International shortwave broadcasting", propagation: "Daytime skywave, long-distance", notes: "Good daytime band for intercontinental broadcasting." },
  { start: 18068, end: 18168, label: "17m", service: "amateur", color: "#c4a24e",
    details: "17 Meter Amateur Band (WARC)", users: "Amateur radio (General+)", activities: "CW, SSB, digital modes, DXing", propagation: "Excellent DX when open. Between 20m and 15m characteristics.", notes: "WARC band — no contests. Often open when 15m is marginal. FT8 at 18100." },
  { start: 21000, end: 21450, label: "15m", service: "amateur", color: "#c4a24e",
    details: "15 Meter Amateur Band", users: "Amateur radio (General+, Tech CW 21.025–21.200)", activities: "CW, SSB, digital, DXing, contesting", propagation: "F2 layer. Excellent DX during solar maximum.", notes: "Outstanding DX band at solar cycle peaks. Tech CW privileges. FT8 at 21074." },
  { start: 24890, end: 24990, label: "12m", service: "amateur", color: "#c4a24e",
    details: "12 Meter Amateur Band (WARC)", users: "Amateur radio (General+)", activities: "CW, SSB, digital, DXing", propagation: "Similar to 10m. F2 and sporadic E.", notes: "WARC band — no contests. Can surprise with great openings. FT8 at 24915." },
  { start: 25670, end: 26100, label: "11m SW", service: "broadcast", color: "#7a8c6e",
    details: "11 Meter Shortwave / CB Adjacent", users: "Shortwave broadcasters, CB operators nearby", activities: "Broadcasting, freeband activity", propagation: "F2 layer and sporadic E", notes: "Adjacent to Citizens Band (26.965–27.405 MHz)." },
  { start: 26965, end: 27405, label: "CB 11m", service: "citizens", color: "#a0784a",
    details: "Citizens Band Radio (11 Meters)", users: "General public, truckers, hobbyists, preppers", activities: "Voice communication (AM/SSB), Ch.9 emergency, Ch.19 truckers", propagation: "Ground wave local, skip during solar max", notes: "40 channels. No license required in US. 4W AM, 12W SSB. DX skip causes interference." },
  { start: 28000, end: 29700, label: "10m", service: "amateur", color: "#c4a24e",
    details: "10 Meter Amateur Band", users: "Amateur radio (Technician+)", activities: "CW, SSB, FM repeaters (29.5+), digital, beacons, DXing, contesting", propagation: "F2 layer (solar max), sporadic E (summer), tropospheric", notes: "Wide band with all modes. Tech voice privileges above 28.3 MHz. FM repeaters at top. Incredible DX at solar max." },
  { start: 30000, end: 300000, label: "VHF", service: "utility", color: "#6b7c62",
    details: "Very High Frequency", users: "FM broadcast, TV, amateur, aviation, marine, public safety, FRS/GMRS", activities: "FM broadcasting, television, two-way radio, aviation comms", propagation: "Line of sight, tropospheric ducting, sporadic E, meteor scatter", notes: "Primarily line-of-sight with occasional enhanced propagation." },
  { start: 50000, end: 54000, label: "6m", service: "amateur", color: "#c4a24e",
    details: "6 Meter Amateur Band — 'The Magic Band'", users: "Amateur radio (Technician+)", activities: "SSB, CW, FM, digital, DXing, meteor scatter, EME", propagation: "Sporadic E (summer), F2 (solar max), tropo, meteor scatter", notes: "Called 'The Magic Band' for unpredictable openings. FT8 at 50.313. Sporadic E can open worldwide paths." },
  { start: 54000, end: 88000, label: "TV VHF-Lo", service: "broadcast", color: "#7a8c6e",
    details: "VHF Television (Low Band)", users: "TV broadcasters (Ch. 2–6)", activities: "Digital television broadcasting (ATSC 3.0)", propagation: "Line of sight + tropospheric", notes: "Channels 2–6. Many stations moved to UHF after digital transition." },
  { start: 88000, end: 108000, label: "FM Radio", service: "broadcast", color: "#7a8c6e",
    details: "FM Broadcast Band", users: "Commercial & public radio stations, LPFM", activities: "Stereo music broadcasting, HD Radio, RDS data", propagation: "Line of sight, ~100 km typical", notes: "200 channels, 200 kHz spacing. 88–92 MHz reserved for non-commercial/educational." },
  { start: 108000, end: 137000, label: "Airband", service: "aviation", color: "#5a7a8c",
    details: "VHF Aviation Band", users: "Airlines, general aviation, ATC, ATIS", activities: "Air traffic control, pilot-ATC comms, ACARS, ATIS, VOLMET", propagation: "Line of sight (extended at altitude)", notes: "AM modulation. 108–118 VOR/ILS navigation. 118–137 voice comms. 121.5 emergency. 122.75 air-to-air." },
  { start: 144000, end: 148000, label: "2m", service: "amateur", color: "#c4a24e",
    details: "2 Meter Amateur Band", users: "Amateur radio (Technician+)", activities: "FM repeaters, SSB/CW weak signal, APRS, satellite, EME, meteor scatter, digital voice", propagation: "Line of sight, tropo, sporadic E (rare), meteor scatter, EME", notes: "Most popular amateur VHF band. National calling freq 146.520 FM. APRS on 144.390. ISS on 145.800." },
  { start: 148000, end: 174000, label: "VHF Gov/Biz", service: "government", color: "#7a7a72",
    details: "VHF Government & Business Band", users: "Federal agencies, businesses, CAP, NOAA Weather Radio", activities: "Government operations, business two-way, NOAA weather broadcasts", propagation: "Line of sight", notes: "NOAA Weather Radio: 162.400–162.550. CAP on 148.150." },
  { start: 174000, end: 216000, label: "TV VHF-Hi", service: "broadcast", color: "#7a8c6e",
    details: "VHF Television (High Band)", users: "TV broadcasters (Ch. 7–13)", activities: "Digital television broadcasting", propagation: "Line of sight + tropospheric", notes: "Channels 7–13. Better propagation than UHF. Some DAB radio in other countries." },
  { start: 220000, end: 225000, label: "1.25m", service: "amateur", color: "#c4a24e",
    details: "1.25 Meter (222 MHz) Amateur Band", users: "Amateur radio (Technician+)", activities: "FM repeaters, weak signal SSB/CW, digital", propagation: "Line of sight, some tropo", notes: "Less crowded than 2m. Good for repeater linking. 222.1 calling freq." },
  { start: 300000, end: 3000000, label: "UHF", service: "utility", color: "#6b7c62",
    details: "Ultra High Frequency", users: "TV, cellular, WiFi, amateur, GPS, military, FRS/GMRS, public safety", activities: "Television, mobile phones, data, satellite, radar", propagation: "Line of sight, some tropospheric ducting", notes: "Workhorse frequencies for modern communications." },
  { start: 420000, end: 450000, label: "70cm", service: "amateur", color: "#c4a24e",
    details: "70 Centimeter Amateur Band", users: "Amateur radio (Technician+)", activities: "FM repeaters, ATV, satellite, digital voice (DMR/D-STAR/Fusion), weak signal", propagation: "Line of sight, tropo ducting", notes: "Second most popular amateur band. National simplex 446.000. Shared with government radiolocation." },
  { start: 462562, end: 467712, label: "FRS/GMRS", service: "citizens", color: "#a0784a",
    details: "Family Radio Service / GMRS", users: "General public, families, businesses, preppers", activities: "Short-range voice comms, GMRS repeaters", propagation: "Line of sight, 1–5 miles typical", notes: "FRS: no license, 2W max. GMRS: license required, up to 50W, repeaters allowed. 22 shared channels." },
  { start: 470000, end: 698000, label: "UHF TV", service: "broadcast", color: "#7a8c6e",
    details: "UHF Television Band", users: "TV broadcasters (Ch. 14–51)", activities: "Digital television (ATSC), wireless microphones (licensed)", propagation: "Line of sight", notes: "Post-incentive auction: Ch. 14–36. 600 MHz band repurposed for cellular." },
  { start: 698000, end: 960000, label: "Cellular", service: "cellular", color: "#8c5a5a",
    details: "Cellular / Mobile Broadband (700–900 MHz)", users: "AT&T, Verizon, T-Mobile, FirstNet", activities: "LTE, 5G NR, FirstNet public safety broadband", propagation: "Line of sight, good building penetration", notes: "700 MHz: post-TV auction LTE. 850 MHz: original cellular. Band 12/13/14/5/26." },
  { start: 902000, end: 928000, label: "33cm", service: "amateur", color: "#c4a24e",
    details: "33 Centimeter Amateur Band (902 MHz)", users: "Amateur radio (Technician+)", activities: "Weak signal, ATV, spread spectrum, digital, experimental", propagation: "Line of sight", notes: "Shared with ISM (industrial/scientific/medical). Used for amateur mesh networking (AREDN)." },
  { start: 960000, end: 1215000, label: "Aero Nav", service: "aviation", color: "#5a7a8c",
    details: "Aeronautical Navigation / DME / SSR", users: "Aviation, military", activities: "Distance Measuring Equipment, Secondary Surveillance Radar, TACAN, ADS-B (1090 MHz)", propagation: "Line of sight", notes: "ADS-B aircraft tracking on 1090 MHz. DME/TACAN for distance measurement." },
  { start: 1240000, end: 1300000, label: "23cm", service: "amateur", color: "#c4a24e",
    details: "23 Centimeter Amateur Band (1.2 GHz)", users: "Amateur radio (Technician+)", activities: "ATV, digital, satellite, EME, weak signal, D-STAR DD mode", propagation: "Line of sight, rain fade starts", notes: "Used for amateur television (ATV) and high-speed digital links. Shared with GPS L2." },
  { start: 1525000, end: 1559000, label: "Sat Phone", service: "satellite", color: "#5a6e8c",
    details: "Mobile Satellite Service (L-band)", users: "Iridium, Inmarsat, Globalstar users", activities: "Satellite phone calls, emergency comms, maritime safety", propagation: "Earth-satellite", notes: "Iridium: 1616–1626.5 MHz. Globalstar: 1610–1618.725 MHz. Inmarsat: 1525–1559 MHz downlink." },
  { start: 1559000, end: 1610000, label: "GPS/GNSS", service: "navigation", color: "#4a6741",
    details: "Global Navigation Satellite Systems", users: "GPS, GLONASS, Galileo, BeiDou receivers", activities: "Position, navigation, and timing (PNT)", propagation: "Satellite to ground", notes: "GPS L1 at 1575.42 MHz. Galileo E1, GLONASS G1. Critical infrastructure for modern civilization." },
  { start: 2300000, end: 2450000, label: "13cm", service: "amateur", color: "#c4a24e",
    details: "13 Centimeter Amateur Band (2.3 GHz)", users: "Amateur radio", activities: "Weak signal, ATV, digital, mesh networking", propagation: "Line of sight", notes: "Near WiFi band. Used for AREDN mesh and amateur experimentation." },
  { start: 2400000, end: 2500000, label: "WiFi 2.4G", service: "unlicensed", color: "#6e8c5a",
    details: "2.4 GHz ISM / WiFi Band", users: "Everyone — WiFi, Bluetooth, microwave ovens, Zigbee, drones", activities: "802.11b/g/n/ax WiFi, Bluetooth, IoT, cordless phones, baby monitors", propagation: "Line of sight, ~50m indoors", notes: "Most congested unlicensed band. 14 channels (11 in US), only 3 non-overlapping. ISM band." },
  { start: 3300000, end: 3800000, label: "5G C-Band", service: "cellular", color: "#8c5a5a",
    details: "C-Band 5G (3.45–3.7 GHz)", users: "T-Mobile, Verizon, AT&T", activities: "5G NR mid-band mobile broadband", propagation: "Line of sight, moderate building penetration", notes: "Auctioned 2021–2022. Key mid-band 5G spectrum. Former satellite downlink." },
  { start: 5650000, end: 5925000, label: "5cm", service: "amateur", color: "#c4a24e",
    details: "5 Centimeter Amateur Band (5.6 GHz)", users: "Amateur radio", activities: "Weak signal, ATV, digital, satellite, experimental", propagation: "Line of sight", notes: "Shared with 5 GHz WiFi/UNII. Used for amateur microwave experimentation." },
  { start: 5150000, end: 5850000, label: "WiFi 5G", service: "unlicensed", color: "#6e8c5a",
    details: "5 GHz UNII / WiFi Band", users: "WiFi routers, WISP operators, radar", activities: "802.11a/n/ac/ax WiFi, point-to-point wireless links", propagation: "Line of sight, ~30m indoors", notes: "Less congested than 2.4 GHz. DFS channels shared with weather radar. Up to 160 MHz channels." },
  { start: 5925000, end: 7125000, label: "WiFi 6E", service: "unlicensed", color: "#6e8c5a",
    details: "6 GHz Band — WiFi 6E/7", users: "WiFi 6E/7 devices, low-power indoor", activities: "802.11ax/be WiFi, AR/VR, high-throughput applications", propagation: "Line of sight, limited range", notes: "1200 MHz of new unlicensed spectrum. 59 new 20MHz channels. AFC required for outdoor use." },
  { start: 10000000, end: 10500000, label: "3cm", service: "amateur", color: "#c4a24e",
    details: "3 Centimeter Amateur Band (10 GHz)", users: "Amateur radio microwave enthusiasts", activities: "Narrowband, wideband, rain scatter, EME, beacons", propagation: "Line of sight, rain scatter!", notes: "Most popular amateur microwave band. Rain scatter provides unique propagation. 10.368 GHz calling." },
  { start: 24000000, end: 24250000, label: "1.2cm", service: "amateur", color: "#c4a24e",
    details: "1.2 Centimeter Amateur Band (24 GHz)", users: "Amateur radio microwave experimenters", activities: "Narrowband, wideband, experimental", propagation: "Line of sight, significant rain attenuation", notes: "Challenging microwave band. Shared with automotive radar." },
  { start: 24250000, end: 52600000, label: "mmWave 5G", service: "cellular", color: "#8c5a5a",
    details: "Millimeter Wave 5G (24–52 GHz)", users: "Verizon, AT&T, T-Mobile", activities: "Ultra-high-speed 5G, fixed wireless access", propagation: "Very short range, blocked by walls/foliage", notes: "Multi-Gbps speeds but very limited range. Requires dense small cell deployment. n257/n258/n260/n261 bands." },
  { start: 47000000, end: 47200000, label: "6mm", service: "amateur", color: "#c4a24e",
    details: "6 Millimeter Amateur Band (47 GHz)", users: "Amateur radio experimenters", activities: "Experimental, beacons, records attempts", propagation: "Line of sight, severe atmospheric absorption", notes: "Extremely challenging. Near oxygen absorption line. Cutting-edge amateur experimentation." },
];

const SERVICE_META = {
  amateur:    { label: "AMATEUR",     short: "HAM" },
  broadcast:  { label: "BROADCAST",   short: "BCST" },
  aviation:   { label: "AVIATION",    short: "AERO" },
  navigation: { label: "NAVIGATION",  short: "NAV" },
  cellular:   { label: "CELLULAR",    short: "CELL" },
  citizens:   { label: "PERSONAL",    short: "PERS" },
  government: { label: "GOVERNMENT",  short: "GOV" },
  satellite:  { label: "SATELLITE",   short: "SAT" },
  unlicensed: { label: "UNLICENSED",  short: "ISM" },
  utility:    { label: "GENERAL",     short: "GEN" },
};

const SERVICE_COLORS = {
  amateur: "#c4a24e", broadcast: "#7a8c6e", aviation: "#5a7a8c",
  navigation: "#4a6741", cellular: "#8c5a5a", citizens: "#a0784a",
  government: "#7a7a72", satellite: "#5a6e8c", unlicensed: "#6e8c5a",
  utility: "#6b7c62",
};

function formatFreq(khz) {
  if (khz >= 1000000) return `${(khz / 1000000).toFixed(khz % 1000000 === 0 ? 0 : 2)} GHz`;
  if (khz >= 1000) return `${(khz / 1000).toFixed(khz % 1000 === 0 ? 0 : 1)} MHz`;
  return `${khz.toFixed(khz % 1 === 0 ? 0 : 1)} kHz`;
}

function formatWavelength(khz) {
  const meters = 300000 / khz;
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  if (meters >= 1) return `${meters.toFixed(meters >= 100 ? 0 : 1)} m`;
  if (meters >= 0.01) return `${(meters * 100).toFixed(1)} cm`;
  return `${(meters * 1000).toFixed(1)} mm`;
}

const MIN_FREQ = 3;
const MAX_FREQ = 50000000;

export default function BandPlanExplorer() {
  const [viewStart, setViewStart] = useState(Math.log10(MIN_FREQ));
  const [viewEnd, setViewEnd] = useState(Math.log10(MAX_FREQ));
  const [selectedBand, setSelectedBand] = useState(null);
  const [hoveredBand, setHoveredBand] = useState(null);
  const [filterService, setFilterService] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef(null);
  const touchRef = useRef({});

  const logMin = Math.log10(MIN_FREQ);
  const logMax = Math.log10(MAX_FREQ);

  const visibleBands = useMemo(() => {
    let filtered = BANDS.filter(b => Math.log10(b.end) > viewStart && Math.log10(b.start) < viewEnd);
    if (filterService) filtered = filtered.filter(b => b.service === filterService);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        b.label.toLowerCase().includes(q) || b.details.toLowerCase().includes(q) ||
        b.users.toLowerCase().includes(q) || b.activities.toLowerCase().includes(q) ||
        (b.notes && b.notes.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [viewStart, viewEnd, filterService, searchQuery]);

  const freqToPercent = useCallback((freq) => {
    return ((Math.log10(freq) - viewStart) / (viewEnd - viewStart)) * 100;
  }, [viewStart, viewEnd]);

  const clampView = useCallback((s, e) => {
    const range = e - s;
    if (s < logMin) { s = logMin; e = s + range; }
    if (e > logMax) { e = logMax; s = e - range; }
    setViewStart(Math.max(logMin, s));
    setViewEnd(Math.min(logMax, e));
  }, [logMin, logMax]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const logAtMouse = viewStart + mx * (viewEnd - viewStart);
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    const nr = Math.max(0.15, Math.min(logMax - logMin, (viewEnd - viewStart) * factor));
    clampView(logAtMouse - mx * nr, logAtMouse + (1 - mx) * nr);
  }, [viewStart, viewEnd, logMin, logMax, clampView]);

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('[data-interactive]')) return;
    setIsDragging(true); setDragStart(e.clientX);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragStart) / rect.width;
    const range = viewEnd - viewStart;
    clampView(viewStart - dx * range, viewEnd - dx * range);
    setDragStart(e.clientX);
  }, [isDragging, dragStart, viewStart, viewEnd, clampView]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current = { dist: Math.sqrt(dx*dx+dy*dy), mid: (e.touches[0].clientX+e.touches[1].clientX)/2, sv: [viewStart, viewEnd] };
    } else if (e.touches.length === 1) {
      touchRef.current = { startX: e.touches[0].clientX, sv: [viewStart, viewEnd] };
    }
  }, [viewStart, viewEnd]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    if (e.touches.length === 2 && touchRef.current.dist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const scale = touchRef.current.dist / Math.sqrt(dx*dx+dy*dy);
      const [ss, se] = touchRef.current.sv;
      const range = se - ss;
      const midPct = (touchRef.current.mid - rect.left) / rect.width;
      const logAtMid = ss + midPct * range;
      const nr = Math.max(0.15, Math.min(logMax-logMin, range*scale));
      clampView(logAtMid - midPct*nr, logAtMid + (1-midPct)*nr);
    } else if (e.touches.length === 1 && touchRef.current.startX !== undefined) {
      const dx = (e.touches[0].clientX - touchRef.current.startX) / rect.width;
      const [ss, se] = touchRef.current.sv;
      const range = se - ss;
      clampView(ss - dx*range, se - dx*range);
    }
  }, [logMin, logMax, clampView]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => { el.removeEventListener("wheel", handleWheel); el.removeEventListener("touchmove", handleTouchMove); };
  }, [handleWheel, handleTouchMove]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const zoomTo = (start, end) => {
    const pad = (Math.log10(end) - Math.log10(start)) * 0.15;
    clampView(Math.log10(start) - pad, Math.log10(end) + pad);
  };

  const zoomPresets = [
    { label: "FULL SPECTRUM", start: MIN_FREQ, end: MAX_FREQ },
    { label: "HF", start: 3000, end: 30000 },
    { label: "VHF", start: 30000, end: 300000 },
    { label: "UHF", start: 300000, end: 3000000 },
    { label: "HAM HF", start: 1800, end: 30000 },
    { label: "MICROWAVE", start: 1000000, end: 50000000 },
  ];

  const generateTicks = () => {
    const ticks = [];
    const range = viewEnd - viewStart;
    let step = range > 4 ? 1 : range > 2 ? 0.5 : range > 1 ? 0.25 : 0.1;
    const start = Math.ceil(viewStart / step) * step;
    for (let log = start; log <= viewEnd; log += step) {
      const freq = Math.pow(10, log);
      const pct = ((log - viewStart) / (viewEnd - viewStart)) * 100;
      if (pct >= -1 && pct <= 101) ticks.push({ freq, pct, label: formatFreq(freq), major: Math.abs(log % 1) < 0.001 });
    }
    return ticks;
  };

  const ticks = generateTicks();
  const selected = selectedBand;

  return (
    <div style={{
      fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
      background: "#1e1f19",
      color: "#e8dfc6",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #2e2f28; }
        ::-webkit-scrollbar-thumb { background: #4a4b42; border: 1px solid #2e2f28; }
        .hw-btn {
          font-family: 'Courier Prime', monospace;
          font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
          padding: 4px 10px;
          background: linear-gradient(180deg, #55564e 0%, #45463f 50%, #3d3e36 100%);
          color: #b8af96;
          border: 1px solid #2a2b24;
          border-radius: 2px; cursor: pointer;
          box-shadow: 0 1px 0 rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.3);
          text-transform: uppercase; transition: all 0.1s; white-space: nowrap;
        }
        .hw-btn:hover { background: linear-gradient(180deg, #5f605a 0%, #4d4e47 50%, #44453e 100%); color: #e8dfc6; }
        .hw-btn:active { box-shadow: inset 0 1px 3px rgba(0,0,0,0.4); transform: translateY(1px); }
        .hw-btn.active {
          background: linear-gradient(180deg, #5a5030 0%, #4a4228 100%);
          color: #c4a24e; border-color: #a08838;
          box-shadow: 0 0 6px rgba(196,162,78,0.15), inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .screw {
          width: 10px; height: 10px; border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #6b6c64, #3d3e36);
          border: 1px solid #2a2b24;
          box-shadow: inset 0 0 2px rgba(0,0,0,0.4);
          position: relative; flex-shrink: 0;
        }
        .screw::after {
          content: ''; position: absolute; top: 3px; left: 2px; right: 2px; height: 1px;
          background: #2a2b24; transform: rotate(35deg);
        }
        .detail-slide { animation: htSlide 0.2s ease-out; }
        @keyframes htSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .band-bar { transition: opacity 0.12s; }
        .band-bar:hover { opacity: 1 !important; }
        input[type="text"] { font-family: 'Courier Prime', monospace; }
        input[type="text"]::placeholder { color: #8a8270; }
        input[type="text"]:focus { outline: none; border-color: #a08838 !important; }
      `}</style>

      {/* ===== TOP PANEL — brushed aluminum look ===== */}
      <header style={{
        background: `linear-gradient(180deg, #4a4b42 0%, #3d3e36 4%, #3d3e36 96%, #2e2f28 100%)`,
        borderBottom: "2px solid #1a1b15",
        padding: "12px 16px 10px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div className="screw" />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{
                fontSize: 15, fontWeight: 700, letterSpacing: "0.18em",
                color: "#e8dfc6", textShadow: "0 1px 0 rgba(0,0,0,0.5)",
              }}>RADIO FREQUENCY ALLOCATIONS</h1>
              <span style={{ fontSize: 10, color: "#8a8270", letterSpacing: "0.12em" }}>
                UNITED STATES · 3 kHz – 47 GHz
              </span>
            </div>
            <div style={{
              marginTop: 4, fontSize: 11, fontWeight: 700,
              color: "#c4a24e", letterSpacing: "0.06em",
              textShadow: "0 0 8px rgba(196,162,78,0.25)",
            }}>
              ▸ {formatFreq(Math.pow(10, viewStart))} — {formatFreq(Math.pow(10, viewEnd))}
              <span style={{ color: "#8a8270", fontWeight: 400, marginLeft: 12 }}>
                λ {formatWavelength(Math.pow(10, viewStart))} — {formatWavelength(Math.pow(10, viewEnd))}
              </span>
            </div>
          </div>
          <div className="screw" />
        </div>

        <div style={{ marginBottom: 8 }}>
          <input data-interactive type="text" placeholder="SEARCH BANDS, SERVICES, ACTIVITIES..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: "100%", padding: "6px 10px", background: "#2e2f28",
              border: "1px solid #1a1b15", borderRadius: 1, color: "#e8dfc6",
              fontSize: 11, letterSpacing: "0.05em",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
          {zoomPresets.map(p => (
            <button key={p.label} data-interactive className="hw-btn"
              onClick={() => zoomTo(p.start, p.end)}>{p.label}</button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button data-interactive className="hw-btn" style={{ padding: "4px 8px", fontSize: 14 }}
              onClick={() => { const r=viewEnd-viewStart; const m=(viewStart+viewEnd)/2; clampView(m-r*0.3, m+r*0.3); }}>+</button>
            <button data-interactive className="hw-btn" style={{ padding: "4px 8px", fontSize: 14 }}
              onClick={() => { const r=viewEnd-viewStart; const m=(viewStart+viewEnd)/2; const nr=Math.min(logMax-logMin,r*1.5); clampView(m-nr/2, m+nr/2); }}>−</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button data-interactive className={`hw-btn ${!filterService ? 'active' : ''}`}
            onClick={() => setFilterService(null)}>ALL</button>
          {Object.entries(SERVICE_META).filter(([k]) => k !== "utility").map(([key, val]) => (
            <button key={key} data-interactive className={`hw-btn ${filterService === key ? 'active' : ''}`}
              onClick={() => setFilterService(filterService === key ? null : key)}>{val.short}</button>
          ))}
        </div>
      </header>

      {/* ===== SPECTRUM DISPLAY — recessed CRT-like window ===== */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{
          flex: 1, position: "relative",
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none", overflow: "hidden", minHeight: 280,
          background: "#141510",
          borderTop: "1px solid rgba(255,255,255,0.03)",
          boxShadow: "inset 0 6px 20px rgba(0,0,0,0.6), inset 0 -6px 20px rgba(0,0,0,0.4), inset 4px 0 12px rgba(0,0,0,0.3), inset -4px 0 12px rgba(0,0,0,0.3)",
        }}
      >
        {/* CRT scan lines */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.035,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(200,190,160,0.5) 2px, rgba(200,190,160,0.5) 3px)",
        }} />
        {/* Subtle vignette */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)",
        }} />

        {/* Grid lines */}
        {ticks.map((t, i) => (
          <div key={i} style={{ position: "absolute", left: `${t.pct}%`, top: 0, bottom: 0, zIndex: 1, pointerEvents: "none" }}>
            <div style={{
              position: "absolute", top: 0, bottom: 0, width: 1,
              background: t.major
                ? "linear-gradient(180deg, rgba(138,130,112,0.1) 0%, rgba(138,130,112,0.05) 50%, rgba(138,130,112,0.1) 100%)"
                : "rgba(138,130,112,0.03)",
            }} />
            <span style={{
              position: "absolute", top: 6, left: 4,
              fontSize: 9, fontWeight: 700,
              color: t.major ? "#8a827066" : "#8a827033",
              whiteSpace: "nowrap", letterSpacing: "0.06em",
            }}>{t.label}</span>
          </div>
        ))}

        {/* Band blocks */}
        {visibleBands.map((band) => {
          const left = Math.max(0, freqToPercent(band.start));
          const right = Math.min(100, freqToPercent(band.end));
          const width = right - left;
          if (width < 0.08) return null;
          const isSelected = selected === band;
          const isHovered = hoveredBand === band;
          const isOverview = band.service === "utility";
          const color = SERVICE_COLORS[band.service];

          return (
            <div
              key={`${band.label}-${band.start}`}
              data-interactive={!isOverview ? true : undefined}
              className="band-bar"
              onClick={() => { if (!isOverview) setSelectedBand(isSelected ? null : band); }}
              onMouseEnter={() => setHoveredBand(band)}
              onMouseLeave={() => setHoveredBand(null)}
              style={{
                position: "absolute",
                left: `${left}%`, width: `${width}%`,
                top: isOverview ? 22 : 40,
                bottom: isOverview ? "auto" : 48,
                height: isOverview ? 16 : undefined,
                minWidth: 2,
                background: isOverview
                  ? `linear-gradient(180deg, ${color}08, ${color}03)`
                  : isSelected
                    ? `linear-gradient(180deg, ${color}55, ${color}18 85%, ${color}06)`
                    : `linear-gradient(180deg, ${color}30, ${color}0d 85%, ${color}04)`,
                borderTop: isOverview ? `1px solid ${color}15`
                  : `2px solid ${isSelected ? color : isHovered ? color+'bb' : color+'77'}`,
                borderLeft: isOverview ? "none" : `1px solid ${color}10`,
                borderRight: isOverview ? "none" : `1px solid ${color}10`,
                cursor: isOverview ? "default" : "pointer",
                zIndex: isOverview ? 0 : isSelected ? 20 : isHovered ? 15 : 5,
                opacity: isOverview ? 1 : isSelected ? 1 : isHovered ? 1 : 0.85,
                display: "flex", alignItems: isOverview ? "center" : "flex-start",
                justifyContent: "center", overflow: "hidden",
                boxShadow: isSelected ? `0 0 16px ${color}18, inset 0 0 24px ${color}08` : "none",
              }}
            >
              {width > (isOverview ? 4 : 2.5) && (
                <span style={{
                  fontSize: isOverview ? 8 : width > 6 ? 11 : 9,
                  fontWeight: 700,
                  color: isOverview ? `${color}44` : isSelected ? "#e8dfc6" : color,
                  padding: isOverview ? "0 4px" : "5px 4px",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  letterSpacing: "0.08em",
                  textShadow: isSelected ? `0 0 10px ${color}55` : "none",
                }}>{band.label}</span>
              )}
            </div>
          );
        })}

        {/* Hover readout */}
        {hoveredBand && !selectedBand && hoveredBand.service !== "utility" && (
          <div style={{
            position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)",
            background: "#2e2f28ee", border: "1px solid #4a4b42",
            padding: "5px 14px", fontSize: 11, fontWeight: 700,
            color: "#b8af96", whiteSpace: "nowrap", zIndex: 50, pointerEvents: "none",
            letterSpacing: "0.04em", boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}>
            <span style={{ color: SERVICE_COLORS[hoveredBand.service] }}>{hoveredBand.label}</span>
            {"  ·  "}{formatFreq(hoveredBand.start)} – {formatFreq(hoveredBand.end)}
            {"  ·  λ "}{formatWavelength((hoveredBand.start + hoveredBand.end) / 2)}
          </div>
        )}

        {/* Bottom ruler */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 42,
          borderTop: "1px solid rgba(138,130,112,0.08)",
          background: "linear-gradient(180deg, transparent, rgba(46,47,40,0.4))",
          zIndex: 30, pointerEvents: "none",
        }}>
          {ticks.map((t, i) => (
            <div key={i} style={{ position: "absolute", left: `${t.pct}%`, bottom: 0, height: "100%" }}>
              <div style={{
                position: "absolute", bottom: 16, width: 1,
                height: t.major ? 12 : 6,
                background: t.major ? "#8a8270" : "#8a827044",
              }} />
              {t.major && (
                <span style={{
                  position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)",
                  fontSize: 9, fontWeight: 700, color: "#8a8270",
                  whiteSpace: "nowrap", letterSpacing: "0.06em",
                }}>{t.label}</span>
              )}
            </div>
          ))}
        </div>

        {/* Instructions */}
        {!selectedBand && !hoveredBand && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            textAlign: "center", color: "#8a8270", fontSize: 11, pointerEvents: "none", zIndex: 2,
            letterSpacing: "0.06em", opacity: 0.5,
          }}>
            <div style={{ fontSize: 20, marginBottom: 6, opacity: 0.7 }}>⟷</div>
            <div>SCROLL TO ZOOM · DRAG TO PAN · TAP BAND FOR DETAILS</div>
            <div style={{ marginTop: 4, fontSize: 9, opacity: 0.5 }}>PINCH TO ZOOM ON MOBILE</div>
          </div>
        )}
      </div>

      {/* ===== DETAIL PANEL ===== */}
      {selected && (() => {
        const sc = SERVICE_COLORS[selected.service];
        return (
          <div className="detail-slide" style={{
            background: `linear-gradient(180deg, #3d3e36 0%, #2e2f28 100%)`,
            borderTop: `2px solid ${sc}`,
            padding: "14px 16px", maxHeight: "48vh", overflowY: "auto",
            boxShadow: "inset 0 4px 12px rgba(0,0,0,0.3)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h2 style={{
                  fontSize: 14, fontWeight: 700, color: "#e8dfc6",
                  letterSpacing: "0.1em", textShadow: "0 1px 0 rgba(0,0,0,0.5)", marginBottom: 4,
                }}>{selected.details.toUpperCase()}</h2>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "#b8af96", letterSpacing: "0.04em" }}>
                  <span style={{ color: "#c4a24e", fontWeight: 700 }}>
                    {formatFreq(selected.start)} – {formatFreq(selected.end)}
                  </span>
                  <span>λ {formatWavelength((selected.start + selected.end) / 2)}</span>
                  <span style={{
                    padding: "1px 8px", background: `${sc}20`, color: sc,
                    fontWeight: 700, fontSize: 10, letterSpacing: "0.08em",
                  }}>{SERVICE_META[selected.service]?.label}</span>
                </div>
              </div>
              <button data-interactive className="hw-btn" onClick={() => setSelectedBand(null)}
                style={{ padding: "3px 8px", fontSize: 12 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
              <DCard label="OPERATORS & USERS" text={selected.users} accent={sc} />
              <DCard label="ACTIVITIES & MODES" text={selected.activities} accent={sc} />
              <DCard label="PROPAGATION" text={selected.propagation} accent={sc} />
              {selected.notes && <DCard label="NOTES" text={selected.notes} accent={sc} />}
            </div>
            <button data-interactive className="hw-btn active" onClick={() => zoomTo(selected.start, selected.end)}
              style={{ marginTop: 10 }}>▸ ZOOM TO BAND</button>
          </div>
        );
      })()}

      {/* ===== FOOTER ===== */}
      <footer style={{
        background: "#3d3e36", borderTop: "1px solid #4a4b42",
        padding: "6px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
        boxShadow: "0 -2px 8px rgba(0,0,0,0.2)",
      }}>
        <div className="screw" style={{ width: 8, height: 8 }} />
        <span style={{ fontSize: 9, color: "#8a8270", letterSpacing: "0.14em", fontWeight: 700 }}>
          {visibleBands.filter(b => b.service !== "utility").length} ALLOCATIONS IN VIEW
        </span>
        <div className="screw" style={{ width: 8, height: 8 }} />
      </footer>
    </div>
  );
}

function DCard({ label, text, accent }) {
  return (
    <div style={{
      background: "#2e2f28", border: "1px solid #1a1b15",
      padding: "8px 10px", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: "0.12em", marginBottom: 5, opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#b8af96", lineHeight: 1.55 }}>{text}</div>
    </div>
  );
}
