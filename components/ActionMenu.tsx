"use client";

import React, { useEffect, useRef } from "react";

export interface ActionMenuItem {
  id?: string;
  label: string;
  onClick: () => void;
  variant?: "default" | "active" | "danger";
  disabled?: boolean;
}

export interface ActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  items?: ActionMenuItem[];
  className?: string;
  align?: "left" | "right";
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  isOpen,
  onClose,
  onEdit,
  onDelete,
  items,
  className = "",
  align = "right",
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-1.5 z-50 min-w-[110px] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-100 ${className}`}
    >
      {items && items.length > 0 ? (
        items.map((item, idx) => {
          const isDanger = item.variant === "danger";
          const isActive = item.variant === "active";
          return (
            <button
              key={item.id ?? idx}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className={`block w-full px-4 py-2.5 text-center text-sm font-bold transition disabled:opacity-50 ${
                idx > 0 ? "border-t border-slate-100" : ""
              } ${
                isDanger
                  ? "text-[#DC2626] bg-white hover:bg-rose-50 cursor-pointer"
                  : isActive
                  ? "text-slate-800 bg-[#E2E8F0] hover:bg-slate-300 cursor-pointer"
                  : "text-slate-800 hover:bg-slate-100 cursor-pointer"
              }`}
            >
              {item.label}
            </button>
          );
        })
      ) : (
        <>
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onEdit();
                onClose();
              }}
              className="block w-full bg-[#E2E8F0] px-4 py-2.5 text-center text-sm font-bold text-slate-800 hover:bg-slate-300 transition cursor-pointer"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="block w-full bg-white border-t border-slate-100 px-4 py-2.5 text-center text-sm font-bold text-[#DC2626] hover:bg-rose-50 transition cursor-pointer"
            >
              Delete
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default ActionMenu;
