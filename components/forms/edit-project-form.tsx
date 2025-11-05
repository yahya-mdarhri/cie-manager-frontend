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
import { useLanguage } from "@/lib/language-context"

export default function EditProjectForm({
  project,
  onSave,
  onClose,
}: {
  project: any
  onSave: (updated: any) => void
  onClose: () => void
}) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [formData, setFormData] = useState({ ...project })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <Dialog open={!!project} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("form.project.edit")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={t("projects.name")}
          />
          <Input
            name="coordinator"
            value={formData.coordinator}
            onChange={handleChange}
            placeholder={t("projects.coordinator")}
          />
          <Input
            name="totalBudget"
            value={formData.totalBudget}
            onChange={handleChange}
            placeholder={t("projects.totalBudget")}
          />
          <Input
            name="remainingBudget"
            value={formData.remainingBudget}
            onChange={handleChange}
            placeholder={t("projects.remainingBudget")}
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button  onClick={onClose}>
            {t("common.cancel")}
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
            {t("common.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
