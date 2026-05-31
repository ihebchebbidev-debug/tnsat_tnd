import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { translations, type Lang, type TranslationKey } from "@/utils/translations";
import { getLang, setLangStorage } from "@/store/store";

interface LangContextType {
  lang: Lang;
  t: (key: TranslationKey) => string;
  setLanguage: (lang: Lang) => void;
  isRTL: boolean;
}

const LangContext = createContext<LangContextType | null>(null);

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>(getLang);

  const isRTL = lang === "ar";

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang, isRTL]);

  const t = useCallback((key: TranslationKey) => {
    return translations[lang]?.[key] || translations.fr[key] || key;
  }, [lang]);

  const setLanguage = useCallback((next: Lang) => {
    setLang(next);
    setLangStorage(next);
  }, []);

  return (
    <LangContext.Provider value={{ lang, t, setLanguage, isRTL }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
};
