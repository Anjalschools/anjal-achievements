"use client";

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";

type NewsShareBarProps = {
  url: string;
  title: string;
  isAr: boolean;
};

const NewsShareBar = ({ url, title, isAr }: NewsShareBarProps) => {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleKeyDownCopy = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void handleCopy();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/80 p-3">
      <span className="flex items-center gap-1 text-sm font-semibold text-text">
        <Share2 className="h-4 w-4 text-primary" aria-hidden />
        {isAr ? "مشاركة" : "Share"}
      </span>
      <a
        href={`https://twitter.com/intent/tweet?url=${enc}&text=${encTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-text shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
      >
        X
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${enc}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-text shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
      >
        Facebook
      </a>
      <button
        type="button"
        onClick={() => void handleCopy()}
        onKeyDown={handleKeyDownCopy}
        aria-label={isAr ? "نسخ الرابط" : "Copy link"}
        className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90"
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Link2 className="h-3.5 w-3.5" aria-hidden />}
        {copied ? (isAr ? "تم النسخ" : "Copied") : isAr ? "نسخ الرابط" : "Copy link"}
      </button>
    </div>
  );
};

export default NewsShareBar;
