import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClients, useCreateIntervention, useInterventions, useSetInterventionStatus } from "@/hooks/useData";
import type { InterventionStatus, Priority } from "@/types";

const STATUS: Record<InterventionStatus, string> = { nuovo: "Nuovo", assegnato: "Assegnato", in_corso: "In corso", chiuso: "Chiuso" };
const NEXT: Partial<Record<InterventionStatus, { to: InterventionStatus; label: string }>> = {
  nuovo: { to: "in_corso", label: "Avvia" },
  assegnato: { to: "in_corso", label: "Avvia" },
  in_corso: { to: "chiuso", label: "Chiudi" },
};

export default function InterventionsPage() {
  const { profile } = useAuth();
  const staff = profile?.role !== "tecnico";
  const { data: items, isLoading } = useInterventions();
  const { data: clients } = useClients();
  const create = useCreateIntervention();
  const setStatus = useSetInterventionStatus();
  const [form, setForm] = useState({ clientId: "", title: "", description: "", priority: "media" as Priority, address: "" });

  return (
    <>
      <h1 className="text-xl font-semibold">Interventi</h1>
      {staff && (
        <form className="box grid gap-2 p-3 md:grid-cols-[2fr_2fr_1fr_auto]"
          onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm({ ...form, title: "", description: "", address: "" }) }); }}>
          <select className="field" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
            <option value="">Scegli il cliente</option>
            {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="field" placeholder="Cosa c'è da fare" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <select className="field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
            <option value="bassa">Bassa</option><option value="media">Media</option><option value="alta">Alta</option><option value="critica">Critica</option>
          </select>
          <button className="btn" disabled={create.isPending}>Crea</button>
        </form>
      )}
      {isLoading ? <p className="text-sm text-steel">Caricamento...</p> : (items ?? []).length === 0 ? <p className="text-sm text-steel">Nessun intervento.</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {(items ?? []).map((i) => (
            <div key={i.id} className={`box space-y-1 p-3 text-sm ${i.priority === "critica" && i.status !== "chiuso" ? "border-red-600" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-steel">{i.number}</span>
                <span className="tag">{STATUS[i.status]}</span>
              </div>
              <p className="font-semibold">{i.title}</p>
              <p className="text-xs text-steel">{i.client?.name}{i.address ? ` · ${i.address}` : ""} · priorità {i.priority}</p>
              {NEXT[i.status] && (
                <button className="btn btn-outline h-8" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: i.id, status: NEXT[i.status]!.to })}>
                  {NEXT[i.status]!.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
