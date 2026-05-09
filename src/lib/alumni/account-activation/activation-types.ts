import type { AlumniOnboardingServices } from "@/models/AlumniOnboardingRequest";
import type { AlumniActivationStatus } from "@/models/AlumniOnboardingRequest";

export type { AlumniActivationStatus };

export type AlumniOnboardingActivationRow = {
  _id: string;
  userId?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  graduationYear: number;
  universityName?: string | null;
  major?: string | null;
  degree?: string | null;
  customDegree?: string | null;
  studyCountry?: string | null;
  currentCompany?: string | null;
  currentPosition?: string | null;
  industry?: string | null;
  linkedinUrl?: string | null;
  city?: string | null;
  country?: string | null;
  bio?: string | null;
  services?: AlumniOnboardingServices | null;
};

export type AlumniActivationSuccess = {
  ok: true;
  userId: string;
  outcome: "created_new" | "linked_existing";
  emailDispatched: boolean;
  profileStatus: AlumniActivationStatus;
};

export type AlumniActivationFailure = {
  ok: false;
  code: string;
};

export type AlumniActivationResult = AlumniActivationSuccess | AlumniActivationFailure;

export const normalizeAlumniOnboardingEmail = (email: string): string =>
  String(email || "").trim().toLowerCase();
