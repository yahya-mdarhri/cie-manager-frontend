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

async function fetchRevenuesForUser(user: { role: string; department?: string | number | null }) {
  const base = "http://localhost:8000/api/management"
  const allowedDepartments = new Set(["CIE Direct", "Tech Center", "TTO", "Clinique Industrielle"]) 
  const formatMoney = (n: number) => Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "MAD" })
  const typeBadge = (t?: string) => <Badge variant="default">{t || "-"}</Badge>

  async function listDepartmentProjects(depId: number) {
    const res = await fetch(`${base}/departments/${depId}/projects/`, { credentials: "include" })
    if (!res.ok) return []
    return res.json()
  }

  const rows: any[] = []
  if (user.role === "director") {
    const depRes = await fetch(`${base}/departments/`, { credentials: "include" })
    if (!depRes.ok) return []
    const departments = (await depRes.json()).filter((d: any) => allowedDepartments.has(d.name))
    for (const dep of departments) {
      const projects = await listDepartmentProjects(dep.id)
      for (const p of projects) {
        const payRes = await fetch(`${base}/departments/${dep.id}/projects/${p.id}/payments/`, { credentials: "include" })
        if (!payRes.ok) continue
        const pays = await payRes.json()
        pays.forEach((pr: any) => {
          rows.push({
            project: p.project_name,
            code: p.project_code,
            date: pr.payment_received_date,
            amount: formatMoney(pr.amount),
            amountValue: Number(pr.amount || 0),
            paymentType: typeBadge(pr.payment_type),
            reference: pr.payment_reference || "-",
            description: pr.description || "-",
          })
        })
      }
    }
  } else if (user.role === "department_manager" && user.department) {
    const depId = Number(user.department)
    const projects = await listDepartmentProjects(depId)
    for (const p of projects) {
      const payRes = await fetch(`${base}/departments/${depId}/projects/${p.id}/payments/`, { credentials: "include" })
      if (!payRes.ok) continue
      const pays = await payRes.json()
      pays.forEach((pr: any) => {
        rows.push({
          project: p.project_name,
          code: p.project_code,
          date: pr.payment_received_date,
          amount: formatMoney(pr.amount),
          amountValue: Number(pr.amount || 0),
          paymentType: typeBadge(pr.payment_type),
          reference: pr.payment_reference || "-",
          description: pr.description || "-",
        })
      })
    }
  }
  return rows
}

export default function RevenuesPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      if (!user) return
      const data = await fetchRevenuesForUser(user)
      setRows(data)
    }
    load()
  }, [user])

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

      <DataTable title="Liste des Encaissements" columns={columns} data={rows} summary={summary} />
    </div>
  )
}
