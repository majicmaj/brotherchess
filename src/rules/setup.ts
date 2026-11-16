import {
  files,
  type Position,
  type Role,
  type Setup,
  type Side,
} from "./types";
const standard: Role[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
export function randomLayout(random: () => number = Math.random): Role[] {
  const candidates: Role[][] = [];
  for (let first = 0; first < 5; first++)
    for (let second = first + 1; second < 5; second++) {
      const slots = [1, 2, 3, 5, 6];
      if (slots[first] % 2 === slots[second] % 2) continue;
      const rest = slots.filter((_, i) => i !== first && i !== second);
      for (const queen of rest) {
        const row = [...standard];
        slots.forEach((i) => {
          row[i] = "n";
        });
        row[slots[first]] = "b";
        row[slots[second]] = "b";
        row[queen] = "q";
        candidates.push(row);
      }
    }
  return candidates[Math.floor(random() * candidates.length)];
}
export function createPosition(setup: Setup): Position {
  const layout = setup.layout ?? (setup.shuffled ? randomLayout() : standard);
  const board: Position["board"] = {};
  for (const side of ["w", "b"] as Side[])
    for (let x = 0; x < 8; x++) {
      const home = files[x] + (side === "w" ? 1 : 8),
        pawnHome = files[x] + (side === "w" ? 2 : 7);
      board[home] = {
        id: side + "-" + home,
        side,
        role: layout[x],
        base: layout[x],
        home,
        moved: false,
      };
      board[pawnHome] = {
        id: side + "-" + pawnHome,
        side,
        role: "p",
        base: "p",
        home: pawnHome,
        moved: false,
      };
    }
  return {
    board,
    turn: "w",
    cooldown: { w: 0, b: 0 },
    cooldownLength: {
      w: setup.underdog ? (setup.underdog === "w" ? 1 : 3) : 2,
      b: setup.underdog ? (setup.underdog === "b" ? 1 : 3) : 2,
    },
    revivalUsed: { w: false, b: false },
    captured: [],
    history: [],
    quietPlies: 0,
    repetitions: {},
  };
}
