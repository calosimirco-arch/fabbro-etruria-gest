import { useState } from "react";
import { saveStoredConfig } from "@/lib/config";
import { cleanKey, normalizeSupabaseUrl } from "@/lib/env";
import { configProblem } from "@/lib/supabase";

/** Primo avvio: si incollano indirizzo e chiave del progetto Supabase, senza file .env e senza terminale. */
export default function SetupPage() {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = normalizeSupabaseUrl(url);
    const cleanedKey = cleanKey(key);
    if (!cleanUrl) return setError("L'indirizzo non è valido: deve essere simile a https://abcdefgh.supabase.co");
    if (cleanedKey.length < 20) return setError("La chiave sembra troppo corta: copiala tutta (inizia con eyJ...).");
    if (!saveStoredConfig({ url: cleanUrl, key: cleanedKey })) return setError("Il browser non permette di salvare i dati: prova con Chrome o Edge in una finestra normale (non anonima).");
    window.location.reload();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center p-4">
      <form onSubmit={save} className="box w-full space-y-3 p-5">
        <h1 className="text-xl font-bold text-brand">Sara Gest</h1>
        <p className="text-sm text-steel">Primo avvio: collega il tuo progetto Supabase. In Supabase apri <b>Project Settings → API</b> e copia i due valori.</p>
        {(error ?? configProblem) && <p className="border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error ?? configProblem}</p>}
        <label className="block text-sm font-medium">Project URL
          <input className="field mt-1" placeholder="https://abcdefgh.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
        </label>
        <label className="block text-sm font-medium">Chiave «anon public»
          <input className="field mt-1" placeholder="eyJhbGciOi..." value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <button className="btn w-full">Salva e continua</button>
        <p className="text-xs text-steel">I dati restano solo in questo browser. Usa la chiave «anon public», mai la «service_role».</p>
      </form>
    </main>
  );
}
