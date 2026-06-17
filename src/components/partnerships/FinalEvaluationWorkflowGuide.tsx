"use client";

import { FileText, Printer, Upload, UserCheck } from "lucide-react";

type FinalEvaluationWorkflowGuideProps = {
  isAr: boolean;
  audience: "student" | "institution";
};

const FinalEvaluationWorkflowGuide = ({ isAr, audience }: FinalEvaluationWorkflowGuideProps) => {
  const studentSteps = isAr
    ? [
        "إرسال تقييم الطالب",
        "توليد التقرير الرسمي PDF",
        "تحميل وطباعة التقرير",
        "تعبئة قسم المؤسسة يدوياً وختمه وتوقيعه",
        "رفع التقرير الموقّع",
        "التحقق الآلي",
        "مراجعة المشرف",
        "الاعتماد",
      ]
    : [
        "Submit student evaluation",
        "Generate official report PDF",
        "Download and print",
        "Institution section filled, stamped & signed manually",
        "Upload signed report",
        "AI verification",
        "Supervisor review",
        "Approval",
      ];

  const institutionSteps = isAr
    ? [
        "إكمال التقييم الإلكتروني للمؤسسة",
        "إرسال التقييم",
        "مراجعة المشرف",
        "الاعتماد",
      ]
    : [
        "Complete electronic institution evaluation",
        "Submit evaluation",
        "Supervisor review",
        "Approval",
      ];

  const steps = audience === "student" ? studentSteps : institutionSteps;
  const icons = audience === "student"
    ? [UserCheck, FileText, Printer, FileText, Upload, UserCheck, UserCheck, UserCheck]
    : [FileText, Upload, UserCheck, UserCheck];

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/60 px-4 py-4">
      <p className="mb-3 text-sm font-bold text-blue-950">
        {isAr ? "مسار إكمال التقييم النهائي" : "Final evaluation workflow"}
      </p>
      <ol className="space-y-2">
        {steps.map((step, index) => {
          const Icon = icons[index] || FileText;
          return (
            <li key={step} className="flex items-start gap-2 text-sm text-blue-900">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <span className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
                {step}
              </span>
            </li>
          );
        })}
      </ol>
      {audience === "student" ? (
        <p className="mt-3 text-xs text-blue-800">
          {isAr
            ? "يمكن للمؤسسة أيضاً إكمال التقييم إلكترونياً عبر بوابة المؤسسة — كلا المسارين مدعومان."
            : "Institutions may also complete the evaluation electronically via the institution portal — both paths are supported."}
        </p>
      ) : null}
    </div>
  );
};

export default FinalEvaluationWorkflowGuide;
