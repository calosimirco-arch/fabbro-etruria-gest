import { describe, expect, it } from "vitest";
import { cleanKey, normalizeSupabaseUrl } from "./env";

describe("indirizzo del progetto", () => {
  const ok = "https://cmavzwxkhqxadvegtbsi.supabase.co";
  it("accetta quello giusto", () => expect(normalizeSupabaseUrl(ok)).toBe(ok));
  it("aggiunge https:// se manca", () => expect(normalizeSupabaseUrl("cmavzwxkhqxadvegtbsi.supabase.co")).toBe(ok));
  it("toglie virgolette, spazi, barra finale e /rest/v1", () => {
    expect(normalizeSupabaseUrl(`  "${ok}/"  `)).toBe(ok);
    expect(normalizeSupabaseUrl(`${ok}/rest/v1/`)).toBe(ok);
    expect(normalizeSupabaseUrl(`${ok}/auth/v1/health`)).toBe(ok);
  });
  it("rifiuta cio' che non e' un indirizzo", () => {
    expect(normalizeSupabaseUrl("")).toBeNull();
    expect(normalizeSupabaseUrl(undefined)).toBeNull();
    expect(normalizeSupabaseUrl("cosa strana")).toBeNull();
    expect(normalizeSupabaseUrl("localhost")).toBeNull();
  });
});

describe("chiave", () => {
  it("toglie virgolette e a-capo", () => expect(cleanKey(' "eyJabc\n def" ')).toBe("eyJabcdef"));
  it("vuota se manca", () => expect(cleanKey(undefined)).toBe(""));
});
