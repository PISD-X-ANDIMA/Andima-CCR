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
  title = "SUCCEED",
  message,
  onDismiss,
  className = "",
}) => {
  return (
    <div
      role="status"
      className={`rounded-2xl border border-[#6EE7B7] bg-[#ECFDF5] p-4 text-left shadow-xs font-sans ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-[12px] font-bold tracking-wider text-[#065F46] uppercase font-heading">
            {title}
          </h4>
          <p className="mt-1 text-xs font-medium leading-relaxed text-[#047857]">
            {message}
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss banner"
            className="rounded p-1 text-[#065F46] hover:bg-[#D1FAE5] transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default StatusBanner;
