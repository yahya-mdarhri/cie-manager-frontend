"use client"

import React, { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Column {
  key: string
  label: string
  className?: string
}

interface DataTableProps {
  title: string
  columns: Column[]
  data: Record<string, any>[]
  summary?: Array<{
    label: string
    value: string
    className?: string
  }>
  loading?: boolean
  /** optional identifier used to persist per-table column visibility in localStorage */
  tableId?: string
}

export function DataTable({ title, columns, data, summary, loading = false, tableId }: DataTableProps) {
  const [visibleColumns, setVisibleColumns] = useState<string[] | null>(null)

  const metaKey = tableId ? `table-columns-meta:${tableId}` : null
  const visibleKey = tableId ? `table-columns-visible:${tableId}` : null

  // Initialize localStorage metadata and visible columns when tableId is provided
  useEffect(() => {
    if (!tableId) return

    try {
      const existingMeta = localStorage.getItem(metaKey!)
      if (!existingMeta) {
        // store the columns metadata so SettingsDialog can read labels
        localStorage.setItem(metaKey!, JSON.stringify(columns.map((c) => ({ key: c.key, label: c.label }))))
      }

      const existingVisible = localStorage.getItem(visibleKey!)
      if (existingVisible) {
        setVisibleColumns(JSON.parse(existingVisible))
      } else {
        const defaults = columns.map((c) => c.key)
        localStorage.setItem(visibleKey!, JSON.stringify(defaults))
        setVisibleColumns(defaults)
      }
    } catch (e) {
      // ignore storage errors
      setVisibleColumns(columns.map((c) => c.key))
    }

    const handler = (ev: Event) => {
      // Custom event used by SettingsDialog to notify updates
      try {
        const ce = ev as CustomEvent<{ tableId: string }>
        if (ce.detail?.tableId === tableId) {
          const v = localStorage.getItem(visibleKey!)
          if (v) setVisibleColumns(JSON.parse(v))
        }
      } catch {
        // ignore
      }
    }

    window.addEventListener("table-columns-updated", handler as EventListener)
    return () => window.removeEventListener("table-columns-updated", handler as EventListener)
  }, [tableId, metaKey, visibleKey, columns])

  const renderedColumns = (visibleColumns ?? columns.map((c) => c.key)).map((key) => columns.find((c) => c.key === key)!).filter(Boolean)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {summary.map((item, index) => (
              <div key={index} className="text-center p-4 bg-muted/50 rounded-lg">
                <p className={`text-2xl font-bold ${item.className || 'text-primary'}`}>{item.value}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {renderedColumns.map((column) => (
                  <TableHead key={column.key} className={column.className}>
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={renderedColumns.length} className="text-center py-8 text-muted-foreground">
                    Chargement en cours...
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={renderedColumns.length} className="text-center py-8 text-muted-foreground">
                    Aucune donnée disponible pour la période sélectionnée.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, index) => (
                  <TableRow key={index} className="hover:bg-muted/40 transition-colors">
                    {renderedColumns.map((column) => (
                      <TableCell key={column.key} className={column.className}>
                        {row[column.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
