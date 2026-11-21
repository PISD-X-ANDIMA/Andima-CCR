"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

interface SidebarContextType {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggleSidebar: () => void;
  closeMobileSidebar: () => void;
  setIsCollapsed: (collapsed: boolean) => void;
}

const STORAGE_KEY = "andima_sidebar_collapsed";

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  isMobileOpen: false,
  toggleSidebar: () => {},
  closeMobileSidebar: () => {},
  setIsCollapsed: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsedState] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true") {
        setIsCollapsedState(true);
      }
    } catch {
      // LocalStorage might be restricted
    }

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const setIsCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed);
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setIsCollapsedState((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(STORAGE_KEY, String(next));
        } catch {
          // Ignore
        }
        return next;
      });
    }
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        isMobileOpen,
        toggleSidebar,
        closeMobileSidebar,
        setIsCollapsed,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
