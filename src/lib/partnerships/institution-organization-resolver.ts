import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import type { IPartnerOrganization } from "@/models/PartnerOrganization";

type OrgLike = Pick<IPartnerOrganization, "institutionUserId" | "institutionUserIds"> & {
  _id?: mongoose.Types.ObjectId;
};

/** Canonical institution user for an organization (single-account policy). */
export const getOrganizationInstitutionUserId = (org: OrgLike | null | undefined): string | null => {
  if (!org) return null;
  if (org.institutionUserId) return String(org.institutionUserId);
  const legacy = Array.isArray(org.institutionUserIds) ? org.institutionUserIds[0] : null;
  return legacy ? String(legacy) : null;
};

export const organizationHasInstitutionAccount = (org: OrgLike | null | undefined): boolean =>
  Boolean(getOrganizationInstitutionUserId(org));

export const resolveInstitutionOrganizationForUser = async (userId: string) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const organization = await PartnerOrganization.findOne({
    $or: [{ institutionUserId: userObjectId }, { institutionUserIds: userObjectId }],
    active: { $ne: false },
  })
    .select("_id name city sector institutionUserId institutionUserIds")
    .lean();

  if (!organization) return null;

  const canonicalUserId = getOrganizationInstitutionUserId(organization);
  if (canonicalUserId && canonicalUserId !== userId) return null;

  return {
    id: String(organization._id),
    name: organization.name,
    city: organization.city || "",
    sector: organization.sector || "",
    institutionUserId: canonicalUserId,
  };
};

export const bindInstitutionUserToOrganization = async (
  organizationId: string,
  userId: string,
  options?: { allowReplace?: boolean }
): Promise<void> => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid organization or user id");
  }

  const organization = await PartnerOrganization.findById(organizationId);
  if (!organization) throw new Error("Organization not found");

  const existing = getOrganizationInstitutionUserId(organization);
  if (existing && existing !== userId && !options?.allowReplace) {
    throw new Error("Organization already has an institution account");
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  organization.institutionUserId = userObjectId;
  organization.institutionUserIds = [userObjectId];
  await organization.save();
};

export const getInstitutionUserIdsForNotifications = async (organizationId: string): Promise<string[]> => {
  await connectDB();
  const organization = await PartnerOrganization.findById(organizationId)
    .select("institutionUserId institutionUserIds")
    .lean();
  const userId = getOrganizationInstitutionUserId(organization);
  return userId ? [userId] : [];
};
