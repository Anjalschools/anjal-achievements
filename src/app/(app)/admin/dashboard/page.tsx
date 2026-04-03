"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, memo } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { getLocale } from "@/lib/i18n";
import type { AdminDashboardPayload } from "@/lib/admin-dashboard-stats";
import { roleAccentClass, roleLabel } from "@/lib/admin-dashboard-ui-labels";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  Loader2,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
  UserPlus,
  Users,
  XCircle,
  FileBarChart,
} from "lucide-react";

const AdminDashboardCharts = dynamic(() => import("@/components/admin/AdminDashboardCharts"), {
  ssr: false,
  loading: () => (
    <div className="grid gap-6 lg:grid-cols-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-64 animate-pulse rounded-2xl border border-gray-100 bg-gray-100 lg:col-span-2"
        />
      ))}
    </div>
  ),
});

type StatDef = {
  id: string;
  value: number;
  titleAr: string;
  titleEn: string;
  icon: typeof Users;
  tone: "slate" | "amber" | "orange" | "emerald" | "violet" | "rose" | "sky";
};

const toneClass: Record<StatDef["tone"], string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-900",
  amber: "border-amber-200 bg-amber-50 text-amber-950",
  orange: "border-orange-200 bg-orange-50 text-orange-950",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
  violet: "border-violet-200 bg-violet-50 text-violet-950",
  rose: "border-rose-200 bg-rose-50 text-rose-950",
  sky: "border-sky-200 bg-sky-50 text-sky-950",
};

const StatTile = memo(({ def, isAr }: { def: StatDef; isAr: boolean }) => {
  const Icon = def.icon;
  return (
    <div
      className={`flex flex-col rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md md:p-5 ${toneClass[def.tone]}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide opacity-80">
          {isAr ? def.titleAr : def.titleEn}
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 shadow-sm ring-1 ring-black/5">
          <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        </span>
      </div>
      <p className="text-3xl font-black tabular-nums md:text-4xl">{def.value}</p>
    </div>
  );
});
StatTile.displayName = "StatTile";

const AdminDashboardPage = () => {
  const router = useRouter();
  const locale = getLocale();
  const isAr = locale === "ar";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [viewerRole, setViewerRole] = useState<string>("");
  const [data, setData] = useState<AdminDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (!res.ok) {
          setAllowed(false);
          return;
        }
        const j = await res.json();
        const role = String(j.role || "");
        setViewerRole(role);
        setAllowed(["admin", "supervisor", "schoolAdmin", "teacher", "judge"].includes(role));
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        setAllowed(false);
        return;
      }
      const j = (await res.json()) as AdminDashboardPayload & { error?: string };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (allowed !== true) return;
    void load();
  }, [allowed, load]);

  const statDefs = useMemo<StatDef[]>(
    () => [
      {
        id: "total",
        value: data?.stats.totalAchievements ?? 0,
        titleAr: "إجمالي الإنجازات",
        titleEn: "Total achievements",
        icon: BarChart3,
        tone: "slate",
      },
      {
        id: "pending",
        value: data?.stats.pendingReview ?? 0,
        titleAr: "قيد المراجعة",
        titleEn: "Under review",
        icon: ClipboardList,
        tone: "amber",
      },
      {
        id: "revision",
        value: data?.stats.needsRevision ?? 0,
        titleAr: "يحتاج تعديل",
        titleEn: "Needs revision",
        icon: AlertTriangle,
        tone: "orange",
      },
      {
        id: "resub",
        value: data?.stats.resubmitted ?? 0,
        titleAr: "تم تعديلها",
        titleEn: "Resubmitted",
        icon: RefreshCw,
        tone: "sky",
      },
      {
        id: "approved",
        value: data?.stats.approved ?? 0,
        titleAr: "معتمد",
        titleEn: "Approved",
        icon: CheckCircle2,
        tone: "emerald",
      },
      {
        id: "featured",
        value: data?.stats.featured ?? 0,
        titleAr: "مميز",
        titleEn: "Featured",
        icon: Star,
        tone: "violet",
      },
      {
        id: "rejected",
        value: data?.stats.rejected ?? 0,
        titleAr: "مرفوض",
        titleEn: "Rejected",
        icon: XCircle,
        tone: "rose",
      },
      {
        id: "ai",
        value: data?.stats.aiAlerts ?? 0,
        titleAr: "تنبيهات الذكاء الاصطناعي",
        titleEn: "AI review queue",
        icon: Bot,
        tone: "violet",
      },
      {
        id: "users",
        value: data?.stats.totalUsers ?? 0,
        titleAr: "إجمالي المستخدمين",
        titleEn: "Total users",
        icon: Users,
        tone: "slate",
      },
    ],
    [data]
  );

  if (allowed === false) {
    return (
      <PageContainer>
        <p className="p-6 text-sm text-red-700" dir={isAr ? "rtl" : "ltr"}>
          {isAr ? "غير مصرح لك بعرض لوحة الإدارة." : "You are not allowed to view the admin dashboard."}
        </p>
      </PageContainer>
    );
  }

  if (allowed === null) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-24 text-text-light" dir={isAr ? "rtl" : "ltr"}>
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحقق من الصلاحيات…" : "Checking access…"}</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
        <header className="border-b border-gray-200/80 pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                {isAr ? "قيادة المنصة" : "Platform command"}
              </p>
              <h1 className="mt-1 text-4xl font-black tracking-tight text-text sm:text-5xl">
                {isAr ? "لوحة الإدارة" : "Admin dashboard"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-light sm:text-base">
                {isAr
                  ? "مؤشرات تشغيلية، تحليلات، وتنبيهات مختصرة — نظرة تنفيذية على الإنجازات والمستخدمين دون استبدال صفحة المراجعة."
                  : "Operational KPIs, analytics, and concise alerts — an executive view of achievements and users, not a substitute for the review workspace."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-text shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" />}
              {isAr ? "تحديث البيانات" : "Refresh data"}
            </button>
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900"
          >
            {error}
          </div>
        ) : null}

        {allowed === true && !data && loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-text-light">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
          </div>
        ) : null}

        {data ? (
          <>
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-text-muted">
                {isAr ? "المؤشرات الرئيسية" : "Key indicators"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {statDefs.map((d) => (
                  <StatTile key={d.id} def={d} isAr={isAr} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-text-muted">
                {isAr ? "التحليلات والرسوم" : "Analytics & charts"}
              </h2>
              <AdminDashboardCharts data={data} isAr={isAr} />
            </section>

            <section className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
                <h2 className="mb-1 text-lg font-bold text-text">
                  {isAr ? "توزيع المستخدمين حسب الدور" : "Users by role"}
                </h2>
                <p className="mb-4 text-xs text-text-light">
                  {isAr
                    ? "جميع الأدوار المعتمدة في النظام (يُعرض الصفر عند عدم وجود حسابات)."
                    : "All registered roles (zero shown when no accounts exist)."}
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {data.usersByRole.map((r) => (
                    <div
                      key={r.role}
                      className={`rounded-xl border px-3 py-2.5 ${roleAccentClass(r.role)}`}
                    >
                      <p className="text-[11px] font-bold leading-tight opacity-90">{roleLabel(r.role, isAr)}</p>
                      <p className="mt-0.5 text-xl font-black tabular-nums">{r.count}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-4 shadow-sm md:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-700" aria-hidden />
                  <h2 className="text-lg font-bold text-violet-950">
                    {isAr ? "رؤى الذكاء الاصطناعي" : "AI insights"}
                  </h2>
                </div>
                <p className="mb-3 text-xs leading-relaxed text-violet-900/80">
                  {isAr
                    ? "عدد السجلات التي تحتاج متابعة في كل فئة؛ انتقل إلى تبويب المراجعة المناسب عند وجود حالات."
                    : "Counts of records needing follow-up per category; open the matching review tab when non-zero."}
                </p>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  <AiInsightCard
                    isAr={isAr}
                    count={data.stats.duplicateSuspicion}
                    titleAr="اشتباه تكرار"
                    titleEn="Duplicate suspicion"
                    descAr="سجلات مُعلَّمة باحتمال تكرار."
                    descEn="Records flagged for possible duplication."
                    href="/admin/achievements/review?tab=duplicate"
                  />
                  <AiInsightCard
                    isAr={isAr}
                    count={data.stats.attachmentUnclear}
                    titleAr="مرفقات غير واضحة"
                    titleEn="Unclear attachments"
                    descAr="مرفقات تحتاج توضيحاً بصرياً أو نصّياً."
                    descEn="Attachments that need clearer evidence."
                    href="/admin/achievements/review?tab=attachment_ai_unclear"
                  />
                  <AiInsightCard
                    isAr={isAr}
                    count={data.stats.attachmentMismatch}
                    titleAr="مرفقات غير مطابقة"
                    titleEn="Mismatched attachments"
                    descAr="المرفق لا يتماشى مع وصف الإنجاز."
                    descEn="Attachment content misaligned with the achievement."
                    href="/admin/achievements/review?tab=attachment_ai_mismatch"
                  />
                  <AiInsightCard
                    isAr={isAr}
                    count={data.stats.aiAlerts}
                    titleAr="طابور مراجعة الذكاء الاصطناعي"
                    titleEn="AI review queue"
                    descAr="إجمالي ما يظهر في تبويب فحص الذكاء الاصطناعي."
                    descEn="Total items in the AI inspection tab."
                    href="/admin/achievements/review?tab=ai_flagged"
                  />
                </ul>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm md:p-5">
                <div className="mb-1 flex items-center gap-2">
                  <FileWarning className="h-5 w-5 text-amber-800" aria-hidden />
                  <h2 className="text-lg font-bold text-amber-950">
                    {isAr ? "الأولوية الآن" : "Priority now"}
                  </h2>
                </div>
                <p className="mb-4 text-xs text-amber-950/80">
                  {isAr
                    ? "أقرب طابور عمل للمراجعة؛ «عرض الكل» يفتح التبويب المطابق في صفحة المراجعة."
                    : "Nearest work queues; “View all” opens the matching tab on the review page."}
                </p>
                <div className="space-y-4 text-sm">
                  <PriorityBlock
                    titleAr="قيد المراجعة"
                    titleEn="Pending review"
                    descAr="طلبات تنتظر قرار اللجنة (الأقدم في المعاينة أولاً)."
                    descEn="Awaiting committee action (preview sorted oldest first)."
                    href="/admin/achievements/review?tab=pending"
                    count={data.priorityQueue.pendingReview.count}
                    items={data.priorityQueue.pendingReview.items}
                    isAr={isAr}
                  />
                  <PriorityBlock
                    titleAr="معادة بعد التعديل"
                    titleEn="Resubmitted after revision"
                    descAr="أُعيدت بعد تعديل الطالب وفق الملاحظات."
                    descEn="Returned by students after addressing feedback."
                    href="/admin/achievements/review?tab=pending_re_review"
                    count={data.priorityQueue.resubmitted.count}
                    items={data.priorityQueue.resubmitted.items}
                    isAr={isAr}
                  />
                  <PriorityBlock
                    titleAr="تنبيهات الذكاء الاصطناعي"
                    titleEn="AI-flagged records"
                    descAr="تحتاج متابعة (مرفقات، تكرار، أو علامات آلية)."
                    descEn="Follow-up on attachments, duplicates, or automated flags."
                    href="/admin/achievements/review?tab=ai_flagged"
                    count={data.priorityQueue.aiReview.count}
                    items={data.priorityQueue.aiReview.items}
                    isAr={isAr}
                  />
                  <PriorityBlock
                    titleAr="قيد المراجعة — متأخرة (+٧ أيام)"
                    titleEn="Stale pending (+7 days)"
                    descAr="لم تُحدَّث ضمن الطابور العادي منذ أكثر من أسبوع."
                    descEn="Still pending with no update for over seven days."
                    href="/admin/achievements/review?tab=pending"
                    count={data.priorityQueue.stale.count}
                    items={data.priorityQueue.stale.items}
                    isAr={isAr}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
                <h2 className="mb-1 text-lg font-bold text-text">
                  {isAr ? "إجراءات سريعة" : "Quick actions"}
                </h2>
                <p className="mb-4 text-xs text-text-light">
                  {isAr ? "اختصارات تنفيذية لأكثر المهام الإدارية استخداماً." : "Shortcuts to common admin tasks."}
                </p>
                <div className="grid gap-2.5 sm:grid-cols-1">
                  <QuickLink
                    href="/admin/achievements/review"
                    icon={ClipboardList}
                    titleAr="مراجعة الإنجازات"
                    titleEn="Review achievements"
                    isAr={isAr}
                  />
                  {roleHasCapability(viewerRole, "userManagement") ? (
                    <>
                      <QuickLink
                        href="/admin/users"
                        icon={Users}
                        titleAr="إدارة المستخدمين"
                        titleEn="User management"
                        isAr={isAr}
                      />
                      <QuickLink
                        href="/admin/users/new"
                        icon={UserPlus}
                        titleAr="إضافة مستخدم جديد"
                        titleEn="Add new user"
                        isAr={isAr}
                      />
                    </>
                  ) : null}
                  {roleHasCapability(viewerRole, "reports") ? (
                    <QuickLink
                      href="/admin/achievements/reports"
                      icon={FileBarChart}
                      titleAr="التقارير"
                      titleEn="Reports"
                      isAr={isAr}
                    />
                  ) : null}
                  <QuickLink
                    href="/settings"
                    icon={Settings}
                    titleAr="الإعدادات"
                    titleEn="Settings"
                    isAr={isAr}
                  />
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </PageContainer>
  );
};

const AiInsightCard = memo(
  ({
    isAr,
    count,
    titleAr,
    titleEn,
    descAr,
    descEn,
    href,
  }: {
    isAr: boolean;
    count: number;
    titleAr: string;
    titleEn: string;
    descAr: string;
    descEn: string;
    href: string;
  }) => {
    const title = isAr ? titleAr : titleEn;
    const desc = isAr ? descAr : descEn;
    const zero = count === 0;
    const shellClass = zero
      ? "rounded-xl border border-violet-100/80 bg-white/60 px-3 py-2.5"
      : "rounded-xl border border-violet-200 bg-white px-3 py-2.5 shadow-sm ring-1 ring-violet-100/80 transition hover:border-violet-300 hover:shadow-md";

    const body = (
      <>
        <p className="text-xs font-bold text-violet-900">{title}</p>
        {zero ? (
          <p className="mt-1.5 text-sm font-medium text-text-muted">
            {isAr ? "لا توجد حالات" : "No cases"}
          </p>
        ) : (
          <p className="mt-0.5 text-2xl font-black tabular-nums text-violet-950">{count}</p>
        )}
        <p className="mt-1 text-[11px] leading-snug text-violet-900/70">{desc}</p>
        {!zero ? (
          <p className="mt-2 text-[11px] font-semibold text-primary">
            {isAr ? "فتح التبويب ←" : "Open tab →"}
          </p>
        ) : null}
      </>
    );

    if (zero) {
      return <li className={shellClass}>{body}</li>;
    }

    return (
      <li>
        <Link href={href} className={`block ${shellClass}`}>
          {body}
        </Link>
      </li>
    );
  }
);
AiInsightCard.displayName = "AiInsightCard";

const PriorityBlock = memo(
  ({
    titleAr,
    titleEn,
    descAr,
    descEn,
    href,
    count,
    items,
    isAr,
  }: {
    titleAr: string;
    titleEn: string;
    descAr: string;
    descEn: string;
    href: string;
    count: number;
    items: { id: string; titleAr: string; titleEn: string }[];
    isAr: boolean;
  }) => (
    <div className="rounded-xl border border-amber-200/70 bg-white/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-amber-950">{isAr ? titleAr : titleEn}</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-amber-950">{count}</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-950/75">{isAr ? descAr : descEn}</p>
        </div>
        <Link
          href={href}
          className="shrink-0 text-xs font-bold text-primary underline-offset-2 hover:underline"
        >
          {isAr ? "عرض الكل" : "View all"}
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 border-t border-amber-200/50 pt-2 text-xs text-text-light">
          {isAr ? "لا عناصر في المعاينة." : "No preview rows."}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5 border-t border-amber-200/50 pt-2">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/admin/achievements/review/${it.id}`}
                className="line-clamp-2 text-xs font-medium text-text hover:text-primary hover:underline"
              >
                <span>{isAr ? it.titleAr : it.titleEn}</span>
                {isAr ? (
                  <span className="mt-0.5 block text-[10px] font-normal text-text-light" dir="ltr" lang="en">
                    {it.titleEn}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
);
PriorityBlock.displayName = "PriorityBlock";

const QuickLink = memo(
  ({
    href,
    icon: Icon,
    titleAr,
    titleEn,
    isAr,
  }: {
    href: string;
    icon: typeof Settings;
    titleAr: string;
    titleEn: string;
    isAr: boolean;
  }) => (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-gray-100">
        <Icon className="h-5 w-5 text-primary" aria-hidden />
      </span>
      <span className="font-semibold text-text">{isAr ? titleAr : titleEn}</span>
    </Link>
  )
);
QuickLink.displayName = "QuickLink";

export default AdminDashboardPage;
