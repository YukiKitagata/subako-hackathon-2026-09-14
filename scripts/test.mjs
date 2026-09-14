import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
async function find(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", "dist"].includes(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await find(path)));
    else if (/\.test\.(ts|mjs)$/.test(entry.name)) files.push(path);
  }
  return files;
}
const files = [...(await find("apps")), ...(await find("scripts"))];
if (!files.length) throw new Error("テストがありません");
const child = spawn(process.execPath, ["--import", "tsx", "--test", ...files], {
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
