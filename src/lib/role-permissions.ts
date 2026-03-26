import type { AppRole } from "@/lib/app-role-scope-matrix";
import { ALL_PERMISSIONS, PERMISSIONS, type PermissionKey } from "@/constants/permissions";

export const ROLE_DEFAULT_PERMISSIONS: Record<AppRole, PermissionKey[]> = {
  student: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.achievementsView,
    PERMISSIONS.achievementsCreate,
  ],
  admin: [...ALL_PERMISSIONS],
  supervisor: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.achievementsView,
    PERMISSIONS.achievementsCreateAdmin,
    PERMISSIONS.achievementsReview,
    PERMISSIONS.achievementsApprove,
    PERMISSIONS.achievementsRequestRevision,
    PERMISSIONS.achievementsReject,
    PERMISSIONS.achievementsFeature,
    PERMISSIONS.reportsView,
    PERMISSIONS.analyticsView,
    PERMISSIONS.usersManage,
    PERMISSIONS.auditLogView,
    PERMISSIONS.contactMessagesManage,
    PERMISSIONS.accessMatrixView,
  ],
  schoolAdmin: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.achievementsView,
    PERMISSIONS.achievementsCreateAdmin,
    PERMISSIONS.achievementsReview,
    PERMISSIONS.achievementsApprove,
    PERMISSIONS.achievementsRequestRevision,
    PERMISSIONS.achievementsReject,
    PERMISSIONS.achievementsFeature,
    PERMISSIONS.reportsView,
    PERMISSIONS.analyticsView,
    PERMISSIONS.contactMessagesManage,
    PERMISSIONS.accessMatrixView,
  ],
  teacher: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.achievementsView,
    PERMISSIONS.achievementsCreateAdmin,
    PERMISSIONS.achievementsReview,
    PERMISSIONS.achievementsApprove,
    PERMISSIONS.achievementsRequestRevision,
    PERMISSIONS.achievementsReject,
    PERMISSIONS.reportsView,
    PERMISSIONS.contactMessagesManage,
    PERMISSIONS.accessMatrixView,
  ],
  judge: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.achievementsView,
    PERMISSIONS.achievementsReview,
    PERMISSIONS.achievementsApprove,
    PERMISSIONS.achievementsRequestRevision,
    PERMISSIONS.achievementsReject,
    PERMISSIONS.accessMatrixView,
  ],
};

export const getRolePermissions = (
  role: string | null | undefined,
  rolePermissionOverrides?: Partial<Record<AppRole, PermissionKey[]>>
): PermissionKey[] => {
  const r = String(role || "") as AppRole;
  const defaults = ROLE_DEFAULT_PERMISSIONS[r] || [];
  const override = rolePermissionOverrides?.[r];
  return Array.from(new Set((override && Array.isArray(override) ? override : defaults) as PermissionKey[]));
};

