"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
    /** Text direction for the portaled menu (parent `dir` is not inherited from `body`) */
    menuDirection?: "rtl" | "ltr";
  }
>(
  (
    {
      className = "",
      sideOffset = 4,
      collisionPadding = 12,
      avoidCollisions = true,
      menuDirection,
      style,
      ...props
    },
    ref
  ) => (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        avoidCollisions={avoidCollisions}
        style={{
          ...(style as object),
          ...(menuDirection ? { direction: menuDirection } : {}),
        }}
        className={`z-[100] max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] min-w-[200px] overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg outline-none ${className}`}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
);
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className = "", ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={`relative flex cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm text-text outline-none focus:bg-gray-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
