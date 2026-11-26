"use client";

import Swal, { SweetAlertOptions, SweetAlertResult, SweetAlertIcon } from "sweetalert2";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useMemo } from "react";
import { UI_FEEDBACK_CONFIG } from "@/lib/uiFeedbackConfig";

export type LanguageCode = "id" | "en";

export interface SwalAlertOptions {
  title: string;
  text?: string;
  html?: string;
  confirmButtonText?: string;
  timer?: number;
  showConfirmButton?: boolean;
  language?: LanguageCode;
  customClass?: SweetAlertOptions["customClass"];
}

export interface SwalConfirmOptions extends SwalAlertOptions {
  cancelButtonText?: string;
  isDanger?: boolean;
  showCancelButton?: boolean;
}

export interface SwalToastOptions {
  title: string;
  icon?: "success" | "warning" | "error" | "info" | "question";
  timer?: number;
  position?: "top" | "top-start" | "top-end" | "center" | "bottom" | "bottom-end";
}

/**
 * Mendeteksi preferensi bahasa aktif dari localStorage dengan fallback 'id'.
 */
export function getCurrentLanguage(): LanguageCode {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("andima_lang");
      if (stored === "id" || stored === "en") return stored;
    } catch {
      // Ignore localStorage access errors
    }
  }
  return "id";
}

/**
 * Base SweetAlert2 instance dengan tema Antikode / Bright Information Space.
 * Konfigurasi `scrollbarPadding: false` dan `heightAuto: false` menjamin zero layout shift.
 */
export const CcrSwal = Swal.mixin({
  buttonsStyling: false,
  scrollbarPadding: false,
  heightAuto: false,
  returnFocus: true,
  focusConfirm: true,
  allowOutsideClick: true,
  allowEscapeKey: true,
  customClass: {
    container: "ccr-swal-container",
    popup: "ccr-swal-popup",
    title: "ccr-swal-title",
    htmlContainer: "ccr-swal-html",
    confirmButton: "ccr-swal-confirm-btn",
    cancelButton: "ccr-swal-cancel-btn",
    denyButton: "ccr-swal-cancel-btn",
    actions: "ccr-swal-actions",
    icon: "ccr-swal-icon",
    closeButton: "ccr-swal-close-btn",
  },
});

/**
 * 1. Preset Success (showSuccess):
 * Menampilkan modal sukses untuk konfirmasi aksi berhasil (simpan data, unggah dokumen, pembaruan status).
 */
export async function showSuccess(options: SwalAlertOptions): Promise<SweetAlertResult> {
  if (!UI_FEEDBACK_CONFIG.ENABLE_POPUP_ALERTS) {
    return Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false } as SweetAlertResult);
  }
  const lang = options.language ?? getCurrentLanguage();
  const defaultConfirmText = lang === "id" ? "Selesai" : "Done";

  return CcrSwal.fire({
    icon: "success",
    title: options.title,
    text: options.text,
    html: options.html,
    confirmButtonText: options.confirmButtonText ?? defaultConfirmText,
    timer: options.timer,
    showConfirmButton: options.showConfirmButton ?? true,
    customClass: {
      confirmButton: "ccr-swal-confirm-btn",
      ...options.customClass,
    },
  });
}

/**
 * 2. Preset Warning / Overdue (showWarning):
 * Menampilkan modal peringatan terkait tenggat waktu, overdue invoice, atau validasi penting.
 */
export async function showWarning(options: SwalAlertOptions): Promise<SweetAlertResult> {
  if (!UI_FEEDBACK_CONFIG.ENABLE_POPUP_ALERTS) {
    return Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false } as SweetAlertResult);
  }
  const lang = options.language ?? getCurrentLanguage();
  const defaultConfirmText = lang === "id" ? "Mengerti" : "Understood";

  return CcrSwal.fire({
    icon: "warning",
    title: options.title,
    text: options.text,
    html: options.html,
    confirmButtonText: options.confirmButtonText ?? defaultConfirmText,
    showConfirmButton: options.showConfirmButton ?? true,
    customClass: {
      confirmButton: "ccr-swal-confirm-btn",
      ...options.customClass,
    },
  });
}

/**
 * 3. Preset Confirmation / Assignment (showConfirm):
 * Dialog konfirmasi sebelum menjalankan aksi penting, penugasan, atau penghapusan permanen.
 * Mengembalikan Promise<boolean> (true jika dikonfirmasi, false jika dibatalkan).
 */
export async function showConfirm(options: SwalConfirmOptions): Promise<boolean> {
  if (!UI_FEEDBACK_CONFIG.ENABLE_POPUP_ALERTS) {
    return Promise.resolve(true);
  }
  const lang = options.language ?? getCurrentLanguage();
  const isDanger = options.isDanger ?? false;

  const defaultConfirmText = isDanger
    ? lang === "id" ? "Ya, Hapus" : "Yes, Delete"
    : lang === "id" ? "Ya, Lanjutkan" : "Yes, Proceed";
  const defaultCancelText = lang === "id" ? "Batal" : "Cancel";

  const result = await CcrSwal.fire({
    icon: isDanger ? "warning" : "question",
    title: options.title,
    text: options.text,
    html: options.html,
    showCancelButton: options.showCancelButton ?? true,
    confirmButtonText: options.confirmButtonText ?? defaultConfirmText,
    cancelButtonText: options.cancelButtonText ?? defaultCancelText,
    reverseButtons: true,
    customClass: {
      popup: isDanger ? "ccr-swal-popup ccr-swal-popup-danger" : "ccr-swal-popup",
      confirmButton: isDanger
        ? "ccr-swal-confirm-btn ccr-swal-confirm-btn-danger"
        : "ccr-swal-confirm-btn",
      cancelButton: "ccr-swal-cancel-btn",
      ...options.customClass,
    },
  });

  return result.isConfirmed;
}

/**
 * 4. Preset Error (showError):
 * Menampilkan pesan galat terstruktur saat proses API atau validasi gagal.
 */
export async function showError(options: SwalAlertOptions): Promise<SweetAlertResult> {
  if (!UI_FEEDBACK_CONFIG.ENABLE_POPUP_ALERTS) {
    console.error("[showError suppressed]", options.title, options.text);
    return Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false } as SweetAlertResult);
  }
  const lang = options.language ?? getCurrentLanguage();
  const defaultConfirmText = lang === "id" ? "Tutup" : "Close";

  return CcrSwal.fire({
    icon: "error",
    title: options.title,
    text: options.text,
    html: options.html,
    confirmButtonText: options.confirmButtonText ?? defaultConfirmText,
    showConfirmButton: options.showConfirmButton ?? true,
    customClass: {
      confirmButton: "ccr-swal-confirm-btn",
      ...options.customClass,
    },
  });
}

/**
 * Preset Toast Notifikasi (showToast):
 * Notifikasi ringan non-blocking di pojok kanan atas dengan timer progres.
 */
export function showToast(options: SwalToastOptions) {
  if (!UI_FEEDBACK_CONFIG.ENABLE_NOTIFICATIONS) {
    return Promise.resolve({ isConfirmed: false, isDenied: false, isDismissed: true } as SweetAlertResult);
  }
  return Swal.fire({
    toast: true,
    position: options.position ?? "top-end",
    icon: options.icon ?? "success",
    title: options.title,
    showConfirmButton: false,
    timer: options.timer ?? 3000,
    timerProgressBar: true,
    scrollbarPadding: false,
    heightAuto: false,
    customClass: {
      popup: "ccr-swal-toast",
      title: "ccr-swal-toast-title",
    },
  });
}

/**
 * React Hook untuk kemudahan integrasi dengan reactive LanguageContext aplikasi.
 */
export function useSwal() {
  const { language } = useLanguage();

  return useMemo(
    () => ({
      success: (title: string, textOrOptions?: string | Partial<SwalAlertOptions>) => {
        if (typeof textOrOptions === "string") {
          return showSuccess({ title, text: textOrOptions, language });
        }
        return showSuccess({ title, language, ...textOrOptions });
      },
      warning: (title: string, textOrOptions?: string | Partial<SwalAlertOptions>) => {
        if (typeof textOrOptions === "string") {
          return showWarning({ title, text: textOrOptions, language });
        }
        return showWarning({ title, language, ...textOrOptions });
      },
      confirm: (title: string, textOrOptions?: string | Partial<SwalConfirmOptions>) => {
        if (typeof textOrOptions === "string") {
          return showConfirm({ title, text: textOrOptions, language });
        }
        return showConfirm({ title, language, ...textOrOptions });
      },
      error: (title: string, textOrOptions?: string | Partial<SwalAlertOptions>) => {
        if (typeof textOrOptions === "string") {
          return showError({ title, text: textOrOptions, language });
        }
        return showError({ title, language, ...textOrOptions });
      },
      toast: (title: string, icon?: SwalToastOptions["icon"], opts?: Partial<SwalToastOptions>) =>
        showToast({ title, icon, ...opts }),
      Swal: CcrSwal,
    }),
    [language]
  );
}

export default CcrSwal;
