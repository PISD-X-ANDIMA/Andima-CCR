import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const generator = readFileSync(new URL("../components/WarningLetterGenerator.tsx", import.meta.url), "utf8");
const helper = readFileSync(new URL("../lib/warningLetter.ts", import.meta.url), "utf8");
const overdueView = readFileSync(new URL("../components/OverdueAlertView.tsx", import.meta.url), "utf8");

test("warning letter escalation boundaries and ineligible state are defined", () => {
  assert.match(helper, /if \(daysOverdue < 30\) return null/);
  assert.match(helper, /if \(daysOverdue <= 59\) return "SP-1"/);
  assert.match(helper, /if \(daysOverdue <= 90\) return "SP-2"/);
  assert.match(helper, /return "SP-3"/);
  assert.match(generator, /Surat belum tersedia|Letter Not Available/i);
  assert.match(overdueView, /invoice\.days_overdue >= 30/);
});

test("warning letter parameters are read-only except calendar fields", () => {
  assert.match(generator, /ReadonlyField label="(?:Tingkat eskalasi|Escalation Level)"/);
  assert.match(generator, /ReadonlyField label="(?:Nomor registrasi|Registration Number)"/);
  assert.match(generator, /ReadonlyField label="(?:Credit controller bertanggung jawab|Assigned Credit Controller)"/);
  assert.match(generator, /ReadonlyField label="(?:Catatan internal|Internal Notes)"/);
  assert.match(generator, /type="date"/);
  assert.match(generator, /type="datetime-local"/);
  assert.doesNotMatch(generator, /Rekening penampungan|escrowBank|Pratinjau PDF|isPreviewOpen/);
});

test("warning letter PDF filenames and payment/signature content are defined", () => {
  assert.match(generator, /Draft-SP|Draft-Warning-Letter/);
  assert.match(generator, /(?:Surat-Peringatan|Warning-Letter)-\$\{params\.escalationLevel\}/);
  assert.match(helper, /No\. Rekening: \$\{PAYMENT_ACCOUNT\.number\}|Account Number: \$\{PAYMENT_ACCOUNT\.number\}/);
  assert.match(generator, /PT ANDIMA TRANSPORTINDO/);
  assert.match(generator, /Credit Controller/);
  assert.doesNotMatch(generator, /Authorized Signatory/);
});
