import { useId } from 'react'

// NovaWallet logo mark (pulse-bars "N") — vector recreation of the chosen
// logo artwork so it stays crisp at every size, from favicon to lock screen.
// NOTE: gradient/clip ids MUST be unique per instance (useId). With shared
// ids, the first instance in the DOM — the desktop sidebar Logo, which is
// display:none on phones — owns the defs, and references into a display:none
// subtree fail on mobile Chrome: the visible logo renders as an empty tile.
export default function LogoMark({ size = 34, className = '' }: { size?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const tile = `nw-tile-${uid}`, bars = `nw-bars-${uid}`, shade = `nw-shade-${uid}`, clip = `nw-clip-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="NovaWallet">
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d2042" />
          <stop offset="100%" stopColor="#101223" />
        </linearGradient>
        <linearGradient id={bars} gradientUnits="userSpaceOnUse" x1="8" y1="0" x2="92" y2="0">
          <stop offset="0%" stopColor="#9b30ff" />
          <stop offset="45%" stopColor="#7a5cff" />
          <stop offset="62%" stopColor="#5f74fc" />
          <stop offset="100%" stopColor="#1ed2f8" />
        </linearGradient>
        <linearGradient id={shade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="42%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>
        <clipPath id={clip}>
        <rect x="10.0" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="13.5" y="10.4" width="2.2" height="79.2" rx="1.1" />
        <rect x="16.8" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="20.3" y="10.4" width="2.2" height="79.2" rx="1.1" />
        <rect x="23.8" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="27.1" y="10.4" width="2.2" height="79.2" rx="1.1" />
        <rect x="30.7" y="10.4" width="2.2" height="33.2" rx="1.1" />
        <rect x="34.2" y="12.5" width="2.2" height="35.5" rx="1.1" />
        <rect x="37.5" y="16.8" width="2.2" height="35.5" rx="1.1" />
        <rect x="40.4" y="20.7" width="2.2" height="35.4" rx="1.1" />
        <rect x="43.0" y="24.0" width="2.2" height="36.2" rx="1.1" />
        <rect x="46.3" y="27.7" width="2.2" height="36.6" rx="1.1" />
        <rect x="49.4" y="31.8" width="2.2" height="36.8" rx="1.1" />
        <rect x="52.9" y="36.3" width="2.2" height="36.9" rx="1.1" />
        <rect x="56.6" y="41.0" width="2.2" height="36.9" rx="1.1" />
        <rect x="60.2" y="45.3" width="2.2" height="36.7" rx="1.1" />
        <rect x="63.7" y="50.4" width="2.2" height="36.3" rx="1.1" />
        <rect x="67.0" y="54.7" width="2.2" height="34.9" rx="1.1" />
        <rect x="70.5" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="73.8" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="77.3" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="80.9" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="84.4" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="87.7" y="10.2" width="2.2" height="79.4" rx="1.1" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="100" height="100" rx="22" fill={`url(#${tile})`} />
      <g fill={`url(#${bars})`}>
        <rect x="10.0" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="13.5" y="10.4" width="2.2" height="79.2" rx="1.1" />
        <rect x="16.8" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="20.3" y="10.4" width="2.2" height="79.2" rx="1.1" />
        <rect x="23.8" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="27.1" y="10.4" width="2.2" height="79.2" rx="1.1" />
        <rect x="30.7" y="10.4" width="2.2" height="33.2" rx="1.1" />
        <rect x="34.2" y="12.5" width="2.2" height="35.5" rx="1.1" />
        <rect x="37.5" y="16.8" width="2.2" height="35.5" rx="1.1" />
        <rect x="40.4" y="20.7" width="2.2" height="35.4" rx="1.1" />
        <rect x="43.0" y="24.0" width="2.2" height="36.2" rx="1.1" />
        <rect x="46.3" y="27.7" width="2.2" height="36.6" rx="1.1" />
        <rect x="49.4" y="31.8" width="2.2" height="36.8" rx="1.1" />
        <rect x="52.9" y="36.3" width="2.2" height="36.9" rx="1.1" />
        <rect x="56.6" y="41.0" width="2.2" height="36.9" rx="1.1" />
        <rect x="60.2" y="45.3" width="2.2" height="36.7" rx="1.1" />
        <rect x="63.7" y="50.4" width="2.2" height="36.3" rx="1.1" />
        <rect x="67.0" y="54.7" width="2.2" height="34.9" rx="1.1" />
        <rect x="70.5" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="73.8" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="77.3" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="80.9" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="84.4" y="10.2" width="2.2" height="79.4" rx="1.1" />
        <rect x="87.7" y="10.2" width="2.2" height="79.4" rx="1.1" />
      </g>
      <g clipPath={`url(#${clip})`}>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${shade})`} />
      </g>
    </svg>
  )
}
