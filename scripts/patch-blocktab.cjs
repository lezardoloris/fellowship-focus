const fs = require("fs");
const path = "web/src/components/BlockTab.tsx";
const replPath = "scripts/blocktab-main-jsx.txt";
let s = fs.readFileSync(path, "utf8");
const next = fs.readFileSync(replPath, "utf8");
const start = s.indexOf('    <div className="space-y-5">');
const end = s.indexOf("\nfunction Stepper(");
if (start < 0 || end < 0) {
  console.error("markers", start, end);
  process.exit(1);
}
fs.writeFileSync(path, s.slice(0, start) + next + s.slice(end));
console.log("ok", start, end);
