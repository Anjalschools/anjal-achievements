import type { MentorCandidate } from "@/lib/alumni/matching/mentor-matching";
import { symmetricAlumniAffinity } from "./similarity";
import type { PathwayHop } from "./types";

export const findAlumniPathways = (input: {
  self: MentorCandidate;
  target: MentorCandidate;
  intermediates: MentorCandidate[];
  maxPaths?: number;
}): PathwayHop[] => {
  const { self, target } = input;
  const maxPaths = input.maxPaths ?? 4;
  const paths: PathwayHop[] = [];

  const direct = symmetricAlumniAffinity(self, target);
  if (direct.weight >= 8) {
    paths.push({
      type: "direct",
      strength: direct.weight,
      hopIds: [self.id, target.id],
      labels: [self.fullName, target.fullName],
    });
  }

  for (const c of input.intermediates) {
    if (c.id === target.id || c.id === self.id) continue;
    const e1 = symmetricAlumniAffinity(self, c);
    const e2 = symmetricAlumniAffinity(c, target);
    if (e1.weight < 10 || e2.weight < 10) continue;
    paths.push({
      type: "via_peer",
      strength: e1.weight + e2.weight,
      hopIds: [self.id, c.id, target.id],
      labels: [self.fullName, c.fullName, target.fullName],
    });
  }

  paths.sort((a, b) => b.strength - a.strength);
  return paths.slice(0, maxPaths);
};
