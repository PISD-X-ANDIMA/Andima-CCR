"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from "lucide-react";

export interface CalendarProps {
  value?: string | Date;
  onChange?: (dateString: string) => void;
  className?: string;
  minDate?: string;
  maxDate?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const Calendar: React.FC<CalendarProps> = ({
  value,
  onChange,
  className = "",
}) => {
  // Parse initial selected date
  const selectedDate = useMemo(() => {
    if (!value) return null;
    const d = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00`) : new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  // Current viewing month and year
  const [currentYear, setCurrentYear] = useState(() => selectedDate ? selectedDate.getFullYear() : new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => selectedDate ? selectedDate.getMonth() : new Date().getMonth());

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Days in month calculation
  const { leadingEmptySlots, daysInMonth } = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    return {
      leadingEmptySlots: firstDayIndex,
      daysInMonth: totalDays,
    };
  }, [currentYear, currentMonth]);

  const handleDayClick = (dayNumber: number) => {
    const monthStr = String(currentMonth + 1).padStart(2, "0");
    const dayStr = String(dayNumber).padStart(2, "0");
    const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
    onChange?.(dateStr);
  };

  return (
    <div className={`w-full max-w-[320px] rounded-2xl bg-white p-4 font-sans select-none ${className}`}>
      {/* Header: Month Year on left, < > arrows on right */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-bold text-slate-900 font-heading">
          {MONTH_NAMES[currentMonth]} {currentYear}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <ChevronLeft className="size-4 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next month"
            className="p-1 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          >
            <ChevronRight className="size-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Days of week: Sun & Sat in red */}
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {DAY_NAMES.map((day, idx) => {
          const isWeekend = idx === 0 || idx === 6;
          return (
            <div
              key={day}
              className={`text-xs font-semibold py-1 ${
                isWeekend ? "text-[#EF4444]" : "text-slate-700"
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {/* Leading empty slots */}
        {Array.from({ length: leadingEmptySlots }).map((_, i) => (
          <div key={`empty-${i}`} className="size-8" />
        ))}

        {/* Month days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNumber = i + 1;
          const dayOfWeek = (leadingEmptySlots + i) % 7;
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          const isSelected =
            selectedDate !== null &&
            selectedDate.getFullYear() === currentYear &&
            selectedDate.getMonth() === currentMonth &&
            selectedDate.getDate() === dayNumber;

          return (
            <div key={dayNumber} className="flex items-center justify-center p-0.5">
              <button
                type="button"
                onClick={() => handleDayClick(dayNumber)}
                className={`size-8 rounded-xl flex items-center justify-center text-xs font-medium transition ${
                  isSelected
                    ? "bg-[#2563EB] text-white font-bold shadow-xs hover:bg-blue-700"
                    : isWeekend
                    ? "text-[#EF4444] hover:bg-rose-50 cursor-pointer"
                    : "text-slate-700 hover:bg-slate-100 cursor-pointer"
                }`}
              >
                {dayNumber}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export interface CalendarModalProps extends CalendarProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  isOpen,
  onClose,
  title = "Select Date",
  value,
  onChange,
  className = "",
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
          <span className="text-xs font-bold text-slate-800 font-heading">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
            aria-label="Close calendar"
          >
            <X className="size-4" />
          </button>
        </div>
        <Calendar
          value={value}
          onChange={(dateStr) => {
            onChange?.(dateStr);
            onClose();
          }}
          className={className}
        />
      </div>
    </div>
  );
};

export interface DatePickerProps {
  value?: string;
  onChange?: (dateString: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  disabled?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = "Select date",
  className = "",
  label,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const formattedDisplay = useMemo(() => {
    if (!value) return null;
    const d = new Date(`${value.slice(0, 10)}T00:00:00`);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  }, [value]);

  return (
    <div className={`relative w-full ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1.5 font-heading">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:border-slate-300 disabled:opacity-50 transition cursor-pointer"
      >
        <span className={formattedDisplay ? "text-slate-900 font-semibold" : "text-slate-400 font-normal"}>
          {formattedDisplay ?? placeholder}
        </span>
        <CalendarIcon className="size-4 text-slate-400" />
      </button>

      <CalendarModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        value={value}
        onChange={(newDate) => {
          onChange?.(newDate);
          setIsOpen(false);
        }}
        title={label ?? placeholder}
      />
    </div>
  );
};

export interface PeriodRangeCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  startPeriod: string;
  endPeriod: string;
  onApply: (startPeriod: string, endPeriod: string) => void;
  title?: string;
  disabled?: boolean;
}

export const PeriodRangeCalendarModal: React.FC<PeriodRangeCalendarModalProps> = ({
  isOpen,
  onClose,
  startPeriod,
  endPeriod,
  onApply,
  title = "Select Period Range",
  disabled = false,
}) => {
  const initStart = useMemo(() => startPeriod.slice(0, 7), [startPeriod]);
  const initEnd = useMemo(() => endPeriod.slice(0, 7), [endPeriod]);

  const [draftStart, setDraftStart] = useState(initStart);
  const [draftEnd, setDraftEnd] = useState(initEnd);
  const [selecting, setSelecting] = useState<"start" | "end">("start");

  const [viewYear, setViewYear] = useState(() => {
    const y = parseInt(initEnd.slice(0, 4), 10);
    return isNaN(y) ? new Date().getFullYear() : y;
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const m = parseInt(initEnd.slice(5, 7), 10) - 1;
    return isNaN(m) || m < 0 || m > 11 ? new Date().getMonth() : m;
  });

  useEffect(() => {
    if (isOpen) {
      setDraftStart(initStart);
      setDraftEnd(initEnd);
      setSelecting("start");
      const y = parseInt(initEnd.slice(0, 4), 10);
      const m = parseInt(initEnd.slice(5, 7), 10) - 1;
      if (!isNaN(y)) setViewYear(y);
      if (!isNaN(m) && m >= 0 && m <= 11) setViewMonth(m);
    }
  }, [isOpen, initStart, initEnd]);

  if (!isOpen) return null;

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const currentMonthPeriod = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;

  const handleSelectDay = (dayNumber: number) => {
    const period = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    if (selecting === "start") {
      setDraftStart(period);
      setDraftEnd(period);
      setSelecting("end");
    } else {
      if (period < draftStart) {
        setDraftStart(period);
        setDraftEnd(draftStart);
      } else {
        setDraftEnd(period);
      }
      setSelecting("start");
    }
  };

  const handleApply = () => {
    const normStart = draftStart <= draftEnd ? draftStart : draftEnd;
    const normEnd = draftStart <= draftEnd ? draftEnd : draftStart;
    onApply(normStart, normEnd);
    onClose();
  };

  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();

  const formatPeriodLabel = (period: string) => {
    const [y, m] = period.split("-").map(Number);
    if (!y || !m) return period;
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const isCurrentMonthStart = currentMonthPeriod === draftStart;
  const isCurrentMonthEnd = currentMonthPeriod === draftEnd;
  const isCurrentMonthInRange = currentMonthPeriod > draftStart && currentMonthPeriod < draftEnd;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-150 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
          <span className="text-sm font-bold text-slate-900 font-heading">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
            aria-label="Close calendar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Calendar Nav: Month Year < > */}
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-[15px] font-bold text-slate-900 font-heading">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <ChevronLeft className="size-4 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="p-1 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <ChevronRight className="size-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {DAY_NAMES.map((day, idx) => {
            const isWeekend = idx === 0 || idx === 6;
            return (
              <div
                key={day}
                className={`text-xs font-semibold py-1 ${
                  isWeekend ? "text-[#EF4444]" : "text-slate-700"
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Grid Days */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="size-8" />
          ))}

          {Array.from({ length: totalDays }).map((_, i) => {
            const dayNumber = i + 1;
            const dayOfWeek = (firstDayIndex + i) % 7;
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            const isSelected = isCurrentMonthStart || isCurrentMonthEnd;
            const inRange = isCurrentMonthInRange;

            return (
              <div key={dayNumber} className="flex items-center justify-center p-0.5">
                <button
                  type="button"
                  onClick={() => handleSelectDay(dayNumber)}
                  className={`size-8 rounded-xl flex items-center justify-center text-xs font-medium transition cursor-pointer ${
                    isSelected
                      ? "bg-[#2563EB] text-white font-bold shadow-xs hover:bg-blue-700"
                      : inRange
                      ? "bg-blue-50 text-blue-800 font-semibold hover:bg-blue-100"
                      : isWeekend
                      ? "text-[#EF4444] hover:bg-rose-50"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {dayNumber}
                </button>
              </div>
            );
          })}
        </div>

        {/* Selected Period Info */}
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-center">
          <p className="text-[11px] text-slate-500 font-medium">
            {selecting === "start" ? "Click a date to select start month" : "Click a date to select end month"}
          </p>
          <p className="text-xs font-bold text-slate-800 mt-0.5">
            {formatPeriodLabel(draftStart)} — {formatPeriodLabel(draftEnd)}
          </p>
        </div>

        {/* Actions: Apply & Cancel */}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={handleApply}
            className="rounded-xl bg-[#1D60FF] hover:bg-blue-700 text-white px-5 py-2 text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarModal;
