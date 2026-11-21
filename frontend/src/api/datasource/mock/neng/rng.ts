// Verbatim port of the mockup's Park-Miller generator (Neng.js `rng`).
export function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
