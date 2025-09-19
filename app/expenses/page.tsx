"use client"

import { useEffect, useState } from "react"
import { FilterBar } from "@/components/ui/filter-bar"
import { DataTable } from "@/components/ui/data-table"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"

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

async function fetchExpensesForUser(user: { role: string; department?: string | number | null }) {
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

  async function listDepartmentProjects(depId: number) {
    const res = await fetch(`${base}/departments/${depId}/projects/`, { credentials: "include" })
    if (!res.ok) return []
    return res.json()
  }

  const records: any[] = []
  if (user.role === "director") {
    const depRes = await fetch(`${base}/departments/`, { credentials: "include" })
    if (!depRes.ok) return []
    const departments = (await depRes.json()).filter((d: any) => allowedDepartments.has(d.name))
    for (const dep of departments) {
      const projects = await listDepartmentProjects(dep.id)
      for (const p of projects) {
        const expRes = await fetch(`${base}/departments/${dep.id}/projects/${p.id}/expenses/`, { credentials: "include" })
        if (!expRes.ok) continue
        const expenses = await expRes.json()
        expenses.forEach((e: any) => {
          records.push({
            project: p.project_name,
            code: p.project_code,
            date: e.expense_date,
            amount: formatMoney(e.amount),
            amountValue: Number(e.amount || 0),
            category: categoryBadge(e.category),
            supplier: e.supplier || "-",
          })
        })
      }
    }
  } else if (user.role === "department_manager" && user.department) {
    const depId = Number(user.department)
    const projects = await listDepartmentProjects(depId)
    for (const p of projects) {
      const expRes = await fetch(`${base}/departments/${depId}/projects/${p.id}/expenses/`, { credentials: "include" })
      if (!expRes.ok) continue
      const expenses = await expRes.json()
      expenses.forEach((e: any) => {
        records.push({
          project: p.project_name,
          code: p.project_code,
          date: e.expense_date,
          amount: formatMoney(e.amount),
          amountValue: Number(e.amount || 0),
          category: categoryBadge(e.category),
          supplier: e.supplier || "-",
        })
      })
    }
  }
  return records
}

export default function ExpensesPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      if (!user) return
      const data = await fetchExpensesForUser(user)
      setRows(data)
    }
    load()
  }, [user])

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

      <DataTable title="Liste des Dépenses" columns={columns} data={rows} summary={summary} />
    </div>
  )
}
