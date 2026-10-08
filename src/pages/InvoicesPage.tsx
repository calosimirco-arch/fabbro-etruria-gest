import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Check, Plus, Printer, X } from "lucide-react";
import { DocumentSheet } from "@/components/DocumentSheet";
import { LinesEditor, emptyLine, parseLines, type FormLine } from "@/components/LinesEditor";
import { useCancelInvoice, useClients, useMaterials, useCreateInvoice, useInvoices, useMarkInvoicePaid } from "@/hooks/useData";
import { INVOICE_LABELS, METHOD_LABELS, daysOverdue, effectiveStatus, summarizeInvoices, type EffectiveStatus } from "@/lib/invoices";
import { formatCents, lineNet, quoteTotals } from "@/lib/quotes";
import type { Invoice, PaymentMethod } from "@/types";

const TONE: Record<EffectiveStatus, string> = {
  pagata: "bg-emerald-700 text-white border-emerald-700",
  in_attesa: "bg-blue-50 text-brand border-brand",
  scaduta: "bg-red-700 text-white border-red-700",
  annullata: "bg-steel-soft text-steel border-steel-line",
};
const FILTERS: Array<{ value: EffectiveStatus | "tutte"; label: string }> = [
  { value: "tutte", label: "Tutte" }, { value: "in_attesa", label: "In attesa" }, { value: "scaduta", label: "Scadute" }, { value: "pagata", label: "Pagate" }, { value: "annullata", label: "Annullate" },
];
const dateOnly = (d: string) => format(new Date(`${d}T00:00:00`), "dd/MM/yyyy");

export default function InvoicesPage() {
  const { data: invoices, isLoading } = useInvoices();
  const { data: clients } = useClients();
  const { data: materials } = useMaterials();
  const create = useCreateInvoice();
  const pay = useMarkInvoicePaid();
  const cancel = useCancelInvoice();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<EffectiveStatus | "tutte">("tutte");
  const [printing, setPrinting] = useState<Invoice | null>(null);
  const [method, setMethod] = useState<Record<string, PaymentMethod>>({});
  const [form, setForm] = useState({ clientId: "", title: "", notes: "", dueDate: "" });
  const [lines, setLines] = useState<FormLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const parsed = parseLines(lines);

  const all = useMemo(() => invoices ?? [], [invoices]);
  const summary = useMemo(() => summarizeInvoices(all), [all]);
  const shown = all.filter((i) => filter === "tutte" || effectiveStatus(i) === filter);

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
      onSuccess: () => { setOpen(false); setForm({ clientId: "", title: "", notes: "", dueDate: "" }); setLines([emptyLine()]); },
    });
  };

  return (
    <>
      <div className="no-print space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Fatture</h1>
          <button className="btn" onClick={() => setOpen(!open)}>{open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? "Chiudi" : "Nuova fattura"}</button>
        </div>
        <p className="text-xs text-steel">Documenti interni per tenere i conti: non sono fatture elettroniche da inviare all'Agenzia delle Entrate.</p>

        <div className="grid grid-cols-3 gap-3">
          <div className="box p-3"><p className="text-xl font-bold">{formatCents(summary.toCollect)}</p><p className="text-xs text-steel">Da incassare</p></div>
          <div className={`box p-3 ${summary.overdueCount ? "border-red-600" : ""}`}><p className="text-xl font-bold">{formatCents(summary.overdue)}</p><p className="text-xs text-steel">Scadute{summary.overdueCount ? ` (${summary.overdueCount})` : ""}</p></div>
          <div className="box p-3"><p className="text-xl font-bold">{formatCents(summary.collectedThisMonth)}</p><p className="text-xs text-steel">Incassato questo mese</p></div>
        </div>

        {open && (
          <form onSubmit={submit} className="box space-y-3 p-4">
            <div className="grid gap-2 md:grid-cols-[2fr_3fr_1fr]">
              <select className="field" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} aria-label="Cliente">
                <option value="">Scegli il cliente</option>
                {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input className="field" placeholder="Oggetto (es. Intervento di manutenzione)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              <input className="field" type="date" title="Scadenza (se vuota: 30 giorni)" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <LinesEditor lines={lines} setLines={setLines} totals={parsed.totals} materials={materials} />
            <textarea className="field h-20 py-2" placeholder="Note (facoltative)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex items-center justify-between gap-2"><p className="text-xs text-steel">Una fattura emessa non si modifica: si può solo annullare o segnare come pagata.</p><button className="btn" disabled={create.isPending}>Emetti la fattura</button></div>
            {error && <p className="border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          </form>
        )}

        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)} className={`px-3 py-1.5 text-sm font-medium ${filter === f.value ? "bg-brand text-white" : "box text-slate-700 hover:bg-steel-soft"}`}>{f.label}</button>
          ))}
        </div>

        {isLoading ? <p className="text-sm text-steel">Caricamento...</p> : shown.length === 0 ? (
          <p className="text-sm text-steel">Nessuna fattura{filter !== "tutte" ? " in questo stato" : ""}. Puoi emetterne una nuova oppure crearla da un preventivo accettato.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {shown.map((inv) => {
              const st = effectiveStatus(inv);
              const t = quoteTotals(inv.items ?? []);
              return (
                <div key={inv.id} className={`box space-y-2 p-3 text-sm ${st === "scaduta" ? "border-red-600" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-steel">{inv.number} · {dateOnly(inv.issue_date)}</span>
                    <span className={`inline-flex border px-2 py-0.5 text-xs font-medium ${TONE[st]}`}>{INVOICE_LABELS[st]}</span>
                  </div>
                  <p className="font-semibold">{inv.title}</p>
                  <p className="text-xs text-steel">
                    {inv.client?.name} · scadenza {dateOnly(inv.due_date)}
                    {st === "scaduta" ? ` · in ritardo di ${daysOverdue(inv)} giorni` : ""}
                    {inv.status === "pagata" && inv.paid_at ? ` · pagata il ${format(new Date(inv.paid_at), "dd/MM/yyyy", { locale: it })}${inv.payment_method ? ` (${METHOD_LABELS[inv.payment_method]})` : ""}` : ""}
                    {inv.status === "annullata" && inv.cancel_reason ? ` · motivo: ${inv.cancel_reason}` : ""}
                  </p>
                  <ul className="space-y-0.5 text-xs">
                    {(inv.items ?? []).map((i) => <li key={i.id} className="flex justify-between gap-2"><span className="truncate">{i.quantity} × {i.description}</span><span>{formatCents(lineNet(i))}</span></li>)}
                  </ul>
                  <p className="border-t border-steel-line pt-1 text-right font-semibold">Totale {formatCents(t.gross)} <span className="text-xs font-normal text-steel">(IVA inclusa)</span></p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button className="btn btn-outline h-8" onClick={() => setPrinting(inv)}><Printer className="h-4 w-4" />Stampa / PDF</button>
                    {inv.status === "in_attesa" && (
                      <>
                        <select className="field h-8 w-auto py-0" aria-label="Metodo di pagamento" value={method[inv.id] ?? "bonifico"} onChange={(e) => setMethod({ ...method, [inv.id]: e.target.value as PaymentMethod })}>
                          {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                        </select>
                        <button className="btn h-8" disabled={pay.isPending} onClick={() => pay.mutate({ id: inv.id, method: method[inv.id] ?? "bonifico" })}><Check className="h-4 w-4" />Segna pagata</button>
                        <button className="btn btn-outline h-8" disabled={cancel.isPending} onClick={() => { const reason = window.prompt("Motivo dell'annullamento (facoltativo)"); if (reason !== null) cancel.mutate({ id: inv.id, reason }); }}>Annulla</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {printing && (
        <DocumentSheet doc={{ kind: "Fattura", number: printing.number, date: `${printing.issue_date}T00:00:00`, extraDate: { label: "Scadenza", value: dateOnly(printing.due_date) },
          client: printing.client, title: printing.title, items: printing.items ?? [], notes: printing.notes,
          footer: printing.status === "pagata" ? "Pagata" : printing.status === "annullata" ? "ANNULLATA" : "Documento interno, non valido ai fini fiscali." }} />
      )}
    </>
  );
}
