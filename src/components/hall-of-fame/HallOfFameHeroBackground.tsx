/**
 * Layered gradient + pattern + vignette for Hall of Fame hero only.
 * Purely decorative; no external image assets.
 */
const HallOfFameHeroBackground = () => (
  <div
    className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
    aria-hidden
  >
    {/* Deep base: ink navy → royal → teal depth */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#01040c] via-[#0a1f38] to-[#0c4a6e]" />
    {/* Cobalt sweep */}
    <div className="absolute inset-0 bg-gradient-to-tl from-[#172554]/90 via-[#1e3a8a]/35 to-transparent" />
    {/* Royal band */}
    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[#1d4ed8]/20 to-[#0e7490]/30" />
    {/* Cyan mist — upper area */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_65%_at_12%_8%,rgba(34,211,238,0.16),transparent_60%)]" />
    {/* Teal haze — mid */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_55%_45%,rgba(20,184,166,0.08),transparent_55%)]" />
    {/* Gold whisper — corner */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_50%_at_92%_90%,rgba(212,175,55,0.14),transparent_58%)]" />
    {/* Bottom depth pool */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_110%_50%_at_50%_115%,rgba(2,6,23,0.92),transparent_55%)]" />
    {/* Plus-grid — softer */}
    <div
      className="absolute inset-0 opacity-[0.038]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}
    />
    {/* Soft top highlight */}
    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-transparent" />
    {/* Vignette — readability; lighter than before so stars read better */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_88%_78%_at_50%_42%,transparent_0%,rgba(1,4,12,0.42)_100%)]" />
    <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
  </div>
);

export default HallOfFameHeroBackground;
