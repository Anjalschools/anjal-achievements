export type DeadLetterRecord = {
  type: string;
  payload: Record<string, unknown>;
  error: string;
  at: Date;
  attempts: number;
};

export type DeadLetterHandler = {
  push(record: DeadLetterRecord): void;
  snapshot(): DeadLetterRecord[];
};

export const createInMemoryDeadLetterHandler = (cap = 500): DeadLetterHandler => {
  const buf: DeadLetterRecord[] = [];
  return {
    push(record) {
      buf.push(record);
      if (buf.length > cap) buf.shift();
    },
    snapshot() {
      return [...buf];
    },
  };
};
