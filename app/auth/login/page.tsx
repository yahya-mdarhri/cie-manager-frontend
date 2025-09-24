"use client"
import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, LogIn } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { http } from "@/lib/http"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsLoading(true)
  setError("")

  try {
    const res = await http.post(`/api/accounts/login/`, { email, password })

    if (res.status !== 200) {
      const data = res.data || {}
      setError(data.detail || "Email ou mot de passe incorrect")
      return
    }

    const data = res.data

    // Backend returns: { user: { id, first_name, last_name, username, email, role, department }, access_token, refresh }
    const fullName = [data.user?.first_name, data.user?.last_name].filter(Boolean).join(" ")
    const userData = {
      id: String(data.user?.id ?? ""),
      email: data.user?.email ?? "",
      name: fullName || data.user?.username || data.user?.email || "",
      role: data.user?.role ?? "",
      department: data.user?.department ?? "",
    }

   

    login(userData)
    router.push("/")
  } catch (err) {
    setError("Impossible de se connecter au serveur")
  } finally {
    setIsLoading(false)
  }
}


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4 bg-fixed  ">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <LogIn className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Connexion</CardTitle>
          <CardDescription>Connectez-vous à votre compte CIE</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Pas encore de compte ?{" "}
              <Link href="/auth/signup" className="text-primary hover:underline">
                Créer un compte
              </Link>
            </p>
          </div>

          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <p className="font-medium mb-1">Compte de démonstration :</p>
            <p>Email: admin@cie.ma</p>
            <p>Mot de passe: admin123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}



