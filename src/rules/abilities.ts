import { attacked, inCheck } from "./movement";
import {
  distance,
  files,
  other,
  square,
  xy,
  type Piece,
  type Position,
  type Role,
  type Side,
  type Square,
  type Step,
} from "./types";
const promotions: Role[] = ["q", "r", "b", "n"];
export function promote(piece: Piece, to: Square, choice?: Role): void {
  if (piece.role !== "p" || !["1", "8"].includes(to[1])) return;
  const role = choice ?? "q";
  if (!promotions.includes(role))
    throw new Error("Choose a queen, rook, bishop or knight.");
  piece.role = role;
}
export function neighbors(at: Square): Square[] {
  const [x, y] = xy(at),
    out: Square[] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      const next = square(x + dx, y + dy);
      if (next && (dx || dy)) out.push(next);
    }
  return out;
}
export function rally(p: Position, king: Square, step: Step): void {
  const piece = p.board[step.from];
  if (
    !piece ||
    piece.side !== p.turn ||
    piece.role === "k" ||
    distance(step.from, king) !== 1
  )
    throw new Error("Rally one piece beside Monkus.");
  if (distance(step.from, step.to) !== 1 || p.board[step.to])
    throw new Error("Rally is a one-square move to an empty square.");
  delete p.board[step.from];
  piece.moved = true;
  promote(piece, step.to, step.promotion);
  p.board[step.to] = piece;
  p.lastEffect = {
    name: "Motivational Wank",
    text: "The pawn does the work. Monkus takes the credit.",
  };
}
export function revival(p: Position, side: Side, count: number): number {
  const available = [...files]
    .map((f) => f + (side === "w" ? "2" : "7"))
    .filter((at) => !p.board[at]);
  const dead = p.captured.filter(
    (piece) => piece.side === side && piece.base === "p",
  );
  const amount = Math.min(count, available.length, dead.length);
  for (let i = 0; i < amount; i++) {
    const pawn = dead[i];
    p.board[available[i]] = { ...pawn, role: "p", moved: false };
    p.captured = p.captured.filter((x) => x.id !== pawn.id);
  }
  p.revivalUsed[side] = true;
  p.lastEffect = {
    name: "Please Join VC",
    roll: count,
    text: amount
      ? `BigDoe revived ${amount} pawn${amount === 1 ? "" : "s"}. Someone finally joined the fucking call.`
      : "BigDoe pinged everyone. Nobody fucking came.",
  };
  return amount;
}
export function rescueOptions(
  p: Position,
  piece: Piece,
  origin: Square,
  actor: Side,
): Square[] {
  return neighbors(origin).filter((at) => {
    if (p.board[at] || (piece.role === "p" && ["1", "8"].includes(at[1])))
      return false;
    const probe = {
      ...p,
      board: { ...p.board, [at]: { ...piece, moved: true } },
    };
    return !attacked(probe, at, other(piece.side)) && !inCheck(probe, actor);
  });
}
export function restore(p: Position, to: Square): void {
  const pending = p.pending;
  if (!pending || !pending.options.includes(to))
    throw new Error("Choose a highlighted safe square.");
  p.board[to] = { ...pending.piece, moved: true };
  p.captured = p.captured.filter((piece) => piece.id !== pending.piece.id);
  p.rescueUsed[pending.owner] = true;
  p.lastEffect = {
    name: "Moving the Fucking Goalposts",
    text: "Your capture was correct. Apparently you misunderstood his position.",
  };
  if (p.enPassant?.target === to) delete p.enPassant;
}
