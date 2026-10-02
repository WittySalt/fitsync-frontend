type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) {
    return context;
  }
  const ctor: AudioContextCtor | undefined =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext);
  try {
    context = ctor ? new ctor() : null;
  } catch {
    context = null;
  }
  return context;
}

/** Call from a tap (the Start button): browsers only let a page make sound after one. */
export function unlockSound(): void {
  const ctx = audioContext();
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }
}

/** Three short beeps made with Web Audio, no sound file. Silent when the browser has no audio. */
export function playTimerBeep(): void {
  const ctx = audioContext();
  if (!ctx) {
    return;
  }
  try {
    const start = ctx.currentTime + 0.02;
    [0, 0.28, 0.56].forEach((offset) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.2);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.22);
    });
  } catch {
    // A beep is a courtesy; the tick and the bar still tell the cook.
  }
}

export function vibrateTimer(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([200, 100, 200]);
    }
  } catch {
    // Not every browser allows it.
  }
}
