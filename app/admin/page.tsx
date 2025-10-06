"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { Pagination } from "@/components/ui/pagination"
import { Plus, Building2, UserPlus, Users, Building, Settings, Edit, Trash2 } from "lucide-react"
import CreateDepartmentForm from "@/components/forms/create-department-form"
import CreateManagerForm from "@/components/forms/create-manager-form"
import { useAuth } from "@/lib/auth-context"
import { usePagination } from "@/hooks/use-pagination"
import { http } from "@/lib/http"

interface Department {
  id: number
  name: string
  description?: string
  created_at: string
  managers?: Array<{
    id: number
    first_name: string
    last_name: string
    email: string
  }>
  projects_count?: number
}

interface User {
  id: number
  first_name: string
  last_name: string
  username: string
  email: string
  role: string
  department?: {
    id: number
    name: string
  }
  created_at: string
}

const departmentColumns = [
  { key: "name", label: "Nom du Département" },
  { key: "description", label: "Description" },
  { key: "manager", label: "Manager" },
  { key: "projects_count", label: "Projets", className: "text-center" },
  { key: "created_at", label: "Créé le" },
  { key: "actions", label: "Actions", className: "text-center" }
]

const userColumns = [
  { key: "name", label: "Nom Complet" },
  { key: "email", label: "Email" },
  { key: "username", label: "Nom d'utilisateur" },
  { key: "role", label: "Rôle" },
  { key: "department", label: "Département" },
  { key: "created_at", label: "Créé le" },
  { key: "actions", label: "Actions", className: "text-center" }
]

export default function AdminPage() {
  const { user } = useAuth()
  const { pagination: deptPagination, goToPage: goToDeptPage, updateFromResponse: updateDeptFromResponse } = usePagination(10)
  const { pagination: userPagination, goToPage: goToUserPage, updateFromResponse: updateUserFromResponse } = usePagination(10)
  
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [activeTab, setActiveTab] = useState<"departments" | "users">("departments")

  // Redirect if not director
  useEffect(() => {
    if (user && user.role !== "director") {
      window.location.href = "/"
      return
    }
  }, [user])

  // Load departments
  const loadDepartments = async () => {
    if (!user || user.role !== "director") return
    
    setLoadingDepartments(true)
    try {
      const response = await http.get("/api/management/departments/", {
        params: { page: deptPagination.currentPage, size: deptPagination.pageSize }
      })
      const data = response.data?.results || response.data || []
      
      // Enrich with manager info and projects count
      const enrichedDepartments = await Promise.all(
        data.map(async (dept: any) => {
          try {
            // Get projects count for this department
            const projectsResponse = await http.get(`/api/management/departments/${dept.id}/projects/`)
            const projects = projectsResponse.data?.results || projectsResponse.data || []
            
            return {
              ...dept,
              projects_count: Array.isArray(projects) ? projects.length : 0
            }
          } catch (error) {
            console.warn(`Failed to fetch projects for department ${dept.id}`)
            return { ...dept, projects_count: 0 }
          }
        })
      )
      
      setDepartments(enrichedDepartments)
      updateDeptFromResponse(response.data)
    } catch (error) {
      console.error("Error loading departments:", error)
    } finally {
      setLoadingDepartments(false)
    }
  }

  // Load users
  const loadUsers = async () => {
    if (!user || user.role !== "director") return
    
    setLoadingUsers(true)
    try {
      const response = await http.get("/api/accounts/users/", {
        params: { page: userPagination.currentPage, size: userPagination.pageSize }
      })
      const data = response.data?.results || response.data || []
      setUsers(Array.isArray(data) ? data : [])
      updateUserFromResponse(response.data)
    } catch (error) {
      console.error("Error loading users:", error)
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    if (user && user.role === "director") {
      if (activeTab === "departments") {
        loadDepartments()
      } else {
        loadUsers()
      }
    }
  }, [user, activeTab, deptPagination.currentPage, userPagination.currentPage])

  const handleDeleteDepartment = async (departmentId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce département ? Cette action est irréversible.")) {
      return
    }

    try {
      await http.delete(`/api/management/departments/${departmentId}/`)
      await loadDepartments()
      alert("Département supprimé avec succès")
    } catch (error) {
      console.error("Error deleting department:", error)
      alert("Erreur lors de la suppression du département")
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR")
  }

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; variant: any }> = {
      director: { label: "Directeur", variant: "default" },
      department_manager: { label: "Manager", variant: "secondary" },
      user: { label: "Utilisateur", variant: "outline" }
    }
    const roleInfo = roleMap[role] || { label: role, variant: "outline" }
    return <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>
  }

  // Format data for tables
  const departmentData = departments.map((dept) => ({
    ...dept,
    manager: dept.managers && dept.managers.length > 0 
      ? `${dept.managers[0].first_name} ${dept.managers[0].last_name}`
      : <Badge variant="outline">Aucun manager</Badge>,
    created_at: formatDate(dept.created_at),
    actions: (
      <div className="flex items-center justify-center gap-1">
        <Button size="sm" variant="ghost">
          <Edit className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={() => handleDeleteDepartment(dept.id)}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    )
  }))

  const userData = users.map((user) => ({
    ...user,
    name: `${user.first_name} ${user.last_name}`,
    role: getRoleBadge(user.role),
    department: user.department ? user.department.name : <Badge variant="outline">Aucun</Badge>,
    created_at: formatDate(user.created_at),
    actions: (
      <div className="flex items-center justify-center gap-1">
        <Button size="sm" variant="ghost">
          <Edit className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    )
  }))

  if (!user || user.role !== "director") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Accès Refusé</h1>
          <p className="text-muted-foreground">Cette page est réservée aux directeurs.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Administration</h1>
          <p className="text-muted-foreground">
            Gestion des départements et utilisateurs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateDepartmentForm onCreated={loadDepartments}>
            <Button className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Nouveau Département
            </Button>
          </CreateDepartmentForm>
          <CreateManagerForm onCreated={() => {
            loadDepartments()
            loadUsers()
          }}>
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Nouveau Manager
            </Button>
          </CreateManagerForm>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Départements</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments.length}</div>
            <p className="text-xs text-muted-foreground">
              Départements actifs
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              Utilisateurs enregistrés
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Managers</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === "department_manager").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Managers de département
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b">
        <button
          onClick={() => setActiveTab("departments")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "departments"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building className="h-4 w-4 mr-2 inline" />
          Départements
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4 mr-2 inline" />
          Utilisateurs
        </button>
      </div>

      {/* Content */}
      {activeTab === "departments" ? (
        <>
          <DataTable
            title="Liste des Départements"
            columns={departmentColumns}
            data={departmentData}
            loading={loadingDepartments}
          />
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Affichage de {departments.length} département(s)
            </div>
            <Pagination
              currentPage={deptPagination.currentPage}
              totalPages={deptPagination.totalPages}
              onPageChange={goToDeptPage}
            />
          </div>
        </>
      ) : (
        <>
          <DataTable
            title="Liste des Utilisateurs"
            columns={userColumns}
            data={userData}
            loading={loadingUsers}
          />
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Affichage de {users.length} utilisateur(s)
            </div>
            <Pagination
              currentPage={userPagination.currentPage}
              totalPages={userPagination.totalPages}
              onPageChange={goToUserPage}
            />
          </div>
        </>
      )}
    </div>
  )
}