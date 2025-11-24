"use client"

import { useEffect, useState } from "react"
import { FilterBar } from "@/components/ui/filter-bar"
import { DataTable } from "@/components/ui/data-table"
import { Pagination } from "@/components/ui/pagination"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { usePagination } from "@/hooks/use-pagination"
import { http } from "@/lib/http"
import { mapDepartmentLabel } from "@/lib/constants"

// Helper: fetch project-level endpoints in limited-size batches to avoid serial long-running loops
async function fetchProjectPaymentsInBatches(base: string, depId: string, projects: any[], params: Record<string, any> = {}, batchSize = 5) {
  const allPayments: any[] = [];
  for (let i = 0; i < projects.length; i += batchSize) {
    const batch = projects.slice(i, i + batchSize).map((p) => {
      const url = `${base}/departments/${depId}/projects/${p.id}/payments/`;
      return http.get(url, { params }).then((r) => ({ project: p, data: r.data })).catch(() => ({ project: p, data: { results: [] } }));
    });

    const results = await Promise.all(batch);
    results.forEach((res: any) => {
      const payments = (res.data && (res.data.results || res.data)) || [];
      payments.forEach((pr: any) => {
        allPayments.push({
          ...pr,
          project_name: res.project.project_name,
          project_code: res.project.project_code,
          projectDepartment: res.project.department?.name || "",
          projectCoordinator: res.project.coordinator || "",
        });
      });
    });
  }

  return allPayments;
}

async function fetchRevenuesForUser(
  user: { role: string; department?: string | number | null },
  page: number = 1,
  pageSize: number = 10,
  filters: Record<string, string> = {},
) {
  const base = "/api/management"
  const allowedDepartments = new Set(["CIE Direct", "Tech Center", "TTO", "Clinique Industrielle"]) 
  const formatMoney = (n: number) => Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "MAD" })
  const typeBadge = (t?: string) => <Badge variant="default">{t || "-"}</Badge>

  // For directors, use the all payments endpoint for proper pagination
  if (user.role === "director") {
    const params: Record<string, any> = { page, size: pageSize };
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (!v) return;
      if (v === "all") return;
      params[k] = v;
    });

    const { data: raw } = await http.get(`${base}/all/payments/`, { params })
    const payments = raw.results || raw
    
    const rows = payments.map((pr: any) => ({
      project: pr.project?.project_name || "N/A",
      code: pr.project?.project_code || "N/A",
      date: pr.payment_received_date,
      amount: formatMoney(pr.amount),
      amountValue: Number(pr.amount || 0),
      paymentType: typeBadge(pr.payment_type),
      client: pr.client_display || "-",
      reference: pr.payment_reference || "-",
      description: pr.description || "-",
      // Additional fields for filtering
      projectDepartment: pr.project?.department?.name || "",
      projectCoordinator: pr.project?.coordinator || "",
      paymentTypeText: pr.payment_type || "",
    }))

    return { rows, pagination: raw }
  }

  // For department managers, fetch from their department's projects
  if (user.role === "department_manager" && user.department) {
    const depId =
      typeof user.department === "object"
        ? String((user.department as any)?.id ?? (user.department as any)?.pk ?? "")
        : String(user.department ?? "")

    if (!depId) return { rows: [], pagination: {} }

    // First get all projects for the department
    const { data: projectsRaw } = await http.get(`${base}/departments/${depId}/projects/`, { params: { page: 1, size: 100 } })
    let projects = projectsRaw.results || projectsRaw

    // Coordinator filter optimization: skip unrelated projects
    if (filters.coordinator && filters.coordinator !== 'all') {
      const coordFilter = filters.coordinator.trim().toLowerCase()
      projects = projects.filter((p: any) => (p.coordinator || '').trim().toLowerCase() === coordFilter)
    }

    // Collect all payments from all projects
    const paramsForProjects: Record<string, any> = { page: 1, size: 100 };
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (!v || v === 'all') return
      // pass only supported project-level payment filters
      if (['startDate', 'endDate', 'paymentType'].includes(k)) {
        paramsForProjects[k] = v
      }
    });

    const allPayments: any[] = await fetchProjectPaymentsInBatches(base, depId, projects, paramsForProjects, 5);

    // Implement frontend pagination for department managers
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedPayments = allPayments.slice(startIndex, endIndex)

    const rows = paginatedPayments.map((pr: any) => ({
      project: pr.project_name,
      code: pr.project_code,
      date: pr.payment_received_date,
      amount: formatMoney(pr.amount),
      amountValue: Number(pr.amount || 0),
      paymentType: typeBadge(pr.payment_type),
      client: pr.client_display || "-",
      reference: pr.payment_reference || "-",
      description: pr.description || "-",
      // Additional fields for filtering
      projectDepartment: pr.projectDepartment || "",
      projectCoordinator: pr.projectCoordinator || "",
      paymentTypeText: pr.payment_type || "",
    }))

        return { 
          rows, 
          pagination: { 
            page, 
            total: Math.ceil(allPayments.length / pageSize), 
            count: allPayments.length 
          } 
        }
  }

  return { rows: [], pagination: {} }
}

export default function RevenuesPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { pagination, goToPage, updateFromResponse } = usePagination(10)
  const [rows, setRows] = useState<any[]>([])
  const [allRows, setAllRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [filterOptions, setFilterOptions] = useState<any>({ departments: [], coordinators: [], paymentTypes: [] })

  const filterFields = [
    { type: "date" as const, key: "startDate", label: t("revenues.startDate"), placeholder: "dd/mm/yyyy" },
    { type: "date" as const, key: "endDate", label: t("revenues.endDate"), placeholder: "dd/mm/yyyy" },
    {
      type: "select" as const,
      key: "department",
      label: t("common.department"),
      placeholder: t("common.all"),
      options: [
        { value: "all", label: t("common.all") },
        ...filterOptions.departments.map((d: string) => ({ value: d, label: mapDepartmentLabel(d) })),
      ],
    },
    {
      type: "select" as const,
      key: "coordinator",
      label: t("common.coordinator"),
      placeholder: t("common.all"),
      options: [
        { value: "all", label: t("common.all") },
        ...filterOptions.coordinators.map((c: string) => ({ value: c, label: c })),
      ],
    },
    {
      type: "select" as const,
      key: "paymentType",
      label: t("revenues.paymentType"),
      placeholder: t("common.all"),
      options: [
        { value: "all", label: t("common.all") },
        ...filterOptions.paymentTypes.map((p: string) => ({ value: p, label: p })),
      ],
    },
  ]

  const columns = [
    { key: "project", label: t("revenues.project") },
    { key: "code", label: t("revenues.projectCode") },
    { key: "date", label: t("revenues.date") },
    { key: "amount", label: t("revenues.amount"), className: "text-right font-medium text-green-600" },
    { key: "paymentType", label: t("revenues.paymentType") },
    { key: "client", label: t("projects.client") },
    { key: "reference", label: t("revenues.reference") },
    { key: "description", label: t("revenues.description") },
  ]

  const applyFilters = (data: any[], currentFilters: Record<string, string>) => {
    return data.filter((row) => {
      // Date range filter
      if (currentFilters.startDate) {
        const rowDate = new Date(row.date)
          const startDate = new Date(currentFilters.startDate)
          rowDate.setHours(0, 0, 0, 0);
          startDate.setHours(0, 0, 0, 0);
          if (rowDate < startDate) return false
      }
      if (currentFilters.endDate) {
        const rowDate = new Date(row.date)
        const endDate = new Date(currentFilters.endDate)
        if (rowDate > endDate) return false
      }

      // Department filter
      if (currentFilters.department && currentFilters.department !== "all") {
        const projectDepartment = row.projectDepartment || ""
          const filterDepartment = currentFilters.department.trim();
          if (!projectDepartment || projectDepartment.toLowerCase() !== filterDepartment.toLowerCase()) return false;
      }

      // Coordinator filter
      if (currentFilters.coordinator && currentFilters.coordinator !== "all") {
        const projectCoordinator = row.projectCoordinator || ""
          const filterCoordinator = currentFilters.coordinator.trim();
          if (!projectCoordinator || projectCoordinator.toLowerCase() !== filterCoordinator.toLowerCase()) return false;
      }

      // Payment type filter
      if (currentFilters.paymentType && currentFilters.paymentType !== "all") {
        const paymentTypeText = row.paymentTypeText || ""
          const filterPayment = currentFilters.paymentType.toLowerCase();
          if (!paymentTypeText || (paymentTypeText !== filterPayment && !paymentTypeText.includes(filterPayment))) return false;
      }

      return true
    })
  }

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoading(true)
      try {
        let globalLoaded = false
        // Load global filter options (departments/coordinators/payment types)
        try {
          const { data: globalFilters } = await http.get('/api/management/all/filters/')
          const sanitize = (arr: any[]) => Array.from(new Set((arr || []).map(a => (a || '').trim()))).filter(Boolean).sort((a,b)=>a.localeCompare(b))
          setFilterOptions({ 
            departments: sanitize(globalFilters.departments || []), 
            coordinators: sanitize(globalFilters.coordinators || []), 
            paymentTypes: sanitize(globalFilters.payment_types || []) 
          })
          globalLoaded = true
        } catch (e) {
          // ignore; will derive from returned data below if request fails
        }
        if (user.role === "director") {
          const { rows: recs, pagination: pag } = await fetchRevenuesForUser(user, 1, pagination.pageSize, filters)
          setRows(recs)
          // Fallback derive only if global options not loaded
          if (!globalLoaded) {
            const sanitize = (arr: any[]) => Array.from(new Set(arr.map(a => (a || '').trim()))).filter(Boolean).sort((a,b)=>a.localeCompare(b))
            const deps = sanitize(recs.map((r: any) => r.projectDepartment).filter(Boolean))
            const coords = sanitize(recs.map((r: any) => r.projectCoordinator).filter(Boolean))
            const ptypes = sanitize(recs.map((r: any) => r.paymentTypeText).filter(Boolean))
            setFilterOptions({ departments: deps, coordinators: coords, paymentTypes: ptypes })
          }
          updateFromResponse({ page: pag.page || 1, total: pag.total || 1, count: pag.count || 0 })
        } else {
          const data = await fetchRevenuesForUser(user, 1, 1000, filters) // Load more data for filtering
          setAllRows(data.rows)
          const filteredData = applyFilters(data.rows, filters)
          setRows(filteredData.slice(0, pagination.pageSize))
          updateFromResponse({ page: 1, total: Math.ceil(filteredData.length / pagination.pageSize), count: filteredData.length })
          const deps = Array.from(new Set(data.rows.map((r: any) => r.projectDepartment).filter(Boolean)))
          const coords = Array.from(new Set(data.rows.map((r: any) => r.projectCoordinator).filter(Boolean)))
          const ptypes = Array.from(new Set(data.rows.map((r: any) => r.paymentTypeText).filter(Boolean)))
          // Fallback only if global fetch failed
          if (!globalLoaded) {
            const sanitize = (arr: any[]) => Array.from(new Set(arr.map(a => (a || '').trim()))).filter(Boolean).sort((a,b)=>a.localeCompare(b))
            setFilterOptions({ departments: sanitize(deps), coordinators: sanitize(coords), paymentTypes: sanitize(ptypes) })
          }
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoading(true)
      try {
        if (user.role === "director") {
          const { rows: recs, pagination: pag } = await fetchRevenuesForUser(user, pagination.currentPage, pagination.pageSize, filters)
          setRows(recs)
          // avoid resetting allRows here to prevent effect retrigger
          updateFromResponse({ page: pag.page || pagination.currentPage, total: pag.total || 1, count: pag.count || 0 })
        } else {
          const filteredData = applyFilters(allRows, filters)
          const startIndex = (pagination.currentPage - 1) * pagination.pageSize
          const endIndex = startIndex + pagination.pageSize
          setRows(filteredData.slice(startIndex, endIndex))
          updateFromResponse({ 
            page: pagination.currentPage, 
            total: Math.ceil(filteredData.length / pagination.pageSize), 
            count: filteredData.length 
          })
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filters, pagination.currentPage, pagination.pageSize])

  const handlePageChange = (page: number) => {
    goToPage(page)
  }

  const handleFilter = (newFilters: Record<string, string>) => {
    setFilters(newFilters)
    goToPage(1) // Reset to first page when filtering
  }

  const handleReset = () => {
    setFilters({})
    goToPage(1)
  }

  const totalAmount = rows.reduce((sum, r: any) => sum + Number(r.amountValue || 0), 0)
  const totalAmountStr = Number(totalAmount).toLocaleString("fr-FR", { style: "currency", currency: "MAD" })
  const summary = [
    { label: t("revenues.totalRevenues"), value: String(rows.length) },
    { label: t("revenues.totalAmount"), value: totalAmountStr },
    { label: t("revenues.projectsInvolved"), value: String(new Set(rows.map((r) => r.code)).size) },
  ]

  // Project-level aggregates for revenues (current filtered page dataset)
  const projectAggregates = (() => {
    const map: Record<string, { project: string; code: string; total: number; count: number }> = {};
    rows.forEach((r: any) => {
      const key = r.code || r.project;
      if (!map[key]) {
        map[key] = { project: r.project, code: r.code, total: 0, count: 0 };
      }
      map[key].total += Number(r.amountValue || 0);
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => a.project.localeCompare(b.project));
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("revenues.title")}</h1>
        <p className="text-muted-foreground">{t("revenues.subtitle")}</p>
      </div>

      {/* Hide department filter for department managers (they only see their own dept) */}
      <FilterBar
        fields={user?.role === "department_manager" ? filterFields.filter(f => f.key !== "department") : filterFields}
        onFilter={handleFilter}
        onReset={handleReset}
      />

  <DataTable title={t("revenues.listTitle")} columns={columns} data={rows} summary={summary} loading={loading} tableId="revenues" />

      {/* Empty state when department filter yields no results */}
      {!loading && rows.length === 0 && filters.department && filters.department !== 'all' && (
        <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
          {t('revenues.noDepartmentResults') || 'Aucun encaissement trouvé pour le département sélectionné.'}
        </div>
      )}

      {!loading && projectAggregates.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">{t('revenues.projectTotals') || 'Totaux par projet (page filtrée)'}</h2>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">{t('revenues.project') || 'Projet'}</th>
                  <th className="text-left p-2">{t('revenues.projectCode') || 'Code'}</th>
                  <th className="text-right p-2">{t('revenues.totalAmount') || 'Montant total'}</th>
                  <th className="text-right p-2">{t('revenues.revenuesCount') || 'Nombre encaissements'}</th>
                </tr>
              </thead>
              <tbody>
                {projectAggregates.map(agg => (
                  <tr key={agg.code} className="border-t">
                    <td className="p-2">{agg.project}</td>
                    <td className="p-2">{agg.code}</td>
                    <td className="p-2 text-right font-medium text-green-600">{agg.total.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })}</td>
                    <td className="p-2 text-right">{agg.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {t("revenues.showing")} {rows.length} {t("revenues.revenuesOf")} {pagination.totalCount} {t("revenues.total")}
        </div>
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  )
}
