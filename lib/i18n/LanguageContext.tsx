"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { en, type TranslationType } from "./en";
import { id } from "./id";

export type Language = "en" | "id";

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
  ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
  : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<TranslationType>;
export type TranslationParams = Record<string, string | number>;

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallbackOrParams?: string | TranslationParams, params?: TranslationParams) => string;
}

const STORAGE_KEY = "andima_lang";

const dictionaries: Record<Language, TranslationType> = {
  en,
  id,
};

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, token: string) => {
    const value = params[token];
    return value !== undefined && value !== null ? String(value) : match;
  });
}

function resolveKey(dictionary: TranslationType, path: string): string | undefined {
  const keys = path.split(".");
  let current: unknown = dictionary;

  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return typeof current === "string" ? current : undefined;
}

const LanguageContext = createContext<LanguageContextProps>({
  language: "en",
  setLanguage: () => { },
  toggleLanguage: () => { },
  t: (key: string, fallbackOrParams?: string | TranslationParams, params?: TranslationParams) => {
    const fallback = typeof fallbackOrParams === "string" ? fallbackOrParams : key;
    const activeParams = typeof fallbackOrParams === "object" ? fallbackOrParams : params;
    return interpolate(fallback, activeParams);
  },
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "id") {
        setLanguageState(saved);
        document.documentElement.lang = saved;
      } else {
        document.documentElement.lang = "en";
      }
    } catch {
      // LocalStorage access may be restricted
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && (event.newValue === "en" || event.newValue === "id")) {
        setLanguageState(event.newValue);
        document.documentElement.lang = event.newValue;
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setLanguage = useCallback((nextLang: Language) => {
    setLanguageState(nextLang);
    try {
      localStorage.setItem(STORAGE_KEY, nextLang);
      document.documentElement.lang = nextLang;
    } catch {
      // LocalStorage access may be restricted
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const nextLang: Language = prev === "en" ? "id" : "en";
      try {
        localStorage.setItem(STORAGE_KEY, nextLang);
        document.documentElement.lang = nextLang;
      } catch {
        // LocalStorage access may be restricted
      }
      return nextLang;
    });
  }, []);

  const t = useCallback(
    (path: string, fallbackOrParams?: string | TranslationParams, params?: TranslationParams): string => {
      const fallback = typeof fallbackOrParams === "string" ? fallbackOrParams : undefined;
      const activeParams = typeof fallbackOrParams === "object" ? fallbackOrParams : params;

      const localized = resolveKey(dictionaries[language], path);
      if (localized !== undefined) {
        return interpolate(localized, activeParams);
      }

      // Fallback to English dictionary if missing in target
      const englishFallback = resolveKey(dictionaries.en, path);
      if (englishFallback !== undefined) {
        return interpolate(englishFallback, activeParams);
      }

      return interpolate(fallback ?? path, activeParams);
    },
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language, setLanguage, toggleLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>
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
