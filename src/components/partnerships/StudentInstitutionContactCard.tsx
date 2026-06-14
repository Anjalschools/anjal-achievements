"use client";

import SectionCard from "@/components/layout/SectionCard";
import { Building2, Mail, Phone, User } from "lucide-react";

export type StudentInstitutionContactView = {
  hasAccess: boolean;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
};

type StudentInstitutionContactCardProps = {
  institutionContact: StudentInstitutionContactView | null;
  isAr: boolean;
};

const StudentInstitutionContactCard = ({ institutionContact, isAr }: StudentInstitutionContactCardProps) => {
  if (!institutionContact?.hasAccess) return null;

  const rows = [
    {
      label: isAr ? "جهة الاتصال" : "Contact person",
      value: institutionContact.contactName,
      icon: User,
    },
    {
      label: isAr ? "الجوال" : "Phone",
      value: institutionContact.contactPhone,
      icon: Phone,
    },
    {
      label: isAr ? "البريد الإلكتروني" : "Email",
      value: institutionContact.contactEmail,
      icon: Mail,
    },
  ].filter((row) => row.value);

  if (rows.length === 0) return null;

  return (
    <SectionCard>
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
        <Building2 className="h-4 w-4 text-primary" aria-hidden />
        {isAr ? "بيانات تواصل المؤسسة" : "Institution contact details"}
      </h2>
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
    </SectionCard>
  );
};

export default StudentInstitutionContactCard;
