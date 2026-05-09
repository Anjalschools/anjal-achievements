"use client";

import type { ReactNode } from "react";
import { AlumniCommunityAccessGate } from "@/components/alumni/AlumniCommunityAccessGate";

export default function AlumniMentorsPublicLayout({ children }: { children: ReactNode }) {
  return <AlumniCommunityAccessGate>{children}</AlumniCommunityAccessGate>;
}
