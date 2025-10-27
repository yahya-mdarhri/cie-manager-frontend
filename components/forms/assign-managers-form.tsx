"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { http } from "@/lib/http"
import { Users } from "lucide-react"

interface Manager {
  id: number
  first_name: string
  last_name: string
  email: string
  username?: string
}

interface Department {
  id: number
  name: string
  description?: string
  managers?: Array<{
    id: number
    first_name: string
    last_name: string
    email: string
  }>
}

interface AssignManagersFormProps {
  department: Department
  onUpdated?: () => void
  trigger?: React.ReactNode
}

export default function AssignManagersForm({
  department,
  onUpdated,
  trigger,
}: AssignManagersFormProps) {
  const [open, setOpen] = useState(false)
  const [managers, setManagers] = useState<Manager[]>([])
  const [selectedManagerIds, setSelectedManagerIds] = useState<number[]>([])
  const [loadingManagers, setLoadingManagers] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load available managers (all users with department_manager role)
  useEffect(() => {
    if (open) {
      loadAvailableManagers()
    }
  }, [open])

  const loadAvailableManagers = async () => {
    setLoadingManagers(true)
    setError(null)
    try {
      // Use management endpoint to list users with proper permissions
      const response = await http.get("/api/management/users/", {
        params: { size: 1000 } // Get all managers in one request
      })
      
      let allUsers = response.data?.results || response.data || []
      console.log("Loaded users from /api/management/users/:", allUsers)
      
      // Filter for department_manager role
      const availableManagers = allUsers.filter(
        (user: any) => user.role === "department_manager"
      )
      
      console.log("Available managers after filter:", availableManagers)
      setManagers(availableManagers)
      
      // Initialize selected managers from department
      if (department.managers && department.managers.length > 0) {
        const currentManagerIds = department.managers.map(m => m.id)
        setSelectedManagerIds(currentManagerIds)
      } else {
        setSelectedManagerIds([])
      }
    } catch (err: any) {
      console.error("Error loading managers:", err)
      setError(
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.message ||
        "Erreur lors du chargement des managers"
      )
    } finally {
      setLoadingManagers(false)
    }
  }

  const handleManagerToggle = (managerId: number) => {
    setSelectedManagerIds(prev => {
      if (prev.includes(managerId)) {
        return prev.filter(id => id !== managerId)
      } else {
        return [...prev, managerId]
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      // Get the selected managers' data
      const assignedManagers = managers.filter(m => 
        selectedManagerIds.includes(m.id)
      )

      // Update department with assigned managers via PUT
      await http.put(`/api/management/departments/${department.id}/`, {
        name: department.name,
        description: department.description,
        managers: assignedManagers.map(m => m.id),
      })

      // Update local state with assigned managers
      setOpen(false)
      if (onUpdated) {
        onUpdated()
      }
    } catch (err: any) {
      console.error("Error assigning managers:", err)
      setError(
        err.response?.data?.error ||
        err.message ||
        "Erreur lors de l'assignation des managers"
      )
    } finally {
      setSubmitting(false)
    }
  }

  const getSelectedManagerNames = () => {
    const selected = managers.filter(m => selectedManagerIds.includes(m.id))
    if (selected.length === 0) {
      return "Aucun manager"
    }
    if (selected.length === 1) {
      return `${selected[0].first_name} ${selected[0].last_name}`
    }
    return `${selected.length} managers`
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="ghost">
            <Users className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assigner des Managers</DialogTitle>
          <DialogDescription>
            Sélectionnez les managers à assigner à <strong>{department.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {loadingManagers ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Chargement des managers...</p>
            </div>
          ) : managers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-2">
              <p className="text-muted-foreground">
                Aucun manager disponible. Créez d'abord des managers.
              </p>
              {error && (
                <p className="text-xs text-red-600">Erreur: {error}</p>
              )}
            </div>
          ) : (
            <>
              <ScrollArea className="border rounded-md p-4 max-h-96">
                <div className="space-y-3 pr-4">
                  {managers.map(manager => (
                    <div
                      key={manager.id}
                      className="flex items-start space-x-3 p-2 rounded hover:bg-muted"
                    >
                      <Checkbox
                        id={`manager-${manager.id}`}
                        checked={selectedManagerIds.includes(manager.id)}
                        onCheckedChange={() => handleManagerToggle(manager.id)}
                        disabled={submitting}
                      />
                      <Label
                        htmlFor={`manager-${manager.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium">
                          {manager.first_name} {manager.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {manager.email}
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {managers.length > 0 && (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">
                Managers sélectionnés: <strong>{selectedManagerIds.length}</strong>
              </p>
              {selectedManagerIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {managers
                    .filter(m => selectedManagerIds.includes(m.id))
                    .map(m => (
                      <Badge key={m.id} variant="secondary">
                        {m.first_name} {m.last_name}
                      </Badge>
                    ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={submitting || loadingManagers}>
              {submitting ? "Assignation..." : "Assigner"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
