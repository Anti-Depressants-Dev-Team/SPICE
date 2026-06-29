const { spawn } = require("child_process");
const electron = require("electron");

const child = spawn(electron, ["."], {
  stdio: "inherit",
  env: {
    ...process.env,
    SPICE_NATIVE_APP: "1",
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code || 0);
});
