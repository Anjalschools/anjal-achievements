import { measureSerializedBytes } from "@/lib/school-intelligence/school-intelligence-bson-safety";

export type SchoolIntelligenceInArrayAnalysis = {
  path: string;
  arrayLength: number;
  uniqueValues: number;
  duplicateValues: number;
  firstFiveValues: string[];
  lastFiveValues: string[];
  serializedBytes: number;
};

export type SchoolIntelligenceQuerySourceEntry = {
  queryName: string;
  collection: string;
  filterKeys: string[];
  projectionKeys: string[];
  sourceVariableName: string;
  sourceFunction: string;
  arrayLength?: number;
  serializedBytes?: number;
  totalSerializedBytes: number;
  offendingFilterPath?: string;
  uniqueValues?: number;
  duplicateValues?: number;
  firstFiveValues?: string[];
  lastFiveValues?: string[];
  fieldBytes: Record<string, number>;
  inArrayAnalysis: SchoolIntelligenceInArrayAnalysis[];
};

const stringifyFilterValue = (value: unknown): string => {
  if (value == null) return String(value);
  if (typeof value === "object" && "toHexString" in value) {
    return (value as { toHexString: () => string }).toHexString();
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
};

export const normalizeFilterPath = (path: string): string =>
  path.replace(/^filter\./, "").replace(/^\$match\./, "$match.");

const walkFilter = (
  value: unknown,
  path: string,
  visit: (path: string, key: string, node: unknown) => void
): void => {
  if (value == null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkFilter(item, `${path}[${index}]`, visit));
    return;
  }

  const record = value as Record<string, unknown>;
  for (const [key, node] of Object.entries(record)) {
    visit(path, key, node);
    if (node != null && typeof node === "object") {
      walkFilter(node, path ? `${path}.${key}` : key, visit);
    }
  }
};

export const extractFilterKeys = (filter?: unknown, pipeline?: unknown[]): string[] => {
  const keys = new Set<string>();
  if (filter && typeof filter === "object" && !Array.isArray(filter)) {
    Object.keys(filter as Record<string, unknown>).forEach((key) => keys.add(key));
  }
  for (const stage of pipeline ?? []) {
    if (stage && typeof stage === "object" && "$match" in stage) {
      const match = (stage as { $match: unknown }).$match;
      if (match && typeof match === "object" && !Array.isArray(match)) {
        Object.keys(match as Record<string, unknown>).forEach((key) => keys.add(key));
      }
    }
  }
  return [...keys];
};

export const analyzeInArrays = (
  filter: unknown,
  rootPath = "filter"
): SchoolIntelligenceInArrayAnalysis[] => {
  if (filter == null) return [];
  const matches: SchoolIntelligenceInArrayAnalysis[] = [];

  walkFilter(filter, rootPath, (path, key, node) => {
    if (key !== "$in" || !Array.isArray(node)) return;
    const normalizedPath = normalizeFilterPath(`${path}.${key}`);
    const serialized = node.map(stringifyFilterValue);
    const unique = new Set(serialized);
    matches.push({
      path: normalizedPath,
      arrayLength: node.length,
      uniqueValues: unique.size,
      duplicateValues: node.length - unique.size,
      firstFiveValues: serialized.slice(0, 5),
      lastFiveValues: serialized.slice(-5),
      serializedBytes: measureSerializedBytes(node),
    });
  });

  return matches;
};

export const buildFilterFieldBytes = (filter: unknown): Record<string, number> => {
  if (filter == null || typeof filter !== "object" || Array.isArray(filter)) return {};
  const fieldBytes: Record<string, number> = {};

  for (const [key, value] of Object.entries(filter as Record<string, unknown>)) {
    fieldBytes[key] = measureSerializedBytes(value);
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (Array.isArray(record.$in)) {
        fieldBytes[`${key}.$in`] = measureSerializedBytes(record.$in);
      }
    }
  }

  walkFilter(filter, "filter", (path, key, node) => {
    if (key !== "$in" || !Array.isArray(node)) return;
    fieldBytes[normalizeFilterPath(`${path}.${key}`)] = measureSerializedBytes(node);
  });

  return fieldBytes;
};

export const buildPipelineFieldBytes = (pipeline: unknown[]): Record<string, number> => {
  const fieldBytes: Record<string, number> = {};
  pipeline.forEach((stage, index) => {
    fieldBytes[`pipeline[${index}]`] = measureSerializedBytes(stage);
    if (stage == null || typeof stage !== "object" || !("$match" in stage)) return;
    const match = (stage as { $match: unknown }).$match;
    if (match == null || typeof match !== "object" || Array.isArray(match)) return;
    for (const [key, value] of Object.entries(match as Record<string, unknown>)) {
      fieldBytes[`$match.${key}`] = measureSerializedBytes(value);
      if (value != null && typeof value === "object" && !Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        if (Array.isArray(record.$in)) {
          fieldBytes[`$match.${key}.$in`] = measureSerializedBytes(record.$in);
        }
      }
    }
  });
  return fieldBytes;
};

const findLargestFieldPath = (fieldBytes: Record<string, number>): string | undefined => {
  const entries = Object.entries(fieldBytes);
  if (entries.length === 0) return undefined;
  return entries.sort((a, b) => b[1] - a[1])[0]?.[0];
};

export const buildQuerySourceTrace = (input: {
  queryName: string;
  collection: string;
  filter?: unknown;
  projection?: string | Record<string, unknown>;
  pipeline?: unknown[];
  sourceVariableName: string;
  sourceFunction: string;
  projectionKeys?: string[];
}): SchoolIntelligenceQuerySourceEntry => {
  const filterKeys = extractFilterKeys(input.filter, input.pipeline);
  const projectionKeys =
    input.projectionKeys ??
    (typeof input.projection === "string"
      ? input.projection.split(/\s+/).filter(Boolean)
      : input.projection
        ? Object.keys(input.projection)
        : []);

  const pipelineMatches = (input.pipeline ?? [])
    .filter(
      (stage): stage is { $match: unknown } =>
        stage != null && typeof stage === "object" && "$match" in stage
    )
    .map((stage) => stage.$match);

  const inArrayAnalysis = [
    ...analyzeInArrays(input.filter),
    ...pipelineMatches.flatMap((match) => analyzeInArrays(match, "$match")),
  ];

  const fieldBytes = {
    ...buildFilterFieldBytes(input.filter),
    ...buildPipelineFieldBytes(input.pipeline ?? []),
  };

  const queryBytes = measureSerializedBytes(input.filter ?? {});
  const pipelineBytes = measureSerializedBytes(input.pipeline ?? []);
  const totalSerializedBytes = Math.max(queryBytes, pipelineBytes);
  const largestIn = [...inArrayAnalysis].sort((a, b) => b.serializedBytes - a.serializedBytes)[0];

  return {
    queryName: input.queryName,
    collection: input.collection,
    filterKeys,
    projectionKeys,
    sourceVariableName: input.sourceVariableName,
    sourceFunction: input.sourceFunction,
    arrayLength: largestIn?.arrayLength,
    serializedBytes: largestIn?.serializedBytes ?? totalSerializedBytes,
    totalSerializedBytes,
    offendingFilterPath: largestIn?.path ?? findLargestFieldPath(fieldBytes),
    uniqueValues: largestIn?.uniqueValues,
    duplicateValues: largestIn?.duplicateValues,
    firstFiveValues: largestIn?.firstFiveValues,
    lastFiveValues: largestIn?.lastFiveValues,
    fieldBytes,
    inArrayAnalysis,
  };
};

export const pickPrimaryQuerySourceEntry = (
  entries: SchoolIntelligenceQuerySourceEntry[] | undefined,
  queryName?: string
): SchoolIntelligenceQuerySourceEntry | undefined => {
  if (!entries?.length) return undefined;
  if (queryName) {
    const match = entries.find((entry) => entry.queryName === queryName);
    if (match) return match;
  }
  return [...entries].sort(
    (a, b) => (b.serializedBytes ?? b.totalSerializedBytes) - (a.serializedBytes ?? a.totalSerializedBytes)
  )[0];
};

export const formatFieldBytesSummary = (fieldBytes: Record<string, number>): string =>
  Object.entries(fieldBytes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([field, bytes]) => `${field}: ${bytes}B`)
    .join(", ");
