"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function EditProjectForm({
  project,
  onSave,
  onClose,
}: {
  project: any
  onSave: (updated: any) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({ ...project })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <Dialog open={!!project} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le projet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Nom du projet"
          />
          <Input
            name="coordinator"
            value={formData.coordinator}
            onChange={handleChange}
            placeholder="Coordinateur"
          />
          <Input
            name="totalBudget"
            value={formData.totalBudget}
            onChange={handleChange}
            placeholder="Budget total"
          />
          <Input
            name="remainingBudget"
            value={formData.remainingBudget}
            onChange={handleChange}
            placeholder="Budget restant"
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => {
              onSave(formData)
              onClose()
            }}
          >
            Sauvegarder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
