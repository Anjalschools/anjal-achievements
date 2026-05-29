/**
 * Pooled intersection observer for executive section scroll spy.
 */

import type { ExecutiveNavEntry } from "@/lib/analytics/executive-nav-registry";

type ScrollSpyCallback = (activeAnchorId: string) => void;

let sharedObserver: IntersectionObserver | null = null;
const subscribers = new Map<string, ScrollSpyCallback>();
const elementToAnchor = new WeakMap<Element, string>();

const ensureObserver = (): IntersectionObserver => {
  if (sharedObserver) return sharedObserver;
  sharedObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0));
      const top = visible[0];
      if (!top) return;
      const anchorId = elementToAnchor.get(top.target);
      if (!anchorId) return;
      for (const cb of subscribers.values()) {
        cb(anchorId);
      }
    },
    { rootMargin: "-18% 0px -62% 0px", threshold: [0, 0.15, 0.35, 0.55] }
  );
  return sharedObserver;
};

export const registerExecutiveScrollSpy = (
  subscriberId: string,
  entries: ExecutiveNavEntry[],
  onActive: ScrollSpyCallback
): (() => void) => {
  if (typeof window === "undefined") return () => undefined;

  subscribers.set(subscriberId, onActive);
  const obs = ensureObserver();

  const registerIdle = () => {
    for (const entry of entries) {
      const el = document.getElementById(entry.anchorId);
      if (!el) continue;
      elementToAnchor.set(el, entry.anchorId);
      obs.observe(el);
    }
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(registerIdle, { timeout: 200 });
  } else {
    setTimeout(registerIdle, 0);
  }

  return () => {
    subscribers.delete(subscriberId);
    for (const entry of entries) {
      const el = document.getElementById(entry.anchorId);
      if (el) obs.unobserve(el);
    }
  };
};

export const scrollToExecutiveAnchor = (anchorId: string): void => {
  if (typeof document === "undefined") return;
  const el = document.getElementById(anchorId);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};
