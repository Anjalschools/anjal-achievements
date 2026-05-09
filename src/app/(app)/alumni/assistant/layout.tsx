import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "المرشد الأكاديمي الذكي",
  description: "إرشاد أكاديمي ومهني ضمن منصة الأنجال لطلاب الثانوي والخريجين.",
};

export default function AlumniAssistantLayout({ children }: { children: React.ReactNode }) {
  return children;
}
