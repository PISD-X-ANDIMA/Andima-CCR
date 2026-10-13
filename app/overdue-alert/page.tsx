"use client";

import React, { useState } from "react";
import OverdueAlertView from "@/components/OverdueAlertView";
import WarningLetterGenerator from "@/components/WarningLetterGenerator";
import { OverdueInvoiceItem } from "@/types/overdue";

export default function OverdueAlertPage() {
  const [activeView, setActiveView] = useState<"dashboard" | "sp_generator">("dashboard");
  const [selectedInvoice, setSelectedInvoice] = useState<OverdueInvoiceItem | null>(null);

  const handleOpenWarningLetter = (inv: OverdueInvoiceItem) => {
    setSelectedInvoice(inv);
    setActiveView("sp_generator");
  };

  return activeView === "sp_generator" && selectedInvoice ? (
    <WarningLetterGenerator
      invoice={selectedInvoice}
      onBack={() => setActiveView("dashboard")}
    />
  ) : (
    <OverdueAlertView onOpenWarningLetter={handleOpenWarningLetter} />
  );
}
