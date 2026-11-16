import assert from "node:assert/strict";
import { test } from "node:test";
import { createPosition } from "../src/rules/setup";
import { transition } from "../src/rules/transitions";
import { sacrificePreview } from "../src/client/sacrifice";
import { upgradeMatch } from "../src/server/upgrade";
import { createMatch } from "../src/server/session";
import type { Move } from "../src/rules/types";
test("reported game: Ethan saves a second guarded pawn and confirmation names the actual square", () => {
  let p = createPosition({
    shuffled: true,
    layout: ["r", "n", "b", "b", "k", "q", "n", "r"],
  });
  const moves: Move[] = [
    { type: "move", from: "f1", to: "e2" },
    { type: "move", from: "g7", to: "g6" },
    { type: "move", from: "d2", to: "d4" },
    { type: "move", from: "d7", to: "d5" },
    { type: "move", from: "c2", to: "c3" },
    { type: "move", from: "e7", to: "e6" },
    { type: "move", from: "d1", to: "a4" },
    { type: "move", from: "b8", to: "d7" },
    { type: "move", from: "a4", to: "d7" },
    { type: "move", from: "e8", to: "d7", extra: { from: "d6", to: "c6" } },
  ];
  for (const move of moves) p = transition(p, move);
  const move: Move = { type: "move", from: "e2", to: "e3" },
    pawn = p.board.e3,
    preview = sacrificePreview(p, move);
  assert.equal(preview.title, "Tushar + Ethan");
  assert.equal(preview.destination, "d3");
  assert.equal(preview.confirm, "Shove to D3");
  assert.equal(preview.message, "Shove Pawn to D3. Tushar takes E3.");
  const after = transition(p, move);
  assert.equal(after.board.d3.id, pawn.id);
  assert.equal(after.board.e3.role, "q");
  assert.equal(
    after.captured.some((v) => v.id === pawn.id),
    false,
  );
});
test("confirmation warns of loss when Ethan is absent or every safe square is blocked", () => {
  const move: Move = { type: "move", from: "d1", to: "e2" };
  const p = createPosition({ shuffled: false });
  delete p.board.f1;
  assert.match(sacrificePreview(p, move).message, /isn’t guarding/);
  assert.equal(sacrificePreview(p, move).confirm, "Sacrifice Pawn");
  p.board.f1 = { ...p.board.c1, id: "extra-bishop", home: "f1" };
  for (const at of ["d3", "e3", "f3"]) p.board[at] = { ...p.board.a2, id: at };
  // The vacated queen square is attacked, so it is not an escape either.
  p.board.b2 = { ...p.board.b8, id: "attacker" };
  assert.match(sacrificePreview(p, move).message, /No safe square/);
});
test("stored spent-save flags no longer disable Ethan in existing rooms", () => {
  const m = createMatch("ABCDEF", "Alice", "hash", "w", false);
  const legacy = {
    ...m,
    position: { ...m.position, rescueUsed: { w: true, b: true } },
  };
  const next = upgradeMatch(legacy);
  assert.equal("rescueUsed" in next.position, false);
  assert.equal(
    sacrificePreview(next.position, { type: "move", from: "d1", to: "e2" })
      .destination,
    "e3",
  );
  assert.deepEqual(upgradeMatch(next), next);
});
