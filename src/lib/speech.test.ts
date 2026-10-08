import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listen, restartDelay } from "./speech";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = ""; continuous = false; interimResults = false;
  onresult: ((e: unknown) => void) | null = null; onerror: ((e: { error: string }) => void) | null = null; onend: (() => void) | null = null;
  starts = 0; aborted = false; failStart = false;
  constructor() { FakeRecognition.instances.push(this); }
  start() { if (this.failStart) throw new Error("gia' avviato"); this.starts += 1; }
  stop() {} abort() { this.aborted = true; }
}

describe("ascolto continuo", () => {
  beforeEach(() => { vi.useFakeTimers(); FakeRecognition.instances = []; (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition; });
  afterEach(() => { vi.useRealTimers(); delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition; });

  it("quando il browser lo interrompe, riparte da solo", () => {
    const states: boolean[] = [];
    const l = listen({ continuous: true, onFinal: () => {}, onState: (a) => states.push(a) })!;
    const rec = FakeRecognition.instances[0];
    expect(rec.starts).toBe(1);
    rec.onend!();
    expect(rec.starts).toBe(1); // non subito: una breve pausa
    vi.advanceTimersByTime(300);
    expect(rec.starts).toBe(2);
    expect(states).toEqual([true, false, true]);
    l.stop();
  });

  it("se le interruzioni sono continue, allunga la pausa invece di girare a vuoto", () => {
    listen({ continuous: true, onFinal: () => {} });
    const rec = FakeRecognition.instances[0];
    for (let i = 0; i < 7; i += 1) { rec.onend!(); vi.advanceTimersByTime(restartDelay(i + 1) + 1); }
    const before = rec.starts;
    rec.onend!();
    vi.advanceTimersByTime(1000);
    expect(rec.starts).toBe(before); // dopo molte interruzioni attende 3 secondi
    vi.advanceTimersByTime(2100);
    expect(rec.starts).toBe(before + 1);
  });

  it("se non riesce a ripartire riprova piu' tardi", () => {
    listen({ continuous: true, onFinal: () => {} });
    const rec = FakeRecognition.instances[0];
    rec.failStart = true;
    rec.onend!(); vi.advanceTimersByTime(300);
    expect(rec.starts).toBe(1);
    rec.failStart = false;
    vi.advanceTimersByTime(5000);
    expect(rec.starts).toBe(2);
  });

  it("dopo stop() non riparte piu' e non lancia", () => {
    const l = listen({ continuous: true, onFinal: () => {} })!;
    const rec = FakeRecognition.instances[0];
    rec.onend!();
    l.stop();
    vi.advanceTimersByTime(10_000);
    expect(rec.starts).toBe(1);
    expect(rec.aborted).toBe(true);
  });

  it("microfono negato: non riprova e avvisa", () => {
    const denied = vi.fn();
    listen({ continuous: true, onFinal: () => {}, onDenied: denied });
    const rec = FakeRecognition.instances[0];
    rec.onerror!({ error: "not-allowed" }); rec.onend!();
    vi.advanceTimersByTime(10_000);
    expect(denied).toHaveBeenCalledTimes(1);
    expect(rec.starts).toBe(1);
  });

  it("riconosce una frase", () => {
    const heard: string[] = [];
    listen({ continuous: true, onFinal: (t) => heard.push(t) });
    FakeRecognition.instances[0].onresult!({ resultIndex: 0, results: [Object.assign([{ transcript: " Ehi Sara " }], { isFinal: true })] });
    expect(heard).toEqual(["Ehi Sara"]);
  });
});
