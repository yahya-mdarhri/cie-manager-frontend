"use client"

import { useEffect, useState } from "react"
import { MetricCard } from "@/components/ui/metric-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FolderOpen, DollarSign, TrendingUp, TrendingDown, Download, Calendar, Settings, Building2, UserPlus } from "lucide-react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { http } from "@/lib/http"
import ExportMenu from "@/components/ui/export-menu"
import CreateDepartmentForm from "@/components/forms/create-department-form"
import CreateManagerForm from "@/components/forms/create-manager-form"
import { useRecentActivity } from "@/hooks/use-recent-activity"

export default function Dashboard() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [reloadKey, setReloadKey] = useState(0)
  const [metrics, setMetrics] = useState({
    projects: 0,
    totalBudget: 0,
    committedBudget: 0,
    remainingBudget: 0,
  })
  const [recent, setRecent] = useState<Array<{ title: string; subtitle: string; color: string }>>([])
  const { activities, loading: activityLoading, error: activityError, refetch } = useRecentActivity(20)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    "In Progress": 0,
    Paused: 0,
    Completed: 0,
    Cancelled: 0,
  })

  useEffect(() => {
    const load = async () => {
      if (!user) return
  const base = "/api/management"
  const locale = language === "fr" ? "fr-FR" : "en-US"
  const formatMoney = (n: number) => Number(n || 0).toLocaleString(locale, { style: "currency", currency: "MAD" })

      let projects: any[] = []
      try {
        if (user.role === "director") {
          // Fetch all projects in one call for directors
          const { data: raw } = await http.get(`${base}/all/projects/`, { params: { page: 1, size: 1000 } })
          projects = (raw?.results || raw) ?? []
        } else if (user.role === "department_manager" && user.department) {
          // Fetch projects for the manager's department (normalize department id if it's an object)
          const depId =
            typeof user.department === "object"
              ? String((user.department as any)?.id ?? (user.department as any)?.pk ?? "")
              : String(user.department ?? "")
          if (depId) {
            const { data: raw } = await http.get(`${base}/departments/${depId}/projects/`, { params: { page: 1, size: 1000 } })
            projects = (raw?.results || raw) ?? []
          } else {
            projects = []
          }
        }
      } catch (e) {
        // If unauthorized or network issues, leave projects empty; interceptor will redirect on 401
        projects = []
      }

      const totals = projects.reduce(
        (acc, p: any) => {
          acc.projects += 1
          acc.totalBudget += Number(p.total_budget || 0)
          acc.committedBudget += Number(p.committed_budget || 0)
          acc.remainingBudget += Number(p.remaining_budget || 0)
          return acc
        },
        { projects: 0, totalBudget: 0, committedBudget: 0, remainingBudget: 0 }
      )
      setMetrics(totals)

      // Status counts
      const counts: Record<string, number> = { "In Progress": 0, Paused: 0, Completed: 0, Cancelled: 0 }
      projects.forEach((p: any) => {
        const s = p.status || ""
        if (counts[s] !== undefined) counts[s] += 1
      })
      setStatusCounts(counts)

      // Recent activity now uses backend activity logs
      const formatRelative = (ts: string) => {
        try {
          const d = new Date(ts)
          const now = new Date()
          const diffMs = d.getTime() - now.getTime()
          const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
          const minutes = Math.round(diffMs / (60 * 1000))
          const hours = Math.round(diffMs / (60 * 60 * 1000))
          const days = Math.round(diffMs / (24 * 60 * 60 * 1000))
          if (Math.abs(minutes) < 1) return rtf.format(0, "minute")
          if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute")
          if (Math.abs(hours) < 24) return rtf.format(hours, "hour")
          return rtf.format(days, "day")
        } catch {
          return new Date(ts).toLocaleString(locale)
        }
      }
      const colorFor = (ct: string) =>
        ct === "paymentreceived" ? "green" : ct === "expense" ? "blue" : ct === "projectsteps" ? "purple" : ct === "project" ? "gray" : "blue"
      const actionKey = (action: string) => {
        const map: Record<string, string> = { CREATE: "created", UPDATE: "updated", DELETE: "deleted" }
        return map[action] || action.toLowerCase()
      }
      const mapped = (activities || []).map(a => {
        const ak = actionKey(a.action)
        return {
          title: t("dashboard.activityTitlePattern", {
            action: t(`dashboard.activity.${ak}`),
            model: t(`dashboard.models.${a.content_type}`)
          }),
          subtitle: `${a.object_name} • ${formatRelative(a.timestamp)}`,
          color: colorFor(a.content_type)
        }
      })
      setRecent(mapped.slice(0, 6))
    }
    load()
  }, [user, reloadKey, language, activities])

  const fmt = (n: number) => Number(n || 0).toLocaleString(language === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "MAD" })

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 md:pl-72 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">{t("dashboard.overview")}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Select defaultValue="last-month">
            <SelectTrigger className="w-full sm:w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last-month">{t("dashboard.filters.lastMonth")}</SelectItem>
              <SelectItem value="last-quarter">{t("dashboard.filters.lastQuarter")}</SelectItem>
              <SelectItem value="last-year">{t("dashboard.filters.lastYear")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="w-full sm:w-auto">
            <ExportMenu user={user} />
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title={t("dashboard.activeProjects")} value={String(metrics.projects)} icon={FolderOpen} trend={{ value: 0, isPositive: true }} />
        <MetricCard
          title={t("dashboard.totalBudget")}
          value={fmt(metrics.totalBudget)}
          icon={DollarSign}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title={t("dashboard.budgetEngaged")}
          value={fmt(metrics.committedBudget)}
          icon={TrendingUp}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title={t("dashboard.remainingBudget")}
          value={fmt(metrics.remainingBudget)}
          icon={TrendingDown}
          trend={{ value: 0, isPositive: false }}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => { setReloadKey((k) => k + 1); refetch(); }}>
                {t("common.refresh")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-56 overflow-y-auto sm:max-h-none sm:overflow-visible pr-1">
              {recent.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{it.title}</p>
                    <p className="text-sm text-muted-foreground truncate max-w-[70vw] sm:max-w-none">{it.subtitle}</p>
                  </div>
                  <div className={`h-2 w-2 rounded-full ${it.color === "green" ? "bg-green-500" : it.color === "purple" ? "bg-purple-500" : it.color === "gray" ? "bg-gray-500" : "bg-blue-500"}`}></div>
                </div>
              ))}
              {recent.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("dashboard.noRecentActivity")}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.projectsByStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span>{t("status.inProgress")}</span>
                </div>
                <span className="font-medium">{statusCounts["In Progress"]} {statusCounts["In Progress"] === 1 ? t("common.units.project.singular") : t("common.units.project.plural")}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-yellow-500 rounded-full"></div>
                  <span>{t("common.onPause")}</span>
                </div>
                <span className="font-medium">{statusCounts["Paused"]} {statusCounts["Paused"] === 1 ? t("common.units.project.singular") : t("common.units.project.plural")}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                  <span>{t("status.completed")}</span>
                </div>
                <span className="font-medium">{statusCounts["Completed"]} {statusCounts["Completed"] === 1 ? t("common.units.project.singular") : t("common.units.project.plural")}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                  <span>{t("status.cancelled")}</span>
                </div>
                <span className="font-medium">{statusCounts["Cancelled"]} {statusCounts["Cancelled"] === 1 ? t("common.units.project.singular") : t("common.units.project.plural")}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Shortcuts for Directors */}
      {user?.role === "director" && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t("admin.quickActions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-700 mb-4">
              {t("admin.directorHelp")}
            </p>
            <div className="flex flex-wrap gap-3">
              <CreateDepartmentForm onCreated={() => console.log('Department created')} />
              <CreateManagerForm onCreated={() => console.log('Manager created')} />
              <Button  asChild>
                <Link href="/admin" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  {t("admin.fullAdmin")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Alert */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-blue-700">
            <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-white text-xs">i</span>
            </div>
            <p className="text-sm">
              {t("dashboard.dataSyncInfo")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}



