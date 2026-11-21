"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface FollowUpFormSkeletonProps {
  isInnerOnly?: boolean;
}

export function FollowUpFormSkeleton({ isInnerOnly = false }: FollowUpFormSkeletonProps) {
  const innerContent = (
    <div className="w-full space-y-6" aria-label="Loading follow-up form" aria-busy="true">
      {/* 1. Invoice Overview Card Skeleton */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs animate-pulse">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3 flex-1">
            {/* Status Pills Skeleton */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="h-5 w-36 rounded-md bg-red-100" />
              <div className="h-5 w-24 rounded-full bg-slate-200" />
              <div className="h-5 w-20 rounded bg-slate-200" />
            </div>

            {/* Customer Title Skeleton */}
            <div className="space-y-2 pt-1">
              <div className="h-7 w-72 sm:w-96 rounded-lg bg-slate-200" />
              <div className="h-4 w-60 rounded bg-slate-200" />
              <div className="h-3 w-48 rounded bg-slate-100" />
              <div className="h-3 w-56 rounded bg-slate-100" />
            </div>
          </div>

          {/* Outstanding Amount Box Skeleton */}
          <div className="flex flex-col items-start md:items-end gap-2 rounded-xl border border-red-100 bg-red-50/60 p-4 min-w-[220px]">
            <div className="h-3 w-28 rounded bg-red-200/70" />
            <div className="h-8 w-44 rounded bg-red-200" />
            <div className="h-2.5 w-24 rounded bg-red-100" />
          </div>
        </div>

        {/* PIC Strip Skeleton */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-slate-200 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 w-32 rounded bg-slate-200" />
              <div className="h-2.5 w-48 rounded bg-slate-100" />
            </div>
          </div>
          <div className="flex items-center sm:justify-end gap-2">
            <div className="h-8 w-28 rounded-lg bg-emerald-100/80" />
          </div>
        </div>
      </section>

      {/* 2. Follow-Up Form Card Skeleton */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs animate-pulse">
        {/* Form Title */}
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
          <div className="size-5 rounded bg-blue-200" />
          <div className="h-5 w-44 rounded bg-slate-200" />
        </div>

        <div className="mt-5 space-y-5">
          {/* Status Selection Skeleton */}
          <div className="space-y-2">
            <div className="h-3.5 w-28 rounded bg-slate-200" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded-xl border border-slate-200 bg-slate-50" />
              ))}
            </div>
          </div>

          {/* 2-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="h-3.5 w-32 rounded bg-slate-200" />
              <div className="h-10 rounded-xl border border-slate-200 bg-slate-50" />
            </div>
            <div className="space-y-2">
              <div className="h-3.5 w-36 rounded bg-slate-200" />
              <div className="h-10 rounded-xl border border-slate-200 bg-slate-50" />
            </div>
          </div>

          {/* Notes Textarea Skeleton */}
          <div className="space-y-2">
            <div className="h-3.5 w-24 rounded bg-slate-200" />
            <div className="h-28 rounded-xl border border-slate-200 bg-slate-50" />
          </div>

          {/* File Attachment Dropzone Skeleton */}
          <div className="space-y-2">
            <div className="h-3.5 w-40 rounded bg-slate-200" />
            <div className="h-20 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60" />
          </div>

          {/* Actions Skeleton */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <div className="h-9 w-24 rounded-lg border border-slate-200 bg-slate-100" />
            <div className="h-9 w-32 rounded-lg bg-blue-300" />
          </div>
        </div>
      </section>

      {/* 3. Follow-up Activity History Timeline Skeleton */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs animate-pulse">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <div className="size-5 rounded bg-slate-200" />
          <div className="h-5 w-48 rounded bg-slate-200" />
        </div>

        <div className="mt-5 space-y-4">
          {[1, 2].map((item) => (
            <div key={item} className="flex gap-3.5 items-start">
              <div className="size-8 rounded-full bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-36 rounded bg-slate-200" />
                  <div className="h-3 w-24 rounded bg-slate-200" />
                </div>
                <div className="h-3 w-3/4 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  if (isInnerOnly) {
    return innerContent;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="flex w-full items-center justify-between px-6 py-4 md:px-8">
          <Link
            href="/overdue-alert"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-700 transition group"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Overdue Alerts</span>
          </Link>
          <div className="flex items-center gap-2.5 animate-pulse">
            <div className="w-[32px] h-[32px] rounded-full bg-[#DBEAFE] border border-[#BFDBFE]" />
            <div className="space-y-1">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="h-2.5 w-14 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full space-y-6 px-4 sm:px-6 lg:px-8 py-6">
        {innerContent}
      </main>
    </div>
  );
}

export default FollowUpFormSkeleton;
