import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createMatch,
  hashToken,
  perform,
  snapshot,
} from "../src/server/session";
import { command } from "../src/server/validation";
import type { Match } from "../src/shared/protocol";
function match(): Match {
  const m = createMatch("ABCDEF", "Alice", "hash-a", "w", false);
  m.seats.b = { name: "Bob", tokenHash: "hash-b" };
  m.started = true;
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
  assert.throws(() => perform(m, move, "b"), /turn/);
  assert.equal(JSON.stringify(m), before);
  const next = perform(m, move, "w");
  assert.equal(next.revision, 1);
  assert.throws(() => perform(next, move, "w"), /changed/);
  assert.equal(JSON.stringify(m), before);
});
test("untimed reconnect snapshots preserve exact state and never expose seat keys", () => {
  const next = perform(match(), move, "w");
  assert.equal(next.position.turn, "b");
  const restored = JSON.parse(JSON.stringify(next)) as Match;
  assert.deepEqual(snapshot(restored, "w"), snapshot(next, "w"));
  const view = JSON.stringify(snapshot(restored, "w"));
  for (const key of ["hash-a", "tokenHash", "clocks", "clockAt"])
    assert.equal(view.includes(key), false);
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
      roll,
    ),
  );
  assert.equal(calls, 0);
});
test("draw offers and resignation remain authorized, revisioned commands", () => {
  const m = perform(match(), { type: "offer-draw", revision: 0 }, "w");
  assert.throws(() => perform(m, { type: "accept-draw", revision: 1 }, "w"));
  const drawn = perform(m, { type: "accept-draw", revision: 1 }, "b");
  assert.equal(drawn.position.result?.winner, null);
  const resigned = perform(match(), { type: "resign", revision: 0 }, "b");
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

test("manual rescue commands are rejected; rescue is part of the capture transaction", () => {
  assert.throws(
    () =>
      command({
        type: "action",
        revision: 0,
        action: { type: "rescue", to: "e4" },
      }),
    /Unknown action/,
  );
});
