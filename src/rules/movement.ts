import {
  distance,
  other,
  square,
  xy,
  type Piece,
  type Position,
  type Side,
  type Square,
} from "./types";
export function hasAura(p: Position, at: Square): boolean {
  const piece = p.board[at];
  if (!piece || piece.role === "k") return false;
  const [x, y] = xy(at);
  return [-1, 1].some((dx) => {
    const neighbor = p.board[square(x + dx, y) ?? ""];
    return neighbor?.role === "r" && neighbor.side === piece.side;
  });
}
export function clearPath(p: Position, from: Square, to: Square): boolean {
  const [x, y] = xy(from),
    [u, v] = xy(to),
    dx = Math.sign(u - x),
    dy = Math.sign(v - y);
  const length = Math.max(Math.abs(u - x), Math.abs(v - y));
  for (let i = 1; i < length; i++)
    if (p.board[square(x + dx * i, y + dy * i) ?? ""]) return false;
  return true;
}
function usualAttack(
  p: Position,
  piece: Piece,
  from: Square,
  to: Square,
): boolean {
  const [x, y] = xy(from),
    [u, v] = xy(to),
    dx = Math.abs(x - u),
    dy = Math.abs(y - v);
  if (piece.role === "p")
    return dx === 1 && v - y === (piece.side === "w" ? 1 : -1);
  if (piece.role === "n") return dx * dy === 2;
  if (piece.role === "k") return Math.max(dx, dy) === 1;
  const diagonal = dx === dy,
    straight = dx === 0 || dy === 0;
  const aligned =
    piece.role === "b"
      ? diagonal
      : piece.role === "r"
        ? straight
        : diagonal || straight;
  return aligned && clearPath(p, from, to);
}
export function attacks(p: Position, from: Square, to: Square): boolean {
  const piece = p.board[from];
  if (!piece || from === to) return false;
  return (
    (hasAura(p, from) && distance(from, to) === 1) ||
    usualAttack(p, piece, from, to)
  );
}
export function attacked(p: Position, at: Square, by: Side): boolean {
  return Object.entries(p.board).some(
    ([from, piece]) => piece.side === by && attacks(p, from, at),
  );
}
export function kingSquare(p: Position, side: Side): Square | undefined {
  return Object.entries(p.board).find(
    ([, v]) => v.role === "k" && v.side === side,
  )?.[0];
}
export function inCheck(p: Position, side: Side): boolean {
  const king = kingSquare(p, side);
  return !king || attacked(p, king, other(side));
}
export function bishopGuard(p: Position, at: Square, side: Side): boolean {
  return Object.entries(p.board).some(
    ([from, piece]) =>
      piece.side === side && piece.role === "b" && attacks(p, from, at),
  );
}
function pawnMove(
  p: Position,
  from: Square,
  to: Square,
  piece: Piece,
): boolean {
  const [x, y] = xy(from),
    [u, v] = xy(to),
    forward = piece.side === "w" ? 1 : -1;
  const target = p.board[to];
  if (x === u && !target) {
    if (v - y === forward) return true;
    return (
      !piece.moved &&
      y === (piece.side === "w" ? 1 : 6) &&
      v - y === 2 * forward &&
      !p.board[square(x, y + forward) ?? ""]
    );
  }
  if (Math.abs(x - u) !== 1 || v - y !== forward) return false;
  if (target) return target.side !== piece.side;
  const ep = p.enPassant;
  if (ep?.target !== to) return false;
  const victim = p.board[ep.pawn];
  return victim?.role === "p" && victim.side !== piece.side;
}
export function canCastle(p: Position, from: Square, to: Square): boolean {
  const king = p.board[from];
  if (!king || king.role !== "k" || king.moved) return false;
  const rank = king.side === "w" ? "1" : "8";
  if (from !== "e" + rank || !["c" + rank, "g" + rank].includes(to))
    return false;
  const rook = p.board[(to[0] === "g" ? "h" : "a") + rank];
  if (!rook || rook.side !== king.side || rook.role !== "r" || rook.moved)
    return false;
  const empty = to[0] === "g" ? ["f", "g"] : ["b", "c", "d"];
  if (empty.some((f) => p.board[f + rank])) return false;
  return ["e", to[0] === "g" ? "f" : "d", to[0]].every(
    (f) => !attacked(p, f + rank, other(king.side)),
  );
}
export function canMove(p: Position, from: Square, to: Square): boolean {
  const piece = p.board[from],
    target = p.board[to];
  if (!piece || from === to || target?.role === "k") return false;
  if (target?.side === piece.side)
    return (
      piece.role === "q" && p.cooldown[piece.side] === 0 && attacks(p, from, to)
    );
  if (hasAura(p, from) && distance(from, to) === 1) return true;
  if (piece.role === "p") return pawnMove(p, from, to, piece);
  if (piece.role === "k" && canCastle(p, from, to)) return true;
  return usualAttack(p, piece, from, to);
}
