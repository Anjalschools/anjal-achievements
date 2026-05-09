import type { AlumniPrivacySettings } from "@/models/alumni-privacy-types";

type AlumniProfileSlice = {
  privacySettings?: AlumniPrivacySettings;
  alumniServices?: { mentoring?: boolean };
};

/** Defaults: open visibility (backward-safe for legacy documents). */
export const defaultAlumniPrivacy = (): Required<AlumniPrivacySettings> => ({
  publicProfile: true,
  searchable: true,
  showEmail: false,
  showLinkedIn: true,
  showCompany: true,
  allowMentorshipRequests: true,
});

export const effectivePrivacy = (ap?: AlumniProfileSlice | null): Required<AlumniPrivacySettings> => {
  const d = defaultAlumniPrivacy();
  const p = ap?.privacySettings;
  if (!p) return d;
  return {
    publicProfile: p.publicProfile !== false,
    searchable: p.searchable !== false,
    showEmail: p.showEmail === true,
    showLinkedIn: p.showLinkedIn !== false,
    showCompany: p.showCompany !== false,
    allowMentorshipRequests: p.allowMentorshipRequests !== false,
  };
};

export const isAlumniSearchable = (ap?: AlumniProfileSlice | null): boolean => effectivePrivacy(ap).searchable;

export const isMentorDiscoverable = (ap?: AlumniProfileSlice | null): boolean => {
  const e = effectivePrivacy(ap);
  return e.publicProfile && e.allowMentorshipRequests && ap?.alumniServices?.mentoring === true;
};

/** Strip sensitive alumni fields for public API responses; null = profile hidden. */
export const redactAlumniProfileForPublic = (ap?: unknown): Record<string, unknown> | null => {
  if (!ap || typeof ap !== "object") return {};
  const e = effectivePrivacy(ap as AlumniProfileSlice);
  if (!e.publicProfile) return null;
  const out: Record<string, unknown> = { ...(ap as Record<string, unknown>) };
  delete out.privacySettings;
  if (!e.showLinkedIn) delete out.linkedinUrl;
  if (!e.showCompany) {
    delete out.currentCompany;
    delete out.currentPosition;
    delete out.industry;
  }
  return out;
};
