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
    key: "category",
    label: "Catégorie",
    placeholder: "Toutes",
    options: [
      { value: "all", label: "Toutes" },
      { value: "personnel", label: "Personnel" },
      { value: "sous-traitance", label: "Sous-traitance" },
      { value: "autre", label: "Autre" },
    ],
  },
]

const columns = [
  { key: "project", label: "Projet" },
  { key: "code", label: "Code Projet" },
  { key: "date", label: "Date" },
  { key: "amount", label: "Montant", className: "text-right font-medium text-blue-600" },
  { key: "category", label: "Catégorie" },
  { key: "supplier", label: "Fournisseur" },
]

async function fetchExpensesForUser(
  user: { role: string; department?: string | number | null },
  page: number = 1,
  pageSize: number = 10
) {
  const base = "http://localhost:8000/api/management"
  const allowedDepartments = new Set(["CIE Direct", "Tech Center", "TTO", "Clinique Industrielle"]) 

  const formatMoney = (n: number) => Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "MAD" })
  const categoryBadge = (c?: string) => {
    const v = (c || "").toLowerCase()
    if (v.includes("personnel")) return <Badge variant="secondary">Personnel</Badge>
    if (v.includes("equipment") || v.includes("équipement")) return <Badge variant="outline">Équipement</Badge>
    if (v.includes("subcontract")) return <Badge variant="outline">Sous-traitance</Badge>
    return <Badge variant="default">Autre</Badge>
  }

  // For directors, use the all expenses endpoint for proper pagination
  if (user.role === "director") {
    const expRes = await fetch(`${base}/all/expenses/?page=${page}&size=${pageSize}`, { credentials: "include" })
    if (!expRes.ok) return { records: [], pagination: {} }
    const raw = await expRes.json()
    const expenses = raw.results || raw
    
    const records = expenses.map((e: any) => ({
      project: e.project?.project_name || "N/A",
      code: e.project?.project_code || "N/A",
      date: e.expense_date,
      amount: formatMoney(e.amount),
      amountValue: Number(e.amount || 0),
      category: categoryBadge(e.category),
      supplier: e.supplier || "-",
    }))

    return { records, pagination: raw }
  }

  // For department managers, fetch from their department's projects
  if (user.role === "department_manager" && user.department) {
    const depId = Number(user.department)
    
    // First get all projects for the department
    const projectsRes = await fetch(`${base}/departments/${depId}/projects/?page=1&size=100`, { credentials: "include" })
    if (!projectsRes.ok) return { records: [], pagination: {} }
    const projectsRaw = await projectsRes.json()
    const projects = projectsRaw.results || projectsRaw

    // Collect all expenses from all projects
    const allExpenses: any[] = []
    for (const p of projects) {
      const expRes = await fetch(`${base}/departments/${depId}/projects/${p.id}/expenses/?page=1&size=100`, { credentials: "include" })
      if (expRes.ok) {
        const raw = await expRes.json()
        const expenses = raw.results || raw
        expenses.forEach((e: any) => {
          allExpenses.push({
            ...e,
            project_name: p.project_name,
            project_code: p.project_code,
          })
        })
      }
    }

    // Implement frontend pagination for department managers
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedExpenses = allExpenses.slice(startIndex, endIndex)

    const records = paginatedExpenses.map((e: any) => ({
      project: e.project_name,
      code: e.project_code,
      date: e.expense_date,
      amount: formatMoney(e.amount),
      amountValue: Number(e.amount || 0),
      category: categoryBadge(e.category),
      supplier: e.supplier || "-",
    }))

    return { 
      records, 
      pagination: { 
        page, 
        total: Math.ceil(allExpenses.length / pageSize), 
        count: allExpenses.length 
      } 
    }
  }

  return { records: [], pagination: {} }
}

export default function ExpensesPage() {
  const { user } = useAuth()
  const { pagination, goToPage, updateFromResponse } = usePagination(10)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoading(true)
      try {
        const data = await fetchExpensesForUser(user, pagination.currentPage, pagination.pageSize)
        setRows(data.records)
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
    { label: "Total Dépenses", value: String(rows.length) },
    { label: "Montant Total", value: totalAmountStr },
    { label: "Projets Impliqués", value: String(new Set(rows.map((r) => r.code)).size) },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gestion des Dépenses</h1>
        <p className="text-muted-foreground">Suivi et analyse des dépenses par projet</p>
      </div>

      <FilterBar fields={filterFields} onFilter={handleFilter} onReset={handleReset} />

      <DataTable title="Liste des Dépenses" columns={columns} data={rows} summary={summary} loading={loading} />

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Affichage de {rows.length} dépense(s) sur {pagination.totalCount} total
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
