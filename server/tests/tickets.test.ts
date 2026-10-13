import { describe, expect, test } from "vitest";
import { issueTicket, verifyTicket } from "../tickets.ts";

const NOW = 1_000_000;

describe("create tickets", () => {
  test("a fresh ticket verifies for its own code only", async () => {
    const { ticket, expires } = await issueTicket("secret", "ABCDEF", NOW);
    expect(await verifyTicket("secret", "ABCDEF", ticket, expires, NOW + 1000)).toBe(true);
    expect(await verifyTicket("secret", "ABCDEG", ticket, expires, NOW + 1000)).toBe(false);
  });

  test("wrong secret, tampered expiry and tampered ticket are refused", async () => {
    const { ticket, expires } = await issueTicket("secret", "ABCDEF", NOW);
    expect(await verifyTicket("other", "ABCDEF", ticket, expires, NOW)).toBe(false);
    expect(await verifyTicket("secret", "ABCDEF", ticket, expires + 1, NOW)).toBe(false);
    const flipped = ticket.slice(0, -2) + (ticket.endsWith("AA") ? "BB" : "AA");
    expect(await verifyTicket("secret", "ABCDEF", flipped, expires, NOW)).toBe(false);
  });

  test("an expired ticket is refused", async () => {
    const { ticket, expires } = await issueTicket("secret", "ABCDEF", NOW, 1000);
    expect(await verifyTicket("secret", "ABCDEF", ticket, expires, NOW + 999)).toBe(true);
    expect(await verifyTicket("secret", "ABCDEF", ticket, expires, NOW + 1001)).toBe(false);
  });

  test("garbage input never throws and is refused", async () => {
    expect(await verifyTicket("secret", "ABCDEF", "!!!not base64!!!", NOW + 10, NOW)).toBe(false);
    expect(await verifyTicket("secret", "ABCDEF", "", NOW + 10, NOW)).toBe(false);
    expect(await verifyTicket("", "ABCDEF", "abc", NOW + 10, NOW)).toBe(false);
    expect(await verifyTicket("secret", "ABCDEF", "abc", Number.NaN, NOW)).toBe(false);
  });
});
