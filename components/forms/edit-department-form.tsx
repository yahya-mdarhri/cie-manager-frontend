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
      alert("Le nom du département est requis")
      return
    }

    setLoading(true)
    try {
      await http.put(`/api/management/departments/${department.id}/`, formData)
      
      setOpen(false)
      onUpdated?.()
      alert("Département mis à jour avec succès")
    } catch (error: any) {
      console.error('Error updating department:', error)
      const errorMessage = error.response?.data?.name?.[0] || 
                           error.response?.data?.details || 
                           "Erreur lors de la mise à jour du département"
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
            Modifier le Département
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations du Département</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du Département *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Tech Center, CIE Direct, TTO..."
                  required
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Décrivez les responsabilités et activités du département..."
                  className="min-h-[100px]"
                  disabled={loading}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Mise à jour...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Mettre à jour
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
