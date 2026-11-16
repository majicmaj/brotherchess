import { readFile, writeFile } from "node:fs/promises";
const path = "package-lock.json";
await writeFile(
  path,
  JSON.stringify(JSON.parse(await readFile(path, "utf8"))) + "\n",
);
