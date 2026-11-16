import { canMove, inCheck } from "./movement";
import { neighbors } from "./abilities";
import { positionKey, transition } from "./transitions";
import {
  files,
  type Action,
  type Move,
  type Position,
  type Role,
  type Square,
} from "./types";
export const allSquares = Array.from(
  { length: 64 },
  (_, i) => files[i % 8] + (Math.floor(i / 8) + 1),
);
function accepted(p: Position, action: Action): Position | undefined {
  try {
    return transition(p, action);
  } catch {
    return undefined;
  }
}
function rallyActions(p: Position, move: Move, after: Position): Action[] {
  if (
    p.cooldown[p.turn] ||
    p.board[move.from].role !== "k" ||
    Math.abs(Number(move.from[1]) - Number(move.to[1])) > 1 ||
    Math.abs(files.indexOf(move.from[0]) - files.indexOf(move.to[0])) > 1
  )
    return [];
  const out: Action[] = [];
  for (const from of neighbors(move.to)) {
    const piece = after.board[from];
    if (!piece || piece.side !== p.turn || piece.role === "k") continue;
    for (const to of neighbors(from)) {
      if (after.board[to]) continue;
      out.push(...rallyVariants(p, move, from, to, piece.role));
    }
  }
  return out;
}
function rallyVariants(
  p: Position,
  move: Move,
  from: Square,
  to: Square,
  role: Role,
): Move[] {
  const promotions: (Role | undefined)[] =
    role === "p" && ["1", "8"].includes(to[1])
      ? ["q", "r", "b", "n"]
      : [undefined];
  return promotions
    .map((promotion) => ({
      ...move,
      extra: { from, to, ...(promotion ? { promotion } : {}) },
    }))
    .filter((action) => Boolean(accepted(p, action)));
}
function movesTo(p: Position, from: Square, to: Square): Action[] {
  if (!canMove(p, from, to)) return [];
  const piece = p.board[from];
  const promotions: (Role | undefined)[] =
    piece.role === "p" && ["1", "8"].includes(to[1])
      ? ["q", "r", "b", "n"]
      : [undefined];
  const out: Action[] = [];
  for (const promotion of promotions) {
    const move: Move = {
      type: "move",
      from,
      to,
      ...(promotion ? { promotion } : {}),
    };
    const after = accepted(p, move);
    if (!after) continue;
    out.push(move, ...rallyActions(p, move, after));
    if (
      piece.role === "n" &&
      !p.cooldown[p.turn] &&
      !p.revivalUsed[p.turn] &&
      to[1] === (p.turn === "w" ? "8" : "1")
    )
      out.push({ ...move, revive: true });
  }
  return out;
}
export function legalActions(p: Position): Action[] {
  if (p.result) return [];
  return Object.entries(p.board)
    .filter(([, piece]) => piece.side === p.turn)
    .flatMap(([from]) => allSquares.flatMap((to) => movesTo(p, from, to)));
}
export function adjudicate(p: Position): Position {
  if (p.result) return p;
  if (!legalActions(p).length)
    p.result = {
      winner: inCheck(p, p.turn) ? (p.turn === "w" ? "b" : "w") : null,
      reason: inCheck(p, p.turn) ? "checkmate" : "stalemate",
    };
  else if ((p.repetitions[positionKey(p)] ?? 0) >= 3)
    p.result = { winner: null, reason: "threefold repetition" };
  else if (p.quietPlies >= 100)
    p.result = { winner: null, reason: "fifty-move rule" };
  else if (Object.values(p.board).every((piece) => piece.role === "k"))
    p.result = { winner: null, reason: "bare kings" };
  return p;
}
export function applyAction(p: Position, action: Action, roll = 0): Position {
  return adjudicate(transition(p, action, roll));
}
export function fen(p: Position): string {
  const rows = [];
  for (let y = 7; y >= 0; y--) {
    let line = "",
      empty = 0;
    for (let x = 0; x < 8; x++) {
      const piece = p.board[files[x] + (y + 1)];
      if (!piece) {
        empty++;
        continue;
      }
      if (empty) {
        line += empty;
        empty = 0;
      }
      line += piece.side === "w" ? piece.role.toUpperCase() : piece.role;
    }
    if (empty) line += empty;
    rows.push(line);
  }
  return rows.join("/");
}
