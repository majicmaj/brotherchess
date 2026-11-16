import { canMove, bishopGuard, inCheck } from "./movement";
import {
  promote,
  rally,
  nearestSafeSquare,
  rescue,
  revival,
} from "./abilities";
import {
  distance,
  other,
  square,
  validSquare,
  xy,
  type Action,
  type Move,
  type Piece,
  type Position,
  type Side,
} from "./types";
function assertMove(before: Position, move: Move): Piece {
  if (
    !validSquare(move.from) ||
    !validSquare(move.to) ||
    !canMove(before, move.from, move.to)
  )
    throw new Error("That move is not legal.");
  const piece = before.board[move.from];
  if (piece.side !== before.turn) throw new Error("Move your own piece.");
  if (
    move.extra &&
    (!validSquare(move.extra.from) || !validSquare(move.extra.to))
  )
    throw new Error("Invalid rally square.");
  return piece;
}
function victimSquare(p: Position, move: Move, piece: Piece): string {
  if (p.board[move.to]) return move.to;
  if (
    piece.role === "p" &&
    p.enPassant?.target === move.to &&
    move.from[0] !== move.to[0]
  )
    return p.enPassant.pawn;
  return move.to;
}
function executeMove(p: Position, move: Move): void {
  const piece = p.board[move.from];
  delete p.board[move.from];
  const [x, y] = xy(move.from),
    [u, v] = xy(move.to);
  if (piece.role === "k" && Math.abs(x - u) === 2) {
    const rank = move.from[1],
      rookFrom = (u > x ? "h" : "a") + rank,
      rookTo = (u > x ? "f" : "d") + rank;
    p.board[rookTo] = { ...p.board[rookFrom], moved: true };
    delete p.board[rookFrom];
  }
  delete p.enPassant;
  if (piece.role === "p" && x === u && Math.abs(v - y) === 2)
    p.enPassant = { target: square(x, (v + y) / 2)!, pawn: move.to };
  piece.moved = true;
  promote(piece, move.to, move.promotion);
  p.board[move.to] = piece;
}
function power(
  p: Position,
  move: Move,
  piece: Piece,
  friendlyCapture: boolean,
  roll: number,
): boolean {
  const side = piece.side;
  const active = Boolean(move.extra || move.revive || friendlyCapture);
  if (active && p.cooldown[side])
    throw new Error("Your powers are cooling down.");
  if (move.extra) {
    if (
      piece.role !== "k" ||
      distance(move.from, move.to) !== 1 ||
      inCheck(p, side)
    )
      throw new Error(
        "Monkus must make a safe one-square move before rallying.",
      );
    rally(p, move.to, move.extra);
  }
  if (move.revive) {
    if (
      piece.role !== "n" ||
      move.to[1] !== (side === "w" ? "8" : "1") ||
      p.revivalUsed[side]
    )
      throw new Error("BigDoe revives once, on the enemy back rank.");
    revival(p, side, roll);
  }
  if (friendlyCapture)
    p.lastEffect = {
      name: "Tushar · Sacrifice",
      text: "Friendly piece captured.",
    };
  return active;
}
export function positionKey(p: Position): string {
  const roles = "pnbrqk",
    cells: string[] = [],
    rights: string[] = [];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const at = square(x, y)!,
        piece = p.board[at];
      if (!piece) {
        cells.push(".");
        continue;
      }
      const code =
        roles.indexOf(piece.role) +
        (piece.side === "b" ? 6 : 0) +
        (piece.base === "p" && piece.role !== "p" ? 12 : 0);
      cells.push(String.fromCharCode(65 + code));
      if (
        !piece.moved &&
        (piece.role === "k" ||
          piece.role === "r" ||
          (piece.role === "p" && y === (piece.side === "w" ? 1 : 6)))
      )
        rights.push(at);
    }
  const reserve = ["w", "b"].map(
    (side) =>
      p.captured.filter((v) => v.side === side && v.base === "p").length,
  );
  return [
    cells.join(""),
    rights.join(""),
    p.turn,
    p.cooldown.w,
    p.cooldown.b,
    +p.revivalUsed.w,
    +p.revivalUsed.b,
    p.enPassant?.target ?? "-",
    reserve.join(","),
  ].join("|");
}
function clonePosition(p: Position): Position {
  return {
    ...p,
    board: Object.fromEntries(
      Object.entries(p.board).map(([at, piece]) => [at, { ...piece }]),
    ),
    cooldown: { ...p.cooldown },
    revivalUsed: { ...p.revivalUsed },
    captured: [...p.captured],
    history: [...p.history],
    repetitions: { ...p.repetitions },
  };
}
export function finishTurn(
  p: Position,
  actor: Side,
  active: boolean,
  pawnOrCapture: boolean,
  notation: string,
  from: string,
  to: string,
): void {
  p.cooldown[actor] = active
    ? p.cooldownLength[actor]
    : Math.max(0, p.cooldown[actor] - 1);
  p.quietPlies = pawnOrCapture ? 0 : p.quietPlies + 1;
  p.history.push({
    text: notation,
    side: actor,
    ...(p.lastEffect
      ? { ability: p.lastEffect.name, roll: p.lastEffect.roll }
      : {}),
  });
  p.lastMove = [from, to];
  p.turn = other(actor);
  const key = positionKey(p);
  p.repetitions[key] = (p.repetitions[key] ?? 0) + 1;
}
export function transition(
  before: Position,
  action: Action,
  roll = 0,
): Position {
  if (before.result) throw new Error("This game has ended.");
  const p = clonePosition(before);
  delete p.lastEffect;
  const original = assertMove(before, action),
    captureAt = victimSquare(before, action, original),
    victim = before.board[captureAt];
  const guarded = Boolean(
    victim && bishopGuard(before, captureAt, victim.side),
  );
  const piece = p.board[action.from];
  if (victim) {
    delete p.board[captureAt];
    p.captured.push({ ...victim });
  }
  executeMove(p, action);
  const active = power(
    p,
    action,
    original,
    Boolean(victim?.side === original.side),
    roll,
  );
  let notation = `${original.role.toUpperCase()} ${action.from}${victim ? "×" : "–"}${action.to}${action.extra ? ` + ${action.extra.from}–${action.extra.to}` : ""}${action.revive ? " · revive" : ""}`;
  const pawnOrCapture = Boolean(
    victim ||
    original.role === "p" ||
    (action.extra && before.board[action.extra.from]?.role === "p"),
  );
  if (guarded && victim) {
    const to = nearestSafeSquare(p, victim, captureAt, original.side);
    if (to) {
      rescue(p, victim, to);
      notation += ` · saved → ${to}`;
    }
  }
  if (inCheck(p, piece.side)) throw new Error("Your king would be in check.");
  finishTurn(
    p,
    original.side,
    active,
    pawnOrCapture,
    notation,
    action.from,
    action.to,
  );
  return p;
}
