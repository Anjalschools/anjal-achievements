import "server-only";
/**
 * @deprecated Use `@/lib/alumni/account-activation/send-activation-email` (new vs linked flows).
 * Kept for backward compatibility with any external imports.
 */
import type { AlumniOnboardingServices } from "@/models/AlumniOnboardingRequest";
import { sendLinkedAlumniActivationEmail } from "@/lib/alumni/account-activation/send-activation-email";

export type SendAlumniApprovalEmailInput = {
  to: string;
  recipientName: string;
  useExistingPortalPassword: boolean;
  services?: AlumniOnboardingServices | null;
};

/** @deprecated */
export const sendAlumniApprovalEmail = async (input: SendAlumniApprovalEmailInput): Promise<boolean> => {
  return sendLinkedAlumniActivationEmail({
    to: input.to,
    recipientName: input.recipientName,
    services: input.services,
  });
};
