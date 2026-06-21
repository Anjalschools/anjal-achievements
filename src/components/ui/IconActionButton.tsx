"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
};

const IconActionButton = ({ label, children, className = "", ...props }: IconActionButtonProps) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    className={`rounded-lg border border-border p-2 transition hover:bg-muted disabled:opacity-60 ${className}`}
    {...props}
  >
    {children}
  </button>
);

export default IconActionButton;
