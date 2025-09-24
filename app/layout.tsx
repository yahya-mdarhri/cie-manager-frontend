"use client"

import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { Header } from "@/components/layout/header"
import { Navigation } from "@/components/layout/navigation"
import { AuthProvider } from "@/lib/auth-context"
import { AuthGuard } from "@/components/auth/auth-guard"
import { usePathname } from "next/navigation"
import { useEffect } from "react"



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <AuthProvider>
          <AuthGuardWrapper>{children}</AuthGuardWrapper>
        </AuthProvider>
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
