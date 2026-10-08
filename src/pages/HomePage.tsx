import { Link } from "react-router-dom";
import { CalendarDays, FileText, Mic, Package, Receipt, Truck, Users, Wrench, Megaphone, FolderOpen, HardHat, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useInterventions, useSaraRequests } from "@/hooks/useData";

interface Tile { label: string; icon: LucideIcon; to?: string; staffOnly?: boolean; note?: string }

// Riquadri quadrati dei moduli. Quelli senza `to` non sono ancora costruiti e si vedono "In arrivo": meglio dirlo.
const TILES: Tile[] = [
  { label: "Sara", icon: Mic, to: "/sara", staffOnly: true },
  { label: "Interventi", icon: Wrench, to: "/interventi" },
  { label: "Clienti", icon: Users, to: "/clienti", staffOnly: true },
  { label: "Preventivi", icon: FileText, to: "/preventivi", staffOnly: true },
  { label: "Fatture", icon: Receipt, to: "/fatture", staffOnly: true },
  { label: "Magazzino", icon: Package },
  { label: "Agenda", icon: CalendarDays },
  { label: "Tecnici", icon: HardHat },
  { label: "Fornitori", icon: Truck },
  { label: "Marketing", icon: Megaphone },
  { label: "Documenti", icon: FolderOpen },
];

export default function HomePage() {
  const { profile } = useAuth();
  const staff = profile?.role !== "tecnico";
  const { data: interventions } = useInterventions();
  const { data: requests } = useSaraRequests();
  const open = (interventions ?? []).filter((i) => i.status !== "chiuso").length;
  const urgent = (interventions ?? []).filter((i) => i.status !== "chiuso" && i.priority === "critica").length;
  const pending = (requests ?? []).filter((r) => r.status === "in_attesa").length;

  return (
    <>
      <h1 className="text-xl font-semibold">Buongiorno, {profile?.full_name}</h1>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Interventi aperti" value={open} />
        <Stat label="Urgenti" value={urgent} tone={urgent ? "red" : undefined} />
        {staff && <Stat label="Da confermare" value={pending} tone={pending ? "amber" : undefined} />}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {TILES.filter((t) => staff || !t.staffOnly).map((t) => {
          const body = (
            <>
              <t.icon className="h-8 w-8" />
              <span className="text-sm font-semibold">{t.label}</span>
              {!t.to && <span className="text-[11px] uppercase text-steel">In arrivo</span>}
            </>
          );
          return t.to ? (
            <Link key={t.label} to={t.to} className="box flex aspect-square flex-col items-center justify-center gap-2 text-brand transition hover:bg-brand hover:text-white">{body}</Link>
          ) : (
            <div key={t.label} className="box flex aspect-square flex-col items-center justify-center gap-2 text-steel opacity-60">{body}</div>
          );
        })}
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "red" | "amber" }) {
  return (
    <div className={`box p-3 ${tone === "red" ? "border-red-600" : tone === "amber" ? "border-amber-500" : ""}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-steel">{label}</p>
    </div>
  );
}
