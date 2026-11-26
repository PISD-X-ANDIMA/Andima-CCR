import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("i18n dictionaries contain all required overdue keys", async () => {
  const idPath = path.join(rootDir, "lib", "i18n", "id.ts");
  const enPath = path.join(rootDir, "lib", "i18n", "en.ts");

  const idContent = fs.readFileSync(idPath, "utf-8");
  const enContent = fs.readFileSync(enPath, "utf-8");

  const requiredKeys = [
    "notesRequired",
    "promiseDateRequired",
    "paymentAmountRequired",
    "proofRequired",
    "managementCannotCreate",
    "managementStaffGuidance",
    "staffOnlySubmitBtn",
    "records",
    "noHistoryYet",
    "historyEmptyDesc",
    "authorOnly",
    "deleteCompletedNotice",
  ];

  for (const key of requiredKeys) {
    assert.ok(
      idContent.includes(`"${key}":`),
      `lib/i18n/id.ts must contain key: ${key}`
    );
    assert.ok(
      enContent.includes(`"${key}":`),
      `lib/i18n/en.ts must contain key: ${key}`
    );
  }
});

test("OverdueInvoiceCreateView contains language toggle and inline field errors", async () => {
  const filePath = path.join(rootDir, "components", "OverdueInvoiceCreateView.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  // Language switcher in header
  assert.ok(
    content.includes('onClick={() => setLanguage("en")}'),
    "OverdueInvoiceCreateView must include EN language toggle"
  );
  assert.ok(
    content.includes('onClick={() => setLanguage("id")}'),
    "OverdueInvoiceCreateView must include ID language toggle"
  );

  // Inline field errors
  assert.ok(
    content.includes("fieldErrors.notes"),
    "OverdueInvoiceCreateView must render fieldErrors.notes"
  );
  assert.ok(
    content.includes("fieldErrors.promiseDate"),
    "OverdueInvoiceCreateView must render fieldErrors.promiseDate"
  );
  assert.ok(
    content.includes("fieldErrors.paymentAmount"),
    "OverdueInvoiceCreateView must render fieldErrors.paymentAmount"
  );
  assert.ok(
    content.includes("fieldErrors.evidenceFile"),
    "OverdueInvoiceCreateView must render fieldErrors.evidenceFile"
  );

  // Submit button disabled for management
  assert.ok(
    content.includes('userRole === "MANAGEMENT"'),
    "OverdueInvoiceCreateView must check userRole === MANAGEMENT"
  );
  assert.ok(
    content.includes("staffOnlySubmitBtn"),
    "OverdueInvoiceCreateView must render staffOnlySubmitBtn"
  );

  // Internationalized history section (no hardcoded English)
  assert.ok(
    content.includes('t("overdue.historyTitle"'),
    "History title must use t('overdue.historyTitle')"
  );
  assert.ok(
    content.includes('t("overdue.noHistoryYet"'),
    "No history message must use t('overdue.noHistoryYet')"
  );
  assert.ok(
    content.includes('t("overdue.historyEmptyDesc"'),
    "History empty description must use t('overdue.historyEmptyDesc')"
  );
});

test("OverdueInvoiceEditView contains language toggle and inline field errors", async () => {
  const filePath = path.join(rootDir, "components", "OverdueInvoiceEditView.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  // Language switcher in header
  assert.ok(
    content.includes('onClick={() => setLanguage("en")}'),
    "OverdueInvoiceEditView must include EN language toggle"
  );
  assert.ok(
    content.includes('onClick={() => setLanguage("id")}'),
    "OverdueInvoiceEditView must include ID language toggle"
  );

  // Inline field errors in edit modal
  assert.ok(
    content.includes("editFieldErrors.notes"),
    "OverdueInvoiceEditView must render editFieldErrors.notes"
  );
  assert.ok(
    content.includes("editFieldErrors.promiseDate"),
    "OverdueInvoiceEditView must render editFieldErrors.promiseDate"
  );
  assert.ok(
    content.includes("editFieldErrors.paymentAmount"),
    "OverdueInvoiceEditView must render editFieldErrors.paymentAmount"
  );

  // Internationalized history items
  assert.ok(
    content.includes('t("overdue.collectionPicAssignment"'),
    "Must use t('overdue.collectionPicAssignment')"
  );
  assert.ok(
    content.includes('t("overdue.authorOnly"'),
    "Must use t('overdue.authorOnly')"
  );
  assert.ok(
    content.includes('t("overdue.deleteCompletedNotice"'),
    "Must use t('overdue.deleteCompletedNotice')"
  );
});
