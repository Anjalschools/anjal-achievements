"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

type SafeLocalImageProps = {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** When fill is true, parent must be `relative` with defined size */
  objectFit?: "cover" | "contain";
  fallback: ReactNode;
};

/**
 * Local `next/image` with onError → fallback (no broken image icon).
 */
const SafeLocalImage = ({
  src,
  alt,
  fill,
  width,
  height,
  className = "",
  sizes,
  priority,
  objectFit = "cover",
  fallback,
}: SafeLocalImageProps) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <>{fallback}</>;
  }

  const fit = objectFit === "contain" ? "object-contain" : "object-cover";

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={`${fit} ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      className={`${fit} ${className}`}
      onError={() => setFailed(true)}
    />
  );
};

export default SafeLocalImage;
