"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
export type Account = { full_name: string; app_role: string | null; initials: string };
const Context = createContext<{ account: Account | null; clearAccount: () => void }>({ account: null, clearAccount: () => {} });
export function AccountProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = pathname === "/login" || pathname === "/register" || pathname === "/auth" || pathname.startsWith("/auth/");
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    if (isPublic) return;
    const controller = new AbortController();
    fetch("/api/v1/account/me", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) { setAccount(null); return; }
      const body = await response.json(); if (!controller.signal.aborted) setAccount(body.data);
    }).catch(() => {});
    return () => controller.abort();
  }, [isPublic]);
  return <Context.Provider value={{ account: isPublic ? null : account, clearAccount: () => setAccount(null) }}>{children}</Context.Provider>;
}
export const useAccount = () => useContext(Context);
export function accountRole(role: string | null | undefined, fallback: string) {
  return role === "HR" ? "HR" : role === "MANAGER" ? "Manager" : role === "EMPLOYEE" ? "Employee" : fallback;
}
