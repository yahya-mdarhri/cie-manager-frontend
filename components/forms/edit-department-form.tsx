"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Edit, Building2, Loader2 } from "lucide-react"
import { http } from "@/lib/http"
import { useLanguage } from "@/lib/language-context"

interface EditDepartmentFormProps {
  department: {
    id: number
    name: string
    description?: string
  }
  onUpdated?: () => void
  trigger?: React.ReactNode
}

interface DepartmentFormData {
  name: string
  description: string
}

export function EditDepartmentForm({ department, onUpdated, trigger }: EditDepartmentFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t } = useLanguage()
  const [formData, setFormData] = useState<DepartmentFormData>({
    name: department.name,
    description: department.description || ""
  })

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        name: department.name,
        description: department.description || ""
      })
    }
  }, [open, department])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert(t('department.nameRequired'))
      return
    }

    setLoading(true)
    try {
      await http.put(`/api/management/departments/${department.id}/`, formData)
      
      setOpen(false)
      onUpdated?.()
      alert(t('department.updateSuccess'))
    } catch (error: any) {
      console.error('Error updating department:', error)
      const errorMessage = error.response?.data?.name?.[0] || 
                           error.response?.data?.details || 
                           t('department.updateError')
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="ghost">
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t('department.editTitle')}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('department.infoTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('department.name')} *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('department.namePlaceholder')}
                  required
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">{t('department.description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('department.descriptionPlaceholder')}
                  className="min-h-[100px]"
                  disabled={loading}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={loading}>
              {t('department.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('department.updating')}
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  {t('department.update')}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default EditDepartmentForm
