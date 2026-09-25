'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Native <dialog> as a modal: focus trap, Escape and backdrop click close it.
 * Children render only while open, so they may read browser-only state.
 */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="card m-auto w-[min(26rem,calc(100vw-2rem))] p-0 text-ink backdrop:bg-black/40"
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={titleId} className="font-display text-xl font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-ink-2 hover:bg-paper-2"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
