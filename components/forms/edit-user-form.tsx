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
      alert("Erreur lors du chargement des départements")
    } finally {
      setLoadingDepartments(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.first_name || !formData.last_name || !formData.username || !formData.email) {
      alert("Veuillez remplir tous les champs obligatoires")
      return
    }

    // Password validation (only if password is provided)
    if (formData.password && formData.password.trim()) {
      if (formData.password !== formData.confirmPassword) {
        alert("Les mots de passe ne correspondent pas")
        return
      }
      if (formData.password.length < 6) {
        alert("Le mot de passe doit contenir au moins 6 caractères")
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

        alert("Utilisateur mis à jour avec succès")
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
        "Erreur lors de la mise à jour de l'utilisateur"
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
      director: { label: "Directeur", variant: "default" },
      department_manager: { label: "Manager", variant: "secondary" },
      user: { label: "Utilisateur", variant: "outline" }
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
            Modifier l'utilisateur
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Info Display */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations actuelles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nom complet:</span>
                <span className="font-medium">{user.first_name} {user.last_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email:</span>
                <span className="font-medium">{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Rôle:</span>
                {getRoleBadge(user.role)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Département:</span>
                <span className="font-medium">
                  {user.department ? user.department.name : "Aucun"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Edit Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations personnelles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prénom *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="Prénom"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Nom de famille"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Nom d'utilisateur *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="nom.utilisateur"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@example.com"
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
              <CardTitle className="text-lg">Rôle et Département</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Rôle</Label>
                  <Select 
                    value={formData.role} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Utilisateur</SelectItem>
                      <SelectItem value="department_manager">Manager de Département</SelectItem>
                      <SelectItem value="director">Directeur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.role === "department_manager" && (
                  <div className="space-y-2">
                    <Label htmlFor="department">Département</Label>
                    <Select 
                      value={formData.departmentId} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, departmentId: value }))}
                      disabled={loading || loadingDepartments}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un département" />
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
                      <p className="text-sm text-muted-foreground">Chargement des départements...</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Password Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Changer le mot de passe (optionnel)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Laisser vide pour ne pas changer"
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
                    <p className="text-sm text-red-600">Le mot de passe doit contenir au moins 6 caractères</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirmer le nouveau mot de passe"
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
                    <p className="text-sm text-red-600">Les mots de passe ne correspondent pas</p>
                  )}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>• Laissez les champs vides pour conserver le mot de passe actuel</p>
                <p>• Le mot de passe doit contenir au moins 6 caractères</p>
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
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mise à jour...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4" />
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

export default EditUserForm