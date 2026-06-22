"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export type PartnershipMessageActionItem = {
  key: "edit" | "delete" | "restore";
  label: string;
  emoji: string;
  tone?: "default" | "danger" | "success";
  onSelect: () => void;
};

type PartnershipMessageActionsMenuProps = {
  isAr: boolean;
  align?: "start" | "end";
  busy?: boolean;
  items: PartnershipMessageActionItem[];
  triggerLabel: string;
};

const toneClass: Record<NonNullable<PartnershipMessageActionItem["tone"]>, string> = {
  default: "text-slate-800 hover:bg-slate-50",
  danger: "text-red-600 hover:bg-red-50",
  success: "text-emerald-700 hover:bg-emerald-50",
};

/** T.1.2.H — Portaled ⋮ menu (no Radix) for scroll/overflow-safe message actions. */
const PartnershipMessageActionsMenu = ({
  isAr,
  align = "start",
  busy = false,
  items,
  triggerLabel,
}: PartnershipMessageActionsMenuProps) => {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateCoords = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 148;
    const menuHeight = Math.max(items.length, 1) * 38 + 10;
    const alignEnd = align === "end";

    let left = alignEnd ? rect.right - menuWidth : rect.left;
    left = Math.min(Math.max(8, left), window.innerWidth - menuWidth - 8);

    let top = rect.bottom + 6;
    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - 6);
    }

    setCoords({ top, left });
  }, [align, items.length]);

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
  }, [open, updateCoords, items.length]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateCoords);
    window.addEventListener("scroll", updateCoords, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords, true);
    };
  }, [open, updateCoords]);

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  const menu =
    open && mounted
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            data-state="open"
            dir={isAr ? "rtl" : "ltr"}
            className="pointer-events-auto visible fixed z-[99999] min-w-[9rem] rounded-xl border border-slate-200 bg-white p-1 opacity-100 shadow-lg"
            style={{ top: coords.top, left: coords.left }}
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={`flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-start text-xs font-bold ${toneClass[item.tone ?? "default"]}`}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                <span aria-hidden>{item.emoji}</span>
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={handleToggle}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {menu}
    </>
  );
};

export default PartnershipMessageActionsMenu;
