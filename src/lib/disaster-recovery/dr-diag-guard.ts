type DrRegistryOverflowState = {
  detected: boolean;
  registry?: string;
  count: number;
};

let internalLogging = false;
let asyncHookEnabled = false;
let overflow: DrRegistryOverflowState = { detected: false, count: 0 };

export const isDrInternalLogging = (): boolean => internalLogging;

export const isDrAsyncHookEnabled = (): boolean => asyncHookEnabled;

export const setDrAsyncHookEnabled = (enabled: boolean): void => {
  asyncHookEnabled = enabled;
};

export const recordDrRegistryOverflow = (registry: string): void => {
  overflow.detected = true;
  overflow.registry = registry;
  overflow.count += 1;
};

export const resetDrDiagGuard = (): void => {
  internalLogging = false;
  asyncHookEnabled = false;
  overflow = { detected: false, count: 0 };
};

export const getDrRegistryOverflowState = (): DrRegistryOverflowState => ({ ...overflow });

export const emitDeferredRegistryOverflowWarning = (): void => {
  if (!overflow.detected) return;

  internalLogging = true;
  try {
    console.warn("[DR] REGISTRY_LIMIT", {
      registry: overflow.registry,
      overflowCount: overflow.count,
      deferred: true,
    });
  } finally {
    internalLogging = false;
    overflow = { detected: false, count: 0 };
  }
};

export const logDrRegistryLimit = (registry: string, max: number): void => {
  if (isDrInternalLogging()) return;

  if (isDrAsyncHookEnabled()) {
    recordDrRegistryOverflow(registry);
    return;
  }

  internalLogging = true;
  try {
    console.warn("[DR] REGISTRY_LIMIT", { registry, max });
  } finally {
    internalLogging = false;
  }
};
