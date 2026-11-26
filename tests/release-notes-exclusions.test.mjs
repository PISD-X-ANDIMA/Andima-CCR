import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

test("docs/RELEASE_NOTES_v1.1.0.md exists and strictly adheres to exclusion, no-emoji, and content rules", (t) => {
  const filePath = path.resolve("docs/RELEASE_NOTES_v1.1.0.md");
  if (!fs.existsSync(filePath)) {
    t.skip("docs/ directory is ignored by git");
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");

  // No emoji rule
  assert.ok(!EMOJI_REGEX.test(content), "docs/RELEASE_NOTES_v1.1.0.md must not contain any emojis");

  // Exclusions: No C1 -> A1 table migration
  assert.ok(!content.includes("c1_customer"), "Must not mention c1_customer");
  assert.ok(!content.includes("a1_customers"), "Must not mention a1_customers");
  assert.ok(!/perpindahan table|perpindahan tabel|migrasi.*a1/i.test(content), "Must not mention customer table migration to a1");

  // Exclusions: No MID escalations
  assert.ok(!content.includes("c1_mid_escalations"), "Must not mention c1_mid_escalations");
  assert.ok(!/eskalasi.*mid|mid.*eskalasi|escalation/i.test(content), "Must not mention MID escalations");

  // Exclusions: No branch removal/decoupling
  assert.ok(!/penghapusan.*branch|penghapusan.*cabang|decoupling.*branch/i.test(content), "Must not mention branch removal");

  // Inclusions: Customer Invoices rebrand & invoice counts
  assert.ok(/customer invoices|faktur pelanggan/i.test(content), "Must mention Customer Invoices");
  assert.ok(/invoice count|jumlah invoice/i.test(content), "Must mention invoice count subtitle");

  // Inclusions: Cost sort filter
  assert.ok(/cost|biaya operasional/i.test(content), "Must mention Cost sort filter");

  // Inclusions: Author-only follow up log protection
  assert.ok(/author|hanya pembuat|pembuat log/i.test(content), "Must mention author-only edit/delete protection for follow up logs");
});

test("docs/UNRELEASED_NOTES.md exists and contains excluded architectural, MID escalation, and branch notes without emojis", (t) => {
  const filePath = path.resolve("docs/UNRELEASED_NOTES.md");
  if (!fs.existsSync(filePath)) {
    t.skip("docs/ directory is ignored by git");
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");

  // No emoji rule
  assert.ok(!EMOJI_REGEX.test(content), "docs/UNRELEASED_NOTES.md must not contain any emojis");

  // Inclusions for unreleased notes:
  assert.ok(content.includes("c1_customer") && content.includes("a1_customers"), "Must document c1_customer to a1_customers migration");
  assert.ok(content.includes("c1_mid_escalations") || /mid/i.test(content), "Must document MID escalations table and trigger sync");
  assert.ok(/branch|cabang/i.test(content), "Must document branch removal/decoupling");
});

test("docs/RELEASE_NOTES.md index has no emojis and links v1.1.0 and unreleased notes", (t) => {
  const filePath = path.resolve("docs/RELEASE_NOTES.md");
  if (!fs.existsSync(filePath)) {
    t.skip("docs/ directory is ignored by git");
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");

  assert.ok(!EMOJI_REGEX.test(content), "docs/RELEASE_NOTES.md must not contain any emojis");
  assert.ok(content.includes("v1.1.0-staging"), "Must include v1.1.0-staging");
  assert.ok(content.includes("docs/RELEASE_NOTES_v1.1.0.md"), "Must link v1.1.0 release notes");
  assert.ok(content.includes("docs/UNRELEASED_NOTES.md"), "Must link unreleased notes");
});
