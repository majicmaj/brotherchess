import { build } from "esbuild";
import { mkdir, copyFile, cp } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/client/main.ts"],
  bundle: true,
  external: ["/avatars/*"],
  format: "esm",
  target: ["es2022"],
  minify: true,
  outfile: "dist/app.js",
  sourcemap: false,
  legalComments: "eof",
  loader: { ".svg": "dataurl" },
});
await copyFile("src/client/index.html", "dist/index.html");
await copyFile("LICENSE", "dist/LICENSE.txt");

await cp("assets/avatars", "dist/avatars", { recursive: true });
await copyFile("src/client/_headers", "dist/_headers");
