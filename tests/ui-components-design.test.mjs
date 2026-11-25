import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Pagination implements Figma spec: page-size dropdown and capsule pill page navigation", () => {
  const content = fs.readFileSync("components/Pagination.tsx", "utf8");
  assert.match(content, /pageSizeOptions/);
  assert.match(content, /rounded-full border border-slate-200/);
  assert.match(content, /bg-\[#1D60FF\]|bg-blue-600/);
  assert.match(content, /per halaman|per page/i);
});

test("CalendarModal implements Figma spec: month navigation, weekend red styling, and blue active date pill", () => {
  const content = fs.readFileSync("components/CalendarModal.tsx", "utf8");
  assert.match(content, /text-\[#EF4444\]|text-red-500/);
  assert.match(content, /bg-\[#2563EB\]|bg-blue-600/);
  assert.match(content, /Sun/);
  assert.match(content, /Sat/);
  assert.match(content, /export const Calendar/);
  assert.match(content, /export const CalendarModal/);
});

test("AlertModal implements Figma spec: SuccessAlertModal (green check, blue Yes) and ConfirmDeleteModal (red border, question mark, Yes/No buttons)", () => {
  const content = fs.readFileSync("components/AlertModal.tsx", "utf8");
  assert.match(content, /export const SuccessAlertModal/);
  assert.match(content, /export const ConfirmDeleteModal/);
  assert.match(content, /border-2 border-\[#DC2626\]|border-red-600/);
  assert.match(content, /bg-\[#D1FAE5\]|bg-emerald-100/);
  assert.match(content, /bg-\[#1D60FF\]|bg-blue-600/);
  assert.match(content, /bg-\[#DC2626\]|bg-red-600/);
});

test("ActionMenu and StatusBanner match Figma design specifications", () => {
  const actionContent = fs.readFileSync("components/ActionMenu.tsx", "utf8");
  assert.match(actionContent, /text-\[#DC2626\]|text-red-600/);
  assert.match(actionContent, /bg-\[#E2E8F0\]|bg-slate-200/);
  assert.match(actionContent, /export const ActionMenu/);

  const bannerContent = fs.readFileSync("components/StatusBanner.tsx", "utf8");
  assert.match(bannerContent, /bg-\[#ECFDF5\]/);
  assert.match(bannerContent, /SUCCEED/);
  assert.match(bannerContent, /export const StatusBanner/);
});

test("CustomDropdown supports pill variant and Figma menu styling", () => {
  const content = fs.readFileSync("components/CustomDropdown.tsx", "utf8");
  assert.match(content, /variant\?: "default" \| "pill"/);
  assert.match(content, /rounded-full/);
  assert.match(content, /rounded-2xl border border-slate-100/);
  assert.match(content, /bg-\[#E2E8F0\]/);
});

test("Pagination combines data range and page count to prevent collision", () => {
  const content = fs.readFileSync("components/Pagination.tsx", "utf8");
  assert.match(content, /totalItems !== undefined/);
  assert.match(content, /Showing/);
  assert.match(content, /itemLabel/);
});

test("DatePicker is integrated in InvoiceDetailModal and CustomerAnalyticsDetail", () => {
  const invoiceModal = fs.readFileSync("components/InvoiceDetailModal.tsx", "utf8");
  assert.match(invoiceModal, /DatePicker/);
  assert.doesNotMatch(invoiceModal, /type="date"/);

  const customerDetail = fs.readFileSync("components/CustomerAnalyticsDetail.tsx", "utf8");
  assert.match(customerDetail, /DatePicker/);
  assert.doesNotMatch(customerDetail, /type="date"/);
});

test("CustomDropdown replaces native selects in uploaded-documents and matches Figma spec", () => {
  const content = fs.readFileSync("app/uploaded-documents/page.tsx", "utf8");
  assert.match(content, /CustomDropdown/);
  assert.doesNotMatch(content, /<select/);
});

test("SidebarContext provides logout confirmation states and actions", () => {
  const context = fs.readFileSync("components/sidebar-context.tsx", "utf8");
  assert.match(context, /isLogoutConfirmOpen/);
  assert.match(context, /requestLogout/);
  assert.match(context, /closeLogoutConfirm/);
});

test("Sign out confirmation alert modal is rendered in main content page and triggered by Sidebar", () => {
  const sidebar = fs.readFileSync("components/sidebar.tsx", "utf8");
  const appshell = fs.readFileSync("components/appshell.tsx", "utf8");
  assert.match(sidebar, /id="logoutBtn"/);
  assert.match(sidebar, /requestLogout/);
  assert.doesNotMatch(sidebar, /<ConfirmDeleteModal/);
  assert.match(appshell, /<ConfirmDeleteModal/);
  assert.match(appshell, /flex-1[\s\S]*<ConfirmDeleteModal/);
});

test("Header is responsive without collision and Sidebar mobile drawer uses burger collapse button", () => {
  const header = fs.readFileSync("components/Header.tsx", "utf8");
  assert.match(header, /id="breadcrumbLabel"[^>]*hidden md:inline/);

  const account = fs.readFileSync("components/headeraccount.tsx", "utf8");
  assert.match(account, /hidden sm:flex/);

  const sidebar = fs.readFileSync("components/sidebar.tsx", "utf8");
  assert.match(sidebar, /id="mobileSidebarCollapseBtn"/);
  assert.doesNotMatch(sidebar, /<X size={18} \/>/);
});

test("Pagination page-size dropdown is a dropup (bottom-full) to prevent table clipping", () => {
  const content = fs.readFileSync("components/Pagination.tsx", "utf8");
  assert.match(content, /bottom-full mb-1\.5 z-50/);
  assert.doesNotMatch(content, /md:top-full/);
});

test("Pagination supports custom page size input and option", () => {
  const content = fs.readFileSync("components/Pagination.tsx", "utf8");
  assert.match(content, /isCustomMode/);
  assert.match(content, /customValue/);
  assert.match(content, /Custom/);
  assert.match(content, /type="number"/);
});

test("CalendarModal exports PeriodRangeCalendarModal with month navigation and Figma styling", () => {
  const content = fs.readFileSync("components/CalendarModal.tsx", "utf8");
  assert.match(content, /export const PeriodRangeCalendarModal/);
  assert.match(content, /startPeriod/);
  assert.match(content, /endPeriod/);
  assert.match(content, /onApply/);
});

test("SalesOverview period filter uses the original custom month range picker", () => {
  const content = fs.readFileSync("components/Sales Overview/SalesOverview.tsx", "utf8");
  assert.match(content, /MonthRangePicker/);
  assert.match(content, /monthNames\.map/);
  assert.doesNotMatch(content, /CalendarPicker/);
});

test("Uploaded documents pagination uses skeleton loader when loading", () => {
  const content = fs.readFileSync("app/uploaded-documents/page.tsx", "utf8");
  assert.match(content, /loading \?[\s\S]*animate-pulse[\s\S]*<Pagination/);
});

test("Customer analytics filters use CustomDropdown instead of native selects", () => {
  const content = fs.readFileSync("app/customer-analytics/page.tsx", "utf8");
  assert.match(content, /CustomDropdown/);
  assert.doesNotMatch(content, /<select/);
});

test("Uploaded documents and Customer Analytics pass dynamic pageSize and onPageSizeChange to Pagination", () => {
  const uploadContent = fs.readFileSync("app/uploaded-documents/page.tsx", "utf8");
  assert.match(uploadContent, /onPageSizeChange/);
  assert.match(uploadContent, /params\.set\("limit",\s*String\(pageSize\)\)|limit:\s*String\(pageSize\)/);

  const analyticsContent = fs.readFileSync("app/customer-analytics/page.tsx", "utf8");
  assert.match(analyticsContent, /onPageSizeChange/);
  assert.match(analyticsContent, /limit:\s*String\(itemsPerPage\)/);
});

test("OverdueAlertView, SalesOverview, CustomerAnalyticsDetail, and CustomTable support functional onPageSizeChange", () => {
  const overdueContent = fs.readFileSync("components/OverdueAlertView.tsx", "utf8");
  assert.match(overdueContent, /onPageSizeChange/);

  const salesContent = fs.readFileSync("components/Sales Overview/SalesOverview.tsx", "utf8");
  assert.match(salesContent, /onPageSizeChange/);

  const detailContent = fs.readFileSync("components/CustomerAnalyticsDetail.tsx", "utf8");
  assert.match(detailContent, /onPageSizeChange/);

  const customTableContent = fs.readFileSync("components/CustomTable.tsx", "utf8");
  assert.match(customTableContent, /onPageSizeChange/);
});













