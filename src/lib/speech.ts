// Voce di Sara: riconoscimento (parlare) e sintesi (ascoltare) con le funzioni del browser, in italiano.
// Nessun servizio esterno: niente costi e niente audio inviato a terzi dal nostro codice (il browser puo' pero'
// usare il proprio servizio vocale: in Chrome il riconoscimento passa dai server di Google).
//
// LIMITI NOTI: Firefox non ha il riconoscimento vocale; la WebView di Android e l'app Windows (Electron) non lo
// supportano in modo affidabile. Dove manca, la pagina di Sara resta usabile scrivendo (vedi `speechSupport`).

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupport = {
  listening: () => recognitionCtor() !== null,
  speaking: () => typeof window !== "undefined" && "speechSynthesis" in window,
};

/** Nomi di voci italiane femminili note, dalla piu' naturale. Se nessuna c'e' si usa la prima voce italiana. */
const PREFERRED_VOICES = ["elsa", "isabella", "alice", "federica", "paola", "google italiano", "microsoft elsa", "microsoft isabella"];

export function pickItalianVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const italian = voices.filter((v) => v.lang.toLowerCase().startsWith("it"));
  for (const name of PREFERRED_VOICES) {
    const found = italian.find((v) => v.name.toLowerCase().includes(name));
    if (found) return found;
  }
  return italian[0] ?? null;
}

/** Fa parlare Sara. Risolve quando ha finito (o subito se la sintesi non c'e'): non lancia mai. */
export function speak(text: string): Promise<void> {
  if (!speechSupport.speaking() || !text.trim()) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "it-IT";
      utterance.rate = 0.98;
      utterance.pitch = 1.05; // voce un po' piu' calda
      const voice = pickItalianVoice(synth.getVoices());
      if (voice) utterance.voice = voice;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      synth.speak(utterance);
    } catch {
      resolve();
    }
  });
}

export function stopSpeaking(): void {
  try {
    if (speechSupport.speaking()) window.speechSynthesis.cancel();
  } catch {
    // niente da fermare
  }
}

export interface Listener {
  stop: () => void;
}

export interface ListenOptions {
  /** true = resta in ascolto (per «Ehi Sara»); false = una sola frase. */
  continuous: boolean;
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  /** Il microfono e' stato negato o non e' disponibile: non ha senso riprovare in silenzio. */
  onDenied?: () => void;
  onEnd?: () => void;
}

/** Ascolto del microfono. Un ascolto continuo che il browser interrompe da solo (succede dopo qualche minuto) riparte. */
export function listen(options: ListenOptions): Listener | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  let stopped = false;
  const rec = new Ctor();
  rec.lang = "it-IT";
  rec.continuous = options.continuous;
  rec.interimResults = true;
  rec.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const text = event.results[i][0].transcript.trim();
      if (!text) continue;
      if (event.results[i].isFinal) options.onFinal(text);
      else options.onInterim?.(text);
    }
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      stopped = true;
      options.onDenied?.();
    }
  };
  rec.onend = () => {
    if (options.continuous && !stopped) {
      try {
        rec.start();
        return;
      } catch {
        // non riesce a ripartire: si chiude normalmente
      }
    }
    options.onEnd?.();
  };
  try {
    rec.start();
  } catch {
    return null;
  }
  return {
    stop: () => {
      stopped = true;
      try {
        rec.abort();
      } catch {
        // gia' fermo
      }
    },
  };
}
