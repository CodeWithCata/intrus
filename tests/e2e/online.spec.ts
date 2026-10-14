/**
 * Online play with three real browser contexts (three phones): the host creates a room, two players join through the
 * invitation link, a round starts, and each phone must see only its own role. Needs the whole stack, see playwright.config.ts.
 * Selectors follow the Romanian UI texts of OnlineSheet.svelte / OnlineScreen.svelte. NOT VERIFIED when written.
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

interface Phone {
  ctx: BrowserContext;
  page: Page;
  frames: string[];
}

/**
 * A fresh "phone": skips the intro and records every WebSocket frame it receives.
 * The app only restores a saved game that has at least 3 players (see stores/settings.svelte.ts), so `seen: true` alone
 * would be ignored and the intro would show.
 */
async function phone(browser: Browser): Promise<Phone> {
  const ctx = await browser.newContext({ locale: "ro-RO" });
  await ctx.addInitScript(() => {
    try {
      if (!localStorage.getItem("intrus.v6")) {
        const players = [0, 1, 2].map(a => ({ n: "", a }));
        localStorage.setItem("intrus.v6", JSON.stringify({ seen: true, players }));
      }
    } catch {
      /* storage blocked */
    }
  });
  const page = await ctx.newPage();
  const frames: string[] = [];
  page.on("websocket", ws => ws.on("framereceived", f => frames.push(String(f.payload))));
  return { ctx, page, frames };
}

const sheet = (p: Page) => p.getByRole("dialog");

/**
 * Closes the phones one after the other. Closing three traced contexts at once sometimes failed on Windows with
 * ENOENT on a `.trace` recording file, AFTER every assertion of the test had passed. A teardown error must not
 * fail a test whose checks are done, so it is only logged.
 */
async function closeAll(phones: Phone[]): Promise<void> {
  for (const p of phones) {
    try {
      await p.ctx.close();
    } catch (e) {
      console.warn("context close failed (ignored):", e instanceof Error ? e.message.split("\n")[0] : e);
    }
  }
}

async function createRoom(host: Phone, name: string): Promise<string> {
  await host.page.goto("/");
  await host.page.getByRole("button", { name: /Joacă online/ }).click();
  await sheet(host.page).getByLabel("Numele tău").fill(name);
  await sheet(host.page).getByRole("button", { name: "Creează camera" }).click();
  // The code arrives from the server after the ticket and the WebSocket handshake: wait for it, do not read it at once.
  const codeBox = sheet(host.page).locator(".code");
  await expect(codeBox).toHaveText(/^\s*[A-HJ-NP-Z2-9]{6}\s*$/);
  const code = (await codeBox.innerText()).trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  return code;
}

async function joinByLink(p: Phone, code: string, name: string): Promise<void> {
  await p.page.goto(`/online/${code}`);
  await expect(sheet(p.page).getByLabel("Cod cameră")).toHaveValue(code);
  await sheet(p.page).getByLabel("Numele tău").fill(name);
  await sheet(p.page).getByRole("button", { name: "Intră în cameră" }).click();
  await expect(sheet(p.page).getByText("Așteptăm ca gazda să înceapă runda")).toBeVisible();
}

async function startRound(host: Phone, phones: Phone[]): Promise<void> {
  await expect(sheet(host.page).getByText("În cameră · 3")).toBeVisible();
  await sheet(host.page).getByRole("button", { name: "Începe runda" }).click();
  for (const p of phones) await expect(p.page.locator("#card")).toBeVisible();
}

/** Reads the role card of a phone: hold the card down (like a finger), read the face, let go. Secret word (crew) or null (intruder). */
async function readRole(p: Phone): Promise<{ intruder: boolean; word: string | null }> {
  // A hold can be lost when the card is re-rendered under the finger (e.g. right after a reload, when the role and the
  // state arrive after the first paint): the new card never sees the pointerdown. So every attempt is bounded (the
  // default wait has NO timeout, which used to hang the test until the 90 s test timeout) and a new hold is tried.
  let role: { intruder: boolean; word: string | null } | undefined;
  await expect(async () => {
    const card = p.page.locator("#card");
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    if (!box) throw new Error("no card on screen");
    await p.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.page.mouse.down();
    try {
      const face = p.page.locator("#face .stamp, #face .secret").first();
      await face.waitFor({ timeout: 3_000 });
      if (await p.page.locator("#face .stamp").isVisible()) role = { intruder: true, word: null };
      else role = { intruder: false, word: (await p.page.locator("#face .secret").innerText()).trim() };
    } finally {
      await p.page.mouse.up();
    }
  }).toPass({ timeout: 20_000 });
  if (!role) throw new Error("role not read");
  return role;
}

test("three phones play a round; everyone sees only their own role", async ({ browser }) => {
  const host = await phone(browser);
  const bob = await phone(browser);
  const cara = await phone(browser);
  const all = [host, bob, cara];
  try {
    const code = await createRoom(host, "Ana");
    await joinByLink(bob, code, "Bob");
    await joinByLink(cara, code, "Cara");
    await startRound(host, all);

    const roles = await Promise.all(all.map(readRole));
    expect(roles.filter(r => r.intruder)).toHaveLength(1);
    const words = new Set(roles.filter(r => !r.intruder).map(r => r.word));
    expect(words.size).toBe(1);
    const word = [...words][0] as string;
    expect(word.length).toBeGreaterThan(0);

    // The intruder's phone never received the word, in any frame, from the server.
    const intruder = all[roles.findIndex(r => r.intruder)];
    expect(intruder.frames.join("\n").includes(word)).toBe(false);
    // And nobody has received the list of intruders yet: it only comes when the host reveals.
    for (const p of all) {
      expect(p.frames.join("\n").includes("imposterIds")).toBe(false);
      expect(p.frames.join("\n").includes("intruderIds")).toBe(false);
    }

    // The host starts the discussion: every phone gets the same starter (and spins the same wheel).
    await host.page.getByRole("button", { name: "Începe discuția" }).click();
    for (const p of all) await expect(p.page.locator(".starter")).toBeVisible({ timeout: 15_000 }); // it appears when the wheel has stopped
    const starters = await Promise.all(all.map(p => p.page.locator(".starter").innerText()));
    expect(new Set(starters.map(x => x.trim())).size).toBe(1);
    expect(intruder.frames.join("\n").includes(word)).toBe(false);

    // Secret vote: everyone picks someone; the server shows the tally by itself once everyone has voted.
    await host.page.getByRole("button", { name: "Trecem la vot" }).click();
    for (const p of all) {
      await p.page.locator(".suspect").first().click();
    }
    await expect(host.page.locator("ul .score").first()).toBeVisible();

    // Host reveals the intruders: only now do the word and the intruder list reach the phones.
    await host.page.getByRole("button", { name: "Dezvăluie intrusul" }).click();
    for (const p of all) await expect(p.page.locator(".wordtag")).toHaveText(word);
    expect(intruder.frames.join("\n").includes("intruderIds")).toBe(true);

    // Host ends the round: everybody sees the scoreboard, then the next round returns everyone to the lobby.
    // Two outcomes start with "Prins" (caught +1 / caught but guessed the word): the first is the normal one.
    await host.page
      .getByRole("button", { name: /^Prins/ })
      .first()
      .click();
    for (const p of all) await expect(p.page.getByRole("heading", { name: "Clasament" })).toBeVisible();
    await host.page.getByRole("button", { name: "Runda următoare" }).click();
    await expect(sheet(host.page).getByRole("button", { name: "Începe runda" })).toBeVisible();
    await expect(sheet(bob.page).getByText("Așteptăm ca gazda să înceapă runda")).toBeVisible();
  } finally {
    await closeAll(all);
  }
});

test("a phone that reloads mid-round gets its seat and its role back", async ({ browser }) => {
  const host = await phone(browser);
  const bob = await phone(browser);
  const cara = await phone(browser);
  const all = [host, bob, cara];
  try {
    const code = await createRoom(host, "Ana");
    await joinByLink(bob, code, "Bob");
    await joinByLink(cara, code, "Cara");
    await startRound(host, all);
    const before = await readRole(bob);

    await bob.page.reload();
    await expect(bob.page.locator("#card")).toBeVisible();
    const after = await readRole(bob);
    expect(after).toEqual(before);
    await expect(host.page.getByText("Camera")).toBeVisible();
  } finally {
    await closeAll(all);
  }
});
