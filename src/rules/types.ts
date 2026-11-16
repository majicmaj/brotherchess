export type Side = "w" | "b";
export type Role = "p" | "n" | "b" | "r" | "q" | "k";
export type Square = string;
export interface Piece {
  id: string;
  side: Side;
  role: Role;
  base: Role;
  home: Square;
  moved: boolean;
}
export interface Step {
  from: Square;
  to: Square;
  promotion?: Role;
}
export interface Move extends Step {
  type: "move";
  extra?: Step;
  revive?: boolean;
}
export type Action = Move;
export interface Entry {
  text: string;
  side: Side;
  ability?: string;
  roll?: number;
}
export interface Position {
  board: Record<Square, Piece>;
  turn: Side;
  cooldown: Record<Side, number>;
  cooldownLength: Record<Side, number>;
  rescueUsed: Record<Side, boolean>;
  revivalUsed: Record<Side, boolean>;
  captured: Piece[];
  enPassant?: { target: Square; pawn: Square };
  lastMove?: [Square, Square];
  lastEffect?: { name: string; text: string; roll?: number };
  history: Entry[];
  quietPlies: number;
  repetitions: Record<string, number>;
  result?: { winner: Side | null; reason: string };
}
export interface Setup {
  shuffled: boolean;
  underdog?: Side;
  layout?: Role[];
}
export const other = (side: Side): Side => (side === "w" ? "b" : "w");
export const files = "abcdefgh";
export function xy(at: Square): [number, number] {
  return [files.indexOf(at[0]), Number(at[1]) - 1];
}
export function square(x: number, y: number): Square | undefined {
  return x >= 0 && x < 8 && y >= 0 && y < 8 ? files[x] + (y + 1) : undefined;
}
export function validSquare(value: unknown): value is Square {
  return typeof value === "string" && /^[a-h][1-8]$/.test(value);
}
export function distance(a: Square, b: Square): number {
  const [x, y] = xy(a),
    [u, v] = xy(b);
  return Math.max(Math.abs(x - u), Math.abs(y - v));
}
