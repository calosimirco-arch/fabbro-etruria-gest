import type { SaraKind, SaraMood, SaraPrice, SaraUrgency } from "@/types";

// Il "cervello" di Sara senza voce e senza React: capisce cosa dice la persona, decide la prossima domanda e prepara
// la proposta. Tutto in italiano. Si prova da solo (sara.test.ts); la voce vera sta in speech.ts.

export type SaraStep = "motivo" | "nome" | "telefono" | "email" | "indirizzo" | "urgenza" | "note";

/**
 * Cio' che Sara ha raccolto. `null` = non ancora chiesto; "" = chiesto e la persona non vuole/non puo' dirlo
 * (per i campi facoltativi). Cosi' non richiede due volte la stessa cosa.
 */
export interface SaraDraft {
  reason: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  urgency: SaraUrgency | null;
  notes: string | null;
  kind: SaraKind;
  mood: SaraMood;
}

export const EMPTY_DRAFT: SaraDraft = {
  reason: null,
  name: null,
  phone: null,
  email: null,
  address: null,
  urgency: null,
  notes: null,
  kind: "intervento",
  mood: "sereno",
};

const STEPS: readonly SaraStep[] = ["motivo", "nome", "telefono", "email", "indirizzo", "urgenza", "note"];

/** Minuscolo, senza accenti e senza punteggiatura: il riconoscimento vocale scrive come vuole. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9@+.\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Parola di attivazione ----------

const WAKE = /\b(?:ehi|ehy|hey|ei|ciao|ok|okay)\s+sara\b[\s,.:!-]*/;

/** "Ehi Sara, ricordami..." -> { woke: true, rest: "ricordami..." }. Senza la parola di attivazione -> woke false. */
export function extractWake(transcript: string): { woke: boolean; rest: string } {
  const text = normalize(transcript);
  const match = WAKE.exec(text);
  if (!match) return { woke: false, rest: text };
  return { woke: true, rest: (text.slice(0, match.index) + text.slice(match.index + match[0].length)).trim() };
}

// ---------- Saluto ----------

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  const hello = h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
  return `${hello}, sono Sara, come posso aiutarla?`;
}

// ---------- Comprensione di cio' che si dice ----------

const DIGITS: Record<string, string> = {
  zero: "0", uno: "1", una: "1", due: "2", tre: "3", quattro: "4", cinque: "5", sei: "6", sette: "7", otto: "8", nove: "9",
};

const PHONE_FILLERS = new Set(["e", "il", "numero", "è", "e'", "mio", "mia", "telefono", "cellulare", "prefisso", "allora", "dunque", "ehm", "il", "mio"]);

/** Numero di telefono detto a cifre ("tre tre otto...") o scritto ("338 123 4567"). Null se non sembra un numero. */
export function parsePhone(text: string): string | null {
  const words = normalize(text).replace(/\bpiu\b/g, "+").split(" ");
  let out = "";
  for (const w of words) {
    if (w === "+" ) out += "+";
    else if (DIGITS[w]) out += DIGITS[w];
    else if (/^[0-9+-]+$/.test(w)) out += w.replace(/-/g, "");
    // Una parola che non e' una cifra (es. "trentanove") non si butta via: il numero risulterebbe sbagliato senza che
    // nessuno se ne accorga. Meglio chiedere di ripeterlo.
    else if (!PHONE_FILLERS.has(w)) return null;
  }
  const digits = out.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15) return null;
  return out.startsWith("+") ? `+${digits}` : digits;
}

/** Email detta a voce ("mario chiocciola gmail punto com"). Null se non e' un indirizzo valido. */
export function parseEmail(text: string): string | null {
  const joined = normalize(text)
    .replace(/\b(?:chiocciola|at)\b/g, "@")
    .replace(/\bpunto\b/g, ".")
    .replace(/\btrattino basso\b|\bunderscore\b/g, "_")
    .replace(/\btrattino\b/g, "-")
    .replace(/\s+/g, "");
  return /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(joined) ? joined : null;
}

const SKIP = /\b(?:no|niente|nessuna|nessuno|salta|passo|non ce l'ho|non ho|non lo so|non saprei|non serve)\b/;

export function isSkip(text: string): boolean {
  return SKIP.test(normalize(text));
}

export function parseUrgency(text: string): SaraUrgency {
  const t = normalize(text);
  if (/\bnon (?:e |e' )?urgent|\bnessuna fretta|\bcon calma|\bnormale\b/.test(t)) return "normale";
  if (/urgent|subito|emergenza|allag|\bgas\b|fuoco|incendio|scintille|cortocircuito|senza (?:corrente|acqua|luce|riscaldamento)|pericol/.test(t)) {
    return "urgente";
  }
  if (/appena possibile|il prima possibile|presto|oggi|domani|entro/.test(t)) return "alta";
  return "normale";
}

export function detectMood(text: string): SaraMood {
  const t = normalize(text);
  if (/inaccettabil|arrabbiat|stufo|stufa|vergogna|assurd|incredibil|da giorni|da settimane|ancora non|nessuno (?:mi )?risponde/.test(t)) {
    return "irritato";
  }
  if (/preoccupat|paura|pericol|aiuto|allag|panico|grave|disperat|urgent/.test(t)) return "preoccupato";
  return "sereno";
}

export function detectKind(text: string): SaraKind {
  const t = normalize(text);
  if (/ricordami|promemoria|ricordare/.test(t)) return "promemoria";
  if (parseUrgency(t) === "urgente") return "urgenza";
  if (/preventiv|quanto costa|quanto viene|costo|prezzo|tariffa/.test(t)) return "preventivo";
  if (/appuntament|fissare|prenotar|prenotazione|passare (?:domani|lunedi|martedi|mercoledi|giovedi|venerdi)/.test(t)) return "appuntamento";
  if (/material|ricambi|ordinare|ordine di|scorte/.test(t)) return "materiali";
  if (/intervent|guasto|ripar|rott[oa]|non funzion|perdita|manutenzion|install|sostitu/.test(t)) return "intervento";
  return "altro";
}

// ---------- Domande e risposte ----------

export const KIND_LABELS: Record<SaraKind, string> = {
  intervento: "Intervento",
  urgenza: "Urgenza",
  preventivo: "Preventivo",
  appuntamento: "Appuntamento",
  materiali: "Richiesta materiali",
  promemoria: "Promemoria",
  altro: "Altra richiesta",
};

export const URGENCY_LABELS: Record<SaraUrgency, string> = { normale: "Normale", alta: "Alta", urgente: "Urgente" };
export const MOOD_LABELS: Record<SaraMood, string> = { sereno: "Sereno", preoccupato: "Preoccupato", irritato: "Irritato" };

/** Il prossimo dato da chiedere, o null quando c'e' tutto. L'urgenza si chiede solo se dalle parole non e' emersa. */
export function nextStep(draft: SaraDraft): SaraStep | null {
  for (const step of STEPS) {
    if (step === "motivo" && draft.reason === null) return step;
    if (step === "nome" && draft.name === null) return step;
    if (step === "telefono" && draft.phone === null) return step;
    if (step === "email" && draft.email === null) return step;
    if (step === "indirizzo" && draft.address === null) return step;
    if (step === "urgenza" && draft.urgency === null) return step;
    if (step === "note" && draft.notes === null) return step;
  }
  return null;
}

export function question(step: SaraStep): string {
  switch (step) {
    case "motivo": return "Come posso aiutarla?";
    case "nome": return "Mi dice il suo nome e cognome?";
    case "telefono": return "A quale numero di telefono possiamo richiamarla?";
    case "email": return "Ha un indirizzo email a cui scriverle? Se non ce l'ha, dica pure di no.";
    case "indirizzo": return "Mi dice l'indirizzo dove serve l'intervento?";
    case "urgenza": return "Quanto è urgente? Può dirmi se è urgente, da fare appena possibile, oppure senza fretta.";
    case "note": return "Vuole aggiungere qualche nota? Se non c'è altro, dica pure di no.";
  }
}

export interface AnswerResult {
  draft: SaraDraft;
  /** false = Sara non ha capito e rifa' la domanda con `reply` al posto della domanda normale. */
  ok: boolean;
  reply?: string;
}

/** Registra la risposta data alla domanda `step`. Non lancia mai. */
export function applyAnswer(draft: SaraDraft, step: SaraStep, text: string): AnswerResult {
  const clean = text.trim();
  switch (step) {
    case "motivo": {
      const kind = detectKind(clean);
      const urgency = parseUrgency(clean);
      return {
        ok: true,
        draft: {
          ...draft,
          reason: clean,
          kind,
          mood: detectMood(clean),
          // L'urgenza gia' chiara dalle parole non si richiede; "normale" resta da chiedere (poteva essere solo omessa).
          urgency: urgency === "normale" ? draft.urgency : urgency,
        },
      };
    }
    case "nome": {
      if (clean.split(/\s+/).filter(Boolean).length < 2) {
        return { ok: false, draft, reply: "Mi scusi, mi serve nome e cognome. Può ripeterli?" };
      }
      return { ok: true, draft: { ...draft, name: toTitleCase(clean) } };
    }
    case "telefono": {
      const phone = parsePhone(clean);
      if (!phone) return { ok: false, draft, reply: "Non ho capito bene il numero. Può ripeterlo cifra per cifra?" };
      return { ok: true, draft: { ...draft, phone } };
    }
    case "email": {
      if (isSkip(clean) && !clean.includes("chiocciola")) return { ok: true, draft: { ...draft, email: "" } };
      const email = parseEmail(clean);
      if (!email) return { ok: false, draft, reply: "Non sono riuscita a capire l'email. La ripeta dicendo «chiocciola» e «punto», oppure dica di no." };
      return { ok: true, draft: { ...draft, email } };
    }
    case "indirizzo":
      if (isSkip(clean) && clean.split(/\s+/).length <= 3) return { ok: true, draft: { ...draft, address: "" } };
      return { ok: true, draft: { ...draft, address: clean } };
    case "urgenza":
      return { ok: true, draft: { ...draft, urgency: parseUrgency(clean), mood: draft.mood === "sereno" ? detectMood(clean) : draft.mood } };
    case "note":
      return { ok: true, draft: { ...draft, notes: isSkip(clean) && clean.split(/\s+/).length <= 3 ? "" : clean } };
  }
}

function toTitleCase(text: string): string {
  return text.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// ---------- Prezzi preimpostati e proposta ----------

/** La voce del listino che corrisponde al motivo della chiamata (la prima per cui compare una parola chiave). */
export function findPrice(reason: string, prices: readonly SaraPrice[]): SaraPrice | null {
  const t = normalize(reason);
  for (const price of prices) {
    if (price.keywords.some((k) => k && t.includes(normalize(k)))) return price;
  }
  return null;
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);
}

/** Cio' che Sara dice al cliente a fine raccolta e cio' che scrive per il Titolare. Mai una promessa: decide il Titolare. */
export function buildProposal(draft: SaraDraft, price: SaraPrice | null): string {
  const parts = [
    `${KIND_LABELS[draft.kind]} per ${draft.name || "cliente"}`,
    draft.reason ? `motivo: ${draft.reason}` : null,
    draft.address ? `indirizzo: ${draft.address}` : null,
    `urgenza ${URGENCY_LABELS[draft.urgency ?? "normale"].toLowerCase()}`,
    price ? `prezzo di listino: ${price.label}, ${formatEuro(price.amount)}` : null,
  ];
  return parts.filter(Boolean).join("; ") + ".";
}

export function closingSpeech(draft: SaraDraft, price: SaraPrice | null): string {
  const first = (draft.name ?? "").split(" ")[0];
  const priceText = price
    ? ` Per ${price.label.toLowerCase()} il prezzo indicato dal titolare è ${formatEuro(price.amount)}, che sarà comunque confermato.`
    : "";
  return `Grazie ${first}, ho preso nota di tutto.${priceText} Passo la richiesta al titolare: appena la conferma la richiamiamo al numero che mi ha lasciato.`;
}

// ---------- Promemoria ("Sara, ricordami domani di chiamare il fornitore") ----------

const WEEKDAYS = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];

export interface ParsedReminder {
  what: string;
  at: Date;
}

/**
 * "ricordami domani alle 15 di chiamare il fornitore" -> { what: "chiamare il fornitore", at: domani 15:00 }.
 * Senza giorno: domani; senza ora: le 9. Null se non c'e' "ricordami" o non c'e' cosa ricordare.
 */
export function parseReminder(text: string, now: Date = new Date()): ParsedReminder | null {
  let t = normalize(text);
  const m = /\bricordami\b/.exec(t);
  if (!m) return null;
  t = t.slice(m.index + m[0].length).trim();

  const at = new Date(now);
  at.setHours(9, 0, 0, 0);
  let dayDone = false;

  const consume = (re: RegExp, apply: (match: RegExpExecArray) => void) => {
    const found = re.exec(t);
    if (!found) return;
    apply(found);
    t = (t.slice(0, found.index) + " " + t.slice(found.index + found[0].length)).replace(/\s+/g, " ").trim();
  };

  consume(/\btra (\d{1,2}|un|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci) (giorn[oi]|or[ae]|settiman[ae])\b/, (f) => {
    const words: Record<string, number> = { un: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10 };
    const n = words[f[1]] ?? Number(f[1]);
    if (f[2].startsWith("or")) {
      at.setTime(now.getTime() + n * 3_600_000);
      at.setSeconds(0, 0);
    } else {
      at.setDate(at.getDate() + n * (f[2].startsWith("sett") ? 7 : 1));
    }
    dayDone = true;
  });
  consume(/\bdopodomani\b/, () => { at.setDate(at.getDate() + 2); dayDone = true; });
  consume(/\bdomani\b/, () => { at.setDate(at.getDate() + 1); dayDone = true; });
  consume(/\boggi\b/, () => { dayDone = true; });
  consume(new RegExp(`\\b(${WEEKDAYS.join("|")})\\b`), (f) => {
    const target = WEEKDAYS.indexOf(f[1]);
    let diff = (target - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    at.setDate(at.getDate() + diff);
    dayDone = true;
  });
  consume(/\balle (\d{1,2})(?: e (\d{1,2}|mezza|un quarto))?\b/, (f) => {
    const h = Number(f[1]);
    if (h > 23) return;
    const min = f[2] === "mezza" ? 30 : f[2] === "un quarto" ? 15 : f[2] ? Number(f[2]) : 0;
    at.setHours(h, min, 0, 0);
  });

  if (!dayDone) at.setDate(at.getDate() + 1);
  const what = t.replace(/^(?:di|che|per)\s+/, "").trim();
  if (!what) return null;
  return { what, at };
}

export function describeWhen(at: Date, now: Date = new Date()): string {
  const day = new Date(at).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0);
  const days = Math.round(day / 86_400_000);
  const hh = `${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}`;
  const when = days === 0 ? "oggi" : days === 1 ? "domani" : days === 2 ? "dopodomani" : at.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  return `${when} alle ${hh}`;
}
