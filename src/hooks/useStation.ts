import { useCallback, useEffect, useRef, useState } from "react";
import { NIGHTLY_RELOAD_HOUR, RELOAD_RETRY_MS, WATCHDOG_MS, msUntilNextHour } from "@/lib/station";

const KEY = "sara-station";

function readSaved(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

interface StationSara {
  canListen: boolean;
  inCall: boolean;
  setArmed: (on: boolean) => void;
  ensureListening: () => void;
}

/**
 * Postazione sempre attiva (tablet o PC lasciato acceso): resta in ascolto di «Ehi Sara» 24 ore su 24.
 *  - ricorda la scelta e si riaccende da sola quando la pagina si riapre;
 *  - tiene lo schermo acceso (Screen Wake Lock) e lo richiede di nuovo quando la scheda torna visibile;
 *  - ogni 15 secondi, al ritorno della rete e della scheda controlla che il microfono sia acceso, e lo riaccende;
 *  - ogni notte alle 4:00 (se non c'e' una chiamata) ricarica la pagina: la ripulisce e prende gli aggiornamenti.
 * Un sito non puo' ascoltare ad app chiusa: la pagina deve restare aperta in primo piano.
 */
export function useStation(sara: StationSara) {
  const [station, setStationState] = useState(readSaved);
  const [wakeLock, setWakeLock] = useState(false);
  const inCallRef = useRef(sara.inCall);
  const { setArmed, ensureListening, canListen } = sara;

  useEffect(() => { inCallRef.current = sara.inCall; }, [sara.inCall]);

  const setStation = useCallback((on: boolean) => {
    try {
      window.localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      // senza memoria nel browser la scelta vale solo per questa apertura
    }
    setStationState(on);
    if (on) setArmed(true);
  }, [setArmed]);

  // Riaccensione automatica all'apertura della pagina.
  useEffect(() => { if (station && canListen) setArmed(true); }, [station, canListen, setArmed]);

  useEffect(() => {
    if (!station || !("wakeLock" in navigator)) { setWakeLock(false); return; }
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request("screen");
        if (cancelled) { void l.release().catch(() => {}); return; }
        lock = l;
        setWakeLock(true);
        l.addEventListener("release", () => setWakeLock(false));
      } catch {
        setWakeLock(false); // il browser lo nega (es. batteria scarica): la postazione funziona lo stesso
      }
    };
    void acquire();
    const onVisible = () => { if (document.visibilityState === "visible") void acquire(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [station]);

  useEffect(() => {
    if (!station) return;
    const check = () => ensureListening();
    const timer = window.setInterval(check, WATCHDOG_MS);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [station, ensureListening]);

  useEffect(() => {
    if (!station) return;
    let timer: number;
    const schedule = (ms: number) => {
      timer = window.setTimeout(() => {
        if (inCallRef.current) schedule(RELOAD_RETRY_MS); // mai a meta' di una chiamata
        else window.location.reload();
      }, ms);
    };
    schedule(msUntilNextHour(new Date(), NIGHTLY_RELOAD_HOUR));
    return () => window.clearTimeout(timer);
  }, [station]);

  return { station, setStation, wakeLock, wakeLockSupported: typeof navigator !== "undefined" && "wakeLock" in navigator };
}
