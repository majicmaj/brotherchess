import { DurableObject } from "cloudflare:workers";
import { other, type Side } from "../rules/types";
import { upgradeMatch } from "./upgrade";
import type { Match } from "../shared/protocol";
import { body, command, joinName, setup } from "./validation";
import { createMatch, hashToken, newToken, perform, snapshot } from "./session";
export interface Env {
  ROOMS: DurableObjectNamespace<MatchRoom>;
  ASSETS: Fetcher;
  CREATE_ROOM_LIMITER: RateLimit;
  APP_ORIGIN: string;
}
interface Attachment {
  side?: Side;
  window: number;
  count: number;
}
export class MatchRoom extends DurableObject<Env> {
  private match?: Match;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY, data TEXT NOT NULL)",
      );
      const rows = ctx.storage.sql
        .exec<{ data: string }>("SELECT data FROM room WHERE id=1")
        .toArray();
      await ctx.storage.deleteAlarm();
      if (rows[0]) {
        const stored = JSON.parse(rows[0].data) as Match;
        this.match = upgradeMatch(stored);
        if ("clocks" in stored || "pending" in stored.position)
          await this.save(this.match);
      }
    });
  }
  async fetch(request: Request): Promise<Response> {
    try {
      if (request.headers.get("Upgrade")?.toLowerCase() === "websocket")
        return await this.upgradeSocket(request);
      if (request.method === "GET")
        return this.match
          ? Response.json(snapshot(this.match))
          : Response.json({ error: "Room not found." }, { status: 404 });
      return await this.ctx.blockConcurrencyWhile(async () => {
        try {
          return await this.change(request);
        } catch (error) {
          return Response.json({ error: message(error) }, { status: 400 });
        }
      });
    } catch (error) {
      return Response.json({ error: message(error) }, { status: 400 });
    }
  }
  private async change(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.endsWith("/create")) return this.create(request);
    if (path.endsWith("/join")) return this.join(request);
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  private async create(request: Request): Promise<Response> {
    if (this.match)
      return Response.json(
        { error: "Room code is already in use." },
        { status: 409 },
      );
    const options = setup(await body(request)),
      token = newToken(),
      code = new URL(request.url).pathname.split("/")[3];
    const match = createMatch(
      code,
      options.name,
      await hashToken(token),
      options.host,
      options.shuffled,
      options.underdog,
    );
    await this.save(match);
    return Response.json({ code, token, side: options.host }, { status: 201 });
  }
  private async join(request: Request): Promise<Response> {
    const match = this.match;
    if (!match)
      return Response.json({ error: "Room not found." }, { status: 404 });
    const side = other(match.host);
    if (match.seats[side])
      return Response.json(
        { error: "Both seats are taken. You can still watch." },
        { status: 409 },
      );
    const name = joinName(await body(request)),
      token = newToken(),
      next = structuredClone(match);
    next.seats[side] = { name, tokenHash: await hashToken(token) };
    next.started = true;
    next.revision++;
    await this.save(next);
    this.broadcast();
    return Response.json({ code: next.code, token, side });
  }
  private async upgradeSocket(request: Request): Promise<Response> {
    const match = this.match;
    if (!match)
      return Response.json({ error: "Room not found." }, { status: 404 });
    const protocols = (request.headers.get("Sec-WebSocket-Protocol") ?? "")
      .split(",")
      .map((v) => v.trim());
    if (!protocols.includes("brotherchess"))
      return new Response("Invalid protocol", { status: 400 });
    const token = protocols.find((p) => p.startsWith("auth."))?.slice(5);
    let side: Side | undefined;
    if (token) {
      const hash = await hashToken(token);
      side = (["w", "b"] as Side[]).find(
        (s) => match.seats[s]?.tokenHash === hash,
      );
      if (!side) return new Response("Invalid room key", { status: 403 });
    }
    if (this.ctx.getWebSockets().length >= 32)
      return new Response("Room is full", { status: 429 });
    const pair = new WebSocketPair(),
      server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      side,
      window: Date.now(),
      count: 0,
    } satisfies Attachment);
    server.send(JSON.stringify(snapshot(match, side)));
    return new Response(null, {
      status: 101,
      webSocket: pair[0],
      headers: { "Sec-WebSocket-Protocol": "brotherchess" },
    });
  }
  async webSocketMessage(
    ws: WebSocket,
    payload: string | ArrayBuffer,
  ): Promise<void> {
    try {
      if (typeof payload !== "string" || payload.length > 2048)
        throw new Error("Message too large.");
      const auth = ws.deserializeAttachment() as Attachment;
      this.rateLimit(ws, auth);
      const input = command(JSON.parse(payload));
      if (input.type === "sync") {
        if (this.match)
          ws.send(JSON.stringify(snapshot(this.match, auth.side)));
        return;
      }
      if (!auth.side) throw new Error("Spectators cannot play.");
      await this.ctx.blockConcurrencyWhile(async () => {
        try {
          if (!this.match) throw new Error("Room not found.");
          await this.save(perform(this.match, input, auth.side!));
          this.broadcast();
        } catch (error) {
          this.sendError(ws, error);
        }
      });
    } catch (error) {
      this.sendError(ws, error);
    }
  }
  private sendError(ws: WebSocket, error: unknown): void {
    try {
      ws.send(JSON.stringify({ type: "error", message: message(error) }));
      if (this.match)
        ws.send(
          JSON.stringify(
            snapshot(
              this.match,
              (ws.deserializeAttachment() as Attachment).side,
            ),
          ),
        );
    } catch {
      ws.close(1011, "Reconnect to restore the game.");
    }
  }
  private rateLimit(ws: WebSocket, auth: Attachment): void {
    const now = Date.now();
    if (now - auth.window >= 1000) {
      auth.window = now;
      auth.count = 0;
    }
    auth.count++;
    ws.serializeAttachment(auth);
    if (auth.count > 12) throw new Error("Slow down a little.");
  }
  private async save(match: Match): Promise<void> {
    this.ctx.storage.sql.exec(
      "INSERT INTO room(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      JSON.stringify(match),
    );
    await this.ctx.storage.sync();
    this.match = match;
  }
  private broadcast(): void {
    if (!this.match) return;
    const view = snapshot(this.match);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const auth = ws.deserializeAttachment() as Attachment;
        ws.send(JSON.stringify({ ...view, side: auth.side }));
      } catch {
        ws.close(1011, "Reconnect to restore the game.");
      }
    }
  }
  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
  }
  webSocketClose(ws: WebSocket, code: number, reason: string): void {
    ws.close([1005, 1006, 1015].includes(code) ? 1000 : code, reason);
  }
  webSocketError(ws: WebSocket): void {
    ws.close(1011, "Reconnect to restore the game.");
  }
}
function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Could not process that request.";
}
