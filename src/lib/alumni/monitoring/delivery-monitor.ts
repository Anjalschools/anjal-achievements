type DeliveryCounter = { channel: string; failures: number; successes: number };

const caps = new Map<string, DeliveryCounter>();

const bump = (channel: string, field: "failures" | "successes"): void => {
  const k = channel.slice(0, 80);
  const row = caps.get(k) || { channel: k, failures: 0, successes: 0 };
  row[field] += 1;
  caps.set(k, row);
};

export const recordDeliveryFailure = (channel: string, _reason?: string): void => {
  bump(channel, "failures");
};

export const recordDeliverySuccess = (channel: string): void => {
  bump(channel, "successes");
};

export const getDeliveryCounters = (): DeliveryCounter[] => [...caps.values()].slice(-40);
