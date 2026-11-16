import { MatchRoom, type Env } from "./room";
import { boundedText } from "./validation";
import { randomInt } from "./session";
export { MatchRoom };
const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeCode = (): string =>
  Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(
    "",
  );
function originAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return request.method === "GET";
  return origin === env.APP_ORIGIN || origin === new URL(request.url).origin;
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const response = await route(request, env);
      if (response.status === 101) return response;
      const result = new Response(response.body, response);
      if (new URL(request.url).pathname.startsWith("/api/"))
        result.headers.set("Cache-Control", "no-store");
      return result;
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Could not process this request.",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
  },
} satisfies ExportedHandler<Env>;
async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (!originAllowed(request, env))
    return Response.json({ error: "Origin not allowed." }, { status: 403 });
  if (url.pathname === "/api/health") return Response.json({ ready: true });
  if (url.pathname === "/api/rooms" && request.method === "POST")
    return createRoom(request, env);
  const route = url.pathname.match(
    /^\/api\/rooms\/([A-HJKMNP-Z2-9]{6})(\/(join|ws))?$/,
  );
  if (!route)
    return Response.json({ error: "Room not found." }, { status: 404 });
  if (
    request.method !== "GET" &&
    !(request.method === "POST" && route[3] === "join")
  )
    return new Response("Method not allowed", { status: 405 });
  const room = env.ROOMS.get(env.ROOMS.idFromName(route[1]));
  return room.fetch(request);
}
async function createRoom(request: Request, env: Env): Promise<Response> {
  const limiter = await env.CREATE_ROOM_LIMITER.limit({
    key: request.headers.get("CF-Connecting-IP") ?? "local",
  });
  if (!limiter.success)
    return Response.json(
      { error: "Too many new rooms. Try again in a minute." },
      { status: 429 },
    );
  const text = await boundedText(request);
  if (text.length > 2048)
    return Response.json({ error: "Message too large." }, { status: 413 });
  for (let i = 0; i < 3; i++) {
    const code = makeCode(),
      url = new URL(request.url);
    url.pathname = "/api/rooms/" + code + "/create";
    const response = await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(
      new Request(url, {
        method: "POST",
        body: text,
        headers: { "Content-Type": "application/json" },
      }),
    );
    if (response.status !== 409) return response;
  }
  return Response.json(
    { error: "Please try creating the room again." },
    { status: 503 },
  );
}
