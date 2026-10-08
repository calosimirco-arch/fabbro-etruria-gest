import { describe, expect, it } from "vitest";
import { msUntilNextHour } from "./station";

describe("riavvio notturno", () => {
  it("prima delle 4: oggi alle 4", () => {
    expect(msUntilNextHour(new Date(2026, 9, 8, 1, 30), 4)).toBe(2.5 * 3600_000);
  });
  it("dopo le 4: domani alle 4", () => {
    expect(msUntilNextHour(new Date(2026, 9, 8, 15, 0), 4)).toBe(13 * 3600_000);
  });
  it("alle 4 in punto: la prossima e' domani, non subito", () => {
    expect(msUntilNextHour(new Date(2026, 9, 8, 4, 0), 4)).toBe(24 * 3600_000);
  });
  it("a cavallo di fine mese", () => {
    expect(msUntilNextHour(new Date(2026, 9, 31, 23, 0), 4)).toBe(5 * 3600_000);
  });
});
