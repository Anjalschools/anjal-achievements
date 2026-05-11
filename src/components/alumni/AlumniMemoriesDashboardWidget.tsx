"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Heart, Images, Loader2, Pencil, Trash2, TrendingUp, Upload, X } from "lucide-react";
import { compressAlumniMemoryImageForUpload } from "@/lib/client/alumni-memory-image-compress";

const MAX_BYTES = 5 * 1024 * 1024;
const VIEWED_KEY = "alumni-memory-views-session-v1";

const uploadImageWithProgress = (file: File, onProgress: (pct: number) => void): Promise<{ url: string }> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads/image");
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) {
        onProgress(12);
        return;
      }
      onProgress(Math.min(99, Math.round((100 * e.loaded) / Math.max(1, e.total))));
    };
    xhr.onload = () => {
      onProgress(100);
      try {
        const j = JSON.parse(xhr.responseText || "{}") as { url?: string; error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && j.url) resolve({ url: j.url });
        else reject(new Error(j.error || "UPLOAD_FAILED"));
      } catch {
        reject(new Error("UPLOAD_FAILED"));
      }
    };
    xhr.onerror = () => reject(new Error("NETWORK"));
    const fd = new FormData();
    fd.set("file", file);
    xhr.send(fd);
  });

type Mine = {
  id: string;
  imageUrl: string;
  caption: string;
  memoryYear: number | null;
  status: string;
  submittedAt: string | null;
  likeCount?: number;
  viewCount?: number;
};

type ShowcaseItem = {
  ownerUserId: string;
  memoryPostId: string;
  fullName: string;
  profilePhoto: string | null;
  imageUrl: string;
  caption: string;
  submittedAt: string | null;
  likeCount: number;
  viewCount: number;
  engagementScore: number;
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

const readViewedSet = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(VIEWED_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

const writeViewedSet = (s: Set<string>) => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...s].slice(0, 400)));
};

export const AlumniMemoriesDashboardWidget = memo(({ isAr, onMemorySubmitted }: Props) => {
  const [mine, setMine] = useState<Mine[]>([]);
  const [communityPreview, setCommunityPreview] = useState<Preview[]>([]);
  const [showcase, setShowcase] = useState<ShowcaseItem[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [counts, setCounts] = useState({ pending: 0, draft: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [selfEdit, setSelfEdit] = useState<Mine | null>(null);
  const [selfCaption, setSelfCaption] = useState("");
  const [selfYear, setSelfYear] = useState("");
  const [selfFile, setSelfFile] = useState<File | null>(null);
  const [selfPreviewUrl, setSelfPreviewUrl] = useState<string | null>(null);
  const [selfBusy, setSelfBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const viewedRef = useRef<Set<string>>(readViewedSet());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alumni/memories", { credentials: "include", cache: "no-store" });
      const j = (await res.json()) as {
        ok?: boolean;
        mine?: Mine[];
        communityPreview?: Preview[];
        showcase?: ShowcaseItem[];
        counts?: { pending: number; draft?: number; approved: number; rejected?: number; total: number };
      };
      if (j.ok) {
        setMine(j.mine || []);
        setCommunityPreview(j.communityPreview || []);
        setShowcase(j.showcase || []);
        const c = j.counts || { pending: 0, approved: 0, total: 0 };
        setCounts({
          pending: c.pending,
          draft: typeof c.draft === "number" ? c.draft : 0,
          approved: c.approved,
          rejected: typeof c.rejected === "number" ? c.rejected : 0,
          total: c.total,
        });
        setCarouselIndex(0);
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

  useEffect(() => {
    if (!selfFile) {
      setSelfPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selfFile);
    setSelfPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selfFile]);

  const sendView = useCallback(
    async (ownerUserId: string, memoryPostId: string) => {
      const k = `${ownerUserId}:${memoryPostId}`;
      if (viewedRef.current.has(k)) return;
      viewedRef.current.add(k);
      writeViewedSet(viewedRef.current);
      try {
        await fetch("/api/alumni/memories/interaction", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "view", ownerUserId, memoryPostId }),
        });
        setShowcase((prev) =>
          prev.map((p) =>
            p.ownerUserId === ownerUserId && p.memoryPostId === memoryPostId
              ? { ...p, viewCount: p.viewCount + 1 }
              : p
          )
        );
      } catch {
        /* optional */
      }
    },
    []
  );

  useEffect(() => {
    const top = showcase.slice(0, 6);
    for (const p of top) {
      void sendView(p.ownerUserId, p.memoryPostId);
    }
  }, [showcase, sendView]);

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
    setUploadPct(0);
    try {
      const compressed = await compressAlumniMemoryImageForUpload(file);
      const { url } = await uploadImageWithProgress(compressed, setUploadPct);
      const body: Record<string, unknown> = { intent: "submit", imageUrl: url, caption: caption.trim() || undefined };
      const y = year.trim() ? Number(year) : undefined;
      if (y !== undefined && Number.isFinite(y)) body.memoryYear = y;

      setCounts((c) => ({ ...c, pending: c.pending + 1, total: c.total + 1 }));

      const res = await fetch("/api/alumni/memories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const mj = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !mj.ok) {
        setCounts((c) => ({
          ...c,
          pending: Math.max(0, c.pending - 1),
          total: Math.max(0, c.total - 1),
        }));
        setErr(
          mj.error === "PENDING_LIMIT"
            ? isAr
              ? "لديك طلبات قيد المراجعة. انتظر الموافقة قبل رفع المزيد."
              : "You have several submissions pending review. Please wait before uploading more."
            : mj.error === "MEMORY_LIMIT"
              ? isAr
                ? "وصلت للحد الأقصى من الذكريات."
                : "You reached the memory upload limit."
            : mj.error === "DUPLICATE_MEMORY"
              ? isAr
                ? "تبدو هذه الذكرى مكررة مع ذكرى رفعتها مؤخرًا."
                : "This looks like a duplicate of a memory you recently submitted."
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
    } catch {
      setErr(isAr ? "فشل الرفع" : "Upload failed");
      setCounts((c) => ({
        ...c,
        pending: Math.max(0, c.pending - 1),
        total: Math.max(0, c.total - 1),
      }));
    } finally {
      setBusy(false);
      setUploadPct(0);
    }
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    setErr(null);
    setUploadPct(0);
    try {
      let imageUrl: string | undefined;
      if (file) {
        const compressed = await compressAlumniMemoryImageForUpload(file);
        const { url } = await uploadImageWithProgress(compressed, setUploadPct);
        imageUrl = url;
      }
      const body: Record<string, unknown> = {
        intent: "draft",
        caption: caption.trim() || undefined,
      };
      const y = year.trim() ? Number(year) : undefined;
      if (y !== undefined && Number.isFinite(y)) body.memoryYear = y;
      if (imageUrl) body.imageUrl = imageUrl;

      setCounts((c) => ({ ...c, draft: c.draft + 1, total: c.total + 1 }));

      const res = await fetch("/api/alumni/memories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const mj = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !mj.ok) {
        setCounts((c) => ({
          ...c,
          draft: Math.max(0, c.draft - 1),
          total: Math.max(0, c.total - 1),
        }));
        setErr(
          mj.error === "MEMORY_LIMIT"
            ? isAr
              ? "وصلت للحد الأقصى من الذكريات."
              : "You reached the memory upload limit."
            : isAr
              ? "تعذر حفظ المسودة."
              : "Could not save draft."
        );
        return;
      }
      setOpen(false);
      resetModal();
      await load();
      onMemorySubmitted?.();
    } catch {
      setErr(isAr ? "فشل الرفع" : "Upload failed");
      setCounts((c) => ({
        ...c,
        draft: Math.max(0, c.draft - 1),
        total: Math.max(0, c.total - 1),
      }));
    } finally {
      setBusy(false);
      setUploadPct(0);
    }
  };

  const editableMine = (s: string) => s === "pending" || s === "rejected" || s === "draft";

  const openSelfEdit = (m: Mine) => {
    setSelfEdit(m);
    setSelfCaption(m.caption || "");
    setSelfYear(m.memoryYear != null ? String(m.memoryYear) : "");
    setSelfFile(null);
    setErr(null);
  };

  const handleSelfSave = async () => {
    if (!selfEdit) return;
    setErr(null);
    const yRaw = selfYear.trim();
    if (yRaw) {
      const y = Number(yRaw);
      if (!Number.isFinite(y) || y < 1970 || y > 2100) {
        setErr(isAr ? "سنة غير صالحة." : "Invalid year.");
        return;
      }
    }
    setSelfBusy(true);
    setUploadPct(0);
    try {
      let imageUrl: string | undefined;
      if (selfFile) {
        const compressed = await compressAlumniMemoryImageForUpload(selfFile);
        const { url } = await uploadImageWithProgress(compressed, setUploadPct);
        imageUrl = url;
      }
      const body: Record<string, unknown> = { caption: selfCaption.trim() };
      if (yRaw) {
        body.memoryYear = Number(yRaw);
      } else {
        body.memoryYear = null;
      }
      if (imageUrl) body.imageUrl = imageUrl;

      const res = await fetch(`/api/alumni/memories/${encodeURIComponent(selfEdit.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(isAr ? "تعذر حفظ التعديل." : "Could not save changes.");
        return;
      }
      setSelfEdit(null);
      setSelfFile(null);
      await load();
      onMemorySubmitted?.();
    } catch {
      setErr(isAr ? "فشل الرفع" : "Upload failed");
    } finally {
      setSelfBusy(false);
      setUploadPct(0);
    }
  };

  const handleSubmitDraftForReview = async () => {
    if (!selfEdit || selfEdit.status !== "draft") return;
    const yRaw = selfYear.trim();
    if (yRaw) {
      const y = Number(yRaw);
      if (!Number.isFinite(y) || y < 1970 || y > 2100) {
        setErr(isAr ? "سنة غير صالحة." : "Invalid year.");
        return;
      }
    }
    setSelfBusy(true);
    setUploadPct(0);
    setErr(null);
    try {
      let imageUrl: string | undefined = selfEdit.imageUrl || undefined;
      if (selfFile) {
        const compressed = await compressAlumniMemoryImageForUpload(selfFile);
        const { url } = await uploadImageWithProgress(compressed, setUploadPct);
        imageUrl = url;
      }
      const body: Record<string, unknown> = {
        status: "pending",
        caption: selfCaption.trim(),
        ...(yRaw ? { memoryYear: Number(yRaw) } : { memoryYear: null }),
      };
      if (imageUrl) body.imageUrl = imageUrl;
      const res = await fetch(`/api/alumni/memories/${encodeURIComponent(selfEdit.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(
          j.error === "DUPLICATE_MEMORY"
            ? isAr
              ? "تبدو مكررة مع ذكرى سابقة."
              : "Looks like a duplicate of a recent memory."
            : j.error === "IMAGE_REQUIRED_FOR_SUBMIT"
              ? isAr
                ? "أضف صورة قبل الإرسال للمراجعة."
                : "Add a photo before submitting for review."
              : isAr
                ? "تعذر الإرسال للمراجعة."
                : "Could not submit for review."
        );
        return;
      }
      setSelfEdit(null);
      setSelfFile(null);
      await load();
      onMemorySubmitted?.();
    } catch {
      setErr(isAr ? "فشل الرفع" : "Upload failed");
    } finally {
      setSelfBusy(false);
      setUploadPct(0);
    }
  };

  const handleSelfDelete = async (m: Mine) => {
    const ok = window.confirm(isAr ? "حذف هذه الذكرى؟" : "Delete this memory?");
    if (!ok) return;
    setSelfBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/alumni/memories/${encodeURIComponent(m.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !j.ok) {
        setErr(isAr ? "تعذر الحذف." : "Could not delete.");
        return;
      }
      setSelfEdit(null);
      await load();
      onMemorySubmitted?.();
    } finally {
      setSelfBusy(false);
    }
  };

  const handleToggleLike = async (item: ShowcaseItem) => {
    const key = `${item.ownerUserId}:${item.memoryPostId}`;
    setLikeBusy(key);
    try {
      const res = await fetch("/api/alumni/memories/interaction", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "like",
          ownerUserId: item.ownerUserId,
          memoryPostId: item.memoryPostId,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; likeCount?: number; liked?: boolean; error?: string };
      if (!res.ok || !j.ok) return;
      setShowcase((prev) =>
        prev.map((p) =>
          p.memoryPostId === item.memoryPostId && p.ownerUserId === item.ownerUserId
            ? { ...p, likeCount: typeof j.likeCount === "number" ? j.likeCount : p.likeCount }
            : p
        )
      );
    } finally {
      setLikeBusy(null);
    }
  };

  const dir = isAr ? "rtl" : "ltr";
  const topShowcase = showcase.slice(0, 12);
  const carousel = topShowcase.slice(0, 8);
  const hero = carousel[carouselIndex] || null;

  const strip = communityPreview.slice(0, 8);

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
                  ? "يمكنك حفظ مسودة بدون صورة وإكمالها لاحقًا، أو رفع صورة وإرسالها للمراجعة. حتى 5 ميجابايت — يُفضّل ضغط الصور تلقائيًا قبل الرفع."
                  : "Save a draft without a photo and finish later, or attach a photo and submit for review. Up to 5MB — images are compressed client-side before upload when supported."}
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

              {busy && uploadPct > 0 ? (
                <div className="mt-4" aria-live="polite">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${uploadPct}%` }} />
                  </div>
                  <p className="mt-1 text-center text-xs font-bold tabular-nums text-slate-600 [direction:ltr]">{uploadPct}%</p>
                </div>
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
                  disabled={busy}
                  onClick={() => void handleSaveDraft()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-black text-violet-900 shadow-sm disabled:opacity-50 min-[400px]:flex-none"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isAr ? "حفظ كمسودة" : "Save draft"}
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

  const selfModal =
    selfEdit && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[101] flex items-end justify-center bg-black/50 p-4 sm:items-center"
            role="dialog"
            aria-modal
            aria-labelledby="alumni-memory-self-edit-title"
            dir={dir}
          >
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <h2 id="alumni-memory-self-edit-title" className="text-lg font-black text-slate-900">
                  {isAr ? "تعديل الذكرى" : "Edit memory"}
                </h2>
                <button
                  type="button"
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                  onClick={() => {
                    setSelfEdit(null);
                    setSelfFile(null);
                  }}
                  aria-label={isAr ? "إغلاق" : "Close"}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {isAr
                  ? "يمكنك تعديل الصورة والوصف قبل اعتماد الإدارة. بعد الاعتماد لا يمكن الحذف أو تغيير الصورة من هنا."
                  : "You can change the image and caption before admin approval. After approval, deletion and image changes are not available here."}
              </p>
              <div className="mt-4">
                {selfPreviewUrl || selfEdit.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selfPreviewUrl || selfEdit.imageUrl}
                    alt=""
                    className="max-h-48 w-full rounded-2xl object-contain ring-1 ring-slate-200"
                  />
                ) : (
                  <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm font-semibold text-slate-500">
                    {isAr ? "لا صورة بعد — مسودة" : "No photo yet — draft"}
                  </div>
                )}
              </div>
              <label className="mt-4 block text-xs font-bold text-slate-700">{isAr ? "صورة جديدة (اختياري)" : "New image (optional)"}</label>
              <input
                type="file"
                accept="image/*"
                className="mt-1 w-full text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  if (!f) {
                    setSelfFile(null);
                    return;
                  }
                  if (!f.type.startsWith("image/")) {
                    setErr(isAr ? "يرجى اختيار صورة." : "Please choose an image.");
                    return;
                  }
                  if (f.size > MAX_BYTES) {
                    setErr(isAr ? "الحد الأقصى 5 ميجابايت." : "Maximum size is 5MB.");
                    return;
                  }
                  setSelfFile(f);
                }}
              />
              {selfBusy && uploadPct > 0 ? (
                <div className="mt-3" aria-live="polite">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${uploadPct}%` }} />
                  </div>
                  <p className="mt-1 text-center text-xs font-bold tabular-nums text-slate-600 [direction:ltr]">{uploadPct}%</p>
                </div>
              ) : null}
              <label className="mt-4 block text-xs font-bold text-slate-700">{isAr ? "الوصف" : "Caption"}</label>
              <textarea
                value={selfCaption}
                onChange={(e) => setSelfCaption(e.target.value)}
                rows={3}
                maxLength={500}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <label className="mt-3 block text-xs font-bold text-slate-700">{isAr ? "سنة الذكرى" : "Memory year"}</label>
              <input
                value={selfYear}
                onChange={(e) => setSelfYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums [direction:ltr]"
              />
              {err ? <p className="mt-3 text-sm font-semibold text-red-600">{err}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={selfBusy}
                  onClick={() => void handleSelfSave()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white disabled:opacity-50 min-[400px]:flex-none"
                >
                  {selfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isAr ? "حفظ" : "Save"}
                </button>
                {selfEdit.status === "draft" ? (
                  <button
                    type="button"
                    disabled={selfBusy}
                    onClick={() => void handleSubmitDraftForReview()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-900 disabled:opacity-50 min-[400px]:flex-none"
                  >
                    {isAr ? "إرسال للمراجعة" : "Submit for review"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setSelfEdit(null);
                    setSelfFile(null);
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
            {isAr ? "عرض مجتمعي للذكريات" : "Micro community showcase"}
          </div>
          <p className="mt-2 text-sm text-slate-600 [font-variant-numeric:tabular-nums]">
            {isAr
              ? `المشاركات المعتمدة: ${counts.approved} · قيد المراجعة: ${counts.pending}${
                  counts.draft > 0 ? ` · مسودات: ${counts.draft}` : ""
                }${counts.rejected > 0 ? ` · مرفوضة: ${counts.rejected}` : ""}`
              : `Published: ${counts.approved} · Pending review: ${counts.pending}${
                  counts.draft > 0 ? ` · Drafts: ${counts.draft}` : ""
                }${counts.rejected > 0 ? ` · Rejected: ${counts.rejected}` : ""}`}
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
        <>
          {topShowcase.length > 0 ? (
            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-violet-900">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                  {isAr ? "الأكثر تفاعلًا" : "Most engaging"}
                </p>
                {hero ? (
                  <span className="text-[11px] font-bold text-slate-500">
                    {hero.likeCount} {isAr ? "إعجاب" : "likes"} · {hero.viewCount} {isAr ? "مشاهدة" : "views"}
                  </span>
                ) : null}
              </div>

              {hero ? (
                <div className="relative overflow-hidden rounded-3xl border border-violet-100 bg-black/5 shadow-inner">
                  <div className="relative aspect-[16/9] max-h-[320px] w-full sm:aspect-[21/9]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={hero.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                    <div className="absolute bottom-0 start-0 end-0 flex flex-wrap items-end justify-between gap-3 p-4 text-white">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{hero.fullName}</p>
                        {hero.caption ? <p className="mt-1 line-clamp-2 text-xs font-medium text-white/90">{hero.caption}</p> : null}
                      </div>
                      <button
                        type="button"
                        disabled={likeBusy === `${hero.ownerUserId}:${hero.memoryPostId}`}
                        onClick={() => void handleToggleLike(hero)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-white/15 px-3 py-2 text-xs font-black backdrop-blur-sm transition hover:bg-white/25 disabled:opacity-50"
                        aria-label={isAr ? "إعجاب" : "Like"}
                      >
                        <Heart className="h-4 w-4" aria-hidden />
                        {hero.likeCount}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {carousel.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
                  {carousel.map((c, i) => (
                    <button
                      key={`${c.ownerUserId}-${c.memoryPostId}`}
                      type="button"
                      onClick={() => {
                        setCarouselIndex(i);
                        void sendView(c.ownerUserId, c.memoryPostId);
                      }}
                      className={`relative h-20 w-28 shrink-0 snap-start overflow-hidden rounded-2xl ring-2 transition ${
                        i === carouselIndex ? "ring-violet-600" : "ring-transparent opacity-90 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : null}

              <div
                className="columns-2 gap-2 sm:columns-3 sm:gap-3"
                aria-label={isAr ? "شبكة ذكريات المجتمع" : "Community memory grid"}
              >
                {topShowcase.slice(0, 9).map((m) => (
                  <div
                    key={`${m.ownerUserId}-${m.memoryPostId}`}
                    className="mb-2 break-inside-avoid overflow-hidden rounded-2xl ring-1 ring-slate-200/80 sm:mb-3"
                  >
                    <div className="relative aspect-square w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-white/90 px-2 py-1.5 text-[10px] font-bold text-slate-600">
                      <span className="truncate">{m.fullName}</span>
                      <span className="shrink-0 tabular-nums text-slate-500">
                        ♥{m.likeCount} · {m.viewCount}▶
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {mine.length > 0 ? (
            <div className="mt-8 space-y-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-violet-900">
                <Images className="h-3.5 w-3.5" aria-hidden />
                {isAr ? "ذكرياتي" : "My memories"}
              </p>
              <div
                className="columns-2 gap-2 sm:columns-3 sm:gap-3"
                aria-label={isAr ? "ذكرياتي المعروضة" : "My uploaded memories"}
              >
                {mine.map((m) => (
                  <div
                    key={m.id}
                    className="mb-2 break-inside-avoid overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200/80 sm:mb-3"
                  >
                    <div className="relative aspect-square w-full min-h-[120px]">
                      {m.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full min-h-[120px] items-center justify-center bg-slate-200/80 text-center text-[11px] font-bold text-slate-600">
                          {isAr ? "مسودة" : "Draft"}
                        </div>
                      )}
                      <span
                        className={`absolute start-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black text-white shadow ${
                          m.status === "approved"
                            ? "bg-emerald-600"
                            : m.status === "rejected"
                              ? "bg-red-600"
                              : m.status === "draft"
                                ? "bg-slate-600"
                                : "bg-amber-500"
                        }`}
                      >
                        {m.status === "approved"
                          ? isAr
                            ? "معتمدة"
                            : "Approved"
                          : m.status === "rejected"
                            ? isAr
                              ? "مرفوضة"
                              : "Rejected"
                            : m.status === "draft"
                              ? isAr
                                ? "مسودة"
                                : "Draft"
                              : isAr
                                ? "قيد المراجعة"
                                : "Pending"}
                      </span>
                    </div>
                    {m.caption ? (
                      <p className="border-t border-slate-100 bg-white/95 px-2 py-1.5 text-[10px] font-semibold text-slate-700 line-clamp-3">
                        {m.caption}
                      </p>
                    ) : null}
                    {editableMine(m.status) ? (
                      <div className="flex gap-1 border-t border-slate-100 bg-white px-2 py-1.5">
                        <button
                          type="button"
                          disabled={selfBusy}
                          onClick={() => openSelfEdit(m)}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-violet-600 px-2 py-1.5 text-[10px] font-black text-white disabled:opacity-50"
                        >
                          <Pencil className="h-3 w-3" aria-hidden />
                          {isAr ? "تعديل" : "Edit"}
                        </button>
                        <button
                          type="button"
                          disabled={selfBusy}
                          onClick={() => void handleSelfDelete(m)}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-[10px] font-black text-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                          {isAr ? "حذف" : "Delete"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 space-y-2">
            {strip.length > 0 ? (
              <p className="text-xs font-black uppercase tracking-wide text-slate-600">
                {isAr ? "لمحة من المجتمع" : "Community preview"}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {strip.length === 0 && mine.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center text-sm font-semibold text-slate-600">
                  {isAr ? "كن أول من يشارك صورة من ذكريات الأنجال." : "Be the first to share a photo from your Al-Anjal memories."}
                </div>
              ) : (
                strip.map((m, idx) => (
                  <div
                    key={`c-${idx}-${m.imageUrl}`}
                    className="group relative aspect-square overflow-hidden rounded-2xl ring-1 ring-slate-200/80"
                  >
                    <div className="relative h-full w-full bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.imageUrl}
                        alt=""
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {modal}
      {selfModal}
    </section>
  );
});
AlumniMemoriesDashboardWidget.displayName = "AlumniMemoriesDashboardWidget";
