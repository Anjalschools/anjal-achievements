"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Images, Loader2, Upload, X } from "lucide-react";

const MAX_BYTES = 5 * 1024 * 1024;

type Mine = {
  id: string;
  imageUrl: string;
  caption: string;
  memoryYear: number | null;
  status: string;
  submittedAt: string | null;
};

type Preview = {
  userId: string;
  fullName: string;
  profilePhoto: string | null;
  imageUrl: string;
  submittedAt: string | null;
};

type Props = {
  isAr: boolean;
  onMemorySubmitted?: () => void;
};

export const AlumniMemoriesDashboardWidget = memo(({ isAr, onMemorySubmitted }: Props) => {
  const [mine, setMine] = useState<Mine[]>([]);
  const [communityPreview, setCommunityPreview] = useState<Preview[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alumni/memories", { credentials: "include", cache: "no-store" });
      const j = (await res.json()) as {
        ok?: boolean;
        mine?: Mine[];
        communityPreview?: Preview[];
        counts?: { pending: number; approved: number; total: number };
      };
      if (j.ok) {
        setMine(j.mine || []);
        setCommunityPreview(j.communityPreview || []);
        setCounts(j.counts || { pending: 0, approved: 0, total: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const resetModal = () => {
    setFile(null);
    setCaption("");
    setYear("");
    setErr(null);
  };

  const handlePick = (f: File | null) => {
    setErr(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErr(isAr ? "يرجى اختيار ملف صورة." : "Please choose an image file.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setErr(isAr ? "الحد الأقصى 5 ميجابايت." : "Maximum size is 5MB.");
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    handlePick(f || null);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const up = await fetch("/api/uploads/image", { method: "POST", body: fd, credentials: "include" });
      const uj = (await up.json()) as { ok?: boolean; url?: string; error?: string };
      if (!up.ok || !uj.url) {
        setErr(uj.error || (isAr ? "فشل الرفع" : "Upload failed"));
        return;
      }
      const body: Record<string, unknown> = { imageUrl: uj.url, caption: caption.trim() || undefined };
      const y = year.trim() ? Number(year) : undefined;
      if (y !== undefined && Number.isFinite(y)) body.memoryYear = y;

      const res = await fetch("/api/alumni/memories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const mj = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !mj.ok) {
        setErr(
          mj.error === "PENDING_LIMIT"
            ? isAr
              ? "لديك طلبات قيد المراجعة. انتظر الموافقة قبل رفع المزيد."
              : "You have several submissions pending review. Please wait before uploading more."
            : mj.error === "MEMORY_LIMIT"
              ? isAr
                ? "وصلت للحد الأقصى من الذكريات."
                : "You reached the memory upload limit."
              : isAr
                ? "تعذر حفظ الذكرى."
                : "Could not save your memory."
        );
        return;
      }
      setOpen(false);
      resetModal();
      await load();
      onMemorySubmitted?.();
    } finally {
      setBusy(false);
    }
  };

  const dir = isAr ? "rtl" : "ltr";
  const strip = [...mine.filter((m) => m.status === "approved"), ...communityPreview].slice(0, 8);

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center"
            role="dialog"
            aria-modal
            aria-labelledby="alumni-memory-modal-title"
            dir={dir}
          >
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <h2 id="alumni-memory-modal-title" className="text-lg font-black text-slate-900">
                  {isAr ? "أضف ذكراك" : "Add your memory"}
                </h2>
                <button
                  type="button"
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                  onClick={() => {
                    setOpen(false);
                    resetModal();
                  }}
                  aria-label={isAr ? "إغلاق" : "Close"}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {isAr
                  ? "صورة واحدة حتى 5 ميجابايت. تُراجع الإدارة قبل الظهور للمجتمع."
                  : "One image up to 5MB. The team reviews submissions before they appear to the community."}
              </p>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="mt-4 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center transition hover:border-primary/40 hover:bg-sky-50/50"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
                }}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="mb-2 h-8 w-8 text-primary" aria-hidden />
                <p className="text-sm font-bold text-slate-800">{isAr ? "اسحب الصورة أو انقر للاختيار" : "Drag & drop or click to choose"}</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePick(e.target.files?.[0] || null)}
                />
              </div>

              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="" className="mt-4 max-h-48 w-full rounded-2xl object-contain ring-1 ring-slate-200" />
              ) : null}

              <label className="mt-4 block text-xs font-bold text-slate-700">{isAr ? "وصف (اختياري)" : "Caption (optional)"}</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                maxLength={500}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <label className="mt-3 block text-xs font-bold text-slate-700">{isAr ? "سنة الذكرى (اختياري)" : "Memory year (optional)"}</label>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                placeholder="2019"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              {err ? <p className="mt-3 text-sm font-semibold text-red-600">{err}</p> : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !file}
                  onClick={() => void handleSubmit()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white shadow-lg disabled:opacity-50 min-[400px]:flex-none"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isAr ? "إرسال للمراجعة" : "Submit for review"}
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setOpen(false);
                    resetModal();
                  }}
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <section
      className="overflow-hidden rounded-[2rem] border border-violet-200/60 bg-gradient-to-br from-violet-50/80 via-white to-sky-50/40 p-6 shadow-[0_20px_50px_-30px_rgba(76,29,149,0.35)] ring-1 ring-violet-100/80 sm:p-8"
      dir={dir}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-600/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-violet-800">
            <Images className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "ذكرياتي في الأنجال" : "My memories at Al-Anjal"}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {isAr
              ? `المشاركات المعتمدة: ${counts.approved} · قيد المراجعة: ${counts.pending}`
              : `Published: ${counts.approved} · Pending review: ${counts.pending}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/25 transition hover:opacity-95"
        >
          {isAr ? "أضف ذكراك" : "Add your memory"}
        </button>
      </div>

      {loading ? (
        <div className="mt-6 flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {strip.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center text-sm font-semibold text-slate-600">
              {isAr ? "كن أول من يشارك صورة من ذكريات الأنجال." : "Be the first to share a photo from your Al-Anjal memories."}
            </div>
          ) : (
            strip.map((m, idx) => (
              <div
                key={"id" in m ? (m as Mine).id : `c-${idx}-${(m as Preview).imageUrl}`}
                className="group relative aspect-square overflow-hidden rounded-2xl ring-1 ring-slate-200/80"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.imageUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                {"status" in m && (m as Mine).status === "pending" ? (
                  <span className="absolute start-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white shadow">
                    {isAr ? "مراجعة" : "Review"}
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}

      {modal}
    </section>
  );
});
AlumniMemoriesDashboardWidget.displayName = "AlumniMemoriesDashboardWidget";
