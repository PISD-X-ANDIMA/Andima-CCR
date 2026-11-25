"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export interface PaginationProps {
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  className?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  showPageSize?: boolean;
  totalItems?: number;
  itemLabel?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage = 1,
  totalPages = 10,
  onPageChange,
  className = "",
  pageSize = 10,
  pageSizeOptions = [10, 20, 50, 100, 150],
  onPageSizeChange,
  showPageSize = true,
  totalItems,
  itemLabel,
}) => {
  const { language, t } = useLanguage();
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPageSizeOpen(false);
        setIsCustomMode(false);
      }
    };
    if (isPageSizeOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPageSizeOpen]);

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange?.(page);
    }
  };

  const handleSelectPageSize = (size: number) => {
    onPageSizeChange?.(size);
    setIsPageSizeOpen(false);
    setIsCustomMode(false);
  };

  // Generate page numbers with ellipsis
  const pageItems: Array<number | "ellipsis-start" | "ellipsis-end"> = [];
  if (totalPages <= 7) {
    for (let p = 1; p <= totalPages; p += 1) {
      pageItems.push(p);
    }
  } else {
    pageItems.push(1);
    if (currentPage > 4) {
      pageItems.push("ellipsis-start");
    }
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let p = start; p <= end; p += 1) {
      pageItems.push(p);
    }
    if (currentPage < totalPages - 3) {
      pageItems.push("ellipsis-end");
    }
    pageItems.push(totalPages);
  }

  const perPageLabel = language === "id" ? "per halaman" : t("common.perPage", "per page");
  const showingStart = totalItems !== undefined ? (totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1) : 0;
  const showingEnd = totalItems !== undefined ? Math.min(currentPage * pageSize, totalItems) : 0;

  return (
    <nav
      aria-label="Pagination Navigation"
      className={`w-full flex flex-col md:flex-row items-center justify-between gap-4 font-sans select-none text-xs text-slate-600 ${className}`}
    >
      {/* Left side: Combined Data Range + Page Status + Per Page Dropdown */}
      {showPageSize && (
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-slate-500 font-medium">
          {totalItems !== undefined ? (
            <span>
              {t("common.showing", "Showing")}{" "}
              <span className="font-bold text-slate-800">{showingStart}-{showingEnd}</span>{" "}
              {t("common.of", "of")}{" "}
              <span className="font-bold text-slate-800">{totalItems}</span>
              {itemLabel ? ` ${itemLabel}` : ""}{" "}
              <span className="text-slate-400">·</span>{" "}
              {t("common.page", "Page")}{" "}
              <span className="font-bold text-slate-800">{currentPage}</span>{" "}
              {t("common.of", "of")}{" "}
              <span className="font-bold text-slate-800">{totalPages}</span>
            </span>
          ) : (
            <span>
              {t("common.page", "Page")}{" "}
              <span className="font-bold text-slate-800">{currentPage}</span>{" "}
              {t("common.of", "of")}{" "}
              <span className="font-bold text-slate-800">{totalPages}</span>
            </span>
          )}
          <span className="text-slate-300">|</span>
          <span className="whitespace-nowrap">{perPageLabel}</span>

          {/* Page size dropdown */}
          <div className="relative inline-block" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsPageSizeOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isPageSizeOpen}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 shadow-xs hover:border-slate-300 transition cursor-pointer"
            >
              <span className="font-bold text-slate-800">{pageSize}</span>
              <ChevronDown className={`size-3 text-slate-500 transition-transform ${isPageSizeOpen ? "rotate-180" : ""}`} />
            </button>

            {isPageSizeOpen && (
              <div
                role="listbox"
                className="absolute left-0 bottom-full mb-1.5 z-50 min-w-[72px] rounded-xl border border-slate-200 bg-white py-1 shadow-xl overflow-hidden animate-in fade-in duration-100"
              >
                {pageSizeOptions.map((size) => {
                  const isSelected = size === pageSize;
                  return (
                    <button
                      key={size}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectPageSize(size)}
                      className={`block w-full px-3 py-1 text-center text-xs font-semibold transition ${
                        isSelected
                          ? "bg-[#DBEAFE] text-slate-900 font-bold"
                          : "text-slate-600 hover:bg-slate-50 cursor-pointer"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}

                {/* Custom page size option */}
                <div className="border-t border-slate-100 mt-1 pt-1 px-1">
                  {isCustomMode ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const parsed = Number.parseInt(customValue, 10);
                        if (Number.isFinite(parsed) && parsed > 0 && parsed <= 500) {
                          handleSelectPageSize(parsed);
                        }
                      }}
                      className="flex items-center gap-1"
                    >
                      <input
                        type="number"
                        min="1"
                        max="500"
                        autoFocus
                        placeholder="1-500"
                        value={customValue}
                        onChange={(e) => setCustomValue(e.target.value)}
                        className="w-12 rounded border border-slate-200 px-1 py-0.5 text-center text-[11px] font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        aria-label="Custom page size"
                      />
                      <button
                        type="submit"
                        disabled={!customValue || Number.parseInt(customValue, 10) <= 0}
                        className="rounded bg-[#3B6FF5] px-1.5 py-0.5 text-[11px] font-bold text-white hover:bg-blue-600 disabled:opacity-50 transition cursor-pointer"
                        title="Apply custom page size"
                      >
                        ✓
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsCustomMode(true)}
                      className={`block w-full rounded px-2 py-1 text-center text-[11px] font-semibold transition cursor-pointer ${
                        !pageSizeOptions.includes(pageSize)
                          ? "bg-[#DBEAFE] text-blue-900 font-bold"
                          : "text-blue-600 hover:bg-blue-50"
                      }`}
                    >
                      {t("common.custom", "Custom")}...
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right side: Pill capsule with < 1 2 3 ... > */}
      <div className="rounded-full border border-slate-200 bg-white px-3 py-1 flex items-center gap-1.5 shadow-xs shrink-0">
        {/* Previous button */}
        <button
          type="button"
          onClick={() => handlePageClick(currentPage - 1)}
          disabled={currentPage <= 1}
          className={`flex items-center justify-center p-0.5 rounded transition ${
            currentPage <= 1
              ? "text-slate-300 cursor-not-allowed"
              : "text-slate-700 hover:text-blue-600 cursor-pointer"
          }`}
          aria-label="Previous Page"
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {pageItems.map((item, idx) => {
            if (typeof item === "number") {
              const isActive = currentPage === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => handlePageClick(item)}
                  className={`size-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#1D60FF] text-white shadow-xs"
                      : "text-slate-700 hover:text-slate-950 hover:bg-slate-100 cursor-pointer"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item}
                </button>
              );
            }
            return (
              <span key={`${item}-${idx}`} className="px-1 text-xs text-slate-400 select-none">
                ...
              </span>
            );
          })}
        </div>

        {/* Next button */}
        <button
          type="button"
          onClick={() => handlePageClick(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={`flex items-center justify-center p-0.5 rounded transition ${
            currentPage >= totalPages
              ? "text-slate-300 cursor-not-allowed"
              : "text-slate-700 hover:text-blue-600 cursor-pointer"
          }`}
          aria-label="Next Page"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
};

export default Pagination;
