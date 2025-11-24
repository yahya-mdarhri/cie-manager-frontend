"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Building2, Loader2, UserCircle2 } from "lucide-react"
import { http } from "@/lib/http"
import { useLanguage } from "@/lib/language-context"

interface CreateClientFormProps {
  onCreated?: () => void
  trigger?: React.ReactNode
}

export default function CreateClientForm({ onCreated, trigger }: CreateClientFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { language } = useLanguage()

  const [name, setName] = useState("")
  const [registrationNumber, setRegistrationNumber] = useState("")

  const t = (en: string, fr: string) => (language === "fr" ? fr : en)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !registrationNumber.trim()) {
      alert(t("Please provide name and registration number","Veuillez fournir le nom et le numéro d'enregistrement"))
      return
    }
    setLoading(true)
    try {
      const payload = { name: name.trim(), registration_number: registrationNumber.trim() }
      await http.post("/api/management/clients/create/", payload)
      setName("")
      setRegistrationNumber("")
      setOpen(false)
      onCreated?.()
      alert(t("Client saved","Client enregistré"))
    } catch (err: any) {
      console.error("Error creating client:", err)
      const msg = err?.response?.data?.details || err?.response?.data?.registration_number?.[0] || err?.message || t("Failed to save client","Échec de l'enregistrement du client")
      alert(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <UserCircle2 className="h-4 w-4" />
            {t("New Client","Nouveau Client")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle2 className="h-5 w-5" />
            {t("Create Client","Créer un Client")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("Client Information","Informations Client")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client_name">{t("Name","Nom")} *</Label>
                <Input id="client_name" value={name} onChange={(e) => setName(e.target.value)} required disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_reg">{t("Registration Number","Numéro d'enregistrement")} *</Label>
                <Input id="client_reg" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} required disabled={loading} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              {t("Cancel","Annuler")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Saving...","Enregistrement...")}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("Save Client","Enregistrer le Client")}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
