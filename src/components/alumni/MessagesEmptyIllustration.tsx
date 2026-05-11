"use client";

const MessagesEmptyIllustration = ({ className = "h-32 w-full max-w-[200px]" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <defs>
      <linearGradient id="msg-g" x1="20" y1="20" x2="180" y2="120" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1e3a8a" stopOpacity="0.2" />
        <stop offset="1" stopColor="#38bdf8" stopOpacity="0.15" />
      </linearGradient>
    </defs>
    <rect x="16" y="24" width="168" height="92" rx="18" fill="url(#msg-g)" />
    <rect x="36" y="44" width="88" height="10" rx="5" fill="#1e3a8a" opacity="0.2" />
    <rect x="36" y="62" width="120" height="8" rx="4" fill="#64748b" opacity="0.2" />
    <circle cx="152" cy="56" r="18" fill="#1e3a8a" opacity="0.25" />
    <path d="M52 96 L100 96 L76 118 Z" fill="#d4af37" opacity="0.35" />
  </svg>
);

export default MessagesEmptyIllustration;
