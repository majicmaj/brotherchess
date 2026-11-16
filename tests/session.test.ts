import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createMatch,
  hashToken,
  liveClocks,
  perform,
  snapshot,
} from "../src/server/session";
import { command } from "../src/server/validation";
import type { Match } from "../src/shared/protocol";
const now = 100_000;
function match(): Match {
  const m = createMatch("ABCDEF", "Alice", "hash-a", "w", 10, false);
  m.seats.b = { name: "Bob", tokenHash: "hash-b" };
  m.started = true;
  m.clockSince = now;
  return m;
}
const move = {
  type: "action" as const,
  revision: 0,
  action: { type: "move" as const, from: "e2", to: "e4" },
};
test("only the actor may move and stale revisions never mutate stored state", () => {
  const m = match(),
    before = JSON.stringify(m);
  assert.throws(() => perform(m, move, "b", now + 1000), /turn/);
  assert.equal(JSON.stringify(m), before);
  const next = perform(m, move, "w", now + 1000);
  assert.equal(next.revision, 1);
  assert.throws(() => perform(next, move, "w", now + 2000), /changed/);
  assert.equal(JSON.stringify(m), before);
});
test("clocks, increments and reconnect snapshots preserve exact persisted turn state", () => {
  const next = perform(match(), move, "w", now + 3000);
  assert.equal(next.clocks.w, 599000);
  assert.equal(next.position.turn, "b");
  const restored = JSON.parse(JSON.stringify(next)) as Match;
  assert.deepEqual(
    snapshot(restored, now + 5000, "w"),
    snapshot(next, now + 5000, "w"),
  );
  assert.equal(liveClocks(restored, now + 5000).b, 598000);
  const view = JSON.stringify(snapshot(restored, now + 5000, "w"));
  assert.equal(view.includes("hash-a"), false);
  assert.equal(view.includes("tokenHash"), false);
});
test("invalid revival requests cannot consume server dice", () => {
  let calls = 0;
  const roll = () => {
    calls++;
    return 5;
  };
  assert.throws(() =>
    perform(
      match(),
      { ...move, action: { ...move.action, revive: true } },
      "w",
      now + 1000,
      roll,
    ),
  );
  assert.equal(calls, 0);
});
test("timeout ends the game before accepting a late action and cannot be reset by reconnecting", () => {
  const m = match();
  m.clocks.w = 1000;
  const ended = perform(m, move, "w", now + 1001);
  assert.equal(ended.position.result?.reason, "time");
  assert.equal(ended.position.result?.winner, "b");
  assert.equal(ended.position.board.e2.role, "p");
});
test("draw offers and resignation remain authorized, revisioned commands", () => {
  const m = perform(
    match(),
    { type: "offer-draw", revision: 0 },
    "w",
    now + 1000,
  );
  assert.throws(() =>
    perform(m, { type: "accept-draw", revision: 1 }, "w", now + 1100),
  );
  const drawn = perform(
    m,
    { type: "accept-draw", revision: 1 },
    "b",
    now + 1200,
  );
  assert.equal(drawn.position.result?.winner, null);
  const resigned = perform(
    match(),
    { type: "resign", revision: 0 },
    "b",
    now + 1000,
  );
  assert.equal(resigned.position.result?.winner, "w");
});
test("protocol strips untrusted state and rejects malformed action, revision and promotion values", async () => {
  assert.throws(() =>
    command({ type: "action", revision: -1, action: move.action }),
  );
  assert.throws(() =>
    command({
      type: "action",
      revision: 0,
      action: { ...move.action, promotion: "k" },
    }),
  );
  assert.deepEqual(command({ ...move, board: "cheat", dice: 5 }), move);
  assert.notEqual(await hashToken("first"), await hashToken("second"));
});

test("a pending enemy rescue charges its owner and gives the capture actor exactly one increment", () => {
  const m = match();
  m.position.board = {
    a1: { id: "wk", side: "w", role: "k", base: "k", home: "a1", moved: true },
    h8: { id: "bk", side: "b", role: "k", base: "k", home: "h8", moved: true },
    d8: { id: "br", side: "b", role: "r", base: "r", home: "d8", moved: true },
    d5: { id: "wn", side: "w", role: "n", base: "n", home: "d5", moved: true },
    c4: { id: "wb", side: "w", role: "b", base: "b", home: "c4", moved: true },
  };
  m.position.turn = "b";
  const waiting = perform(
    m,
    {
      type: "action",
      revision: 0,
      action: { type: "move", from: "d8", to: "d5" },
    },
    "b",
    now + 1000,
  );
  assert.equal(waiting.position.pending?.owner, "w");
  assert.equal(waiting.clocks.b, 599000);
  assert.throws(() =>
    perform(
      waiting,
      { type: "action", revision: 1, action: { type: "rescue", to: "e4" } },
      "b",
      now + 2000,
    ),
  );
  const restored = JSON.parse(JSON.stringify(waiting)) as Match;
  const saved = perform(
    restored,
    { type: "action", revision: 1, action: { type: "rescue", to: "e4" } },
    "w",
    now + 3000,
  );
  assert.equal(saved.clocks.w, 598000);
  assert.equal(saved.clocks.b, 601000);
  assert.equal(saved.position.turn, "w");
  assert.equal(saved.position.pending, undefined);
});
