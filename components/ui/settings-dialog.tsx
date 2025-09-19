"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [profilePicture, setProfilePicture] = useState<File | null>(null)

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePicture(e.target.files[0])
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
  
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Paramètres</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Entrez votre nom"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-picture">Photo de profil</Label>
            <Input
              id="profile-picture"
              type="file"
              accept="image/*"
              onChange={handleProfilePictureChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Entrez votre nouveau mot de passe"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="dark-mode">Mode sombre</Label>
            <Switch id="dark-mode" />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="notifications">Notifications</Label>
            <Switch id="notifications" defaultChecked />
          </div>

          <Button type="submit" className="w-full">
            Enregistrer les modifications
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}