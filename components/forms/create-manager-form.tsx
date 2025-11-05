"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, UserPlus, Loader2, Eye, EyeOff } from "lucide-react"
import { http } from "@/lib/http"
import { useLanguage } from "@/lib/language-context"

interface CreateManagerFormProps {
  onCreated?: () => void
  trigger?: React.ReactNode
}

interface Department {
  id: number
  name: string
  description?: string
}

interface ManagerFormData {
  first_name: string
  last_name: string
  username: string
  email: string
  password: string
  confirmPassword: string
  departmentId: string
}

export function CreateManagerForm({ onCreated, trigger }: CreateManagerFormProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState<ManagerFormData>({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    departmentId: ""
  })

  // Load departments when dialog opens
  useEffect(() => {
    if (open) {
      loadDepartments()
    }
  }, [open])

  const loadDepartments = async () => {
    setLoadingDepartments(true)
    try {
      const response = await http.get('/api/management/departments/')
      const departmentList = response.data?.results || response.data || []
      setDepartments(Array.isArray(departmentList) ? departmentList : [])
    } catch (error) {
  console.error('Error loading departments:', error)
  alert(t("manager.errors.loadDepartments"))
    } finally {
      setLoadingDepartments(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.first_name || !formData.last_name || !formData.username || !formData.email || !formData.password || !formData.departmentId) {
      alert(t("manager.errors.requiredFields"))
      return
    }

    if (formData.password !== formData.confirmPassword) {
      alert(t("manager.errors.passwordMismatch"))
      return
    }

    if (formData.password.length < 6) {
      alert(t("manager.errors.passwordTooShort"))
      return
    }

    setLoading(true)
    try {
      // Log the payload to verify password inclusion
      const userData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        username: formData.username,
        email: formData.email,
        password: formData.password,
      }


      // Step 1: Create the user (use axios instance so cookies/CSRF are included)
      const createResp = await http.post(`/api/management/users/`, userData)
      const userId = createResp.data?.id

      if (!userId) {
        throw new Error('User creation returned unexpected response')
      }

      // Step 2: Assign the user as department manager
      await http.put(`/api/management/departments/${formData.departmentId}/set-manager/`, { manager: userId })

      // Reset form
      setFormData({
        first_name: "",
        last_name: "",
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        departmentId: "",
      })

      alert(t("manager.createSuccess"))
      // Optionally close dialog
      setOpen(false)
    } catch (error: any) {
      console.error("[v0] Error creating manager:", error)
      const errorMessage =
        error.response?.data?.password?.[0] ||
        error.response?.data?.email?.[0] ||
        error.response?.data?.detail ||
        error.message ||
        t("manager.errors.create")
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      first_name: "",
      last_name: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      departmentId: ""
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {t("admin.newManager")}
          </Button>
        )}
      </DialogTrigger>
  <DialogContent className="w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t("manager.createTitle")}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("manager.personalInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">{t("manager.firstName")} *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder={t("manager.firstName")}
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="last_name">{t("manager.lastName")} *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder={t("manager.lastNamePlaceholder")}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">{t("manager.username")} *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder={t("manager.usernamePlaceholder")}
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">{t("manager.email")} *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder={t("manager.emailPlaceholder")}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("manager.security")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">{t("manager.password")} *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      className="pr-10"
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder={t("manager.passwordMin")}
                      required
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("manager.confirmPassword")} *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      className="pr-10"
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder={t("manager.repeatPassword")}
                      required
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={loading}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("manager.assignment")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="department">{t("manager.departmentToManage")} *</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value: string) => setFormData(prev => ({ ...prev, departmentId: value }))}
                  disabled={loading || loadingDepartments}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loadingDepartments ? t("common.loading") : t("form.project.selectDepartment")} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={String(department.id)}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {departments.length === 0 && !loadingDepartments && (
                  <p className="text-sm text-muted-foreground">
                    {t("manager.noDepartments")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
            <Button type="button" onClick={handleCancel} disabled={loading} className="w-full sm:w-auto">
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading || departments.length === 0} className="w-full sm:w-auto">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("manager.creating")}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t("manager.create")}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateManagerForm