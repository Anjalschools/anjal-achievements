import type { IPartnerOrganization } from "@/models/PartnerOrganization";
import type { ITrainingOpportunity } from "@/models/TrainingOpportunity";

type LeanOrg = Pick<
  IPartnerOrganization,
  | "name"
  | "logo"
  | "sector"
  | "city"
  | "contactName"
  | "contactEmail"
  | "contactPhone"
  | "notes"
  | "category"
  | "subCategory"
  | "averageRating"
  | "ratingCount"
  | "institutionUserId"
  | "institutionUserIds"
  | "active"
> & { _id?: { toString(): string } };

type LeanOpp = Pick<
  ITrainingOpportunity,
  | "title"
  | "description"
  | "organizationId"
  | "targetGender"
  | "targetStages"
  | "targetGrades"
  | "seats"
  | "reserveSeats"
  | "academicYear"
  | "registrationStart"
  | "registrationEnd"
  | "trainingStart"
  | "trainingEnd"
  | "visible"
  | "active"
> & { _id?: { toString(): string } };

export const serializePartnerOrganization = (row: LeanOrg) => ({
  id: String(row._id),
  name: row.name,
  logo: row.logo || "",
  sector: row.sector || "",
  city: row.city || "",
  contactName: row.contactName || "",
  contactEmail: row.contactEmail || "",
  contactPhone: row.contactPhone || "",
  notes: row.notes || "",
  category: row.category || "",
  subCategory: row.subCategory || "",
  averageRating: typeof row.averageRating === "number" ? row.averageRating : 0,
  ratingCount: typeof row.ratingCount === "number" ? row.ratingCount : 0,
  institutionUserId: row.institutionUserId
    ? String(row.institutionUserId)
    : Array.isArray(row.institutionUserIds) && row.institutionUserIds[0]
      ? String(row.institutionUserIds[0])
      : null,
  institutionUserIds: Array.isArray(row.institutionUserIds)
    ? row.institutionUserIds.map((id) => String(id))
    : [],
  active: row.active !== false,
});

export const serializeTrainingOpportunity = (row: LeanOpp, organization?: LeanOrg | null) => ({
  id: String(row._id),
  title: row.title,
  description: row.description || "",
  organizationId: String(row.organizationId),
  organization: organization ? serializePartnerOrganization(organization) : undefined,
  targetGender: row.targetGender,
  targetStages: Array.isArray(row.targetStages) ? row.targetStages : [],
  targetGrades: Array.isArray(row.targetGrades) ? row.targetGrades : [],
  seats: typeof row.seats === "number" ? row.seats : 0,
  reserveSeats: typeof row.reserveSeats === "number" ? row.reserveSeats : 0,
  academicYear: row.academicYear || "",
  registrationStart: row.registrationStart ? new Date(row.registrationStart).toISOString() : null,
  registrationEnd: row.registrationEnd ? new Date(row.registrationEnd).toISOString() : null,
  trainingStart: row.trainingStart ? new Date(row.trainingStart).toISOString() : null,
  trainingEnd: row.trainingEnd ? new Date(row.trainingEnd).toISOString() : null,
  visible: row.visible === true,
  active: row.active !== false,
});

export const parseOptionalDate = (value: unknown): Date | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
};
