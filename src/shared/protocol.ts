import type { Action, Position, Side } from "../rules/types";
export interface Seat {
  name: string;
  tokenHash: string;
}
export interface Match {
  code: string;
  seats: Partial<Record<Side, Seat>>;
  host: Side;
  position: Position;
  revision: number;
  created: number;
  started: boolean;
  drawOffer?: Side;
}
export interface Snapshot {
  type: "state";
  code: string;
  names: Partial<Record<Side, string>>;
  host: Side;
  position: Position;
  revision: number;
  started: boolean;
  actions: Action[];
  side?: Side;
  drawOffer?: Side;
}
export type Command =
  | { type: "action"; action: Action; revision: number }
  | { type: "resign"; revision: number }
  | { type: "offer-draw"; revision: number }
  | { type: "accept-draw"; revision: number }
  | { type: "sync" };
export const sideName = (side: Side): string =>
  side === "w" ? "White" : "Black";
