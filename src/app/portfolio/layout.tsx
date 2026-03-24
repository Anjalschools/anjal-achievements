import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "ملف الإنجاز العام | Student Achievement Portfolio",
  description: "ملف إنجاز موثق من المدرسة — Official school achievement portfolio",
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
