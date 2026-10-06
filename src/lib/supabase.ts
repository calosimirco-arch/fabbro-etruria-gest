import { createClient } from "@supabase/supabase-js";

// .trim(): uno spazio o un a-capo incollato per sbaglio nel file .env rompe l'indirizzo senza che si veda.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** true quando le variabili d'ambiente ci sono: senza, l'app mostra come configurarle invece di una pagina bianca. */
export const isConfigured = Boolean(url && key);

/** L'indirizzo deve finire con .supabase.co: un /rest/v1 in fondo (errore frequente) fa fallire ogni richiesta. */
export const urlProblem = url && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)
  ? "L'indirizzo del progetto deve essere nella forma https://xxxx.supabase.co, senza niente dopo \".co\"."
  : null;

export const supabase = createClient(url || "https://example.invalid", key || "missing");

/** I messaggi del database sono in ASCII (puo', e', gia'): si rimettono gli accenti. */
export function friendly(error: { message: string }): Error {
  return new Error(error.message.replace(/\bpuo'/g, "può").replace(/\be'/g, "è").replace(/\bgia'/g, "già"));
}
