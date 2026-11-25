"use client";

import React, { useEffect, useRef, useState } from "react";
import HeaderAccount from "@/components/headeraccount";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSidebar } from "@/components/sidebar-context";

interface HeaderProps {
  pageName: string;
}

export const Header: React.FC<HeaderProps> = ({ pageName }) => {
  const { language, setLanguage, t } = useLanguage();
  const { toggleSidebar } = useSidebar();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const notifRef = useRef<HTMLDivElement | null>(null);

  // Close notifications popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const translatedPageName = (() => {
    switch (pageName) {
      case "Sales Overview":
        return t("nav.salesOverview", pageName);
      case "Uploaded Documents":
        return t("nav.uploadedDocuments", pageName);
      case "Customer Analytics":
        return t("nav.customerAnalytics", pageName);
      case "Overdue Alert":
        return t("nav.overdueAlert", pageName);
      default:
        return pageName;
    }
  })();

  return (
    <header className="h-[58px] bg-[#FFFFFF] border-b border-[#E2E8F0] flex items-center justify-between shrink-0 sticky top-0 z-20">
      {/* Left Group: Burger Toggle + Brand Title & Breadcrumb */}
      <div className="flex items-center h-full min-w-0">
        {/* Burger Button Compartment */}
        <div className="h-full px-3.5 flex items-center justify-center border-r border-[#F1F5F9] shrink-0">
          <button
            id="burgerBtn"
            type="button"
            onClick={toggleSidebar}
            aria-label="Toggle Sidebar"
            className="w-[28px] h-[28px] rounded-[6px] bg-[#3B6FF5] hover:bg-[#2E61E6] active:bg-[#2554D1] flex flex-col items-center justify-center gap-[3.5px] transition-colors cursor-pointer shadow-2xs"
          >
            {/* Three Crisp White (#FFFFFF) Horizontal Bars */}
            <span className="w-[14px] h-[1.75px] bg-[#FFFFFF] rounded-full block" />
            <span className="w-[14px] h-[1.75px] bg-[#FFFFFF] rounded-full block" />
            <span className="w-[14px] h-[1.75px] bg-[#FFFFFF] rounded-full block" />
          </button>
        </div>

        {/* Navbar Title ("Andima CCR" in #121B2E) & Breadcrumb in #3F4940 */}
        <div className="pl-3 sm:pl-4 pr-2 sm:pr-3 flex items-center gap-2 sm:gap-3.5 truncate">
          <span className="text-[#121B2E] font-bold text-[13px] sm:text-[14px] tracking-[-0.01em] whitespace-nowrap">
            Andima CCR
          </span>
          <span
            id="breadcrumbLabel"
            className="hidden md:inline text-[#3F4940] font-medium text-[11.5px] tracking-[-0.005em] truncate"
          >
            CCR / <strong className="text-[#1D4ED8] font-bold">{translatedPageName}</strong>
          </span>
        </div>
      </div>

      {/* Right Group: Language Switcher + Notification Bell + User Profile */}
      <div className="flex items-center h-full shrink-0">
        {/* Language Switcher Compartment */}
        <div className="h-full px-3 flex items-center justify-center border-l border-[#E2E8F0]">
          <div
            role="group"
            aria-label={t("nav.selectLanguage", "Select language")}
            className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold"
          >
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-md px-2 py-0.5 text-[11px] transition-colors cursor-pointer ${
                language === "en"
                  ? "bg-white text-blue-700 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              aria-label={t("nav.switchToEnglish", "Switch language to English")}
              aria-pressed={language === "en"}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("id")}
              className={`rounded-md px-2 py-0.5 text-[11px] transition-colors cursor-pointer ${
                language === "id"
                  ? "bg-white text-blue-700 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              aria-label={t("nav.switchToIndonesian", "Switch language to Indonesian")}
              aria-pressed={language === "id"}
            >
              ID
            </button>
          </div>
        </div>

        {/* Notification Bell Compartment */}
        <div
          ref={notifRef}
          className="h-full px-4 flex items-center justify-center border-l border-[#E2E8F0] relative"
        >
          <button
            id="notifBtn"
            type="button"
            onClick={() => setIsNotifOpen((prev) => !prev)}
            aria-label={t("nav.notifications", "Notifications")}
            aria-expanded={isNotifOpen}
            className="relative p-1.5 rounded-lg hover:bg-slate-100 text-[#334155] transition-colors cursor-pointer"
          >
            {/* Outline Bell SVG */}
            <svg
              className="w-[18px] h-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {/* Circular Red Notification Badge */}
            {unreadCount > 0 && (
              <span
                id="notifBadge"
                className="absolute -top-0.5 -right-1 w-[16px] h-[16px] rounded-full bg-[#DC2626] text-[#FFFFFF] text-[9.5px] font-bold flex items-center justify-center leading-none shadow-2xs"
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Clean Notification Popover Dropdown */}
          {isNotifOpen && (
            <div
              id="notifDropdown"
              className="absolute right-3 top-[54px] w-72 bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-1"
            >
              <div className="px-3.5 py-2 border-b border-[#F1F5F9] flex items-center justify-between">
                <span className="text-[12px] font-bold text-[#121B2E]">
                  {t("nav.notifications", "Notifications")}
                </span>
                {unreadCount > 0 && (
                  <button
                    id="markReadBtn"
                    type="button"
                    onClick={() => setUnreadCount(0)}
                    className="text-[11px] font-semibold text-[#3B6FF5] hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="divide-y divide-[#F1F5F9] text-[12px]">
                <div className="px-3.5 py-2.5 hover:bg-slate-50 transition-colors">
                  <p className="font-semibold text-[#121B2E]">Overdue Invoice Alert</p>
                  <p className="text-[#64748B] text-[11px] mt-0.5">3 invoices overdue &gt; 60 days</p>
                </div>
                <div className="px-3.5 py-2.5 hover:bg-slate-50 transition-colors">
                  <p className="font-semibold text-[#121B2E]">Document Validated</p>
                  <p className="text-[#64748B] text-[11px] mt-0.5">Sales report October 2026</p>
                </div>
                <div className="px-3.5 py-2.5 hover:bg-slate-50 transition-colors">
                  <p className="font-semibold text-[#121B2E]">Settlement Recorded</p>
                  <p className="text-[#64748B] text-[11px] mt-0.5">Payment completed for INV-1002</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Compartment */}
        <HeaderAccount />
      </div>
    </header>
  );
};

export default Header;
