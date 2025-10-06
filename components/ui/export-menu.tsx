"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Download, 
  FileSpreadsheet, 
  FolderOpen, 
  Receipt, 
  CreditCard, 
  Calendar,
  Database,
  Loader2
} from "lucide-react"
import { 
  exportProjectsServerCSV, 
  exportExpensesServerCSV, 
  exportPaymentsServerCSV, 
  exportJalonsServerCSV,
  exportCompleteDataServerCSV,
  exportDashboardSummaryCSV
} from "@/lib/csv-export"

interface ExportMenuProps {
  user: any
}

export function ExportMenu({ user }: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null)

  const handleExport = async (exportType: string, exportFunction: () => Promise<void>) => {
    if (!user) {
      alert("Erreur: Utilisateur non connecté")
      return
    }

    setIsExporting(exportType)
    try {
      await exportFunction()
      alert("Export réussi: Les données ont été exportées avec succès")
    } catch (error) {
      console.error(`Export failed (${exportType}):`, error)
      const errorMessage = error instanceof Error ? error.message : "Une erreur inattendue s'est produite"
      alert(`Erreur d'export: ${errorMessage}`)
    } finally {
      setIsExporting(null)
    }
  }

  const exportOptions = [
    {
      key: "projects",
      label: "Projets",
      description: "Exporter tous les projets",
      icon: FolderOpen,
      action: () => exportProjectsServerCSV()
    },
    {
      key: "expenses",
      label: "Dépenses",
      description: "Exporter toutes les dépenses",
      icon: Receipt,
      action: () => exportExpensesServerCSV()
    },
    {
      key: "payments",
      label: "Encaissements",
      description: "Exporter tous les encaissements",
      icon: CreditCard,
      action: () => exportPaymentsServerCSV()
    },
    {
      key: "jalons",
      label: "Jalons",
      description: "Exporter tous les jalons",
      icon: Calendar,
      action: () => exportJalonsServerCSV()
    },
    {
      key: "dashboard",
      label: "Résumé Dashboard",
      description: "Exporter le résumé du tableau de bord",
      icon: Database,
      action: () => exportDashboardSummaryCSV()
    },
    {
      key: "complete",
      label: "Données complètes",
      description: "Exporter toutes les données (5 fichiers)",
      icon: Database,
      action: () => exportCompleteDataServerCSV(),
      separator: true
    }
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="flex items-center gap-2" disabled={isExporting !== null}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isExporting ? "Export en cours..." : "Exporter les données"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Export CSV
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {exportOptions.map((option) => (
          <React.Fragment key={option.key}>
            {option.separator && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => handleExport(option.key, option.action)}
              disabled={isExporting !== null}
              className="flex items-start gap-3 p-3 cursor-pointer"
            >
              <option.icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </div>
              {isExporting === option.key && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
        
        <DropdownMenuSeparator />
        <div className="px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Les fichiers CSV sont compatibles avec Excel, Google Sheets et autres tableurs.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ExportMenu