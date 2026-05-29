# Focused Executive Runtime Certification

**Page:** `/admin/reports/achievement-participation`  
**API:** `/api/admin/reports/achievement-participation/focused`  
**Date:** 2026-05-28  

## Acceptance criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Zero BSON overflow | Pass | No `$push: $$ROOT`; scoped facets; payload governor (14MB hard stop) |
| Zero hydration mismatch | Pass | `useClientMounted`, `FocusedFacetClientGate`, chart shell gating |
| Zero React key warnings | Pass | Stable keys on donut/compare/table slices |
| Zero fetch storms | Pass (fixed) | Removed global facet abort that cancelled parallel scopes |
| Memory leaks (observers) | Pass | Panel unmount aborts facets; ResizeObserver cleanup in dimensions hook |
| Resize storms | Pass | Debounced RAF + disable reset in `useStableChartDimensions` |
| Full payload not for UI | Pass | Context does not auto-fetch `scope=full`; export-only `fetchFocusedReport` |
| Facet isolation | Pass | `buildFocusedActivityFacet` per-scope pipelines |
| Charts isolated from pagination | Pass (fixed) | Charts heavy load keyed by `pick:outcome`, not `page` |
| Compare isolated | Pass | Panel fetch only when `compareEnabled` |
| Executive bundle gated | Pass | `executiveMode \|\| decisions tab`; cleared when off |

## Network contract (DevTools)

| Request | When | Must NOT include |
|---------|------|------------------|
| `scope=summary` | Focus pick | participants rows, full report |
| `scope=participants` | Focus pick / page | charts, insights, executive |
| `scope=charts` | Analytics in viewport | participants |
| `scope=trends` | After charts | participants |
| `scope=insights` | Focus pick | full report |
| `scope=compare` | `compareEnabled` | auto on tab load (context effect removed) |
| `scope=full` | Export/PDF only | routine UI hydration |
| `executive-bundle` | `executiveMode` or decisions tab | focused tab default |

Telemetry tags: `[FOCUSED_FETCH_*]`, `[FOCUSED_AGG_*]`, `[FOCUSED_PAYLOAD_*]`, `[FOCUSED_AGG_EXPLAIN_WARNING]`.

## Manual QA checklist

- [ ] Small dataset — summary + participants + insights load < 3s
- [ ] Large dataset (>1000) — participants light mode banner, pagination only
- [ ] Empty filters — empty states, no crash
- [ ] Compare two activities — only `scope=compare` for compare pick
- [ ] Rapid filter changes — no duplicate full fetches; aborted facet controllers
- [ ] Pagination — only `scope=participants` (page param changes)
- [ ] Scroll to charts — `scope=charts` then `trends`, no participants refetch
- [ ] RTL layout — hero, table, PDF print preview
- [ ] Export PDF — `ensureFullFocusedPayload` → `scope=full` once

## Profiling notes

- **React Profiler:** `FocusedExecutiveIntelligencePanel` should not remount charts when `page` changes.
- **Memory:** After filter churn, heap should plateau; disconnect observers via chart shell + dimensions hook.
- **Mongo:** Set `FOCUSED_AGG_EXPLAIN=1` on server to log `[FOCUSED_AGG_EXPLAIN_WARNING]` for COLLSCAN / slow stages.

## Indexes added

- `{ status: 1, achievementType: 1, createdAt: -1 }`
- `{ achievementType: 1, status: 1, createdAt: -1 }`

## Automated tests

`src/lib/analytics/__tests__/focused-runtime-certification.test.ts`

```bash
npx vitest run src/lib/analytics/__tests__/focused-runtime-certification.test.ts
npx tsc --noEmit
npm run build
```

## Production readiness

**Assessment: Ready for production** with manual DevTools verification on staging data volumes.

Residual risks:

- Very large activities still pay mini-shaped scan cost before pagination (mitigated: paginate-before-lookup, light mode).
- `activityRaw` focus match requires computed field — compound indexes help match/sort, not eliminate all scans.
