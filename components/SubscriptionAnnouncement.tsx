"use client";

import { useEffect, useRef, useState } from "react";
import { getDevicePreference, initializeDevicePreferences, updateDevicePreferences } from "@/lib/device-preferences";
import { RideDialog } from "./RideDialog";

const TITLE = "OOS is moving to a subscription model";
const SEEN_KEY = "oos_subscription_announcement_seen";

export function SubscriptionAnnouncement() {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true);
  const returnFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void initializeDevicePreferences().then(() => {
      if (!cancelled) setSeen(getDevicePreference(SEEN_KEY) === "1");
    }).catch(() => { if (!cancelled) setSeen(false); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (wasOpen.current && !open) returnFocus.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);
  return <>
    {!seen && <button type="button" className="ss-subscription-banner" aria-haspopup="dialog" onClick={event => {
      returnFocus.current = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]") ?? [])]
        .find(element => element !== event.currentTarget) ?? null;
      setOpen(true);
      setSeen(true);
      // Opening the notice stays available even if saving is temporarily unavailable.
      void updateDevicePreferences({ [SEEN_KEY]: "1" }).catch(() => {});
    }}>
      <span>
        <strong>{TITLE}</strong>
        <span>Tap to learn what’s changing and why.</span>
      </span>
      <span className="ss-subscription-banner__arrow" aria-hidden="true">›</span>
    </button>}
    {open && <RideDialog title={TITLE} className="ss-subscription-announcement" onClose={() => setOpen(false)}>
      <p>To help bring OOS to every state and continue adding new features, we’re introducing subscription plans.</p>
      <p>OOS will remain free for the rest of November. Expect these changes mid December.</p>
      <p><strong>Free:</strong> Map and aircraft tracking will remain free.</p>
      <p><strong>Pro:</strong> Notifications, Ride Mode, ride summaries, and flight paths will move to OOS Pro.</p>
      <p><strong>Elite:</strong> An OOS Elite subscription is also on the way. We’ll share more details soon.</p>
      <button type="button" className="ss-ride-primary" onClick={() => setOpen(false)}>Got it</button>
    </RideDialog>}
  </>;
}
