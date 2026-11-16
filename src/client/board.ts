import { inCheck } from "../rules/movement";
import { Chessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { Key, Role as GroundRole } from "@lichess-org/chessground/types";
import { fen } from "../rules/legal";
import { transition } from "../rules/transitions";
import {
  type Action,
  type Move,
  type Position,
  type Role,
} from "../rules/types";
import type { Snapshot } from "../shared/protocol";
import { characters, roleNames } from "../shared/characters";
import { sacrificePreview } from "./sacrifice";
import { dialog } from "./dom";
const groundRoles: Record<string, Role> = {
  queen: "q",
  rook: "r",
  bishop: "b",
  knight: "n",
};
export class Board {
  private ground: Api;
  private overlay = document.createElement("div");
  private highlighted: [string[], string[]] = [[], []];
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
    this.overlay.className = "power-overlay";
    this.overlay.setAttribute("aria-hidden", "true");
    this.ground.state.dom.elements.board.append(this.overlay);
    container.addEventListener("pointerdown", () => this.highlight([]));
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
    this.highlight(...this.highlighted);
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
      this.view.side === position.turn &&
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
      turnColor: position.turn === "w" ? "white" : "black",
      lastMove: position.lastMove as [Key, Key] | undefined,
      check: inCheck(position, position.turn)
        ? position.turn === "w"
          ? "white"
          : "black"
        : false,
      movable: {
        color: interactive
          ? this.view?.side === "w"
            ? "white"
            : "black"
          : undefined,
        dests,
      },
      highlight: { lastMove: true, check: true },
    });
    this.ground.setAutoShapes([]);
    this.highlight([]);
  }
  private selected(key: Key): void {
    const piece = this.shown?.board[key];
    if (piece) this.select(piece.role);
  }
  highlight(squares: string[], origins: string[] = []): void {
    if (this.extras) return;
    // Chessground rounds its board to device pixels and rebuilds it on flips.
    // Use the actual board as the containing block, including after a rebuild.
    this.ground.state.dom.elements.board.append(this.overlay);
    this.highlighted = [squares, origins];
    this.overlay.replaceChildren();
    for (const at of new Set([...origins, ...squares])) {
      const cell = document.createElement("div");
      cell.className = "power-square" + (origins.includes(at) ? " source" : "");
      const black = this.ground.state.orientation === "black";
      const x = at.charCodeAt(0) - 97,
        y = Number(at[1]) - 1;
      cell.style.left = (black ? 7 - x : x) * 12.5 + "%";
      cell.style.top = (black ? y : 7 - y) * 12.5 + "%";
      this.overlay.append(cell);
    }
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
      dialog("Rally?", "Move Monkus alone, or nudge a neighbour.", [
        { label: "Just move Monkus", action: () => this.play(ordinary) },
        {
          label: "Rally the boys",
          primary: true,
          action: () => this.rally(extras),
        },
      ]);
      return;
    }
    const revive = candidates.find((a) => a.revive);
    if (revive) {
      dialog("Revive the server?", "Roll 0–5. Revive captured pawns at home.", [
        { label: "Just move", action: () => this.play(ordinary) },
        {
          label: "Ping everyone · roll",
          primary: true,
          action: () => this.play(revive),
        },
      ]);
      return;
    }
    const victim = view.position.board[ordinary.to];
    if (victim?.side === view.side) {
      const preview = sacrificePreview(view.position, ordinary);
      dialog(preview.title, preview.message, [
        { label: "Cancel", action: () => this.cancel() },
        {
          label: preview.confirm,
          primary: true,
          action: () => this.play(ordinary),
        },
      ]);
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
    this.notice("Nudge a neighbour 1 empty square.");
  }
  description(role: Role): string {
    return role === "p"
      ? "Normal pawn · Barb may give it extra movement."
      : characters[role].rule;
  }
}
