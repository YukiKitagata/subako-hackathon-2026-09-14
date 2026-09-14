import { spawn } from "node:child_process";
import { appConfig } from "./apps.mjs";
const app = process.argv[2] ?? "todo";
try {
  const config = appConfig(app);
  console.log(`${config.title}: http://127.0.0.1:${config.port}`);
  const child = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev", "--workspace", `@hackathon/${app}`],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  child.on("exit", (code) => process.exit(code ?? 0));
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
