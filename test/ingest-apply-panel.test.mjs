import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { transformSync } from "@babel/core";

const filename = new URL("../src/components/IngestReviewPanel.tsx", import.meta.url).pathname;
const { code } = transformSync(fs.readFileSync(filename, "utf8"), { filename, babelrc: false, configFile: false,
  presets: [["@babel/preset-env", { targets: { node: "current" }, modules: "commonjs" }], "@babel/preset-react", "@babel/preset-typescript"] });

// Controlled hook state exercises the component's real event handlers while the
// network task is held open. No DOM/browser or production server is required.
test("apply stays disabled during indexing and gated proposals cannot be retried", async () => {
  const state = [], effects = [], dependencies = [];
  let cursor = 0, calls = 0, notifyProgress;
  const result = Promise.withResolvers();
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; return state[index] ||= { current: initial }; },
    useMemo: factory => factory(),
    useEffect(effect, deps) {
      const index = cursor++;
      if (!dependencies[index] || deps.some((v, i) => v !== dependencies[index][i])) {
        dependencies[index] = deps; effects.push(effect);
      }
    },
  };
  const store = {
    ingestSession: { panelOpen: true, plan: { operation: "lint" }, proposals: ["saved", "blocked"].map(slug => ({ slug, action: "update", proposed_md: "text", judge_verdict: "trust" })) },
    closeIngestPanel() {}, resetIngest() {},
  };
  const imports = {
    react: hooks,
    "react-hot-toast": { toast: { loading: () => "toast", error() {}, success() {} } },
    "../store/appStore": { useAppStore: select => select(store) },
    "../utils/wikiTask": { wikiTask: (_operation, _body, _signal, progress) => { calls++; notifyProgress = progress; return result.promise; } },
  };
  const compiled = { exports: {} };
  new Function("require", "module", "exports", code)(name => imports[name], compiled, compiled.exports);
  const render = () => { cursor = 0; const tree = compiled.exports.default(); while (effects.length) effects.shift()(); return tree; };
  const nodes = tree => !tree || typeof tree !== "object" ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
  const button = tree => nodes(tree).find(n => n.props?.className === "ingest-panel__apply");
  render();
  const click = button(render()).props.onClick;
  const pending = click();
  await click();
  assert.equal(calls, 1, "double-click cannot create a second task");
  assert.equal(button(render()).props.disabled, true);
  notifyProgress({ phase: "index", applied: [{ slug: "saved" }] });
  const indexing = render();
  assert.equal(button(indexing).props.disabled, true);
  assert.equal(button(indexing).props.children, "Aggiornamento indice…");
  assert.match(nodes(indexing).find(n => n.props?.role === "status").props.children, /1 pagine salvate/);
  result.resolve({ applied: [{ slug: "saved" }], errors: [], gated: [{ slug: "blocked", reason: "Unresolved link" }] });
  const previousWarn = console.warn; console.warn = () => {};
  try { await pending; } finally { console.warn = previousWarn; }
  const finished = render();
  assert.equal(button(finished).props.disabled, true, "neither saved nor gated pages remain eligible");
  const messages = nodes(finished).filter(n => n.type === "p").map(n => n.props.children);
  assert.ok(messages.includes("blocked: Unresolved link"));
  await button(finished).props.onClick();
  assert.equal(calls, 1);
});
