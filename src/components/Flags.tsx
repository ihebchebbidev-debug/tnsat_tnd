const FlagFR = ({ className = "h-4 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 900 600" className={className} aria-hidden="true">
    <rect width="300" height="600" fill="#002395" />
    <rect x="300" width="300" height="600" fill="#ffffff" />
    <rect x="600" width="300" height="600" fill="#ED2939" />
  </svg>
);

const FlagEN = ({ className = "h-4 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 60 30" className={className} aria-hidden="true">
    <clipPath id="s"><path d="M0,0 v30 h60 v-30 z"/></clipPath>
    <clipPath id="t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>
    <g clipPath="url(#s)">
      <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
    </g>
  </svg>
);

const FlagAR = ({ className = "h-4 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 900 600" className={className} aria-hidden="true">
    <rect width="900" height="200" fill="#E70013" />
    <rect y="200" width="900" height="200" fill="#ffffff" />
    <rect y="400" width="900" height="200" fill="#000000" />
  </svg>
);

export { FlagFR, FlagEN, FlagAR };
