import { describe, expect, it } from "vitest";
import {
  EMPTY_DRAFT,
  applyAnswer,
  buildProposal,
  describeWhen,
  detectKind,
  detectMood,
  extractWake,
  findPrice,
  greeting,
  nextStep,
  parseEmail,
  parsePhone,
  parseReminder,
  parseUrgency,
} from "./sara";

describe("parola di attivazione", () => {
  it("riconosce «Ehi Sara» e restituisce il resto", () => {
    expect(extractWake("Ehi Sara, ricordami domani")).toEqual({ woke: true, rest: "ricordami domani" });
    expect(extractWake("ok sara")).toEqual({ woke: true, rest: "" });
  });
  it("senza la parola non si attiva", () => {
    expect(extractWake("la sara è in ferie").woke).toBe(false);
  });
});

describe("saluto", () => {
  it("cambia con l'ora", () => {
    expect(greeting(new Date(2026, 9, 6, 9))).toBe("Buongiorno, sono Sara, come posso aiutarla?");
    expect(greeting(new Date(2026, 9, 6, 15))).toMatch(/^Buon pomeriggio/);
    expect(greeting(new Date(2026, 9, 6, 20))).toMatch(/^Buonasera/);
  });
});

describe("telefono ed email detti a voce", () => {
  it("capisce cifre a parole e scritte", () => {
    expect(parsePhone("tre tre otto uno due tre quattro cinque sei sette")).toBe("3381234567");
    expect(parsePhone("338 123 4567")).toBe("3381234567");
    expect(parsePhone("più trentanove 338 1234567")).toBeNull(); // «trentanove» non è una cifra: meglio chiedere di nuovo
    expect(parsePhone("non lo ricordo")).toBeNull();
  });
  it("capisce l'email", () => {
    expect(parseEmail("mario punto rossi chiocciola gmail punto com")).toBe("mario.rossi@gmail.com");
    expect(parseEmail("mario rossi")).toBeNull();
  });
});

describe("urgenza, tono e tipo di richiesta", () => {
  it("distingue urgente da non urgente", () => {
    expect(parseUrgency("c'è un allagamento in cucina")).toBe("urgente");
    expect(parseUrgency("non è urgente")).toBe("normale");
    expect(parseUrgency("appena possibile")).toBe("alta");
  });
  it("rileva il tono", () => {
    expect(detectMood("è inaccettabile, aspetto da giorni")).toBe("irritato");
    expect(detectMood("sono preoccupata")).toBe("preoccupato");
    expect(detectMood("vorrei un controllo")).toBe("sereno");
  });
  it("classifica la richiesta", () => {
    expect(detectKind("quanto costa cambiare una caldaia")).toBe("preventivo");
    expect(detectKind("vorrei fissare un appuntamento")).toBe("appuntamento");
    expect(detectKind("perdita d'acqua, è urgente")).toBe("urgenza");
    expect(detectKind("il boiler è rotto")).toBe("intervento");
  });
});

describe("conversazione di raccolta dati", () => {
  it("percorre tutte le domande e salta l'urgenza se già chiara", () => {
    let d = EMPTY_DRAFT;
    const say = (text: string) => {
      const step = nextStep(d)!;
      const r = applyAnswer(d, step, text);
      expect(r.ok).toBe(true);
      d = r.draft;
    };
    expect(nextStep(d)).toBe("motivo");
    say("ho un allagamento in bagno");
    expect(d.kind).toBe("urgenza");
    expect(d.urgency).toBe("urgente");
    say("mario rossi");
    say("tre tre otto uno due tre quattro cinque sei sette");
    say("no");
    say("via Roma 12 Milano");
    expect(nextStep(d)).toBe("note"); // urgenza già nota
    say("citofono Rossi");
    expect(nextStep(d)).toBeNull();
    expect(d).toMatchObject({ name: "Mario Rossi", phone: "3381234567", email: "", address: "via Roma 12 Milano", notes: "citofono Rossi" });
  });
  it("chiede di ripetere quando non capisce", () => {
    const r = applyAnswer(EMPTY_DRAFT, "telefono", "boh");
    expect(r.ok).toBe(false);
    expect(r.reply).toMatch(/numero/);
    expect(applyAnswer(EMPTY_DRAFT, "nome", "Mario").ok).toBe(false);
  });
  it("la proposta cita il prezzo di listino", () => {
    const price = { id: "1", label: "Uscita e diagnosi", keywords: ["caldaia"], amount: 60 };
    expect(findPrice("la caldaia non parte", [price])).toBe(price);
    expect(findPrice("problema alla porta", [price])).toBeNull();
    const text = buildProposal({ ...EMPTY_DRAFT, name: "Mario Rossi", reason: "caldaia", urgency: "alta" }, price);
    expect(text).toMatch(/Uscita e diagnosi/);
    expect(text).toMatch(/urgenza alta/);
  });
});

describe("promemoria", () => {
  const now = new Date(2026, 9, 6, 10, 0); // martedì 6 ottobre 2026
  it("«ricordami domani di chiamare il fornitore»", () => {
    const r = parseReminder("Sara, ricordami domani di chiamare il fornitore", now)!;
    expect(r.what).toBe("chiamare il fornitore");
    expect(r.at.getDate()).toBe(7);
    expect(r.at.getHours()).toBe(9);
    expect(describeWhen(r.at, now)).toBe("domani alle 9:00");
  });
  it("capisce ora e giorni della settimana", () => {
    const r = parseReminder("ricordami venerdì alle 15 e 30 di mandare il preventivo", now)!;
    expect(r.at.getDay()).toBe(5);
    expect([r.at.getHours(), r.at.getMinutes()]).toEqual([15, 30]);
    expect(r.what).toBe("mandare il preventivo");
  });
  it("senza «ricordami» o senza cosa ricordare non c'è promemoria", () => {
    expect(parseReminder("chiama il fornitore", now)).toBeNull();
    expect(parseReminder("ricordami domani", now)).toBeNull();
  });
});
