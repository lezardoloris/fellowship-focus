import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, "../src/lib/githubActivity.ts");
const src = fs.readFileSync(srcPath, "utf8");
const { outputText } = ts.transpileModule(src, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: "githubActivity.ts",
});
const out = path.join(__dirname, ".githubActivity.test.cjs");
fs.writeFileSync(out, outputText);
const require = createRequire(import.meta.url);
const { parseGithubUsername, aggregateGithubEvents } = require(out);

assert.equal(parseGithubUsername("octocat"), "octocat");
assert.equal(parseGithubUsername("@octocat"), "octocat");
assert.equal(parseGithubUsername("https://github.com/octocat"), "octocat");
assert.equal(parseGithubUsername("github.com/octocat/hello"), "octocat");
assert.equal(parseGithubUsername("https://github.com/settings"), null);
assert.equal(parseGithubUsername("-bad"), null);

const now = new Date().toISOString();
const stats = aggregateGithubEvents("octocat", [
  {
    type: "PushEvent",
    created_at: now,
    repo: { name: "octocat/hello" },
    payload: { size: 3 },
  },
  {
    type: "PullRequestEvent",
    created_at: now,
    repo: { name: "octocat/hello" },
    payload: { action: "opened" },
  },
  {
    type: "PullRequestReviewEvent",
    created_at: now,
    repo: { name: "octocat/hello" },
  },
]);

assert.equal(stats.commits, 3);
assert.equal(stats.prs, 1);
assert.equal(stats.reviews, 1);
assert.equal(stats.repos, 1);
assert.ok(stats.activeDays >= 1);

fs.unlinkSync(out);
console.log("ok — githubActivity tests passed");
