"use client"

import type React from "react"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"

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
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { http } from "@/lib/http"
import jsPDF from "jspdf"
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
  const [projectSteps, setProjectSteps] = useState<ProjectStep[]>([])
  const [loadingSteps, setLoadingSteps] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>("details")
  const [editedProject, setEditedProject] = useState<Project>(project)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingExpenses, setLoadingExpenses] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([
    { id: 1, name: "Cahier des charges.pdf", type: "PDF", size: "2.5 MB", uploadDate: "2024-01-10" },
    { id: 2, name: "Maquettes UI.figma", type: "Figma", size: "15.2 MB", uploadDate: "2024-01-20" },
    { id: 3, name: "Contrat client.pdf", type: "PDF", size: "1.8 MB", uploadDate: "2024-01-05" },
  ])
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [newTransaction, setNewTransaction] = useState<{
    description: string
    amount: string
    type: "encaissement" | "depense"
    category: string
  }>({
    description: "",
    amount: "",
    type: "encaissement",
    category: "",
  })

  useEffect(() => {
    const fetchProjectSteps = async () => {
      if (!project.id || !project.departmentId) return

      setLoadingSteps(true)
      try {
        const { data: raw } = await http.get(`/api/management/departments/${project.departmentId}/projects/${project.id}/steps/`)
        const steps = raw?.results || raw
        setProjectSteps(Array.isArray(steps) ? steps : [])
      } catch (error) {
        console.error("Error fetching project steps:", error)
      } finally {
        setLoadingSteps(false)
      }
    }

    fetchProjectSteps()
  }, [project.id, project.departmentId])

  // Fetch project details to load contract_documents and related documents
  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!project.id || !project.departmentId) return
      setLoadingDocuments(true)
      try {
        const { data } = await http.get(`/api/management/departments/${project.departmentId}/projects/${project.id}/`)
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
            `/api/management/departments/${project.departmentId}/projects/${project.id}/steps/`,
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
  }, [project.id, project.departmentId])

  // Fetch project expenses from backend
  useEffect(() => {
    const refreshExpenses = async () => {
      if (!project.id || !project.departmentId) return
      setLoadingExpenses(true)
      try {
        const { data: raw } = await http.get(
          `/api/management/departments/${project.departmentId}/projects/${project.id}/expenses/`,
        )
        const list = raw?.results || raw || []
        const mapped: Transaction[] = (Array.isArray(list) ? list : [])
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
        setTransactions(mapped)
      } catch (err) {
        console.error("Error fetching project expenses:", err)
      } finally {
        setLoadingExpenses(false)
      }
    }

    refreshExpenses()
  }, [project.id, project.departmentId])

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === "string" ? Number.parseFloat(amount.replace(/[^\d.-]/g, "")) : amount
    return (
      new Intl.NumberFormat("fr-MA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numAmount) + " MAD"
    )
  }

  const totalBudgetNum =
    typeof project.totalBudget === "string"
      ? Number.parseFloat(project.totalBudget.replace(/[^\d.-]/g, ""))
      : project.totalBudget
  const remainingBudgetNum =
    typeof project.remainingBudget === "string"
      ? Number.parseFloat(project.remainingBudget.replace(/[^\d.-]/g, ""))
      : project.remainingBudget
  const spentBudget = totalBudgetNum - remainingBudgetNum
  const engagedBudget = 1500 // Sample engaged amount

  const handleDownloadPDF = (project: Project) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // --- Header ---
    doc.setFillColor(63, 81, 181)
    doc.rect(0, 0, pageWidth, 25, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.setTextColor(255, 255, 255)
    doc.text(project.name || "Projet", 15, 17)

    // --- Main details ---
    doc.setFont("helvetica", "normal")
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)

    const details: [string, string | number | undefined][] = [
      ["Code", project.code],
      ["Département", project.department],
      ["Coordinateur", project.coordinator],
      ["Client", project.client],
      ["Période", `${project.startDate} - ${project.endDate}`],
      ["Budget Total", project.totalBudget],
      ["Budget Restant", project.remainingBudget],
      ["Statut", project.status],
    ]

    let startY = 40
    details.forEach(([label, value], i) => {
      doc.setFont("helvetica", "bold")
      doc.text(`${label}:`, 15, startY + i * 8)
      doc.setFont("helvetica", "normal")
      doc.text(String(value ?? "-"), 55, startY + i * 8)
    })

    // --- Budget Ventilation ---
    if (project.budgetVentilation?.length) {
      startY += details.length * 8 + 10
      doc.setFont("helvetica", "bold")
      doc.text("Ventilation du Budget:", 15, startY)

      project.budgetVentilation.forEach((item, i) => {
        doc.setFont("helvetica", "normal")
        doc.text(`- ${item.label}: ${item.amount} MAD`, 20, startY + 8 + i * 6)
      })
      startY += project.budgetVentilation.length * 6 + 15
    }

    // --- Timeline ---
    if (project.timeline?.length) {
      doc.setFont("helvetica", "bold")
      doc.text("Timeline du Projet:", 15, startY)

      project.timeline.forEach((step, i) => {
        doc.setFont("helvetica", "normal")
        doc.text(`${step.step}: ${step.date}`, 20, startY + 8 + i * 6)
      })
    }

    // --- Footer ---
    doc.setFontSize(10)
    doc.setTextColor(150)
    doc.text("Generated by Business Management Dashboard", 15, 290)

    doc.save(`${project.code}.pdf`)
  }

  const handleSaveEdit = () => {
    // Here you would typically make an API call to save the changes
    setActiveTab("details")
  }

  const handleAddTransaction = () => {
    if (!newTransaction.description || !newTransaction.amount) return

    // Currently we only POST expenses (depense) to the backend endpoint
    if (newTransaction.type === "depense") {
      (async () => {
        try {
          if (!project.id || !project.departmentId) throw new Error("Project context missing")
          const payload = {
            description: newTransaction.description,
            amount: Number.parseFloat(newTransaction.amount),
            expense_date: new Date().toISOString().split("T")[0],
            category: newTransaction.category || "Autre",
            supplier: "",
            invoice_reference: "",
          }
          await http.post(
            `/api/management/departments/${project.departmentId}/projects/${project.id}/expenses/`,
            payload,
          )
          // refresh list
          const { data: raw } = await http.get(
            `/api/management/departments/${project.departmentId}/projects/${project.id}/expenses/`,
          )
          const list = raw?.results || raw || []
          const mapped: Transaction[] = (Array.isArray(list) ? list : [])
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
          setTransactions(mapped)
          setNewTransaction({ description: "", amount: "", type: "encaissement", category: "" })
        } catch (err) {
          console.error("Failed to create expense:", err)
          alert("Échec de la création de la dépense")
        }
      })()
    } else {
      // encaissements are not handled here yet; fallback to local add for now
      const transaction: Transaction = {
        id: Date.now(),
        date: new Date().toISOString().split("T")[0],
        description: newTransaction.description,
        amount: Number.parseFloat(newTransaction.amount),
        type: newTransaction.type,
        category: newTransaction.category || "Autre",
      }
      setTransactions([...transactions, transaction])
      setNewTransaction({ description: "", amount: "", type: "encaissement", category: "" })
    }
  }

  const handleDeleteTransaction = (id: number) => {
    ;(async () => {
      try {
        if (!project.id || !project.departmentId) throw new Error("Project context missing")
        await http.delete(
          `/api/management/departments/${project.departmentId}/projects/${project.id}/expenses/${id}/`,
        )
        // refresh
        const { data: raw } = await http.get(
          `/api/management/departments/${project.departmentId}/projects/${project.id}/expenses/`,
        )
        const list = raw?.results || raw || []
        const mapped: Transaction[] = (Array.isArray(list) ? list : [])
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
        setTransactions(mapped)
      } catch (err) {
        console.error("Failed to delete expense:", err)
        alert("Échec lors de la suppression de la dépense")
      }
    })()
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // upload contract document to project via PATCH
      ;(async () => {
        try {
          if (!project.id || !project.departmentId) throw new Error("Project context missing")
          const fd = new FormData()
          fd.append("contract_documents", file)
          // let axios/browser set Content-Type
          await http.patch(
            `/api/management/departments/${project.departmentId}/projects/${project.id}/`,
            fd,
          )
          // refresh documents
          const { data } = await http.get(`/api/management/departments/${project.departmentId}/projects/${project.id}/`)
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
          alert("Échec du téléchargement du document")
        }
      })()
    }
  }

  const handleDeleteDocument = async (doc: Document) => {
    if (!project.id || !project.departmentId) return
    // If it's the contract document (id === -1), clear it via PATCH
    try {
      if (doc.id === -1) {
        // send FormData with empty value to clear the file
        const fd = new FormData()
        // Some DRF setups accept an empty string to clear file fields
        fd.append("contract_documents", "")
        await http.patch(
          `/api/management/departments/${project.departmentId}/projects/${project.id}/`,
          fd,
        )
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
        return
      }

      // Otherwise, it may be a step proof; delete the step resource's file by PATCH-ing the step
      // Attempt to clear the step's execution_proof
      await http.patch(
        `/api/management/departments/${project.departmentId}/projects/${project.id}/steps/${doc.id}/`,
        { execution_proof: null },
      )
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (err) {
      console.error("Failed to delete document:", err)
      alert("Échec lors de la suppression du document")
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "edit":
        return (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Modifier le Projet</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nom du projet</Label>
                <Input
                  id="name"
                  value={editedProject.name}
                  onChange={(e) => setEditedProject({ ...editedProject, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="coordinator">Coordinateur</Label>
                  <Input
                    id="coordinator"
                    value={editedProject.coordinator}
                    onChange={(e) => setEditedProject({ ...editedProject, coordinator: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="client">Client</Label>
                  <Input
                    id="client"
                    value={editedProject.client || ""}
                    onChange={(e) => setEditedProject({ ...editedProject, client: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Date de début</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={editedProject.startDate}
                    onChange={(e) => setEditedProject({ ...editedProject, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">Date de fin</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={editedProject.endDate}
                    onChange={(e) => setEditedProject({ ...editedProject, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="totalBudget">Budget total</Label>
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
                <Button onClick={handleSaveEdit}>Sauvegarder</Button>
                <Button  onClick={() => setActiveTab("details")}>
                  Annuler
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
              <h3 className="text-lg font-semibold">Encaissements</h3>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total encaissé</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalEncaissements)}</p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-3">Ajouter un encaissement</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  placeholder="Description"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                />
                <Input
                  placeholder="Montant"
                  type="number"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                />
                <Input
                  placeholder="Catégorie"
                  value={newTransaction.category}
                  onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                />
                <Button
                  onClick={() => {
                    setNewTransaction({ ...newTransaction, type: "encaissement" })
                    handleAddTransaction()
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {encaissements.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-sm text-gray-600">
                      {transaction.date} • {transaction.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-green-600">+{formatCurrency(transaction.amount)}</span>
                    <Button size="sm"  onClick={() => handleDeleteTransaction(transaction.id)}>
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
            departmentId={project.departmentId!}
            projectEndDate={project.endDate}
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
              <h3 className="text-lg font-semibold">Dépenses</h3>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total dépensé</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalDepenses)}</p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-3">Ajouter une dépense</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  placeholder="Description"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                />
                <Input
                  placeholder="Montant"
                  type="number"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                />
                <Input
                  placeholder="Catégorie"
                  value={newTransaction.category}
                  onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                />
                <Button
                  onClick={() => {
                    setNewTransaction({ ...newTransaction, type: "depense" })
                    handleAddTransaction()
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {loadingExpenses ? (
                <p className="text-gray-600">Chargement des dépenses...</p>
              ) : depenses.length === 0 ? (
                <p className="text-gray-600">Aucune dépense enregistrée pour ce projet.</p>
              ) : (
                depenses.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{transaction.description || "-"}</p>
                      <p className="text-sm text-gray-600">
                        {transaction.date} • {transaction.category || "-"}
                      </p>
                      {transaction.supplier && (
                        <p className="text-xs text-gray-500">Fournisseur: {transaction.supplier}</p>
                      )}
                      {transaction.invoice_reference && (
                        <p className="text-xs text-gray-500">Réf. facture: {transaction.invoice_reference}</p>
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
                      <Button size="sm" onClick={() => handleDeleteTransaction(transaction.id)}>
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
              <h3 className="text-lg font-semibold">Documents du Projet</h3>
              <div>
                <input type="file" id="file-upload" className="hidden" onChange={handleFileUpload} />
                <Button onClick={() => document.getElementById("file-upload")?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Télécharger
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingDocuments ? (
                <p className="text-gray-600 col-span-3">Chargement des documents...</p>
              ) : documents.length === 0 ? (
                <p className="text-gray-600 col-span-3">Aucun document disponible pour ce projet.</p>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <FileText className="h-8 w-8 text-blue-500" />
                      <Badge variant="secondary">{doc.type}</Badge>
                    </div>
                    <h4 className="font-medium text-sm mb-1 truncate">{doc.name}</h4>
                    <p className="text-xs text-gray-600 mb-2">{doc.size}</p>
                    <p className="text-xs text-gray-500 mb-3">{doc.uploadDate ? `Ajouté le ${new Date(doc.uploadDate).toLocaleDateString("fr-FR")}` : ""}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-transparent"
                        onClick={() => doc.url && window.open(doc.url, "_blank")}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Voir
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
        className="relative bg-white rounded-xl shadow-lg w-[95%] md:w-[900px] max-h-[90vh] overflow-y-auto"
      >
        <div className="bg-white rounded-t-xl p-6 border-b">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <Button size="sm">
              <Eye className="h-4 w-4 mr-2" />
              {project.status}
            </Button>
          </div>

          <p className="text-sm text-gray-600 mb-6">{project.code}</p>

          {/* Project Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="p-2 bg-blue-100 rounded-full">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase">Coordinateur</p>
                <p className="font-medium text-gray-900">{project.coordinator}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="p-2 bg-blue-100 rounded-full">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase">Département</p>
                <p className="font-medium text-gray-900">{project.department}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="p-2 bg-blue-100 rounded-full">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase">Période</p>
                <p className="font-medium text-gray-900">
                  {project.startDate} - {project.endDate}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="p-2 bg-blue-100 rounded-full">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase">Client</p>
                <p className="font-medium text-gray-900">{project.client}</p>
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <div className="bg-green-100 border border-green-200 rounded-lg p-3 mb-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800 font-medium">
                Il reste 74 jours avant la fin prévue du projet. La progression est conforme au planning.
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              
              size="sm"
              onClick={() => setActiveTab("details")}
            >
              <Eye className="h-4 w-4 mr-2" />
              Détails
            </Button>
            <Button
             
              size="sm"
              onClick={() => setActiveTab("edit")}
            >
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
            <Button
              
              size="sm"
              onClick={() => setActiveTab("jalons")}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Jalons
            </Button>
            <Button
              
              size="sm"
              onClick={() => setActiveTab("encaissements")}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Encaissements
            </Button>
            <Button
             
              size="sm"
              onClick={() => setActiveTab("depenses")}
            >
              <FileText className="h-4 w-4 mr-2" />
              Dépenses
            </Button>
            <Button
    
              size="sm"
              onClick={() => setActiveTab("documents")}
            >
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {activeTab === "details" ? (
            <>
              <Card className="p-6">
                <div className="text-center mb-6">
                  <h2 className="text-lg font-semibold text-gray-700 mb-2">Budget Total</h2>
                  <div className="text-3xl font-bold text-blue-600 mb-4">{formatCurrency(project.totalBudget)}</div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Dépensé</p>
                      <p className="font-semibold">{formatCurrency(spentBudget)}</p>
                      <p className="text-xs text-gray-500">{((spentBudget / totalBudgetNum) * 100).toFixed(0)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Engagé</p>
                      <p className="font-semibold">{formatCurrency(engagedBudget)}</p>
                      <p className="text-xs text-gray-500">{((engagedBudget / totalBudgetNum) * 100).toFixed(2)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Disponible</p>
                      <p className="font-semibold">{formatCurrency(project.remainingBudget)}</p>
                      <p className="text-xs text-gray-500">
                        {((remainingBudgetNum / totalBudgetNum) * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Budget Dépensé</span>
                    </div>
                    <Progress value={(spentBudget / totalBudgetNum) * 100} className="h-2" />

                    <div className="flex justify-between text-sm">
                      <span>Budget Engagé</span>
                    </div>
                    <Progress value={(engagedBudget / totalBudgetNum) * 100} className="h-2" />
                  </div>
                </div>
              </Card>

              {project.budgetVentilation && project.budgetVentilation.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Ventilation du Budget</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {project.budgetVentilation.map((item, idx) => {
                      const colorClasses: Record<string, string> = {
                        green: "border-green-200 bg-green-50",
                        blue: "border-blue-200 bg-blue-50",
                        purple: "border-purple-200 bg-purple-50",
                        orange: "border-orange-200 bg-orange-50",
                        red: "border-red-200 bg-red-50",
                        gray: "border-gray-200 bg-gray-50",
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
                          <p className="text-sm text-gray-600">
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
                  <h3 className="text-lg font-semibold mb-4">Timeline du Projet</h3>
                  <div className="flex flex-wrap gap-4 justify-center">
                    {project.timeline.map((step, index) => (
                      <div key={index} className="flex flex-col items-center space-y-2 min-w-[100px]">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            step.completed ? "bg-blue-100" : "bg-gray-100"
                          }`}
                        >
                          <User className={`h-6 w-6 ${step.completed ? "text-blue-600" : "text-gray-400"}`} />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-medium text-gray-900">{step.step}</p>
                          <p className="text-xs text-gray-600">{step.date || "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Jalons / Étapes du Projet</h3>
                {loadingSteps ? (
                  <p className="text-gray-600">Chargement des jalons...</p>
                ) : projectSteps.length > 0 ? (
                  <div className="space-y-4">
                    {projectSteps.map((step, index) => (
                      <div key={step.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{step.name}</h4>
                          <Badge variant={step.execution_status ? "default" : "secondary"}>
                            {step.execution_status ? "Terminé" : "En cours"}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Début: {new Date(step.start_date).toLocaleDateString("fr-FR")}</span>
                          <span>Fin: {new Date(step.end_date).toLocaleDateString("fr-FR")}</span>
                        </div>
                        {step.execution_proof && (
                          <div className="mt-2">
                            <Button size="sm">
                              <FileText className="h-4 w-4 mr-2" />
                              Voir la preuve d'exécution
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600">Aucun jalon n'a été défini pour ce projet.</p>
                )}
              </Card>
            </>
          ) : (
            renderTabContent()
          )}

          {/* Footer actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex gap-2">
              <Badge variant="secondary">Visualisation</Badge>
              <Badge >Projet #{project.code}</Badge>
            </div>
            <Button onClick={() => handleDownloadPDF(project)} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Télécharger PDF
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
