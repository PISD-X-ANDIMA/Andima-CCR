/**
 * Global UI Feedback Configuration.
 * 
 * Controls visibility of modal alerts (confirmations, success popups)
 * and toast notifications across the web application.
 * 
 * Set to `false` during testing so workflows are clean and non-disruptive.
 * Set to `true` to re-enable all original modal popups and toasts instantly.
 */
export const UI_FEEDBACK_CONFIG = {
  /** Suppress modal alert dialogs (logout confirmation, delete confirmation, success alert modals) */
  ENABLE_POPUP_ALERTS: false,
  /** Suppress toast banner notifications (e.g. "Document deleted.") */
  ENABLE_NOTIFICATIONS: false,
} as const;
