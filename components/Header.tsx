"use client";

import React from "react";

interface HeaderProps {
  onSearchChange?: (val: string) => void;
  searchValue?: string;
  leftTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onSearchChange,
  searchValue = "",
  leftTitle,
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 md:px-8 flex items-center justify-between font-sans shrink-0">
      {/* Left Header Breadcrumb / Title */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        {leftTitle ? (
          <span className="font-extrabold text-slate-800 tracking-tight">{leftTitle}</span>
        ) : (
          <>
            <span className="text-[#203d70] font-bold uppercase tracking-wider">
              ANDIMA CCR: <span className="text-[#1D4ED8]">SALES &amp; COLLECTION</span>
            </span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="hidden sm:inline text-slate-400 font-mono text-[11px]">28-09-2026</span>
          </>
        )}
      </div>

      {/* Right User Utilities & Search Input Box */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Search Input Box */}
        <div className="relative w-48 sm:w-64 md:w-80">
          <svg
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search ledger, bills, vessels..."
            className="w-full bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-slate-200/90 rounded-lg pl-10 pr-4 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-xs"
          />
        </div>

        {/* Notification Bell Icon */}
        <button className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white"></span>
        </button>

        {/* Filter Sliders Icon */}
        <button className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
        </button>

        {/* User Profile Avatar */}
        <div className="flex items-center gap-3 pl-1 border-l border-slate-200">
          <div className="w-9 h-9 rounded-full bg-[#0F52BA] text-white flex items-center justify-center font-bold text-xs shadow-xs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
