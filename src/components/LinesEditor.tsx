import { Plus, Trash2 } from "lucide-react";
import { formatCents, lineNet, parseDecimal, quoteTotals, type Totals } from "@/lib/quotes";

// Voci di un preventivo o di una fattura: stesse regole, un solo componente.
export interface FormLine { description: string; quantity: string; price: string; vat: string }
export const emptyLine = (): FormLine => ({ description: "", quantity: "1", price: "", vat: "22" });

export interface ParsedItem { description: string; quantity: number; unit_price: number; vat_rate: number }

/** Legge le righe scritte a mano: ignora quelle vuote e dice cosa non va, con il numero della voce. */
export function parseLines(lines: readonly FormLine[]): { items: ParsedItem[]; error: string | null; totals: Totals } {
  const parsed = lines.map((l) => ({ description: l.description.trim(), quantity: parseDecimal(l.quantity), unit_price: parseDecimal(l.price), vat_rate: parseDecimal(l.vat) }));
  const filled = parsed.filter((l) => l.description || !Number.isNaN(l.unit_price));
  const valid = (l: ParsedItem) => l.description && l.quantity > 0 && !Number.isNaN(l.unit_price) && !Number.isNaN(l.vat_rate) && l.vat_rate <= 100;
  const bad = filled.findIndex((l) => !valid(l));
  const error = filled.length === 0 ? "Aggiungi almeno una voce."
    : bad >= 0 ? `Controlla la voce ${bad + 1}: servono descrizione, quantità maggiore di zero, prezzo e IVA validi.` : null;
  return { items: filled, error, totals: quoteTotals(filled.filter(valid)) };
}

export function LinesEditor({ lines, setLines, totals }: { lines: FormLine[]; setLines: (l: FormLine[]) => void; totals: Totals }) {
  const setLine = (i: number, patch: Partial<FormLine>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      <div className="hidden gap-2 text-xs text-steel md:grid md:grid-cols-[4fr_1fr_1.5fr_1fr_2fr_auto]"><span>Descrizione</span><span>Quantità</span><span>Prezzo €</span><span>IVA %</span><span className="text-right">Importo</span><span /></div>
      {lines.map((l, i) => {
        const q = parseDecimal(l.quantity), p = parseDecimal(l.price);
        const n = q > 0 && !Number.isNaN(p) ? lineNet({ quantity: q, unit_price: p, vat_rate: 0 }) : 0;
        return (
          <div key={i} className="grid gap-2 md:grid-cols-[4fr_1fr_1.5fr_1fr_2fr_auto] md:items-center">
            <input className="field" placeholder="Descrizione" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
            <input className="field" inputMode="decimal" aria-label="Quantità" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
            <input className="field" inputMode="decimal" placeholder="0,00" aria-label="Prezzo" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} />
            <input className="field" inputMode="decimal" aria-label="IVA" value={l.vat} onChange={(e) => setLine(i, { vat: e.target.value })} />
            <span className="text-right text-sm font-medium">{formatCents(n)}</span>
            <button type="button" className="btn btn-outline h-10 w-10 px-0" aria-label="Togli la voce" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></button>
          </div>
        );
      })}
      <button type="button" className="btn btn-outline h-8" onClick={() => setLines([...lines, emptyLine()])}><Plus className="h-4 w-4" />Aggiungi voce</button>
      <p className="text-sm"><span className="text-steel">Imponibile {formatCents(totals.net)} · IVA {formatCents(totals.vat)} · </span><b>Totale {formatCents(totals.gross)}</b></p>
    </div>
  );
}
