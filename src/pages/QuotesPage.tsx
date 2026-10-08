import { useEffect, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Printer, Trash2, X } from "lucide-react";
import { useClients, useCreateQuote, useDeleteQuote, useQuotes, useSetQuoteStatus } from "@/hooks/useData";
import { NEXT_STATUSES, STATUS_LABELS, formatCents, lineNet, parseDecimal, quoteTotals } from "@/lib/quotes";
import type { Quote, QuoteStatus } from "@/types";

const TONE: Record<QuoteStatus, string> = {
  bozza: "bg-steel-soft text-steel border-steel-line",
  inviato: "bg-blue-50 text-brand border-brand",
  accettato: "bg-emerald-700 text-white border-emerald-700",
  rifiutato: "bg-red-50 text-red-700 border-red-300",
};
const dateIt = (iso: string) => format(new Date(iso), "dd MMM yyyy", { locale: it });

interface FormLine { description: string; quantity: string; price: string; vat: string }
const emptyLine = (): FormLine => ({ description: "", quantity: "1", price: "", vat: "22" });

export default function QuotesPage() {
  const { data: quotes, isLoading } = useQuotes();
  const { data: clients } = useClients();
  const create = useCreateQuote();
  const setStatus = useSetQuoteStatus();
  const remove = useDeleteQuote();
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState<Quote | null>(null);
  const [form, setForm] = useState({ clientId: "", title: "", notes: "", validUntil: "" });
  const [lines, setLines] = useState<FormLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);

  // Stampa: si mostra solo il foglio del preventivo (vedi index.css) e si apre la finestra di stampa del browser,
  // da cui si sceglie "Salva come PDF".
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done);
    const t = window.setTimeout(() => window.print(), 100);
    return () => { window.removeEventListener("afterprint", done); window.clearTimeout(t); };
  }, [printing]);

  const parsed = lines.map((l) => ({ description: l.description.trim(), quantity: parseDecimal(l.quantity), unit_price: parseDecimal(l.price), vat_rate: parseDecimal(l.vat) }));
  const filled = parsed.filter((l) => l.description || !Number.isNaN(l.unit_price));
  const totals = quoteTotals(filled.filter((l) => l.quantity > 0 && !Number.isNaN(l.unit_price) && !Number.isNaN(l.vat_rate)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.clientId) return setError("Scegli il cliente.");
    if (filled.length === 0) return setError("Aggiungi almeno una voce.");
    const bad = filled.findIndex((l) => !l.description || !(l.quantity > 0) || Number.isNaN(l.unit_price) || Number.isNaN(l.vat_rate));
    if (bad >= 0) return setError(`Controlla la voce ${bad + 1}: servono descrizione, quantità maggiore di zero, prezzo e IVA validi.`);
    create.mutate({ ...form, items: filled }, {
      onSuccess: () => { setOpen(false); setForm({ clientId: "", title: "", notes: "", validUntil: "" }); setLines([emptyLine()]); },
    });
  };
  const setLine = (i: number, patch: Partial<FormLine>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  return (
    <>
      <div className="no-print space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Preventivi</h1>
          <button className="btn" onClick={() => setOpen(!open)}>{open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? "Chiudi" : "Nuovo preventivo"}</button>
        </div>

        {open && (
          <form onSubmit={submit} className="box space-y-3 p-4">
            <div className="grid gap-2 md:grid-cols-[2fr_3fr_1fr]">
              <select className="field" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} aria-label="Cliente">
                <option value="">Scegli il cliente</option>
                {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input className="field" placeholder="Oggetto (es. Sostituzione caldaia)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              <input className="field" type="date" title="Valido fino al" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
            </div>
            <div className="space-y-2">
              <div className="hidden gap-2 text-xs text-steel md:grid md:grid-cols-[4fr_1fr_1.5fr_1fr_2fr_auto]"><span>Descrizione</span><span>Quantità</span><span>Prezzo €</span><span>IVA %</span><span className="text-right">Importo</span><span /></div>
              {lines.map((l, i) => {
                const n = parseDecimal(l.quantity) > 0 && !Number.isNaN(parseDecimal(l.price)) ? lineNet({ quantity: parseDecimal(l.quantity), unit_price: parseDecimal(l.price), vat_rate: 0 }) : 0;
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
            </div>
            <textarea className="field h-20 py-2" placeholder="Note per il cliente (facoltative)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm"><span className="text-steel">Imponibile {formatCents(totals.net)} · IVA {formatCents(totals.vat)} · </span><b>Totale {formatCents(totals.gross)}</b></div>
              <button className="btn" disabled={create.isPending}>Salva come bozza</button>
            </div>
            {error && <p className="border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          </form>
        )}

        {isLoading ? <p className="text-sm text-steel">Caricamento...</p> : (quotes ?? []).length === 0 ? (
          <p className="text-sm text-steel">Nessun preventivo. Quando confermi una richiesta di preventivo di Sara, qui trovi la bozza già pronta.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(quotes ?? []).map((q) => {
              const t = quoteTotals(q.items ?? []);
              return (
                <div key={q.id} className="box space-y-2 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-steel">{q.number} · {dateIt(q.created_at)}</span>
                    <span className={`inline-flex border px-2 py-0.5 text-xs font-medium ${TONE[q.status]}`}>{STATUS_LABELS[q.status]}</span>
                  </div>
                  <p className="font-semibold">{q.title}</p>
                  <p className="text-xs text-steel">{q.client?.name}{q.valid_until ? ` · valido fino al ${format(new Date(q.valid_until), "dd/MM/yyyy")}` : ""}</p>
                  <ul className="space-y-0.5 text-xs">
                    {(q.items ?? []).map((it2) => <li key={it2.id} className="flex justify-between gap-2"><span className="truncate">{it2.quantity} × {it2.description}</span><span>{formatCents(lineNet(it2))}</span></li>)}
                    {(q.items ?? []).length === 0 && <li className="text-steel">Nessuna voce: aggiungila prima di inviarlo.</li>}
                  </ul>
                  <p className="border-t border-steel-line pt-1 text-right font-semibold">Totale {formatCents(t.gross)} <span className="text-xs font-normal text-steel">(IVA inclusa)</span></p>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-outline h-8" onClick={() => setPrinting(q)}><Printer className="h-4 w-4" />Stampa / PDF</button>
                    {NEXT_STATUSES[q.status].map((n) => (
                      <button key={n.to} className="btn btn-outline h-8" disabled={setStatus.isPending || (n.to === "inviato" && (q.items ?? []).length === 0)} onClick={() => setStatus.mutate({ id: q.id, status: n.to })}>{n.label}</button>
                    ))}
                    {q.status === "bozza" && <button className="btn btn-outline h-8" aria-label="Elimina la bozza" disabled={remove.isPending} onClick={() => { if (window.confirm("Eliminare questa bozza?")) remove.mutate(q.id); }}><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {printing && <PrintSheet quote={printing} />}
    </>
  );
}

/** Il foglio che si stampa: solo questo resta visibile in stampa. */
function PrintSheet({ quote }: { quote: Quote }) {
  const items = quote.items ?? [];
  const t = quoteTotals(items);
  return (
    <div id="print-area" className="hidden bg-white p-8 text-sm text-black">
      <div className="flex items-start justify-between border-b-2 border-brand pb-3">
        <div><p className="text-2xl font-bold text-brand">Preventivo</p><p>{quote.number}</p></div>
        <div className="text-right"><p>Data: {dateIt(quote.created_at)}</p>{quote.valid_until && <p>Valido fino al {format(new Date(quote.valid_until), "dd/MM/yyyy")}</p>}</div>
      </div>
      <div className="my-4"><p className="text-xs uppercase text-steel">Cliente</p><p className="font-semibold">{quote.client?.name}</p><p>{[quote.client?.address, quote.client?.phone, quote.client?.email].filter(Boolean).join(" · ")}</p></div>
      <p className="mb-2 font-semibold">{quote.title}</p>
      <table className="w-full border-collapse">
        <thead><tr className="border-b border-black text-left"><th className="py-1">Descrizione</th><th className="text-right">Q.tà</th><th className="text-right">Prezzo</th><th className="text-right">IVA</th><th className="text-right">Importo</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-steel-line"><td className="py-1">{i.description}</td><td className="text-right">{i.quantity}</td><td className="text-right">{formatCents(Math.round(i.unit_price * 100))}</td><td className="text-right">{i.vat_rate}%</td><td className="text-right">{formatCents(lineNet(i))}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 ml-auto w-64 space-y-1">
        <p className="flex justify-between"><span>Imponibile</span><span>{formatCents(t.net)}</span></p>
        <p className="flex justify-between"><span>IVA</span><span>{formatCents(t.vat)}</span></p>
        <p className="flex justify-between border-t border-black pt-1 text-base font-bold"><span>Totale</span><span>{formatCents(t.gross)}</span></p>
      </div>
      {quote.notes && <p className="mt-6 whitespace-pre-line text-xs">{quote.notes}</p>}
    </div>
  );
}
