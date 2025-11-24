"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// Removed custom Calendar/Popover in favor of native inputs
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Plus, Upload, ChevronDown, ChevronRight, Info, Calendar, Clock, Trash2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { http, getResults } from "@/lib/http"
import { useLanguage } from "@/lib/language-context"

interface NewProjectFormProps {
  children: React.ReactNode
  onCreated?: () => void
}

const timelineIndexes = Array.from({ length: 11 }, (_, i) => i)

export function NewProjectForm({ children, onCreated }: NewProjectFormProps) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [showDates, setShowDates] = useState(false)
  const [expandedSteps, setExpandedSteps] = useState<number[]>([])
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    department: "",
    coordinator: "",
    coordinatorUserId: "",
    nature: "",
    clientId: "",
    supplierId: "",
    totalBudget: "",
    budgetBreakdown: {
      personnel: "",
      equipment: "",
      subcontracting: "",
      material: "",
      consumables: "",
      other: "",
    },
    timeline: {} as Record<number, Date | undefined>,
    description: "",
    objective: "",
    problems: "",
    stakeholders: [] as string[],
    milestones: [] as string[],
    contractFile: null as File | null,
  })
  const [departments, setDepartments] = useState<any[]>([])
  const [managers, setManagers] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [clientQuery, setClientQuery] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [needsExpressionDate, setNeedsExpressionDate] = useState<Date | undefined>(undefined)
  const [clientPoDate, setClientPoDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [steps, setSteps] = useState<
    Array<{
      name: string
      description: string
      startDate: Date | undefined
      endDate: Date | undefined
    }>
  >([{ name: "", description: "", startDate: undefined, endDate: undefined }])

  const toInput = (d?: Date) => {
    if (!d) return ""
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
  const fromInput = (v: string) => {
    if (!v) return undefined
    const [y, m, day] = v.split("-").map((n) => Number.parseInt(n, 10))
    return new Date(y, (m || 1) - 1, day || 1)
  }
  // Synchronize timeline with required dates when dialog opens
  useEffect(() => {
    if (open) {
      const today = new Date()
      const defaultNeedsExpressionDate = today
      const defaultClientPoDate = today
      const defaultEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30)

      setNeedsExpressionDate((prev) => prev ?? defaultNeedsExpressionDate)
      setClientPoDate((prev) => prev ?? defaultClientPoDate)
      setEndDate((prev) => prev ?? defaultEndDate)

      setFormData((prev) => ({
        ...prev,
        timeline: {
          ...prev.timeline,
          0: prev.timeline[0] ?? defaultNeedsExpressionDate,
          1: prev.timeline[1] ?? defaultClientPoDate,
          10: prev.timeline[10] ?? defaultEndDate,
        },
      }))
    }
  }, [open])

  // Update timeline when individual date states change
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        0: needsExpressionDate,
        1: clientPoDate,
        10: endDate,
      },
    }))
  }, [needsExpressionDate, clientPoDate, endDate])

  // Load master data (clients only) when dialog opens
  useEffect(() => {
    if (!open) return
    const loadMaster = async () => {
      try {
        const cRes = await http.get(`/api/management/clients/`, { params: { page_size: 50 } })
        setClients(getResults(cRes.data))
      } catch {}
    }
    loadMaster()
  }, [open])

  useEffect(() => {
    const loadDeps = async () => {
      try {
        const allowed = new Set(["CIE Direct", "Tech Center", "TTO", "Clinique Industrielle"])
        if (user?.role === "director") {
          // Fetch ALL departments for directors
          const { data: raw } = await http.get(`/api/management/departments/`)
          {
            const arr = Array.isArray((raw as any)?.results || raw) ? (raw as any).results || raw : []
            setDepartments(arr)
            setFormData((prev) =>
              !prev.department && arr.length > 0 ? { ...prev, department: String(arr[0].id) } : prev,
            )
          }
          // Director: leave coordinator empty to force explicit selection or backend mapping via coordinator_user_id
          return
        }

        // Helper: resolve current user's department id when shape is either id, string, or nested object
        const resolveDepId = (depVal: any): number | null => {
          if (depVal == null) return null
          if (typeof depVal === "number") return depVal
          if (typeof depVal === "string") {
            const n = Number(depVal)
            if (Number.isFinite(n)) return n
            try {
              const maybeObj = JSON.parse(depVal)
              if (maybeObj && typeof maybeObj === "object" && typeof maybeObj.id === "number") return maybeObj.id
            } catch {}
            return null
          }
          if (typeof depVal === "object" && typeof depVal.id === "number") return depVal.id
          return null
        }

        const managerDepId = user?.role === "department_manager" ? resolveDepId((user as any).department) : null
        if (user?.role === "department_manager" && managerDepId) {
          const { data: dep } = await http.get(`/api/management/departments/${managerDepId}/`)
            if (allowed.has(dep.name)) {
              setDepartments([dep])
              // Auto-assign coordinator to the manager themselves if blank
              setFormData((prev) => ({
                ...prev,
                department: String(dep.id),
                // Use email as stable identifier fallback
                coordinator: prev.coordinator || (user?.email || "")
              }))
            } else {
              setDepartments([])
            }
          return
        }
        const { data: raw2 } = await http.get(`/api/management/departments/`)
        {
          const arr = Array.isArray((raw2 as any)?.results || raw2) ? (raw2 as any).results || raw2 : []
          const data = user?.role === "director" ? arr : arr.filter((d: any) => allowed.has(d.name))
          setDepartments(data)
          setFormData((prev) =>
            !prev.department && data.length > 0 ? { ...prev, department: String(data[0].id) } : prev,
          )
        }
      } catch (e) {
        // ignore
      }
    }
    loadDeps()
  }, [user])

  // When a director selects a department, fetch its managers to choose the coordinator from
  useEffect(() => {
    const fetchManagers = async () => {
      if (user?.role !== "director") return
      if (!formData.department) return
      try {
        const { data: raw } = await http.get(`/api/management/departments/${formData.department}/managers/`)
        const list = Array.isArray((raw as any)?.results || raw) ? (raw as any).results || raw : []
        setManagers(list)
        // Reset selection when department changes
        setFormData((prev) => ({ ...prev, coordinatorUserId: "", coordinator: "" }))
      } catch (e) {
        setManagers([])
      }
    }
    fetchManagers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.department, user?.role])

  const toggleStep = (stepIndex: number) => {
    setExpandedSteps((prev) => (prev.includes(stepIndex) ? prev.filter((i) => i !== stepIndex) : [...prev, stepIndex]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsSubmitting(true)
    try {
      let departmentId: number | null = null
      if (user.role === "department_manager" && (user as any).department) {
        const depVal: any = (user as any).department
        if (typeof depVal === "number") departmentId = depVal
        else if (typeof depVal === "object" && typeof depVal.id === "number") departmentId = depVal.id
        else if (typeof depVal === "string") {
          const n = Number(depVal)
          if (Number.isFinite(n)) departmentId = n
        }
      } else if (user.role === "director") {
        departmentId = Number(formData.department || 0)
      }
      if (!departmentId) {
        throw new Error(t("form.project.departmentNotFound"))
      }
      if (!formData.clientId) {
        throw new Error(t("form.project.selectClient"))
      }
      // No main supplier on project; only client is required

      const fd = new FormData()
      fd.append("project_code", formData.code)
      fd.append("project_name", formData.name)
      // Coordinator logic aligned with rule: Coordinators are department managers
      if (user.role === "director") {
        // Directors must pick a manager from the selected department
        if (!formData.coordinatorUserId) {
          throw new Error(t("form.project.selectCoordinator"))
        }
        fd.append("coordinator_user_id", formData.coordinatorUserId)
      } else {
        // Department manager: default to self if blank
        let coordinatorValue = formData.coordinator.trim()
        if (!coordinatorValue) {
          coordinatorValue = user.email || "Manager"
        }
        fd.append("coordinator", coordinatorValue)
      }
      fd.append("project_nature", formData.nature)
      const toDate = (d?: Date) => (d ? d.toISOString().slice(0, 10) : "")
      const needsExprStr = toDate(formData.timeline[0])
      const clientPoStr = toDate(formData.timeline[1])
      const endDateStr = toDate(formData.timeline[10])
      if (!needsExprStr || !clientPoStr || !endDateStr) {
        throw new Error(t("form.project.requiredDatesError"))
      }
      fd.append("needs_expression_date", needsExprStr)
      fd.append("client_po_date", clientPoStr)
      fd.append("end_date", endDateStr)
        fd.append("total_budget", String(Number(formData.totalBudget || 0)))
        // Map budget breakdown to backend field names
        fd.append("personnel_budget", String(Number(formData.budgetBreakdown.personnel || 0)))
        fd.append("equipment_budget", String(Number(formData.budgetBreakdown.equipment || 0)))
        fd.append("subcontracting_budget", String(Number(formData.budgetBreakdown.subcontracting || 0)))
        // "material" maps to mobility_budget in the backend
        fd.append("mobility_budget", String(Number(formData.budgetBreakdown.material || 0)))
        fd.append("consumables_budget", String(Number(formData.budgetBreakdown.consumables || 0)))
        fd.append("other_budget", String(Number(formData.budgetBreakdown.other || 0)))
      fd.append("description", formData.description)
      fd.append("objective", formData.objective)
      fd.append("partners", "")
      fd.append("risks", formData.problems)
      const optionalDates: Array<[keyof typeof formData.timeline, string]> = [
        [2 as any, "signature_date"],
        [3 as any, "cg_validation_date"],
        [4 as any, "da_creation_date"],
        [5 as any, "purchase_request_date"],
        [6 as any, "uir_po_send_date"],
        [7 as any, "uir_delivery_date"],
        [8 as any, "invoicing_date"],
        [9 as any, "payment_received_date"],
      ]
      optionalDates.forEach(([idx, field]) => {
        const d = formData.timeline[idx as number]
        const s = toDate(d)
        if (s) fd.append(field, s)
      })
      // contract_documents is optional on the backend; append only if present
      if (formData.contractFile) {
        fd.append("contract_documents", formData.contractFile)
      }

      // Master references (client required)
      fd.append("client", formData.clientId)
      // Removed main_supplier from project

      // Don't set Content-Type manually for FormData — let the browser set the boundary
      await http.post(`/api/management/departments/${departmentId}/projects/create/`, fd)
      // Try to locate created project id via project_code
      let createdProjectId: number | null = null
      try {
        const { data: projs } = await http.get(`/api/management/departments/${departmentId}/projects/`)
        const list = Array.isArray(projs) ? projs : (Array.isArray(projs?.results) ? projs.results : [])
        const found = list.find((p: any) => String(p.project_code) === String(formData.code))
        if (found?.id) createdProjectId = Number(found.id)
      } catch {}

      // Create steps (jalons) if provided
      if (createdProjectId) {
        const validSteps = steps.filter((s) => s.name || s.description)
        for (const s of validSteps) {
          const fdStep = new FormData()
          fdStep.append("name", s.name)
          fdStep.append("description", s.description)
          const startDate = s.startDate ? s.startDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
          const endDate = s.endDate
            ? s.endDate.toISOString().slice(0, 10)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
          fdStep.append("start_date", startDate)
          fdStep.append("end_date", endDate)
            try {
              // allow browser to set Content-Type for FormData
              await http.post(`/api/management/departments/${departmentId}/projects/${createdProjectId}/steps/create/`, fdStep)
            } catch (stepErr) {
              console.warn("Failed to create step:", stepErr)
            }
        }
      }

      setOpen(false)
      onCreated?.()
    } catch (err) {
      console.error(err)
      alert(String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Plus className="h-4 w-4 text-primary-foreground" />
            </div>
            <DialogTitle className="text-xl font-semibold">{t("form.project.title")}</DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("form.project.generalInfo")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">{t("form.project.code")}</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("form.project.name")}</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  {user?.role !== "department_manager" && (
                    <div className="space-y-2">
                      <Label htmlFor="department">{t("form.project.department")}</Label>
                      <Select
                        value={formData.department}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, department: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("form.project.selectDepartment")} />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {user?.role === "director" && (
                    <div className="space-y-2">
                      <Label htmlFor="coordinator">{t("form.project.coordinator")}</Label>
                      <Select
                        value={formData.coordinatorUserId}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, coordinatorUserId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("form.project.selectCoordinator")} />
                        </SelectTrigger>
                        <SelectContent>
                          {managers.length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              {t("form.project.selectCoordinator")}
                            </div>
                          )}
                          {managers.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>
                              {m.first_name || m.last_name ? `${m.first_name || ""} ${m.last_name || ""}`.trim() : m.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {/* Client master select */}
                  <div className="space-y-2">
                    <Label htmlFor="clientMaster">{t("form.project.client")} (master)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder={t("common.search")}
                        value={clientQuery}
                        onChange={(e) => setClientQuery(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const { data } = await http.get(`/api/management/clients/`, { params: { q: clientQuery, page_size: 50 } })
                            setClients(getResults(data))
                          } catch {}
                        }}
                      >
                        {t("common.search")}
                      </Button>
                    </div>
                    <Select
                      value={formData.clientId}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, clientId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("form.project.selectClient")} />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name} ({c.registration_number})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nature">{t("form.project.nature")}</Label>
                    <Select
                      value={formData.nature}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, nature: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("form.project.selectNature")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Purchase Order">Purchase Order</SelectItem>
                        <SelectItem value="Contract">Contract</SelectItem>
                        <SelectItem value="Agreement">Agreement</SelectItem>
                        <SelectItem value="Grant">Grant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Removed supplier selection from project creation */}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("form.project.budget")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="totalBudget">{t("form.project.totalBudget")}</Label>
                  <Input
                    id="totalBudget"
                    type="number"
                    step="0.01"
                    value={formData.totalBudget}
                    onChange={(e) => setFormData((prev) => ({ ...prev, totalBudget: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-medium">{t("form.project.budgetBreakdown")}</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="personnel" className="text-sm">
                        {t("form.project.personnel")}
                      </Label>
                      <Input
                        id="personnel"
                        type="number"
                        step="0.01"
                        value={formData.budgetBreakdown.personnel}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            budgetBreakdown: { ...prev.budgetBreakdown, personnel: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="equipment" className="text-sm">
                        {t("form.project.equipment")}
                      </Label>
                      <Input
                        id="equipment"
                        type="number"
                        step="0.01"
                        value={formData.budgetBreakdown.equipment}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            budgetBreakdown: { ...prev.budgetBreakdown, equipment: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subcontracting" className="text-sm">
                        {t("form.project.subcontracting")}
                      </Label>
                      <Input
                        id="subcontracting"
                        type="number"
                        step="0.01"
                        value={formData.budgetBreakdown.subcontracting}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            budgetBreakdown: { ...prev.budgetBreakdown, subcontracting: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="material" className="text-sm">
                        {t("form.project.material")}
                      </Label>
                      <Input
                        id="material"
                        type="number"
                        step="0.01"
                        value={formData.budgetBreakdown.material}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            budgetBreakdown: { ...prev.budgetBreakdown, material: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="consumables" className="text-sm">
                        {t("form.project.consumables")}
                      </Label>
                      <Input
                        id="consumables"
                        type="number"
                        step="0.01"
                        value={formData.budgetBreakdown.consumables}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            budgetBreakdown: { ...prev.budgetBreakdown, consumables: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="other" className="text-sm">
                        {t("form.project.other")}
                      </Label>
                      <Input
                        id="other"
                        type="number"
                        step="0.01"
                        value={formData.budgetBreakdown.other}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            budgetBreakdown: { ...prev.budgetBreakdown, other: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowDates((v) => !v)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  {showDates ? t("form.project.hideDates") : t("form.project.setDates")}
                </Button>
              </div>

              {showDates && (
              <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {t("form.project.timeline")}
                  <Info className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="mb-2 block">{t("form.project.needsApproval")}*</Label>
                    <Input
                      type="date"
                      value={toInput(formData.timeline[0])}
                      onChange={(e) => {
                        const d = fromInput(e.target.value)
                        setNeedsExpressionDate(d)
                        setFormData((prev) => ({ ...prev, timeline: { ...prev.timeline, 0: d } }))
                      }}
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">{t("form.project.clientPO")}*</Label>
                    <Input
                      type="date"
                      value={toInput(formData.timeline[1])}
                      onChange={(e) => {
                        const d = fromInput(e.target.value)
                        setClientPoDate(d)
                        setFormData((prev) => ({ ...prev, timeline: { ...prev.timeline, 1: d } }))
                      }}
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">{t("form.project.endDate")}*</Label>
                    <Input
                      type="date"
                      value={toInput(formData.timeline[10])}
                      onChange={(e) => {
                        const d = fromInput(e.target.value)
                        setEndDate(d)
                        setFormData((prev) => ({ ...prev, timeline: { ...prev.timeline, 10: d } }))
                      }}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{t("form.project.timelineInfo")}</p>
                {timelineIndexes.filter((i) => ![0, 1, 10].includes(i)).map((index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{t(`form.project.timelineSteps.${index}`)}</h4>
                      </div>
                      <Input
                        type="date"
                        value={toInput(formData.timeline[index])}
                        onChange={(e) => {
                          const d = fromInput(e.target.value)
                          setFormData((prev) => ({ ...prev, timeline: { ...prev.timeline, [index]: d } }))
                        }}
                        className="w-[180px]"
                      />
                      <Button type="button" variant="ghost" size="sm" onClick={() => toggleStep(index)}>
                        {expandedSteps.includes(index) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {expandedSteps.includes(index) && (
                      <div className="mt-3 pl-11">
                        <Textarea placeholder={t("form.project.timelineNotePlaceholder")} className="min-h-[60px]" />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
              </Card>
              )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("form.project.description")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">{t("form.project.descriptionLabel")}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    className="min-h-[100px]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="objective">{t("form.project.objective")}</Label>
                  <Textarea
                    id="objective"
                    value={formData.objective}
                    onChange={(e) => setFormData((prev) => ({ ...prev, objective: e.target.value }))}
                    className="min-h-[100px]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="problems">{t("form.project.problems")}</Label>
                  <Textarea
                    id="problems"
                    value={formData.problems}
                    onChange={(e) => setFormData((prev) => ({ ...prev, problems: e.target.value }))}
                    className="min-h-[100px]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("form.project.stakeholders")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Label>{t("form.project.stakeholders")}</Label>
                  <div className="flex gap-2">
                    <Input placeholder={t("form.project.stakeholderName")} />
                    <Button type="button" size="sm">
                      <Plus className="h-4 w-4" />
                      {t("form.project.addStakeholder")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t("form.project.milestones")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-2">{t("form.project.milestonesDesc")}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {steps.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">{t("form.project.milestonesDefined")}: {steps.length}</span>
                      </div>
                      <span className="text-xs text-blue-600">
                        {steps.filter(s => s.name && s.description).length} {t("form.project.milestonesValid")}
                      </span>
                    </div>
                  )}
                  
                  {steps.map((st, idx) => (
                    <Card key={idx} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">{t("form.project.milestone")} #{idx + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            {t("common.delete")}
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">{t("form.project.milestoneName")}</Label>
                            <Input
                              placeholder={`${t("form.project.milestoneNamePlaceholder")} ${idx + 1}`}
                              value={st.name}
                              onChange={(e) =>
                                setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, name: e.target.value } : s)))
                              }
                              className={!st.name ? "border-red-200 focus:border-red-400" : ""}
                            />
                            {!st.name && (
                              <p className="text-xs text-red-600">{t("form.project.milestoneNameRequired")}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">{t("form.project.milestonePriority")}</Label>
                            <Select defaultValue="Medium">
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Low">{t("form.project.priorityLow")}</SelectItem>
                                <SelectItem value="Medium">{t("form.project.priorityMedium")}</SelectItem>
                                <SelectItem value="High">{t("form.project.priorityHigh")}</SelectItem>
                                <SelectItem value="Critical">{t("form.project.priorityCritical")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">{t("form.project.milestoneDescription")}</Label>
                          <Textarea
                            placeholder={t("form.project.milestoneDescPlaceholder")}
                            value={st.description}
                            onChange={(e) =>
                              setSteps((prev) =>
                                prev.map((s, i) => (i === idx ? { ...s, description: e.target.value } : s)),
                              )
                            }
                            className={`min-h-[80px] ${!st.description ? "border-red-200 focus:border-red-400" : ""}`}
                          />
                          {!st.description && (
                            <p className="text-xs text-red-600">{t("form.project.milestoneDescRequired")}</p>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {t("form.project.milestoneStartDate")}
                            </Label>
                            <Input
                              type="date"
                              value={st.startDate ? toInput(st.startDate) : ""}
                              onChange={(e) => {
                                const date = fromInput(e.target.value)
                                setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, startDate: date } : s)))
                              }}
                              min={toInput(formData.timeline[0])}
                            />
                            {!st.startDate && (
                              <p className="text-xs text-gray-500">{t("form.project.milestoneDateHint")}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {t("form.project.milestoneEndDate")}
                            </Label>
                            <Input
                              type="date"
                              value={st.endDate ? toInput(st.endDate) : ""}
                              onChange={(e) => {
                                const date = fromInput(e.target.value)
                                setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, endDate: date } : s)))
                              }}
                              min={st.startDate ? toInput(st.startDate) : toInput(formData.timeline[0])}
                              max={toInput(formData.timeline[10])}
                            />
                            {!st.endDate && (
                              <p className="text-xs text-gray-500">{t("form.project.milestoneDateHint")}</p>
                            )}
                            {formData.timeline[10] && (
                              <p className="text-xs text-gray-500">
                                {t("form.project.milestoneDateLimit")}: {toInput(formData.timeline[10])}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {st.startDate && st.endDate && (
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <Clock className="h-4 w-4" />
                              <span>
                                {t("form.project.milestoneDuration")}: {Math.ceil((st.endDate.getTime() - st.startDate.getTime()) / (1000 * 60 * 60 * 24))} {t("form.project.milestoneDays")}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setSteps((prev) => [
                          ...prev,
                          { name: "", description: "", startDate: undefined, endDate: undefined },
                        ])
                      }
                      className="flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      {t("form.project.addMilestone")}
                    </Button>
                    
                    {steps.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const projectStart = formData.timeline[0]
                          const projectEnd = formData.timeline[10]
                          if (!projectStart || !projectEnd) {
                            alert(t("form.project.generateDatesError"))
                            return
                          }
                          
                          // Auto-generate dates for jalons
                          const duration = projectEnd.getTime() - projectStart.getTime()
                          const stepDuration = duration / steps.length
                          
                          setSteps((prev) => prev.map((step, idx) => ({
                            ...step,
                            startDate: step.startDate || new Date(projectStart.getTime() + (stepDuration * idx)),
                            endDate: step.endDate || new Date(projectStart.getTime() + (stepDuration * (idx + 1)))
                          })))
                        }}
                        className="flex items-center justify-center gap-2"
                      >
                        <Calendar className="h-4 w-4" />
                        {t("form.project.generateDates")}
                      </Button>
                    )}
                  </div>
                  
                  {steps.length === 0 && (
                    <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-lg">
                      <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{t("form.project.noMilestones")}</h3>
                      <p className="text-gray-500 mb-4">{t("form.project.noMilestonesDesc")}</p>
                      <Button
                        type="button"
                        onClick={() =>
                          setSteps([{ name: "", description: "", startDate: undefined, endDate: undefined }])
                        }
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t("form.project.createFirstMilestone")}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("form.project.documents")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Label>{t("form.project.documentsLabel")}</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">{t("form.project.uploadText")}</p>
                    <p className="text-xs text-muted-foreground mb-2">{t("form.project.uploadFormat")}</p>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setFormData((prev) => ({ ...prev, contractFile: e.target.files?.[0] || null }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Separator />

            <div className="flex items-center justify-end gap-3 pt-4">
              <Button type="button" onClick={() => setOpen(false)}>
                {t("form.project.cancel")}
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? t("form.project.saving") : t("form.project.save")}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
