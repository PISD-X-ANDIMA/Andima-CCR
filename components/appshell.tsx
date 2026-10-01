"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = pathname === "/login" || pathname === "/register" || pathname.startsWith("/auth/");

  if (isPublicRoute) return <>{children}</>;

  return (
    <>
      <Sidebar />
      <div className="min-h-full lg:pl-[260px]">{children}</div>
    </>
  );
}
