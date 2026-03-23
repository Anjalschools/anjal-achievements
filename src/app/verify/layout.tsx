import PublicShell from "@/components/layout/PublicShell";

export default function VerifyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PublicShell>{children}</PublicShell>;
}
