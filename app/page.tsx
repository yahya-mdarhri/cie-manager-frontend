"use client"

import { useEffect, useState } from "react"
import { MetricCard } from "@/components/ui/metric-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FolderOpen, DollarSign, TrendingUp, TrendingDown, Download, Calendar } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"

export default function Dashboard() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState({
    projects: 0,
    totalBudget: 0,
    committedBudget: 0,
    remainingBudget: 0,
  })
  const [recent, setRecent] = useState<Array<{ title: string; subtitle: string; color: string }>>([])
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    "In Progress": 0,
    Paused: 0,
    Completed: 0,
    Cancelled: 0,
  })

  useEffect(() => {
    const load = async () => {
      if (!user) return
      const base = "http://localhost:8000/api/management"
      const allowed = new Set(["CIE Direct", "Tech Center", "TTO", "Clinique Industrielle"]) 
      const formatMoney = (n: number) => Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "MAD" })

      async function listProjects(depId: number) {
        const r = await fetch(`${base}/departments/${depId}/projects/`, { credentials: "include" })
        if (!r.ok) return []
        const raw = await r.json()
        // Handle paginated response
        return raw.results || raw
      }

      let projects: any[] = []
      if (user.role === "director") {
        const depRes = await fetch(`${base}/departments/`, { credentials: "include" })
        if (depRes.ok) {
          const raw = await depRes.json()
          const arr = Array.isArray(raw.results || raw) ? (raw.results || raw) : []
          const deps = arr.filter((d: any) => allowed.has(d.name))
          for (const d of deps) {
            const p = await listProjects(d.id)
            projects = projects.concat(p)
          }
        }
      } else if (user.role === "department_manager" && user.department) {
        const p = await listProjects(Number(user.department))
        projects = projects.concat(p)
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

      // Recent activity: last few expenses and payments across first few projects
      const recentItems: Array<{ title: string; subtitle: string; color: string; date: string }> = []
      for (const p of projects.slice(0, 5)) {
        const depId = p.department?.id || p.department_id || 0
        if (!depId) continue
        const [expRes, payRes] = await Promise.all([
          fetch(`${base}/departments/${depId}/projects/${p.id}/expenses/`, { credentials: "include" }),
          fetch(`${base}/departments/${depId}/projects/${p.id}/payments/`, { credentials: "include" }),
        ])
        if (expRes.ok) {
          const raw = await expRes.json()
          const exps = raw.results || raw
          exps.slice(-2).forEach((e: any) =>
            recentItems.push({
              title: "Dépense approuvée",
              subtitle: `${formatMoney(e.amount)} - ${p.project_name}`,
              color: "blue",
              date: e.expense_date,
            })
          )
        }
        if (payRes.ok) {
          const raw = await payRes.json()
          const pays = raw.results || raw
          pays.slice(-2).forEach((pr: any) =>
            recentItems.push({
              title: "Encaissement reçu",
              subtitle: `${formatMoney(pr.amount)} - ${p.project_name}`,
              color: "green",
              date: pr.payment_received_date,
            })
          )
        }
      }
      // sort by date desc if possible
      recentItems.sort((a, b) => (a.date > b.date ? -1 : 1))
      setRecent(recentItems.slice(0, 6))
    }
    load()
  }, [user])

  const fmt = (n: number) => Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "MAD" })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tableau de Bord</h1>
          <p className="text-muted-foreground">Vue d'ensemble de votre activité</p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="last-month">
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last-month">Dernier mois</SelectItem>
              <SelectItem value="last-quarter">Dernier trimestre</SelectItem>
              <SelectItem value="last-year">Dernière année</SelectItem>
            </SelectContent>
          </Select>
          <Button  className="flex items-center gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Exporter les données
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Projets Actifs" value={String(metrics.projects)} icon={FolderOpen} trend={{ value: 0, isPositive: true }} />
        <MetricCard
          title="Budget Total"
          value={fmt(metrics.totalBudget)}
          icon={DollarSign}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title="Budget Engagé"
          value={fmt(metrics.committedBudget)}
          icon={TrendingUp}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title="Budget Restant"
          value={fmt(metrics.remainingBudget)}
          icon={TrendingDown}
          trend={{ value: 0, isPositive: false }}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Activité Récente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recent.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{it.title}</p>
                    <p className="text-sm text-muted-foreground">{it.subtitle}</p>
                  </div>
                  <div className={`h-2 w-2 rounded-full ${it.color === "green" ? "bg-green-500" : "bg-blue-500"}`}></div>
                </div>
              ))}
              {recent.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune activité récente.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projets par Statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span>En cours</span>
                </div>
                <span className="font-medium">{statusCounts["In Progress"]} projets</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-yellow-500 rounded-full"></div>
                  <span>En pause</span>
                </div>
                <span className="font-medium">{statusCounts["Paused"]} projets</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                  <span>Terminés</span>
                </div>
                <span className="font-medium">{statusCounts["Completed"]} projets</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                  <span>Annulés</span>
                </div>
                <span className="font-medium">{statusCounts["Cancelled"]} projets</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Alert */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-blue-700">
            <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-white text-xs">i</span>
            </div>
            <p className="text-sm">
              Toutes les données sont mises à jour en temps réel. Dernière synchronisation : il y a 5 minutes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
