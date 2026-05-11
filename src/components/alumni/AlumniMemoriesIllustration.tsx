"use client";

/** Lightweight inline illustration for empty states & memories card (no external assets). */
const AlumniMemoriesIllustration = ({ className = "h-28 w-full" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <defs>
      <linearGradient id="am-g1" x1="0" y1="0" x2="200" y2="120" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1e3a8a" stopOpacity="0.25" />
        <stop offset="1" stopColor="#d4af37" stopOpacity="0.2" />
      </linearGradient>
      <linearGradient id="am-g2" x1="40" y1="20" x2="160" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38bdf8" stopOpacity="0.35" />
        <stop offset="1" stopColor="#1e3a8a" stopOpacity="0.45" />
      </linearGradient>
    </defs>
    <rect x="8" y="12" width="184" height="96" rx="16" fill="url(#am-g1)" />
    <rect x="28" y="28" width="64" height="48" rx="8" fill="url(#am-g2)" stroke="#fff" strokeWidth="2" opacity="0.9" />
    <rect x="108" y="36" width="56" height="8" rx="4" fill="#fff" opacity="0.5" />
    <rect x="108" y="52" width="40" height="8" rx="4" fill="#fff" opacity="0.35" />
    <circle cx="168" cy="34" r="14" fill="#d4af37" opacity="0.35" />
    <circle cx="44" cy="92" r="6" fill="#1e3a8a" opacity="0.3" />
    <circle cx="152" cy="88" r="10" fill="#38bdf8" opacity="0.25" />
  </svg>
);

export default AlumniMemoriesIllustration;
