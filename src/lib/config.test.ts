import { beforeEach, describe, expect, it } from "vitest";
import { buildShareLink, consumeConfigFromUrl, decodeConfig, encodeConfig, readStoredConfig } from "./config";

const cfg = { url: "https://abcdefgh.supabase.co", key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc_def-ghi" };

describe("collegamento per un altro dispositivo", () => {
  beforeEach(() => { window.localStorage.clear(); window.history.replaceState(null, "", "/"); });

  it("codifica e decodifica senza perdere nulla", () => {
    expect(decodeConfig(encodeConfig(cfg))).toEqual(cfg);
  });
  it("il testo e' sicuro in un indirizzo (niente + / =)", () => {
    expect(encodeConfig(cfg)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it("un testo sbagliato non e' una configurazione", () => {
    expect(decodeConfig("non-valido!!")).toBeNull();
    expect(decodeConfig(encodeConfig({ url: "x", key: "y" }).slice(0, 5))).toBeNull();
  });
  it("aprire il collegamento salva la configurazione e pulisce la barra", () => {
    window.history.replaceState(null, "", `/app/?cfg=${encodeConfig(cfg)}#/sara`);
    consumeConfigFromUrl();
    expect(readStoredConfig()).toEqual(cfg);
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("#/sara"); // il percorso dell'app resta
  });
  it("un collegamento con dati non validi non salva niente", () => {
    window.history.replaceState(null, "", `/?cfg=${encodeConfig({ url: "javascript:alert(1)", key: "x".repeat(30) })}`);
    consumeConfigFromUrl();
    expect(readStoredConfig()).toBeNull();
  });
  it("costruisce il collegamento da condividere", () => {
    const link = buildShareLink(cfg, "https://esempio.github.io/sara/");
    expect(link.startsWith("https://esempio.github.io/sara/?cfg=")).toBe(true);
    expect(decodeConfig(link.split("?cfg=")[1])).toEqual(cfg);
  });
});
