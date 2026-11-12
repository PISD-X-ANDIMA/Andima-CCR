"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { en, type TranslationType } from "./en";
import { id } from "./id";

export type Language = "en" | "id";

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<TranslationType>;

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const dictionaries: Record<Language, TranslationType> = {
  en,
  id,
};

const LanguageContext = createContext<LanguageContextProps>({
  language: "en",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key: string, fallback?: string) => fallback ?? key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("andima_lang");
      if (saved === "en" || saved === "id") {
        setLanguageState(saved);
      }
    } catch {
      // LocalStorage access may be restricted
    }
  }, []);

  const setLanguage = (nextLang: Language) => {
    setLanguageState(nextLang);
    try {
      localStorage.setItem("andima_lang", nextLang);
      document.documentElement.lang = nextLang;
    } catch {
      // LocalStorage access may be restricted
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "id" : "en");
  };

  const t = (path: string, fallback?: string): string => {
    const keys = path.split(".");
    let current: unknown = dictionaries[language];

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        current = undefined;
        break;
      }
    }

    if (typeof current === "string") {
      return current;
    }

    // Fallback to English dictionary if missing in target
    let fallbackCurrent: unknown = dictionaries.en;
    for (const key of keys) {
      if (fallbackCurrent && typeof fallbackCurrent === "object" && key in fallbackCurrent) {
        fallbackCurrent = (fallbackCurrent as Record<string, unknown>)[key];
      } else {
        fallbackCurrent = undefined;
        break;
      }
    }

    if (typeof fallbackCurrent === "string") {
      return fallbackCurrent;
    }

    return fallback ?? path;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

