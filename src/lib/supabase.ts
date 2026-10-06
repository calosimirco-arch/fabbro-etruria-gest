import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true quando le variabili d'ambiente ci sono: senza, l'app mostra come configurarle invece di una pagina bianca. */
export const isConfigured = Boolean(url && key);

export const supabase = createClient(url ?? "https://example.invalid", key ?? "missing");

/** I messaggi del database sono in ASCII (puo', e', gia'): si rimettono gli accenti. */
export function friendly(error: { message: string }): Error {
  return new Error(error.message.replace(/\bpuo'/g, "può").replace(/\be'/g, "è").replace(/\bgia'/g, "già"));
}
