// Smooth wave divider for the auth pages.
// Period = 300 viewBox units = one animation cycle (0→300), so the loop is seamless.
// Center x=60, amplitude ±45 (range 15–105) in a 120px-wide container.

const WAVE =
  'M 60 -300 ' +
  'C 105 -210, 15 -90, 60 0 ' +
  'C 105 90,   15 210, 60 300 ' +
  'C 105 390,  15 510, 60 600 ' +
  'C 105 690,  15 810, 60 900 ' +
  'C 105 990,  15 1110, 60 1200'

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
