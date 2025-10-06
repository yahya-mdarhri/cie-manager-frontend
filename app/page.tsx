"use client"

import { useEffect, useState } from "react"
import { MetricCard } from "@/components/ui/metric-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FolderOpen, DollarSign, TrendingUp, TrendingDown, Download, Calendar, Settings, Building2, UserPlus } from "lucide-react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"
import { http } from "@/lib/http"
import ExportMenu from "@/components/ui/export-menu"
import CreateDepartmentForm from "@/components/forms/create-department-form"
import CreateManagerForm from "@/components/forms/create-manager-form"

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
      const base = "/api/management"
      const formatMoney = (n: number) => Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "MAD" })

      let projects: any[] = []
      try {
        if (user.role === "director") {
          // Fetch all projects in one call for directors
          const { data: raw } = await http.get(`${base}/all/projects/`, { params: { page: 1, size: 1000 } })
          projects = (raw?.results || raw) ?? []
        } else if (user.role === "department_manager" && user.department) {
          // Fetch projects for the manager's department
          const { data: raw } = await http.get(`${base}/departments/${user.department}/projects/`, { params: { page: 1, size: 1000 } })
          projects = (raw?.results || raw) ?? []
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

      // Recent activity
      const recentItems: Array<{ title: string; subtitle: string; color: string; date: string }> = []
      try {
        if (user.role === "director") {
          // Use global endpoints for directors
          const [expRes, payRes] = await Promise.allSettled([
            http.get(`${base}/all/expenses/`, { params: { page: 1, size: 10 } }),
            http.get(`${base}/all/payments/`, { params: { page: 1, size: 10 } }),
          ])
          if (expRes.status === "fulfilled") {
            const exps = (expRes.value.data?.results || expRes.value.data) ?? []
            exps.forEach((e: any) =>
              recentItems.push({
                title: "Dépense approuvée",
                subtitle: `${formatMoney(e.amount)} - ${e.project?.project_name ?? "Projet"}`,
                color: "blue",
                date: e.expense_date,
              })
            )
          }
          if (payRes.status === "fulfilled") {
            const pays = (payRes.value.data?.results || payRes.value.data) ?? []
            pays.forEach((pr: any) =>
              recentItems.push({
                title: "Encaissement reçu",
                subtitle: `${formatMoney(pr.amount)} - ${pr.project?.project_name ?? "Projet"}`,
                color: "green",
                date: pr.payment_received_date,
              })
            )
          }
        } else {
          // For managers, pull from each project (best-effort)
          for (const p of projects.slice(0, 5)) {
            const depId = p.department?.id || p.department_id || user.department
            if (!depId) continue
            const [expRes, payRes] = await Promise.allSettled([
              http.get(`${base}/departments/${depId}/projects/${p.id}/expenses/`, { params: { page: 1, size: 5 } }),
              http.get(`${base}/departments/${depId}/projects/${p.id}/payments/`, { params: { page: 1, size: 5 } }),
            ])
            if (expRes.status === "fulfilled") {
              const raw = expRes.value.data
              const exps = raw.results || raw
              exps.forEach((e: any) =>
                recentItems.push({
                  title: "Dépense approuvée",
                  subtitle: `${formatMoney(e.amount)} - ${p.project_name}`,
                  color: "blue",
                  date: e.expense_date,
                })
              )
            }
            if (payRes.status === "fulfilled") {
              const raw = payRes.value.data
              const pays = raw.results || raw
              pays.forEach((pr: any) =>
                recentItems.push({
                  title: "Encaissement reçu",
                  subtitle: `${formatMoney(pr.amount)} - ${p.project_name}`,
                  color: "green",
                  date: pr.payment_received_date,
                })
              )
            }
          }
        }
      } catch {
        // ignore
      }

      recentItems.sort((a, b) => (a.date > b.date ? -1 : 1))
      setRecent(recentItems.slice(0, 6))
    }
    load()
  }, [user])

  const fmt = (n: number) => Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "MAD" })

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 md:pl-72 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Tableau de Bord</h1>
          <p className="text-muted-foreground">Vue d'ensemble de votre activité</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Select defaultValue="last-month">
            <SelectTrigger className="w-full sm:w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last-month">Dernier mois</SelectItem>
              <SelectItem value="last-quarter">Dernier trimestre</SelectItem>
              <SelectItem value="last-year">Dernière année</SelectItem>
            </SelectContent>
          </Select>
          <div className="w-full sm:w-auto">
            <ExportMenu user={user} />
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <div className="space-y-4 max-h-56 overflow-y-auto sm:max-h-none sm:overflow-visible pr-1">
              {recent.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{it.title}</p>
                    <p className="text-sm text-muted-foreground truncate max-w-[70vw] sm:max-w-none">{it.subtitle}</p>
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

      {/* Admin Shortcuts for Directors */}
      {user?.role === "director" && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Actions d'Administration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-700 mb-4">
              En tant que directeur, vous pouvez créer de nouveaux départements et assigner des managers.
            </p>
            <div className="flex flex-wrap gap-3">
              <CreateDepartmentForm onCreated={() => console.log('Department created')}>
                <Button variant="outline" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Nouveau Département
                </Button>
              </CreateDepartmentForm>
              <CreateManagerForm onCreated={() => console.log('Manager created')}>
                <Button variant="outline" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Nouveau Manager
                </Button>
              </CreateManagerForm>
              <Button variant="outline" asChild>
                <Link href="/admin" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Administration Complète
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
              Toutes les données sont mises à jour en temps réel. Dernière synchronisation : il y a 5 minutes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
