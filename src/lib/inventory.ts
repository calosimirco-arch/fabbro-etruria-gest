import type { Material, MovementKind, StockLevel } from "@/types";

// Logica delle scorte senza React (si prova da sola, inventory.test.ts). La giacenza vera la calcola il database
// come somma dei movimenti: qui si sommano le righe gia' calcolate per mostrarle e avvisare delle scorte basse.

export function stockOf(levels: readonly StockLevel[], materialId: string, warehouseId?: string): number {
  let total = 0;
  for (const l of levels) {
    if (l.material_id === materialId && (!warehouseId || l.warehouse_id === warehouseId)) total += Number(l.quantity);
  }
  return Math.round(total * 100) / 100;
}

export type StockState = "esaurito" | "basso" | "ok";

/** Esaurito = zero (o meno); basso = sotto la scorta minima impostata (solo se minima > 0). */
export function stockState(material: Pick<Material, "min_stock">, total: number): StockState {
  if (total <= 0) return material.min_stock > 0 ? "esaurito" : "ok";
  return material.min_stock > 0 && total < material.min_stock ? "basso" : "ok";
}

export interface LowStockItem { material: Material; total: number; state: Exclude<StockState, "ok"> }

/** I materiali attivi da riordinare, dal piu' urgente (esauriti) in poi. */
export function lowStock(materials: readonly Material[], levels: readonly StockLevel[]): LowStockItem[] {
  const items: LowStockItem[] = [];
  for (const material of materials) {
    if (!material.active) continue;
    const total = stockOf(levels, material.id);
    const state = stockState(material, total);
    if (state !== "ok") items.push({ material, total, state });
  }
  return items.sort((a, b) => (a.state === b.state ? a.total - b.total : a.state === "esaurito" ? -1 : 1));
}

export const KIND_LABELS: Record<MovementKind, string> = { carico: "Carico", scarico: "Scarico", rettifica: "Rettifica" };

export function formatQty(value: number, unit = ""): string {
  const text = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(value);
  return unit ? `${text} ${unit}` : text;
}

/** Quantita' scritta da una persona: "5", "2,5", "-3" (solo per le rettifiche). NaN se non e' un numero. */
export function parseQty(text: string, allowNegative = false): number {
  const t = text.trim().replace(",", ".");
  const pattern = allowNegative ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/;
  if (!pattern.test(t)) return NaN;
  const n = Number(t);
  return n === 0 ? NaN : n;
}
