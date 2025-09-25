"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, EyeOff, UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { http } from "@/lib/http"
import { useEffect } from "react"


export default function SignupPage() {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    department: "",
    role: "user",
  })
  const [departments, setDepartments] = useState<any[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        if (!user || user.role !== "director") return
        const res = await http.get(`/api/management/departments/`)
        if (res.status !== 200) return
        const raw = res.data
        const arr = Array.isArray((raw as any)?.results || raw) ? ((raw as any).results || raw) : []
        setDepartments(arr)
        setFormData((prev) => (!prev.department && arr.length > 0 ? { ...prev, department: String(arr[0].id) } : prev))
      } catch {
        // ignore
      }
    }
    loadDepartments()
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      if (!user || user.role !== "director") {
        setError("L'inscription publique est désactivée. Veuillez contacter l'administrateur pour créer un compte.")
        return
      }
      // Create user via backend endpoint reserved for director
      const res = await http.post(`/api/accounts/users/create/`, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        username: formData.username,
        email: formData.email,
      })
      if (res.status !== 201 && res.status !== 200) {
        throw new Error("Échec de création de l'utilisateur")
      }
      const created = res.data
      // Optionally assign department manager role
      if (formData.role === "department_manager" && formData.department) {
        const setRes = await http.put(`/api/management/departments/${formData.department}/set-manager/`, {
          manager: created.id,
        })
        if (setRes.status !== 200) {
          throw new Error("Utilisateur créé, mais l'affectation du département a échoué")
        }
      }
      router.push("/")
    } catch (err:any) {
      setError(String(err.message || err))
    } finally {
      setIsLoading(false)
    }
  }

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <UserPlus className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Créer un compte</CardTitle>
          <CardDescription>Rejoignez le Centre d'Innovation et d'Entrepreneuriat</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="first_name">Prénom</Label>
              <Input id="first_name" value={formData.first_name} onChange={(e) => updateFormData("first_name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Nom</Label>
              <Input id="last_name" value={formData.last_name} onChange={(e) => updateFormData("last_name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <Input id="username" value={formData.username} onChange={(e) => updateFormData("username", e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
                required
              />
            </div>

            {user?.role === "director" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="role">Rôle</Label>
                  <Select value={formData.role} onValueChange={(value) => updateFormData("role", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Utilisateur</SelectItem>
                      <SelectItem value="department_manager">Gestionnaire de département</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.role === "department_manager" && (
                  <div className="space-y-2">
                    <Label htmlFor="department">Département</Label>
                    <Select value={formData.department} onValueChange={(value) => updateFormData("department", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez le département" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Création du compte..." : "Créer le compte"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Déjà un compte ?{" "}
              <Link href="/auth/login" className="text-primary hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
