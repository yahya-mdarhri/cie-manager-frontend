"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Edit, Loader2, Eye, EyeOff } from "lucide-react"
import { http } from "@/lib/http"
import { useLanguage } from "@/lib/language-context"

interface EditUserFormProps {
  user: {
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
  }
  onUpdated?: () => void
  trigger?: React.ReactNode
}

interface Department {
  id: number
  name: string
  description?: string
}

interface UserFormData {
  first_name: string
  last_name: string
  username: string
  email: string
  role: string
  departmentId: string
  password: string
  confirmPassword: string
}

export function EditUserForm({ user, onUpdated, trigger }: EditUserFormProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState<UserFormData>({
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    email: user.email,
    role: user.role,
    departmentId: user.department?.id?.toString() || "",
    password: "",
    confirmPassword: ""
  })

  // Load departments when dialog opens
  useEffect(() => {
    if (open) {
      loadDepartments()
    }
  }, [open])

  // Update form data when user prop changes
  useEffect(() => {
    setFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      email: user.email,
      role: user.role,
      departmentId: user.department?.id?.toString() || "",
      password: "",
      confirmPassword: ""
    })
  }, [user])

  const loadDepartments = async () => {
    setLoadingDepartments(true)
    try {
      const response = await http.get('/api/management/departments/')
      const departmentList = response.data?.results || response.data || []
      setDepartments(Array.isArray(departmentList) ? departmentList : [])
    } catch (error) {
  console.error('Error loading departments:', error)
  alert(t("user.errors.loadDepartments"))
    } finally {
      setLoadingDepartments(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.first_name || !formData.last_name || !formData.username || !formData.email) {
      alert(t("user.errors.requiredFields"))
      return
    }

    // Password validation (only if password is provided)
    if (formData.password && formData.password.trim()) {
      if (formData.password !== formData.confirmPassword) {
        alert(t("user.errors.passwordMismatch"))
        return
      }
      if (formData.password.length < 6) {
        alert(t("user.errors.passwordTooShort"))
        return
      }
    }

    setLoading(true)
    try {
      // Update the user
      const userData: any = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        username: formData.username,
        email: formData.email,
      }

      // Add password only if provided
      if (formData.password && formData.password.trim()) {
        userData.password = formData.password
      }

      console.log("Updating user data:", userData)

      // Try management endpoint first, fallback to accounts endpoint
      let response
      try {
        response = await http.put(`/api/management/users/${user.id}/`, userData)
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.log("Management endpoint not found, trying accounts endpoint...")
          response = await http.put(`/api/accounts/users/${user.id}/`, userData)
        } else {
          throw error
        }
      }

      if (response.status === 200) {
        // Handle role and department changes separately if needed
        if (formData.role !== user.role && formData.role === "department_manager" && formData.departmentId) {
          try {
            await http.put(`/api/management/departments/${formData.departmentId}/set-manager/`, {
              manager: user.id
            })
          } catch (error) {
            console.warn("Could not update department manager assignment:", error)
          }
        }

        alert(t("user.updateSuccess"))
        setOpen(false)
        if (onUpdated) {
          onUpdated()
        }
      }
    } catch (error: any) {
      console.error("Error updating user:", error)
      const errorMessage =
        error.response?.data?.email?.[0] ||
        error.response?.data?.username?.[0] ||
        error.response?.data?.detail ||
        error.message ||
        t("user.errors.update")
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    // Reset form to original values
    setFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      email: user.email,
      role: user.role,
      departmentId: user.department?.id?.toString() || "",
      password: "",
      confirmPassword: ""
    })
    setOpen(false)
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="ghost">
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            {t("user.editTitle")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Info Display */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("user.currentInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("user.fullName")}:</span>
                <span className="font-medium">{user.first_name} {user.last_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("user.email")}:</span>
                <span className="font-medium">{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("user.role")}:</span>
                {getRoleBadge(user.role)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("user.department")}:</span>
                <span className="font-medium">
                  {user.department ? user.department.name : t("admin.noDepartment")}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Edit Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("user.personalInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">{t("user.firstName")} *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder={t("user.firstName")}
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="last_name">{t("user.lastName")} *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder={t("user.lastNamePlaceholder")}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">{t("user.username")} *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder={t("user.usernamePlaceholder")}
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">{t("user.email")} *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder={t("user.emailPlaceholder")}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role and Department */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("user.roleDepartment")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">{t("user.role")}</Label>
                  <Select 
                    value={formData.role} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("user.selectRole")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">{t("roles.user")}</SelectItem>
                      <SelectItem value="department_manager">{t("roles.department_manager")}</SelectItem>
                      <SelectItem value="director">{t("roles.director")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.role === "department_manager" && (
                  <div className="space-y-2">
                    <Label htmlFor="department">{t("user.department")}</Label>
                    <Select 
                      value={formData.departmentId} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, departmentId: value }))}
                      disabled={loading || loadingDepartments}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("form.project.selectDepartment")} />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id.toString()}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {loadingDepartments && (
                      <p className="text-sm text-muted-foreground">{t("user.loadingDepartments")}</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Password Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("user.changePasswordOptional")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">{t("user.newPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder={t("user.leaveEmpty")}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {formData.password && formData.password.length > 0 && formData.password.length < 6 && (
                    <p className="text-sm text-red-600">{t("user.errors.passwordTooShort")}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("user.confirmPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder={t("user.confirmNewPassword")}
                      disabled={loading || !formData.password}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={!formData.password}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-sm text-red-600">{t("user.errors.passwordMismatch")}</p>
                  )}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>• {t("user.passwordHints.line1")}</p>
                <p>• {t("user.passwordHints.line2")}</p>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={loading}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("user.updating")}
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4" />
                  {t("user.update")}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default EditUserForm