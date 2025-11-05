"use client"

import type React from "react"
import type { Metadata } from "next"
import { Inter, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"
import { Header } from "@/components/layout/header"
import { Navigation } from "@/components/layout/navigation"
import { AuthProvider } from "@/lib/auth-context"
import { AuthGuard } from "@/components/auth/auth-guard"
import { LanguageProvider } from "@/lib/language-context"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { usePathname } from "next/navigation"
import { useEffect } from "react"


// Notion-like typography: Inter for sans and IBM Plex Mono for code, mapped to existing CSS variables
const InterSans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
})

const PlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-geist-mono",
})


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`font-sans ${InterSans.variable} ${PlexMono.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            <AuthProvider>
              <AuthGuardWrapper>{children}</AuthGuardWrapper>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
        {/* Global toast container */}
        <Toaster />
      </body>
    </html>
  )
}

function AuthGuardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <GlobalFetchCredentials>
        <ConditionalLayout>{children}</ConditionalLayout>
      </GlobalFetchCredentials>
    </div>
  )
}

function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname.startsWith("/auth")

  if (isAuthPage) {
    // Render auth pages without Navigation/Header/AuthGuard
    return <>{children}</>
  }

  // All other pages go inside the dashboard layout
  return (
    <AuthGuard>
      <Navigation />
      <div className="md:ml-64">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </AuthGuard>
  )
}

function GlobalFetchCredentials({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return
    const originalFetch = window.fetch
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const nextInit: RequestInit = {
        credentials: "include",
        ...init,
      }
      // If headers are provided as a plain object, preserve them
      if (init?.headers && !(init.headers instanceof Headers)) {
        nextInit.headers = { ...(init.headers as Record<string, string>) }
      }
      return originalFetch(input, nextInit)
    }
    return () => {
      window.fetch = originalFetch
    }
  }, [])
  return <>{children}</>
}
