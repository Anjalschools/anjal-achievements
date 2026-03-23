/**
 * Static twinkling stars in the Hall of Fame hero (always on, subtle).
 * Sits above background, below text. pointer-events-none.
 */

type SparkleSpec = {
  top: string;
  left: string;
  size: number;
  delay: number;
  duration: number;
  variant: "twinkle" | "glow";
  /** Soft tints — readable on dark hero */
  color: string;
};

const SPARKLES: SparkleSpec[] = [
  { top: "8%", left: "10%", size: 4, delay: 0, duration: 3.4, variant: "twinkle", color: "rgba(255,255,255,0.95)" },
  { top: "14%", left: "24%", size: 3, delay: 0.3, duration: 4.0, variant: "twinkle", color: "rgba(253,224,71,0.9)" },
  { top: "20%", left: "76%", size: 3, delay: 1.0, duration: 3.2, variant: "twinkle", color: "rgba(165,243,252,0.88)" },
  { top: "11%", left: "90%", size: 4, delay: 0.15, duration: 4.6, variant: "glow", color: "rgba(45,212,191,0.85)" },
  { top: "30%", left: "6%", size: 3, delay: 0.7, duration: 3.8, variant: "twinkle", color: "rgba(255,255,255,0.85)" },
  { top: "36%", left: "46%", size: 3, delay: 1.5, duration: 4.2, variant: "twinkle", color: "rgba(251,191,36,0.82)" },
  { top: "44%", left: "86%", size: 4, delay: 0.45, duration: 5.0, variant: "glow", color: "rgba(165,243,252,0.8)" },
  { top: "54%", left: "14%", size: 3, delay: 2.0, duration: 3.4, variant: "twinkle", color: "rgba(255,255,255,0.9)" },
  { top: "60%", left: "54%", size: 3, delay: 1.1, duration: 3.9, variant: "twinkle", color: "rgba(253,224,71,0.75)" },
  { top: "68%", left: "70%", size: 3, delay: 0.85, duration: 3.6, variant: "twinkle", color: "rgba(45,212,191,0.78)" },
  { top: "74%", left: "30%", size: 4, delay: 1.7, duration: 5.1, variant: "glow", color: "rgba(255,255,255,0.88)" },
  { top: "80%", left: "50%", size: 3, delay: 0.25, duration: 4.4, variant: "twinkle", color: "rgba(165,243,252,0.82)" },
  { top: "86%", left: "20%", size: 3, delay: 2.2, duration: 3.5, variant: "twinkle", color: "rgba(251,191,36,0.8)" },
  { top: "24%", left: "60%", size: 3, delay: 1.3, duration: 3.7, variant: "twinkle", color: "rgba(255,255,255,0.82)" },
  { top: "40%", left: "34%", size: 3, delay: 1.9, duration: 4.1, variant: "twinkle", color: "rgba(165,243,252,0.78)" },
  { top: "50%", left: "94%", size: 3, delay: 0.55, duration: 4.0, variant: "twinkle", color: "rgba(253,224,71,0.85)" },
];

const HallOfFameHeroSparkles = () => (
  <div
    className="pointer-events-none absolute inset-0 z-[3] overflow-hidden rounded-[inherit]"
    aria-hidden
  >
    {SPARKLES.map((s, i) => {
      const name = s.variant === "glow" ? "hof-glow-pulse" : "hof-twinkle";
      return (
        <span
          key={i}
          className="hof-sparkle absolute rounded-full shadow-[0_0_10px_rgba(255,255,255,0.35)]"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            background: `radial-gradient(circle, ${s.color} 0%, transparent 70%)`,
            animation: `${name} ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      );
    })}
  </div>
);

export default HallOfFameHeroSparkles;
