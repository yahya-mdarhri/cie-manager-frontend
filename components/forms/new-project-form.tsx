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
import { http } from "@/lib/http"

interface NewProjectFormProps {
  children: React.ReactNode
  onCreated?: () => void
}

const timelineSteps = [
  "Date d'Approbation de Besoin & Étude Préliminaire",
  "Début du Bon de Commande Client",
  "Date de Signature",
  "Date de Validation du Contrôle de Gestion",
  "Date de la Création de la Demande d'Achat",
  "Demande d'Achat",
  "Date d'Envoi Bon de Commande UB",
  "Date de Livraison UB",
  "Date de Facturation",
  "Date d'Encaissement",
  "Date de fin du projet (définitif)",
]

export function NewProjectForm({ children, onCreated }: NewProjectFormProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [expandedSteps, setExpandedSteps] = useState<number[]>([])
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    department: "",
    coordinator: "",
    nature: "",
    client: "",
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
          
          return
        }

        if (user?.role === "department_manager" && user.department) {
          const { data: dep } = await http.get(`/api/management/departments/${user.department}/`)
            if (allowed.has(dep.name)) {
              setDepartments([dep])
              setFormData((prev) => ({ ...prev, department: String(dep.id) }))
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

  const toggleStep = (stepIndex: number) => {
    setExpandedSteps((prev) => (prev.includes(stepIndex) ? prev.filter((i) => i !== stepIndex) : [...prev, stepIndex]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsSubmitting(true)
    try {
      let departmentId: number | null = null
      if (user.role === "department_manager" && user.department) {
        departmentId = Number(user.department)
      } else if (user.role === "director") {
        departmentId = Number(formData.department || 0)
      }
      if (!departmentId) {
        throw new Error("Département introuvable")
      }

      const fd = new FormData()
      fd.append("project_code", formData.code)
      fd.append("project_name", formData.name)
      fd.append("coordinator", formData.coordinator)
      fd.append("project_nature", formData.nature)
      const toDate = (d?: Date) => (d ? d.toISOString().slice(0, 10) : "")
      const needsExprStr = toDate(formData.timeline[0])
      const clientPoStr = toDate(formData.timeline[1])
      const endDateStr = toDate(formData.timeline[10])
      if (!needsExprStr || !clientPoStr || !endDateStr) {
        throw new Error("Veuillez sélectionner les dates requises (Besoin, PO Client, Fin du projet)")
      }
      fd.append("needs_expression_date", needsExprStr)
      fd.append("client_po_date", clientPoStr)
      fd.append("end_date", endDateStr)
      fd.append("total_budget", String(Number(formData.totalBudget || 0)))
      fd.append("client_name", formData.client)
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
      if (!formData.contractFile) throw new Error("Le document contractuel est requis")
      fd.append("contract_documents", formData.contractFile)

      await http.post(`/api/management/departments/${departmentId}/projects/create/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
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
            await http.post(`/api/management/departments/${departmentId}/projects/${createdProjectId}/steps/create/`, fdStep, {
              headers: { "Content-Type": "multipart/form-data" },
            })
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
            <DialogTitle className="text-xl font-semibold">Nouveau Projet</DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informations Générales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Code Projet*</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom du Projet*</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Département*</Label>
                    <Select
                      value={formData.department}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, department: value }))}
                      disabled={user?.role === "department_manager"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le département" />
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
                  <div className="space-y-2">
                    <Label htmlFor="coordinator">Coordinateur*</Label>
                    <Select
                      value={formData.coordinator}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, coordinator: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner coordinateur" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Omar Jebbouri">Omar Jebbouri</SelectItem>
                        <SelectItem value="Wacim Benyahya">Wacim Benyahya</SelectItem>
                        <SelectItem value="Bertrand Denise">Bertrand Denise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nature">Nature du Projet*</Label>
                    <Select
                      value={formData.nature}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, nature: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner la nature" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Purchase Order">Purchase Order</SelectItem>
                        <SelectItem value="Contract">Contract</SelectItem>
                        <SelectItem value="Agreement">Agreement</SelectItem>
                        <SelectItem value="Grant">Grant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client">Nom du Client*</Label>
                    <Input
                      id="client"
                      value={formData.client}
                      onChange={(e) => setFormData((prev) => ({ ...prev, client: e.target.value }))}
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Budget</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="totalBudget">Budget Total (MAD)*</Label>
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
                  <Label className="text-sm font-medium">Ventilation du Budget (MAD) (Optionnel)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="personnel" className="text-sm">
                        Personnel
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
                        Équipement
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
                        Sous-traitance
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
                        Matériel
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
                        Consommable
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
                        Autre
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

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  Timeline du Projet
                  <Info className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="mb-2 block">Date d'Approbation de Besoin*</Label>
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
                    <Label className="mb-2 block">Date PO Client*</Label>
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
                    <Label className="mb-2 block">Date de fin du projet*</Label>
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
                {timelineSteps.map((step, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{step}</h4>
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
                        <Textarea placeholder="Ajouter des informations sur présente" className="min-h-[60px]" />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Description du Projet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description du projet*</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    className="min-h-[100px]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="objective">Objectif du projet*</Label>
                  <Textarea
                    id="objective"
                    value={formData.objective}
                    onChange={(e) => setFormData((prev) => ({ ...prev, objective: e.target.value }))}
                    className="min-h-[100px]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="problems">Problèmes (optionnel)</Label>
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
                <CardTitle className="text-lg">Parties prenantes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Label>Ajouter les parties prenantes</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Nom de la partie prenante" />
                    <Button type="button" size="sm">
                      <Plus className="h-4 w-4" />
                      Ajouter une partie prenante
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Jalons du Projet
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  Définissez les étapes clés et les livrables de votre projet avec des dates précises.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {steps.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">Jalons définis: {steps.length}</span>
                      </div>
                      <span className="text-xs text-blue-600">
                        {steps.filter(s => s.name && s.description).length} jalon(s) valide(s)
                      </span>
                    </div>
                  )}
                  
                  {steps.map((st, idx) => (
                    <Card key={idx} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">Jalon #{idx + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Supprimer
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Nom du jalon *</Label>
                            <Input
                              placeholder={`Ex: Livraison phase ${idx + 1}`}
                              value={st.name}
                              onChange={(e) =>
                                setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, name: e.target.value } : s)))
                              }
                              className={!st.name ? "border-red-200 focus:border-red-400" : ""}
                            />
                            {!st.name && (
                              <p className="text-xs text-red-600">Le nom du jalon est requis</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Priorité</Label>
                            <Select defaultValue="Medium">
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Low">🟢 Faible</SelectItem>
                                <SelectItem value="Medium">🟡 Moyenne</SelectItem>
                                <SelectItem value="High">🟠 Élevée</SelectItem>
                                <SelectItem value="Critical">🔴 Critique</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Description / Livrables *</Label>
                          <Textarea
                            placeholder="Décrivez les objectifs, livrables et critères d'acceptation de ce jalon..."
                            value={st.description}
                            onChange={(e) =>
                              setSteps((prev) =>
                                prev.map((s, i) => (i === idx ? { ...s, description: e.target.value } : s)),
                              )
                            }
                            className={`min-h-[80px] ${!st.description ? "border-red-200 focus:border-red-400" : ""}`}
                          />
                          {!st.description && (
                            <p className="text-xs text-red-600">La description du jalon est requise</p>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Date de début *
                            </Label>
                            <Input
                              type="date"
                              value={st.startDate ? toInput(st.startDate) : ""}
                              onChange={(e) => {
                                const date = fromInput(e.target.value)
                                setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, startDate: date } : s)))
                              }}
                              min={toInput(formData.timeline[0])}
                              className={!st.startDate ? "border-red-200 focus:border-red-400" : ""}
                            />
                            {!st.startDate && (
                              <p className="text-xs text-red-600">La date de début est requise</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Date de fin *
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
                              className={!st.endDate ? "border-red-200 focus:border-red-400" : ""}
                            />
                            {!st.endDate && (
                              <p className="text-xs text-red-600">La date de fin est requise</p>
                            )}
                            {formData.timeline[10] && (
                              <p className="text-xs text-gray-500">
                                Date limite: {toInput(formData.timeline[10])}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {st.startDate && st.endDate && (
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <Clock className="h-4 w-4" />
                              <span>Durée estimée: {Math.ceil((st.endDate.getTime() - st.startDate.getTime()) / (1000 * 60 * 60 * 24))} jours</span>
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
                      Ajouter un jalon
                    </Button>
                    
                    {steps.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const projectStart = formData.timeline[0]
                          const projectEnd = formData.timeline[10]
                          if (!projectStart || !projectEnd) {
                            alert("Veuillez d'abord définir les dates de début et fin du projet")
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
                        Générer les dates automatiquement
                      </Button>
                    )}
                  </div>
                  
                  {steps.length === 0 && (
                    <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-lg">
                      <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun jalon défini</h3>
                      <p className="text-gray-500 mb-4">
                        Les jalons vous aident à suivre l'avancement de votre projet et à respecter les échéances importantes.
                      </p>
                      <Button
                        type="button"
                        onClick={() =>
                          setSteps([{ name: "", description: "", startDate: undefined, endDate: undefined }])
                        }
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Créer le premier jalon
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Documents Contractuels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Label>Documents (PDF Requis)</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Glissez vos fichiers ici ou cliquez pour sélectionner
                    </p>
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
                Annuler
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? "Enregistrement..." : "Enregistrer le projet"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
