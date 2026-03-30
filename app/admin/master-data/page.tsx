"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Users, Building2, Eye } from "lucide-react"
import { http } from "@/lib/http"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import CreateClientForm from "@/components/forms/create-client-form"
import CreateSupplierForm from "@/components/forms/create-supplier-form"
import { DataTable } from "@/components/ui/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface Project {
  id: number
  project_code: string
  project_name: string
  status: string
  total_budget: number
  department: string | null
  department_id?: number | null
}

interface Client {
  id: number
  name: string
  registration_number: string
  created_at: string
  updated_at: string
  projects?: Project[]
  total_revenue?: number
}

interface Supplier {
  id: number
  name: string
  registration_number: string
  created_at: string
  updated_at: string
  projects?: Project[]
  total_expense?: number
}

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

export default function MasterDataPage() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [clients, setClients] = useState<Client[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [qClient, setQClient] = useState("")
  const [qSupplier, setQSupplier] = useState("")
  const [loadingClients, setLoadingClients] = useState(false)
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [expandedClient, setExpandedClient] = useState<number | null>(null)
  const [expandedSupplier, setExpandedSupplier] = useState<number | null>(null)
  const [loadingClientTotals, setLoadingClientTotals] = useState<Record<number, boolean>>({})
  const [loadingSupplierTotals, setLoadingSupplierTotals] = useState<Record<number, boolean>>({})
  const [expandedClientProjects, setExpandedClientProjects] = useState<Record<number, boolean>>({})
  const [expandedSupplierProjects, setExpandedSupplierProjects] = useState<Record<number, boolean>>({})
  const [clientRevenuesByProject, setClientRevenuesByProject] = useState<Record<number, { loading: boolean; items: Array<{ id: number; date: string; amount: number; description: string; category: string }>; total: number }>>({})
  const [supplierExpensesByProject, setSupplierExpensesByProject] = useState<Record<number, { loading: boolean; items: Array<{ id: number; date: string; amount: number; description: string; category: string }>; total: number }>>({})
  // Detail dialogs
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false)
  const [supplierDetailsOpen, setSupplierDetailsOpen] = useState(false)
  const [activeClient, setActiveClient] = useState<Client | null>(null)
  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null)
  const [activeClientTotals, setActiveClientTotals] = useState<{ total_revenue: number; projects: Array<{ project_id: number; project_code: string; project_name: string; department?: string; total_revenue: number }> } | null>(null)
  const [activeSupplierTotals, setActiveSupplierTotals] = useState<{ total_expense: number; projects: Array<{ project_id: number; project_code: string; project_name: string; department?: string; total_expense: number }> } | null>(null)
  const [analytics, setAnalytics] = useState<DirectorAnalytics | null>(null)

  const formatMAD = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }).format(v)
  const sumClientRevenue = clients.reduce((acc: number, client: Client) => acc + Number(client.total_revenue || 0), 0)
  const sumSupplierExpense = suppliers.reduce((acc: number, supplier: Supplier) => acc + Number(supplier.total_expense || 0), 0)

  // All roles can view this page; creation/deletion restricted to directors only.

  const loadClients = async () => {
    setLoadingClients(true)
    try {
      const { data } = await http.get("/api/management/clients/", {
        params: { page: 1, size: 50, q: qClient || undefined },
      })
      setClients(Array.isArray(data?.results) ? data.results : data || [])
    } catch (e) {
      setClients([])
    } finally {
      setLoadingClients(false)
    }
  }

  const loadSuppliers = async () => {
    setLoadingSuppliers(true)
    try {
      const { data } = await http.get("/api/management/suppliers/", {
        params: { page: 1, size: 50, q: qSupplier || undefined },
      })
      setSuppliers(Array.isArray(data?.results) ? data.results : data || [])
    } catch (e) {
      setSuppliers([])
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const loadAnalytics = async () => {
    try {
      const { data } = await http.get("/api/management/all/statistics/")
      setAnalytics(data || null)
    } catch {
      setAnalytics(null)
    }
  }

  useEffect(() => {
    loadClients()
    loadSuppliers()
    loadAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDeleteClient = async (id: number) => {
    if (!confirm(t("messages.confirmDelete"))) return
    try {
      await http.delete(`/api/management/clients/${id}/`)
      await loadClients()
    } catch (e) {
      alert(t("messages.error"))
    }
  }

  const handleDeleteSupplier = async (id: number) => {
    if (!confirm(t("messages.confirmDelete"))) return
    try {
      await http.delete(`/api/management/suppliers/${id}/`)
      await loadSuppliers()
    } catch (e) {
      alert(t("messages.error"))
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">{t("common.loading")}</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("admin.masterData")}</h1>
        <p className="text-muted-foreground">{t("admin.directorHelp")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analyse DG - Alertes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-3">
                <div className="text-muted-foreground">Projets en retard</div>
                <div className="text-xl font-semibold text-red-600">{analytics?.kpis?.overdue_projects ?? 0}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-muted-foreground">Terminés non soldés</div>
                <div className="text-xl font-semibold text-amber-600">{analytics?.kpis?.completed_unpaid_projects ?? 0}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-muted-foreground">Retard + non encaissé</div>
                <div className="text-xl font-semibold text-red-700">{analytics?.kpis?.overdue_unpaid_projects ?? 0}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-muted-foreground">Montant à risque</div>
                <div className="text-lg font-semibold text-red-700">{formatMAD(analytics?.kpis?.overdue_unpaid_amount || 0)}</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Taux d'encaissement global: <span className="font-medium text-foreground">{analytics?.kpis?.collection_rate_percent ?? 0}%</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Marge globale: <span className="font-medium text-foreground">{formatMAD(analytics?.kpis?.margin_value || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top clients exposés</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(analytics?.top_clients_exposure || []).slice(0, 5).map((item) => (
              <div key={item.client} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium">{item.client}</div>
                  <div className="text-xs text-muted-foreground">{item.projects_count} projets</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-red-700">{formatMAD(item.remaining_to_collect)}</div>
                  <div className="text-xs text-muted-foreground">Encaissé: {formatMAD(item.collected)}</div>
                </div>
              </div>
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
              <div key={item.project_id} className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-md border p-3 text-sm">
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
                  <div className="font-semibold text-red-700">{formatMAD(item.remaining_to_collect)}</div>
                </div>
              </div>
            ))}
            {(!analytics?.projects_needing_attention || analytics.projects_needing_attention.length === 0) && (
              <div className="text-sm text-muted-foreground">Aucune alerte critique pour le moment.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        {/* Clients */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" /> {t("admin.clients")}
            </CardTitle>
            {user.role === "director" && <CreateClientForm onCreated={loadClients} />}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Input
                placeholder={language === "fr" ? "Rechercher..." : "Search..."}
                value={qClient}
                onChange={(e) => setQClient(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadClients()}
              />
              <Button onClick={loadClients}>{t("common.search")}</Button>
            </div>
            <DataTable
              title={t("admin.clients")}
              tableId="clients-table"
              loading={loadingClients}
              summary={[
                { label: t('common.count'), value: String(clients.length), className: 'text-foreground' },
                { label: t('revenues.totalRevenue'), value: formatMAD(sumClientRevenue), className: 'text-green-600' },
                { label: t('projects.projects'), value: String(clients.reduce((a,c)=>a+(c.projects?.length||0),0)), className: 'text-blue-600' },
              ]}
              columns={[
                { key: "name", label: t("common.name") },
                { key: "registration_number", label: t("common.registrationNumber") },
                { key: "projects", label: t("projects.projects"), className: "w-24" },
                { key: "total", label: t("revenues.totalRevenue"), className: "w-40" },
                { key: "actions", label: t("common.actions"), className: "w-32" },
              ]}
              data={clients.map((c) => ({
                name: c.name,
                registration_number: c.registration_number,
                projects: <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{c.projects?.length || 0}</Badge>,
                total: c.total_revenue != null ? <span className="text-green-600 font-medium">{formatMAD(c.total_revenue)}</span> : "-",
                actions: (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        setActiveClient(c)
                        setClientDetailsOpen(true)
                        try {
                          const { data } = await http.get(`/api/management/clients/${c.id}/totals/`)
                          setActiveClientTotals(data)
                        } catch {
                          setActiveClientTotals(null)
                        }
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" /> {t("common.view")}
                    </Button>
                    {user.role === "director" && (
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDeleteClient(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ),
              }))}
            />
          </CardContent>
        </Card>

        {/* Suppliers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" /> {t("admin.suppliers")}
            </CardTitle>
            {user.role === "director" && <CreateSupplierForm onCreated={loadSuppliers} />}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Input
                placeholder={language === "fr" ? "Rechercher..." : "Search..."}
                value={qSupplier}
                onChange={(e) => setQSupplier(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadSuppliers()}
              />
              <Button onClick={loadSuppliers}>{t("common.search")}</Button>
            </div>
            <DataTable
              title={t("admin.suppliers")}
              tableId="suppliers-table"
              loading={loadingSuppliers}
              summary={[
                { label: t('common.count'), value: String(suppliers.length), className: 'text-foreground' },
                { label: t('expenses.totalExpense'), value: formatMAD(sumSupplierExpense), className: 'text-red-600' },
                { label: t('projects.projects'), value: String(suppliers.reduce((a,s)=>a+(s.projects?.length||0),0)), className: 'text-blue-600' },
              ]}
              columns={[
                { key: "name", label: t("common.name") },
                { key: "registration_number", label: t("common.registrationNumber") },
                { key: "projects", label: t("projects.projects"), className: "w-24" },
                { key: "total", label: t("expenses.totalExpense"), className: "w-40" },
                { key: "actions", label: t("common.actions"), className: "w-32" },
              ]}
              data={suppliers.map((s) => ({
                name: s.name,
                registration_number: s.registration_number,
                projects: <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{s.projects?.length || 0}</Badge>,
                total: s.total_expense != null ? <span className="text-red-600 font-medium">{formatMAD(s.total_expense)}</span> : "-",
                actions: (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        setActiveSupplier(s)
                        setSupplierDetailsOpen(true)
                        try {
                          const { data } = await http.get(`/api/management/suppliers/${s.id}/totals/`)
                          setActiveSupplierTotals(data)
                        } catch {
                          setActiveSupplierTotals(null)
                        }
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" /> {t("common.view")}
                    </Button>
                    {user.role === "director" && (
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDeleteSupplier(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ),
              }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Client Details Dialog */}
      <Dialog open={clientDetailsOpen} onOpenChange={setClientDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {activeClient ? `${activeClient.name} (${activeClient.registration_number})` : t("admin.clients")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle className="text-sm">{t("revenues.totalRevenue")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-semibold text-green-600">{activeClientTotals ? formatMAD(activeClientTotals.total_revenue) : "-"}</div>
                </CardContent>
              </Card>
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm">{t("projects.projects")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted">
                          <th className="text-left p-2">{t("projects.project")}</th>
                          <th className="text-left p-2">{t("common.department")}</th>
                          <th className="text-right p-2">{t("revenues.totalRevenue")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeClientTotals?.projects?.map((p) => (
                          <tr key={p.project_id} className="border-t">
                            <td className="p-2">{p.project_code} - {p.project_name}</td>
                            <td className="p-2">{p.department || '-'}</td>
                            <td className="p-2 text-right">{formatMAD(p.total_revenue)}</td>
                          </tr>
                        )) || (
                          <tr>
                            <td className="p-3 text-center text-muted-foreground" colSpan={3}>{t("common.noData")}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplier Details Dialog */}
      <Dialog open={supplierDetailsOpen} onOpenChange={setSupplierDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {activeSupplier ? `${activeSupplier.name} (${activeSupplier.registration_number})` : t("admin.suppliers")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle className="text-sm">{t("expenses.totalExpense")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-semibold text-red-600">{activeSupplierTotals ? formatMAD(activeSupplierTotals.total_expense) : "-"}</div>
                </CardContent>
              </Card>
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm">{t("projects.projects")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted">
                          <th className="text-left p-2">{t("projects.project")}</th>
                          <th className="text-left p-2">{t("common.department")}</th>
                          <th className="text-right p-2">{t("expenses.totalExpense")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSupplierTotals?.projects?.map((p) => (
                          <tr key={p.project_id} className="border-t">
                            <td className="p-2">{p.project_code} - {p.project_name}</td>
                            <td className="p-2">{p.department || '-'}</td>
                            <td className="p-2 text-right">{formatMAD(p.total_expense)}</td>
                          </tr>
                        )) || (
                          <tr>
                            <td className="p-3 text-center text-muted-foreground" colSpan={3}>{t("common.noData")}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
