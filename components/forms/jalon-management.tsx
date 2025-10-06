"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Plus, Edit, Trash2, CheckCircle, Clock, AlertTriangle, Upload, FileText, Eye, BarChart3 } from "lucide-react"
import { http } from "@/lib/http"
import GanttDialog from "@/components/dialogs/gantt-dialog"

interface Jalon {
  id: number
  name: string
  description: string
  start_date: string
  end_date: string
  execution_status: boolean
  execution_comments?: string
  execution_proof?: string
  created_at: string
}

interface JalonFormData {
  name: string
  description: string
  start_date: string
  end_date: string
  priority: "Low" | "Medium" | "High" | "Critical"
}

interface JalonManagementProps {
  projectId: number
  departmentId: number
  projectEndDate?: string
  projectName?: string
  projectDescription?: string
  onUpdate?: () => void
}

const priorityColors = {
  Low: "bg-gray-100 text-gray-800",
  Medium: "bg-blue-100 text-blue-800",
  High: "bg-orange-100 text-orange-800",
  Critical: "bg-red-100 text-red-800"
}

const statusColors = {
  completed: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  overdue: "bg-red-100 text-red-800"
}

export default function JalonManagement({ 
  projectId, 
  departmentId, 
  projectEndDate,
  projectName = "Projet",
  projectDescription,
  onUpdate 
}: JalonManagementProps) {
  const [jalons, setJalons] = useState<Jalon[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingJalon, setEditingJalon] = useState<Jalon | null>(null)
  const [executingJalon, setExecutingJalon] = useState<Jalon | null>(null)
  const [showGanttView, setShowGanttView] = useState(false)
  const [formData, setFormData] = useState<JalonFormData>({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    priority: "Medium"
  })
  const [executionForm, setExecutionForm] = useState({
    comments: "",
    proof: null as File | null
  })

  const fetchJalons = async () => {
    setLoading(true)
    try {
      const response = await http.get(`/api/management/departments/${departmentId}/projects/${projectId}/steps/`)
      const data = response.data?.results || response.data || []
      setJalons(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching jalons:", error)
      setJalons([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (projectId && departmentId) {
      fetchJalons()
    }
  }, [projectId, departmentId])

  const handleCreateJalon = async () => {
    try {
      const fd = new FormData()
      fd.append("name", formData.name)
      fd.append("description", formData.description)
      fd.append("start_date", formData.start_date)
      fd.append("end_date", formData.end_date)

      await http.post(
        `/api/management/departments/${departmentId}/projects/${projectId}/steps/create/`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      )

      await fetchJalons()
      setShowCreateModal(false)
      setFormData({
        name: "",
        description: "",
        start_date: "",
        end_date: "",
        priority: "Medium"
      })
      onUpdate?.()
    } catch (error) {
      console.error("Error creating jalon:", error)
      alert("Erreur lors de la création du jalon")
    }
  }

  const handleUpdateJalon = async (jalonId: number) => {
    try {
      const fd = new FormData()
      fd.append("name", formData.name)
      fd.append("description", formData.description)
      fd.append("start_date", formData.start_date)
      fd.append("end_date", formData.end_date)

      await http.put(
        `/api/management/departments/${departmentId}/projects/${projectId}/steps/${jalonId}/`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      )

      await fetchJalons()
      setEditingJalon(null)
      onUpdate?.()
    } catch (error) {
      console.error("Error updating jalon:", error)
      alert("Erreur lors de la modification du jalon")
    }
  }

  const handleDeleteJalon = async (jalonId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce jalon ?")) return

    try {
      await http.delete(
        `/api/management/departments/${departmentId}/projects/${projectId}/steps/${jalonId}/`
      )
      await fetchJalons()
      onUpdate?.()
    } catch (error) {
      console.error("Error deleting jalon:", error)
      alert("Erreur lors de la suppression du jalon")
    }
  }

  const handleExecuteJalon = async (jalonId: number) => {
    try {
      const fd = new FormData()
      fd.append("execution_status", "true")
      fd.append("execution_comments", executionForm.comments)
      if (executionForm.proof) {
        fd.append("execution_proof", executionForm.proof)
      }

      await http.put(
        `/api/management/departments/${departmentId}/projects/${projectId}/steps/${jalonId}/execute/`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      )

      await fetchJalons()
      setExecutingJalon(null)
      setExecutionForm({ comments: "", proof: null })
      onUpdate?.()
    } catch (error) {
      console.error("Error executing jalon:", error)
      alert("Erreur lors de l'exécution du jalon")
    }
  }

  const getJalonStatus = (jalon: Jalon) => {
    if (jalon.execution_status) return "completed"
    const today = new Date()
    const endDate = new Date(jalon.end_date)
    return endDate < today ? "overdue" : "pending"
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4" />
      case "overdue":
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const calculateProgress = () => {
    if (jalons.length === 0) return 0
    const completed = jalons.filter(j => j.execution_status).length
    return (completed / jalons.length) * 100
  }

  const startEditing = (jalon: Jalon) => {
    setFormData({
      name: jalon.name,
      description: jalon.description,
      start_date: jalon.start_date,
      end_date: jalon.end_date,
      priority: "Medium" // Default since we don't have this in the current model
    })
    setEditingJalon(jalon)
  }

  return (
    <div className="space-y-6">
      {/* Header with progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Jalons du Projet
            </CardTitle>
            <div className="flex items-center gap-2">
              {jalons.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={() => setShowGanttView(true)}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Vue Gantt
                </Button>
              )}
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau Jalon
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progression globale</span>
              <span>{Math.round(calculateProgress())}% ({jalons.filter(j => j.execution_status).length}/{jalons.length})</span>
            </div>
            <Progress value={calculateProgress()} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Jalons List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p>Chargement des jalons...</p>
            </CardContent>
          </Card>
        ) : jalons.length > 0 ? (
          jalons.map((jalon) => {
            const status = getJalonStatus(jalon)
            return (
              <Card key={jalon.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{jalon.name}</h3>
                        <Badge className={statusColors[status as keyof typeof statusColors]}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(status)}
                            {status === "completed" ? "Terminé" : status === "overdue" ? "En retard" : "En cours"}
                          </div>
                        </Badge>
                      </div>
                      <p className="text-gray-600 mb-3">{jalon.description}</p>
                      <div className="flex items-center gap-6 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Début: {new Date(jalon.start_date).toLocaleDateString("fr-FR")}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Fin: {new Date(jalon.end_date).toLocaleDateString("fr-FR")}</span>
                        </div>
                      </div>
                      {jalon.execution_comments && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm">
                            <strong>Commentaires d'exécution:</strong> {jalon.execution_comments}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {jalon.execution_proof && (
                        <Button size="sm" variant="outline">
                          <FileText className="h-4 w-4 mr-1" />
                          Preuve
                        </Button>
                      )}
                      {!jalon.execution_status && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => setExecutingJalon(jalon)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Marquer terminé
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEditing(jalon)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteJalon(jalon.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500 mb-4">Aucun jalon n'a été défini pour ce projet.</p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer le premier jalon
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Jalon Modal */}
      <Dialog open={showCreateModal || editingJalon !== null} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false)
          setEditingJalon(null)
          setFormData({
            name: "",
            description: "",
            start_date: "",
            end_date: "",
            priority: "Medium"
          })
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingJalon ? "Modifier le jalon" : "Nouveau jalon"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nom du jalon*</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Livraison phase 1"
                />
              </div>
              <div>
                <Label htmlFor="priority">Priorité</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Faible</SelectItem>
                    <SelectItem value="Medium">Moyenne</SelectItem>
                    <SelectItem value="High">Élevée</SelectItem>
                    <SelectItem value="Critical">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description*</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Décrivez les objectifs et livrables de ce jalon..."
                className="min-h-[100px]"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Date de début*</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="end_date">Date de fin*</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  max={projectEndDate}
                />
                {projectEndDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    Date limite du projet: {new Date(projectEndDate).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateModal(false)
                  setEditingJalon(null)
                }}
              >
                Annuler
              </Button>
              <Button 
                onClick={() => {
                  if (editingJalon) {
                    handleUpdateJalon(editingJalon.id)
                  } else {
                    handleCreateJalon()
                  }
                }}
                disabled={!formData.name || !formData.description || !formData.start_date || !formData.end_date}
              >
                {editingJalon ? "Modifier" : "Créer"} le jalon
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Execute Jalon Modal */}
      <Dialog open={executingJalon !== null} onOpenChange={(open) => {
        if (!open) {
          setExecutingJalon(null)
          setExecutionForm({ comments: "", proof: null })
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Marquer le jalon comme terminé</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium">{executingJalon?.name}</h4>
              <p className="text-sm text-gray-600 mt-1">{executingJalon?.description}</p>
            </div>
            <div>
              <Label htmlFor="comments">Commentaires d'exécution</Label>
              <Textarea
                id="comments"
                value={executionForm.comments}
                onChange={(e) => setExecutionForm(prev => ({ ...prev, comments: e.target.value }))}
                placeholder="Décrivez ce qui a été accompli, les résultats obtenus..."
                className="min-h-[100px]"
              />
            </div>
            <div>
              <Label htmlFor="proof">Preuve d'exécution (optionnel)</Label>
              <Input
                id="proof"
                type="file"
                onChange={(e) => setExecutionForm(prev => ({ ...prev, proof: e.target.files?.[0] || null }))}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              <p className="text-xs text-gray-500 mt-1">
                Formats acceptés: PDF, Word, images (max 10MB)
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setExecutingJalon(null)}>
                Annuler
              </Button>
              <Button 
                onClick={() => executingJalon && handleExecuteJalon(executingJalon.id)}
                className="bg-green-600 hover:bg-green-700"
              >
                Marquer comme terminé
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gantt View Dialog */}
      <GanttDialog
        open={showGanttView}
        onOpenChange={setShowGanttView}
        project={{
          id: projectId,
          project_name: projectName,
          description: projectDescription
        }}
        jalons={jalons.map(jalon => ({
          id: jalon.id,
          name: jalon.name,
          description: jalon.description,
          start_date: jalon.start_date,
          end_date: jalon.end_date,
          is_completed: jalon.execution_status,
          completion_date: jalon.execution_status ? jalon.created_at : undefined,
          proof_document: jalon.execution_proof,
          comments: jalon.execution_comments
        }))}
      />
    </div>
  )
}
