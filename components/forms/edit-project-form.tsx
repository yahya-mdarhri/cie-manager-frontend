"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { http } from "@/lib/http"
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
  const { user } = useAuth()
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
          <Button  onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={async () => {
              try {
                const depId = project.departmentId
                const projId = project.id
                if (depId && projId) {
                  const payload = {
                    project_name: formData.name,
                    coordinator: formData.coordinator,
                  }
                  await http.put(`/api/management/departments/${depId}/projects/${projId}/`, payload)
                }
              } catch {}
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
