"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

/**
 * Bottom-Sheet (Popover von unten): Slide-up, abgedunkelter Hintergrund,
 * auf Mobile per Swipe schliessbar. Variante "tall" = 75 % Viewport-Höhe, 100 % Breite.
 */
function BottomSheet(props: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="bottom-sheet" {...props} />;
}

function BottomSheetTrigger(props: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="bottom-sheet-trigger" {...props} />;
}

function BottomSheetClose(props: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="bottom-sheet-close" {...props} />;
}

function BottomSheetContent({
  className,
  children,
  size = "auto",
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & { size?: "auto" | "tall" }) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70" />
      <DrawerPrimitive.Content
        data-slot="bottom-sheet-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex w-full flex-col rounded-t-xl border-t bg-popover text-popover-foreground outline-none",
          size === "tall" ? "h-[75vh]" : "max-h-[85vh]",
          className,
        )}
        {...props}
      >
        <div aria-hidden className="mx-auto mt-3 mb-1 h-1.5 w-12 shrink-0 rounded-full bg-border" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

function BottomSheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="bottom-sheet-header" className={cn("flex flex-col gap-1 px-5 pt-2 pb-3", className)} {...props} />;
}

function BottomSheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="bottom-sheet-footer" className={cn("mt-auto flex gap-2 border-t px-5 py-4", className)} {...props} />;
}

function BottomSheetTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title data-slot="bottom-sheet-title" className={cn("font-display text-lg font-semibold", className)} {...props} />;
}

function BottomSheetDescription({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return <DrawerPrimitive.Description data-slot="bottom-sheet-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetFooter,
  BottomSheetTitle,
  BottomSheetDescription,
};
