"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import frTranslations from "@/locales/fr.json"
import enTranslations from "@/locales/en.json"

type Language = "fr" | "en"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const translations = {
  fr: frTranslations,
  en: enTranslations,
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("fr")

  useEffect(() => {
    // Load language from localStorage
    const savedLanguage = localStorage.getItem("language") as Language
    if (savedLanguage && (savedLanguage === "fr" || savedLanguage === "en")) {
      setLanguageState(savedLanguage)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("language", lang)
  }

  const t = (key: string, vars?: Record<string, string | number>): string => {
    // Split the key by dots to access nested properties
    const keys = key.split(".")
    let value: any = translations[language]
    
    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k]
      } else {
        // Return the key if translation not found
        return key
      }
    }
    
    // If value is not a string, return the key
    if (typeof value !== "string") {
      return key
    }
    
    // Replace variables in the translation (e.g., {{name}}, {{count}})
    if (vars) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return String(vars[varName] ?? match)
      })
    }
    
    return value
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
