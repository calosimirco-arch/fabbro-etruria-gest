import { useEffect, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { FileText, Plus, Printer, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DocumentSheet } from "@/components/DocumentSheet";
import { LinesEditor, emptyLine, parseLines, type FormLine } from "@/components/LinesEditor";
import { useClients, useCreateInvoiceFromQuote, useMaterials, useCreateQuote, useDeleteQuote, useQuotes, useSetQuoteStatus } from "@/hooks/useData";
import { NEXT_STATUSES, STATUS_LABELS, formatCents, lineNet, quoteTotals } from "@/lib/quotes";
import type { Quote, QuoteStatus } from "@/types";

const TONE: Record<QuoteStatus, string> = {
  bozza: "bg-steel-soft text-steel border-steel-line",
  inviato: "bg-blue-50 text-brand border-brand",
  accettato: "bg-emerald-700 text-white border-emerald-700",
  rifiutato: "bg-red-50 text-red-700 border-red-300",
};
const dateIt = (iso: string) => format(new Date(iso), "dd MMM yyyy", { locale: it });

export default function QuotesPage() {
  const navigate = useNavigate();
  const { data: quotes, isLoading } = useQuotes();
  const { data: clients } = useClients();
  const { data: materials } = useMaterials();
  const create = useCreateQuote();
  const setStatus = useSetQuoteStatus();
  const remove = useDeleteQuote();
  const toInvoice = useCreateInvoiceFromQuote();
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState<Quote | null>(null);
  const [form, setForm] = useState({ clientId: "", title: "", notes: "", validUntil: "" });
  const [lines, setLines] = useState<FormLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const parsed = parseLines(lines);

  // Stampa: si mostra solo il foglio del preventivo e si apre la finestra di stampa del browser ("Salva come PDF").
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done);
    const t = window.setTimeout(() => window.print(), 100);
    return () => { window.removeEventListener("afterprint", done); window.clearTimeout(t); };
  }, [printing]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.clientId) return setError("Scegli il cliente.");
    if (parsed.error) return setError(parsed.error);
    create.mutate({ ...form, items: parsed.items }, {
      onSuccess: () => { setOpen(false); setForm({ clientId: "", title: "", notes: "", validUntil: "" }); setLines([emptyLine()]); },
    });
  };

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
            <LinesEditor lines={lines} setLines={setLines} totals={parsed.totals} materials={materials} />
            <textarea className="field h-20 py-2" placeholder="Note per il cliente (facoltative)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex justify-end"><button className="btn" disabled={create.isPending}>Salva come bozza</button></div>
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
                    {q.status === "accettato" && (
                      <button className="btn h-8" disabled={toInvoice.isPending} onClick={() => toInvoice.mutate(q.id, { onSuccess: () => navigate("/fatture") })}><FileText className="h-4 w-4" />Crea fattura</button>
                    )}
                    {q.status === "bozza" && <button className="btn btn-outline h-8" aria-label="Elimina la bozza" disabled={remove.isPending} onClick={() => { if (window.confirm("Eliminare questa bozza?")) remove.mutate(q.id); }}><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {printing && (
        <DocumentSheet doc={{ kind: "Preventivo", number: printing.number, date: printing.created_at, extraDate: printing.valid_until ? { label: "Valido fino al", value: format(new Date(printing.valid_until), "dd/MM/yyyy") } : null,
          client: printing.client, title: printing.title, items: printing.items ?? [], notes: printing.notes }} />
      )}
    </>
  );
}
