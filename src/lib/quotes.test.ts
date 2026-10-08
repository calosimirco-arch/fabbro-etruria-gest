import { describe, expect, it } from "vitest";
import { formatCents, lineNet, parseDecimal, quoteTotals } from "./quotes";

describe("totali del preventivo", () => {
  it("calcola imponibile, IVA e totale in centesimi", () => {
    const t = quoteTotals([{ quantity: 2, unit_price: 35, vat_rate: 22 }, { quantity: 1, unit_price: 60, vat_rate: 22 }]);
    expect(t).toEqual({ net: 13000, vat: 2860, gross: 15860 });
  });
  it("non sbaglia con i decimali", () => {
    expect(lineNet({ quantity: 3, unit_price: 0.1, vat_rate: 22 })).toBe(30);
    expect(quoteTotals([{ quantity: 1, unit_price: 0.1, vat_rate: 0 }, { quantity: 1, unit_price: 0.2, vat_rate: 0 }]).gross).toBe(30);
  });
  it("gestisce aliquote diverse e quantita' con decimali", () => {
    const t = quoteTotals([{ quantity: 1.5, unit_price: 100, vat_rate: 22 }, { quantity: 1, unit_price: 50, vat_rate: 10 }]);
    expect(t).toEqual({ net: 20000, vat: 3300 + 500, gross: 24400 - 600 });
  });
  it("vuoto = zero", () => expect(quoteTotals([])).toEqual({ net: 0, vat: 0, gross: 0 }));
  it("formatta in euro all'italiana", () => {
    expect(formatCents(123456)).toContain("1234,56");
    expect(formatCents(12345678)).toContain("123.456,78");
  });
});

describe("lettura degli importi", () => {
  it("capisce i formati italiani e semplici", () => {
    expect(parseDecimal("1.234,50")).toBe(1234.5);
    expect(parseDecimal("12,5")).toBe(12.5);
    expect(parseDecimal("12.5")).toBe(12.5);
    expect(parseDecimal("€ 60")).toBe(60);
  });
  it("rifiuta il resto", () => {
    expect(parseDecimal("")).toBeNaN();
    expect(parseDecimal("abc")).toBeNaN();
    expect(parseDecimal("-5")).toBeNaN();
  });
});
