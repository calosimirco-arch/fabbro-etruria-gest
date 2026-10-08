import type { QuoteStatus } from "@/types";

// Calcoli del preventivo, in CENTESIMI interi (mai decimali: 0,1 + 0,2 non fa 0,3). Si prova da soli (quotes.test.ts).

export interface Line { quantity: number; unit_price: number; vat_rate: number }

const cents = (euro: number) => Math.round(euro * 100);

/** Imponibile di una riga, in centesimi. */
export function lineNet(line: Line): number {
  return Math.round(line.quantity * cents(line.unit_price));
}

export interface Totals { net: number; vat: number; gross: number }

/** Imponibile, IVA e totale in centesimi. L'IVA si calcola per aliquota (non riga per riga) e si arrotonda una volta. */
export function quoteTotals(lines: readonly Line[]): Totals {
  const byRate = new Map<number, number>();
  let net = 0;
  for (const line of lines) {
    const n = lineNet(line);
    net += n;
    byRate.set(line.vat_rate, (byRate.get(line.vat_rate) ?? 0) + n);
  }
  let vat = 0;
  for (const [rate, base] of byRate) vat += Math.round((base * rate) / 100);
  return { net, vat, gross: net + vat };
}

export const formatCents = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value / 100);

/** Legge un numero scritto da una persona: "1.234,50", "12,5", "12.5". NaN se non e' un numero. */
export function parseDecimal(text: string): number {
  const t = text.trim().replace(/[€\s]/g, "");
  if (!t) return NaN;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

export const STATUS_LABELS: Record<QuoteStatus, string> = { bozza: "Bozza", inviato: "Inviato", accettato: "Accettato", rifiutato: "Rifiutato" };

/** Le mosse possibili da uno stato (le stesse regole del database). */
export const NEXT_STATUSES: Record<QuoteStatus, Array<{ to: QuoteStatus; label: string }>> = {
  bozza: [{ to: "inviato", label: "Segna come inviato" }],
  inviato: [{ to: "accettato", label: "Accettato" }, { to: "rifiutato", label: "Rifiutato" }],
  accettato: [],
  rifiutato: [],
};
