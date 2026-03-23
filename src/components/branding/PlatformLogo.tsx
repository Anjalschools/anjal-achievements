"use client";

import Image from "next/image";
import { GraduationCap } from "lucide-react";
import { useState } from "react";
import { PUBLIC_IMG } from "@/lib/publicImages";

type PlatformLogoProps = {
  variant?: "color" | "white";
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
};

export default function PlatformLogo({
  variant = "color",
  size = 48,
  className = "",
  priority = false,
  alt,
}: PlatformLogoProps) {
  const [failed, setFailed] = useState(false);
  const defaultAlt =
    variant === "color"
      ? "شعار مدارس الأنجال الأهلية"
      : "شعار مدارس الأنجال الأهلية - أبيض";

  const src = variant === "white" ? PUBLIC_IMG.logoWhite : PUBLIC_IMG.logoColor;

  if (failed) {
    return (
      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl ${
          variant === "white"
            ? "bg-white/15 text-white ring-1 ring-white/25"
            : "bg-primary/12 text-primary ring-1 ring-primary/20"
        } ${className}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label={alt || defaultAlt}
      >
        <GraduationCap className="h-[58%] w-[58%]" strokeWidth={2} aria-hidden />
      </div>
    );
  }

  const frameClass =
    variant === "white"
      ? "rounded-2xl bg-transparent"
      : "rounded-xl bg-white ring-1 ring-gray-200";

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${frameClass} ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt || defaultAlt}
        fill
        priority={priority}
        sizes={`${size}px`}
        className={`object-contain ${variant === "white" ? "p-1" : "p-0.5"}`}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
