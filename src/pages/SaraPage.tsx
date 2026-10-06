import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Check, Mic, MicOff, PhoneCall, Send, Trash2, X } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { useSara } from "@/hooks/useSara";
import {
  useConfirmSaraRequest,
  useDeleteSaraPrice,
  useRejectSaraRequest,
  useSaraPrices,
  useSaraRequests,
  useSaveSaraPrice,
} from "@/hooks/useData";
import { KIND_LABELS, MOOD_LABELS, URGENCY_LABELS, formatEuro } from "@/lib/sara";
import { useAuth } from "@/hooks/useAuth";
import clsx from "clsx";
import type { SaraRequest } from "@/types";

const formatDateTime = (iso: string) => format(new Date(iso), "dd MMM yyyy, HH:mm", { locale: it });

const DRAFT_FIELDS: Array<[string, "name" | "phone" | "email" | "address" | "reason" | "notes"]> = [
  ["Nome", "name"],
  ["Telefono", "phone"],
  ["Email", "email"],
  ["Indirizzo", "address"],
  ["Motivo", "reason"],
  ["Note", "notes"],
];

export default function SaraPage() {
  const { profile } = useAuth();
  const isOwner = profile?.role === "titolare";
  const sara = useSara();
  const { data: requests, isLoading } = useSaraRequests();
  const pending = (requests ?? []).filter((r) => r.status === "in_attesa");
  const history = (requests ?? []).filter((r) => r.status !== "in_attesa");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Sara</h1>
        <p className="text-sm text-muted-foreground">
          La tua segretaria: risponde ai clienti, raccoglie i dati e ti chiede sempre conferma prima di fare qualsiasi cosa.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Conversation sara={sara} />
        <Card>
          <CardHeader>
            <CardTitle>Cosa ha raccolto Sara</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!sara.inCall && sara.messages.length === 0 && (
              <p className="text-muted-foreground">Premi «Nuova chiamata» per far rispondere Sara a un cliente.</p>
            )}
            {DRAFT_FIELDS.map(([label, key]) => (
              <div key={key} className="flex justify-between gap-3 border-b border-border pb-1">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-right font-medium">{sara.draft[key] || "—"}</span>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline">{KIND_LABELS[sara.draft.kind]}</Badge>
              {sara.draft.urgency && (
                <Badge variant={sara.draft.urgency === "urgente" ? "destructive" : "secondary"}>
                  {URGENCY_LABELS[sara.draft.urgency]}
                </Badge>
              )}
              <Badge variant="outline">Tono: {MOOD_LABELS[sara.draft.mood]}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Da confermare {pending.length > 0 && <Badge variant="warning">{pending.length}</Badge>}
        </h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Niente da confermare: Sara non ha richieste in sospeso.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pending.map((r) => <PendingCard key={r.id} request={r} />)}
          </div>
        )}
      </section>

      {isOwner && <PriceList />}

      <section>
        <h2 className="mb-2 text-sm font-semibold">Storico di Sara</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ancora nessuna richiesta decisa.</p>
        ) : (
          <div className="divide-y divide-border border border-border bg-card">
            {history.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.client_name ?? "Promemoria"} — {r.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {KIND_LABELS[r.kind]} · {formatDateTime(r.created_at)}
                    {r.scheduled_at && r.kind === "promemoria" ? ` · per il ${formatDateTime(r.scheduled_at)}` : ""}
                    {r.reject_reason ? ` · motivo: ${r.reject_reason}` : ""}
                  </p>
                </div>
                <Badge variant={r.status === "confermata" ? "success" : "secondary"}>
                  {r.status === "confermata" ? "Confermata" : "Rifiutata"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Conversation({ sara }: { sara: ReturnType<typeof useSara> }) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [sara.messages.length, sara.interim]);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    void sara.submitText(value);
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Conversazione {sara.speaking && <span className="text-primary">· Sara sta parlando</span>}</CardTitle>
        <div className="flex gap-2">
          {sara.inCall ? (
            <Button variant="outline" size="sm" onClick={sara.cancelCall}>
              <X className="mr-1 h-4 w-4" /> Annulla chiamata
            </Button>
          ) : (
            <Button size="sm" onClick={() => void sara.startCall()}>
              <PhoneCall className="mr-1 h-4 w-4" /> Nuova chiamata
            </Button>
          )}
          {sara.canListen && (
            <Button
              variant={sara.armed ? "default" : "outline"}
              size="sm"
              onClick={() => sara.setArmed(!sara.armed)}
              aria-pressed={sara.armed}
              title="Resta in ascolto: dì «Ehi Sara» per chiamarla"
            >
              {sara.armed ? <Mic className="mr-1 h-4 w-4" /> : <MicOff className="mr-1 h-4 w-4" />}
              «Ehi Sara»
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-64 space-y-2 overflow-y-auto border border-border bg-muted/30 p-3 text-sm">
          {sara.messages.length === 0 && (
            <p className="text-muted-foreground">
              {sara.canListen
                ? "Attiva «Ehi Sara» e di' «Ehi Sara, ricordami domani di chiamare il fornitore», oppure premi «Nuova chiamata»."
                : "Questo browser non ascolta la voce: scrivi a Sara qui sotto (per la voce usa Chrome o Edge)."}
            </p>
          )}
          {sara.messages.map((m, i) => (
            <div key={i} className={clsx("flex", m.from === "persona" && "justify-end")}>
              <p className={clsx("max-w-[85%] px-3 py-2", m.from === "sara" ? "bg-primary/10" : "bg-secondary")}>
                <span className="block text-[11px] uppercase text-muted-foreground">{m.from === "sara" ? "Sara" : "Cliente"}</span>
                {m.text}
              </p>
            </div>
          ))}
          {sara.interim && <p className="text-right italic text-muted-foreground">{sara.interim}…</p>}
          <div ref={endRef} />
        </div>
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder={sara.inCall ? "Scrivi la risposta del cliente" : "Scrivi a Sara (es. «ricordami domani di chiamare il fornitore»)"}
            aria-label="Scrivi a Sara"
          />
          <Button onClick={send} aria-label="Invia"><Send className="h-4 w-4" /></Button>
        </div>
        {!sara.canSpeak && <p className="text-xs text-muted-foreground">Questo dispositivo non ha la voce: Sara risponde solo per iscritto.</p>}
      </CardContent>
    </Card>
  );
}

function PendingCard({ request }: { request: SaraRequest }) {
  const confirm = useConfirmSaraRequest();
  const reject = useRejectSaraRequest();
  const busy = confirm.isPending || reject.isPending;
  const createsTicket = ["intervento", "urgenza", "appuntamento"].includes(request.kind);

  return (
    <Card className={clsx(request.urgency === "urgente" && "border-destructive")}>
      <CardContent className="space-y-2 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{KIND_LABELS[request.kind]}</Badge>
          <Badge variant={request.urgency === "urgente" ? "destructive" : "secondary"}>{URGENCY_LABELS[request.urgency]}</Badge>
          {request.mood !== "sereno" && <Badge variant="warning">{MOOD_LABELS[request.mood]}</Badge>}
        </div>
        <p className="font-semibold">{request.client_name}</p>
        <p>{request.reason}</p>
        <p className="text-xs text-muted-foreground">
          {[request.client_phone, request.client_email, request.client_address].filter(Boolean).join(" · ") || "Nessun recapito"}
        </p>
        {request.notes && <p className="text-xs text-muted-foreground">Note: {request.notes}</p>}
        {request.price_hint != null && <p className="text-xs">Prezzo di listino proposto: <strong>{formatEuro(request.price_hint)}</strong></p>}
        <p className="border-l-2 border-primary bg-muted/40 p-2 text-xs">
          <span className="font-medium">Proposta di Sara:</span> {request.proposal}
          {createsTicket ? " Se confermi, creo il cliente (se è nuovo) e il lavoro negli interventi." : ""}
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button disabled={busy} onClick={() => confirm.mutate(request.id)}>
            <Check className="mr-1 h-4 w-4" /> Conferma
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => reject.mutate(request.id)}>
            <X className="mr-1 h-4 w-4" /> Rifiuta
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Ricevuta il {formatDateTime(request.created_at)}</p>
      </CardContent>
    </Card>
  );
}

function PriceList() {
  const { data: prices } = useSaraPrices();
  const save = useSaveSaraPrice();
  const remove = useDeleteSaraPrice();
  const [label, setLabel] = useState("");
  const [keywords, setKeywords] = useState("");
  const [amount, setAmount] = useState("");

  const add = () => {
    const value = Number(amount.replace(",", "."));
    if (!label.trim() || !Number.isFinite(value) || value < 0) return;
    save.mutate({ label, keywords, amount: value }, { onSuccess: () => { setLabel(""); setKeywords(""); setAmount(""); } });
  };

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Listino prezzi di Sara</h2>
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">
            Se il cliente nomina una delle parole chiave, Sara propone quel prezzo (sempre «da confermare dal titolare»).
          </p>
          {(prices ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{p.label} — {formatEuro(p.amount)}</p>
                <p className="truncate text-xs text-muted-foreground">Parole: {p.keywords.join(", ") || "nessuna"}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Elimina ${p.label}`} onClick={() => remove.mutate(p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="grid gap-2 md:grid-cols-[2fr_2fr_1fr_auto]">
            <Input placeholder="Prestazione (es. Uscita e diagnosi)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Input placeholder="Parole chiave, separate da virgola" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            <Input placeholder="Importo €" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button onClick={add} disabled={save.isPending}>Aggiungi</Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
