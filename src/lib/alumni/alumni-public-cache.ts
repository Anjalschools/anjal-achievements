import type {
  AlumniFieldsResponse,
  AlumniSummaryResponse,
  AlumniUniversitiesResponse,
  FeaturedAlumniResponse,
} from "@/lib/alumni/alumni-public-types";

type Slot<T> = { value: T; expiresAt: number };

const DEFAULT_TTL_MS = 45_000;

let alumniSummaryCache: Slot<AlumniSummaryResponse> | null = null;
let featuredAlumniCache: Slot<FeaturedAlumniResponse> | null = null;
let alumniUniversitiesCache: Slot<AlumniUniversitiesResponse> | null = null;
let alumniFieldsCache: Slot<AlumniFieldsResponse> | null = null;

const getValidValue = <T>(slot: Slot<T> | null): T | null => {
  if (!slot || slot.expiresAt <= Date.now()) return null;
  return slot.value;
};

export const getAlumniSummaryCached = (): AlumniSummaryResponse | null => getValidValue(alumniSummaryCache);
export const getFeaturedAlumniCached = (): FeaturedAlumniResponse | null => getValidValue(featuredAlumniCache);
export const getAlumniUniversitiesCached = (): AlumniUniversitiesResponse | null =>
  getValidValue(alumniUniversitiesCache);
export const getAlumniFieldsCached = (): AlumniFieldsResponse | null => getValidValue(alumniFieldsCache);

export const setAlumniSummaryCached = (
  value: AlumniSummaryResponse,
  ttlMs: number = DEFAULT_TTL_MS
) => {
  alumniSummaryCache = { value, expiresAt: Date.now() + ttlMs };
};

export const setFeaturedAlumniCached = (
  value: FeaturedAlumniResponse,
  ttlMs: number = DEFAULT_TTL_MS
) => {
  featuredAlumniCache = { value, expiresAt: Date.now() + ttlMs };
};

export const setAlumniUniversitiesCached = (
  value: AlumniUniversitiesResponse,
  ttlMs: number = DEFAULT_TTL_MS
) => {
  alumniUniversitiesCache = { value, expiresAt: Date.now() + ttlMs };
};

export const setAlumniFieldsCached = (
  value: AlumniFieldsResponse,
  ttlMs: number = DEFAULT_TTL_MS
) => {
  alumniFieldsCache = { value, expiresAt: Date.now() + ttlMs };
};
