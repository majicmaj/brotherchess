import { characters } from "../shared/characters";
import type { Position, Role, Side } from "../rules/types";
import { el, button } from "./dom";
export function characterPanel(
  root: HTMLElement,
  p: Position,
  side: Side,
  selected: Role,
  onSelect: (role: Role) => void,
): void {
  root.replaceChildren();
  root.append(el("div", "section-label", "THE USUAL SUSPECTS"));
  for (const role of ["k", "n", "r", "b", "q"] as const) {
    const character = characters[role],
      card = button(
        "",
        () => onSelect(role),
        "character" + (selected === role ? " selected" : ""),
      );
    const icon = el("img", "character-avatar");
    icon.src = "/avatars/" + role + ".png";
    icon.alt = "";
    icon.loading = "lazy";
    const copy = el("span", "character-copy");
    copy.append(
      el("strong", "", character.name),
      el("span", "small", character.ability),
    );
    const badge = el("span", "character-badge", badgeText(role, p, side));
    card.append(icon, copy, badge);
    root.append(card);
  }
  const detail = el("div", "character-detail");
  if (selected === "p") {
    detail.append(
      el("h3", "", "Just a pawn. For now."),
      el(
        "p",
        "",
        "Move forward and capture diagonally. Stand immediately beside Barb for one-square king-style moves. Reach the back rank to promote.",
      ),
    );
  } else {
    const character = characters[selected];
    detail.append(
      el("h3", "", character.ability),
      el("p", "", character.rule),
      el("p", "roast", character.roast),
    );
  }
  root.append(detail);
}
function badgeText(role: Exclude<Role, "p">, p: Position, side: Side): string {
  if (role === "r") return "AURA";
  if (role === "b") return p.rescueUsed[side] ? "USED" : "1 SAVE";
  if (role === "n" && p.revivalUsed[side]) return "USED";
  return p.cooldown[side] ? p.cooldown[side] + " TURNS" : "READY";
}
export function ruleDialog(): void {
  const modal = el("dialog", "rules-dialog");
  modal.append(
    el("h2", "", "Same board. New problems."),
    el(
      "p",
      "",
      "Normal chess movement, check and checkmate. Powers replace your turn; Monkus’s rally is part of his move. Barb’s aura is always on.",
    ),
  );
  for (const role of ["k", "n", "r", "b", "q"] as const) {
    const c = characters[role];
    modal.append(el("h3", "", c.name + " · " + c.ability), el("p", "", c.rule));
  }
  modal.append(
    el(
      "p",
      "",
      "After an active power, make two ordinary turns before another. Underdog mode changes that to one turn for the underdog and three for the favourite. Ethan’s rescue is passive and once per side. Neither rescue nor revival restores that charge.",
    ),
  );
  modal.append(
    el(
      "p",
      "",
      "Ethan rescues the first eligible protected capture. The owner chooses a highlighted adjacent safe square; the attacker stays on the capture square. A rescued pawn cannot land on the first or last rank. BigDoe fills empty pawn-starting squares from left to right, up to the roll and captured-pawn count.",
    ),
  );
  modal.append(
    el(
      "p",
      "",
      "Shuffled games keep the king and rooks on their normal squares and bishops on opposite colours. Castling and en passant still work. Captured promoted pawns return as pawns. Rescued rooks cannot castle.",
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
