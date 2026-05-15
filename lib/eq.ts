// Deterministic hash-based "random" so SSR and client match.
export function rand(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function eqBarStyle(i: number, seed: number) {
  const height = 18 + rand(i, seed) * 75          // 18% – 93%
  const duration = 0.7 + rand(i, seed + 1) * 1.6  // 0.7s – 2.3s
  const delay = rand(i, seed + 2) * -2.3          // negative = pre-staggered, no startup pop
  return {
    height: `${height.toFixed(1)}%`,
    animationDuration: `${duration.toFixed(2)}s`,
    animationDelay: `${delay.toFixed(2)}s`,
  }
}
