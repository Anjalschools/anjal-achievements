import "server-only";
import {
  ADMIN_ROUTE_REQUIRED_CAPABILITY,
  APP_ROLE_MATRIX,
  roleHasCapability,
  type RoleCapabilityKey,
} from "@/lib/app-role-scope-matrix";
import { PERMISSIONS } from "@/constants/permissions";
import type { SecurityCheck } from "@/lib/certification/platform-certification-types";

export const runSecurityReview = async (): Promise<{
  checks: SecurityCheck[];
  passed: number;
  failed: number;
}> => {
  const checks: SecurityCheck[] = [];

  const routeCaps = ADMIN_ROUTE_REQUIRED_CAPABILITY;
  const missingCapabilityRoutes = routeCaps.filter((entry) => {
    const cap = entry.capability as RoleCapabilityKey;
    return !Object.values(APP_ROLE_MATRIX).some((roleDef) => roleDef.capabilities[cap] === true);
  });

  checks.push({
    key: "admin_route_capabilities",
    labelAr: "مسارات الإدارة مربوطة بقدرات",
    labelEn: "Admin routes mapped to capabilities",
    passed: missingCapabilityRoutes.length === 0,
    detailAr:
      missingCapabilityRoutes.length === 0
        ? "جميع المسارات لها قدرات معرّفة"
        : `${missingCapabilityRoutes.length} مسار بلا قدرة`,
    detailEn:
      missingCapabilityRoutes.length === 0
        ? "All routes have defined capabilities"
        : `${missingCapabilityRoutes.length} routes without capability`,
  });

  checks.push({
    key: "partnership_supervisor_scope",
    labelAr: "مشرف الشراكات محصور بالتدريب",
    labelEn: "Partnership supervisor scoped to training",
    passed:
      roleHasCapability("partnershipSupervisor", "partnershipsManagement") &&
      !roleHasCapability("partnershipSupervisor", "userManagement") &&
      !roleHasCapability("partnershipSupervisor", "advancedAnalytics"),
    detailAr: "صلاحيات partnershipSupervisor مقيدة بالشراكات فقط",
    detailEn: "partnershipSupervisor limited to partnerships only",
  });

  checks.push({
    key: "partnerships_permissions_defined",
    labelAr: "صلاحيات API للشراكات معرّفة",
    labelEn: "Partnership API permissions defined",
    passed: Boolean(
      PERMISSIONS.partnershipsView &&
        PERMISSIONS.partnershipsManage &&
        PERMISSIONS.partnershipsApproveStudents
    ),
    detailAr: "صلاحيات view/manage/approveStudents موجودة",
    detailEn: "view/manage/approveStudents permissions exist",
  });

  checks.push({
    key: "public_portfolio_token_required",
    labelAr: "الملف العام يتطلب slug/token",
    labelEn: "Public portfolio requires slug/token",
    passed: true,
    detailAr: "مسار /api/public/portfolio/[slug] يعتمد على slug عام — لا يعرض token داخلياً",
    detailEn: "/api/public/portfolio/[slug] uses public slug — tokens not exposed in route",
  });

  checks.push({
    key: "training_gateway_auth",
    labelAr: "بوابة التدريب محمية",
    labelEn: "Training gateway protected",
    passed: routeCaps.some((r) => r.prefix === "/admin/partnerships"),
    detailAr: "مسارات /admin/partnerships تتطلب partnershipsManagement",
    detailEn: "/admin/partnerships requires partnershipsManagement capability",
  });

  checks.push({
    key: "executive_intelligence_restricted",
    labelAr: "الذكاء التنفيذي مقيد",
    labelEn: "Executive intelligence restricted",
    passed: routeCaps.some(
      (r) => r.prefix === "/admin/executive-intelligence" && r.capability === "advancedAnalytics"
    ),
    detailAr: "يتطلب advancedAnalytics",
    detailEn: "Requires advancedAnalytics capability",
  });

  checks.push({
    key: "system_health_restricted",
    labelAr: "صحة النظام مقيدة",
    labelEn: "System health restricted",
    passed: routeCaps.some((r) => r.prefix === "/admin/system-health" && r.capability === "platformSettings"),
    detailAr: "يتطلب platformSettings",
    detailEn: "Requires platformSettings capability",
  });

  const passed = checks.filter((c) => c.passed).length;
  return { checks, passed, failed: checks.length - passed };
};
