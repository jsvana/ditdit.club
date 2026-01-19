// Parse PSKReporter XML response into spot format
export const parsePskReporterXml = (xmlText) => {
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
