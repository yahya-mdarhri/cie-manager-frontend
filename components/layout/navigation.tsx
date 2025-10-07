"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, FolderOpen, Receipt, TrendingUp, Menu, X, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import Image from "next/image"

const baseNavigation = [
  { name: "Accueil", href: "/", icon: Home },
  { name: "Projets", href: "/projects", icon: FolderOpen },
  { name: "Dépenses", href: "/expenses", icon: Receipt },
  { name: "Encaissements", href: "/revenues", icon: TrendingUp },
]

const adminNavigation = [
  { name: "Administration", href: "/admin", icon: Settings, roles: ["director"] },
]

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { user } = useAuth()
  
  // Improve mobile UX: lock body scroll and close on Escape
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [isOpen])
  
  // Build navigation based on user role
  const navigation = [
    ...baseNavigation,
    ...adminNavigation.filter(item => 
      !item.roles || (user && item.roles.includes(user.role))
    )
  ]

  return (
    <>
      {/* Cool Animated Hamburger Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-controls="mobile-sidebar"
          aria-expanded={isOpen}
          className={cn(
            "relative h-12 w-12 rounded-xl transition-all duration-200 ease-in-out",
            "bg-white/90 backdrop-blur-lg border border-gray-200/50 shadow-lg hover:shadow-xl",
            "hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/50",
            "group overflow-hidden",
            isOpen && "bg-blue-50/90 border-blue-200/50"
          )}
        >
          {/* Animated Hamburger Lines */}
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-1.5">
            <span
              className={cn(
                "block h-0.5 w-6 bg-gray-700 transition-all duration-300 ease-in-out",
                "group-hover:bg-blue-600",
                isOpen ? "rotate-45 translate-y-2" : ""
              )}
            />
            <span
              className={cn(
                "block h-0.5 w-6 bg-gray-700 transition-all duration-300 ease-in-out",
                "group-hover:bg-blue-600",
                isOpen ? "opacity-0 scale-0" : "opacity-100 scale-100"
              )}
            />
            <span
              className={cn(
                "block h-0.5 w-6 bg-gray-700 transition-all duration-300 ease-in-out",
                "group-hover:bg-blue-600",
                isOpen ? "-rotate-45 -translate-y-2" : ""
              )}
            />
          </div>
          
          {/* Ripple effect on click */}
          <div className="absolute inset-0 rounded-xl bg-blue-500/20 scale-0 group-active:scale-100 transition-transform duration-150 ease-out" />
          
          <span className="sr-only">{isOpen ? "Fermer" : "Ouvrir"}</span>
        </button>
      </div>

      {/* Sidebar */}
      <nav
        id="mobile-sidebar"
        aria-label="Navigation principale"
        role="dialog"
        aria-modal={isOpen || undefined}
        className={cn(
          "fixed left-0 top-0 z-40 h-full w-64 transform bg-sidebar border-r transition-transform duration-200 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col z-20">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-8">
             
              <div>
                <Image
                  src="/uir.png"
                  alt="Logo"
                  width={300}
                  height={30}
                  className="object-contain"
                />
              </div>
            </div>

            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </nav>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}
