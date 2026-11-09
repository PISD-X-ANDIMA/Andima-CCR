"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import LanguageToggle from "@/components/i18n/LanguageToggle";
import { useLanguage } from "@/components/i18n/LanguageProvider";

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

function roleLabel(role: AccountAccess["app_role"], t: ReturnType<typeof useLanguage>["t"]) {
  if (role === "HR") return "HR";
  if (role === "MANAGER") return t("manager");
  if (role === "EMPLOYEE") return t("employee");
  return t("hrmsUser");
}

export default function HeaderAccount() {
  const { language, t } = useLanguage();
  const [account, setAccount] = useState<Account>(fallbackAccount);

  useEffect(() => {
    let isMounted = true;

    async function loadAccount() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user || !isMounted) return;

      const { data: access } = await supabase
        .from("b2_register")
        .select("app_role, full_name")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
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
        setAccount({ initials, name, role: roleLabel(accountAccess?.app_role ?? null, t) });
      }
    }

    void loadAccount();
    return () => {
      isMounted = false;
    };
  }, [language, t]);

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <LanguageToggle />
      <div className="hidden items-center gap-2 border-l border-[#BCD4EE] pl-3 sm:flex">
        <span className="grid size-8 place-items-center rounded-full border border-[#0C68D5]/25 bg-[#E6F1FF] text-xs font-bold text-[#0C68D5]">
          {account.initials}
        </span>
        <div className="min-w-0 text-left">
          <p className="max-w-40 truncate text-xs font-bold text-[#172033]">{account.name}</p>
          <p className="text-[10px] text-[#4d5f81]">{account.role}</p>
        </div>
      </div>
    </div>
  );
}