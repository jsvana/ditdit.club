export const getSunPosition = (date = new Date()) => {
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const declination = -23.45 * Math.cos((360/365) * (dayOfYear + 10) * Math.PI / 180);
  const hourUTC = date.getUTCHours() + date.getUTCMinutes() / 60;
  const longitude = (12 - hourUTC) * 15;
  return { lat: declination, lon: longitude };
};

export const getTerminatorPath = (sunPos, numPoints = 100) => {
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
