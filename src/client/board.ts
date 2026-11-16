import { inCheck } from "../rules/movement";
import { Chessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { Key, Role as GroundRole } from "@lichess-org/chessground/types";
import { actor, fen } from "../rules/legal";
import { transition } from "../rules/transitions";
import {
  type Action,
  type Move,
  type Position,
  type Role,
} from "../rules/types";
import type { Snapshot } from "../shared/protocol";
import { characters, roleNames } from "../shared/characters";
import { dialog } from "./dom";
const groundRoles: Record<string, Role> = {
  queen: "q",
  rook: "r",
  bishop: "b",
  knight: "n",
};
export class Board {
  private ground: Api;
  private view?: Snapshot;
  private extras?: Move[];
  private shown?: Position;
  constructor(
    container: HTMLElement,
    private play: (action: Action) => void,
    private select: (role: Role) => void,
    private notice: (text: string) => void,
  ) {
    this.ground = Chessground(container, {
      coordinates: true,
      autoCastle: false,
      animation: { enabled: true, duration: 160 },
      movable: {
        free: false,
        color: undefined,
        dests: new Map(),
        showDests: true,
        events: { after: (from, to) => this.moved(from, to) },
      },
      premovable: { enabled: false },
      drawable: { enabled: true },
      events: { select: (key) => this.selected(key) },
    });
  }
  update(view: Snapshot): void {
    this.view = view;
    this.extras = undefined;
    this.paint(view.position, view.actions);
  }
  preview(position: Position): void {
    this.paint(position, []);
  }
  flip(): void {
    this.ground.toggleOrientation();
  }
  orientation(side: "w" | "b"): void {
    this.ground.set({ orientation: side === "w" ? "white" : "black" });
  }
  cancel(): void {
    if (this.view) this.update(this.view);
    this.notice("");
  }
  private paint(position: Position, actions: Action[]): void {
    this.shown = position;
    const interactive = Boolean(
      this.view?.started &&
      this.view.side === actor(position) &&
      !position.result,
    );
    const dests = new Map<Key, Key[]>();
    if (interactive)
      for (const action of actions) {
        if (action.type !== "move" || action.extra) continue;
        const from = action.from as Key,
          to = action.to as Key;
        dests.set(from, [...new Set([...(dests.get(from) ?? []), to])]);
      }
    this.ground.set({
      fen: fen(position),
      turnColor: actor(position) === "w" ? "white" : "black",
      lastMove: position.lastMove as [Key, Key] | undefined,
      check: inCheck(position, position.turn)
        ? position.turn === "w"
          ? "white"
          : "black"
        : false,
      movable: {
        color:
          interactive && !position.pending
            ? this.view?.side === "w"
              ? "white"
              : "black"
            : undefined,
        dests,
      },
      highlight: { lastMove: true, check: true },
    });
    const shapes =
      position.pending?.options.map((at) => ({
        orig: at as Key,
        brush: "green",
      })) ?? [];
    this.ground.setAutoShapes(shapes);
  }
  private selected(key: Key): void {
    const view = this.view;
    if (!view) return;
    if (
      !view.position.result &&
      view.position.pending &&
      view.side === view.position.pending.owner &&
      view.position.pending.options.includes(key)
    ) {
      this.play({ type: "rescue", to: key });
      return;
    }
    const piece = this.shown?.board[key];
    if (piece) this.select(piece.role);
  }
  private moved(from: Key, to: Key): void {
    const view = this.view;
    if (!view) return;
    if (this.extras) {
      const choices = this.extras.filter(
        (move) => move.extra?.from === from && move.extra.to === to,
      );
      if (choices.some((move) => move.extra?.promotion)) {
        dialog(
          "Promote your pawn",
          "Choose who gets the promotion.",
          choices.map((action) => ({
            label: roleNames[action.extra!.promotion!],
            action: () => this.play(action),
          })),
        );
      } else if (choices[0]) this.play(choices[0]);
      else this.cancel();
      return;
    }
    const candidates = view.actions.filter(
      (a): a is Move => a.type === "move" && a.from === from && a.to === to,
    );
    if (!candidates.length) {
      this.cancel();
      return;
    }
    if (candidates.some((a) => a.promotion)) {
      this.promotion(candidates);
      return;
    }
    this.choose(candidates);
  }
  private promotion(candidates: Move[]): void {
    const names: GroundRole[] = ["queen", "rook", "bishop", "knight"];
    dialog(
      "Promote your pawn",
      "Choose who gets the promotion.",
      names.map((role) => ({
        label: roleNames[groundRoles[role]],
        action: () =>
          this.choose(
            candidates.filter((a) => a.promotion === groundRoles[role]),
          ),
      })),
    );
  }
  private choose(candidates: Move[]): void {
    const view = this.view;
    if (!view) return;
    const ordinary = candidates.find((a) => !a.extra && !a.revive);
    if (!ordinary) {
      this.cancel();
      return;
    }
    const extras = candidates.filter((a) => a.extra);
    if (extras.length) {
      dialog(
        "Take action, bro",
        "Move Monkus alone, or rally a teammate beside his new square.",
        [
          { label: "Just move Monkus", action: () => this.play(ordinary) },
          {
            label: "Rally the boys",
            primary: true,
            action: () => this.rally(extras),
          },
        ],
      );
      return;
    }
    const revive = candidates.find((a) => a.revive);
    if (revive) {
      dialog(
        "Revive the server?",
        "Roll 1d6 − 1. Restore up to five captured pawns on empty starting squares. Once this game; BigDoe survives.",
        [
          { label: "Just move", action: () => this.play(ordinary) },
          {
            label: "Ping everyone · roll",
            primary: true,
            action: () => this.play(revive),
          },
        ],
      );
      return;
    }
    const victim = view.position.board[ordinary.to];
    if (victim?.side === view.side) {
      dialog(
        "Willing sacrifice",
        `Capture your own ${roleNames[victim.role]}? If Ethan protects them and a safe square exists, they can be rescued.`,
        [
          { label: "Cancel", action: () => this.cancel() },
          {
            label: "Sacrifice " + roleNames[victim.role],
            primary: true,
            action: () => this.play(ordinary),
          },
        ],
      );
      return;
    }
    this.play(ordinary);
  }
  private rally(extras: Move[]): void {
    const view = this.view;
    if (!view) return;
    const { from, to, promotion } = extras[0];
    const preview = transition(view.position, {
      type: "move",
      from,
      to,
      promotion,
    });
    this.paint(preview, []);
    this.extras = extras;
    const dests = new Map<Key, Key[]>();
    for (const move of extras) {
      const step = move.extra!;
      dests.set(step.from as Key, [
        ...new Set([...(dests.get(step.from as Key) ?? []), step.to as Key]),
      ]);
    }
    this.ground.set({
      turnColor: view.side === "w" ? "white" : "black",
      movable: { color: view.side === "w" ? "white" : "black", dests },
    });
    this.notice(
      "Choose a teammate beside Monkus and move them one square. Cancel to start again.",
    );
  }
  description(role: Role): string {
    return role === "p"
      ? "Normal pawn · Barb may give it extra movement."
      : characters[role].rule;
  }
}
