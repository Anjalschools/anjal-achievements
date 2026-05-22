/**
 * Shared batch helpers for category backfill scripts (safe bulk writes).
 */

export const BACKFILL_BATCH_DEFAULT = 50;

export type BulkFlushResult = {
  ok: boolean;
  batchIndex: number;
  opCount: number;
  modifiedCount: number;
  matchedCount: number;
  errors: string[];
};

export const safeBulkFlush = async (
  model: { bulkWrite: (ops: any[], options?: { ordered?: boolean }) => Promise<any> },
  bulkOps: any[],
  opts: { dryRun: boolean; batchIndex: number }
): Promise<BulkFlushResult> => {
  const result: BulkFlushResult = {
    ok: true,
    batchIndex: opts.batchIndex,
    opCount: bulkOps.length,
    modifiedCount: 0,
    matchedCount: 0,
    errors: [],
  };

  if (bulkOps.length === 0) return result;
  if (opts.dryRun) return result;

  try {
    const res = await model.bulkWrite(bulkOps, { ordered: false });
    result.modifiedCount = res.modifiedCount ?? 0;
    result.matchedCount = res.matchedCount ?? 0;
    if (res.hasWriteErrors?.()) {
      const writeErrors = res.getWriteErrors?.() ?? [];
      for (const we of writeErrors) {
        result.errors.push(String(we.errmsg || we));
      }
      result.ok = result.errors.length < bulkOps.length;
    }
  } catch (e) {
    result.ok = false;
    result.errors.push(e instanceof Error ? e.message : String(e));
  }

  return result;
};
