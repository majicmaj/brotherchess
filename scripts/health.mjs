import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
  encoding: "utf8",
})
  .trim()
  .split("\n");
const errors = [];
for (const file of new Set(files)) {
  if (!existsSync(file)) continue;
  const data = readFileSync(file);
  if (data.includes(0)) continue;
  const text = data.toString();
  const lines = text.trimEnd().split("\n").length;
  if (lines > 800) errors.push(`${file}: ${lines} lines exceeds 800`);
  if (/(?:^|\n)(?:CLOUDFLARE_API_TOKEN|DISCORD_TOKEN)\s*=\s*[^\s$]/.test(text))
    errors.push(`${file}: possible credential`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `Health gates passed: ${new Set(files).size} tracked/source files, max 800 lines.`,
);
