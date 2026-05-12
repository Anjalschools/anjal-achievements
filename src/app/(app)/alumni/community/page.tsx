"use client";

import { useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import CommunityFeedList from "@/components/alumni/CommunityFeedList";
import type { CommunityFeedItem } from "@/lib/alumni/community-feed-service";

export default function AlumniCommunityFeedPage() {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [items, setItems] = useState<CommunityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let m = true;
    void (async () => {
      setError(null);
      try {
        const res = await fetch("/api/alumni/community-feed", { credentials: "include" });
        if (res.status === 401 || res.status === 403) {
          if (m) setError(isAr ? "يتطلب حساب خريج مع صلاحية المجتمع." : "Requires an alumni account with community access.");
          if (m) setItems([]);
          return;
        }
        const j = (await res.json()) as { ok?: boolean; items?: CommunityFeedItem[] };
        if (m && j.ok && Array.isArray(j.items)) setItems(j.items);
      } catch {
        if (m) setError(isAr ? "تعذر التحميل." : "Could not load feed.");
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, [isAr]);

  return (
    <PageContainer>
      <div dir={isAr ? "rtl" : "ltr"}>
        <PageHeader
          title={isAr ? "مجتمع الخريجين" : "Alumni community"}
          subtitle={
            isAr
              ? "ذكريات، فرص، قصص، ومرشدون — من مصادر حقيقية على المنصة."
              : "Memories, opportunities, stories, and mentors — sourced live from the platform."
          }
        />
        {error ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
            {error}
          </div>
        ) : null}
        <CommunityFeedList
          items={items}
          loading={loading}
          isAr={isAr}
          emptyLabelAr="لا يوجد نشاط لعرضه بعد."
          emptyLabelEn="No community activity to show yet."
        />
      </div>
    </PageContainer>
  );
}
