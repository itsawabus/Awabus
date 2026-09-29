// Rough box around Ghana with a little margin at the borders. Positions
// outside it are refused: they are GPS glitches or made-up values.
export const GHANA_BOUNDS = { minLat: 4.3, maxLat: 11.5, minLng: -3.6, maxLng: 1.5 };

export const inGhana = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= GHANA_BOUNDS.minLat &&
  lat <= GHANA_BOUNDS.maxLat &&
  lng >= GHANA_BOUNDS.minLng &&
  lng <= GHANA_BOUNDS.maxLng;
