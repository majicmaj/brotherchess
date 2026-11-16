import type { Role } from "../rules/types";
export interface Character {
  name: string;
  piece: string;
  ability: string;
  rule: string;
  roast: string;
}
export const characters: Record<Exclude<Role, "p">, Character> = {
  k: {
    name: "Monkus",
    piece: "King",
    ability: "Motivational Wank",
    rule: "After a safe one-square king move, rally one adjacent friendly non-king piece one empty square in any direction.",
    roast:
      "Delivers a 900-word speech about taking action. Someone else does the work.",
  },
  n: {
    name: "BigDoe",
    piece: "Knight",
    ability: "Please Join VC",
    rule: "On the enemy back rank, optionally roll 1d6 − 1. Revive that many captured pawns on empty pawn-starting squares. Once per side. BigDoe lives.",
    roast: "Crossed the entire board to get one more cunt into the call.",
  },
  r: {
    name: "Barb",
    piece: "Rook",
    ability: "Stop Skipping Leg Day",
    rule: "Friendly pieces immediately left and right gain king-style one-square moves and captures. This replaces their move; it is not an extra turn. Always on.",
    roast:
      "Logs into another account to remind Alen he lost in the same fucking car.",
  },
  b: {
    name: "Ethan B",
    piece: "Bishop",
    ability: "Moving the Fucking Goalposts",
    rule: "The first captured ally defended by a bishop is rescued to an adjacent empty, unattacked square chosen by its owner. Once per side. Kings cannot be rescued.",
    roast:
      "Your capture was correct. Apparently you misunderstood his position.",
  },
  q: {
    name: "Tushar",
    piece: "Queen",
    ability: "Willing Sacrifice",
    rule: "Capture your own non-king pieces. An ally protected by Ethan before the move may be rescued instead. This spends the rescue charge.",
    roast:
      "Bans his own member for being in the way. Calls it server maintenance.",
  },
};
export const roleNames: Record<Role, string> = {
  p: "Pawn",
  n: "BigDoe",
  b: "Ethan B",
  r: "Barb",
  q: "Tushar",
  k: "Monkus",
};
