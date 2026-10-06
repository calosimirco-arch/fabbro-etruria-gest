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
