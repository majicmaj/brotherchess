import { applyAction, legalActions } from "../rules/legal";
import { positionKey, transition } from "../rules/transitions";
import { createPosition, randomLayout } from "../rules/setup";
import { other, type Side } from "../rules/types";
import type { Command, Match, Snapshot } from "../shared/protocol";
export function randomInt(max: number): number {
  const values = new Uint32Array(1),
    limit = Math.floor(0x100000000 / max) * max;
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);
  return values[0] % max;
}
export function newToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}
export async function hashToken(token: string): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
}
export function createMatch(
  code: string,
  name: string,
  tokenHash: string,
  host: Side,
  shuffled: boolean,
  underdog?: Side,
): Match {
  const layout = shuffled
    ? randomLayout(() => randomInt(0x1000000) / 0x1000000)
    : undefined;
  const position = createPosition({ shuffled, underdog, layout });
  position.repetitions[positionKey(position)] = 1;
  return {
    code,
    seats: { [host]: { name, tokenHash } },
    host,
    position,
    revision: 0,
    created: Date.now(),
    started: false,
  };
}
export function snapshot(match: Match, side?: Side): Snapshot {
  return {
    type: "state",
    code: match.code,
    names: { w: match.seats.w?.name, b: match.seats.b?.name },
    host: match.host,
    position: match.position,
    revision: match.revision,
    started: match.started,
    actions: match.started ? legalActions(match.position) : [],
    side,
    drawOffer: match.drawOffer,
  };
}
export function perform(
  match: Match,
  command: Command,
  side: Side,
  roll: () => number = () => randomInt(6),
): Match {
  if (command.type === "sync") return match;
  if (command.revision !== match.revision)
    throw new Error("The board changed. Try again on the current position.");
  if (!match.started || match.position.result)
    throw new Error("This game is not active.");
  const next = structuredClone(match);
  if (command.type === "action") return play(next, command, side, roll);
  if (command.type === "resign")
    next.position.result = { winner: other(side), reason: "resignation" };
  else if (command.type === "offer-draw") next.drawOffer = side;
  else if (command.type === "accept-draw") {
    if (next.drawOffer !== other(side))
      throw new Error("There is no draw offer to accept.");
    next.position.result = { winner: null, reason: "agreement" };
  }
  next.revision++;
  return next;
}
function play(
  next: Match,
  command: Extract<Command, { type: "action" }>,
  side: Side,
  roll: () => number,
): Match {
  if (next.position.turn !== side) throw new Error("It is not your turn.");
  // Validate before drawing entropy: invalid requests can never reroll a revival.
  transition(next.position, command.action, 0);
  const die =
    command.action.type === "move" && command.action.revive ? roll() : 0;
  const before = next.position;
  next.position = applyAction(before, command.action, die);
  delete next.drawOffer;
  next.revision++;
  return next;
}
