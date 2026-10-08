// Postazione sempre attiva: calcoli semplici, senza React (station.test.ts).

/** Millisecondi da `now` alla prossima volta che l'orologio segna le `hour`:00 (oggi se non e' ancora passata, altrimenti domani). */
export function msUntilNextHour(now: Date, hour: number): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** Ora del riavvio notturno: la pagina aperta per giorni si ripulisce e prende gli aggiornamenti. */
export const NIGHTLY_RELOAD_HOUR = 4;
/** Se alle 4:00 c'e' una chiamata in corso, si riprova dopo questo tempo. */
export const RELOAD_RETRY_MS = 10 * 60_000;
/** Ogni quanto si controlla che il microfono sia ancora acceso. */
export const WATCHDOG_MS = 15_000;
