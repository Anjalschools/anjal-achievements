"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";

export type HallPageMoveSpark = {
  id: number;
  x: number;
  y: number;
  color: string;
};

export type HallPageBurstSpark = {
  id: number;
  x: number;
  y: number;
  color: string;
  dx: number;
  dy: number;
  size: number;
};

/** Saturated colors — readable on white / light gray page background */
const SPARK_COLORS = [
  "rgba(234, 179, 8, 0.95)",
  "rgba(251, 191, 36, 0.92)",
  "rgba(59, 130, 246, 0.88)",
  "rgba(14, 165, 233, 0.9)",
  "rgba(20, 184, 166, 0.88)",
  "rgba(167, 139, 250, 0.85)",
  "rgba(244, 114, 182, 0.75)",
] as const;

const MOVE_STAR_SIZE = 15;
const BURST_MIN = 12;
const BURST_MAX = 18;

/** Sparkle star SVG — size in px */
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
      filter: `drop-shadow(0 0 ${Math.max(4, size * 0.28)}px ${color})`,
    }}
  >
    <path
      fill={color}
      d="M12 1.5l2.8 7.2 7.7.6-5.9 4.9 1.9 7.5L12 18.2 6.5 21.7l1.9-7.5-5.9-4.9 7.7-.6L12 1.5z"
    />
  </svg>
);

/**
 * Trail sparkles on move + burst on pointer down (Hall of Fame page only).
 */
export const useHallOfFamePageCursorSparkles = () => {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [moveSparks, setMoveSparks] = useState<HallPageMoveSpark[]>([]);
  const [burstSparks, setBurstSparks] = useState<HallPageBurstSpark[]>([]);
  const lastMoveTs = useRef(0);
  const seq = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const onPagePointerMove = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (reduceMotion) return;
      const now = performance.now();
      if (now - lastMoveTs.current < 80) return;
      lastMoveTs.current = now;

      const rect = e.currentTarget.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;
      const jitterX = ((Math.random() - 0.5) * 3) / w * 100;
      const jitterY = ((Math.random() - 0.5) * 3) / h * 100;
      const x = ((e.clientX - rect.left) / w) * 100 + jitterX;
      const y = ((e.clientY - rect.top) / h) * 100 + jitterY;

      const id = ++seq.current;
      const color = SPARK_COLORS[id % SPARK_COLORS.length];
      setMoveSparks((prev) => [...prev.slice(-14), { id, x, y, color }]);

      window.setTimeout(() => {
        setMoveSparks((prev) => prev.filter((s) => s.id !== id));
      }, 600);
    },
    [reduceMotion]
  );

  const onPagePointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (reduceMotion) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "BUTTON" || tag === "TEXTAREA") return;

      const rect = e.currentTarget.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;
      const cx = ((e.clientX - rect.left) / w) * 100;
      const cy = ((e.clientY - rect.top) / h) * 100;

      const count = 11;
      const next: HallPageBurstSpark[] = [];
      for (let i = 0; i < count; i++) {
        const id = ++seq.current;
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const dist = 28 + Math.random() * 36;
        next.push({
          id,
          x: cx + (Math.random() - 0.5) * 1.5,
          y: cy + (Math.random() - 0.5) * 1.5,
          color: SPARK_COLORS[id % SPARK_COLORS.length],
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          size: BURST_MIN + Math.floor(Math.random() * (BURST_MAX - BURST_MIN + 1)),
        });
      }

      setBurstSparks((prev) => [...prev, ...next].slice(-48));

      const toRemove = next.map((p) => p.id);
      window.setTimeout(() => {
        setBurstSparks((prev) => prev.filter((p) => !toRemove.includes(p.id)));
      }, 580);
    },
    [reduceMotion]
  );

  return { onPagePointerMove, onPagePointerDown, moveSparks, burstSparks, reduceMotion };
};

type LayerProps = {
  moveSparks: HallPageMoveSpark[];
  burstSparks: HallPageBurstSpark[];
};

export const HallOfFamePageCursorSparkleLayer = ({ moveSparks, burstSparks }: LayerProps) => (
  <div
    className="pointer-events-none absolute inset-0 z-[1] min-h-full overflow-hidden"
    aria-hidden
  >
    {moveSparks.map((s) => (
      <span
        key={`m-${s.id}`}
        className="absolute"
        style={{ left: `${s.x}%`, top: `${s.y}%` }}
      >
        <SparkleStarSvg color={s.color} size={MOVE_STAR_SIZE} className="hof-cursor-sparkle" />
      </span>
    ))}
    {burstSparks.map((s) => (
      <span
        key={`b-${s.id}`}
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
