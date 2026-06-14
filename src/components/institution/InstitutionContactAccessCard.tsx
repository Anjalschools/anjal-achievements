"use client";

import SectionCard from "@/components/layout/SectionCard";
import { Mail, MessageSquare, Phone, Shield } from "lucide-react";

export type InstitutionContactAccessView = {
  hasAccess: boolean;
  pendingApproval: boolean;
  studentPhone: string | null;
  parentPhone: string | null;
  studentEmail: string | null;
};

type InstitutionContactAccessCardProps = {
  contactAccess: InstitutionContactAccessView;
  isAr: boolean;
};

const InstitutionContactAccessCard = ({ contactAccess, isAr }: InstitutionContactAccessCardProps) => {
  const rows = [
    {
      label: isAr ? "جوال الطالب" : "Student phone",
      value: contactAccess.studentPhone,
      icon: Phone,
    },
    {
      label: isAr ? "جوال ولي الأمر" : "Parent phone",
      value: contactAccess.parentPhone,
      icon: Phone,
    },
    {
      label: isAr ? "البريد الإلكتروني" : "Email",
      value: contactAccess.studentEmail,
      icon: Mail,
    },
  ].filter((row) => row.value);

  return (
    <SectionCard padding="sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
        <Shield className="h-4 w-4 text-primary" aria-hidden />
        {isAr ? "بيانات التواصل" : "Contact information"}
      </h3>

      {!contactAccess.hasAccess ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">
            {isAr ? "بيانات التواصل غير متاحة حالياً" : "Contact information is not available yet"}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "يرجى التواصل عبر المنصة" : "Please communicate through the platform"}
          </p>
          {contactAccess.pendingApproval ? (
            <p className="mt-2 text-xs font-semibold">
              {isAr ? "بانتظار موافقة مشرف الشراكات" : "Awaiting partnerships supervisor approval"}
            </p>
          ) : null}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-text-light">
          {isAr ? "لا توجد بيانات مشاركة حالياً." : "No shared contact fields at this time."}
        </p>
      ) : (
        <dl className="space-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
              <row.icon className="h-4 w-4 text-primary" aria-hidden />
              <div>
                <dt className="text-xs font-bold text-text-light">{row.label}</dt>
                <dd className="font-semibold text-foreground">{row.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      )}
    </SectionCard>
  );
};

export default InstitutionContactAccessCard;
