"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { http } from "@/lib/http"

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [password, setPassword] = useState("")
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [tableMeta, setTableMeta] = useState<{ key: string; label: string }[] | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())

  // derive a tableId based on current pathname so settings can be per-page
  const getTableIdFromPath = () => {
    if (typeof window === "undefined") return null
    const p = window.location.pathname
    if (p.includes("/projects")) return "projects"
    if (p.includes("/expenses")) return "expenses"
    if (p.includes("/revenues")) return "revenues"
    if (p.includes("/admin")) return "admin"
    return null
  }

  const tableId = getTableIdFromPath()

  // Load current user data when dialog opens
  useEffect(() => {
    if (open) {
      const loadUserData = async () => {
        try {
          const response = await http.get('/api/accounts/me/')
          const data = response.data
          setFirstName(data.first_name || "")
          setLastName(data.last_name || "")
          setPassword("") // Always start empty for password
          setProfilePicture(null) // Reset file input
        } catch (error) {
          console.error('Failed to load user data:', error)
        }
      }
      loadUserData()
      // load table metadata and visible keys for the current page
      try {
        if (tableId) {
          const meta = localStorage.getItem(`table-columns-meta:${tableId}`)
          const visible = localStorage.getItem(`table-columns-visible:${tableId}`)
          if (meta) {
            setTableMeta(JSON.parse(meta))
            if (visible) {
              setVisibleKeys(new Set(JSON.parse(visible)))
            } else {
              // default to all visible
              const all = JSON.parse(meta).map((m: any) => m.key)
              setVisibleKeys(new Set(all))
            }
          }
        }
      } catch (e) {
        console.error('Failed to load table settings:', e)
      }
    }
  }, [open])

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePicture(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData()
    if (firstName) formData.append('first_name', firstName)
    if (lastName) formData.append('last_name', lastName)
    if (password) formData.append('password', password)
    if (profilePicture) formData.append('profile_picture', profilePicture)

    try {
      const response = await http.put('/api/accounts/me/', formData)
      
      const data = response.data
      
      // Update localStorage with new data
      const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ')
      const u = JSON.parse(localStorage.getItem('user') || '{}')
      u.name = fullName || data.username || data.email
      u.profilePicture = data.profile_picture ?? null
      localStorage.setItem('user', JSON.stringify(u))
      
      alert('Profil mis à jour avec succès')
      onOpenChange(false)
    } catch (error) {
      console.error('Profile update failed:', error)
      alert('Erreur lors de la mise à jour du profil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Paramètres</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Prénom</Label>
              <Input
                id="first_name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prénom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Nom</Label>
              <Input
                id="last_name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom de famille"
              />
            </div>
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
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Laissez vide pour ne pas changer"
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

          {/* Table columns settings */}
          {tableMeta && tableId && (
            <div className="space-y-2">
              <Label>Colonnes du tableau ({tableId})</Label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-auto p-2 border rounded">
                {tableMeta.map((col) => (
                  <label key={col.key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={visibleKeys.has(col.key)}
                      onChange={(e) => {
                        const next = new Set(visibleKeys)
                        if (e.target.checked) next.add(col.key)
                        else next.delete(col.key)
                        setVisibleKeys(next)
                      }}
                    />
                    <span className="text-sm">{col.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    // save visible keys and notify DataTable instances
                    try {
                      localStorage.setItem(
                        `table-columns-visible:${tableId}`,
                        JSON.stringify(Array.from(visibleKeys)),
                      )
                      // notify others (same window)
                      window.dispatchEvent(new CustomEvent('table-columns-updated', { detail: { tableId } }))
                      alert('Paramètres du tableau enregistrés')
                    } catch (e) {
                      console.error('Failed to save table settings', e)
                      alert('Impossible d\'enregistrer les paramètres du tableau')
                    }
                  }}
                >
                  Enregistrer les colonnes
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    // reset to defaults
                    const meta = tableMeta || []
                    const defaults = meta.map((m) => m.key)
                    setVisibleKeys(new Set(defaults))
                    localStorage.setItem(`table-columns-visible:${tableId}`, JSON.stringify(defaults))
                    window.dispatchEvent(new CustomEvent('table-columns-updated', { detail: { tableId } }))
                    alert('Réinitialisé aux valeurs par défaut')
                  }}
                >
                  Réinitialiser
                </Button>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Mise à jour...' : 'Enregistrer les modifications'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}