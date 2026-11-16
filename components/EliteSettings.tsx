"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { loadRiderProfile, updateRiderProfile } from "@/lib/rider-profile-client";
import { SettingsCard } from "./SettingsCard";
import { RideDialog } from "./RideDialog";
import { PIXEL_RIDER_ICONS, PixelRiderIcon, type PixelRiderIconId } from "./PixelRiderIcon";

type Preferences = { visible: boolean; shareSpeed: boolean; username: string; icon: PixelRiderIconId };
const DEFAULTS: Preferences = { visible: false, shareSpeed: false, username: "", icon: "eye" };
const ICON_REPLACEMENTS: Record<string, PixelRiderIconId> = {
  biohazard: "radioactive",
  "clapping-hands-sign": "skull",
  "bird-filled": "middle-finger",
  "slightly-smiling-face-small": "middle-finger",
  "black-sun-with-rays-filled": "strawberry",
  "bomb-filled": "pistol-filled",
  "bow-and-arrow": "dagger-knife-small",
  buddy: "face-with-no-good-gesture",
  bug: "game-die",
  "bye-face": "ghost",
  camera: "gem-stone",
  "clapper-board": "slightly-smiling-face",
};

function normalizePreferences(saved: { visible: boolean; shareSpeed: boolean; username: string; icon: string }): Preferences {
  try {
    const savedIcon = typeof saved?.icon === "string" && Object.hasOwn(ICON_REPLACEMENTS, saved.icon)
      ? ICON_REPLACEMENTS[saved.icon] : saved?.icon;
    return {
      visible: typeof saved?.visible === "boolean" ? saved.visible : DEFAULTS.visible,
      shareSpeed: typeof saved?.shareSpeed === "boolean" ? saved.shareSpeed : DEFAULTS.shareSpeed,
      username: typeof saved?.username === "string" ? saved.username.slice(0, 20) : "",
      icon: PIXEL_RIDER_ICONS.find(item => item.id === savedIcon)?.id ?? DEFAULTS.icon,
    };
  } catch { return DEFAULTS; }
}

export function EliteSettings() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const current = useRef(DEFAULTS);
  const revision = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [usernameDraft, setUsernameDraft] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameSaved, setUsernameSaved] = useState(false);
  const usernameInput = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elite, setElite] = useState(false);
  const [confirmSharing, setConfirmSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pickerButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let cancelled=false;
    setError("");
    void loadRiderProfile().then(profile=>{
      if(cancelled)return;
      current.current=normalizePreferences(profile); setPreferences(current.current);
      setUsernameDraft(current.current.username); setElite(profile.elite); setReady(true);
    }).catch(error=>{ if(!cancelled)setError(error instanceof Error ? error.message : "Your profile could not be loaded."); });
    return ()=>{cancelled=true;};
  }, [attempt]);

  async function update(changes: Partial<Preferences>): Promise<boolean> {
    if(busy)return false;
    setBusy(true);
    const previous = current.current;
    const next = { ...current.current, ...changes };
    const change = ++revision.current;
    current.current = next;
    setPreferences(next);
    setError("");
    try {
      const profile=await updateRiderProfile(changes);
      current.current=normalizePreferences(profile);setPreferences(current.current);setElite(profile.elite);
      return true;
    } catch (error) {
      if (revision.current === change) {
        current.current = previous;
        setPreferences(previous);
        setError(error instanceof Error ? error.message : "Your changes could not be saved. Please try again.");
      }
      return false;
    } finally {setBusy(false);}
  }

  async function saveUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || savingUsername || !usernameDraft || usernameDraft === current.current.username) return;
    setSavingUsername(true);
    const saved = await update({ username: usernameDraft });
    setSavingUsername(false);
    if (saved) {
      setUsernameSaved(true);
      usernameInput.current?.blur();
    }
  }

  function closePicker() {
    setPickerOpen(false);
    requestAnimationFrame(() => pickerButton.current?.focus({ preventScroll: true }));
  }

  return <>
    {ready && !elite && <p className="ss-elite-caption" role="status">Elite sharing is not active on this device yet.</p>}
    <p className="ss-elite-caption">Your rider profile is saved for this device. Choose a username before enabling map visibility.</p>
    <SettingsCard title="On the map">
      <label className="ss-elite-toggle">
        <span><strong>Visible to other riders</strong><small>Appear on everyone’s map while you’re in Ride Mode.</small></span>
        <input type="checkbox" role="switch" checked={preferences.visible} disabled={!ready || busy || (!elite && !preferences.visible) || !preferences.username} onChange={event => event.target.checked ? setConfirmSharing(true) : void update({ visible: false })} />
      </label>
      <label className="ss-elite-toggle">
        <span><strong>Share current speed</strong><small>Let other riders see your MPH when they tap your icon.</small></span>
        <input type="checkbox" role="switch" checked={preferences.shareSpeed} disabled={!ready || busy || (!elite && !preferences.shareSpeed) || !preferences.visible} onChange={event => void update({ shareSpeed: event.target.checked })} />
      </label>
    </SettingsCard>
    <SettingsCard title="Username">
      <form className="ss-elite-username" onSubmit={event => void saveUsername(event)}>
        <input ref={usernameInput} aria-label="Username" type="text" value={usernameDraft} disabled={!ready || busy || !elite} maxLength={20} placeholder="Choose your username" autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={event => { setUsernameDraft(event.target.value.replace(/[^a-zA-Z0-9_]/g, "")); setUsernameSaved(false); }} aria-describedby="elite-username-help" />
        <p id="elite-username-help" className="ss-elite-caption">Up to 20 letters, numbers or underscores.</p>
        <button type="submit" className="ss-ride-primary ss-elite-username-save" disabled={!ready || busy || !elite || !usernameDraft || usernameDraft === preferences.username} aria-live="polite">{savingUsername ? "Saving…" : usernameSaved ? "Saved" : "Save"}</button>
      </form>
    </SettingsCard>
    <section className="ss-settings-card">
      <div className="ss-settings-card__header ss-elite-map-icon-row">
        <h2>Your map icon</h2>
        <button ref={pickerButton} type="button" className="ss-elite-selected-icon" aria-label="Change map icon" aria-haspopup="dialog" aria-expanded={pickerOpen} disabled={!ready || busy || !elite} onClick={() => setPickerOpen(true)}>
          <PixelRiderIcon icon={preferences.icon} />
        </button>
      </div>
    </section>
    {pickerOpen && <RideDialog title="Choose your icon" className="ss-elite-icon-dialog" onClose={closePicker}>
      <div className="ss-elite-icons" role="group" aria-label="Map icons">
        {PIXEL_RIDER_ICONS.map(item => <button key={item.id} type="button" aria-label={item.name} aria-pressed={preferences.icon === item.id} onClick={() => { void update({ icon: item.id }); closePicker(); }} className="ss-elite-icon-choice">
          <PixelRiderIcon icon={item.id} />
        </button>)}
      </div>
      <button type="button" className="ss-ride-primary ss-elite-picker-done" onClick={closePicker}>Done</button>
    </RideDialog>}
    {confirmSharing && <RideDialog title="Appear on other riders’ maps?" onClose={()=>setConfirmSharing(false)}>
      <p>Your precise location, username and icon will be visible to everyone using OOS while you record a ride, including while your screen is locked. You can turn sharing off here at any time.</p>
      <p>{preferences.shareSpeed ? "Your current speed will also be shared." : "Your speed stays hidden unless you enable speed sharing."}</p>
      <button className="ss-ride-primary" disabled={busy} onClick={()=>{setConfirmSharing(false);void update({visible:true});}}>Enable visibility</button>
      <button className="ss-ride-secondary" onClick={()=>setConfirmSharing(false)}>Keep hidden</button>
    </RideDialog>}
    {error && <p role="alert" className="ss-elite-save-error">{error}</p>}
    {!ready && error && <button className="ss-ride-secondary" onClick={()=>setAttempt(n=>n+1)}>Try again</button>}
  </>;
}
