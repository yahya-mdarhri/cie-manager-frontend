"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { Pagination } from "@/components/ui/pagination"
import { Plus, Building2, UserPlus, Users, Building, Settings, Edit, Trash2 } from "lucide-react"
import CreateDepartmentForm from "@/components/forms/create-department-form"
import EditDepartmentForm from "@/components/forms/edit-department-form"
import AssignManagersForm from "@/components/forms/assign-managers-form"
import CreateManagerForm from "@/components/forms/create-manager-form"
import EditUserForm from "@/components/forms/edit-user-form"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
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

export default function AdminPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { pagination: deptPagination, goToPage: goToDeptPage, updateFromResponse: updateDeptFromResponse } = usePagination(10)
  const { pagination: userPagination, goToPage: goToUserPage, updateFromResponse: updateUserFromResponse } = usePagination(10)
  
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [managersCount, setManagersCount] = useState(0)
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [activeTab, setActiveTab] = useState<"departments" | "users">("departments")

  // Column definitions with translations
  const departmentColumns = [
    { key: "name", label: t("admin.departmentName") },
    { key: "description", label: t("admin.departmentDescription") },
    { key: "manager", label: t("admin.departmentManager") },
    { key: "projects_count", label: t("admin.departmentProjects"), className: "text-center" },
    { key: "created_at", label: t("admin.departmentCreatedAt") },
    { key: "actions", label: t("common.actions"), className: "text-center" }
  ]

  const userColumns = [
    { key: "name", label: t("admin.userName") },
    { key: "email", label: t("admin.userEmail") },
    { key: "username", label: t("admin.userUsername") },
    { key: "role", label: t("admin.userRole") },
    { key: "department", label: t("admin.userDepartment") },
    { key: "created_at", label: t("admin.userCreatedAt") },
    { key: "actions", label: t("common.actions"), className: "text-center" }
  ]

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
      
      // Count total managers separately
      try {
        const managersResponse = await http.get("/api/management/users/", {
          params: { role: "department_manager" }
        })
        const managersData = managersResponse.data?.results || managersResponse.data || []
        setManagersCount(Array.isArray(managersData) ? managersData.length : managersResponse.data?.count || 0)
      } catch (error) {
        console.warn("Failed to fetch managers count:", error)
      }
    } catch (error) {
      console.error("Error loading users:", error)
    } finally {
      setLoadingUsers(false)
    }
  }

  // Load statistics (for cards at the top)
  const loadStatistics = async () => {
    if (!user || user.role !== "director") return
    
    try {
      // Get total departments count
      const deptResponse = await http.get("/api/management/departments/", {
        params: { page: 1, size: 1 } // Just get first page to extract total count
      })
      updateDeptFromResponse(deptResponse.data)
      
      // Get total users count
      const usersResponse = await http.get("/api/accounts/users/", {
        params: { page: 1, size: 1 }
      })
      updateUserFromResponse(usersResponse.data)
      
      // Get total managers count
      const managersResponse = await http.get("/api/management/users/", {
        params: { role: "department_manager" }
      })
      const managersData = managersResponse.data?.results || managersResponse.data || []
      setManagersCount(Array.isArray(managersData) ? managersData.length : managersResponse.data?.count || 0)
    } catch (error) {
      console.error("Error loading statistics:", error)
    }
  }

  useEffect(() => {
    if (user && user.role === "director") {
      // Load statistics on mount
      loadStatistics()
      
      // Load data for active tab
      if (activeTab === "departments") {
        loadDepartments()
      } else {
        loadUsers()
      }
    }
  }, [user, activeTab, deptPagination.currentPage, userPagination.currentPage])

  const handleDeleteDepartment = async (departmentId: number) => {
    if (!confirm(t("admin.confirmDeleteDepartment"))) {
      return
    }

    try {
      await http.delete(`/api/management/departments/${departmentId}/`)
      await loadDepartments()
      await loadStatistics()
      alert(t("admin.departmentDeleted"))
    } catch (error) {
      console.error("Error deleting department:", error)
      alert(t("admin.errorDeletingDepartment"))
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm(t("admin.confirmDeleteUser"))) {
      return
    }

    try {
      // Try management endpoint first, fallback to accounts endpoint
      try {
        await http.delete(`/api/management/users/${userId}/`)
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.log("Management endpoint not found, trying accounts endpoint...")
          await http.delete(`/api/accounts/users/${userId}/`)
        } else {
          throw error
        }
      }
      await loadUsers()
      await loadStatistics()
      alert(t("admin.userDeleted"))
    } catch (error) {
      console.error("Error deleting user:", error)
      alert(t("admin.errorDeletingUser"))
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR")
  }

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; variant: any }> = {
      director: { label: t("roles.director"), variant: "default" },
      department_manager: { label: t("roles.department_manager"), variant: "secondary" },
      user: { label: t("roles.user"), variant: "outline" }
    }
    const roleInfo = roleMap[role] || { label: role, variant: "outline" }
    return <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>
  }

  // Format data for tables
  const departmentData = departments.map((dept) => ({
    ...dept,
    manager: dept.managers && dept.managers.length > 0 
      ? (
          <div className="flex flex-col gap-1">
            <Badge variant="secondary" className="w-fit">
              {dept.managers.length} {t("admin.managerCount")}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {dept.managers.map(m => `${m.first_name} ${m.last_name}`).join(", ")}
            </span>
          </div>
        )
      : <Badge variant="outline">{t("admin.noManager")}</Badge>,
    created_at: formatDate(dept.created_at),
    actions: (
      <div className="flex items-center justify-center gap-1">
        <AssignManagersForm
          department={dept}
          onUpdated={() => {
            loadDepartments()
            loadStatistics()
          }}
          trigger={
            <Button size="sm" variant="ghost" title={t("admin.assignManagers")}>
              <Users className="h-4 w-4" />
            </Button>
          }
        />
        <EditDepartmentForm
          department={dept}
          onUpdated={() => {
            loadDepartments()
            loadStatistics()
          }}
          trigger={
            <Button size="sm" variant="ghost">
              <Edit className="h-4 w-4" />
            </Button>
          }
        />
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
    department: user.department ? user.department.name : <Badge variant="outline">{t("admin.noDepartment")}</Badge>,
    created_at: formatDate(user.created_at),
    actions: (
      <div className="flex items-center justify-center gap-1">
        <EditUserForm 
          user={user}
          onUpdated={() => {
            loadUsers()
            loadDepartments()
            loadStatistics()
          }}
        />
        <Button 
          size="sm" 
          variant="ghost"
          className="text-red-600 hover:text-red-700"
          onClick={() => handleDeleteUser(user.id)}
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
          <h1 className="text-2xl font-bold mb-4">{t("admin.accessDenied")}</h1>
          <p className="text-muted-foreground">{t("admin.accessDeniedMessage")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("admin.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateDepartmentForm 
            onCreated={() => {
              loadDepartments()
              loadStatistics()
            }}
            trigger={
              <Button className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {t("admin.newDepartment")}
              </Button>
            }
          />
          <CreateManagerForm 
            onCreated={() => {
              loadDepartments()
              loadUsers()
              loadStatistics()
            }}
            trigger={
              <Button className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                {t("admin.newManager")}
              </Button>
            }
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.departments")}</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deptPagination.totalCount}</div>
            <p className="text-xs text-muted-foreground">
              {t("admin.activeDepartments")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.users")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userPagination.totalCount}</div>
            <p className="text-xs text-muted-foreground">
              {t("admin.registeredUsers")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.managers")}</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {managersCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("admin.departmentManagers")}
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
          {t("admin.departments")}
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
          {t("admin.users")}
        </button>
      </div>

      {/* Content */}
      {activeTab === "departments" ? (
        <>
          <DataTable
            title={t("admin.departmentsList")}
            columns={departmentColumns}
            data={departmentData}
            loading={loadingDepartments}
            tableId="admin-departments"
          />
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t("common.showing")} {departments.length} {t("admin.departmentCount")}
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
            title={t("admin.usersList")}
            columns={userColumns}
            data={userData}
            loading={loadingUsers}
            tableId="admin-users"
          />
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t("common.showing")} {users.length} {t("admin.userCount")}
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