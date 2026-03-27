import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.css";
import LocaleProvider from "@/components/LocaleProvider";
import { CSP_NONCE_HEADER } from "@/lib/csp";

const cairo = localFont({
  src: [
    { path: "../../public/fonts/Cairo-ExtraLight.ttf", weight: "200", style: "normal" },
    { path: "../../public/fonts/Cairo-Light.ttf", weight: "300", style: "normal" },
    { path: "../../public/fonts/Cairo-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/Cairo-Medium.ttf", weight: "500", style: "normal" },
    { path: "../../public/fonts/Cairo-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../public/fonts/Cairo-Bold.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/Cairo-ExtraBold.ttf", weight: "800", style: "normal" },
    { path: "../../public/fonts/Cairo-Black.ttf", weight: "900", style: "normal" },
  ],
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
  const nonce = headers().get(CSP_NONCE_HEADER) ?? undefined;

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning nonce={nonce}>
      <body className={`${cairo.variable} antialiased`}>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
