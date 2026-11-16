import assert from "node:assert/strict";
import { test } from "node:test";
import { createMatch, perform, snapshot } from "../src/server/session";
import { upgradeMatch } from "../src/server/upgrade";
test("old timed rooms retain seats and board, retire clocks, and remain playable", () => {
  const m = createMatch("ABCDEF", "Alice", "hash-a", "w", false);
  m.started = true;
  m.seats.b = { name: "Bob", tokenHash: "hash-b" };
  const legacy = {
    ...m,
    clocks: { w: 0, b: 0 },
    clockSince: 1,
    increment: 2000,
  };
  const next = upgradeMatch(legacy);
  assert.deepEqual(next.seats, m.seats);
  assert.deepEqual(next.position, m.position);
  assert.equal("clocks" in next, false);
  assert.equal("clockSince" in next, false);
  assert.equal("increment" in next, false);
  const played = perform(
    next,
    {
      type: "action",
      revision: 0,
      action: { type: "move", from: "e2", to: "e4" },
    },
    "w",
  );
  assert.equal(played.position.board.e4.role, "p");
  assert.equal(played.position.result, undefined);
});
test("an old pending rescue completes automatically exactly once during recovery", () => {
  const m = createMatch("ABCDEF", "Alice", "hash-a", "w", false);
  const pawn = m.position.board.e2;
  const queen = m.position.board.d1;
  delete m.position.board.d1;
  m.position.board.e2 = { ...queen, moved: true };
  m.position.captured.push(pawn);
  const legacy = {
    ...m,
    position: {
      ...m.position,
      pending: {
        piece: pawn,
        origin: "e2",
        actor: "w" as const,
        pawnOrCapture: true,
        notation: "Q d1×e2",
        from: "d1",
        to: "e2",
      },
    },
  };
  const original = JSON.stringify(legacy),
    next = upgradeMatch(legacy);
  assert.equal(JSON.stringify(legacy), original);
  assert.equal(next.revision, 1);
  assert.equal(next.position.turn, "b");
  assert.equal(next.position.history.length, 1);
  assert.equal(Object.keys(next.position.board).length, 32);
  assert.equal(next.position.board.e3.id, pawn.id);
  assert.equal(JSON.stringify(snapshot(next)).includes('"pending"'), false);
  assert.deepEqual(upgradeMatch(next), next);
});

test("old cooldown and revival limits are removed without losing the game", () => {
  const m = createMatch("ABCDEF", "Alice", "hash-a", "w", false);
  const old = {
    ...m,
    position: {
      ...m.position,
      cooldown: { w: 2, b: 3 },
      cooldownLength: { w: 2, b: 3 },
      revivalUsed: { w: true, b: true },
    },
  };
  const next = upgradeMatch(old);
  assert.deepEqual(next.position.board, m.position.board);
  assert.deepEqual(next.seats, m.seats);
  assert.deepEqual(next.position.history, m.position.history);
  for (const key of ["cooldown", "cooldownLength", "revivalUsed"])
    assert.equal(key in next.position, false);
  assert.deepEqual(upgradeMatch(next), next);
});
