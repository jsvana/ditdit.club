// Get color for MUF value based on which band it supports
export const getMufColor = (mufd) => {
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

export const getMufBand = (mufd) => {
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
