import { characters } from "../shared/characters";
import type { Action, Position, Role, Side } from "../rules/types";
import { powerPreview, type PowerRole } from "./powers";
import { el, button } from "./dom";
export function characterPanel(
  root: HTMLElement,
  p: Position,
  side: Side,
  selected: Role,
  actions: Action[],
  playing: boolean,
  onPreview: (role?: PowerRole) => void,
): void {
  root.replaceChildren();
  const heading = el("div", "powers-heading");
  heading.append(
    el("h3", "", "Powers"),
    el("span", "small muted", side === "w" ? "White" : "Black"),
  );
  root.append(heading);
  for (const role of ["k", "n", "r", "b", "q"] as const) {
    const character = characters[role],
      preview = powerPreview(p, side, role, actions, playing);
    const card = button(
      "",
      () => onPreview(role),
      "character" +
        (selected === role ? " selected" : "") +
        (preview.available ? "" : " unavailable"),
    );
    card.setAttribute(
      "aria-label",
      `Preview ${character.name}: ${character.rule}. ${preview.status}`,
    );
    card.title = character.ability + " · " + character.roast;
    card.dataset.power = role;
    const icon = el("img", "character-avatar");
    icon.src = "/avatars/" + role + ".png";
    icon.alt = "";
    const copy = el("span", "character-copy");
    copy.append(
      el("strong", "", character.name),
      el("span", "power-effect", character.rule),
    );
    const badge = el("span", "character-badge", preview.status);
    card.append(icon, copy, badge);
    card.addEventListener("pointerenter", () => onPreview(role));
    card.addEventListener("pointerleave", () => onPreview());
    card.addEventListener("focus", () => onPreview(role));
    card.addEventListener("blur", () => onPreview());
    root.append(card);
  }
  root.append(el("p", "power-hint", "Hover to preview"));
}
export function ruleDialog(): void {
  const modal = el("dialog", "rules-dialog");
  modal.append(
    el("h2", "", "Chess. Five extra rules."),
    el("p", "", "Normal chess. No timers. Powers are part of your move."),
  );
  for (const role of ["k", "n", "r", "b", "q"] as const) {
    const c = characters[role];
    modal.append(el("h3", "", c.name + " · " + c.ability), el("p", "", c.rule));
  }
  modal.append(
    el(
      "p",
      "rule-note",
      "Powers have no use limits. Barb and Ethan are passive. Ethan saves every guarded non-king ally. A save needs an empty, unattacked square beside the capture; nearest first, with a fixed tie-break. No safe square = no save.",
    ),
  );
  modal.append(
    el(
      "p",
      "rule-note",
      "Revived pawns fill empty home-row squares left to right. Shuffling keeps kings and rooks in place.",
    ),
  );
  modal.append(
    button(
      "Got it",
      () => {
        modal.close();
        modal.remove();
      },
      "primary",
    ),
  );
  document.body.append(modal);
  modal.showModal();
}
