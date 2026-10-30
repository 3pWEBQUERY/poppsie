import "server-only";
import { randomInt } from "node:crypto";

/**
 * Anbieter-neutrale KYC-Schnittstelle. Solange kein externer Anbieter gewählt ist, läuft die
 * Identitätsprüfung "manual": Poppsie legt nur einen Vorgang an; Ausweisdaten werden vom
 * KYC-Anbieter geprüft und nie bei uns gespeichert.
 */
export type KycProvider = {
  id: string;
  /** Startet eine Prüfung und liefert optional eine Weiterleitung zum Anbieter. */
  start(input: { userId: string; verificationId: string }): Promise<{ redirectUrl: string | null; providerRef: string | null }>;
};

const manual: KycProvider = {
  id: "manual",
  async start() {
    return { redirectUrl: null, providerRef: null };
  },
};

export function kycProvider(): KycProvider {
  return manual;
}

const GESTURES = [
  "Peace-Zeichen (✌) neben dem Gesicht",
  "Daumen hoch (👍) neben dem Gesicht",
  "Drei Finger hochhalten",
  "Hand flach an die Wange legen",
  "Zeigefinger an die Nasenspitze",
  "OK-Zeichen (👌) neben dem Auge",
];

/** Zufälliger Gesten-Code für die Foto-Verifikation: Geste + Zahlencode auf einem Zettel. */
export function randomGestureCode() {
  const gesture = GESTURES[randomInt(GESTURES.length)]!;
  const code = `POPP-${randomInt(1000, 10000)}`;
  return `${code} · ${gesture}`;
}

export function parseGestureCode(v: string | null) {
  if (!v) return null;
  const [code, gesture] = v.split(" · ");
  return { code: code ?? v, gesture: gesture ?? "" };
}
