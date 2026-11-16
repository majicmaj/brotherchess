import { bishopGuard } from "../rules/movement";
import { transition } from "../rules/transitions";
import type { Move, Position } from "../rules/types";
import { roleNames } from "../shared/characters";
export function sacrificePreview(
  p: Position,
  move: Move,
): {
  title: string;
  message: string;
  confirm: string;
  destination?: string;
} {
  const victim = p.board[move.to];
  const after = transition(p, move);
  const destination = Object.keys(after.board).find(
    (at) => after.board[at].id === victim.id,
  );
  const name = roleNames[victim.role];
  if (destination)
    return {
      title: "Tushar + Ethan",
      message: `Shove ${name} to ${destination.toUpperCase()}. Tushar takes ${move.to.toUpperCase()}.`,
      confirm: `Shove to ${destination.toUpperCase()}`,
      destination,
    };
  const reason = bishopGuard(p, move.to, victim.side)
    ? "No safe square."
    : "Ethan isn’t guarding this piece.";
  return {
    title: `Sacrifice ${name}?`,
    message: `${reason} Your ${name} will be lost.`,
    confirm: `Sacrifice ${name}`,
  };
}
