"use client";

import React from "react";
import { X } from "lucide-react";

export function ActivityHistorySkeleton() {
  return (
    <div className="relative ml-2 space-y-4 border-l-2 border-slate-200 pl-4 py-1 animate-pulse" aria-label="Loading activity history" aria-busy="true">
      {[1, 2, 3].map((item) => (
        <div key={item} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-300 ring-4 ring-white" />
          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-28 rounded bg-slate-200" />
                <div className="h-3 w-16 rounded bg-slate-100" />
              </div>
              <div className="h-3 w-20 rounded bg-slate-200" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-20 rounded bg-blue-100" />
              <div className="h-4 w-16 rounded bg-slate-200" />
            </div>
            <div className="h-3 w-3/4 rounded bg-slate-200" />
            <div className="h-2.5 w-1/2 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function OverdueInvoicePreviewSkeleton({ onClose }: { onClose?: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Loading invoice preview"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-pulse">
        {/* Header Skeleton */}
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="h-5 w-48 rounded-md bg-slate-200" />
              <div className="h-4 w-20 rounded-full bg-slate-200" />
            </div>
            <div className="h-3 w-32 rounded bg-slate-100" />
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="size-5" />
            </button>
          ) : (
            <div className="size-6 rounded bg-slate-200" />
          )}
        </header>

        {/* Modal Body Skeleton */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Top 3 KPI Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2">
              <div className="h-2.5 w-24 rounded bg-slate-200" />
              <div className="h-6 w-36 rounded bg-red-200" />
              <div className="h-2.5 w-20 rounded bg-slate-100" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2">
              <div className="h-2.5 w-28 rounded bg-slate-200" />
              <div className="h-4 w-24 rounded bg-slate-300" />
              <div className="h-4 w-28 rounded bg-amber-100" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2">
              <div className="h-2.5 w-24 rounded bg-slate-200" />
              <div className="h-3.5 w-32 rounded bg-slate-300" />
              <div className="h-2.5 w-20 rounded bg-slate-100" />
            </div>
          </div>

          {/* Contact Person Skeleton */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <div className="pb-2.5 border-b border-slate-100">
                <div className="h-3.5 w-36 rounded bg-slate-200" />
              </div>
              <div className="space-y-1">
                <div className="h-3.5 w-28 rounded bg-slate-300" />
                <div className="h-3 w-32 rounded bg-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="h-8 rounded-lg bg-emerald-100/70" />
                <div className="h-8 rounded-lg bg-slate-100" />
              </div>
          </div>

          {/* Activity & Follow-up History Skeleton */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="size-4 rounded bg-blue-200" />
              <div className="h-3.5 w-44 rounded bg-slate-200" />
            </div>
            <ActivityHistorySkeleton />
          </div>
        </div>

        {/* Footer Skeleton */}
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <div className="h-8 w-20 rounded-lg bg-slate-200" />
          <div className="h-8 w-28 rounded-lg bg-blue-200" />
        </footer>
      </div>
    </div>
  );
}

export default OverdueInvoicePreviewSkeleton;
