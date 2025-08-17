// scripts/control.js

const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("🚀 MEV Bot Control CLI");
console.log("1. List Modules\n2. Restart Watchdog\n3. Exit");

rl.on("line", (input) => {
  switch (input.trim()) {
    case "1":
      console.log("Available modules: simulateBundle, gptRouter, watchdog");
      break;
    case "2":
      console.log("Restarting watchdog...");
      break;
    case "3":
      console.log("Exiting CLI");
      process.exit(0);
    default:
      console.log("Invalid option");
  }
});

