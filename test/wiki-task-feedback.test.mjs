import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { transformSync } from "@babel/core";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Render the actual TSX without adding a browser/test framework dependency.
const filename = new URL("../src/components/WikiTaskFeedback.tsx", import.meta.url).pathname;
const source = fs.readFileSync(filename, "utf8");
const { code } = transformSync(source, { filename, babelrc: false, configFile: false,
  presets: [["@babel/preset-env", { targets: { node: "current" }, modules: "commonjs" }], "@babel/preset-react", "@babel/preset-typescript"] });
const compiled = { exports: {} };
new Function("require", "module", "exports", code)(createRequire(import.meta.url), compiled, compiled.exports);
const Feedback = compiled.exports.default;

test("operation failures stay visible in an accessible themed alert", () => {
  const html = renderToStaticMarkup(React.createElement(Feedback, { error: "lint: Worker unavailable", rejected: [], report: "" }));
  assert.match(html, /role="alert"/);
  assert.match(html, /dm-settings__error/);
  assert.match(html, /lint: Worker unavailable/);
});

test("a partial lint shows its report and rejected page reasons without offering them for apply", () => {
  const html = renderToStaticMarkup(React.createElement(Feedback, {
    error: "", report: "Rapporto conservato", reviewCount: 1,
    rejected: [{ slug: "campaign-s098", code: "classification-change", reason: "Classification change requires a separate review." }],
  }));
  assert.match(html, /Rapporto conservato/);
  assert.match(html, /campaign-s098/);
  assert.match(html, /Classification change requires a separate review/);
  assert.match(html, /1 proposal ready for review/);
  assert.doesNotMatch(html, /<button/);
});

test("all-rejected results do not imply there are approved or applicable changes", () => {
  const html = renderToStaticMarkup(React.createElement(Feedback, {
    error: "", report: "Report", reviewCount: 0, rejected: [{ slug: null, code: "invalid-proposal", reason: "Invalid Markdown" }],
  }));
  assert.match(html, /No proposals ready for review/);
  assert.match(html, /Unnamed proposal/);
  assert.match(html, /No page changes have been applied/);
});
