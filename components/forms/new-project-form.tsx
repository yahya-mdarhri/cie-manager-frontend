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
import { CalendarIcon, Plus, Upload, ChevronDown, ChevronRight, Info } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { useAuth } from "@/lib/auth-context"

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
  const [steps, setSteps] = useState<Array<{ jalon: string; livrable: string; file: File | null }>>([
    { jalon: "", livrable: "", file: null },
  ])

  const toInput = (d?: Date) => {
    if (!d) return ""
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
  const fromInput = (v: string) => {
    if (!v) return undefined
    const [y, m, day] = v.split("-").map((n) => parseInt(n, 10))
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
        if (user?.role === "department_manager" && user.department) {
          const res = await fetch(`http://localhost:8000/api/management/departments/${user.department}/`, {
            credentials: "include",
          })
          if (res.ok) {
            const dep = await res.json()
            if (allowed.has(dep.name)) {
              setDepartments([dep])
              setFormData((prev) => ({ ...prev, department: String(dep.id) }))
            } else {
              setDepartments([])
            }
          } else {
            setDepartments([])
          }
          return
        }
        const res = await fetch("http://localhost:8000/api/management/departments/", { credentials: "include" })
        if (res.ok) {
          const all = await res.json()
          const data = (Array.isArray(all) ? all : []).filter((d: any) => allowed.has(d.name))
          setDepartments(data)
          setFormData((prev) =>
            !prev.department && data.length > 0 ? { ...prev, department: String(data[0].id) } : prev,
          )
        } else {
          setDepartments([])
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
        const dep = departments.find((d) => String(d.id) === String(formData.department))
        departmentId = dep?.id ?? null
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

      const res = await fetch(`http://localhost:8000/api/management/departments/${departmentId}/projects/create/`, {
        method: "POST",
        credentials: "include",
        body: fd,
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => "")
        let details = "Échec de création du projet"
        try {
          const errJson = JSON.parse(errText)
          details = errJson.details || errText
        } catch {
          details = errText || details
        }
        throw new Error(details)
      }
      // Try to locate created project id via project_code
      let createdProjectId: number | null = null
      try {
        const listRes = await fetch(`http://localhost:8000/api/management/departments/${departmentId}/projects/`, { credentials: "include" })
        if (listRes.ok) {
          const projs = await listRes.json()
          const found = Array.isArray(projs) ? projs.find((p: any) => String(p.project_code) === String(formData.code)) : null
          if (found?.id) createdProjectId = Number(found.id)
        }
      } catch {}

      // Create steps (jalons) if provided
      if (createdProjectId) {
        const validSteps = steps.filter((s) => s.jalon || s.livrable)
        for (const s of validSteps) {
          const fdStep = new FormData()
          fdStep.append("jalon", s.jalon)
          fdStep.append("livrable", s.livrable)
          if (s.file) fdStep.append("preuve_execution", s.file)
          try {
            await fetch(
              `http://localhost:8000/api/management/departments/${departmentId}/projects/${createdProjectId}/steps/create/`,
              { method: "POST", credentials: "include", body: fdStep }
            )
          } catch {}
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
                <CardTitle className="text-lg">Étapes / Jalons du Projet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Label>Ajouter les jalons du projet et leurs livrables</Label>
                  {steps.map((st, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                      <Input
                        placeholder={`Jalon ${idx + 1}`}
                        value={st.jalon}
                        onChange={(e) => setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, jalon: e.target.value } : s)))}
                      />
                      <Input
                        placeholder="Livrables du jalon"
                        value={st.livrable}
                        onChange={(e) => setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, livrable: e.target.value } : s)))}
                      />
                      <Input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, file: e.target.files?.[0] || null } : s)))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Retirer
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => setSteps((prev) => [...prev, { jalon: "", livrable: "", file: null }])}>
                      <Plus className="h-4 w-4" />
                      Ajouter un jalon
                    </Button>
                  </div>
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
