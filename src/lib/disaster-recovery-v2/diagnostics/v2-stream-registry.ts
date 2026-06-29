import type { Readable, Writable } from "stream";
import { PassThrough } from "stream";

export type V2StreamKind = "read" | "write" | "passthrough";

type TrackedStream = {
  id: string;
  kind: V2StreamKind;
  label: string;
  createdAt: number;
};

let nextStreamId = 1;
const activeStreams = new Map<string, TrackedStream>();

export const getV2ActiveStreamCounts = (): {
  readStreams: number;
  writeStreams: number;
  passThroughStreams: number;
  total: number;
} => {
  let readStreams = 0;
  let writeStreams = 0;
  let passThroughStreams = 0;

  for (const stream of activeStreams.values()) {
    if (stream.kind === "read") readStreams += 1;
    if (stream.kind === "write") writeStreams += 1;
    if (stream.kind === "passthrough") passThroughStreams += 1;
  }

  return {
    readStreams,
    writeStreams,
    passThroughStreams,
    total: activeStreams.size,
  };
};

const unregisterStream = (id: string): void => {
  activeStreams.delete(id);
};

export const trackV2Stream = <T extends Readable | Writable | PassThrough>(
  stream: T,
  input: { kind: V2StreamKind; label: string }
): T => {
  const id = `stream-${nextStreamId++}`;
  activeStreams.set(id, {
    id,
    kind: input.kind,
    label: input.label,
    createdAt: Date.now(),
  });

  const cleanup = (): void => {
    unregisterStream(id);
  };

  stream.once("close", cleanup);
  stream.once("error", cleanup);
  if (input.kind === "read") {
    stream.once("end", cleanup);
  }
  if (input.kind === "write") {
    stream.once("finish", cleanup);
  }

  return stream;
};

export const resetV2StreamRegistry = (): void => {
  activeStreams.clear();
};
