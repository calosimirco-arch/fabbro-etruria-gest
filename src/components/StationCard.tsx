import { Monitor } from "lucide-react";
import clsx from "clsx";

interface Props {
  station: boolean;
  setStation: (on: boolean) => void;
  wakeLock: boolean;
  wakeLockSupported: boolean;
  canListen: boolean;
  armed: boolean;
  listening: boolean;
}

/** Postazione sempre attiva + indicatore di stato dell'ascolto. */
export function StationCard({ station, setStation, wakeLock, wakeLockSupported, canListen, armed, listening }: Props) {
  const status = !canListen
    ? { tone: "bg-steel-soft text-steel border-steel-line", text: "Questo browser non ascolta la voce (usa Chrome o Edge): puoi scrivere a Sara." }
    : armed && listening
      ? { tone: "bg-emerald-50 text-emerald-800 border-emerald-600", text: "In ascolto: di’ «Ehi Sara»" }
      : armed
        ? { tone: "bg-amber-50 text-amber-800 border-amber-500", text: "Riavvio dell’ascolto…" }
        : { tone: "bg-steel-soft text-steel border-steel-line", text: "Ascolto spento" };

  return (
    <div className="box space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold"><Monitor className="h-4 w-4 text-brand" />Postazione sempre attiva (24 ore su 24)</p>
        <span role="status" className={clsx("inline-flex items-center gap-2 border px-2 py-1 text-xs font-medium", status.tone)}>
          <span className={clsx("h-2 w-2 rounded-full", armed && listening ? "bg-emerald-600" : "bg-current opacity-50")} />{status.text}
        </span>
      </div>
      <p className="text-xs text-steel">
        Lascia questa pagina aperta su un tablet o un PC in ufficio: Sara resta in ascolto di «Ehi Sara» tutto il giorno e tutta la notte, tiene lo schermo acceso, si
        riprende da sola se l’ascolto si interrompe e si ricarica ogni notte alle 4:00 (mai durante una chiamata). Serve l’indirizzo online (https) e il permesso del microfono, e la pagina deve restare aperta in primo piano.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button className={clsx("btn", station ? "" : "btn-outline")} aria-pressed={station} disabled={!canListen} onClick={() => setStation(!station)}>
          {station ? "Postazione attiva: disattiva" : "Attiva la postazione"}
        </button>
        {station && <span className="text-xs text-steel">{wakeLockSupported ? (wakeLock ? "Schermo sempre acceso: sì" : "Schermo sempre acceso: non ottenuto (controlla le impostazioni di risparmio energetico)") : "Questo browser non può tenere lo schermo acceso: disattiva lo standby dal dispositivo."}</span>}
      </div>
    </div>
  );
}
