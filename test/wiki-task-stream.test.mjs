import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "@babel/core";

const filename = new URL("../src/utils/wikiTask.ts", import.meta.url).pathname;
const { code } = transformSync(fs.readFileSync(filename, "utf8"), { filename, babelrc: false, configFile: false,
  presets: [["@babel/preset-env", { targets: { node: "current" }, modules: "commonjs" }], "@babel/preset-typescript"] });
const compiled = { exports: {} };
new Function("require", "module", "exports", "localStorage", code)(() => ({ getBaseUrl: () => "http://offline.invalid" }), compiled, compiled.exports, { getItem: () => "synthetic-token" });
const { wikiTask } = compiled.exports;

test("save progress reaches the UI while apply remains pending through index completion", { timeout: 1000 }, async t => {
  const progressSeen = Promise.withResolvers();
  let stream;
  const encoder = new TextEncoder();
  t.mock.method(globalThis, "fetch", async () => new Response(new ReadableStream({ start(controller) { stream = controller; } })));
  let completed = false;
  const pending = wikiTask("ingest/apply", {}, undefined, progressSeen.resolve).then(result => { completed = true; return result; });
  stream.enqueue(encoder.encode('event: progress\ndata: {"phase":"index","applied":[{"slug":"saved-page"}]}\n\n'));
  assert.equal((await progressSeen.promise).applied[0].slug, "saved-page");
  assert.equal(completed, false);
  stream.enqueue(encoder.encode('event: result\ndata: {"applied":[{"slug":"saved-page"}],"errors":[],"gated":[]}\n\n'));
  stream.close();
  assert.equal((await pending).applied.length, 1);
});

test("an error after save progress is still reported, not mistaken for completion", async t => {
  const progress = [];
  t.mock.method(globalThis, "fetch", async () => new Response('event: progress\ndata: {"phase":"index","applied":[{"slug":"saved-page"}]}\n\nevent: error\ndata: {"error":"Index interrupted"}\n\n'));
  await assert.rejects(wikiTask("ingest/apply", {}, undefined, p => progress.push(p)), /Index interrupted/);
  assert.equal(progress[0].applied[0].slug, "saved-page");
});
