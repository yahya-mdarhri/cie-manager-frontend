"use client"

import { useEffect, useState } from "react"
import { FilterBar } from "@/components/ui/filter-bar"
import { DataTable } from "@/components/ui/data-table"
import { Pagination } from "@/components/ui/pagination"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { usePagination } from "@/hooks/use-pagination"

const filterFields = [
  { type: "date" as const, key: "startDate", label: "Date de début", placeholder: "dd/mm/yyyy" },
  { type: "date" as const, key: "endDate", label: "Date de fin", placeholder: "dd/mm/yyyy" },
  {
    type: "select" as const,
    key: "department",
    label: "Département",
    placeholder: "Tous",
    options: [
      { value: "all", label: "Tous" },
      { value: "tech", label: "Tech Center" },
      { value: "cie", label: "CIE" },
      { value: "tto", label: "TTO" },
    ],
  },
  {
    type: "select" as const,
    key: "coordinator",
    label: "Coordinateur",
    placeholder: "Tous",
    options: [
      { value: "all", label: "Tous" },
      { value: "newrest", label: "Newrest" },
      { value: "el-maadani", label: "El Maadani" },
    ],
  },
  {
    type: "select" as const,
    key: "project",
    label: "Projet",
    placeholder: "Tous",
    options: [
      { value: "all", label: "Tous" },
      { value: "innovacteurs", label: "Innov'acteurs" },
      { value: "retrofitting", label: "Retrofitting" },
    ],
  },
]

const columns = [
  { key: "project", label: "Projet" },
  { key: "code", label: "Code Projet" },
  { key: "date", label: "Date" },
  { key: "amount", label: "Montant", className: "text-right font-medium text-green-600" },
  { key: "paymentType", label: "Type de Paiement" },
  { key: "reference", label: "Référence" },
  { key: "description", label: "Description" },
]

async function fetchRevenuesForUser(
  user: { role: string; department?: string | number | null },
  page: number = 1,
  pageSize: number = 10
) {
  const base = "http://localhost:8000/api/management"
  const allowedDepartments = new Set(["CIE Direct", "Tech Center", "TTO", "Clinique Industrielle"]) 
  const formatMoney = (n: number) => Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "MAD" })
  const typeBadge = (t?: string) => <Badge variant="default">{t || "-"}</Badge>

  // For directors, use the all payments endpoint for proper pagination
  if (user.role === "director") {
    const payRes = await fetch(`${base}/all/payments/?page=${page}&size=${pageSize}`, { credentials: "include" })
    if (!payRes.ok) return { rows: [], pagination: {} }
    const raw = await payRes.json()
    const payments = raw.results || raw
    
    const rows = payments.map((pr: any) => ({
      project: pr.project?.project_name || "N/A",
      code: pr.project?.project_code || "N/A",
      date: pr.payment_received_date,
      amount: formatMoney(pr.amount),
      amountValue: Number(pr.amount || 0),
      paymentType: typeBadge(pr.payment_type),
      reference: pr.payment_reference || "-",
      description: pr.description || "-",
    }))

    return { rows, pagination: raw }
  }

  // For department managers, fetch from their department's projects
  if (user.role === "department_manager" && user.department) {
    const depId = Number(user.department)
    
    // First get all projects for the department
    const projectsRes = await fetch(`${base}/departments/${depId}/projects/?page=1&size=100`, { credentials: "include" })
    if (!projectsRes.ok) return { rows: [], pagination: {} }
    const projectsRaw = await projectsRes.json()
    const projects = projectsRaw.results || projectsRaw

    // Collect all payments from all projects
    const allPayments: any[] = []
    for (const p of projects) {
      const payRes = await fetch(`${base}/departments/${depId}/projects/${p.id}/payments/?page=1&size=100`, { credentials: "include" })
      if (payRes.ok) {
        const raw = await payRes.json()
        const payments = raw.results || raw
        payments.forEach((pr: any) => {
          allPayments.push({
            ...pr,
            project_name: p.project_name,
            project_code: p.project_code,
          })
        })
      }
    }

    // Implement frontend pagination for department managers
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedPayments = allPayments.slice(startIndex, endIndex)

    const rows = paginatedPayments.map((pr: any) => ({
      project: pr.project_name,
      code: pr.project_code,
      date: pr.payment_received_date,
      amount: formatMoney(pr.amount),
      amountValue: Number(pr.amount || 0),
      paymentType: typeBadge(pr.payment_type),
      reference: pr.payment_reference || "-",
      description: pr.description || "-",
    }))

    return { 
      rows, 
      pagination: { 
        page, 
        total: Math.ceil(allPayments.length / pageSize), 
        count: allPayments.length 
      } 
    }
  }

  return { rows: [], pagination: {} }
}

export default function RevenuesPage() {
  const { user } = useAuth()
  const { pagination, goToPage, updateFromResponse } = usePagination(10)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoading(true)
      try {
        const data = await fetchRevenuesForUser(user, pagination.currentPage, pagination.pageSize)
        setRows(data.rows)
        updateFromResponse(data.pagination)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, pagination.currentPage, pagination.pageSize])

  const handlePageChange = (page: number) => {
    goToPage(page)
  }

  const handleFilter = () => {}
  const handleReset = () => {}

  const totalAmount = rows.reduce((sum, r: any) => sum + Number(r.amountValue || 0), 0)
  const totalAmountStr = Number(totalAmount).toLocaleString("fr-FR", { style: "currency", currency: "MAD" })
  const summary = [
    { label: "Total Encaissements", value: String(rows.length) },
    { label: "Montant Total", value: totalAmountStr },
    { label: "Projets Impliqués", value: String(new Set(rows.map((r) => r.code)).size) },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gestion des Encaissements</h1>
        <p className="text-muted-foreground">Suivi et analyse des revenus par projet</p>
      </div>

      <FilterBar fields={filterFields} onFilter={handleFilter} onReset={handleReset} />

      <DataTable title="Liste des Encaissements" columns={columns} data={rows} summary={summary} loading={loading} />

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Affichage de {rows.length} encaissement(s) sur {pagination.totalCount} total
        </div>
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  )
}
