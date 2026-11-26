import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const indonesianTranslations = fs.readFileSync(path.join(rootDir, "lib/i18n/id.ts"), "utf8");

test("Indonesian logout label is Keluar", () => {
  assert.match(indonesianTranslations, /"logout": "Keluar"/);
});

test("Header component implements unified tribe navbar layout and burger button", () => {
  const headerContent = fs.readFileSync(path.join(rootDir, "components/Header.tsx"), "utf8");

  // 1. Burger button compartment and styling
  assert.match(headerContent, /id="burgerBtn"/);
  assert.match(headerContent, /bg-\[#3B6FF5\]/);
  assert.match(headerContent, /toggleSidebar/);

  // 2. Title and breadcrumb
  assert.match(headerContent, /Andima CCR/);
  assert.match(headerContent, /id="breadcrumbLabel"/);

  // 3. Language switcher and notification compartment
  assert.match(headerContent, /switchToEnglish/);
  assert.match(headerContent, /switchToIndonesian/);
  assert.match(headerContent, /id="notifBtn"/);
  assert.match(headerContent, /id="notifBadge"/);
  assert.match(headerContent, /id="notifDropdown"/);

  // 4. HeaderAccount integration
  assert.match(headerContent, /<HeaderAccount \/>/);
});

test("HeaderAccount implements tribe profile avatar and role typography", () => {
  const accountContent = fs.readFileSync(path.join(rootDir, "components/headeraccount.tsx"), "utf8");

  // Avatar with #DBEAFE
  assert.match(accountContent, /bg-\[#DBEAFE\]/);
  assert.match(accountContent, /border-\[#BFDBFE\]/);

  // Typography for name and role
  assert.match(accountContent, /text-\[#121B2E\]/);
  assert.match(accountContent, /text-\[#64748B\]/);
});

test("Sidebar implements tribe color scheme, ANDIMA logo image, active state, and collapse", () => {
  const sidebarContent = fs.readFileSync(path.join(rootDir, "components/sidebar.tsx"), "utf8");

  // 1. Dark Navy background & collapse transition
  assert.match(sidebarContent, /bg-\[#0F2342\]/);
  assert.match(sidebarContent, /isCollapsed/);
  assert.match(sidebarContent, /md:w-0/);

  // 2. ANDIMA Logo Image
  assert.match(sidebarContent, /\/images\/Logo ANDIMA\.png/);
  assert.match(sidebarContent, /alt="Logo ANDIMA"/);

  // 3. CCR Menu button and submenu styling
  assert.match(sidebarContent, /id="ccrToggleBtn"/);
  assert.match(sidebarContent, /bg-\[#0550D7\]/);
  assert.match(sidebarContent, /bg-\[#263B5E\]/);
  assert.match(sidebarContent, /bg-\[#B0C6D4\]/);
  assert.match(sidebarContent, /bg-\[#14B8A6\]/);

  // 4. Red pill logout button
  assert.match(sidebarContent, /id="logoutBtn"/);
  assert.match(sidebarContent, /border-\[#D92D43\]/);
  assert.match(sidebarContent, /text-\[#D92D43\]/);
});

test("AppShell integrates SidebarProvider and responsive drawer/collapse padding", () => {
  const appshellContent = fs.readFileSync(path.join(rootDir, "components/appshell.tsx"), "utf8");

  assert.match(appshellContent, /<SidebarProvider>/);
  assert.match(appshellContent, /md:pl-0/);
  assert.match(appshellContent, /md:pl-\[250px\]/);
  assert.match(appshellContent, /closeMobileSidebar/);
});

test("FollowUpFormSkeleton is used in create and edit routes and views to eliminate blank screens", () => {
  // 1. Skeleton component exists and has rich structure
  const skeletonContent = fs.readFileSync(path.join(rootDir, "components/FollowUpFormSkeleton.tsx"), "utf8");
  assert.match(skeletonContent, /FollowUpFormSkeleton/);
  assert.match(skeletonContent, /Invoice Overview Card Skeleton/);
  assert.match(skeletonContent, /Follow-Up Form Card Skeleton/);

  // 2. Route loading.tsx files exist and import the skeleton
  const createLoading = fs.readFileSync(path.join(rootDir, "app/overdue-alert/[invoiceId]/create/loading.tsx"), "utf8");
  assert.match(createLoading, /FollowUpFormSkeleton/);

  const editLoading = fs.readFileSync(path.join(rootDir, "app/overdue-alert/[invoiceId]/edit/loading.tsx"), "utf8");
  assert.match(editLoading, /FollowUpFormSkeleton/);

  // 3. Create and Edit views use FollowUpFormSkeleton isInnerOnly
  const createView = fs.readFileSync(path.join(rootDir, "components/OverdueInvoiceCreateView.tsx"), "utf8");
  assert.match(createView, /<FollowUpFormSkeleton isInnerOnly \/>/);

  const editView = fs.readFileSync(path.join(rootDir, "components/OverdueInvoiceEditView.tsx"), "utf8");
  assert.match(editView, /<FollowUpFormSkeleton isInnerOnly \/>/);
});

test("OverdueInvoicePreviewSkeleton and ActivityHistorySkeleton provide loading skeleton for preview follow up", () => {
  // 1. Preview skeleton file exists and exports components
  const previewSkeleton = fs.readFileSync(path.join(rootDir, "components/OverdueInvoicePreviewSkeleton.tsx"), "utf8");
  assert.match(previewSkeleton, /export function ActivityHistorySkeleton/);
  assert.match(previewSkeleton, /export function OverdueInvoicePreviewSkeleton/);
  assert.match(previewSkeleton, /Loading activity history/);
  assert.match(previewSkeleton, /Loading invoice preview/);

  // 2. OverdueInvoicePreviewModal uses the skeleton
  const modalContent = fs.readFileSync(path.join(rootDir, "components/OverdueInvoicePreviewModal.tsx"), "utf8");
  assert.match(modalContent, /OverdueInvoicePreviewSkeleton/);
  assert.match(modalContent, /ActivityHistorySkeleton/);
  assert.match(modalContent, /historyLoading/);
  assert.match(modalContent, /isLoading/);

  // 3. OverdueAlertView manages historyLoading state and passes it to preview modal
  const overdueView = fs.readFileSync(path.join(rootDir, "components/OverdueAlertView.tsx"), "utf8");
  assert.match(overdueView, /historyLoading/);
  assert.match(overdueView, /setHistoryLoading/);
  assert.match(overdueView, /historyLoading=\{historyLoading\}/);
});
