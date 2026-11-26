"use client";

import React from "react";
import { X } from "lucide-react";

export interface StatusBannerProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  title,
  message,
  onDismiss,
  className = "",
}) => {
  const isNegative =
    message.toLowerCase().includes("ditolak") ||
    message.toLowerCase().includes("rejected") ||
    message.toLowerCase().includes("gagal") ||
    message.toLowerCase().includes("failed");

  const resolvedTitle = title ?? (isNegative ? "NOTICE" : "SUCCEED");

  return (
    <div
      role="status"
      className={`rounded-2xl border ${isNegative ? "border-amber-300 bg-amber-50" : "border-[#6EE7B7] bg-[#ECFDF5]"} p-4 text-left shadow-xs font-sans ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className={`text-[12px] font-bold tracking-wider uppercase font-heading ${isNegative ? "text-amber-800" : "text-[#065F46]"}`}>
            {resolvedTitle}
          </h4>
          <p className={`mt-1 text-xs font-medium leading-relaxed ${isNegative ? "text-amber-900" : "text-[#047857]"}`}>
            {message}
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss banner"
            className={`rounded p-1 transition cursor-pointer ${isNegative ? "text-amber-800 hover:bg-amber-100" : "text-[#065F46] hover:bg-[#D1FAE5]"}`}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default StatusBanner;
