import { useState } from "react";
import { useClients, useCreateClient } from "@/hooks/useData";

export default function ClientsPage() {
  const { data: clients, isLoading } = useClients();
  const create = useCreateClient();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [query, setQuery] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const shown = (clients ?? []).filter((c) => `${c.name} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <h1 className="text-xl font-semibold">Clienti</h1>
      <form className="box grid gap-2 p-3 md:grid-cols-[2fr_1fr_2fr_2fr_auto]"
        onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm({ name: "", phone: "", email: "", address: "" }) }); }}>
        <input className="field" placeholder="Nome e cognome / ragione sociale" value={form.name} onChange={set("name")} required />
        <input className="field" placeholder="Telefono" value={form.phone} onChange={set("phone")} />
        <input className="field" type="email" placeholder="Email" value={form.email} onChange={set("email")} />
        <input className="field" placeholder="Indirizzo" value={form.address} onChange={set("address")} />
        <button className="btn" disabled={create.isPending}>Aggiungi</button>
      </form>
      <input className="field" placeholder="Cerca per nome, telefono o email" value={query} onChange={(e) => setQuery(e.target.value)} />
      {isLoading ? <p className="text-sm text-steel">Caricamento...</p> : shown.length === 0 ? <p className="text-sm text-steel">Nessun cliente.</p> : (
        <div className="box divide-y divide-steel-line">
          {shown.map((c) => (
            <div key={c.id} className="p-3 text-sm">
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-steel">{[c.phone, c.email, c.address].filter(Boolean).join(" · ") || "Nessun recapito"}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
