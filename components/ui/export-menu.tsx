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
import { useLanguage } from "@/lib/language-context"

interface ExportMenuProps {
  user: any
}

export function ExportMenu({ user }: ExportMenuProps) {
  const { t } = useLanguage()
  const [isExporting, setIsExporting] = useState<string | null>(null)

  const handleExport = async (exportType: string, exportFunction: () => Promise<void>) => {
    if (!user) {
      alert(t('export.errorNotLoggedIn'))
      return
    }

    setIsExporting(exportType)
    try {
      await exportFunction()
      alert(t('export.success'))
    } catch (error) {
      console.error(`Export failed (${exportType}):`, error)
      const errorMessage = error instanceof Error ? error.message : t('export.unexpectedError')
      alert(`${t('export.errorPrefix')}: ${errorMessage}`)
    } finally {
      setIsExporting(null)
    }
  }

  const exportOptions = [
    {
      key: "projects",
      label: t('export.options.projects.label'),
      description: t('export.options.projects.description'),
      icon: FolderOpen,
      action: () => exportProjectsServerCSV()
    },
    {
      key: "expenses",
      label: t('export.options.expenses.label'),
      description: t('export.options.expenses.description'),
      icon: Receipt,
      action: () => exportExpensesServerCSV()
    },
    {
      key: "payments",
      label: t('export.options.payments.label'),
      description: t('export.options.payments.description'),
      icon: CreditCard,
      action: () => exportPaymentsServerCSV()
    },
    {
      key: "jalons",
      label: t('export.options.jalons.label'),
      description: t('export.options.jalons.description'),
      icon: Calendar,
      action: () => exportJalonsServerCSV()
    },
    {
      key: "dashboard",
      label: t('export.options.dashboard.label'),
      description: t('export.options.dashboard.description'),
      icon: Database,
      action: () => exportDashboardSummaryCSV()
    },
    {
      key: "complete",
      label: t('export.options.complete.label'),
      description: t('export.options.complete.description'),
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
          {isExporting ? t('export.exporting') : t('export.exportData')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          {t('export.exportCsv')}
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
            {t('export.note')}
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ExportMenu