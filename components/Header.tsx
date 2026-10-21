"use client";

import React from "react";
import HeaderAccount from "@/components/headeraccount";

interface HeaderProps {
  pageName: string;
}

export const Header: React.FC<HeaderProps> = ({ pageName }) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 md:px-8 flex items-center justify-between gap-3 shrink-0">
      <div className="min-w-0 text-xs font-semibold tracking-wide text-[#0F2342] font-heading">
        CCR / <span className="text-[#1D4ED8] font-bold">{pageName}</span>
      </div>

      <div className="flex shrink-0 items-center gap-3 md:gap-4">
        <button
          type="button"
          aria-label="Notifications"
          className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
        </button>

        <button
          type="button"
          aria-label="Filters"
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
        </button>

        <HeaderAccount />
      </div>
    </header>
  );
};

export default Header;
