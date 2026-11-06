export function CatPortrait({ color, className = '' }: { color: string; className?: string }) {
  return <svg className={className} viewBox="0 0 180 170" fill="none" aria-hidden="true">
    <ellipse cx="89" cy="150" rx="53" ry="9" fill="#45553b" opacity=".09" />
    <path d="M132 123q32 8 26-20" stroke={color} strokeWidth="14" strokeLinecap="round" />
    <path d="M43 76 39 29q0-5 5-2l30 21q16-4 31 0l29-22q5-3 5 3l-2 48c25 67-5 74-46 74S17 142 43 76Z" fill={color} />
    <path d="m47 40 4 26 15-11Z" fill="#fff" opacity=".35" />
    <path d="m130 40-4 26-15-11Z" fill="#fff" opacity=".35" />
    <ellipse cx="90" cy="126" rx="28" ry="18" fill="#fff" opacity=".18" />
    <ellipse cx="67" cy="90" rx="3.5" ry="5" fill="#4b4c43" />
    <ellipse cx="111" cy="90" rx="3.5" ry="5" fill="#4b4c43" />
    <ellipse cx="55" cy="103" rx="8" ry="4" fill="#ce8f86" opacity=".4" />
    <ellipse cx="124" cy="103" rx="8" ry="4" fill="#ce8f86" opacity=".4" />
    <path d="m86 102 4 3 4-3m-4 3q-6 9-11 2m11-2q6 9 11 2" stroke="#4b4c43" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M66 142v7m46-7v7" stroke="#4b4c43" strokeOpacity=".17" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

