"use client";

import { useEffect, useRef, useId } from "react";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  side?: "bottom" | "right";
}

/**
 * Lightweight slide-over built on the native <dialog> element. Mirrors the
 * BrickCard aesthetic: pure-white surface with a 2px jet-black border so it
 * reads as a confident overlay rather than a soft modal.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  side = "right",
}: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onOpenChange(false);
    }
  };

  const sideClasses =
    side === "bottom"
      ? "bottom-0 inset-x-0 max-h-[85vh] border-t-2"
      : "right-0 inset-y-0 max-w-md w-full border-l-2";

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onClick={handleClick}
      aria-labelledby={open ? `sheet-title-${titleId}` : undefined}
      className="fixed m-0 p-0 bg-transparent backdrop:bg-jet-black/60"
    >
      {open ? (
        <div
          className={`${sideClasses} fixed bg-pure-white text-jet-black border-jet-black overflow-y-auto shadow-click`}
        >
          <div className="sticky top-0 z-10 bg-sunshine-yellow border-b-2 border-jet-black px-4 py-3 flex items-center justify-between">
            <h2
              id={`sheet-title-${titleId}`}
              className="type-h4 truncate"
              style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-chip border-2 border-jet-black bg-pure-white p-1.5 hover:-translate-x-px hover:-translate-y-px hover:shadow-click transition-all"
              aria-label="Close"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
