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
    <div className="flex items-center gap-2 border-l border-[#BCD4EE] pl-3">
      <span className="grid size-8 place-items-center rounded-full border border-[#0C68D5]/25 bg-[#E6F1FF] text-xs font-bold text-[#0C68D5] font-heading">
        {account.initials}
      </span>
      <div className="min-w-0 text-left">
        <p className="max-w-40 truncate text-xs font-bold text-[#172033] font-heading">{account.name}</p>
        <p className="text-[10px] text-[#4d5f81]">{account.role}</p>
      </div>
    </div>
  );
}
