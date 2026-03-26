import type { ReactNode } from "react";
import AdminAreaGuard from "@/components/admin/AdminAreaGuard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminSectionLayout({ children }: { children: ReactNode }) {
  return <AdminAreaGuard>{children}</AdminAreaGuard>;
}
