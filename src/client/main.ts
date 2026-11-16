import { createPosition } from "../rules/setup";
import { actor } from "../rules/legal";
import { other, type Action, type Role, type Side } from "../rules/types";
import { sideName, type Snapshot } from "../shared/protocol";
import { Board } from "./board";
import { characterPanel, ruleDialog } from "./characters";
import { button, byId, dialog, el } from "./dom";
import { lobby } from "./lobby";
import { api, Connection, recall, type Credential } from "./network";
import "./style.css";
import "@lichess-org/chessground/assets/chessground.base.css";
import "@lichess-org/chessground/assets/chessground.brown.css";
import "@lichess-org/chessground/assets/chessground.cburnett.css";
let current: Snapshot | undefined,
  connection: Connection | undefined,
  selected: Role = "k",
  clockOffset = 0,
  sendPending = false;
const sidebar = byId("sidebar"),
  notice = byId("notice"),
  status = byId("connection"),
  charactersRoot = byId("characters");
const board = new Board(
  byId("board"),
  play,
  (role) => {
    selected = role;
    renderCharacters();
  },
  (text) => {
    notice.textContent = text;
    byId<HTMLButtonElement>("cancel").disabled = !text;
  },
);
const showError = (text: string): void => {
  notice.textContent = text;
  notice.classList.add("error");
  sendPending = false;
};
function play(action: Action): void {
  if (!current || !connection || sendPending) return;
  notice.textContent = "";
  notice.classList.remove("error");
  sendPending = true;
  connection.play(action, current.revision);
}
function accept(view: Snapshot): void {
  const old = current;
  current = view;
  sendPending = false;
  clockOffset = view.clockAt - Date.now();
  if (old?.revision !== view.revision) {
    notice.textContent = "";
    document
      .querySelectorAll<HTMLDialogElement>("dialog.choice-dialog")
      .forEach((modal) => {
        modal.close();
        modal.remove();
      });
  }
  board.update(view);
  renderCharacters();
  renderPlayers();
  clocks();
  byId<HTMLButtonElement>("cancel").disabled = true;
  renderMatch();
  renderHistory();
}
function renderCharacters(): void {
  characterPanel(
    charactersRoot,
    current?.position ?? createPosition({ shuffled: false }),
    current?.side ?? "w",
    selected,
    (role) => {
      selected = role;
      renderCharacters();
    },
  );
}
function renderPlayers(): void {
  const view = current;
  if (!view) return;
  const orientation = byId("game").dataset.orientation === "b" ? "b" : "w";
  player(byId("player-top"), view, other(orientation));
  player(byId("player-bottom"), view, orientation);
}
function player(root: HTMLElement, view: Snapshot, side: Side): void {
  root.replaceChildren();
  const name = el("div", "player-name");
  const marker = el(
    "span",
    "side-marker " + (side === "w" ? "white" : "black"),
  );
  name.append(
    marker,
    el("strong", "", view.names[side] ?? "Waiting for a brother…"),
  );
  const own = view.side === side;
  if (own) name.append(el("span", "you", "you"));
  const powers = el(
    "span",
    "player-powers",
    view.position.cooldown[side]
      ? `Powers · ${view.position.cooldown[side]} turns`
      : "Powers ready",
  );
  const clock = el("div", "clock");
  clock.dataset.side = side;
  root.append(name, powers, clock);
  root.classList.toggle(
    "active",
    view.started && !view.position.result && actor(view.position) === side,
  );
}
function renderMatch(): void {
  const view = current;
  if (!view) return;
  if (!view.side && !view.started) {
    lobby(sidebar, enter, watch, showError, view);
    return;
  }
  sidebar.replaceChildren();
  const card = el("div", "match-card");
  card.append(
    el("div", "section-label", "PRIVATE ROOM"),
    el("div", "room-code", view.code),
  );
  card.append(
    button(
      "Copy invite link",
      async () => {
        try {
          await navigator.clipboard.writeText(
            location.origin + "/room/" + view.code,
          );
          notice.textContent =
            "Invite link copied. Your seat key stays private.";
        } catch {
          notice.textContent = location.origin + "/room/" + view.code;
        }
      },
      "secondary full",
    ),
  );
  card.append(
    el(
      "p",
      "small muted",
      view.side
        ? "Your seat is saved in this browser."
        : "You are watching this game.",
    ),
  );
  let text = view.started
    ? sideName(view.position.turn) + " to move"
    : "Waiting for your opponent";
  if (view.position.pending)
    text =
      view.position.pending.owner === view.side
        ? "Ethan’s save · choose a green square"
        : `${view.names[view.position.pending.owner] ?? sideName(view.position.pending.owner)} is choosing a rescue square`;
  if (view.position.result)
    text = view.position.result.winner
      ? `${view.names[view.position.result.winner]} wins · ${view.position.result.reason}`
      : `Draw · ${view.position.result.reason}`;
  card.append(el("h2", "turn-status", text));
  if (view.position.lastEffect) {
    const effect = el("div", "effect");
    effect.append(
      el("strong", "", view.position.lastEffect.name),
      el("p", "", view.position.lastEffect.text),
    );
    if (view.position.lastEffect.roll !== undefined)
      effect.append(
        el(
          "span",
          "die",
          `🎲 ${view.position.lastEffect.roll + 1} − 1 = ${view.position.lastEffect.roll}`,
        ),
      );
    card.append(effect);
  }
  if (view.started && view.side && !view.position.result) actions(card, view);
  if (!view.side && view.started && !view.names[other(view.host)])
    card.append(
      button(
        "Take the open seat",
        () => lobby(sidebar, enter, watch, showError, view),
        "primary",
      ),
    );
  if (view.position.result)
    card.append(
      button(
        "Play another game",
        () => {
          location.href = "/";
        },
        "primary full",
      ),
    );
  card.append(button("How to play", ruleDialog, "text-button"));
  sidebar.append(card);
}
function actions(card: HTMLElement, view: Snapshot): void {
  const controls = el("div", "match-controls");
  controls.append(
    button(
      "Offer draw",
      () => connection?.send("offer-draw", view.revision),
      "quiet",
    ),
    button(
      "Resign",
      () =>
        dialog(
          "Resign this game?",
          "Your opponent wins. The game stays available to review.",
          [
            { label: "Keep playing", action: () => {} },
            {
              label: "Resign",
              action: () => connection?.send("resign", view.revision),
            },
          ],
        ),
      "quiet",
    ),
  );
  if (view.drawOffer === view.side)
    controls.append(el("span", "small muted", "Draw offered"));
  else if (view.drawOffer)
    controls.append(
      button(
        "Accept draw",
        () => connection?.send("accept-draw", view.revision),
        "secondary",
      ),
    );
  card.append(controls);
}
function renderHistory(): void {
  const root = byId("moves"),
    history = current?.position.history ?? [];
  root.replaceChildren();
  if (!history.length) {
    root.append(el("p", "muted small", "The receipts will appear here."));
    return;
  }
  history.forEach((entry, index) => {
    const row = el("div", "move");
    row.append(
      el(
        "span",
        "move-number",
        `${Math.floor(index / 2) + 1}${entry.side === "b" ? "…" : "."}`,
      ),
      el("span", "", entry.text),
    );
    if (entry.ability)
      row.append(
        el(
          "span",
          "move-ability",
          entry.ability +
            (entry.roll !== undefined
              ? ` · 🎲 ${entry.roll + 1}−1=${entry.roll}`
              : ""),
        ),
      );
    root.append(row);
  });
  root.scrollTop = root.scrollHeight;
}
function clocks(): void {
  if (!current) return;
  const now = Date.now() + clockOffset,
    active = actor(current.position);
  document.querySelectorAll<HTMLElement>(".clock").forEach((node) => {
    const side = node.dataset.side as Side;
    let ms = current!.clocks[side];
    if (current!.started && !current!.position.result && active === side)
      ms -= now - current!.clockAt;
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    node.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    node.classList.toggle("low", ms < 30000 && current!.started);
  });
}
function connect(code: string, credential?: Credential): void {
  connection?.close();
  history.replaceState({}, "", "/room/" + code);
  byId("game").dataset.orientation = credential?.side ?? "w";
  board.orientation(credential?.side ?? "w");
  connection = new Connection(code, credential, {
    state: accept,
    status: (text) => {
      status.textContent = text;
    },
    error: showError,
  });
}
function enter(credential: Credential): void {
  connect(credential.code, credential);
}
function watch(code: string): void {
  connect(code);
}
async function start(): Promise<void> {
  renderCharacters();
  board.preview(createPosition({ shuffled: false }));
  byId("rules").addEventListener("click", ruleDialog);
  const frame = document.querySelector<HTMLElement>(".board-frame")!;
  const faces = byId<HTMLButtonElement>("faces");
  const setFaces = (enabled: boolean): void => {
    frame.classList.toggle("portraits", enabled);
    faces.setAttribute("aria-pressed", String(enabled));
    localStorage.setItem("brotherchess-faces", String(enabled));
  };
  setFaces(localStorage.getItem("brotherchess-faces") === "true");
  faces.addEventListener("click", () =>
    setFaces(!frame.classList.contains("portraits")),
  );
  byId("cancel").addEventListener("click", () => board.cancel());
  byId("flip").addEventListener("click", () => {
    board.flip();
    byId("game").dataset.orientation =
      byId("game").dataset.orientation === "b" ? "w" : "b";
    renderPlayers();
  });
  const code = location.pathname.match(/^\/room\/([A-HJKMNP-Z2-9]{6})$/)?.[1];
  if (!code) {
    lobby(sidebar, enter, watch, showError);
    return;
  }
  const key = recall(code);
  if (key) {
    enter(key);
    return;
  }
  try {
    const view = await api<Snapshot>("/api/rooms/" + code);
    current = view;
    board.update(view);
    renderCharacters();
    renderPlayers();
    lobby(sidebar, enter, watch, showError, view);
    status.textContent = "Choose a seat or watch";
  } catch (error) {
    showError(error instanceof Error ? error.message : "Room not found.");
    lobby(sidebar, enter, watch, showError);
  }
}
setInterval(clocks, 100);
void start();
