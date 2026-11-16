import assert from "node:assert/strict";
import { test } from "node:test";
import { createPosition, randomLayout } from "../src/rules/setup";
import { applyAction, legalActions, adjudicate } from "../src/rules/legal";
import { transition, positionKey } from "../src/rules/transitions";
import { canMove, hasAura, inCheck } from "../src/rules/movement";
import {
  type Piece,
  type Position,
  type Role,
  type Side,
} from "../src/rules/types";
function add(
  p: Position,
  at: string,
  role: Role,
  side: Side = "w",
  moved = true,
): Piece {
  const piece = {
    id: side + at + role,
    side,
    role,
    base: role,
    home: at,
    moved,
  };
  p.board[at] = piece;
  return piece;
}
function arena(): Position {
  const p = createPosition({ shuffled: false });
  p.board = {};
  add(p, "a1", "k");
  add(p, "h8", "k", "b");
  return p;
}
const move = (from: string, to: string) => ({
  type: "move" as const,
  from,
  to,
});
test("shuffled layouts preserve castling homes, opposite bishops and matching armies", () => {
  for (let i = 0; i < 18; i++) {
    const layout = randomLayout(() => i / 18),
      p = createPosition({ shuffled: true, layout });
    assert.equal(layout[0], "r");
    assert.equal(layout[4], "k");
    assert.equal(layout[7], "r");
    const bishops = layout.flatMap((r, x) => (r === "b" ? [x] : []));
    assert.notEqual(bishops[0] % 2, bishops[1] % 2);
    assert.equal(Object.keys(p.board).length, 32);
    for (const file of "abcdefgh")
      assert.equal(p.board[file + "1"].role, p.board[file + "8"].role);
  }
});
test("ordinary moves reject wrong owners, collisions, king captures and self-check", () => {
  let p = createPosition({ shuffled: false });
  assert.throws(() => transition(p, move("a7", "a6")));
  assert.throws(() => transition(p, move("a1", "a3")));
  p = transition(p, move("e2", "e4"));
  assert.equal(p.turn, "b");
  assert.equal(p.board.e4.role, "p");
  const pinned = arena();
  delete pinned.board.a1;
  add(pinned, "e1", "k");
  add(pinned, "e2", "b");
  add(pinned, "e8", "r", "b");
  assert.throws(() => transition(pinned, move("e2", "f3")), /check/);
  assert.equal(canMove(pinned, "e2", "h8"), false);
});
test("Barb grants a replacement king-style move only immediately left and right", () => {
  const p = arena();
  add(p, "a4", "r");
  add(p, "b4", "p");
  add(p, "b5", "b");
  assert.equal(hasAura(p, "b4"), true);
  assert.equal(hasAura(p, "b5"), false);
  assert.equal(canMove(p, "b4", "b3"), true);
  assert.equal(canMove(p, "b4", "b6"), false);
  const after = transition(p, move("a4", "a5"));
  assert.equal(hasAura(after, "b4"), false);
  assert.equal(canMove(after, "b4", "b3"), false);
});
test("Monkus rallies one adjacent non-king piece without captures and spends the shared cooldown", () => {
  const p = arena();
  add(p, "b2", "n");
  const result = transition(p, {
    ...move("a1", "a2"),
    extra: { from: "b2", to: "c2" },
  });
  assert.equal(result.board.a2.role, "k");
  assert.equal(result.board.c2.role, "n");
  assert.equal(result.cooldown.w, 2);
  assert.equal(p.board.b2.role, "n");
  assert.equal(p.board.a1.moved, true);
  assert.throws(() =>
    transition(p, { ...move("a1", "a2"), extra: { from: "b2", to: "e2" } }),
  );
  const blocked = structuredClone(p);
  add(blocked, "c2", "p", "b");
  assert.throws(() =>
    transition(blocked, {
      ...move("a1", "a2"),
      extra: { from: "b2", to: "c2" },
    }),
  );
  const hot = structuredClone(p);
  hot.cooldown.w = 1;
  assert.throws(
    () =>
      transition(hot, { ...move("a1", "a2"), extra: { from: "b2", to: "c2" } }),
    /cooling/,
  );
});
test("Monkus cannot move into check and then use the rally to repair it", () => {
  const p = arena();
  delete p.board.a1;
  add(p, "e1", "k");
  add(p, "e8", "r", "b");
  add(p, "f2", "b");
  assert.throws(
    () =>
      transition(p, { ...move("e1", "e2"), extra: { from: "f2", to: "e3" } }),
    /safe/,
  );
});
test("Tushar can sacrifice friendly pieces except Monkus", () => {
  const p = arena();
  add(p, "d4", "q");
  const victim = add(p, "d5", "n");
  const result = transition(p, move("d4", "d5"));
  assert.equal(result.board.d5.role, "q");
  assert.ok(result.captured.some((v) => v.id === victim.id));
  assert.equal(result.cooldown.w, 2);
  assert.equal(canMove(p, "d4", "a1"), false);
  p.cooldown.w = 1;
  assert.equal(canMove(p, "d4", "d5"), false);
});
test("Tushar and Ethan combo relocates the protected sacrifice, then uses the save exactly once", () => {
  const p = arena();
  add(p, "d4", "q");
  const victim = add(p, "d5", "n");
  add(p, "c4", "b");
  const saved = transition(p, move("d4", "d5"));
  assert.equal(saved.board.c5.id, victim.id);
  assert.equal(saved.board.d5.role, "q");
  assert.equal(saved.rescueUsed.w, true);
  assert.equal(saved.cooldown.w, 2);
  assert.equal(saved.turn, "b");
  assert.equal(saved.captured.length, 0);
  saved.turn = "w";
  saved.cooldown.w = 0;
  const twice = transition(saved, move("d5", "c5"));
  assert.equal(twice.captured.length, 1);
});
test("enemy capture automatically rescues to the nearest safe square without a second action", () => {
  const p = arena();
  p.turn = "b";
  add(p, "d8", "r", "b");
  const victim = add(p, "d5", "n");
  add(p, "c4", "b");
  const saved = transition(p, move("d8", "d5"));
  assert.equal(saved.board.d5.side, "b");
  assert.equal(saved.board.c6.id, victim.id);
  assert.equal(saved.rescueUsed.w, true);
  assert.equal(saved.turn, "w");
  assert.equal(saved.history.length, 1);
  const reordered = {
    ...p,
    board: Object.fromEntries(Object.entries(p.board).reverse()),
  };
  assert.equal(transition(reordered, move("d8", "d5")).board.c6.id, victim.id);
});
test("rescue prefers a safe orthogonal square over a diagonal and preserves king safety", () => {
  const p = arena();
  add(p, "d4", "q");
  const victim = add(p, "d5", "n");
  add(p, "c4", "b");
  add(p, "c5", "p");
  const saved = transition(p, move("d4", "d5"));
  assert.equal(saved.board.d4.id, victim.id);
  assert.equal(inCheck(saved, "w"), false);
  assert.equal(inCheck(saved, "b"), false);
});
test("a queen attacks every adjacent rescue square, so the victim dies without spending a save", () => {
  const p = arena();
  p.turn = "b";
  add(p, "d8", "q", "b");
  add(p, "d5", "n");
  add(p, "c4", "b");
  const result = transition(p, move("d8", "d5"));
  assert.equal(result.rescueUsed.w, false);
  assert.equal(result.captured.length, 1);
});
test("BigDoe survives and restores only captured pawns, bounded by the roll and empty home squares", () => {
  const p = arena();
  add(p, "b6", "n");
  add(p, "b2", "p");
  p.captured = ["a2", "c2", "d2"].map((at) => ({
    id: "dead" + at,
    side: "w",
    role: "p",
    base: "p",
    home: at,
    moved: true,
  }));
  p.captured.push({
    id: "deadQueen",
    side: "w",
    role: "q",
    base: "q",
    home: "d1",
    moved: true,
  });
  const result = transition(p, { ...move("b6", "c8"), revive: true }, 5);
  assert.equal(result.board.c8.role, "n");
  assert.equal(result.revivalUsed.w, true);
  assert.equal(result.cooldown.w, 2);
  assert.equal(
    Object.values(result.board).filter((v) => v.role === "p").length,
    4,
  );
  assert.equal(result.captured.length, 1);
  assert.equal(result.captured[0].role, "q");
  assert.equal(
    new Set(Object.values(result.board).map((v) => v.id)).size,
    Object.keys(result.board).length,
  );
});
test("zero revival rolls spend the single charge; captured promoted pawns return as pawns", () => {
  const p = arena();
  add(p, "b6", "n");
  p.captured = [
    {
      id: "promoted",
      role: "q",
      base: "p",
      side: "w",
      home: "a2",
      moved: true,
    },
  ];
  const zero = transition(p, { ...move("b6", "c8"), revive: true }, 0);
  assert.equal(zero.revivalUsed.w, true);
  assert.equal(zero.captured.length, 1);
  const one = transition(p, { ...move("b6", "c8"), revive: true }, 1);
  assert.equal(one.board.a2.role, "p");
  assert.equal(one.board.a2.moved, false);
  p.revivalUsed.w = true;
  assert.throws(
    () => transition(p, { ...move("b6", "c8"), revive: true }, 5),
    /once/,
  );
});
test("castling preserves the rook move and rejects attacked transit squares", () => {
  const p = arena();
  delete p.board.a1;
  delete p.board.h8;
  add(p, "e1", "k", "w", false);
  add(p, "h1", "r", "w", false);
  add(p, "a8", "k", "b");
  const result = transition(p, move("e1", "g1"));
  assert.equal(result.board.g1.role, "k");
  assert.equal(result.board.f1.role, "r");
  assert.equal(result.board.f1.moved, true);
  add(p, "f8", "r", "b");
  assert.throws(() => transition(p, move("e1", "g1")));
});
test("en passant captures the correct pawn and allows its bishop-protected rescue", () => {
  const p = arena();
  p.turn = "b";
  add(p, "e5", "p");
  add(p, "d7", "p", "b", false);
  add(p, "f7", "b", "b");
  const double = transition(p, move("d7", "d5"));
  assert.equal(double.enPassant?.target, "d6");
  const captured = transition(double, move("e5", "d6"));
  assert.equal(captured.board.d5, undefined);
  assert.equal(captured.board.d6.side, "w");
  assert.equal(captured.board.c5.role, "p");
  assert.equal(captured.board.c5.side, "b");
  assert.equal(captured.rescueUsed.b, true);
  assert.equal(captured.enPassant, undefined);
});
test("checkmate uses variant moves and repetition distinguishes remaining charges", () => {
  let p = createPosition({ shuffled: false });
  for (const [a, b] of [
    ["f2", "f3"],
    ["e7", "e5"],
    ["g2", "g4"],
    ["d8", "h4"],
  ])
    p = applyAction(p, move(a, b));
  assert.equal(p.result, undefined);
  assert.ok(
    legalActions(p).some(
      (a) => a.type === "move" && a.from === "g1" && a.to === "f2",
    ),
  );
  const mate = arena();
  delete mate.board.a1;
  add(mate, "f6", "k");
  add(mate, "g7", "q");
  mate.turn = "b";
  adjudicate(mate);
  assert.equal(mate.result?.reason, "checkmate");
  assert.equal(mate.result?.winner, "w");
  const fresh = createPosition({ shuffled: false }),
    key = positionKey(fresh);
  fresh.rescueUsed.w = true;
  assert.notEqual(positionKey(fresh), key);
});
test("deterministic legal play preserves kings, immutability and unique piece identities", () => {
  let p = createPosition({ shuffled: false });
  for (let i = 0; i < 48 && !p.result; i++) {
    const actions = legalActions(p),
      action = actions[(i * 17) % actions.length],
      before = JSON.stringify(p),
      actor = p.turn;
    const next = applyAction(p, action, i % 6);
    assert.equal(JSON.stringify(p), before);
    assert.equal(inCheck(next, actor), false);
    const pieces = [...Object.values(next.board), ...next.captured];
    assert.equal(new Set(pieces.map((v) => v.id)).size, pieces.length);
    assert.equal(pieces.filter((v) => v.role === "k").length, 2);
    p = next;
  }
});

test("ordinary and rallied promotions preserve pawn identity and offer all four promotion roles", () => {
  const p = arena();
  const pawn = add(p, "b7", "p");
  const ordinary = legalActions(p).filter(
    (a) => a.type === "move" && a.from === "b7" && a.to === "b8",
  );
  assert.equal(ordinary.length, 4);
  const knight = transition(p, {
    type: "move",
    from: "b7",
    to: "b8",
    promotion: "n",
  });
  assert.equal(knight.board.b8.role, "n");
  assert.equal(knight.board.b8.base, "p");
  assert.equal(knight.board.b8.id, pawn.id);
  const rallied = arena();
  delete rallied.board.a1;
  add(rallied, "b6", "k");
  add(rallied, "c7", "p");
  const choices = legalActions(rallied).filter(
    (a) =>
      a.type === "move" &&
      a.from === "b6" &&
      a.to === "b7" &&
      a.extra?.from === "c7" &&
      a.extra.to === "c8",
  );
  assert.equal(choices.length, 4);
});
