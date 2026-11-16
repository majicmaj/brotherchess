import { nearestSafeSquare, rescue } from "../rules/abilities";
import { adjudicate } from "../rules/legal";
import { finishTurn } from "../rules/transitions";
import type { Piece, Position, Side } from "../rules/types";
import type { Match } from "../shared/protocol";
interface LegacyRescue {
  piece: Piece;
  origin: string;
  actor: Side;
  activePower: boolean;
  pawnOrCapture: boolean;
  notation: string;
  from: string;
  to: string;
}
// Upgrade old rooms in place: keep seats, board and resources; retire clocks.
export function upgradeMatch(stored: Match): Match {
  const position = structuredClone(stored.position) as Position & {
    pending?: LegacyRescue;
  };
  const pending = position.pending;
  delete position.pending;
  const next: Match = {
    code: stored.code,
    seats: stored.seats,
    host: stored.host,
    position,
    revision: stored.revision,
    created: stored.created,
    started: stored.started,
    ...(stored.drawOffer ? { drawOffer: stored.drawOffer } : {}),
  };
  if (pending && !position.result) {
    const to = nearestSafeSquare(
      position,
      pending.piece,
      pending.origin,
      pending.actor,
    );
    if (to) rescue(position, pending.piece, to);
    finishTurn(
      position,
      pending.actor,
      pending.activePower,
      pending.pawnOrCapture,
      pending.notation + (to ? ` · saved → ${to}` : ""),
      pending.from,
      pending.to,
    );
    adjudicate(position);
    next.revision++;
  }
  return next;
}
