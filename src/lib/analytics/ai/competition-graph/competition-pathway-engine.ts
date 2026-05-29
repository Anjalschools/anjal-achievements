/**
 * competition-pathway-engine.ts
 * Defines named academic pathways and resolves a student's current position.
 */
import {
  NODE_BY_KEY,
  COMPETITION_NODES,
  type CompetitionNode,
} from "./competition-graph-registry";

export type PathwayDefinition = {
  key: string;
  labelAr: string;
  labelEn: string;
  nodes: string[];         // ordered keys from entry → elite
  domain: string;
  eliteNodeKey: string;
};

export const PATHWAY_DEFINITIONS: PathwayDefinition[] = [
  {
    key: "math_ladder",
    labelAr: "مسار الرياضيات",
    labelEn: "Math Ladder",
    nodes: ["bebras", "kangaroo", "kaust_math", "math_olympiad"],
    domain: "math",
    eliteNodeKey: "math_olympiad",
  },
  {
    key: "gifted_track",
    labelAr: "مسار الموهوبين",
    labelEn: "Gifted Track",
    nodes: ["mawhiba_discovery", "nasmo", "olympiad_training"],
    domain: "gifted",
    eliteNodeKey: "olympiad_training",
  },
  {
    key: "research_track",
    labelAr: "مسار البحث العلمي",
    labelEn: "Research Track",
    nodes: ["ibdaa", "misk", "srsi"],
    domain: "research",
    eliteNodeKey: "srsi",
  },
  {
    key: "international_track",
    labelAr: "المسار الدولي",
    labelEn: "International Track",
    nodes: ["ielts", "sat", "srsi", "misk"],
    domain: "international",
    eliteNodeKey: "srsi",
  },
  {
    key: "olympiad_track",
    labelAr: "مسار الأولمبياد",
    labelEn: "Olympiad Track",
    nodes: ["bebras", "mawhiba_discovery", "nasmo", "olympiad_training"],
    domain: "science",
    eliteNodeKey: "olympiad_training",
  },
];

export const PATHWAY_BY_KEY = new Map(
  PATHWAY_DEFINITIONS.map((p) => [p.key, p])
);

export type StudentPathwayPosition = {
  pathwayKey: string;
  pathwayLabelAr: string;
  pathwayLabelEn: string;
  completedNodes: string[];   // nodes student has participated in
  currentNodeKey: string | null;
  currentNodeIndex: number;   // -1 = not started
  nextNodeKey: string | null;
  completionPct: number;       // 0–100
  isOnTrack: boolean;
};

export const resolveStudentPathwayPosition = (
  pathwayKey: string,
  studentActivityKeys: Set<string>
): StudentPathwayPosition => {
  const pathway = PATHWAY_BY_KEY.get(pathwayKey);
  if (!pathway) {
    return {
      pathwayKey,
      pathwayLabelAr: "",
      pathwayLabelEn: "",
      completedNodes: [],
      currentNodeKey: null,
      currentNodeIndex: -1,
      nextNodeKey: null,
      completionPct: 0,
      isOnTrack: false,
    };
  }

  const completedNodes = pathway.nodes.filter((n) => studentActivityKeys.has(n));
  const highestCompletedIdx = completedNodes.length > 0
    ? Math.max(...completedNodes.map((n) => pathway.nodes.indexOf(n)))
    : -1;

  const currentNodeKey = highestCompletedIdx >= 0
    ? pathway.nodes[highestCompletedIdx] ?? null
    : null;
  const nextNodeKey = pathway.nodes[highestCompletedIdx + 1] ?? null;

  const completionPct =
    pathway.nodes.length > 0
      ? Math.round((completedNodes.length / pathway.nodes.length) * 100)
      : 0;

  return {
    pathwayKey,
    pathwayLabelAr: pathway.labelAr,
    pathwayLabelEn: pathway.labelEn,
    completedNodes,
    currentNodeKey,
    currentNodeIndex: highestCompletedIdx,
    nextNodeKey,
    completionPct,
    isOnTrack: completedNodes.length > 0,
  };
};

/** Resolve all pathways for a student and return only relevant ones (started or feasible) */
export const resolveAllPathwayPositions = (
  studentActivityKeys: Set<string>,
  studentGrade: number
): StudentPathwayPosition[] => {
  return PATHWAY_DEFINITIONS.map((p) =>
    resolveStudentPathwayPosition(p.key, studentActivityKeys)
  ).filter((pos) => pos.completedNodes.length > 0);
};
