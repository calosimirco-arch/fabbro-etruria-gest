import { createClient } from "@supabase/supabase-js";
import { readStoredConfig } from "@/lib/config";
import { cleanKey, normalizeSupabaseUrl } from "@/lib/env";

// Prima il file .env (sviluppo), poi quanto scritto nella schermata di avvio e salvato nel browser.
const stored = readStoredConfig();
const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || stored?.url;
const url = normalizeSupabaseUrl(rawUrl);
const key = cleanKey((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || stored?.key);

/** true quando indirizzo e chiave ci sono e l'indirizzo e' valido: senza, l'app dice come sistemare il file .env. */
export const isConfigured = Boolean(url && key);

/** Cosa non va nel file .env (null = tutto a posto). */
export const configProblem: string | null = !rawUrl?.trim() || !key
  ? "Mancano l'indirizzo o la chiave del progetto Supabase."
  : !url
    ? "L'indirizzo del progetto non è valido: deve essere nella forma https://xxxx.supabase.co (lo trovi in Supabase → Project Settings → API → Project URL)."
    : null;

// Mai un errore all'avvio: con valori mancanti o sbagliati si usa un client "finto" e l'app mostra configProblem.
export const supabase = createClient(url ?? "https://example.invalid", key || "missing");

/** I messaggi del database sono in ASCII (puo', e', gia'): si rimettono gli accenti. */
export function friendly(error: { message: string }): Error {
  return new Error(error.message.replace(/\bpuo'/g, "può").replace(/\be'/g, "è").replace(/\bgia'/g, "già"));
}
