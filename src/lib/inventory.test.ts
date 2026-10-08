import { describe, expect, it } from "vitest";
import { formatQty, lowStock, parseQty, stockOf, stockState } from "./inventory";
import type { Material, StockLevel } from "@/types";

const mat = (id: string, min: number, active = true): Material => ({ id, code: id.toUpperCase(), name: id, unit: "pz", price: 1, min_stock: min, active });
const lv = (material_id: string, warehouse_id: string, quantity: number): StockLevel => ({ material_id, warehouse_id, quantity });

describe("giacenza", () => {
  const levels = [lv("a", "w1", 3), lv("a", "w2", 2.5), lv("b", "w1", 7)];
  it("somma i magazzini o ne guarda uno", () => {
    expect(stockOf(levels, "a")).toBe(5.5);
    expect(stockOf(levels, "a", "w2")).toBe(2.5);
    expect(stockOf(levels, "zzz")).toBe(0);
  });
  it("non sbaglia con i decimali", () => expect(stockOf([lv("a", "w", 0.1), lv("a", "x", 0.2)], "a")).toBe(0.3));
});

describe("scorte basse", () => {
  it("stato: ok, basso, esaurito", () => {
    expect(stockState({ min_stock: 5 }, 10)).toBe("ok");
    expect(stockState({ min_stock: 5 }, 4.99)).toBe("basso");
    expect(stockState({ min_stock: 5 }, 5)).toBe("ok");
    expect(stockState({ min_stock: 5 }, 0)).toBe("esaurito");
    expect(stockState({ min_stock: 0 }, 0)).toBe("ok"); // senza scorta minima impostata non c'e' allarme
  });
  it("elenco ordinato: prima gli esauriti; ignora archiviati e senza minima", () => {
    const items = lowStock(
      [mat("a", 5), mat("b", 5), mat("c", 5), mat("d", 0), mat("e", 5, false)],
      [lv("a", "w", 2), lv("b", "w", 0), lv("c", "w", 9)],
    );
    expect(items.map((i) => [i.material.id, i.state])).toEqual([["b", "esaurito"], ["a", "basso"]]);
  });
});

describe("quantita' scritte a mano", () => {
  it("legge i formati italiani", () => { expect(parseQty("5")).toBe(5); expect(parseQty("2,5")).toBe(2.5); });
  it("rifiuta zero, negativi (tranne rettifiche) e testo", () => {
    expect(parseQty("0")).toBeNaN(); expect(parseQty("-3")).toBeNaN(); expect(parseQty("abc")).toBeNaN();
    expect(parseQty("-3", true)).toBe(-3);
  });
  it("formatta", () => { expect(formatQty(2.5, "m")).toBe("2,5 m"); expect(formatQty(1200)).toBe("1200"); });
});
