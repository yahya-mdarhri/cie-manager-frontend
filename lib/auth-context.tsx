"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface User {
  id: string
  name: string
  email: string
  role: string
  department?: string
}

interface AuthContextType {
  user: User | null
  login: (userData: User) => void
  logout: () => void
  isLoading: boolean
}
    
const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = localStorage.getItem("user")
        if (userData) {
          setUser(JSON.parse(userData))
          setIsLoading(false)
          return
        }
        // Fallback to server validation via cookie
        const res = await fetch("http://localhost:8000/api/accounts/me/", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ")
          const u = {
            id: String(data.id ?? ""),
            email: data.email ?? "",
            name: fullName || data.username || data.email || "",
            role: data.role ?? "",
            department: data.department ?? "",
          }
          setUser(u)
          localStorage.setItem("user", JSON.stringify(u))
        } else {
          localStorage.removeItem("user")
        }
      } catch (error) {
        console.error("Auth check failed:", error)
        localStorage.removeItem("user")
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = (userData: User) => {
    setUser(userData)
    localStorage.setItem("user", JSON.stringify(userData))
  }

  const logout = async () => {
    try {
      await fetch("http://localhost:8000/api/accounts/logout/", { method: "POST", credentials: "include" })
    } catch (e) {
      // ignore network errors here
    } finally {
      setUser(null)
      localStorage.removeItem("user")
      router.push("/auth/login")
    }
  }

  return <AuthContext.Provider value={{ user, login, logout, isLoading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
