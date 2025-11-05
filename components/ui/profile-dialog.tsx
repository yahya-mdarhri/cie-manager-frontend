"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { http } from "@/lib/http"
import { useToast } from "@/hooks/use-toast"

export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, login } = useAuth()
  const { t } = useLanguage()
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const getUserInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      const url = URL.createObjectURL(f)
      setPreview(url)
    }
  }

  const refreshUser = async () => {
    try {
      const res = await http.get(`/api/accounts/me/`)
      if (res.status === 200) {
        const data = res.data
        const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ")
        login({
          id: String(data.id ?? ""),
          email: data.email ?? "",
          name: fullName || data.username || data.email || "",
          role: data.role ?? "",
          department: data.department ?? "",
          avatarUrl: data.profile_picture_url ?? null,
        })
      }
    } catch (e) {
      // ignore
    }
  }

  const onUpload = async () => {
    if (!file) return
    try {
      const form = new FormData()
      form.append("profile_picture", file)
      await http.patch(`/api/accounts/me/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      toast({ title: t("settings.profileUpdateSuccess") })
      await refreshUser()
      setFile(null)
      setPreview(null)
    } catch (e) {
      toast({ title: t("settings.profileUpdateError") })
    }
  }

  const onRemove = async () => {
    try {
      const form = new FormData()
      // Backend clears when empty string provided
      form.append("profile_picture", "")
      await http.patch(`/api/accounts/me/`, form)
      toast({ title: t("settings.profileUpdateSuccess") })
      await refreshUser()
      setFile(null)
      setPreview(null)
    } catch (e) {
      toast({ title: t("settings.profileUpdateError") })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('profile.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            {preview ? (
              <AvatarImage src={preview} alt={user?.name || "avatar preview"} />
            ) : user?.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.name} />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {user ? getUserInitials(user.name) : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{user?.name || t('profile.userFallback')}</h2>
            <p className="text-sm text-muted-foreground">{user?.email || "user@example.com"}</p>
            <p className="text-xs text-muted-foreground">{user?.role || t('profile.roleFallback')}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input id="profile_picture_input" type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          <label htmlFor="profile_picture_input">
            <Button type="button" size="sm">
              {t("common.import")}
            </Button>
          </label>
          {file ? (
            <Button type="button" size="sm" onClick={onUpload}>
              {t("common.save")}
            </Button>
          ) : null}
          {user?.avatarUrl ? (
            <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
              {t("common.delete")}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
