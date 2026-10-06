import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRegisterSaraRequest, useSaraPrices } from "@/hooks/useData";
import {
  EMPTY_DRAFT,
  applyAnswer,
  buildProposal,
  closingSpeech,
  describeWhen,
  extractWake,
  findPrice,
  greeting,
  nextStep,
  normalize,
  parseReminder,
  question,
  type SaraDraft,
} from "@/lib/sara";
import { listen, speak, speechSupport, stopSpeaking, type Listener } from "@/lib/speech";

export interface SaraMessage {
  from: "sara" | "persona";
  text: string;
}

const CANCEL = /\b(annulla|lascia stare|lascia perdere|ricominciamo)\b/;
const NEW_CALL = /\b(nuova chiamata|c'e una chiamata|rispondi|prendi (?:la )?chiamata|nuovo cliente)\b/;

/**
 * La conversazione di Sara. Due modi: in "chiamata" raccoglie i dati di una persona, uno alla volta, come una
 * segretaria; a riposo ascolta solo la parola «Ehi Sara» (se attivata) e capisce i promemoria. Funziona anche
 * scrivendo, per i browser senza riconoscimento vocale. Sara non decide nulla: registra una richiesta che il
 * Titolare deve confermare (vedi supabase/sara_assistant.sql).
 */
export function useSara() {
  const register = useRegisterSaraRequest();
  const { data: prices } = useSaraPrices();

  const [messages, setMessages] = useState<SaraMessage[]>([]);
  const [draft, setDraft] = useState<SaraDraft>(EMPTY_DRAFT);
  const [inCall, setInCall] = useState(false);
  const [armed, setArmedState] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");

  // Gli ascoltatori vivono oltre un singolo disegno: lo stato che leggono sta in riferimenti, mai nelle chiusure.
  const draftRef = useRef(draft);
  const inCallRef = useRef(inCall);
  const armedRef = useRef(armed);
  const speakingRef = useRef(false);
  const pricesRef = useRef(prices ?? []);
  const listenerRef = useRef<Listener | null>(null);
  const registerRef = useRef(register.mutateAsync);
  const handleRef = useRef<(text: string, fromVoice: boolean) => void>(() => {});

  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { inCallRef.current = inCall; }, [inCall]);
  useEffect(() => { armedRef.current = armed; }, [armed]);
  useEffect(() => { pricesRef.current = prices ?? []; }, [prices]);
  useEffect(() => { registerRef.current = register.mutateAsync; }, [register.mutateAsync]);

  const stopListening = useCallback(() => {
    listenerRef.current?.stop();
    listenerRef.current = null;
  }, []);

  const startListening = useCallback(() => {
    if (listenerRef.current || !speechSupport.listening()) return;
    listenerRef.current = listen({
      continuous: true,
      onInterim: (t) => { if (!speakingRef.current) setInterim(t); },
      onFinal: (t) => {
        setInterim("");
        // Mentre Sara parla il microfono sentirebbe la sua stessa voce: si ignora tutto.
        if (!speakingRef.current) handleRef.current(t, true);
      },
      onDenied: () => {
        listenerRef.current = null;
        setArmedState(false);
        toast.error("Il microfono non è consentito: abilitalo dalle impostazioni del browser, oppure scrivi a Sara.");
      },
      onEnd: () => { listenerRef.current = null; },
    });
  }, []);

  // Ascolto acceso quando serve (chiamata in corso o «Ehi Sara» attivo), spento altrimenti.
  useEffect(() => {
    if (armed || inCall) startListening();
    else stopListening();
  }, [armed, inCall, startListening, stopListening]);

  useEffect(() => () => { stopListening(); stopSpeaking(); }, [stopListening]);

  const say = useCallback(async (text: string) => {
    setMessages((m) => [...m, { from: "sara", text }]);
    speakingRef.current = true;
    setSpeaking(true);
    try {
      await speak(text);
    } finally {
      speakingRef.current = false;
      setSpeaking(false);
    }
  }, []);

  const finishCall = useCallback(async (finalDraft: SaraDraft) => {
    const price = findPrice(finalDraft.reason ?? "", pricesRef.current);
    const proposal = buildProposal(finalDraft, price);
    try {
      await registerRef.current({
        kind: finalDraft.kind,
        name: finalDraft.name ?? "",
        phone: finalDraft.phone ?? "",
        email: finalDraft.email ?? "",
        address: finalDraft.address ?? "",
        reason: finalDraft.reason ?? "",
        urgency: finalDraft.urgency ?? "normale",
        notes: finalDraft.notes ?? "",
        mood: finalDraft.mood,
        priceHint: price?.amount ?? null,
        proposal,
      });
      toast.success("Richiesta pronta: aspetta la tua conferma");
      await say(closingSpeech(finalDraft, price));
    } catch {
      // l'errore e' gia' mostrato dalla mutazione
      await say("Mi dispiace, non sono riuscita a salvare la richiesta. Può riprovare tra un attimo?");
    }
    setInCall(false);
    setDraft(EMPTY_DRAFT);
  }, [say]);

  const startCall = useCallback(async () => {
    setDraft(EMPTY_DRAFT);
    setMessages([]);
    setInCall(true);
    inCallRef.current = true;
    draftRef.current = EMPTY_DRAFT;
    await say(greeting());
  }, [say]);

  const cancelCall = useCallback(() => {
    stopSpeaking();
    setInCall(false);
    setDraft(EMPTY_DRAFT);
    void say("Va bene, annullo la chiamata.");
  }, [say]);

  const handle = useCallback(async (raw: string, fromVoice: boolean) => {
    const text = raw.trim();
    if (!text) return;

    if (inCallRef.current) {
      setMessages((m) => [...m, { from: "persona", text }]);
      if (CANCEL.test(normalize(text))) { cancelCall(); return; }
      const step = nextStep(draftRef.current);
      if (!step) return;
      const result = applyAnswer(draftRef.current, step, text);
      if (!result.ok) { await say(result.reply ?? question(step)); return; }
      draftRef.current = result.draft;
      setDraft(result.draft);
      const next = nextStep(result.draft);
      if (next) await say(question(next));
      else await finishCall(result.draft);
      return;
    }

    // A riposo: con la voce serve «Ehi Sara»; scrivendo no (l'ha scritto apposta a lei).
    let command = normalize(text);
    if (fromVoice) {
      const wake = extractWake(text);
      if (!wake.woke) return;
      command = wake.rest;
    }
    setMessages((m) => [...m, { from: "persona", text }]);

    if (!command) { await say("Dica pure, sono qui."); return; }
    if (NEW_CALL.test(command)) { await startCall(); return; }

    const reminder = parseReminder(command);
    if (reminder) {
      try {
        await registerRef.current({
          kind: "promemoria", name: "", phone: "", email: "", address: "", reason: reminder.what,
          urgency: "normale", notes: "", mood: "sereno", scheduledAt: reminder.at,
          proposal: `Promemoria: ${reminder.what}, ${describeWhen(reminder.at)}.`,
        });
        await say(`Va bene, le ricordo ${describeWhen(reminder.at)} di ${reminder.what}.`);
      } catch {
        await say("Non sono riuscita a salvare il promemoria.");
      }
      return;
    }
    await say("Non ho capito. Può dire «nuova chiamata» per far rispondere me a un cliente, oppure «ricordami domani di...».");
  }, [cancelCall, finishCall, say, startCall]);

  useEffect(() => { handleRef.current = (t, v) => { void handle(t, v); }; }, [handle]);

  return {
    messages,
    draft,
    inCall,
    armed,
    speaking,
    interim,
    canListen: speechSupport.listening(),
    canSpeak: speechSupport.speaking(),
    setArmed: setArmedState,
    startCall,
    cancelCall,
    submitText: (text: string) => handle(text, false),
  };
}
