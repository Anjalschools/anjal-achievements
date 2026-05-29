type CacheValue<T> = { key: string; value: T };

const createMemoSelector = <T>() => {
  let cache: CacheValue<T> | null = null;
  return (key: string, build: () => T) => {
    if (cache?.key === key) return cache.value;
    const value = build();
    cache = { key, value };
    return value;
  };
};

const memoYoY = createMemoSelector<Array<{ year: string; participants: number; medals: number; excellence: number }>>();
const memoDemo = createMemoSelector<Array<{ name: string; male: number; female: number }>>();
const memoTrend = createMemoSelector<Array<{ year: string; aPart: number; bPart: number; aMed: number; bMed: number; aEx: number; bEx: number }>>();
const memoParticipation = createMemoSelector<Array<{ key: string; name: string; value: number; fill?: string }>>();
const memoDistribution = createMemoSelector<Array<{ name: string; n: number }>>();

export const selectYoYSeries = (key: string, rows: Array<{ year: string; participants: number; medals: number; excellence: number }>) =>
  memoYoY(key, () => rows.map((r) => ({ ...r })));

export const selectDemographicSeries = (key: string, rows: Array<{ name: string; male: number; female: number }>) =>
  memoDemo(key, () => rows.map((r) => ({ ...r })));

export const selectTrendSeries = (key: string, rows: Array<{ year: string; aPart: number; bPart: number; aMed: number; bMed: number; aEx: number; bEx: number }>) =>
  memoTrend(key, () => rows.map((r) => ({ ...r })));

export const selectParticipationSeries = (key: string, rows: Array<{ key: string; name: string; value: number; fill?: string }>) =>
  memoParticipation(key, () => rows.map((r) => ({ ...r })));

export const selectDistributionSeries = (key: string, rows: Array<{ name: string; n: number }>) =>
  memoDistribution(key, () => rows.map((r) => ({ ...r })));

