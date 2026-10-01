"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Account = {
  initials: string;
  name: string;
  role: string;
};

type AccountAccess = {
  app_role: "EMPLOYEE" | "HR" | "MANAGER" | null;
  full_name: string | null;
};

const fallbackAccount: Account = {
  initials: "AU",
  name: "Andima User",
  role: "HRMS User",
};

function roleLabel(role: AccountAccess["app_role"]) {
  if (role === "HR") return "HR";
  if (role === "MANAGER") return "Manager";
  if (role === "EMPLOYEE") return "Employee";
  return "HRMS User";
}

export default function HeaderAccount() {
  const [account, setAccount] = useState<Account>(fallbackAccount);

  useEffect(() => {
    let isMounted = true;

    async function loadAccount() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user || !isMounted) return;

      const { data: access } = await supabase
        .from("d3_employee")
        .select("app_role, full_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      const accountAccess = access as unknown as AccountAccess | null;
      const metadataName = user.user_metadata?.full_name;
      const registeredName = typeof metadataName === "string" && metadataName.trim()
        ? metadataName.trim()
        : user.email?.split("@")[0] ?? fallbackAccount.name;
      const name = accountAccess?.full_name?.trim() || registeredName;
      const initials = name
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || fallbackAccount.initials;

      if (isMounted) {
        setAccount({ initials, name, role: roleLabel(accountAccess?.app_role ?? null) });
      }
    }

    void loadAccount();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="hidden items-center gap-2 border-l border-[#d9e2fc] pl-3 sm:flex">
      <span className="grid size-8 place-items-center rounded-full border border-[#006838]/30 bg-[#16834b]/15 text-xs font-bold text-[#006838]">
        {account.initials}
      </span>
      <div className="text-left">
        <p className="text-xs font-bold">{account.name}</p>
        <p className="text-[10px] text-[#4d5f81]">{account.role}</p>
      </div>
    </div>
  );
}
