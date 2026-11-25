"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export interface DropdownItem {
  id: string | number;
  label: string;
  displayLabel?: string;
  subLabel?: string;
  badge?: string;
  selected?: boolean;
}

export interface CustomDropdownProps {
  id?: string;
  label?: string;
  placeholder?: string;
  categoryTitle?: string;
  categoryBadge?: string;
  items?: DropdownItem[];
  value?: string | number;
  onChange?: (item: DropdownItem) => void;
  className?: string;
  defaultOpen?: boolean;
  variant?: "default" | "pill";
  ariaLabel?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  id,
  label,
  placeholder,
  categoryTitle,
  categoryBadge,
  items = [
    { id: "node", label: "Node.js", subLabel: "v2.3.9" },
    { id: "react", label: "React.js", subLabel: "yes yes" },
    { id: "next", label: "Next.js", subLabel: "v2.4.1-rc" },
  ],
  value = "react",
  onChange,
  className = "",
  defaultOpen = false,
  variant = "pill",
  ariaLabel,
}) => {
  const { t } = useLanguage();
  const resolvedPlaceholder = placeholder ?? t("common.selectOption", "Select Option");
  const resolvedCategoryTitle = categoryTitle ?? t("common.options", "Options");
  const resolvedCategoryBadge = categoryBadge;
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedId, setSelectedId] = useState<string | number>(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (item: DropdownItem) => {
    setSelectedId(item.id);
    onChange?.(item);
    setIsOpen(false);
  };

  const isPill = variant === "pill";

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-[340px] font-sans ${className}`}
    >
      {label && (
        <label className="block text-xs font-bold text-slate-700 mb-1.5 font-heading">
          {label}
        </label>
      )}

      {/* Trigger Button: Pill or Default Box */}
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`w-full bg-white border ${
          isOpen ? "border-slate-800 ring-1 ring-slate-800" : "border-slate-300 hover:border-slate-400"
        } ${
          isPill ? "rounded-full px-4 py-2" : "rounded-xl px-4 py-2.5"
        } text-left flex items-center justify-between shadow-xs transition-all duration-150 cursor-pointer`}
      >
        <span className={`text-xs font-semibold truncate ${selectedItem ? "text-slate-900" : "text-slate-500"}`}>
          {selectedItem ? (selectedItem.displayLabel ?? selectedItem.label) : resolvedPlaceholder}
        </span>
        <div className="flex items-center text-slate-500 shrink-0 ml-2">
          {isOpen ? (
            <ChevronUp className="size-3.5 text-slate-800 stroke-[2.5]" />
          ) : (
            <ChevronDown className="size-3.5 text-slate-500 stroke-[2]" />
          )}
        </div>
      </button>

      {/* Dropdown Menu Panel (Figma Spec: Rounded-2xl with light header and active highlight) */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 rounded-2xl border border-slate-100 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 py-1">
          {/* Header Row: Category Title */}
          {resolvedCategoryTitle && (
            <div className="flex items-center justify-between gap-2 px-4 pt-2.5 pb-1 text-[11px] font-bold text-slate-400 font-heading">
              <span className="truncate">{resolvedCategoryTitle}</span>
              {resolvedCategoryBadge && (
                <span className="text-slate-400 font-normal whitespace-nowrap shrink-0">{resolvedCategoryBadge}</span>
              )}
            </div>
          )}

          {/* List Items */}
          <div className="py-0.5">
            {items.map((item) => {
              const isSelected = item.id === selectedId || item.label === value || item.displayLabel === value;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(item)}
                  className={`w-full px-4 py-2 text-left flex items-center justify-between text-xs transition-colors ${
                    isSelected
                      ? "bg-[#E2E8F0] text-slate-900 font-bold"
                      : "text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSelected && <Check className="size-3.5 text-slate-900 stroke-[2.5] shrink-0" />}
                    <span className="truncate">{item.displayLabel ?? item.label}</span>
                  </div>

                  {item.subLabel && (
                    <span
                      className={`text-[11px] font-normal ${
                        isSelected ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      {item.subLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;
