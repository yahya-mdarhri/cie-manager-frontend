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
import CreateClientForm from "@/components/forms/create-client-form"
import CreateSupplierForm from "@/components/forms/create-supplier-form"
import { useRecentActivity, type ActivityLog } from "@/hooks/use-recent-activity"
import { useRouter } from "next/navigation"

interface DirectorAnalytics {
  kpis?: {
    overdue_projects: number
    completed_unpaid_projects: number
    overdue_unpaid_projects: number
    overdue_unpaid_amount: number
    collection_rate_percent: number
    margin_value: number
  }
  projects_needing_attention?: Array<{
    project_id: number
    project_code: string
    project_name: string
    department?: string | null
    status: string
    days_overdue: number
    remaining_to_collect: number
    client?: string | null
  }>
  top_clients_exposure?: Array<{
    client: string
    projects_count: number
    remaining_to_collect: number
    collected: number
  }>
}

export default function Dashboard() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const router = useRouter()
  const [reloadKey, setReloadKey] = useState(0)
  const [metrics, setMetrics] = useState({
    projects: 0,
    totalBudget: 0,
    committedBudget: 0,
    remainingBudget: 0,
  })
  const [recent, setRecent] = useState<Array<{ title: string; subtitle: string; color: string; href: string }>>([])
  const { activities, loading: activityLoading, error: activityError, refetch } = useRecentActivity(20)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    "In Progress": 0,
    Paused: 0,
    Completed: 0,
    Cancelled: 0,
  })
  const [analytics, setAnalytics] = useState<DirectorAnalytics | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!user) return
  const base = "/api/management"
  const locale = language === "fr" ? "fr-FR" : "en-US"
  const formatMoney = (n: number) => Number(n || 0).toLocaleString(locale, { style: "currency", currency: "MAD" })

      let projects: any[] = []
      let paymentsTotal = 0
      try {
        if (user.role === "director") {
          // Fetch all projects in one call for directors
          const { data: raw } = await http.get(`${base}/all/projects/`, { params: { page: 1, size: 1000 } })
          projects = (raw?.results || raw) ?? []
          // Fetch all payments and sum amounts to reflect Encaissements in "Encaissé"
          try {
            const { data: prow } = await http.get(`${base}/all/payments/`, { params: { page: 1, size: 1000 } })
            const payments = (prow?.results || prow) ?? []
            paymentsTotal = payments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0)
          } catch {}
          try {
            const { data: sraw } = await http.get(`${base}/all/statistics/`)
            setAnalytics(sraw || null)
          } catch {
            setAnalytics(null)
          }
        } else if (user.role === "department_manager" && user.department) {
          // Fetch projects for the manager's department (normalize department id if it's an object)
          const depId =
            typeof user.department === "object"
              ? String((user.department as any)?.id ?? (user.department as any)?.pk ?? "")
              : String(user.department ?? "")
          if (depId) {
            const { data: raw } = await http.get(`${base}/departments/${depId}/projects/`, { params: { page: 1, size: 1000 } })
            projects = (raw?.results || raw) ?? []
            // Sum payments for all projects in this department
            for (const p of projects) {
              try {
                const { data: prw } = await http.get(`${base}/departments/${depId}/projects/${p.id}/payments/`, { params: { page: 1, size: 1000 } })
                const plist = (prw?.results || prw) ?? []
                paymentsTotal += plist.reduce((acc: number, r: any) => acc + Number(r.amount || 0), 0)
              } catch {}
            }
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
          // committedBudget is used to display "Encaissé"; we override later with Encaissements total
          acc.committedBudget += 0
          acc.remainingBudget += Number(p.remaining_budget || 0)
          return acc
        },
        { projects: 0, totalBudget: 0, committedBudget: 0, remainingBudget: 0 }
      )
      // Override with Encaissements logic: Encaissé = total encaissements; Remaining = Total - Encaissé
      totals.committedBudget = paymentsTotal
      totals.remainingBudget = Math.max(0, totals.totalBudget - totals.committedBudget)
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
      const activityHref = (activity: ActivityLog) => {
        const modelName = String(activity.model_name || activity.content_type || "").toLowerCase()
        const objectName = String(activity.object_name || "")
        const objectId = String(activity.object_id || "")
        const projectCodeMatch = objectName.match(/[A-Z0-9]{6}/)
        const projectQuery = encodeURIComponent(projectCodeMatch?.[0] || objectName || objectId)

        if (modelName === "paymentreceived" || modelName === "payment_received") return "/revenues"
        if (modelName === "expense") return "/expenses"
        if (modelName === "project") {
          return projectQuery ? `/projects?q=${projectQuery}` : "/projects"
        }
        if (modelName === "projectsteps" || modelName === "project_step" || modelName === "projectsteps") {
          return projectQuery ? `/projects?q=${projectQuery}` : "/projects"
        }
        return "/projects"
      }
      const mapped = (activities || []).map(a => {
        const ak = actionKey(a.action)
        return {
          title: t("dashboard.activityTitlePattern", {
            action: t(`dashboard.activity.${ak}`),
            model: t(`dashboard.models.${a.content_type}`)
          }),
          subtitle: `${a.object_name} • ${a.user_name || a.user_email} • ${formatRelative(a.timestamp)}`,
          color: colorFor(a.content_type),
          href: activityHref(a)
        }
      })
      setRecent(mapped.slice(0, 5))
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
        <button type="button" onClick={() => router.push("/projects")} className="cursor-pointer text-left">
          <MetricCard title={t("dashboard.activeProjects")} value={String(metrics.projects)}  trend={{ value: 0, isPositive: true }} />
        </button>
        <button type="button" onClick={() => router.push("/projects")} className="cursor-pointer text-left">
          <MetricCard
            title={t("dashboard.totalBudget")}
            value={fmt(metrics.totalBudget)}
            trend={{ value: 0, isPositive: true }}
          />
        </button>
        <button type="button" onClick={() => router.push("/revenues")} className="cursor-pointer text-left">
          <MetricCard
            title={t("dashboard.budgetEngaged")}
            value={fmt(metrics.committedBudget)}
            trend={{ value: 0, isPositive: true }}
          />
        </button>
        <button type="button" onClick={() => router.push("/expenses")} className="cursor-pointer text-left">
          <MetricCard
            title={t("dashboard.remainingBudget")}
            value={fmt(metrics.remainingBudget)}
            trend={{ value: 0, isPositive: false }}
          />
        </button>
      </div>

      {user?.role === "director" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Analyse DG - Alertes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <button type="button" onClick={() => router.push("/projects?risk=overdue")} className="cursor-pointer rounded-md border p-3 text-left hover:bg-muted/40 transition-colors">
                    <div className="text-muted-foreground">Projets en retard</div>
                    <div className="text-xl font-semibold text-red-600">{analytics?.kpis?.overdue_projects ?? 0}</div>
                  </button>
                  <button type="button" onClick={() => router.push("/projects?risk=completed_unpaid")} className="cursor-pointer rounded-md border p-3 text-left hover:bg-muted/40 transition-colors">
                    <div className="text-muted-foreground">Terminés non soldés</div>
                    <div className="text-xl font-semibold text-amber-600">{analytics?.kpis?.completed_unpaid_projects ?? 0}</div>
                  </button>
                  <button type="button" onClick={() => router.push("/projects?risk=overdue_unpaid")} className="cursor-pointer rounded-md border p-3 text-left hover:bg-muted/40 transition-colors">
                    <div className="text-muted-foreground">Retard + non encaissé</div>
                    <div className="text-xl font-semibold text-red-700">{analytics?.kpis?.overdue_unpaid_projects ?? 0}</div>
                  </button>
                  <button type="button" onClick={() => router.push("/projects?risk=overdue_unpaid")} className="cursor-pointer rounded-md border p-3 text-left hover:bg-muted/40 transition-colors">
                    <div className="text-muted-foreground">Montant à risque</div>
                    <div className="text-lg font-semibold text-red-700">{fmt(analytics?.kpis?.overdue_unpaid_amount || 0)}</div>
                  </button>
                </div>

                <div className="text-xs text-muted-foreground">
                  Taux d'encaissement global: <span className="font-medium text-foreground">{analytics?.kpis?.collection_rate_percent ?? 0}%</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Marge globale: <span className="font-medium text-foreground">{fmt(analytics?.kpis?.margin_value || 0)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top clients exposés</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(analytics?.top_clients_exposure || []).slice(0, 5).map((item) => (
                  <button type="button" key={item.client} onClick={() => router.push(`/projects?q=${encodeURIComponent(item.client)}`)} className="flex w-full cursor-pointer items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted/40 transition-colors">
                    <div>
                      <div className="font-medium">{item.client}</div>
                      <div className="text-xs text-muted-foreground">{item.projects_count} projets</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-700">{fmt(item.remaining_to_collect)}</div>
                      <div className="text-xs text-muted-foreground">Encaissé: {fmt(item.collected)}</div>
                    </div>
                  </button>
                ))}
                {(!analytics?.top_clients_exposure || analytics.top_clients_exposure.length === 0) && (
                  <div className="text-sm text-muted-foreground">Aucune exposition client critique.</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Projets nécessitant une action immédiate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(analytics?.projects_needing_attention || []).slice(0, 6).map((item) => (
                  <button type="button" key={item.project_id} onClick={() => router.push(`/projects?q=${encodeURIComponent(item.project_code)}`)} className="grid w-full cursor-pointer grid-cols-1 md:grid-cols-4 gap-2 rounded-md border p-3 text-left text-sm hover:bg-muted/40 transition-colors">
                    <div className="md:col-span-2">
                      <div className="font-medium">{item.project_code} - {item.project_name}</div>
                      <div className="text-xs text-muted-foreground">{item.department || "-"} • Client: {item.client || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Jours retard</div>
                      <div className="font-semibold">{item.days_overdue}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Reste à encaisser</div>
                      <div className="font-semibold text-red-700">{fmt(item.remaining_to_collect)}</div>
                    </div>
                  </button>
                ))}
                {(!analytics?.projects_needing_attention || analytics.projects_needing_attention.length === 0) && (
                  <div className="text-sm text-muted-foreground">Aucune alerte critique pour le moment.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

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
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {recent.map((it, idx) => (
                <button type="button" key={idx} onClick={() => router.push(it.href)} className="flex w-full cursor-pointer items-center justify-between rounded-md bg-muted/50 p-2 text-left hover:bg-muted transition-colors">
                  <div>
                    <p className="text-sm font-medium leading-tight">{it.title}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[70vw] sm:max-w-none">{it.subtitle}</p>
                  </div>
                  <div className={`h-2 w-2 rounded-full ${it.color === "green" ? "bg-green-500" : it.color === "purple" ? "bg-purple-500" : it.color === "gray" ? "bg-gray-500" : "bg-blue-500"}`}></div>
                </button>
              ))}
              {recent.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("dashboard.noRecentActivity")}</p>
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
              <button type="button" onClick={() => router.push("/projects?status=In%20Progress")} className="flex w-full cursor-pointer items-center justify-between rounded-md p-1 text-left hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span>{t("status.inProgress")}</span>
                </div>
                <span className="font-medium">{statusCounts["In Progress"]} {statusCounts["In Progress"] === 1 ? t("common.units.project.singular") : t("common.units.project.plural")}</span>
              </button>
              <button type="button" onClick={() => router.push("/projects?status=Paused")} className="flex w-full cursor-pointer items-center justify-between rounded-md p-1 text-left hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-yellow-500 rounded-full"></div>
                  <span>{t("common.onPause")}</span>
                </div>
                <span className="font-medium">{statusCounts["Paused"]} {statusCounts["Paused"] === 1 ? t("common.units.project.singular") : t("common.units.project.plural")}</span>
              </button>
              <button type="button" onClick={() => router.push("/projects?status=Completed")} className="flex w-full cursor-pointer items-center justify-between rounded-md p-1 text-left hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                  <span>{t("status.completed")}</span>
                </div>
                <span className="font-medium">{statusCounts["Completed"]} {statusCounts["Completed"] === 1 ? t("common.units.project.singular") : t("common.units.project.plural")}</span>
              </button>
              <button type="button" onClick={() => router.push("/projects?status=Cancelled")} className="flex w-full cursor-pointer items-center justify-between rounded-md p-1 text-left hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                  <span>{t("status.cancelled")}</span>
                </div>
                <span className="font-medium">{statusCounts["Cancelled"]} {statusCounts["Cancelled"] === 1 ? t("common.units.project.singular") : t("common.units.project.plural")}</span>
              </button>
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
              <CreateClientForm onCreated={() => console.log('Client created')} />
              <CreateSupplierForm onCreated={() => console.log('Supplier created')} />
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



