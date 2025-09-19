"use client"

import { useState } from "react"
import { Building2, LogOut, Settings, UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/auth-context"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import { ProfileDialog } from "@/components/ui/profile-dialog"
import { SettingsDialog } from "@/components/ui/settings-dialog"

export function Header() {
  const { user, logout } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <>
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="flex h-16 items-center justify-between px-6">
          {/* Left side logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-lg font-semibold text-primary">CIE</h1>
                <p className="text-xs text-muted-foreground">
                  Center for Innovation and Entrepreneurship
                </p>
              </div>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
    

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div>
                  <Button
                    variant="ghost"
                    type="button"
                    className="flex items-center gap-2 h-10"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {user ? getUserInitials(user.name) : "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium">
                        {user?.name || "Utilisateur"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {user?.role || "Rôle"}
                      </span>
                    </div>
                  </Button>
                </div>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center gap-2 p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {user ? getUserInitials(user.name) : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user?.name}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  Profil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Paramètres
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Overlays */}
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
