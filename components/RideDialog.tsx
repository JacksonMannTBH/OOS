"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function RideDialog({ title, children, onClose, className = "" }: { title: string; children: ReactNode; onClose?: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    titleRef.current?.focus({ preventScroll: true });
    return () => dialog?.close();
  }, []);
  return createPortal(<dialog ref={ref} className={`ss-ride-dialog ${className}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose?.(); }}>
    <h2 ref={titleRef} id={titleId} tabIndex={-1}>{title}</h2>
    {children}
  </dialog>, document.body);
}
