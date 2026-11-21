"use client";

import { useEffect, useState } from "react";
import { useAccount, accountRole, type Account } from "@/components/account-provider";
import { readJsonResponse } from "@/lib/clientHttp";

type AccountState = {
  initials: string;
  name: string;
  role: string;
};

const fallbackAccount: AccountState = {
  initials: "AU",
  name: "Andima User",
  role: "CCR User",
};

export default function HeaderAccount() {
  const { account: loaded } = useAccount();
  const [account, setAccount] = useState<AccountState>(() => {
    if (loaded) {
      return {
        initials: loaded.initials || "AU",
        name: loaded.full_name || "Andima User",
        role: accountRole(loaded.app_role, "CCR User"),
      };
    }
    return fallbackAccount;
  });

  useEffect(() => {
    if (loaded) {
      setAccount({
        initials: loaded.initials || "AU",
        name: loaded.full_name || "Andima User",
        role: accountRole(loaded.app_role, "CCR User"),
      });
      return;
    }

    let isMounted = true;
    async function fetchAccountDirectly() {
      try {
        const res = await fetch("/api/v1/account/me", { cache: "no-store" });
        if (!res.ok) return;
        const body = await readJsonResponse<{ data?: Account }>(res);
        const data = body?.data;
        if (data && isMounted) {
          setAccount({
            initials: data.initials || "AU",
            name: data.full_name || "Andima User",
            role: accountRole(data.app_role, "CCR User"),
          });
        }
      } catch {
        // Fallback gracefully
      }
    }

    void fetchAccountDirectly();
    return () => {
      isMounted = false;
    };
  }, [loaded]);

  return (
    <div className="h-full px-4 flex items-center gap-2.5 border-l border-[#E2E8F0]">
      {/* User Icon Circle with Specified #DBEAFE Background */}
      <div className="w-[32px] h-[32px] rounded-full bg-[#DBEAFE] border border-[#BFDBFE] flex items-center justify-center text-[#121B2E] font-semibold text-[13px] shrink-0 select-none">
        {account.initials}
      </div>

      {/* User Name & Role Stack */}
      <div className="flex flex-col leading-tight min-w-0 text-left">
        <span className="max-w-36 truncate text-[12px] font-bold text-[#121B2E] tracking-[-0.01em]">
          {account.name}
        </span>
        <span className="max-w-36 truncate text-[10.5px] font-normal text-[#64748B] mt-0.5">
          {account.role}
        </span>
      </div>
    </div>
  );
}
