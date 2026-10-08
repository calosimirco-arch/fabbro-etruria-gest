import { quoteTotals } from "@/lib/quotes";
import type { Invoice, PaymentMethod } from "@/types";

// Stato "vero" di una fattura e riepilogo degli incassi. "Scaduta" non e' salvata nel database: si calcola dalla data.
export type EffectiveStatus = "pagata" | "in_attesa" | "scaduta" | "annullata";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** `due_date` e' una data (YYYY-MM-DD): e' scaduta dal giorno DOPO la scadenza. */
export function effectiveStatus(invoice: Pick<Invoice, "status" | "due_date">, today: Date = new Date()): EffectiveStatus {
  if (invoice.status !== "in_attesa") return invoice.status;
  const [y, m, d] = invoice.due_date.split("-").map(Number);
  return startOfDay(today) > new Date(y, m - 1, d).getTime() ? "scaduta" : "in_attesa";
}

export interface Summary { toCollect: number; overdue: number; collectedThisMonth: number; overdueCount: number }

/** Importi in centesimi: da incassare (non scadute), scadute, incassato nel mese corrente. Le annullate non contano. */
export function summarizeInvoices(invoices: readonly Invoice[], today: Date = new Date()): Summary {
  const s: Summary = { toCollect: 0, overdue: 0, collectedThisMonth: 0, overdueCount: 0 };
  for (const inv of invoices) {
    const gross = quoteTotals(inv.items ?? []).gross;
    const st = effectiveStatus(inv, today);
    if (st === "in_attesa") s.toCollect += gross;
    else if (st === "scaduta") { s.overdue += gross; s.overdueCount += 1; }
    else if (st === "pagata" && inv.paid_at) {
      const p = new Date(inv.paid_at);
      if (p.getFullYear() === today.getFullYear() && p.getMonth() === today.getMonth()) s.collectedThisMonth += gross;
    }
  }
  return s;
}

export const INVOICE_LABELS: Record<EffectiveStatus, string> = { pagata: "Pagata", in_attesa: "In attesa", scaduta: "Scaduta", annullata: "Annullata" };
export const METHOD_LABELS: Record<PaymentMethod, string> = { bonifico: "Bonifico", contanti: "Contanti", carta: "Carta", assegno: "Assegno", altro: "Altro" };

export function daysOverdue(invoice: Pick<Invoice, "due_date">, today: Date = new Date()): number {
  const [y, m, d] = invoice.due_date.split("-").map(Number);
  return Math.max(0, Math.round((startOfDay(today) - new Date(y, m - 1, d).getTime()) / 86_400_000));
}
