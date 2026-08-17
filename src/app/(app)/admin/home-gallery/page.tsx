"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import IconActionButton from "@/components/ui/IconActionButton";
import { getLocale } from "@/lib/i18n";
import type { GalleryImageRow } from "@/lib/home-gallery";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB source file cap (before compression)
const MAX_DIMENSION = 1920; // resized longest edge
const JPEG_QUALITY = 0.82;

/**
 * Downscales + re-encodes an image file client-side (camera photos can be 20-30MB) before it is
 * uploaded to R2 — the compressed blob is what actually gets uploaded; nothing is persisted as
 * base64 in the database (see /api/admin/home-gallery, which stores the R2 object URL only).
 */
const compressImageFile = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas_unsupported"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("compression_failed"))),
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image_decode_failed"));
    };
    img.src = objectUrl;
  });

export default function AdminHomeGalleryPage() {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GalleryImageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [pendingTitleAr, setPendingTitleAr] = useState("");
  const [pendingTitleEn, setPendingTitleEn] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingBlobRef = useRef<Blob | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/home-gallery", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFileSelect = async (file: File | null) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(isAr ? "الملف المختار ليس صورة صالحة." : "The selected file is not a valid image.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(isAr ? "حجم الصورة كبير جدًا (الحد الأقصى 10 ميجابايت)." : "Image is too large (max 10MB).");
      return;
    }
    try {
      const blob = await compressImageFile(file);
      pendingBlobRef.current = blob;
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
      setPendingPreview(URL.createObjectURL(blob));
    } catch {
      setError(isAr ? "تعذّرت معالجة الصورة." : "Failed to process the image.");
    }
  };

  const cancelPending = () => {
    pendingBlobRef.current = null;
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
    setPendingTitleAr("");
    setPendingTitleEn("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confirmAdd = async () => {
    const blob = pendingBlobRef.current;
    if (!blob) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", blob, "gallery.jpg");
      formData.append("titleAr", pendingTitleAr.trim());
      formData.append("titleEn", pendingTitleEn.trim());
      formData.append("altAr", pendingTitleAr.trim());
      formData.append("altEn", pendingTitleEn.trim());

      const res = await fetch("/api/admin/home-gallery", {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      cancelPending();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (row: GalleryImageRow) => {
    const confirmText = isAr
      ? `سيتم حذف هذه الصورة نهائيًا من معرض حفل التكريم.\n\nهل تريد المتابعة؟`
      : `This will permanently delete this photo from the ceremony gallery.\n\nContinue?`;
    if (!window.confirm(confirmText)) return;
    setBusyId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/home-gallery/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const patchImage = async (row: GalleryImageRow, patch: Record<string, unknown>) => {
    setBusyId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/home-gallery/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const moveImage = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[idx];
    const b = items[target];
    setBusyId(a.id);
    setError(null);
    try {
      await Promise.all([
        fetch(`/api/admin/home-gallery/${encodeURIComponent(a.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: b.displayOrder }),
        }),
        fetch(`/api/admin/home-gallery/${encodeURIComponent(b.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: a.displayOrder }),
        }),
      ]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "معرض حفل تكريم الطلاب والطالبات" : "Ceremony Gallery"}
        subtitle={
          isAr
            ? "إدارة الصور التي تظهر في معرض الصفحة الرئيسية أسفل قسم حفل التكريم."
            : "Manage the photos shown in the homepage gallery under the ceremony section."
        }
      />

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <SectionCard className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-foreground">
          <ImagePlus className="h-4 w-4 text-primary" aria-hidden />
          {isAr ? "إضافة صورة" : "Add photo"}
        </h2>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => void handleFileSelect(e.target.files?.[0] || null)}
          className="mb-4 block w-full text-sm"
          aria-label={isAr ? "اختيار صورة" : "Choose image"}
        />

        {pendingPreview ? (
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingPreview} alt={isAr ? "معاينة" : "Preview"} className="h-full w-full object-cover" />
            </div>
            <div className="space-y-3">
              <input
                value={pendingTitleAr}
                onChange={(e) => setPendingTitleAr(e.target.value)}
                placeholder={isAr ? "وصف الصورة (عربي) — اختياري" : "Image caption (Arabic) — optional"}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                dir="rtl"
              />
              <input
                value={pendingTitleEn}
                onChange={(e) => setPendingTitleEn(e.target.value)}
                placeholder={isAr ? "وصف الصورة (إنجليزي) — اختياري" : "Image caption (English) — optional"}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                dir="ltr"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void confirmAdd()}
                  disabled={uploading}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {uploading ? "…" : isAr ? "إضافة إلى المعرض" : "Add to gallery"}
                </button>
                <button
                  type="button"
                  onClick={cancelPending}
                  disabled={uploading}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground disabled:opacity-60"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard>
        <h2 className="mb-4 text-base font-bold text-foreground">
          {isAr ? "صور المعرض" : "Gallery photos"} ({items.length})
        </h2>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-text-light">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-text-light">
            {isAr ? "لا توجد صور بعد. أضف أول صورة أعلاه." : "No photos yet. Add the first one above."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((row, idx) => (
              <div key={row.id} className="overflow-hidden rounded-xl border border-border">
                <div className="relative aspect-[4/3] w-full bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={row.imageUrl}
                    alt={row.altAr || row.altEn || ""}
                    className="h-full w-full object-cover"
                  />
                  {row.isCover ? (
                    <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                      <Star className="h-3 w-3" aria-hidden />
                      {isAr ? "الغلاف" : "Cover"}
                    </span>
                  ) : null}
                  {!row.isActive ? (
                    <span className="absolute end-2 top-2 rounded-full bg-slate-700/80 px-2 py-0.5 text-[10px] font-bold text-white">
                      {isAr ? "غير مفعّلة" : "Inactive"}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2 p-3">
                  <p className="truncate text-xs text-text-light">
                    {row.titleAr || row.titleEn || (isAr ? "بدون وصف" : "No caption")}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    <IconActionButton
                      label={isAr ? "تحريك للأعلى" : "Move up"}
                      disabled={busyId === row.id || idx === 0}
                      onClick={() => void moveImage(idx, -1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </IconActionButton>
                    <IconActionButton
                      label={isAr ? "تحريك للأسفل" : "Move down"}
                      disabled={busyId === row.id || idx === items.length - 1}
                      onClick={() => void moveImage(idx, 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </IconActionButton>
                    <IconActionButton
                      label={isAr ? "تعيين كصورة الغلاف" : "Set as cover"}
                      disabled={busyId === row.id || row.isCover}
                      onClick={() => void patchImage(row, { isCover: true })}
                    >
                      <Star className="h-4 w-4 text-amber-600" aria-hidden />
                    </IconActionButton>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void patchImage(row, { isActive: !row.isActive })}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-bold disabled:opacity-60"
                    >
                      {row.isActive ? (isAr ? "إخفاء" : "Hide") : isAr ? "إظهار" : "Show"}
                    </button>
                    <IconActionButton
                      label={isAr ? "حذف" : "Delete"}
                      disabled={busyId === row.id}
                      onClick={() => void removeImage(row)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
                    </IconActionButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
}
