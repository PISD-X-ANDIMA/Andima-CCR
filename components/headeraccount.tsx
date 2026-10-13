"use client";
import { useAccount, accountRole } from "@/components/account-provider";
export default function HeaderAccount() {
  const { account: loaded } = useAccount();
  const account = { name: loaded?.full_name ?? "Andima User", initials: loaded?.initials ?? "AU", role: accountRole(loaded?.app_role, "HRMS User") };
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
