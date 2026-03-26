"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

export type HeroMoveSpark = {
  id: number;
  x: number;
  y: number;
  color: string;
};

export type HeroBurstSpark = {
  id: number;
  x: number;
  y: number;
  color: string;
  dx: number;
  dy: number;
  size: number;
};

const HERO_SPARK_COLORS = [
  "rgba(255,255,255,0.38)",
  "rgba(165,243,252,0.34)",
  "rgba(253,224,71,0.32)",
  "rgba(196,181,253,0.28)",
  "rgba(45,212,191,0.3)",
  "rgba(251,191,36,0.28)",
] as const;

const MOVE_STAR_SIZE = 6;
const BURST_COUNT = 10;
const MOVE_THROTTLE_MS = 96;
const MOVE_SPARK_CAP = 12;
const BURST_SPARK_CAP = 40;

const SparkleStarSvg = ({
  color,
  size,
  className = "",
}: {
  color: string;
  size: number;
  className?: string;
}) => (
  <svg
    className={`pointer-events-none ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden
    style={{
      marginLeft: -(size / 2),
      marginTop: -(size / 2),
      filter: `drop-shadow(0 0 ${Math.max(2, size * 0.35)}px ${color})`,
      opacity: 0.78,
    }}
  >
    <path
      fill={color}
      d="M12 1.5l2.8 7.2 7.7.6-5.9 4.9 1.9 7.5L12 18.2 6.5 21.7l1.9-7.5-5.9-4.9 7.7-.6L12 1.5z"
    />
  </svg>
);

const shouldIgnoreBurstTarget = (el: EventTarget | null) => {
  if (!el || !(el instanceof HTMLElement)) return false;
  return Boolean(el.closest("a,button,input,select,textarea,[role='button']"));
};

/**
 * Hero-only particles: native mousemove + click on the hero element via useEffect (cleanup on unmount).
 * Pass the same node you set with `ref={setHeroRoot}` so the effect re-runs when the element mounts.
 */
export const useHallOfFameHeroParticles = (heroEl: HTMLDivElement | null) => {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [moveSparks, setMoveSparks] = useState<HeroMoveSpark[]>([]);
  const [burstSparks, setBurstSparks] = useState<HeroBurstSpark[]>([]);
  const lastMoveTs = useRef(0);
  const seq = useRef(0);
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = heroEl;
    if (!el) return;

    const handleMove = (e: MouseEvent) => {
      if (reduceMotionRef.current) return;
      const now = performance.now();
      if (now - lastMoveTs.current < MOVE_THROTTLE_MS) return;
      lastMoveTs.current = now;

      const rect = el.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;
      const jitterX = ((Math.random() - 0.5) * 2.5) / w * 100;
      const jitterY = ((Math.random() - 0.5) * 2.5) / h * 100;
      const x = ((e.clientX - rect.left) / w) * 100 + jitterX;
      const y = ((e.clientY - rect.top) / h) * 100 + jitterY;

      const id = ++seq.current;
      const color = HERO_SPARK_COLORS[id % HERO_SPARK_COLORS.length];
      setMoveSparks((prev) => [...prev.slice(-(MOVE_SPARK_CAP - 1)), { id, x, y, color }]);

      window.setTimeout(() => {
        setMoveSparks((prev) => prev.filter((s) => s.id !== id));
      }, 560);
    };

    const handleClick = (e: MouseEvent) => {
      if (reduceMotionRef.current) return;
      if (shouldIgnoreBurstTarget(e.target)) return;

      const rect = el.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;
      const cx = ((e.clientX - rect.left) / w) * 100;
      const cy = ((e.clientY - rect.top) / h) * 100;

      const next: HeroBurstSpark[] = [];
      for (let i = 0; i < BURST_COUNT; i++) {
        const id = ++seq.current;
        const angle = (Math.PI * 2 * i) / BURST_COUNT + (Math.random() - 0.5) * 0.35;
        const dist = 20 + Math.random() * 26;
        next.push({
          id,
          x: cx + (Math.random() - 0.5) * 1.2,
          y: cy + (Math.random() - 0.5) * 1.2,
          color: HERO_SPARK_COLORS[id % HERO_SPARK_COLORS.length],
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          size: 5 + Math.floor(Math.random() * 4),
        });
      }

      setBurstSparks((prev) => [...prev, ...next].slice(-BURST_SPARK_CAP));

      const toRemove = next.map((p) => p.id);
      window.setTimeout(() => {
        setBurstSparks((prev) => prev.filter((p) => !toRemove.includes(p.id)));
      }, 580);
    };

    el.addEventListener("mousemove", handleMove, { passive: true });
    el.addEventListener("click", handleClick);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("click", handleClick);
    };
  }, [heroEl]);

  return { moveSparks, burstSparks };
};

type LayerProps = {
  moveSparks: HeroMoveSpark[];
  burstSparks: HeroBurstSpark[];
};

export const HallOfFameHeroParticleLayer = ({ moveSparks, burstSparks }: LayerProps) => (
  <div
    className="pointer-events-none absolute inset-0 z-[3] overflow-hidden rounded-[inherit]"
    aria-hidden
  >
    {moveSparks.map((s) => (
      <span key={`hm-${s.id}`} className="absolute" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
        <SparkleStarSvg color={s.color} size={MOVE_STAR_SIZE} className="hof-cursor-sparkle" />
      </span>
    ))}
    {burstSparks.map((s) => (
      <span
        key={`hb-${s.id}`}
        className="hof-burst-sparkle absolute"
        style={
          {
            left: `${s.x}%`,
            top: `${s.y}%`,
            "--hof-dx": `${s.dx}px`,
            "--hof-dy": `${s.dy}px`,
          } as CSSProperties
        }
      >
        <SparkleStarSvg color={s.color} size={s.size} />
      </span>
    ))}
  </div>
);
