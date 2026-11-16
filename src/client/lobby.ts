import { api, remember, type Credential } from "./network";
import { el, button, field, input, select } from "./dom";
import type { Snapshot } from "../shared/protocol";
export function lobby(
  root: HTMLElement,
  enter: (credential: Credential) => void,
  watch: (code: string) => void,
  notify: (text: string) => void,
  room?: Snapshot,
): void {
  root.replaceChildren();
  const name = input(
    "Your name",
    24,
    localStorage.getItem("brotherchess-name") ?? "",
  );
  name.autocomplete = "off";
  name.required = true;
  const form = el("form", "lobby-form");
  form.append(
    el("h2", "", room ? "Join the boys" : "Bring the boys"),
    el(
      "p",
      "muted",
      room
        ? "Take the open seat, or watch the carnage."
        : "Chess. Five familiar idiots. Unfamiliar problems.",
    ),
    field("Display name", name),
  );
  if (room) {
    form.append(el("div", "room-code", room.code));
    const full = Boolean(room.names.w && room.names.b);
    const join = el(
      "button",
      "primary",
      full ? "Both seats taken" : "Take the open seat",
    );
    join.disabled = full;
    form.append(join);
    form.append(button("Watch game", () => watch(room.code), "secondary"));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      join.disabled = true;
      try {
        localStorage.setItem("brotherchess-name", name.value.trim());
        const credential = await api<Credential>(
          "/api/rooms/" + room.code + "/join",
          { name: name.value },
        );
        remember(credential);
        enter(credential);
      } catch (error) {
        notify(error instanceof Error ? error.message : "Could not join.");
        join.disabled = false;
      }
    });
  } else createForm(form, name, enter, notify);
  root.append(form);
}
function createForm(
  form: HTMLFormElement,
  name: HTMLInputElement,
  enter: (credential: Credential) => void,
  notify: (text: string) => void,
): void {
  const side = select([
    ["random", "Random"],
    ["w", "White"],
    ["b", "Black"],
  ]);
  const time = select(
    [
      ["3", "3 + 2"],
      ["5", "5 + 2"],
      ["10", "10 + 2"],
      ["15", "15 + 2"],
      ["30", "30 + 2"],
    ],
    "10",
  );
  const weaker = select([
    ["", "Equal powers"],
    ["w", "White gets more powers"],
    ["b", "Black gets more powers"],
  ]);
  const shuffled = el("input");
  shuffled.type = "checkbox";
  shuffled.checked = true;
  const shuffle = el("label", "toggle");
  shuffle.append(shuffled, el("span", "", "Shuffle the back rank"));
  const row = el("div", "form-row");
  row.append(field("Your side", side), field("Minutes + seconds", time));
  const create = el("button", "primary", "Create a room");
  form.append(
    row,
    field("Power balance", weaker),
    shuffle,
    create,
    el(
      "p",
      "small muted",
      "Kings and rooks stay put. Bishops keep opposite colours.",
    ),
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    create.disabled = true;
    try {
      localStorage.setItem("brotherchess-name", name.value.trim());
      const credential = await api<Credential>("/api/rooms", {
        name: name.value,
        side: side.value,
        minutes: Number(time.value),
        shuffled: shuffled.checked,
        ...(weaker.value ? { underdog: weaker.value } : {}),
      });
      remember(credential);
      enter(credential);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not create room.");
      create.disabled = false;
    }
  });
  const code = input("ROOM CODE", 6);
  code.autocomplete = "off";
  code.className = "code-input";
  const join = button(
    "Join",
    () => {
      const value = code.value.trim().toUpperCase();
      if (!/^[A-HJKMNP-Z2-9]{6}$/.test(value)) {
        notify("Enter the six-letter room code.");
        return;
      }
      location.href = "/room/" + value;
    },
    "secondary",
  );
  const joinRow = el("div", "join-row");
  joinRow.append(code, join);
  form.append(el("div", "divider", "or join a room"), joinRow);
}
