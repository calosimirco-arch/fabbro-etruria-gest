import { useState } from "react";
import { Check, Copy, Smartphone } from "lucide-react";
import { buildShareLink } from "@/lib/config";
import { activeConfig } from "@/lib/supabase";

/**
 * "Usa sul telefono": genera un collegamento che, aperto sul telefono, configura da solo il progetto Supabase
 * (resta solo da accedere). Compare solo quando l'app e' online: da file sul computer il collegamento non servirebbe.
 */
export function PhoneLink() {
  const [copied, setCopied] = useState(false);
  const online = window.location.protocol === "http:" || window.location.protocol === "https:";
  if (!online || !activeConfig) return null;
  const link = buildShareLink(activeConfig);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // senza permesso per gli appunti si puo' comunque selezionare il testo qui sotto
    }
  };

  return (
    <div className="box space-y-2 p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold"><Smartphone className="h-4 w-4 text-brand" />Usa Sara Gest sul telefono</p>
      <p className="text-xs text-steel">Copia questo collegamento e invialo a te stesso (WhatsApp, email, note). Aprilo dal telefono: il progetto si collega da solo e ti basta accedere. Non condividerlo con altri: è per i tuoi dispositivi.</p>
      <div className="flex gap-2">
        <input className="field text-xs" readOnly value={link} aria-label="Collegamento per il telefono" onFocus={(e) => e.currentTarget.select()} />
        <button className="btn shrink-0" onClick={() => void copy()}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copiato" : "Copia"}</button>
      </div>
    </div>
  );
}
