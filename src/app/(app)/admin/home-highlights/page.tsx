"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import type {
  HomeHighlightBlockPayload,
  HomeHighlightItemPayload,
  HomeHighlightPayload,
} from "@/lib/home-highlights";
import { DEFAULT_HOME_HIGHLIGHTS } from "@/lib/home-highlights";
import {
  Loader2,
  Save,
  PlusCircle,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  ImagePlus,
} from "lucide-react";
import InstitutionalAchievementCard from "@/components/landing/InstitutionalAchievementCard";
import SafeLocalImage from "@/components/media/SafeLocalImage";

type BlockColor = "blue" | "gold";
type ItemType = "award" | "accreditation" | "national" | "international" | "scholarship" | "milestone";
type IconKey =
  | "trophy"
  | "medal"
  | "shield-check"
  | "globe"
  | "building"
  | "graduation-cap"
  | "star"
  | "target";

const clonePayload = (data: HomeHighlightPayload): HomeHighlightPayload =>
  JSON.parse(JSON.stringify(data)) as HomeHighlightPayload;

const normalizeOrders = (items: HomeHighlightItemPayload[]): HomeHighlightItemPayload[] =>
  items.map((item, idx) => ({ ...item, order: idx + 1 }));

export default function AdminHomeHighlightsPage() {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<HomeHighlightPayload>(clonePayload(DEFAULT_HOME_HIGHLIGHTS));
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/home-highlights", { cache: "no-store" });
      if (!res.ok) throw new Error("load_failed");
      const json = (await res.json()) as { data?: HomeHighlightPayload };
      setState(clonePayload(json.data || DEFAULT_HOME_HIGHLIGHTS));
    } catch {
      setState(clonePayload(DEFAULT_HOME_HIGHLIGHTS));
      setToast({
        kind: "err",
        text: isAr ? "تعذر تحميل محتوى الإبرازات. تم عرض الإعداد الافتراضي." : "Failed to load. Using defaults.",
      });
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    void load();
  }, [load]);

  const moveItem = (blockIdx: number, itemIdx: number, dir: -1 | 1) => {
    setState((prev) => {
      const next = clonePayload(prev);
      const arr = [...next.blocks[blockIdx].items];
      const target = itemIdx + dir;
      if (target < 0 || target >= arr.length) return prev;
      const [moved] = arr.splice(itemIdx, 1);
      arr.splice(target, 0, moved);
      next.blocks[blockIdx].items = normalizeOrders(arr);
      return next;
    });
  };

  const canSave = useMemo(() => {
    if (!state.sectionTitleAr?.trim() && !state.sectionTitleEn?.trim()) return false;
    if (!state.sectionSubtitleAr?.trim() && !state.sectionSubtitleEn?.trim()) return false;
    if (state.blocks.length === 0) return false;
    for (const b of state.blocks) {
      if ((!b.titleAr?.trim() && !b.titleEn?.trim()) || (b.color !== "blue" && b.color !== "gold")) return false;
      if (b.items.length === 0) return false;
      for (const i of b.items) {
        if (
          (!i.titleAr?.trim() && !i.titleEn?.trim()) ||
          (!i.descriptionAr?.trim() && !i.descriptionEn?.trim()) ||
          !String(i.imageUrl || "").trim()
        ) {
          return false;
        }
      }
    }
    if (state.participationSectionEnabled !== false) {
      if (!state.participationTitleAr?.trim() && !state.participationTitleEn?.trim()) return false;
      if (!state.participationSubtitleAr?.trim() && !state.participationSubtitleEn?.trim()) return false;
      const pBlocks = state.participationBlocks || [];
      if (pBlocks.length === 0) return false;
      for (const b of pBlocks) {
        if ((!b.titleAr?.trim() && !b.titleEn?.trim()) || (b.color !== "blue" && b.color !== "gold")) return false;
        if (b.items.length === 0) return false;
        for (const i of b.items) {
          if (
            (!i.titleAr?.trim() && !i.titleEn?.trim()) ||
            (!i.descriptionAr?.trim() && !i.descriptionEn?.trim()) ||
            !String(i.imageUrl || "").trim()
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }, [state]);

  const handleSave = async () => {
    if (!canSave) {
      setToast({
        kind: "err",
        text: isAr ? "أكمل الحقول المطلوبة (عنوان/وصف لكل عنصر)." : "Please complete required fields.",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/home-highlights", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error("save_failed");
      const json = (await res.json()) as { data?: HomeHighlightPayload };
      setState(clonePayload(json.data || state));
      setToast({ kind: "ok", text: isAr ? "تم حفظ الإبرازات بنجاح." : "Saved successfully." });
    } catch {
      setToast({ kind: "err", text: isAr ? "فشل حفظ التعديلات." : "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  const updateBlock = (idx: number, patch: Partial<HomeHighlightBlockPayload>) => {
    setState((prev) => {
      const next = clonePayload(prev);
      next.blocks[idx] = { ...next.blocks[idx], ...patch };
      return next;
    });
  };

  const updateItem = (
    blockIdx: number,
    itemIdx: number,
    patch: Partial<HomeHighlightItemPayload>
  ) => {
    setState((prev) => {
      const next = clonePayload(prev);
      next.blocks[blockIdx].items[itemIdx] = {
        ...next.blocks[blockIdx].items[itemIdx],
        ...patch,
      };
      return next;
    });
  };

  const handleUploadImage = async (blockIdx: number, itemIdx: number, file: File | null) => {
    if (!file) return;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("read_failed"));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setState((prev) => {
      const next = clonePayload(prev);
      if (!next.blocks?.[blockIdx]?.items?.[itemIdx]) return prev;
      next.blocks[blockIdx].items[itemIdx].imageUrl = base64;
      return next;
    });
  };

  const moveParticipationBlock = (blockIdx: number, dir: -1 | 1) => {
    setState((prev) => {
      const next = clonePayload(prev);
      const list = [...(next.participationBlocks || [])];
      const target = blockIdx + dir;
      if (target < 0 || target >= list.length) return prev;
      const [moved] = list.splice(blockIdx, 1);
      list.splice(target, 0, moved);
      next.participationBlocks = list.map((b, idx) => ({ ...b, sortOrder: idx + 1 }));
      return next;
    });
  };

  const moveParticipationItem = (blockIdx: number, itemIdx: number, dir: -1 | 1) => {
    setState((prev) => {
      const next = clonePayload(prev);
      const blocks = [...(next.participationBlocks || [])];
      const arr = [...blocks[blockIdx].items];
      const target = itemIdx + dir;
      if (target < 0 || target >= arr.length) return prev;
      const [moved] = arr.splice(itemIdx, 1);
      arr.splice(target, 0, moved);
      blocks[blockIdx].items = normalizeOrders(arr);
      next.participationBlocks = blocks;
      return next;
    });
  };

  const updateParticipationBlock = (idx: number, patch: Partial<HomeHighlightBlockPayload>) => {
    setState((prev) => {
      const next = clonePayload(prev);
      const blocks = [...(next.participationBlocks || [])];
      blocks[idx] = { ...blocks[idx], ...patch };
      next.participationBlocks = blocks;
      return next;
    });
  };

  const updateParticipationItem = (
    blockIdx: number,
    itemIdx: number,
    patch: Partial<HomeHighlightItemPayload>
  ) => {
    setState((prev) => {
      const next = clonePayload(prev);
      const blocks = [...(next.participationBlocks || [])];
      blocks[blockIdx].items[itemIdx] = {
        ...blocks[blockIdx].items[itemIdx],
        ...patch,
      };
      next.participationBlocks = blocks;
      return next;
    });
  };

  const handleUploadParticipationImage = async (blockIdx: number, itemIdx: number, file: File | null) => {
    if (!file) return;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("read_failed"));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setState((prev) => {
      const next = clonePayload(prev);
      const blocks = [...(next.participationBlocks || [])];
      if (!blocks?.[blockIdx]?.items?.[itemIdx]) return prev;
      blocks[blockIdx].items[itemIdx].imageUrl = base64;
      next.participationBlocks = blocks;
      return next;
    });
  };

  if (loading) {
    return (
      <PageContainer className="py-8">
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-10">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{isAr ? "جاري التحميل..." : "Loading..."}</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="py-8">
      <PageHeader
        title="تعديل بيانات الصفحة الرئيسية"
        subtitle={
          isAr
            ? "تعديل قسم إبراز النماذج المتميزة والإنجازات البارزة في الصفحة الرئيسية (العناوين، النصوص، والصور)."
            : "Edit the featured models and highlights section on the homepage (titles, copy, and images)."
        }
        actions={
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !canSave}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isAr ? "حفظ" : "Save"}
          </button>
        }
      />

      {toast ? (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${
            toast.kind === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-base font-bold text-slate-900">
            {isAr ? "الإنجازات المؤسسية" : "Institutional achievements"}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              {isAr ? "عنوان القسم (عربي)" : "Section title (Arabic)"}
              <input
                value={state.sectionTitleAr || ""}
                onChange={(e) =>
                  setState((p) => ({
                    ...p,
                    sectionTitleAr: e.target.value,
                    sectionTitle: e.target.value || p.sectionTitleEn || "",
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {isAr ? "عنوان القسم (إنجليزي)" : "Section title (English)"}
              <input
                value={state.sectionTitleEn || ""}
                onChange={(e) =>
                  setState((p) => ({
                    ...p,
                    sectionTitleEn: e.target.value,
                    sectionTitle: p.sectionTitleAr || e.target.value || "",
                  }))
                }
                dir="ltr"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {isAr ? "وصف القسم (عربي)" : "Section subtitle (Arabic)"}
              <input
                value={state.sectionSubtitleAr || ""}
                onChange={(e) =>
                  setState((p) => ({
                    ...p,
                    sectionSubtitleAr: e.target.value,
                    sectionSubtitle: e.target.value || p.sectionSubtitleEn || "",
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {isAr ? "وصف القسم (إنجليزي)" : "Section subtitle (English)"}
              <input
                value={state.sectionSubtitleEn || ""}
                onChange={(e) =>
                  setState((p) => ({
                    ...p,
                    sectionSubtitleEn: e.target.value,
                    sectionSubtitle: p.sectionSubtitleAr || e.target.value || "",
                  }))
                }
                dir="ltr"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {isAr ? "إظهار القسم في الصفحة الرئيسية" : "Show section on homepage"}
              <div className="mt-2">
                <input
                  type="checkbox"
                  checked={state.sectionEnabled !== false}
                  onChange={(e) => setState((p) => ({ ...p, sectionEnabled: e.target.checked }))}
                />
              </div>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {isAr ? "عدد الأعمدة في العرض" : "Columns count"}
              <select
                value={state.layoutColumns || 3}
                onChange={(e) =>
                  setState((p) => ({ ...p, layoutColumns: Number(e.target.value) as 2 | 3 }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value={3}>{isAr ? "3 أعمدة" : "3 columns"}</option>
                <option value={2}>{isAr ? "عمودان" : "2 columns"}</option>
              </select>
            </label>
          </div>
        </section>

        {state.blocks.map((block, blockIdx) => (
          <section key={`${block.color}-${blockIdx}`} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                {isAr ? "عنوان البلوك (عربي)" : "Block title (Arabic)"}
                <input
                  value={block.titleAr || ""}
                  onChange={(e) =>
                    updateBlock(blockIdx, {
                      titleAr: e.target.value,
                      title: e.target.value || block.titleEn || "",
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                {isAr ? "عنوان البلوك (إنجليزي)" : "Block title (English)"}
                <input
                  value={block.titleEn || ""}
                  onChange={(e) =>
                    updateBlock(blockIdx, {
                      titleEn: e.target.value,
                      title: block.titleAr || e.target.value || "",
                    })
                  }
                  dir="ltr"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                {isAr ? "اللون" : "Color"}
                <select
                  value={block.color}
                  onChange={(e) => updateBlock(blockIdx, { color: e.target.value as BlockColor })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  <option value="gold">{isAr ? "ذهبي" : "Gold"}</option>
                  <option value="blue">{isAr ? "أزرق" : "Blue"}</option>
                </select>
              </label>
            </div>

            <div className="space-y-4">
              {block.items.map((item, itemIdx) => (
                <article
                  key={`${item.title || item.titleAr || item.titleEn || "item"}-${itemIdx}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-700">
                      {isAr ? `العنصر ${itemIdx + 1}` : `Item ${itemIdx + 1}`}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveItem(blockIdx, itemIdx, -1)}
                        className="rounded-lg border border-slate-300 bg-white p-2 disabled:opacity-40"
                        disabled={itemIdx === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(blockIdx, itemIdx, 1)}
                        className="rounded-lg border border-slate-300 bg-white p-2 disabled:opacity-40"
                        disabled={itemIdx === block.items.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setState((prev) => {
                            const next = clonePayload(prev);
                            next.blocks[blockIdx].items = normalizeOrders(
                              next.blocks[blockIdx].items.filter((_, i) => i !== itemIdx)
                            );
                            if (next.blocks[blockIdx].items.length === 0) {
                              next.blocks[blockIdx].items = [
                                {
                                  titleAr: "",
                                  titleEn: "",
                                  descriptionAr: "",
                                  descriptionEn: "",
                                  type: "milestone",
                                  iconKey: "star",
                                  badgeAr: "",
                                  badgeEn: "",
                                  isActive: true,
                                  title: "",
                                  description: "",
                                  imageUrl: "/Achive_file.jpg",
                                  order: 1,
                                },
                              ];
                            }
                            return next;
                          })
                        }
                        className="rounded-lg border border-red-300 bg-white p-2 text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={item.titleAr || ""}
                      onChange={(e) =>
                        updateItem(blockIdx, itemIdx, {
                          titleAr: e.target.value,
                          title: e.target.value || item.titleEn || "",
                        })
                      }
                      placeholder={isAr ? "العنوان (عربي)" : "Title (Arabic)"}
                      className="rounded-xl border border-slate-200 px-3 py-2"
                    />
                    <input
                      value={item.titleEn || ""}
                      onChange={(e) =>
                        updateItem(blockIdx, itemIdx, {
                          titleEn: e.target.value,
                          title: item.titleAr || e.target.value || "",
                        })
                      }
                      placeholder={isAr ? "العنوان (إنجليزي)" : "Title (English)"}
                      dir="ltr"
                      className="rounded-xl border border-slate-200 px-3 py-2"
                    />
                    <input
                      value={item.badgeAr || ""}
                      onChange={(e) => updateItem(blockIdx, itemIdx, { badgeAr: e.target.value })}
                      placeholder={isAr ? "شارة صغيرة (عربي) - اختياري" : "Badge (Arabic) - optional"}
                      className="rounded-xl border border-slate-200 px-3 py-2"
                    />
                    <input
                      value={item.badgeEn || ""}
                      onChange={(e) => updateItem(blockIdx, itemIdx, { badgeEn: e.target.value })}
                      placeholder={isAr ? "شارة صغيرة (إنجليزي) - اختياري" : "Badge (English) - optional"}
                      dir="ltr"
                      className="rounded-xl border border-slate-200 px-3 py-2"
                    />
                    <textarea
                      value={item.descriptionAr || ""}
                      onChange={(e) =>
                        updateItem(blockIdx, itemIdx, {
                          descriptionAr: e.target.value,
                          description: e.target.value || item.descriptionEn || "",
                        })
                      }
                      placeholder={isAr ? "الوصف (عربي)" : "Description (Arabic)"}
                      rows={3}
                      className="rounded-xl border border-slate-200 px-3 py-2 md:col-span-2"
                    />
                    <textarea
                      value={item.descriptionEn || ""}
                      onChange={(e) =>
                        updateItem(blockIdx, itemIdx, {
                          descriptionEn: e.target.value,
                          description: item.descriptionAr || e.target.value || "",
                        })
                      }
                      placeholder={isAr ? "الوصف (إنجليزي)" : "Description (English)"}
                      rows={3}
                      dir="ltr"
                      className="rounded-xl border border-slate-200 px-3 py-2 md:col-span-2"
                    />
                    <select
                      value={item.type || "milestone"}
                      onChange={(e) => updateItem(blockIdx, itemIdx, { type: e.target.value as ItemType })}
                      className="rounded-xl border border-slate-200 px-3 py-2"
                    >
                      <option value="award">{isAr ? "جائزة" : "Award"}</option>
                      <option value="accreditation">{isAr ? "اعتماد" : "Accreditation"}</option>
                      <option value="national">{isAr ? "إنجاز وطني" : "National"}</option>
                      <option value="international">{isAr ? "إنجاز عالمي" : "International"}</option>
                      <option value="scholarship">{isAr ? "منح ومبادرات" : "Scholarship"}</option>
                      <option value="milestone">{isAr ? "محطة مؤسسية" : "Milestone"}</option>
                    </select>
                    <select
                      value={item.iconKey || "star"}
                      onChange={(e) => updateItem(blockIdx, itemIdx, { iconKey: e.target.value as IconKey })}
                      className="rounded-xl border border-slate-200 px-3 py-2"
                    >
                      <option value="trophy">Trophy</option>
                      <option value="medal">Medal</option>
                      <option value="shield-check">Shield Check</option>
                      <option value="globe">Globe</option>
                      <option value="building">Building</option>
                      <option value="graduation-cap">Graduation Cap</option>
                      <option value="star">Star</option>
                      <option value="target">Target</option>
                    </select>
                    <input
                      value={item.imageUrl || ""}
                      onChange={(e) => updateItem(blockIdx, itemIdx, { imageUrl: e.target.value })}
                      placeholder={isAr ? "رابط الصورة أو Base64" : "Image URL or Base64"}
                      dir="ltr"
                      className="rounded-xl border border-slate-200 px-3 py-2 md:col-span-2"
                    />
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-primary md:col-span-2">
                      <ImagePlus className="h-4 w-4" />
                      {isAr ? "رفع صورة من الجهاز" : "Upload image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void handleUploadImage(blockIdx, itemIdx, e.target.files?.[0] || null)}
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 md:col-span-2">
                      <input
                        type="checkbox"
                        checked={item.isActive !== false}
                        onChange={(e) => updateItem(blockIdx, itemIdx, { isActive: e.target.checked })}
                      />
                      {isAr ? "تفعيل العنصر في العرض" : "Item is active in frontend"}
                    </label>
                    <div className="rounded-xl border border-dashed border-slate-300 p-3 md:col-span-2">
                      <div className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <Eye className="h-3.5 w-3.5" />
                        {isAr ? "معاينة البطاقة" : "Card preview"}
                      </div>
                      <InstitutionalAchievementCard
                        iconKey={(item.iconKey || "star") as IconKey}
                        title={item.titleAr || item.titleEn || item.title || (isAr ? "عنوان" : "Title")}
                        description={
                          item.descriptionAr ||
                          item.descriptionEn ||
                          item.description ||
                          (isAr ? "وصف مختصر للإنجاز." : "Short achievement description.")
                        }
                        badge={item.badgeAr || item.badgeEn || ""}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setState((prev) => {
                  const next = clonePayload(prev);
                  const list = [...next.blocks[blockIdx].items];
                  list.push({
                    titleAr: "",
                    titleEn: "",
                    descriptionAr: "",
                    descriptionEn: "",
                    type: "milestone",
                    iconKey: "star",
                    badgeAr: "",
                    badgeEn: "",
                    isActive: true,
                    title: "",
                    description: "",
                    imageUrl: "/Achive_file.jpg",
                    order: list.length + 1,
                  });
                  next.blocks[blockIdx].items = normalizeOrders(list);
                  return next;
                })
              }
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
            >
              <PlusCircle className="h-4 w-4" />
              {isAr ? "إضافة عنصر" : "Add item"}
            </button>
          </section>
        ))}

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-base font-bold text-slate-900">
            {isAr ? "إبراز النماذج المتميزة والإنجازات البارزة" : "Featured models and prominent achievements"}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              {isAr ? "عنوان القسم (عربي)" : "Section title (Arabic)"}
              <input
                value={state.participationTitleAr || ""}
                onChange={(e) =>
                  setState((p) => ({
                    ...p,
                    participationTitleAr: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {isAr ? "عنوان القسم (إنجليزي)" : "Section title (English)"}
              <input
                value={state.participationTitleEn || ""}
                onChange={(e) =>
                  setState((p) => ({
                    ...p,
                    participationTitleEn: e.target.value,
                  }))
                }
                dir="ltr"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {isAr ? "وصف القسم (عربي)" : "Section subtitle (Arabic)"}
              <input
                value={state.participationSubtitleAr || ""}
                onChange={(e) =>
                  setState((p) => ({
                    ...p,
                    participationSubtitleAr: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {isAr ? "وصف القسم (إنجليزي)" : "Section subtitle (English)"}
              <input
                value={state.participationSubtitleEn || ""}
                onChange={(e) =>
                  setState((p) => ({
                    ...p,
                    participationSubtitleEn: e.target.value,
                  }))
                }
                dir="ltr"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {isAr ? "إظهار القسم في الصفحة الرئيسية" : "Show section on homepage"}
              <div className="mt-2">
                <input
                  type="checkbox"
                  checked={state.participationSectionEnabled !== false}
                  onChange={(e) =>
                    setState((p) => ({ ...p, participationSectionEnabled: e.target.checked }))
                  }
                />
              </div>
            </label>
          </div>
        </section>

        {(state.participationBlocks || []).map((block, blockIdx) => (
          <section
            key={`participation-${block.color}-${blockIdx}`}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="grid flex-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  {isAr ? "عنوان البلوك (عربي)" : "Block title (Arabic)"}
                  <input
                    value={block.titleAr || ""}
                    onChange={(e) =>
                      updateParticipationBlock(blockIdx, {
                        titleAr: e.target.value,
                        title: e.target.value || block.titleEn || "",
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  {isAr ? "عنوان البلوك (إنجليزي)" : "Block title (English)"}
                  <input
                    value={block.titleEn || ""}
                    onChange={(e) =>
                      updateParticipationBlock(blockIdx, {
                        titleEn: e.target.value,
                        title: block.titleAr || e.target.value || "",
                      })
                    }
                    dir="ltr"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  {isAr ? "اللون / النمط" : "Color / style"}
                  <select
                    value={block.color}
                    onChange={(e) =>
                      updateParticipationBlock(blockIdx, { color: e.target.value as BlockColor })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  >
                    <option value="gold">{isAr ? "ذهبي" : "Gold"}</option>
                    <option value="blue">{isAr ? "أزرق" : "Blue"}</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  {isAr ? "أيقونة العنوان" : "Header icon"}
                  <select
                    value={block.headerIconKey || (block.color === "gold" ? "star" : "globe")}
                    onChange={(e) =>
                      updateParticipationBlock(blockIdx, {
                        headerIconKey: e.target.value as "globe" | "star",
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  >
                    <option value="globe">Globe</option>
                    <option value="star">Star</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  {isAr ? "ترتيب العمود" : "Column order"}
                  <input
                    type="number"
                    min={1}
                    value={block.sortOrder ?? blockIdx + 1}
                    onChange={(e) =>
                      updateParticipationBlock(blockIdx, {
                        sortOrder: Number(e.target.value) || 1,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveParticipationBlock(blockIdx, -1)}
                  className="rounded-lg border border-slate-300 bg-white p-2 disabled:opacity-40"
                  disabled={blockIdx === 0}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveParticipationBlock(blockIdx, 1)}
                  className="rounded-lg border border-slate-300 bg-white p-2 disabled:opacity-40"
                  disabled={blockIdx === (state.participationBlocks || []).length - 1}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {block.items.map((item, itemIdx) => (
                <article
                  key={`participation-item-${item.title || item.titleAr || item.titleEn || "item"}-${itemIdx}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-700">
                      {isAr ? `العنصر ${itemIdx + 1}` : `Item ${itemIdx + 1}`}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveParticipationItem(blockIdx, itemIdx, -1)}
                        className="rounded-lg border border-slate-300 bg-white p-2 disabled:opacity-40"
                        disabled={itemIdx === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveParticipationItem(blockIdx, itemIdx, 1)}
                        className="rounded-lg border border-slate-300 bg-white p-2 disabled:opacity-40"
                        disabled={itemIdx === block.items.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setState((prev) => {
                            const next = clonePayload(prev);
                            const blocks = [...(next.participationBlocks || [])];
                            blocks[blockIdx].items = normalizeOrders(
                              blocks[blockIdx].items.filter((_, i) => i !== itemIdx)
                            );
                            if (blocks[blockIdx].items.length === 0) {
                              blocks[blockIdx].items = [
                                {
                                  titleAr: "",
                                  titleEn: "",
                                  descriptionAr: "",
                                  descriptionEn: "",
                                  type: "milestone",
                                  iconKey: "star",
                                  isActive: true,
                                  title: "",
                                  description: "",
                                  imageUrl: "/Achive_file.jpg",
                                  order: 1,
                                },
                              ];
                            }
                            next.participationBlocks = blocks;
                            return next;
                          })
                        }
                        className="rounded-lg border border-red-300 bg-white p-2 text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={item.titleAr || ""}
                      onChange={(e) =>
                        updateParticipationItem(blockIdx, itemIdx, {
                          titleAr: e.target.value,
                          title: e.target.value || item.titleEn || "",
                        })
                      }
                      placeholder={isAr ? "العنوان (عربي)" : "Title (Arabic)"}
                      className="rounded-xl border border-slate-200 px-3 py-2"
                    />
                    <input
                      value={item.titleEn || ""}
                      onChange={(e) =>
                        updateParticipationItem(blockIdx, itemIdx, {
                          titleEn: e.target.value,
                          title: item.titleAr || e.target.value || "",
                        })
                      }
                      placeholder={isAr ? "العنوان (إنجليزي)" : "Title (English)"}
                      dir="ltr"
                      className="rounded-xl border border-slate-200 px-3 py-2"
                    />
                    <textarea
                      value={item.descriptionAr || ""}
                      onChange={(e) =>
                        updateParticipationItem(blockIdx, itemIdx, {
                          descriptionAr: e.target.value,
                          description: e.target.value || item.descriptionEn || "",
                        })
                      }
                      placeholder={isAr ? "الوصف (عربي)" : "Description (Arabic)"}
                      rows={3}
                      className="rounded-xl border border-slate-200 px-3 py-2 md:col-span-2"
                    />
                    <textarea
                      value={item.descriptionEn || ""}
                      onChange={(e) =>
                        updateParticipationItem(blockIdx, itemIdx, {
                          descriptionEn: e.target.value,
                          description: item.descriptionAr || e.target.value || "",
                        })
                      }
                      placeholder={isAr ? "الوصف (إنجليزي)" : "Description (English)"}
                      rows={3}
                      dir="ltr"
                      className="rounded-xl border border-slate-200 px-3 py-2 md:col-span-2"
                    />
                    <label className="text-sm font-semibold text-slate-700">
                      {isAr ? "ترتيب العنصر (sortOrder)" : "Sort order"}
                      <input
                        type="number"
                        min={0}
                        value={item.order}
                        onChange={(e) =>
                          updateParticipationItem(blockIdx, itemIdx, {
                            order: Number(e.target.value) || 0,
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={item.isActive !== false}
                        onChange={(e) =>
                          updateParticipationItem(blockIdx, itemIdx, { isActive: e.target.checked })
                        }
                      />
                      {isAr ? "تفعيل العنصر" : "Active"}
                    </label>
                    <input
                      value={item.imageUrl || ""}
                      onChange={(e) =>
                        updateParticipationItem(blockIdx, itemIdx, { imageUrl: e.target.value })
                      }
                      placeholder={isAr ? "رابط الصورة أو Base64" : "Image URL or Base64"}
                      dir="ltr"
                      className="rounded-xl border border-slate-200 px-3 py-2 md:col-span-2"
                    />
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-primary md:col-span-2">
                      <ImagePlus className="h-4 w-4" />
                      {isAr ? "رفع صورة من الجهاز" : "Upload image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          void handleUploadParticipationImage(
                            blockIdx,
                            itemIdx,
                            e.target.files?.[0] || null
                          )
                        }
                      />
                    </label>
                    <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-xl border border-slate-200 md:col-span-2">
                      <SafeLocalImage
                        src={item.imageUrl || "/Achive_file.jpg"}
                        alt={item.titleAr || item.titleEn || ""}
                        fill
                        objectFit="contain"
                        className="bg-slate-100"
                        fallback={<div className="absolute inset-0 bg-slate-200" aria-hidden />}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setState((prev) => {
                  const next = clonePayload(prev);
                  const blocks = [...(next.participationBlocks || [])];
                  const list = [...blocks[blockIdx].items];
                  list.push({
                    titleAr: "",
                    titleEn: "",
                    descriptionAr: "",
                    descriptionEn: "",
                    type: "milestone",
                    iconKey: "star",
                    isActive: true,
                    title: "",
                    description: "",
                    imageUrl: "/Achive_file.jpg",
                    order: list.length + 1,
                  });
                  blocks[blockIdx].items = normalizeOrders(list);
                  next.participationBlocks = blocks;
                  return next;
                })
              }
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
            >
              <PlusCircle className="h-4 w-4" />
              {isAr ? "إضافة عنصر" : "Add item"}
            </button>
          </section>
        ))}

        <button
          type="button"
          onClick={() =>
            setState((prev) => {
              const next = clonePayload(prev);
              const blocks = [...(next.participationBlocks || [])];
              blocks.push({
                titleAr: "",
                titleEn: "",
                title: "",
                color: "blue",
                sortOrder: blocks.length + 1,
                headerIconKey: "globe",
                items: [
                  {
                    titleAr: "",
                    titleEn: "",
                    descriptionAr: "",
                    descriptionEn: "",
                    type: "milestone",
                    iconKey: "star",
                    isActive: true,
                    title: "",
                    description: "",
                    imageUrl: "/Achive_file.jpg",
                    order: 1,
                  },
                ],
              });
              next.participationBlocks = blocks;
              return next;
            })
          }
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
        >
          <PlusCircle className="h-4 w-4" />
          {isAr ? "إضافة عمود/بلوك" : "Add column block"}
        </button>

      </div>
    </PageContainer>
  );
}

