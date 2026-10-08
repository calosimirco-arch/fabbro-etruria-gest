import { useState } from "react";
import { Check, Copy, Mic } from "lucide-react";

/**
 * "Avvio con la voce": un collegamento che apre Sara gia' in ascolto. Si abbina all'assistente del telefono
 * (Google Assistant / Siri), che sa aprire un collegamento anche con l'app chiusa: «Ok Google, Sara».
 */
export function VoiceLaunch() {
  const [copied, setCopied] = useState(false);
  const online = window.location.protocol === "http:" || window.location.protocol === "https:";
  if (!online) return null;
  const link = `${window.location.origin}${window.location.pathname}#/sara?attiva=1`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // si puo' comunque selezionare il testo
    }
  };
  return (
    <div className="box space-y-3 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold"><Mic className="h-4 w-4 text-brand" />Apri Sara con la voce, anche con l&apos;app chiusa</p>
      <p className="text-xs text-steel">Un sito non può restare in ascolto da chiuso: lo fa l&apos;assistente del telefono, che apre questo collegamento (Sara parte già in ascolto).</p>
      <div className="flex gap-2">
        <input className="field text-xs" readOnly value={link} aria-label="Collegamento che apre Sara in ascolto" onFocus={(e) => e.currentTarget.select()} />
        <button className="btn shrink-0" onClick={() => void copy()}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copiato" : "Copia"}</button>
      </div>
      <div className="grid gap-3 text-xs md:grid-cols-2">
        <div><p className="font-semibold">Android (Assistente Google)</p>
          <ol className="ml-4 list-decimal space-y-0.5"><li>Apri l&apos;app Google → profilo → <b>Impostazioni → Assistente Google → Routine</b>.</li><li>Nuova routine: come comando scrivi <b>«Sara»</b>.</li><li>Azione: <b>«Apri un sito Web o un&apos;app»</b> e incolla il collegamento.</li><li>Ora di’ <b>«Ok Google, Sara»</b>: si apre Sara in ascolto.</li></ol></div>
        <div><p className="font-semibold">iPhone (Siri)</p>
          <ol className="ml-4 list-decimal space-y-0.5"><li>Apri l&apos;app <b>Comandi</b> → <b>+</b> → azione <b>«Apri URL»</b> e incolla il collegamento.</li><li>Chiama il comando <b>«Sara»</b>.</li><li>Ora di’ <b>«Ehi Siri, Sara»</b>: si apre Sara in ascolto.</li></ol></div>
      </div>
    </div>
  );
}
