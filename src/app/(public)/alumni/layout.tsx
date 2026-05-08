import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مجتمع خريجي الأنجال | Al-Anjal Alumni",
  description:
    "منصة تربط خريجي مدارس الأنجال ببعضهم وبمدرستهم — رحلة أكاديمية ومهنية داعمة للأجيال القادمة.",
};

export default function AlumniLayout({ children }: { children: React.ReactNode }) {
  return children;
}
