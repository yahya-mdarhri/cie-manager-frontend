"use client"

import { useEffect, useState } from "react"
import { FilterBar } from "@/components/ui/filter-bar"
import { DataTable } from "@/components/ui/data-table"
import { Pagination } from "@/components/ui/pagination"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { usePagination } from "@/hooks/use-pagination"
import { http } from "@/lib/http"

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
      { value: "CIE Direct", label: "CIE Direct" },
      { value: "Tech Center", label: "Tech Center" },
      { value: "TTO", label: "TTO" },
      { value: "Clinique Industrielle", label: "Clinique Industrielle" },
    ],
  },
  {
    type: "select" as const,
    key: "coordinator",
    label: "Coordinateur",
    placeholder: "Tous",
    options: [
      { value: "all", label: "Tous" },
      { value: "Omar Jebbouri", label: "Omar Jebbouri" },
      { value: "Wacim Benyahya", label: "Wacim Benyahya" },
      { value: "Bertrand Denise", label: "Bertrand Denise" },
    ],
  },
  {
    type: "select" as const,
    key: "paymentType",
    label: "Type de Paiement",
    placeholder: "Tous",
    options: [
      { value: "all", label: "Tous" },
      { value: "Bank Transfer", label: "Virement Bancaire" },
      { value: "Check", label: "Chèque" },
      { value: "Cash", label: "Espèces" },
      { value: "Other", label: "Autre" },
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
  const base = "/api/management"
  const allowedDepartments = new Set(["CIE Direct", "Tech Center", "TTO", "Clinique Industrielle"]) 
  const formatMoney = (n: number) => Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "MAD" })
  const typeBadge = (t?: string) => <Badge variant="default">{t || "-"}</Badge>

  // For directors, use the all payments endpoint for proper pagination
  if (user.role === "director") {
    const { data: raw } = await http.get(`${base}/all/payments/`, { params: { page, size: pageSize } })
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
      // Additional fields for filtering
      projectDepartment: pr.project?.department?.name || "",
      projectCoordinator: pr.project?.coordinator || "",
      paymentTypeText: pr.payment_type || "",
    }))

    return { rows, pagination: raw }
  }

  // For department managers, fetch from their department's projects
  if (user.role === "department_manager" && user.department) {
    const depId = Number(user.department)
    
    // First get all projects for the department
    const { data: projectsRaw } = await http.get(`${base}/departments/${depId}/projects/`, { params: { page: 1, size: 100 } })
    const projects = projectsRaw.results || projectsRaw

    // Collect all payments from all projects
    const allPayments: any[] = []
    for (const p of projects) {
      const { data: raw } = await http.get(`${base}/departments/${depId}/projects/${p.id}/payments/`, { params: { page: 1, size: 100 } })
      const payments = raw.results || raw
      payments.forEach((pr: any) => {
        allPayments.push({
          ...pr,
          project_name: p.project_name,
          project_code: p.project_code,
          projectDepartment: p.department?.name || "",
          projectCoordinator: p.coordinator || "",
        })
      })
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
      // Additional fields for filtering
      projectDepartment: pr.projectDepartment || "",
      projectCoordinator: pr.projectCoordinator || "",
      paymentTypeText: pr.payment_type || "",
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
  const [allRows, setAllRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({})

  const applyFilters = (data: any[], currentFilters: Record<string, string>) => {
    return data.filter((row) => {
      // Date range filter
      if (currentFilters.startDate) {
        const rowDate = new Date(row.date)
        const startDate = new Date(currentFilters.startDate)
        if (rowDate < startDate) return false
      }
      if (currentFilters.endDate) {
        const rowDate = new Date(row.date)
        const endDate = new Date(currentFilters.endDate)
        if (rowDate > endDate) return false
      }

      // Department filter
      if (currentFilters.department && currentFilters.department !== "all") {
        const projectDepartment = row.projectDepartment || ""
        if (!projectDepartment.toLowerCase().includes(currentFilters.department.toLowerCase())) return false
      }

      // Coordinator filter
      if (currentFilters.coordinator && currentFilters.coordinator !== "all") {
        const projectCoordinator = row.projectCoordinator || ""
        if (!projectCoordinator.toLowerCase().includes(currentFilters.coordinator.toLowerCase())) return false
      }

      // Payment type filter
      if (currentFilters.paymentType && currentFilters.paymentType !== "all") {
        const paymentTypeText = row.paymentTypeText || ""
        if (!paymentTypeText.toLowerCase().includes(currentFilters.paymentType.toLowerCase())) return false
      }

      return true
    })
  }

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoading(true)
      try {
        const data = await fetchRevenuesForUser(user, 1, 1000) // Load more data for filtering
        setAllRows(data.rows)
        const filteredData = applyFilters(data.rows, filters)
        setRows(filteredData.slice(0, pagination.pageSize))
        updateFromResponse({ page: 1, total: Math.ceil(filteredData.length / pagination.pageSize), count: filteredData.length })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  useEffect(() => {
    const filteredData = applyFilters(allRows, filters)
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize
    const endIndex = startIndex + pagination.pageSize
    setRows(filteredData.slice(startIndex, endIndex))
    updateFromResponse({ 
      page: pagination.currentPage, 
      total: Math.ceil(filteredData.length / pagination.pageSize), 
      count: filteredData.length 
    })
  }, [filters, pagination.currentPage, allRows])

  const handlePageChange = (page: number) => {
    goToPage(page)
  }

  const handleFilter = (newFilters: Record<string, string>) => {
    setFilters(newFilters)
    goToPage(1) // Reset to first page when filtering
  }

  const handleReset = () => {
    setFilters({})
    goToPage(1)
  }

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
