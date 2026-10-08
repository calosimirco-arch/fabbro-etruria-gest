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

export type SpeakResult = "ok" | "blocked";

/**
 * Fa parlare Sara. Risolve quando ha finito, mai dopo un tempo massimo (una sintesi che non da' mai "fine" lascerebbe
 * Sara a ignorare il microfono per sempre), o subito se la sintesi non c'e'. "blocked" = il browser non permette la
 * voce senza un tocco dell'utente (succede quando la pagina si apre da sola, es. da un assistente vocale). Non lancia mai.
 */
export function speak(text: string): Promise<SpeakResult> {
  if (!speechSupport.speaking() || !text.trim()) return Promise.resolve("ok");
  return new Promise((resolve) => {
    let finished = false;
    const finish = (result: SpeakResult) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    const timer = window.setTimeout(() => finish("ok"), Math.max(4000, text.length * 130));
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "it-IT";
      utterance.rate = 0.98;
      utterance.pitch = 1.05; // voce un po' piu' calda
      const voice = pickItalianVoice(synth.getVoices());
      if (voice) utterance.voice = voice;
      utterance.onend = () => finish("ok");
      utterance.onerror = (e) => finish((e as SpeechSynthesisErrorEvent).error === "not-allowed" ? "blocked" : "ok");
      synth.speak(utterance);
    } catch {
      finish("ok");
    }
  });
}

/** Da chiamare dentro un tocco dell'utente: sblocca la voce per il resto della sessione. */
export function unlockVoice(): Promise<SpeakResult> {
  return speak("Sono qui.");
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
  /** true quando il microfono e' acceso, false quando e' fermo (anche per i brevi riavvii automatici). */
  onState?: (active: boolean) => void;
}

/** Pausa prima di riprendere l'ascolto: breve di norma, piu' lunga se il browser continua a interromperlo. */
export function restartDelay(recentRestarts: number): number {
  return recentRestarts >= 6 ? 3000 : recentRestarts >= 3 ? 1000 : 250;
}

/**
 * Ascolto del microfono. Un ascolto continuo che il browser interrompe da solo (succede dopo qualche minuto di
 * silenzio, o se cade la rete) riparte: e' cio' che permette a una postazione di restare in ascolto per giorni.
 * Se le interruzioni sono troppo frequenti la pausa si allunga, cosi' non si va in un giro a vuoto.
 */
export function listen(options: ListenOptions): Listener | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  let stopped = false;
  let timer: number | undefined;
  const restarts: number[] = [];
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
  const begin = (): boolean => {
    try {
      rec.start();
      options.onState?.(true);
      return true;
    } catch {
      return false;
    }
  };
  rec.onend = () => {
    options.onState?.(false);
    if (!options.continuous || stopped) {
      options.onEnd?.();
      return;
    }
    const now = Date.now();
    while (restarts.length && now - restarts[0] > 10_000) restarts.shift();
    restarts.push(now);
    const retry = () => {
      timer = undefined;
      if (stopped) return;
      if (!begin()) {
        // non riesce a ripartire adesso: riprova piu' tardi invece di arrendersi
        restarts.push(Date.now());
        timer = window.setTimeout(retry, restartDelay(restarts.length));
      }
    };
    timer = window.setTimeout(retry, restartDelay(restarts.length));
  };
  if (!begin()) return null;
  return {
    stop: () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
      try {
        rec.abort();
      } catch {
        // gia' fermo
      }
      options.onState?.(false);
    },
  };
}
