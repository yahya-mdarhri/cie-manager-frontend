"use client"

import type React from "react"

import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"

import {
  X,
  Download,
  Calendar,
  User,
  Building2,
  Users,
  CheckCircle,
  Edit,
  CreditCard,
  FileText,
  Eye,
  Plus,
  Trash2,
  Upload,
  Play,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PauseCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { http } from "@/lib/http"
import jsPDF from "jspdf"
import { useLanguage } from "@/lib/language-context"
import JalonManagement from "./jalon-management"

interface Project {
  id?: number
  name: string
  code: string
  department: string
  coordinator: string
  totalBudget: string | number
  remainingBudget: string | number
  status: string
  client?: string
  startDate?: string
  endDate?: string
  budgetVentilation?: { label: string; amount: number; color?: string | null }[]
  timeline?: { step: string; date?: string; completed?: boolean }[]
  departmentId?: number
  description?: string
}

interface ProjectStep {
  id: number
  name: string
  description: string
  start_date: string
  end_date: string
  execution_status: boolean
  execution_comments?: string
  execution_proof?: string
  created_at: string
}

type ActiveTab = "details" | "edit" | "jalons" | "encaissements" | "depenses" | "documents"

interface Transaction {
  id: number
  date: string
  description: string
  amount: number
  type: "encaissement" | "depense"
  category?: string
  supplier?: string
  invoice_reference?: string
  document_path?: string | null
}

interface Document {
  id: number
  name: string
  type: string
  size: string
  uploadDate: string
  url?: string
}

export default function ProjectViewModal({
  project,
  onClose,
}: {
  project: Project
  onClose: () => void
}) {
  const { t, language } = useLanguage()
  const tt = (k: string, d: string) => {
    const s = t(k as any)
    return typeof s === "string" && s.includes(".") ? d : s
  }
  const statusLabel = (s?: string) => {
    switch (s) {
      case "In Progress":
        return t("status.inProgress")
      case "Paused":
        return t("status.paused")
      case "Completed":
        return t("status.completed")
      case "Cancelled":
      case "Canceled":
        return t("status.cancelled")
      default:
        return s || "-"
    }
  }
  // transient flash message for add/delete feedback
  const [flash, setFlash] = useState<{ text: string; type?: "success" | "info" | "error" } | null>(null)
  const showFlash = (text: string, type: "success" | "info" | "error" = "success") => {
    setFlash({ text, type })
    window.setTimeout(() => setFlash(null), 2000)
  }
  // Derive department id robustly from multiple possible shapes
  const depId = (project as any)?.departmentId ?? (project as any)?.department_id ?? (project as any)?.department?.id
  const [projectSteps, setProjectSteps] = useState<ProjectStep[]>([])
  const [loadingSteps, setLoadingSteps] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>("details")
  const [editedProject, setEditedProject] = useState<Project>(project)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingExpenses, setLoadingExpenses] = useState(false)
  const [budget, setBudget] = useState<{ total: number; committed: number; remaining: number }>(() => {
    const totalBudgetNum = typeof project.totalBudget === "string"
      ? Number.parseFloat(project.totalBudget.replace(/[^\d.-]/g, ""))
      : (project.totalBudget || 0)
    const remainingBudgetNum = typeof project.remainingBudget === "string"
      ? Number.parseFloat(project.remainingBudget.replace(/[^\d.-]/g, ""))
      : (project.remainingBudget || 0)
    const committedApprox = Math.max(0, Number(totalBudgetNum) - Number(remainingBudgetNum))
    return { total: Number(totalBudgetNum) || 0, committed: committedApprox || 0, remaining: Number(remainingBudgetNum) || 0 }
  })
  const [documents, setDocuments] = useState<Document[]>([
    { id: 1, name: "Cahier des charges.pdf", type: "PDF", size: "2.5 MB", uploadDate: "2024-01-10" },
    { id: 2, name: "Maquettes UI.figma", type: "Figma", size: "15.2 MB", uploadDate: "2024-01-20" },
    { id: 3, name: "Contrat client.pdf", type: "PDF", size: "1.8 MB", uploadDate: "2024-01-05" },
  ])
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  // (legacy) print layout state removed; exporting directly via jsPDF now
  const printRef = useRef<HTMLDivElement | null>(null)

  // Print-safe Gantt component (inline styles only, hex colors)
  const PrintGantt: React.FC<{
    jalons: Array<{
      id: number
      name: string
      description?: string
      start_date: string
      end_date: string
      is_completed: boolean
      completion_date?: string
    }>
  }> = ({ jalons }) => {
    if (!jalons || jalons.length === 0) {
      return <div style={{ padding: "16px", color: "#6b7280", fontSize: 12 }}>Aucun jalon à afficher</div>
    }
    const allDates = jalons.flatMap((j) => [new Date(j.start_date), new Date(j.end_date)])
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))
    const dayMs = 24 * 60 * 60 * 1000
    const padDays = 7
    const timelineStart = new Date(minDate.getTime() - padDays * dayMs)
    const timelineEnd = new Date(maxDate.getTime() + padDays * dayMs)
    const totalDays = Math.max(1, Math.ceil((timelineEnd.getTime() - timelineStart.getTime()) / dayMs))

    const monthMarkers = (() => {
      const markers: { pos: number; label: string }[] = []
      const current = new Date(timelineStart)
      current.setDate(1)
      while (current <= timelineEnd) {
        const pos = (current.getTime() - timelineStart.getTime()) / (timelineEnd.getTime() - timelineStart.getTime())
        markers.push({ pos, label: current.toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) })
        current.setMonth(current.getMonth() + 1)
      }
      return markers
    })()

    const showWeekly = totalDays <= 120
    const weekMarkers = (() => {
      const markers: number[] = []
      if (!showWeekly) return markers
      const c = new Date(timelineStart)
      const day = c.getDay()
      const deltaToMon = (1 - day + 7) % 7
      c.setDate(c.getDate() + deltaToMon)
      while (c <= timelineEnd) {
        const pos = (c.getTime() - timelineStart.getTime()) / (timelineEnd.getTime() - timelineStart.getTime())
        markers.push(pos)
        c.setDate(c.getDate() + 7)
      }
      return markers
    })()

    const today = new Date()
    const showToday = today >= timelineStart && today <= timelineEnd
    const todayPos = (today.getTime() - timelineStart.getTime()) / (timelineEnd.getTime() - timelineStart.getTime())

    const barStyle = (j: any) => {
      const s = new Date(j.start_date)
      const e = new Date(j.end_date)
      const startOffset = Math.max(0, Math.ceil((s.getTime() - timelineStart.getTime()) / dayMs))
      const duration = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / dayMs) + 1)
      const left = (startOffset / totalDays) * 100
      const width = (duration / totalDays) * 100
      return { left: `${left}%`, width: `${Math.max(width, 2)}%` }
    }

    const colorFor = (j: any) => (j.is_completed ? "#22c55e" : new Date(j.end_date) < new Date() ? "#ef4444" : "#3b82f6")

    const headerCell: React.CSSProperties = { fontSize: 12, color: "#6b7280" }
    const labelCell: React.CSSProperties = { fontSize: 12, fontWeight: 600 }

    return (
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
        {/* Timeline header */}
        <div style={{ position: "relative", height: 32, borderBottom: "1px solid #e5e7eb", marginBottom: 8 }}>
          {monthMarkers.map((m, i) => (
            <div key={`m-${i}`} style={{ position: "absolute", left: `${m.pos * 100}%`, top: 0, transform: "translateX(-50%)", fontSize: 11, color: "#6b7280", textAlign: "center" }}>
              <div style={{ borderLeft: "1px solid #e5e7eb", height: 18, marginBottom: 2 }} />
              <span>{m.label}</span>
            </div>
          ))}
          {showWeekly && weekMarkers.map((p, i) => (
            <div key={`w-${i}`} style={{ position: "absolute", left: `${p * 100}%`, top: 0, bottom: 0, borderLeft: "1px solid #e5e7eb" }} />
          ))}
        </div>

        {/* Bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {jalons
            .slice()
            .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
            .map((j) => (
              <div key={j.id} style={{ position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 9999, background: j.is_completed ? "#22c55e" : new Date(j.end_date) < new Date() ? "#ef4444" : "#9ca3af" }} />
                    <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>
                    {new Date(j.start_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} - {new Date(j.end_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </div>
                </div>
                <div style={{ position: "relative", height: 20, background: "#f3f4f6", borderRadius: 6, overflow: "hidden" }}>
                  {monthMarkers.map((m, i) => (
                    <div key={`mg-${i}`} style={{ position: "absolute", left: `${m.pos * 100}%`, top: 0, bottom: 0, borderLeft: "1px solid #e5e7eb" }} />
                  ))}
                  {showWeekly && weekMarkers.map((p, i) => (
                    <div key={`wg-${i}`} style={{ position: "absolute", left: `${p * 100}%`, top: 0, bottom: 0, borderLeft: "1px solid #e5e7eb" }} />
                  ))}
                  <div style={{ position: "absolute", top: 0, bottom: 0, background: colorFor(j), borderRadius: 6, ...barStyle(j) }} />
                  {showToday ? (
                    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${todayPos * 100}%`, width: 2, background: "#ef4444" }} />
                  ) : null}
                </div>
              </div>
            ))}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center", paddingTop: 8, borderTop: "1px solid #e5e7eb", marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><div style={{ width: 12, height: 12, background: "#3b82f6" }} /> En cours</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><div style={{ width: 12, height: 12, background: "#22c55e" }} /> Terminé</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><div style={{ width: 12, height: 12, background: "#ef4444" }} /> En retard</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><div style={{ width: 2, height: 12, background: "#ef4444" }} /> Aujourd'hui</div>
        </div>
      </div>
    )
  }
  const [newTransaction, setNewTransaction] = useState<{
    description: string
    amount: string
    type: "encaissement" | "depense"
    category: string
    reference?: string
  }>({
    description: "",
    amount: "",
    type: "encaissement",
    category: "",
    reference: "",
  })

  useEffect(() => {
    const fetchProjectSteps = async () => {
      if (!project.id || !depId) return

      setLoadingSteps(true)
      try {
        const { data: raw } = await http.get(`/api/management/departments/${depId}/projects/${project.id}/steps/`)
        const steps = raw?.results || raw
        setProjectSteps(Array.isArray(steps) ? steps : [])
      } catch (error) {
        console.error("Error fetching project steps:", error)
      } finally {
        setLoadingSteps(false)
      }
    }

    fetchProjectSteps()
  }, [project.id, depId])

  // Fetch project details to load contract_documents and related documents
  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!project.id || !depId) return
      setLoadingDocuments(true)
      try {
        const { data } = await http.get(`/api/management/departments/${depId}/projects/${project.id}/`)
        // Update budget from backend for concrete numbers
        if (data) {
          const tb = Number(data.total_budget || 0)
          const cb = Number(data.committed_budget || 0)
          const rb = Number(data.remaining_budget || Math.max(0, tb - cb))
          setBudget({ total: tb, committed: cb, remaining: rb })
          // Hydrate editedProject with canonical backend values, preserving user input if present
          setEditedProject((prev) => ({
            ...prev,
            name: data.project_name ?? prev.name,
            coordinator: data.coordinator ?? prev.coordinator,
            client: data.client_name ?? prev.client,
            startDate: data.signature_date ?? prev.startDate,
            endDate: data.end_date ?? prev.endDate,
            totalBudget: data.total_budget ?? prev.totalBudget,
            status: data.status ?? prev.status,
          }))
        }
        const docs: Document[] = []
        // contract_documents may be a URL string
        if (data?.contract_documents) {
          docs.push({
            id: -1,
            name: data.contract_documents.split("/").pop() || "contract",
            type: (data.contract_documents.split(".").pop() || "pdf").toUpperCase(),
            size: "-",
            uploadDate: "-",
            url: data.contract_documents,
          })
        }
        // include project steps' execution_proof (if available)
        try {
          const { data: stepsRaw } = await http.get(
            `/api/management/departments/${depId}/projects/${project.id}/steps/`,
          )
          const steps = stepsRaw?.results || stepsRaw || []
          if (Array.isArray(steps)) {
            for (const s of steps) {
              if (s.execution_proof) {
                docs.push({
                  id: s.id,
                  name: s.execution_proof.split("/").pop() || `jalon-${s.id}`,
                  type: (s.execution_proof.split(".").pop() || "pdf").toUpperCase(),
                  size: "-",
                  uploadDate: s.created_at ? s.created_at.split("T")[0] : "-",
                  url: s.execution_proof,
                })
              }
            }
          }
        } catch (e) {
          // ignore steps fetch errors here
        }

        setDocuments(docs)
      } catch (err) {
        console.error("Error fetching project details/documents:", err)
      } finally {
        setLoadingDocuments(false)
      }
    }

    fetchProjectDetails()
  }, [project.id, depId])

  // Fetch project expenses and revenues from backend
  useEffect(() => {
    const refreshExpenses = async () => {
      if (!project.id || !depId) return
      setLoadingExpenses(true)
      try {
        const { data: raw } = await http.get(
          `/api/management/departments/${depId}/projects/${project.id}/expenses/`,
        )
        const list = raw?.results || raw || []
        const mappedExpenses: Transaction[] = (Array.isArray(list) ? list : [])
          .map((e: any) => ({
            id: e.id,
            date: e.expense_date,
            description: e.description || e.invoice_reference || "",
            amount: Number(e.amount || 0),
            type: "depense",
            category: e.category || "",
            supplier: (e as any).supplier || "",
            invoice_reference: (e as any).invoice_reference || "",
            // allow optional document link
            document_path: (e as any).document_path || null,
          }))
        // fetch payments
        const { data: praw } = await http.get(
          `/api/management/departments/${depId}/projects/${project.id}/payments/`,
        )
        const plist = praw?.results || praw || []
        const mappedPayments: Transaction[] = (Array.isArray(plist) ? plist : [])
          .map((p: any) => ({
            id: p.id,
            date: p.payment_received_date,
            description: p.description || p.payment_reference || "",
            amount: Number(p.amount || 0),
            type: "encaissement",
            category: p.payment_type || "",
            supplier: "",
            invoice_reference: (p as any).payment_reference || "",
            document_path: null,
          }))
        setTransactions([...mappedExpenses, ...mappedPayments])
      } catch (err) {
        console.error("Error fetching project expenses:", err)
      } finally {
        setLoadingExpenses(false)
      }
    }

    refreshExpenses()
  }, [project.id, depId])

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === "string" ? Number.parseFloat(amount.replace(/[^\d.-]/g, "")) : amount
    return (
      new Intl.NumberFormat("fr-MA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numAmount) + " MAD"
    )
  }

  // Concrete aggregates
  const depensesAll = transactions.filter((t) => t.type === "depense")
  const encaissementsAll = transactions.filter((t) => t.type === "encaissement")
  const spentBudget = depensesAll.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const totalEncaissements = encaissementsAll.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const totalBudgetNum = budget.total
  // Engaged depends on backend committed minus payments received
  const engagedBudget = Math.max(0, (budget.committed || 0) - totalEncaissements)
  // Derive remaining so percentages sum to 100%
  const derivedRemaining = Math.max(0, (totalBudgetNum || 0) - (engagedBudget || 0) - (spentBudget || 0))
  const spentPct = totalBudgetNum > 0 ? (spentBudget / totalBudgetNum) * 100 : 0
  const engagedPct = totalBudgetNum > 0 ? (engagedBudget / totalBudgetNum) * 100 : 0
  const availablePct = totalBudgetNum > 0 ? (derivedRemaining / totalBudgetNum) * 100 : 0

  const handleDownloadPDF = async (project: Project) => {
    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 12
    let y = margin

    // Try to add logo centered on its own line (optional)
    try {
      const dataUrl = await (async () => {
        const res = await fetch("/logo.png")
        if (!res.ok) return null
        const blob = await res.blob()
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(blob)
        })
      })()
      if (dataUrl) {
        // Measure intrinsic image size in the browser to preserve aspect ratio
        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image()
          img.onload = () => resolve({ w: img.width, h: img.height })
          img.src = dataUrl
        })
        const maxLogoWidthMm = Math.min(60, pageWidth - margin * 2) // cap logo width
        const ratio = dims.w > 0 ? dims.h / dims.w : 1
        const logoW = maxLogoWidthMm
        const logoH = logoW * ratio
        const logoX = (pageWidth - logoW) / 2
        pdf.addImage(dataUrl, "PNG", logoX, y, logoW, logoH)
        y += logoH + 6
        // Optional divider for clean layout
        pdf.setDrawColor(230)
        pdf.line(margin, y, pageWidth - margin, y)
        y += 6
      }
    } catch {}

    // Header text (placed below logo, not on the same line)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(16)
    pdf.text(project.name || "Projet", margin, y)
    pdf.setFontSize(10)
    pdf.setTextColor(100)
    pdf.text(project.code || "-", margin, y + 6)
    pdf.setTextColor(0)
    y += 14

    // Details grid
    const rowH = 6
    const leftColX = margin
    const rightColX = pageWidth / 2
    const writeRow = (label: string, value: string, x: number) => {
      pdf.setFontSize(10)
      pdf.setTextColor(100)
      pdf.text(label, x, y)
      pdf.setTextColor(0)
      pdf.setFontSize(12)
      pdf.text(value || "-", x, y + 4)
    }
    writeRow("Département", String(project.department || "-"), leftColX)
    writeRow("Coordinateur", String(project.coordinator || "-"), rightColX)
    y += rowH + 6
    writeRow("Client", String(project.client || "-"), leftColX)
    writeRow("Période", `${project.startDate || "-"} - ${project.endDate || "-"}`, rightColX)
    y += rowH + 10

    // Budget summary
    const fmtCurrency = (v: number) =>
      new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + " MAD"
    const total = Number(budget.total || 0)
    const engaged = Number(engagedBudget || 0)
    const available = Math.max(0, total - engaged - Number(spentBudget || 0))
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(12)
    pdf.text("Budget", margin, y)
    y += 6
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(11)
    pdf.text(`Total: ${fmtCurrency(total)}`, margin, y)
    pdf.text(`Engagé: ${fmtCurrency(engaged)}`, pageWidth / 2, y)
    y += 6
    pdf.text(`Disponible: ${fmtCurrency(available)}`, margin, y)
    y += 10

    const addPageIfNeeded = (needed: number) => {
      if (y + needed > pageHeight - margin) {
        pdf.addPage()
        y = margin
      }
    }

    // Milestones table
    addPageIfNeeded(12)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(12)
    pdf.text("Jalons", margin, y)
    y += 6
    // Ensure we have fresh steps; fetch if empty
    let steps = projectSteps || []
    if ((!steps || steps.length === 0) && project.id && depId) {
      try {
        const { data: raw } = await http.get(
          `/api/management/departments/${depId}/projects/${project.id}/steps/`
        )
        const fetched = raw?.results || raw || []
        if (Array.isArray(fetched)) steps = fetched
      } catch (e) {
        // ignore fetch errors; we'll render fallback
      }
    }
    if (steps.length > 0) {
      // headers
      const colX = [margin, margin + 70, margin + 110, margin + 150]
      pdf.setFontSize(10)
      pdf.setTextColor(100)
      pdf.text("Nom", colX[0], y)
      pdf.text("Début", colX[1], y)
      pdf.text("Fin", colX[2], y)
      pdf.text("Statut", colX[3], y)
      pdf.setTextColor(0)
      y += 4
      pdf.setDrawColor(220)
      pdf.line(margin, y, pageWidth - margin, y)
      y += 3

      pdf.setFontSize(10)
      for (const s of steps) {
        addPageIfNeeded(8)
        const start = new Date(s.start_date).toLocaleDateString("fr-FR")
        const end = new Date(s.end_date).toLocaleDateString("fr-FR")
        const status = s.execution_status ? "Terminé" : "En cours"
        pdf.text(String(s.name || "-"), colX[0], y)
        pdf.text(start, colX[1], y)
        pdf.text(end, colX[2], y)
        pdf.text(status, colX[3], y)
        y += 6
        pdf.setDrawColor(242)
        pdf.line(margin, y - 4, pageWidth - margin, y - 4)
      }
      y += 2
    } else {
      pdf.setFontSize(10)
      pdf.setTextColor(100)
      pdf.text("Aucun jalon", margin, y)
      pdf.setTextColor(0)
      y += 6
    }

    // Gantt chart
    const jalons = steps.map((s) => ({
      id: s.id,
      name: s.name,
      start: new Date(s.start_date),
      end: new Date(s.end_date),
      done: !!s.execution_status,
    }))
    if (jalons.length > 0) {
      const dayMs = 24 * 60 * 60 * 1000
      const min = new Date(Math.min(...jalons.flatMap((j) => [j.start.getTime(), j.end.getTime()])))
      const max = new Date(Math.max(...jalons.flatMap((j) => [j.start.getTime(), j.end.getTime()])))
      const padDays = 7
      const startT = min.getTime() - padDays * dayMs
      const endT = max.getTime() + padDays * dayMs
      const range = Math.max(1, endT - startT)

      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(12)
      addPageIfNeeded(12)
      pdf.text("Gantt", margin, y)
      y += 6
      const chartX = margin
      const chartW = pageWidth - margin * 2
      const rowH2 = 8
      const barH = 5
      const colorInProg = [59, 130, 246] // #3b82f6
      const colorDone = [34, 197, 94] // #22c55e
      const colorLate = [239, 68, 68] // #ef4444

      // background grid
      pdf.setDrawColor(230)
      pdf.line(chartX, y, chartX + chartW, y)

      for (const j of jalons) {
        addPageIfNeeded(rowH2 + 4)
        // label
        pdf.setFontSize(10)
        pdf.setTextColor(0)
        pdf.text(j.name || "-", chartX, y + rowH2 - 2)

        // bar
        const jStart = j.start.getTime()
        const jEnd = j.end.getTime()
        const left = chartX + ((jStart - startT) / range) * chartW
        const width = Math.max(2, ((jEnd - jStart) / range) * chartW)
        const now = Date.now()
        const rgb = j.done ? colorDone : j.end.getTime() < now ? colorLate : colorInProg
        pdf.setFillColor(rgb[0], rgb[1], rgb[2])
        pdf.setDrawColor(rgb[0], rgb[1], rgb[2])
        pdf.rect(left, y + 2, width, barH, "F")
        y += rowH2
        pdf.setDrawColor(242)
        pdf.line(chartX, y, chartX + chartW, y)
      }

      // legend
      addPageIfNeeded(10)
      const legendY = y + 4
      const legendItems = [
        { label: "En cours", color: colorInProg },
        { label: "Terminé", color: colorDone },
        { label: "En retard", color: colorLate },
      ]
      let lx = chartX
      for (const it of legendItems) {
        pdf.setFillColor(it.color[0], it.color[1], it.color[2])
        pdf.rect(lx, legendY - 4, 6, 4, "F")
        pdf.setTextColor(0)
        pdf.setFontSize(10)
        pdf.text(it.label, lx + 8, legendY)
        lx += 40
      }
      y += 14
    }

    // Footer note
    pdf.setFontSize(9)
    pdf.setTextColor(120)
    pdf.text(`${new Date().toLocaleString("fr-FR")} • Export PDF`, margin, pageHeight - margin)

    pdf.save(`${project.code || project.name || "projet"}.pdf`)
  }

  const handleSaveEdit = async () => {
    try {
      if (!project.id || !depId) throw new Error("Project context missing")
      // Map UI fields to backend payload
      const payload: any = {}
      if (editedProject.name != null) payload.project_name = editedProject.name
      if (editedProject.coordinator != null) payload.coordinator = editedProject.coordinator
      if (editedProject.client != null) payload.client_name = editedProject.client
      if (editedProject.startDate) payload.signature_date = editedProject.startDate
      if (editedProject.endDate) payload.end_date = editedProject.endDate
      if (editedProject.totalBudget != null) payload.total_budget = Number(editedProject.totalBudget)

      const { data: updated } = await http.patch(
        `/api/management/departments/${depId}/projects/${project.id}/`,
        payload,
      )

      // Reflect saved values locally
      const next: Project = {
        ...editedProject,
        name: updated?.project_name ?? editedProject.name,
        coordinator: updated?.coordinator ?? editedProject.coordinator,
        client: updated?.client_name ?? editedProject.client,
        startDate: updated?.signature_date ?? editedProject.startDate,
        endDate: updated?.end_date ?? editedProject.endDate,
        totalBudget: updated?.total_budget ?? editedProject.totalBudget,
        status: updated?.status ?? editedProject.status,
      }
      setEditedProject(next)

      // Update budget block from backend concrete values
      if (updated) {
        const tb = Number(updated.total_budget ?? next.totalBudget ?? 0)
        const cb = Number(updated.committed_budget ?? budget.committed ?? 0)
        const rb = Number(
          updated.remaining_budget ?? Math.max(0, tb - cb)
        )
        setBudget({ total: tb, committed: cb, remaining: rb })
      }

      showFlash(t("messages.updateSuccess"))
      setActiveTab("details")
    } catch (err) {
      console.error("Failed to update project:", err)
      alert(t("messages.error"))
    }
  }

  const handleUpdateStatus = async (status: "Completed" | "Paused" | "In Progress") => {
    try {
      if (!project.id || !depId) throw new Error("Project context missing")
      // Guard: if trying to resume but end date has already passed, inform the user and don't PATCH
      if (status === "In Progress" && editedProject.endDate) {
        try {
          const today = new Date()
          const end = new Date(editedProject.endDate)
          // Normalize to date-only comparison
          const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
          if (atMidnight(end) < atMidnight(today)) {
            showFlash(
              tt(
                "projectView.status.extendDeadlineToResume",
                "To resume this project, please extend the end date first."
              ),
              "info"
            )
            setActiveTab("edit")
            return
          }
        } catch {}
      }
      setUpdatingStatus(true)
      const { data: updated } = await http.patch(
        `/api/management/departments/${depId}/projects/${project.id}/`,
        { status }
      )
      setEditedProject((prev) => ({
        ...prev,
        status: updated?.status ?? status,
      }))
      const msg =
        status === "Completed"
          ? tt("projectView.status.setCompleted", "Project set to Completed")
          : status === "Paused"
            ? tt("projectView.status.setPaused", "Project set to Paused")
            : tt("projectView.status.setInProgress", "Project set to In Progress")
      showFlash(msg, "info")
    } catch (err) {
      console.error("Failed to update status:", err)
      alert(tt("projectView.status.updateError", "Failed to update status"))
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleAddTransaction = (kind: "encaissement" | "depense") => {
    if (!newTransaction.description || !newTransaction.amount) return

    // Decide branch using explicit kind (avoid async state race)
    if (kind === "depense") {
      (async () => {
        try {
          if (!project.id || !depId) throw new Error("Project context missing")
          // Normalize category to backend enum values
          const normalizeCategory = (c: string) => {
            const s = (c || "").trim().toLowerCase()
            const map: Record<string, string> = {
              "personnel": "Personnel",
              "equipment": "Equipment",
              "équipement": "Equipment",
              "equipement": "Equipment",
              "subcontracting": "Subcontracting",
              "sous-traitance": "Subcontracting",
              "material": "Material",
              "matériel": "Material",
              "materiel": "Material",
              "consumables": "Consumables",
              "consommable": "Consumables",
              "consommables": "Consumables",
              "mobility": "Mobility",
              "mobilité": "Mobility",
              "mobilite": "Mobility",
              "other": "Other",
              "autre": "Other",
            }
            return map[s] || "Other"
          }
          const payload = {
            description: newTransaction.description,
            amount: Number.parseFloat(newTransaction.amount),
            expense_date: new Date().toISOString().split("T")[0],
            category: normalizeCategory(newTransaction.category),
            supplier: "",
            invoice_reference: "",
          }
          const res = await http.post(
            `/api/management/departments/${depId}/projects/${project.id}/expenses/create/`,
            payload,
          )
          // refresh both expenses and payments to keep unified list consistent
          const { data: raw } = await http.get(
            `/api/management/departments/${depId}/projects/${project.id}/expenses/`,
          )
          const list = raw?.results || raw || []
          const mappedExpenses: Transaction[] = (Array.isArray(list) ? list : [])
            .map((e: any) => ({
              id: e.id,
              date: e.expense_date,
              description: e.description || e.invoice_reference || "",
              amount: Number(e.amount || 0),
              type: "depense",
              category: e.category || "",
              supplier: (e as any).supplier || "",
              invoice_reference: (e as any).invoice_reference || "",
              document_path: (e as any).document_path || null,
            }))
          const { data: praw } = await http.get(
            `/api/management/departments/${depId}/projects/${project.id}/payments/`,
          )
          const plist = praw?.results || praw || []
          const mappedPayments: Transaction[] = (Array.isArray(plist) ? plist : [])
            .map((p: any) => ({
              id: p.id,
              date: p.payment_received_date,
              description: p.description || p.payment_reference || "",
              amount: Number(p.amount || 0),
              type: "encaissement",
              category: p.payment_type || "",
              supplier: "",
              invoice_reference: (p as any).payment_reference || "",
              document_path: null,
            }))
          setTransactions([...mappedExpenses, ...mappedPayments])
          // reset form for another expense
          setNewTransaction({ description: "", amount: "", type: "depense", category: "" })
          showFlash(`${t("dashboard.models.expense")}: ${t("messages.createSuccess")}`)
        } catch (err) {
          console.error("Failed to create expense:", err)
          const anyErr: any = err as any
          const msg = anyErr?.response?.data?.details || anyErr?.response?.data || t("projectView.errors.createExpense")
          alert(typeof msg === "string" ? msg : t("projectView.errors.createExpense"))
        }
      })()
  } else {
      // Create payment received (encaissement)
      (async () => {
        try {
          if (!project.id || !depId) throw new Error("Project context missing")
          const normalizePaymentType = (s: string) => {
            const v = (s || "").toLowerCase()
            if (v.includes("bank")) return "Bank Transfer"
            if (v.includes("vir") || v.includes("transfer")) return "Bank Transfer"
            if (v.includes("check") || v.includes("chèque") || v.includes("cheque")) return "Check"
            if (v.includes("cash") || v.includes("espèces") || v.includes("especes")) return "Cash"
            return "Bank Transfer"
          }
          const payload = {
            amount: Number.parseFloat(newTransaction.amount),
            payment_received_date: new Date().toISOString().split("T")[0],
            payment_type: normalizePaymentType(newTransaction.category),
            payment_reference: newTransaction.reference || newTransaction.description || "REF",
            description: newTransaction.description || "",
          }
          await http.post(
            `/api/management/departments/${depId}/projects/${project.id}/payments/create/`,
            payload,
          )
          // refresh list (both)
          const { data: raw } = await http.get(
            `/api/management/departments/${depId}/projects/${project.id}/expenses/`,
          )
          const list = raw?.results || raw || []
          const mappedExpenses: Transaction[] = (Array.isArray(list) ? list : [])
            .map((e: any) => ({
              id: e.id,
              date: e.expense_date,
              description: e.description || e.invoice_reference || "",
              amount: Number(e.amount || 0),
              type: "depense",
              category: e.category || "",
              supplier: (e as any).supplier || "",
              invoice_reference: (e as any).invoice_reference || "",
              document_path: (e as any).document_path || null,
            }))
          const { data: praw } = await http.get(
            `/api/management/departments/${depId}/projects/${project.id}/payments/`,
          )
          const plist = praw?.results || praw || []
          const mappedPayments: Transaction[] = (Array.isArray(plist) ? plist : [])
            .map((p: any) => ({
              id: p.id,
              date: p.payment_received_date,
              description: p.description || p.payment_reference || "",
              amount: Number(p.amount || 0),
              type: "encaissement",
              category: p.payment_type || "",
              supplier: "",
              invoice_reference: (p as any).payment_reference || "",
              document_path: null,
            }))
          setTransactions([...mappedExpenses, ...mappedPayments])
          setNewTransaction({ description: "", amount: "", type: "encaissement", category: "", reference: "" })
          showFlash(`${t("dashboard.models.paymentreceived")}: ${t("messages.createSuccess")}`)
        } catch (err) {
          console.error("Failed to create payment:", err)
          const anyErr: any = err as any
          const msg = anyErr?.response?.data?.details || anyErr?.response?.data || t("messages.error")
          alert(typeof msg === "string" ? msg : t("messages.error"))
        }
      })()
    }
  }

  const handleDeleteTransaction = (id: number, kind: "encaissement" | "depense") => {
    ;(async () => {
      try {
        if (!project.id || !depId) throw new Error("Project context missing")
        // choose endpoint by explicit type to avoid id collision issues
        if (kind === "encaissement") {
          await http.delete(
            `/api/management/departments/${depId}/projects/${project.id}/payments/${id}/`,
          )
        } else {
          await http.delete(
            `/api/management/departments/${depId}/projects/${project.id}/expenses/${id}/`,
          )
        }
        // refresh
        const { data: raw } = await http.get(
          `/api/management/departments/${depId}/projects/${project.id}/expenses/`,
        )
        const list = raw?.results || raw || []
        const mappedExpenses: Transaction[] = (Array.isArray(list) ? list : [])
          .map((e: any) => ({
            id: e.id,
            date: e.expense_date,
            description: e.description || e.invoice_reference || "",
            amount: Number(e.amount || 0),
            type: "depense",
            category: e.category || "",
            supplier: (e as any).supplier || "",
            invoice_reference: (e as any).invoice_reference || "",
            document_path: (e as any).document_path || null,
          }))
        const { data: praw } = await http.get(
          `/api/management/departments/${depId}/projects/${project.id}/payments/`,
        )
        const plist = praw?.results || praw || []
        const mappedPayments: Transaction[] = (Array.isArray(plist) ? plist : [])
          .map((p: any) => ({
            id: p.id,
            date: p.payment_received_date,
            description: p.description || p.payment_reference || "",
            amount: Number(p.amount || 0),
            type: "encaissement",
            category: p.payment_type || "",
            supplier: "",
            invoice_reference: (p as any).payment_reference || "",
            document_path: null,
          }))
        setTransactions([...mappedExpenses, ...mappedPayments])
        if (kind === "encaissement") {
          showFlash(`${t("dashboard.models.paymentreceived")}: ${t("messages.deleteSuccess")}`)
        } else {
          showFlash(`${t("dashboard.models.expense")}: ${t("messages.deleteSuccess")}`)
        }
      } catch (err) {
        console.error("Failed to delete expense:", err)
        alert(t("projectView.errors.deleteExpense"))
      }
    })()
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // upload contract document to project via PATCH
      ;(async () => {
        try {
          if (!project.id || !depId) throw new Error("Project context missing")
          const fd = new FormData()
          fd.append("contract_documents", file)
          // let axios/browser set Content-Type
          await http.patch(
            `/api/management/departments/${depId}/projects/${project.id}/`,
            fd,
          )
          // refresh documents
          const { data } = await http.get(`/api/management/departments/${depId}/projects/${project.id}/`)
          const docs: Document[] = []
          if (data?.contract_documents) {
            docs.push({
              id: -1,
              name: data.contract_documents.split("/").pop() || "contract",
              type: (data.contract_documents.split(".").pop() || "pdf").toUpperCase(),
              size: "-",
              uploadDate: "-",
              url: data.contract_documents,
            })
          }
          setDocuments(docs)
        } catch (err) {
          console.error("Failed to upload document:", err)
          alert(t("projectView.errors.uploadDocument"))
        }
      })()
    }
  }

  const handleDeleteDocument = async (doc: Document) => {
    if (!project.id || !depId) return
    // If it's the contract document (id === -1), clear it via PATCH
    try {
      if (doc.id === -1) {
        // send FormData with empty value to clear the file
        const fd = new FormData()
        // Some DRF setups accept an empty string to clear file fields
        fd.append("contract_documents", "")
        await http.patch(
          `/api/management/departments/${depId}/projects/${project.id}/`,
          fd,
        )
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
        return
      }

      // Otherwise, it may be a step proof; delete the step resource's file by PATCH-ing the step
      // Attempt to clear the step's execution_proof
      await http.patch(
        `/api/management/departments/${depId}/projects/${project.id}/steps/${doc.id}/`,
        { execution_proof: null },
      )
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (err) {
      console.error("Failed to delete document:", err)
      alert(t("projectView.errors.deleteDocument"))
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "edit":
        return (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">{t("form.project.edit")}</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">{t("projects.name")}</Label>
                <Input
                  id="name"
                  value={editedProject.name}
                  onChange={(e) => setEditedProject({ ...editedProject, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="coordinator">{t("projects.coordinator")}</Label>
                  <Input
                    id="coordinator"
                    value={editedProject.coordinator}
                    onChange={(e) => setEditedProject({ ...editedProject, coordinator: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="client">{t("projects.client")}</Label>
                  <Input
                    id="client"
                    value={editedProject.client || ""}
                    onChange={(e) => setEditedProject({ ...editedProject, client: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">{t("expenses.startDate")}</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={editedProject.startDate}
                    onChange={(e) => setEditedProject({ ...editedProject, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">{t("expenses.endDate")}</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={editedProject.endDate}
                    onChange={(e) => setEditedProject({ ...editedProject, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="totalBudget">{t("projects.totalBudget")}</Label>
                <Input
                  id="totalBudget"
                  type="number"
                  value={editedProject.totalBudget}
                  onChange={(e) =>
                    setEditedProject({ ...editedProject, totalBudget: Number.parseFloat(e.target.value) })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit}>{t("common.save")}</Button>
                <Button  onClick={() => setActiveTab("details")}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          </Card>
        )

      case "encaissements":
        const encaissements = transactions.filter((t) => t.type === "encaissement")
        const totalEncaissements = encaissements.reduce((sum, t) => sum + t.amount, 0)

        return (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t("projectView.revenues.title")}</h3>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t("projectView.revenues.total")}</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalEncaissements)}</p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-3">{t("projectView.revenues.addTitle")}</h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <Input
                  placeholder={t("projectView.revenues.description")}
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                />
                <Input
                  placeholder={t("projectView.revenues.amount")}
                  type="number"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                />
                <Select
                  value={newTransaction.category}
                  onValueChange={(v) => setNewTransaction({ ...newTransaction, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("revenues.paymentType")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bank Transfer">{t("revenues.bankTransfer")}</SelectItem>
                    <SelectItem value="Check">{t("revenues.check")}</SelectItem>
                    <SelectItem value="Cash">{t("revenues.cash")}</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={t("revenues.reference")}
                  value={newTransaction.reference}
                  onChange={(e) => setNewTransaction({ ...newTransaction, reference: e.target.value })}
                />
                <Button
                  onClick={() => {
                    handleAddTransaction("encaissement")
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("projectView.revenues.add")}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {encaissements.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {transaction.date} • {transaction.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-green-600">+{formatCurrency(transaction.amount)}</span>
                    <Button size="sm" className="text-red-600" onClick={() => handleDeleteTransaction(transaction.id, "encaissement")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )

      case "jalons":
        return (
          <JalonManagement 
            projectId={project.id!}
            departmentId={depId!}
            projectEndDate={editedProject.endDate}
            projectName={project.name}
            projectDescription={project.description}
            onUpdate={() => {
              // Refresh project data if needed
              console.log("Jalons updated")
            }}
          />
        )

      case "depenses":
        const depenses = transactions.filter((t) => t.type === "depense")
        const totalDepenses = depenses.reduce((sum, t) => sum + t.amount, 0)

        return (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t("projectView.expenses.title")}</h3>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{t("projectView.expenses.total")}</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalDepenses)}</p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-3">{t("projectView.expenses.addTitle")}</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  placeholder={t("projectView.expenses.description")}
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                />
                <Input
                  placeholder={t("projectView.expenses.amount")}
                  type="number"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                />
                <Select
                  value={newTransaction.category}
                  onValueChange={(v) => setNewTransaction({ ...newTransaction, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("projectView.expenses.category")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Personnel">{t("expenses.categories.personnel")}</SelectItem>
                    <SelectItem value="Equipment">{t("expenses.categories.equipment")}</SelectItem>
                    <SelectItem value="Subcontracting">{t("expenses.categories.subcontracting")}</SelectItem>
                    <SelectItem value="Mobility">{t("expenses.categories.mobility")}</SelectItem>
                    <SelectItem value="Material">{t("expenses.categories.material")}</SelectItem>
                    <SelectItem value="Consumables">{t("expenses.categories.consumables")}</SelectItem>
                    <SelectItem value="Other">{t("expenses.categories.other")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    handleAddTransaction("depense")
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("projectView.expenses.add")}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {loadingExpenses ? (
                <p className="text-muted-foreground">{t("projectView.expenses.loading")}</p>
              ) : depenses.length === 0 ? (
                <p className="text-muted-foreground">{t("projectView.expenses.none")}</p>
              ) : (
                depenses.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{transaction.description || "-"}</p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.date} • {transaction.category || "-"}
                      </p>
                      {transaction.supplier && (
                        <p className="text-xs text-muted-foreground">{t("projectView.expenses.supplier")}: {transaction.supplier}</p>
                      )}
                      {transaction.invoice_reference && (
                        <p className="text-xs text-muted-foreground">{t("projectView.expenses.invoiceReference")}: {transaction.invoice_reference}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-2">
                        <div className="font-semibold text-red-600">-{formatCurrency(transaction.amount)}</div>
                      </div>
                      {transaction.document_path ? (
                        <Button size="sm" className="mr-2" onClick={() => window.open(transaction.document_path || "", "_blank") }>
                          <FileText className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button size="sm" className="text-red-600" onClick={() => handleDeleteTransaction(transaction.id, "depense")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )

      case "documents":
        return (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t("projectView.documents.title")}</h3>
              <div>
                <input type="file" id="file-upload" className="hidden" onChange={handleFileUpload} />
                <Button onClick={() => document.getElementById("file-upload")?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("projectView.documents.upload")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingDocuments ? (
                <p className="text-muted-foreground col-span-3">{t("projectView.documents.loading")}</p>
              ) : documents.length === 0 ? (
                <p className="text-muted-foreground col-span-3">{t("projectView.documents.none")}</p>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow bg-card">
                    <div className="flex items-start justify-between mb-2">
                      <FileText className="h-8 w-8 text-blue-500" />
                      <Badge variant="secondary">{doc.type}</Badge>
                    </div>
                    <h4 className="font-medium text-sm mb-1 truncate">{doc.name}</h4>
                    <p className="text-xs text-muted-foreground mb-2">{doc.size}</p>
                    <p className="text-xs text-muted-foreground mb-3">{doc.uploadDate ? new Date(doc.uploadDate).toLocaleDateString("fr-FR") : ""}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-transparent"
                        onClick={() => doc.url && window.open(doc.url, "_blank")}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {t("projectView.documents.view")}
                      </Button>
                      <Button size="sm" onClick={() => doc.url && window.open(doc.url, "_blank") }>
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button size="sm" className="text-red-600" onClick={() => handleDeleteDocument(doc)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )

      default:
        return <></>
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="relative bg-card text-card-foreground rounded-xl shadow-lg w-[95%] md:w-[900px] max-h-[90vh] overflow-y-auto border"
      >
        {flash ? (
          <div
            className={
              "pointer-events-none absolute top-3 right-3 z-[60] px-3 py-2 rounded-md shadow text-white text-sm " +
              (flash.type === "error" ? "bg-red-600" : flash.type === "info" ? "bg-blue-600" : "bg-green-600")
            }
            role="status"
            aria-live="polite"
          >
            {flash.text}
          </div>
        ) : null}
        {/* Hidden print layout removed; export is drawn directly with jsPDF */}
  <div className="bg-card rounded-t-xl p-6 pr-14 border-b">
          <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-foreground">{editedProject.name}</h1>
            <div className="flex gap-2">
              <Button size="sm">
                <Eye className="h-4 w-4 mr-2" />
                {statusLabel(editedProject.status)}
              </Button>
              <Button size="sm" onClick={() => handleUpdateStatus("Completed")} disabled={updatingStatus}>
                <CheckCircle className="h-4 w-4 mr-2" />
                {tt("projectView.actions.finish", "Mark as finished")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleUpdateStatus("Paused")} disabled={updatingStatus}>
                <PauseCircle className="h-4 w-4 mr-2" />
                {tt("projectView.actions.pause", "Pause project")}
              </Button>
              {(editedProject.status === "Completed" || editedProject.status === "Paused") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus("In Progress")}
                  disabled={updatingStatus}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {tt("projectView.actions.resume", "Resume project")}
                </Button>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-6">{project.code}</p>

          {/* Project Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <div className="p-2 bg-primary/20 rounded-full">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">{t("projectView.header.coordinator")}</p>
                <p className="font-medium text-foreground">{editedProject.coordinator}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <div className="p-2 bg-primary/20 rounded-full">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">{t("projectView.header.department")}</p>
                <p className="font-medium text-foreground">{project.department}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <div className="p-2 bg-primary/20 rounded-full">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">{t("projectView.header.period")}</p>
                <p className="font-medium text-foreground">
                  {editedProject.startDate} - {editedProject.endDate}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <div className="p-2 bg-primary/20 rounded-full">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">{t("projectView.header.client")}</p>
                <p className="font-medium text-foreground">{editedProject.client}</p>
              </div>
            </div>
          </div>

          {/* Status Bar (dynamic days left) */}
          {(() => {
            let daysLeft: number | null = null
            if (editedProject.endDate) {
              try {
                const end = new Date(editedProject.endDate)
                const now = new Date()
                const diffMs = end.getTime() - now.getTime()
                daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
              } catch {}
            }
            const overdue = typeof daysLeft === "number" && daysLeft < 0
            const msg = (() => {
              if (typeof daysLeft !== "number") {
                return language === "fr" ? "Date de fin non définie." : "No end date defined."
              }
              if (overdue) {
                const d = Math.abs(daysLeft)
                return language === "fr"
                  ? `Le projet a dépassé la date de fin de ${d} jour${d > 1 ? "s" : ""}.`
                  : `The project is past its end date by ${d} day${d > 1 ? "s" : ""}.`
              }
              const d = daysLeft
              return language === "fr"
                ? `Il reste ${d} jour${d > 1 ? "s" : ""} avant la fin prévue du projet.`
                : `${d} day${d > 1 ? "s" : ""} remaining before the planned end.`
            })()
            return (
              <div className={(overdue ? "bg-red-500/10 border-red-500/30" : "bg-green-500/10 border-green-500/30") + " border rounded-lg p-3 mb-6"}>
                <div className="flex items-center space-x-2">
                  <CheckCircle className={"h-5 w-5 " + (overdue ? "text-red-500" : "text-green-500")} />
                  <span className={(overdue ? "text-red-400" : "text-green-400") + " font-medium"}>{msg}</span>
                </div>
              </div>
            )
          })()}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              
              size="sm"
              onClick={() => setActiveTab("details")}
            >
              <Eye className="h-4 w-4 mr-2" />
              {t("projectView.tabs.details")}
            </Button>
            <Button
             
              size="sm"
              onClick={() => setActiveTab("edit")}
            >
              <Edit className="h-4 w-4 mr-2" />
              {t("projectView.tabs.edit")}
            </Button>
            <Button
              
              size="sm"
              onClick={() => setActiveTab("jalons")}
            >
              <Calendar className="h-4 w-4 mr-2" />
              {t("projectView.tabs.milestones")}
            </Button>
            <Button
              
              size="sm"
              onClick={() => setActiveTab("encaissements")}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {t("projectView.tabs.revenues")}
            </Button>
            <Button
             
              size="sm"
              onClick={() => setActiveTab("depenses")}
            >
              <FileText className="h-4 w-4 mr-2" />
              {t("projectView.tabs.expenses")}
            </Button>
            <Button
    
              size="sm"
              onClick={() => setActiveTab("documents")}
            >
              <FileText className="h-4 w-4 mr-2" />
              {t("projectView.tabs.documents")}
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {activeTab === "details" ? (
            <>
              <Card className="p-6">
                <div className="text-center mb-6">
                  <h2 className="text-lg font-semibold text-muted-foreground mb-2">{t("projectView.budget.total")}</h2>
                  <div className="text-3xl font-bold text-primary mb-4">{formatCurrency(totalBudgetNum)}</div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">{t("projectView.budget.spent")}</p>
                      <p className="font-semibold">{formatCurrency(spentBudget)}</p>
                      <p className="text-xs text-muted-foreground">{spentPct.toFixed(2)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">{t("projectView.budget.engaged")}</p>
                      <p className="font-semibold">{formatCurrency(engagedBudget)}</p>
                      <p className="text-xs text-muted-foreground">{engagedPct.toFixed(2)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">{t("projectView.budget.available")}</p>
                      <p className="font-semibold">{formatCurrency(derivedRemaining)}</p>
                      <p className="text-xs text-muted-foreground">{availablePct.toFixed(2)}%</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{t("projectView.budget.spentBudget")}</span>
                    </div>
                    <Progress value={spentPct} className="h-2" />

                    <div className="flex justify-between text-sm">
                      <span>{t("projectView.budget.engagedBudget")}</span>
                    </div>
                    <Progress value={engagedPct} className="h-2" />
                  </div>
                </div>
              </Card>

              {project.budgetVentilation && project.budgetVentilation.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">{t("projectView.budget.breakdown")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {project.budgetVentilation.map((item, idx) => {
                      const colorClasses: Record<string, string> = {
                        green: "border-border bg-muted",
                        blue: "border-border bg-muted",
                        purple: "border-border bg-muted",
                        orange: "border-border bg-muted",
                        red: "border-border bg-muted",
                        gray: "border-border bg-muted",
                      }

                      const dotColors: Record<string, string> = {
                        green: "bg-green-500",
                        blue: "bg-blue-500",
                        purple: "bg-purple-500",
                        orange: "bg-orange-500",
                        red: "bg-red-500",
                        gray: "bg-gray-500",
                      }

                      return (
                        <div
                          key={idx}
                          className={`border rounded-lg p-4 ${colorClasses[item?.color || "gray"] || colorClasses.gray}`}
                        >
                          <div className="flex items-center space-x-2 mb-2">
                            <div
                              className={`w-3 h-3 rounded-full ${dotColors[item?.color || "gray"] || dotColors.gray}`}
                            ></div>
                            <span className="text-sm font-medium">{item.label}</span>
                          </div>
                          <p className="text-lg font-bold">{formatCurrency(item.amount)}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.amount > 0 ? `${((item.amount / totalBudgetNum) * 100).toFixed(0)}%` : "—%"}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {project.timeline && project.timeline.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">{t("projectView.timeline.title")}</h3>
                  <div className="flex flex-wrap gap-4 justify-center">
                    {project.timeline.map((step, index) => (
                      <div key={index} className="flex flex-col items-center space-y-2 min-w-[100px]">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            step.completed ? "bg-primary/20" : "bg-muted"
                          }`}
                        >
                          <User className={`h-6 w-6 ${step.completed ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-medium text-foreground">{step.step}</p>
                          <p className="text-xs text-muted-foreground">{step.date || "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">{t("projectView.milestones.title")}</h3>
                {loadingSteps ? (
                  <p className="text-muted-foreground">{t("projectView.milestones.loading")}</p>
                ) : projectSteps.length > 0 ? (
                  <div className="space-y-4">
                    {projectSteps.map((step, index) => (
                      <div key={step.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-foreground">{step.name}</h4>
                          <Badge variant={step.execution_status ? "default" : "secondary"}>
                            {step.execution_status ? t("projectView.milestones.completed") : t("projectView.milestones.inProgress")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{step.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{t("projectView.milestones.start")}: {new Date(step.start_date).toLocaleDateString("fr-FR")}</span>
                          <span>{t("projectView.milestones.end")}: {new Date(step.end_date).toLocaleDateString("fr-FR")}</span>
                        </div>
                        {step.execution_proof && (
                          <div className="mt-2">
                            <Button size="sm">
                              <FileText className="h-4 w-4 mr-2" />
                              {t("projectView.milestones.viewProof")}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t("projectView.milestones.none")}</p>
                )}
              </Card>
            </>
          ) : (
            renderTabContent()
          )}

          {/* Footer actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex gap-2">
              <Badge variant="secondary">{t("projectView.footer.view")}</Badge>
              <Badge>{t("projectView.footer.project")} #{project.code}</Badge>
            </div>
            <Button onClick={() => handleDownloadPDF(project)} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              {t("projectView.footer.downloadPdf")}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
