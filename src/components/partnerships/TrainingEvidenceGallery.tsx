"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { GripVertical, ImagePlus, Loader2, Trash2, X, ZoomIn } from "lucide-react";
import {
  MAX_TRAINING_EVIDENCE_IMAGES,
  TRAINING_EVIDENCE_IMAGE_LABELS,
  TRAINING_EVIDENCE_MIME_TYPES,
} from "@/lib/partnerships/training-final-evaluation-ui-constants";
import { attachmentDisplayUrl, uploadTrainingEvidenceImage } from "@/lib/partnerships/training-completion-upload";

export type TrainingEvidenceImage = {
  attachmentId?: string;
  fileName: string;
  storageKey: string;
  mimeType?: string;
  storageProvider?: "r2" | "cloudinary";
  label?: string;
  caption?: string;
};

type TrainingEvidenceGalleryProps = {
  images: TrainingEvidenceImage[];
  onChange: (images: TrainingEvidenceImage[]) => void;
  isAr: boolean;
  disabled?: boolean;
};

const TrainingEvidenceGallery = ({ images, onChange, isAr, disabled = false }: TrainingEvidenceGalleryProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const safeSelected = images.length ? Math.min(selectedIndex, images.length - 1) : 0;
  const mainImage = images[safeSelected];

  const updateImage = (index: number, patch: Partial<TrainingEvidenceImage>) => {
    onChange(images.map((img, i) => (i === index ? { ...img, ...patch } : img)));
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length || disabled) return;
    setError(null);
    const remaining = MAX_TRAINING_EVIDENCE_IMAGES - images.length;
    if (remaining <= 0) {
      setError(isAr ? `الحد الأقصى ${MAX_TRAINING_EVIDENCE_IMAGES} صور` : `Maximum ${MAX_TRAINING_EVIDENCE_IMAGES} images`);
      return;
    }

    const files = Array.from(fileList).slice(0, remaining);
    setUploading(true);
    try {
      const uploaded: TrainingEvidenceImage[] = [];
      for (const file of files) {
        const mime = (file.type || "").toLowerCase();
        if (!TRAINING_EVIDENCE_MIME_TYPES.has(mime) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
          throw new Error(isAr ? "صيغة غير مدعومة" : "Unsupported file type");
        }
        const row = await uploadTrainingEvidenceImage(file);
        uploaded.push({
          fileName: row.fileName,
          storageKey: row.storageKey,
          mimeType: row.mimeType,
          storageProvider: row.storageProvider || "cloudinary",
          label: "workplace",
        });
      }
      onChange([...images, ...uploaded]);
      if (images.length === 0) setSelectedIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    const next = images.filter((_, i) => i !== index);
    onChange(next);
    if (safeSelected >= next.length) setSelectedIndex(Math.max(0, next.length - 1));
  };

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
    if (safeSelected === from) setSelectedIndex(to);
    else if (from < safeSelected && to >= safeSelected) setSelectedIndex(safeSelected - 1);
    else if (from > safeSelected && to <= safeSelected) setSelectedIndex(safeSelected + 1);
  };

  const handleDropOnSlot = (targetIndex: number) => {
    if (dragIndex === null || disabled) return;
    reorder(dragIndex, targetIndex);
    setDragIndex(null);
  };

  const labelText = (value?: string) => {
    const row = TRAINING_EVIDENCE_IMAGE_LABELS.find((l) => l.value === value);
    if (!row) return isAr ? "أخرى" : "Other";
    return isAr ? row.ar : row.en;
  };

  const mainUrl = mainImage ? attachmentDisplayUrl(mainImage.storageKey) : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-foreground">
          {isAr ? "معرض صور التدريب" : "Training evidence gallery"}
        </p>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-black text-primary">
          {images.length}/{MAX_TRAINING_EVIDENCE_IMAGES}
        </span>
      </div>

      {mainImage && mainUrl ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-muted/20">
          <div className="relative aspect-[16/10] w-full bg-black/5 sm:aspect-[2/1]">
            <Image src={mainUrl} alt={mainImage.fileName} fill className="object-contain" sizes="(max-width:768px) 100vw, 640px" unoptimized />
            {!disabled ? (
              <button
                type="button"
                onClick={() => setPreviewKey(mainImage.storageKey)}
                className="absolute bottom-3 end-3 inline-flex items-center gap-1 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-bold text-white"
                aria-label={isAr ? "عرض بملء الشاشة" : "Full screen"}
              >
                <ZoomIn className="h-3.5 w-3.5" aria-hidden />
                {isAr ? "ملء الشاشة" : "Full screen"}
              </button>
            ) : null}
          </div>
          <div className="space-y-2 border-t border-border/60 p-3">
            <div className="flex flex-wrap gap-2">
              <select
                disabled={disabled}
                value={mainImage.label || "other"}
                onChange={(e) => updateImage(safeSelected, { label: e.target.value })}
                className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-semibold"
                aria-label={isAr ? "تصنيف الصورة" : "Image label"}
              >
                {TRAINING_EVIDENCE_IMAGE_LABELS.map((row) => (
                  <option key={row.value} value={row.value}>
                    {isAr ? row.ar : row.en}
                  </option>
                ))}
              </select>
              <span className="self-center text-xs text-text-light">{labelText(mainImage.label)}</span>
            </div>
            <input
              type="text"
              disabled={disabled}
              value={mainImage.caption || ""}
              onChange={(e) => updateImage(safeSelected, { caption: e.target.value })}
              placeholder={isAr ? "وصف اختياري للصورة" : "Optional caption"}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              maxLength={500}
            />
          </div>
        </div>
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 text-sm text-text-light sm:aspect-[2/1]">
          {isAr ? "أضف صوراً لمعرض التدريب" : "Add images to build your training gallery"}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 min-[480px]:grid-cols-4 sm:grid-cols-5 sm:gap-2.5">
        {images.map((img, index) => {
          const url = attachmentDisplayUrl(img.storageKey);
          const isDragging = dragIndex === index;
          const isSelected = safeSelected === index;
          return (
            <div
              key={`${img.storageKey}-${index}`}
              draggable={!disabled}
              onDragStart={() => !disabled && setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => {
                if (disabled) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDropOnSlot(index);
              }}
              className={`group relative overflow-hidden rounded-xl border-2 bg-muted/30 transition ${
                isSelected ? "border-primary ring-2 ring-primary/20" : isDragging ? "border-primary opacity-60" : "border-border"
              }`}
            >
              <button
                type="button"
                className="relative block aspect-square w-full"
                onClick={() => setSelectedIndex(index)}
                aria-label={isAr ? `اختيار صورة ${index + 1}` : `Select image ${index + 1}`}
                aria-pressed={isSelected}
              >
                {url ? (
                  <Image src={url} alt={img.fileName} fill className="object-cover" sizes="80px" unoptimized />
                ) : (
                  <span className="flex h-full items-center justify-center p-1 text-[10px] text-text-light">{img.fileName}</span>
                )}
              </button>
              {!disabled ? (
                <div className="absolute inset-x-0 top-0 flex justify-between bg-gradient-to-b from-black/55 to-transparent p-0.5 sm:opacity-0 sm:group-hover:opacity-100">
                  <span className="cursor-grab rounded bg-white/90 p-0.5 text-foreground active:cursor-grabbing" aria-hidden>
                    <GripVertical className="h-3 w-3" />
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="rounded bg-red-600/90 p-0.5 text-white"
                    aria-label={isAr ? "حذف" : "Remove"}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        {!disabled && images.length < MAX_TRAINING_EVIDENCE_IMAGES ? (
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square min-h-[4rem] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-white text-text-light transition hover:border-primary hover:text-primary disabled:opacity-60"
            aria-label={isAr ? "إضافة صور" : "Add images"}
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <ImagePlus className="h-5 w-5" aria-hidden />}
            <span className="px-1 text-center text-[10px] font-bold">{isAr ? "إضافة" : "Add"}</span>
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <p className="text-xs text-text-light">
        {isAr
          ? "اختر حتى 8 صور. اسحب لإعادة الترتيب. انقر على الصورة المصغرة لعرضها كصورة رئيسية."
          : "Select up to 8 images. Drag to reorder. Tap a thumbnail to set the main preview."}
      </p>

      {previewKey ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewKey(null)}
          onKeyDown={(e) => e.key === "Escape" && setPreviewKey(null)}
        >
          <button
            type="button"
            className="absolute end-4 top-4 rounded-full bg-white p-2 text-foreground"
            onClick={() => setPreviewKey(null)}
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <div className="relative max-h-[90vh] w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachmentDisplayUrl(previewKey)}
              alt=""
              className="mx-auto max-h-[90vh] w-auto max-w-full rounded-lg object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TrainingEvidenceGallery;
