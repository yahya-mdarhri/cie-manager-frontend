"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, FolderOpen, Receipt, TrendingUp, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Accueil", href: "/", icon: Home },
  { name: "Projets", href: "/projects", icon: FolderOpen },
  { name: "Dépenses", href: "/expenses", icon: Receipt },
  { name: "Encaissements", href: "/revenues", icon: TrendingUp },
]

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* Mobile menu button */}
      <div className="md:hidden fixed top-9 left-9 z-50">
        <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <nav
        className={cn(
          "fixed left-0 top-0 z-40 h-full w-64 transform bg-sidebar border-r transition-transform duration-200 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col z-20">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-8">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">CIE</span>
              </div>
              <div>
                <h2 className="font-semibold text-sidebar-foreground">Business Manager</h2>
                <p className="text-xs text-muted-foreground">Innovation Center</p>
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
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
      {isOpen && <div className="fixed inset-0 z-90 bg-black/50 md:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
