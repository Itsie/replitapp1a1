import { spawn } from "node:child_process";

const p = spawn("npx", ["ts-node", "--transpile-only", "server/index.ts"], {
  stdio: "inherit",
  shell: true
});

p.on("close", (code) => process.exit(code ?? 0));
