import { spawn } from "child_process";

const processes = [
  ["server:a", ["src/server.js", "A", "8001", "8002"]],
  ["server:b", ["src/server.js", "B", "8002", "8001"]],
  ["gateway", ["src/gateway.js"]]
];

const children = processes.map(([name, args]) => {
  const child = spawn(process.execPath, args, {
    stdio: "pipe",
    shell: false
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on("exit", (code, signal) => {
    console.log(`[${name}] exited with ${signal || code}`);
  });

  return child;
});

function stopAll() {
  children.forEach((child) => {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  });
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});
