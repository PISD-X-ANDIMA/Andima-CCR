"use client";

import React from "react";

export interface PaginationProps {
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage = 1,
  totalPages = 24,
  onPageChange,
  className = "",
}) => {
  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange?.(page);
    }
  };

  const pageItems: Array<number | "ellipsis-start" | "ellipsis-end"> = [];
  const firstPage = Math.max(2, currentPage - 1);
  const lastPage = Math.min(totalPages - 1, currentPage + 1);
  if (totalPages <= 5) {
    for (let page = 1; page <= totalPages; page += 1) pageItems.push(page);
  } else {
    pageItems.push(1);
    if (firstPage > 2) pageItems.push("ellipsis-start");
    for (let page = firstPage; page <= lastPage; page += 1) pageItems.push(page);
    if (lastPage < totalPages - 1) pageItems.push("ellipsis-end");
    pageItems.push(totalPages);
  }

  return (
    <nav
      aria-label="Pagination Navigation"
      className={`flex max-w-full items-center justify-center gap-1.5 overflow-hidden font-sans select-none sm:gap-2 ${className}`}
    >
      {/* Previous Button */}
      <button
        type="button"
        onClick={() => handlePageClick(currentPage - 1)}
        disabled={currentPage <= 1}
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
          currentPage <= 1
            ? "border border-slate-100 text-slate-300 bg-white cursor-not-allowed"
            : "border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 cursor-pointer shadow-xs"
        }`}
        aria-label="Previous Page"
      >
        <svg
          className="w-4 h-4 stroke-[2.2]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
        {pageItems.map((item) => (typeof item === "number" ? (
          <button key={item} type="button" onClick={() => handlePageClick(item)} className={`h-9 w-9 shrink-0 rounded-lg text-sm font-semibold transition-all ${currentPage === item ? "bg-[#3B6FF5] text-white shadow-xs" : "text-slate-700 hover:bg-slate-100 cursor-pointer"}`} aria-current={currentPage === item ? "page" : undefined}>{item}</button>
        ) : <span key={item} className="flex h-9 w-5 shrink-0 items-center justify-center text-sm font-bold text-slate-400" aria-hidden="true">...</span>))}
      </div>

      {/* Next Button */}
      <button
        type="button"
        onClick={() => handlePageClick(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
          currentPage >= totalPages
            ? "border border-slate-100 text-slate-300 bg-white cursor-not-allowed"
            : "border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 cursor-pointer shadow-xs"
        }`}
        aria-label="Next Page"
      >
        <svg
          className="w-4 h-4 stroke-[2.2]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </nav>
  );
};

export default Pagination;
