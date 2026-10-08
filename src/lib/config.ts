// Configurazione del progetto Supabase: dal file .env (sviluppo) oppure scritta nella schermata di avvio e
// salvata nel browser (versione "file unico"). Mai un errore: se il browser non permette di salvare, si riscrive ogni volta.
const STORAGE_KEY = "sara-gest-config";

export interface StoredConfig { url: string; key: string }

export function readStoredConfig(): StoredConfig | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredConfig>;
    return typeof parsed.url === "string" && typeof parsed.key === "string" ? { url: parsed.url, key: parsed.key } : null;
  } catch {
    return null;
  }
}

export function saveStoredConfig(config: StoredConfig): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredConfig(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // niente da cancellare
  }
}

// ---- Collegare un altro dispositivo (es. il telefono) senza riscrivere nulla ----
// Il collegamento contiene indirizzo e chiave "anon public" del progetto (la chiave anon e' pubblica per natura: sta
// in qualunque app web; i dati restano protetti dall'accesso con email e password e dalle regole del database).
// MAI la chiave "service_role".

function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(text: string): string {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
}

export function encodeConfig(config: StoredConfig): string {
  return toBase64Url(JSON.stringify({ u: config.url, k: config.key }));
}

export function decodeConfig(text: string): StoredConfig | null {
  try {
    const parsed = JSON.parse(fromBase64Url(text)) as { u?: unknown; k?: unknown };
    return typeof parsed.u === "string" && typeof parsed.k === "string" ? { url: parsed.u, key: parsed.k } : null;
  } catch {
    return null;
  }
}

/** Se l'indirizzo della pagina contiene ?cfg=..., salva la configurazione e toglie il parametro dalla barra. Non lancia mai. */
export function consumeConfigFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("cfg");
    if (!raw) return;
    const config = decodeConfig(raw);
    if (config && /^https?:\/\//.test(config.url) && config.key.length >= 20) saveStoredConfig(config);
    url.searchParams.delete("cfg");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch {
    // un indirizzo strano non deve mai impedire l'avvio
  }
}

/** Il collegamento da aprire sull'altro dispositivo (solo se l'app e' online: da file non avrebbe senso). */
export function buildShareLink(config: StoredConfig, base: string = window.location.origin + window.location.pathname): string {
  return `${base}?cfg=${encodeConfig(config)}`;
}
