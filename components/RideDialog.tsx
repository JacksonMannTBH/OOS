"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function RideDialog({ title, children, onClose, className = "", dismissOnBackdrop = false }: { title: string; children: ReactNode; onClose?: () => void; className?: string; dismissOnBackdrop?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const backdropPress = useRef(false);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    titleRef.current?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<dialog ref={ref} className={`ss-ride-dialog ${className}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose?.(); }}
    onPointerDown={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      backdropPress.current = dismissOnBackdrop && event.target === event.currentTarget &&
        (event.clientX < rect.left || event.clientX >= rect.right || event.clientY < rect.top || event.clientY >= rect.bottom);
    }}
    onClick={event => {
      const startedOutside = backdropPress.current;
      backdropPress.current = false;
      if (!startedOutside || event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX >= rect.right || event.clientY < rect.top || event.clientY >= rect.bottom) onClose?.();
    }}>
    <h2 ref={titleRef} id={titleId} tabIndex={-1}>{title}</h2>
    {children}
  </dialog>, document.body);
}
