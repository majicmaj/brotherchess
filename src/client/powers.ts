import { neighbors } from "../rules/abilities";
import { attacks, bishopGuard } from "../rules/movement";
import {
  distance,
  files,
  other,
  square,
  xy,
  type Action,
  type Position,
  type Role,
  type Side,
} from "../rules/types";
export type PowerRole = Exclude<Role, "p">;
export interface PowerPreview {
  origins: string[];
  squares: string[];
  available: boolean;
  status: string;
}
export function powerPreview(
  p: Position,
  side: Side,
  role: PowerRole,
  actions: Action[],
  playing: boolean,
): PowerPreview {
  const origins = Object.keys(p.board).filter(
    (at) => p.board[at].side === side && p.board[at].role === role,
  );
  const targets = effectSquares(p, side, role, origins, actions);
  const status = powerStatus(
    p,
    side,
    role,
    actions,
    playing,
    origins.length > 0,
    targets.length > 0,
  );
  return {
    origins,
    squares: [...new Set(targets)],
    available: status.available,
    status: status.text,
  };
}
function powerStatus(
  p: Position,
  side: Side,
  role: PowerRole,
  actions: Action[],
  playing: boolean,
  present: boolean,
  targets: boolean,
): { available: boolean; text: string } {
  const off = (text: string) => ({ available: false, text });
  const on = (text: string) => ({ available: true, text });
  if (p.result) return off("Game over");
  if (!present) return off("Captured");
  if (role === "n" && p.revivalUsed[side]) return off("Spent");
  if (role === "r") return targets ? on("Passive") : off("No allies");
  if (role === "b") return targets ? on("Auto") : off("No cover");
  if (p.cooldown[side]) return off(`${p.cooldown[side]} turns`);
  if (!playing) return off("Preview");
  if (p.turn !== side) return off("Their turn");
  const ready = actions.some((a) =>
    role === "k"
      ? Boolean(a.extra)
      : role === "n"
        ? Boolean(a.revive)
        : p.board[a.from]?.role === "q" && p.board[a.to]?.side === side,
  );
  if (!ready) return off(role === "n" ? "Back rank" : "No move");
  return on(role === "n" ? "Ready · 1×" : "Ready");
}
function effectSquares(
  p: Position,
  side: Side,
  role: PowerRole,
  origins: string[],
  actions: Action[],
): string[] {
  if (role === "r")
    return origins.flatMap((at) => {
      const [x, y] = xy(at);
      return [-1, 1]
        .map((dx) => square(x + dx, y))
        .filter((v): v is string =>
          Boolean(v && p.board[v]?.side === side && p.board[v].role !== "k"),
        );
    });
  if (role === "b")
    return Object.keys(p.board).filter(
      (at) =>
        p.board[at].side === side &&
        p.board[at].role !== "k" &&
        bishopGuard(p, at, side),
    );
  if (role === "n")
    return [
      ...[...files].map((f) => f + (side === "w" ? "8" : "1")),
      ...[...files]
        .map((f) => f + (side === "w" ? "2" : "7"))
        .filter((at) => !p.board[at]),
    ];
  const ownActions = p.turn === side ? actions : [];
  if (role === "q")
    return Object.keys(p.board).filter(
      (at) =>
        p.board[at].side === side &&
        p.board[at].role !== "k" &&
        origins.some((from) => attacks(p, from, at)),
    );
  const rally = ownActions.flatMap((a) =>
    a.extra ? [a.to, a.extra.from, a.extra.to] : [],
  );
  if (rally.length) return rally;
  return origins
    .flatMap((at) =>
      neighbors(at).filter(
        (next) => !p.board[next] || p.board[next].side === other(side),
      ),
    )
    .filter((at) => origins.some((from) => distance(from, at) === 1));
}
