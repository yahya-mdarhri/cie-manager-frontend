"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/lib/auth-context"

export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth()

  const getUserInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Profil</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {user ? getUserInitials(user.name) : "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-lg font-semibold">{user?.name || "Utilisateur"}</h2>
            <p className="text-sm text-muted-foreground">{user?.email || "user@example.com"}</p>
            <p className="text-xs text-muted-foreground">{user?.role || "Rôle"}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
