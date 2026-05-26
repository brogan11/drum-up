// Two cubics per period (one right bump, one left bump) — mathematically symmetric.
// Period = 300, half-period = 150.
// Control points sit 50 units in from each segment endpoint (1/3 of 150).
// Center x=60, CPs at x=90 (right) and x=30 (left) — gentle amplitude ±22.5.

const WAVE =
  'M 60 -300 ' +
  'C 90 -250, 90 -200, 60 -150 ' +
  'C 30 -100, 30 -50, 60 0 ' +
  'C 90 50, 90 100, 60 150 ' +
  'C 30 200, 30 250, 60 300 ' +
  'C 90 350, 90 400, 60 450 ' +
  'C 30 500, 30 550, 60 600 ' +
  'C 90 650, 90 700, 60 750 ' +
  'C 30 800, 30 850, 60 900 ' +
  'C 90 950, 90 1000, 60 1050 ' +
  'C 30 1100, 30 1150, 60 1200'

export function WaveDivider() {
  return (
    <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-0 h-full z-20 pointer-events-none" style={{ width: '120px' }}>
      <svg
        viewBox="0 0 120 900"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Right side — cream fill */}
        <path d={`${WAVE} L 120 1200 L 120 -300 Z`} fill="#E8E4E0">
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 300" dur="8s" repeatCount="indefinite" />
        </path>
        {/* Left side — graphite fill */}
        <path d={`${WAVE} L 0 1200 L 0 -300 Z`} fill="#333333">
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 300" dur="8s" repeatCount="indefinite" />
        </path>
        {/* Chestnut accent line */}
        <path d={WAVE} fill="none" stroke="#DC7F41" strokeWidth="2.5" strokeLinecap="round">
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 300" dur="8s" repeatCount="indefinite" />
        </path>
      </svg>
    </div>
  )
}
