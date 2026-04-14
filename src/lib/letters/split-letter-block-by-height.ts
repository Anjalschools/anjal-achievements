/**
 * Split plain text so each slice fits within a measured max height (binary search).
 * Prefers breaking after newlines, then spaces, when refining the cut point.
 */

const refineCut = (head: string, tail: string): [string, string] => {
  const nl = head.lastIndexOf("\n");
  if (nl > 0 && nl >= Math.floor(head.length * 0.35)) {
    return [head.slice(0, nl + 1).trimEnd(), head.slice(nl + 1) + tail];
  }
  const sp = head.lastIndexOf(" ");
  if (sp > 0 && sp >= Math.floor(head.length * 0.3)) {
    return [head.slice(0, sp + 1).trimEnd(), head.slice(sp + 1) + tail];
  }
  return [head, tail];
};

export const splitTextToFitHeight = (
  text: string,
  maxHeight: number,
  measure: (s: string) => number,
): string[] => {
  const t = text.replace(/\r\n/g, "\n");
  if (!t.trim()) return [t];
  if (measure(t) <= maxHeight) return [t];

  const out: string[] = [];
  let rest = t;
  let guard = 0;
  const maxIter = t.length + 80;

  while (rest.length > 0 && guard++ < maxIter) {
    let lo = 0;
    let hi = rest.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (measure(rest.slice(0, mid)) <= maxHeight) lo = mid;
      else hi = mid - 1;
    }
    let take = lo;
    if (take === 0) take = 1;
    let head = rest.slice(0, take);
    let tail = rest.slice(take);
    [head, tail] = refineCut(head, tail);
    out.push(head.trimEnd());
    rest = tail.trimStart();
  }

  return out.length ? out : [t];
};
