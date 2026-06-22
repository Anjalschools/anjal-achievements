export const PARTNERSHIP_MESSAGE_ACTIONS_MODES = ["dropdown", "inline"] as const;

export type PartnershipMessageActionsMode = (typeof PARTNERSHIP_MESSAGE_ACTIONS_MODES)[number];

/** Platform / program setting key for message action presentation. */
export const PARTNERSHIP_MESSAGE_ACTIONS_MODE_KEY = "messageActionsMode";

export const DEFAULT_PARTNERSHIP_MESSAGE_ACTIONS_MODE: PartnershipMessageActionsMode = "dropdown";

export const normalizePartnershipMessageActionsMode = (
  value: unknown
): PartnershipMessageActionsMode =>
  value === "inline" ? "inline" : DEFAULT_PARTNERSHIP_MESSAGE_ACTIONS_MODE;
