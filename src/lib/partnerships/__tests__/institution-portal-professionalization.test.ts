import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

const readSrc = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Phase 10.2.5 — institution portal professionalization", () => {
  it("defines institution supervisor channel inquiry type", async () => {
    const mod = await import("@/lib/partnerships/institution-portal-constants");
    expect(mod.INSTITUTION_SUPERVISOR_INQUIRY_TYPE).toBe("institution_supervisor_channel");
    expect(mod.INSTITUTION_QUICK_ACTION_TEMPLATES.request_cv).toBeTruthy();
    expect(mod.DEFAULT_INSTITUTION_NOTIFICATION_SETTINGS.newStudents).toBe(true);
  });

  it("exports institution portal profile service", () => {
    const src = readSrc("src/lib/partnerships/institution-portal-profile-service.ts");
    expect(src).toContain("buildInstitutionPortalProfile");
    expect(src).toContain("buildInstitutionRecentActivity");
    expect(src).toContain("buildInstitutionPortalDashboard");
    expect(src).toContain("updateInstitutionNotificationSettings");
  });

  it("exports institution quick actions service", () => {
    const src = readSrc("src/lib/partnerships/institution-portal-quick-actions-service.ts");
    expect(src).toContain("executeInstitutionConversationQuickAction");
    expect(src).toContain("createApplicationRequirement");
    expect(src).toContain("executeInstitutionReviewDecision");
  });

  it("extends institution messaging with supervisor thread helpers", async () => {
    const mod = await import("@/lib/partnerships/institution-messaging-service");
    expect(typeof mod.listInstitutionMessagingCenter).toBe("function");
    expect(typeof mod.ensureInstitutionSupervisorThread).toBe("function");
    expect(typeof mod.sendInstitutionSupervisorMessage).toBe("function");
  });

  it("stores institution notification settings on PartnerOrganization", async () => {
    const src = readSrc("src/models/PartnerOrganization.ts");
    expect(src).toContain("institutionNotificationSettings");
    expect(src).toContain("newStudents");
    expect(src).toContain("finalReports");
  });

  it("registers institution profile API route", () => {
    const src = readSrc("src/app/api/institution/profile/route.ts");
    expect(src).toContain("buildInstitutionPortalProfile");
    expect(src).toContain("updateInstitutionNotificationSettings");
  });

  it("registers institution dashboard API route", () => {
    const src = readSrc("src/app/api/institution/dashboard/route.ts");
    expect(src).toContain("buildInstitutionPortalDashboard");
    expect(src).toContain("listInstitutionCandidatePipeline");
    expect(src).toContain("buildInstitutionRecruitmentAnalytics");
  });

  it("registers quick actions API route", () => {
    const src = readSrc("src/app/api/institution/training/quick-actions/route.ts");
    expect(src).toContain("executeInstitutionConversationQuickAction");
  });

  it("messages API returns categorized threads", () => {
    const src = readSrc("src/app/api/institution/training/messages/route.ts");
    expect(src).toContain("listInstitutionMessagingCenter");
    expect(src).toContain("studentThreads");
    expect(src).toContain("supervisorThread");
    expect(src).toContain("sendInstitutionSupervisorMessage");
  });

  it("has institution profile page without student achievement metrics", () => {
    const src = readSrc("src/app/(app)/institution/profile/page.tsx");
    expect(src).toContain("nominatedStudents");
    expect(src).toContain("partnershipYears");
    expect(src).not.toContain("totalAchievements");
    expect(src).not.toContain("bestAchievement");
  });

  it("has institution settings with notification toggles only", () => {
    const src = readSrc("src/app/(app)/institution/settings/page.tsx");
    expect(src).toContain("newStudents");
    expect(src).toContain("finalReports");
    expect(src).not.toContain("privacy");
    expect(src).not.toContain("showEmail");
  });

  it("messages page includes quick actions component", () => {
    const src = readSrc("src/app/(app)/institution/training/messages/page.tsx");
    expect(src).toContain("InstitutionConversationQuickActions");
    expect(src).toContain("supervisorThread");
    expect(src).toContain("studentThreads");
  });

  it("dashboard page includes recent activity and quick actions", () => {
    const src = readSrc("src/app/(app)/institution/training/page.tsx");
    expect(src).toContain("Recent activity");
    expect(src).toContain("Quick actions");
    expect(src).toContain("/api/institution/dashboard");
    expect(src).toContain("InstitutionBrandingHeader");
    expect(src).toContain("InstitutionRecruitmentAnalytics");
    expect(src).toContain("INSTITUTION_PIPELINE_STAGES");
  });

  it("sidebar points institution users to institution profile and settings", () => {
    const src = readSrc("src/components/layout/AppSidebar.tsx");
    expect(src).toContain('href: "/institution/profile"');
    expect(src).toContain('href: "/institution/settings"');
    expect(src).toContain("institutionProfileItem");
    expect(src).toContain("institutionSettingsItem");
  });

  it("redirects trainingInstitution away from student profile", () => {
    const profileSrc = readSrc("src/app/(app)/profile/page.tsx");
    const settingsSrc = readSrc("src/app/(app)/settings/page.tsx");
    expect(profileSrc).toContain('router.replace("/institution/profile")');
    expect(settingsSrc).toContain('router.replace("/institution/settings")');
  });

  it("quick actions component covers required actions", () => {
    const src = readSrc("src/components/institution/InstitutionConversationQuickActions.tsx");
    expect(src).toContain("request_cv");
    expect(src).toContain("request_intro_video");
    expect(src).toContain("schedule_interview");
    expect(src).toContain("send_zoom_link");
    expect(src).toContain("accept_student");
    expect(src).toContain("reject_student");
    expect(src).toContain("send_feedback");
  });

  it("institution scope helpers remain available for visibility rules", async () => {
    const mod = await import("@/lib/partnerships/institution-scope");
    expect(typeof mod.assertInstitutionApplicationAccess).toBe("function");
    expect(typeof mod.resolveInstitutionApplicationScope).toBe("function");
  });

  it("messaging service logs audit for institution messages", () => {
    const src = readSrc("src/lib/partnerships/institution-messaging-service.ts");
    expect(src).toContain("institution_supervisor_thread_created");
    expect(src).toContain("institution_supervisor_message_sent");
    expect(src).toContain("institution_student_message_sent");
    expect(src).toContain("logAuditEvent");
  });
});

describe("regression protection — protected engines untouched", () => {
  it("achievement scoring module remains importable", async () => {
    const mod = await import("@/lib/achievement-scoring");
    expect(mod).toBeTruthy();
  });

  it("academic year resolver remains importable", async () => {
    const mod = await import("@/lib/academic-years/current-academic-year");
    expect(typeof mod.getCurrentAcademicYear).toBe("function");
  });

  it("institution portal service decision flow remains importable", () => {
    const src = readSrc("src/lib/partnerships/institution-portal-service.ts");
    expect(src).toContain("executeInstitutionReviewDecision");
    expect(src).toContain("getInstitutionApplicationDetail");
  });
});
