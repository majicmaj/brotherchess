import { nearestSafeSquare, rescue } from "../rules/abilities";
import { adjudicate } from "../rules/legal";
import { positionKey, finishTurn } from "../rules/transitions";
import type { Piece, Position, Side } from "../rules/types";
import type { Match } from "../shared/protocol";
interface LegacyRescue {
  piece: Piece;
  origin: string;
  actor: Side;
  pawnOrCapture: boolean;
  notation: string;
  from: string;
  to: string;
}
const retired = ["rescueUsed", "cooldown", "cooldownLength", "revivalUsed"];
export function hasRetiredPowers(position: Position): boolean {
  return retired.some((key) => key in position);
}
// Upgrade old rooms in place: keep seats, board and resources; retire clocks.
export function upgradeMatch(stored: Match): Match {
  const position = structuredClone(stored.position) as Position & {
    pending?: LegacyRescue;
  };
  const pending = position.pending;
  delete position.pending;
  const changedRules = hasRetiredPowers(position);
  for (const key of retired) Reflect.deleteProperty(position, key);
  if (changedRules) position.repetitions = { [positionKey(position)]: 1 };
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
