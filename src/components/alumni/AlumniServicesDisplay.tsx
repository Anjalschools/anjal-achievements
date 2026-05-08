"use client";

type Services = {
  mentoring?: boolean;
  internships?: boolean;
  jobs?: boolean;
  workshops?: boolean;
  judging?: boolean;
  sponsorship?: boolean;
};

type AlumniServicesDisplayProps = {
  services: Services | null | undefined;
  locale: "ar" | "en";
};

export const AlumniServicesDisplay = ({ services, locale }: AlumniServicesDisplayProps) => {
  const isAr = locale === "ar";
  const items = [
    { key: "mentoring", labelAr: "الإرشاد", labelEn: "Mentoring", on: services?.mentoring === true },
    { key: "workshops", labelAr: "الورش", labelEn: "Workshops", on: services?.workshops === true },
    { key: "internships", labelAr: "التدريب", labelEn: "Internships", on: services?.internships === true },
    { key: "jobs", labelAr: "الفرص الوظيفية", labelEn: "Jobs", on: services?.jobs === true },
    { key: "judging", labelAr: "التحكيم", labelEn: "Judging", on: services?.judging === true },
    { key: "sponsorship", labelAr: "الرعاية", labelEn: "Sponsorship", on: services?.sponsorship === true },
  ];
  const active = items.filter((i) => i.on);

  if (active.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {isAr ? "لا توجد خدمات معلنة حالياً." : "No announced services yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {active.map((item) => (
        <span
          key={item.key}
          className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold text-primary"
        >
          {isAr ? item.labelAr : item.labelEn}
        </span>
      ))}
    </div>
  );
};
