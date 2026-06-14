"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import StatCard from "@/components/layout/StatCard";
import InstitutionBrandingHeader from "@/components/institution/InstitutionBrandingHeader";
import { getLocale } from "@/lib/i18n";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  User,
  Users,
  XCircle,
} from "lucide-react";

type ProfilePayload = {
  organization: {
    id: string;
    name: string;
    logo: string;
    sector: string;
    city: string;
    category: string;
    subCategory: string;
    categoryLabelAr: string;
    categoryLabelEn: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    partnershipStartedAt: string | null;
    active: boolean;
  };
  metrics: {
    nominatedStudents: number;
    acceptedStudents: number;
    rejectedStudents: number;
    completedStudents: number;
    interviewCount: number;
    messageCount: number;
    partnershipYears: number;
    historicallyTrainedStudents: number;
  };
};

const InstitutionProfilePage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/institution/profile", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setData(json as ProfilePayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString(isAr ? "ar-SA" : "en-US");
    } catch {
      return value;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "ملف المؤسسة" : "Institution profile"}
        subtitle={isAr ? "بطاقة المؤسسة التدريبية الشريكة" : "Partner training institution card"}
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </div>
      ) : error && !data ? (
        <SectionCard>
          <p className="py-8 text-center text-red-600">{error}</p>
        </SectionCard>
      ) : data ? (
        <div className="space-y-4">
          <InstitutionBrandingHeader
            isAr={isAr}
            data={{
              name: data.organization.name,
              logo: data.organization.logo,
              sector: data.organization.sector,
              categoryLabelAr: data.organization.categoryLabelAr,
              categoryLabelEn: data.organization.categoryLabelEn,
              city: data.organization.city,
              partnershipYears: data.metrics.partnershipYears,
              historicallyTrainedStudents: data.metrics.historicallyTrainedStudents,
            }}
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title={isAr ? "الطلاب المرشحون" : "Nominated students"}
              value={data.metrics.nominatedStudents}
              icon={Users}
            />
            <StatCard
              title={isAr ? "المقبولون" : "Accepted"}
              value={data.metrics.acceptedStudents}
              icon={CheckCircle2}
            />
            <StatCard
              title={isAr ? "المرفوضون" : "Rejected"}
              value={data.metrics.rejectedStudents}
              icon={XCircle}
            />
            <StatCard
              title={isAr ? "المكتملون" : "Completed"}
              value={data.metrics.completedStudents}
              icon={CheckCircle2}
            />
            <StatCard
              title={isAr ? "المقابلات" : "Interviews"}
              value={data.metrics.interviewCount}
              icon={Calendar}
            />
            <StatCard
              title={isAr ? "الرسائل" : "Messages"}
              value={data.metrics.messageCount}
              icon={MessageSquare}
            />
            <StatCard
              title={isAr ? "سنوات الشراكة" : "Partnership years"}
              value={data.metrics.partnershipYears}
              icon={Building2}
            />
            <StatCard
              title={isAr ? "متدربون تاريخياً" : "Historical trainees"}
              value={data.metrics.historicallyTrainedStudents}
              icon={Users}
            />
          </div>

          <SectionCard>
            <h3 className="mb-4 text-base font-bold text-foreground">
              {isAr ? "معلومات المؤسسة" : "Organization information"}
            </h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold text-text-light">{isAr ? "التصنيف" : "Category"}</dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {isAr ? data.organization.categoryLabelAr || "—" : data.organization.categoryLabelEn || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-text-light">{isAr ? "التصنيف الفرعي" : "Sub-category"}</dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {data.organization.subCategory || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-text-light">{isAr ? "جهة الاتصال" : "Contact person"}</dt>
                <dd className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <User className="h-4 w-4 text-primary" aria-hidden />
                  {data.organization.contactName || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-text-light">{isAr ? "البريد الإلكتروني" : "Email"}</dt>
                <dd className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Mail className="h-4 w-4 text-primary" aria-hidden />
                  {data.organization.contactEmail || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-text-light">{isAr ? "الهاتف" : "Phone"}</dt>
                <dd className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Phone className="h-4 w-4 text-primary" aria-hidden />
                  {data.organization.contactPhone || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-text-light">{isAr ? "بداية الشراكة" : "Partnership start"}</dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {formatDate(data.organization.partnershipStartedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-text-light">{isAr ? "حالة المؤسسة" : "Status"}</dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {data.organization.active
                    ? isAr
                      ? "نشطة"
                      : "Active"
                    : isAr
                      ? "غير نشطة"
                      : "Inactive"}
                </dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      ) : null}
    </PageContainer>
  );
};

export default InstitutionProfilePage;
