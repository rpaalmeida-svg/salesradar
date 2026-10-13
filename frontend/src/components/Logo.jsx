// Logótipo SalesRadar: ecrã de radar com varrimento e um "blip" — SVG, escala a qualquer tamanho.
export default function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="SalesRadar">
      <defs>
        <linearGradient id="srg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#667eea" />
          <stop offset="1" stopColor="#764ba2" />
        </linearGradient>
        <linearGradient id="srs" x1="16" y1="16" x2="30" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#667eea" stopOpacity="0.55" />
          <stop offset="1" stopColor="#667eea" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#srg)" />
      {/* varrimento */}
      <path d="M16 16 L16 4 A12 12 0 0 1 27.4 11.6 Z" fill="white" fillOpacity="0.28" />
      {/* anéis */}
      <circle cx="16" cy="16" r="12" stroke="white" strokeOpacity="0.85" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="7.5" stroke="white" strokeOpacity="0.55" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="3" stroke="white" strokeOpacity="0.4" strokeWidth="1" />
      {/* eixos */}
      <path d="M16 4 V28 M4 16 H28" stroke="white" strokeOpacity="0.35" strokeWidth="1" />
      {/* linha de varrimento */}
      <path d="M16 16 L27.4 11.6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      {/* blips */}
      <circle cx="21.5" cy="10.5" r="1.9" fill="#34d399" />
      <circle cx="11" cy="20.5" r="1.4" fill="white" fillOpacity="0.9" />
      <circle cx="16" cy="16" r="1.3" fill="white" />
    </svg>
  );
}
