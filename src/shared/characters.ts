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
    rule: "Move king → nudge a neighbour 1 square.",
    roast:
      "Delivers a 900-word speech about taking action. Someone else does the work.",
  },
  n: {
    name: "BigDoe",
    piece: "Knight",
    ability: "Please Join VC",
    rule: "Enemy back rank → revive 0–5 pawns.",
    roast: "Crossed the entire board to get one more cunt into the call.",
  },
  r: {
    name: "Barb",
    piece: "Rook",
    ability: "Stop Skipping Leg Day",
    rule: "Left/right allies gain king moves.",
    roast:
      "Logs into another account to remind Alen he lost in the same fucking car.",
  },
  b: {
    name: "Ethan B",
    piece: "Bishop",
    ability: "Moving the Fucking Goalposts",
    rule: "Guarded ally captured → nearest safe square.",
    roast:
      "Your capture was correct. Apparently you misunderstood his position.",
  },
  q: {
    name: "Tushar",
    piece: "Queen",
    ability: "Willing Sacrifice",
    rule: "Capture your own piece. Ethan can save it.",
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
