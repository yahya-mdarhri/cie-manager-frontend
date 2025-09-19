"use client"


import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Search, Settings, Eye, Edit } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NewProjectForm } from "@/components/forms/new-project-form"
import EditProjectForm from "@/components/forms/edit-project-form"
import ViewProjectForm from "@/components/forms/project-view"
import { useAuth } from "@/lib/auth-context"

// Columns definition
const columns = [
  { key: "code", label: "Code" },
  { key: "name", label: "Nom du Projet" },
  { key: "department", label: "Département" },
  { key: "coordinator", label: "Coordinateur" },
  { key: "totalBudget", label: "Budget Total", className: "text-right" },
  { key: "remainingBudget", label: "Budget Restant", className: "text-right" },
  { key: "status", label: "Statut" },
  { key: "actions", label: "Actions", className: "text-center" },
]
async function fetchProjectsForUser(user: { role: string; department?: string | number | null }): Promise<any[]> {
  const base = "http://localhost:8000/api/management"
  const allowedDepartments = new Set(["CIE Direct", "Tech Center", "TTO", "Clinique Industrielle"]) 
  const mapProjects = (projects: any[]) =>
    projects.map((p: any) => ({
      id: p.id,
      departmentId: p.department?.id ?? undefined,
      code: p.project_code,
      name: p.project_name,
      department: p.department?.name ?? "",
      coordinator: p.coordinator,
      totalBudget: Number(p.total_budget).toLocaleString("fr-FR", { style: "currency", currency: "MAD" }),
      remainingBudget: Number(p.remaining_budget).toLocaleString("fr-FR", { style: "currency", currency: "MAD" }),
      status: p.status,
      client: p.client_name,
      startDate: p.signature_date || p.needs_expression_date || "",
      endDate: p.end_date,
    }))

  if (user.role === "director") {
    const depRes = await fetch(`${base}/departments/`, { credentials: "include" })
    if (!depRes.ok) return []
    const departments = (await depRes.json()).filter((d: any) => allowedDepartments.has(d.name))
    const projectLists = await Promise.all(
      departments.map(async (dep: any) => {
        const res = await fetch(`${base}/departments/${dep.id}/projects/`, { credentials: "include" })
        if (!res.ok) return []
        const projs = await res.json()
        return mapProjects(projs)
      })
    )
    return projectLists.flat()
  }

  if (user.role === "department_manager" && user.department) {
    const res = await fetch(`${base}/departments/${user.department}/projects/`, { credentials: "include" })
    if (!res.ok) return []
    const projs = await res.json()
    return mapProjects(projs)
  }

  return []
}

const initialProjectData: any[] = []

export default function ProjectsPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState(initialProjectData)
  const [editingProject, setEditingProject] = useState<any | null>(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [viewingProject, setViewingProject] = useState<any | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        if (!user) return
        const data = await fetchProjectsForUser(user)
        setProjects(data)
      } catch (e) {
        // ignore
      }
    }
    load()
  }, [user])


  // Update logic
  const handleSave = (updatedProject: any) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.code === updatedProject.code ? { ...p, ...updatedProject } : p
      )
    )
  }

  // Add actions column dynamically
  const dataWithActions = projects.map((project) => ({
    ...project,
    actions: (
      <div className="flex items-center justify-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setViewingProject(project)}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditingProject(project)}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </div>
    ),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Gestion des Projets
          </h1>
          <p className="text-muted-foreground">
            Suivi et gestion de tous vos projets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewProjectForm onCreated={async () => {
            if (!user) return
            const data = await fetchProjectsForUser(user)
            setProjects(data)
          }}>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nouveau Projet
            </Button>
          </NewProjectForm>
          <Button
  
            className="flex items-center gap-2 bg-transparent"
          >
            <Settings className="h-4 w-4" />
            Paramètres
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rechercher</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Code, nom ou coordinateur..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              value={selectedDepartment}
              onValueChange={setSelectedDepartment}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous les départements" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les départements</SelectItem>
                <SelectItem value="tto">TTO</SelectItem>
                <SelectItem value="clinique">Clinique Industrielle</SelectItem>
                <SelectItem value="tech">Tech Center</SelectItem>
                <SelectItem value="cie">CIE Direct</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="en-cours">En cours</SelectItem>
                <SelectItem value="en-pause">En pause</SelectItem>
                <SelectItem value="termine">Terminé</SelectItem>
                <SelectItem value="annule">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <DataTable title="Liste des Projets" columns={columns} data={dataWithActions} />

      {/* Edit modal */}
      {editingProject && (
        <EditProjectForm
          project={editingProject}
          onSave={handleSave}
          onClose={() => setEditingProject(null)}
        />
      )}
      {/* View modal */}
      {viewingProject && (
        <ViewProjectForm
          project={viewingProject}
          onClose={() => setViewingProject(null)}
        />
      )}
    </div>
  )
}
