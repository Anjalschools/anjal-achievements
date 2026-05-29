# Executive Analytics — Known Operational Limits

Operational thresholds for `/admin/reports/achievement-participation` (focused executive mode). Values reflect current governors, budgets, and runtime guards.

## Dataset & facet thresholds

| Facet | Max response budget | Typical safe row volume | Degraded behavior |
|-------|---------------------|-------------------------|-------------------|
| `summary` | 1 MB | KPI-only | Trim ranking pools |
| `participants` | 4 MB | ≤ 1,000 records (light mode above) | Page cap 25, strip `rankingPool` |
| `charts` | 2 MB | ≤ 24 points per series | Slice series arrays |
| `trends` | 2 MB | ≤ 24 buckets | Slice trend arrays |
| `insights` | 2 MB | ≤ 8 recommendations, 5 alerts | Trim decision platform |
| `compare` | 4 MB | ≤ 12 YoY rows | Trim `executive.yearComparison` |
| `executive` | 6 MB | Bundle sections partial | `degraded: true` header |
| `full` (export only) | 14 MB | Full report for PDF | Global payload governor + trim |

**Participants light mode:** activates when `totalRecords > 1000` — slimmer row shape, no heavy post-lookup enrichment on full set.

**Pagination:** UI default `pageSize=25`; do not raise above **50** without re-profiling participants pipeline.

## Export thresholds

- **Scope:** only `scope=full` or dedicated `exportParticipants=1` — never hydrate UI React state with full payload.
- **Recommended max export rows:** 5,000 participant rows per job; above this expect degraded PDF tables and longer server time.
- **Concurrent exports:** 1 per browser tab (export overlay blocks duplicate starts).
- **Telemetry:** `[EXEC_EXPORT_RUNTIME_START]` / `[EXEC_EXPORT_RUNTIME_END]` — target &lt; 45s P95 on production hardware.

## Chart density limits

| Guard | Limit | Action |
|-------|-------|--------|
| Render duration | &gt; 2.5s | Simplified mode + `[FOCUSED_CHART_WATCHDOG]` |
| Resize burst | 12 events / 3s | Freeze resize 1.5s |
| Remount churn | ≥ 6 mounts | Simplified mode, disable animation |
| In-view hydration | IntersectionObserver `rootMargin: 160px` | Charts off-screen stay skeleton |

**Series density:** prefer ≤ **24** bars/points per chart; watchdog trims server payloads at 24.

## Memory expectations (client)

| Signal | Threshold | Notes |
|--------|-----------|-------|
| Heap sample | &gt; 450 MB | `[FOCUSED_MEMORY_SPIKE]` recorded |
| Long session | 30+ min filter/chart use | Expect stable heap if facets stay isolated; investigate if &gt; 550 MB sustained |
| SWR + analytics cache | max **120** entries LRU | `[CACHE_EVICT]` / `[CACHE_STALE_PURGE]` |

## Server / Mongo limits

| Signal | Threshold | Telemetry |
|--------|-----------|-----------|
| Stage duration | &gt; 8s (node), &gt; 12s (legacy) | `[FOCUSED_AGG_STAGE_SLOW]` |
| Lookup | &gt; 3s or &gt; 25k docs | `[FOCUSED_LOOKUP_HEAVY]` |
| Index usage | keys/docs &lt; 5% on large scans | `[FOCUSED_INDEX_MISS]` |
| Pipeline total | &gt; 15s | `[FOCUSED_AGG_STAGE_SLOW]` |
| Explain mode | `FOCUSED_AGG_EXPLAIN=1` | Dev/staging only |

**BSON:** hard cap 16 MB at Mongo; facet budgets prevent approaching this on UI scopes.

## Cache governance

- Default TTL: **5 min** (`ANALYTICS_CACHE_DEFAULT_TTL_MS`)
- Stale revalidate: **30 s**
- Max entries: **120** (LRU eviction)
- Facet fetch: per-key abort only (no global abort controller)

## Debug & recovery (development)

- `window.__EXEC_ANALYTICS_RUNTIME__` — live snapshot (dev only)
- Overlay hide: `localStorage.setItem('exec_analytics_debug_overlay', '0')`
- Recovery: `ExecutiveRuntimeRecoveryBoundary` — soft reset / facet retry without `window.location.reload`

## Regression checklist (release gate)

1. `npx tsc --noEmit`
2. `npm run build`
3. `vitest focused-runtime-certification`
4. Network tab: parallel facets (`summary`, `participants`, `insights`) without mutual abort
5. Export: `scope=full` not merged into progressive `focusedData` state
6. No `scope=full` on tab focus / filter change

## Not supported (by design)

- Full monolithic aggregation for UI scopes
- Global `AbortController` cancelling all in-flight facets
- Full-page reload as recovery
- Unbounded participant `$lookup` before pagination
