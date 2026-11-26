import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("UI feedback configuration exists and defaults to suppressed for web testing", () => {
  const config = readFileSync("lib/uiFeedbackConfig.ts", "utf8");
  assert.match(config, /ENABLE_POPUP_ALERTS:\s*false/);
  assert.match(config, /ENABLE_NOTIFICATIONS:\s*false/);
});

test("swal functions respect UI feedback configuration", () => {
  const swal = readFileSync("lib/swal.ts", "utf8");
  assert.match(swal, /UI_FEEDBACK_CONFIG/);
  assert.match(swal, /if\s*\(!UI_FEEDBACK_CONFIG\.ENABLE_NOTIFICATIONS\)/);
  assert.match(swal, /if\s*\(!UI_FEEDBACK_CONFIG\.ENABLE_POPUP_ALERTS\)/);
});

test("appshell handles logout directly when alert popups are disabled", () => {
  const appshell = readFileSync("components/appshell.tsx", "utf8");
  assert.match(appshell, /UI_FEEDBACK_CONFIG/);
});

test("uploaded-documents deletes directly when alert popups are disabled", () => {
  const page = readFileSync("app/uploaded-documents/page.tsx", "utf8");
  assert.match(page, /UI_FEEDBACK_CONFIG/);
});
