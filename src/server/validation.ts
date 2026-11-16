import {
  validSquare,
  type Action,
  type Role,
  type Side,
  type Step,
} from "../rules/types";
import type { Command } from "../shared/protocol";
type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid message.");
  return value as ObjectValue;
}
function step(value: unknown): Step {
  const row = object(value);
  if (!validSquare(row.from) || !validSquare(row.to))
    throw new Error("Invalid square.");
  if (
    row.promotion !== undefined &&
    !["q", "r", "b", "n"].includes(String(row.promotion))
  )
    throw new Error("Invalid promotion.");
  return {
    from: row.from,
    to: row.to,
    ...(row.promotion ? { promotion: row.promotion as Role } : {}),
  };
}
export function action(value: unknown): Action {
  const row = object(value);
  if (row.type === "rescue") {
    if (!validSquare(row.to)) throw new Error("Invalid rescue square.");
    return { type: "rescue", to: row.to };
  }
  if (row.type !== "move") throw new Error("Unknown action.");
  if (row.revive !== undefined && typeof row.revive !== "boolean")
    throw new Error("Invalid revival.");
  return {
    type: "move",
    ...step(row),
    ...(row.extra ? { extra: step(row.extra) } : {}),
    ...(row.revive === true ? { revive: true } : {}),
  };
}
export function command(value: unknown): Command {
  const row = object(value);
  if (row.type === "sync") return { type: "sync" };
  if (!Number.isSafeInteger(row.revision) || Number(row.revision) < 0)
    throw new Error("Invalid board revision.");
  const revision = Number(row.revision);
  if (row.type === "action")
    return { type: "action", action: action(row.action), revision };
  if (
    row.type === "resign" ||
    row.type === "offer-draw" ||
    row.type === "accept-draw"
  )
    return { type: row.type, revision };
  throw new Error("Unknown command.");
}
export function setup(value: unknown): {
  name: string;
  host: Side;
  minutes: number;
  shuffled: boolean;
  underdog?: Side;
} {
  const row = object(value),
    name = playerName(row.name);
  const host =
    row.side === "b"
      ? "b"
      : row.side === "w"
        ? "w"
        : crypto.getRandomValues(new Uint8Array(1))[0] % 2
          ? "w"
          : "b";
  const minutes = Number(row.minutes ?? 10);
  if (![3, 5, 10, 15, 30].includes(minutes))
    throw new Error("Choose a supported time control.");
  if (row.underdog !== undefined && !["w", "b"].includes(String(row.underdog)))
    throw new Error("Invalid underdog.");
  return {
    name,
    host,
    minutes,
    shuffled: row.shuffled !== false,
    ...(row.underdog ? { underdog: row.underdog as Side } : {}),
  };
}
export function playerName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a display name.");
  const name = Array.from(value.trim())
    .filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127)
    .join("");
  if (name.length < 1 || name.length > 24)
    throw new Error("Use a name between 1 and 24 characters.");
  return name;
}
export async function boundedText(request: Request): Promise<string> {
  if (Number(request.headers.get("Content-Length")) > 2048)
    throw new Error("Message too large.");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) {
      await reader.cancel();
      throw new Error("Message too large.");
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(combined);
}
export async function body(request: Request): Promise<unknown> {
  return JSON.parse(await boundedText(request));
}
export function joinName(value: unknown): string {
  return playerName(object(value).name);
}
