"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import CommunityFeedList from "@/components/alumni/CommunityFeedList";
import type { CommunityFeedItem } from "@/lib/alumni/community-feed-service";

export default function AdminAlumniCommunityFeedPage() {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [items, setItems] = useState<CommunityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/alumni/community-feed", { credentials: "include" });
        const j = (await res.json()) as { ok?: boolean; items?: CommunityFeedItem[] };
        if (m && j.ok && Array.isArray(j.items)) setItems(j.items);
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "تغذية مجتمع الخريجين" : "Alumni community feed"}
        subtitle={
          isAr
            ? "عرض موحّد للذكريات والفرص والقصص والمرشدين — مرتب حسب التحديث مع تقدير تفاعل بسيط."
            : "Unified stream of memories, opportunities, stories, and mentors — time-sorted with a lightweight engagement score."
        }
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/alumni/memories"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
        >
          {isAr ? "الذكريات" : "Memories"}
        </Link>
        <Link
          href="/admin/alumni/opportunities/review"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
        >
          {isAr ? "مراجعة الفرص" : "Opportunity review"}
        </Link>
        <Link
          href="/admin/alumni/stories"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
        >
          {isAr ? "القصص" : "Stories"}
        </Link>
      </div>
      <CommunityFeedList
        items={items}
        loading={loading}
        isAr={isAr}
        emptyLabelAr="لا توجد عناصر في التغذية حاليًا."
        emptyLabelEn="No feed items right now."
      />
    </PageContainer>
  );
}
