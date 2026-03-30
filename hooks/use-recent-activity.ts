"use client"

import { useEffect, useState } from "react"
import { http } from "@/lib/http"

export interface ActivityLog {
  id: number
  user: number | null
  user_email: string
  user_name?: string
  content_type: string
  model_name: string
  object_id: string
  object_name: string
  action: "CREATE" | "UPDATE" | "DELETE"
  action_label: string
  changes: any
  timestamp: string
  formatted_timestamp: string
  ip_address: string | null
  user_agent: string | null
}

interface ActivityLogResponse {
  results?: ActivityLog[]
  count?: number
}

export function useRecentActivity(limit: number = 20, autoRefresh: boolean = false) {
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActivities = async () => {
    try {
      const { data } = await http.get<ActivityLog[] | ActivityLogResponse>('/api/management/action-logs/', {
        params: { page: 1, size: limit }
      })
      const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
      setActivities(
        list.map((activity) => ({
          ...activity,
          user_name: activity.user_name || activity.user_email,
          content_type: String(activity.content_type || "").toLowerCase(),
          model_name: String(activity.model_name || "").toLowerCase(),
        }))
      )
      setError(null)
    } catch (err: any) {
      console.error("Failed to fetch recent activity:", err)
      const errorMessage = err?.response?.data?.detail || 
                          err?.response?.data?.error || 
                          "Impossible de charger les activités récentes"
      setError(errorMessage)
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchActivities()

    // Auto-refresh every 30 seconds if enabled
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchActivities()
      }, 30000)

      return () => clearInterval(interval)
    }
  }, [limit, autoRefresh])

  return { activities, loading, error, refetch: fetchActivities }
}
