import type { Action } from "../rules/types";
import type { Snapshot } from "../shared/protocol";
export interface Credential {
  code: string;
  token: string;
  side: "w" | "b";
}
export interface NetworkEvents {
  state: (state: Snapshot) => void;
  status: (status: string) => void;
  error: (message: string) => void;
}
export class Connection {
  private socket?: WebSocket;
  private timer?: ReturnType<typeof setTimeout>;
  private attempt = 0;
  private stopped = false;
  constructor(
    private code: string,
    private credential: Credential | undefined,
    private events: NetworkEvents,
  ) {
    this.open();
  }
  private open(): void {
    this.events.status(this.attempt ? "Reconnecting…" : "Connecting…");
    const url = new URL("/api/rooms/" + this.code + "/ws", location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const protocols = ["brotherchess"];
    if (this.credential) protocols.push("auth." + this.credential.token);
    const socket = new WebSocket(url, protocols);
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.attempt = 0;
      this.events.status("Connected");
    });
    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.type === "state") this.events.state(message as Snapshot);
        else if (message.type === "error")
          this.events.error(String(message.message));
      } catch {
        this.events.error(
          "Could not read the game update. Reconnect to restore it.",
        );
      }
    });
    socket.addEventListener("close", () => {
      if (this.stopped) return;
      this.events.status("Connection lost · your game is saved");
      this.timer = setTimeout(
        () => {
          this.attempt++;
          this.open();
        },
        Math.min(1000 * 2 ** this.attempt, 15000),
      );
    });
    socket.addEventListener("error", () =>
      this.events.status("Connection interrupted"),
    );
  }
  send(type: "resign" | "offer-draw" | "accept-draw", revision: number): void {
    this.write({ type, revision });
  }
  play(action: Action, revision: number): void {
    this.write({ type: "action", action, revision });
  }
  private write(value: unknown): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.events.error("Reconnect before making a move.");
      return;
    }
    this.socket.send(JSON.stringify(value));
  }
  close(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    this.socket?.close();
  }
}
export function remember(credential: Credential): void {
  localStorage.setItem(
    "brotherchess-room-" + credential.code,
    JSON.stringify(credential),
  );
}
export function recall(code: string): Credential | undefined {
  try {
    const value = JSON.parse(
      localStorage.getItem("brotherchess-room-" + code) ?? "null",
    ) as Credential | null;
    return value?.code === code && typeof value.token === "string"
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
export async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: data === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Could not load the room.");
  return result;
}
