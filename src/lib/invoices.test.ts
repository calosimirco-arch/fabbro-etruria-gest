import { describe, expect, it } from "vitest";
import { daysOverdue, effectiveStatus, summarizeInvoices } from "./invoices";
import type { Invoice } from "@/types";

const today = new Date(2026, 9, 8, 15, 30); // 8 ottobre 2026
const inv = (over: Partial<Invoice>, gross = 100): Invoice => ({
  id: "x", number: "FAT", client_id: "c", quote_id: null, title: "t", notes: null, issue_date: "2026-09-01", due_date: "2026-10-31",
  status: "in_attesa", paid_at: null, payment_method: null, cancelled_at: null, cancel_reason: null, created_at: "2026-09-01T10:00:00Z",
  items: [{ id: "i", invoice_id: "x", position: 0, description: "d", quantity: 1, unit_price: gross / 1.22, vat_rate: 22 }], ...over,
});

describe("stato delle fatture", () => {
  it("in attesa fino al giorno di scadenza compreso, scaduta dal giorno dopo", () => {
    expect(effectiveStatus(inv({ due_date: "2026-10-08" }), today)).toBe("in_attesa");
    expect(effectiveStatus(inv({ due_date: "2026-10-07" }), today)).toBe("scaduta");
    expect(effectiveStatus(inv({ due_date: "2026-12-01" }), today)).toBe("in_attesa");
  });
  it("pagata e annullata non diventano mai scadute", () => {
    expect(effectiveStatus(inv({ status: "pagata", due_date: "2020-01-01" }), today)).toBe("pagata");
    expect(effectiveStatus(inv({ status: "annullata", due_date: "2020-01-01" }), today)).toBe("annullata");
  });
  it("giorni di ritardo", () => {
    expect(daysOverdue({ due_date: "2026-10-01" }, today)).toBe(7);
    expect(daysOverdue({ due_date: "2026-10-20" }, today)).toBe(0);
  });
});

describe("riepilogo incassi", () => {
  it("separa da incassare, scadute e incassato del mese; ignora le annullate", () => {
    const s = summarizeInvoices([
      inv({ due_date: "2026-10-31" }, 122),
      inv({ due_date: "2026-09-15" }, 61),
      inv({ status: "pagata", paid_at: "2026-10-02T09:00:00" }, 244),
      inv({ status: "pagata", paid_at: "2026-09-02T09:00:00" }, 500),
      inv({ status: "annullata", cancelled_at: "2026-10-01T00:00:00" }, 999),
    ], today);
    expect(s).toEqual({ toCollect: 12200, overdue: 6100, collectedThisMonth: 24400, overdueCount: 1 });
  });
});
