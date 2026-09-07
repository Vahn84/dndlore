import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as sass from "sass";

const css = sass.compile(new URL("../src/styles/DmSettings.scss", import.meta.url).pathname).css;
const component = fs.readFileSync(new URL("../src/components/WikiMaintenance.tsx", import.meta.url), "utf8");
const declarations = selector => css.slice(css.indexOf(`${selector} {`)).split("}")[0];

test("DM cards provide a light inherited color for status, answers and reports", () => {
  assert.match(declarations(".dm-settings__card"), /(?:^|;)\s*color:\s*#e2e8f0/);
});

test("pending status uses its themed style instead of browser-default text", () => {
  assert.match(component, /className="dm-settings__status" role="status"/);
  assert.match(declarations(".dm-settings__status"), /color: rgb\(208, 179, 115\)/);
  assert.match(declarations(".dm-settings__status"), /font-family: "Montserrat", sans-serif/);
});

test("shared toggle retains label association and keyboard focus", () => {
  assert.match(component, /className="input-checkbox input-checkbox-light"/);
  assert.match(component, /aria-labelledby="wiki-include-spoilers-label"/);
  assert.equal((component.match(/htmlFor="wiki-include-spoilers"/g) || []).length, 2);
  assert.match(declarations(".dm-settings__checkbox.checkbox-wrapper .input-checkbox"), /display: block/);
  assert.match(css, /:focus-visible \+ \.input-checkbox-btn/);
});
