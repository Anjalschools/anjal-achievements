import "server-only";
import type mongoose from "mongoose";

export type FocusedAggExplainWarning = {
  code:
    | "COLLSCAN"
    | "UNINDEXED_SORT"
    | "LARGE_STAGE_SPILL"
    | "SLOW_STAGE"
    | "INDEX_MISS"
    | "HEAVY_LOOKUP"
    | "MEMORY_SPILL"
    | "LOW_INDEX_RATIO";
  stage?: string;
  detail?: string;
};

const log = (tag: string, payload: Record<string, unknown>): void => {
  // eslint-disable-next-line no-console
  console.info(tag, payload);
};

const mapWarningToTelemetry = (w: FocusedAggExplainWarning): void => {
  switch (w.code) {
    case "SLOW_STAGE":
      log("[FOCUSED_AGG_STAGE_SLOW]", w);
      break;
    case "HEAVY_LOOKUP":
      log("[FOCUSED_LOOKUP_HEAVY]", w);
      break;
    case "COLLSCAN":
    case "UNINDEXED_SORT":
    case "INDEX_MISS":
      log("[FOCUSED_INDEX_MISS]", w);
      break;
    default:
      log("[FOCUSED_AGG_EXPLAIN_WARNING]", w);
  }
};

/** Inspect Mongo aggregation explain output (executionStats / queryPlanner). */
export const inspectFocusedAggregationExplain = (
  explain: unknown,
  meta?: { scope?: string; correlationId?: string }
): FocusedAggExplainWarning[] => {
  const warnings: FocusedAggExplainWarning[] = [];
  const executionStats = explain as {
    executionStats?: {
      executionTimeMillis?: number;
      totalKeysExamined?: number;
      totalDocsExamined?: number;
      executionStages?: Record<string, unknown>;
    };
    stages?: unknown[];
  };

  const rootStage = executionStats.executionStats?.executionStages;
  const walkStage = (node: Record<string, unknown> | undefined, depth = 0): void => {
    if (!node || depth > 24) return;
    const stageName = String(node.stage ?? "");
    const ms = Number(node.executionTimeMillisEstimate ?? node.executionTimeMillis ?? 0);
    const docsExamined = Number(node.totalDocsExamined ?? node.docsExamined ?? 0);
    const keysExamined = Number(node.totalKeysExamined ?? node.keysExamined ?? 0);
    const indexName = node.indexName as string | undefined;

    if (ms > 8_000) {
      warnings.push({ code: "SLOW_STAGE", stage: stageName, detail: `${ms}ms` });
    }
    if (stageName === "$lookup" || stageName === "LOOKUP") {
      if (ms > 3_000 || docsExamined > 25_000) {
        warnings.push({
          code: "HEAVY_LOOKUP",
          stage: stageName,
          detail: `ms=${ms} docs=${docsExamined}`,
        });
      }
    }
    if ((stageName === "COLLSCAN" || stageName === "collectionScan") && !indexName) {
      warnings.push({ code: "COLLSCAN", stage: stageName, detail: `docs=${docsExamined}` });
    }
    if ((stageName === "SORT" || stageName === "sort") && keysExamined === 0 && docsExamined > 5_000) {
      warnings.push({ code: "UNINDEXED_SORT", stage: stageName });
    }
    if (!indexName && docsExamined > 50_000 && stageName !== "$facet") {
      warnings.push({ code: "INDEX_MISS", stage: stageName, detail: `docs=${docsExamined}` });
    }
    if (String(node.spills).includes("true") || stageName.includes("spill")) {
      warnings.push({ code: "LARGE_STAGE_SPILL", stage: stageName });
    }
    const stageMem = Number(node.memUsage ?? node.memLimit ?? 0);
    if (stageMem > 64 * 1024 * 1024) {
      warnings.push({ code: "MEMORY_SPILL", stage: stageName, detail: `memBytes=${stageMem}` });
    }
    if (docsExamined > 0 && keysExamined > 0 && keysExamined / docsExamined < 0.08 && docsExamined > 8_000) {
      warnings.push({
        code: "LOW_INDEX_RATIO",
        stage: stageName,
        detail: `ratio=${(keysExamined / docsExamined).toFixed(3)}`,
      });
    }

    const input = node.inputStage as Record<string, unknown> | undefined;
    if (input) walkStage(input, depth + 1);
    const inner = node.innerStage as Record<string, unknown> | undefined;
    if (inner) walkStage(inner, depth + 1);
    const outer = node.outerStage as Record<string, unknown> | undefined;
    if (outer) walkStage(outer, depth + 1);
    const shards = node.shards as Array<{ executionStages?: Record<string, unknown> }> | undefined;
    if (Array.isArray(shards)) {
      for (const sh of shards) walkStage(sh.executionStages, depth + 1);
    }
  };

  walkStage(rootStage);

  const legacyStages = executionStats.stages;
  if (Array.isArray(legacyStages)) {
    for (const stage of legacyStages) {
      const s = stage as {
        stage?: string;
        executionTimeMillisEstimate?: number;
        indexesUsed?: string[];
        inputStage?: { stage?: string };
      };
      const stageName = String(s.stage || "");
      const ms = Number(s.executionTimeMillisEstimate ?? 0);
      if (ms > 12_000) warnings.push({ code: "SLOW_STAGE", stage: stageName, detail: `${ms}ms` });
      if (stageName === "COLLSCAN" || s.inputStage?.stage === "COLLSCAN") {
        warnings.push({ code: "COLLSCAN", stage: stageName });
      }
    }
  }

  const totalMs = Number(executionStats.executionStats?.executionTimeMillis ?? 0);
  const totalDocs = Number(executionStats.executionStats?.totalDocsExamined ?? 0);
  const totalKeys = Number(executionStats.executionStats?.totalKeysExamined ?? 0);
  const indexUsageRatio = totalDocs > 0 ? totalKeys / totalDocs : totalKeys > 0 ? 1 : 0;
  if (totalDocs > 0 && totalKeys === 0 && totalDocs > 20_000) {
    warnings.push({ code: "INDEX_MISS", detail: `docsExamined=${totalDocs}` });
  }
  if (totalDocs > 10_000 && indexUsageRatio < 0.05) {
    warnings.push({
      code: "INDEX_MISS",
      detail: `indexUsageRatio=${indexUsageRatio.toFixed(3)} docs=${totalDocs} keys=${totalKeys}`,
    });
  }
  if (totalMs > 15_000) {
    warnings.push({ code: "SLOW_STAGE", detail: `pipeline=${totalMs}ms` });
  }
  if (totalMs > 20_000 && totalDocs > 80_000) {
    warnings.push({
      code: "MEMORY_SPILL",
      detail: `estimatedHeavyScan docs=${totalDocs} ms=${totalMs}`,
    });
  }

  if (warnings.length) {
    log("[FOCUSED_AGG_EXPLAIN_WARNING]", {
      scope: meta?.scope,
      correlationId: meta?.correlationId,
      warningCount: warnings.length,
      totalMs,
      totalDocs,
      totalKeys,
    });
    for (const w of warnings) mapWarningToTelemetry(w);
  }
  return warnings;
};

export const maybeExplainFocusedPipeline = async (
  model: mongoose.Model<unknown>,
  pipeline: mongoose.PipelineStage[],
  opts: { scope: string; correlationId?: string; enabled?: boolean }
): Promise<FocusedAggExplainWarning[]> => {
  if (opts.enabled === false) return [];
  if (process.env.FOCUSED_AGG_EXPLAIN !== "1") return [];
  try {
    const explain = await model.aggregate(pipeline).explain("executionStats");
    return inspectFocusedAggregationExplain(explain, {
      scope: opts.scope,
      correlationId: opts.correlationId,
    });
  } catch (e) {
    log("[FOCUSED_AGG_EXPLAIN_WARNING]", {
      scope: opts.scope,
      correlationId: opts.correlationId,
      error: e instanceof Error ? e.message : "explain_failed",
    });
    return [];
  }
};
