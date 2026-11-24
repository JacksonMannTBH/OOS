// Local PCM audio works offline and avoids Ogg support differences on iPhone.
// Recording: Secretlondon, Mudchute pig 3, CC BY-SA 3.0. See /audio/pig-sound-credit.txt.
import { Capacitor, registerPlugin } from "@capacitor/core";

const native = registerPlugin<{
  preloadPig(): Promise<void>;
  playPig(): Promise<{ played: boolean }>;
}>("OOSSoundEffects");

function useNativeSound(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"
    && Capacitor.isPluginAvailable("OOSSoundEffects");
}
let context: AudioContext | undefined;
let bytes: Promise<ArrayBuffer> | undefined;
let buffer: Promise<AudioBuffer> | undefined;

function loadWebSound(): Promise<ArrayBuffer> {
  return bytes ??= fetch("/audio/mudchute-pig-3.wav").then(response => {
    if (!response.ok) throw new Error("pig_sound_unavailable");
    return response.arrayBuffer();
  }).catch(error => { bytes = undefined; throw error; });
}

export async function preloadPigSound(): Promise<void> {
  if (useNativeSound()) await native.preloadPig();
  else await loadWebSound();
}

// Call synchronously from the gesture: iOS can suspend audio between uses.
export function preparePigSound(): Promise<void> {
  if (useNativeSound()) return native.preloadPig();
  context ??= new AudioContext();
  const resumed = context.resume().catch(() => undefined);
  buffer ??= loadWebSound().then(data => context!.decodeAudioData(data.slice(0)))
    .catch(error => { buffer = undefined; throw error; });
  void buffer.catch(() => undefined);
  return resumed;
}

export async function playPigSound(): Promise<boolean> {
  try {
    if (useNativeSound()) return (await native.playPig()).played;
    const decoded = await buffer;
    if (!context || !decoded || context.state !== "running") return false;
    const source = context.createBufferSource();
    source.buffer = decoded;
    source.connect(context.destination);
    source.onended = () => source.disconnect();
    source.start();
    return true;
  } catch { return false; }
}
