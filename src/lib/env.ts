/**
 * Rende utilizzabile l'indirizzo del progetto Supabase scritto a mano nel file .env.
 * Perdona gli errori piu' comuni: virgolette, spazi, "https://" mancante (Chrome non lo mostra nella barra),
 * barra finale e pezzi in piu' come /rest/v1 o /auth/v1. Restituisce null se non e' un indirizzo.
 */
export function normalizeSupabaseUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let text = raw.trim().replace(/^["']+|["']+$/g, "").trim();
  if (!text) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text}`;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** La chiave: senza virgolette, spazi e a-capo incollati per sbaglio. */
export function cleanKey(raw: string | undefined): string {
  return (raw ?? "").replace(/\s+/g, "").replace(/^["']+|["']+$/g, "");
}
