/**
 * Analytics computation graph — recompute only when input fingerprints change.
 */

type NodeState = {
  fingerprint: string;
  value: unknown;
};

const nodes = new Map<string, NodeState>();

export const computeWithFingerprint = <T>(
  nodeId: string,
  fingerprint: string,
  factory: () => T
): T => {
  const existing = nodes.get(nodeId);
  if (existing && existing.fingerprint === fingerprint) {
    return existing.value as T;
  }
  const value = factory();
  nodes.set(nodeId, { fingerprint, value });
  return value;
};

export const invalidateComputationNode = (nodeId: string): void => {
  nodes.delete(nodeId);
};

export const clearComputationGraph = (): void => {
  nodes.clear();
};
