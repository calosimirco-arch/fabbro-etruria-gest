import { useMemo, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, ArrowRightLeft, Archive, Pencil, Plus, X } from "lucide-react";
import { useCreateWarehouse, useInterventions, useMaterials, useMovements, useSaveMaterial, useStockLevels, useStockMove, useStockTransfer, useWarehouses } from "@/hooks/useData";
import { KIND_LABELS, formatQty, lowStock, parseQty, stockOf, stockState } from "@/lib/inventory";
import { formatCents, parseDecimal } from "@/lib/quotes";
import type { Material, MovementKind } from "@/types";

type Tab = "materiali" | "movimenti" | "magazzini";
type Action = MovementKind | "trasferimento";
const ACTION_LABELS: Record<Action, string> = { carico: "Carico", scarico: "Scarico", rettifica: "Rettifica", trasferimento: "Trasferimento" };
const STATE_TONE = { ok: "", basso: "bg-amber-500 text-white border-amber-500", esaurito: "bg-red-700 text-white border-red-700" } as const;

export default function InventoryPage() {
  const { data: materials, isLoading } = useMaterials();
  const { data: warehouses } = useWarehouses();
  const { data: levels } = useStockLevels();
  const { data: movements } = useMovements();
  const { data: interventions } = useInterventions();
  const save = useSaveMaterial();
  const move = useStockMove();
  const transfer = useStockTransfer();
  const addWarehouse = useCreateWarehouse();

  const [tab, setTab] = useState<Tab>("materiali");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Material | "new" | null>(null);
  const [matForm, setMatForm] = useState({ code: "", name: "", unit: "pz", price: "", minStock: "" });
  const [matError, setMatError] = useState<string | null>(null);
  const [acting, setActing] = useState<Material | null>(null);
  const [mv, setMv] = useState({ action: "carico" as Action, warehouseId: "", toId: "", quantity: "", note: "", interventionId: "" });
  const [mvError, setMvError] = useState<string | null>(null);
  const [filterMaterial, setFilterMaterial] = useState("");
  const [newWarehouse, setNewWarehouse] = useState("");

  const mats = useMemo(() => materials ?? [], [materials]);
  const lvls = useMemo(() => levels ?? [], [levels]);
  const whs = warehouses ?? [];
  const low = useMemo(() => lowStock(mats, lvls), [mats, lvls]);
  const shown = mats.filter((m) => `${m.code} ${m.name}`.toLowerCase().includes(query.toLowerCase()));

  const openEditor = (m: Material | "new") => {
    setEditing(m); setMatError(null);
    setMatForm(m === "new" ? { code: "", name: "", unit: "pz", price: "", minStock: "" }
      : { code: m.code, name: m.name, unit: m.unit, price: String(m.price).replace(".", ","), minStock: String(m.min_stock).replace(".", ",") });
  };
  const submitMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    const price = matForm.price.trim() ? parseDecimal(matForm.price) : 0;
    const minStock = matForm.minStock.trim() ? parseDecimal(matForm.minStock) : 0;
    if (!matForm.code.trim() || !matForm.name.trim()) return setMatError("Servono codice e nome.");
    if (Number.isNaN(price) || Number.isNaN(minStock)) return setMatError("Prezzo e scorta minima devono essere numeri.");
    save.mutate({ id: editing && editing !== "new" ? editing.id : undefined, code: matForm.code, name: matForm.name, unit: matForm.unit, price, minStock }, { onSuccess: () => setEditing(null) });
  };

  const openMovement = (m: Material, action: Action = "carico") => {
    setActing(m); setMvError(null);
    setMv({ action, warehouseId: whs[0]?.id ?? "", toId: whs[1]?.id ?? "", quantity: "", note: "", interventionId: "" });
  };
  const submitMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acting) return;
    const qty = parseQty(mv.quantity, mv.action === "rettifica");
    if (Number.isNaN(qty)) return setMvError(mv.action === "rettifica" ? "Scrivi la differenza (es. -2 o 3)." : "Scrivi una quantità maggiore di zero.");
    if (!mv.warehouseId) return setMvError("Scegli il magazzino.");
    const done = { onSuccess: () => setActing(null) };
    if (mv.action === "trasferimento") {
      if (!mv.toId || mv.toId === mv.warehouseId) return setMvError("Scegli due magazzini diversi.");
      transfer.mutate({ materialId: acting.id, fromId: mv.warehouseId, toId: mv.toId, quantity: qty, note: mv.note }, done);
    } else {
      move.mutate({ materialId: acting.id, warehouseId: mv.warehouseId, kind: mv.action, quantity: qty, note: mv.note, interventionId: mv.action === "scarico" ? mv.interventionId : null }, done);
    }
  };

  const movementsShown = (movements ?? []).filter((m) => !filterMaterial || m.material_id === filterMaterial);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Magazzino</h1>
        {tab === "materiali" && <button className="btn" onClick={() => (editing ? setEditing(null) : openEditor("new"))}>{editing ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editing ? "Chiudi" : "Nuovo materiale"}</button>}
      </div>

      {low.length > 0 && (
        <div className="border border-amber-400 bg-amber-50 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-amber-800"><AlertTriangle className="h-4 w-4" />Da riordinare ({low.length})</p>
          <ul className="mt-1 grid gap-x-6 sm:grid-cols-2">
            {low.map(({ material, total, state }) => (
              <li key={material.id} className="flex justify-between gap-2"><span className="truncate">{material.code} · {material.name}</span><span className={state === "esaurito" ? "font-semibold text-red-700" : ""}>{state === "esaurito" ? "esaurito" : `${formatQty(total, material.unit)} / min ${formatQty(material.min_stock)}`}</span></li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {(["materiali", "movimenti", "magazzini"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-brand text-white" : "box text-slate-700 hover:bg-steel-soft"}`}>{t}</button>
        ))}
      </div>

      {tab === "materiali" && (
        <>
          {editing && (
            <form onSubmit={submitMaterial} className="box space-y-2 p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_3fr_1fr_1fr_1fr]">
                <input className="field" placeholder="Codice" aria-label="Codice" value={matForm.code} onChange={(e) => setMatForm({ ...matForm, code: e.target.value })} />
                <input className="field" placeholder="Nome del materiale" aria-label="Nome" value={matForm.name} onChange={(e) => setMatForm({ ...matForm, name: e.target.value })} />
                <input className="field" placeholder="Unità (pz, m, kg)" aria-label="Unità" value={matForm.unit} onChange={(e) => setMatForm({ ...matForm, unit: e.target.value })} />
                <input className="field" inputMode="decimal" placeholder="Prezzo €" aria-label="Prezzo" value={matForm.price} onChange={(e) => setMatForm({ ...matForm, price: e.target.value })} />
                <input className="field" inputMode="decimal" placeholder="Scorta minima" aria-label="Scorta minima" value={matForm.minStock} onChange={(e) => setMatForm({ ...matForm, minStock: e.target.value })} />
              </div>
              {matError && <p className="border border-red-300 bg-red-50 p-2 text-sm text-red-700">{matError}</p>}
              <div className="flex justify-end"><button className="btn" disabled={save.isPending}>{editing === "new" ? "Aggiungi materiale" : "Salva modifiche"}</button></div>
            </form>
          )}

          {acting && (
            <form onSubmit={submitMovement} className="box space-y-2 border-brand p-3">
              <p className="text-sm font-semibold">{acting.code} · {acting.name} <span className="font-normal text-steel">— in magazzino {formatQty(stockOf(lvls, acting.id), acting.unit)}</span></p>
              <div className="grid gap-2 md:grid-cols-4">
                <select className="field" aria-label="Tipo di movimento" value={mv.action} onChange={(e) => setMv({ ...mv, action: e.target.value as Action })}>
                  {(Object.keys(ACTION_LABELS) as Action[]).map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
                </select>
                <select className="field" aria-label={mv.action === "trasferimento" ? "Da" : "Magazzino"} value={mv.warehouseId} onChange={(e) => setMv({ ...mv, warehouseId: e.target.value })}>
                  {whs.map((w) => <option key={w.id} value={w.id}>{mv.action === "trasferimento" ? `Da: ${w.name}` : w.name}</option>)}
                </select>
                {mv.action === "trasferimento" ? (
                  <select className="field" aria-label="A" value={mv.toId} onChange={(e) => setMv({ ...mv, toId: e.target.value })}>
                    {whs.map((w) => <option key={w.id} value={w.id}>A: {w.name}</option>)}
                  </select>
                ) : mv.action === "scarico" ? (
                  <select className="field" aria-label="Intervento" value={mv.interventionId} onChange={(e) => setMv({ ...mv, interventionId: e.target.value })}>
                    <option value="">Nessun intervento</option>
                    {(interventions ?? []).filter((i) => i.status !== "chiuso").map((i) => <option key={i.id} value={i.id}>{i.number} · {i.title.slice(0, 40)}</option>)}
                  </select>
                ) : <span />}
                <input className="field" inputMode="decimal" aria-label="Quantità" placeholder={mv.action === "rettifica" ? "Differenza (es. -2)" : "Quantità"} value={mv.quantity} onChange={(e) => setMv({ ...mv, quantity: e.target.value })} />
              </div>
              <input className="field" placeholder="Nota (facoltativa)" aria-label="Nota" value={mv.note} onChange={(e) => setMv({ ...mv, note: e.target.value })} />
              {mvError && <p className="border border-red-300 bg-red-50 p-2 text-sm text-red-700">{mvError}</p>}
              <div className="flex justify-end gap-2"><button type="button" className="btn btn-outline" onClick={() => setActing(null)}>Annulla</button><button className="btn" disabled={move.isPending || transfer.isPending}>Registra</button></div>
            </form>
          )}

          <input className="field" placeholder="Cerca per codice o nome" value={query} onChange={(e) => setQuery(e.target.value)} />
          {isLoading ? <p className="text-sm text-steel">Caricamento...</p> : shown.length === 0 ? <p className="text-sm text-steel">Nessun materiale. Aggiungi il primo con «Nuovo materiale».</p> : (
            <div className="grid gap-3 md:grid-cols-2">
              {shown.map((m) => {
                const total = stockOf(lvls, m.id);
                const state = stockState(m, total);
                return (
                  <div key={m.id} className={`box space-y-2 p-3 text-sm ${!m.active ? "opacity-60" : ""} ${state === "esaurito" ? "border-red-600" : state === "basso" ? "border-amber-500" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><p className="text-xs font-medium text-steel">{m.code}{!m.active ? " · archiviato" : ""}</p><p className="truncate font-semibold">{m.name}</p></div>
                      <div className="text-right"><p className="text-lg font-bold">{formatQty(total, m.unit)}</p>{state !== "ok" && <span className={`inline-flex border px-2 py-0.5 text-xs font-medium ${STATE_TONE[state]}`}>{state === "esaurito" ? "Esaurito" : "Scorta bassa"}</span>}</div>
                    </div>
                    <p className="text-xs text-steel">Prezzo {formatCents(Math.round(m.price * 100))} · scorta minima {formatQty(m.min_stock)}{whs.length > 1 ? ` · ${whs.map((w) => `${w.name}: ${formatQty(stockOf(lvls, m.id, w.id))}`).join(" · ")}` : ""}</p>
                    <div className="flex flex-wrap gap-2">
                      {m.active && <button className="btn h-8" onClick={() => openMovement(m)}>Movimento</button>}
                      {m.active && whs.length > 1 && <button className="btn btn-outline h-8" onClick={() => openMovement(m, "trasferimento")}><ArrowRightLeft className="h-4 w-4" />Trasferisci</button>}
                      <button className="btn btn-outline h-8" onClick={() => openEditor(m)}><Pencil className="h-4 w-4" />Modifica</button>
                      <button className="btn btn-outline h-8" disabled={save.isPending} onClick={() => save.mutate({ id: m.id, code: m.code, name: m.name, unit: m.unit, price: m.price, minStock: m.min_stock, active: !m.active })}><Archive className="h-4 w-4" />{m.active ? "Archivia" : "Riattiva"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "movimenti" && (
        <>
          <select className="field" aria-label="Filtra per materiale" value={filterMaterial} onChange={(e) => setFilterMaterial(e.target.value)}>
            <option value="">Tutti i materiali</option>
            {mats.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}
          </select>
          {movementsShown.length === 0 ? <p className="text-sm text-steel">Nessun movimento.</p> : (
            <div className="box divide-y divide-steel-line">
              {movementsShown.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.material?.code} · {m.material?.name}</p>
                    <p className="text-xs text-steel">{KIND_LABELS[m.kind]} · {m.warehouse?.name} · {format(new Date(m.created_at), "dd MMM yyyy, HH:mm", { locale: it })}{m.intervention?.number ? ` · ${m.intervention.number}` : ""}{m.note ? ` · ${m.note}` : ""}</p>
                  </div>
                  <span className={`font-semibold ${m.delta < 0 ? "text-red-700" : "text-emerald-700"}`}>{m.delta > 0 ? "+" : ""}{formatQty(m.delta, m.material?.unit)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "magazzini" && (
        <>
          <form className="box flex gap-2 p-3" onSubmit={(e) => { e.preventDefault(); if (newWarehouse.trim()) addWarehouse.mutate(newWarehouse, { onSuccess: () => setNewWarehouse("") }); }}>
            <input className="field" placeholder="Nome del nuovo magazzino (es. Furgone 1)" value={newWarehouse} onChange={(e) => setNewWarehouse(e.target.value)} />
            <button className="btn" disabled={addWarehouse.isPending}>Aggiungi</button>
          </form>
          <div className="grid gap-3 md:grid-cols-3">
            {whs.map((w) => {
              const items = mats.filter((m) => stockOf(lvls, m.id, w.id) > 0).length;
              return <div key={w.id} className="box p-3"><p className="font-semibold">{w.name}</p><p className="text-xs text-steel">{items} materiali con giacenza</p></div>;
            })}
          </div>
        </>
      )}
    </div>
  );
}
