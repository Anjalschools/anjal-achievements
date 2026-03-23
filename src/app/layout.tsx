import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import LocaleProvider from "@/components/LocaleProvider";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "منصة تميز الأنجال | إنجازات تصنع المستقبل",
  description:
    "منصة رقمية احترافية لتوثيق وتصنيف وإبراز إنجازات طلاب مدارس الأنجال الأهلية",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.variable} antialiased`}>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
