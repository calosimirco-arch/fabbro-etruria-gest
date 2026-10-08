import { format } from "date-fns";
import { it } from "date-fns/locale";
import { formatCents, lineNet, quoteTotals } from "@/lib/quotes";

export interface SheetItem { id: string; description: string; quantity: number; unit_price: number; vat_rate: number }
export interface SheetData {
  kind: "Preventivo" | "Fattura"; number: string; date: string; extraDate?: { label: string; value: string } | null;
  client?: { name: string; phone: string | null; email: string | null; address: string | null } | null;
  title: string; items: SheetItem[]; notes: string | null; footer?: string | null;
}

/** Il foglio che si stampa (preventivo o fattura): in stampa resta visibile solo questo (vedi index.css). */
export function DocumentSheet({ doc }: { doc: SheetData }) {
  const t = quoteTotals(doc.items);
  return (
    <div id="print-area" className="hidden bg-white p-8 text-sm text-black">
      <div className="flex items-start justify-between border-b-2 border-brand pb-3">
        <div><p className="text-2xl font-bold text-brand">{doc.kind}</p><p>{doc.number}</p></div>
        <div className="text-right"><p>Data: {format(new Date(doc.date), "dd MMM yyyy", { locale: it })}</p>{doc.extraDate && <p>{doc.extraDate.label} {doc.extraDate.value}</p>}</div>
      </div>
      <div className="my-4"><p className="text-xs uppercase text-steel">Cliente</p><p className="font-semibold">{doc.client?.name}</p><p>{[doc.client?.address, doc.client?.phone, doc.client?.email].filter(Boolean).join(" · ")}</p></div>
      <p className="mb-2 font-semibold">{doc.title}</p>
      <table className="w-full border-collapse">
        <thead><tr className="border-b border-black text-left"><th className="py-1">Descrizione</th><th className="text-right">Q.tà</th><th className="text-right">Prezzo</th><th className="text-right">IVA</th><th className="text-right">Importo</th></tr></thead>
        <tbody>
          {doc.items.map((i) => (
            <tr key={i.id} className="border-b border-steel-line"><td className="py-1">{i.description}</td><td className="text-right">{i.quantity}</td><td className="text-right">{formatCents(Math.round(i.unit_price * 100))}</td><td className="text-right">{i.vat_rate}%</td><td className="text-right">{formatCents(lineNet(i))}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 ml-auto w-64 space-y-1">
        <p className="flex justify-between"><span>Imponibile</span><span>{formatCents(t.net)}</span></p>
        <p className="flex justify-between"><span>IVA</span><span>{formatCents(t.vat)}</span></p>
        <p className="flex justify-between border-t border-black pt-1 text-base font-bold"><span>Totale</span><span>{formatCents(t.gross)}</span></p>
      </div>
      {doc.notes && <p className="mt-6 whitespace-pre-line text-xs">{doc.notes}</p>}
      {doc.footer && <p className="mt-6 border-t border-steel-line pt-2 text-xs text-steel">{doc.footer}</p>}
    </div>
  );
}
