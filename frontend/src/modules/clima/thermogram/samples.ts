// Reading a measured/forecast pair of series at one sample.

/** Value at sample i: the measured value up to now, the forecast after (both are set at nowIndex). */
export function sampleAt(
  measured: readonly (number | null)[],
  forecast: readonly (number | null)[],
  i: number,
): number | null {
  return measured[i] ?? forecast[i] ?? null;
}
