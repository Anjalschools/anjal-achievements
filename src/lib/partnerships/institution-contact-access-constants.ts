export const CONTACT_ACCESS_TIMELINE_ACTIONS = {
  granted: "contact_access_granted",
  updated: "contact_access_updated",
  revoked: "contact_access_revoked",
} as const;

export const CONTACT_ACCESS_AUDIT_ACTIONS = {
  granted: "contact_access_granted",
  updated: "contact_access_updated",
  revoked: "contact_access_revoked",
} as const;

export type ContactAccessShareFlags = {
  shareStudentPhone: boolean;
  shareParentPhone: boolean;
  shareStudentEmail: boolean;
  shareInstitutionContact: boolean;
};

export const DEFAULT_CONTACT_ACCESS_FLAGS: ContactAccessShareFlags = {
  shareStudentPhone: false,
  shareParentPhone: false,
  shareStudentEmail: false,
  shareInstitutionContact: false,
};

export type GatedInstitutionContactView = {
  hasAccess: boolean;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
};

export const stripOrganizationContactForStudent = <T extends Record<string, unknown>>(
  organization: T | null | undefined,
  access: GatedInstitutionContactView | null
): T | undefined => {
  if (!organization) return undefined;
  if (access?.hasAccess) {
    return {
      ...organization,
      contactName: access.contactName || "",
      contactPhone: access.contactPhone || "",
      contactEmail: access.contactEmail || "",
    };
  }
  const { contactName: _cn, contactPhone: _cp, contactEmail: _ce, ...rest } = organization;
  return rest as T;
};
