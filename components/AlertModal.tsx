"use client";

import React, { useEffect } from "react";
import { Check, Loader2 } from "lucide-react";

export interface SuccessAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  buttonText?: string;
}

export const SuccessAlertModal: React.FC<SuccessAlertModalProps> = ({
  isOpen,
  onClose,
  title = "Pendaftaran Berhasil",
  message = "Anda Telah Terdaftar, Silahkan Cek Email (Xx) Anda!",
  buttonText = "Yes",
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-7 text-center shadow-2xl animate-in zoom-in-95 duration-150 font-sans">
        {/* Soft mint circular badge with emerald checkmark */}
        <div className="size-16 rounded-full bg-[#D1FAE5] mx-auto flex items-center justify-center mb-4">
          <Check className="size-8 text-[#059669] stroke-[2.5]" />
        </div>

        {/* Title & Message */}
        <h3 className="text-lg font-bold text-slate-900 font-heading">{title}</h3>
        {message && (
          <p className="text-xs text-slate-600 mt-2 leading-relaxed font-medium">
            {message}
          </p>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-36 py-2.5 rounded-xl bg-[#1D60FF] hover:bg-blue-700 text-white font-semibold text-sm shadow-sm mx-auto mt-6 transition cursor-pointer"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm To Delete?",
  message,
  confirmText = "Yes",
  cancelText = "No",
  loading = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, loading]);

  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      {/* Modal card with 2px solid red border */}
      <div className="w-full max-w-sm rounded-3xl border-2 border-[#DC2626] bg-white p-7 text-center shadow-2xl animate-in zoom-in-95 duration-150 font-sans">
        {/* Red outlined circle with question mark */}
        <div className="size-16 rounded-full border-4 border-[#DC2626] mx-auto flex items-center justify-center mb-4 text-[#DC2626] text-3xl font-bold font-heading">
          ?
        </div>

        {/* Title & Message */}
        <h3 className="text-lg font-bold text-slate-900 font-heading">{title}</h3>
        {message && (
          <div className="text-xs text-slate-600 mt-2 leading-relaxed">
            {message}
          </div>
        )}

        {/* Actions: Yes (Blue) and No (Red) */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-7 py-2.5 rounded-xl bg-[#1D60FF] hover:bg-blue-700 text-white font-semibold text-sm shadow-sm disabled:opacity-50 transition cursor-pointer"
          >
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            {confirmText}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-7 py-2.5 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white font-semibold text-sm shadow-sm disabled:opacity-50 transition cursor-pointer"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
